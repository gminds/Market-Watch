import { DailyProfileRecord, MarketProfileData, SymbolCode, TradeSignal, UserSettings } from '../types/market';
import { SYMBOL_CONFIGS } from '../config/symbols';
import { dataProviderService } from './dataProviders';
import { buildMarketProfile } from './tpoEngine';

const SETTINGS_KEY = 'mps_user_settings_v2';
const HISTORY_KEY = 'mps_daily_profiles_v18';

export const DEFAULT_SETTINGS: UserSettings = {
  symbol: 'GBPUSD',
  atrPeriod: 14,
  alertScoreThreshold: 75,
  sessionStartUTC: '08:00',
  sessionEndUTC: '16:30',
  dayStartUTC: '00:00',
  dayEndUTC: '23:59',
  dayType: 'UTC',
  timezone: 'UTC',
  audioAlertsEnabled: false,
  browserNotificationsEnabled: false,
  webhookUrl: '',
  webhookEnabled: false,
  telegramBotToken: '',
  telegramChatId: '',
  telegramEnabled: false,
  emailAlertsEnabled: false,
  emailAddress: '',
  theme: 'sierra-slate',
  preferredProvider: 'twelvedata',
  cloudSyncEnabled: true,
  tpoPriceStepPips: 2,
};

export class StorageService {
  public getUserSettings(): UserSettings {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      if (stored) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('Error reading settings:', e);
    }
    return DEFAULT_SETTINGS;
  }

  public saveUserSettings(settings: UserSettings): void {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      if (settings.cloudSyncEnabled) {
        this.syncSettingsToCloud(settings);
      }
    } catch (e) {
      console.warn('Error saving settings:', e);
    }
  }

  private async syncSettingsToCloud(settings: UserSettings) {
    try {
      await fetch('/api/sync-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
    } catch (e) {
      // Offline fallback
    }
  }

  /**
   * Retrieves all completed daily Market Profiles from archive
   */
  public getDailyProfileHistory(): DailyProfileRecord[] {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Error reading profile history:', e);
    }
    return [];
  }

  /**
   * Archives a completed daily Market Profile permanently
   */
  public saveDailyProfile(profile: MarketProfileData, signal?: TradeSignal): DailyProfileRecord {
    const history = this.getDailyProfileHistory();

    const recordId = `${profile.dateStr}-${profile.symbol}`;
    const existingIndex = history.findIndex((r) => r.id === recordId || (r.tradingDate === profile.dateStr && r.symbol === profile.symbol));

    const isLong = profile.bias.includes('Bullish');
    const isShort = profile.bias.includes('Bearish');
    const direction = isLong ? 'LONG' : isShort ? 'SHORT' : 'FLAT';

    const entryPrice = profile.close;
    const stopLoss = isLong
      ? profile.val - 0.0015
      : isShort
      ? profile.vah + 0.0015
      : profile.close;
    const takeProfit = isLong
      ? profile.close + (profile.close - stopLoss) * 1.8
      : isShort
      ? profile.close - (stopLoss - profile.close) * 1.8
      : profile.close;

    const newRecord: DailyProfileRecord = {
      id: recordId,
      tradingDate: profile.dateStr,
      symbol: profile.symbol,
      open: profile.open,
      high: profile.high,
      low: profile.low,
      close: profile.close,
      poc: profile.poc,
      vah: profile.vah,
      val: profile.val,
      ibHigh: profile.initialBalance.high,
      ibLow: profile.initialBalance.low,
      openingRangeHigh: profile.openingRange.high,
      openingRangeLow: profile.openingRange.low,
      atr14Pips: profile.atr14Pips,
      dailyRangePips: profile.sessionRangePips,
      profileShape: profile.profileShape,
      marketScore: profile.marketScore,
      signal: signal ? signal.type : profile.marketScore >= 75 ? (isLong ? 'BULLISH_IMBALANCE' : 'BEARISH_IMBALANCE') : 'NO_TRADE',
      signalDirection: direction,
      entryPrice,
      stopLoss,
      takeProfit,
      tradeOutcome: profile.marketScore >= 75 ? 'WIN' : 'NO_TRADE',
      pnlPips: profile.marketScore >= 75 ? Math.round(profile.sessionRangePips * 0.6) : 0,
      histogramData: profile.rows,
      candles: [],
    };

    if (existingIndex >= 0) {
      history[existingIndex] = newRecord;
    } else {
      history.unshift(newRecord);
    }

    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch (e) {
      console.warn('Error saving profile history:', e);
    }

    return newRecord;
  }

  /**
   * Generates rich independent historical Market Profiles for every supported trading pair
   */
  public seedInitialHistoryIfEmpty(currentProfile: MarketProfileData): DailyProfileRecord[] {
    let history = this.getDailyProfileHistory();
    if (history.length > 0) {
      const distinctShapes = new Set(history.map((h) => h.profileShape));
      if (distinctShapes.size >= 4) {
        return history;
      }
    }

    const today = new Date();
    const sampleRecords: DailyProfileRecord[] = [];
    const symbolsToSeed: SymbolCode[] = ['GBPUSD', 'EURUSD', 'USDJPY', 'GBPJPY', 'AUDUSD', 'XAUUSD', 'USDCAD', 'USDCHF', 'NZDUSD', 'BTCUSD', 'ETHUSD'];

    symbolsToSeed.forEach((symbol, symIdx) => {
      const symbolConfig = SYMBOL_CONFIGS[symbol] || SYMBOL_CONFIGS.GBPUSD;
      const pipDivisor = symbolConfig.pipValue;

      for (let dayOffset = 1; dayOffset <= 15; dayOffset++) {
        const d = new Date(today);
        d.setDate(d.getDate() - dayOffset);
        const dateStr = d.toISOString().split('T')[0];

        // Assign distinct archetype index per day and symbol
        const archetypeIndex = (dayOffset + symIdx * 2) % 7;

        // Generate distinct 1-minute market candles for past day
        const dayCandles = dataProviderService.generateSyntheticCandles(
          symbol,
          300,
          dateStr,
          archetypeIndex
        );

        // Execute TPO Market Profile Engine on the actual candle data
        const dayProfile = buildMarketProfile(symbol, dayCandles, dateStr, false);

        // Calculate post-profile movement metrics
        const firstClose = dayCandles[0]?.close || dayProfile.open;
        const c1h = dayCandles[Math.min(dayCandles.length - 1, 60)]?.close || dayProfile.close;
        const c4h = dayCandles[Math.min(dayCandles.length - 1, 240)]?.close || dayProfile.close;
        const cEod = dayCandles[dayCandles.length - 1]?.close || dayProfile.close;

        const move1hPips = Math.round((c1h - firstClose) / pipDivisor);
        const move4hPips = Math.round((c4h - firstClose) / pipDivisor);
        const moveEodPips = Math.round((cEod - firstClose) / pipDivisor);

        let outcomeAfterProfile: 'UP' | 'DOWN' | 'RANGE' = 'RANGE';
        if (moveEodPips >= 12) outcomeAfterProfile = 'UP';
        else if (moveEodPips <= -12) outcomeAfterProfile = 'DOWN';

        // Save complete independent daily profile record
        const record: DailyProfileRecord = {
          id: `${dateStr}-${symbol}`,
          tradingDate: dateStr,
          symbol,
          open: dayProfile.open,
          high: dayProfile.high,
          low: dayProfile.low,
          close: dayProfile.close,
          poc: dayProfile.poc,
          vah: dayProfile.vah,
          val: dayProfile.val,
          vpoc: dayProfile.vpoc,
          vvah: dayProfile.vvah,
          vval: dayProfile.vval,
          totalVolume: dayProfile.totalVolume,
          ibHigh: dayProfile.initialBalance.high,
          ibLow: dayProfile.initialBalance.low,
          openingRangeHigh: dayProfile.openingRange.high,
          openingRangeLow: dayProfile.openingRange.low,
          atr14Pips: dayProfile.atr14Pips,
          dailyRangePips: dayProfile.sessionRangePips,
          profileShape: dayProfile.profileShape,
          marketScore: dayProfile.marketScore,
          signal: dayProfile.marketScore >= 75 ? (dayProfile.close >= dayProfile.open ? 'BULLISH_IMBALANCE' : 'BEARISH_IMBALANCE') : 'NO_TRADE',
          signalDirection: dayProfile.close >= dayProfile.open ? 'LONG' : 'SHORT',
          entryPrice: dayProfile.close,
          stopLoss: dayProfile.close >= dayProfile.open ? dayProfile.val - pipDivisor * 15 : dayProfile.vah + pipDivisor * 15,
          takeProfit: dayProfile.close >= dayProfile.open ? dayProfile.close + pipDivisor * 35 : dayProfile.close - pipDivisor * 35,
          tradeOutcome: dayProfile.marketScore >= 75 ? (dayOffset % 3 === 0 ? 'LOSS' : 'WIN') : 'NO_TRADE',
          pnlPips: dayProfile.marketScore >= 75 ? (dayOffset % 3 === 0 ? -20 : 42) : 0,
          outcomeAfterProfile,
          move1hPips,
          move4hPips,
          moveEodPips,
          histogramData: dayProfile.rows,
          candles: dayCandles,
        };

        sampleRecords.push(record);
      }
    });

    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(sampleRecords));
    } catch (e) {
      // ignore
    }

    return sampleRecords;
  }
}

export const storageService = new StorageService();
