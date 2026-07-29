import React, { useState, useEffect } from 'react';
import {
  Compass,
  ArrowUpRight,
  ArrowDownRight,
  ShieldAlert,
  CheckCircle2,
  Eye,
  Target,
  Zap,
  Layers,
  Info,
} from 'lucide-react';
import { Candle, MarketProfileData, TradeSignal } from '../types/market';
import { formatPrice, getSymbolConfig } from '../config/symbols';

interface SignalChartPanelProps {
  candles: Candle[];
  profile: MarketProfileData;
  tradeSignal: TradeSignal | null;
}

export const SignalChartPanel: React.FC<SignalChartPanelProps> = ({
  candles,
  profile,
  tradeSignal,
}) => {
  const [showDemoSignal, setShowDemoSignal] = useState<boolean>(false);

  // Reset demo signal state when active symbol changes
  useEffect(() => {
    setShowDemoSignal(false);
  }, [profile.symbol]);

  const symbolConfig = getSymbolConfig(profile.symbol);
  const pipDivisor = symbolConfig.pipValue || 0.0001;

  // Filter out stale trade signal if it belongs to a different symbol
  let activeSignal: TradeSignal | null = tradeSignal;
  if (activeSignal && activeSignal.symbol && activeSignal.symbol !== profile.symbol) {
    activeSignal = null;
  }

  if ((!activeSignal || activeSignal.type === 'NO_TRADE') && showDemoSignal) {
    const isBull = profile.close >= profile.open;
    const entry = profile.close;
    const slDistPips = Math.max(15, Math.round((profile.atr14Pips || 80) * 0.35));
    const tpDistPips = Math.round(slDistPips * 2.5);
    const sl = isBull ? entry - slDistPips * pipDivisor : entry + slDistPips * pipDivisor;
    const tp = isBull ? entry + tpDistPips * pipDivisor : entry - tpDistPips * pipDivisor;

    activeSignal = {
      id: 'demo-signal-preview',
      symbol: profile.symbol,
      dateStr: new Date().toISOString().split('T')[0],
      timeStr: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now(),
      type: isBull ? 'BULLISH_IMBALANCE' : 'BEARISH_IMBALANCE',
      bias: isBull ? 'Bullish' : 'Bearish',
      score: profile.marketScore,
      entryPrice: entry,
      stopLoss: sl,
      takeProfit: tp,
      riskReward: 2.5,
      targetPips: tpDistPips,
      stopPips: slDistPips,
      rationale: [
        `Market Profile Value Area High expansion detected`,
        `Point of Control (${formatPrice(profile.poc, profile.symbol)}) acting as institutional support`,
        `Favorable 1:2.5 Risk-to-Reward ratio with low-risk invalidation`,
      ],
    };
  }

  const hasActiveSignal = Boolean(activeSignal && activeSignal.type !== 'NO_TRADE');

  // Asset-aware pip distances
  const defaultSlDistPips = Math.max(15, Math.round((profile.atr14Pips || 80) * 0.35));
  const defaultTpDistPips = Math.round(defaultSlDistPips * 2.5);

  let slPips = defaultSlDistPips;
  let tpPips = defaultTpDistPips;
  if (hasActiveSignal && activeSignal) {
    slPips =
      activeSignal.stopPips ||
      Math.abs(Math.round((activeSignal.entryPrice - activeSignal.stopLoss) / pipDivisor));
    tpPips =
      activeSignal.targetPips ||
      Math.abs(Math.round((activeSignal.takeProfit - activeSignal.entryPrice) / pipDivisor));
  }

  // Diagram SVG Geometry Calculations
  const isBullish = activeSignal
    ? activeSignal.type === 'BULLISH_IMBALANCE'
    : profile.close >= profile.open;

  // Price Boundary Range
  const entryPrice = activeSignal ? activeSignal.entryPrice : profile.close;

  const takeProfit = activeSignal
    ? activeSignal.takeProfit
    : isBullish
    ? entryPrice + defaultTpDistPips * pipDivisor
    : entryPrice - defaultTpDistPips * pipDivisor;

  const stopLoss = activeSignal
    ? activeSignal.stopLoss
    : isBullish
    ? entryPrice - defaultSlDistPips * pipDivisor
    : entryPrice + defaultSlDistPips * pipDivisor;

  const pocPrice = profile.poc;

  const allPrices = [entryPrice, takeProfit, stopLoss, pocPrice, profile.vah, profile.val].filter(
    (p) => typeof p === 'number' && !isNaN(p) && isFinite(p)
  );

  const maxP =
    allPrices.length > 0
      ? Math.max(...allPrices) + 8 * pipDivisor
      : entryPrice + defaultTpDistPips * pipDivisor;
  const minP =
    allPrices.length > 0
      ? Math.min(...allPrices) - 8 * pipDivisor
      : entryPrice - defaultSlDistPips * pipDivisor;
  const priceRange = Math.max(10 * pipDivisor, maxP - minP);

  // Map price to Y coordinate in SVG (Canvas height = 360, padding = 45)
  const canvasHeight = 360;
  const canvasWidth = 720;
  const padY = 45;
  const usableH = canvasHeight - padY * 2;

  const getSvgY = (price: number) => {
    if (!priceRange || isNaN(priceRange) || priceRange === 0 || typeof price !== 'number' || isNaN(price)) {
      return canvasHeight / 2;
    }
    const ratio = (price - minP) / priceRange;
    if (isNaN(ratio)) return canvasHeight / 2;
    const clampedRatio = Math.max(0, Math.min(1, ratio));
    return canvasHeight - padY - clampedRatio * usableH;
  };

  const yEntry = getSvgY(entryPrice);
  const yTP = getSvgY(takeProfit);
  const ySL = getSvgY(stopLoss);
  const yPOC = getSvgY(pocPrice);

  // Dynamic Zigzag Points Generation
  const seedMultiplier = Math.abs((entryPrice * 10000) % 7);
  const shift1 = seedMultiplier * 2 - 6;
  const shift2 = seedMultiplier * 1.5 - 4;

  let zigzagPoints: { x: number; y: number; label?: string; tag?: string }[] = [];

  if (isBullish) {
    // Bullish Diagram Sequence:
    // 1. Value Area Consolidation (Start at bottom-left near POC/SL)
    // 2. Breakout Push
    // 3. Pullback to Entry Trigger
    // 4. Strong Impulse Expansion
    // 5. Shallow Consolidating Dip
    // 6. Reach Take Profit Target
    zigzagPoints = [
      { x: 40, y: Math.min(canvasHeight - padY - 10, yEntry + (ySL - yEntry) * 0.6 + shift1) },
      { x: 110, y: yEntry + (ySL - yEntry) * 0.25 },
      { x: 180, y: yEntry - 28 + shift2, label: 'Value Area Breakout' },
      { x: 260, y: yEntry, label: 'Entry Trigger', tag: 'ENTRY' },
      { x: 380, y: yEntry + (yTP - yEntry) * 0.52 },
      { x: 460, y: yEntry + (yTP - yEntry) * 0.38 },
      { x: 570, y: yTP, label: 'Take Profit Target', tag: 'TARGET' },
      { x: 670, y: yTP - 8 },
    ];
  } else {
    // Bearish Diagram Sequence:
    // 1. Value Area Consolidation (Start at top-left near POC/SL)
    // 2. Breakdown Push
    // 3. Rally Retest to Entry Trigger
    // 4. Strong Drop Expansion
    // 5. Shallow Bounce
    // 6. Reach Take Profit Target
    zigzagPoints = [
      { x: 40, y: Math.max(padY + 10, yEntry + (ySL - yEntry) * 0.6 + shift1) },
      { x: 110, y: yEntry + (ySL - yEntry) * 0.25 },
      { x: 180, y: yEntry + 28 + shift2, label: 'Value Area Breakdown' },
      { x: 260, y: yEntry, label: 'Entry Trigger', tag: 'ENTRY' },
      { x: 380, y: yEntry + (yTP - yEntry) * 0.52 },
      { x: 460, y: yEntry + (yTP - yEntry) * 0.38 },
      { x: 570, y: yTP, label: 'Take Profit Target', tag: 'TARGET' },
      { x: 670, y: yTP + 8 },
    ];
  }

  // Create smooth curved path string
  const pathD = zigzagPoints.reduce((acc, pt, i) => {
    if (i === 0) return `M ${pt.x} ${pt.y}`;
    const prev = zigzagPoints[i - 1];
    const cx1 = prev.x + (pt.x - prev.x) * 0.45;
    const cy1 = prev.y;
    const cx2 = prev.x + (pt.x - prev.x) * 0.55;
    const cy2 = pt.y;
    return `${acc} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${pt.x} ${pt.y}`;
  }, '');

  return (
    <div className="bg-[#111113] border-2 border-blue-500/30 rounded-2xl p-5 shadow-2xl space-y-5 relative overflow-hidden">
      {/* Background Accent Glow */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />

      {/* Panel Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2d2d30] pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-950/80 border border-blue-700/60 flex items-center justify-center text-blue-400 shadow-md">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-white tracking-tight flex items-center gap-2 font-sans">
              <span>Session Signal Diagram</span>
              <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800 text-[10px] font-mono font-bold uppercase">
                {profile.symbol} ILLUSTRATION
              </span>
            </h3>
            <p className="text-xs text-[#a1a1aa]">
              Simplified educational SVG diagram showing entry trigger, risk boundaries, and profit target trajectory.
            </p>
          </div>
        </div>

        {/* Controls */}
        {!tradeSignal || tradeSignal.type === 'NO_TRADE' ? (
          <button
            onClick={() => setShowDemoSignal(!showDemoSignal)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold font-sans flex items-center gap-1.5 transition-all border ${
              showDemoSignal
                ? 'bg-amber-950 text-amber-300 border-amber-800 shadow-sm'
                : 'bg-[#161618] text-[#a1a1aa] border-[#2d2d30] hover:text-white'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{showDemoSignal ? 'Hide Strategy Overlay' : 'Preview Signal Diagram'}</span>
          </button>
        ) : null}
      </div>

      {/* Signal Status Metric Bar */}
      {hasActiveSignal && activeSignal ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
          {/* Signal Type */}
          <div className="bg-[#0c0c0e] border border-[#2d2d30] p-3 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[10px] text-[#71717a] font-sans font-bold uppercase block">Signal Direction</span>
              <span
                className={`text-sm font-extrabold flex items-center gap-1 ${
                  activeSignal.type === 'BULLISH_IMBALANCE' ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {activeSignal.type === 'BULLISH_IMBALANCE' ? (
                  <>
                    <ArrowUpRight className="w-4 h-4" /> BULLISH BUY
                  </>
                ) : (
                  <>
                    <ArrowDownRight className="w-4 h-4" /> BEARISH SELL
                  </>
                )}
              </span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800 font-bold">
              Score {activeSignal.score}/100
            </span>
          </div>

          {/* Entry Level */}
          <div className="bg-[#0c0c0e] border border-cyan-900/40 p-3 rounded-xl">
            <span className="text-[10px] text-cyan-400 font-sans font-bold uppercase block">Entry Price</span>
            <span className="text-sm font-black text-cyan-300">
              {formatPrice(activeSignal.entryPrice, profile.symbol)}
            </span>
          </div>

          {/* Stop Loss Level */}
          <div className="bg-[#0c0c0e] border border-red-900/40 p-3 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[10px] text-red-400 font-sans font-bold uppercase block">Stop Loss (SL)</span>
              <span className="text-sm font-black text-red-400">
                {formatPrice(activeSignal.stopLoss, profile.symbol)}
              </span>
            </div>
            <span className="text-[10px] font-bold text-red-400 bg-red-950/60 px-1.5 py-0.5 rounded border border-red-900/60">
              -{slPips} pips
            </span>
          </div>

          {/* Take Profit Level */}
          <div className="bg-[#0c0c0e] border border-emerald-900/40 p-3 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[10px] text-emerald-400 font-sans font-bold uppercase block">Take Profit (TP)</span>
              <span className="text-sm font-black text-emerald-400">
                {formatPrice(activeSignal.takeProfit, profile.symbol)}
              </span>
            </div>
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-900/60">
              +{tpPips} pips
            </span>
          </div>
        </div>
      ) : (
        <div className="bg-[#0c0c0e] border border-[#2d2d30] p-3.5 rounded-xl flex items-center justify-between font-sans text-xs">
          <div className="flex items-center gap-2 text-[#a1a1aa]">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <span>
              Market Quality Score for <strong className="text-cyan-400 font-mono">{profile.symbol}</strong> is <strong className="text-white font-mono">{profile.marketScore}/100</strong>. Live signal threshold requires score 85+.
            </span>
          </div>
          <button
            onClick={() => setShowDemoSignal(true)}
            className="text-xs text-blue-400 hover:underline font-bold font-mono"
          >
            Show Visual Diagram Overlay
          </button>
        </div>
      )}

      {/* SVG DIAGRAM STAGE (WHITE BACKGROUND + LIGHT GREY GRID + PROFESSIONAL TRADING EDUCATION ILLUSTRATION) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-inner p-4 relative overflow-hidden">
        {/* Top Diagram Legend Bar */}
        <div className="flex flex-wrap items-center justify-between text-xs font-sans font-bold text-slate-700 mb-3 pb-2 border-b border-slate-200">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-1 rounded-full bg-blue-600" />
              <span>SIGNAL TRAJECTORY</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500 border-2 border-white shadow-sm" />
              <span>TAKE PROFIT (+{tpPips} PIPS)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-cyan-500 border-2 border-white shadow-sm" />
              <span>ENTRY TRIGGER</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-rose-500 border-2 border-white shadow-sm" />
              <span>STOP LOSS (-{slPips} PIPS)</span>
            </span>
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
            <span>R:R RATIO = 1 : {activeSignal?.riskReward || 2.5}</span>
          </div>
        </div>

        {/* Dynamic SVG Diagram */}
        <div className="w-full relative h-[340px]">
          <svg
            className="w-full h-full"
            viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              {/* Light Grid Pattern */}
              <pattern
                id="lightGridPattern"
                width="30"
                height="30"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 30 0 L 0 0 0 30"
                  fill="none"
                  stroke="#e2e8f0"
                  strokeWidth="0.8"
                />
              </pattern>

              {/* Reward Zone Gradient */}
              <linearGradient id="rewardZoneLight" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.03" />
              </linearGradient>

              {/* Risk Zone Gradient */}
              <linearGradient id="riskZoneLight" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.03" />
                <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.12" />
              </linearGradient>

              {/* Path Drop Shadow Filter */}
              <filter id="diagramPathShadow" x="-10%" y="-10%" width="120%" height="120%">
                <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#1e3a8a" floodOpacity="0.25" />
              </filter>
            </defs>

            {/* WHITE BACKGROUND */}
            <rect width="100%" height="100%" fill="#ffffff" rx="8" />

            {/* LIGHT GREY GRID */}
            <rect width="100%" height="100%" fill="url(#lightGridPattern)" />

            {/* Subdued Axis Grid Lines */}
            {[0.2, 0.4, 0.6, 0.8].map((ratio) => (
              <line
                key={ratio}
                x1="0"
                y1={canvasHeight * ratio}
                x2={canvasWidth}
                y2={canvasHeight * ratio}
                stroke="#cbd5e1"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
            ))}

            {/* REWARD & RISK ZONE SHADINGS */}
            {hasActiveSignal && (
              <>
                {/* Take Profit Reward Zone */}
                <rect
                  x="200"
                  y={Math.min(yEntry, yTP)}
                  width={canvasWidth - 200}
                  height={Math.abs(yTP - yEntry)}
                  fill="url(#rewardZoneLight)"
                  stroke="#10b981"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />

                {/* Stop Loss Risk Zone */}
                <rect
                  x="200"
                  y={Math.min(yEntry, ySL)}
                  width={canvasWidth - 200}
                  height={Math.abs(ySL - yEntry)}
                  fill="url(#riskZoneLight)"
                  stroke="#f43f5e"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
              </>
            )}

            {/* POC MARKET PROFILE LEVEL LINE */}
            <line
              x1="30"
              y1={yPOC}
              x2={canvasWidth - 30}
              y2={yPOC}
              stroke="#d97706"
              strokeWidth="2"
              strokeDasharray="5 4"
            />
            <rect
              x={canvasWidth - 160}
              y={yPOC - 11}
              width="145"
              height="20"
              rx="4"
              fill="#fffbeb"
              stroke="#f59e0b"
              strokeWidth="1"
            />
            <text
              x={canvasWidth - 88}
              y={yPOC + 3}
              fill="#b45309"
              fontSize="10"
              fontWeight="bold"
              fontFamily="monospace"
              textAnchor="middle"
            >
              POC @ {formatPrice(pocPrice, profile.symbol)}
            </text>

            {/* TAKE PROFIT LEVEL LINE */}
            <line
              x1="30"
              y1={yTP}
              x2={canvasWidth - 30}
              y2={yTP}
              stroke="#059669"
              strokeWidth="3"
              strokeDasharray="6 3"
            />
            <g transform={`translate(${canvasWidth - 200}, ${yTP - 13})`}>
              <rect width="185" height="24" rx="6" fill="#059669" />
              <text
                x="92"
                y="16"
                fill="#ffffff"
                fontSize="11"
                fontWeight="800"
                fontFamily="sans-serif"
                textAnchor="middle"
              >
                TAKE PROFIT: {formatPrice(takeProfit, profile.symbol)}
              </text>
            </g>

            {/* STOP LOSS LEVEL LINE */}
            <line
              x1="30"
              y1={ySL}
              x2={canvasWidth - 30}
              y2={ySL}
              stroke="#dc2626"
              strokeWidth="3"
              strokeDasharray="6 3"
            />
            <g transform={`translate(${canvasWidth - 200}, ${ySL - 12})`}>
              <rect width="185" height="24" rx="6" fill="#dc2626" />
              <text
                x="92"
                y="16"
                fill="#ffffff"
                fontSize="11"
                fontWeight="800"
                fontFamily="sans-serif"
                textAnchor="middle"
              >
                STOP LOSS: {formatPrice(stopLoss, profile.symbol)}
              </text>
            </g>

            {/* ENTRY PRICE LEVEL LINE */}
            <line
              x1="30"
              y1={yEntry}
              x2={canvasWidth - 30}
              y2={yEntry}
              stroke="#0284c7"
              strokeWidth="3.5"
            />
            <g transform={`translate(40, ${yEntry - 13})`}>
              <rect width="180" height="24" rx="6" fill="#0284c7" />
              <text
                x="90"
                y="16"
                fill="#ffffff"
                fontSize="11"
                fontWeight="800"
                fontFamily="sans-serif"
                textAnchor="middle"
              >
                ENTRY LEVEL: {formatPrice(entryPrice, profile.symbol)}
              </text>
            </g>

            {/* THICK ZIGZAG TRAJECTORY PATH (SMOOTH ZIGZAG MOTION) */}
            <path
              d={pathD}
              fill="none"
              stroke={isBullish ? '#1e3a8a' : '#991b1b'}
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#diagramPathShadow)"
            />

            {/* Secondary Inner Accent Line on Path */}
            <path
              d={pathD}
              fill="none"
              stroke={isBullish ? '#3b82f6' : '#ef4444'}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* DYNAMIC ZIGZAG NODE CALLOUTS */}
            {zigzagPoints.map((pt, idx) => {
              if (!pt.tag && !pt.label) return null;

              const isEntryNode = pt.tag === 'ENTRY';
              const isTargetNode = pt.tag === 'TARGET';

              const nodeColor = isTargetNode
                ? '#10b981'
                : isEntryNode
                ? '#0284c7'
                : '#3b82f6';

              return (
                <g key={idx} transform={`translate(${pt.x}, ${pt.y})`}>
                  {/* Outer Pulsing Halo */}
                  <circle
                    r={isEntryNode || isTargetNode ? '12' : '8'}
                    fill={nodeColor}
                    opacity="0.2"
                  />
                  {/* Solid Inner Node */}
                  <circle
                    r={isEntryNode || isTargetNode ? '7' : '5'}
                    fill={nodeColor}
                    stroke="#ffffff"
                    strokeWidth="2.5"
                  />

                  {/* Text Badge for Major Nodes */}
                  {pt.label && (
                    <g
                      transform={`translate(0, ${
                        isBullish ? (isTargetNode ? -22 : 22) : (isTargetNode ? 22 : -22)
                      })`}
                    >
                      <rect
                        x="-55"
                        y="-11"
                        width="110"
                        height="20"
                        rx="5"
                        fill="#0f172a"
                        stroke={nodeColor}
                        strokeWidth="1.5"
                      />
                      <text
                        x="0"
                        y="3"
                        fill="#ffffff"
                        fontSize="9.5"
                        fontWeight="bold"
                        fontFamily="sans-serif"
                        textAnchor="middle"
                      >
                        {pt.label}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* RISK / REWARD BRACKET ILLUSTRATION ON RIGHT */}
            <g transform={`translate(${canvasWidth - 25}, 0)`}>
              {/* Bracket Line for TP */}
              <line
                x1="0"
                y1={yEntry}
                x2="0"
                y2={yTP}
                stroke="#059669"
                strokeWidth="2"
              />
              <line
                x1="-6"
                y1={yTP}
                x2="6"
                y2={yTP}
                stroke="#059669"
                strokeWidth="2"
              />
              {/* Bracket Line for SL */}
              <line
                x1="0"
                y1={yEntry}
                x2="0"
                y2={ySL}
                stroke="#dc2626"
                strokeWidth="2"
              />
              <line
                x1="-6"
                y1={ySL}
                x2="6"
                y2={ySL}
                stroke="#dc2626"
                strokeWidth="2"
              />
            </g>
          </svg>
        </div>

        {/* Bottom Educational Callouts Footer */}
        <div className="mt-3 pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between text-[11px] font-sans text-slate-600">
          <div className="flex items-center gap-1.5 font-semibold">
            <Info className="w-3.5 h-3.5 text-blue-600" />
            <span>
              Dynamic Market Profile Model:{' '}
              <strong className="text-slate-900">{profile.profileShape} Shape</strong> with{' '}
              <strong className="text-blue-700">{profile.bias} Bias</strong>
            </span>
          </div>
          <div className="flex items-center gap-3 font-mono font-bold text-slate-700">
            <span>ATR (14): {profile.atr14Pips} pips</span>
            <span>•</span>
            <span>Volume VA: {profile.valueAreaVolumePercent}%</span>
          </div>
        </div>
      </div>

      {/* Signal Setup Execution Rationale */}
      {hasActiveSignal && activeSignal && (
        <div className="bg-[#0c0c0e] border border-[#2d2d30] p-4 rounded-xl space-y-2 font-sans text-xs">
          <div className="font-bold text-[#a1a1aa] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Signal Structure & Trade Execution Mechanics</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <ul className="space-y-1.5 text-[#e0e0e0]">
              {activeSignal.rationale.map((r, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0 mt-1.5" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
            <div className="bg-[#111113] p-3 rounded-lg border border-[#2d2d30] text-[#a1a1aa] font-mono text-[11px] space-y-1">
              <div className="text-white font-bold flex justify-between">
                <span>Risk:Reward Target</span>
                <span className="text-amber-400 font-bold">1 : {activeSignal.riskReward}</span>
              </div>
              <div className="flex justify-between">
                <span>Calculated Stop Distance</span>
                <span className="text-red-400">{slPips} pips</span>
              </div>
              <div className="flex justify-between">
                <span>Calculated Profit Target</span>
                <span className="text-emerald-400">+{tpPips} pips</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
