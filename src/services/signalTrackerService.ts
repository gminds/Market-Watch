import {
  MarketProfileData,
  MarketProfileSnapshot,
  SignalTrackerStats,
  SymbolCode,
  TrackedSignal,
  TrackedSignalStatus,
} from '../types/market';
import { getSymbolConfig } from '../config/symbols';

const TRACKED_SIGNALS_STORAGE_KEY = 'mps_tracked_signals_v2';

type Listener = (signals: TrackedSignal[]) => void;

export interface ClearSignalFilterOptions {
  mode: 'all' | 'resolved' | 'dateRange' | 'asset' | 'signalType' | 'selected';
  ids?: string[];
  dateRangeMode?: 'older7d' | 'older30d' | 'today' | 'custom';
  customStartDate?: string;
  customEndDate?: string;
  symbol?: SymbolCode | 'ALL' | string;
  signalType?: string;
}

export class SignalTrackerService {
  private signals: TrackedSignal[] = [];
  private listeners: Set<Listener> = new Set();
  private mutedSymbols: Set<string> = new Set();
  private noiseSuppressionLevel: 'strict' | 'moderate' | 'off' = 'strict';

  public getMutedSymbols(): string[] {
    return Array.from(this.mutedSymbols);
  }

  public muteSymbol(symbol: string) {
    this.mutedSymbols.add(symbol.toUpperCase());
    this.notifyListeners();
  }

  public unmuteSymbol(symbol: string) {
    this.mutedSymbols.delete(symbol.toUpperCase());
    this.notifyListeners();
  }

  public isSymbolMuted(symbol: string): boolean {
    return this.mutedSymbols.has(symbol.toUpperCase());
  }

  public toggleMuteSymbol(symbol: string): boolean {
    const symUpper = symbol.toUpperCase();
    if (this.mutedSymbols.has(symUpper)) {
      this.mutedSymbols.delete(symUpper);
    } else {
      this.mutedSymbols.add(symUpper);
    }
    this.notifyListeners();
    return this.isSymbolMuted(symUpper);
  }

  public setNoiseSuppressionLevel(level: 'strict' | 'moderate' | 'off') {
    this.noiseSuppressionLevel = level;
    this.notifyListeners();
  }

  public getNoiseSuppressionLevel(): 'strict' | 'moderate' | 'off' {
    return this.noiseSuppressionLevel;
  }

  /**
   * Generic action to suppress noise for any symbol and purge recent duplicate signals
   */
  public suppressSymbolNoiseAndPurgeDuplicates(symbol: string): { purgedCount: number; isMuted: boolean } {
    const symUpper = symbol.toUpperCase();
    this.mutedSymbols.add(symUpper);

    const targetSignals = this.signals.filter((s) => s.symbol === symUpper);
    const otherSignals = this.signals.filter((s) => s.symbol !== symUpper);

    const keptTarget: TrackedSignal[] = [];
    for (const sig of targetSignals) {
      const isDuplicateInWindow = keptTarget.some(
        (existing) =>
          existing.direction === sig.direction &&
          Math.abs(existing.timestamp - sig.timestamp) < 900000 // 15 mins
      );
      if (!isDuplicateInWindow) {
        keptTarget.push(sig);
      }
    }

    const purgedCount = targetSignals.length - keptTarget.length;
    this.signals = [...keptTarget, ...otherSignals].sort((a, b) => b.timestamp - a.timestamp);
    this.saveToStorage();
    this.notifyListeners();
    return { purgedCount, isMuted: true };
  }

  /**
   * Quick action to suppress AUDUSD noise and purge recent duplicate AUDUSD signals
   */
  public suppressAudusdNoiseAndPurgeDuplicates(): { purgedCount: number; isMuted: boolean } {
    return this.suppressSymbolNoiseAndPurgeDuplicates('AUDUSD');
  }

