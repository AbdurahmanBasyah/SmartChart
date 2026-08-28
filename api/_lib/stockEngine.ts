// Self-contained Stock Data & Smart Money Concept (SMC) Engine for Vercel Serverless & Node Express API

import type { NaraSummary } from '../../src/types.js';
import { buildChartNaraSummary } from '../../src/utils/naraEvidenceEngine.js';
import {
  fetchYahooRawOhlcv,
  normalizeTicker,
} from './rawOhlcvSnapshot.js';
import type { AnyRawOhlcvSnapshot } from './rawOhlcvSnapshot.js';
import { CANONICAL_STOCK_UNIVERSE } from '../../shared/stockUniverse.js';
import type { CanonicalStockConfig } from '../../shared/stockUniverse.js';

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
  structureConfirmation: 'BOS' | 'CHOCH' | 'NONE';
  structureLineId?: string;
  formationIndex: number;
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
  takeProfit3?: number;
  takeProfit3Percent?: number;
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
  isRealData?: boolean;
  naraSummary?: NaraSummary;
  source?: 'YAHOO' | 'SYNTHETIC' | 'UNKNOWN';
  fetchedAt?: string;
  tradeDate?: string;
  snapshotSchemaVersion?: number;
}

export type StockRawConfig = CanonicalStockConfig;

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

export interface CanonicalCandlePrices {
  open: number;
  high: number;
  low: number;
  close: number;
}

export function canonicalizeCandlePrices(
  open: number,
  high: number,
  low: number,
  close: number,
  roundPrice: (value: number) => number,
): CanonicalCandlePrices {
  const roundedOpen = roundPrice(open);
  const roundedHigh = roundPrice(high);
  const roundedLow = roundPrice(low);
  const roundedClose = roundPrice(close);

  return {
    open: roundedOpen,
    high: Math.max(roundedHigh, roundedOpen, roundedClose),
    low: Math.min(roundedLow, roundedOpen, roundedClose),
    close: roundedClose,
  };
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

  let previousHigh: SwingPoint | null = null;
  let previousLow: SwingPoint | null = null;

  for (let i = lookback; i <= candles.length - lookback - 1; i++) {
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
      const swing: SwingPoint = {
        index: i,
        time: candles[i].time,
        price: currentHigh,
        type: !previousHigh || currentHigh > previousHigh.price ? 'HH' : 'LH',
      };
      swings.push(swing);
      previousHigh = swing;
    }

    if (isLow) {
      const swing: SwingPoint = {
        index: i,
        time: candles[i].time,
        price: currentLow,
        type: !previousLow ? 'LL' : currentLow > previousLow.price ? 'HL' : 'LL',
      };
      swings.push(swing);
      previousLow = swing;
    }
  }

  return swings;
}

const SWING_LOOKBACK = 3;

