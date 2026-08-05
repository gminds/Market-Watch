/**
 * MetaTrader Statement & Risk Management Types
 */

export interface MTTrade {
  ticket: string;               // e.g. "109283741"
  openTime: string;             // e.g. "2026.07.15 08:30:00"
  closeTime: string;            // e.g. "2026.07.15 11:15:20"
  openTimestamp: number;        // ms epoch
  closeTimestamp: number;       // ms epoch
  symbol: string;               // e.g. "GBPUSD", "EURUSD", "XAUUSD"
  type: 'buy' | 'sell' | 'deposit' | 'withdrawal' | 'credit';
  lots: number;
  openPrice: number;
  closePrice: number;
  sl: number;
  tp: number;
  commission: number;
  swap: number;
  profit: number;               // Gross profit/loss
  netProfit: number;            // Profit + Commission + Swap
  pips: number;
  rMultiple: number;            // Calculated realized R
  balanceAfter: number;         // Cumulative balance after trade
  equityAfter: number;          // Cumulative equity after trade
}

export interface StatementImportSummary {
  dealsRead: number;
  positionsReconstructed: number;
  completedTradesImported: number;
  openPositionsIgnored: number;
  duplicateTradesSkipped: number;
  parsingErrors: number;
}

export interface MTAccount {
  accountNumber: string;        // Unique account identifier e.g. "5029381"
  accountName: string;          // e.g. "John Doe - Live IC Markets"
  broker: string;               // e.g. "IC Markets SC"
  currency: string;             // e.g. "USD"
  leverage: string;             // e.g. "1:100"
  initialDeposit: number;       // e.g. 10000
  currentBalance: number;
  currentEquity: number;
  lastUpdated: number;          // ms timestamp of last statement upload
  statementFileName?: string;
  importSummary?: StatementImportSummary;
  trades: MTTrade[];
}

export interface AccountMetrics {
  balance: number;
  equity: number;
  initialDeposit: number;
  netProfit: number;
  grossProfit: number;
  grossLoss: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  breakEvenTrades: number;
  winRate: number;              // percentage 0 - 100
  profitFactor: number;         // grossProfit / grossLoss
  sharpeRatio: number;          // annualized Sharpe ratio
  recoveryFactor: number;       // netProfit / maxDrawdown
  expectancy: number;           // Average profit per trade in $
  expectancyR: number;          // Average profit per trade in R
  avgWin: number;               // Average winning trade $
  avgLoss: number;              // Average losing trade $
  payoffRatio: number;          // avgWin / avgLoss
  largestWin: number;
  largestLoss: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  maxDrawdownAmount: number;    // Peak to valley $ loss
  maxDrawdownPct: number;       // Peak to valley % loss
  avgRMultiple: number;
}

export type RollingWindowSize = 20 | 30 | 50 | 100;

export interface RollingMetrics {
  windowSize: RollingWindowSize;
  rollingWinRate: number;
  rollingProfitFactor: number;
  rollingExpectancy: number;
  rollingExpectancyR: number;
  rollingMaxDrawdownPct: number;
  rollingMaxConsecutiveLosses: number;
  rollingAvgR: number;
}

export type HealthStatus = 'HEALTHY' | 'WATCH' | 'PAUSE';

export interface StrategyHealth {
  status: HealthStatus;
  score: number;                // 0 - 100
  reasons: string[];
  recommendation: string;
}

export interface TradePerformanceSummary {
  period: string;               // Date e.g. "2026-08-04" or "Week 31" or "2026-08"
  tradesCount: number;
  wins: number;
  losses: number;
  winRate: number;
  netProfit: number;
  profitFactor: number;
  totalVolumeLots: number;
  maxDrawdownPct: number;
}
