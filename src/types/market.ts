/**
 * Market Profile Scanner V1 - Types & Interfaces
 */

export type SymbolCode =
  | 'EURUSD'
  | 'GBPUSD'
  | 'USDJPY'
  | 'AUDUSD'
  | 'USDCHF'
  | 'USDCAD'
  | 'NZDUSD'
  | 'GBPJPY'
  | 'XAUUSD'
  | 'BTCUSD'
  | 'ETHUSD'
  | (string & {});

export interface SymbolConfig {
  code: SymbolCode;
  name: string;
  pipValue: number;       // e.g. 0.0001 for GBPUSD, 1.0 for BTCUSD
  tickSize: number;       // e.g. 0.00001
  tpoPriceStep: number;   // Price step bucket for TPO rows, e.g. 0.0002 (2 pips)
  defaultSessionStart: string; // '08:00'
  defaultSessionEnd: string;   // '16:30'
  timezone: string;       // 'UTC' or 'Europe/London'
  basePrice: number;      // e.g. 1.3550
  decimalPlaces?: number; // Price display precision (e.g. 5 for EURUSD, 2 for BTCUSD)
}

export interface Candle {
  timestamp: number;     // epoch ms
  timeStr: string;       // HH:MM
  dateStr: string;       // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  bracketLetter?: string; // TPO Bracket 'A', 'B', 'C', etc.
}

export interface Tick {
  timestamp: number;
  price: number;
  volume: number;
  symbol: SymbolCode;
}

export interface TPORow {
  price: number;
  priceFormatted: string;
  tpoCount: number;
  volume: number;
  brackets: string[];     // ['A', 'B', 'C']
  isPOC: boolean;
  isValueArea: boolean;
  isInitialBalance: boolean;
  isSinglePrint: boolean;
  isPoorHighLow: boolean;
  isExcess: boolean;
  isVPOC?: boolean;             // Volume Point of Control
  isVolumeValueArea?: boolean;   // 70% Volume Value Area
}

export type ProfileShape =
  | 'D Profile'
  | 'P Profile'
  | 'b Profile'
  | 'Double Distribution'
  | 'Trend Day'
  | 'Neutral Day'
  | 'Unknown';

export type AuctionBias = 'Bullish' | 'Bearish' | 'Neutral' | 'Strong Bullish' | 'Strong Bearish';

export type EventType =
  | 'Initial Balance Breakout'
  | 'Acceptance Above Value'
  | 'Acceptance Below Value'
  | 'POC Migration Higher'
  | 'POC Migration Lower'
  | 'POC / Value Area Balanced'
  | 'Buying Tail Developing'
  | 'Selling Tail Developing'
  | 'Testing Previous Day VAH'
  | 'Testing Previous Day VAL'
  | 'Testing Previous Day POC'
  | 'Previous Day Level Reached'
  | 'Failed Auction'
  | 'Successful Auction'
  | 'Single Prints'
  | 'Poor High'
  | 'Poor Low'
  | 'Excess High'
  | 'Excess Low'
  | 'Range Extension'
  | 'Value Migration'
  | 'Developing Trend'
  | 'Rotational Day';

export interface ImbalanceEvent {
  id: string;
  timestamp: number;
  timeStr: string;
  dateStr: string;
  type: EventType;
  price: number;
  details: string;
  severity: 'info' | 'warning' | 'high' | 'critical';
}

export interface MarketProfileData {
  symbol: SymbolCode;
  dateStr: string;
  isDeveloping: boolean;
  
  // High-level session metrics
  open: number;
  high: number;
  low: number;
  close: number;
  sessionRangePips: number;
  
  // TPO Profile key levels
  poc: number;            // Point of Control
  vah: number;            // Value Area High
  val: number;            // Value Area Low
  valueArea70: { high: number; low: number; totalTPOs: number };

  // Volume Profile key levels
  vpoc: number;           // Volume Point of Control
  vvah: number;           // Volume Value Area High
  vval: number;           // Volume Value Area Low
  totalVolume: number;    // Total Volume
  volumeArea70: { high: number; low: number; totalVolume: number };
  
  initialBalance: {
    high: number;
    low: number;
    rangePips: number;
    brackets: string[]; // ['A', 'B']
  };
  
  openingRange: {
    high: number;
    low: number;
  };
  
  developingPOC: number;
  developingVAH: number;
  developingVAL: number;
  
