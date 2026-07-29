import {
  DailyProfileRecord,
  MarketProfileData,
  ProfileSimilarityMatch,
  SimilaritySearchResult,
  SymbolCode,
} from '../types/market';
import { SYMBOL_CONFIGS } from '../config/symbols';

export class SimilarityEngine {
  /**
   * Compares today's Market Profile with a stored historical profile record
   * Returns a similarity percentage (0 - 100%) and key matching factors
   */
  public calculateSimilarity(
    target: MarketProfileData,
    candidate: DailyProfileRecord
  ): {
    similarityPct: number;
    matchFactors: string[];
    move1hPips: number;
    move4hPips: number;
    moveEodPips: number;
    outcomeAfterProfile: 'UP' | 'DOWN' | 'RANGE';
  } {
    const symbol = target.symbol || 'GBPUSD';
    const config = SYMBOL_CONFIGS[symbol] || SYMBOL_CONFIGS.GBPUSD;
    const pipDivisor = config.pipValue;

    const matchFactors: string[] = [];

    // 1. Profile Shape Matching (25 Points)
    let shapePoints = 5;
    if (target.profileShape === candidate.profileShape) {
      shapePoints = 25;
      matchFactors.push(`Identical ${target.profileShape} Shape`);
    } else if (
      (target.profileShape === 'P Profile' && candidate.profileShape === 'Trend Day') ||
      (target.profileShape === 'b Profile' && candidate.profileShape === 'Trend Day')
    ) {
      shapePoints = 18;
      matchFactors.push(`Similar Directional Trend Profile`);
    } else if (
      (target.profileShape === 'D Profile' && candidate.profileShape === 'Neutral Day') ||
      (target.profileShape === 'Double Distribution' && candidate.profileShape === 'Double Distribution')
    ) {
      shapePoints = 18;
      matchFactors.push(`Balanced Two-Sided Auction Structure`);
    }

    // 2. TPO Histogram Vector Density Cosine Similarity (35 Points)
    const targetVector = this.normalizeHistogramToBuckets(target.rows, target.low, target.high, 10);
    const candidateVector = this.normalizeHistogramToBuckets(candidate.histogramData, candidate.low, candidate.high, 10);
    const cosineSim = this.cosineSimilarity(targetVector, candidateVector);
    const histogramPoints = Math.round(cosineSim * 35);

    if (cosineSim >= 0.85) {
      matchFactors.push(`High TPO Density Overlap (${Math.round(cosineSim * 100)}%)`);
    }

    // 3. POC & Value Area Geometry (20 Points)
    const targetRange = Math.max(0.0001, target.high - target.low);
    const candidateRange = Math.max(0.0001, candidate.high - candidate.low);

    const targetPocPct = (target.poc - target.low) / targetRange;
    const candidatePocPct = (candidate.poc - candidate.low) / candidateRange;
    const pocDiff = Math.abs(targetPocPct - candidatePocPct);
    const pocPoints = Math.max(0, 10 - Math.round(pocDiff * 20));

    if (pocDiff <= 0.10) {
      matchFactors.push(`Matching POC Location (${Math.round(candidatePocPct * 100)}% Range)`);
    }

    const targetVaWidth = (target.vah - target.val) / targetRange;
    const candidateVaWidth = (candidate.vah - candidate.val) / candidateRange;
    const vaDiff = Math.abs(targetVaWidth - candidateVaWidth);
    const vaPoints = Math.max(0, 10 - Math.round(vaDiff * 20));

    if (vaDiff <= 0.10) {
      matchFactors.push(`Similar Value Area Width (${Math.round(candidateVaWidth * 100)}% of Range)`);
    }

    // 4. Initial Balance (IB) Extension & Break Direction (10 Points)
    const targetIbHighBreak = target.high > target.initialBalance.high;
    const targetIbLowBreak = target.low < target.initialBalance.low;

    const candidateIbHighBreak = candidate.high > candidate.ibHigh;
    const candidateIbLowBreak = candidate.low < candidate.ibLow;

    let ibPoints = 4;
    if (targetIbHighBreak === candidateIbHighBreak && targetIbLowBreak === candidateIbLowBreak) {
      ibPoints = 10;
      if (targetIbHighBreak) matchFactors.push(`Matching Bullish IB Breakout`);
      else if (targetIbLowBreak) matchFactors.push(`Matching Bearish IB Breakdown`);
      else matchFactors.push(`Matching Inside-IB Auction`);
    } else if ((targetIbHighBreak && candidateIbHighBreak) || (targetIbLowBreak && candidateIbLowBreak)) {
      ibPoints = 8;
      matchFactors.push(`Aligned IB Extension Direction`);
    }

    // 5. ATR Expansion Ratio & Market Score Proximity (10 Points)
    const targetRatio = target.rangeExpansionRatio || 1.0;
    const candidateRatio = candidate.dailyRangePips && candidate.atr14Pips
      ? candidate.dailyRangePips / Math.max(1, candidate.atr14Pips)
      : 1.0;

    const ratioDiff = Math.abs(targetRatio - candidateRatio);
    const ratioPoints = Math.max(0, 5 - Math.round(ratioDiff * 5));

    if (ratioDiff <= 0.2) {
      matchFactors.push(`Matching ATR Expansion (${candidateRatio.toFixed(1)}x Daily ATR)`);
    }

    const scoreDiff = Math.abs(target.marketScore - candidate.marketScore);
    const scorePoints = Math.max(0, 5 - Math.round(scoreDiff * 0.1));

    if (scoreDiff <= 10) {
      matchFactors.push(`Quality Score Proximity (${candidate.marketScore}/100)`);
    }

    const totalPoints = shapePoints + histogramPoints + pocPoints + vaPoints + ibPoints + ratioPoints + scorePoints;
    const similarityPct = Math.min(99, Math.max(25, Math.round(totalPoints)));

    // Calculate or retrieve post-profile metrics
    const move1hPips = candidate.move1hPips !== undefined
      ? candidate.move1hPips
      : this.derive1hMovePips(candidate, pipDivisor);

    const move4hPips = candidate.move4hPips !== undefined
      ? candidate.move4hPips
      : this.derive4hMovePips(candidate, pipDivisor);

    const moveEodPips = candidate.moveEodPips !== undefined
      ? candidate.moveEodPips
      : this.deriveEodMovePips(candidate, pipDivisor);

    let outcomeAfterProfile: 'UP' | 'DOWN' | 'RANGE' = candidate.outcomeAfterProfile || 'RANGE';
    if (!candidate.outcomeAfterProfile) {
      if (moveEodPips >= 12) outcomeAfterProfile = 'UP';
      else if (moveEodPips <= -12) outcomeAfterProfile = 'DOWN';
      else outcomeAfterProfile = 'RANGE';
    }

    return {
      similarityPct,
      matchFactors: matchFactors.slice(0, 4),
      move1hPips,
      move4hPips,
      moveEodPips,
      outcomeAfterProfile,
    };
  }

