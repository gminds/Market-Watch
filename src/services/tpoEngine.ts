import {
  Candle,
  DailyProfileRecord,
  MarketProfileData,
  ProfileShape,
  TPORow,
  SymbolCode,
  ImbalanceEvent,
  EventType,
  AuctionBias,
  QualityRating,
} from '../types/market';
import { SYMBOL_CONFIGS } from '../config/symbols';

/**
 * Bracket letters for 30-minute intervals
 * A = 08:00-08:30, B = 08:30-09:00, C = 09:00-09:30 ...
 */
const BRACKET_LETTERS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'
];

export function getBracketForTime(timeStr: string, sessionStartStr: string = '08:00'): string {
  const [h, m] = timeStr.split(':').map(Number);
  const [startH, startM] = sessionStartStr.split(':').map(Number);
  
  const currentMinutes = h * 60 + m;
  const startMinutes = startH * 60 + startM;
  
  const diffMinutes = currentMinutes - startMinutes;
  if (diffMinutes < 0) return 'A'; // Pre-session
  
  const index = Math.floor(diffMinutes / 30);
  return BRACKET_LETTERS[Math.min(index, BRACKET_LETTERS.length - 1)];
}

export function calculateATR(candles: Candle[], period: number = 14): number {
  if (candles.length < 2) return 0.0050; // default fallback
  
  const trueRanges: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;
    
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trueRanges.push(tr);
  }
  
  if (trueRanges.length === 0) return 0.0050;
  
  const slice = trueRanges.slice(-period);
  const sum = slice.reduce((acc, v) => acc + v, 0);
  return sum / slice.length;
}