export function detectBosChoch(candles: Candle[], swings: SwingPoint[]): BosChochLine[] {
  const lines: BosChochLine[] = [];
  if (!candles || candles.length < 2 || !swings || swings.length === 0) return lines;

  const sortedSwings = [...swings].sort((a, b) => {
    if (a.index !== b.index) return a.index - b.index;
    if (a.price !== b.price) return a.price - b.price;
    return a.type.localeCompare(b.type);
  });
  const consumedHighIndexes = new Set<number>();
  const consumedLowIndexes = new Set<number>();

  for (let c = 0; c < candles.length; c++) {
    const candle = candles[c];
    const confirmedSwings = sortedSwings.filter((s) => s.index + SWING_LOOKBACK <= c);
    let latestHigh: SwingPoint | null = null;
    let latestLow: SwingPoint | null = null;

    for (const swing of confirmedSwings) {
      if (swing.type === 'HH' || swing.type === 'LH') latestHigh = swing;
      if (swing.type === 'HL' || swing.type === 'LL') latestLow = swing;
    }

    const priorStructure =
      latestHigh?.type === 'HH' && latestLow?.type === 'HL'
        ? 'BULLISH'
        : latestHigh?.type === 'LH' && latestLow?.type === 'LL'
          ? 'BEARISH'
          : 'NEUTRAL';

    let latestEligibleHigh: SwingPoint | null = null;
    let latestEligibleLow: SwingPoint | null = null;
    for (let i = confirmedSwings.length - 1; i >= 0; i--) {
      const swing = confirmedSwings[i];
      if (!latestEligibleHigh && (swing.type === 'HH' || swing.type === 'LH') && !consumedHighIndexes.has(swing.index)) {
        latestEligibleHigh = swing;
      }
      if (!latestEligibleLow && (swing.type === 'HL' || swing.type === 'LL') && !consumedLowIndexes.has(swing.index)) {
        latestEligibleLow = swing;
      }
      if (latestEligibleHigh && latestEligibleLow) break;
    }

    const crossedHighs = confirmedSwings.filter(
      (swing) =>
        (swing.type === 'HH' || swing.type === 'LH') &&
        !consumedHighIndexes.has(swing.index) &&
        candle.close > swing.price,
    );
    const crossedLows = confirmedSwings.filter(
      (swing) =>
        (swing.type === 'HL' || swing.type === 'LL') &&
        !consumedLowIndexes.has(swing.index) &&
        candle.close < swing.price,
    );

    crossedHighs.forEach((swing) => consumedHighIndexes.add(swing.index));
    crossedLows.forEach((swing) => consumedLowIndexes.add(swing.index));

    if (latestEligibleHigh && crossedHighs.some((swing) => swing.index === latestEligibleHigh?.index)) {
      if (priorStructure !== 'NEUTRAL') {
        const type = priorStructure === 'BULLISH' ? 'BOS' : 'CHoCH';
        lines.push({
          id: `${type}-bullish-${latestEligibleHigh.index}-${c}`,
          type,
          direction: 'bullish',
          startIndex: latestEligibleHigh.index,
          endIndex: c,
          price: latestEligibleHigh.price,
          label: type,
          time: candle.time,
        });
      }
    }

    if (latestEligibleLow && crossedLows.some((swing) => swing.index === latestEligibleLow?.index)) {
      if (priorStructure !== 'NEUTRAL') {
        const type = priorStructure === 'BEARISH' ? 'BOS' : 'CHoCH';
        lines.push({
          id: `${type}-bearish-${latestEligibleLow.index}-${c}`,
          type,
          direction: 'bearish',
          startIndex: latestEligibleLow.index,
          endIndex: c,
          price: latestEligibleLow.price,
          label: type,
          time: candle.time,
        });
      }
    }
  }

  return lines;
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

    if (curr.open > prev.close) {
      const bottom = prev.close;
      const initialTop = curr.open;
      let minimumReachedLow = initialTop;

      for (let j = i; j < candles.length; j++) {
        if (candles[j].low < initialTop) {
          minimumReachedLow = Math.min(
            minimumReachedLow,
            Math.max(bottom, candles[j].low),
          );
        }
      }

      const top = Math.min(initialTop, minimumReachedLow);
      if (top > bottom) {
        gaps.push({
          id: `gap-bull-${i}`,
          type: 'bullish',
          top,
          bottom,
          startIndex: i - 1,
          endIndex: candles.length - 1,
          mitigated: false,
          time: curr.time,
        });
      }
    }

    if (curr.open < prev.close) {
      const initialBottom = curr.open;
      const top = prev.close;
      let maximumReachedHigh = initialBottom;

      for (let j = i; j < candles.length; j++) {
        if (candles[j].high > initialBottom) {
          maximumReachedHigh = Math.max(
            maximumReachedHigh,
            Math.min(top, candles[j].high),
          );
        }
      }

      const bottom = Math.max(initialBottom, maximumReachedHigh);
      if (bottom < top) {
        gaps.push({
          id: `gap-bear-${i}`,
          type: 'bearish',
          top,
          bottom,
          startIndex: i - 1,
          endIndex: candles.length - 1,
          mitigated: false,
          time: curr.time,
        });
      }
    }
  }

  return gaps;
}

function medianPositiveBodyBefore(candles: Candle[], endExclusive: number): number | null {
  const bodies = candles
    .slice(Math.max(0, endExclusive - 20), endExclusive)
    .map((candle) => Math.abs(candle.close - candle.open))
    .filter((body) => body > 0)
    .sort((a, b) => a - b);

  if (bodies.length < 5) return null;
  const middle = Math.floor(bodies.length / 2);
  return bodies.length % 2 === 1
    ? bodies[middle]
    : (bodies[middle - 1] + bodies[middle]) / 2;
}

