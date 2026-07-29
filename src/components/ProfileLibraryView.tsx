import React, { useState } from 'react';
import { DailyProfileRecord, ProfileShape, SymbolCode } from '../types/market';
import {
  Calendar,
  Database,
  Filter,
  Search,
  Trophy,
  X,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { TpoHistogram } from './TpoHistogram';
import { profileRecordToMarketProfile } from '../services/tpoEngine';

interface ProfileLibraryViewProps {
  history: DailyProfileRecord[];
}

export const ProfileLibraryView: React.FC<ProfileLibraryViewProps> = ({ history }) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSymbolFilter, setSelectedSymbolFilter] = useState<string>('ALL');
  const [selectedShapeFilter, setSelectedShapeFilter] = useState<string>('ALL');
  const [selectedOutcomeFilter, setSelectedOutcomeFilter] = useState<string>('ALL');
  const [selectedRecord, setSelectedRecord] = useState<DailyProfileRecord | null>(null);

  const filteredHistory = history.filter((rec) => {
    const recSymbol = rec.symbol || 'GBPUSD';
    const query = searchQuery.trim().toLowerCase();

    // 1. Search Query Match
    let matchesSearch = true;
    if (query) {
      const matchDate = rec.tradingDate.toLowerCase().includes(query);
      const matchSymbol = recSymbol.toLowerCase().includes(query);
      const matchSignal = rec.signal.toLowerCase().includes(query);
      const matchOutcome = rec.tradeOutcome.toLowerCase().includes(query);

      const shapeLower = rec.profileShape.toLowerCase();
      const normQuery = query.replace(/[-_]/g, ' ').trim();

      let matchShape = false;
      if (
        normQuery === 'p' ||
        normQuery.includes('p profile') ||
        normQuery.includes('p shape')
      ) {
        matchShape = shapeLower.startsWith('p');
      } else if (
        normQuery === 'b' ||
        normQuery.includes('b profile') ||
        normQuery.includes('b shape')
      ) {
        matchShape = shapeLower.startsWith('b');
      } else if (
        normQuery === 'd' ||
        normQuery.includes('d profile') ||
        normQuery.includes('d shape')
      ) {
        matchShape = shapeLower.startsWith('d') && !shapeLower.includes('double');
      } else if (normQuery.includes('double')) {
        matchShape = shapeLower.includes('double');
      } else if (normQuery.includes('trend')) {
        matchShape = shapeLower.includes('trend');
      } else if (normQuery.includes('neutral')) {
        matchShape = shapeLower.includes('neutral');
      } else {
        matchShape = shapeLower.includes(normQuery);
      }

      matchesSearch = matchDate || matchSymbol || matchSignal || matchOutcome || matchShape;
    }

    // 2. Symbol Filter
    const matchesSymbol = selectedSymbolFilter === 'ALL' || recSymbol === selectedSymbolFilter;

    // 3. Shape Filter Pill Buttons
    let matchesShape = true;
    if (selectedShapeFilter !== 'ALL') {
      const recShapeLower = rec.profileShape.toLowerCase().trim();
      const targetFilterLower = selectedShapeFilter.toLowerCase().trim();

      if (targetFilterLower.includes('double')) {
        matchesShape = recShapeLower.includes('double');
      } else if (targetFilterLower.includes('trend')) {
        matchesShape = recShapeLower.includes('trend');
      } else if (targetFilterLower.includes('neutral')) {
        matchesShape = recShapeLower.includes('neutral');
      } else if (targetFilterLower.startsWith('p')) {
        matchesShape = recShapeLower.startsWith('p');
      } else if (targetFilterLower.startsWith('b')) {
        matchesShape = recShapeLower.startsWith('b');
      } else if (targetFilterLower.startsWith('d')) {
        matchesShape = recShapeLower.startsWith('d') && !recShapeLower.includes('double');
      } else {
        matchesShape = recShapeLower === targetFilterLower;
      }
    }

    // 4. Outcome Filter
    const matchesOutcome =
      selectedOutcomeFilter === 'ALL' || rec.tradeOutcome === selectedOutcomeFilter;

    return matchesSearch && matchesSymbol && matchesShape && matchesOutcome;
  });

  const uniqueShapes: ProfileShape[] = [
    'P Profile',
    'b Profile',
    'D Profile',
    'Double Distribution',
    'Trend Day',
    'Neutral Day',
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Title & Stats */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#111113] border border-[#2d2d30] rounded-xl p-5 shadow-xl">
        <div className="space-y-1">
          <div className="text-lg font-bold text-[#ffffff] flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-400" />
            <span>Daily Market Profile Archive & Library</span>
          </div>
          <div className="text-xs text-[#71717a]">
            Permanently archived daily completed profiles, auction shape metrics, and signal trade history.
          </div>
        </div>

        <div className="flex items-center gap-4 font-mono text-xs">
          <div className="bg-[#0c0c0e] px-3 py-2 rounded-lg border border-[#2d2d30]">
            <span className="text-[#71717a] uppercase block text-[10px]">Total Archived Days</span>
            <span className="text-blue-400 font-bold text-sm">{history.length} Days</span>
          </div>
          <div className="bg-[#0c0c0e] px-3 py-2 rounded-lg border border-[#2d2d30]">
            <span className="text-[#71717a] uppercase block text-[10px]">Win Rate</span>
            <span className="text-emerald-400 font-bold text-sm">
              {history.length > 0
                ? `${Math.round(
                    (history.filter((h) => h.tradeOutcome === 'WIN').length /
                      Math.max(1, history.filter((h) => h.tradeOutcome !== 'NO_TRADE').length)) *
                      100
                  )}%`
                : '0%'}
            </span>
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-[#111113] border border-[#2d2d30] rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 font-mono text-xs shadow-lg">
        {/* Search Bar */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-[#71717a] absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search date (YYYY-MM-DD), shape, or signal..."
            className="w-full bg-[#0c0c0e] border border-[#2d2d30] rounded-lg pl-9 pr-3 py-2 text-[#e0e0e0] placeholder-[#71717a] focus:outline-none focus:border-blue-500 font-mono text-xs"
          />
        </div>

        {/* Symbol Filter */}
        <select
          value={selectedSymbolFilter}
          onChange={(e) => setSelectedSymbolFilter(e.target.value)}
          className="bg-[#0c0c0e] border border-[#2d2d30] text-[#e0e0e0] rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 font-mono text-xs"
        >
          <option value="ALL">All Symbols</option>
          <option value="GBPUSD">GBP/USD</option>
          <option value="EURUSD">EUR/USD</option>
          <option value="USDJPY">USD/JPY</option>
          <option value="GBPJPY">GBP/JPY</option>
          <option value="AUDUSD">AUD/USD</option>
          <option value="XAUUSD">XAU/USD (Gold)</option>
          <option value="USDCAD">USD/CAD</option>
          <option value="USDCHF">USD/CHF</option>
          <option value="NZDUSD">NZD/USD</option>
          <option value="BTCUSD">BTC/USD (Bitcoin)</option>
          <option value="ETHUSD">ETH/USD (Ethereum)</option>
        </select>

        {/* Shape Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setSelectedShapeFilter('ALL')}
            className={`px-2.5 py-1.5 rounded text-[11px] font-semibold transition-colors ${
              selectedShapeFilter === 'ALL'
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                : 'bg-[#0c0c0e] text-[#71717a] border border-[#2d2d30] hover:text-[#e0e0e0]'
            }`}
          >
            All Shapes
          </button>
          {uniqueShapes.map((shape) => (
            <button
              key={shape}
              onClick={() => setSelectedShapeFilter(shape)}
              className={`px-2.5 py-1.5 rounded text-[11px] font-semibold transition-colors ${
                selectedShapeFilter === shape
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                  : 'bg-[#0c0c0e] text-[#71717a] border border-[#2d2d30] hover:text-[#e0e0e0]'
              }`}
            >
              {shape}
            </button>
          ))}
        </div>

        {/* Outcome Filter */}
        <select
          value={selectedOutcomeFilter}
          onChange={(e) => setSelectedOutcomeFilter(e.target.value)}
          className="bg-[#0c0c0e] border border-[#2d2d30] text-[#e0e0e0] rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
        >
          <option value="ALL">All Trade Outcomes</option>
          <option value="WIN">Wins Only</option>
          <option value="LOSS">Losses Only</option>
          <option value="NO_TRADE">No Trade Days</option>
        </select>
      </div>

      {/* Grid of Archived Daily Profile Cards */}
      {filteredHistory.length === 0 ? (
        <div className="bg-[#111113] border border-[#2d2d30] rounded-xl p-12 text-center space-y-4 font-mono shadow-xl">
          <div className="text-amber-400 font-bold text-base">No Matching Profiles Found</div>
          <div className="text-xs text-[#71717a] max-w-md mx-auto">
            No archived profiles matched your active shape, symbol, or search filter criteria. Try clearing search keywords or choosing "All Shapes" or "All Symbols".
          </div>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedSymbolFilter('ALL');
              setSelectedShapeFilter('ALL');
              setSelectedOutcomeFilter('ALL');
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors inline-flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            Reset All Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredHistory.map((rec) => (
            <div
              key={rec.id}
              onClick={() => setSelectedRecord(rec)}
              className="bg-[#111113] border border-[#2d2d30] hover:border-blue-500/50 rounded-xl p-5 shadow-xl transition-all cursor-pointer group space-y-4"
            >
              <div className="flex items-center justify-between border-b border-[#2d2d30] pb-3 font-mono text-xs">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-extrabold text-[11px] border border-blue-500/30">
                    {rec.symbol || 'GBPUSD'}
                  </span>
                  <Calendar className="w-3.5 h-3.5 text-blue-400" />
                  <span className="font-bold text-[#ffffff] text-sm">{rec.tradingDate}</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-[#161618] text-amber-400 font-bold border border-[#2d2d30]">
                  {rec.profileShape}
                </span>
              </div>

              {/* Quick Metrics */}
              <div className="grid grid-cols-3 gap-2 font-mono text-xs bg-[#0c0c0e] p-3 rounded-lg border border-[#2d2d30]">
                <div>
                  <span className="text-[#71717a] text-[10px] block">POC</span>
                  <span className="text-amber-400 font-bold">{rec.poc.toFixed(5)}</span>
                </div>
                <div>
                  <span className="text-[#71717a] text-[10px] block">VAH</span>
                  <span className="text-emerald-400 font-semibold">{rec.vah.toFixed(5)}</span>
                </div>
                <div>
                  <span className="text-[#71717a] text-[10px] block">VAL</span>
                  <span className="text-emerald-400 font-semibold">{rec.val.toFixed(5)}</span>
                </div>
              </div>

              {/* Score & Trade Outcome */}
              <div className="flex items-center justify-between font-mono text-xs pt-1">
                <div>
                  <span className="text-[#71717a] text-[10px] uppercase block">Market Score</span>
                  <span className="text-[#e0e0e0] font-bold">{rec.marketScore} / 100</span>
                </div>

                <div>
                  <span className="text-[#71717a] text-[10px] uppercase block">Trade Outcome</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      rec.tradeOutcome === 'WIN'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : rec.tradeOutcome === 'LOSS'
                        ? 'bg-red-950 text-red-400 border border-red-800'
                        : 'bg-[#161618] text-[#71717a]'
                    }`}
                  >
                    {rec.tradeOutcome} {rec.pnlPips ? `(${rec.pnlPips > 0 ? '+' : ''}${rec.pnlPips} pips)` : ''}
                  </span>
                </div>
              </div>

              <div className="text-center text-blue-400 text-xs font-mono font-semibold group-hover:underline pt-2 border-t border-[#2d2d30]/80">
                Inspect Full Daily TPO Profile &rarr;
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Detail Inspector for Selected Record */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#111113] border border-[#2d2d30] rounded-2xl max-w-4xl w-full p-6 space-y-6 shadow-2xl relative my-8">
            <button
              onClick={() => setSelectedRecord(null)}
              className="absolute top-4 right-4 p-2 rounded-lg bg-[#161618] hover:bg-[#2d2d30] text-[#e0e0e0] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1 font-mono">
              <div className="text-xs text-blue-400 font-bold uppercase tracking-wider">
                Full Profile Inspection
              </div>
              <div className="text-xl font-bold text-[#ffffff]">
                {selectedRecord.symbol || 'GBPUSD'} - Trading Date {selectedRecord.tradingDate}
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#0c0c0e] p-4 rounded-xl border border-[#2d2d30] font-mono text-xs">
              <div>
                <span className="text-[#71717a] text-[10px] block">Open / Close</span>
                <span className="text-[#e0e0e0] font-bold">
                  {selectedRecord.open.toFixed(5)} / {selectedRecord.close.toFixed(5)}
                </span>
              </div>
              <div>
                <span className="text-[#71717a] text-[10px] block">Daily High / Low</span>
                <span className="text-[#e0e0e0] font-bold">
                  {selectedRecord.high.toFixed(5)} / {selectedRecord.low.toFixed(5)}
                </span>
              </div>
              <div>
                <span className="text-[#71717a] text-[10px] block">Point of Control (POC)</span>
                <span className="text-amber-400 font-bold">{selectedRecord.poc.toFixed(5)}</span>
              </div>
              <div>
                <span className="text-[#71717a] text-[10px] block">Value Area (VAH / VAL)</span>
                <span className="text-emerald-400 font-bold">
                  {selectedRecord.vah.toFixed(5)} / {selectedRecord.val.toFixed(5)}
                </span>
              </div>
            </div>

            {/* TPO Histogram Component */}
            <TpoHistogram
              profile={profileRecordToMarketProfile(selectedRecord, (selectedRecord.symbol || 'GBPUSD') as SymbolCode)}
              title={`Archived TPO Profile (${selectedRecord.profileShape})`}
              isDeveloping={false}
              maxHeightPx={400}
            />
          </div>
        </div>
      )}
    </div>
  );
};