export function buildMarketProfile(
  symbol: SymbolCode,
  candles: Candle[],
  dateStr: string,
  isDeveloping: boolean = true,
  sessionStart: string = '08:00',
  sessionEnd: string = '16:30',
  stepPipsOverride?: number,
  prevDayLevels?: { vah: number; val: number; poc: number }
): MarketProfileData {
  const symbolConfig = SYMBOL_CONFIGS[symbol] || SYMBOL_CONFIGS.GBPUSD;
  const stepSize = stepPipsOverride ? stepPipsOverride * symbolConfig.pipValue : symbolConfig.tpoPriceStep;
  
  if (!candles || candles.length === 0) {
    // Return empty profile layout
    return {
      symbol,
      dateStr,
      isDeveloping,
      open: symbolConfig.basePrice,
      high: symbolConfig.basePrice,
      low: symbolConfig.basePrice,
      close: symbolConfig.basePrice,
      sessionRangePips: 0,
      poc: symbolConfig.basePrice,
      vah: symbolConfig.basePrice,
      val: symbolConfig.basePrice,
      valueArea70: { high: symbolConfig.basePrice, low: symbolConfig.basePrice, totalTPOs: 0 },
      vpoc: symbolConfig.basePrice,
      vvah: symbolConfig.basePrice,
      vval: symbolConfig.basePrice,
      totalVolume: 0,
      volumeArea70: { high: symbolConfig.basePrice, low: symbolConfig.basePrice, totalVolume: 0 },
      initialBalance: { high: symbolConfig.basePrice, low: symbolConfig.basePrice, rangePips: 0, brackets: ['A', 'B'] },
      openingRange: { high: symbolConfig.basePrice, low: symbolConfig.basePrice },
      developingPOC: symbolConfig.basePrice,
      developingVAH: symbolConfig.basePrice,
      developingVAL: symbolConfig.basePrice,
      atr14Pips: 80,
      averageDailyRangePips: 95,
      rangeExpansionRatio: 0,
      profileWidth: 0,
      profileHeightPips: 0,
      tpoCountTotal: 0,
      timeAtPriceMap: {},
      profileShape: 'Unknown',
      events: [],
      singlePrints: [],
      poorHigh: false,
      poorLow: false,
      excessHigh: false,
      excessLow: false,
      rows: [],
      marketScore: 50,
      qualityRating: 'Poor',
      scoreBreakdown: {
        trendAlignment: 10,
        atrExpansion: 10,
        pocMigration: 10,
        valueAcceptance: 5,
        rangeExtension: 5,
        profileShapeScore: 5,
        singlePrints: 0,
        excess: 0,
        valueMigration: 0,
        ibBreak: 5,
      },
      bias: 'Neutral',
      statusText: 'Awaiting Session Data',
    };
  }

  // 1. Session High, Low, Open, Close
  const open = candles[0].open;
  const close = candles[candles.length - 1].close;
  let sessionHigh = -Infinity;
  let sessionLow = Infinity;
  
  candles.forEach((c) => {
    if (c.high > sessionHigh) sessionHigh = c.high;
    if (c.low < sessionLow) sessionLow = c.low;
  });

  const sessionRangePips = Math.round((sessionHigh - sessionLow) / symbolConfig.pipValue);

  // 2. Initial Balance (IB: first 2 brackets 'A' and 'B', i.e. 08:00 - 09:00)
  const ibCandles = candles.filter((c) => {
    const bracket = c.bracketLetter || getBracketForTime(c.timeStr, sessionStart);
    return bracket === 'A' || bracket === 'B';
  });

  let ibHigh = sessionHigh;
  let ibLow = sessionLow;
  if (ibCandles.length > 0) {
    ibHigh = Math.max(...ibCandles.map((c) => c.high));
    ibLow = Math.min(...ibCandles.map((c) => c.low));
  }
  const ibRangePips = Math.round((ibHigh - ibLow) / symbolConfig.pipValue);

  // 3. Opening Range (First 15 minutes)
  const openingRangeCandles = candles.slice(0, 15);
  const openingRangeHigh = Math.max(...openingRangeCandles.map((c) => c.high));
  const openingRangeLow = Math.min(...openingRangeCandles.map((c) => c.low));

  // 4. Build TPO Price Bins Map
  // Align price bins to stepSize
  const minPriceBin = Math.floor(sessionLow / stepSize) * stepSize;
  const maxPriceBin = Math.ceil(sessionHigh / stepSize) * stepSize;

  const binMap: Record<string, { price: number; brackets: Set<string>; volume: number }> = {};
  
  for (let p = minPriceBin; p <= maxPriceBin + 0.0000001; p += stepSize) {
    const key = p.toFixed(5);
    binMap[key] = { price: p, brackets: new Set<string>(), volume: 0 };
  }

  // Populate TPO brackets from candles
  candles.forEach((c) => {
    const bracket = c.bracketLetter || getBracketForTime(c.timeStr, sessionStart);
    const lowBin = Math.floor(c.low / stepSize) * stepSize;
    const highBin = Math.ceil(c.high / stepSize) * stepSize;
    
    for (let p = lowBin; p <= highBin + 0.0000001; p += stepSize) {
      const key = p.toFixed(5);
      if (binMap[key]) {
        binMap[key].brackets.add(bracket);
        binMap[key].volume += Math.round(c.volume / Math.max(1, Math.round((c.high - c.low) / stepSize)));
      }
    }
  });

  // Convert binMap to array of TPORow
  const rawRows = Object.values(binMap).map((bin) => {
    const bracketsArr = Array.from(bin.brackets).sort();
    return {
      price: bin.price,
      priceFormatted: bin.price.toFixed(5),
      tpoCount: bracketsArr.length,
      volume: bin.volume,
      brackets: bracketsArr,
      isPOC: false,
      isValueArea: false,
      isInitialBalance: bin.price >= ibLow && bin.price <= ibHigh,
      isSinglePrint: false,
      isPoorHighLow: false,
      isExcess: false,
      isVPOC: false,
      isVolumeValueArea: false,
    };
  });

  // Sort descending by price (highest price top of histogram)
  rawRows.sort((a, b) => b.price - a.price);

  // 5. Point of Control (POC)
  let maxTPO = -1;
  let maxVolume = -1;
  let pocPrice = (sessionHigh + sessionLow) / 2;

  rawRows.forEach((row) => {
    if (row.tpoCount > maxTPO || (row.tpoCount === maxTPO && row.volume > maxVolume)) {
      maxTPO = row.tpoCount;
      maxVolume = row.volume;
      pocPrice = row.price;
    }
  });

  rawRows.forEach((row) => {
    if (Math.abs(row.price - pocPrice) < stepSize / 2) {
      row.isPOC = true;
    }
  });

  // 6. Value Area Calculation (70% of total TPO)
  const totalTPOs = rawRows.reduce((sum, r) => sum + r.tpoCount, 0);
  const targetTPOs = Math.ceil(totalTPOs * 0.70);

  let accumulatedTPOs = 0;
  const pocIndex = rawRows.findIndex((r) => r.isPOC);
  
  let vahIndex = pocIndex >= 0 ? pocIndex : 0;
  let valIndex = pocIndex >= 0 ? pocIndex : 0;

  if (pocIndex >= 0) {
    accumulatedTPOs += rawRows[pocIndex].tpoCount;
    rawRows[pocIndex].isValueArea = true;

    let upperIdx = pocIndex - 1; // higher price
    let lowerIdx = pocIndex + 1; // lower price

    while (accumulatedTPOs < targetTPOs && (upperIdx >= 0 || lowerIdx < rawRows.length)) {
      const upperTPO = upperIdx >= 0 ? rawRows[upperIdx].tpoCount : -1;
      const lowerTPO = lowerIdx < rawRows.length ? rawRows[lowerIdx].tpoCount : -1;

      if (upperTPO >= lowerTPO && upperIdx >= 0) {
        accumulatedTPOs += rawRows[upperIdx].tpoCount;
        rawRows[upperIdx].isValueArea = true;
        vahIndex = upperIdx;
        upperIdx--;
      } else if (lowerIdx < rawRows.length) {
        accumulatedTPOs += rawRows[lowerIdx].tpoCount;
        rawRows[lowerIdx].isValueArea = true;
        valIndex = lowerIdx;
        lowerIdx++;
      } else if (upperIdx >= 0) {
        accumulatedTPOs += rawRows[upperIdx].tpoCount;
        rawRows[upperIdx].isValueArea = true;
        vahIndex = upperIdx;
        upperIdx--;
      } else {
        break;
      }
    }
  }

  const vahPrice = rawRows[vahIndex] ? rawRows[vahIndex].price : sessionHigh;
  const valPrice = rawRows[valIndex] ? rawRows[valIndex].price : sessionLow;

  // 6b. Volume Profile Calculation (Independent 70% Volume Value Area & VPOC)
  let maxVol = -1;
  let vpocIndex = -1;
  rawRows.forEach((row, idx) => {
    if (row.volume > maxVol) {
      maxVol = row.volume;
      vpocIndex = idx;
    }
  });

  if (vpocIndex >= 0) {
    rawRows[vpocIndex].isVPOC = true;
  }

  const totalVolume = rawRows.reduce((sum, r) => sum + r.volume, 0);
  const targetVolume = Math.ceil(totalVolume * 0.70);

  let accumulatedVolume = 0;
  let vvahIndex = vpocIndex >= 0 ? vpocIndex : 0;
  let vvalIndex = vpocIndex >= 0 ? vpocIndex : 0;

  if (vpocIndex >= 0) {
    accumulatedVolume += rawRows[vpocIndex].volume;
    rawRows[vpocIndex].isVolumeValueArea = true;

    let upperVolIdx = vpocIndex - 1;
    let lowerVolIdx = vpocIndex + 1;

    while (accumulatedVolume < targetVolume && (upperVolIdx >= 0 || lowerVolIdx < rawRows.length)) {
      const upperVol = upperVolIdx >= 0 ? rawRows[upperVolIdx].volume : -1;
      const lowerVol = lowerVolIdx < rawRows.length ? rawRows[lowerVolIdx].volume : -1;

      if (upperVol >= lowerVol && upperVolIdx >= 0) {
        accumulatedVolume += rawRows[upperVolIdx].volume;
        rawRows[upperVolIdx].isVolumeValueArea = true;
        vvahIndex = upperVolIdx;
        upperVolIdx--;
      } else if (lowerVolIdx < rawRows.length) {
        accumulatedVolume += rawRows[lowerVolIdx].volume;
        rawRows[lowerVolIdx].isVolumeValueArea = true;
        vvalIndex = lowerVolIdx;
        lowerVolIdx++;
      } else if (upperVolIdx >= 0) {
        accumulatedVolume += rawRows[upperVolIdx].volume;
        rawRows[upperVolIdx].isVolumeValueArea = true;
        vvahIndex = upperVolIdx;
        upperVolIdx--;
      } else {
        break;
      }
    }
  }

  const vpocPrice = rawRows[vpocIndex] ? rawRows[vpocIndex].price : pocPrice;
  const vvahPrice = rawRows[vvahIndex] ? rawRows[vvahIndex].price : vahPrice;
  const vvalPrice = rawRows[vvalIndex] ? rawRows[vvalIndex].price : valPrice;

  // 7. Profile Width & Stats
  const profileWidth = Math.max(...rawRows.map((r) => r.tpoCount), 1);
  const atr14 = calculateATR(candles, 14);
  const atr14Pips = Math.round(atr14 / symbolConfig.pipValue);
  const rangeExpansionRatio = Number((sessionRangePips / Math.max(1, atr14Pips)).toFixed(2));

  // 8. Single Prints & Tails Detection
  const singlePrintPrices: number[] = [];
  rawRows.forEach((r) => {
    if (r.tpoCount === 1 && !r.isPOC && r.price < sessionHigh - stepSize && r.price > sessionLow + stepSize) {
      r.isSinglePrint = true;
      singlePrintPrices.push(r.price);
    }
  });

  // Poor High & Poor Low check
  const topRow = rawRows[0];
  const bottomRow = rawRows[rawRows.length - 1];
  const poorHigh = topRow ? topRow.tpoCount >= 2 : false;
  const poorLow = bottomRow ? bottomRow.tpoCount >= 2 : false;
  if (topRow) topRow.isPoorHighLow = poorHigh;
  if (bottomRow) bottomRow.isPoorHighLow = poorLow;

  // Excess High & Excess Low
  const excessHigh = topRow ? topRow.tpoCount === 1 && rawRows[1]?.tpoCount === 1 : false;
  const excessLow = bottomRow ? bottomRow.tpoCount === 1 && rawRows[rawRows.length - 2]?.tpoCount === 1 : false;
  if (topRow) topRow.isExcess = excessHigh;
  if (bottomRow) bottomRow.isExcess = excessLow;

  // 9. Profile Shape Classification
  let profileShape: ProfileShape = 'D Profile';
  const pocRelativePosition = (pocPrice - sessionLow) / Math.max(0.0001, sessionHigh - sessionLow);
  const closeRelativePosition = (close - sessionLow) / Math.max(0.0001, sessionHigh - sessionLow);

  // Check for multi-distribution (two distinct TPO peaks separated by a thin middle bridge)
  let isDoubleDistribution = false;
  if (rawRows.length >= 10) {
    const topHalf = rawRows.slice(0, Math.floor(rawRows.length / 2));
    const bottomHalf = rawRows.slice(Math.floor(rawRows.length / 2));
    const topMaxTPO = Math.max(...topHalf.map((r) => r.tpoCount));
    const bottomMaxTPO = Math.max(...bottomHalf.map((r) => r.tpoCount));

    const midStart = Math.floor(rawRows.length * 0.30);
    const midEnd = Math.ceil(rawRows.length * 0.70);
    const midRows = rawRows.slice(midStart, midEnd);
    const midMinTPO = midRows.length > 0 ? Math.min(...midRows.map((r) => r.tpoCount)) : 99;
    const midSinglePrints = midRows.filter((r) => r.tpoCount <= 2).length;

    if (topMaxTPO >= 4 && bottomMaxTPO >= 4 && midMinTPO <= 2 && midSinglePrints >= 3) {
      isDoubleDistribution = true;
    }
  }

  if (isDoubleDistribution) {
    profileShape = 'Double Distribution';
  } else if (
    (sessionHigh > ibHigh + stepSize && sessionLow < ibLow - stepSize)
  ) {
    profileShape = 'Neutral Day';
  } else if (pocRelativePosition >= 0.58) {
    if (rangeExpansionRatio >= 1.8 && sessionRangePips >= 55) {
      profileShape = 'Trend Day';
    } else {
      profileShape = 'P Profile';
    }
  } else if (pocRelativePosition <= 0.42) {
    if (rangeExpansionRatio >= 1.8 && sessionRangePips >= 55) {
      profileShape = 'Trend Day';
    } else {
      profileShape = 'b Profile';
    }
  } else if (
    rangeExpansionRatio >= 1.30 || closeRelativePosition >= 0.82 || closeRelativePosition <= 0.18
  ) {
    profileShape = 'Trend Day';
  } else {
    profileShape = 'D Profile';
  }

  // 10. Imbalance & Live Auction Events Detection
  const events: ImbalanceEvent[] = [];
  const latestTimeStr = candles[candles.length - 1]?.timeStr || '12:00';

  // Retrieve Previous Day Levels if not provided
  let prevLevels = prevDayLevels;
  if (!prevLevels && typeof localStorage !== 'undefined') {
    try {
      const storedHistory = localStorage.getItem('mps_daily_profiles_v18');
      if (storedHistory) {
        const historyArr = JSON.parse(storedHistory);
        const match = historyArr.find(
          (r: { symbol?: string; tradingDate: string; vah?: number; val?: number; poc?: number }) =>
            (r.symbol || 'GBPUSD') === symbol && r.tradingDate !== dateStr
        );
        if (match && match.vah && match.val && match.poc) {
          prevLevels = { vah: match.vah, val: match.val, poc: match.poc };
        }
      }
    } catch (e) {
      // ignore
    }
  }

  // Fallback: derive complete previous day profile levels from candle history if available
  if (!prevLevels && candles && candles.length > 0) {
    const priorCandles = candles.filter((c) => c.dateStr && c.dateStr < dateStr);
    if (priorCandles.length > 0) {
      const lastPriorDate = priorCandles[priorCandles.length - 1].dateStr;
      const prevDayCandles = priorCandles.filter((c) => c.dateStr === lastPriorDate);
      if (prevDayCandles.length >= 5) {
        const pHigh = Math.max(...prevDayCandles.map((c) => c.high));
        const pLow = Math.min(...prevDayCandles.map((c) => c.low));
        const pClose = prevDayCandles[prevDayCandles.length - 1].close;
        const pPoc = (pHigh + pLow + pClose) / 3;
        const pRange = Math.max(pHigh - pLow, symbolConfig.pipValue * 10);
        const pVah = pPoc + pRange * 0.25;
        const pVal = pPoc - pRange * 0.25;
        prevLevels = { vah: pVah, val: pVal, poc: pPoc };
      }
    }
  }

  const hasPrevDayProfileComplete = Boolean(
    prevLevels && typeof prevLevels.vah === 'number' && prevLevels.vah > 0 && typeof prevLevels.val === 'number' && prevLevels.val > 0
  );

  // 10A. Buying & Selling Tail Developing Detection
  // Buying Tail: Single prints or excess at session low with price moving up away from low
  const tailBottomRow = rawRows[rawRows.length - 1];
  const secondBottomRow = rawRows[rawRows.length - 2];
  const hasBuyingTailPrint =
    (tailBottomRow && (tailBottomRow.tpoCount === 1 || tailBottomRow.isExcess || tailBottomRow.isSinglePrint)) ||
    (secondBottomRow && secondBottomRow.tpoCount <= 2 && tailBottomRow?.tpoCount === 1);
  const isPriceAboveLowRejection = close > sessionLow + stepSize * 1.5;

  if (hasBuyingTailPrint && isPriceAboveLowRejection) {
    const rejectionPips = Math.round((close - sessionLow) / symbolConfig.pipValue);
    events.push({
      id: `buying-tail-${Date.now()}`,
      timestamp: Date.now(),
      timeStr: latestTimeStr,
      dateStr,
      type: 'Buying Tail Developing',
      price: sessionLow,
      details: `Buying tail developing at ${sessionLow.toFixed(5)} (${rejectionPips} pips rejection at low). Aggressive buyers defending lower prices.`,
      severity: 'high',
    });
  }

  // Selling Tail: Single prints or excess at session high with price moving down away from high
  const tailTopRow = rawRows[0];
  const secondTopRow = rawRows[1];
  const hasSellingTailPrint =
    (tailTopRow && (tailTopRow.tpoCount === 1 || tailTopRow.isExcess || tailTopRow.isSinglePrint)) ||
    (secondTopRow && secondTopRow.tpoCount <= 2 && tailTopRow?.tpoCount === 1);
  const isPriceBelowHighRejection = close < sessionHigh - stepSize * 1.5;

  if (hasSellingTailPrint && isPriceBelowHighRejection) {
    const rejectionPips = Math.round((sessionHigh - close) / symbolConfig.pipValue);
    events.push({
      id: `selling-tail-${Date.now()}`,
      timestamp: Date.now(),
      timeStr: latestTimeStr,
      dateStr,
      type: 'Selling Tail Developing',
      price: sessionHigh,
      details: `Selling tail developing at ${sessionHigh.toFixed(5)} (${rejectionPips} pips rejection at high). Aggressive sellers defending higher prices.`,
      severity: 'high',
    });
  }

  // 10B. POC & Value Area Migration or Balance Detection
  const pocMidDiff = Math.abs(pocPrice - (sessionHigh + sessionLow) / 2) / Math.max(0.0001, sessionHigh - sessionLow);
  const isPocCentered = pocMidDiff <= 0.15;

  if (pocRelativePosition >= 0.60 || pocPrice > open + stepSize * 2.5) {
    events.push({
      id: `poc-migrating-higher-${Date.now()}`,
      timestamp: Date.now(),
      timeStr: latestTimeStr,
      dateStr,
      type: 'POC Migration Higher',
      price: pocPrice,
      details: `POC migrating higher to ${pocPrice.toFixed(5)}. Buyers expanding value toward session highs.`,
      severity: 'warning',
    });
  } else if (pocRelativePosition <= 0.40 || pocPrice < open - stepSize * 2.5) {
    events.push({
      id: `poc-migrating-lower-${Date.now()}`,
      timestamp: Date.now(),
      timeStr: latestTimeStr,
      dateStr,
      type: 'POC Migration Lower',
      price: pocPrice,
      details: `POC migrating lower to ${pocPrice.toFixed(5)}. Sellers expanding value toward session lows.`,
      severity: 'warning',
    });
  } else if (isPocCentered || profileShape === 'D Profile' || profileShape === 'Neutral Day') {
    events.push({
      id: `poc-va-balanced-${Date.now()}`,
      timestamp: Date.now(),
      timeStr: latestTimeStr,
      dateStr,
      type: 'POC / Value Area Balanced',
      price: pocPrice,
      details: `POC & Value Area balanced around ${pocPrice.toFixed(5)} (VAH: ${vahPrice.toFixed(5)}, VAL: ${valPrice.toFixed(5)}). Rotational two-way auction.`,
      severity: 'info',
    });
  }

  // 10C. Price Reaching Previous Day Key Levels (Prev VAH, Prev VAL, Prev POC)
  if (prevLevels) {
    const pipVal = symbolConfig.pipValue;
    const currentPrice = close;

    // Check Previous Day VAH
    const vahDistPips = Math.abs(currentPrice - prevLevels.vah) / pipVal;
    const isTestingPrevVAH = vahDistPips <= 7 || (sessionHigh >= prevLevels.vah && sessionLow <= prevLevels.vah);
    if (isTestingPrevVAH) {
      const isAcceptedAbove = currentPrice > prevLevels.vah + stepSize;
      events.push({
        id: `prev-vah-test-${Date.now()}`,
        timestamp: Date.now(),
        timeStr: latestTimeStr,
        dateStr,
        type: isAcceptedAbove ? 'Previous Day Level Reached' : 'Testing Previous Day VAH',
        price: prevLevels.vah,
        details: isAcceptedAbove
          ? `Price accepted above Previous Day VAH (${prevLevels.vah.toFixed(5)}). Bullish acceptance above prior value area.`
          : `Price (${currentPrice.toFixed(5)}) reaching Previous Day VAH (${prevLevels.vah.toFixed(5)}). Key overhead resistance.`,
        severity: isAcceptedAbove ? 'critical' : 'high',
      });
    }

    // Check Previous Day VAL
    const valDistPips = Math.abs(currentPrice - prevLevels.val) / pipVal;
    const isTestingPrevVAL = valDistPips <= 7 || (sessionHigh >= prevLevels.val && sessionLow <= prevLevels.val);
    if (isTestingPrevVAL) {
      const isAcceptedBelow = currentPrice < prevLevels.val - stepSize;
      events.push({
        id: `prev-val-test-${Date.now()}`,
        timestamp: Date.now(),
        timeStr: latestTimeStr,
        dateStr,
        type: isAcceptedBelow ? 'Previous Day Level Reached' : 'Testing Previous Day VAL',
        price: prevLevels.val,
        details: isAcceptedBelow
          ? `Price accepted below Previous Day VAL (${prevLevels.val.toFixed(5)}). Bearish acceptance below prior value area.`
          : `Price (${currentPrice.toFixed(5)}) reaching Previous Day VAL (${prevLevels.val.toFixed(5)}). Key lower support level.`,
        severity: isAcceptedBelow ? 'critical' : 'high',
      });
    }

    // Check Previous Day POC
    const pocDistPips = Math.abs(currentPrice - prevLevels.poc) / pipVal;
    const isTestingPrevPOC = pocDistPips <= 7 || (sessionHigh >= prevLevels.poc && sessionLow <= prevLevels.poc);
    if (isTestingPrevPOC) {
      events.push({
        id: `prev-poc-test-${Date.now()}`,
        timestamp: Date.now(),
        timeStr: latestTimeStr,
        dateStr,
        type: 'Testing Previous Day POC',
        price: prevLevels.poc,
        details: `Price (${currentPrice.toFixed(5)}) reaching Previous Day Point of Control (${prevLevels.poc.toFixed(5)}). Primary fair value node.`,
        severity: 'high',
      });
    }
  }

  // IB Breakout
  if (close > ibHigh) {
    events.push({
      id: `ib-break-high-${Date.now()}`,
      timestamp: Date.now(),
      timeStr: latestTimeStr,
      dateStr,
      type: 'Initial Balance Breakout',
      price: close,
      details: `Price accepted above Initial Balance High (${ibHigh.toFixed(5)}). Bullish expansion.`,
      severity: 'high',
    });
  } else if (close < ibLow) {
    events.push({
      id: `ib-break-low-${Date.now()}`,
      timestamp: Date.now(),
      timeStr: latestTimeStr,
      dateStr,
      type: 'Initial Balance Breakout',
      price: close,
      details: `Price accepted below Initial Balance Low (${ibLow.toFixed(5)}). Bearish expansion.`,
      severity: 'high',
    });
  }

  // Value Acceptance
  if (close > vahPrice) {
    events.push({
      id: `value-accept-high-${Date.now()}`,
      timestamp: Date.now(),
      timeStr: latestTimeStr,
      dateStr,
      type: 'Acceptance Above Value',
      price: close,
      details: `Sustained auction above VAH (${vahPrice.toFixed(5)}). Buyers in control.`,
      severity: 'critical',
    });
  } else if (close < valPrice) {
    events.push({
      id: `value-accept-low-${Date.now()}`,
      timestamp: Date.now(),
      timeStr: latestTimeStr,
      dateStr,
      type: 'Acceptance Below Value',
      price: close,
      details: `Sustained auction below VAL (${valPrice.toFixed(5)}). Sellers in control.`,
      severity: 'critical',
    });
  }

  // Single Prints
  if (singlePrintPrices.length > 0) {
    events.push({
      id: `single-prints-${Date.now()}`,
      timestamp: Date.now(),
      timeStr: latestTimeStr,
      dateStr,
      type: 'Single Prints',
      price: singlePrintPrices[0],
      details: `Detected ${singlePrintPrices.length} Single Print levels indicating high directional velocity.`,
      severity: 'warning',
    });
  }

  // Poor High/Low
  if (poorHigh) {
    events.push({
      id: `poor-high-${Date.now()}`,
      timestamp: Date.now(),
      timeStr: latestTimeStr,
      dateStr,
      type: 'Poor High',
      price: sessionHigh,
      details: `Poor High at ${sessionHigh.toFixed(5)}. Unfinished auction likely to be retested.`,
      severity: 'warning',
    });
  }
  if (poorLow) {
    events.push({
      id: `poor-low-${Date.now()}`,
      timestamp: Date.now(),
      timeStr: latestTimeStr,
      dateStr,
      type: 'Poor Low',
      price: sessionLow,
      details: `Poor Low at ${sessionLow.toFixed(5)}. Unfinished auction likely to be retested.`,
      severity: 'warning',
    });
  }

  // 11. Profile Quality Engine Scoring (Max 100) - Prompt 5
  // Breakdown:
  // 1. Trend Alignment (20)
  // 2. ATR Expansion (15)
  // 3. POC Migration (15)
  // 4. Acceptance Outside Value (15)
  // 5. Range Extension (10)
  // 6. Profile Shape Quality (10)
  // 7. Single Prints (5)
  // 8. Excess (5)
  // 9. Value Migration (5)
  // 10. Initial Balance Break (5)

  let trendAlignmentScore = 5;
  if ((close > open && close > vahPrice) || (close < open && close < valPrice)) {
    trendAlignmentScore = 20;
  } else if ((close > open && close > pocPrice) || (close < open && close < pocPrice)) {
    trendAlignmentScore = 14;
  } else if ((close > open && close > open) || (close < open && close < open)) {
    trendAlignmentScore = 10;
  }

  const atrExpansionScore = Math.min(15, Math.round(rangeExpansionRatio * 10));

  let pocMigrationScore = 5;
  if (pocRelativePosition >= 0.70 || pocRelativePosition <= 0.30) {
    pocMigrationScore = 15;
  } else if (pocRelativePosition >= 0.60 || pocRelativePosition <= 0.40) {
    pocMigrationScore = 10;
  }

  let valueAcceptanceScore = 3;
  if (close > vahPrice || close < valPrice) {
    valueAcceptanceScore = 15;
  } else if (close >= valPrice && close <= vahPrice && Math.abs(close - pocPrice) / (vahPrice - valPrice || 1) > 0.3) {
    valueAcceptanceScore = 8;
  }

  let rangeExtensionScore = 2;
  if (sessionHigh > ibHigh && sessionLow < ibLow) {
    rangeExtensionScore = 10;
  } else if (sessionHigh > ibHigh || sessionLow < ibLow) {
    rangeExtensionScore = 7;
  }

  let profileShapeScore = 5;
  if (profileShape === 'Trend Day') profileShapeScore = 10;
  else if (profileShape === 'P Profile' || profileShape === 'b Profile') profileShapeScore = 9;
  else if (profileShape === 'Double Distribution') profileShapeScore = 8;
  else if (profileShape === 'D Profile') profileShapeScore = 6;

  const singlePrintsScore = singlePrintPrices.length > 0 ? 5 : 0;
  const excessScore = (excessHigh || excessLow) ? 5 : 0;

  let valueMigrationScore = 2;
  if (vahPrice > open + stepSize || valPrice < open - stepSize) {
    valueMigrationScore = 5;
  }

  let ibBreakScore = 1;
  if (close > ibHigh || close < ibLow) {
    ibBreakScore = 5;
  }

  const totalMarketScore = Math.min(
    100,
    Math.max(
      15,
      trendAlignmentScore +
        atrExpansionScore +
        pocMigrationScore +
        valueAcceptanceScore +
        rangeExtensionScore +
        profileShapeScore +
        singlePrintsScore +
        excessScore +
        valueMigrationScore +
        ibBreakScore
    )
  );

  const qualityRating: QualityRating = getQualityRating(totalMarketScore);

  // Bias Determination
  let bias: AuctionBias = 'Neutral';
  if (totalMarketScore >= 85) {
    bias = close > open ? 'Strong Bullish' : 'Strong Bearish';
  } else if (totalMarketScore >= 65) {
    bias = close > open ? 'Bullish' : 'Bearish';
  } else {
    bias = 'Neutral';
  }

  const statusText =
    totalMarketScore >= 85
      ? `${qualityRating} (${totalMarketScore}/100) ${bias} Imbalance`
      : totalMarketScore >= 75
      ? `Good (${totalMarketScore}/100) ${bias} Opportunity`
      : `Developing ${profileShape}`;

  return {
    symbol,
    dateStr,
    isDeveloping,
    open,
    high: sessionHigh,
    low: sessionLow,
    close,
    sessionRangePips,
    poc: pocPrice,
    vah: vahPrice,
    val: valPrice,
    valueArea70: {
      high: vahPrice,
      low: valPrice,
      totalTPOs: accumulatedTPOs,
    },
    vpoc: vpocPrice,
    vvah: vvahPrice,
    vval: vvalPrice,
    totalVolume,
    volumeArea70: {
      high: vvahPrice,
      low: vvalPrice,
      totalVolume: accumulatedVolume,
    },
    initialBalance: {
      high: ibHigh,
      low: ibLow,
      rangePips: ibRangePips,
      brackets: ['A', 'B'],
    },
    openingRange: {
      high: openingRangeHigh,
      low: openingRangeLow,
    },
    developingPOC: pocPrice,
    developingVAH: vahPrice,
    developingVAL: valPrice,
    atr14Pips,
    averageDailyRangePips: Math.round(atr14Pips * 1.15),
    rangeExpansionRatio,
    profileWidth,
    profileHeightPips: sessionRangePips,
    tpoCountTotal: totalTPOs,
    timeAtPriceMap: {},
    profileShape,
    events,
    singlePrints: singlePrintPrices,
    poorHigh,
    poorLow,
    excessHigh,
    excessLow,
    rows: rawRows,
    marketScore: totalMarketScore,
    qualityRating,
    scoreBreakdown: {
      trendAlignment: trendAlignmentScore,
      atrExpansion: atrExpansionScore,
      pocMigration: pocMigrationScore,
      valueAcceptance: valueAcceptanceScore,
      rangeExtension: rangeExtensionScore,
      profileShapeScore,
      singlePrints: singlePrintsScore,
      excess: excessScore,
      valueMigration: valueMigrationScore,
      ibBreak: ibBreakScore,
    },
    bias,
    statusText,
    hasPrevDayProfileComplete,
    prevDayLevels: prevLevels || undefined,
  };
}

