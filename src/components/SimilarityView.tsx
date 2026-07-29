import React, { useState } from 'react';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Compass,
  Database,
  Filter,
  Layers,
  Lightbulb,
  Search,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import {
  DailyProfileRecord,
  MarketProfileData,
  ProfileSimilarityMatch,
  SimilaritySearchResult,
  SymbolCode,
} from '../types/market';
import { TpoHistogram } from './TpoHistogram';
import { profileRecordToMarketProfile } from '../services/tpoEngine';

interface SimilarityViewProps {
  currentProfile: MarketProfileData;
  searchResult: SimilaritySearchResult;
  onSelectPair: (symbol: SymbolCode) => void;
}

export const SimilarityView: React.FC<SimilarityViewProps> = ({
  currentProfile,
  searchResult,
  onSelectPair,
}) => {
  const [selectedMatch, setSelectedMatch] = useState<ProfileSimilarityMatch | null>(null);
  const [filterOutcome, setFilterOutcome] = useState<'ALL' | 'UP' | 'DOWN' | 'RANGE'>('ALL');

  if (!currentProfile || !searchResult) return null;

  const filteredMatches = searchResult.topMatches.filter((m) => {
    if (filterOutcome === 'ALL') return true;
    return m.outcomeAfterProfile === filterOutcome;
  });

  const isJpy = currentProfile.symbol.includes('JPY');
  const forecast = searchResult.todayForecast;

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-6">
      {/* Top Hero Banner - Yesterday's Completed Profile & Today's Forecast */}
      <div className="bg-[#111113] border border-[#2d2d30] rounded-xl p-5 shadow-2xl relative overflow-hidden space-y-4">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#2d2d30] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded bg-blue-500/10 border border-blue-500/30 text-xs font-mono font-bold text-blue-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                <span>Pattern Recognition Engine</span>
              </span>
              <span className="text-xs text-emerald-400 font-mono font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Analysis Target: Yesterday's Completed Profile
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white mt-1">
              Market Profile Similarity Search & Today's Forecast
            </h1>
            <p className="text-xs text-[#a1a1aa] mt-0.5">
              Matching yesterday's completed <strong className="text-white">{searchResult.targetSymbol}</strong> profile ({searchResult.targetShape}, {searchResult.targetDate}) against {searchResult.totalCompared} historical session profiles to project today's outcomes.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-[#0c0c0e] p-3 rounded-lg border border-[#2d2d30] font-mono text-xs shrink-0">
            <div>
              <span className="text-[#71717a] text-[10px] uppercase block">Pair Analyzed</span>
              <span className="text-blue-400 font-bold text-sm">{searchResult.targetSymbol}</span>
            </div>
            <div className="w-px h-6 bg-[#2d2d30]" />
            <div>
              <span className="text-[#71717a] text-[10px] uppercase block">Yesterday Date</span>
              <span className="text-white font-semibold">{searchResult.targetDate}</span>
            </div>
            <div className="w-px h-6 bg-[#2d2d30]" />
            <div>
              <span className="text-[#71717a] text-[10px] uppercase block">Completed Shape</span>
              <span className="text-amber-400 font-bold">{searchResult.targetShape}</span>
            </div>
          </div>
        </div>

        {/* TODAY'S FORECAST PANEL */}
        {forecast && (
          <div className="bg-[#0c0c0e] border border-blue-900/60 p-4 rounded-xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#2d2d30] pb-2">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-bold font-sans uppercase tracking-wider text-white">
                  Today's Session Forecast (Derived from Yesterday's Matches)
                </span>
              </div>
              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="text-[#71717a]">Historical Confidence:</span>
                <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30">
                  {forecast.confidencePct}% Probability
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              {/* Left Directional Forecast Box */}
              <div className="md:col-span-4 bg-[#111113] p-3.5 rounded-lg border border-[#2d2d30] flex flex-col justify-between space-y-2">
                <span className="text-[10px] text-[#71717a] uppercase font-mono font-bold block">
                  Forecasted Directional Bias
                </span>
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-lg flex items-center justify-center font-black text-xl shrink-0 ${
                      forecast.bias === 'BULLISH'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : forecast.bias === 'BEARISH'
                        ? 'bg-red-950 text-red-400 border border-red-800'
                        : 'bg-amber-950 text-amber-400 border border-amber-800'
                    }`}
                  >
                    {forecast.bias === 'BULLISH' && <TrendingUp className="w-6 h-6" />}
                    {forecast.bias === 'BEARISH' && <TrendingDown className="w-6 h-6" />}
                    {forecast.bias === 'NEUTRAL' && <Activity className="w-6 h-6" />}
                  </div>
                  <div>
                    <div className="text-lg font-extrabold font-mono text-white">
                      {forecast.bias} FORECAST
                    </div>
                    <div className="text-[11px] text-[#a1a1aa] font-mono">
                      {searchResult.outcomeStats.upPct}% Bullish | {searchResult.outcomeStats.downPct}% Bearish | {searchResult.outcomeStats.rangePct}% Range
                    </div>
                  </div>
                </div>

                <div className="text-[11px] font-mono text-[#a1a1aa] bg-[#0c0c0e] p-2 rounded border border-[#2d2d30]">
                  <span className="text-blue-400 font-bold block mb-0.5">Key Strategy:</span>
                  {forecast.keyTakeaway}
                </div>
              </div>

              {/* Right Expected Moves Grid */}
              <div className="md:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
                <div className="bg-[#111113] p-3 rounded-lg border border-[#2d2d30] space-y-1">
                  <span className="text-[10px] text-[#71717a] uppercase block">Expected +1h Move</span>
                  <span
                    className={`text-lg font-bold block ${
                      forecast.expectedMove1hPips >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {forecast.expectedMove1hPips >= 0 ? `+${forecast.expectedMove1hPips}` : forecast.expectedMove1hPips} Pips
                  </span>
                  <span className="text-[9px] text-[#71717a] block">First hour impulse</span>
                </div>

                <div className="bg-[#111113] p-3 rounded-lg border border-[#2d2d30] space-y-1">
                  <span className="text-[10px] text-[#71717a] uppercase block">Expected +4h Move</span>
                  <span
                    className={`text-lg font-bold block ${
                      forecast.expectedMove4hPips >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {forecast.expectedMove4hPips >= 0 ? `+${forecast.expectedMove4hPips}` : forecast.expectedMove4hPips} Pips
                  </span>
                  <span className="text-[9px] text-[#71717a] block">Mid-session extension</span>
                </div>

                <div className="bg-[#111113] p-3 rounded-lg border border-[#2d2d30] space-y-1">
                  <span className="text-[10px] text-[#71717a] uppercase block">Expected EOD Move</span>
                  <span
                    className={`text-lg font-bold block ${
                      forecast.expectedMoveEodPips >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {forecast.expectedMoveEodPips >= 0 ? `+${forecast.expectedMoveEodPips}` : forecast.expectedMoveEodPips} Pips
                  </span>
                  <span className="text-[9px] text-[#71717a] block">Net daily close delta</span>
                </div>

                <div className="bg-[#111113] p-3 rounded-lg border border-[#2d2d30] space-y-1">
                  <span className="text-[10px] text-[#71717a] uppercase block">Avg Session Range</span>
                  <span className="text-lg font-bold text-blue-400 block">
                    {forecast.expectedRangePips} Pips
                  </span>
                  <span className="text-[9px] text-[#71717a] block">High to Low volatility</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Top 10 Matches List Section */}
      <div className="bg-[#111113] border border-[#2d2d30] rounded-xl p-5 shadow-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2d2d30] pb-3">
          <div>
            <div className="font-bold text-sm text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-400" />
              <span>Top Historical Profiles Matching Yesterday's Profile</span>
            </div>
            <p className="text-xs text-[#71717a] mt-0.5">
              Each match shows the historical profile (Day T) and the outcomes recorded on the <strong className="text-white">following trading day (Day T+1)</strong>.
            </p>
          </div>

          {/* Outcome Filter Buttons */}
          <div className="flex items-center gap-1.5 font-mono text-xs">
            <span className="text-[#71717a] text-[11px] mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Filter Day T+1:
            </span>
            <button
              onClick={() => setFilterOutcome('ALL')}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                filterOutcome === 'ALL'
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                  : 'text-[#71717a] hover:text-[#e0e0e0] bg-[#161618]'
              }`}
            >
              All Matches ({searchResult.topMatches.length})
            </button>
            <button
              onClick={() => setFilterOutcome('UP')}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                filterOutcome === 'UP'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'text-[#71717a] hover:text-[#e0e0e0] bg-[#161618]'
              }`}
            >
              UP
            </button>
            <button
              onClick={() => setFilterOutcome('DOWN')}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                filterOutcome === 'DOWN'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                  : 'text-[#71717a] hover:text-[#e0e0e0] bg-[#161618]'
              }`}
            >
              DOWN
            </button>
            <button
              onClick={() => setFilterOutcome('RANGE')}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                filterOutcome === 'RANGE'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  : 'text-[#71717a] hover:text-[#e0e0e0] bg-[#161618]'
              }`}
            >
              RANGE
            </button>
          </div>
        </div>

        {/* List of Matches */}
        <div className="space-y-3">
          {filteredMatches.map((match) => (
            <div
              key={match.record.id}
              className="bg-[#0c0c0e] border border-[#2d2d30] hover:border-blue-500/40 p-4 rounded-xl transition-all shadow-md space-y-3"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                {/* Left Rank & Basic Info */}
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-lg font-mono font-bold text-sm flex items-center justify-center shrink-0 ${
                      match.rank === 1
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : match.rank === 2
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                        : 'bg-[#161618] text-[#a1a1aa] border border-[#2d2d30]'
                    }`}
                  >
                    #{match.rank}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="text-white font-bold text-sm">
                        Matched Date: {match.record.tradingDate}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-[#161618] border border-[#2d2d30] text-[10px] font-bold text-blue-400">
                        {match.record.symbol || 'GBPUSD'}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-[#161618] text-[10px] text-[#a1a1aa] font-medium">
                        {match.record.profileShape}
                      </span>
                    </div>

                    {/* Matching Factor Badges */}
                    <div className="flex items-center gap-1.5 flex-wrap mt-1">
                      {match.matchFactors.map((factor, fIdx) => (
                        <span
                          key={fIdx}
                          className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 text-[10px] font-mono"
                        >
                          ✓ {factor}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Similarity Score & Subsequent Outcome */}
                <div className="flex items-center gap-4 justify-between md:justify-end shrink-0 font-mono">
                  {/* Similarity Score % */}
                  <div className="text-right">
                    <span className="text-[10px] text-[#71717a] uppercase block">Similarity</span>
                    <span
                      className={`text-xl font-extrabold ${
                        match.similarityPct >= 90
                          ? 'text-emerald-400'
                          : match.similarityPct >= 80
                          ? 'text-blue-400'
                          : 'text-amber-400'
                      }`}
                    >
                      {match.similarityPct}% Match
                    </span>
                  </div>

                  {/* Following Day Outcome Badge */}
                  <div className="text-right">
                    <span className="text-[10px] text-[#71717a] uppercase block">Following Day (T+1)</span>
                    <span
                      className={`px-2.5 py-1 rounded text-xs font-extrabold uppercase inline-flex items-center gap-1 ${
                        match.outcomeAfterProfile === 'UP'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : match.outcomeAfterProfile === 'DOWN'
                          ? 'bg-red-950 text-red-300 border border-red-800'
                          : 'bg-amber-950 text-amber-300 border border-amber-800'
                      }`}
                    >
                      {match.outcomeAfterProfile === 'UP' && <TrendingUp className="w-3.5 h-3.5" />}
                      {match.outcomeAfterProfile === 'DOWN' && <TrendingDown className="w-3.5 h-3.5" />}
                      {match.outcomeAfterProfile}
                    </span>
                  </div>

                  {/* Inspect Button */}
                  <button
                    onClick={() => setSelectedMatch(match)}
                    className="px-3 py-1.5 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs font-semibold flex items-center gap-1 transition-all"
                  >
                    <span>Inspect</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Sub-row: Following Trading Day (Day T+1) Outcomes Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 bg-[#111113] p-2.5 rounded-lg border border-[#2d2d30] font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#71717a] text-[10px] uppercase">Following Date (T+1):</span>
                  <span className="text-white font-bold">
                    {match.followingDayDate || 'Next Session'}
                  </span>
                </div>

                <div className="flex items-center justify-between sm:border-l sm:border-[#2d2d30] sm:pl-2">
                  <span className="text-[#71717a] text-[10px] uppercase">Following Shape:</span>
                  <span className="text-amber-400 font-bold">
                    {match.followingDayShape || match.record.profileShape}
                  </span>
                </div>

                <div className="flex items-center justify-between sm:border-l sm:border-[#2d2d30] sm:pl-2">
                  <span className="text-[#71717a] text-[10px] uppercase">EOD Net Move:</span>
                  <span
                    className={`font-bold ${
                      match.moveEodPips >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {match.moveEodPips >= 0 ? `+${match.moveEodPips}` : match.moveEodPips} pips
                  </span>
                </div>

                <div className="flex items-center justify-between sm:border-l sm:border-[#2d2d30] sm:pl-2">
                  <span className="text-[#71717a] text-[10px] uppercase">Session Range:</span>
                  <span className="text-blue-400 font-bold">
                    {match.followingDayRangePips || 50} pips
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Side-by-Side Comparison Inspector Modal */}
      {selectedMatch && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#111113] border border-blue-900/60 rounded-xl max-w-5xl w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#2d2d30] pb-3">
              <div>
                <div className="text-xs font-mono text-blue-400 font-bold uppercase flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Profile Comparison & Subsequent Outcome Analysis</span>
                </div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2 mt-0.5">
                  <span>Yesterday's {currentProfile.symbol} Profile vs {selectedMatch.record.tradingDate} Historical Match ({selectedMatch.similarityPct}%)</span>
                </h3>
              </div>
              <button
                onClick={() => setSelectedMatch(null)}
                className="px-3 py-1 rounded bg-[#161618] hover:bg-[#222226] text-[#a1a1aa] hover:text-white font-mono text-xs border border-[#2d2d30]"
              >
                Close [ESC]
              </button>
            </div>

            {/* Side by Side Profiles */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Yesterday's Completed Profile */}
              <div>
                <div className="text-xs font-mono font-bold text-blue-400 mb-2 flex items-center justify-between">
                  <span>YESTERDAY'S PROFILE ({searchResult.targetDate})</span>
                  <span className="text-[#71717a]">{searchResult.targetShape}</span>
                </div>
                <TpoHistogram
                  profile={currentProfile}
                  title={`Yesterday's Completed Session (${searchResult.targetDate})`}
                  isDeveloping={false}
                  maxHeightPx={420}
                />
              </div>

              {/* Historical Match Profile */}
              <div>
                <div className="text-xs font-mono font-bold text-emerald-400 mb-2 flex items-center justify-between">
                  <span>HISTORICAL MATCH ({selectedMatch.record.tradingDate})</span>
                  <span className="text-emerald-400 font-bold">{selectedMatch.similarityPct}% Match</span>
                </div>
                <TpoHistogram
                  profile={profileRecordToMarketProfile(selectedMatch.record, selectedMatch.record.symbol || 'GBPUSD')}
                  title={`Historical Session (${selectedMatch.record.profileShape})`}
                  isDeveloping={false}
                  maxHeightPx={420}
                />
              </div>
            </div>

            {/* Bottom Details Footer showing Following Day (T+1) Outcome */}
            <div className="bg-[#0c0c0e] p-4 rounded-lg border border-[#2d2d30] flex flex-col md:flex-row items-center justify-between gap-4 font-mono text-xs">
              <div>
                <span className="text-[#71717a] uppercase block text-[10px]">Following Trading Day Outcome (Day T+1: {selectedMatch.followingDayDate || 'Next Day'})</span>
                <span className="text-white font-bold">
                  On the following day ({selectedMatch.followingDayDate || 'Next Day'}), price executed a <span className="text-amber-400">{selectedMatch.followingDayShape || selectedMatch.record.profileShape}</span> structure moving <span className={selectedMatch.moveEodPips >= 0 ? 'text-emerald-400' : 'text-red-400'}>{selectedMatch.moveEodPips >= 0 ? `+${selectedMatch.moveEodPips}` : selectedMatch.moveEodPips} pips</span> until EOD close ({selectedMatch.outcomeAfterProfile}).
                </span>
              </div>

              <button
                onClick={() => setSelectedMatch(null)}
                className="px-4 py-2 rounded bg-blue-500 text-white font-bold text-xs hover:bg-blue-600 transition-all shrink-0"
              >
                Back to Similarity Search
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
