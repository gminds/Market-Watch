import {
  CorrelationMatrixData,
  CorrelationPairResult,
  CorrelationPeriod,
  CorrelationStrength,
  SignalType,
  SymbolCode,
  AlertItem,
} from '../types/market';
import { getAvailableSymbols, SYMBOL_CONFIGS } from '../config/symbols';

/**
 * Historical Return Seeds for Correlation Matrix Engine
 * Realistic market correlations:
 * EURUSD vs GBPUSD ~ +0.92
 * EURUSD vs USDCHF ~ -0.93 (Strong Inverse)
 * GBPUSD vs USDCHF ~ -0.89
 * AUDUSD vs NZDUSD ~ +0.91
 * EURUSD vs USDJPY ~ -0.45
 * USDCAD vs Oil/USD ~ -0.72
 */
const CORRELATION_BASE_MATRIX: Record<string, Record<string, number>> = {
  EURUSD: { EURUSD: 1.0, GBPUSD: 0.93, USDJPY: -0.42, AUDUSD: 0.81, USDCHF: -0.92, USDCAD: -0.68, NZDUSD: 0.78, GBPJPY: 0.35, XAUUSD: 0.65, BTCUSD: 0.35, ETHUSD: 0.38 },
  GBPUSD: { EURUSD: 0.93, GBPUSD: 1.0, USDJPY: -0.38, AUDUSD: 0.84, USDCHF: -0.89, USDCAD: -0.64, NZDUSD: 0.80, GBPJPY: 0.48, XAUUSD: 0.60, BTCUSD: 0.32, ETHUSD: 0.35 },
  USDJPY: { EURUSD: -0.42, GBPUSD: -0.38, USDJPY: 1.0, AUDUSD: -0.25, USDCHF: 0.52, USDCAD: 0.45, NZDUSD: -0.22, GBPJPY: 0.62, XAUUSD: -0.40, BTCUSD: -0.20, ETHUSD: -0.18 },
  AUDUSD: { EURUSD: 0.81, GBPUSD: 0.84, USDJPY: -0.25, AUDUSD: 1.0, USDCHF: -0.76, USDCAD: -0.75, NZDUSD: 0.92, GBPJPY: 0.32, XAUUSD: 0.70, BTCUSD: 0.42, ETHUSD: 0.45 },
  USDCHF: { EURUSD: -0.92, GBPUSD: -0.89, USDJPY: 0.52, AUDUSD: -0.76, USDCHF: 1.0, USDCAD: 0.62, NZDUSD: -0.74, GBPJPY: -0.30, XAUUSD: -0.62, BTCUSD: -0.30, ETHUSD: -0.32 },
  USDCAD: { EURUSD: -0.68, GBPUSD: -0.64, USDJPY: 0.45, AUDUSD: -0.75, USDCHF: 0.62, USDCAD: 1.0, NZDUSD: -0.71, GBPJPY: -0.15, XAUUSD: -0.55, BTCUSD: -0.28, ETHUSD: -0.30 },
  NZDUSD: { EURUSD: 0.78, GBPUSD: 0.80, USDJPY: -0.22, AUDUSD: 0.92, USDCHF: -0.74, USDCAD: -0.71, NZDUSD: 1.0, GBPJPY: 0.30, XAUUSD: 0.68, BTCUSD: 0.38, ETHUSD: 0.40 },
  GBPJPY: { EURUSD: 0.35, GBPUSD: 0.48, USDJPY: 0.62, AUDUSD: 0.32, USDCHF: -0.30, USDCAD: -0.15, NZDUSD: 0.30, GBPJPY: 1.0, XAUUSD: 0.18, BTCUSD: 0.25, ETHUSD: 0.28 },
  XAUUSD: { EURUSD: 0.65, GBPUSD: 0.60, USDJPY: -0.40, AUDUSD: 0.70, USDCHF: -0.62, USDCAD: -0.55, NZDUSD: 0.68, GBPJPY: 0.18, XAUUSD: 1.0, BTCUSD: 0.52, ETHUSD: 0.50 },
  BTCUSD: { EURUSD: 0.35, GBPUSD: 0.32, USDJPY: -0.20, AUDUSD: 0.42, USDCHF: -0.30, USDCAD: -0.28, NZDUSD: 0.38, GBPJPY: 0.25, XAUUSD: 0.52, BTCUSD: 1.0, ETHUSD: 0.88 },
  ETHUSD: { EURUSD: 0.38, GBPUSD: 0.35, USDJPY: -0.18, AUDUSD: 0.45, USDCHF: -0.32, USDCAD: -0.30, NZDUSD: 0.40, GBPJPY: 0.28, XAUUSD: 0.50, BTCUSD: 0.88, ETHUSD: 1.0 },
};

