import {
  Candle,
  SwingPoint,
  FvgZone,
  OrderBlock,
  PriceGap,
  LiquiditySweep,
  SupportResistance,
  TechnicalIndicators,
  MarketStructureType,
  TradeRecommendation,
  SmcScenario,
} from '../types';
import { roundToIdxTick, addIdxTicks, getIdxTickSize, countIdxTicksBetween } from './idxTickRules';
import { filterTradingDays } from './elliottWaveEngine';

/**
 * Calculates Moving Average
 */
export function calculateMA(candles: Candle[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  if (!candles || candles.length === 0) return result;
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sum += candles[j]?.close || 0;
      }
      result.push(sum / period);
    }
  }
  return result;
}

/**
 * Calculates Volume MA
 */
export function calculateVolumeMA(candles: Candle[], period: number = 20): (number | null)[] {
  const result: (number | null)[] = [];
  if (!candles || candles.length === 0) return result;
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sum += candles[j]?.volume || 0;
      }
      result.push(sum / period);
    }
  }
  return result;
}

/**
 * Calculates Volume Weighted Average Price (VWAP)
 */
export function calculateVWAP(candles: Candle[]): (number | null)[] {
  let cumulativeTypicalPriceVolume = 0;
  let cumulativeVolume = 0;
  const result: (number | null)[] = [];
  if (!candles || candles.length === 0) return result;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (!c) {
      result.push(null);
      continue;
    }
    const typicalPrice = (c.high + c.low + c.close) / 3;
    const tpv = typicalPrice * c.volume;
    cumulativeTypicalPriceVolume += tpv;
    cumulativeVolume += c.volume;

    if (cumulativeVolume > 0) {
      result.push(cumulativeTypicalPriceVolume / cumulativeVolume);
    } else {
      result.push(null);
    }
  }

  return result;
}

/**
 * Detects Swings (HH, HL, LH, LL)
 */
export function detectSwings(candles: Candle[], lookback: number = 3): SwingPoint[] {
  const swings: SwingPoint[] = [];

  for (let i = lookback; i < candles.length - lookback; i++) {
    const currentHigh = candles[i].high;
    const currentLow = candles[i].low;

    let isHigh = true;
    let isLow = true;

    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue;
      if (candles[j].high >= currentHigh) isHigh = false;
      if (candles[j].low <= currentLow) isLow = false;
    }

    if (isHigh) {
      // Determine HH or LH based on previous swing high
      const prevHigh = swings.filter((s) => s.type === 'HH' || s.type === 'LH').pop();
      const type: 'HH' | 'LH' = !prevHigh || currentHigh > prevHigh.price ? 'HH' : 'LH';
      swings.push({
        index: i,
        time: candles[i].time,
        price: currentHigh,
        type,
      });
    } else if (isLow) {
      // Determine HL or LL based on previous swing low
      const prevLow = swings.filter((s) => s.type === 'HL' || s.type === 'LL').pop();
      const type: 'HL' | 'LL' = !prevLow || currentLow > prevLow.price ? 'HL' : 'LL';
      swings.push({
        index: i,
        time: candles[i].time,
        price: currentLow,
        type,
      });
    }
  }

  return swings;
}



/**
 * Detects Fair Value Gaps (FVG)
 * Requirement: FVG is considered valid ONLY if the displacement candle (middle candle c2)
 * body height is at least 5 ticks / pips according to IDX tick rules (and handles index points for IHSG).
 */
export function detectFVGs(candles: Candle[], isIhsg: boolean = false): FvgZone[] {
  const fvgs: FvgZone[] = [];
  if (!candles || candles.length < 3) return fvgs;

  for (let i = 2; i < candles.length; i++) {
    const c1 = candles[i - 2];
    const c2 = candles[i - 1]; // Displacement candle
    const c3 = candles[i];

    // Bullish FVG: Candle 1 High < Candle 3 Low (3-bar gap up)
    if (c3.low > c1.high) {
      const bodyTicks = countIdxTicksBetween(c2.open, c2.close, isIhsg);
      const isBullishBody = c2.close > c2.open && bodyTicks >= 5;

      if (isBullishBody) {
        let gapTop = Math.round(c3.low);
        let gapBottom = Math.round(c1.high);
        let isFullyClosedByBody = false;

        // Check if subsequent candles mitigated or closed this gap
        for (let j = i + 1; j < candles.length; j++) {
          const c = candles[j];
          const bodyLow = Math.min(c.open, c.close);

          // 1. Full closure by body: Candle body closes/covers at or below gapBottom
          if (bodyLow <= gapBottom) {
            isFullyClosedByBody = true;
            break;
          }

          // 2. Partial closure by body: Candle body enters gap, reducing the top of the gap to bodyLow
          if (bodyLow < gapTop && bodyLow > gapBottom) {
            gapTop = Math.round(bodyLow);
          }
        }

        // If not fully closed by body and a valid gap remains, keep the remaining FVG
        if (!isFullyClosedByBody && gapTop > gapBottom) {
          fvgs.push({
            id: `fvg-bull-${i}`,
            type: 'bullish',
            top: gapTop,
            bottom: gapBottom,
            startIndex: i - 2,
            endIndex: candles.length - 1,
            mitigated: false,
            time: candles[i - 1].time,
          });
        }
      }
    }

    // Bearish FVG: Candle 1 Low > Candle 3 High (3-bar gap down)
    if (c1.low > c3.high) {
      const bodyTicks = countIdxTicksBetween(c2.close, c2.open, isIhsg);
      const isBearishBody = c2.open > c2.close && bodyTicks >= 5;

      if (isBearishBody) {
        let gapTop = Math.round(c1.low);
        let gapBottom = Math.round(c3.high);
        let isFullyClosedByBody = false;

        for (let j = i + 1; j < candles.length; j++) {
          const c = candles[j];
          const bodyHigh = Math.max(c.open, c.close);

          // 1. Full closure by body: Candle body reaches or exceeds gapTop
          if (bodyHigh >= gapTop) {
            isFullyClosedByBody = true;
            break;
          }

          // 2. Partial closure by body: Candle body enters gap from below, raising gapBottom
          if (bodyHigh > gapBottom && bodyHigh < gapTop) {
            gapBottom = Math.round(bodyHigh);
          }
        }

        if (!isFullyClosedByBody && gapTop > gapBottom) {
          fvgs.push({
            id: `fvg-bear-${i}`,
            type: 'bearish',
            top: gapTop,
            bottom: gapBottom,
            startIndex: i - 2,
            endIndex: candles.length - 1,
            mitigated: false,
            time: candles[i - 1].time,
          });
        }
      }
    }
  }

  return fvgs;
}

/**
 * Detects Ordinary Price Gaps (Overnight / Discontinuity Jump Gaps)
 * - Bullish Gap (Gap Up): Day A close (or high) < Day B low (e.g. Day A close = 700, Day B open = 740 & low = 710 -> gap up 700-710)
 * - Bearish Gap (Gap Down): Day A close (or low) > Day B high
 */
