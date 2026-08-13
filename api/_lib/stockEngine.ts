// Self-contained Stock Data & Smart Money Concept (SMC) Engine for Vercel Serverless & Node Express API

export interface Candle {
  time: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type SwingType = 'HH' | 'HL' | 'LH' | 'LL';

export interface SwingPoint {
  index: number;
  time: string;
  price: number;
  type: SwingType;
}

export interface BosChochLine {
  id: string;
  type: 'BOS' | 'CHoCH';
  direction: 'bullish' | 'bearish';
  startIndex: number;
  endIndex: number;
  price: number;
  label: string;
  time: string;
}

export interface FvgZone {
  id: string;
  type: 'bullish' | 'bearish';
  top: number;
  bottom: number;
  startIndex: number;
  endIndex: number;
  mitigated: boolean;
  time: string;
}

export interface OrderBlock {
  id: string;
  type: 'bullish' | 'bearish';
  top: number;
  bottom: number;
  startIndex: number;
  endIndex: number;
  mitigated: boolean;
  time: string;
  volumeSpike: boolean;
}

export interface LiquiditySweep {
  id: string;
  type: 'BSL' | 'SSL';
  price: number;
  index: number;
  time: string;
  swept: boolean;
}

export interface PriceGap {
  id: string;
  type: 'bullish' | 'bearish';
  top: number;
  bottom: number;
  startIndex: number;
  endIndex: number;
  mitigated: boolean;
  time: string;
}

export interface SupportResistance {
  id: string;
  type: 'support' | 'resistance';
  price: number;
  strength: number;
  startIndex: number;
  endIndex: number;
}

export interface TechnicalIndicators {
  ma5: (number | null)[];
  ma10: (number | null)[];
  ma20: (number | null)[];
  ma60: (number | null)[];
  ma200: (number | null)[];
  vwap: (number | null)[];
  volumeMa20: (number | null)[];
}

export type MarketStructureType = 'RALLYING' | 'SIDEWAYS' | 'DOWNTREND';

export interface SmcScenario {
  title: string;
  type: 'BOS_CONTINUATION' | 'PULLBACK_RETEST' | 'REVERSAL_CHOCH' | 'SIDEWAYS_ACCUMULATION' | 'BREAKDOWN_RISK';
  probability: 'VERY HIGH' | 'HIGH' | 'MEDIUM';
  targetDescription: string;
  steps: string[];
}

export interface TradeRecommendation {
  symbol: string;
  name: string;
  currentPrice: number;
  structure: MarketStructureType;
  entryZone: [number, number];
  stopLoss: number;
  stopLossPercent: number;
  takeProfit1: number;
  takeProfit1Percent: number;
  takeProfit2: number;
  takeProfit2Percent: number;
  riskRewardRatio: number;
  volumeConfirmation: boolean;
  volumeRatio: number;
  decisionReasoning: string[];
  smcCatalyst: string;
  status: 'STRONG_BUY_POI' | 'WAIT_PULLBACK_FVG' | 'WAIT_VOLUME_CONFIRMATION' | 'SIDEWAYS_ACCUMULATION' | 'NO_ENTRY' | 'WAIT_FVG_CREATION' | 'ON_BUY_AREA' | 'TAPPED_POI_REBOUND' | 'NEAR_ENTRY';
  primaryZoneType: 'GAP' | 'FVG' | 'ORDER_BLOCK' | 'SUPPORT' | 'NONE';
  primaryZonePrice: number;
  isOnBuyArea?: boolean;
  mostLikelyScenario?: SmcScenario;
}

export interface StockData {
  symbol: string;
  ticker: string;
  name: string;
  sector: string;
  conglomerate?: string;
  candles: Candle[];
  swings: SwingPoint[];
  bosChochLines: BosChochLine[];
  fvgs: FvgZone[];
  orderBlocks: OrderBlock[];
  priceGaps?: PriceGap[];
  liquiditySweeps: LiquiditySweep[];
  supportResistance: SupportResistance[];
  indicators: TechnicalIndicators;
  recommendation: TradeRecommendation;
  currentPrice: number;
  change24h: number;
  changePercent24h: number;
}

export interface StockRawConfig {
  t: string; // ticker
  n: string; // name
  s: string; // sector
  p: number; // base price
  cg?: string; // conglomerate group
}

// Indonesian BEI Tick Rules
export function getIdxTickSize(price: number, isIhsg: boolean = false): number {
  if (isIhsg) return 1;
  if (price < 200) return 1;
  if (price < 500) return 2;
  if (price < 2000) return 5;
  if (price < 5000) return 10;
  return 25;
}

export function roundToIdxTick(price: number, isIhsg: boolean = false): number {
  if (!price || price <= 0) return 0;
  if (isIhsg) return Math.round(price);
  const tick = getIdxTickSize(price, false);
  return Math.round(price / tick) * tick;
}

export function addIdxTicks(price: number, ticks: number, isIhsg: boolean = false): number {
  let current = Math.max(1, Math.round(price));
  if (isIhsg) {
    return Math.max(1, current + ticks);
  }
  const step = ticks >= 0 ? 1 : -1;
  const count = Math.abs(ticks);

  for (let i = 0; i < count; i++) {
    const tickSize = getIdxTickSize(current, false);
    current += step * tickSize;
    if (current < 1) {
      current = 1;
      break;
    }
  }

  return roundToIdxTick(current, false);
}

export function countIdxTicksBetween(priceA: number, priceB: number, isIhsg: boolean = false): number {
  if (isIhsg) {
    return Math.round(Math.abs(priceB - priceA));
  }
  const low = Math.min(priceA, priceB);
  const high = Math.max(priceA, priceB);
  if (low === high || isNaN(low) || isNaN(high) || low <= 0) return 0;

  let ticks = 0;
  let current = roundToIdxTick(low, false);
  const target = roundToIdxTick(high, false);

  while (current < target && ticks < 2000) {
    const tickSize = getIdxTickSize(current, false);
    current += tickSize;
    ticks++;
  }

  return ticks;
}

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

export function detectSwings(candles: Candle[], lookback: number = 3): SwingPoint[] {
  const swings: SwingPoint[] = [];
  if (!candles || candles.length < lookback * 2 + 1) return swings;

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
      const prevHigh = swings.filter((s) => s.type === 'HH' || s.type === 'LH').pop();
      const type: 'HH' | 'LH' = !prevHigh || currentHigh > prevHigh.price ? 'HH' : 'LH';
      swings.push({
        index: i,
        time: candles[i].time,
        price: currentHigh,
        type,
      });
    } else if (isLow) {
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

export function detectBosChoch(candles: Candle[], swings: SwingPoint[]): BosChochLine[] {
  const lines: BosChochLine[] = [];
  if (!candles || candles.length < 2 || !swings || swings.length === 0) return lines;

  const sortedSwings = [...swings].sort((a, b) => a.index - b.index);
  let marketTrend: 'BULLISH' | 'BEARISH' = 'BULLISH';
  let activeHH: SwingPoint | null = null;
  let activeHL: SwingPoint | null = null;
  let activeLL: SwingPoint | null = null;
  let activeLH: SwingPoint | null = null;

  let lastEmittedBullishBosPrice: number | null = null;
  let lastEmittedBearishBosPrice: number | null = null;

  for (let c = 0; c < candles.length; c++) {
    const candle = candles[c];
    const swingsUpToC = sortedSwings.filter((s) => s.index <= c);

    const currentHH = swingsUpToC.filter((s) => s.type === 'HH').pop() || null;
    const currentHL = swingsUpToC.filter((s) => s.type === 'HL').pop() || null;
    const currentLL = swingsUpToC.filter((s) => s.type === 'LL').pop() || null;
    const currentLH = swingsUpToC.filter((s) => s.type === 'LH').pop() || null;

    if (currentHH && (!activeHH || currentHH.index > activeHH.index)) activeHH = currentHH;
    if (currentHL && (!activeHL || currentHL.index > activeHL.index)) activeHL = currentHL;
    if (currentLL && (!activeLL || currentLL.index > activeLL.index)) activeLL = currentLL;
    if (currentLH && (!activeLH || currentLH.index > activeLH.index)) activeLH = currentLH;

    if (activeHH && candle.close > activeHH.price) {
      const hasPullbackHl = activeHL != null && activeHL.index < c && activeHL.index > activeHH.index;
      const isNotDuplicate = lastEmittedBullishBosPrice !== activeHH.price;

      if (isNotDuplicate && hasPullbackHl) {
        lines.push({
          id: `BOS-bull-${activeHH.index}-${c}`,
          type: 'BOS',
          direction: 'bullish',
          startIndex: activeHH.index,
          endIndex: c,
          price: activeHH.price,
          label: 'BOS',
          time: candle.time,
        });

        marketTrend = 'BULLISH';
        lastEmittedBullishBosPrice = activeHH.price;
        activeHH = null;
      }
    }

    if (marketTrend === 'BULLISH' && activeHL && candle.close < activeHL.price) {
      lines.push({
        id: `CHoCH-bear-${activeHL.index}-${c}`,
        type: 'CHoCH',
        direction: 'bearish',
        startIndex: activeHL.index,
        endIndex: c,
        price: activeHL.price,
        label: 'CHoCH',
        time: candle.time,
      });

      marketTrend = 'BEARISH';
      activeHL = null;
      lastEmittedBearishBosPrice = null;
    }

    if (activeLL && candle.close < activeLL.price) {
      const hasPullbackLh = activeLH != null && activeLH.index < c && activeLH.index > activeLL.index;
      const isNotDuplicate = lastEmittedBearishBosPrice !== activeLL.price;

      if (isNotDuplicate && hasPullbackLh) {
        lines.push({
          id: `BOS-bear-${activeLL.index}-${c}`,
          type: 'BOS',
          direction: 'bearish',
          startIndex: activeLL.index,
          endIndex: c,
          price: activeLL.price,
          label: 'BOS',
          time: candle.time,
        });

        marketTrend = 'BEARISH';
        lastEmittedBearishBosPrice = activeLL.price;
        activeLL = null;
      }
    }

    if (marketTrend === 'BEARISH' && activeLH && candle.close > activeLH.price) {
      lines.push({
        id: `CHoCH-bull-${activeLH.index}-${c}`,
        type: 'CHoCH',
        direction: 'bullish',
        startIndex: activeLH.index,
        endIndex: c,
        price: activeLH.price,
        label: 'CHoCH',
        time: candle.time,
      });

      marketTrend = 'BULLISH';
      activeLH = null;
      lastEmittedBullishBosPrice = null;
    }
  }

  const cleanLines: BosChochLine[] = [];
  for (const line of lines) {
    const isDuplicateOrOverlapping = cleanLines.some((existing) => {
      const priceDiffRatio = Math.abs(existing.price - line.price) / Math.max(1, line.price);
      if (existing.type === line.type) {
        return priceDiffRatio < 0.015 || Math.abs(existing.endIndex - line.endIndex) < 6;
      }
      return priceDiffRatio < 0.008;
    });

    if (!isDuplicateOrOverlapping) {
      cleanLines.push(line);
    }
  }

  return cleanLines;
}

export function detectFVGs(candles: Candle[], isIhsg: boolean = false): FvgZone[] {
  const fvgs: FvgZone[] = [];
  if (!candles || candles.length < 3) return fvgs;

  for (let i = 2; i < candles.length; i++) {
    const c1 = candles[i - 2];
    const c2 = candles[i - 1];
    const c3 = candles[i];

    if (c3.low > c1.high) {
      const bodyTicks = countIdxTicksBetween(c2.open, c2.close, isIhsg);
      const isBullishBody = c2.close > c2.open && bodyTicks >= 4;

      if (isBullishBody) {
        let gapTop = Math.round(c3.low);
        let gapBottom = Math.round(c1.high);
        let isFullyClosedByBody = false;

        for (let j = i + 1; j < candles.length; j++) {
          const c = candles[j];
          const bodyLow = Math.min(c.open, c.close);
          if (bodyLow <= gapBottom) {
            isFullyClosedByBody = true;
            break;
          }
          if (bodyLow < gapTop && bodyLow > gapBottom) {
            gapTop = Math.round(bodyLow);
          }
        }

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

    if (c1.low > c3.high) {
      const bodyTicks = countIdxTicksBetween(c2.close, c2.open, isIhsg);
      const isBearishBody = c2.open > c2.close && bodyTicks >= 4;

      if (isBearishBody) {
        let gapTop = Math.round(c1.low);
        let gapBottom = Math.round(c3.high);
        let isFullyClosedByBody = false;

        for (let j = i + 1; j < candles.length; j++) {
          const c = candles[j];
          const bodyHigh = Math.max(c.open, c.close);
          if (bodyHigh >= gapTop) {
            isFullyClosedByBody = true;
            break;
          }
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

export function detectPriceGaps(candles: Candle[]): PriceGap[] {
  const gaps: PriceGap[] = [];
  if (!candles || candles.length < 2) return gaps;

  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1];
    const curr = candles[i];

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

export function detectOrderBlocks(
  candles: Candle[],
  swings: SwingPoint[],
  bosLines: BosChochLine[],
  fvgs: FvgZone[],
  volumeMa: (number | null)[]
): OrderBlock[] {
  const orderBlocks: OrderBlock[] = [];
  if (!candles || candles.length < 3) return orderBlocks;

  const usedBullIndices = new Set<number>();
  const usedBearIndices = new Set<number>();

  const bullishBosEvents = bosLines.filter((l) => l.direction === 'bullish');
  for (const bos of bullishBosEvents) {
    const breakIndex = bos.endIndex;
    let targetK = -1;
    let minLow = Infinity;

    for (let k = breakIndex - 1; k >= Math.max(0, breakIndex - 8); k--) {
      const c = candles[k];
      if (c && c.low < minLow) {
        minLow = c.low;
        targetK = k;
      }
    }

    if (targetK !== -1 && !usedBullIndices.has(targetK)) {
      const c = candles[targetK];
      usedBullIndices.add(targetK);
      const obTop = Math.round(Math.max(c.open, c.close));
      const obBottom = Math.round(c.low);

      let mitigated = false;
      let endIndex = candles.length - 1;
      for (let j = targetK + 1; j < candles.length; j++) {
        if (candles[j].close < c.low) {
          mitigated = true;
          endIndex = j;
          break;
        }
      }

      const vMa = volumeMa[targetK];
      const volumeSpike = vMa !== null && c.volume > (vMa || 1) * 1.3;

      orderBlocks.push({
        id: `ob-bull-${targetK}`,
        type: 'bullish',
        top: obTop,
        bottom: obBottom,
        startIndex: targetK,
        endIndex: mitigated ? endIndex : candles.length - 1,
        mitigated,
        time: c.time,
        volumeSpike,
      });
    }
  }

  for (const swing of swings) {
    const sIndex = swing.index;
    if (sIndex >= 0 && sIndex < candles.length) {
      if ((swing.type === 'HL' || swing.type === 'LL') && !usedBullIndices.has(sIndex)) {
        const c = candles[sIndex];
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
  }

  return orderBlocks.filter((ob) => !ob.mitigated);
}

export function detectLiquiditySweeps(candles: Candle[], swings: SwingPoint[]): LiquiditySweep[] {
  const sweeps: LiquiditySweep[] = [];
  for (const swing of swings) {
    for (let i = swing.index + 2; i < candles.length; i++) {
      const c = candles[i];
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

export function detectSupportResistance(candles: Candle[]): SupportResistance[] {
  const levels: SupportResistance[] = [];
  const prices: { price: number; type: 'support' | 'resistance'; index: number }[] = [];

  for (let i = 2; i < candles.length - 2; i++) {
    if (candles[i].high > candles[i - 1].high && candles[i].high > candles[i + 1].high) {
      prices.push({ price: candles[i].high, type: 'resistance', index: i });
    }
    if (candles[i].low < candles[i - 1].low && candles[i].low < candles[i + 1].low) {
      prices.push({ price: candles[i].low, type: 'support', index: i });
    }
  }

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
      decisionReasoning: ['Market candlestick data initialized.'],
      smcCatalyst: 'Standby for institutional volume breakout',
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
  const activeBullFvgs = fvgs.filter((f) => f.type === 'bullish' && !f.mitigated);
  const activeBullObs = orderBlocks.filter((o) => o.type === 'bullish' && !o.mitigated);
  const activeBullGaps = priceGaps.filter((g) => g.type === 'bullish' && !g.mitigated);
  const strongSupports = supports.filter((s) => s.type === 'support');

  let entryMin = currentPrice;
  let entryMax = currentPrice;
  let primaryZoneType: 'GAP' | 'FVG' | 'ORDER_BLOCK' | 'SUPPORT' | 'NONE' = 'NONE';
  let primaryZonePrice = currentPrice;
  const reasoning: string[] = [];

  const candidates: { type: 'ORDER_BLOCK' | 'FVG' | 'GAP' | 'SUPPORT'; min: number; max: number; dist: number; desc: string }[] = [];

  const nearestOb = activeBullObs[activeBullObs.length - 1];
  const nearestFvg = activeBullFvgs[activeBullFvgs.length - 1];
  const nearestGap = activeBullGaps[activeBullGaps.length - 1];
  const nearestSup = strongSupports[strongSupports.length - 1];

  if (nearestOb) {
    candidates.push({
      type: 'ORDER_BLOCK',
      min: nearestOb.bottom,
      max: nearestOb.top,
      dist: Math.abs(currentPrice - nearestOb.top),
      desc: `Demand Order Block (POI) at Rp ${nearestOb.bottom.toLocaleString()} - ${nearestOb.top.toLocaleString()}`,
    });
  }
  if (nearestFvg) {
    candidates.push({
      type: 'FVG',
      min: nearestFvg.bottom,
      max: nearestFvg.top,
      dist: Math.abs(currentPrice - nearestFvg.top),
      desc: `Fair Value Gap (FVG) at Rp ${nearestFvg.bottom.toLocaleString()} - ${nearestFvg.top.toLocaleString()}`,
    });
  }
  if (nearestGap) {
    candidates.push({
      type: 'GAP',
      min: nearestGap.bottom,
      max: nearestGap.top,
      dist: Math.abs(currentPrice - nearestGap.top),
      desc: `Bullish Price Gap at Rp ${nearestGap.bottom.toLocaleString()} - ${nearestGap.top.toLocaleString()}`,
    });
  }
  if (nearestSup) {
    candidates.push({
      type: 'SUPPORT',
      min: Math.round(nearestSup.price * 0.99),
      max: Math.round(nearestSup.price * 1.01),
      dist: Math.abs(currentPrice - nearestSup.price),
      desc: `Strong Support level at Rp ${nearestSup.price.toLocaleString()}`,
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
    entryMin = Math.round(currentPrice * 0.97);
    entryMax = currentPrice;
    reasoning.push(`Accumulation range near Rp ${entryMin.toLocaleString()} - ${entryMax.toLocaleString()}`);
  }

  if (entryMax - entryMin > entryMax * 0.05) {
    entryMin = Math.round(entryMax * 0.95);
  }
  entryMin = roundToIdxTick(entryMin, isIhsg);
  entryMax = roundToIdxTick(entryMax, isIhsg);

  let stopLoss = addIdxTicks(entryMin, -Math.max(2, Math.round((entryMin * 0.035) / getIdxTickSize(entryMin, isIhsg))), isIhsg);
  if (entryMax - stopLoss < Math.round(entryMin * 0.025)) {
    stopLoss = entryMin - Math.round(entryMin * 0.03);
  }
  stopLoss = roundToIdxTick(stopLoss, isIhsg);

  const slDistance = Math.max(1, entryMax - stopLoss);
  const stopLossPercent = parseFloat(((slDistance / entryMax) * 100).toFixed(1));

  let tp1 = addIdxTicks(entryMax, Math.round((slDistance * 2.2) / getIdxTickSize(entryMax, isIhsg)), isIhsg);
  let tp2 = addIdxTicks(entryMax, Math.round((slDistance * 3.8) / getIdxTickSize(entryMax, isIhsg)), isIhsg);
  tp1 = roundToIdxTick(tp1, isIhsg);
  tp2 = roundToIdxTick(tp2, isIhsg);

  const tp1Percent = parseFloat((((tp1 - entryMax) / entryMax) * 100).toFixed(1));
  const tp2Percent = parseFloat((((tp2 - entryMax) / entryMax) * 100).toFixed(1));

  const riskRewardRatio = parseFloat((tp1Percent / Math.max(0.1, stopLossPercent)).toFixed(2));

  // Determine signal status
  const isOnBuyArea = currentPrice >= entryMin && currentPrice <= entryMax;
  let status: TradeRecommendation['status'] = 'WAIT_PULLBACK_FVG';

  if (isOnBuyArea && volumeConfirmation) {
    status = 'STRONG_BUY_POI';
  } else if (isOnBuyArea) {
    status = 'ON_BUY_AREA';
  } else if (currentPrice < entryMin && currentPrice >= entryMin * 0.95) {
    status = 'TAPPED_POI_REBOUND';
  } else if (structure === 'SIDEWAYS') {
    status = 'SIDEWAYS_ACCUMULATION';
  } else {
    status = 'NEAR_ENTRY';
  }

  const scenario: SmcScenario = {
    title: `${structure === 'RALLYING' ? 'Bullish Expansion' : 'Accumulation Retest'} Scenario`,
    type: structure === 'RALLYING' ? 'BOS_CONTINUATION' : 'PULLBACK_RETEST',
    probability: volumeConfirmation ? 'VERY HIGH' : 'HIGH',
    targetDescription: `Target TP1 at Rp ${tp1.toLocaleString()} (${tp1Percent}%)`,
    steps: [
      `Price pulls back to test ${primaryZoneType} area at Rp ${entryMin.toLocaleString()} - ${entryMax.toLocaleString()}`,
      `Smart money absorbs sell volume with institutional volume spike`,
      `Impulsive rebound towards TP1 (Rp ${tp1.toLocaleString()}) and TP2 (Rp ${tp2.toLocaleString()})`
    ]
  };

  return {
    symbol,
    name,
    currentPrice,
    structure,
    entryZone: [entryMin, entryMax],
    stopLoss,
    stopLossPercent,
    takeProfit1: tp1,
    takeProfit1Percent: tp1Percent,
    takeProfit2: tp2,
    takeProfit2Percent: tp2Percent,
    riskRewardRatio,
    volumeConfirmation,
    volumeRatio,
    decisionReasoning: reasoning,
    smcCatalyst: volumeConfirmation ? 'Institutional Volume Surge' : 'SMC Structure Retest',
    status,
    primaryZoneType,
    primaryZonePrice,
    isOnBuyArea,
    mostLikelyScenario: scenario,
  };
}

export function formatJakartaDate(dateOrTimestamp: Date | number): string {
  const date = typeof dateOrTimestamp === 'number' ? new Date(dateOrTimestamp * 1000) : dateOrTimestamp;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(date);
}

export function getLatestClosedTradingDateStr(now: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  let year = 2026, month = 1, day = 1, weekday = 'Mon', hour = 0, minute = 0;
  for (const p of parts) {
    if (p.type === 'year') year = parseInt(p.value, 10);
    if (p.type === 'month') month = parseInt(p.value, 10);
    if (p.type === 'day') day = parseInt(p.value, 10);
    if (p.type === 'weekday') weekday = p.value;
    if (p.type === 'hour') hour = parseInt(p.value, 10);
    if (p.type === 'minute') minute = parseInt(p.value, 10);
  }

  const isAfterClose = (hour * 60 + minute) >= (16 * 60);
  let daysToSubtract = 0;
  if (weekday === 'Sun') daysToSubtract = 2;
  else if (weekday === 'Sat') daysToSubtract = 1;
  else if (weekday === 'Mon') daysToSubtract = isAfterClose ? 0 : 3;
  else daysToSubtract = isAfterClose ? 0 : 1;

  const targetDate = new Date(Date.UTC(year, month - 1, day));
  targetDate.setUTCDate(targetDate.getUTCDate() - daysToSubtract);
  const y = targetDate.getUTCFullYear();
  const m = String(targetDate.getUTCMonth() + 1).padStart(2, '0');
  const d = String(targetDate.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getTradingDayDates(count: number, latestDateStr: string): string[] {
  const [y, m, d] = latestDateStr.split('-').map(Number);
  const cur = new Date(Date.UTC(y, m - 1, d));
  const dates: string[] = [];

  while (dates.length < count) {
    const dayOfWeek = cur.getUTCDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      const cy = cur.getUTCFullYear();
      const cm = String(cur.getUTCMonth() + 1).padStart(2, '0');
      const cd = String(cur.getUTCDate()).padStart(2, '0');
      dates.push(`${cy}-${cm}-${cd}`);
    }
    cur.setUTCDate(cur.getUTCDate() - 1);
  }

  return dates.reverse();
}

function seededRandom(seed: number) {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

export function generateCandles(
  basePrice: number,
  volatility: number = 0.025,
  trendBias: number = 0.001,
  days: number = 100
): Candle[] {
  const candles: Candle[] = [];
  let currentPrice = basePrice;
  const latestDateStr = getLatestClosedTradingDateStr();
  const tradingDates = getTradingDayDates(days, latestDateStr);

  for (let i = 0; i < tradingDates.length; i++) {
    const dateStr = tradingDates[i];
    let cycle = Math.sin(i / 8) * (volatility * 1.5);
    if (i > 70 && i < 85) cycle -= volatility * 1.2;
    if (i >= 85) cycle += volatility * 2.0;

    const rand1 = seededRandom(i * 10 + 1) - 0.48;
    const changePercent = rand1 * volatility + trendBias + cycle;

    const open = Math.round(currentPrice);
    let close = Math.round(currentPrice * (1 + changePercent));
    if (open === close) close = open + (rand1 > 0 ? 5 : -5);

    const high = Math.round(Math.max(open, close) + Math.abs(seededRandom(i * 10 + 2)) * open * volatility * 1.2);
    const low = Math.round(Math.min(open, close) - Math.abs(seededRandom(i * 10 + 3)) * open * volatility * 1.2);

    let baseVolume = 15000000 + Math.floor(seededRandom(i * 10 + 4) * 20000000);
    if (i > 80 && i < 90) baseVolume *= 2.8;

    candles.push({
      time: dateStr,
      open: Math.max(50, open),
      high: Math.max(50, high),
      low: Math.max(50, low),
      close: Math.max(50, close),
      volume: Math.max(1000, baseVolume),
    });

    currentPrice = Math.max(50, close);
  }

  return candles;
}

export function buildStockData(
  symbol: string,
  ticker: string,
  name: string,
  sector: string,
  candles: Candle[],
  conglomerate?: string
): StockData {
  const currentPrice = candles[candles.length - 1]?.close || 100;
  const previousClose = candles.length > 1 ? candles[candles.length - 2]?.close || currentPrice : currentPrice;
  const change24h = currentPrice - previousClose;
  const changePercent24h = previousClose > 0 ? (change24h / previousClose) * 100 : 0;

  const ma5 = calculateMA(candles, 5);
  const ma10 = calculateMA(candles, 10);
  const ma20 = calculateMA(candles, 20);
  const ma60 = calculateMA(candles, 60);
  const ma200 = calculateMA(candles, 200);
  const volumeMa20 = calculateVolumeMA(candles, 20);
  const vwap = calculateVWAP(candles);

  const isIhsg = symbol.includes('JKSE') || ticker === 'IHSG';
  const swings = detectSwings(candles);
  const bosChochLines = detectBosChoch(candles, swings);
  const fvgs = detectFVGs(candles, isIhsg);
  const priceGaps = detectPriceGaps(candles);
  const orderBlocks = detectOrderBlocks(candles, swings, bosChochLines, fvgs, volumeMa20);
  const liquiditySweeps = detectLiquiditySweeps(candles, swings);
  const supportResistance = detectSupportResistance(candles);

  const recommendation = generateRecommendation(
    symbol,
    name,
    candles,
    swings,
    fvgs,
    orderBlocks,
    supportResistance,
    volumeMa20,
    priceGaps
  );

  return {
    symbol,
    ticker,
    name,
    sector,
    conglomerate,
    candles,
    swings,
    bosChochLines,
    fvgs,
    orderBlocks,
    priceGaps,
    liquiditySweeps,
    supportResistance,
    indicators: {
      ma5,
      ma10,
      ma20,
      ma60,
      ma200,
      vwap,
      volumeMa20,
    },
    recommendation,
    currentPrice,
    change24h,
    changePercent24h,
  };
}

export const liquidIDXStocks: StockRawConfig[] = [
  { t: "IHSG", n: "Indeks Harga Saham Gabungan (IHSG)", s: "Market Index", p: 7350, cg: "Bursa Efek Indonesia" },
  { t: "BREN", n: "PT Barito Renewables Energy Tbk.", s: "Energy", p: 7250, cg: "Prajogo Pangestu" },
  { t: "TPIA", n: "PT Chandra Asri Pacific Tbk.", s: "Basic Materials", p: 8800, cg: "Prajogo Pangestu" },
  { t: "BRPT", n: "PT Barito Pacific Tbk.", s: "Basic Materials", p: 1120, cg: "Prajogo Pangestu" },
  { t: "CUAN", n: "PT Petrindo Jaya Kreasi Tbk.", s: "Energy", p: 7600, cg: "Prajogo Pangestu" },
  { t: "PTRO", n: "PT Petrosea Tbk.", s: "Energy", p: 14500, cg: "Prajogo Pangestu" },
  { t: "CDIA", n: "PT Chandra Daya Investama Tbk.", s: "Basic Materials", p: 1850, cg: "Prajogo Pangestu" },
  { t: "BUMI", n: "PT Bumi Resources Tbk.", s: "Energy", p: 140, cg: "Grup Bakrie" },
  { t: "BRMS", n: "PT Bumi Resources Minerals Tbk.", s: "Basic Materials", p: 340, cg: "Grup Bakrie" },
  { t: "ENRG", n: "PT Energi Mega Persada Tbk.", s: "Energy", p: 230, cg: "Grup Bakrie" },
  { t: "DEWA", n: "PT Darma Henwa Tbk.", s: "Energy", p: 92, cg: "Grup Bakrie" },
  { t: "VKTR", n: "PT VKTR Teknologi Mobilitas Tbk.", s: "Industrials", p: 145, cg: "Grup Bakrie" },
  { t: "UNSP", n: "PT Bakrie Sumatera Plantations Tbk.", s: "Consumer Staples", p: 110, cg: "Grup Bakrie" },
  { t: "VIVA", n: "PT Visi Media Asia Tbk.", s: "Telecommunication", p: 50, cg: "Grup Bakrie" },
  { t: "MDIA", n: "PT Intermedia Capital Tbk.", s: "Telecommunication", p: 50, cg: "Grup Bakrie" },
  { t: "PSAB", n: "PT J Resources Asia Pasifik Tbk.", s: "Basic Materials", p: 290, cg: "Happy Hapsoro" },
  { t: "RAJA", n: "PT Rukun Raharja Tbk.", s: "Energy", p: 1420, cg: "Happy Hapsoro" },
  { t: "MINA", n: "PT Sanurhasta Mitra Tbk.", s: "Consumer Cyclical", p: 50, cg: "Happy Hapsoro" },
  { t: "BUVA", n: "PT Bukit Uluwatu Villa Tbk.", s: "Consumer Cyclical", p: 70, cg: "Happy Hapsoro" },
  { t: "RATU", n: "PT Ratu Prabu Energy Tbk.", s: "Energy", p: 95, cg: "Happy Hapsoro" },
  { t: "CBRE", n: "PT Cakra Buana Resources Energi Tbk.", s: "Energy", p: 75, cg: "Happy Hapsoro" },
  { t: "PSKT", n: "PT Red Planet Indonesia Tbk.", s: "Consumer Cyclical", p: 65, cg: "Happy Hapsoro" },
  { t: "PADI", n: "PT Minna Padi Investama Sekuritas Tbk.", s: "Financials", p: 50, cg: "Happy Hapsoro" },
  { t: "FORU", n: "PT Fortune Indonesia Tbk.", s: "Consumer Cyclical", p: 1350, cg: "Happy Hapsoro" },
  { t: "JARR", n: "PT JLM / Jholin Agro Raya Tbk.", s: "Consumer Staples", p: 320, cg: "Haji Isam (Jholin)" },
  { t: "TEBE", n: "PT Dana Brata Lupur Tbk.", s: "Energy", p: 780, cg: "Haji Isam (Jholin)" },
  { t: "SINI", n: "PT Singaraja Putra Tbk.", s: "Energy", p: 1250, cg: "Haji Isam & Happy Hapsoro" },
  { t: "ARCI", n: "PT Archi Indonesia Tbk.", s: "Basic Materials", p: 310, cg: "Rajawali Group (Peter Sondakh)" },
  { t: "EMAS", n: "PT Wilton Makmur Indonesia Tbk.", s: "Basic Materials", p: 125, cg: "Rajawali Group (Peter Sondakh)" },
  { t: "GZCO", n: "PT Gozco Plantations Tbk.", s: "Consumer Staples", p: 90, cg: "Gozali Family (Gozco)" },
  { t: "INET", n: "PT Sinergi Inti Andalan Dinamika Tbk.", s: "Telecommunication", p: 110, cg: "Internet Rakyat (Sinergi)" },
  { t: "WIFI", n: "PT Solusi Sinergi Digital Tbk.", s: "Telecommunication", p: 310, cg: "Internet Rakyat (Surge)" },
  { t: "MORA", n: "PT Mora Telematika Indonesia Tbk.", s: "Telecommunication", p: 280, cg: "Internet Rakyat (Moratelindo)" },
  { t: "BULL", n: "PT Buana Lintas Lautan Tbk.", s: "Industrials & Energy", p: 135, cg: "Perkapalan & Logistik" },
  { t: "SOCI", n: "PT Soechi Lines Tbk.", s: "Industrials & Energy", p: 195, cg: "Perkapalan & Logistik" },
  { t: "PANI", n: "PT Pantai Indah Kapuk Dua Tbk.", s: "Properties", p: 12800, cg: "Agung Sedayu (Aguan)" },
  { t: "BYAN", n: "PT Bayan Resources Tbk.", s: "Energy", p: 18500, cg: "Low Tuck Kwong" },
  { t: "ADRO", n: "PT Adaro Energy Indonesia Tbk.", s: "Energy", p: 3650, cg: "Boy Thohir" },
  { t: "ADMR", n: "PT Adaro Minerals Indonesia Tbk.", s: "Energy", p: 1420, cg: "Boy Thohir" },
  { t: "AADI", n: "PT Adaro Andalan Indonesia Tbk.", s: "Energy", p: 5850, cg: "Boy Thohir" },
  { t: "ESSA", n: "PT ESSA Industries Indonesia Tbk.", s: "Basic Materials", p: 840, cg: "Boy Thohir" },
  { t: "MDKA", n: "PT Merdeka Copper Gold Tbk.", s: "Basic Materials", p: 2450, cg: "Boy Thohir" },
  { t: "MBMA", n: "PT Merdeka Battery Materials Tbk.", s: "Basic Materials", p: 580, cg: "Boy Thohir" },
  { t: "INDF", n: "PT Indofood Sukses Makmur Tbk.", s: "Consumer Staples", p: 7150, cg: "Grup Salim" },
  { t: "ICBP", n: "PT Indofood CBP Sukses Makmur Tbk.", s: "Consumer Staples", p: 11850, cg: "Grup Salim" },
  { t: "AMRT", n: "PT Sumber Alfaria Trijaya Tbk.", s: "Consumer Cyclical", p: 2850, cg: "Grup Salim" },
  { t: "DNET", n: "PT Indoretail Makmur Tbk.", s: "Consumer Cyclical", p: 4100, cg: "Grup Salim" },
  { t: "LSIP", n: "PT PP London Sumatra Indonesia Tbk.", s: "Consumer Staples", p: 1020, cg: "Grup Salim" },
  { t: "SIMP", n: "PT Salim Ivomas Pratama Tbk.", s: "Consumer Staples", p: 410, cg: "Grup Salim" },
  { t: "META", n: "PT Nusantara Infrastructure Tbk.", s: "Industrials", p: 238, cg: "Grup Salim" },
  { t: "AMMN", n: "PT Amman Mineral Internasional Tbk.", s: "Basic Materials", p: 8950, cg: "Grup Salim & Medco" },
  { t: "BBCA", n: "PT Bank Central Asia Tbk.", s: "Financials", p: 10150, cg: "Grup Djarum" },
  { t: "TOWR", n: "PT Sarana Menara Nusantara Tbk.", s: "Telecommunication", p: 810, cg: "Grup Djarum" },
  { t: "BELI", n: "PT Global Digital Niaga Tbk.", s: "Technology", p: 450, cg: "Grup Djarum" },
  { t: "BBHI", n: "PT Allo Bank Indonesia Tbk.", s: "Financials", p: 1180, cg: "Chairul Tanjung (CT Corp)" },
  { t: "GIAA", n: "PT Garuda Indonesia Tbk.", s: "Industrials", p: 68, cg: "Chairul Tanjung (CT Corp)" },
  { t: "INKP", n: "PT Indah Kiat Pulp & Paper Tbk.", s: "Basic Materials", p: 8150, cg: "Grup Sinar Mas" },
  { t: "TKIM", n: "PT Pabrik Kertas Tjiwi Kimia Tbk.", s: "Basic Materials", p: 7100, cg: "Grup Sinar Mas" },
  { t: "BSDE", n: "PT Bumi Serpong Damai Tbk.", s: "Properties", p: 1120, cg: "Grup Sinar Mas" },
  { t: "BSIM", n: "PT Bank Sinarmas Tbk.", s: "Financials", p: 510, cg: "Grup Sinar Mas" },
  { t: "SMAR", n: "PT Smart Tbk.", s: "Consumer Staples", p: 4200, cg: "Grup Sinar Mas" },
  { t: "LPKR", n: "PT Lippo Karawaci Tbk.", s: "Properties", p: 110, cg: "Grup Lippo" },
  { t: "LPCK", n: "PT Lippo Cikarang Tbk.", s: "Properties", p: 720, cg: "Grup Lippo" },
  { t: "MPPA", n: "PT Matahari Putra Prima Tbk.", s: "Consumer Cyclical", p: 78, cg: "Grup Lippo" },
  { t: "LPPF", n: "PT Matahari Department Store Tbk.", s: "Consumer Cyclical", p: 1480, cg: "Grup Lippo" },
  { t: "SILO", n: "PT Siloam International Hospitals Tbk.", s: "Healthcare", p: 2890, cg: "Grup Lippo" },
  { t: "MLPL", n: "PT Multipolar Tbk.", s: "Technology", p: 120, cg: "Grup Lippo" },
  { t: "NOBU", n: "PT Bank Nationalnobu Tbk.", s: "Financials", p: 580, cg: "Grup Lippo" },
  { t: "TAPG", n: "PT Triputra Agro Persada Tbk.", s: "Consumer Staples", p: 880, cg: "Grup Triputra" },
  { t: "DRMA", n: "PT Dharma Polimetal Tbk.", s: "Industrials", p: 1150, cg: "Grup Triputra" },
  { t: "ASSA", n: "PT Adi Sarana Armada Tbk.", s: "Industrials", p: 780, cg: "Grup Triputra" },
  { t: "SRTG", n: "PT Saratoga Investama Sedaya Tbk.", s: "Financials", p: 2350, cg: "Grup Saratoga" },
  { t: "PALM", n: "PT Provident Investama Tbk.", s: "Financials", p: 420, cg: "Grup Saratoga" },
  { t: "MNCN", n: "PT Media Nusantara Citra Tbk.", s: "Telecommunication", p: 320, cg: "Grup MNC" },
  { t: "BHIT", n: "PT MNC Asia Holding Tbk.", s: "Financials", p: 50, cg: "Grup MNC" },
  { t: "KPIG", n: "PT MNC Land Tbk.", s: "Properties", p: 180, cg: "Grup MNC" },
  { t: "BCAP", n: "PT MNC Kapital Indonesia Tbk.", s: "Financials", p: 85, cg: "Grup MNC" },
  { t: "PNBN", n: "PT Bank Pan Indonesia Tbk.", s: "Financials", p: 1250, cg: "Grup Panin" },
  { t: "PNLF", n: "PT Panin Financial Tbk.", s: "Financials", p: 310, cg: "Grup Panin" },
  { t: "BBRI", n: "PT Bank Rakyat Indonesia Tbk.", s: "Financials", p: 4850 },
  { t: "BMRI", n: "PT Bank Mandiri Tbk.", s: "Financials", p: 6900 },
  { t: "BBNI", n: "PT Bank Negara Indonesia Tbk.", s: "Financials", p: 5400 },
  { t: "BRIS", n: "PT Bank Syariah Indonesia Tbk.", s: "Financials", p: 2920 },
  { t: "ARTO", n: "PT Bank Jago Tbk.", s: "Financials", p: 2850 },
  { t: "BBTN", n: "PT Bank Tabungan Negara Tbk.", s: "Financials", p: 1380 },
  { t: "BFIN", n: "PT BFI Finance Indonesia Tbk.", s: "Financials", p: 1020 },
  { t: "PGAS", n: "PT Perusahaan Gas Negara Tbk.", s: "Energy", p: 1540 },
  { t: "PTBA", n: "PT Bukit Asam Tbk.", s: "Energy", p: 2680 },
  { t: "ITMG", n: "PT Indo Tambangraya Megah Tbk.", s: "Energy", p: 26200 },
  { t: "MEDC", n: "PT Medco Energi Internasional Tbk.", s: "Energy", p: 1320 },
  { t: "HRUM", n: "PT Harum Energy Tbk.", s: "Energy", p: 1380 },
  { t: "ANTM", n: "PT Aneka Tambang Tbk.", s: "Basic Materials", p: 1520 },
  { t: "INCO", n: "PT Vale Indonesia Tbk.", s: "Basic Materials", p: 3850 },
  { t: "UNVR", n: "PT Unilever Indonesia Tbk.", s: "Consumer Staples", p: 2350 },
  { t: "CPIN", n: "PT Charoen Pokphand Indonesia Tbk.", s: "Consumer Staples", p: 5150 },
  { t: "MYOR", n: "PT Mayora Indah Tbk.", s: "Consumer Staples", p: 2580 },
  { t: "ASII", n: "PT Astra International Tbk.", s: "Consumer Cyclical", p: 5150 },
  { t: "ACES", n: "PT Aspirasi Hidup Indonesia Tbk.", s: "Consumer Cyclical", p: 820 },
  { t: "MAPI", n: "PT Mitra Adiperkasa Tbk.", s: "Consumer Cyclical", p: 1650 },
  { t: "TLKM", n: "PT Telkom Indonesia (Persero) Tbk.", s: "Telecommunication", p: 3050 },
  { t: "ISAT", n: "PT Indosat Ooredoo Hutchison Tbk.", s: "Telecommunication", p: 10250 },
  { t: "EXCL", n: "PT XL Axiata Tbk.", s: "Telecommunication", p: 2250 },
  { t: "GOTO", n: "PT GoTo Gojek Tokopedia Tbk.", s: "Technology", p: 68 },
  { t: "UNTR", n: "PT United Tractors Tbk.", s: "Industrials", p: 26800 },
  { t: "SMGR", n: "PT Semen Indonesia (Persero) Tbk.", s: "Industrials", p: 3950 },
  { t: "KLBF", n: "PT Kalbe Farma Tbk.", s: "Healthcare", p: 1650 },
  { t: "CTRA", n: "PT Ciputra Development Tbk.", s: "Properties", p: 1280 }
];

export function getMockStocks(limit?: number): StockData[] {
  const stockMap = new Map<string, StockData>();
  const stocksToProcess = limit && limit < liquidIDXStocks.length
    ? liquidIDXStocks.slice(0, limit)
    : liquidIDXStocks;

  stocksToProcess.forEach((s) => {
    const isIhsg = s.t === 'IHSG' || s.t === '^JKSE';
    const ticker = isIhsg ? 'IHSG' : s.t;
    const symbol = isIhsg ? '^JKSE' : s.t + '.JK';
    const candles = generateCandles(s.p, 0.025, 0.001, 90);
    const stockData = buildStockData(symbol, ticker, s.n, s.s, candles, s.cg);
    stockMap.set(ticker, stockData);
  });

  return Array.from(stockMap.values());
}

// In-memory cache for fetched Yahoo data on serverless/node runtime
const serverCache = new Map<string, { data: StockData; timestamp: number }>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute

export async function fetchYahooStockDataServer(ticker: string): Promise<StockData | null> {
  let cleanTicker = ticker.trim().toUpperCase().replace('.JK', '');
  if (cleanTicker === 'IHSG' || cleanTicker === 'JKSE' || cleanTicker === '^JKSE') {
    cleanTicker = '^JKSE';
  }

  const yahooSymbol = cleanTicker.startsWith('^') ? cleanTicker : `${cleanTicker}.JK`;

  // Check in-memory cache
  const cached = serverCache.get(cleanTicker);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const stockMeta = liquidIDXStocks.find(
    (s) => s.t.toUpperCase() === cleanTicker || (cleanTicker === '^JKSE' && s.t === 'IHSG')
  );
  const stockName = stockMeta ? stockMeta.n : `${cleanTicker} Tbk.`;
  const sector = stockMeta ? stockMeta.s : 'Financials';
  const conglomerate = stockMeta?.cg;
  const displayTicker = cleanTicker === '^JKSE' ? 'IHSG' : cleanTicker;

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=1y&includePrePost=true&useYfid=true`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Cache-Control': 'no-cache',
      },
    });

    if (!response.ok) {
      throw new Error(`Yahoo Finance responded with status ${response.status}`);
    }

    const json = await response.json();
    const result = json?.chart?.result?.[0];
    if (!result || !result.timestamp || result.timestamp.length === 0) {
      throw new Error('No chart result returned from Yahoo Finance');
    }

    const timestamps: number[] = result.timestamp;
    const quote = result.indicators?.quote?.[0];
    if (!quote || !quote.open || !quote.close) {
      throw new Error('Malformed quote data in Yahoo response');
    }

    const maxAllowedDateStr = getLatestClosedTradingDateStr();
    const candles: Candle[] = [];
    const seenDates = new Set<string>();

    for (let i = 0; i < timestamps.length; i++) {
      const ts = timestamps[i];
      const open = quote.open[i];
      const high = quote.high[i];
      const low = quote.low[i];
      const close = quote.close[i];
      const volume = quote.volume?.[i] || 0;

      if (open == null || high == null || low == null || close == null || isNaN(close) || close <= 0) {
        continue;
      }

      const dateStr = formatJakartaDate(ts);
      if (dateStr > maxAllowedDateStr) continue;

      if (!seenDates.has(dateStr)) {
        seenDates.add(dateStr);
        candles.push({
          time: dateStr,
          open: Math.round(open),
          high: Math.round(high),
          low: Math.round(low),
          close: Math.round(close),
          volume: Math.max(1000, Math.round(volume)),
        });
      }
    }

    candles.sort((a, b) => a.time.localeCompare(b.time));

    if (candles.length < 5) {
      throw new Error(`Insufficient candle count (${candles.length}) for ${cleanTicker}`);
    }

    const stockData = buildStockData(yahooSymbol, displayTicker, stockName, sector, candles, conglomerate);
    serverCache.set(cleanTicker, { data: stockData, timestamp: Date.now() });
    serverCache.set(displayTicker, { data: stockData, timestamp: Date.now() });
    return stockData;
  } catch (err) {
    console.warn(`Serverless Yahoo fetch failed for ${cleanTicker}:`, err);
    // Return mock fallback on error
    const baseP = stockMeta ? stockMeta.p : 1000;
    const fallbackCandles = generateCandles(baseP, 0.025, 0.001, 90);
    return buildStockData(yahooSymbol, displayTicker, stockName, sector, fallbackCandles, conglomerate);
  }
}

export async function getAllStocksServer(): Promise<StockData[]> {
  const stockMap = new Map<string, StockData>();
  
  // Return list populated from cache and mock defaults
  const baseMock = getMockStocks();
  baseMock.forEach((s) => {
    const cached = serverCache.get(s.ticker.toUpperCase());
    if (cached && cached.data) {
      stockMap.set(s.ticker, cached.data);
    } else {
      stockMap.set(s.ticker, s);
    }
  });

  return Array.from(stockMap.values());
}
