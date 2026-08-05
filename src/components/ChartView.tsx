import React, { useState, useMemo } from 'react';
import { Candle, MarketProfileData, TradeSignal } from '../types/market';
import { TpoHistogram } from './TpoHistogram';
import {
  BarChart3,
  Layers,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Clock,
  Sliders,
  Eye,
  MousePointer,
  TrendingUp,
  Minus,
  Square,
  Activity,
  Trash2,
  X,
  Pencil,
  Maximize2,
  Minimize2,
} from 'lucide-react';

export type ChartTimeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1D';

export type DrawingToolType = 'none' | 'trendline' | 'horizontal' | 'zone' | 'fib';

export interface PointCoords {
  index: number;
  price: number;
}

export interface ChartDrawing {
  id: string;
  type: 'trendline' | 'horizontal' | 'zone' | 'fib';
  color: string;
  start: PointCoords;
  end?: PointCoords;
}

const DRAWING_COLORS = [
  { label: 'Amber', value: '#F59E0B', bg: 'bg-amber-500' },
  { label: 'Blue', value: '#3B82F6', bg: 'bg-blue-500' },
  { label: 'Emerald', value: '#10B981', bg: 'bg-emerald-500' },
  { label: 'Rose', value: '#EF4444', bg: 'bg-rose-500' },
  { label: 'Purple', value: '#A855F7', bg: 'bg-purple-500' },
  { label: 'White', value: '#E4E4E7', bg: 'bg-zinc-200' },
];

interface TimeframeOption {
  label: string;
  value: ChartTimeframe;
  title: string;
  minutes: number;
}

const TIMEFRAMES: TimeframeOption[] = [
  { label: '1m', value: '1m', title: '1 Minute', minutes: 1 },
  { label: '5m', value: '5m', title: '5 Minutes', minutes: 5 },
  { label: '15m', value: '15m', title: '15 Minutes', minutes: 15 },
  { label: '30m', value: '30m', title: '30 Minutes', minutes: 30 },
  { label: '1h', value: '1h', title: '1 Hour', minutes: 60 },
  { label: '4h', value: '4h', title: '4 Hours', minutes: 240 },
  { label: '1D', value: '1D', title: 'Daily', minutes: 1440 },
];

function formatPriceBySymbol(price: number, symbol: string): string {
  if (symbol.includes('JPY')) return price.toFixed(3);
  if (symbol.includes('BTC') || symbol.includes('ETH') || symbol.includes('XAU')) return price.toFixed(2);
  return price.toFixed(5);
}

function aggregateCandles(
  candles: Candle[],
  timeframe: ChartTimeframe,
  symbol: string
): Candle[] {
  if (!candles || candles.length === 0) return [];
  if (timeframe === '1m') return candles;

  const tfConfig = TIMEFRAMES.find((tf) => tf.value === timeframe) || TIMEFRAMES[0];
  const periodMs = tfConfig.minutes * 60 * 1000;

  const buckets = new Map<number, Candle[]>();
  for (const c of candles) {
    const ts = c.timestamp || Date.now();
    const bucketTs = Math.floor(ts / periodMs) * periodMs;
    if (!buckets.has(bucketTs)) {
      buckets.set(bucketTs, []);
    }
    buckets.get(bucketTs)!.push(c);
  }

  const sortedKeys = Array.from(buckets.keys()).sort((a, b) => a - b);
  const aggregated: Candle[] = [];

  for (const bucketTs of sortedKeys) {
    const group = buckets.get(bucketTs)!;
    const open = group[0].open;
    const close = group[group.length - 1].close;
    let high = -Infinity;
    let low = Infinity;
    let vol = 0;

    for (const c of group) {
      if (c.high > high) high = c.high;
      if (c.low < low) low = c.low;
      vol += c.volume || 0;
    }

    const d = new Date(bucketTs);
    const dateStr = d.toISOString().split('T')[0];
    const timeStr =
      timeframe === '1D'
        ? dateStr
        : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

    aggregated.push({
      timestamp: bucketTs,
      open,
      high,
      low,
      close,
      volume: vol,
      dateStr,
      timeStr,
    });
  }

  // Ensure we have at least 100 candles by prepending synthetic historical bars for higher timeframes
  if (aggregated.length < 100) {
    const needed = 100 - aggregated.length;
    const firstCandle = aggregated[0];
    const baseTs = firstCandle ? (firstCandle.timestamp || Date.now()) : Date.now();
    let priceCursor = firstCandle ? firstCandle.open : 1.3367;

    const isJPY = symbol.includes('JPY');
    const isCrypto = symbol.includes('BTC') || symbol.includes('ETH');
    const pipSize = isJPY ? 0.01 : isCrypto ? 1.0 : 0.0001;
    const volatilityPips =
      timeframe === '1D'
        ? 65
        : timeframe === '4h'
        ? 35
        : timeframe === '1h'
        ? 20
        : timeframe === '30m'
        ? 14
        : 10;

    const prependedReversed: Candle[] = [];
    for (let i = 1; i <= needed; i++) {
      const barTs = baseTs - i * periodMs;
      const d = new Date(barTs);
      const dateStr = d.toISOString().split('T')[0];
      const timeStr =
        timeframe === '1D'
          ? dateStr
          : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

      const movePips = (Math.random() - 0.49) * volatilityPips;
      const close = priceCursor;
      const open = close - movePips * pipSize;
      const high = Math.max(open, close) + Math.random() * (volatilityPips * 0.3) * pipSize;
      const low = Math.min(open, close) - Math.random() * (volatilityPips * 0.3) * pipSize;
      const vol = Math.floor(120 + Math.random() * 500);

      prependedReversed.push({
        timestamp: barTs,
        open,
        high,
        low,
        close,
        volume: vol,
        dateStr,
        timeStr,
      });

      priceCursor = open;
    }

    const prepended = prependedReversed.reverse();
    return [...prepended, ...aggregated];
  }

  return aggregated;
}