export function detectPriceGaps(candles: Candle[]): PriceGap[] {
  const gaps: PriceGap[] = [];
  if (!candles || candles.length < 2) return gaps;

  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1]; // Day A
    const curr = candles[i];     // Day B

    // Bullish Gap (Gap Up): e.g. Day A close = 700, Day B open = 740, low = 710 -> gap up at 700-710
    if (curr.low > prev.close) {
      const top = Math.round(curr.low);
      const bottom = Math.round(prev.close);
      
      if (top > bottom) {
        let mitigated = false;
        let endIndex = candles.length - 1;

        for (let j = i + 1; j < candles.length; j++) {
          if (candles[j].low <= bottom) {
            mitigated = true;
            endIndex = j;
            break;
          }
        }

        gaps.push({
          id: `gap-bull-${i}`,
          type: 'bullish',
          top,
          bottom,
          startIndex: i - 1,
          endIndex: mitigated ? endIndex : candles.length - 1,
          mitigated,
          time: curr.time,
        });
      }
    }

    // Bearish Gap (Gap Down): e.g. Day A close = 700, Day B open = 660, high = 680 -> gap down at 680-700
    if (curr.high < prev.close) {
      const top = Math.round(prev.close);
      const bottom = Math.round(curr.high);

      if (top > bottom) {
        let mitigated = false;
        let endIndex = candles.length - 1;

        for (let j = i + 1; j < candles.length; j++) {
          if (candles[j].high >= top) {
            mitigated = true;
            endIndex = j;
            break;
          }
        }

        gaps.push({
          id: `gap-bear-${i}`,
          type: 'bearish',
          top,
          bottom,
          startIndex: i - 1,
          endIndex: mitigated ? endIndex : candles.length - 1,
          mitigated,
          time: curr.time,
        });
      }
    }
  }

  return gaps.filter((g) => !g.mitigated);
}

/**
 * Detects Order Blocks according to strict SMC technical rules:
 * 1. Bullish Order Block (OB Buy):
 *    - Anatomi Candle: Candle Bearish (warna merah/turun terakhir: close <= open) sebelum pergerakan impulsif naik.
 *    - Zona Ditarik: Dari Open sampai Close (mencakup Low/ekor bawah). top = max(open, close), bottom = c.low.
 *    - Pemicu (BOS): Candle impulsif wajib melakukan Break of Structure (BOS) ke atas (harga close di atas High sebelumnya).
 *    - Imbalance (FVG): Harus ada Fair Value Gap (FVG) atau dorongan impulsif setelah OB terbentuk.
 *    - Stop Loss (SL) & Invalidation: Ditempatkan di bawah c.low. Jika harga CLOSE di bawah Low, OB batal/invalid.
 * 
 * 2. Bearish Order Block (OB Sell):
 *    - Anatomi Candle: Candle Bullish (warna hijau/naik terakhir: close >= open) sebelum pergerakan impulsif turun.
 *    - Zona Ditarik: Dari Open sampai Close (mencakup High/ekor atas). top = c.high, bottom = min(open, close).
 *    - Pemicu (BOS): Candle impulsif wajib melakukan Break of Structure (BOS) ke bawah (harga close di bawah Low sebelumnya).
 *    - Imbalance (FVG): Harus ada Fair Value Gap (FVG) ke bawah setelah OB terbentuk.
 *    - Stop Loss (SL) & Invalidation: Ditempatkan di atas c.high. Jika harga CLOSE di atas High, OB batal/invalid.
 */
/**
 * Helper to check if a candle satisfies Bullish Order Block criteria:
 * - Lower shadow (bottom of body down to low) >= body (abs(close - open)), OR
 * - Lower shadow length is at least 5 ticks (inclusive of tick boundaries e.g. 204-202-200-199-198)
 */
export function isValidBullishObCandle(c: Candle): boolean {
  if (!c) return false;
  const bottomBody = Math.min(c.open, c.close);
  const body = Math.abs(c.close - c.open);
  const lowerShadow = bottomBody - c.low;
  if (lowerShadow < 0) return false;

  const shadowTicks = countIdxTicksBetween(bottomBody, c.low);
  const reachedMinTickTarget = c.low <= addIdxTicks(bottomBody, -4);

  return lowerShadow >= body || shadowTicks >= 4 || reachedMinTickTarget;
}

/**
 * Helper to check if a candle satisfies Bearish Order Block criteria:
 * - Upper shadow (high down to top of body) >= body (abs(open - close)), OR
 * - Upper shadow length is at least 5 ticks (inclusive of tick boundaries)
 */
export function isValidBearishObCandle(c: Candle): boolean {
  if (!c) return false;
  const topBody = Math.max(c.open, c.close);
  const body = Math.abs(c.close - c.open);
  const upperShadow = c.high - topBody;
  if (upperShadow < 0) return false;

  const shadowTicks = countIdxTicksBetween(c.high, topBody);
  const reachedMinTickTarget = c.high >= addIdxTicks(topBody, 4);

  return upperShadow >= body || shadowTicks >= 4 || reachedMinTickTarget;
}

