import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Compass,
  Database,
  Flame,
  Info,
  Layers,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import {
  Candle,
  DailyProfileRecord,
  MarketProfileData,
  ScannerPairItem,
  SimilaritySearchResult,
  SymbolCode,
  TradeSignal,
  UserSettings,
} from '../types/market';
import { TpoHistogram } from './TpoHistogram';
import { ScannerGrid } from './ScannerGrid';
import { SignalChartPanel } from './SignalChartPanel';
import { profileRecordToMarketProfile } from '../services/tpoEngine';
import { formatPrice, getSymbolConfig } from '../config/symbols';

interface DashboardViewProps {
  currentProfile: MarketProfileData;
  yesterdayProfile: DailyProfileRecord | null;
  candles: Candle[];
  settings: UserSettings;
  tradeSignal: TradeSignal | null;
  scannerItems: ScannerPairItem[];
  similarityResult?: SimilaritySearchResult;
  onSelectPair: (symbol: SymbolCode) => void;
  onOpenFullChart: () => void;
  onOpenSimilarityTab?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  currentProfile,
  yesterdayProfile,
  candles,
  settings,
  tradeSignal,
  scannerItems,
  similarityResult,
  onSelectPair,
  onOpenFullChart,
  onOpenSimilarityTab,
}) => {
  const [showScoreBreakdownModal, setShowScoreBreakdownModal] = useState(false);

  if (!currentProfile) return null;

  const isUpDay = currentProfile.close >= currentProfile.open;
  const symbolConfig = getSymbolConfig(currentProfile.symbol);
  const pipDivisor = symbolConfig.pipValue || 0.0001;
  const rawPips = (currentProfile.close - currentProfile.open) / pipDivisor;
  
  const pipsChangeText =
    Math.abs(rawPips) < 10 && Math.abs(rawPips) > 0
      ? rawPips > 0
        ? `+${rawPips.toFixed(1)}`
        : rawPips.toFixed(1)
      : rawPips > 0
      ? `+${Math.round(rawPips)}`
      : `${Math.round(rawPips)}`;

  const breakdown = currentProfile.scoreBreakdown;

  // Dynamic Forecast calculation derived from similarityResult & current profile
  const forecast = similarityResult?.todayForecast;
  const outcomeStats = similarityResult?.outcomeStats;

  const forecastBias = forecast?.bias || (currentProfile.bias.includes('Bullish') ? 'BULLISH' : currentProfile.bias.includes('Bearish') ? 'BEARISH' : 'NEUTRAL');
  const forecastBiasDisplay = forecastBias === 'BULLISH' ? 'Bullish' : forecastBias === 'BEARISH' ? 'Bearish' : 'Neutral';
  const biasTextColor = forecastBias === 'BULLISH' ? 'text-emerald-400' : forecastBias === 'BEARISH' ? 'text-red-400' : 'text-amber-400';

  const probValue = forecast?.confidencePct || (outcomeStats ? Math.max(outcomeStats.upPct, outcomeStats.downPct, outcomeStats.rangePct) : 70);
  const probTextColor = probValue >= 65 ? 'text-emerald-400' : probValue >= 50 ? 'text-amber-400' : 'text-blue-400';

  const expectedRange = forecast?.expectedRangePips || currentProfile.atr14Pips || 85;

  const expectedDir = forecastBias === 'BULLISH' ? 'Higher' : forecastBias === 'BEARISH' ? 'Lower' : 'Rotational';
  const dirTextColor = forecastBias === 'BULLISH' ? 'text-emerald-400' : forecastBias === 'BEARISH' ? 'text-red-400' : 'text-amber-400';

  const expectedProfileShape = similarityResult?.topMatches?.[0]?.followingDayShape || similarityResult?.targetShape || currentProfile.profileShape || 'Normal Variation';

  const riskAssessment = currentProfile.marketScore >= 75 ? 'Low' : currentProfile.marketScore >= 50 ? 'Medium' : 'High';
  const riskTextColor = riskAssessment === 'Low' ? 'text-emerald-400' : riskAssessment === 'Medium' ? 'text-amber-400' : 'text-red-400';

  const confidenceScore = forecast?.confidencePct ? Math.min(98, Math.round(forecast.confidencePct * 1.15)) : (currentProfile.marketScore || 82);

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-6">
      {/* Top Hero Active Symbol Live Banner */}
      <div className="bg-[#111113] border border-[#2d2d30] rounded-xl p-5 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Price & Primary Info */}
          <div className="lg:col-span-5 space-y-3">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded bg-[#161618] border border-[#2d2d30] text-xs font-mono font-bold text-blue-400">
                {currentProfile.symbol}
              </span>
              <span className="text-xs text-[#71717a] font-sans font-medium">
                London Session Market Profile
              </span>
            </div>

            <div className="flex items-baseline gap-4 font-mono">
              <div className="text-4xl sm:text-5xl font-extrabold tracking-tight text-[#ffffff]">
                {formatPrice(currentProfile.close, currentProfile.symbol)}
              </div>
              <div
                className={`flex items-center gap-1 text-sm font-bold px-2.5 py-1 rounded-md ${
                  isUpDay
                    ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/80'
                    : 'bg-red-950/80 text-red-400 border border-red-800/80'
                }`}
              >
                {isUpDay ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                <span>
                  {pipsChangeText} pips
                </span>
              </div>
            </div>

            {/* Quick Metrics Line */}
            <div className="grid grid-cols-4 gap-2 pt-2 border-t border-[#2d2d30] text-xs font-mono">
              <div>
                <span className="text-[#71717a] text-[10px] uppercase block">Session High</span>
                <span className="text-[#e0e0e0] font-semibold">{formatPrice(currentProfile.high, currentProfile.symbol)}</span>
              </div>
              <div>
                <span className="text-[#71717a] text-[10px] uppercase block">Session Low</span>
                <span className="text-[#e0e0e0] font-semibold">{formatPrice(currentProfile.low, currentProfile.symbol)}</span>
              </div>
              <div>
                <span className="text-[#71717a] text-[10px] uppercase block">ATR(14)</span>
                <span className="text-blue-400 font-semibold">{currentProfile.atr14Pips} pips</span>
              </div>
              <div>
                <span className="text-[#71717a] text-[10px] uppercase block">Range Expansion</span>
                <span className="text-amber-400 font-semibold">
                  {currentProfile.rangeExpansionRatio}x
                </span>
              </div>
            </div>
          </div>

          {/* Quality Score & Rating Badge */}
          <div className="lg:col-span-3 bg-[#0c0c0e] border border-[#2d2d30] p-4 rounded-lg flex flex-col items-center justify-center text-center space-y-2">
            <div className="flex items-center justify-between w-full">
              <span className="text-[11px] uppercase tracking-wider text-[#71717a] font-bold font-sans">
                Quality Score & Rating
              </span>
              <button
                onClick={() => setShowScoreBreakdownModal(!showScoreBreakdownModal)}
                className="text-blue-400 hover:underline text-[10px] font-mono flex items-center gap-0.5"
              >
                <Info className="w-3 h-3" />
                <span>Breakdown</span>
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div
                className={`text-4xl font-extrabold font-mono ${
                  currentProfile.marketScore >= 85
                    ? 'text-emerald-400'
                    : currentProfile.marketScore >= 75
                    ? 'text-blue-400'
                    : currentProfile.marketScore >= 60
                    ? 'text-amber-400'
                    : 'text-[#71717a]'
                }`}
              >
                {currentProfile.marketScore}
              </div>
              <div className="text-left font-mono space-y-0.5">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase inline-block ${
                    currentProfile.qualityRating === 'Excellent'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      : currentProfile.qualityRating === 'Good'
                      ? 'bg-blue-950 text-blue-300 border border-blue-800'
                      : 'bg-amber-950 text-amber-300 border border-amber-800'
                  }`}
                >
                  {currentProfile.qualityRating}
                </span>
                <div
                  className={`text-xs font-bold ${
                    currentProfile.bias.includes('Bullish')
                      ? 'text-emerald-400'
                      : currentProfile.bias.includes('Bearish')
                      ? 'text-red-400'
                      : 'text-[#e0e0e0]'
                  }`}
                >
                  {currentProfile.bias}
                </div>
              </div>
            </div>

            <div className="w-full bg-[#161618] h-2 rounded-full overflow-hidden mt-1">
              <div
                className={`h-full transition-all duration-500 ${
                  currentProfile.marketScore >= 85
                    ? 'bg-emerald-500'
                    : currentProfile.marketScore >= 75
                    ? 'bg-blue-500'
                    : 'bg-[#2d2d30]'
                }`}
                style={{ width: `${currentProfile.marketScore}%` }}
              />
            </div>
            <div className="text-[10px] text-[#71717a] font-mono italic">
              {currentProfile.statusText}
            </div>
          </div>

          {/* Key Auction Levels Box */}
          <div className="lg:col-span-4 bg-[#0c0c0e] border border-[#2d2d30] p-4 rounded-lg space-y-2 font-mono text-xs">
            <div className="flex items-center justify-between text-[#71717a] border-b border-[#2d2d30] pb-1 font-sans text-[11px] font-bold">
              <span>KEY AUCTION LEVELS</span>
              <button
                onClick={onOpenFullChart}
                className="text-blue-400 hover:underline text-[10px] flex items-center gap-1"
              >
                <span>Full Chart</span> &rarr;
              </button>
            </div>
            <div className="flex justify-between items-center py-0.5">
              <span className="text-amber-400 font-bold">POC (Point of Control):</span>
              <span className="text-amber-300 font-extrabold">{formatPrice(currentProfile.poc, currentProfile.symbol)}</span>
            </div>
            <div className="flex justify-between items-center py-0.5">
              <span className="text-emerald-400 font-semibold">VAH (Value Area High):</span>
              <span className="text-emerald-300 font-bold">{formatPrice(currentProfile.vah, currentProfile.symbol)}</span>
            </div>
            <div className="flex justify-between items-center py-0.5">
              <span className="text-emerald-400 font-semibold">VAL (Value Area Low):</span>
              <span className="text-emerald-300 font-bold">{formatPrice(currentProfile.val, currentProfile.symbol)}</span>
            </div>
            <div className="flex justify-between items-center py-0.5">
              <span className="text-blue-400">Initial Balance Range:</span>
              <span className="text-blue-300 font-medium">
                {formatPrice(currentProfile.initialBalance.low, currentProfile.symbol)} - {formatPrice(currentProfile.initialBalance.high, currentProfile.symbol)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Today's Forecast Display Card */}
      <div className="bg-[#111113] border-2 border-blue-500/40 rounded-xl p-5 shadow-2xl relative overflow-hidden space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2d2d30] pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
            <div>
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider font-sans flex items-center gap-2">
                <span>Today's Forecast</span>
                <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800 text-[10px] font-mono font-bold">
                  {currentProfile.symbol}
                </span>
              </h3>
              <p className="text-xs text-[#a1a1aa]">
                Quantitative market profile forecast & auction expectation
              </p>
            </div>
          </div>
          <div className="text-xs text-[#71717a] font-mono">
            Updated Daily
          </div>
        </div>

        {/* 7 Core Forecast Metrics Display Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 font-mono text-xs">
          <div className="bg-[#0c0c0e] p-3.5 rounded-xl border border-[#2d2d30] space-y-1">
            <span className="text-[10px] text-[#71717a] font-sans font-bold uppercase block">Today's Bias</span>
            <span className={`text-lg font-extrabold ${biasTextColor}`}>{forecastBiasDisplay}</span>
          </div>

          <div className="bg-[#0c0c0e] p-3.5 rounded-xl border border-[#2d2d30] space-y-1">
            <span className="text-[10px] text-[#71717a] font-sans font-bold uppercase block">Probability</span>
            <span className={`text-lg font-extrabold ${probTextColor}`}>{probValue}%</span>
          </div>

          <div className="bg-[#0c0c0e] p-3.5 rounded-xl border border-[#2d2d30] space-y-1">
            <span className="text-[10px] text-[#71717a] font-sans font-bold uppercase block">Expected Range</span>
            <span className="text-lg font-extrabold text-blue-400">{expectedRange} pips</span>
          </div>

          <div className="bg-[#0c0c0e] p-3.5 rounded-xl border border-[#2d2d30] space-y-1">
            <span className="text-[10px] text-[#71717a] font-sans font-bold uppercase block">Expected Direction</span>
            <span className={`text-lg font-extrabold ${dirTextColor}`}>{expectedDir}</span>
          </div>

          <div className="bg-[#0c0c0e] p-3.5 rounded-xl border border-[#2d2d30] space-y-1">
            <span className="text-[10px] text-[#71717a] font-sans font-bold uppercase block">Expected Profile</span>
            <span className="text-lg font-extrabold text-indigo-300 truncate block">{expectedProfileShape}</span>
          </div>

          <div className="bg-[#0c0c0e] p-3.5 rounded-xl border border-[#2d2d30] space-y-1">
            <span className="text-[10px] text-[#71717a] font-sans font-bold uppercase block">Risk</span>
            <span className={`text-lg font-extrabold ${riskTextColor}`}>{riskAssessment}</span>
          </div>

          <div className="bg-[#0c0c0e] p-3.5 rounded-xl border border-[#2d2d30] space-y-1">
            <span className="text-[10px] text-[#71717a] font-sans font-bold uppercase block">Confidence</span>
            <span className="text-lg font-extrabold text-blue-400">{confidenceScore}%</span>
          </div>
        </div>
      </div>

      {/* Score Breakdown Detail Cards (Prompt 5) */}
      {showScoreBreakdownModal && (
        <div className="bg-[#111113] border border-blue-900/60 rounded-xl p-5 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-[#2d2d30] pb-3">
            <div className="font-bold text-sm text-white flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-blue-400" />
              <span>Profile Quality Engine Score Breakdown (Total 100 Points)</span>
            </div>
            <button
              onClick={() => setShowScoreBreakdownModal(false)}
              className="text-[#71717a] hover:text-white text-xs font-mono"
            >
              Close [X]
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 font-mono text-xs">
            <div className="bg-[#0c0c0e] p-3 rounded-lg border border-[#2d2d30]">
              <div className="text-[10px] text-[#71717a] uppercase">1. Trend Alignment</div>
              <div className="text-base font-bold text-blue-400">{breakdown.trendAlignment} / 20</div>
            </div>
            <div className="bg-[#0c0c0e] p-3 rounded-lg border border-[#2d2d30]">
              <div className="text-[10px] text-[#71717a] uppercase">2. ATR Expansion</div>
              <div className="text-base font-bold text-blue-400">{breakdown.atrExpansion} / 15</div>
            </div>
            <div className="bg-[#0c0c0e] p-3 rounded-lg border border-[#2d2d30]">
              <div className="text-[10px] text-[#71717a] uppercase">3. POC Migration</div>
              <div className="text-base font-bold text-blue-400">{breakdown.pocMigration} / 15</div>
            </div>
            <div className="bg-[#0c0c0e] p-3 rounded-lg border border-[#2d2d30]">
              <div className="text-[10px] text-[#71717a] uppercase">4. Outside Value Acceptance</div>
              <div className="text-base font-bold text-blue-400">{breakdown.valueAcceptance} / 15</div>
            </div>
            <div className="bg-[#0c0c0e] p-3 rounded-lg border border-[#2d2d30]">
              <div className="text-[10px] text-[#71717a] uppercase">5. Range Extension</div>
              <div className="text-base font-bold text-blue-400">{breakdown.rangeExtension} / 10</div>
            </div>
            <div className="bg-[#0c0c0e] p-3 rounded-lg border border-[#2d2d30]">
              <div className="text-[10px] text-[#71717a] uppercase">6. Profile Shape Quality</div>
              <div className="text-base font-bold text-blue-400">{breakdown.profileShapeScore} / 10</div>
            </div>
            <div className="bg-[#0c0c0e] p-3 rounded-lg border border-[#2d2d30]">
              <div className="text-[10px] text-[#71717a] uppercase">7. Single Prints</div>
              <div className="text-base font-bold text-blue-400">{breakdown.singlePrints} / 5</div>
            </div>
            <div className="bg-[#0c0c0e] p-3 rounded-lg border border-[#2d2d30]">
              <div className="text-[10px] text-[#71717a] uppercase">8. Excess High/Low</div>
              <div className="text-base font-bold text-blue-400">{breakdown.excess} / 5</div>
            </div>
            <div className="bg-[#0c0c0e] p-3 rounded-lg border border-[#2d2d30]">
              <div className="text-[10px] text-[#71717a] uppercase">9. Value Migration</div>
              <div className="text-base font-bold text-blue-400">{breakdown.valueMigration} / 5</div>
            </div>
            <div className="bg-[#0c0c0e] p-3 rounded-lg border border-[#2d2d30]">
              <div className="text-[10px] text-[#71717a] uppercase">10. IB Break</div>
              <div className="text-base font-bold text-blue-400">{breakdown.ibBreak} / 5</div>
            </div>
          </div>
        </div>
      )}

      {/* Multi-Pair Live Scanner Section */}
      <ScannerGrid
        scannerItems={scannerItems}
        onSelectPair={onSelectPair}
        activeSymbol={currentProfile.symbol}
      />

      {/* Main Side-by-Side Market Profiles Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Yesterday's Completed Profile */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#e0e0e0] font-sans flex items-center gap-2">
              <Database className="w-4 h-4 text-[#71717a]" />
              <span>Yesterday (Completed Day Profile)</span>
            </h3>
            {yesterdayProfile && (
              <span className="text-xs font-mono text-[#71717a]">
                {yesterdayProfile.tradingDate}
              </span>
            )}
          </div>

          {yesterdayProfile ? (
            <TpoHistogram
              profile={profileRecordToMarketProfile(yesterdayProfile, currentProfile.symbol)}
              title={`Yesterday's Profile (${yesterdayProfile.profileShape})`}
              isDeveloping={false}
              maxHeightPx={480}
            />
          ) : (
            <div className="bg-[#111113] border border-[#2d2d30] rounded-lg p-12 text-center text-[#71717a] font-mono text-xs">
              No Previous Day Profile Archived Yet
            </div>
          )}
        </div>

        {/* Today's Developing Profile */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-400 font-sans flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-400" />
              <span>Today (Developing Profile - Live)</span>
            </h3>
            <span className="text-xs font-mono text-emerald-400 font-bold animate-pulse">
              RECURRING 1-MIN REFRESH
            </span>
          </div>

          <TpoHistogram
            profile={currentProfile}
            title={`Developing Profile (${currentProfile.profileShape})`}
            isDeveloping={true}
            maxHeightPx={480}
          />
        </div>
      </div>

      {/* Profile Similarity Search Widget Section */}
      {similarityResult && similarityResult.topMatches.length > 0 && (
        <div className="bg-[#111113] border border-[#2d2d30] rounded-xl p-5 shadow-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2d2d30] pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4.5 h-4.5 text-blue-400" />
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-sans">
                  Profile Similarity Search & Today's Forecast
                </h3>
                <p className="text-xs text-[#71717a]">
                  Yesterday's completed {similarityResult.targetSymbol} ({similarityResult.targetShape}, {similarityResult.targetDate}) matched against {similarityResult.totalCompared} historical sessions
                </p>
              </div>
            </div>

            {onOpenSimilarityTab && (
              <button
                onClick={onOpenSimilarityTab}
                className="px-3.5 py-1.5 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all self-start sm:self-auto"
              >
                <span>View All Top 10 Matches</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 font-mono text-xs">
            {/* Historical Probability Edge */}
            <div className="bg-[#0c0c0e] p-3 rounded-lg border border-[#2d2d30] space-y-1">
              <span className="text-[10px] text-[#71717a] uppercase block">Historical Edge</span>
              <span
                className={`text-base font-extrabold flex items-center gap-1 ${
                  similarityResult.outcomeStats.dominantOutcome === 'UP'
                    ? 'text-emerald-400'
                    : similarityResult.outcomeStats.dominantOutcome === 'DOWN'
                    ? 'text-red-400'
                    : 'text-amber-400'
                }`}
              >
                {similarityResult.outcomeStats.dominantOutcome === 'UP' && <TrendingUp className="w-4 h-4" />}
                {similarityResult.outcomeStats.dominantOutcome === 'DOWN' && <TrendingDown className="w-4 h-4" />}
                {similarityResult.outcomeStats.dominantOutcome === 'UP'
                  ? `${similarityResult.outcomeStats.upPct}% Bullish`
                  : similarityResult.outcomeStats.dominantOutcome === 'DOWN'
                  ? `${similarityResult.outcomeStats.downPct}% Bearish`
                  : `${similarityResult.outcomeStats.rangePct}% Ranging`}
              </span>
            </div>

            {/* 1h Avg Move */}
            <div className="bg-[#0c0c0e] p-3 rounded-lg border border-[#2d2d30] space-y-1">
              <span className="text-[10px] text-[#71717a] uppercase block">Avg +1 Hour Move</span>
              <span
                className={`text-base font-bold ${
                  similarityResult.avgMove1hPips >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {similarityResult.avgMove1hPips >= 0 ? `+${similarityResult.avgMove1hPips}` : similarityResult.avgMove1hPips} pips
              </span>
            </div>

            {/* 4h Avg Move */}
            <div className="bg-[#0c0c0e] p-3 rounded-lg border border-[#2d2d30] space-y-1">
              <span className="text-[10px] text-[#71717a] uppercase block">Avg +4 Hours Move</span>
              <span
                className={`text-base font-bold ${
                  similarityResult.avgMove4hPips >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {similarityResult.avgMove4hPips >= 0 ? `+${similarityResult.avgMove4hPips}` : similarityResult.avgMove4hPips} pips
              </span>
            </div>

            {/* EOD Avg Move */}
            <div className="bg-[#0c0c0e] p-3 rounded-lg border border-[#2d2d30] space-y-1">
              <span className="text-[10px] text-[#71717a] uppercase block">Avg End of Day Move</span>
              <span
                className={`text-base font-bold ${
                  similarityResult.avgMoveEodPips >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {similarityResult.avgMoveEodPips >= 0 ? `+${similarityResult.avgMoveEodPips}` : similarityResult.avgMoveEodPips} pips
              </span>
            </div>
          </div>

          {/* Top 3 Quick Preview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {similarityResult.topMatches.slice(0, 3).map((match) => (
              <div
                key={match.record.id}
                className="bg-[#0c0c0e] border border-[#2d2d30] p-3 rounded-lg font-mono text-xs space-y-2 hover:border-blue-500/30 transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">#{match.rank} {match.record.tradingDate}</span>
                  <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[10px] font-bold">
                    {match.similarityPct}% Match
                  </span>
                </div>

                <div className="text-[11px] text-[#a1a1aa] flex justify-between">
                  <span>{match.record.symbol || currentProfile.symbol} ({match.record.profileShape})</span>
                  <span
                    className={`font-extrabold ${
                      match.outcomeAfterProfile === 'UP'
                        ? 'text-emerald-400'
                        : match.outcomeAfterProfile === 'DOWN'
                        ? 'text-red-400'
                        : 'text-amber-400'
                    }`}
                  >
                    {match.outcomeAfterProfile}
                  </span>
                </div>

                <div className="text-[10px] text-[#71717a] border-t border-[#2d2d30] pt-1.5 flex justify-between">
                  <span>EOD Move:</span>
                  <span className={`font-bold ${match.moveEodPips >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {match.moveEodPips >= 0 ? `+${match.moveEodPips}` : match.moveEodPips} pips
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Signal Generator Candlestick Visualizer Panel */}
        <div className="lg:col-span-8">
          <SignalChartPanel
            candles={candles}
            profile={currentProfile}
            tradeSignal={tradeSignal}
          />
        </div>

        {/* Live Detected Imbalances Feed */}
        <div className="lg:col-span-4 bg-[#111113] border border-[#2d2d30] rounded-2xl p-5 shadow-2xl space-y-3 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-[#2d2d30] pb-3">
            <div className="flex items-center gap-2 font-bold text-sm text-[#e0e0e0]">
              <Flame className="w-4 h-4 text-amber-400" />
              <span>Live Detected Auction Events</span>
            </div>
            <span className="text-xs font-mono text-[#71717a]">
              {currentProfile.events.length} Events Detected
            </span>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
            {currentProfile.events.length > 0 ? (
              currentProfile.events.map((evt) => (
                <div
                  key={evt.id}
                  className="p-3 rounded-lg bg-[#0c0c0e] border border-[#2d2d30] flex items-start justify-between gap-3 text-xs font-mono"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 font-bold">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] ${
                          evt.severity === 'critical'
                            ? 'bg-red-950 text-red-400 border border-red-800'
                            : evt.severity === 'high'
                            ? 'bg-amber-950 text-amber-400 border border-amber-800'
                            : 'bg-blue-950 text-blue-400 border border-blue-800'
                        }`}
                      >
                        {evt.type}
                      </span>
                      <span className="text-[#e0e0e0]">{formatPrice(evt.price, currentProfile.symbol)}</span>
                    </div>
                    <div className="text-[#71717a] text-[11px] font-sans">{evt.details}</div>
                  </div>
                  <div className="text-[10px] text-[#71717a] shrink-0">{evt.timeStr}</div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-[#71717a] text-xs font-mono">
                No Auction Imbalances Detected Yet
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