function isDisplacementCandle(candles: Candle[], cIndex: number): boolean {
  const c = candles[cIndex];
  if (!c) return false;

  const body = Math.abs(c.close - c.open);
  const range = c.high - c.low;
  const medianBody = medianPositiveBodyBefore(candles, cIndex);

  return (
    medianBody !== null &&
    range > 0 &&
    body >= 1.5 * medianBody &&
    body / range >= 0.60
  );
}

/** Detect only confirmed Order Blocks formed by an adjacent B-C-D sequence. */
export function detectOrderBlocks(
  candles: Candle[],
  volumeMa: (number | null)[],
  bosChochLines: BosChochLine[] = [],
): OrderBlock[] {
  const orderBlocks: OrderBlock[] = [];
  if (!candles || candles.length < 4) return orderBlocks;

  const chooseStructureLine = (
    direction: 'bullish' | 'bearish',
    originIndex: number,
  ): { structureConfirmation: 'BOS' | 'CHOCH' | 'NONE'; structureLineId?: string } => {
    const candidates = bosChochLines
      .filter(
        (line) =>
          line.direction === direction &&
          (line.endIndex === originIndex + 1 || line.endIndex === originIndex + 2),
      )
      .sort((a, b) => {
        if (a.endIndex !== b.endIndex) return a.endIndex - b.endIndex;
        if (a.type !== b.type) return a.type === 'CHoCH' ? -1 : 1;
        if (a.startIndex !== b.startIndex) return b.startIndex - a.startIndex;
        return a.id.localeCompare(b.id);
      });

    const line = candidates[0];
    return line
      ? { structureConfirmation: line.type === 'CHoCH' ? 'CHOCH' : 'BOS', structureLineId: line.id }
      : { structureConfirmation: 'NONE' };
  };

  for (let i = 1; i <= candles.length - 3; i++) {
    const a = candles[i - 1];
    const b = candles[i];
    const c = candles[i + 1];
    const d = candles[i + 2];
    const displacement = isDisplacementCandle(candles, i + 1);
    const bullish =
      b.low < a.low &&
      b.low < c.low &&
      b.close < b.open &&
      c.close > c.open &&
      displacement &&
      c.close > b.high &&
      d.low > b.high;
    const bearish =
      b.high > a.high &&
      b.high > c.high &&
      b.close > b.open &&
      c.close < c.open &&
      displacement &&
      c.close < b.low &&
      d.high < b.low;

    if (!bullish && !bearish) continue;

    let invalidationIndex = -1;
    for (let j = i + 3; j < candles.length; j++) {
      if ((bullish && candles[j].close < b.low) || (bearish && candles[j].close > b.high)) {
        invalidationIndex = j;
        break;
      }
    }
    if (invalidationIndex !== -1) continue;

    const vMa = volumeMa[i];
    const volumeSpike = vMa !== null && b.volume > vMa * 1.3;
    const structure = chooseStructureLine(bullish ? 'bullish' : 'bearish', i);
    orderBlocks.push({
      id: `${bullish ? 'ob-bull' : 'ob-bear'}-${i}`,
      type: bullish ? 'bullish' : 'bearish',
      top: Math.round(bullish ? Math.max(b.open, b.close) : b.high),
      bottom: Math.round(bullish ? b.low : Math.min(b.open, b.close)),
      startIndex: i,
      endIndex: candles.length - 1,
      mitigated: false,
      time: b.time,
      volumeSpike,
      ...structure,
      formationIndex: i + 2,
    });
  }

  return orderBlocks;
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

interface PriorTappedZone {
  type: 'ORDER_BLOCK' | 'FVG' | 'GAP';
  top: number;
  bottom: number;
}

function findPriorTappedBullishZone(candles: Candle[], isIhsg: boolean): PriorTappedZone | null {
  if (candles.length < 2) return null;

  const lastIndex = candles.length - 1;
  const previousCandle = candles[lastIndex - 1];
  const lastCandle = candles[lastIndex];
  const priorCandles = candles.slice(0, -1);
  const priorFvgs = detectFVGs(priorCandles, isIhsg)
    .filter((zone) => zone.type === 'bullish' && !zone.mitigated);
  const priorOrderBlocks = detectOrderBlocks(
    priorCandles,
    calculateVolumeMA(priorCandles, 20),
  ).filter((zone) => zone.type === 'bullish' && !zone.mitigated);
  const priorGaps = detectPriceGaps(priorCandles)
    .filter((zone) => zone.type === 'bullish' && !zone.mitigated);
  const candidates: PriorTappedZone[] = [
    ...priorOrderBlocks.map((zone) => ({ type: 'ORDER_BLOCK' as const, top: zone.top, bottom: zone.bottom })),
    ...priorFvgs.map((zone) => ({ type: 'FVG' as const, top: zone.top, bottom: zone.bottom })),
    ...priorGaps.map((zone) => ({ type: 'GAP' as const, top: zone.top, bottom: zone.bottom })),
  ];

  return candidates.find(
    (zone) =>
      previousCandle.close > zone.top &&
      lastCandle.open > zone.top &&
      lastCandle.low <= zone.top &&
      lastCandle.high >= zone.bottom &&
      lastCandle.close > zone.top,
  ) || null;
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

  if (candidates.length > 0) {
    candidates.sort((a, b) => a.dist - b.dist);
    const chosen = candidates[0];
    if (chosen.dist <= currentPrice * 0.15) {
      entryMin = chosen.min;
      entryMax = chosen.max;
      primaryZoneType = chosen.type;
      primaryZonePrice = chosen.max;
      reasoning.push(chosen.desc);
    } else {
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

  let tp1 = addIdxTicks(entryMax, Math.max(2, Math.round((slDistance * 2.2) / getIdxTickSize(entryMax, isIhsg))), isIhsg);
  tp1 = roundToIdxTick(tp1, isIhsg);
  if (tp1 <= entryMax) {
    tp1 = addIdxTicks(entryMax, 2, isIhsg);
  }

  let tp2 = addIdxTicks(tp1, Math.max(2, Math.round((slDistance * 2.0) / getIdxTickSize(tp1, isIhsg))), isIhsg);
  tp2 = roundToIdxTick(tp2, isIhsg);
  if (tp2 <= tp1) {
    tp2 = addIdxTicks(tp1, Math.max(2, Math.round(tp1 * 0.08 / getIdxTickSize(tp1, isIhsg))), isIhsg);
  }

  let tp3 = addIdxTicks(tp2, Math.max(2, Math.round((slDistance * 2.5) / getIdxTickSize(tp2, isIhsg))), isIhsg);
  tp3 = roundToIdxTick(tp3, isIhsg);
  if (tp3 <= tp2) {
    tp3 = addIdxTicks(tp2, Math.max(2, Math.round(tp2 * 0.10 / getIdxTickSize(tp2, isIhsg))), isIhsg);
  }

  const tp1Percent = parseFloat((((tp1 - entryMax) / entryMax) * 100).toFixed(1));
  const tp2Percent = parseFloat((((tp2 - entryMax) / entryMax) * 100).toFixed(1));
  const tp3Percent = parseFloat((((tp3 - entryMax) / entryMax) * 100).toFixed(1));

  const riskRewardRatio = parseFloat((tp1Percent / Math.max(0.1, stopLossPercent)).toFixed(2));

  // Determine signal status
  const hasConfirmedPoi = primaryZoneType !== 'NONE';
  const isOnBuyArea = hasConfirmedPoi && currentPrice >= entryMin && currentPrice <= entryMax;
  const isNearEntry = hasConfirmedPoi && !isBreakoutRising && currentPrice > entryMax && currentPrice <= entryMax * 1.03;

  const tappedZone = lastCandle
    ? findPriorTappedBullishZone(candles, isIhsg)
    : null;
  const isRecentTappedPoi = Boolean(tappedZone);

  let status: TradeRecommendation['status'] = 'WAIT_PULLBACK_FVG';

  if (isRecentTappedPoi) {
    status = 'TAPPED_POI_REBOUND';
    reasoning.unshift(
      `TAPPED POI REBOUND: Low Rp ${lastCandle?.low.toLocaleString()} retraced from above into active ${tappedZone?.type} Rp ${tappedZone?.bottom.toLocaleString()} - ${tappedZone?.top.toLocaleString()} and closed at Rp ${lastCandle?.close.toLocaleString()} above the zone.`,
    );
  } else if (isOnBuyArea && volumeConfirmation) {
    status = 'STRONG_BUY_POI';
  } else if (isOnBuyArea) {
    status = 'ON_BUY_AREA';
  } else if (isBreakoutRising || !hasConfirmedPoi || (currentPrice > entryMax * 1.08 && !activeBullFvgs.some(f => f.top >= currentPrice * 0.90))) {
    status = 'WAIT_FVG_CREATION';
  } else if (isNearEntry) {
    status = 'NEAR_ENTRY';
  } else if (structure === 'SIDEWAYS') {
    status = 'SIDEWAYS_ACCUMULATION';
  } else if (currentPrice > entryMax) {
    status = 'WAIT_PULLBACK_FVG';
  } else {
    status = 'WAIT_VOLUME_CONFIRMATION';
  }

  const scenario: SmcScenario = {
    title: `${structure === 'RALLYING' ? 'Bullish Expansion' : 'Accumulation Retest'} Scenario`,
    type: structure === 'RALLYING' ? 'BOS_CONTINUATION' : 'PULLBACK_RETEST',
    probability: volumeConfirmation ? 'VERY HIGH' : 'HIGH',
    targetDescription: `Target TP1: Rp ${tp1.toLocaleString()} (+${tp1Percent}%) | TP2: Rp ${tp2.toLocaleString()} | TP3: Rp ${tp3.toLocaleString()}`,
    steps: [
      `Price pulls back to test ${primaryZoneType} area at Rp ${entryMin.toLocaleString()} - ${entryMax.toLocaleString()}`,
      `Smart money absorbs sell volume with institutional volume spike`,
      `Impulsive rebound towards TP1 (Rp ${tp1.toLocaleString()}), TP2 (Rp ${tp2.toLocaleString()}), and TP3 (Rp ${tp3.toLocaleString()})`
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
    takeProfit3: tp3,
    takeProfit3Percent: tp3Percent,
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

export function buildStockData(
  symbol: string,
  ticker: string,
  name: string,
  sector: string,
  candles: Candle[],
  conglomerate?: string,
  isRealData?: boolean
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
  const orderBlocks = detectOrderBlocks(candles, volumeMa20, bosChochLines);
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

  const stockData: StockData = {
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
    isRealData,
  };

  stockData.naraSummary = buildChartNaraSummary({
    ticker,
    isRealData,
    candles,
    swings,
    bosChochLines,
    fvgs,
    orderBlocks,
    priceGaps,
    supportResistance,
    indicators: stockData.indicators,
    asOfDate: candles[candles.length - 1]?.time,
    sourceMetadata: {
      ticker,
      timeframe: '1D',
      asOfDate: candles[candles.length - 1]?.time,
      source: isRealData === true ? 'REAL' : isRealData === false ? 'SYNTHETIC' : 'UNKNOWN',
    },
  });

  return stockData;
}

export function buildStockDataFromRawSnapshot(snapshot: AnyRawOhlcvSnapshot): StockData {
  const metadata = liquidIDXStocks.find(
    (stock) => stock.t === snapshot.ticker,
  );
  const stockData = buildStockData(
    snapshot.symbol,
    snapshot.ticker,
    metadata?.n ?? `${snapshot.ticker} Tbk.`,
    metadata?.s ?? 'IDX Market',
    snapshot.candles,
    metadata?.cg,
    true,
  );
  stockData.source = snapshot.source;
  stockData.fetchedAt = snapshot.fetchedAt;
  stockData.tradeDate = snapshot.tradeDate;
  stockData.snapshotSchemaVersion = snapshot.schemaVersion;
  return stockData;
}

export const liquidIDXStocks: readonly StockRawConfig[] = CANONICAL_STOCK_UNIVERSE;

// In-memory cache for fetched Yahoo data on serverless/node runtime
const serverCache = new Map<string, { data: StockData; timestamp: number }>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute

export async function fetchYahooStockDataServer(ticker: string): Promise<StockData | null> {
  const cleanTicker = normalizeTicker(ticker);

  // Check in-memory cache
  const cached = serverCache.get(cleanTicker);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const snapshot = await fetchYahooRawOhlcv(cleanTicker);
    const stockData = buildStockDataFromRawSnapshot(snapshot);
    serverCache.set(cleanTicker, { data: stockData, timestamp: Date.now() });
    if (cleanTicker === 'IHSG') serverCache.set('^JKSE', { data: stockData, timestamp: Date.now() });
    return stockData;
  } catch (err) {
    throw err;
  }
}

export async function getAllStocksServer(): Promise<StockData[]> {
  const stockMap = new Map<string, StockData>();
  for (const config of liquidIDXStocks) {
    const ticker = config.t === 'IHSG' ? 'IHSG' : config.t;
    const cached = serverCache.get(ticker);
    if (cached?.data?.isRealData === true) stockMap.set(ticker, cached.data);
  }
  return Array.from(stockMap.values());
}