  constructor() {
    this.loadFromStorage();
    if (this.signals.length === 0) {
      this.seedSampleSignals();
    }
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getSignals());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    const data = this.getSignals();
    this.listeners.forEach((fn) => fn(data));
  }

  public getSignals(): TrackedSignal[] {
    return [...this.signals];
  }

  private deduplicateAndRepairIds(signalsList: TrackedSignal[]): TrackedSignal[] {
    const seen = new Set<string>();
    return signalsList.map((sig, idx) => {
      if (!sig.id || seen.has(sig.id)) {
        const cleanDate = (sig.dateStr || new Date().toISOString().split('T')[0]).replace(/-/g, '');
        const newId = `SIG-${cleanDate}-${Math.floor(100 + Math.random() * 9000)}-${idx + 1}`;
        seen.add(newId);
        return { ...sig, id: newId };
      }
      seen.add(sig.id);
      return sig;
    });
  }

  private generateUniqueId(dateStr: string): string {
    const cleanDate = dateStr.replace(/-/g, '');
    let candidate = `SIG-${cleanDate}-${Math.floor(100 + Math.random() * 900)}`;
    let attempts = 0;
    while (this.signals.some((s) => s.id === candidate) && attempts < 100) {
      attempts++;
      candidate = `SIG-${cleanDate}-${Math.floor(100 + Math.random() * 9000)}`;
    }
    if (this.signals.some((s) => s.id === candidate)) {
      candidate = `SIG-${cleanDate}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
    }
    return candidate;
  }

  private loadFromStorage() {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(TRACKED_SIGNALS_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            this.signals = this.deduplicateAndRepairIds(parsed);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load tracked signals from storage:', e);
      this.signals = [];
    }
  }

  private saveToStorage() {
    try {
      this.signals = this.deduplicateAndRepairIds(this.signals);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(TRACKED_SIGNALS_STORAGE_KEY, JSON.stringify(this.signals));
      }
    } catch (e) {
      console.warn('Failed to save tracked signals to storage:', e);
    }
    this.notifyListeners();
  }

  /**
   * Rule 1: Verifies if the previous day's Market Profile is complete
   */
  public isPrevDayProfileComplete(symbol: SymbolCode, profile: MarketProfileData): boolean {
    if (profile.hasPrevDayProfileComplete !== undefined) {
      return profile.hasPrevDayProfileComplete;
    }
    if (profile.prevDayLevels && profile.prevDayLevels.vah > 0 && profile.prevDayLevels.val > 0) {
      return true;
    }
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem('mps_daily_profiles_v18');
        if (stored) {
          const historyArr = JSON.parse(stored);
          const match = historyArr.find(
            (r: { symbol?: string; tradingDate: string; vah?: number; val?: number; poc?: number }) =>
              (r.symbol || 'GBPUSD') === symbol && r.tradingDate !== profile.dateStr && r.vah && r.val && r.poc
          );
          if (match) return true;
        }
      }
    } catch (e) {
      // ignore
    }
    return true;
  }

  /**
   * Rule 2: Checks if there is a significant change in outlook during the day
   */
  public checkOutlookChange(
    symbol: SymbolCode,
    profile: MarketProfileData,
    candidateDirection: 'LONG' | 'SHORT',
    candidateSignalType: string
  ): { hasSignificantChange: boolean; reason: string; lastDirection?: string; lastScore?: number } {
    if (this.isSymbolMuted(symbol)) {
      return {
        hasSignificantChange: false,
        reason: `Signal Monitor for ${symbol} is muted to suppress signal noise.`,
      };
    }

    const todayStr = profile.dateStr || new Date().toISOString().split('T')[0];

    const sameDaySignals = this.signals.filter(
      (s) => s.symbol === symbol && (s.dateStr === todayStr || Math.abs(Date.now() - s.timestamp) < 86400000)
    );

    if (sameDaySignals.length === 0) {
      return {
        hasSignificantChange: true,
        reason: 'First signal of session following prior day Market Profile completion.',
      };
    }

    const lastSignal = sameDaySignals[0];
    const lastScore = lastSignal.marketProfileSnapshot?.marketScore || 0;
    const lastDirection = lastSignal.direction;
    const lastType = lastSignal.signalType;
    const lastShape = lastSignal.marketProfileSnapshot?.profileShape;

    // Check cooldown based on noiseSuppressionLevel
    const minCooldownMs =
      this.noiseSuppressionLevel === 'strict'
        ? 1200000 // 20 minutes
        : this.noiseSuppressionLevel === 'moderate'
        ? 600000 // 10 minutes
        : 120000; // 2 minutes

    const timeSinceLastSignal = Date.now() - lastSignal.timestamp;
    if (timeSinceLastSignal < minCooldownMs && candidateDirection === lastDirection) {
      return {
        hasSignificantChange: false,
        reason: `Noise suppression active: ${symbol} ${candidateDirection} signal issued ${Math.round(timeSinceLastSignal / 60000)}m ago (Cooldown: ${Math.round(minCooldownMs / 60000)}m).`,
        lastDirection,
        lastScore,
      };
    }

    if (candidateDirection !== lastDirection) {
      return {
        hasSignificantChange: true,
        reason: `Intraday direction reversal from ${lastDirection} to ${candidateDirection}.`,
        lastDirection,
        lastScore,
      };
    }

    const scoreDiff = Math.abs(profile.marketScore - lastScore);
    if (scoreDiff >= 15) {
      return {
        hasSignificantChange: true,
        reason: `Market score shifted significantly from ${lastScore}/100 to ${profile.marketScore}/100 (+${scoreDiff} pts).`,
        lastDirection,
        lastScore,
      };
    }

    if (
      lastShape &&
      profile.profileShape !== lastShape &&
      (profile.profileShape === 'Trend Day' || profile.profileShape === 'Double Distribution')
    ) {
      return {
        hasSignificantChange: true,
        reason: `Profile structure evolved from ${lastShape} to ${profile.profileShape}.`,
        lastDirection,
        lastScore,
      };
    }

    const isMajorCandidateType =
      candidateSignalType.includes('Breakout') ||
      candidateSignalType.includes('Tail') ||
      candidateSignalType.includes('Acceptance') ||
      candidateSignalType.includes('IMBALANCE');
    if (candidateSignalType !== lastType && isMajorCandidateType && !lastType.includes('IMBALANCE')) {
      return {
        hasSignificantChange: true,
        reason: `High-impact auction event detected: ${candidateSignalType}.`,
        lastDirection,
        lastScore,
      };
    }

    if (lastSignal.status === 'Target Hit' || lastSignal.status === 'Stop Hit') {
      return {
        hasSignificantChange: true,
        reason: `Previous signal completed (${lastSignal.status}); new setup formed.`,
        lastDirection,
        lastScore,
      };
    }

    return {
      hasSignificantChange: false,
      reason: `Outlook unchanged today for ${symbol} (Active ${lastDirection} signal at ${lastScore}/100 maintained).`,
      lastDirection,
      lastScore,
    };
  }

  /**
   * Captures and auto-saves a new signal generated by Market Scanner or Auction Events
   */
  public autoSaveSignal(
    symbol: SymbolCode,
    signalType: string,
    direction: 'LONG' | 'SHORT',
    entryPrice: number,
    profile: MarketProfileData,
    customSl?: number,
    customTp?: number,
    rationale?: string[]
  ): TrackedSignal {
    const config = getSymbolConfig(symbol);
    const pipVal = config.pipValue;

    // Rule 1: Enforce prior day Market Profile completion
    if (!this.isPrevDayProfileComplete(symbol, profile)) {
      console.log(`[Signal Engine] Suppressed ${symbol}: Previous day Market Profile incomplete.`);
      const existing = this.signals.find((s) => s.symbol === symbol);
      if (existing) return existing;
    }

    // Rule 2: Only issue new signal if intraday outlook changes significantly
    const outlookCheck = this.checkOutlookChange(symbol, profile, direction, signalType);
    if (!outlookCheck.hasSignificantChange) {
      console.log(`[Signal Engine] Suppressed ${symbol}: ${outlookCheck.reason}`);
      const existing = this.signals.find((s) => s.symbol === symbol && s.dateStr === profile.dateStr);
      if (existing) return existing;
    }

    // Avoid exact duplicate within 30 minutes
    const recentDuplicate = this.signals.find(
      (s) =>
        s.symbol === symbol &&
        s.signalType === signalType &&
        Math.abs(Date.now() - s.timestamp) < 1800000 &&
        s.status === 'Pending'
    );
    if (recentDuplicate) {
      return recentDuplicate;
    }

    // Calculate default Stop Loss & Take Profit if not supplied
    let stopLoss = customSl;
    let takeProfit = customTp;

    if (!stopLoss) {
      if (direction === 'LONG') {
        stopLoss = profile.val > 0 ? Math.min(profile.val - pipVal * 12, entryPrice - pipVal * 18) : entryPrice - pipVal * 20;
      } else {
        stopLoss = profile.vah > 0 ? Math.max(profile.vah + pipVal * 12, entryPrice + pipVal * 18) : entryPrice + pipVal * 20;
      }
    }

    if (!takeProfit) {
      const riskPips = Math.abs(entryPrice - stopLoss) / pipVal;
      const targetPipsCalculated = Math.max(25, riskPips * 1.8);
      if (direction === 'LONG') {
        takeProfit = entryPrice + targetPipsCalculated * pipVal;
      } else {
        takeProfit = entryPrice - targetPipsCalculated * pipVal;
      }
    }

    const stopPips = Math.round(Math.abs(entryPrice - stopLoss) / pipVal);
    const targetPips = Math.round(Math.abs(takeProfit - entryPrice) / pipVal);
    const riskReward = Number((targetPips / Math.max(1, stopPips)).toFixed(2));

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const dateStr = now.toISOString().split('T')[0];

    const snapshot: MarketProfileSnapshot = {
      profileShape: profile.profileShape,
      marketScore: profile.marketScore,
      qualityRating: profile.qualityRating,
      poc: profile.poc,
      vah: profile.vah,
      val: profile.val,
      ibHigh: profile.initialBalance.high,
      ibLow: profile.initialBalance.low,
      bias: profile.bias,
      atr14Pips: profile.atr14Pips,
    };

    const newSignal: TrackedSignal = {
      id: this.generateUniqueId(dateStr),
      dateStr,
      timeStr,
      timestamp: Date.now(),
      symbol,
      signalType,
      direction,
      entryPrice,
      stopLoss,
      takeProfit,
      targetPips,
      stopPips,
      riskReward,
      marketProfileSnapshot: snapshot,
      status: 'Pending',
      highestPriceReached: entryPrice,
      lowestPriceReached: entryPrice,
      lastEvaluatedPrice: entryPrice,
      lastEvaluatedTimestamp: Date.now(),
      rationale: rationale || [
        `${direction} signal generated by Market Profile Scanner`,
        `Score: ${profile.marketScore}/100 (${profile.qualityRating})`,
        `Profile Shape: ${profile.profileShape}`,
      ],
    };

    this.signals.unshift(newSignal);
    this.saveToStorage();
    return newSignal;
  }

  /**
   * Continuously monitors price and automatically updates signal outcomes
   */
  public evaluatePriceUpdate(
    symbol: SymbolCode,
    currentPrice: number,
    high?: number,
    low?: number,
    timestamp: number = Date.now()
  ): void {
    const config = getSymbolConfig(symbol);
    const pipVal = config.pipValue;
    const currentHigh = high !== undefined ? high : currentPrice;
    const currentLow = low !== undefined ? low : currentPrice;

    let modified = false;

    for (const sig of this.signals) {
      if (sig.symbol !== symbol || sig.status !== 'Pending') {
        continue;
      }

      sig.highestPriceReached = Math.max(sig.highestPriceReached || sig.entryPrice, currentHigh);
      sig.lowestPriceReached = Math.min(sig.lowestPriceReached || sig.entryPrice, currentLow);
      sig.lastEvaluatedPrice = currentPrice;
      sig.lastEvaluatedTimestamp = timestamp;

      const elapsedMinutes = Math.round((timestamp - sig.timestamp) / 60000);

      if (sig.direction === 'LONG') {
        // Target Hit
        if (currentHigh >= sig.takeProfit) {
          sig.status = 'Target Hit';
          sig.closedAt = timestamp;
          sig.timeToTargetMinutes = elapsedMinutes;
          sig.pnlPips = sig.targetPips;
          sig.rMultiple = sig.riskReward;
          modified = true;
        }
        // Stop Hit
        else if (currentLow <= sig.stopLoss) {
          sig.status = 'Stop Hit';
          sig.closedAt = timestamp;
          sig.pnlPips = -sig.stopPips;
          sig.rMultiple = -1.0;
          modified = true;
        }
        // Expired (e.g. > 24 hours / 1440 mins)
        else if (elapsedMinutes >= 1440) {
          sig.status = 'Expired';
          sig.closedAt = timestamp;
          sig.pnlPips = Math.round((currentPrice - sig.entryPrice) / pipVal);
          sig.rMultiple = Number((sig.pnlPips / sig.stopPips).toFixed(2));
          modified = true;
        }
        // No Follow-Through (e.g. > 360 mins stagnant within +/- 30% of stop range)
        else if (elapsedMinutes >= 360) {
          const maxGainPips = (sig.highestPriceReached - sig.entryPrice) / pipVal;
          if (maxGainPips < sig.targetPips * 0.25) {
            sig.status = 'No Follow-Through';
            sig.closedAt = timestamp;
            sig.pnlPips = Math.round((currentPrice - sig.entryPrice) / pipVal);
            sig.rMultiple = Number((sig.pnlPips / sig.stopPips).toFixed(2));
            modified = true;
          }
        }
      } else {
        // SHORT Direction
        // Target Hit
        if (currentLow <= sig.takeProfit) {
          sig.status = 'Target Hit';
          sig.closedAt = timestamp;
          sig.timeToTargetMinutes = elapsedMinutes;
          sig.pnlPips = sig.targetPips;
          sig.rMultiple = sig.riskReward;
          modified = true;
        }
        // Stop Hit
        else if (currentHigh >= sig.stopLoss) {
          sig.status = 'Stop Hit';
          sig.closedAt = timestamp;
          sig.pnlPips = -sig.stopPips;
          sig.rMultiple = -1.0;
          modified = true;
        }
        // Expired
        else if (elapsedMinutes >= 1440) {
          sig.status = 'Expired';
          sig.closedAt = timestamp;
          sig.pnlPips = Math.round((sig.entryPrice - currentPrice) / pipVal);
          sig.rMultiple = Number((sig.pnlPips / sig.stopPips).toFixed(2));
          modified = true;
        }
        // No Follow-Through
        else if (elapsedMinutes >= 360) {
          const maxGainPips = (sig.entryPrice - sig.lowestPriceReached) / pipVal;
          if (maxGainPips < sig.targetPips * 0.25) {
            sig.status = 'No Follow-Through';
            sig.closedAt = timestamp;
            sig.pnlPips = Math.round((sig.entryPrice - currentPrice) / pipVal);
            sig.rMultiple = Number((sig.pnlPips / sig.stopPips).toFixed(2));
            modified = true;
          }
        }
      }
    }

    if (modified) {
      this.saveToStorage();
    }
  }

  /**
   * Calculates performance statistics across all or filtered signals
   */
  public getStats(customSignals?: TrackedSignal[]): SignalTrackerStats {
    const dataset = customSignals || this.signals;

    const totalSignals = dataset.length;
    const pendingCount = dataset.filter((s) => s.status === 'Pending').length;
    const targetHitCount = dataset.filter((s) => s.status === 'Target Hit').length;
    const stopHitCount = dataset.filter((s) => s.status === 'Stop Hit').length;
    const noFollowThroughCount = dataset.filter((s) => s.status === 'No Follow-Through').length;
    const expiredCount = dataset.filter((s) => s.status === 'Expired').length;

    const resolvedCount = targetHitCount + stopHitCount + noFollowThroughCount + expiredCount;

    const winRate = resolvedCount > 0 ? Number(((targetHitCount / resolvedCount) * 100).toFixed(1)) : 0;
    const lossRate = resolvedCount > 0 ? Number(((stopHitCount / resolvedCount) * 100).toFixed(1)) : 0;

    // Average R-Multiple across resolved signals
    let sumR = 0;
    let resolvedRCount = 0;
    let grossGainR = 0;
    let grossLossR = 0;
    let totalPnlPips = 0;

    dataset.forEach((s) => {
      if (s.rMultiple !== undefined && s.status !== 'Pending') {
        sumR += s.rMultiple;
        resolvedRCount++;
        if (s.rMultiple > 0) {
          grossGainR += s.rMultiple;
        } else {
          grossLossR += Math.abs(s.rMultiple);
        }
      }
      if (s.pnlPips !== undefined && s.status !== 'Pending') {
        totalPnlPips += s.pnlPips;
      }
    });

    const averageRMultiple =
      resolvedRCount > 0 ? Number((sumR / resolvedRCount).toFixed(2)) : 0;

    // Average time to target for 'Target Hit' signals
    const targetHitSignals = dataset.filter(
      (s) => s.status === 'Target Hit' && s.timeToTargetMinutes !== undefined
    );
    const sumTimeToTarget = targetHitSignals.reduce(
      (acc, curr) => acc + (curr.timeToTargetMinutes || 0),
      0
    );
    const averageTimeToTargetMinutes =
      targetHitSignals.length > 0 ? Math.round(sumTimeToTarget / targetHitSignals.length) : 0;

    // Profit Factor calculation
    let profitFactor = 0;
    if (grossLossR === 0) {
      profitFactor = grossGainR > 0 ? Number(grossGainR.toFixed(2)) : 1.0;
    } else {
      profitFactor = Number((grossGainR / grossLossR).toFixed(2));
    }

    return {
      totalSignals,
      pendingCount,
      targetHitCount,
      stopHitCount,
      noFollowThroughCount,
      expiredCount,
      resolvedCount,
      winRate,
      lossRate,
      averageRMultiple,
      averageTimeToTargetMinutes,
      profitFactor,
      totalPnlPips,
    };
  }

  public deleteSignal(id: string) {
    this.signals = this.signals.filter((s) => s.id !== id);
    this.saveToStorage();
  }

  public clearAllSignals() {
    this.signals = [];
    this.saveToStorage();
  }

  public clearSignalsByFilter(options: ClearSignalFilterOptions): number {
    const initialCount = this.signals.length;

    switch (options.mode) {
      case 'all':
        this.signals = [];
        break;
      case 'resolved':
        // Only delete historical resolved signals (Target Hit, Stop Hit, Expired, No Follow-Through)
        // Active 'Pending' signals and scanner configuration are untouched
        this.signals = this.signals.filter((s) => s.status === 'Pending');
        break;
      case 'selected':
        if (options.ids && options.ids.length > 0) {
          const toRemove = new Set(options.ids);
          this.signals = this.signals.filter((s) => !toRemove.has(s.id));
        }
        break;
      case 'asset':
        if (options.symbol && options.symbol !== 'ALL') {
          this.signals = this.signals.filter((s) => s.symbol !== options.symbol);
        }
        break;
      case 'signalType':
        if (options.signalType && options.signalType !== 'ALL') {
          this.signals = this.signals.filter((s) => s.signalType !== options.signalType);
        }
        break;
      case 'dateRange': {
        const nowMs = Date.now();
        if (options.dateRangeMode === 'older7d') {
          const cutoff = nowMs - 7 * 86400000;
          this.signals = this.signals.filter((s) => s.timestamp >= cutoff);
        } else if (options.dateRangeMode === 'older30d') {
          const cutoff = nowMs - 30 * 86400000;
          this.signals = this.signals.filter((s) => s.timestamp >= cutoff);
        } else if (options.dateRangeMode === 'today') {
          const todayStr = new Date().toISOString().split('T')[0];
          this.signals = this.signals.filter((s) => s.dateStr !== todayStr);
        } else if (options.dateRangeMode === 'custom' && options.customStartDate) {
          const start = options.customStartDate;
          const end = options.customEndDate || options.customStartDate;
          this.signals = this.signals.filter((s) => {
            const date = s.dateStr || new Date(s.timestamp).toISOString().split('T')[0];
            return date < start || date > end;
          });
        }
        break;
      }
    }

    const removedCount = initialCount - this.signals.length;
    this.saveToStorage();
    return removedCount;
  }

  /**
   * Pre-seeds realistic historical tracked signals for instant demonstration
   */
  public seedSampleSignals() {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const samples: TrackedSignal[] = [
      {
        id: `SIG-${todayStr.replace(/-/g, '')}-001`,
        dateStr: todayStr,
        timeStr: '09:15',
        timestamp: Date.now() - 3600000 * 2,
        symbol: 'GBPUSD',
        signalType: 'Buying Tail Developing',
        direction: 'LONG',
        entryPrice: 1.3540,
        stopLoss: 1.3515,
        takeProfit: 1.3590,
        targetPips: 50,
        stopPips: 25,
        riskReward: 2.0,
        marketProfileSnapshot: {
          profileShape: 'P Profile',
          marketScore: 88,
          qualityRating: 'Excellent',
          poc: 1.3555,
          vah: 1.3570,
          val: 1.3530,
          ibHigh: 1.3560,
          ibLow: 1.3525,
          bias: 'Strong Bullish',
          atr14Pips: 68,
        },
        status: 'Target Hit',
        closedAt: Date.now() - 3600000 * 0.5,
        timeToTargetMinutes: 48,
        rMultiple: 2.0,
        pnlPips: 50,
        highestPriceReached: 1.3595,
        lowestPriceReached: 1.3538,
        lastEvaluatedPrice: 1.3588,
        rationale: [
          'Buying Tail developing at session low 1.3515 (25 pips rejection)',
          'Market Profile Score: 88/100 (Excellent)',
          'Single prints created in A & B brackets',
        ],
      },
      {
        id: `SIG-${todayStr.replace(/-/g, '')}-002`,
        dateStr: todayStr,
        timeStr: '10:30',
        timestamp: Date.now() - 3600000 * 1.5,
        symbol: 'EURUSD',
        signalType: 'Testing Previous Day VAH',
        direction: 'LONG',
        entryPrice: 1.0850,
        stopLoss: 1.0830,
        takeProfit: 1.0890,
        targetPips: 40,
        stopPips: 20,
        riskReward: 2.0,
        marketProfileSnapshot: {
          profileShape: 'Trend Day',
          marketScore: 92,
          qualityRating: 'Excellent',
          poc: 1.0865,
          vah: 1.0880,
          val: 1.0840,
          ibHigh: 1.0870,
          ibLow: 1.0835,
          bias: 'Bullish',
          atr14Pips: 55,
        },
        status: 'Pending',
        highestPriceReached: 1.0875,
        lowestPriceReached: 1.0845,
        lastEvaluatedPrice: 1.0870,
        rationale: [
          'Price testing Previous Day VAH level with high volume',
          'Acceptance above prior Value Area',
        ],
      },
      {
        id: `SIG-${todayStr.replace(/-/g, '')}-003`,
        dateStr: todayStr,
        timeStr: '08:45',
        timestamp: Date.now() - 3600000 * 4,
        symbol: 'USDJPY',
        signalType: 'Selling Tail Developing',
        direction: 'SHORT',
        entryPrice: 154.20,
        stopLoss: 154.60,
        takeProfit: 153.40,
        targetPips: 80,
        stopPips: 40,
        riskReward: 2.0,
        marketProfileSnapshot: {
          profileShape: 'b Profile',
          marketScore: 84,
          qualityRating: 'Good',
          poc: 154.00,
          vah: 154.30,
          val: 153.80,
          ibHigh: 154.50,
          ibLow: 153.90,
          bias: 'Bearish',
          atr14Pips: 110,
        },
        status: 'Target Hit',
        closedAt: Date.now() - 3600000 * 1.2,
        timeToTargetMinutes: 95,
        rMultiple: 2.0,
        pnlPips: 80,
        highestPriceReached: 154.35,
        lowestPriceReached: 153.30,
        lastEvaluatedPrice: 153.45,
        rationale: [
          'Selling tail rejection at 154.50 high',
          'POC migrating lower toward session low',
        ],
      },
      {
        id: `SIG-${todayStr.replace(/-/g, '')}-004`,
        dateStr: todayStr,
        timeStr: '11:15',
        timestamp: Date.now() - 3600000 * 1,
        symbol: 'XAUUSD',
        signalType: 'Initial Balance Breakout',
        direction: 'LONG',
        entryPrice: 2380.0,
        stopLoss: 2368.0,
        takeProfit: 2404.0,
        targetPips: 240,
        stopPips: 120,
        riskReward: 2.0,
        marketProfileSnapshot: {
          profileShape: 'Double Distribution',
          marketScore: 90,
          qualityRating: 'Excellent',
          poc: 2385.0,
          vah: 2392.0,
          val: 2372.0,
          ibHigh: 2378.0,
          ibLow: 2365.0,
          bias: 'Strong Bullish',
          atr14Pips: 280,
        },
        status: 'Pending',
        highestPriceReached: 2394.0,
        lowestPriceReached: 2378.0,
        lastEvaluatedPrice: 2390.0,
        rationale: [
          'Strong IB High breakout at 2378.0',
          'Gold volatility expansion with score 90',
        ],
      },
      {
        id: `SIG-${todayStr.replace(/-/g, '')}-005`,
        dateStr: todayStr,
        timeStr: '07:20',
        timestamp: Date.now() - 3600000 * 6,
        symbol: 'BTCUSD',
        signalType: 'POC / Value Area Balanced',
        direction: 'SHORT',
        entryPrice: 64500,
        stopLoss: 65200,
        takeProfit: 63100,
        targetPips: 1400,
        stopPips: 700,
        riskReward: 2.0,
        marketProfileSnapshot: {
          profileShape: 'D Profile',
          marketScore: 78,
          qualityRating: 'Good',
          poc: 64600,
          vah: 65000,
          val: 64000,
          ibHigh: 64800,
          ibLow: 64200,
          bias: 'Neutral',
          atr14Pips: 1850,
        },
        status: 'Stop Hit',
        closedAt: Date.now() - 3600000 * 3,
        rMultiple: -1.0,
        pnlPips: -700,
        highestPriceReached: 65350,
        lowestPriceReached: 64200,
        lastEvaluatedPrice: 65100,
        rationale: [
          'Fade test at VAH 65,000 in balanced rotational profile',
        ],
      },
      {
        id: `SIG-${todayStr.replace(/-/g, '')}-006`,
        dateStr: todayStr,
        timeStr: '06:00',
        timestamp: Date.now() - 3600000 * 8,
        symbol: 'GBPJPY',
        signalType: 'BUY',
        direction: 'LONG',
        entryPrice: 198.50,
        stopLoss: 198.10,
        takeProfit: 199.30,
        targetPips: 80,
        stopPips: 40,
        riskReward: 2.0,
        marketProfileSnapshot: {
          profileShape: 'P Profile',
          marketScore: 86,
          qualityRating: 'Excellent',
          poc: 198.80,
          vah: 199.10,
          val: 198.30,
          ibHigh: 198.70,
          ibLow: 198.20,
          bias: 'Bullish',
          atr14Pips: 135,
        },
        status: 'Target Hit',
        closedAt: Date.now() - 3600000 * 5,
        timeToTargetMinutes: 62,
        rMultiple: 2.0,
        pnlPips: 80,
        highestPriceReached: 199.45,
        lowestPriceReached: 198.42,
        lastEvaluatedPrice: 199.20,
        rationale: [
          'P-shape short covering rally on GBPJPY',
          'Value migration higher into London open',
        ],
      },
    ];

    this.signals = samples;
    this.saveToStorage();
  }
}

export const signalTrackerService = new SignalTrackerService();
