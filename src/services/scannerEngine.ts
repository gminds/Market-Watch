import {
  Candle,
  MarketProfileData,
  QualityRating,
  ScannerAlertAction,
  ScannerPairItem,
  SymbolCode,
  UserSettings,
} from '../types/market';
import { getAvailableSymbols, getSymbolConfig } from '../config/symbols';
import { dataProviderService } from './dataProviders';
import { buildMarketProfile, getQualityRating, getShortShapeName } from './tpoEngine';
import { correlationEngine } from './correlationEngine';
import { alertEngine } from './alertEngine';
import { signalTrackerService } from './signalTrackerService';

export class ScannerEngine {
  private lastScannerItems: ScannerPairItem[] = [];
  private pairProfilesMap: Map<SymbolCode, MarketProfileData> = new Map();
  private pairCandlesMap: Map<SymbolCode, Candle[]> = new Map();

  /**
   * Runs scanner calculations across every supported pair loaded from config
   */
  public async runFullScan(settings: UserSettings): Promise<{
    items: ScannerPairItem[];
    profiles: Map<SymbolCode, MarketProfileData>;
  }> {
    const symbols = getAvailableSymbols();
    const todayStr = new Date().toISOString().split('T')[0];
    const items: ScannerPairItem[] = [];

    const existingAlerts = alertEngine.getAlertHistory();

    for (const symbol of symbols) {
      const config = getSymbolConfig(symbol);
      let candles = this.pairCandlesMap.get(symbol);

      if (!candles || candles.length === 0) {
        candles = await dataProviderService.fetchHistoricalCandles(symbol, 250, todayStr);
        this.pairCandlesMap.set(symbol, candles);
      } else {
        // Generate a subtle live tick to update candles with proper 1-min candle rolling
        const tick = dataProviderService.generateLiveTick(symbol);
        const lastIdx = candles.length - 1;
        const last = { ...candles[lastIdx] };
        const now = Date.now();

        if (now - last.timestamp >= 60000) {
          const timeStr = new Date(now).toISOString().substring(11, 16);
          const dateStr = new Date(now).toISOString().substring(0, 10);
          const newCandle: Candle = {
            timestamp: now,
            timeStr,
            dateStr,
            open: tick.price,
            high: tick.price,
            low: tick.price,
            close: tick.price,
            volume: tick.volume || 25,
          };
          candles.push(newCandle);
          if (candles.length > 300) {
            candles.shift();
          }
        } else {
          last.close = tick.price;
          const maxHigh = last.open + config.pipValue * 2.5;
          const minLow = last.open - config.pipValue * 2.5;
          last.high = Math.min(maxHigh, Math.max(last.high, tick.price));
          last.low = Math.max(minLow, Math.min(last.low, tick.price));
          candles[lastIdx] = last;
        }
      }

      // Calculate Market Profile
      const profile = buildMarketProfile(
        symbol,
        candles,
        todayStr,
        true,
        settings.sessionStartUTC || config.defaultSessionStart,
        settings.sessionEndUTC || config.defaultSessionEnd,
        settings.tpoPriceStepPips
      );

      this.pairProfilesMap.set(symbol, profile);

      // Continuously monitor live price against pending tracked signals for this symbol
      signalTrackerService.evaluatePriceUpdate(
        symbol,
        profile.close,
        profile.high,
        profile.low
      );

      // Determine Alert Action according to Prompt 5 (Gated at 85+ Quality Score)
      let alertAction: ScannerAlertAction = 'None';
      let suppressedReason: string | undefined = undefined;

      const isLong = profile.bias.includes('Bullish');
      const isShort = profile.bias.includes('Bearish');

      // Check Rule 1: Signal generation requires completed prior day Market Profile
      const isPrevProfileComplete = signalTrackerService.isPrevDayProfileComplete(symbol, profile);

      if (!isPrevProfileComplete) {
        alertAction = 'None';
        suppressedReason = 'Previous day Market Profile incomplete - awaiting prior session completion.';
      } else if (profile.marketScore >= 85) {
        const signalType = isLong ? 'BULLISH_IMBALANCE' : isShort ? 'BEARISH_IMBALANCE' : 'NO_TRADE';
        const candidateDirection = isLong ? 'LONG' : 'SHORT';

        // Check Rule 2: Only issue a new signal if outlook changes significantly during the day
        const outlookCheck = signalTrackerService.checkOutlookChange(
          symbol,
          profile,
          candidateDirection,
          signalType
        );

        if (!outlookCheck.hasSignificantChange) {
          alertAction = 'Watch';
          suppressedReason = outlookCheck.reason;
        } else {
          // Check correlation smart alert suppression
          const suppressionCheck = correlationEngine.checkSmartAlertSuppression(
            symbol,
            signalType,
            existingAlerts
          );

          if (suppressionCheck.isSuppressed) {
            alertAction = 'Watch';
            suppressedReason = suppressionCheck.message;
          } else {
            alertAction = isLong ? 'BUY' : isShort ? 'SELL' : 'Watch';

            // Automatically save generated signal to Signal Outcome Tracker
            if (alertAction === 'BUY' || alertAction === 'SELL') {
              signalTrackerService.autoSaveSignal(
                symbol,
                alertAction === 'BUY' ? 'BULLISH_IMBALANCE (Score 85+)' : 'BEARISH_IMBALANCE (Score 85+)',
                alertAction === 'BUY' ? 'LONG' : 'SHORT',
                profile.close,
                profile,
                undefined,
                undefined,
                [
                  `Auto-generated by Multi-Pair Scanner`,
                  `Quality Score: ${profile.marketScore}/100 (${profile.qualityRating})`,
                  `Prior Profile Status: Complete`,
                  `Outlook Change Trigger: ${outlookCheck.reason}`,
                  `Profile Shape: ${profile.profileShape}`,
                  `POC: ${profile.poc.toFixed(5)}, VAH: ${profile.vah.toFixed(5)}, VAL: ${profile.val.toFixed(5)}`,
                ]
              );
            }
          }
        }
      } else if (profile.marketScore >= 70) {
        alertAction = 'Watch';
      } else {
        alertAction = 'None';
      }

      items.push({
        symbol,
        name: config.name,
        shape: profile.profileShape,
        shortShape: getShortShapeName(profile.profileShape),
        score: profile.marketScore,
        qualityRating: profile.qualityRating,
        bias: profile.bias,
        alertAction,
        atr: profile.atr14Pips,
        poc: profile.poc,
        vah: profile.vah,
        val: profile.val,
        close: profile.close,
        lastUpdated: Date.now(),
        suppressedReason,
      });
    }

    // Default Sort by highest score
    items.sort((a, b) => b.score - a.score);

    this.lastScannerItems = items;
    return {
      items,
      profiles: this.pairProfilesMap,
    };
  }

  public clearPairCandles(symbol?: SymbolCode) {
    if (symbol) {
      this.pairCandlesMap.delete(symbol);
      this.pairProfilesMap.delete(symbol);
    } else {
      this.pairCandlesMap.clear();
      this.pairProfilesMap.clear();
    }
  }

  public getPairProfile(symbol: SymbolCode): MarketProfileData | undefined {
    return this.pairProfilesMap.get(symbol);
  }

  public getPairCandles(symbol: SymbolCode): Candle[] | undefined {
    return this.pairCandlesMap.get(symbol);
  }

  public getLastScannerItems(): ScannerPairItem[] {
    return [...this.lastScannerItems];
  }
}

export const scannerEngine = new ScannerEngine();
