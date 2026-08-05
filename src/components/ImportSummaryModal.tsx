import React from 'react';
import {
  X,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Activity,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { StatementImportSummary } from '../types/risk';

interface ImportSummaryModalProps {
  summary: StatementImportSummary;
  accountNumber: string;
  accountName: string;
  fileName?: string;
  onClose: () => void;
}

export const ImportSummaryModal: React.FC<ImportSummaryModalProps> = ({
  summary,
  accountNumber,
  accountName,
  fileName,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#121215] border border-[#2d2d30] rounded-2xl max-w-xl w-full p-6 shadow-2xl text-left font-sans relative overflow-hidden">
        {/* Subtle Background Glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-start justify-between mb-6 pb-4 border-b border-[#2d2d30]">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                MT5 Statement Import Summary
              </h2>
              <p className="text-xs text-[#a1a1aa] mt-0.5">
                Account #{accountNumber} {fileName ? `• ${fileName}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#a1a1aa] hover:text-white hover:bg-[#202025] rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 6 Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
          {/* Deals Read */}
          <div className="bg-[#18181c] border border-[#27272a] rounded-xl p-3.5">
            <div className="flex items-center justify-between text-[#a1a1aa] text-xs font-mono mb-1.5">
              <span>Deals Read</span>
              <Layers className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div className="text-xl font-bold font-mono text-white">
              {summary.dealsRead.toLocaleString()}
            </div>
            <div className="text-[10px] text-[#71717a] mt-1">Raw execution deals</div>
          </div>

          {/* Positions Reconstructed */}
          <div className="bg-[#18181c] border border-[#27272a] rounded-xl p-3.5">
            <div className="flex items-center justify-between text-[#a1a1aa] text-xs font-mono mb-1.5">
              <span>Positions Reconstructed</span>
              <Activity className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div className="text-xl font-bold font-mono text-purple-300">
              {summary.positionsReconstructed.toLocaleString()}
            </div>
            <div className="text-[10px] text-[#71717a] mt-1">Grouped by Position ID</div>
          </div>

          {/* Completed Trades Imported */}
          <div className="bg-[#18181c] border border-[#27272a] rounded-xl p-3.5">
            <div className="flex items-center justify-between text-[#a1a1aa] text-xs font-mono mb-1.5">
              <span>Completed Trades</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-xl font-bold font-mono text-emerald-400">
              {summary.completedTradesImported.toLocaleString()}
            </div>
            <div className="text-[10px] text-[#71717a] mt-1">Closed positions imported</div>
          </div>

          {/* Open Positions Ignored */}
          <div className="bg-[#18181c] border border-[#27272a] rounded-xl p-3.5">
            <div className="flex items-center justify-between text-[#a1a1aa] text-xs font-mono mb-1.5">
              <span>Open Positions Ignored</span>
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-xl font-bold font-mono text-amber-300">
              {summary.openPositionsIgnored.toLocaleString()}
            </div>
            <div className="text-[10px] text-[#71717a] mt-1">Active / Pending orders</div>
          </div>

          {/* Duplicate Trades Skipped */}
          <div className="bg-[#18181c] border border-[#27272a] rounded-xl p-3.5">
            <div className="flex items-center justify-between text-[#a1a1aa] text-xs font-mono mb-1.5">
              <span>Duplicates Skipped</span>
              <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <div className="text-xl font-bold font-mono text-indigo-300">
              {summary.duplicateTradesSkipped.toLocaleString()}
            </div>
            <div className="text-[10px] text-[#71717a] mt-1">Already in database</div>
          </div>

          {/* Parsing Errors */}
          <div className="bg-[#18181c] border border-[#27272a] rounded-xl p-3.5">
            <div className="flex items-center justify-between text-[#a1a1aa] text-xs font-mono mb-1.5">
              <span>Parsing Errors</span>
              <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <div className={`text-xl font-bold font-mono ${summary.parsingErrors > 0 ? 'text-rose-400' : 'text-zinc-400'}`}>
              {summary.parsingErrors.toLocaleString()}
            </div>
            <div className="text-[10px] text-[#71717a] mt-1">Unparseable rows</div>
          </div>
        </div>

        {/* Explanatory Info Card */}
        <div className="bg-[#18181c]/70 border border-[#27272a] rounded-xl p-3.5 text-xs text-[#a1a1aa] mb-6 flex items-start gap-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-zinc-200 mb-0.5">Position Reconstruction Engine</p>
            <p className="leading-relaxed text-[11px] text-[#a1a1aa]">
              Entry and exit deals were merged by Position ID. Commissions, swaps, fees, and realized profit were consolidated into completed trade records. Unclosed active deals and pending orders were safely ignored for performance calculations.
            </p>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs transition-colors shadow-lg shadow-emerald-600/20"
          >
            Done & View Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};
