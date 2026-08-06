import React, { useState, useEffect } from 'react';
import { Activity, Zap, Layers, Sparkles, Clock, BarChart2 } from 'lucide-react';
import { SymbolCode } from '../types/market';
import { getSymbolConfig } from '../config/symbols';

interface DashboardLoadingStateProps {
  targetSymbol: SymbolCode;
}

export const DashboardLoadingState: React.FC<DashboardLoadingStateProps> = ({ targetSymbol }) => {
  const config = getSymbolConfig(targetSymbol);
  const [step, setStep] = useState<number>(1);

  useEffect(() => {
    const t1 = setTimeout(() => setStep(2), 120);
    const t2 = setTimeout(() => setStep(3), 280);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [targetSymbol]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6 animate-fadeIn">
      {/* Top Asset Switching Notification Banner */}
      <div className="bg-[#111113] border border-blue-500/40 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-xl bg-blue-950/80 border border-blue-500/50 flex items-center justify-center text-blue-400 shadow-lg">
                <Activity className="w-6 h-6 animate-spin text-blue-400" />
              </div>
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[#111113] animate-ping" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-blue-950 text-blue-300 border border-blue-800">
                  {targetSymbol}
                </span>
                <span className="text-xs text-[#71717a] font-mono">{config.name}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950 text-emerald-400 border border-emerald-800 animate-pulse">
                  ASSET SWITCHING
                </span>
              </div>
              <h2 className="text-lg font-bold text-white tracking-wide mt-1 flex items-center gap-2">
                Loading {targetSymbol} Market Profile & Analytics...
              </h2>
            </div>
          </div>

          {/* Real-Time Processing Stepper */}
          <div className="flex items-center gap-2 font-mono text-xs bg-[#0c0c0e] px-3.5 py-2 rounded-xl border border-[#2d2d30]">
            <div className={`flex items-center gap-1.5 ${step >= 1 ? 'text-emerald-400 font-bold' : 'text-[#71717a]'}`}>
              <Clock className="w-3.5 h-3.5" />
              <span>1. Candles</span>
            </div>
            <span className="text-[#3f3f46]">→</span>
            <div className={`flex items-center gap-1.5 ${step >= 2 ? 'text-emerald-400 font-bold' : 'text-[#71717a]'}`}>
              <Layers className="w-3.5 h-3.5" />
              <span>2. TPO Matrix</span>
            </div>
            <span className="text-[#3f3f46]">→</span>
            <div className={`flex items-center gap-1.5 ${step >= 3 ? 'text-emerald-400 font-bold' : 'text-[#71717a]'}`}>
              <Sparkles className="w-3.5 h-3.5" />
              <span>3. Forecast</span>
            </div>
          </div>
        </div>

        {/* Shimmering Progress Bar */}
        <div className="mt-4 w-full h-1.5 bg-[#1a1a1e] rounded-full overflow-hidden relative">
          <div className="h-full bg-gradient-to-r from-blue-600 via-indigo-400 to-emerald-400 rounded-full animate-pulse transition-all duration-300 w-3/4" />
        </div>
      </div>

      {/* Hero Stats & Price Banner Skeleton */}
      <div className="bg-[#111113] border border-[#2d2d30] rounded-2xl p-6 shadow-2xl space-y-5 animate-pulse">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-[#2d2d30] pb-5">
          <div className="space-y-2">
            <div className="h-4 w-32 bg-[#252528] rounded" />
            <div className="h-9 w-64 bg-[#252528] rounded-lg" />
            <div className="h-3 w-48 bg-[#1f1f22] rounded" />
          </div>
          <div className="flex gap-4">
            <div className="h-16 w-36 bg-[#1e1e22] rounded-xl border border-[#2d2d30]" />
            <div className="h-16 w-36 bg-[#1e1e22] rounded-xl border border-[#2d2d30]" />
            <div className="h-16 w-36 bg-[#1e1e22] rounded-xl border border-[#2d2d30]" />
          </div>
        </div>

        {/* 7 Forecast Metrics Skeleton Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="bg-[#0c0c0e] p-3.5 rounded-xl border border-[#2d2d30] space-y-2">
              <div className="h-2.5 w-16 bg-[#252528] rounded" />
              <div className="h-6 w-20 bg-[#252528] rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Dual TPO Histograms Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#111113] border border-[#2d2d30] rounded-2xl p-6 shadow-2xl space-y-4 animate-pulse">
          <div className="flex items-center justify-between border-b border-[#2d2d30] pb-3">
            <div className="h-4 w-48 bg-[#252528] rounded" />
            <div className="h-3 w-20 bg-[#1f1f22] rounded" />
          </div>
          <div className="h-80 bg-[#0c0c0e] rounded-xl border border-[#2d2d30] flex flex-col justify-center items-center gap-3 p-6">
            <BarChart2 className="w-8 h-8 text-[#3f3f46] animate-bounce" />
            <span className="text-xs font-mono text-[#71717a]">Rebuilding Yesterday TPO Distribution...</span>
          </div>
        </div>

        <div className="bg-[#111113] border border-[#2d2d30] rounded-2xl p-6 shadow-2xl space-y-4 animate-pulse">
          <div className="flex items-center justify-between border-b border-[#2d2d30] pb-3">
            <div className="h-4 w-48 bg-[#252528] rounded" />
            <div className="h-3 w-20 bg-[#1f1f22] rounded" />
          </div>
          <div className="h-80 bg-[#0c0c0e] rounded-xl border border-[#2d2d30] flex flex-col justify-center items-center gap-3 p-6">
            <Zap className="w-8 h-8 text-emerald-500/40 animate-pulse" />
            <span className="text-xs font-mono text-[#71717a]">Computing Live Session TPO Profile...</span>
          </div>
        </div>
      </div>

      {/* Candlestick Chart Skeleton */}
      <div className="bg-[#111113] border border-[#2d2d30] rounded-2xl p-6 shadow-2xl h-96 animate-pulse flex flex-col justify-center items-center gap-3">
        <Activity className="w-10 h-10 text-blue-500/40 animate-pulse" />
        <span className="text-xs font-mono text-[#71717a]">Generating Candlestick & Signal Analysis Engine...</span>
      </div>
    </div>
  );
};