  /**
   * Searches every stored historical completed Market Profile in the database
   * comparing yesterday's completed profile with historical completed profiles,
   * studying what happened on the FOLLOWING trading day after each similar profile,
   * and generating today's forecast.
   */
  public searchSimilarProfiles(
    yesterdayProfile: MarketProfileData,
    history: DailyProfileRecord[],
    topLimit: number = 10
  ): SimilaritySearchResult {
    const symbol = yesterdayProfile.symbol || 'GBPUSD';
    const targetDate = yesterdayProfile.dateStr || new Date().toISOString().split('T')[0];
    const config = SYMBOL_CONFIGS[symbol] || SYMBOL_CONFIGS.GBPUSD;
    const pipDivisor = config.pipValue;

    const emptyForecast = {
      bias: 'NEUTRAL' as const,
      confidencePct: 0,
      expectedMove1hPips: 0,
      expectedMove4hPips: 0,
      expectedMoveEodPips: 0,
      expectedRangePips: 0,
      summary: 'Insufficient historical profiles available for similarity analysis.',
      keyTakeaway: 'Wait for additional session data to build statistical confidence.',
    };

    if (!history || history.length === 0) {
      return {
        targetSymbol: symbol,
        targetDate,
        targetShape: yesterdayProfile.profileShape,
        targetMarketScore: yesterdayProfile.marketScore,
        topMatches: [],
        avgMove1hPips: 0,
        avgMove4hPips: 0,
        avgMoveEodPips: 0,
        avgFollowingRangePips: 0,
        outcomeStats: {
          upCount: 0,
          downCount: 0,
          rangeCount: 0,
          upPct: 0,
          downPct: 0,
          rangePct: 0,
          dominantOutcome: 'RANGE',
        },
        todayForecast: emptyForecast,
        totalCompared: 0,
        lastUpdated: Date.now(),
      };
    }

    // Filter candidate historical profiles:
    // Prefer records for the same symbol; fallback to all symbol profiles if needed
    const sameSymbolCandidates = history.filter(
      (rec) => (rec.symbol || 'GBPUSD') === symbol && rec.tradingDate !== targetDate
    );
    const validCandidates =
      sameSymbolCandidates.length >= 3
        ? sameSymbolCandidates
        : history.filter((rec) => rec.tradingDate !== targetDate || rec.symbol !== symbol);

    const matchesWithScores: ProfileSimilarityMatch[] = validCandidates.map((record) => {
      const calc = this.calculateSimilarity(yesterdayProfile, record);

      // Find the following trading day record after candidate record (Day T+1)
      const followingDay = this.findFollowingDayRecord(record, history);

      let move1hPips = calc.move1hPips;
      let move4hPips = calc.move4hPips;
      let moveEodPips = calc.moveEodPips;
      let outcomeAfterProfile: 'UP' | 'DOWN' | 'RANGE' = calc.outcomeAfterProfile;
      let followingDayShape = record.profileShape;
      let followingDayRangePips = record.dailyRangePips || 50;

      if (followingDay) {
        followingDayShape = followingDay.profileShape;
        followingDayRangePips = followingDay.dailyRangePips || Math.round((followingDay.high - followingDay.low) / pipDivisor);
        
        moveEodPips = followingDay.moveEodPips !== undefined
          ? followingDay.moveEodPips
          : Math.round((followingDay.close - followingDay.open) / pipDivisor);
        
        move1hPips = followingDay.move1hPips !== undefined
          ? followingDay.move1hPips
          : Math.round((followingDay.close - followingDay.open) * 0.35 / pipDivisor);

        move4hPips = followingDay.move4hPips !== undefined
          ? followingDay.move4hPips
          : Math.round((followingDay.close - followingDay.open) * 0.65 / pipDivisor);

        if (moveEodPips >= 12) outcomeAfterProfile = 'UP';
        else if (moveEodPips <= -12) outcomeAfterProfile = 'DOWN';
        else outcomeAfterProfile = 'RANGE';
      }

      return {
        rank: 0,
        record: {
          ...record,
          symbol: record.symbol || symbol,
        },
        similarityPct: calc.similarityPct,
        matchFactors: calc.matchFactors,
        followingDayRecord: followingDay || undefined,
        followingDayDate: followingDay ? followingDay.tradingDate : undefined,
        followingDayShape,
        outcomeAfterProfile,
        move1hPips,
        move4hPips,
        moveEodPips,
        followingDayRangePips,
      };
    });

    // Sort descending by similarity score
    matchesWithScores.sort((a, b) => b.similarityPct - a.similarityPct);

    // Pick top N
    const topMatches = matchesWithScores.slice(0, topLimit).map((match, idx) => ({
      ...match,
      rank: idx + 1,
    }));

    if (topMatches.length === 0) {
      return {
        targetSymbol: symbol,
        targetDate,
        targetShape: yesterdayProfile.profileShape,
        targetMarketScore: yesterdayProfile.marketScore,
        topMatches: [],
        avgMove1hPips: 0,
        avgMove4hPips: 0,
        avgMoveEodPips: 0,
        avgFollowingRangePips: 0,
        outcomeStats: {
          upCount: 0,
          downCount: 0,
          rangeCount: 0,
          upPct: 0,
          downPct: 0,
          rangePct: 0,
          dominantOutcome: 'RANGE',
        },
        todayForecast: emptyForecast,
        totalCompared: validCandidates.length,
        lastUpdated: Date.now(),
      };
    }

    const total1h = topMatches.reduce((sum, m) => sum + m.move1hPips, 0);
    const total4h = topMatches.reduce((sum, m) => sum + m.move4hPips, 0);
    const totalEod = topMatches.reduce((sum, m) => sum + m.moveEodPips, 0);
    const totalRange = topMatches.reduce((sum, m) => sum + (m.followingDayRangePips || 50), 0);

    const avgMove1hPips = Number((total1h / topMatches.length).toFixed(1));
    const avgMove4hPips = Number((total4h / topMatches.length).toFixed(1));
    const avgMoveEodPips = Number((totalEod / topMatches.length).toFixed(1));
    const avgFollowingRangePips = Number((totalRange / topMatches.length).toFixed(1));

    let upCount = 0;
    let downCount = 0;
    let rangeCount = 0;

    topMatches.forEach((m) => {
      if (m.outcomeAfterProfile === 'UP') upCount++;
      else if (m.outcomeAfterProfile === 'DOWN') downCount++;
      else rangeCount++;
    });

    const upPct = Math.round((upCount / topMatches.length) * 100);
    const downPct = Math.round((downCount / topMatches.length) * 100);
    const rangePct = Math.round((rangeCount / topMatches.length) * 100);

    let dominantOutcome: 'UP' | 'DOWN' | 'RANGE' = 'RANGE';
    if (upPct >= downPct && upPct >= rangePct) dominantOutcome = 'UP';
    else if (downPct >= upPct && downPct >= rangePct) dominantOutcome = 'DOWN';

    // Build Today's Forecast
    let bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    if (upPct > downPct && upPct >= 40) bias = 'BULLISH';
    else if (downPct > upPct && downPct >= 40) bias = 'BEARISH';

    const confidencePct = Math.max(upPct, downPct, rangePct);

    const summary = `Based on ${topMatches.length} historical Market Profiles matching yesterday's completed ${symbol} (${yesterdayProfile.profileShape}, ${targetDate}), ${confidencePct}% of subsequent trading sessions resulted in a ${dominantOutcome === 'UP' ? 'Bullish expansion' : dominantOutcome === 'DOWN' ? 'Bearish expansion' : 'Consolidation range'}.`;

    const keyTakeaway = bias === 'BULLISH'
      ? `Historical outcomes favor looking for Long opportunities above yesterday's VAL (${yesterdayProfile.val.toFixed(5)}) with an expected EOD move of +${avgMoveEodPips} pips.`
      : bias === 'BEARISH'
      ? `Historical outcomes favor looking for Short opportunities below yesterday's VAH (${yesterdayProfile.vah.toFixed(5)}) with an expected EOD move of ${avgMoveEodPips} pips.`
      : `Historical outcomes indicate rotational two-sided trading within yesterday's Value Area (${yesterdayProfile.val.toFixed(5)} - ${yesterdayProfile.vah.toFixed(5)}).`;

    return {
      targetSymbol: symbol,
      targetDate,
      targetShape: yesterdayProfile.profileShape,
      targetMarketScore: yesterdayProfile.marketScore,
      topMatches,
      avgMove1hPips,
      avgMove4hPips,
      avgMoveEodPips,
      avgFollowingRangePips,
      outcomeStats: {
        upCount,
        downCount,
        rangeCount,
        upPct,
        downPct,
        rangePct,
        dominantOutcome,
      },
      todayForecast: {
        bias,
        confidencePct,
        expectedMove1hPips: avgMove1hPips,
        expectedMove4hPips: avgMove4hPips,
        expectedMoveEodPips: avgMoveEodPips,
        expectedRangePips: avgFollowingRangePips,
        summary,
        keyTakeaway,
      },
      totalCompared: validCandidates.length,
      lastUpdated: Date.now(),
    };
  }

