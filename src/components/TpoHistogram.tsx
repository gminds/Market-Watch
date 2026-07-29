import React, { useState } from 'react';
import { MarketProfileData, TPORow } from '../types/market';
import { Layers, ListFilter, BarChart2, Split } from 'lucide-react';

interface TpoHistogramProps {
  profile: MarketProfileData;
  title?: string;
  isDeveloping?: boolean;
  maxHeightPx?: number;
}

export const TpoHistogram: React.FC<TpoHistogramProps> = ({
  profile,
  title,
  isDeveloping = false,
  maxHeightPx = 520,
}) => {
  const [profileView, setProfileView] = useState<'dual' | 'tpo' | 'volume'>('dual');
  const [renderMode, setRenderMode] = useState<'blocks' | 'letters'>('blocks');
  const [hoveredRow, setHoveredRow] = useState<TPORow | null>(null);

  if (!profile || !profile.rows || profile.rows.length === 0) {
    return (
      <div className="bg-[#111113] border border-[#2d2d30] rounded-lg p-6 text-center text-[#71717a] font-mono text-xs">
        No Market Profile Data Available
      </div>
    );
  }

  const maxTPO = Math.max(...profile.rows.map((r) => r.tpoCount), 1);
  const maxVolume = Math.max(...profile.rows.map((r) => r.volume), 1);
  const totalVolume = profile.totalVolume || profile.rows.reduce((s, r) => s + r.volume, 0);

  // Key levels lookup helpers
  const vpoc = profile.vpoc || profile.poc;
  const vvah = profile.vvah || profile.vah;
  const vval = profile.vval || profile.val;

  return (
    <div className="bg-[#111113] border border-[#2d2d30] rounded-lg p-4 text-[#e0e0e0] font-mono shadow-2xl relative">
      {/* Header bar */}
      <div className="flex flex-col gap-3 pb-3 mb-3 border-b border-[#2d2d30]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-xs uppercase tracking-wider text-[#71717a] font-sans font-bold flex items-center gap-2">
              <span>{title || (isDeveloping ? 'Developing Session (Live)' : 'Completed Day Profile')}</span>
              {isDeveloping && (
                <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 animate-pulse font-mono">
                  LIVE
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#71717a] font-mono mt-1">
              {/* TPO Metrics */}
              <span>
                TPO POC: <strong className="text-amber-400">{profile.poc.toFixed(5)}</strong>
              </span>
              <span>
                VAH: <strong className="text-emerald-400">{profile.vah.toFixed(5)}</strong>
              </span>
              <span>
                VAL: <strong className="text-emerald-400">{profile.val.toFixed(5)}</strong>
              </span>
              <span className="text-[#3f3f46]">|</span>
              {/* Volume Metrics */}
              <span>
                VPOC: <strong className="text-purple-400">{vpoc.toFixed(5)}</strong>
              </span>
              <span>
                VVAH: <strong className="text-cyan-400">{vvah.toFixed(5)}</strong>
              </span>
              <span>
                VVAL: <strong className="text-cyan-400">{vval.toFixed(5)}</strong>
              </span>
            </div>
          </div>

          {/* Profile View Mode & Format Controls */}
          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-[#0c0c0e] p-1 rounded border border-[#2d2d30]">
              <button
                onClick={() => setProfileView('dual')}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 transition-colors ${
                  profileView === 'dual'
                    ? 'bg-blue-950 text-blue-300 border border-blue-800'
                    : 'text-[#71717a] hover:text-[#e0e0e0]'
                }`}
                title="Dual Profile (TPO + Volume Side-by-Side)"
              >
                <Split className="w-3 h-3" />
                <span>Dual</span>
              </button>
              <button
                onClick={() => setProfileView('tpo')}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 transition-colors ${
                  profileView === 'tpo'
                    ? 'bg-amber-950 text-amber-300 border border-amber-800'
                    : 'text-[#71717a] hover:text-[#e0e0e0]'
                }`}
                title="TPO Profile Only"
              >
                <Layers className="w-3 h-3" />
                <span>TPO</span>
              </button>
              <button
                onClick={() => setProfileView('volume')}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 transition-colors ${
                  profileView === 'volume'
                    ? 'bg-purple-950 text-purple-300 border border-purple-800'
                    : 'text-[#71717a] hover:text-[#e0e0e0]'
                }`}
                title="Volume Profile Only"
              >
                <BarChart2 className="w-3 h-3" />
                <span>Volume</span>
              </button>
            </div>

            {/* Display Format Toggle */}
            <div className="flex items-center gap-1 bg-[#0c0c0e] p-1 rounded border border-[#2d2d30]">
              <button
                onClick={() => setRenderMode('blocks')}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 transition-colors ${
                  renderMode === 'blocks'
                    ? 'bg-[#161618] text-blue-300 border border-[#2d2d30]'
                    : 'text-[#71717a] hover:text-[#e0e0e0]'
                }`}
                title="Histogram Blocks"
              >
                <Layers className="w-3 h-3" />
                <span>Blocks</span>
              </button>
              <button
                onClick={() => setRenderMode('letters')}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 transition-colors ${
                  renderMode === 'letters'
                    ? 'bg-[#161618] text-blue-300 border border-[#2d2d30]'
                    : 'text-[#71717a] hover:text-[#e0e0e0]'
                }`}
                title="Brackets & Details"
              >
                <ListFilter className="w-3 h-3" />
                <span>Details</span>
              </button>
            </div>
          </div>
        </div>

        {/* Dual Mode Subheader Labels */}
        {profileView === 'dual' && (
          <div className="grid grid-cols-12 gap-2 text-[10px] font-mono font-bold text-[#71717a] px-1 bg-[#0c0c0e] py-1 rounded border border-[#2d2d30]/60">
            <div className="col-span-2 text-right pr-2">Price</div>
            <div className="col-span-2 text-center">Levels</div>
            <div className="col-span-4 text-left pl-1 text-amber-400/90 flex items-center gap-1">
              <span className="w-2 h-2 rounded bg-amber-500" /> TPO Market Profile
            </div>
            <div className="col-span-4 text-left pl-1 text-purple-400/90 flex items-center gap-1">
              <span className="w-2 h-2 rounded bg-purple-500" /> Volume Profile
            </div>
          </div>
        )}
      </div>

      {/* Dual Matrix Rows Container */}
      <div
        className="overflow-y-auto pr-1 space-y-[2px] custom-scrollbar"
        style={{ maxHeight: `${maxHeightPx}px` }}
      >
        {profile.rows.map((row) => {
          const tpoWidthPct = Math.min(100, Math.max(3, (row.tpoCount / maxTPO) * 100));
          const volWidthPct = Math.min(100, Math.max(3, (row.volume / maxVolume) * 100));

          // TPO Styling
          let tpoBg = 'bg-[#18181c] border-[#2d2d30] text-[#a1a1aa]';
          if (row.isPOC) {
            tpoBg = 'bg-amber-500/90 border-amber-400 text-black font-extrabold shadow-sm';
          } else if (row.isValueArea) {
            tpoBg = 'bg-emerald-600/50 border-emerald-500/70 text-emerald-200';
          } else if (row.isSinglePrint) {
            tpoBg = 'bg-fuchsia-600/70 border-fuchsia-400 text-fuchsia-200';
          }

          // Volume Styling
          let volBg = 'bg-[#18181c] border-[#2d2d30] text-[#a1a1aa]';
          if (row.isVPOC || Math.abs(row.price - vpoc) < 0.00005) {
            volBg = 'bg-purple-600 border-purple-400 text-white font-extrabold shadow-sm';
          } else if (row.isVolumeValueArea || (row.price <= vvah + 0.00005 && row.price >= vval - 0.00005)) {
            volBg = 'bg-cyan-600/50 border-cyan-500/70 text-cyan-200';
          }

          return (
            <div
              key={row.priceFormatted}
              onMouseEnter={() => setHoveredRow(row)}
              onMouseLeave={() => setHoveredRow(null)}
              className={`flex items-center text-[11px] group transition-colors py-[1px] px-1 rounded ${
                row.isPOC
                  ? 'bg-amber-950/30'
                  : row.isVPOC
                  ? 'bg-purple-950/30'
                  : 'hover:bg-[#161618]'
              }`}
            >
              {/* Price Label */}
              <div
                className={`w-16 text-right pr-2 select-none text-[10px] font-mono shrink-0 ${
                  row.isPOC
                    ? 'text-amber-400 font-bold'
                    : row.isVPOC
                    ? 'text-purple-400 font-bold'
                    : row.isValueArea
                    ? 'text-emerald-400 font-medium'
                    : 'text-[#71717a]'
                }`}
              >
                {row.priceFormatted}
              </div>

              {/* Status Tags */}
              <div className="w-16 flex items-center justify-center gap-0.5 text-[8px] font-bold shrink-0">
                {row.isPOC && (
                  <span className="px-1 py-0.2 rounded bg-amber-500 text-black">T-POC</span>
                )}
                {(row.isVPOC || Math.abs(row.price - vpoc) < 0.00005) && (
                  <span className="px-1 py-0.2 rounded bg-purple-600 text-white">VPOC</span>
                )}
                {!row.isPOC && !row.isVPOC && Math.abs(row.price - profile.vah) < 0.0001 && (
                  <span className="px-1 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                    VAH
                  </span>
                )}
                {!row.isPOC && !row.isVPOC && Math.abs(row.price - profile.val) < 0.0001 && (
                  <span className="px-1 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                    VAL
                  </span>
                )}
                {!row.isPOC && !row.isVPOC && Math.abs(row.price - vvah) < 0.0001 && (
                  <span className="px-1 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                    VVAH
                  </span>
                )}
                {!row.isPOC && !row.isVPOC && Math.abs(row.price - vval) < 0.0001 && (
                  <span className="px-1 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                    VVAL
                  </span>
                )}
                {row.isSinglePrint && (
                  <span className="px-1 py-0.2 rounded bg-fuchsia-950 text-fuchsia-300 border border-fuchsia-800">
                    SINGLE
                  </span>
                )}
              </div>

              {/* DUAL MODE DISPLAY */}
              {profileView === 'dual' && (
                <div className="flex-1 flex items-center gap-2 pl-1 overflow-hidden">
                  {/* Left Column: TPO Bar */}
                  <div className="w-1/2 relative flex items-center h-4">
                    {renderMode === 'blocks' ? (
                      <div
                        className={`h-3.5 rounded-sm border flex items-center px-1 transition-all ${tpoBg}`}
                        style={{ width: `${tpoWidthPct}%` }}
                      >
                        <span className="text-[9px] font-mono whitespace-nowrap">
                          {row.tpoCount} TPO
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-0.5 overflow-x-auto whitespace-nowrap text-[9px] font-bold">
                        {row.brackets.map((letter, idx) => (
                          <span
                            key={idx}
                            className={`w-3.5 h-3.5 flex items-center justify-center rounded-[2px] text-[9px] ${
                              row.isPOC
                                ? 'bg-amber-400 text-black font-extrabold'
                                : row.isValueArea
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                : 'bg-[#161618] text-[#e0e0e0] border border-[#2d2d30]'
                            }`}
                          >
                            {letter}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Volume Bar */}
                  <div className="w-1/2 relative flex items-center h-4 border-l border-[#2d2d30]/60 pl-2">
                    <div
                      className={`h-3.5 rounded-sm border flex items-center px-1 transition-all ${volBg}`}
                      style={{ width: `${volWidthPct}%` }}
                    >
                      <span className="text-[9px] font-mono whitespace-nowrap">
                        {row.volume.toLocaleString()} vol
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* TPO ONLY MODE */}
              {profileView === 'tpo' && (
                <div className="flex-1 relative flex items-center h-5 pl-1">
                  {renderMode === 'blocks' ? (
                    <div
                      className={`h-4 rounded-sm border flex items-center px-1.5 transition-all ${tpoBg}`}
                      style={{ width: `${tpoWidthPct}%` }}
                    >
                      <span className="text-[10px] font-mono whitespace-nowrap">
                        {row.tpoCount} TPO
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-0.5 overflow-x-auto whitespace-nowrap text-[10px] font-bold">
                      {row.brackets.map((letter, idx) => (
                        <span
                          key={idx}
                          className={`w-4 h-4 flex items-center justify-center rounded-[2px] text-[10px] ${
                            row.isPOC
                              ? 'bg-amber-400 text-black font-extrabold'
                              : row.isValueArea
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : 'bg-[#161618] text-[#e0e0e0] border border-[#2d2d30]'
                          }`}
                        >
                          {letter}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* VOLUME ONLY MODE */}
              {profileView === 'volume' && (
                <div className="flex-1 relative flex items-center h-5 pl-1">
                  <div
                    className={`h-4 rounded-sm border flex items-center px-2 transition-all ${volBg}`}
                    style={{ width: `${volWidthPct}%` }}
                  >
                    <span className="text-[10px] font-mono whitespace-nowrap">
                      {row.volume.toLocaleString()} vol ({((row.volume / (totalVolume || 1)) * 100).toFixed(1)}%)
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Hover Tooltip Details Bar */}
      {hoveredRow && (
        <div className="mt-3 p-2 rounded bg-[#0c0c0e] border border-[#2d2d30] text-xs flex flex-wrap items-center justify-between font-mono gap-2">
          <div>
            <span className="text-[#71717a]">Price: </span>
            <span className="text-white font-bold">{hoveredRow.priceFormatted}</span>
          </div>
          <div>
            <span className="text-[#71717a]">TPOs: </span>
            <span className="text-amber-400 font-bold">{hoveredRow.tpoCount}</span>
            <span className="text-[#71717a] text-[10px] ml-1">({hoveredRow.brackets.join(',')})</span>
          </div>
          <div>
            <span className="text-[#71717a]">Volume: </span>
            <span className="text-purple-400 font-bold">{hoveredRow.volume.toLocaleString()}</span>
            <span className="text-[#71717a] text-[10px] ml-1">
              ({((hoveredRow.volume / (totalVolume || 1)) * 100).toFixed(1)}%)
            </span>
          </div>
        </div>
      )}

      {/* Footer Legend */}
      <div className="mt-3 pt-2 border-t border-[#2d2d30]/80 flex flex-wrap items-center justify-between text-[10px] text-[#71717a] font-sans gap-2">
        <div className="flex flex-wrap items-center gap-3">
          {/* TPO Legends */}
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-amber-500" /> TPO POC
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-emerald-600" /> TPO Value Area (70%)
          </span>
          {/* Volume Legends */}
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-purple-600" /> VPOC
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-cyan-600" /> Volume Value Area (70%)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-fuchsia-600" /> Single Prints
          </span>
        </div>
        <div className="font-mono text-[#71717a] flex items-center gap-3">
          <span>TPOs: {profile.tpoCountTotal}</span>
          <span>Vol: {totalVolume.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
};