export function getQualityRating(score: number): QualityRating {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 60) return 'Average';
  return 'Poor';
}

export function getShortShapeName(shape: ProfileShape): string {
  switch (shape) {
    case 'P Profile':
      return 'P';
    case 'b Profile':
      return 'b';
    case 'D Profile':
      return 'D';
    case 'Double Distribution':
      return 'Double';
    case 'Trend Day':
      return 'Trend';
    case 'Neutral Day':
      return 'Neutral';
    default:
      return 'D';
  }
}

/**
 * Converts a archived DailyProfileRecord into a complete data-driven MarketProfileData object
 */
export function profileRecordToMarketProfile(
  record: DailyProfileRecord,
  symbol: SymbolCode = 'GBPUSD'
): MarketProfileData {
  if (record.candles && record.candles.length > 0) {
    return buildMarketProfile(symbol, record.candles, record.tradingDate, false);
  }

  const symbolConfig = SYMBOL_CONFIGS[symbol] || SYMBOL_CONFIGS.GBPUSD;
  const isUp = record.close >= record.open;
  const score = record.marketScore || 50;
  const qualityRating = getQualityRating(score);

  const totalTPOs = record.histogramData ? record.histogramData.reduce((s, r) => s + r.tpoCount, 0) : 0;
  const valueAreaTPOs = record.histogramData
    ? record.histogramData.filter((r) => r.isValueArea).reduce((s, r) => s + r.tpoCount, 0)
    : 0;

  // Process Volume Profile on archived rows if needed
  const rawRows = record.histogramData ? record.histogramData.map((r) => ({ ...r })) : [];
  if (rawRows.length > 0 && !rawRows.some((r) => r.isVPOC)) {
    let maxV = -1;
    let vpocIdx = -1;
    rawRows.forEach((r, idx) => {
      if (r.volume > maxV) {
        maxV = r.volume;
        vpocIdx = idx;
      }
    });
    if (vpocIdx >= 0) {
      rawRows[vpocIdx].isVPOC = true;
      const totV = rawRows.reduce((s, r) => s + r.volume, 0);
      const targetV = Math.ceil(totV * 0.70);
      let accV = rawRows[vpocIdx].volume;
      rawRows[vpocIdx].isVolumeValueArea = true;

      let upperIdx = vpocIdx - 1;
      let lowerIdx = vpocIdx + 1;
      while (accV < targetV && (upperIdx >= 0 || lowerIdx < rawRows.length)) {
        const uVol = upperIdx >= 0 ? rawRows[upperIdx].volume : -1;
        const lVol = lowerIdx < rawRows.length ? rawRows[lowerIdx].volume : -1;
        if (uVol >= lVol && upperIdx >= 0) {
          accV += rawRows[upperIdx].volume;
          rawRows[upperIdx].isVolumeValueArea = true;
          upperIdx--;
        } else if (lowerIdx < rawRows.length) {
          accV += rawRows[lowerIdx].volume;
          rawRows[lowerIdx].isVolumeValueArea = true;
          lowerIdx++;
        } else if (upperIdx >= 0) {
          accV += rawRows[upperIdx].volume;
          rawRows[upperIdx].isVolumeValueArea = true;
          upperIdx--;
        } else {
          break;
        }
      }
    }
  }

  const vpoc = record.vpoc || rawRows.find((r) => r.isVPOC)?.price || record.poc;
  const volVaRows = rawRows.filter((r) => r.isVolumeValueArea);
  const vvah = record.vvah || (volVaRows.length > 0 ? Math.max(...volVaRows.map((r) => r.price)) : record.vah);
  const vval = record.vval || (volVaRows.length > 0 ? Math.min(...volVaRows.map((r) => r.price)) : record.val);
  const totalVolume = record.totalVolume || rawRows.reduce((s, r) => s + r.volume, 0);
  const volVaTotal = volVaRows.reduce((s, r) => s + r.volume, 0);

  const profileWidth = rawRows.length > 0
    ? Math.max(...rawRows.map((r) => r.tpoCount), 1)
    : 1;

  const singlePrints = record.histogramData
    ? record.histogramData.filter((r) => r.isSinglePrint).map((r) => r.price)
    : [];

  const topRow = record.histogramData?.[0];
  const bottomRow = record.histogramData?.[record.histogramData.length - 1];

  let bias: AuctionBias = 'Neutral';
  if (score >= 85) {
    bias = isUp ? 'Strong Bullish' : 'Strong Bearish';
  } else if (score >= 65) {
    bias = isUp ? 'Bullish' : 'Bearish';
  }

  // Calculate proportional score breakdown matching the actual score
  const scoreRatio = score / 100;
  const scoreBreakdown = {
    trendAlignment: Math.round(20 * scoreRatio),
    atrExpansion: Math.round(15 * scoreRatio),
    pocMigration: Math.round(15 * scoreRatio),
    valueAcceptance: Math.round(15 * scoreRatio),
    rangeExtension: Math.round(10 * scoreRatio),
    profileShapeScore: Math.round(10 * scoreRatio),
    singlePrints: Math.round(5 * scoreRatio),
    excess: Math.round(5 * scoreRatio),
    valueMigration: Math.round(5 * scoreRatio),
    ibBreak: Math.round(5 * scoreRatio),
  };

  return {
    symbol,
    dateStr: record.tradingDate,
    isDeveloping: false,
    open: record.open,
    high: record.high,
    low: record.low,
    close: record.close,
    sessionRangePips: record.dailyRangePips,
    poc: record.poc,
    vah: record.vah,
    val: record.val,
    valueArea70: {
      high: record.vah,
      low: record.val,
      totalTPOs: valueAreaTPOs || Math.round(totalTPOs * 0.7),
    },
    vpoc,
    vvah,
    vval,
    totalVolume,
    volumeArea70: {
      high: vvah,
      low: vval,
      totalVolume: volVaTotal,
    },
    initialBalance: {
      high: record.ibHigh,
      low: record.ibLow,
      rangePips: Math.round(Math.abs(record.ibHigh - record.ibLow) / symbolConfig.pipValue),
      brackets: ['A', 'B'],
    },
    openingRange: {
      high: record.openingRangeHigh,
      low: record.openingRangeLow,
    },
    developingPOC: record.poc,
    developingVAH: record.vah,
    developingVAL: record.val,
    atr14Pips: record.atr14Pips,
    averageDailyRangePips: Math.round(record.atr14Pips * 1.15),
    rangeExpansionRatio: Number((record.dailyRangePips / Math.max(1, record.atr14Pips)).toFixed(2)),
    profileWidth,
    profileHeightPips: record.dailyRangePips,
    tpoCountTotal: totalTPOs,
    timeAtPriceMap: {},
    profileShape: record.profileShape,
    events: [],
    singlePrints,
    poorHigh: topRow ? topRow.isPoorHighLow : false,
    poorLow: bottomRow ? bottomRow.isPoorHighLow : false,
    excessHigh: topRow ? topRow.isExcess : false,
    excessLow: bottomRow ? bottomRow.isExcess : false,
    rows: rawRows.length > 0 ? rawRows : record.histogramData || [],
    marketScore: score,
    qualityRating,
    scoreBreakdown,
    bias,
    statusText: `Archived Profile (${record.profileShape}) - Score: ${score}/100`,
  };
}
