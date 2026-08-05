import {
  AccountMetrics,
  MTAccount,
  MTTrade,
  RollingMetrics,
  RollingWindowSize,
  StrategyHealth,
  TradePerformanceSummary,
} from '../types/risk';
import { statementParser } from './statementParser';

const STORAGE_KEY_ACCOUNTS = 'mps_mt_accounts_v1';
const STORAGE_KEY_ACTIVE_ACC = 'mps_mt_active_acc_v1';

export class RiskManagementService {
  private accounts: Map<string, MTAccount> = new Map();
  private activeAccountNumber: string = '';

  constructor() {
    this.loadFromStorage();
    if (this.accounts.size === 0) {
      this.seedSampleAccount();
    }
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_ACCOUNTS);
      if (stored) {
        const parsedArray: MTAccount[] = JSON.parse(stored);
        parsedArray.forEach((acc) => {
          this.accounts.set(acc.accountNumber, acc);
        });
      }
      const activeAcc = localStorage.getItem(STORAGE_KEY_ACTIVE_ACC);
      if (activeAcc && this.accounts.has(activeAcc)) {
        this.activeAccountNumber = activeAcc;
      } else if (this.accounts.size > 0) {
        this.activeAccountNumber = Array.from(this.accounts.keys())[0];
      }
    } catch (e) {
      console.error('Failed to load risk management accounts from storage:', e);
    }
  }

  private saveToStorage() {
    try {
      const accList = Array.from(this.accounts.values());
      localStorage.setItem(STORAGE_KEY_ACCOUNTS, JSON.stringify(accList));
      localStorage.setItem(STORAGE_KEY_ACTIVE_ACC, this.activeAccountNumber);
    } catch (e) {
      console.error('Failed to save risk management accounts to storage:', e);
    }
  }

  public getAccounts(): MTAccount[] {
    return Array.from(this.accounts.values());
  }

  public getActiveAccount(): MTAccount | null {
    if (!this.activeAccountNumber && this.accounts.size > 0) {
      this.activeAccountNumber = Array.from(this.accounts.keys())[0];
    }
    return this.accounts.get(this.activeAccountNumber) || null;
  }

  public setActiveAccount(accountNumber: string) {
    if (this.accounts.has(accountNumber)) {
      this.activeAccountNumber = accountNumber;
      this.saveToStorage();
    }
  }

  public deleteAccount(accountNumber: string) {
    this.accounts.delete(accountNumber);
    if (this.activeAccountNumber === accountNumber) {
      const remaining = Array.from(this.accounts.keys());
      this.activeAccountNumber = remaining.length > 0 ? remaining[0] : '';
    }
    this.saveToStorage();
  }

  /**
   * Import or merge a MetaTrader statement into local storage.
   * Deduplicates trades based on ticket ID and close timestamp.
   */
  public saveOrMergeAccountStatement(parsedAccount: MTAccount): {
    mergedAccount: MTAccount;
    newTradesAdded: number;
  } {
    const existing = this.accounts.get(parsedAccount.accountNumber);

    if (!existing) {
      // New account
      this.recalculateAccountBalancesAndEquity(parsedAccount);
      this.accounts.set(parsedAccount.accountNumber, parsedAccount);
      this.activeAccountNumber = parsedAccount.accountNumber;
      this.saveToStorage();
      return { mergedAccount: parsedAccount, newTradesAdded: parsedAccount.trades.length };
    }

    // Merge new statement into existing account
    const existingTicketMap = new Map<string, MTTrade>();
    existing.trades.forEach((t) => existingTicketMap.set(`${t.ticket}_${t.closeTimestamp}`, t));

    let newTradesAdded = 0;
    parsedAccount.trades.forEach((newTrade) => {
      const key = `${newTrade.ticket}_${newTrade.closeTimestamp}`;
      if (!existingTicketMap.has(key)) {
        existingTicketMap.set(key, newTrade);
        newTradesAdded++;
      }
    });

    const combinedTrades = Array.from(existingTicketMap.values()).sort(
      (a, b) => a.closeTimestamp - b.closeTimestamp
    );

    const mergedAccount: MTAccount = {
      ...existing,
      accountName: parsedAccount.accountName || existing.accountName,
      broker: parsedAccount.broker || existing.broker,
      currency: parsedAccount.currency || existing.currency,
      leverage: parsedAccount.leverage || existing.leverage,
      initialDeposit: parsedAccount.initialDeposit || existing.initialDeposit,
      lastUpdated: Date.now(),
      statementFileName: parsedAccount.statementFileName || existing.statementFileName,
      importSummary: parsedAccount.importSummary || existing.importSummary,
      trades: combinedTrades,
    };

    this.recalculateAccountBalancesAndEquity(mergedAccount);
    this.accounts.set(mergedAccount.accountNumber, mergedAccount);
    this.activeAccountNumber = mergedAccount.accountNumber;
    this.saveToStorage();

    return { mergedAccount, newTradesAdded };
  }

  /**
   * Recalculates running balance & equity chronologically across all closed trades
   */
  private recalculateAccountBalancesAndEquity(account: MTAccount) {
    let runningBalance = account.initialDeposit;
    account.trades.forEach((trade) => {
      runningBalance += trade.netProfit;
      trade.balanceAfter = parseFloat(runningBalance.toFixed(2));
      trade.equityAfter = trade.balanceAfter;
    });
    account.currentBalance = parseFloat(runningBalance.toFixed(2));
    account.currentEquity = account.currentBalance;
  }

  /**
   * Computes comprehensive financial & risk metrics for a trade list
   */
  public calculateAccountMetrics(trades: MTTrade[], initialDeposit: number): AccountMetrics {
    if (trades.length === 0) {
      return {
        balance: initialDeposit,
        equity: initialDeposit,
        initialDeposit,
        netProfit: 0,
        grossProfit: 0,
        grossLoss: 0,
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        breakEvenTrades: 0,
        winRate: 0,
        profitFactor: 0,
        sharpeRatio: 0,
        recoveryFactor: 0,
        expectancy: 0,
        expectancyR: 0,
        avgWin: 0,
        avgLoss: 0,
        payoffRatio: 0,
        largestWin: 0,
        largestLoss: 0,
        maxConsecutiveWins: 0,
        maxConsecutiveLosses: 0,
        maxDrawdownAmount: 0,
        maxDrawdownPct: 0,
        avgRMultiple: 0,
      };
    }

    let grossProfit = 0;
    let grossLoss = 0;
    let winningTrades = 0;
    let losingTrades = 0;
    let breakEvenTrades = 0;
    let largestWin = 0;
    let largestLoss = 0;
    let sumR = 0;

    let currentConsecutiveWins = 0;
    let maxConsecutiveWins = 0;
    let currentConsecutiveLosses = 0;
    let maxConsecutiveLosses = 0;

    // Drawdown Calculation
    let peakBalance = initialDeposit;
    let maxDrawdownAmount = 0;
    let maxDrawdownPct = 0;
    let runningBalance = initialDeposit;

    const returnsPct: number[] = [];

    trades.forEach((t) => {
      const prevBal = runningBalance;
      runningBalance += t.netProfit;

      if (prevBal > 0) {
        returnsPct.push(t.netProfit / prevBal);
      }

      if (runningBalance > peakBalance) {
        peakBalance = runningBalance;
      }

      const ddAmount = peakBalance - runningBalance;
      const ddPct = peakBalance > 0 ? (ddAmount / peakBalance) * 100 : 0;

      if (ddAmount > maxDrawdownAmount) {
        maxDrawdownAmount = ddAmount;
      }
      if (ddPct > maxDrawdownPct) {
        maxDrawdownPct = ddPct;
      }

      sumR += t.rMultiple || 0;

      if (t.netProfit > 0) {
        winningTrades++;
        grossProfit += t.netProfit;
        if (t.netProfit > largestWin) largestWin = t.netProfit;

        currentConsecutiveWins++;
        currentConsecutiveLosses = 0;
        if (currentConsecutiveWins > maxConsecutiveWins) {
          maxConsecutiveWins = currentConsecutiveWins;
        }
      } else if (t.netProfit < 0) {
        losingTrades++;
        grossLoss += Math.abs(t.netProfit);
        if (t.netProfit < largestLoss) largestLoss = t.netProfit;

        currentConsecutiveLosses++;
        currentConsecutiveWins = 0;
        if (currentConsecutiveLosses > maxConsecutiveLosses) {
          maxConsecutiveLosses = currentConsecutiveLosses;
        }
      } else {
        breakEvenTrades++;
      }
    });

    const netProfit = grossProfit - grossLoss;
    const totalTrades = trades.length;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    const lossRate = totalTrades > 0 ? (losingTrades / totalTrades) * 100 : 0;

    const profitFactor = grossLoss > 0 ? parseFloat((grossProfit / grossLoss).toFixed(2)) : grossProfit > 0 ? 99.9 : 0;

    const avgWin = winningTrades > 0 ? grossProfit / winningTrades : 0;
    const avgLoss = losingTrades > 0 ? grossLoss / losingTrades : 0;
    const payoffRatio = avgLoss > 0 ? parseFloat((avgWin / avgLoss).toFixed(2)) : avgWin > 0 ? 99.9 : 0;

    // Expectancy = (Win % * Avg Win) - (Loss % * Avg Loss)
    const expectancy = (winRate / 100) * avgWin - (lossRate / 100) * avgLoss;
    const avgRMultiple = totalTrades > 0 ? sumR / totalTrades : 0;
    const expectancyR = avgRMultiple;

    const recoveryFactor = maxDrawdownAmount > 0 ? parseFloat((netProfit / maxDrawdownAmount).toFixed(2)) : netProfit > 0 ? 99.9 : 0;

    // Sharpe Ratio
    let sharpeRatio = 0;
    if (returnsPct.length > 1) {
      const avgReturn = returnsPct.reduce((a, b) => a + b, 0) / returnsPct.length;
      const variance = returnsPct.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (returnsPct.length - 1);
      const stdDev = Math.sqrt(variance);
      if (stdDev > 0) {
        // Annualized Sharpe assuming ~252 trading days
        sharpeRatio = parseFloat(((avgReturn / stdDev) * Math.sqrt(252)).toFixed(2));
      }
    }

    return {
      balance: parseFloat(runningBalance.toFixed(2)),
      equity: parseFloat(runningBalance.toFixed(2)),
      initialDeposit,
      netProfit: parseFloat(netProfit.toFixed(2)),
      grossProfit: parseFloat(grossProfit.toFixed(2)),
      grossLoss: parseFloat(grossLoss.toFixed(2)),
      totalTrades,
      winningTrades,
      losingTrades,
      breakEvenTrades,
      winRate: parseFloat(winRate.toFixed(1)),
      profitFactor,
      sharpeRatio,
      recoveryFactor,
      expectancy: parseFloat(expectancy.toFixed(2)),
      expectancyR: parseFloat(expectancyR.toFixed(2)),
      avgWin: parseFloat(avgWin.toFixed(2)),
      avgLoss: parseFloat(avgLoss.toFixed(2)),
      payoffRatio,
      largestWin: parseFloat(largestWin.toFixed(2)),
      largestLoss: parseFloat(largestLoss.toFixed(2)),
      maxConsecutiveWins,
      maxConsecutiveLosses,
      maxDrawdownAmount: parseFloat(maxDrawdownAmount.toFixed(2)),
      maxDrawdownPct: parseFloat(maxDrawdownPct.toFixed(1)),
      avgRMultiple: parseFloat(avgRMultiple.toFixed(2)),
    };
  }

  /**
   * Computes metrics over a rolling window of recent N trades
   */
  public calculateRollingMetrics(trades: MTTrade[], windowSize: RollingWindowSize): RollingMetrics {
    if (trades.length === 0) {
      return {
        windowSize,
        rollingWinRate: 0,
        rollingProfitFactor: 0,
        rollingExpectancy: 0,
        rollingExpectancyR: 0,
        rollingMaxDrawdownPct: 0,
        rollingMaxConsecutiveLosses: 0,
        rollingAvgR: 0,
      };
    }

    const windowTrades = trades.slice(-windowSize);
    const initialBal = windowTrades[0].balanceAfter - windowTrades[0].netProfit;
    const metrics = this.calculateAccountMetrics(windowTrades, initialBal > 0 ? initialBal : 10000);

    return {
      windowSize,
      rollingWinRate: metrics.winRate,
      rollingProfitFactor: metrics.profitFactor,
      rollingExpectancy: metrics.expectancy,
      rollingExpectancyR: metrics.expectancyR,
      rollingMaxDrawdownPct: metrics.maxDrawdownPct,
      rollingMaxConsecutiveLosses: metrics.maxConsecutiveLosses,
      rollingAvgR: metrics.avgRMultiple,
    };
  }

  /**
   * Evaluates Strategy Health Indicator (🟢 HEALTHY, 🟡 WATCH, 🔴 PAUSE)
   */
  public evaluateStrategyHealth(
    overallMetrics: AccountMetrics,
    rollingMetrics: RollingMetrics
  ): StrategyHealth {
    if (overallMetrics.totalTrades < 5) {
      return {
        status: 'HEALTHY',
        score: 85,
        reasons: ['Initial sample size (< 5 trades). Strategy performing within standard baseline.'],
        recommendation: 'Continue executing trades according to Market Profile plan with standard 1% risk per trade.',
      };
    }

    const reasons: string[] = [];
    let penalty = 0;

    // Check Rolling Profit Factor
    if (rollingMetrics.rollingProfitFactor < 1.0) {
      penalty += 35;
      reasons.push(`Rolling Profit Factor (${rollingMetrics.rollingProfitFactor}) is below 1.0 (unprofitable over last ${rollingMetrics.windowSize} trades).`);
    } else if (rollingMetrics.rollingProfitFactor < 1.3) {
      penalty += 15;
      reasons.push(`Rolling Profit Factor (${rollingMetrics.rollingProfitFactor}) is marginal (below 1.30 target).`);
    }

    // Check Rolling Expectancy
    if (rollingMetrics.rollingExpectancy <= 0) {
      penalty += 30;
      reasons.push(`Rolling Expectancy ($${rollingMetrics.rollingExpectancy}/trade) is negative.`);
    }

    // Check Rolling Drawdown
    if (rollingMetrics.rollingMaxDrawdownPct > 15) {
      penalty += 35;
      reasons.push(`Rolling Drawdown (${rollingMetrics.rollingMaxDrawdownPct}%) exceeds 15% risk threshold.`);
    } else if (rollingMetrics.rollingMaxDrawdownPct > 10) {
      penalty += 15;
      reasons.push(`Rolling Drawdown (${rollingMetrics.rollingMaxDrawdownPct}%) is elevated (above 10%).`);
    }

    // Check Consecutive Losses
    if (rollingMetrics.rollingMaxConsecutiveLosses >= 5) {
      penalty += 20;
      reasons.push(`High consecutive loss streak (${rollingMetrics.rollingMaxConsecutiveLosses} losses) detected in rolling window.`);
    }

    // Check Strike Rate (Win Rate)
    if (rollingMetrics.rollingWinRate < 35 && overallMetrics.payoffRatio < 2.0) {
      penalty += 20;
      reasons.push(`Rolling Strike Rate (${rollingMetrics.rollingWinRate}%) is low without sufficient R:R compensation.`);
    }

    const score = Math.max(0, 100 - penalty);

    if (score < 50 || rollingMetrics.rollingProfitFactor < 1.0 || rollingMetrics.rollingMaxDrawdownPct > 15) {
      return {
        status: 'PAUSE',
        score,
        reasons: reasons.length > 0 ? reasons : ['Critical risk thresholds breached.'],
        recommendation: '🔴 PAUSE TRADING: Reduce risk per trade to 0.25% or stop live trading. Re-verify Market Profile auction setups & Value Area acceptance before placing new orders.',
      };
    } else if (score < 80 || rollingMetrics.rollingProfitFactor < 1.35 || rollingMetrics.rollingMaxDrawdownPct > 8) {
      return {
        status: 'WATCH',
        score,
        reasons,
        recommendation: '🟡 WATCH LIST: Reduce position size by 50% (0.5% risk/trade). Strict adherence to Value Area High/Low boundaries required.',
      };
    } else {
      return {
        status: 'HEALTHY',
        score,
        reasons: ['Rolling Profit Factor, Expectancy, and Drawdown are within optimal statistical parameters.'],
        recommendation: '🟢 HEALTHY STRATEGY: System operating at prime efficiency. Execute standard 1% risk per trade with full confidence.',
      };
    }
  }

  /**
   * Group trades by Period (Daily, Weekly, Monthly)
   */
  public getTradeSummariesByPeriod(
    trades: MTTrade[],
    periodType: 'daily' | 'weekly' | 'monthly'
  ): TradePerformanceSummary[] {
    const periodMap = new Map<string, MTTrade[]>();

    trades.forEach((t) => {
      const d = new Date(t.closeTimestamp);
      let key = '';

      if (periodType === 'daily') {
        key = d.toISOString().split('T')[0];
      } else if (periodType === 'monthly') {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      } else {
        // Weekly
        const oneJan = new Date(d.getFullYear(), 0, 1);
        const numberOfDays = Math.floor((d.getTime() - oneJan.getTime()) / (24 * 60 * 60 * 1000));
        const weekNum = Math.ceil((d.getDay() + 1 + numberOfDays) / 7);
        key = `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
      }

      if (!periodMap.has(key)) periodMap.set(key, []);
      periodMap.get(key)!.push(t);
    });

    const result: TradePerformanceSummary[] = [];

    periodMap.forEach((periodTrades, periodKey) => {
      let wins = 0;
      let losses = 0;
      let grossProfit = 0;
      let grossLoss = 0;
      let netProfit = 0;
      let totalVolumeLots = 0;

      let peak = 0;
      let maxDd = 0;
      let running = 0;

      periodTrades.forEach((t) => {
        netProfit += t.netProfit;
        totalVolumeLots += t.lots;

        running += t.netProfit;
        if (running > peak) peak = running;
        const dd = peak - running;
        if (dd > maxDd) maxDd = dd;

        if (t.netProfit > 0) {
          wins++;
          grossProfit += t.netProfit;
        } else if (t.netProfit < 0) {
          losses++;
          grossLoss += Math.abs(t.netProfit);
        }
      });

      const total = periodTrades.length;
      const winRate = total > 0 ? (wins / total) * 100 : 0;
      const profitFactor = grossLoss > 0 ? parseFloat((grossProfit / grossLoss).toFixed(2)) : grossProfit > 0 ? 99.9 : 0;

      result.push({
        period: periodKey,
        tradesCount: total,
        wins,
        losses,
        winRate: parseFloat(winRate.toFixed(1)),
        netProfit: parseFloat(netProfit.toFixed(2)),
        profitFactor,
        totalVolumeLots: parseFloat(totalVolumeLots.toFixed(2)),
        maxDrawdownPct: peak > 0 ? parseFloat(((maxDd / peak) * 100).toFixed(1)) : 0,
      });
    });

    return result.sort((a, b) => b.period.localeCompare(a.period));
  }

  /**
   * Pre-seeds a realistic sample MetaTrader account statement for instant testing
   */
  public seedSampleAccount(): MTAccount {
    const sampleHtml = `
      <html>
        <body>
          <table>
            <tr><td>Account: 884192</td><td>Name: Institutional Prop Trader</td><td>Broker: IC Markets SC</td><td>Currency: USD</td><td>Leverage: 1:100</td></tr>
          </table>
          <table>
            <tr>
              <th>Ticket</th><th>Open Time</th><th>Type</th><th>Size</th><th>Item</th><th>Price</th><th>S / L</th><th>T / P</th><th>Close Time</th><th>Price</th><th>Commission</th><th>Taxes</th><th>Swap</th><th>Profit</th>
            </tr>
            <tr><td>101001</td><td>2026.07.01 08:30:00</td><td>buy</td><td>1.00</td><td>GBPUSD</td><td>1.26500</td><td>1.26250</td><td>1.27000</td><td>2026.07.01 11:20:00</td><td>1.27000</td><td>-3.50</td><td>0</td><td>0.00</td><td>500.00</td></tr>
            <tr><td>101002</td><td>2026.07.02 09:15:00</td><td>sell</td><td>1.00</td><td>EURUSD</td><td>1.08800</td><td>1.09050</td><td>1.08300</td><td>2026.07.02 14:10:00</td><td>1.08300</td><td>-3.50</td><td>0</td><td>-1.20</td><td>500.00</td></tr>
            <tr><td>101003</td><td>2026.07.03 10:00:00</td><td>buy</td><td>1.00</td><td>XAUUSD</td><td>2350.00</td><td>2340.00</td><td>2370.00</td><td>2026.07.03 12:45:00</td><td>2340.00</td><td>-3.50</td><td>0</td><td>0.00</td><td>-1000.00</td></tr>
            <tr><td>101004</td><td>2026.07.06 08:45:00</td><td>buy</td><td>1.50</td><td>GBPUSD</td><td>1.26800</td><td>1.26550</td><td>1.27300</td><td>2026.07.06 15:30:00</td><td>1.27300</td><td>-5.25</td><td>0</td><td>0.00</td><td>750.00</td></tr>
            <tr><td>101005</td><td>2026.07.07 13:20:00</td><td>sell</td><td>1.00</td><td>AUDUSD</td><td>0.67200</td><td>0.67400</td><td>0.66800</td><td>2026.07.07 16:10:00</td><td>0.66800</td><td>-3.50</td><td>0</td><td>0.00</td><td>400.00</td></tr>
            <tr><td>101006</td><td>2026.07.08 09:00:00</td><td>buy</td><td>1.00</td><td>EURUSD</td><td>1.08500</td><td>1.08300</td><td>1.08900</td><td>2026.07.08 11:30:00</td><td>1.08300</td><td>-3.50</td><td>0</td><td>0.00</td><td>-200.00</td></tr>
            <tr><td>101007</td><td>2026.07.09 10:30:00</td><td>buy</td><td>1.20</td><td>GBPUSD</td><td>1.27100</td><td>1.26800</td><td>1.27700</td><td>2026.07.09 16:00:00</td><td>1.27700</td><td>-4.20</td><td>0</td><td>-0.80</td><td>720.00</td></tr>
            <tr><td>101008</td><td>2026.07.10 08:15:00</td><td>sell</td><td>1.00</td><td>USDJPY</td><td>158.500</td><td>158.900</td><td>157.700</td><td>2026.07.10 13:20:00</td><td>157.700</td><td>-3.50</td><td>0</td><td>0.00</td><td>510.00</td></tr>
            <tr><td>101009</td><td>2026.07.13 09:30:00</td><td>buy</td><td>1.00</td><td>XAUUSD</td><td>2365.00</td><td>2355.00</td><td>2385.00</td><td>2026.07.13 14:00:00</td><td>2385.00</td><td>-3.50</td><td>0</td><td>0.00</td><td>2000.00</td></tr>
            <tr><td>101010</td><td>2026.07.14 08:00:00</td><td>sell</td><td>1.00</td><td>GBPUSD</td><td>1.27800</td><td>1.28100</td><td>1.27200</td><td>2026.07.14 11:15:00</td><td>1.27200</td><td>-3.50</td><td>0</td><td>0.00</td><td>600.00</td></tr>
            <tr><td>101011</td><td>2026.07.15 11:00:00</td><td>buy</td><td>1.00</td><td>EURUSD</td><td>1.09100</td><td>1.08850</td><td>1.09600</td><td>2026.07.15 15:45:00</td><td>1.08850</td><td>-3.50</td><td>0</td><td>0.00</td><td>-250.00</td></tr>
            <tr><td>101012</td><td>2026.07.16 09:10:00</td><td>buy</td><td>1.20</td><td>GBPUSD</td><td>1.27400</td><td>1.27150</td><td>1.27900</td><td>2026.07.16 13:30:00</td><td>1.27900</td><td>-4.20</td><td>0</td><td>0.00</td><td>600.00</td></tr>
            <tr><td>101013</td><td>2026.07.17 08:30:00</td><td>sell</td><td>1.00</td><td>AUDUSD</td><td>0.67500</td><td>0.67750</td><td>0.67000</td><td>2026.07.17 12:00:00</td><td>0.67000</td><td>-3.50</td><td>0</td><td>0.00</td><td>500.00</td></tr>
            <tr><td>101014</td><td>2026.07.20 09:45:00</td><td>buy</td><td>1.00</td><td>USDJPY</td><td>157.200</td><td>156.800</td><td>158.000</td><td>2026.07.20 14:15:00</td><td>158.000</td><td>-3.50</td><td>0</td><td>0.00</td><td>510.00</td></tr>
            <tr><td>101015</td><td>2026.07.21 10:15:00</td><td>sell</td><td>1.00</td><td>GBPUSD</td><td>1.28100</td><td>1.28400</td><td>1.27500</td><td>2026.07.21 16:30:00</td><td>1.27500</td><td>-3.50</td><td>0</td><td>0.00</td><td>600.00</td></tr>
            <tr><td>101016</td><td>2026.07.22 08:20:00</td><td>buy</td><td>1.50</td><td>XAUUSD</td><td>2380.00</td><td>2370.00</td><td>2400.00</td><td>2026.07.22 13:00:00</td><td>2400.00</td><td>-5.25</td><td>0</td><td>0.00</td><td>3000.00</td></tr>
            <tr><td>101017</td><td>2026.07.23 09:00:00</td><td>buy</td><td>1.00</td><td>EURUSD</td><td>1.09400</td><td>1.09150</td><td>1.09900</td><td>2026.07.23 11:45:00</td><td>1.09150</td><td>-3.50</td><td>0</td><td>0.00</td><td>-250.00</td></tr>
            <tr><td>101018</td><td>2026.07.24 10:30:00</td><td>sell</td><td>1.00</td><td>GBPUSD</td><td>1.28600</td><td>1.28900</td><td>1.28000</td><td>2026.07.24 15:10:00</td><td>1.28000</td><td>-3.50</td><td>0</td><td>0.00</td><td>600.00</td></tr>
            <tr><td>101019</td><td>2026.07.27 08:45:00</td><td>buy</td><td>1.00</td><td>AUDUSD</td><td>0.67100</td><td>0.66850</td><td>0.67600</td><td>2026.07.27 12:30:00</td><td>0.67600</td><td>-3.50</td><td>0</td><td>0.00</td><td>500.00</td></tr>
            <tr><td>101020</td><td>2026.07.28 09:15:00</td><td>sell</td><td>1.00</td><td>USDJPY</td><td>156.800</td><td>157.200</td><td>156.000</td><td>2026.07.28 14:00:00</td><td>156.000</td><td>-3.50</td><td>0</td><td>0.00</td><td>510.00</td></tr>
            <tr><td>101021</td><td>2026.07.29 10:00:00</td><td>buy</td><td>1.20</td><td>GBPUSD</td><td>1.28900</td><td>1.28600</td><td>1.29500</td><td>2026.07.29 16:15:00</td><td>1.29500</td><td>-4.20</td><td>0</td><td>0.00</td><td>720.00</td></tr>
            <tr><td>101022</td><td>2026.07.30 08:30:00</td><td>sell</td><td>1.00</td><td>EURUSD</td><td>1.09800</td><td>1.10050</td><td>1.09300</td><td>2026.07.30 11:00:00</td><td>1.09300</td><td>-3.50</td><td>0</td><td>0.00</td><td>500.00</td></tr>
            <tr><td>101023</td><td>2026.07.31 09:30:00</td><td>buy</td><td>1.00</td><td>XAUUSD</td><td>2410.00</td><td>2400.00</td><td>2430.00</td><td>2026.07.31 15:00:00</td><td>2430.00</td><td>-3.50</td><td>0</td><td>0.00</td><td>2000.00</td></tr>
            <tr><td>101024</td><td>2026.08.03 08:15:00</td><td>buy</td><td>1.00</td><td>GBPUSD</td><td>1.29200</td><td>1.28950</td><td>1.29700</td><td>2026.08.03 12:10:00</td><td>1.29700</td><td>-3.50</td><td>0</td><td>0.00</td><td>500.00</td></tr>
            <tr><td>101025</td><td>2026.08.04 09:00:00</td><td>sell</td><td>1.00</td><td>AUDUSD</td><td>0.66900</td><td>0.67150</td><td>0.66400</td><td>2026.08.04 14:30:00</td><td>0.66400</td><td>-3.50</td><td>0</td><td>0.00</td><td>500.00</td></tr>
          </table>
        </body>
      </html>
    `;

    const parsed = statementParser.parseStatement(sampleHtml, 'Sample_MT4_Statement.html');
    this.saveOrMergeAccountStatement(parsed);
    return parsed;
  }
}

export const riskManagementService = new RiskManagementService();