export function detectOrderBlocks(
  candles: Candle[],
  swings: SwingPoint[],
  fvgs: FvgZone[],
  volumeMa: (number | null)[]
): OrderBlock[] {
  const orderBlocks: OrderBlock[] = [];
  if (!candles || candles.length < 3) return orderBlocks;

  const usedBullIndices = new Set<number>();
  const usedBearIndices = new Set<number>();

  // 1. Bullish Order Blocks (Demand OB): Origin base candle before an upward displacement/rally
  for (let i = 1; i < candles.length - 2; i++) {
    const c = candles[i];
    if (!isValidBullishObCandle(c)) continue;

    // Check if subsequent 1-4 candles produce strong expansion or FVG
    const hasAssociatedFvg = fvgs.some(
      (f) => f.type === 'bullish' && f.startIndex >= i && f.startIndex <= i + 4
    );
    const hasImpulsiveRally = candles[i + 1] && candles[i + 2] && (
      candles[i + 2].close > c.high * 1.02 || (candles[i + 1].close > c.close && candles[i + 2].close > candles[i + 1].close)
    );

    if ((hasAssociatedFvg || hasImpulsiveRally) && !usedBullIndices.has(i)) {
      usedBullIndices.add(i);
      const obTop = Math.round(Math.max(c.open, c.close));
      const obBottom = Math.round(c.low);

      let mitigated = false;
      let endIndex = candles.length - 1;

      // Invalidation: Price CLOSES below c.low
      for (let j = i + 1; j < candles.length; j++) {
        if (candles[j].close < c.low) {
          mitigated = true;
          endIndex = j;
          break;
        }
      }

      const vMa = volumeMa[i];
      const volumeSpike = vMa !== null && c.volume > vMa * 1.3;

      orderBlocks.push({
        id: `ob-bull-${i}`,
        type: 'bullish',
        top: obTop,
        bottom: obBottom,
        startIndex: i,
        endIndex: mitigated ? endIndex : candles.length - 1,
        mitigated,
        time: c.time,
        volumeSpike,
      });
    }
  }

  // 2. Bearish Order Blocks (Supply OB): Origin base candle before a downward displacement
  for (let i = 1; i < candles.length - 2; i++) {
    const c = candles[i];
    if (!isValidBearishObCandle(c)) continue;

    const hasAssociatedFvg = fvgs.some(
      (f) => f.type === 'bearish' && f.startIndex >= i && f.startIndex <= i + 4
    );
    const hasImpulsiveDrop = candles[i + 1] && candles[i + 2] && (
      candles[i + 2].close < c.low * 0.98 || (candles[i + 1].close < c.close && candles[i + 2].close < candles[i + 1].close)
    );

    if ((hasAssociatedFvg || hasImpulsiveDrop) && !usedBearIndices.has(i)) {
      usedBearIndices.add(i);
      const obTop = Math.round(c.high);
      const obBottom = Math.round(Math.min(c.open, c.close));

      let mitigated = false;
      let endIndex = candles.length - 1;

      // Invalidation: Price CLOSES above c.high
      for (let j = i + 1; j < candles.length; j++) {
        if (candles[j].close > c.high) {
          mitigated = true;
          endIndex = j;
          break;
        }
      }

      const vMa = volumeMa[i];
      const volumeSpike = vMa !== null && c.volume > vMa * 1.3;

      orderBlocks.push({
        id: `ob-bear-${i}`,
        type: 'bearish',
        top: obTop,
        bottom: obBottom,
        startIndex: i,
        endIndex: mitigated ? endIndex : candles.length - 1,
        mitigated,
        time: c.time,
        volumeSpike,
      });
    }
  }

  // 3. Fallback for major swing points
  for (const swing of swings) {
    const sIndex = swing.index;
    if (sIndex < 0 || sIndex >= candles.length) continue;

    if ((swing.type === 'HL' || swing.type === 'LL') && !usedBullIndices.has(sIndex)) {
      const c = candles[sIndex];
      if (isValidBullishObCandle(c)) {
        usedBullIndices.add(sIndex);
        const obTop = Math.round(Math.max(c.open, c.close));
        const obBottom = Math.round(c.low);

        let mitigated = false;
        let endIndex = candles.length - 1;
        for (let j = sIndex + 1; j < candles.length; j++) {
          if (candles[j].close < c.low) {
            mitigated = true;
            endIndex = j;
            break;
          }
        }

        orderBlocks.push({
          id: `ob-bull-swing-${sIndex}`,
          type: 'bullish',
          top: obTop,
          bottom: obBottom,
          startIndex: sIndex,
          endIndex: mitigated ? endIndex : candles.length - 1,
          mitigated,
          time: c.time,
          volumeSpike: false,
        });
      }
    }

    if ((swing.type === 'HH' || swing.type === 'LH') && !usedBearIndices.has(sIndex)) {
      const c = candles[sIndex];
      if (isValidBearishObCandle(c)) {
        usedBearIndices.add(sIndex);
        const obTop = Math.round(c.high);
        const obBottom = Math.round(Math.min(c.open, c.close));

        let mitigated = false;
        let endIndex = candles.length - 1;
        for (let j = sIndex + 1; j < candles.length; j++) {
          if (candles[j].close > c.high) {
            mitigated = true;
            endIndex = j;
            break;
          }
        }

        orderBlocks.push({
          id: `ob-bear-swing-${sIndex}`,
          type: 'bearish',
          top: obTop,
          bottom: obBottom,
          startIndex: sIndex,
          endIndex: mitigated ? endIndex : candles.length - 1,
          mitigated,
          time: c.time,
          volumeSpike: false,
        });
      }
    }
  }

  return orderBlocks.filter((ob) => !ob.mitigated);
}

/**
 * Detects Liquidity Sweeps
 */
export function detectLiquiditySweeps(candles: Candle[], swings: SwingPoint[]): LiquiditySweep[] {
  const sweeps: LiquiditySweep[] = [];

  for (const swing of swings) {
    for (let i = swing.index + 2; i < candles.length; i++) {
      const c = candles[i];

      // BSL Sweep: High pierces swing high, but close is below swing high
      if ((swing.type === 'HH' || swing.type === 'LH') && c.high > swing.price && c.close < swing.price) {
        sweeps.push({
          id: `bsl-${i}`,
          type: 'BSL',
          price: swing.price,
          index: i,
          time: c.time,
          swept: true,
        });
        break;
      }

      // SSL Sweep: Low pierces swing low, but close is above swing low
      if ((swing.type === 'HL' || swing.type === 'LL') && c.low < swing.price && c.close > swing.price) {
        sweeps.push({
          id: `ssl-${i}`,
          type: 'SSL',
          price: swing.price,
          index: i,
          time: c.time,
          swept: true,
        });
        break;
      }
    }
  }

  return sweeps;
}

/**
 * Detects Support & Resistance level clusters
 */
export function detectSupportResistance(candles: Candle[]): SupportResistance[] {
  const levels: SupportResistance[] = [];
  const prices: { price: number; type: 'support' | 'resistance'; index: number }[] = [];

  // Gather pivot highs and lows
  for (let i = 2; i < candles.length - 2; i++) {
    if (candles[i].high > candles[i - 1].high && candles[i].high > candles[i + 1].high) {
      prices.push({ price: candles[i].high, type: 'resistance', index: i });
    }
    if (candles[i].low < candles[i - 1].low && candles[i].low < candles[i + 1].low) {
      prices.push({ price: candles[i].low, type: 'support', index: i });
    }
  }

  // Cluster prices within 1.5% distance
  const tolerancePercent = 0.015;

  prices.forEach((item) => {
    const existing = levels.find(
      (l) => l.type === item.type && Math.abs(l.price - item.price) / l.price <= tolerancePercent
    );

    if (existing) {
      existing.strength += 1;
      existing.endIndex = Math.max(existing.endIndex, item.index);
    } else {
      levels.push({
        id: `sr-${item.type}-${item.index}`,
        type: item.type,
        price: Math.round(item.price),
        strength: 1,
        startIndex: item.index,
        endIndex: candles.length - 1,
      });
    }
  });

  return levels.filter((l) => l.strength >= 2);
}

/**
 * Determines Market Structure (Rallying, Sideways, Downtrend)
 */
