import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Flame,
  BarChart2,
  PieChart,
  RefreshCw,
  Plus,
  Trash2,
  Download,
  Eye,
  Sliders,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Target,
  Award,
  Layers,
  X,
  Sparkles,
  Calendar,
  CheckSquare,
  Square,
  Check,
  VolumeX,
  Volume2,
} from 'lucide-react';
import {
  MarketProfileData,
  QualityRating,
  SignalTrackerStats,
  SymbolCode,
  TrackedSignal,
  TrackedSignalStatus,
} from '../types/market';
import { signalTrackerService, ClearSignalFilterOptions } from '../services/signalTrackerService';
import { formatPrice, getAvailableSymbols, getSymbolConfig } from '../config/symbols';

interface SignalOutcomeTrackerViewProps {
  currentProfile?: MarketProfileData | null;
  onSelectPair?: (symbol: SymbolCode) => void;
}

export const SignalOutcomeTrackerView: React.FC<SignalOutcomeTrackerViewProps> = ({
  currentProfile,
  onSelectPair,
}) => {
  const [signals, setSignals] = useState<TrackedSignal[]>(() =>
    signalTrackerService.getSignals()
  );
  const [selectedSymbol, setSelectedSymbol] = useState<string>('ALL');
  const [selectedDateRange, setSelectedDateRange] = useState<'ALL' | 'TODAY' | '7D' | '30D'>('ALL');
  const [selectedSignalType, setSelectedSignalType] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSnapshotSignal, setSelectedSnapshotSignal] = useState<TrackedSignal | null>(null);

  // Row selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Clear Log Modal State
  const [showClearModal, setShowClearModal] = useState<boolean>(false);
  const [clearMode, setClearMode] = useState<
    'all' | 'resolved' | 'dateRange' | 'asset' | 'signalType' | 'selected'
  >('resolved');
  const [clearDateRangeMode, setClearDateRangeMode] = useState<'older7d' | 'older30d' | 'today' | 'custom'>('older7d');
  const [clearCustomStartDate, setClearCustomStartDate] = useState<string>(
    new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
  );
  const [clearCustomEndDate, setClearCustomEndDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [clearSymbol, setClearSymbol] = useState<string>('ALL');
  const [clearSignalType, setClearSignalType] = useState<string>('ALL');

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Signal Monitor Noise Controls State
  const [mutedSymbols, setMutedSymbols] = useState<string[]>(() => signalTrackerService.getMutedSymbols());
  const [selectedNoiseSymbol, setSelectedNoiseSymbol] = useState<SymbolCode>('AUDUSD');
  const [noiseLevel, setNoiseLevel] = useState<'strict' | 'moderate' | 'off'>(() => signalTrackerService.getNoiseSuppressionLevel());

  const refreshNoiseState = () => {
    setMutedSymbols(signalTrackerService.getMutedSymbols());
  };

  const handleSuppressNoiseForSymbol = (sym: string) => {
    const res = signalTrackerService.suppressSymbolNoiseAndPurgeDuplicates(sym);
    refreshNoiseState();
    setSignals(signalTrackerService.getSignals());
    setToastMessage(`${sym} Noise Suppressed: Purged ${res.purgedCount} duplicate signal(s) & enabled noise filter.`);
  };

  const handleToggleMuteForSymbol = (sym: string) => {
    const muted = signalTrackerService.toggleMuteSymbol(sym);
    refreshNoiseState();
    setToastMessage(muted ? `${sym} Signal Monitor muted.` : `${sym} Signal Monitor unmuted.`);
  };

  const handleUnmuteSymbol = (sym: string) => {
    signalTrackerService.unmuteSymbol(sym);
    refreshNoiseState();
    setToastMessage(`${sym} Signal Monitor unmuted.`);
  };

  const handleNoiseLevelChange = (lvl: 'strict' | 'moderate' | 'off') => {
    signalTrackerService.setNoiseSuppressionLevel(lvl);
    setNoiseLevel(lvl);
    setToastMessage(`Signal Monitor noise filter set to ${lvl.toUpperCase()}`);
  };

  // Modal for Manual Signal Creation
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [addSymbol, setAddSymbol] = useState<SymbolCode>('GBPUSD');
  const [addSignalType, setAddSignalType] = useState<string>('Buying Tail Developing');
  const [addDirection, setAddDirection] = useState<'LONG' | 'SHORT'>('LONG');
  const [addEntryPrice, setAddEntryPrice] = useState<string>('1.3550');

  // Subscribe to Signal Tracker Service
  useEffect(() => {
    const unsubscribe = signalTrackerService.subscribe((updatedSignals) => {
      setSignals(updatedSignals);
    });
    return unsubscribe;
  }, []);

  // Filter signals
  const filteredSignals = signals.filter((sig) => {
    // Asset / Symbol Filter
    if (selectedSymbol !== 'ALL' && sig.symbol !== selectedSymbol) return false;

    // Status Filter
    if (selectedStatus !== 'ALL' && sig.status !== selectedStatus) return false;

    // Signal Type Filter
    if (selectedSignalType !== 'ALL' && sig.signalType !== selectedSignalType) return false;

    // Date Range Filter
    if (selectedDateRange !== 'ALL') {
      const sigDate = new Date(sig.timestamp);
      const now = new Date();
      if (selectedDateRange === 'TODAY') {
        const todayStr = now.toISOString().split('T')[0];
        if (sig.dateStr !== todayStr) return false;
      } else if (selectedDateRange === '7D') {
        const diffMs = now.getTime() - sigDate.getTime();
        if (diffMs > 7 * 24 * 3600 * 1000) return false;
      } else if (selectedDateRange === '30D') {
        const diffMs = now.getTime() - sigDate.getTime();
        if (diffMs > 30 * 24 * 3600 * 1000) return false;
      }
    }

    // Search Query Filter
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const matchId = sig.id.toLowerCase().includes(q);
      const matchSymbol = sig.symbol.toLowerCase().includes(q);
      const matchType = sig.signalType.toLowerCase().includes(q);
      const matchStatus = sig.status.toLowerCase().includes(q);
      const matchShape = sig.marketProfileSnapshot.profileShape.toLowerCase().includes(q);
      const matchRationale = sig.rationale?.some((r) => r.toLowerCase().includes(q));

      if (!matchId && !matchSymbol && !matchType && !matchStatus && !matchShape && !matchRationale) {
        return false;
      }
    }

    return true;
  });

  // Calculate stats for current view / filtered dataset
  const stats: SignalTrackerStats = signalTrackerService.getStats(filteredSignals);

  // Get unique signal types for filter dropdown
  const uniqueSignalTypes = Array.from(new Set(signals.map((s) => s.signalType)));

  // Available symbols
  const availableSymbols = getAvailableSymbols();

  // Selection handlers
  const toggleSelectId = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const allFilteredSelected =
    filteredSignals.length > 0 && filteredSignals.every((s) => selectedIds.includes(s.id));

  const toggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      const filteredSet = new Set(filteredSignals.map((s) => s.id));
      setSelectedIds((prev) => prev.filter((id) => !filteredSet.has(id)));
    } else {
      const newIds = new Set([...selectedIds, ...filteredSignals.map((s) => s.id)]);
      setSelectedIds(Array.from(newIds));
    }
  };

  // Preview deletion count calculation
  const getDeletionCount = (): number => {
    switch (clearMode) {
      case 'all':
        return signals.length;
      case 'resolved':
        return signals.filter((s) => s.status !== 'Pending').length;
      case 'selected':
        return selectedIds.length;
      case 'asset':
        if (clearSymbol === 'ALL') return signals.length;
        return signals.filter((s) => s.symbol === clearSymbol).length;
      case 'signalType':
        if (clearSignalType === 'ALL') return signals.length;
        return signals.filter((s) => s.signalType === clearSignalType).length;
      case 'dateRange': {
        const nowMs = Date.now();
        if (clearDateRangeMode === 'older7d') {
          const cutoff = nowMs - 7 * 86400000;
          return signals.filter((s) => s.timestamp < cutoff).length;
        } else if (clearDateRangeMode === 'older30d') {
          const cutoff = nowMs - 30 * 86400000;
          return signals.filter((s) => s.timestamp < cutoff).length;
        } else if (clearDateRangeMode === 'today') {
          const todayStr = new Date().toISOString().split('T')[0];
          return signals.filter((s) => s.dateStr === todayStr).length;
        } else if (clearDateRangeMode === 'custom' && clearCustomStartDate) {
          const start = clearCustomStartDate;
          const end = clearCustomEndDate || clearCustomStartDate;
          return signals.filter((s) => {
            const date = s.dateStr || new Date(s.timestamp).toISOString().split('T')[0];
            return date >= start && date <= end;
          }).length;
        }
        return 0;
      }
      default:
        return 0;
    }
  };

  const handleExecuteClear = () => {
    let count = 0;

    if (clearMode === 'all') {
      count = signalTrackerService.clearSignalsByFilter({ mode: 'all' });
    } else if (clearMode === 'resolved') {
      count = signalTrackerService.clearSignalsByFilter({ mode: 'resolved' });
    } else if (clearMode === 'selected') {
      count = signalTrackerService.clearSignalsByFilter({
        mode: 'selected',
        ids: selectedIds,
      });
      setSelectedIds([]);
    } else if (clearMode === 'asset') {
      count = signalTrackerService.clearSignalsByFilter({
        mode: 'asset',
        symbol: clearSymbol,
      });
    } else if (clearMode === 'signalType') {
      count = signalTrackerService.clearSignalsByFilter({
        mode: 'signalType',
        signalType: clearSignalType,
      });
    } else if (clearMode === 'dateRange') {
      count = signalTrackerService.clearSignalsByFilter({
        mode: 'dateRange',
        dateRangeMode: clearDateRangeMode,
        customStartDate: clearCustomStartDate,
        customEndDate: clearCustomEndDate,
      });
    }

    setShowClearModal(false);
    setToastMessage(`Successfully deleted ${count} signal log record${count === 1 ? '' : 's'}. History database updated.`);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  const handleManualAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const entry = parseFloat(addEntryPrice) || 1.3550;
    const config = getSymbolConfig(addSymbol);
    const pipVal = config.pipValue;

    const dummyProfile: MarketProfileData = currentProfile && currentProfile.symbol === addSymbol
      ? currentProfile
      : {
          symbol: addSymbol,
          dateStr: new Date().toISOString().split('T')[0],
          isDeveloping: true,
          open: entry,
          high: entry + pipVal * 30,
          low: entry - pipVal * 20,
          close: entry,
          sessionRangePips: 50,
          poc: entry + (addDirection === 'LONG' ? pipVal * 10 : -pipVal * 10),
          vah: entry + pipVal * 25,
          val: entry - pipVal * 15,
          valueArea70: { high: entry + pipVal * 25, low: entry - pipVal * 15, totalTPOs: 80 },
          vpoc: entry,
          vvah: entry + pipVal * 20,
          vval: entry - pipVal * 10,
          totalVolume: 50000,
          volumeArea70: { high: entry + pipVal * 20, low: entry - pipVal * 10, totalVolume: 35000 },
          initialBalance: { high: entry + pipVal * 15, low: entry - pipVal * 15, rangePips: 30, brackets: ['A', 'B'] },
          openingRange: { high: entry + pipVal * 10, low: entry - pipVal * 10 },
          developingPOC: entry,
          developingVAH: entry + pipVal * 20,
          developingVAL: entry - pipVal * 10,
          atr14Pips: 65,
          averageDailyRangePips: 70,
          rangeExpansionRatio: 1.1,
          profileWidth: 12,
          profileHeightPips: 50,
          tpoCountTotal: 120,
          timeAtPriceMap: {},
          profileShape: 'P Profile',
          events: [],
          singlePrints: [],
          poorHigh: false,
          poorLow: false,
          excessHigh: false,
          excessLow: false,
          rows: [],
          marketScore: 86,
          qualityRating: 'Excellent',
          scoreBreakdown: {
            trendAlignment: 18,
            atrExpansion: 12,
            pocMigration: 12,
            valueAcceptance: 12,
            rangeExtension: 8,
            profileShapeScore: 8,
            singlePrints: 4,
            excess: 4,
            valueMigration: 4,
            ibBreak: 4,
          },
          bias: addDirection === 'LONG' ? 'Strong Bullish' : 'Strong Bearish',
          statusText: 'Manual test signal created',
        };

    signalTrackerService.autoSaveSignal(
      addSymbol,
      addSignalType,
      addDirection,
      entry,
      dummyProfile,
      addDirection === 'LONG' ? entry - pipVal * 20 : entry + pipVal * 20,
      addDirection === 'LONG' ? entry + pipVal * 40 : entry - pipVal * 40,
      [`Manual test signal triggered for ${addSymbol}`]
    );

    setShowAddModal(false);
  };

  const exportCSV = () => {
    if (signals.length === 0) return;
    const headers = [
      'Signal ID',
      'Date',
      'Time',
      'Symbol',
      'Signal Type',
      'Direction',
      'Entry Price',
      'Stop Loss',
      'Take Profit',
      'Target Pips',
      'Stop Pips',
      'Risk Reward',
      'Profile Shape',
      'Score',
      'Status',
      'Realized R',
      'Realized PnL Pips',
      'Time To Target Mins',
    ];

    const rows = signals.map((s) => [
      s.id,
      s.dateStr,
      s.timeStr,
      s.symbol,
      `"${s.signalType}"`,
      s.direction,
      s.entryPrice,
      s.stopLoss,
      s.takeProfit,
      s.targetPips,
      s.stopPips,
      s.riskReward,
      s.marketProfileSnapshot.profileShape,
      s.marketProfileSnapshot.marketScore,
      s.status,
      s.rMultiple !== undefined ? s.rMultiple : '',
      s.pnlPips !== undefined ? s.pnlPips : '',
      s.timeToTargetMinutes !== undefined ? s.timeToTargetMinutes : '',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Market_Profile_Signal_History_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status: TrackedSignalStatus) => {
    switch (status) {
      case 'Target Hit':
        return (
          <span className="bg-emerald-950/90 text-emerald-300 border border-emerald-700/80 px-2.5 py-1 rounded font-extrabold text-[11px] flex items-center gap-1.5 shadow-sm">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Target Hit</span>
          </span>
        );
      case 'Stop Hit':
        return (
          <span className="bg-rose-950/90 text-rose-300 border border-rose-800/80 px-2.5 py-1 rounded font-extrabold text-[11px] flex items-center gap-1.5 shadow-sm">
            <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>Stop Hit</span>
          </span>
        );
      case 'Pending':
        return (
          <span className="bg-blue-950/90 text-blue-300 border border-blue-700/80 px-2.5 py-1 rounded font-extrabold text-[11px] flex items-center gap-1.5 shadow-sm animate-pulse">
            <Clock className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span>Pending</span>
          </span>
        );
      case 'No Follow-Through':
        return (
          <span className="bg-amber-950/90 text-amber-300 border border-amber-800/80 px-2.5 py-1 rounded font-bold text-[11px] flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>No Follow-Through</span>
          </span>
        );
      case 'Expired':
      default:
        return (
          <span className="bg-[#18181b] text-[#a1a1aa] border border-[#2d2d30] px-2.5 py-1 rounded font-semibold text-[11px] flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[#71717a] shrink-0" />
            <span>Expired</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 relative">
      {/* Toast Notification Alert */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-950 border border-emerald-600 text-emerald-200 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 font-mono text-xs animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="font-bold">{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="text-emerald-400 hover:text-white ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Banner Header */}
      <div className="bg-[#111113] border border-[#2d2d30] rounded-xl p-5 shadow-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 font-black text-lg text-white">
            <Target className="w-6 h-6 text-emerald-400 animate-pulse" />
            <span>Market Profile Signal Outcome Tracker</span>
            <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 px-2.5 py-0.5 rounded text-xs font-mono font-bold ml-2">
              Automated Audit Engine
            </span>
          </div>
          <div className="text-xs text-[#a1a1aa] max-w-3xl">
            Continuously tracks every generated signal against live tick & candle data. Automatically calculates Target Hits, Stop Loss exits, Risk-Reward realized multiples, win rates, and time-to-target efficiency.
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <button
            onClick={() => {
              if (currentProfile) {
                signalTrackerService.evaluatePriceUpdate(
                  currentProfile.symbol,
                  currentProfile.close,
                  currentProfile.high,
                  currentProfile.low
                );
              }
              setSignals(signalTrackerService.getSignals());
            }}
            className="px-3 py-2 rounded-lg bg-[#18181b] hover:bg-[#202023] text-blue-400 border border-[#2d2d30] font-bold flex items-center gap-2 transition-all shadow"
            title="Evaluate pending signals against current market prices"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Evaluate Live</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-2 transition-all shadow-md"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Test Signal</span>
          </button>

          <button
            onClick={exportCSV}
            className="px-3 py-2 rounded-lg bg-[#18181b] hover:bg-[#202023] text-emerald-400 border border-[#2d2d30] font-bold flex items-center gap-2 transition-all shadow"
            title="Export Signal History to CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>

          <button
            onClick={() => {
              setClearMode(selectedIds.length > 0 ? 'selected' : 'resolved');
              setShowClearModal(true);
            }}
            className="px-3 py-2 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800/80 font-bold flex items-center gap-2 transition-all shadow-md"
            title="Clear historical or filtered signal logs"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span>Clear Signal Log</span>
          </button>
        </div>
      </div>

      {/* Signal Monitor Noise Control Banner */}
      <div className="bg-[#12141c] border border-amber-900/40 rounded-xl p-4 flex flex-col gap-3 shadow-lg font-mono text-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-lg ${mutedSymbols.length > 0 ? 'bg-amber-950/90 text-amber-400 border border-amber-800' : 'bg-blue-950/80 text-blue-400 border border-blue-800'}`}>
              <ShieldAlert className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 font-bold text-white text-sm">
                <span>Signal Monitor Noise Filter</span>
                <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${mutedSymbols.length > 0 ? 'bg-amber-950 text-amber-300 border border-amber-700' : 'bg-emerald-950 text-emerald-300 border border-emerald-700'}`}>
                  {mutedSymbols.length > 0 ? `${mutedSymbols.length} Muted Asset${mutedSymbols.length > 1 ? 's' : ''}` : `Filter: ${noiseLevel.toUpperCase()}`}
                </span>
              </div>
              <div className="text-[11px] text-[#a1a1aa] mt-0.5">
                Filters tick jitter, duplicate intraday signals, and micro-range noise across all monitored assets.
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Multi-Asset Selector */}
            <select
              value={selectedNoiseSymbol}
              onChange={(e) => setSelectedNoiseSymbol(e.target.value as SymbolCode)}
              className="bg-[#18181b] text-white border border-[#2d2d30] rounded-lg px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:border-amber-500"
            >
              {getAvailableSymbols().map((sym) => (
                <option key={sym} value={sym}>
                  {sym} {mutedSymbols.includes(sym) ? '(Muted)' : ''}
                </option>
              ))}
            </select>

            <button
              onClick={() => handleSuppressNoiseForSymbol(selectedNoiseSymbol)}
              className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-black flex items-center gap-1.5 shadow transition-all"
              title={`Purge duplicate ${selectedNoiseSymbol} signals & mute noise`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Suppress {selectedNoiseSymbol} Noise</span>
            </button>

            <button
              onClick={() => handleToggleMuteForSymbol(selectedNoiseSymbol)}
              className={`px-3 py-1.5 rounded-lg border font-bold flex items-center gap-1.5 transition-all shadow ${mutedSymbols.includes(selectedNoiseSymbol) ? 'bg-amber-950 text-amber-300 border-amber-800 hover:bg-amber-900' : 'bg-[#18181b] text-slate-300 border-[#2d2d30] hover:bg-[#202023]'}`}
            >
              {mutedSymbols.includes(selectedNoiseSymbol) ? <VolumeX className="w-3.5 h-3.5 text-amber-400" /> : <Volume2 className="w-3.5 h-3.5 text-blue-400" />}
              <span>{mutedSymbols.includes(selectedNoiseSymbol) ? `Unmute ${selectedNoiseSymbol}` : `Mute ${selectedNoiseSymbol}`}</span>
            </button>

            <div className="flex items-center bg-[#18181b] border border-[#2d2d30] rounded-lg p-0.5 ml-1">
              {(['strict', 'moderate', 'off'] as const).map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => handleNoiseLevelChange(lvl)}
                  className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition-all ${noiseLevel === lvl ? 'bg-blue-600 text-white shadow' : 'text-[#71717a] hover:text-white'}`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Currently Muted Assets Badges Bar */}
        {mutedSymbols.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[#252733]">
            <span className="text-[10px] text-[#71717a] font-bold uppercase tracking-wider mr-1">Currently Muted:</span>
            {mutedSymbols.map((sym) => (
              <span
                key={sym}
                className="inline-flex items-center gap-1 bg-amber-950/80 text-amber-300 border border-amber-800 px-2 py-0.5 rounded text-[10px] font-bold"
              >
                <VolumeX className="w-3 h-3 text-amber-400" />
                <span>{sym}</span>
                <button
                  onClick={() => handleUnmuteSymbol(sym)}
                  className="hover:text-white text-amber-400 ml-0.5 p-0.5 rounded hover:bg-amber-900"
                  title={`Unmute ${sym}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 font-mono">
        {/* Total Signals */}
        <div className="bg-[#111113] border border-[#2d2d30] rounded-xl p-4 shadow-xl space-y-1">
          <div className="text-[11px] text-[#71717a] font-semibold uppercase tracking-wider flex items-center justify-between">
            <span>Total Signals</span>
            <Layers className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-white">{stats.totalSignals}</div>
          <div className="text-[10px] text-[#a1a1aa] flex items-center justify-between">
            <span className="text-blue-400 font-bold">{stats.pendingCount} Pending</span>
            <span>{stats.resolvedCount} Resolved</span>
          </div>
        </div>

        {/* Win Rate */}
        <div className="bg-[#111113] border border-[#2d2d30] rounded-xl p-4 shadow-xl space-y-1">
          <div className="text-[11px] text-[#71717a] font-semibold uppercase tracking-wider flex items-center justify-between">
            <span>Win Rate</span>
            <Award className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400">{stats.winRate}%</div>
          {/* Progress bar */}
          <div className="w-full bg-[#1c1c1f] rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-emerald-500 h-1.5 rounded-full"
              style={{ width: `${Math.min(100, stats.winRate)}%` }}
            />
          </div>
        </div>

        {/* Loss Rate */}
        <div className="bg-[#111113] border border-[#2d2d30] rounded-xl p-4 shadow-xl space-y-1">
          <div className="text-[11px] text-[#71717a] font-semibold uppercase tracking-wider flex items-center justify-between">
            <span>Loss Rate</span>
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-2xl font-black text-rose-400">{stats.lossRate}%</div>
          <div className="text-[10px] text-[#a1a1aa]">
            {stats.stopHitCount} Stops / {stats.targetHitCount} Targets
          </div>
        </div>

        {/* Average R-Multiple */}
        <div className="bg-[#111113] border border-[#2d2d30] rounded-xl p-4 shadow-xl space-y-1">
          <div className="text-[11px] text-[#71717a] font-semibold uppercase tracking-wider flex items-center justify-between">
            <span>Avg R-Multiple</span>
            <Zap className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div
            className={`text-2xl font-black ${
              stats.averageRMultiple >= 0 ? 'text-amber-300' : 'text-rose-400'
            }`}
          >
            {stats.averageRMultiple >= 0 ? `+${stats.averageRMultiple}R` : `${stats.averageRMultiple}R`}
          </div>
          <div className="text-[10px] text-[#a1a1aa]">Realized Per Trade</div>
        </div>

        {/* Profit Factor */}
        <div className="bg-[#111113] border border-[#2d2d30] rounded-xl p-4 shadow-xl space-y-1">
          <div className="text-[11px] text-[#71717a] font-semibold uppercase tracking-wider flex items-center justify-between">
            <span>Profit Factor</span>
            <PieChart className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-indigo-300">{stats.profitFactor}</div>
          <div className="text-[10px] text-[#a1a1aa]">Gross Gain / Loss</div>
        </div>

        {/* Total Realized PnL */}
        <div className="bg-[#111113] border border-[#2d2d30] rounded-xl p-4 shadow-xl space-y-1">
          <div className="text-[11px] text-[#71717a] font-semibold uppercase tracking-wider flex items-center justify-between">
            <span>Total PnL</span>
            <BarChart2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div
            className={`text-2xl font-black ${
              stats.totalPnlPips >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {stats.totalPnlPips >= 0 ? `+${stats.totalPnlPips}` : stats.totalPnlPips} pips
          </div>
          <div className="text-[10px] text-[#a1a1aa]">
            Avg Time: {stats.averageTimeToTargetMinutes}m
          </div>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="bg-[#111113] border border-[#2d2d30] rounded-xl p-4 shadow-xl space-y-3 font-mono text-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2d2d30] pb-3">
          <div className="flex items-center gap-2 font-bold text-white">
            <Filter className="w-4 h-4 text-blue-400" />
            <span>Search & Filter Signal History</span>
            <span className="text-xs text-[#71717a] font-normal">
              ({filteredSignals.length} of {signals.length} records shown)
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setSelectedSymbol('ALL');
                setSelectedDateRange('ALL');
                setSelectedSignalType('ALL');
                setSelectedStatus('ALL');
                setSearchQuery('');
              }}
              className="text-[11px] text-blue-400 hover:text-blue-300 underline font-semibold"
            >
              Reset Filters
            </button>
            <button
              onClick={() => {
                setClearMode('all');
                setShowClearModal(true);
              }}
              className="text-[11px] text-rose-400 hover:text-rose-300 font-bold flex items-center gap-1 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 px-2 py-0.5 rounded transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear Log</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5">
          {/* Asset / Symbol Filter */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase text-[#71717a] font-bold">Asset / Pair</label>
            <select
              value={selectedSymbol}
              onChange={(e) => setSelectedSymbol(e.target.value)}
              className="w-full bg-[#0c0c0e] border border-[#2d2d30] rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-blue-500 font-mono text-xs"
            >
              <option value="ALL">All Pairs ({availableSymbols.length})</option>
              {availableSymbols.map((sym) => (
                <option key={sym} value={sym}>
                  {sym}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase text-[#71717a] font-bold">Outcome Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full bg-[#0c0c0e] border border-[#2d2d30] rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-blue-500 font-mono text-xs"
            >
              <option value="ALL">All Statuses</option>
              <option value="Pending">Pending (Active)</option>
              <option value="Target Hit">Target Hit (Win)</option>
              <option value="Stop Hit">Stop Hit (Loss)</option>
              <option value="No Follow-Through">No Follow-Through</option>
              <option value="Expired">Expired</option>
            </select>
          </div>

          {/* Date Range Filter */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase text-[#71717a] font-bold">Timeframe / Date</label>
            <select
              value={selectedDateRange}
              onChange={(e) => setSelectedDateRange(e.target.value as any)}
              className="w-full bg-[#0c0c0e] border border-[#2d2d30] rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-blue-500 font-mono text-xs"
            >
              <option value="ALL">All Time</option>
              <option value="TODAY">Today Only</option>
              <option value="7D">Past 7 Days</option>
              <option value="30D">Past 30 Days</option>
            </select>
          </div>

          {/* Signal Type Filter */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase text-[#71717a] font-bold">Signal Type</label>
            <select
              value={selectedSignalType}
              onChange={(e) => setSelectedSignalType(e.target.value)}
              className="w-full bg-[#0c0c0e] border border-[#2d2d30] rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-blue-500 font-mono text-xs"
            >
              <option value="ALL">All Signal Types</option>
              {uniqueSignalTypes.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          {/* Search Bar */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase text-[#71717a] font-bold">Search Keywords</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#71717a] absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ID, notes, shape..."
                className="w-full bg-[#0c0c0e] border border-[#2d2d30] rounded-lg pl-8 pr-3 py-1.5 text-white placeholder-[#71717a] focus:outline-none focus:border-blue-500 font-mono text-xs"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Batch Actions Bar for Checked Signals */}
      {selectedIds.length > 0 && (
        <div className="bg-rose-950/60 border border-rose-800/80 rounded-xl p-3 px-5 shadow-2xl flex items-center justify-between font-mono text-xs text-rose-200 animate-fadeIn">
          <div className="flex items-center gap-3">
            <CheckSquare className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="font-bold">
              {selectedIds.length} signal record{selectedIds.length === 1 ? '' : 's'} selected
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedIds([])}
              className="px-3 py-1.5 rounded-lg bg-[#18181b] hover:bg-[#252528] text-[#a1a1aa] border border-[#2d2d30] font-semibold"
            >
              Deselect All
            </button>
            <button
              onClick={() => {
                setClearMode('selected');
                setShowClearModal(true);
              }}
              className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-1.5 shadow-md"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Selected ({selectedIds.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Signal History Table */}
      <div className="bg-[#111113] border border-[#2d2d30] rounded-xl shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-mono text-xs">
            <thead>
              <tr className="bg-[#0c0c0e] text-[#71717a] uppercase text-[10px] tracking-wider border-b border-[#2d2d30]">
                <th className="p-3 w-10 text-center">
                  <button
                    onClick={toggleSelectAllFiltered}
                    className="text-[#71717a] hover:text-white transition-colors"
                    title={allFilteredSelected ? 'Deselect all visible' : 'Select all visible'}
                  >
                    {allFilteredSelected ? (
                      <CheckSquare className="w-4 h-4 text-rose-400" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="p-3">Signal ID & Time</th>
                <th className="p-3">Asset</th>
                <th className="p-3">Signal Type & Direction</th>
                <th className="p-3">Entry / SL / TP</th>
                <th className="p-3 text-center">Planned R:R</th>
                <th className="p-3">Profile Snapshot</th>
                <th className="p-3">Status Outcome</th>
                <th className="p-3 text-right">Realized R / PnL</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2d2d30]">
              {filteredSignals.length > 0 ? (
                filteredSignals.map((sig, idx) => {
                  const isLong = sig.direction === 'LONG';
                  const symbolConfig = getSymbolConfig(sig.symbol);
                  const isChecked = selectedIds.includes(sig.id);

                  return (
                    <tr
                      key={`sig-${sig.id}-${idx}`}
                      className={`transition-colors group ${
                        isChecked ? 'bg-rose-950/20' : 'hover:bg-[#161618]'
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="p-3 text-center">
                        <button
                          onClick={() => toggleSelectId(sig.id)}
                          className="text-[#71717a] hover:text-white transition-colors"
                        >
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-rose-400" />
                          ) : (
                            <Square className="w-4 h-4 text-[#3f3f46] group-hover:text-[#71717a]" />
                          )}
                        </button>
                      </td>

                      {/* ID & Time */}
                      <td className="p-3 font-semibold">
                        <div className="text-white font-bold">{sig.id}</div>
                        <div className="text-[10px] text-[#71717a] flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3 text-blue-400" />
                          <span>
                            {sig.dateStr} {sig.timeStr}
                          </span>
                        </div>
                      </td>

                      {/* Asset Symbol */}
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => onSelectPair && onSelectPair(sig.symbol)}
                            className={`font-extrabold border px-2.5 py-1 rounded text-xs transition-colors ${
                              mutedSymbols.includes(sig.symbol)
                                ? 'bg-amber-950/60 text-amber-300 border-amber-800/80 hover:bg-amber-900/80'
                                : 'bg-[#18181b] text-white hover:bg-blue-600/30 hover:text-blue-300 border-[#2d2d30]'
                            }`}
                            title="Click to view chart"
                          >
                            {sig.symbol}
                          </button>
                          <button
                            onClick={() => handleToggleMuteForSymbol(sig.symbol)}
                            className={`p-1 rounded transition-colors ${
                              mutedSymbols.includes(sig.symbol)
                                ? 'text-amber-400 bg-amber-950/80 hover:bg-amber-900 border border-amber-800'
                                : 'text-[#71717a] hover:text-amber-400 hover:bg-[#1f1f23]'
                            }`}
                            title={mutedSymbols.includes(sig.symbol) ? `Unmute ${sig.symbol}` : `Mute ${sig.symbol}`}
                          >
                            {mutedSymbols.includes(sig.symbol) ? (
                              <VolumeX className="w-3.5 h-3.5 text-amber-400" />
                            ) : (
                              <Volume2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Signal Type & Direction */}
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black flex items-center gap-1 ${
                              isLong
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : 'bg-rose-950 text-rose-400 border border-rose-800'
                            }`}
                          >
                            {isLong ? (
                              <ArrowUpRight className="w-3 h-3" />
                            ) : (
                              <ArrowDownRight className="w-3 h-3" />
                            )}
                            {sig.direction}
                          </span>
                          <span className="text-white font-bold">{sig.signalType}</span>
                        </div>
                      </td>

                      {/* Entry / SL / TP */}
                      <td className="p-3">
                        <div className="text-white font-bold">
                          Entry: {formatPrice(sig.entryPrice, sig.symbol)}
                        </div>
                        <div className="text-[10px] text-[#71717a] flex items-center gap-2 mt-0.5">
                          <span className="text-rose-400">
                            SL: {formatPrice(sig.stopLoss, sig.symbol)} ({sig.stopPips}p)
                          </span>
                          <span>|</span>
                          <span className="text-emerald-400">
                            TP: {formatPrice(sig.takeProfit, sig.symbol)} ({sig.targetPips}p)
                          </span>
                        </div>
                      </td>

                      {/* Planned R:R */}
                      <td className="p-3 text-center">
                        <span className="bg-[#18181b] text-amber-300 border border-[#2d2d30] px-2 py-1 rounded font-extrabold text-xs">
                          1:{sig.riskReward}
                        </span>
                      </td>

                      {/* Profile Snapshot */}
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="bg-blue-950 text-blue-300 border border-blue-800 px-2 py-0.5 rounded text-[10px] font-bold">
                            {sig.marketProfileSnapshot.profileShape}
                          </span>
                          <span className="text-[#a1a1aa] font-bold">
                            Score {sig.marketProfileSnapshot.marketScore}/100
                          </span>
                        </div>
                        <div className="text-[10px] text-[#71717a] mt-0.5">
                          POC: {formatPrice(sig.marketProfileSnapshot.poc, sig.symbol)}
                        </div>
                      </td>

                      {/* Status Outcome */}
                      <td className="p-3">{getStatusBadge(sig.status)}</td>

                      {/* Realized R / PnL */}
                      <td className="p-3 text-right">
                        {sig.status !== 'Pending' && sig.rMultiple !== undefined ? (
                          <div>
                            <div
                              className={`font-black text-sm ${
                                sig.rMultiple > 0
                                  ? 'text-emerald-400'
                                  : sig.rMultiple < 0
                                  ? 'text-rose-400'
                                  : 'text-amber-400'
                              }`}
                            >
                              {sig.rMultiple > 0 ? `+${sig.rMultiple}R` : `${sig.rMultiple}R`}
                            </div>
                            <div className="text-[10px] text-[#71717a]">
                              {sig.pnlPips && sig.pnlPips > 0 ? `+${sig.pnlPips}` : sig.pnlPips} pips
                              {sig.timeToTargetMinutes ? ` (${sig.timeToTargetMinutes}m)` : ''}
                            </div>
                          </div>
                        ) : (
                          <div className="text-[#71717a] text-[11px] italic">Active Monitoring</div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setSelectedSnapshotSignal(sig)}
                            className="p-1.5 rounded bg-[#18181b] hover:bg-blue-600/20 text-blue-400 border border-[#2d2d30] transition-colors"
                            title="View Market Profile Snapshot Drawer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => signalTrackerService.deleteSignal(sig.id)}
                            className="p-1.5 rounded bg-[#18181b] hover:bg-rose-600/20 text-[#71717a] hover:text-rose-400 border border-[#2d2d30] transition-colors"
                            title="Delete record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-[#71717a]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Target className="w-8 h-8 text-[#3f3f46]" />
                      <div className="font-bold text-white text-sm">No Tracked Signals Found</div>
                      <div className="text-xs">
                        Adjust search filters or click "Test Signal" above to log a new signal.
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Interactive Profile Snapshot Drawer / Modal */}
      {selectedSnapshotSignal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111113] border border-[#2d2d30] rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 font-mono text-xs relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setSelectedSnapshotSignal(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-[#18181b] hover:bg-[#252528] text-[#71717a] hover:text-white border border-[#2d2d30]"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-emerald-400 font-bold text-sm">
                  {selectedSnapshotSignal.symbol}
                </span>
                <span className="text-white font-black text-sm">
                  {selectedSnapshotSignal.id}
                </span>
                <span className="ml-auto">{getStatusBadge(selectedSnapshotSignal.status)}</span>
              </div>
              <div className="text-[#71717a] text-[11px]">
                Triggered: {selectedSnapshotSignal.dateStr} {selectedSnapshotSignal.timeStr}
              </div>
            </div>

            {/* Profile Snapshot Metrics */}
            <div className="bg-[#0c0c0e] border border-[#2d2d30] rounded-xl p-4 space-y-3">
              <div className="text-xs font-bold text-white border-b border-[#2d2d30] pb-2 flex items-center justify-between">
                <span>Market Profile Snapshot at Entry</span>
                <span className="text-blue-400">
                  Score: {selectedSnapshotSignal.marketProfileSnapshot.marketScore}/100 (
                  {selectedSnapshotSignal.marketProfileSnapshot.qualityRating})
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="bg-[#161618] p-2 rounded border border-[#2d2d30]">
                  <span className="text-[#71717a] block text-[10px]">Profile Shape</span>
                  <span className="font-bold text-blue-300">
                    {selectedSnapshotSignal.marketProfileSnapshot.profileShape}
                  </span>
                </div>
                <div className="bg-[#161618] p-2 rounded border border-[#2d2d30]">
                  <span className="text-[#71717a] block text-[10px]">Point of Control (POC)</span>
                  <span className="font-bold text-amber-300">
                    {formatPrice(
                      selectedSnapshotSignal.marketProfileSnapshot.poc,
                      selectedSnapshotSignal.symbol
                    )}
                  </span>
                </div>
                <div className="bg-[#161618] p-2 rounded border border-[#2d2d30]">
                  <span className="text-[#71717a] block text-[10px]">Value Area High (VAH)</span>
                  <span className="font-bold text-emerald-300">
                    {formatPrice(
                      selectedSnapshotSignal.marketProfileSnapshot.vah,
                      selectedSnapshotSignal.symbol
                    )}
                  </span>
                </div>
                <div className="bg-[#161618] p-2 rounded border border-[#2d2d30]">
                  <span className="text-[#71717a] block text-[10px]">Value Area Low (VAL)</span>
                  <span className="font-bold text-rose-300">
                    {formatPrice(
                      selectedSnapshotSignal.marketProfileSnapshot.val,
                      selectedSnapshotSignal.symbol
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Trade Plan & Excursion */}
            <div className="bg-[#0c0c0e] border border-[#2d2d30] rounded-xl p-4 space-y-3">
              <div className="text-xs font-bold text-white border-b border-[#2d2d30] pb-2">
                Execution Plan & Price Excursion
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-[#161618] p-2.5 rounded border border-[#2d2d30]">
                  <span className="text-[#71717a] block text-[10px]">Entry Price</span>
                  <span className="font-bold text-white text-sm">
                    {formatPrice(selectedSnapshotSignal.entryPrice, selectedSnapshotSignal.symbol)}
                  </span>
                </div>
                <div className="bg-[#161618] p-2.5 rounded border border-[#2d2d30]">
                  <span className="text-[#71717a] block text-[10px]">Stop Loss ({selectedSnapshotSignal.stopPips}p)</span>
                  <span className="font-bold text-rose-400 text-sm">
                    {formatPrice(selectedSnapshotSignal.stopLoss, selectedSnapshotSignal.symbol)}
                  </span>
                </div>
                <div className="bg-[#161618] p-2.5 rounded border border-[#2d2d30]">
                  <span className="text-[#71717a] block text-[10px]">Take Profit ({selectedSnapshotSignal.targetPips}p)</span>
                  <span className="font-bold text-emerald-400 text-sm">
                    {formatPrice(selectedSnapshotSignal.takeProfit, selectedSnapshotSignal.symbol)}
                  </span>
                </div>
              </div>

              {/* Peak Excursion */}
              <div className="flex items-center justify-between text-[11px] pt-1 text-[#a1a1aa]">
                <div>
                  Peak High Reached:{' '}
                  <span className="text-emerald-400 font-bold">
                    {formatPrice(selectedSnapshotSignal.highestPriceReached || selectedSnapshotSignal.entryPrice, selectedSnapshotSignal.symbol)}
                  </span>
                </div>
                <div>
                  Lowest Price Reached:{' '}
                  <span className="text-rose-400 font-bold">
                    {formatPrice(selectedSnapshotSignal.lowestPriceReached || selectedSnapshotSignal.entryPrice, selectedSnapshotSignal.symbol)}
                  </span>
                </div>
              </div>
            </div>

            {/* Signal Rationale */}
            {selectedSnapshotSignal.rationale && (
              <div className="space-y-2">
                <div className="text-xs font-bold text-white">Signal Rationale Notes</div>
                <ul className="space-y-1 list-disc list-inside text-[11px] text-[#a1a1aa] bg-[#0c0c0e] p-3 rounded-lg border border-[#2d2d30]">
                  {selectedSnapshotSignal.rationale.map((r, idx) => (
                    <li key={idx}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Manual Add Signal Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 font-mono text-xs">
          <div className="bg-[#111113] border border-[#2d2d30] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#2d2d30] pb-3">
              <div className="font-bold text-white text-sm flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-400" />
                <span>Simulate Tracked Signal</span>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-[#71717a] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleManualAddSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] uppercase text-[#71717a] font-bold">Asset / Pair</label>
                <select
                  value={addSymbol}
                  onChange={(e) => setAddSymbol(e.target.value as SymbolCode)}
                  className="w-full bg-[#0c0c0e] border border-[#2d2d30] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 font-mono text-xs"
                >
                  {availableSymbols.map((sym) => (
                    <option key={sym} value={sym}>
                      {sym}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase text-[#71717a] font-bold">Signal Type</label>
                <input
                  type="text"
                  value={addSignalType}
                  onChange={(e) => setAddSignalType(e.target.value)}
                  className="w-full bg-[#0c0c0e] border border-[#2d2d30] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 font-mono text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-[#71717a] font-bold">Direction</label>
                  <select
                    value={addDirection}
                    onChange={(e) => setAddDirection(e.target.value as any)}
                    className="w-full bg-[#0c0c0e] border border-[#2d2d30] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 font-mono text-xs"
                  >
                    <option value="LONG">LONG (Buy)</option>
                    <option value="SHORT">SHORT (Sell)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-[#71717a] font-bold">Entry Price</label>
                  <input
                    type="text"
                    value={addEntryPrice}
                    onChange={(e) => setAddEntryPrice(e.target.value)}
                    className="w-full bg-[#0c0c0e] border border-[#2d2d30] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg bg-[#18181b] text-[#71717a] hover:text-white border border-[#2d2d30] font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold"
                >
                  Create Signal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Clear Signal Log Confirmation Modal */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 font-mono text-xs">
          <div className="bg-[#111113] border border-rose-900/60 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 relative animate-fadeIn">
            <button
              onClick={() => setShowClearModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-[#18181b] hover:bg-[#252528] text-[#71717a] hover:text-white border border-[#2d2d30] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div className="flex items-start gap-3 border-b border-[#2d2d30] pb-4">
              <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800/80 text-rose-400 shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="font-extrabold text-white text-base flex items-center gap-2">
                  <span>Clear Signal Log History</span>
                  <span className="bg-rose-950 text-rose-300 border border-rose-800 text-[10px] px-2 py-0.5 rounded font-bold">
                    Destructive Action
                  </span>
                </div>
                <p className="text-[#a1a1aa] text-xs leading-relaxed">
                  Select which signal records to clear from the history database. Active scanner rules and live market monitoring configurations will remain unchanged.
                </p>
              </div>
            </div>

            {/* Clear Mode Options */}
            <div className="space-y-3">
              <label className="text-[10px] uppercase text-[#71717a] font-bold tracking-wider">
                Select Deletion Scope
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* Resolved / Historical Only */}
                <button
                  type="button"
                  onClick={() => setClearMode('resolved')}
                  className={`p-3 rounded-xl border text-left transition-all space-y-1 ${
                    clearMode === 'resolved'
                      ? 'bg-rose-950/60 border-rose-600 text-white ring-1 ring-rose-500'
                      : 'bg-[#0c0c0e] border-[#2d2d30] text-[#a1a1aa] hover:border-[#3f3f46] hover:text-white'
                  }`}
                >
                  <div className="font-bold flex items-center justify-between text-xs">
                    <span>Resolved Signals Only</span>
                    {clearMode === 'resolved' && <Check className="w-4 h-4 text-rose-400" />}
                  </div>
                  <div className="text-[10px] text-[#71717a] leading-tight">
                    Deletes Target Hit, Stop Hit & Expired signals. Keeps active pending signals.
                  </div>
                </button>

                {/* All Signals */}
                <button
                  type="button"
                  onClick={() => setClearMode('all')}
                  className={`p-3 rounded-xl border text-left transition-all space-y-1 ${
                    clearMode === 'all'
                      ? 'bg-rose-950/60 border-rose-600 text-white ring-1 ring-rose-500'
                      : 'bg-[#0c0c0e] border-[#2d2d30] text-[#a1a1aa] hover:border-[#3f3f46] hover:text-white'
                  }`}
                >
                  <div className="font-bold flex items-center justify-between text-xs">
                    <span>Clear All Signals</span>
                    {clearMode === 'all' && <Check className="w-4 h-4 text-rose-400" />}
                  </div>
                  <div className="text-[10px] text-[#71717a] leading-tight">
                    Purges all ({signals.length}) recorded signals across all statuses completely.
                  </div>
                </button>

                {/* Clear Selected Rows */}
                <button
                  type="button"
                  onClick={() => setClearMode('selected')}
                  disabled={selectedIds.length === 0}
                  className={`p-3 rounded-xl border text-left transition-all space-y-1 ${
                    selectedIds.length === 0
                      ? 'opacity-40 cursor-not-allowed bg-[#0c0c0e] border-[#2d2d30] text-[#71717a]'
                      : clearMode === 'selected'
                      ? 'bg-rose-950/60 border-rose-600 text-white ring-1 ring-rose-500'
                      : 'bg-[#0c0c0e] border-[#2d2d30] text-[#a1a1aa] hover:border-[#3f3f46] hover:text-white'
                  }`}
                >
                  <div className="font-bold flex items-center justify-between text-xs">
                    <span>Selected Rows ({selectedIds.length})</span>
                    {clearMode === 'selected' && <Check className="w-4 h-4 text-rose-400" />}
                  </div>
                  <div className="text-[10px] text-[#71717a] leading-tight">
                    Deletes only the {selectedIds.length} records checked in the table.
                  </div>
                </button>

                {/* Clear by Date Range */}
                <button
                  type="button"
                  onClick={() => setClearMode('dateRange')}
                  className={`p-3 rounded-xl border text-left transition-all space-y-1 ${
                    clearMode === 'dateRange'
                      ? 'bg-rose-950/60 border-rose-600 text-white ring-1 ring-rose-500'
                      : 'bg-[#0c0c0e] border-[#2d2d30] text-[#a1a1aa] hover:border-[#3f3f46] hover:text-white'
                  }`}
                >
                  <div className="font-bold flex items-center justify-between text-xs">
                    <span>Clear by Date Range</span>
                    {clearMode === 'dateRange' && <Check className="w-4 h-4 text-rose-400" />}
                  </div>
                  <div className="text-[10px] text-[#71717a] leading-tight">
                    Delete signals by timeframe (e.g. older than 7 days or custom dates).
                  </div>
                </button>

                {/* Clear by Asset */}
                <button
                  type="button"
                  onClick={() => setClearMode('asset')}
                  className={`p-3 rounded-xl border text-left transition-all space-y-1 ${
                    clearMode === 'asset'
                      ? 'bg-rose-950/60 border-rose-600 text-white ring-1 ring-rose-500'
                      : 'bg-[#0c0c0e] border-[#2d2d30] text-[#a1a1aa] hover:border-[#3f3f46] hover:text-white'
                  }`}
                >
                  <div className="font-bold flex items-center justify-between text-xs">
                    <span>Clear by Asset / Pair</span>
                    {clearMode === 'asset' && <Check className="w-4 h-4 text-rose-400" />}
                  </div>
                  <div className="text-[10px] text-[#71717a] leading-tight">
                    Delete signals for a specific instrument (e.g. GBPUSD, XAUUSD).
                  </div>
                </button>

                {/* Clear by Signal Type */}
                <button
                  type="button"
                  onClick={() => setClearMode('signalType')}
                  className={`p-3 rounded-xl border text-left transition-all space-y-1 ${
                    clearMode === 'signalType'
                      ? 'bg-rose-950/60 border-rose-600 text-white ring-1 ring-rose-500'
                      : 'bg-[#0c0c0e] border-[#2d2d30] text-[#a1a1aa] hover:border-[#3f3f46] hover:text-white'
                  }`}
                >
                  <div className="font-bold flex items-center justify-between text-xs">
                    <span>Clear by Signal Type</span>
                    {clearMode === 'signalType' && <Check className="w-4 h-4 text-rose-400" />}
                  </div>
                  <div className="text-[10px] text-[#71717a] leading-tight">
                    Delete signals matching a specific setup (e.g. Buying Tail).
                  </div>
                </button>
              </div>
            </div>

            {/* Sub-parameters for specific modes */}
            {clearMode === 'dateRange' && (
              <div className="bg-[#0c0c0e] border border-[#2d2d30] rounded-xl p-3 space-y-3">
                <label className="text-[10px] uppercase text-[#71717a] font-bold block">
                  Select Date Range Rule
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setClearDateRangeMode('older7d')}
                    className={`p-2 rounded text-center text-xs border font-bold ${
                      clearDateRangeMode === 'older7d'
                        ? 'bg-rose-950 text-rose-300 border-rose-700'
                        : 'bg-[#161618] text-[#71717a] border-[#2d2d30]'
                    }`}
                  >
                    Older than 7d
                  </button>
                  <button
                    type="button"
                    onClick={() => setClearDateRangeMode('older30d')}
                    className={`p-2 rounded text-center text-xs border font-bold ${
                      clearDateRangeMode === 'older30d'
                        ? 'bg-rose-950 text-rose-300 border-rose-700'
                        : 'bg-[#161618] text-[#71717a] border-[#2d2d30]'
                    }`}
                  >
                    Older than 30d
                  </button>
                  <button
                    type="button"
                    onClick={() => setClearDateRangeMode('today')}
                    className={`p-2 rounded text-center text-xs border font-bold ${
                      clearDateRangeMode === 'today'
                        ? 'bg-rose-950 text-rose-300 border-rose-700'
                        : 'bg-[#161618] text-[#71717a] border-[#2d2d30]'
                    }`}
                  >
                    Today Only
                  </button>
                  <button
                    type="button"
                    onClick={() => setClearDateRangeMode('custom')}
                    className={`p-2 rounded text-center text-xs border font-bold ${
                      clearDateRangeMode === 'custom'
                        ? 'bg-rose-950 text-rose-300 border-rose-700'
                        : 'bg-[#161618] text-[#71717a] border-[#2d2d30]'
                    }`}
                  >
                    Custom Dates
                  </button>
                </div>

                {clearDateRangeMode === 'custom' && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="text-[10px] text-[#71717a] block mb-1 font-bold">Start Date</label>
                      <input
                        type="date"
                        value={clearCustomStartDate}
                        onChange={(e) => setClearCustomStartDate(e.target.value)}
                        className="w-full bg-[#161618] border border-[#2d2d30] rounded p-1.5 text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-[#71717a] block mb-1 font-bold">End Date</label>
                      <input
                        type="date"
                        value={clearCustomEndDate}
                        onChange={(e) => setClearCustomEndDate(e.target.value)}
                        className="w-full bg-[#161618] border border-[#2d2d30] rounded p-1.5 text-white"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {clearMode === 'asset' && (
              <div className="bg-[#0c0c0e] border border-[#2d2d30] rounded-xl p-3 space-y-2">
                <label className="text-[10px] uppercase text-[#71717a] font-bold block">
                  Select Asset to Delete
                </label>
                <select
                  value={clearSymbol}
                  onChange={(e) => setClearSymbol(e.target.value)}
                  className="w-full bg-[#161618] border border-[#2d2d30] rounded-lg p-2 text-white font-mono text-xs focus:outline-none focus:border-rose-500"
                >
                  <option value="ALL">All Pairs</option>
                  {availableSymbols.map((sym) => (
                    <option key={sym} value={sym}>
                      {sym}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {clearMode === 'signalType' && (
              <div className="bg-[#0c0c0e] border border-[#2d2d30] rounded-xl p-3 space-y-2">
                <label className="text-[10px] uppercase text-[#71717a] font-bold block">
                  Select Signal Type to Delete
                </label>
                <select
                  value={clearSignalType}
                  onChange={(e) => setClearSignalType(e.target.value)}
                  className="w-full bg-[#161618] border border-[#2d2d30] rounded-lg p-2 text-white font-mono text-xs focus:outline-none focus:border-rose-500"
                >
                  <option value="ALL">All Signal Types</option>
                  {uniqueSignalTypes.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Impact Calculation Preview */}
            <div className="bg-rose-950/30 border border-rose-800/50 rounded-xl p-3.5 flex items-center justify-between text-xs text-rose-200">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                <span>Impact Preview:</span>
              </div>
              <div className="font-extrabold text-white text-sm">
                <span className="text-rose-400 font-black">{getDeletionCount()}</span> of {signals.length} records will be deleted
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#2d2d30]">
              <button
                type="button"
                onClick={() => setShowClearModal(false)}
                className="px-4 py-2 rounded-xl bg-[#18181b] hover:bg-[#252528] text-[#a1a1aa] hover:text-white border border-[#2d2d30] font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteClear}
                disabled={getDeletionCount() === 0}
                className={`px-5 py-2 rounded-xl font-extrabold flex items-center gap-2 shadow-lg transition-all ${
                  getDeletionCount() === 0
                    ? 'opacity-50 cursor-not-allowed bg-rose-950 text-rose-400 border border-rose-900'
                    : 'bg-rose-600 hover:bg-rose-500 text-white'
                }`}
              >
                <Trash2 className="w-4 h-4" />
                <span>Confirm & Delete {getDeletionCount()} Record{getDeletionCount() === 1 ? '' : 's'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
