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
        // Generate a subtle live tick to update candles
        const tick = dataProviderService.generateLiveTick(symbol);
        const last = { ...candles[candles.length - 1] };
        last.close = tick.price;
        if (tick.price > last.high) last.high = tick.price;
        if (tick.price < last.low) last.low = tick.price;
        candles[candles.length - 1] = last;
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

      // Determine Alert Action according to Prompt 5 (Gated at 85+ Quality Score)
      let alertAction: ScannerAlertAction = 'None';
      let suppressedReason: string | undefined = undefined;

      const isLong = profile.bias.includes('Bullish');
      const isShort = profile.bias.includes('Bearish');

      if (profile.marketScore >= 85) {
        const signalType = isLong ? 'BULLISH_IMBALANCE' : isShort ? 'BEARISH_IMBALANCE' : 'NO_TRADE';

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