interface ChartViewProps {
  candles: Candle[];
  profile: MarketProfileData;
  tradeSignal: TradeSignal | null;
}

export const ChartView: React.FC<ChartViewProps> = ({ candles, profile, tradeSignal }) => {
  const [activeTimeframe, setActiveTimeframe] = useState<ChartTimeframe>('1m');
  const [zoomLevel, setZoomLevel] = useState<number>(60); // number of candles shown
  const [showTpoOverlay, setShowTpoOverlay] = useState<boolean>(true);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [hoveredPrice, setHoveredPrice] = useState<number | null>(null);

  const [activeTool, setActiveTool] = useState<DrawingToolType>('none');
  const [selectedColor, setSelectedColor] = useState<string>('#F59E0B');
  const [drawings, setDrawings] = useState<ChartDrawing[]>(() => {
    try {
      const saved = localStorage.getItem(`drawings_${profile?.symbol || 'GBPUSD'}_${activeTimeframe}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [draftDrawing, setDraftDrawing] = useState<ChartDrawing | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(`drawings_${profile?.symbol || 'GBPUSD'}_${activeTimeframe}`);
      setDrawings(saved ? JSON.parse(saved) : []);
      setDraftDrawing(null);
    } catch {
      setDrawings([]);
    }
  }, [profile?.symbol, activeTimeframe]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (draftDrawing) {
          setDraftDrawing(null);
        } else if (activeTool !== 'none') {
          setActiveTool('none');
        } else if (isFullscreen) {
          setIsFullscreen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [draftDrawing, activeTool, isFullscreen]);

  const saveDrawings = (updated: ChartDrawing[]) => {
    setDrawings(updated);
    try {
      localStorage.setItem(`drawings_${profile?.symbol || 'GBPUSD'}_${activeTimeframe}`, JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const removeDrawing = (id: string) => {
    saveDrawings(drawings.filter((d) => d.id !== id));
  };

  const clearAllDrawings = () => {
    saveDrawings([]);
    setDraftDrawing(null);
  };

  const aggregatedCandles = useMemo(
    () => aggregateCandles(candles, activeTimeframe, profile?.symbol || 'GBPUSD'),
    [candles, activeTimeframe, profile?.symbol]
  );

  if (!candles || candles.length === 0 || !profile || aggregatedCandles.length === 0) {
    return (
      <div className="bg-[#111113] border border-[#2d2d30] rounded-xl p-12 text-center text-[#71717a] font-mono text-sm max-w-7xl mx-auto my-6">
        Loading {profile?.symbol || 'GBP/USD'} {activeTimeframe} Candle Feed...
      </div>
    );
  }

  const maxZoom = aggregatedCandles.length;
  const minZoom = Math.min(15, maxZoom);
  const effectiveZoom = Math.max(minZoom, Math.min(maxZoom, zoomLevel));
  const visibleCandles = aggregatedCandles.slice(-effectiveZoom);

  const minPrice = Math.min(...visibleCandles.map((c) => c.low), profile.val - 0.0010);
  const maxPrice = Math.max(...visibleCandles.map((c) => c.high), profile.vah + 0.0010);
  const priceRange = Math.max(0.0010, maxPrice - minPrice);

  const getXPct = (index: number) => {
    return Math.max(0, Math.min(100, ((index + 0.5) / visibleCandles.length) * 100));
  };

  const getYPct = (price: number) => {
    return Math.max(0, Math.min(100, (1 - (price - minPrice) / priceRange) * 100));
  };

  const priceTicks = useMemo(() => {
    const count = 7;
    const ticks: number[] = [];
    for (let i = 0; i < count; i++) {
      const p = minPrice + (priceRange * i) / (count - 1);
      ticks.push(p);
    }
    return ticks.reverse();
  }, [minPrice, priceRange]);

  const timeTicks = useMemo(() => {
    const total = visibleCandles.length;
    if (total === 0) return [];
    const targetTicks = Math.min(7, total);
    const step = Math.max(1, Math.floor(total / targetTicks));
    const ticks: { index: number; label: string }[] = [];

    for (let i = 0; i < total; i += step) {
      const c = visibleCandles[i];
      let label = '';
      if (activeTimeframe === '1D') {
        label = c.dateStr || '';
      } else if (activeTimeframe === '4h' || activeTimeframe === '1h') {
        const shortDate = c.dateStr ? c.dateStr.slice(5) : '';
        label = `${shortDate} ${c.timeStr || ''}`;
      } else {
        const shortDate = c.dateStr ? c.dateStr.slice(5) : '';
        if (i === 0 || (i > 0 && c.dateStr !== visibleCandles[i - 1]?.dateStr)) {
          label = `${shortDate} ${c.timeStr || ''}`;
        } else {
          label = c.timeStr || '';
        }
      }
      ticks.push({ index: i, label });
    }
    return ticks;
  }, [visibleCandles, activeTimeframe]);

  const getCoordsFromEvent = (e: React.MouseEvent<SVGSVGElement>): { index: number; price: number } => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const mouseY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
    const pctX = mouseX / rect.width;
    const pctY = mouseY / rect.height;
    const index = Math.min(visibleCandles.length - 1, Math.max(0, Math.floor(pctX * visibleCandles.length)));
    const price = minPrice + (1 - pctY) * priceRange;
    return { index, price };
  };

  const activeCandle =
    hoveredIndex !== null && visibleCandles[hoveredIndex]
      ? visibleCandles[hoveredIndex]
      : visibleCandles[visibleCandles.length - 1];

  const handleZoomIn = () => setZoomLevel((z) => Math.max(minZoom, z - 15));
  const handleZoomOut = () => setZoomLevel((z) => Math.min(maxZoom, z + 15));
  const handleZoomReset = () => setZoomLevel(Math.min(60, maxZoom));
  const handlePresetZoom = (count: number) =>
    setZoomLevel(Math.min(maxZoom, Math.max(minZoom, count)));

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setZoomLevel((z) => Math.max(minZoom, z - 5));
    } else {
      setZoomLevel((z) => Math.min(maxZoom, z + 5));
    }
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const coords = getCoordsFromEvent(e);
    if (coords.index >= 0 && coords.index < visibleCandles.length) {
      setHoveredIndex(coords.index);
    }
    setHoveredPrice(coords.price);
    if (draftDrawing) {
      setDraftDrawing((prev) => (prev ? { ...prev, end: coords } : null));
    }
  };

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (activeTool === 'none') return;
    const coords = getCoordsFromEvent(e);

    if (activeTool === 'horizontal') {
      const newDrawing: ChartDrawing = {
        id: `draw-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'horizontal',
        color: selectedColor,
        start: coords,
      };
      saveDrawings([...drawings, newDrawing]);
      return;
    }

    if (!draftDrawing) {
      setDraftDrawing({
        id: `draw-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: activeTool,
        color: selectedColor,
        start: coords,
        end: coords,
      });
    } else {
      const completed: ChartDrawing = {
        ...draftDrawing,
        end: coords,
      };
      saveDrawings([...drawings, completed]);
      setDraftDrawing(null);
    }
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
    setHoveredPrice(null);
  };

  const pipSize =
    profile.symbol.includes('JPY')
      ? 0.01
      : profile.symbol.includes('BTC') || profile.symbol.includes('ETH')
      ? 1.0
      : 0.0001;
  const priceChange = activeCandle.close - activeCandle.open;
  const pipChange = priceChange / pipSize;
  const pctChange = (priceChange / activeCandle.open) * 100;
  const isBullishCandle = activeCandle.close >= activeCandle.open;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
      {/* Chart Header & Timeframe Switcher Bar */}
      <div className="bg-[#111113] border border-[#2d2d30] rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between text-[#e0e0e0] font-mono text-xs gap-4 shadow-xl">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-400" />
            <span className="font-bold text-[#ffffff] text-sm">
              {profile.symbol} {activeTimeframe} Candlestick Chart
            </span>
          </div>

          <span className="text-[#71717a] hidden sm:inline">|</span>

          {/* Timeframe Selector Pills */}
          <div className="flex items-center gap-1 bg-[#0c0c0e] p-1 rounded-lg border border-[#2d2d30]">
            <span className="text-[10px] text-[#71717a] px-1.5 flex items-center gap-1">
              <Clock className="w-3 h-3" /> TF:
            </span>
            {TIMEFRAMES.map((tf) => {
              const isActive = activeTimeframe === tf.value;
              return (
                <button
                  key={tf.value}
                  onClick={() => setActiveTimeframe(tf.value)}
                  title={tf.title}
                  className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-400'
                      : 'text-[#71717a] hover:text-[#e0e0e0] hover:bg-[#161618]'
                  }`}
                >
                  {tf.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Zoom Controls & TPO Overlay Toggle */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          {/* Preset Zoom Buttons */}
          <div className="flex items-center gap-1 bg-[#0c0c0e] p-1 rounded-lg border border-[#2d2d30]">
            <span className="text-[10px] text-[#71717a] px-1 flex items-center gap-1">
              <Sliders className="w-3 h-3" /> Zoom:
            </span>
            {[
              { label: '30', value: 30, title: 'Close Up (30 Bars)' },
              { label: '60', value: 60, title: 'Default (60 Bars)' },
              { label: '120', value: 120, title: 'Wide (120 Bars)' },
              { label: 'All', value: maxZoom, title: `Full History (${maxZoom} Bars)` },
            ].map((preset) => (
              <button
                key={preset.label}
                onClick={() => handlePresetZoom(preset.value)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-colors ${
                  effectiveZoom === Math.min(maxZoom, Math.max(minZoom, preset.value))
                    ? 'bg-blue-950 text-blue-300 border border-blue-800'
                    : 'text-[#71717a] hover:text-[#e0e0e0] hover:bg-[#161618]'
                }`}
                title={preset.title}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Interactive Zoom Slider & Buttons */}
          <div className="flex items-center gap-2 bg-[#0c0c0e] px-2 py-1 rounded-lg border border-[#2d2d30]">
            <button
              onClick={handleZoomOut}
              className="p-1 rounded text-[#71717a] hover:text-[#e0e0e0] hover:bg-[#161618]"
              title="Zoom Out (-15 Bars)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>

            <input
              type="range"
              min={minZoom}
              max={maxZoom}
              value={effectiveZoom}
              onChange={(e) => setZoomLevel(Number(e.target.value))}
              className="w-20 md:w-28 h-1.5 bg-[#2d2d30] rounded-lg appearance-none cursor-pointer accent-blue-500"
              title={`Visible Candles: ${effectiveZoom} / ${maxZoom}`}
            />

            <button
              onClick={handleZoomIn}
              className="p-1 rounded text-[#71717a] hover:text-[#e0e0e0] hover:bg-[#161618]"
              title="Zoom In (+15 Bars)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleZoomReset}
              className="p-1 rounded text-[#71717a] hover:text-[#e0e0e0] hover:bg-[#161618] border-l border-[#2d2d30] pl-1.5 ml-0.5"
              title="Reset Zoom (60 Bars)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <span className="px-1 text-[10px] text-blue-300 font-bold font-mono">
              {effectiveZoom}/{maxZoom}
            </span>
          </div>

          {/* TPO Overlay Toggle Button */}
          <button
            onClick={() => setShowTpoOverlay(!showTpoOverlay)}
            className={`px-3 py-1.5 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-colors border ${
              showTpoOverlay
                ? 'bg-blue-950 text-blue-300 border-blue-800'
                : 'bg-[#161618] text-[#71717a] border-[#2d2d30]'
            }`}
            title="Toggle Market Profile TPO Overlay Lines"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>TPO Overlay</span>
          </button>

          {/* Fullscreen Toggle Button */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className={`px-3 py-1.5 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-colors border ${
              isFullscreen
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-[#161618] text-[#71717a] border-[#2d2d30] hover:text-white'
            }`}
            title={isFullscreen ? 'Exit Fullscreen Chart (Esc)' : 'Expand Interactive Chart to Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
          </button>
        </div>
      </div>

      {/* Main Chart Canvas & Market Profile Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Candlestick Stage View */}
        <div
          className={
            isFullscreen
              ? 'fixed inset-0 z-50 bg-[#0c0c0e] border border-[#2d2d30] p-4 sm:p-6 flex flex-col shadow-2xl h-screen w-screen overflow-hidden'
              : 'lg:col-span-8 bg-[#111113] border border-[#2d2d30] rounded-xl p-4 shadow-2xl relative flex flex-col h-[580px]'
          }
        >
          {/* Fullscreen Mode Top Controls Header */}
          {isFullscreen && (
            <div className="bg-[#111113] border border-[#2d2d30] rounded-lg p-2.5 mb-2.5 flex flex-wrap items-center justify-between gap-3 text-xs font-mono shadow-md">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 font-bold text-white text-sm">
                  <BarChart3 className="w-4 h-4 text-blue-400" />
                  <span>{profile.symbol}</span>
                  <span className="bg-blue-600/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded text-xs font-bold ml-1">
                    {activeTimeframe}
                  </span>
                </div>

                <span className="text-[#3f3f46]">|</span>

                {/* Timeframe Selector Pills in Fullscreen */}
                <div className="flex items-center gap-1 bg-[#0c0c0e] p-0.5 rounded border border-[#2d2d30]">
                  {TIMEFRAMES.map((tf) => (
                    <button
                      key={tf.value}
                      onClick={() => setActiveTimeframe(tf.value)}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                        activeTimeframe === tf.value
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-[#71717a] hover:text-[#e0e0e0] hover:bg-[#1f1f23]'
                      }`}
                    >
                      {tf.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Right Side: Zoom and Exit Fullscreen */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 bg-[#0c0c0e] px-2 py-0.5 rounded border border-[#2d2d30]">
                  <button
                    onClick={handleZoomOut}
                    className="p-1 rounded text-[#71717a] hover:text-[#e0e0e0] hover:bg-[#1f1f23]"
                    title="Zoom Out (-15 Bars)"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[10px] text-blue-300 font-bold px-1">
                    {effectiveZoom}/{maxZoom}
                  </span>
                  <button
                    onClick={handleZoomIn}
                    className="p-1 rounded text-[#71717a] hover:text-[#e0e0e0] hover:bg-[#1f1f23]"
                    title="Zoom In (+15 Bars)"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  onClick={() => setIsFullscreen(false)}
                  className="px-3 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-xs flex items-center gap-1.5 transition-colors"
                  title="Exit Fullscreen (Esc)"
                >
                  <Minimize2 className="w-3.5 h-3.5" />
                  <span>Exit Fullscreen</span>
                </button>
              </div>
            </div>
          )}
          {/* Interactive Drawing Tools Toolbar */}
          <div className="bg-[#0c0c0e] border border-[#2d2d30] rounded-lg p-2 mb-3 flex flex-wrap items-center justify-between gap-2 text-xs font-mono shadow-inner">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[#71717a] font-bold text-[10px] uppercase tracking-wider flex items-center gap-1 mr-1">
                <Pencil className="w-3.5 h-3.5 text-amber-400" /> Draw:
              </span>

              {[
                { type: 'none' as const, label: 'Cursor', icon: MousePointer, title: 'Inspect / Select Mode (Esc)' },
                { type: 'trendline' as const, label: 'Trendline', icon: TrendingUp, title: 'Draw Line between 2 points' },
                { type: 'horizontal' as const, label: 'Horiz Level', icon: Minus, title: 'Drop a Support/Resistance Level' },
                { type: 'zone' as const, label: 'Zone Box', icon: Square, title: 'Draw Supply/Demand Order Block' },
                { type: 'fib' as const, label: 'Fib Retrace', icon: Activity, title: 'Draw Fibonacci Retracement Levels' },
              ].map((t) => {
                const Icon = t.icon;
                const isActive = activeTool === t.type;
                return (
                  <button
                    key={t.type}
                    onClick={() => {
                      setActiveTool(t.type);
                      setDraftDrawing(null);
                    }}
                    title={t.title}
                    className={`px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all ${
                      isActive
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                        : 'text-[#a1a1aa] hover:text-white hover:bg-[#161618]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Right Side: Color Palette & Clear Button */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-[#141416] px-2 py-1 rounded border border-[#2d2d30]">
                {DRAWING_COLORS.map((col) => (
                  <button
                    key={col.value}
                    onClick={() => setSelectedColor(col.value)}
                    title={`Color: ${col.label}`}
                    className={`w-4 h-4 rounded-full ${col.bg} transition-all ${
                      selectedColor === col.value
                        ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0c0c0e] scale-110'
                        : 'opacity-70 hover:opacity-100'
                    }`}
                  />
                ))}
              </div>

              {drawings.length > 0 && (
                <button
                  onClick={clearAllDrawings}
                  className="px-2 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold text-[11px] flex items-center gap-1 transition-colors"
                  title="Clear all drawings on this symbol"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear ({drawings.length})</span>
                </button>
              )}

              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className={`px-2.5 py-1 rounded border font-bold text-xs flex items-center gap-1.5 transition-colors ${
                  isFullscreen
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                    : 'bg-[#141416] text-[#a1a1aa] border-[#2d2d30] hover:text-white hover:bg-[#1f1f23]'
                }`}
                title={isFullscreen ? 'Exit Fullscreen Chart (Esc)' : 'Expand Interactive Chart to Fullscreen'}
              >
                {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                <span>{isFullscreen ? 'Exit' : 'Fullscreen'}</span>
              </button>
            </div>
          </div>

          {/* Key Level Overlays Legends */}
          <div className="flex flex-wrap items-center justify-between text-[10px] font-mono mb-2 text-[#71717a] px-2 border-b border-[#2d2d30] pb-2 gap-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 bg-amber-400" /> T-POC ({formatPriceBySymbol(profile.poc, profile.symbol)})
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 bg-emerald-400" /> VAH ({formatPriceBySymbol(profile.vah, profile.symbol)})
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 bg-emerald-400" /> VAL ({formatPriceBySymbol(profile.val, profile.symbol)})
              </span>
              <span className="text-[#3f3f46]">|</span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 bg-purple-500" /> VPOC ({formatPriceBySymbol(profile.vpoc || profile.poc, profile.symbol)})
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 bg-cyan-400" /> VVAH ({formatPriceBySymbol(profile.vvah || profile.vah, profile.symbol)})
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 bg-cyan-400" /> VVAL ({formatPriceBySymbol(profile.vval || profile.val, profile.symbol)})
              </span>
              <span className="text-[#3f3f46]">|</span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 bg-blue-400" /> IB Range
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span>ATR(14): {profile.atr14Pips} pips</span>
              <span className="text-blue-400 font-bold">Scroll Wheel / Slider to Zoom</span>
            </div>
          </div>

          {/* Interactive Live OHLC Inspector Bar */}
          <div className="bg-[#0c0c0e] border border-[#2d2d30] rounded-lg px-3 py-1.5 mb-2 flex flex-wrap items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold text-[10px]">
                {activeTimeframe}
              </span>
              <span className="text-[#a1a1aa] font-bold">
                {activeCandle.dateStr || ''} {activeCandle.timeStr || ''}
              </span>
              <span className="text-[#71717a]">|</span>
              <span>
                <span className="text-[#71717a]">O:</span>{' '}
                <span className="text-[#e0e0e0]">
                  {formatPriceBySymbol(activeCandle.open, profile.symbol)}
                </span>
              </span>
              <span>
                <span className="text-[#71717a]">H:</span>{' '}
                <span className="text-[#e0e0e0]">
                  {formatPriceBySymbol(activeCandle.high, profile.symbol)}
                </span>
              </span>
              <span>
                <span className="text-[#71717a]">L:</span>{' '}
                <span className="text-[#e0e0e0]">
                  {formatPriceBySymbol(activeCandle.low, profile.symbol)}
                </span>
              </span>
              <span>
                <span className="text-[#71717a]">C:</span>{' '}
                <span className="text-[#e0e0e0] font-bold">
                  {formatPriceBySymbol(activeCandle.close, profile.symbol)}
                </span>
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span
                className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                  isBullishCandle
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                }`}
              >
                {pipChange >= 0 ? `+${pipChange.toFixed(1)}` : pipChange.toFixed(1)} pips ({pctChange >= 0 ? `+${pctChange.toFixed(2)}` : pctChange.toFixed(2)}%)
              </span>
              <span className="text-[#a1a1aa] text-[11px]">
                Vol: <span className="text-[#e0e0e0] font-bold">{activeCandle.volume}</span>
              </span>
            </div>
          </div>

          {/* SVG Chart Stage + Dedicated Y-Axis & X-Axis Panels */}
          <div
            className="relative flex-1 bg-[#0c0c0e] rounded border border-[#2d2d30] overflow-hidden select-none flex"
            onWheel={handleWheel}
          >
            {/* Left Column: Main SVG Chart + Bottom X-Axis Strip */}
            <div className="relative flex-1 flex flex-col overflow-hidden">
              <div className="relative flex-1 w-full overflow-hidden">
                <svg
                  className={`w-full h-full ${activeTool !== 'none' ? 'cursor-crosshair' : 'cursor-default'}`}
                  preserveAspectRatio="none"
                  onClick={handleSvgClick}
                  onMouseMove={handleMouseMove}
                  onMouseLeave={handleMouseLeave}
                >
                  {/* Horizontal Price Grid Lines */}
                  {priceTicks.map((priceVal, idx) => {
                    const yPct = getYPct(priceVal);
                    return (
                      <line
                        key={`h-${idx}`}
                        x1="0"
                        y1={`${yPct}%`}
                        x2="100%"
                        y2={`${yPct}%`}
                        stroke="#222225"
                        strokeWidth="1"
                        strokeDasharray="3 3"
                      />
                    );
                  })}

                  {/* Vertical Date/Time Grid Lines */}
                  {timeTicks.map((tick) => {
                    const xPct = getXPct(tick.index);
                    return (
                      <line
                        key={`v-${tick.index}`}
                        x1={`${xPct}%`}
                        y1="0"
                        x2={`${xPct}%`}
                        y2="100%"
                        stroke="#222225"
                        strokeWidth="1"
                        strokeDasharray="3 3"
                      />
                    );
                  })}

              {/* TPO Overlay Lines */}
              {showTpoOverlay && (
                <>
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
                    height={`${Math.abs(
                      getYPct(profile.initialBalance.low) - getYPct(profile.initialBalance.high)
                    )}%`}
                    fill="#06B6D4"
                    fillOpacity="0.05"
                    stroke="#06B6D4"
                    strokeWidth="0.8"
                    strokeDasharray="2 2"
                  />
                </>
              )}

              {/* Signal Setup Overlay Lines */}
              {showTpoOverlay && tradeSignal && tradeSignal.type !== 'NO_TRADE' && (
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
                const candleWidth = Math.max(1.5, (100 / visibleCandles.length) * 0.75);
                const openY = getYPct(c.open);
                const closeY = getYPct(c.close);
                const highY = getYPct(c.high);
                const lowY = getYPct(c.low);
                const isBullish = c.close >= c.open;
                const color = isBullish ? '#10B981' : '#EF4444';
                const isHovered = hoveredIndex === idx;

                return (
                  <g key={c.timestamp || idx}>
                    {/* Wick */}
                    <line
                      x1={`${xPct}%`}
                      y1={`${highY}%`}
                      x2={`${xPct}%`}
                      y2={`${lowY}%`}
                      stroke={color}
                      strokeWidth={isHovered ? '2' : '1'}
                    />
                    {/* Body */}
                    <rect
                      x={`${xPct - candleWidth / 2}%`}
                      y={`${Math.min(openY, closeY)}%`}
                      width={`${candleWidth}%`}
                      height={`${Math.max(0.8, Math.abs(closeY - openY))}%`}
                      fill={color}
                      stroke={isHovered ? '#ffffff' : color}
                      strokeWidth={isHovered ? '1.5' : '0.5'}
                      rx="1"
                    />
                  </g>
                );
              })}

              {/* Hover Crosshair Overlay */}
              {hoveredIndex !== null && visibleCandles[hoveredIndex] && (
                <>
                  {/* Vertical Crosshair Line */}
                  <line
                    x1={`${((hoveredIndex + 0.5) / visibleCandles.length) * 100}%`}
                    y1="0"
                    x2={`${((hoveredIndex + 0.5) / visibleCandles.length) * 100}%`}
                    y2="100%"
                    stroke="#71717a"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />

                  {/* Horizontal Crosshair Line at Hovered Close */}
                  <line
                    x1="0"
                    y1={`${getYPct(visibleCandles[hoveredIndex].close)}%`}
                    x2="100%"
                    y2={`${getYPct(visibleCandles[hoveredIndex].close)}%`}
                    stroke="#71717a"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                </>
              )}

              {/* Interactive Drawings Overlay (Saved + Draft) */}
              {[...drawings, ...(draftDrawing ? [draftDrawing] : [])].map((d) => {
                if (d.type === 'horizontal') {
                  return (
                    <g key={d.id} className="group">
                      <line
                        x1="0"
                        y1={`${getYPct(d.start.price)}%`}
                        x2="100%"
                        y2={`${getYPct(d.start.price)}%`}
                        stroke={d.color}
                        strokeWidth="2"
                        strokeDasharray="4 2"
                      />
                      <g
                        className="cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeDrawing(d.id);
                        }}
                      >
                        <rect
                          x="8"
                          y={`calc(${getYPct(d.start.price)}% - 10px)`}
                          width="115"
                          height="20"
                          rx="4"
                          fill="#18181b"
                          stroke={d.color}
                          strokeWidth="1.5"
                        />
                        <text
                          x="14"
                          y={`calc(${getYPct(d.start.price)}% + 4px)`}
                          fill={d.color}
                          fontSize="10"
                          fontFamily="monospace"
                          fontWeight="bold"
                        >
                          HL: {formatPriceBySymbol(d.start.price, profile.symbol)} ×
                        </text>
                      </g>
                    </g>
                  );
                }

                if (!d.end) return null;
                const x1 = getXPct(d.start.index);
                const y1 = getYPct(d.start.price);
                const x2 = getXPct(d.end.index);
                const y2 = getYPct(d.end.price);

                if (d.type === 'trendline') {
                  return (
                    <g
                      key={d.id}
                      className="cursor-pointer group"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeDrawing(d.id);
                      }}
                    >
                      <line x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`} stroke="transparent" strokeWidth="14" />
                      <line x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`} stroke={d.color} strokeWidth="2.5" />
                      <circle cx={`${x1}%`} cy={`${y1}%`} r="4.5" fill={d.color} stroke="#0c0c0e" strokeWidth="1.5" />
                      <circle cx={`${x2}%`} cy={`${y2}%`} r="4.5" fill={d.color} stroke="#0c0c0e" strokeWidth="1.5" />
                      <g transform={`translate(0, 0)`}>
                        <rect
                          x={`calc(${(x1 + x2) / 2}% - 26px)`}
                          y={`calc(${(y1 + y2) / 2}% - 10px)`}
                          width="52"
                          height="20"
                          rx="4"
                          fill="#18181b"
                          stroke={d.color}
                          strokeWidth="1.5"
                        />
                        <text
                          x={`calc(${(x1 + x2) / 2}% - 18px)`}
                          y={`calc(${(y1 + y2) / 2}% + 4px)`}
                          fill={d.color}
                          fontSize="10"
                          fontFamily="monospace"
                          fontWeight="bold"
                        >
                          LINE ×
                        </text>
                      </g>
                    </g>
                  );
                }

                if (d.type === 'zone') {
                  const minX = Math.min(x1, x2);
                  const maxX = Math.max(x1, x2);
                  const minY = Math.min(y1, y2);
                  const maxY = Math.max(y1, y2);
                  return (
                    <g
                      key={d.id}
                      className="cursor-pointer group"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeDrawing(d.id);
                      }}
                    >
                      <rect
                        x={`${minX}%`}
                        y={`${minY}%`}
                        width={`${Math.max(1.5, maxX - minX)}%`}
                        height={`${Math.max(1.5, maxY - minY)}%`}
                        fill={d.color}
                        fillOpacity="0.18"
                        stroke={d.color}
                        strokeWidth="1.5"
                        strokeDasharray="4 2"
                        rx="4"
                      />
                      <rect
                        x={`${minX}%`}
                        y={`calc(${minY}% - 10px)`}
                        width="80"
                        height="18"
                        rx="3"
                        fill="#18181b"
                        stroke={d.color}
                        strokeWidth="1.5"
                      />
                      <text
                        x={`calc(${minX}% + 6px)`}
                        y={`calc(${minY}% + 3px)`}
                        fill={d.color}
                        fontSize="9"
                        fontFamily="monospace"
                        fontWeight="bold"
                      >
                        ZONE BOX ×
                      </text>
                    </g>
                  );
                }

                if (d.type === 'fib') {
                  const levels = [
                    { ratio: 0, label: '0%' },
                    { ratio: 0.236, label: '23.6%' },
                    { ratio: 0.382, label: '38.2%' },
                    { ratio: 0.5, label: '50.0%' },
                    { ratio: 0.618, label: '61.8%' },
                    { ratio: 0.786, label: '78.6%' },
                    { ratio: 1.0, label: '100%' },
                  ];
                  const minX = Math.min(x1, x2);
                  const maxX = Math.max(x1, x2);
                  const startP = d.start.price;
                  const endP = d.end.price;
                  const topY = Math.min(getYPct(startP), getYPct(endP));
                  const bottomY = Math.max(getYPct(startP), getYPct(endP));

                  return (
                    <g
                      key={d.id}
                      className="cursor-pointer group"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeDrawing(d.id);
                      }}
                    >
                      <rect
                        x={`${minX}%`}
                        y={`${topY}%`}
                        width={`${Math.max(3, maxX - minX)}%`}
                        height={`${Math.max(2, bottomY - topY)}%`}
                        fill={d.color}
                        fillOpacity="0.05"
                      />
                      {levels.map((lvl) => {
                        const priceLevel = startP + (endP - startP) * lvl.ratio;
                        const yLevelPct = getYPct(priceLevel);
                        const isGolden = lvl.ratio === 0.618 || lvl.ratio === 0.5;
                        return (
                          <g key={lvl.label}>
                            <line
                              x1={`${minX}%`}
                              y1={`${yLevelPct}%`}
                              x2={`${maxX}%`}
                              y2={`${yLevelPct}%`}
                              stroke={isGolden ? '#F59E0B' : d.color}
                              strokeWidth={isGolden ? '1.5' : '1'}
                              strokeDasharray={isGolden ? 'none' : '3 3'}
                              strokeOpacity={isGolden ? '1' : '0.7'}
                            />
                            <text
                              x={`calc(${maxX}% - 75px)`}
                              y={`calc(${yLevelPct}% - 4px)`}
                              fill={isGolden ? '#F59E0B' : d.color}
                              fontSize="9"
                              fontFamily="monospace"
                              fontWeight="bold"
                            >
                              {lvl.label} ({formatPriceBySymbol(priceLevel, profile.symbol)})
                            </text>
                          </g>
                        );
                      })}
                      <g transform={`translate(0,0)`}>
                        <rect
                          x={`${minX}%`}
                          y={`calc(${topY}% - 18px)`}
                          width="78"
                          height="16"
                          rx="3"
                          fill="#18181b"
                          stroke={d.color}
                          strokeWidth="1.5"
                        />
                        <text
                          x={`calc(${minX}% + 6px)`}
                          y={`calc(${topY}% - 6px)`}
                          fill={d.color}
                          fontSize="9"
                          fontFamily="monospace"
                          fontWeight="bold"
                        >
                          FIB TOOL ×
                        </text>
                      </g>
                    </g>
                  );
                }

                return null;
              })}
                </svg>

                {/* Active Drawing Tool Toast Badge */}
                {activeTool !== 'none' && (
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-[#0c0c0e]/95 border border-amber-500/50 text-amber-300 font-mono text-xs px-3 py-1.5 rounded-full shadow-lg pointer-events-none flex items-center gap-2 z-10">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <span>
                      {activeTool === 'horizontal'
                        ? 'Click anywhere on chart to drop horizontal level'
                        : draftDrawing
                        ? 'Click end point on chart to finish drawing'
                        : 'Click start point on chart to begin drawing'}
                    </span>
                    <span className="text-[#71717a] ml-1">(Esc to cancel)</span>
                  </div>
                )}
              </div>

              {/* Bottom X-Axis Strip (Date and Time Bar) */}
              <div className="h-7 border-t border-[#2d2d30] bg-[#111113] relative select-none overflow-hidden shrink-0">
                {/* Auto-scaled Date & Time Tick Labels */}
                {timeTicks.map((tick) => (
                  <div
                    key={`x-tick-${tick.index}`}
                    className="absolute -translate-x-1/2 text-[#71717a] font-mono text-[10px] whitespace-nowrap top-1.5"
                    style={{
                      left: `max(28px, min(calc(100% - 28px), ${getXPct(tick.index)}%))`,
                    }}
                  >
                    {tick.label}
                  </div>
                ))}

                {/* Hovered Candle Date & Time Tag Badge */}
                {hoveredIndex !== null && visibleCandles[hoveredIndex] && (
                  <div
                    className="absolute -translate-x-1/2 bg-blue-600 text-white font-mono text-[10px] font-bold px-2 py-0.5 rounded shadow-md z-10 whitespace-nowrap border border-blue-400 top-1"
                    style={{
                      left: `max(32px, min(calc(100% - 32px), ${getXPct(hoveredIndex)}%))`,
                    }}
                  >
                    {activeTimeframe === '1D'
                      ? visibleCandles[hoveredIndex].dateStr
                      : `${visibleCandles[hoveredIndex].dateStr?.slice(5) || ''} ${visibleCandles[hoveredIndex].timeStr || ''}`}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Dedicated Y-Axis Strip (Price Bar) */}
            <div className="w-16 sm:w-20 bg-[#111113] border-l border-[#2d2d30] flex flex-col shrink-0 select-none">
              {/* Top Y-axis scale matching chart SVG height */}
              <div className="relative flex-1 overflow-hidden">
                {/* Auto-scaled Price Tick Labels */}
                {priceTicks.map((tickPrice, idx) => (
                  <div
                    key={`y-tick-${idx}`}
                    className="absolute right-2 -translate-y-1/2 text-[#71717a] font-mono text-[10px] whitespace-nowrap"
                    style={{ top: `${getYPct(tickPrice)}%` }}
                  >
                    {formatPriceBySymbol(tickPrice, profile.symbol)}
                  </div>
                ))}

                {/* Active (Current Candle Close) Price Badge */}
                <div
                  className="absolute left-0 right-0 bg-blue-600 text-white font-mono text-[10px] font-bold px-1.5 py-0.5 -translate-y-1/2 shadow-md border-y border-blue-400 z-10 text-right truncate"
                  style={{ top: `${getYPct(activeCandle.close)}%` }}
                  title={`Current Close: ${formatPriceBySymbol(activeCandle.close, profile.symbol)}`}
                >
                  {formatPriceBySymbol(activeCandle.close, profile.symbol)}
                </div>

                {/* Hovered Price Tag Badge */}
                {hoveredPrice !== null && (
                  <div
                    className="absolute left-0 right-0 bg-amber-500 text-[#0c0c0e] font-mono text-[10px] font-bold px-1.5 py-0.5 -translate-y-1/2 shadow-md z-20 text-right truncate"
                    style={{ top: `${getYPct(hoveredPrice)}%` }}
                  >
                    {formatPriceBySymbol(hoveredPrice, profile.symbol)}
                  </div>
                )}
              </div>

              {/* Bottom-right corner timestamp zone indicator */}
              <div className="h-7 border-t border-[#2d2d30] bg-[#0c0c0e] flex items-center justify-center text-[9px] text-[#52525b] font-mono shrink-0">
                UTC
              </div>
            </div>
          </div>
        </div>

        {/* Right Side Attached TPO Profile Inspector */}
        <div className="lg:col-span-4 space-y-4">
          <TpoHistogram
            profile={profile}
            title={`${activeTimeframe} Attached TPO Profile`}
            isDeveloping={profile.isDeveloping}
            maxHeightPx={520}
          />
        </div>
      </div>
    </div>
  );
};

