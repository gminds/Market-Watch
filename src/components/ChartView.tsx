import React, { useState } from 'react';
import { Candle, MarketProfileData, TradeSignal } from '../types/market';
import { TpoHistogram } from './TpoHistogram';
import { BarChart3, Maximize2, Layers, Compass, ZoomIn, ZoomOut } from 'lucide-react';

interface ChartViewProps {
  candles: Candle[];
  profile: MarketProfileData;
  tradeSignal: TradeSignal | null;
}

export const ChartView: React.FC<ChartViewProps> = ({ candles, profile, tradeSignal }) => {
  const [zoomLevel, setZoomLevel] = useState<number>(60); // number of candles shown
  const [showTpoOverlay, setShowTpoOverlay] = useState<boolean>(true);

  if (!candles || candles.length === 0 || !profile) {
    return (
      <div className="bg-[#111113] border border-[#2d2d30] rounded-xl p-12 text-center text-[#71717a] font-mono text-sm max-w-7xl mx-auto my-6">
        Loading GBP/USD 1-Minute Candle Feed...
      </div>
    );
  }

  const visibleCandles = candles.slice(-zoomLevel);
  const minPrice = Math.min(...visibleCandles.map((c) => c.low), profile.val - 0.0010);
  const maxPrice = Math.max(...visibleCandles.map((c) => c.high), profile.vah + 0.0010);
  const priceRange = Math.max(0.0010, maxPrice - minPrice);

  const getYPct = (price: number) => {
    return Math.max(0, Math.min(100, (1 - (price - minPrice) / priceRange) * 100));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Chart Header Bar */}
      <div className="bg-[#111113] border border-[#2d2d30] rounded-xl p-4 flex flex-wrap items-center justify-between text-[#e0e0e0] font-mono text-xs gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-400" />
            <span className="font-bold text-[#ffffff] text-sm">GBP/USD 1m Candlestick Chart</span>
          </div>
          <span className="text-[#71717a]">|</span>
          <span className="text-[#71717a]">London Session (08:00 - 16:30)</span>
        </div>

        {/* Chart Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-[#0c0c0e] p-1 rounded border border-[#2d2d30]">
            <button
              onClick={() => setZoomLevel((z) => Math.min(150, z + 20))}
              className="p-1 rounded text-[#71717a] hover:text-[#e0e0e0] hover:bg-[#161618]"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 text-[10px] text-blue-300 font-bold">{visibleCandles.length} Candles</span>
            <button
              onClick={() => setZoomLevel((z) => Math.max(30, z - 20))}
              className="p-1 rounded text-[#71717a] hover:text-[#e0e0e0] hover:bg-[#161618]"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={() => setShowTpoOverlay(!showTpoOverlay)}
            className={`px-3 py-1 rounded font-semibold text-xs flex items-center gap-1.5 transition-colors border ${
              showTpoOverlay
                ? 'bg-blue-950 text-blue-300 border-blue-800'
                : 'bg-[#161618] text-[#71717a] border-[#2d2d30]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>TPO Overlay</span>
          </button>
        </div>
      </div>

      {/* Main Chart Canvas & Market Profile Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Candlestick Stage View */}
        <div className="lg:col-span-8 bg-[#111113] border border-[#2d2d30] rounded-xl p-4 shadow-2xl relative flex flex-col h-[560px]">
          {/* Key Level Overlays Legends */}
          <div className="flex flex-wrap items-center justify-between text-[10px] font-mono mb-2 text-[#71717a] px-2 border-b border-[#2d2d30] pb-2 gap-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 bg-amber-400" /> T-POC ({profile.poc.toFixed(5)})
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 bg-emerald-400" /> VAH ({profile.vah.toFixed(5)})
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 bg-emerald-400" /> VAL ({profile.val.toFixed(5)})
              </span>
              <span className="text-[#3f3f46]">|</span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 bg-purple-500" /> VPOC ({(profile.vpoc || profile.poc).toFixed(5)})
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 bg-cyan-400" /> VVAH ({(profile.vvah || profile.vah).toFixed(5)})
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 bg-cyan-400" /> VVAL ({(profile.vval || profile.val).toFixed(5)})
              </span>
              <span className="text-[#3f3f46]">|</span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 bg-blue-400" /> IB Range
              </span>
            </div>
            <div>ATR(14): {profile.atr14Pips} pips</div>
          </div>

          {/* SVG Chart Stage */}
          <div className="relative flex-1 bg-[#0c0c0e] rounded border border-[#2d2d30] overflow-hidden">
            <svg className="w-full h-full" preserveAspectRatio="none">
              {/* Horizontal Price Grid Lines */}
              {[0.1, 0.3, 0.5, 0.7, 0.9].map((ratio) => {
                const yPct = ratio * 100;
                const priceVal = maxPrice - ratio * priceRange;
                return (
                  <g key={ratio}>
                    <line
                      x1="0"
                      y1={`${yPct}%`}
                      x2="100%"
                      y2={`${yPct}%`}
                      stroke="#2d2d30"
                      strokeWidth="1"
                      strokeDasharray="2 2"
                    />
                    <text
                      x="8"
                      y={`${yPct - 1}%`}
                      fill="#71717a"
                      fontSize="9"
                      fontFamily="monospace"
                    >
                      {priceVal.toFixed(5)}
                    </text>
                  </g>
                );
              })}

              {/* Point of Control (POC) Line */}
              <line
                x1="0"
                y1={`${getYPct(profile.poc)}%`}
                x2="100%"
                y2={`${getYPct(profile.poc)}%`}
                stroke="#F59E0B"
                strokeWidth="2"
                strokeDasharray="4 2"
              />

              {/* Volume Point of Control (VPOC) Line */}
              {profile.vpoc && Math.abs(profile.vpoc - profile.poc) > 0.00001 && (
                <line
                  x1="0"
                  y1={`${getYPct(profile.vpoc)}%`}
                  x2="100%"
                  y2={`${getYPct(profile.vpoc)}%`}
                  stroke="#A855F7"
                  strokeWidth="2"
                  strokeDasharray="5 2"
                />
              )}

              {/* Value Area High (VAH) Line */}
              <line
                x1="0"
                y1={`${getYPct(profile.vah)}%`}
                x2="100%"
                y2={`${getYPct(profile.vah)}%`}
                stroke="#10B981"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />

              {/* Value Area Low (VAL) Line */}
              <line
                x1="0"
                y1={`${getYPct(profile.val)}%`}
                x2="100%"
                y2={`${getYPct(profile.val)}%`}
                stroke="#10B981"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />

              {/* Volume Value Area High (VVAH) Line */}
              {profile.vvah && Math.abs(profile.vvah - profile.vah) > 0.00001 && (
                <line
                  x1="0"
                  y1={`${getYPct(profile.vvah)}%`}
                  x2="100%"
                  y2={`${getYPct(profile.vvah)}%`}
                  stroke="#06B6D4"
                  strokeWidth="1.5"
                  strokeDasharray="2 2"
                />
              )}

              {/* Volume Value Area Low (VVAL) Line */}
              {profile.vval && Math.abs(profile.vval - profile.val) > 0.00001 && (
                <line
                  x1="0"
                  y1={`${getYPct(profile.vval)}%`}
                  x2="100%"
                  y2={`${getYPct(profile.vval)}%`}
                  stroke="#06B6D4"
                  strokeWidth="1.5"
                  strokeDasharray="2 2"
                />
              )}

              {/* Initial Balance (IB) Zone Band */}
              <rect
                x="0"
                y={`${getYPct(profile.initialBalance.high)}%`}
                width="100%"
                height={`${Math.abs(getYPct(profile.initialBalance.low) - getYPct(profile.initialBalance.high))}%`}
                fill="#06B6D4"
                fillOpacity="0.05"
                stroke="#06B6D4"
                strokeWidth="0.8"
                strokeDasharray="2 2"
              />

              {/* Signal Setup Overlay Lines */}
              {tradeSignal && tradeSignal.type !== 'NO_TRADE' && (
                <>
                  {/* Entry Line */}
                  <line
                    x1="0"
                    y1={`${getYPct(tradeSignal.entryPrice)}%`}
                    x2="100%"
                    y2={`${getYPct(tradeSignal.entryPrice)}%`}
                    stroke="#06B6D4"
                    strokeWidth="2"
                  />
                  {/* Stop Loss Line */}
                  <line
                    x1="0"
                    y1={`${getYPct(tradeSignal.stopLoss)}%`}
                    x2="100%"
                    y2={`${getYPct(tradeSignal.stopLoss)}%`}
                    stroke="#EF4444"
                    strokeWidth="1.5"
                    strokeDasharray="2 2"
                  />
                  {/* Take Profit Line */}
                  <line
                    x1="0"
                    y1={`${getYPct(tradeSignal.takeProfit)}%`}
                    x2="100%"
                    y2={`${getYPct(tradeSignal.takeProfit)}%`}
                    stroke="#10B981"
                    strokeWidth="1.5"
                    strokeDasharray="2 2"
                  />
                </>
              )}

              {/* Candlesticks */}
              {visibleCandles.map((c, idx) => {
                const xPct = ((idx + 0.5) / visibleCandles.length) * 100;
                const candleWidth = Math.max(2, (100 / visibleCandles.length) * 0.7);
                const openY = getYPct(c.open);
                const closeY = getYPct(c.close);
                const highY = getYPct(c.high);
                const lowY = getYPct(c.low);
                const isBullish = c.close >= c.open;
                const color = isBullish ? '#10B981' : '#EF4444';

                return (
                  <g key={c.timestamp || idx}>
                    {/* Wick */}
                    <line
                      x1={`${xPct}%`}
                      y1={`${highY}%`}
                      x2={`${xPct}%`}
                      y2={`${lowY}%`}
                      stroke={color}
                      strokeWidth="1"
                    />
                    {/* Body */}
                    <rect
                      x={`${xPct - candleWidth / 2}%`}
                      y={`${Math.min(openY, closeY)}%`}
                      width={`${candleWidth}%`}
                      height={`${Math.max(1, Math.abs(closeY - openY))}%`}
                      fill={color}
                      stroke={color}
                      strokeWidth="0.5"
                      rx="1"
                    />
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Right Side Attached TPO Profile Inspector */}
        <div className="lg:col-span-4 space-y-4">
          <TpoHistogram
            profile={profile}
            title="Attached TPO Profile"
            isDeveloping={profile.isDeveloping}
            maxHeightPx={500}
          />
        </div>
      </div>
    </div>
  );
};