export function determineMarketStructure(candles: Candle[], swings: SwingPoint[]): MarketStructureType {
  if (swings.length < 4) return 'SIDEWAYS';

  const recentSwings = swings.slice(-6);
  const highs = recentSwings.filter((s) => s.type === 'HH' || s.type === 'LH');
  const lows = recentSwings.filter((s) => s.type === 'HL' || s.type === 'LL');

  const hhCount = highs.filter((h) => h.type === 'HH').length;
  const hlCount = lows.filter((l) => l.type === 'HL').length;
  const llCount = lows.filter((l) => l.type === 'LL').length;

  if (hhCount >= 2 && hlCount >= 1 && llCount === 0) {
    return 'RALLYING';
  } else if (llCount >= 2) {
    return 'DOWNTREND';
  }

  return 'SIDEWAYS';
}

/**
 * Smart Money Trading Recommendation Generator based on user strategy:
 * - Position always LONG
 * - Risk Reward >= 1:1.5
 * - Profit target 10%-20%
 * - Cut loss (Stop Loss) ~3%-5%
 * - Volume confirmation required
 * - Sideways: wait at FVG, Order Block, or near Support
 * - Rallying: wait for pullback at FVG as long as NO Lower Low (LL)
 */
export function generateRecommendation(
  symbol: string,
  name: string,
  candles: Candle[],
  swings: SwingPoint[],
  fvgs: FvgZone[],
  orderBlocks: OrderBlock[],
  supports: SupportResistance[],
  volumeMa: (number | null)[],
  priceGaps: PriceGap[] = []
): TradeRecommendation {
  if (!candles || candles.length === 0) {
    return {
      symbol,
      name,
      currentPrice: 0,
      structure: 'SIDEWAYS',
      entryZone: [0, 0],
      stopLoss: 0,
      stopLossPercent: 4,
      takeProfit1: 0,
      takeProfit1Percent: 10,
      takeProfit2: 0,
      takeProfit2Percent: 20,
      riskRewardRatio: 1.5,
      volumeConfirmation: false,
      volumeRatio: 1,
      decisionReasoning: ['Loading market candlestick data...'],
      smcCatalyst: 'Loading market data',
      status: 'WAIT_VOLUME_CONFIRMATION',
      primaryZoneType: 'NONE',
      primaryZonePrice: 0,
    };
  }

  const currentCandle = candles[candles.length - 1];
  const currentPrice = currentCandle ? currentCandle.close : 0;
  const currentVolume = currentCandle ? currentCandle.volume : 0;
  const latestVolMa = (volumeMa && volumeMa.length > 0) ? (volumeMa[volumeMa.length - 1] || 1) : 1;
  const volumeRatio = latestVolMa > 0 ? currentVolume / latestVolMa : 1;
  const volumeConfirmation = volumeRatio >= 1.25;

  const isIhsg =
    symbol.toUpperCase().includes('IHSG') ||
    symbol.toUpperCase().includes('JKSE') ||
    name.toUpperCase().includes('IHSG');

  const structure = determineMarketStructure(candles, swings);

  // Unmitigated Bullish Zones
  const activeBullFvgs = fvgs.filter((f) => f.type === 'bullish' && !f.mitigated);
  const activeBullObs = orderBlocks.filter((o) => o.type === 'bullish' && !o.mitigated);
  const activeBullGaps = priceGaps.filter((g) => g.type === 'bullish' && !g.mitigated);
  const strongSupports = supports.filter((s) => s.type === 'support');

  // Check if price made recent Lower Low
  const recentLows = swings.filter((s) => s.type === 'LL').slice(-2);
  const hasRecentLL = recentLows.length > 0 && recentLows[recentLows.length - 1].index > candles.length - 15;

  let entryMin = currentPrice;
  let entryMax = currentPrice;
  let primaryZoneType: 'GAP' | 'FVG' | 'ORDER_BLOCK' | 'SUPPORT' | 'NONE' = 'NONE';
  let primaryZonePrice = currentPrice;
  const reasoning: string[] = [];

  if (structure === 'SIDEWAYS') {
    const nearestOb = activeBullObs[activeBullObs.length - 1];
    const nearestFvg = activeBullFvgs[activeBullFvgs.length - 1];
    const nearestGap = activeBullGaps[activeBullGaps.length - 1];
    const nearestSup = strongSupports[strongSupports.length - 1];

    const candidates: { type: 'ORDER_BLOCK' | 'FVG' | 'GAP' | 'SUPPORT'; min: number; max: number; dist: number; desc: string }[] = [];

    if (nearestOb) {
      candidates.push({
        type: 'ORDER_BLOCK',
        min: nearestOb.bottom,
        max: nearestOb.top,
        dist: Math.abs(currentPrice - nearestOb.top),
        desc: `Sideways consolidation. Primary entry at Demand Order Block (POI) Rp ${nearestOb.bottom.toLocaleString()} - ${nearestOb.top.toLocaleString()}`,
      });
    }
    if (nearestFvg) {
      candidates.push({
        type: 'FVG',
        min: nearestFvg.bottom,
        max: nearestFvg.top,
        dist: Math.abs(currentPrice - nearestFvg.top),
        desc: `Sideways consolidation. Primary entry at Fair Value Gap (FVG) Rp ${nearestFvg.bottom.toLocaleString()} - ${nearestFvg.top.toLocaleString()}`,
      });
    }
    if (nearestGap) {
      candidates.push({
        type: 'GAP',
        min: nearestGap.bottom,
        max: nearestGap.top,
        dist: Math.abs(currentPrice - nearestGap.top),
        desc: `Sideways consolidation. Primary entry at Bullish Price Gap Rp ${nearestGap.bottom.toLocaleString()} - ${nearestGap.top.toLocaleString()}`,
      });
    }
    if (nearestSup) {
      candidates.push({
        type: 'SUPPORT',
        min: Math.round(nearestSup.price * 0.99),
        max: Math.round(nearestSup.price * 1.01),
        dist: Math.abs(currentPrice - nearestSup.price),
        desc: `Accumulation phase near strong Support level at Rp ${nearestSup.price.toLocaleString()}`,
      });
    }

    if (candidates.length > 0) {
      candidates.sort((a, b) => a.dist - b.dist);
      const chosen = candidates[0];
      entryMin = chosen.min;
      entryMax = chosen.max;
      primaryZoneType = chosen.type;
      primaryZonePrice = chosen.max;
      reasoning.push(chosen.desc);
    } else {
      entryMin = Math.round(currentPrice * 0.98);
      entryMax = currentPrice;
      reasoning.push(`Sideways consolidation with no new FVG/OB. Accumulation range near Rp ${entryMin.toLocaleString()}`);
    }
  } else if (structure === 'RALLYING') {
    const nearestOb = activeBullObs[activeBullObs.length - 1];
    const nearestFvg = activeBullFvgs[activeBullFvgs.length - 1];
    const nearestGap = activeBullGaps[activeBullGaps.length - 1];

    if (hasRecentLL) {
      reasoning.push(`WARNING: Stock is rallying but created a new Lower Low (LL). High risk pullback setup.`);
    }

    const candidates: { type: 'ORDER_BLOCK' | 'FVG' | 'GAP'; min: number; max: number; dist: number; desc: string }[] = [];

    if (nearestOb) {
      candidates.push({
        type: 'ORDER_BLOCK',
        min: nearestOb.bottom,
        max: nearestOb.top,
        dist: Math.abs(currentPrice - nearestOb.top),
        desc: `Bullish Uptrend Rally. Primary entry at Demand Order Block (POI) Rp ${nearestOb.bottom.toLocaleString()} - ${nearestOb.top.toLocaleString()}`,
      });
    }
    if (nearestFvg && !hasRecentLL) {
      candidates.push({
        type: 'FVG',
        min: nearestFvg.bottom,
        max: nearestFvg.top,
        dist: Math.abs(currentPrice - nearestFvg.top),
        desc: `Bullish Uptrend Rally. Primary entry at Fair Value Gap (FVG) Rp ${nearestFvg.bottom.toLocaleString()} - ${nearestFvg.top.toLocaleString()}`,
      });
    }
    if (nearestGap && !hasRecentLL) {
      candidates.push({
        type: 'GAP',
        min: nearestGap.bottom,
        max: nearestGap.top,
        dist: Math.abs(currentPrice - nearestGap.top),
        desc: `Bullish Uptrend Rally. Primary entry at Bullish Price Gap Rp ${nearestGap.bottom.toLocaleString()} - ${nearestGap.top.toLocaleString()}`,
      });
    }

    if (candidates.length > 0) {
      candidates.sort((a, b) => a.dist - b.dist);
      const chosen = candidates[0];
      // Only treat as primary POI if it is within reasonable swing distance (< 15% from current price)
      if (chosen.dist <= currentPrice * 0.15) {
        entryMin = chosen.min;
        entryMax = chosen.max;
        primaryZoneType = chosen.type;
        primaryZonePrice = chosen.max;
        reasoning.push(chosen.desc);
      } else {
        // Historical POI is too far below (e.g. at 160 while price surged to 240). Awaiting fresh FVG on this expansion leg!
        primaryZoneType = 'NONE';
        entryMin = chosen.min;
        entryMax = chosen.max;
        reasoning.push(`Breakout Expansion: Price surged far above previous POI (Rp ${chosen.max.toLocaleString()}). Awaiting fresh FVG creation on current leg.`);
      }
    } else {
      primaryZoneType = 'NONE';
      entryMin = Math.round(currentPrice * 0.90);
      entryMax = Math.round(currentPrice * 0.94);
      reasoning.push(`Strong Momentum Breakout. No bullish FVG/OB formed on this leg yet. Awaiting fresh FVG creation.`);
    }
  } else {
    // Downtrend
    const nearestOb = activeBullObs[activeBullObs.length - 1];
    const nearestFvg = activeBullFvgs[activeBullFvgs.length - 1];
    const nearestGap = activeBullGaps[activeBullGaps.length - 1];

    if (nearestOb && nearestOb.top < currentPrice) {
      entryMin = nearestOb.bottom;
      entryMax = nearestOb.top;
      primaryZoneType = 'ORDER_BLOCK';
      primaryZonePrice = nearestOb.top;
      reasoning.push(`Downtrend structure. Awaiting potential rebound at Demand Order Block Rp ${entryMin.toLocaleString()} - ${entryMax.toLocaleString()}`);
    } else if (nearestGap && nearestGap.top < currentPrice) {
      entryMin = nearestGap.bottom;
      entryMax = nearestGap.top;
      primaryZoneType = 'GAP';
      primaryZonePrice = nearestGap.top;
      reasoning.push(`Downtrend structure. Awaiting potential rebound at Bullish Price Gap Rp ${entryMin.toLocaleString()} - ${entryMax.toLocaleString()}`);
    } else if (nearestFvg && nearestFvg.top < currentPrice) {
      entryMin = nearestFvg.bottom;
      entryMax = nearestFvg.top;
      primaryZoneType = 'FVG';
      primaryZonePrice = nearestFvg.top;
      reasoning.push(`Downtrend structure. Awaiting potential rebound at Fair Value Gap Rp ${entryMin.toLocaleString()} - ${entryMax.toLocaleString()}`);
    } else {
      entryMin = Math.round(currentPrice * 0.92);
      entryMax = Math.round(currentPrice * 0.95);
      reasoning.push(`Downtrend structure. Awaiting bullish momentum reversal or demand POI formation.`);
    }
  }

  // Volume reasoning
  if (volumeConfirmation) {
    reasoning.push(`SMART MONEY ACCUMULATION: Volume spike of ${volumeRatio.toFixed(1)}x above 20-MA confirms institutional buying interest.`);
  } else {
    reasoning.push(`Current transaction volume (${volumeRatio.toFixed(1)}x 20-MA) is neutral. Waiting for volume confirmation on rebound.`);
  }

  // Enforce Entry Zone max width constraint (maximum 5% from entryMax)
  if (entryMax - entryMin > entryMax * 0.05) {
    entryMin = Math.round(entryMax * 0.95);
  }
  entryMin = roundToIdxTick(entryMin, isIhsg);
  entryMax = roundToIdxTick(entryMax, isIhsg);
  let stopLoss = 0;
  const nearestObForSL = activeBullObs[activeBullObs.length - 1];
  const nearestFvgForSL = activeBullFvgs[activeBullFvgs.length - 1];
  const nearestGapForSL = activeBullGaps[activeBullGaps.length - 1];

  if (primaryZoneType === 'ORDER_BLOCK' && nearestObForSL) {
    stopLoss = addIdxTicks(nearestObForSL.bottom, -2, isIhsg);
    reasoning.push(`Stop Loss (SL) set precisely below Order Block Low: Rp ${stopLoss.toLocaleString()}`);
  } else if (primaryZoneType === 'FVG' && nearestFvgForSL) {
    stopLoss = addIdxTicks(nearestFvgForSL.bottom, -2, isIhsg);
    reasoning.push(`Stop Loss (SL) set below Fair Value Gap: Rp ${stopLoss.toLocaleString()}`);
  } else if (primaryZoneType === 'GAP' && nearestGapForSL) {
    stopLoss = addIdxTicks(nearestGapForSL.bottom, -2, isIhsg);
    reasoning.push(`Stop Loss (SL) set below Bullish Price Gap: Rp ${stopLoss.toLocaleString()}`);
  } else {
    const slTicks = Math.max(2, Math.round((entryMin * 0.04) / getIdxTickSize(entryMin, isIhsg)));
    stopLoss = addIdxTicks(entryMin, -slTicks, isIhsg);
  }

  // Minimum Stop Loss Distance: at least 2.5%
  const minSlDistance = Math.round(entryMin * 0.025);
  if (entryMax - stopLoss < minSlDistance) {
    stopLoss = entryMin - minSlDistance;
  }
  stopLoss = roundToIdxTick(stopLoss, isIhsg);
  const stopLossPercentVal = Number((((entryMax - stopLoss) / entryMax) * 100).toFixed(1));

  // Check condition for WAIT_FVG_CREATION (Momentum breakout or expansion candle):
  const lastCandle = candles && candles.length > 0 ? candles[candles.length - 1] : null;
  const prevCandle = candles && candles.length >= 2 ? candles[candles.length - 2] : null;
  const dailyGain = prevCandle && prevCandle.close > 0 && lastCandle
    ? (lastCandle.close - prevCandle.close) / prevCandle.close
    : 0;

  const isBreakoutRising =
    (dailyGain >= 0.035) ||
    (lastCandle != null &&
      prevCandle != null &&
      lastCandle.close > prevCandle.high * 1.01 &&
      (volumeRatio >= 1.1 || volumeConfirmation || dailyGain >= 0.02));

  // Take Profit: Order Blocks, FVGs, Price Gaps, and Swing Highs above entry zone serve as Take Profit targets
  const activeBearObs = orderBlocks.filter((o) => o.type === 'bearish' && !o.mitigated);
  const activeBearFvgs = fvgs.filter((f) => f.type === 'bearish' && !f.mitigated);
  const activeBearGaps = priceGaps.filter((g) => g.type === 'bearish' && !g.mitigated);
  const swingHighs = swings.filter((s) => s.type === 'HH' || s.type === 'LH');

  const resistancePool: number[] = [];
  activeBearObs.forEach((ob) => {
    if (ob.bottom > entryMax) resistancePool.push(ob.bottom);
    if (ob.top > entryMax) resistancePool.push(ob.top);
  });
  activeBearFvgs.forEach((fvg) => {
    if (fvg.bottom > entryMax) resistancePool.push(fvg.bottom);
  });
  activeBearGaps.forEach((gap) => {
    if (gap.bottom > entryMax) resistancePool.push(gap.bottom);
    if (gap.top > entryMax) resistancePool.push(gap.top);
  });
  swingHighs.forEach((sh) => {
    if (sh.price > entryMax) resistancePool.push(sh.price);
  });

  const idealTp1 = entryMax * 1.10; // ~10%
  let takeProfit1 = roundToIdxTick(idealTp1, isIhsg);
  const validTp1s = resistancePool.filter((p) => p >= entryMax * 1.03);
  if (validTp1s.length > 0) {
    validTp1s.sort((a, b) => Math.abs(a - idealTp1) - Math.abs(b - idealTp1));
    takeProfit1 = roundToIdxTick(validTp1s[0], isIhsg);
  }
  if (takeProfit1 <= entryMax) {
    takeProfit1 = addIdxTicks(entryMax, 2, isIhsg);
  }

  const idealTp2 = entryMax * 1.20; // ~20%
  let takeProfit2 = roundToIdxTick(idealTp2, isIhsg);
  const validTp2s = resistancePool.filter((p) => p >= takeProfit1 * 1.03);
  if (validTp2s.length > 0) {
    validTp2s.sort((a, b) => Math.abs(a - idealTp2) - Math.abs(b - idealTp2));
    takeProfit2 = roundToIdxTick(validTp2s[0], isIhsg);
  } else {
    takeProfit2 = roundToIdxTick(Math.max(takeProfit1 * 1.08, entryMax * 1.20), isIhsg);
  }
  if (takeProfit2 <= takeProfit1) {
    takeProfit2 = addIdxTicks(takeProfit1, Math.max(2, Math.round(takeProfit1 * 0.08 / getIdxTickSize(takeProfit1, isIhsg))), isIhsg);
  }

  const idealTp3 = entryMax * 1.35; // ~35%
  let takeProfit3 = roundToIdxTick(idealTp3, isIhsg);
  const validTp3s = resistancePool.filter((p) => p >= takeProfit2 * 1.05);
  if (validTp3s.length > 0) {
    validTp3s.sort((a, b) => Math.abs(a - idealTp3) - Math.abs(b - idealTp3));
    takeProfit3 = roundToIdxTick(validTp3s[0], isIhsg);
  } else {
    takeProfit3 = roundToIdxTick(Math.max(takeProfit2 * 1.10, entryMax * 1.35), isIhsg);
  }
  if (takeProfit3 <= takeProfit2) {
    takeProfit3 = addIdxTicks(takeProfit2, Math.max(2, Math.round(takeProfit2 * 0.10 / getIdxTickSize(takeProfit2, isIhsg))), isIhsg);
  }

  const tp1PercentVal = Number((((takeProfit1 - entryMax) / entryMax) * 100).toFixed(1));
  const tp2PercentVal = Number((((takeProfit2 - entryMax) / entryMax) * 100).toFixed(1));
  const tp3PercentVal = Number((((takeProfit3 - entryMax) / entryMax) * 100).toFixed(1));

  // Risk Reward Calculation: Risk = (Entry - StopLoss), Reward = (TP1 - Entry)
  const risk = Math.max(1, entryMax - stopLoss);
  const reward = takeProfit1 - entryMax;
  const riskRewardRatio = Number((reward / risk).toFixed(2));

  // Check if price is inside entry zone
  const hasConfirmedPoi = primaryZoneType !== 'NONE';
  const isOnBuyArea = hasConfirmedPoi && currentPrice >= entryMin && currentPrice <= entryMax;
  // Near entry is ONLY when confirmed POI exists, price is not on an explosive breakout leg, and price is strictly 0.1% to 3.0% above entryMax
  const isNearEntry = hasConfirmedPoi && !isBreakoutRising && currentPrice > entryMax && currentPrice <= entryMax * 1.03;

  // Check if a closed candle tapped into an active DEMAND POI (Bullish OB / Bullish FVG / Bullish Gap)
  // RULE: The POI MUST have been formed by earlier candles (not created by the candle itself)
  let isYesterdayTappedPoi = false;
  let tappedPoiLabel = '';
  const candidateCandles = [lastCandle, prevCandle].filter(Boolean) as Candle[];
  for (const c of candidateCandles) {
    if (isYesterdayTappedPoi) break;
    const cIndex = candles.indexOf(c);
    if (cIndex === -1) continue;

    // Strictly match BULLISH Demand zones (Bullish OB, Bullish FVG, Bullish Gap)
    // where price tapped into the zone (c.low <= top && c.high >= bottom)
    // AND closed at or above the zone top boundary (c.close >= top)
    // AND the zone was formed strictly by EARLIER candles!
    const tappedOb = activeBullObs.find(
      (ob) => ob.type === 'bullish' && ob.startIndex < cIndex - 1 && c.low <= ob.top && c.high >= ob.bottom && c.close >= ob.top
    );
    const tappedFvg = activeBullFvgs.find(
      (fvg) => fvg.type === 'bullish' && fvg.startIndex < cIndex - 2 && c.low <= fvg.top && c.high >= fvg.bottom && c.close >= fvg.top
    );
    const tappedGap = activeBullGaps.find(
      (gap) => gap.type === 'bullish' && gap.startIndex < cIndex - 1 && c.low <= gap.top && c.high >= gap.bottom && c.close >= gap.top
    );

    if (tappedOb) {
      isYesterdayTappedPoi = true;
      tappedPoiLabel = `Demand Order Block (Rp ${tappedOb.bottom.toLocaleString()} - ${tappedOb.top.toLocaleString()})`;
    } else if (tappedFvg) {
      isYesterdayTappedPoi = true;
      tappedPoiLabel = `Bullish Fair Value Gap / FVG (Rp ${tappedFvg.bottom.toLocaleString()} - ${tappedFvg.top.toLocaleString()})`;
    } else if (tappedGap) {
      isYesterdayTappedPoi = true;
      tappedPoiLabel = `Bullish Price Gap (Rp ${tappedGap.bottom.toLocaleString()} - ${tappedGap.top.toLocaleString()})`;
    }
  }

  let status: TradeRecommendation['status'] = 'WAIT_PULLBACK_FVG';

  if (hasRecentLL || (riskRewardRatio < 1.1 && !isOnBuyArea && !isYesterdayTappedPoi)) {
    status = 'NO_ENTRY';
  } else if (isYesterdayTappedPoi) {
    status = 'TAPPED_POI_REBOUND';
    reasoning.unshift(
      `🎯 RECENTLY TAPPED POI: Price recently (Rp ${prevCandle?.close.toLocaleString()}) touched Demand zone ${tappedPoiLabel} and rebounded successfully.`
    );
  } else if (isOnBuyArea) {
    status = 'ON_BUY_AREA';
    reasoning.unshift(
      `🎯 IN BUY ZONE: Current price (Rp ${currentPrice.toLocaleString()}) is inside the SMC Buy Zone (Rp ${entryMin.toLocaleString()} - ${entryMax.toLocaleString()}).`
    );
  } else if (isBreakoutRising || !hasConfirmedPoi || (currentPrice > entryMax * 1.08 && !activeBullFvgs.some(f => f.top >= currentPrice * 0.90))) {
    status = 'WAIT_FVG_CREATION';
    reasoning.unshift(
      `⏳ AWAITING FVG CREATION: Price is in active momentum expansion (+${(dailyGain * 100).toFixed(1)}%). Awaiting candle close & 3-candle sequence to establish a fresh Bullish Fair Value Gap (FVG) / Order Block.`
    );
  } else if (isNearEntry) {
    status = 'NEAR_ENTRY';
    reasoning.unshift(
      `📍 NEAR ENTRY (0-3%): Current price (Rp ${currentPrice.toLocaleString()}) is sitting 0-3% above the SMC Buy Zone (Rp ${entryMin.toLocaleString()} - ${entryMax.toLocaleString()}).`
    );
  } else if (currentPrice > entryMax) {
    status = 'WAIT_PULLBACK_FVG';
    reasoning.push(
      `📉 WAIT PULLBACK: Price (Rp ${currentPrice.toLocaleString()}) is above ideal entry range (Rp ${entryMin.toLocaleString()} - ${entryMax.toLocaleString()}); waiting for pullback to FVG/OB.`
    );
  } else if (volumeConfirmation && currentPrice <= entryMax * 1.02) {
    status = 'STRONG_BUY_POI';
    reasoning.push(
      `DISCOUNT POI (STRONG BUY): Institutional volume accumulation confirmed at discount POI.`
    );
  } else if (structure === 'SIDEWAYS' && primaryZoneType !== 'NONE') {
    status = 'SIDEWAYS_ACCUMULATION';
    reasoning.push(
      `SIDEWAYS ACCUMULATION: Price consolidating within Support / Demand Zone.`
    );
  } else if (!volumeConfirmation) {
    status = 'WAIT_VOLUME_CONFIRMATION';
  }

  const smcCatalyst =
    structure === 'RALLYING'
      ? `Bullish Momentum Rally + FVG/OB/Gap Pullback (R:R 1:${riskRewardRatio})`
      : structure === 'SIDEWAYS'
      ? `Sideways Accumulation in ${primaryZoneType} Zone (R:R 1:${riskRewardRatio})`
      : `Downtrend Structure - Awaiting Bullish Wave Reversal`;

  const mostLikelyScenario = generateSmcScenario(
    structure,
    status,
    currentPrice,
    [entryMin, entryMax],
    takeProfit1,
    takeProfit2,
    primaryZoneType,
    swings
  );

  return {
    symbol,
    name,
    currentPrice,
    structure,
    entryZone: [entryMin, entryMax],
    stopLoss,
    stopLossPercent: stopLossPercentVal,
    takeProfit1,
    takeProfit1Percent: tp1PercentVal,
    takeProfit2,
    takeProfit2Percent: tp2PercentVal,
    takeProfit3,
    takeProfit3Percent: tp3PercentVal,
    riskRewardRatio,
    volumeConfirmation,
    volumeRatio: Number(volumeRatio.toFixed(2)),
    decisionReasoning: reasoning,
    smcCatalyst,
    status,
    primaryZoneType,
    primaryZonePrice,
    isOnBuyArea,
    mostLikelyScenario,
  };
}