  // Quantitative Stats
  atr14Pips: number;
  averageDailyRangePips: number;
  rangeExpansionRatio: number; // Current Range / ATR
  profileWidth: number;        // Max TPOs in a single price row
  profileHeightPips: number;   // Range in pips
  tpoCountTotal: number;
  timeAtPriceMap: Record<string, number>;
  
  // Shapes & Imbalances
  profileShape: ProfileShape;
  events: ImbalanceEvent[];
  singlePrints: number[];      // Price levels with single prints
  poorHigh: boolean;
  poorLow: boolean;
  excessHigh: boolean;
  excessLow: boolean;
  
  // TPO Matrix
  rows: TPORow[];
  
  // Quality Rating & Score Breakdown (Prompt 5)
  marketScore: number;         // 0 to 100
  qualityRating: QualityRating; // 'Excellent' | 'Good' | 'Average' | 'Poor'
  scoreBreakdown: {
    trendAlignment: number;       // max 20
    atrExpansion: number;         // max 15
    pocMigration: number;         // max 15
    valueAcceptance: number;      // max 15 (Acceptance Outside Value)
    rangeExtension: number;       // max 10
    profileShapeScore: number;    // max 10
    singlePrints: number;         // max 5
    excess: number;               // max 5
    valueMigration: number;       // max 5
    ibBreak: number;              // max 5
  };
  bias: AuctionBias;
  statusText: string;
  hasPrevDayProfileComplete?: boolean;
  prevDayLevels?: { vah: number; val: number; poc: number };
}

export type QualityRating = 'Excellent' | 'Good' | 'Average' | 'Poor';

export type ScannerAlertAction = 'BUY' | 'SELL' | 'Watch' | 'None';

export interface ScannerPairItem {
  symbol: SymbolCode;
  name: string;
  shape: ProfileShape;
  shortShape: string;            // 'P', 'D', 'b', 'Double', 'Trend', 'Neutral'
  score: number;
  qualityRating: QualityRating;
  bias: AuctionBias;
  alertAction: ScannerAlertAction;
  atr: number;
  poc: number;
  vah: number;
  val: number;
  close: number;
  lastUpdated: number;
  suppressedReason?: string;     // Smart correlation alert suppression reason if applicable
}

export type CorrelationPeriod = '30D' | '90D' | '180D';
export type CorrelationStrength = 'Very Strong' | 'Strong' | 'Moderate' | 'Weak';

export interface CorrelationPairResult {
  pairA: SymbolCode;
  pairB: SymbolCode;
  correlation: number;            // -1.0 to +1.0 (Pearson r)
  period: CorrelationPeriod;
  strength: CorrelationStrength;
  isInverse: boolean;
  displayText: string;           // e.g. "Very Strong" or "Very Strong Inverse"
}

export interface CorrelationMatrixData {
  period: CorrelationPeriod;
  pairs: SymbolCode[];
  matrix: Record<SymbolCode, Record<SymbolCode, number>>;
  pairwise: CorrelationPairResult[];
  lastCalculated: number;
}

export type SignalType = 'BULLISH_IMBALANCE' | 'BEARISH_IMBALANCE' | 'NO_TRADE';

export interface TradeSignal {
  id: string;
  dateStr: string;
  timeStr: string;
  timestamp: number;
  symbol: SymbolCode;
  type: SignalType;
  bias: AuctionBias;
  score: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  riskReward: number;
  targetPips: number;
  stopPips: number;
  rationale: string[];
  outcome?: 'WIN' | 'LOSS' | 'PENDING' | 'EXPIRED';
  realizedPips?: number;
}

export interface DailyProfileRecord {
  id: string; // YYYY-MM-DD
  tradingDate: string;
  symbol?: SymbolCode;
  open: number;
  high: number;
  low: number;
  close: number;
  poc: number;
  vah: number;
  val: number;
  vpoc?: number;
  vvah?: number;
  vval?: number;
  totalVolume?: number;
  ibHigh: number;
  ibLow: number;
  openingRangeHigh: number;
  openingRangeLow: number;
  atr14Pips: number;
  dailyRangePips: number;
  profileShape: ProfileShape;
  marketScore: number;
  signal: SignalType;
  signalDirection: 'LONG' | 'SHORT' | 'FLAT';
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  tradeOutcome?: 'WIN' | 'LOSS' | 'PENDING' | 'NO_TRADE';
  pnlPips?: number;
  outcomeAfterProfile?: 'UP' | 'DOWN' | 'RANGE';
  move1hPips?: number;
  move4hPips?: number;
  moveEodPips?: number;
  histogramData: TPORow[];
  candles: Candle[];
}

