import React, { useState } from 'react';
import {
  ArrowUpDown,
  Search,
  Zap,
  TrendingUp,
  TrendingDown,
  Clock,
  ExternalLink,
  ShieldAlert,
  Info,
  Target,
  BarChart3,
} from 'lucide-react';
import { QualityRating, ScannerAlertAction, ScannerPairItem, SymbolCode, MarketProfileData } from '../types/market';
import { formatPrice } from '../config/symbols';
import { SignalOutcomeTrackerView } from './SignalOutcomeTrackerView';

interface ScannerGridProps {
  scannerItems: ScannerPairItem[];
  onSelectPair: (symbol: SymbolCode) => void;
  activeSymbol: SymbolCode;
  activeProfile?: MarketProfileData | null;
}

export const ScannerGrid: React.FC<ScannerGridProps> = ({
  scannerItems,
  onSelectPair,
  activeSymbol,
  activeProfile,
}) => {
  const [viewMode, setViewMode] = useState<'matrix' | 'tracker' | 'both'>('matrix');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<'ALL' | 'BUY' | 'SELL' | 'Watch'>('ALL');
  const [sortField, setSortField] = useState<'score' | 'symbol' | 'atr'>('score');
  const [sortAsc, setSortAsc] = useState(false);

  // Filtering
  const filtered = scannerItems.filter((item) => {
    const matchesSearch =
      item.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.shape.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.bias.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesAction = actionFilter === 'ALL' || item.alertAction === actionFilter;

    return matchesSearch && matchesAction;
  });

  // Sorting
  const sorted = [...filtered].sort((a, b) => {
    let diff = 0;
    if (sortField === 'score') diff = b.score - a.score;
    else if (sortField === 'atr') diff = b.atr - a.atr;
    else if (sortField === 'symbol') diff = a.symbol.localeCompare(b.symbol);

    return sortAsc ? -diff : diff;
  });

  const handleSortToggle = (field: 'score' | 'symbol' | 'atr') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const getAlertBadgeClass = (action: ScannerAlertAction) => {
    switch (action) {
      case 'BUY':
        return 'bg-emerald-950 text-emerald-400 border border-emerald-700 shadow-sm font-black';
      case 'SELL':
        return 'bg-red-950 text-red-400 border border-red-700 shadow-sm font-black';
      case 'Watch':
        return 'bg-amber-950 text-amber-400 border border-amber-800 font-semibold';
      case 'None':
      default:
        return 'bg-[#161618] text-[#71717a] border border-[#2d2d30]';
    }
  };

  const getRatingBadgeClass = (rating: QualityRating) => {
    switch (rating) {
      case 'Excellent':
        return 'bg-emerald-950 text-emerald-300 border border-emerald-800';
      case 'Good':
        return 'bg-blue-950 text-blue-300 border border-blue-800';
      case 'Average':
        return 'bg-amber-950 text-amber-300 border border-amber-800';
      case 'Poor':
      default:
        return 'bg-[#161618] text-[#71717a] border border-[#2d2d30]';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Module Sub-Tab Switcher */}
      <div className="flex items-center justify-between bg-[#111113] border border-[#2d2d30] p-2 rounded-xl shadow-xl">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewMode('matrix')}
            className={`px-4 py-2 rounded-lg text-xs font-bold font-mono flex items-center gap-2 transition-all ${
              viewMode === 'matrix'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-[#71717a] hover:text-[#e0e0e0] hover:bg-[#18181b]'
            }`}
          >
            <Zap className="w-4 h-4 text-blue-300" />
            <span>Multi-Pair Scanner Matrix</span>
          </button>

          <button
            onClick={() => setViewMode('tracker')}
            className={`px-4 py-2 rounded-lg text-xs font-bold font-mono flex items-center gap-2 transition-all ${
              viewMode === 'tracker'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-[#71717a] hover:text-[#e0e0e0] hover:bg-[#18181b]'
            }`}
          >
            <Target className="w-4 h-4 text-emerald-300 animate-pulse" />
            <span>Signal Outcome Tracker & Statistics</span>
          </button>

          <button
            onClick={() => setViewMode('both')}
            className={`px-4 py-2 rounded-lg text-xs font-bold font-mono flex items-center gap-2 transition-all ${
              viewMode === 'both'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-[#71717a] hover:text-[#e0e0e0] hover:bg-[#18181b]'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-indigo-300" />
            <span>Combined Dual View</span>
          </button>
        </div>

        <div className="text-xs font-mono text-[#71717a] hidden sm:block">
          Active Pair: <span className="text-white font-bold">{activeSymbol}</span>
        </div>
      </div>

      {/* Scanner Matrix View */}
      {(viewMode === 'matrix' || viewMode === 'both') && (
        <div className="bg-[#111113] border border-[#2d2d30] rounded-xl shadow-2xl p-5 space-y-4">
          {/* Table Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#2d2d30] pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 font-bold text-base text-[#ffffff]">
            <Zap className="w-5 h-5 text-blue-400 animate-pulse" />
            <span>Multi-Pair Market Profile Scanner</span>
          </div>
          <div className="text-xs text-[#71717a]">
            Minute-by-minute calculations for profile shapes, quality scores, POC/VAH/VAL levels, and high-confidence signals (Quality Score 85+).
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          {/* Action Filter Pills */}
          <div className="flex items-center bg-[#0c0c0e] p-1 rounded-lg border border-[#2d2d30]">
            {(['ALL', 'BUY', 'SELL', 'Watch'] as const).map((act) => (
              <button
                key={act}
                onClick={() => setActionFilter(act)}
                className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors ${
                  actionFilter === act
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-[#71717a] hover:text-[#e0e0e0]'
                }`}
              >
                {act}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#71717a] absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter pairs..."
              className="bg-[#0c0c0e] border border-[#2d2d30] rounded-lg pl-8 pr-3 py-1.5 text-[#e0e0e0] placeholder-[#71717a] focus:outline-none focus:border-blue-500 text-xs w-36 sm:w-48 font-mono"
            />
          </div>
        </div>
      </div>

      {/* Main Scanner Table */}
      <div className="overflow-x-auto rounded-lg border border-[#2d2d30]">
        <table className="w-full text-left border-collapse font-mono text-xs">
          <thead>
            <tr className="bg-[#0c0c0e] text-[#71717a] uppercase text-[10px] tracking-wider border-b border-[#2d2d30]">
              <th
                onClick={() => handleSortToggle('symbol')}
                className="p-3 cursor-pointer hover:text-[#e0e0e0]"
              >
                <div className="flex items-center gap-1">
                  <span>Pair</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="p-3">Shape</th>
              <th
                onClick={() => handleSortToggle('score')}
                className="p-3 cursor-pointer hover:text-[#e0e0e0]"
              >
                <div className="flex items-center gap-1">
                  <span>Score</span>
                  <ArrowUpDown className="w-3 h-3 text-blue-400" />
                </div>
              </th>
              <th className="p-3">Rating</th>
              <th className="p-3">Bias</th>
              <th className="p-3">Alert</th>
              <th className="p-3">POC</th>
              <th className="p-3">VAH / VAL</th>
              <th className="p-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2d2d30]/80 text-[#e0e0e0]">
            {sorted.length > 0 ? (
              sorted.map((item) => {
                const isActive = item.symbol === activeSymbol;
                return (
                  <tr
                    key={item.symbol}
                    onClick={() => onSelectPair(item.symbol)}
                    className={`cursor-pointer transition-colors ${
                      isActive
                        ? 'bg-blue-950/40 border-l-4 border-l-blue-500 font-bold'
                        : 'hover:bg-[#161618]'
                    }`}
                  >
                    {/* Pair Symbol */}
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-white text-sm">{item.symbol}</span>
                        {isActive && (
                          <span className="px-1.5 py-0.2 rounded bg-blue-500 text-white text-[9px] uppercase font-sans">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-[#71717a] truncate max-w-[140px] font-sans">
                        {item.name}
                      </div>
                    </td>

                    {/* Profile Shape */}
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded bg-[#161618] border border-[#2d2d30] font-bold text-[#e0e0e0]">
                          {item.shortShape}
                        </span>
                        <span className="text-[10px] text-[#71717a] hidden sm:inline">
                          {item.shape}
                        </span>
                      </div>
                    </td>

                    {/* Quality Score */}
                    <td className="p-3 font-extrabold text-base">
                      <span
                        className={
                          item.score >= 90
                            ? 'text-emerald-400'
                            : item.score >= 75
                            ? 'text-blue-400'
                            : item.score >= 60
                            ? 'text-amber-400'
                            : 'text-[#71717a]'
                        }
                      >
                        {item.score}
                      </span>
                      <span className="text-[10px] text-[#71717a] font-normal">/100</span>
                    </td>

                    {/* Rating Badge */}
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getRatingBadgeClass(item.qualityRating)}`}>
                        {item.qualityRating}
                      </span>
                    </td>

                    {/* Bias */}
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        {item.bias.includes('Bullish') ? (
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : item.bias.includes('Bearish') ? (
                          <TrendingDown className="w-3.5 h-3.5 text-red-400 shrink-0" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-[#71717a]" />
                        )}
                        <span
                          className={`font-semibold ${
                            item.bias.includes('Bullish')
                              ? 'text-emerald-400'
                              : item.bias.includes('Bearish')
                              ? 'text-red-400'
                              : 'text-[#71717a]'
                          }`}
                        >
                          {item.bias}
                        </span>
                      </div>
                    </td>

                    {/* Alert Action */}
                    <td className="p-3">
                      <div className="flex flex-col gap-0.5">
                        <span className={`px-2.5 py-1 rounded text-xs text-center inline-block w-20 ${getAlertBadgeClass(item.alertAction)}`}>
                          {item.alertAction}
                        </span>
                        {item.suppressedReason && (
                          <span className="text-[9px] text-amber-400 flex items-center gap-0.5 font-sans italic max-w-[140px] truncate" title={item.suppressedReason}>
                            <Info className="w-2.5 h-2.5 shrink-0" />
                            <span>Suppressed</span>
                          </span>
                        )}
                      </div>
                    </td>

                    {/* POC */}
                    <td className="p-3 text-amber-300 font-bold">
                      {formatPrice(item.poc, item.symbol)}
                    </td>

                    {/* VAH / VAL */}
                    <td className="p-3 text-[11px]">
                      <div className="text-emerald-400 font-semibold">
                        H: {formatPrice(item.vah, item.symbol)}
                      </div>
                      <div className="text-emerald-400 font-semibold">
                        L: {formatPrice(item.val, item.symbol)}
                      </div>
                    </td>

                    {/* Action */}
                    <td className="p-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectPair(item.symbol);
                        }}
                        className="px-2.5 py-1 rounded bg-[#161618] hover:bg-[#2d2d30] text-blue-400 border border-[#2d2d30] text-[11px] font-bold flex items-center gap-1 ml-auto"
                      >
                        <span>Select</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={9} className="p-8 text-center text-[#71717a]">
                  No Pairs Match Search Filter
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )}

      {/* Signal Outcome Tracker View */}
      {(viewMode === 'tracker' || viewMode === 'both') && (
        <SignalOutcomeTrackerView
          currentProfile={activeProfile}
          onSelectPair={onSelectPair}
        />
      )}
    </div>
  );
};