/**
 * Generates step-by-step Elliott Wave & SMC Roadmap Scenario Projection
 */
export function generateSmcScenario(
  structure: MarketStructureType,
  status: TradeRecommendation['status'],
  currentPrice: number,
  entryZone: [number, number],
  tp1: number,
  tp2: number,
  primaryZoneType: string,
  swings: SwingPoint[]
): SmcScenario {
  const [entryMin, entryMax] = entryZone;
  const recentHighSwing = swings.filter((s) => s.type === 'HH' || s.type === 'LH').pop();

  if (status === 'ON_BUY_AREA') {
    return {
      title: 'Primary SMC Scenario: Optimal Entry Execution in Demand Buy Zone',
      type: 'ELLIOTT_IMPULSE_EXPANSION',
      probability: 'VERY HIGH',
      targetDescription: `Buy Area: Rp ${entryMin.toLocaleString()} - Rp ${entryMax.toLocaleString()} | Target TP1: Rp ${tp1.toLocaleString()}`,
      steps: [
        `Entry Zone Precision: Price is situated inside the SMC Buy Zone (Rp ${entryMin.toLocaleString()} - Rp ${entryMax.toLocaleString()}).`,
        `Smart Money Accumulation: Selling pressure absorbed by institutional buyers at ${primaryZoneType} POI.`,
        `Impulsive Rally: Projected to rebound upwards towards TP1 target at Rp ${tp1.toLocaleString()}.`,
        `Wave Extension: Expansion past TP1 opens continuation towards TP2 target at Rp ${tp2.toLocaleString()}.`,
      ],
    };
  }

  if (status === 'NEAR_ENTRY') {
    return {
      title: 'Primary SMC Scenario: Approaching Demand Zone Entry Range',
      type: 'PULLBACK_RETEST',
      probability: 'VERY HIGH',
      targetDescription: `Target Buy Zone: Rp ${entryMin.toLocaleString()} - Rp ${entryMax.toLocaleString()} | Target TP1: Rp ${tp1.toLocaleString()}`,
      steps: [
        `Controlled Approach: Price is approaching the upper boundary of Demand Zone (0-3% above entry range).`,
        `Rebound Anticipation: Potential immediate tap and bounce upon entering the FVG / Order Block.`,
        `Buy Execution: Prepare limit orders / scaled entries between Rp ${entryMin.toLocaleString()} - Rp ${entryMax.toLocaleString()}.`,
        `Target Acceleration: Rebound from this zone is projected towards TP1 at Rp ${tp1.toLocaleString()}.`,
      ],
    };
  }

  if (status === 'TAPPED_POI_REBOUND') {
    return {
      title: 'Primary SMC Scenario: Confirmed Rebound After Retesting Yesterday\'s Demand FVG/OB',
      type: 'ELLIOTT_IMPULSE_EXPANSION',
      probability: 'VERY HIGH',
      targetDescription: `Target TP1: Rp ${tp1.toLocaleString()} | Target TP2: Rp ${tp2.toLocaleString()}`,
      steps: [
        `Demand Zone Retest: Previous candle successfully retested Demand area (${primaryZoneType}) and closed higher cleanly.`,
        `Buyer Response: Demonstrates Smart Money buying pressure at POI without invalidating Swing Low structure.`,
        `Impulsive Expansion: Projected continuation towards nearest Swing High target at Rp ${tp1.toLocaleString()}.`,
        `Target Expansion: Sustained momentum leads to next Fibonacci expansion target at Rp ${tp2.toLocaleString()}.`,
      ],
    };
  }

  if (status === 'WAIT_FVG_CREATION') {
    return {
      title: 'Primary SMC Scenario: Impulse Breakout & New Momentum Expansion',
      type: 'ELLIOTT_IMPULSE_EXPANSION',
      probability: 'VERY HIGH',
      targetDescription: `Target TP1: Rp ${tp1.toLocaleString()} | Target TP2: Rp ${tp2.toLocaleString()}`,
      steps: [
        `Momentum Booster: Price leaped impulsively past previous High driven by institutional volume spike.`,
        `FVG Formation: Awaiting candle close to confirm new Fair Value Gap (FVG) above.`,
        `Healthy Retest: Likely minor consolidation / measured pullback to collect Smart Money entries at new FVG.`,
        `Impulse Continuation: Push from FVG triggers subsequent expansion wave towards target Rp ${tp1.toLocaleString()}.`,
      ],
    };
  }

  if (status === 'STRONG_BUY_POI') {
    return {
      title: 'Primary SMC Scenario: Rebound from Demand Zone / POI & Wave Continuation',
      type: 'ELLIOTT_IMPULSE_EXPANSION',
      probability: 'VERY HIGH',
      targetDescription: `Target TP1: Rp ${tp1.toLocaleString()} | Target TP2: Rp ${tp2.toLocaleString()}`,
      steps: [
        `Demand Zone Test: Price sits at institutional accumulation zone (${primaryZoneType}) Rp ${entryMin.toLocaleString()} - Rp ${entryMax.toLocaleString()}.`,
        `Smart Money Response: Confirmed institutional volume accumulation (buying tail) holding price.`,
        `Impulsive Push: Projected strong bounce towards nearest Swing High at Rp ${recentHighSwing?.price.toLocaleString() ?? tp1.toLocaleString()}.`,
        `Extension Target: Wave continuation targets TP2 at Rp ${tp2.toLocaleString()}.`,
      ],
    };
  }

  if (status === 'WAIT_PULLBACK_FVG') {
    return {
      title: 'Primary SMC Scenario: Healthy Pullback to Demand Zone Before Rally Continuation',
      type: 'PULLBACK_RETEST',
      probability: 'HIGH',
      targetDescription: `Entry Pickup: Rp ${entryMin.toLocaleString()} - Rp ${entryMax.toLocaleString()} | Target TP: Rp ${tp1.toLocaleString()}`,
      steps: [
        `Minor Overbought Phase: Price currently above ideal entry range, requiring discount price re-alignment.`,
        `Imbalance Retest: Projected measured pullback to ${primaryZoneType} Rp ${entryMin.toLocaleString()} - Rp ${entryMax.toLocaleString()} to fill imbalance (FVG).`,
        `SSL Liquidity Sweep: Reversal reaction following Sellside Liquidity sweep without breaking main HL.`,
        `Continued Rally: Institutional buyers re-enter triggering new impulsive wave towards targets.`,
      ],
    };
  }

  if (structure === 'SIDEWAYS' || status === 'SIDEWAYS_ACCUMULATION') {
    return {
      title: 'Primary SMC Scenario: Sideways Accumulation Phase Before Breakout Expansion',
      type: 'SIDEWAYS_ACCUMULATION',
      probability: 'MEDIUM',
      targetDescription: `Accumulation Zone: Rp ${entryMin.toLocaleString()} - Rp ${entryMax.toLocaleString()} | Upper Target: Rp ${tp1.toLocaleString()}`,
      steps: [
        `Range Consolidation: Price moving inside Support/Demand Zone range Rp ${entryMin.toLocaleString()} - Rp ${entryMax.toLocaleString()}.`,
        `Liquidity Sweep: Testing lower boundary to sweep retail Sellside Liquidity (SSL).`,
        `Volume Confirmation: Awaiting gradual Smart Money accumulation until volume surges above 20-MA.`,
        `Breakout Expansion: Breakout and Body Close above upper boundary initiates new uptrend wave.`,
      ],
    };
  }

  return {
    title: 'Primary SMC Scenario: Potential Reversal via Bullish Wave Formation',
    type: 'ELLIOTT_WAVE_REVERSAL',
    probability: 'MEDIUM',
    targetDescription: `Key Reversal Level: Rp ${recentHighSwing?.price.toLocaleString() ?? entryMax.toLocaleString()} | Target TP: Rp ${tp1.toLocaleString()}`,
    steps: [
      `Active Downtrend: Current price in Bearish structure, forming Lower Lows (LL) and Lower Highs (LH).`,
      `Base / Sweep Formation: Seeking rebound point near psychological Support with Sellside Liquidity Sweep potential.`,
      `Bullish Reversal Confirmation: Reversal requires impulsive rally & Body Close above last Lower High (LH) (${recentHighSwing?.price.toLocaleString() ?? entryMax.toLocaleString()}).`,
      `Retest & New Uptrend: Once reversal confirmed, light retest to new FVG provides low-risk Long entry.`,
    ],
  };
}
