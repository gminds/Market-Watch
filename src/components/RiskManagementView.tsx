import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Upload,
  Trash2,
  TrendingUp,
  TrendingDown,
  Award,
  AlertTriangle,
  FileSpreadsheet,
  Zap,
  Activity,
  Calculator,
  Calendar,
  CheckCircle2,
  PieChart,
  RefreshCw,
  Plus,
  Info,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Percent,
  X,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
  Cell,
} from 'recharts';
import {
  AccountMetrics,
  MTAccount,
  MTTrade,
  RollingMetrics,
  RollingWindowSize,
  StrategyHealth,
  TradePerformanceSummary,
} from '../types/risk';
import { riskManagementService } from '../services/riskManagementService';
import { statementParser } from '../services/statementParser';
import { SymbolCode } from '../types/market';
import { getSymbolConfig } from '../config/symbols';
import { ImportSummaryModal } from './ImportSummaryModal';

export const RiskManagementView: React.FC = () => {
  const [accounts, setAccounts] = useState<MTAccount[]>(() => riskManagementService.getAccounts());
  const [activeAccount, setActiveAccount] = useState<MTAccount | null>(() =>
    riskManagementService.getActiveAccount()
  );

  // Rolling window selection
  const [rollingWindowSize, setRollingWindowSize] = useState<RollingWindowSize>(30);

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [showImportSummaryModal, setShowImportSummaryModal] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [uploadFeedback, setUploadFeedback] = useState<string | null>(null);

  // Summary Table Period
  const [summaryPeriod, setSummaryPeriod] = useState<'daily' | 'weekly' | 'monthly'>('monthly');

  // Position Calculator State
  const [calcRiskPct, setCalcRiskPct] = useState<number>(1.0);
  const [calcStopLossPips, setCalcStopLossPips] = useState<number>(25);
  const [calcSymbol, setCalcSymbol] = useState<SymbolCode>('GBPUSD');

  // Delete modal state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);

  // Refresh local state whenever active account changes
  const refreshAccountsState = () => {
    const accs = riskManagementService.getAccounts();
    const active = riskManagementService.getActiveAccount();
    setAccounts(accs);
    setActiveAccount(active);
  };

  useEffect(() => {
    refreshAccountsState();
  }, []);

  const handleSelectAccount = (accNum: string) => {
    riskManagementService.setActiveAccount(accNum);
    refreshAccountsState();
  };

  const handleDeleteAccount = () => {
    if (!activeAccount) return;
    riskManagementService.deleteAccount(activeAccount.accountNumber);
    setShowDeleteConfirm(false);
    refreshAccountsState();
  };

  const handleFileUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const reader = new FileReader();

    const isBinary = /\.(xlsx|xls)$/i.test(file.name);

    reader.onload = (e) => {
      const content = e.target?.result;
      if (!content) return;

      try {
        const parsed = statementParser.parseStatement(content, file.name);
        const { mergedAccount, newTradesAdded } = riskManagementService.saveOrMergeAccountStatement(parsed);
        refreshAccountsState();

        setUploadFeedback(
          `Success! Account #${mergedAccount.accountNumber} updated. ${newTradesAdded} new trade(s) merged seamlessly.`
        );
        setTimeout(() => setUploadFeedback(null), 5000);
        setShowUploadModal(false);
        if (mergedAccount.importSummary) {
          setShowImportSummaryModal(true);
        }
      } catch (err) {
        setUploadFeedback(`Failed to parse statement: ${err instanceof Error ? err.message : 'Invalid file format'}`);
      }
    };

    if (isBinary) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
  };

  const handleLoadSample = () => {
    const sample = riskManagementService.seedSampleAccount();
    refreshAccountsState();
    setUploadFeedback(`Loaded sample MetaTrader statement for Account #${sample.accountNumber}`);
    setTimeout(() => setUploadFeedback(null), 4000);
  };

  if (!activeAccount) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center font-mono">
        <div className="bg-[#121215] border border-[#2d2d30] rounded-2xl p-8 max-w-xl mx-auto shadow-2xl">
          <ShieldAlert className="w-12 h-12 text-amber-400 mx-auto mb-4 animate-bounce" />
          <h2 className="text-xl font-bold text-white mb-2">No MetaTrader Accounts Loaded</h2>
          <p className="text-sm text-[#a1a1aa] mb-6">
            Upload an MT4/MT5 HTML, Open XML, or CSV account statement to compute institutional risk metrics, rolling performance trends, and strategy health indicators.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => setShowUploadModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-xs flex items-center gap-2 shadow"
            >
              <Upload className="w-4 h-4" />
              <span>Upload MT Statement</span>
            </button>
            <button
              onClick={handleLoadSample}
              className="px-4 py-2 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-600/40 rounded-lg font-bold text-xs flex items-center gap-2"
            >
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Load Sample Statement</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Calculate Metrics
  const trades = activeAccount.trades || [];
  const metrics: AccountMetrics = riskManagementService.calculateAccountMetrics(
    trades,
    activeAccount.initialDeposit
  );
  const rollingMetrics: RollingMetrics = riskManagementService.calculateRollingMetrics(
    trades,
    rollingWindowSize
  );
  const health: StrategyHealth = riskManagementService.evaluateStrategyHealth(metrics, rollingMetrics);
  const summaries: TradePerformanceSummary[] = riskManagementService.getTradeSummariesByPeriod(
    trades,
    summaryPeriod
  );

  // Equity Curve Data
  const equityCurveData = [
    {
      tradeIndex: 0,
      ticket: 'Initial',
      date: trades[0]?.openTime ? trades[0].openTime.substring(0, 10) : 'Start',
      balance: activeAccount.initialDeposit,
      equity: activeAccount.initialDeposit,
      profit: 0,
      symbol: 'BASE',
    },
    ...trades.map((t, idx) => ({
      tradeIndex: idx + 1,
      ticket: t.ticket,
      date: t.closeTime.substring(0, 10),
      balance: t.balanceAfter,
      equity: t.equityAfter,
      profit: t.netProfit,
      symbol: t.symbol,
    })),
  ];

  // Drawdown Curve Data
  let peak = activeAccount.initialDeposit;
  const drawdownData = trades.map((t, idx) => {
    if (t.balanceAfter > peak) peak = t.balanceAfter;
    const ddAmount = peak - t.balanceAfter;
    const ddPct = peak > 0 ? (ddAmount / peak) * 100 : 0;
    return {
      tradeIndex: idx + 1,
      date: t.closeTime.substring(0, 10),
      drawdownPct: parseFloat(ddPct.toFixed(1)),
      drawdownAmount: parseFloat(ddAmount.toFixed(2)),
    };
  });

  // Rolling Metrics Trend Data across trade sequence
  const rollingTrendData = trades.map((_, idx) => {
    const subTrades = trades.slice(0, idx + 1);
    const subRolling = riskManagementService.calculateRollingMetrics(
      subTrades,
      rollingWindowSize
    );
    return {
      tradeIndex: idx + 1,
      rollingPF: subRolling.rollingProfitFactor,
      rollingWR: subRolling.rollingWinRate,
      rollingExpR: subRolling.rollingExpectancyR,
    };
  });

  // Monthly Performance Data
  const monthlySummaries = riskManagementService.getTradeSummariesByPeriod(trades, 'monthly').reverse();

  // R-Multiple Distribution Histogram Data
  const rMultipleBuckets = [
    { label: '< -1R', count: 0, color: '#ef4444' },
    { label: '-1R to 0R', count: 0, color: '#f97316' },
    { label: '0R to +1R', count: 0, color: '#eab308' },
    { label: '+1R to +2R', count: 0, color: '#22c55e' },
    { label: '+2R+', count: 0, color: '#10b981' },
  ];

  trades.forEach((t) => {
    const r = t.rMultiple || 0;
    if (r < -1) rMultipleBuckets[0].count++;
    else if (r < 0) rMultipleBuckets[1].count++;
    else if (r <= 1) rMultipleBuckets[2].count++;
    else if (r <= 2) rMultipleBuckets[3].count++;
    else rMultipleBuckets[4].count++;
  });

  // Position Calculator Math
  const activeBal = metrics.balance > 0 ? metrics.balance : activeAccount.initialDeposit;
  const cashRisk = (activeBal * calcRiskPct) / 100;
  const symConfig = getSymbolConfig(calcSymbol);
  const pipValUnit = symConfig.pipValue; // e.g., 0.0001
  const costPerPipForOneLot = calcSymbol.includes('JPY')
    ? 6.5
    : calcSymbol.includes('XAU')
    ? 10.0
    : calcSymbol.includes('BTC')
    ? 1.0
    : 10.0; // standard lot pip value in USD

  const calculatedLotSize =
    calcStopLossPips > 0 ? parseFloat((cashRisk / (calcStopLossPips * costPerPipForOneLot)).toFixed(2)) : 0;
  const maxDailyLossCap = parseFloat((activeBal * 0.03).toFixed(2)); // 3% daily risk limit recommendation

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6 font-mono text-[#e0e0e0]">
      {/* Feedback Toast */}
      {uploadFeedback && (
        <div className="bg-blue-950/90 border border-blue-800 text-blue-300 p-3.5 rounded-xl shadow-2xl flex items-center justify-between text-xs animate-in fade-in duration-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{uploadFeedback}</span>
          </div>
          <button onClick={() => setUploadFeedback(null)} className="text-blue-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Header & Account Switcher Bar */}
      <div className="bg-[#121215] border border-[#2d2d30] rounded-2xl p-4 sm:p-5 shadow-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-950/80 border border-blue-800 rounded-xl text-blue-400">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 font-bold text-white text-base">
              <span>Risk Management Dashboard</span>
              <span className="px-2 py-0.5 rounded text-[10px] bg-blue-950 text-blue-300 border border-blue-800 uppercase">
                MetaTrader Engine
              </span>
            </div>
            <div className="text-xs text-[#a1a1aa] mt-0.5">
              Live statement auditing, rolling strategy health analysis, and account performance metrics.
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Account Switcher Dropdown */}
          <div className="flex items-center bg-[#18181b] border border-[#2d2d30] rounded-xl px-3 py-1.5">
            <FileSpreadsheet className="w-4 h-4 text-blue-400 mr-2" />
            <select
              value={activeAccount.accountNumber}
              onChange={(e) => handleSelectAccount(e.target.value)}
              className="bg-transparent text-white font-bold text-xs focus:outline-none cursor-pointer pr-2"
            >
              {accounts.map((acc) => (
                <option key={acc.accountNumber} value={acc.accountNumber} className="bg-[#18181b] text-white">
                  Account #{acc.accountNumber} ({acc.broker})
                </option>
              ))}
            </select>
          </div>

          {activeAccount?.importSummary && (
            <button
              onClick={() => setShowImportSummaryModal(true)}
              className="px-3 py-2 bg-emerald-950/80 hover:bg-emerald-900/90 text-emerald-300 border border-emerald-800/80 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
              title="View Statement Import Summary"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Import Summary</span>
            </button>
          )}

          <button
            onClick={() => setShowUploadModal(true)}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow transition-all"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Statement</span>
          </button>

          <button
            onClick={handleLoadSample}
            className="px-3 py-2 bg-[#18181b] hover:bg-[#202024] text-amber-300 border border-amber-800/60 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
            title="Load or refresh sample statement"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Sample MT4</span>
          </button>

          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-2 bg-[#18181b] hover:bg-red-950/80 text-red-400 hover:text-red-300 border border-[#2d2d30] hover:border-red-800 rounded-xl transition-all"
            title="Delete Account & Data"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Strategy Health Traffic Light Banner */}
      <div
        className={`border rounded-2xl p-5 shadow-2xl relative overflow-hidden transition-all ${
          health.status === 'HEALTHY'
            ? 'bg-emerald-950/20 border-emerald-800/80'
            : health.status === 'WATCH'
            ? 'bg-amber-950/20 border-amber-800/80'
            : 'bg-red-950/20 border-red-800/80'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            {/* Status Traffic Light Badge */}
            <div
              className={`p-4 rounded-2xl border flex items-center justify-center shrink-0 ${
                health.status === 'HEALTHY'
                  ? 'bg-emerald-950 text-emerald-400 border-emerald-700 shadow-emerald-900/50'
                  : health.status === 'WATCH'
                  ? 'bg-amber-950 text-amber-400 border-amber-700 shadow-amber-900/50'
                  : 'bg-red-950 text-red-400 border-red-700 shadow-red-900/50'
              }`}
            >
              {health.status === 'HEALTHY' ? (
                <CheckCircle2 className="w-8 h-8 animate-pulse" />
              ) : (
                <AlertTriangle className="w-8 h-8 animate-bounce" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-3">
                <span className="text-xs uppercase font-extrabold tracking-widest text-[#a1a1aa]">
                  Strategy Health Rating
                </span>
                <span
                  className={`px-3 py-0.5 rounded-full text-xs font-extrabold tracking-wider uppercase border ${
                    health.status === 'HEALTHY'
                      ? 'bg-emerald-900/80 text-emerald-300 border-emerald-600'
                      : health.status === 'WATCH'
                      ? 'bg-amber-900/80 text-amber-300 border-amber-600'
                      : 'bg-red-900/80 text-red-300 border-red-600'
                  }`}
                >
                  {health.status === 'HEALTHY' ? '🟢 Healthy' : health.status === 'WATCH' ? '🟡 Watch' : '🔴 Pause'}
                </span>
                <span className="text-xs text-[#71717a]">Score: {health.score}/100</span>
              </div>

              <div className="text-sm font-bold text-white mt-1">{health.recommendation}</div>

              <div className="mt-2 text-xs text-[#a1a1aa] space-y-1">
                {health.reasons.map((r, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
                    <span>{r}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Rolling Health Gauges */}
          <div className="flex items-center gap-3 bg-[#111113]/80 border border-[#2d2d30] p-3 rounded-xl shrink-0 text-xs">
            <div className="text-center px-2">
              <div className="text-[10px] text-[#71717a] uppercase font-bold">Rolling PF ({rollingWindowSize})</div>
              <div
                className={`text-sm font-black ${
                  rollingMetrics.rollingProfitFactor >= 1.35
                    ? 'text-emerald-400'
                    : rollingMetrics.rollingProfitFactor >= 1.0
                    ? 'text-amber-400'
                    : 'text-red-400'
                }`}
              >
                {rollingMetrics.rollingProfitFactor}
              </div>
            </div>
            <div className="h-8 w-px bg-[#2d2d30]" />
            <div className="text-center px-2">
              <div className="text-[10px] text-[#71717a] uppercase font-bold">Rolling Exp (R)</div>
              <div
                className={`text-sm font-black ${
                  rollingMetrics.rollingExpectancyR > 0 ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {rollingMetrics.rollingExpectancyR > 0 ? '+' : ''}
                {rollingMetrics.rollingExpectancyR} R
              </div>
            </div>
            <div className="h-8 w-px bg-[#2d2d30]" />
            <div className="text-center px-2">
              <div className="text-[10px] text-[#71717a] uppercase font-bold">Rolling Max DD</div>
              <div
                className={`text-sm font-black ${
                  rollingMetrics.rollingMaxDrawdownPct < 8
                    ? 'text-emerald-400'
                    : rollingMetrics.rollingMaxDrawdownPct < 15
                    ? 'text-amber-400'
                    : 'text-red-400'
                }`}
              >
                -{rollingMetrics.rollingMaxDrawdownPct}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Account Balance & Primary Metrics Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Balance & Equity */}
        <div className="bg-[#121215] border border-[#2d2d30] rounded-2xl p-4 space-y-1 shadow-xl">
          <div className="text-[10px] text-[#71717a] font-bold uppercase tracking-wider flex items-center justify-between">
            <span>Balance</span>
            <DollarSign className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="text-lg font-black text-white">${metrics.balance.toLocaleString()}</div>
          <div className="text-[10px] text-[#a1a1aa]">Deposit: ${metrics.initialDeposit.toLocaleString()}</div>
        </div>

        {/* Net Profit */}
        <div className="bg-[#121215] border border-[#2d2d30] rounded-2xl p-4 space-y-1 shadow-xl">
          <div className="text-[10px] text-[#71717a] font-bold uppercase tracking-wider flex items-center justify-between">
            <span>Net Profit</span>
            {metrics.netProfit >= 0 ? (
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-red-400" />
            )}
          </div>
          <div className={`text-lg font-black ${metrics.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {metrics.netProfit >= 0 ? '+' : ''}${metrics.netProfit.toLocaleString()}
          </div>
          <div className="text-[10px] text-[#a1a1aa]">
            Profit: +${metrics.grossProfit} | Loss: -${metrics.grossLoss}
          </div>
        </div>

        {/* Win Rate (Strike Rate) */}
        <div className="bg-[#121215] border border-[#2d2d30] rounded-2xl p-4 space-y-1 shadow-xl">
          <div className="text-[10px] text-[#71717a] font-bold uppercase tracking-wider flex items-center justify-between">
            <span>Win Rate</span>
            <Award className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-lg font-black text-amber-300">{metrics.winRate}%</div>
          <div className="text-[10px] text-[#a1a1aa]">
            {metrics.winningTrades} W / {metrics.losingTrades} L ({metrics.totalTrades} Total)
          </div>
        </div>

        {/* Profit Factor */}
        <div className="bg-[#121215] border border-[#2d2d30] rounded-2xl p-4 space-y-1 shadow-xl">
          <div className="text-[10px] text-[#71717a] font-bold uppercase tracking-wider flex items-center justify-between">
            <span>Profit Factor</span>
            <Activity className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className={`text-lg font-black ${metrics.profitFactor >= 1.5 ? 'text-emerald-400' : 'text-amber-400'}`}>
            {metrics.profitFactor}
          </div>
          <div className="text-[10px] text-[#a1a1aa]">Payoff Ratio: {metrics.payoffRatio}x</div>
        </div>

        {/* Expectancy */}
        <div className="bg-[#121215] border border-[#2d2d30] rounded-2xl p-4 space-y-1 shadow-xl">
          <div className="text-[10px] text-[#71717a] font-bold uppercase tracking-wider flex items-center justify-between">
            <span>Expectancy</span>
            <Zap className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className={`text-lg font-black ${metrics.expectancy >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            ${metrics.expectancy}/trade
          </div>
          <div className="text-[10px] text-[#a1a1aa]">Avg R: {metrics.expectancyR > 0 ? '+' : ''}{metrics.expectancyR} R</div>
        </div>

        {/* Max Drawdown */}
        <div className="bg-[#121215] border border-[#2d2d30] rounded-2xl p-4 space-y-1 shadow-xl">
          <div className="text-[10px] text-[#71717a] font-bold uppercase tracking-wider flex items-center justify-between">
            <span>Max Drawdown</span>
            <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
          </div>
          <div className="text-lg font-black text-red-400">-{metrics.maxDrawdownPct}%</div>
          <div className="text-[10px] text-[#a1a1aa]">-${metrics.maxDrawdownAmount.toLocaleString()}</div>
        </div>
      </div>

      {/* Secondary Metrics Summary Bar */}
      <div className="bg-[#121215] border border-[#2d2d30] rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 text-xs">
        <div>
          <div className="text-[10px] text-[#71717a] uppercase font-bold">Sharpe Ratio</div>
          <div className="font-bold text-white mt-0.5">{metrics.sharpeRatio}</div>
        </div>
        <div>
          <div className="text-[10px] text-[#71717a] uppercase font-bold">Recovery Factor</div>
          <div className="font-bold text-white mt-0.5">{metrics.recoveryFactor}</div>
        </div>
        <div>
          <div className="text-[10px] text-[#71717a] uppercase font-bold">Average Win</div>
          <div className="font-bold text-emerald-400 mt-0.5">+${metrics.avgWin}</div>
        </div>
        <div>
          <div className="text-[10px] text-[#71717a] uppercase font-bold">Average Loss</div>
          <div className="font-bold text-red-400 mt-0.5">-${metrics.avgLoss}</div>
        </div>
        <div>
          <div className="text-[10px] text-[#71717a] uppercase font-bold">Largest Win</div>
          <div className="font-bold text-emerald-400 mt-0.5">+${metrics.largestWin}</div>
        </div>
        <div>
          <div className="text-[10px] text-[#71717a] uppercase font-bold">Largest Loss</div>
          <div className="font-bold text-red-400 mt-0.5">${metrics.largestLoss}</div>
        </div>
        <div>
          <div className="text-[10px] text-[#71717a] uppercase font-bold">Max Streak Wins</div>
          <div className="font-bold text-emerald-400 mt-0.5">{metrics.maxConsecutiveWins} trades</div>
        </div>
        <div>
          <div className="text-[10px] text-[#71717a] uppercase font-bold">Max Streak Losses</div>
          <div className="font-bold text-red-400 mt-0.5">{metrics.maxConsecutiveLosses} trades</div>
        </div>
      </div>

      {/* Rolling Window Configurator & Analysis Card */}
      <div className="bg-[#121215] border border-[#2d2d30] rounded-2xl p-5 space-y-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-blue-400" />
            <h3 className="font-bold text-white text-sm">Rolling Window Audit</h3>
            <span className="text-xs text-[#a1a1aa]">
              (Analyzes consistency across last N trades)
            </span>
          </div>

          <div className="flex items-center bg-[#18181b] border border-[#2d2d30] rounded-xl p-1">
            {([20, 30, 50, 100] as const).map((sz) => (
              <button
                key={sz}
                onClick={() => setRollingWindowSize(sz)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  rollingWindowSize === sz
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-[#71717a] hover:text-white'
                }`}
              >
                Last {sz} Trades
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          <div className="bg-[#18181b] border border-[#2d2d30] p-3.5 rounded-xl space-y-1">
            <div className="text-[10px] text-[#71717a] uppercase font-bold">Rolling Win Rate</div>
            <div className="text-base font-black text-amber-300">{rollingMetrics.rollingWinRate}%</div>
            <div className="text-[10px] text-[#71717a]">Overall: {metrics.winRate}%</div>
          </div>

          <div className="bg-[#18181b] border border-[#2d2d30] p-3.5 rounded-xl space-y-1">
            <div className="text-[10px] text-[#71717a] uppercase font-bold">Rolling Profit Factor</div>
            <div className="text-base font-black text-emerald-400">{rollingMetrics.rollingProfitFactor}</div>
            <div className="text-[10px] text-[#71717a]">Overall: {metrics.profitFactor}</div>
          </div>

          <div className="bg-[#18181b] border border-[#2d2d30] p-3.5 rounded-xl space-y-1">
            <div className="text-[10px] text-[#71717a] uppercase font-bold">Rolling Expectancy ($)</div>
            <div className="text-base font-black text-white">${rollingMetrics.rollingExpectancy}/trade</div>
            <div className="text-[10px] text-[#71717a]">Overall: ${metrics.expectancy}</div>
          </div>

          <div className="bg-[#18181b] border border-[#2d2d30] p-3.5 rounded-xl space-y-1">
            <div className="text-[10px] text-[#71717a] uppercase font-bold">Rolling Expectancy (R)</div>
            <div className="text-base font-black text-emerald-400">
              {rollingMetrics.rollingExpectancyR > 0 ? '+' : ''}
              {rollingMetrics.rollingExpectancyR} R
            </div>
            <div className="text-[10px] text-[#71717a]">Overall: {metrics.expectancyR} R</div>
          </div>

          <div className="bg-[#18181b] border border-[#2d2d30] p-3.5 rounded-xl space-y-1">
            <div className="text-[10px] text-[#71717a] uppercase font-bold">Rolling Max Drawdown</div>
            <div className="text-base font-black text-red-400">-{rollingMetrics.rollingMaxDrawdownPct}%</div>
            <div className="text-[10px] text-[#71717a]">Overall: -{metrics.maxDrawdownPct}%</div>
          </div>

          <div className="bg-[#18181b] border border-[#2d2d30] p-3.5 rounded-xl space-y-1">
            <div className="text-[10px] text-[#71717a] uppercase font-bold">Rolling Consecutive Loss</div>
            <div className="text-base font-black text-red-400">
              {rollingMetrics.rollingMaxConsecutiveLosses} losses
            </div>
            <div className="text-[10px] text-[#71717a]">Overall: {metrics.maxConsecutiveLosses}</div>
          </div>
        </div>
      </div>

      {/* Main Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Equity & Balance Curve */}
        <div className="bg-[#121215] border border-[#2d2d30] rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <h3 className="font-bold text-white text-sm">Equity & Balance Progression</h3>
            </div>
            <span className="text-xs text-[#a1a1aa] font-mono">{trades.length} Closed Trades</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={equityCurveData}>
                <defs>
                  <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#25252a" />
                <XAxis dataKey="tradeIndex" stroke="#71717a" tick={{ fontSize: 10 }} />
                <YAxis stroke="#71717a" tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', fontSize: '11px' }}
                  formatter={(value: any) => [`$${Number(value).toLocaleString()}`, 'Balance']}
                />
                <Area type="monotone" dataKey="balance" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorBalance)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Drawdown Depth Chart */}
        <div className="bg-[#121215] border border-[#2d2d30] rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <h3 className="font-bold text-white text-sm">Drawdown Depth (%)</h3>
            </div>
            <span className="text-xs text-red-400 font-bold">Max: -{metrics.maxDrawdownPct}%</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={drawdownData}>
                <defs>
                  <linearGradient id="colorDD" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#25252a" />
                <XAxis dataKey="tradeIndex" stroke="#71717a" tick={{ fontSize: 10 }} />
                <YAxis stroke="#71717a" tick={{ fontSize: 10 }} domain={[0, 'auto']} reversed />
                <Tooltip
                  contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', fontSize: '11px' }}
                  formatter={(value: any) => [`-${value}%`, 'Drawdown']}
                />
                <Area type="monotone" dataKey="drawdownPct" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorDD)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Rolling Profit Factor & Expectancy Trend */}
        <div className="bg-[#121215] border border-[#2d2d30] rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-400" />
              <h3 className="font-bold text-white text-sm">Rolling Profit Factor & Expectancy Trend</h3>
            </div>
            <span className="text-xs text-[#a1a1aa]">Window: {rollingWindowSize} Trades</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rollingTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#25252a" />
                <XAxis dataKey="tradeIndex" stroke="#71717a" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="left" stroke="#10b981" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="right" orientation="right" stroke="#3b82f6" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', fontSize: '11px' }} />
                <ReferenceLine yAxisId="left" y={1.0} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'Breakeven PF', fill: '#ef4444', fontSize: 10 }} />
                <Line yAxisId="left" type="monotone" dataKey="rollingPF" name="Rolling PF" stroke="#10b981" strokeWidth={2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="rollingExpR" name="Rolling Exp (R)" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Monthly Net Profit Bar Chart */}
        <div className="bg-[#121215] border border-[#2d2d30] rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-400" />
              <h3 className="font-bold text-white text-sm">Monthly Returns ($)</h3>
            </div>
            <span className="text-xs text-[#a1a1aa]">{monthlySummaries.length} Months</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlySummaries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#25252a" />
                <XAxis dataKey="period" stroke="#71717a" tick={{ fontSize: 10 }} />
                <YAxis stroke="#71717a" tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', fontSize: '11px' }}
                  formatter={(value: any) => [`$${Number(value).toLocaleString()}`, 'Net P&L']}
                />
                <Bar dataKey="netProfit">
                  {monthlySummaries.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.netProfit >= 0 ? '#10b981' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Position Size & Risk Calculator Widget */}
      <div className="bg-[#121215] border border-[#2d2d30] rounded-2xl p-5 space-y-4 shadow-xl">
        <div className="flex items-center gap-2 border-b border-[#2d2d30] pb-3">
          <Calculator className="w-5 h-5 text-blue-400" />
          <h3 className="font-bold text-white text-base">Position Size & Risk Calculator</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          {/* Risk % */}
          <div className="space-y-1">
            <label className="text-[10px] text-[#71717a] font-bold uppercase">Risk Per Trade (%)</label>
            <div className="flex items-center bg-[#18181b] border border-[#2d2d30] rounded-xl px-3 py-2">
              <Percent className="w-3.5 h-3.5 text-blue-400 mr-2" />
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="10"
                value={calcRiskPct}
                onChange={(e) => setCalcRiskPct(parseFloat(e.target.value) || 0.5)}
                className="bg-transparent text-white font-bold w-full focus:outline-none"
              />
            </div>
          </div>

          {/* Stop Loss Pips */}
          <div className="space-y-1">
            <label className="text-[10px] text-[#71717a] font-bold uppercase">Stop Loss (Pips)</label>
            <div className="flex items-center bg-[#18181b] border border-[#2d2d30] rounded-xl px-3 py-2">
              <input
                type="number"
                value={calcStopLossPips}
                onChange={(e) => setCalcStopLossPips(parseInt(e.target.value) || 15)}
                className="bg-transparent text-white font-bold w-full focus:outline-none"
              />
            </div>
          </div>

          {/* Pair Symbol */}
          <div className="space-y-1">
            <label className="text-[10px] text-[#71717a] font-bold uppercase">Instrument / Symbol</label>
            <select
              value={calcSymbol}
              onChange={(e) => setCalcSymbol(e.target.value as SymbolCode)}
              className="bg-[#18181b] text-white border border-[#2d2d30] rounded-xl px-3 py-2 font-bold w-full focus:outline-none"
            >
              <option value="GBPUSD">GBP/USD</option>
              <option value="EURUSD">EUR/USD</option>
              <option value="USDJPY">USD/JPY</option>
              <option value="AUDUSD">AUD/USD</option>
              <option value="XAUUSD">XAU/USD (Gold)</option>
              <option value="BTCUSD">BTC/USD (Bitcoin)</option>
            </select>
          </div>

          {/* Result Lot Size */}
          <div className="bg-blue-950/40 border border-blue-800/80 p-3 rounded-xl flex flex-col justify-between">
            <div className="text-[10px] text-blue-300 font-bold uppercase">Recommended Size</div>
            <div className="text-xl font-black text-white">{calculatedLotSize} Lots</div>
            <div className="text-[10px] text-blue-400">
              Risk: ${cashRisk.toLocaleString()} ({calcRiskPct}% of ${activeBal.toLocaleString()})
            </div>
          </div>
        </div>
      </div>

      {/* Period Performance Summaries Table */}
      <div className="bg-[#121215] border border-[#2d2d30] rounded-2xl p-5 space-y-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-amber-400" />
            <h3 className="font-bold text-white text-sm">Performance Summaries</h3>
          </div>

          <div className="flex items-center bg-[#18181b] border border-[#2d2d30] rounded-xl p-1">
            {(['daily', 'weekly', 'monthly'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setSummaryPeriod(p)}
                className={`px-3 py-1 rounded-lg text-xs font-bold uppercase transition-all ${
                  summaryPeriod === p ? 'bg-blue-600 text-white shadow' : 'text-[#71717a] hover:text-white'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#2d2d30] text-[#71717a] uppercase font-bold text-[10px]">
                <th className="p-3">Period</th>
                <th className="p-3">Trades</th>
                <th className="p-3">W / L</th>
                <th className="p-3">Win Rate</th>
                <th className="p-3">Net P&L ($)</th>
                <th className="p-3">Profit Factor</th>
                <th className="p-3">Volume (Lots)</th>
                <th className="p-3">Max DD (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1f1f23]">
              {summaries.map((s) => (
                <tr key={s.period} className="hover:bg-[#18181b] transition-colors">
                  <td className="p-3 font-bold text-white">{s.period}</td>
                  <td className="p-3">{s.tradesCount}</td>
                  <td className="p-3">
                    <span className="text-emerald-400 font-bold">{s.wins}W</span> /{' '}
                    <span className="text-red-400 font-bold">{s.losses}L</span>
                  </td>
                  <td className="p-3 font-bold text-amber-300">{s.winRate}%</td>
                  <td className={`p-3 font-black ${s.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {s.netProfit >= 0 ? '+' : ''}${s.netProfit.toLocaleString()}
                  </td>
                  <td className="p-3 font-bold">{s.profitFactor}</td>
                  <td className="p-3 text-[#a1a1aa]">{s.totalVolumeLots}</td>
                  <td className="p-3 text-red-400 font-bold">-{s.maxDrawdownPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MetaTrader Statement Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-mono">
          <div className="bg-[#121215] border border-[#2d2d30] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#2d2d30] pb-3">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-white text-base">Upload MetaTrader Statement</h3>
              </div>
              <button onClick={() => setShowUploadModal(false)} className="text-[#71717a] hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#a1a1aa]">
              Supports MT4 and MT5 "Save as Detailed Report" HTML files (`.htm`/`.html`), Excel reports (`.xlsx`/`.xls`), Open XML (`.xml`), or CSV history reports.
            </p>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                handleFileUpload(e.dataTransfer.files);
              }}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
                isDragging
                  ? 'border-blue-500 bg-blue-950/20'
                  : 'border-[#2d2d30] hover:border-blue-500/50 hover:bg-[#18181b]'
              }`}
            >
              <FileSpreadsheet className="w-10 h-10 text-blue-400 mx-auto mb-3 animate-pulse" />
              <div className="text-xs font-bold text-white mb-1">
                Drag and drop your MetaTrader statement here
              </div>
              <div className="text-[10px] text-[#71717a] mb-4">
                Accepts .xlsx, .xls, .html, .htm, .xml, or .csv files
              </div>

              <label className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-slate-950 font-black rounded-lg text-xs cursor-pointer inline-block shadow">
                <span>Browse Files</span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.html,.htm,.xml,.csv"
                  onChange={(e) => handleFileUpload(e.target.files)}
                  className="hidden"
                />
              </label>
            </div>

            <div className="bg-[#18181b] border border-[#2d2d30] p-3 rounded-xl text-[11px] text-[#a1a1aa] space-y-1">
              <div className="font-bold text-white">Seamless Account Merging Guarantee:</div>
              <div>• Existing account statements are automatically merged using trade ticket numbers.</div>
              <div>• Duplicate trades are discarded; only new closed trades are updated.</div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-mono">
          <div className="bg-[#121215] border border-red-900/60 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <Trash2 className="w-6 h-6" />
              <h3 className="font-bold text-white text-base">Delete Account & Statement Data?</h3>
            </div>
            <p className="text-xs text-[#a1a1aa]">
              Are you sure you want to delete <strong className="text-white">Account #{activeAccount.accountNumber}</strong> ({activeAccount.broker})? This will permanently remove all associated trade history and risk analytics.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 bg-[#18181b] text-white rounded-xl text-xs font-bold hover:bg-[#202024]"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold shadow"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Summary Modal */}
      {showImportSummaryModal && activeAccount?.importSummary && (
        <ImportSummaryModal
          summary={activeAccount.importSummary}
          accountNumber={activeAccount.accountNumber}
          accountName={activeAccount.accountName}
          fileName={activeAccount.statementFileName}
          onClose={() => setShowImportSummaryModal(false)}
        />
      )}
    </div>
  );
};