export function calculatePearsonCorrelation(seriesA: number[], seriesB: number[]): number {
  if (seriesA.length !== seriesB.length || seriesA.length === 0) return 0;
  
  const n = seriesA.length;
  const meanA = seriesA.reduce((sum, val) => sum + val, 0) / n;
  const meanB = seriesB.reduce((sum, val) => sum + val, 0) / n;

  let num = 0;
  let denA = 0;
  let denB = 0;

  for (let i = 0; i < n; i++) {
    const diffA = seriesA[i] - meanA;
    const diffB = seriesB[i] - meanB;
    num += diffA * diffB;
    denA += diffA * diffA;
    denB += diffB * diffB;
  }

  const denominator = Math.sqrt(denA * denB);
  if (denominator === 0) return 0;
  
  const r = num / denominator;
  return Number(Math.max(-1, Math.min(1, r)).toFixed(2));
}

export function getCorrelationStrength(r: number): CorrelationStrength {
  const absR = Math.abs(r);
  if (absR >= 0.90) return 'Very Strong';
  if (absR >= 0.75) return 'Strong';
  if (absR >= 0.50) return 'Moderate';
  return 'Weak';
}

export function formatCorrelationDisplayText(r: number): string {
  const strength = getCorrelationStrength(r);
  if (r < 0) {
    return `${strength} Inverse`;
  }
  return strength;
}

export class CorrelationEngine {
  private cache: Map<CorrelationPeriod, CorrelationMatrixData> = new Map();

  /**
   * Generates or calculates the correlation matrix for supported symbols
   */
  public getCorrelationMatrix(period: CorrelationPeriod = '30D'): CorrelationMatrixData {
    if (this.cache.has(period)) {
      return this.cache.get(period)!;
    }

    const symbols = getAvailableSymbols();
    const matrix: Record<SymbolCode, Record<SymbolCode, number>> = {} as any;
    const pairwise: CorrelationPairResult[] = [];

    // Period scaling variance factor (30D vs 90D vs 180D)
    const factor = period === '30D' ? 1.0 : period === '90D' ? 0.98 : 0.95;

    symbols.forEach((symA) => {
      matrix[symA] = {} as Record<SymbolCode, number>;
      symbols.forEach((symB) => {
        if (symA === symB) {
          matrix[symA][symB] = 1.0;
        } else {
          const baseR = CORRELATION_BASE_MATRIX[symA]?.[symB] ?? 0.50;
          const scaledR = Number((baseR * factor).toFixed(2));
          matrix[symA][symB] = scaledR;
        }
      });
    });

    // Generate pairwise list
    for (let i = 0; i < symbols.length; i++) {
      for (let j = i + 1; j < symbols.length; j++) {
        const pairA = symbols[i];
        const pairB = symbols[j];
        const r = matrix[pairA][pairB];
        const strength = getCorrelationStrength(r);
        const isInverse = r < 0;
        const displayText = formatCorrelationDisplayText(r);

        pairwise.push({
          pairA,
          pairB,
          correlation: r,
          period,
          strength,
          isInverse,
          displayText,
        });
      }
    }

    // Sort pairwise by strongest absolute correlation
    pairwise.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));

    const result: CorrelationMatrixData = {
      period,
      pairs: symbols,
      matrix,
      pairwise,
      lastCalculated: Date.now(),
    };

    this.cache.set(period, result);
    return result;
  }

  /**
   * Smart Alert Filter:
   * Suppresses duplicate alerts when two pairs are highly correlated (> 0.90 or < -0.90)
   * and already have an active signal.
   */
  public checkSmartAlertSuppression(
    newSymbol: SymbolCode,
    newSignalType: SignalType,
    existingAlerts: AlertItem[],
    period: CorrelationPeriod = '30D'
  ): { isSuppressed: boolean; primarySymbol?: SymbolCode; message?: string } {
    if (newSignalType === 'NO_TRADE' || existingAlerts.length === 0) {
      return { isSuppressed: false };
    }

    const { matrix } = this.getCorrelationMatrix(period);
    const symbolCorrelations = matrix[newSymbol];
    if (!symbolCorrelations) return { isSuppressed: false };

    // Recent active alerts within last 30 minutes
    const recentAlerts = existingAlerts.filter(
      (a) => Date.now() - a.timestamp < 30 * 60 * 1000 && a.symbol !== newSymbol
    );

    for (const alert of recentAlerts) {
      const r = symbolCorrelations[alert.symbol] ?? 0;

      // Positive correlation duplicate: r > 0.90 and same signal direction
      if (r >= 0.90 && alert.signalType === newSignalType) {
        return {
          isSuppressed: true,
          primarySymbol: alert.symbol,
          message: `Similar signal already active on highly correlated pair (${alert.symbol}, r=${r.toFixed(2)}). Alert suppressed.`,
        };
      }

      // Inverse correlation duplicate: r <= -0.90 and opposite signal direction
      if (
        r <= -0.90 &&
        ((newSignalType === 'BULLISH_IMBALANCE' && alert.signalType === 'BEARISH_IMBALANCE') ||
          (newSignalType === 'BEARISH_IMBALANCE' && alert.signalType === 'BULLISH_IMBALANCE'))
      ) {
        return {
          isSuppressed: true,
          primarySymbol: alert.symbol,
          message: `Similar inverse signal already active on highly correlated pair (${alert.symbol}, r=${r.toFixed(2)}). Alert suppressed.`,
        };
      }
    }

    return { isSuppressed: false };
  }
}

export const correlationEngine = new CorrelationEngine();
