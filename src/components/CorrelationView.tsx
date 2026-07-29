import React, { useState } from 'react';
import {
  Activity,
  AlertOctagon,
  ArrowRightLeft,
  CheckCircle,
  Filter,
  Info,
  Layers,
  Shield,
  Zap,
} from 'lucide-react';
import { CorrelationPeriod, SymbolCode } from '../types/market';
import { correlationEngine } from '../services/correlationEngine';

export const CorrelationView: React.FC = () => {
  const [period, setPeriod] = useState<CorrelationPeriod>('30D');
  const [selectedPair, setSelectedPair] = useState<SymbolCode | 'ALL'>('ALL');

  const matrixData = correlationEngine.getCorrelationMatrix(period);

  const filteredPairwise = matrixData.pairwise.filter((p) => {
    if (selectedPair === 'ALL') return true;
    return p.pairA === selectedPair || p.pairB === selectedPair;
  });

  const getCellColor = (r: number) => {
    if (r === 1.0) return 'bg-[#161618] text-[#71717a] font-normal';
    if (r >= 0.85) return 'bg-emerald-950/90 text-emerald-300 font-extrabold border border-emerald-800/80';
    if (r >= 0.60) return 'bg-emerald-950/40 text-emerald-400 font-bold';
    if (r >= 0.20) return 'bg-[#161618] text-emerald-500/80';
    if (r <= -0.85) return 'bg-red-950/90 text-red-300 font-extrabold border border-red-800/80';
    if (r <= -0.60) return 'bg-red-950/40 text-red-400 font-bold';
    if (r <= -0.20) return 'bg-[#161618] text-red-500/80';
    return 'bg-[#0c0c0e] text-[#71717a]';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-[#111113] border border-[#2d2d30] rounded-xl p-5 shadow-2xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#2d2d30] pb-4">
          <div>
            <div className="flex items-center gap-2 font-bold text-lg text-white">
              <ArrowRightLeft className="w-5 h-5 text-blue-400" />
              <span>Intermarket Rolling Correlation Engine</span>
            </div>
            <div className="text-xs text-[#71717a] mt-0.5">
              Pearson rolling correlation matrix calculated over 30, 90, and 180-day lookbacks to eliminate signal noise & suppress duplicate alerts on correlated pairs.
            </div>
          </div>

          {/* Period Selector Tabs */}
          <div className="flex items-center bg-[#0c0c0e] p-1 rounded-lg border border-[#2d2d30] font-mono text-xs">
            {(['30D', '90D', '180D'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-md font-bold transition-all ${
                  period === p
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-[#71717a] hover:text-[#e0e0e0]'
                }`}
              >
                {p} Rolling Window
              </button>
            ))}
          </div>
        </div>

        {/* Smart Alerts Rule Notice Box */}
        <div className="p-3.5 rounded-lg bg-[#0c0c0e] border border-blue-900/50 flex items-start gap-3 text-xs font-mono">
          <Shield className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="text-blue-300 font-bold">Smart Correlation Alert Rule Enabled</div>
            <div className="text-[#a0a0a0] font-sans">
              If two pairs have correlation <span className="text-white font-mono font-bold">|r| &gt; 0.90</span>, the scanner automatically suppresses duplicate alerts on the second pair when a signal already exists on the first. (e.g. Simultaneous BUY signals on <span className="text-emerald-400 font-mono font-bold">GBPUSD</span> and <span className="text-emerald-400 font-mono font-bold">EURUSD</span> yield only 1 primary alert).
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Matrix Heatmap & Pairwise Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Heatmap Matrix */}
        <div className="lg:col-span-7 bg-[#111113] border border-[#2d2d30] rounded-xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-[#2d2d30] pb-3">
            <div className="font-bold text-sm text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-400" />
              <span>Cross-Pair Correlation Matrix ({period})</span>
            </div>
            <span className="text-xs font-mono text-[#71717a]">
              {matrixData.pairs.length} Supported Forex Pairs
            </span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-[#2d2d30]">
            <table className="w-full text-center font-mono text-xs border-collapse">
              <thead>
                <tr className="bg-[#0c0c0e] text-[#71717a] text-[10px] uppercase border-b border-[#2d2d30]">
                  <th className="p-2 text-left">Pair</th>
                  {matrixData.pairs.map((sym) => (
                    <th key={sym} className="p-2 font-bold text-white">
                      {sym.replace('USD', '')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2d2d30]">
                {matrixData.pairs.map((symA) => (
                  <tr key={symA} className="hover:bg-[#161618]">
                    <td className="p-2 text-left font-bold text-white bg-[#0c0c0e]">
                      {symA}
                    </td>
                    {matrixData.pairs.map((symB) => {
                      const r = matrixData.matrix[symA][symB];
                      return (
                        <td
                          key={symB}
                          className={`p-2 transition-colors ${getCellColor(r)}`}
                          title={`${symA} vs ${symB}: r = ${r}`}
                        >
                          {r.toFixed(2)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pairwise Rankings List */}
        <div className="lg:col-span-5 bg-[#111113] border border-[#2d2d30] rounded-xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-[#2d2d30] pb-3">
            <div className="font-bold text-sm text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-400" />
              <span>Pairwise Rankings</span>
            </div>

            {/* Filter Dropdown */}
            <select
              value={selectedPair}
              onChange={(e) => setSelectedPair(e.target.value as SymbolCode | 'ALL')}
              className="bg-[#0c0c0e] border border-[#2d2d30] text-xs font-mono text-[#e0e0e0] rounded px-2 py-1 focus:outline-none"
            >
              <option value="ALL">All Pairs</option>
              {matrixData.pairs.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1 custom-scrollbar">
            {filteredPairwise.map((p) => (
              <div
                key={`${p.pairA}-${p.pairB}`}
                className="p-3 rounded-lg bg-[#0c0c0e] border border-[#2d2d30] flex items-center justify-between font-mono text-xs"
              >
                <div className="space-y-0.5">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <span>{p.pairA}</span>
                    <span className="text-[#71717a]">&leftrightarrow;</span>
                    <span>{p.pairB}</span>
                  </div>
                  <div className="text-[10px] text-[#71717a] font-sans">
                    {p.displayText} Correlation
                  </div>
                </div>

                <div className="text-right">
                  <div
                    className={`text-base font-extrabold ${
                      p.correlation >= 0.75
                        ? 'text-emerald-400'
                        : p.correlation <= -0.75
                        ? 'text-red-400'
                        : 'text-[#e0e0e0]'
                    }`}
                  >
                    {p.correlation > 0 ? `+${p.correlation.toFixed(2)}` : p.correlation.toFixed(2)}
                  </div>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[9px] font-sans ${
                      Math.abs(p.correlation) >= 0.90
                        ? 'bg-purple-950 text-purple-300 border border-purple-800'
                        : Math.abs(p.correlation) >= 0.75
                        ? 'bg-blue-950 text-blue-300 border border-blue-800'
                        : 'bg-[#161618] text-[#71717a]'
                    }`}
                  >
                    {p.strength}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
