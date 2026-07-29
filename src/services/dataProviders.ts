import {
  Candle,
  DataProviderId,
  DataProviderStatus,
  SymbolCode,
  Tick,
} from '../types/market';
import { PROVIDER_CATALOG } from '../config/providers';
import { SYMBOL_CONFIGS } from '../config/symbols';

function seededRandom(seedStr: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

export class DataProviderService {
  private providers: Map<DataProviderId, DataProviderStatus> = new Map();
  private activeProviderId: DataProviderId = 'twelvedata';
  private listeners: Array<(activeProvider: DataProviderStatus) => void> = [];
  private basePriceMap: Record<SymbolCode, number> = {
    GBPUSD: 1.32890,
    EURUSD: 1.13810,
    USDJPY: 163.83,
    AUDUSD: 0.6975,
    USDCHF: 0.8194,
    USDCAD: 1.4104,
    NZDUSD: 0.5779,
    GBPJPY: 217.72,
    XAUUSD: 2420.00,
    BTCUSD: 63860.00,
    ETHUSD: 1913.50,
  };

  constructor() {
    PROVIDER_CATALOG.forEach((p) => {
      this.providers.set(p.id, { ...p });
    });
  }

  public getActiveProvider(): DataProviderStatus {
    return this.providers.get(this.activeProviderId) || PROVIDER_CATALOG[0];
  }

  public getAllProviders(): DataProviderStatus[] {
    return Array.from(this.providers.values());
  }

  public setActiveProvider(providerId: DataProviderId) {
    if (this.providers.has(providerId)) {
      this.activeProviderId = providerId;
      this.providers.forEach((p) => {
        p.isActive = p.id === providerId;
      });
      this.notifyListeners();
    }
  }

  public subscribeProviderChange(callback: (activeProvider: DataProviderStatus) => void) {
    this.listeners.push(callback);
    callback(this.getActiveProvider());
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  private notifyListeners() {
    const active = this.getActiveProvider();
    this.listeners.forEach((l) => l(active));
  }

  public handleProviderFailure(providerId: DataProviderId, errorMsg: string) {
    const provider = this.providers.get(providerId);
    if (provider) {
      provider.failureCount += 1;
      provider.statusMessage = `Failure: ${errorMsg}. Fallback triggering...`;
      
      if (provider.failureCount >= 2 && provider.id === this.activeProviderId) {
        // Failover to next available provider
        provider.isAvailable = false;
        const available = Array.from(this.providers.values()).find(
          (p) => p.isAvailable && p.id !== providerId
        );
        if (available) {
          this.setActiveProvider(available.id);
          console.warn(
            `[Data Provider Failover] ${provider.name} failed (${errorMsg}). Switched to ${available.name}`
          );
        } else {
          // Ultimate fallback to synthetic stream
          this.setActiveProvider('synthetic');
        }
      }
    }
  }

  /**
   * Fetch 1-minute historical candles for a symbol
   */
  public async fetchHistoricalCandles(
    symbol: SymbolCode = 'GBPUSD',
    count: number = 300,
    dateStr?: string
  ): Promise<Candle[]> {
    const active = this.getActiveProvider();
    const config = SYMBOL_CONFIGS[symbol] || SYMBOL_CONFIGS.GBPUSD;

    try {
      // 1. Try server proxy endpoint first
      const res = await fetch(`/api/market-data/${symbol.toLowerCase()}?count=${count}`);
      if (res.ok) {
        const json = await res.json();
        if (json.candles && json.candles.length > 0) {
          active.lastSuccessTimestamp = Date.now();
          active.statusMessage = `Streaming 1-Min ${symbol} Live Data (${json.candles.length} candles)`;
          const lastCandle = json.candles[json.candles.length - 1];
          if (lastCandle && typeof lastCandle.close === 'number' && !isNaN(lastCandle.close)) {
            this.basePriceMap[symbol] = lastCandle.close;
          }
          return json.candles;
        }
      }
    } catch (err) {
      this.handleProviderFailure(active.id, 'Server REST endpoint timeout');
    }

    // Fallback: Generate realistic 1-minute historical auction candles
    return this.generateSyntheticCandles(symbol, count, dateStr);
  }

  /**
   * Generate realistic simulated Market Profile 1-min candles with distinct auction shape archetypes
   */
  public generateSyntheticCandles(
    symbol: SymbolCode = 'GBPUSD',
    count: number = 300,
    targetDateStr?: string,
    forcedArchetypeIndex?: number
  ): Candle[] {
    const config = SYMBOL_CONFIGS[symbol] || SYMBOL_CONFIGS.GBPUSD;
    const pipMultiplier = config.pipValue;
    const seed = targetDateStr ? `${targetDateStr}-${symbol}` : `${symbol}-live-${Date.now()}`;
    const rng = seededRandom(seed);

    // Initial base price derivation with seed variance
    const baseOffset = (rng() - 0.5) * 80 * pipMultiplier;
    let currentPrice = (this.basePriceMap[symbol] || config.basePrice) + baseOffset;

    const candles: Candle[] = [];
    const now = new Date();
    
    // Session start 08:00 UTC
    const sessionStart = new Date(now);
    sessionStart.setUTCHours(8, 0, 0, 0);
    const startTimeMs = sessionStart.getTime() - (count - 100) * 60 * 1000;

    // Pick shape archetype (0 to 6)
    const archetypeIndex = forcedArchetypeIndex !== undefined ? forcedArchetypeIndex : Math.floor(rng() * 7);

    // Baseline intraday trajectory generator for the chosen archetype
    const getArchetypeDelta = (i: number, total: number): number => {
      const progress = i / total; // 0.0 to 1.0

      switch (archetypeIndex) {
        case 0: {
          // Trend Day Bullish: persistent upward drive with minimal pullback
          const trendDrift = progress * 45 * pipMultiplier;
          const noise = (rng() - 0.45) * 2.5 * pipMultiplier;
          return trendDrift + noise;
        }
        case 1: {
          // Trend Day Bearish: persistent downward drive
          const trendDrift = -progress * 48 * pipMultiplier;
          const noise = (rng() - 0.55) * 2.5 * pipMultiplier;
          return trendDrift + noise;
        }
        case 2: {
          // P Profile: sharp early morning buying drive (0-30% session), then high-volume balance at top
          if (progress < 0.28) {
            const drive = (progress / 0.28) * 38 * pipMultiplier;
            return drive + (rng() - 0.5) * 2 * pipMultiplier;
          }
          const peakLevel = 38 * pipMultiplier;
          const topBalance = Math.sin((progress - 0.28) * 18) * 6 * pipMultiplier;
          return peakLevel + topBalance + (rng() - 0.5) * 2 * pipMultiplier;
        }
        case 3: {
          // b Profile: sharp early morning selling drop (0-30% session), then high-volume balance at bottom
          if (progress < 0.28) {
            const drop = -(progress / 0.28) * 40 * pipMultiplier;
            return drop + (rng() - 0.5) * 2 * pipMultiplier;
          }
          const troughLevel = -40 * pipMultiplier;
          const bottomBalance = Math.sin((progress - 0.28) * 18) * 6 * pipMultiplier;
          return troughLevel + bottomBalance + (rng() - 0.5) * 2 * pipMultiplier;
        }
        case 4: {
          // Double Distribution: node 1 balance (0-40%), fast single print breakout jump (40-50%), node 2 balance (50-100%)
          if (progress < 0.38) {
            return Math.sin(progress * 25) * 5 * pipMultiplier + (rng() - 0.5) * 2 * pipMultiplier;
          } else if (progress < 0.52) {
            const jumpProgress = (progress - 0.38) / 0.14;
            return (jumpProgress * 32) * pipMultiplier + (rng() - 0.5) * 2 * pipMultiplier;
          } else {
            const topNode = 32 * pipMultiplier;
            return topNode + Math.sin((progress - 0.52) * 20) * 5 * pipMultiplier + (rng() - 0.5) * 2 * pipMultiplier;
          }
        }
        case 5: {
          // D Profile: Symmetric bell curve balance around POC
          const bell = Math.sin(progress * Math.PI * 2) * 12 * pipMultiplier;
          return bell + (rng() - 0.5) * 2.5 * pipMultiplier;
        }
        case 6: default: {
          // Neutral Day: Expands high early (+22 pips), gets rejected down (-22 pips), closes in middle
          if (progress < 0.35) {
            return Math.sin(progress * Math.PI) * 22 * pipMultiplier + (rng() - 0.5) * 2 * pipMultiplier;
          } else if (progress < 0.70) {
            return -Math.sin((progress - 0.35) * Math.PI) * 20 * pipMultiplier + (rng() - 0.5) * 2 * pipMultiplier;
          } else {
            return (rng() - 0.5) * 4 * pipMultiplier;
          }
        }
      }
    };

    const sessionStartPrice = currentPrice;

    for (let i = 0; i < count; i++) {
      const candleTime = new Date(startTimeMs + i * 60 * 1000);
      const hours = String(candleTime.getUTCHours()).padStart(2, '0');
      const mins = String(candleTime.getUTCMinutes()).padStart(2, '0');
      const timeStr = `${hours}:${mins}`;
      const dateStr = targetDateStr || candleTime.toISOString().split('T')[0];

      const targetClose = sessionStartPrice + getArchetypeDelta(i, count);
      const open = i === 0 ? sessionStartPrice : candles[i - 1].close;
      const close = targetClose;
      const maxOC = Math.max(open, close);
      const minOC = Math.min(open, close);

      const high = maxOC + (rng() * 1.8 + 0.2) * pipMultiplier;
      const low = minOC - (rng() * 1.8 + 0.2) * pipMultiplier;
      const volume = Math.floor(140 + rng() * 360 + Math.abs(close - open) / pipMultiplier * 60);

      const decimals = config.decimalPlaces ?? 5;

      candles.push({
        timestamp: candleTime.getTime(),
        timeStr,
        dateStr,
        open: Number(open.toFixed(decimals)),
        high: Number(high.toFixed(decimals)),
        low: Number(low.toFixed(decimals)),
        close: Number(close.toFixed(decimals)),
        volume,
      });
    }

    this.basePriceMap[symbol] = candles[candles.length - 1].close;
    return candles;
  }

  public getBasePrice(symbol: SymbolCode): number {
    return this.basePriceMap[symbol] || SYMBOL_CONFIGS[symbol]?.basePrice || 1.32890;
  }

  public setBasePrice(symbol: SymbolCode, price: number) {
    if (typeof price === 'number' && !isNaN(price) && isFinite(price) && price > 0) {
      this.basePriceMap[symbol] = price;
    }
  }

  /**
   * Generates a single live tick update
   */
  public generateLiveTick(symbol: SymbolCode = 'GBPUSD'): Tick {
    const config = SYMBOL_CONFIGS[symbol] || SYMBOL_CONFIGS.GBPUSD;
    let price = this.basePriceMap[symbol] || config.basePrice;
    
    const pipVal = config.pipValue || 0.0001;
    const maxTickMultiplier =
      symbol.includes('BTC') || symbol.includes('ETH')
        ? 3.5
        : symbol.includes('XAU')
        ? 1.5
        : 0.8;
    const delta = (Math.random() - 0.492) * maxTickMultiplier * pipVal;
    const decimals = config.decimalPlaces ?? 5;
    price = Number((price + delta).toFixed(decimals));
    this.basePriceMap[symbol] = price;

    return {
      timestamp: Date.now(),
      price,
      volume: Math.floor(15 + Math.random() * 85),
      symbol,
    };
  }
}

export const dataProviderService = new DataProviderService();
