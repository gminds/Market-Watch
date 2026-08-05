/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Newspaper,
  AlertTriangle,
  Clock,
  Sparkles,
  ShieldAlert,
  TrendingUp,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Info,
  RefreshCw,
} from 'lucide-react';
import {
  SymbolCode,
  SimilaritySearchResult,
  MarketProfileData,
} from '../types/market';
import { newsService } from '../services/newsService';
import { SYMBOL_CONFIGS } from '../config/symbols';

interface SmartNewsViewProps {
  activeSymbol: SymbolCode;
  onSelectPair: (symbol: SymbolCode) => void;
  similarityResult: SimilaritySearchResult | null;
  currentProfile: MarketProfileData;
}

export const SmartNewsView: React.FC<SmartNewsViewProps> = ({
  activeSymbol,
  onSelectPair,
  similarityResult,
  currentProfile,
}) => {
  const [nowTick, setNowTick] = useState(Date.now());

  // Refresh countdown timer every minute
  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Compute smart news watch data
  const data = newsService.getSmartNewsWatchData(
    activeSymbol,
    similarityResult?.topMatches,
    currentProfile.bias
  );

  const historicalComparison = newsService.getHistoricalNewsComparison(
    similarityResult?.topMatches || [],
    activeSymbol
  );

  const getStatusBadge = (status: 'Upcoming' | 'Live' | 'Released' | 'Completed') => {
    switch (status) {
      case 'Live':
        return (
          <span className="px-2 py-0.5 rounded bg-red-950/80 text-red-400 border border-red-800/80 font-mono text-[11px] font-bold animate-pulse inline-flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
            LIVE
          </span>
        );
      case 'Upcoming':
        return (
          <span className="px-2 py-0.5 rounded bg-blue-950/80 text-blue-300 border border-blue-800/80 font-mono text-[11px] font-semibold">
            Upcoming
          </span>
        );
      case 'Released':
        return (
          <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/80 font-mono text-[11px] font-semibold">
            Released
          </span>
        );
      case 'Completed':
        return (
          <span className="px-2 py-0.5 rounded bg-[#1f1f23] text-[#a1a1aa] border border-[#2d2d30] font-mono text-[11px]">
            Completed
          </span>
        );
    }
  };

  const getImpactBadge = (impact: 'HIGH' | 'MEDIUM' | 'LOW') => {
    if (impact === 'HIGH') {
      return (
        <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-bold uppercase tracking-wider">
          High
        </span>
      );
    }
    if (impact === 'MEDIUM') {
      return (
        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-semibold uppercase tracking-wider">
          Med
        </span>
      );
    }
    return (
      <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] uppercase tracking-wider">
        Low
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-6">
      {/* Top Banner: Asset Detection & Primary Event Countdown */}
      <div className="bg-[#111113] border-2 border-amber-500/40 rounded-xl p-5 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Newspaper className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-extrabold text-white uppercase tracking-wider font-sans">
                  Smart News Watch
                </h2>
                <span className="px-2.5 py-0.5 rounded-md bg-blue-950 text-blue-300 border border-blue-800 text-xs font-mono font-bold">
                  {activeSymbol}
                </span>
                <span className="text-xs text-[#a1a1aa] font-mono">
                  → Relevant Currencies: {data.relevantCurrencies.join(' & ')}
                </span>
              </div>
              <p className="text-xs text-[#a1a1aa] mt-1">
                Monitors scheduled high-impact economic events & combines them with historical Market Profile similarity.
              </p>
            </div>
          </div>

          {/* Live Countdown & Event Status */}
          <div className="flex items-center gap-3 bg-[#0c0c0e] px-4 py-3 rounded-xl border border-[#2d2d30]">
            <Clock className="w-5 h-5 text-amber-400 animate-pulse shrink-0" />
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[#71717a] font-bold">
                Next High-Impact Release
              </div>
              <div className="text-sm font-extrabold text-white flex items-center gap-2">
                {data.nextHighImpactEvent ? (
                  <>
                    <span>
                      {data.nextHighImpactEvent.currency} {data.nextHighImpactEvent.event}
                    </span>
                    <span className="text-amber-400 font-mono font-bold">
                      ({data.countdownTimerStr})
                    </span>
                  </>
                ) : (
                  <span className="text-emerald-400">No upcoming high-impact events today</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Symbol Switch Bar */}
        <div className="mt-4 pt-3 border-t border-[#2d2d30] flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-xs text-[#71717a] font-semibold shrink-0">Switch Asset:</span>
          {(Object.keys(SYMBOL_CONFIGS) as SymbolCode[]).map((s) => (
            <button
              key={s}
              onClick={() => onSelectPair(s)}
              className={`px-2.5 py-1 rounded text-xs font-mono font-semibold transition-all shrink-0 ${
                activeSymbol === s
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow'
                  : 'bg-[#161618] hover:bg-[#202023] text-[#a1a1aa] border border-[#2d2d30]'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Grid Section 1: Trading Warnings & Daily Market Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trading Warnings Panel */}
        <div className="bg-[#111113] border border-red-500/30 rounded-xl p-5 shadow-2xl space-y-3">
          <div className="flex items-center gap-2 border-b border-[#2d2d30] pb-2.5">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Trading Warnings & Event Risk
            </h3>
          </div>
          <div className="space-y-2">
            {data.tradingWarnings.map((warn, i) => (
              <div
                key={i}
                className="p-2.5 rounded-lg bg-red-950/30 border border-red-800/40 text-xs text-red-200 font-mono flex items-start gap-2"
              >
                <span className="text-red-400 font-bold">•</span>
                <span>{warn}</span>
              </div>
            ))}
          </div>
        </div>

        {/* AI Daily Market Summary & Enhanced Forecast (2 cols span) */}
        <div className="lg:col-span-2 bg-[#111113] border border-blue-500/40 rounded-xl p-5 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-[#2d2d30] pb-2.5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-sans">
                AI Market Summary & News-Enhanced Forecast
              </h3>
            </div>
            <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/30 text-[10px] font-mono font-bold">
              AI QUANT & MACRO COMBINED
            </span>
          </div>

          <div className="space-y-3">
            <div className="p-3.5 rounded-lg bg-[#0c0c0e] border border-[#2d2d30] space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400 font-mono">
                Daily Economic & Volatility Outlook
              </div>
              <p className="text-xs sm:text-sm text-[#e0e0e0] leading-relaxed">
                {data.dailyMarketSummary}
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-blue-950/20 border border-blue-500/30 space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-blue-300 font-mono flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-400" />
                <span>AI Enhanced Forecast (News + Profile Structure)</span>
              </div>
              <p className="text-xs sm:text-sm text-[#e0e0e0] leading-relaxed">
                {data.aiMarketForecastEnhanced}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Today's High Impact News Panel Table */}
      <div className="bg-[#111113] border border-[#2d2d30] rounded-xl p-5 shadow-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2d2d30] pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Today's Scheduled Economic Events Panel
              </h3>
              <p className="text-xs text-[#a1a1aa]">
                Filtering releases for {activeSymbol} ({data.relevantCurrencies.join(', ')}) with live countdown status
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono text-[#a1a1aa]">
            <span>
              High Impact Events: <strong className="text-red-400">{data.highImpactCount}</strong>
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-mono text-xs">
            <thead>
              <tr className="border-b border-[#2d2d30] text-[#71717a] text-[11px] uppercase tracking-wider bg-[#0c0c0e]">
                <th className="py-3 px-3">Time (UTC)</th>
                <th className="py-3 px-3">Currency</th>
                <th className="py-3 px-3">Event</th>
                <th className="py-3 px-3">Impact</th>
                <th className="py-3 px-3">Forecast</th>
                <th className="py-3 px-3">Previous</th>
                <th className="py-3 px-3">Countdown</th>
                <th className="py-3 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1f1f23] text-[#e0e0e0]">
              {data.todayEvents.map((e) => (
                <tr
                  key={e.id}
                  className={`hover:bg-[#161618] transition-colors ${
                    e.impact === 'HIGH' ? 'bg-red-950/10' : ''
                  }`}
                >
                  <td className="py-3 px-3 font-bold text-white">{e.timeUtc}</td>
                  <td className="py-3 px-3">
                    <span className="px-1.5 py-0.5 rounded bg-[#1f1f23] text-blue-300 font-bold border border-[#2d2d30]">
                      {e.currency}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-sans font-semibold text-[#e0e0e0] max-w-xs truncate">
                    {e.event}
                  </td>
                  <td className="py-3 px-3">{getImpactBadge(e.impact)}</td>
                  <td className="py-3 px-3 text-amber-300 font-semibold">{e.forecast}</td>
                  <td className="py-3 px-3 text-[#a1a1aa]">{e.previous}</td>
                  <td className="py-3 px-3">
                    <span className="font-bold text-blue-300">{e.countdownStr}</span>
                  </td>
                  <td className="py-3 px-3">{getStatusBadge(e.status)}</td>
                </tr>
              ))}
              {data.todayEvents.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-[#71717a]">
                    No economic releases matching {activeSymbol} currencies today.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 3: AI News Similarity Score & News-Adjusted Confidence Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: AI News Similarity & Combined Score */}
        <div className="bg-[#111113] border border-blue-500/30 rounded-xl p-5 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-[#2d2d30] pb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                AI News Similarity & Confidence Matrix
              </h3>
            </div>
            <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800 text-[10px] font-mono font-bold">
              WEIGHTED SCORE
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-[#0c0c0e] border border-[#2d2d30] text-center space-y-1">
              <span className="text-[10px] text-[#71717a] font-sans font-bold uppercase block">
                Profile Similarity
              </span>
              <span className="text-2xl font-extrabold text-blue-400 font-mono">
                {data.newsAdjustedScore.profileSimilarityPct}%
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0c0c0e] border border-[#2d2d30] text-center space-y-1">
              <span className="text-[10px] text-[#71717a] font-sans font-bold uppercase block">
                News Environment
              </span>
              <span className="text-2xl font-extrabold text-amber-400 font-mono">
                {data.newsAdjustedScore.newsSimilarityPct}%
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-blue-950/30 border border-blue-500/40 text-center space-y-1">
              <span className="text-[10px] text-blue-300 font-sans font-bold uppercase block">
                Combined Confidence
              </span>
              <span className="text-2xl font-extrabold text-emerald-400 font-mono">
                {Math.round(
                  data.newsAdjustedScore.profileSimilarityPct * 0.65 +
                    data.newsAdjustedScore.newsSimilarityPct * 0.35
                )}
                %
              </span>
            </div>
          </div>

          {/* Detailed News-Adjusted Confidence Breakdown List */}
          <div className="space-y-2 text-xs font-mono pt-2">
            <div className="flex justify-between items-center py-1.5 border-b border-[#1f1f23]">
              <span className="text-[#a1a1aa]">Profile Structure Similarity:</span>
              <span className="font-bold text-white">{data.newsAdjustedScore.profileSimilarityPct}%</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-[#1f1f23]">
              <span className="text-[#a1a1aa]">Historical Analogue Accuracy:</span>
              <span className="font-bold text-emerald-400">{data.newsAdjustedScore.historicalAccuracyPct}%</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-[#1f1f23]">
              <span className="text-[#a1a1aa]">News Environment Match:</span>
              <span className="font-bold text-amber-400">{data.newsAdjustedScore.newsSimilarityPct}%</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-[#1f1f23]">
              <span className="text-[#a1a1aa]">Current Volatility Match:</span>
              <span className="font-bold text-blue-300">{data.newsAdjustedScore.currentVolatilityMatchPct}%</span>
            </div>
            <div className="flex justify-between items-center py-2 text-sm">
              <span className="text-white font-bold">Overall News-Adjusted Confidence:</span>
              <span className="font-extrabold text-emerald-400">
                {data.newsAdjustedScore.overallConfidencePct}%
              </span>
            </div>
          </div>
        </div>

        {/* Right: Trade Timing Recommendations */}
        <div className="bg-[#111113] border border-[#2d2d30] rounded-xl p-5 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-[#2d2d30] pb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-emerald-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Trade Timing Recommendations
              </h3>
            </div>
            <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-mono font-bold">
              EXECUTION GUIDANCE
            </span>
          </div>

          <div className="space-y-3 pt-1">
            {data.tradeTimingRecommendations.map((rec, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-[#0c0c0e] border border-[#2d2d30] text-xs sm:text-sm text-[#e0e0e0] font-sans flex items-start gap-3"
              >
                <div className="text-base shrink-0">{rec.slice(0, 2)}</div>
                <div className="leading-relaxed font-semibold">{rec.slice(2).trim()}</div>
              </div>
            ))}

            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-center gap-2.5">
              <Info className="w-4 h-4 shrink-0 text-amber-400" />
              <span>
                Always adjust position sizing when trading into major central bank announcements or CPI/NFP reports.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Section 4: Historical News Comparison Table (NEW) */}
      <div className="bg-[#111113] border border-[#2d2d30] rounded-xl p-5 shadow-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2d2d30] pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-400" />
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Historical News Comparison (Top Profile Matches & Macro Environment)
              </h3>
              <p className="text-xs text-[#a1a1aa]">
                Determines whether historical Market Profile similarity analogues occurred under similar major news conditions
              </p>
            </div>
          </div>
          <span className="text-xs text-[#71717a] font-mono">
            Analogue Count: {historicalComparison.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-mono text-xs">
            <thead>
              <tr className="border-b border-[#2d2d30] text-[#71717a] text-[11px] uppercase tracking-wider bg-[#0c0c0e]">
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Similarity</th>
                <th className="py-3 px-3">Next Day Outcome</th>
                <th className="py-3 px-3">Major News</th>
                <th className="py-3 px-3">News Similarity</th>
                <th className="py-3 px-3">Combined Confidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1f1f23] text-[#e0e0e0]">
              {historicalComparison.map((item, idx) => (
                <tr key={idx} className="hover:bg-[#161618] transition-colors">
                  <td className="py-3 px-3 font-bold text-white">{item.dateStr}</td>
                  <td className="py-3 px-3 font-bold text-blue-400">{item.similarityPct.toFixed(1)}%</td>
                  <td className="py-3 px-3">
                    <span
                      className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                        item.nextDayOutcome === 'Bullish'
                          ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800'
                          : item.nextDayOutcome === 'Bearish'
                          ? 'bg-red-950/80 text-red-400 border border-red-800'
                          : 'bg-amber-950/80 text-amber-300 border border-amber-800'
                      }`}
                    >
                      {item.nextDayOutcome}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                        item.majorNews === 'None'
                          ? 'bg-[#1f1f23] text-[#a1a1aa] border border-[#2d2d30]'
                          : 'bg-red-950/60 text-red-300 border border-red-800/60 font-bold'
                      }`}
                    >
                      {item.majorNews}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-bold text-amber-300">{item.newsSimilarityPct}%</td>
                  <td className="py-3 px-3 font-extrabold text-emerald-400">
                    {item.combinedConfidencePct}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