export interface ProfileSimilarityMatch {
  rank: number;
  record: DailyProfileRecord; // Matched historical profile (Day T)
  similarityPct: number;
  matchFactors: string[];
  // Following Trading Day Outcome (Day T+1)
  followingDayRecord?: DailyProfileRecord;
  followingDayDate?: string;
  followingDayShape?: ProfileShape;
  outcomeAfterProfile: 'UP' | 'DOWN' | 'RANGE';
  move1hPips: number;
  move4hPips: number;
  moveEodPips: number;
  followingDayRangePips?: number;
}

export interface SimilaritySearchResult {
  targetSymbol: SymbolCode;
  targetDate: string; // Yesterday's completed profile date
  targetShape: ProfileShape;
  targetMarketScore?: number;
  topMatches: ProfileSimilarityMatch[];
  avgMove1hPips: number;
  avgMove4hPips: number;
  avgMoveEodPips: number;
  avgFollowingRangePips?: number;
  outcomeStats: {
    upCount: number;
    downCount: number;
    rangeCount: number;
    upPct: number;
    downPct: number;
    rangePct: number;
    dominantOutcome: 'UP' | 'DOWN' | 'RANGE';
  };
  todayForecast: {
    bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    confidencePct: number;
    expectedMove1hPips: number;
    expectedMove4hPips: number;
    expectedMoveEodPips: number;
    expectedRangePips: number;
    summary: string;
    keyTakeaway: string;
  };
  totalCompared: number;
  lastUpdated: number;
}

export type DataProviderId =
  | 'twelvedata'
  | 'alphavantage'
  | 'polygon'
  | 'metatrader5'
  | 'oanda'
  | 'interactivebrokers'
  | 'tradingview'
  | 'yahoofinance'
  | 'synthetic';

export interface DataProviderStatus {
  id: DataProviderId;
  name: string;
  isAvailable: boolean;
  isActive: boolean;
  latencyMs: number;
  lastSuccessTimestamp: number;
  failureCount: number;
  statusMessage: string;
  requiresApiKey: boolean;
}

export interface AlertItem {
  id: string;
  timestamp: number;
  timeStr: string;
  dateStr: string;
  symbol: SymbolCode;
  title: string;
  message: string;
  score: number;
  signalType: SignalType;
  shape: ProfileShape;
  price: number;
  sentToBrowser: boolean;
  sentToWebhook: boolean;
  sentToTelegram: boolean;
}

export type AppTheme = 'sierra-slate' | 'bloomberg-terminal' | 'cyberpunk-dark' | 'tradingview-dark';

export interface UserSettings {
  symbol: SymbolCode;
  atrPeriod: number;              // default 14
  alertScoreThreshold: number;     // default 75
  sessionStartUTC: string;         // '08:00'
  sessionEndUTC: string;           // '16:30'
  dayStartUTC: string;             // '00:00'
  dayEndUTC: string;               // '23:59'
  dayType: 'UTC' | 'Broker' | 'NYClose' | 'Custom';
  timezone: string;                // 'UTC'
  audioAlertsEnabled: boolean;
  browserNotificationsEnabled: boolean;
  webhookUrl: string;
  webhookEnabled: boolean;
  telegramBotToken: string;
  telegramChatId: string;
  telegramEnabled: boolean;
  emailAlertsEnabled: boolean;
  emailAddress: string;
  theme: AppTheme;
  preferredProvider: DataProviderId;
  cloudSyncEnabled: boolean;
  tpoPriceStepPips: number;        // e.g. 2 pips
}

export interface ProfessionalForecast {
  id: string;
  symbol: SymbolCode;
  timestamp: number;
  dateStr: string;
  timeframe: string; // 'Today's Full Day', 'London Session', 'New York Session', 'Weekly'
  
  // Primary metrics matching requested format
  todaysBias: 'Bullish' | 'Bearish' | 'Neutral' | 'Strong Bullish' | 'Strong Bearish';
  probabilityPct: number; // e.g. 72
  expectedRangePips: number; // e.g. 105
  expectedDirection: 'Higher' | 'Lower' | 'Sideways';
  expectedProfile: 'Trend Day' | 'Range Day' | 'Double Distribution' | 'Normal Variation' | 'Reversal Day' | 'P-Shape' | 'b-Shape';
  risk: 'Low' | 'Medium' | 'High' | 'Very High';
  confidencePct: number; // e.g. 91