  /**
   * Finds the following trading day record in history (Day T+1) for a candidate record (Day T)
   */
  private findFollowingDayRecord(
    candidate: DailyProfileRecord,
    history: DailyProfileRecord[]
  ): DailyProfileRecord | null {
    const symbol = candidate.symbol || 'GBPUSD';
    const candidateDate = candidate.tradingDate;

    const subsequentRecords = history
      .filter((rec) => (rec.symbol || 'GBPUSD') === symbol && rec.tradingDate > candidateDate)
      .sort((a, b) => a.tradingDate.localeCompare(b.tradingDate));

    return subsequentRecords.length > 0 ? subsequentRecords[0] : null;
  }

  /**
   * Buckets TPO rows into N equal price slices (0% to 100% of Range)
   */
  private normalizeHistogramToBuckets(
    rows: DailyProfileRecord['histogramData'],
    low: number,
    high: number,
    bucketCount: number = 10
  ): number[] {
    const buckets = new Array(bucketCount).fill(0);
    const range = Math.max(0.0001, high - low);

    if (!rows || rows.length === 0) return buckets;

    const totalTpos = rows.reduce((s, r) => s + r.tpoCount, 0);
    if (totalTpos === 0) return buckets;

    rows.forEach((row) => {
      const relPos = (row.price - low) / range;
      const bucketIdx = Math.min(bucketCount - 1, Math.max(0, Math.floor(relPos * bucketCount)));
      buckets[bucketIdx] += row.tpoCount;
    });

    // Return relative proportions
    return buckets.map((count) => count / totalTpos);
  }