  // Detailed auction mechanics & key levels
  currentPrice: number;
  keyLevels: {
    poc: number;
    vah: number;
    val: number;
    target1: number;
    target2: number;
    invalidation: number;
  };
  scenarios: {
    bullishCase: string;
    bearishCase: string;
    baseCase: string;
  };
  executiveSummary: string;
  tacticalPlaybook: string[];
  macroEconomicCatalysts: string[];
  marketContext: string;
}

export type ActiveTabType =
  | 'forecast'
  | 'dashboard'
  | 'risk'
  | 'news'
  | 'scanner'
  | 'signals'
  | 'correlation'
  | 'similarity'
  | 'chart'
  | 'library'
  | 'alerts'
  | 'settings';

export type TrackedSignalStatus = 'Pending' | 'Target Hit' | 'Stop Hit' | 'No Follow-Through' | 'Expired';

export interface MarketProfileSnapshot {
  profileShape: ProfileShape;
  marketScore: number;
  qualityRating: QualityRating;
  poc: number;
  vah: number;
  val: number;
  ibHigh: number;
  ibLow: number;
  bias: AuctionBias;
  atr14Pips: number;
}

export interface TrackedSignal {
  id: string;                      // e.g. "SIG-20260804-001"
  dateStr: string;                 // e.g. "2026-08-04"
  timeStr: string;                 // e.g. "14:25"
  timestamp: number;               // creation epoch ms
  symbol: SymbolCode;              // e.g. "GBPUSD"
  signalType: string;              // e.g. "BULLISH_IMBALANCE", "BUY", "Buying Tail Developing", etc.
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  targetPips: number;
  stopPips: number;
  riskReward: number;
  
  marketProfileSnapshot: MarketProfileSnapshot;
  
  status: TrackedSignalStatus;
  closedAt?: number;               // resolution epoch ms
  timeToTargetMinutes?: number;    // elapsed minutes to hit target
  rMultiple?: number;              // realized R (e.g. +1.80, -1.00)
  pnlPips?: number;                // realized pips
  highestPriceReached?: number;    // peak price reached
  lowestPriceReached?: number;     // lowest price reached
  lastEvaluatedPrice?: number;
  lastEvaluatedTimestamp?: number;
  rationale?: string[];
}

export interface SignalTrackerStats {
  totalSignals: number;
  pendingCount: number;
  targetHitCount: number;
  stopHitCount: number;
  noFollowThroughCount: number;
  expiredCount: number;
  resolvedCount: number;
  winRate: number;                 // % (0 - 100)
  lossRate: number;                // % (0 - 100)
  averageRMultiple: number;        // e.g. +1.45 R
  averageTimeToTargetMinutes: number; // e.g. 38 mins
  profitFactor: number;            // e.g. 2.40
  totalPnlPips: number;            // e.g. +420 pips
}

export interface EconomicEvent {
  id: string;
  timeUtc: string;
  currency: string;
  event: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  forecast: string;
  previous: string;
  status: 'Upcoming' | 'Live' | 'Released' | 'Completed';
  countdownStr: string;
  actual?: string;
}

export interface NewsComparisonItem {
  dateStr: string;
  similarityPct: number;
  nextDayOutcome: 'Bullish' | 'Bearish' | 'Range';
  majorNews: string;
  newsSimilarityPct: number;
  combinedConfidencePct: number;
}

export interface NewsAdjustedScore {
  profileSimilarityPct: number;
  historicalAccuracyPct: number;
  newsSimilarityPct: number;
  currentVolatilityMatchPct: number;
  overallConfidencePct: number;
}

export interface SmartNewsWatchData {
  symbol: SymbolCode;
  relevantCurrencies: string[];
  todayEvents: EconomicEvent[];
  highImpactCount: number;
  nextHighImpactEvent: EconomicEvent | null;
  countdownTimerStr: string;
  dailyMarketSummary: string;
  tradingWarnings: string[];
  aiMarketForecastEnhanced: string;
  newsAdjustedScore: NewsAdjustedScore;
  tradeTimingRecommendations: string[];
}