  /**
   * Computes cosine similarity between two numeric vectors
   */
  private cosineSimilarity(v1: number[], v2: number[]): number {
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < v1.length; i++) {
      dotProduct += v1[i] * v2[i];
      norm1 += v1[i] * v1[i];
      norm2 += v2[i] * v2[i];
    }

    if (norm1 === 0 || norm2 === 0) return 0;
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  private derive1hMovePips(rec: DailyProfileRecord, pipDivisor: number): number {
    if (rec.candles && rec.candles.length >= 60) {
      const startClose = rec.candles[0].close;
      const end1hClose = rec.candles[Math.min(rec.candles.length - 1, 60)].close;
      return Math.round((end1hClose - startClose) / pipDivisor);
    }

    const isUp = rec.close >= rec.open;
    const factor = isUp ? 1 : -1;
    const pips = Math.round((rec.dailyRangePips * 0.35) * factor);
    return pips;
  }

  private derive4hMovePips(rec: DailyProfileRecord, pipDivisor: number): number {
    if (rec.candles && rec.candles.length >= 240) {
      const startClose = rec.candles[0].close;
      const end4hClose = rec.candles[Math.min(rec.candles.length - 1, 240)].close;
      return Math.round((end4hClose - startClose) / pipDivisor);
    }

    const isUp = rec.close >= rec.open;
    const factor = isUp ? 1 : -1;
    const pips = Math.round((rec.dailyRangePips * 0.65) * factor);
    return pips;
  }

  private deriveEodMovePips(rec: DailyProfileRecord, pipDivisor: number): number {
    if (rec.candles && rec.candles.length > 0) {
      const startClose = rec.candles[0].close;
      const endClose = rec.candles[rec.candles.length - 1].close;
      return Math.round((endClose - startClose) / pipDivisor);
    }

    const pips = Math.round((rec.close - rec.open) / pipDivisor);
    return pips;
  }
}

export const similarityEngine = new SimilarityEngine();
