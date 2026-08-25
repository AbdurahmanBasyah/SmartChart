import assert from 'node:assert/strict';
import {
  canonicalizeCandlePrices as canonicalizeFrontendCandle,
} from '../src/utils/candleNormalization';
import {
  detectPriceGaps as detectFrontendGaps,
  detectOrderBlocks as detectFrontendOrderBlocks,
  generateRecommendation as generateFrontendRecommendation,
} from '../src/utils/smcEngine';
import {
  canonicalizeCandlePrices as canonicalizeServerCandle,
  detectPriceGaps as detectServerGaps,
  detectOrderBlocks as detectServerOrderBlocks,
  generateRecommendation as generateServerRecommendation,
} from '../api/_lib/stockEngine';
import { BrokerInventoryItem, Candle } from '../src/types';
import { sortBrokerInventoryRows } from '../src/utils/brokerSummarySorting';

const identityRound = (value: number) => value;

function candle(
  time: string,
  open: number,
  high: number,
  low: number,
  close: number,
): Candle {
  return { time, open, high, low, close, volume: 1_000 };
}

function assertGapParity(candles: Candle[], expected: Array<{ type: string; top: number; bottom: number }>) {
  const frontend = detectFrontendGaps(candles).map(({ type, top, bottom }) => ({ type, top, bottom }));
  const server = detectServerGaps(candles).map(({ type, top, bottom }) => ({ type, top, bottom }));
  assert.deepEqual(frontend, expected);
  assert.deepEqual(server, expected);
}

const canonicalFrontend = canonicalizeFrontendCandle(695, 745, 700, 730, identityRound);
const canonicalServer = canonicalizeServerCandle(695, 745, 700, 730, identityRound);
assert.deepEqual(canonicalFrontend, { open: 695, high: 745, low: 695, close: 730 });
assert.deepEqual(canonicalServer, canonicalFrontend);

const bullishCreate = [
  candle('2026-01-01', 680, 692, 678, 690),
  candle('2026-01-02', 710, 720, 700, 705),
];
assertGapParity(bullishCreate, [{ type: 'bullish', top: 700, bottom: 690 }]);
assertGapParity(
  [...bullishCreate, candle('2026-01-03', 705, 715, 695, 700)],
  [{ type: 'bullish', top: 695, bottom: 690 }],
);
assertGapParity(
  [...bullishCreate, candle('2026-01-03', 705, 715, 690, 700)],
  [],
);

const bearishCreate = [
  candle('2026-01-01', 690, 702, 688, 700),
  candle('2026-01-02', 680, 690, 675, 680),
];
assertGapParity(bearishCreate, [{ type: 'bearish', top: 700, bottom: 690 }]);
assertGapParity(
  [...bearishCreate, candle('2026-01-03', 680, 695, 670, 685)],
  [{ type: 'bearish', top: 700, bottom: 695 }],
);
assertGapParity(
  [...bearishCreate, candle('2026-01-03', 680, 700, 670, 690)],
  [],
);

const equalOpen = [
  candle('2026-01-01', 680, 702, 650, 690),
  candle('2026-01-02', 690, 720, 700, 705),
];
assertGapParity(equalOpen, []);

const brmsLike = [
  candle('2026-01-01', 680, 700, 670, 695),
  { ...candle('2026-01-02', 695, 745, 700, 730), low: 695 },
];
assertGapParity(brmsLike, []);
assert.notDeepEqual(recommendationStatus(brmsLike), ['TAPPED_POI_REBOUND', 'TAPPED_POI_REBOUND']);

const priorZoneCandles: Candle[] = [
  candle('2026-02-01', 95, 101, 94, 100),
  candle('2026-02-02', 110, 114, 110, 112),
  candle('2026-02-03', 112, 116, 111, 113),
  candle('2026-02-04', 112, 116, 111, 112),
];

function recommendationStatus(candles: Candle[]): [string, string] {
  const emptySwings = [];
  const emptyFvgs = [];
  const emptyOrderBlocks = [];
  const emptySupports = [];
  const emptyGaps = [];
  const volumeMa = candles.map(() => 1_000);
  return [
    generateFrontendRecommendation(
      'BBCA.JK',
      'Fixture',
      candles,
      emptySwings,
      emptyFvgs,
      emptyOrderBlocks,
      emptySupports,
      volumeMa,
      emptyGaps,
    ).status,
    generateServerRecommendation(
      'BBCA.JK',
      'Fixture',
      candles,
      emptySwings,
      emptyFvgs,
      emptyOrderBlocks,
      emptySupports,
      volumeMa,
      emptyGaps,
    ).status,
  ];
}

const validTapped = [
  ...priorZoneCandles,
  candle('2026-02-05', 113, 118, 105, 114),
];
assert.deepEqual(recommendationStatus(validTapped), ['TAPPED_POI_REBOUND', 'TAPPED_POI_REBOUND']);

const upwardCrossing = [
  ...priorZoneCandles,
  candle('2026-02-05', 105, 118, 95, 114),
];
assert.notDeepEqual(recommendationStatus(upwardCrossing), ['TAPPED_POI_REBOUND', 'TAPPED_POI_REBOUND']);

const priorCloseBelowTop = [
  ...priorZoneCandles.slice(0, -1),
  candle('2026-02-04', 108, 110, 104, 104),
  candle('2026-02-05', 113, 118, 105, 114),
];
assert.notDeepEqual(recommendationStatus(priorCloseBelowTop), ['TAPPED_POI_REBOUND', 'TAPPED_POI_REBOUND']);

const priorFilled = [
  ...priorZoneCandles.slice(0, -1),
  candle('2026-02-04', 112, 116, 90, 112),
  candle('2026-02-05', 113, 118, 105, 114),
];
assert.notDeepEqual(recommendationStatus(priorFilled), ['TAPPED_POI_REBOUND', 'TAPPED_POI_REBOUND']);

const lastCreatedZone = [
  candle('2026-02-01', 95, 101, 94, 100),
  candle('2026-02-02', 100, 104, 98, 102),
  candle('2026-02-03', 102, 106, 100, 103),
  candle('2026-02-04', 103, 107, 101, 104),
  candle('2026-02-05', 110, 118, 105, 114),
];
assert.notDeepEqual(recommendationStatus(lastCreatedZone), ['TAPPED_POI_REBOUND', 'TAPPED_POI_REBOUND']);

const equalTop = [...priorZoneCandles, candle('2026-02-05', 110, 118, 105, 110)];
assert.notDeepEqual(recommendationStatus(equalTop), ['TAPPED_POI_REBOUND', 'TAPPED_POI_REBOUND']);

const bearishOnly = [
  candle('2026-02-01', 695, 702, 690, 700),
  candle('2026-02-02', 680, 690, 675, 680),
  candle('2026-02-03', 682, 695, 678, 685),
  candle('2026-02-04', 684, 695, 680, 690),
  candle('2026-02-05', 695, 710, 685, 705),
];
assert.notDeepEqual(recommendationStatus(bearishOnly), ['TAPPED_POI_REBOUND', 'TAPPED_POI_REBOUND']);

type ObFixtureOptions = {
  baselineBodies?: number[];
  bodyC?: number;
  rangeC?: number;
  bHighOffset?: number;
  bLowOffset?: number;
  dGapOffset?: number;
};

function baselineObCandles(base: number, bodies: number[] = Array(20).fill(10)): Candle[] {
  return Array.from({ length: 20 }, (_, index) => {
    const body = bodies[index] ?? 0;
    const bullish = index % 2 === 0;
    const open = bullish ? base : base + body;
    const close = bullish ? base + body : base;
    return candle(
      `2026-03-${String(index + 1).padStart(2, '0')}`,
      open,
      Math.max(open, close) + 1,
      Math.min(open, close) - 1,
      close,
    );
  });
}

function bullishObCandles(options: ObFixtureOptions = {}): Candle[] {
  const base = 100;
  const bodyC = options.bodyC ?? 15;
  const rangeC = options.rangeC ?? 25;
  const bHigh = base + (options.bHighOffset ?? 12);
  const b = candle('2026-03-21', base + 10, bHigh, base - 5, base);
  const c = candle('2026-03-22', base, base + rangeC, base, base + bodyC);
  const dLow = bHigh + (options.dGapOffset ?? 1);
  const d = candle('2026-03-23', c.close, c.close + 2, dLow, c.close + 1);
  return [...baselineObCandles(base, options.baselineBodies), b, c, d];
}

function bearishObCandles(options: ObFixtureOptions = {}): Candle[] {
  const base = 100;
  const bodyC = options.bodyC ?? 15;
  const rangeC = options.rangeC ?? 25;
  const bLow = base + (options.bLowOffset ?? 9);
  const b = candle('2026-03-21', base + 10, base + 22, bLow, base + 20);
  const cClose = b.close - bodyC;
  const c = candle('2026-03-22', b.close, b.close, cClose - (rangeC - bodyC), cClose);
  const dHigh = bLow - (options.dGapOffset ?? 1);
  const d = candle('2026-03-23', c.close, dHigh, c.close - 2, c.close - 1);
  return [...baselineObCandles(base, options.baselineBodies), b, c, d];
}

function normalizeOrderBlocks(orderBlocks: ReturnType<typeof detectFrontendOrderBlocks>) {
  return orderBlocks.map(({ id, type, top, bottom, startIndex, endIndex, mitigated, time, volumeSpike }) => ({
    id,
    type,
    top,
    bottom,
    startIndex,
    endIndex,
    mitigated,
    time,
    volumeSpike,
  }));
}

function assertOrderBlockParity(
  candles: Candle[],
  expected: Array<ReturnType<typeof normalizeOrderBlocks>[number]>,
) {
  const volumeMa = candles.map(() => 1_000);
  const frontend = normalizeOrderBlocks(detectFrontendOrderBlocks(candles, volumeMa));
  const server = normalizeOrderBlocks(detectServerOrderBlocks(candles, volumeMa));
  assert.deepEqual(frontend, expected);
  assert.deepEqual(server, expected);
}

function assertNoOrderBlock(candles: Candle[]) {
  assertOrderBlockParity(candles, []);
}

const validBullishOb = bullishObCandles();
assertOrderBlockParity(validBullishOb, [{
  id: 'ob-bull-20',
  type: 'bullish',
  top: 110,
  bottom: 95,
  startIndex: 20,
  endIndex: 22,
  mitigated: false,
  time: '2026-03-21',
  volumeSpike: false,
}]);

const validBearishOb = bearishObCandles();
assertOrderBlockParity(validBearishOb, [{
  id: 'ob-bear-20',
  type: 'bearish',
  top: 122,
  bottom: 110,
  startIndex: 20,
  endIndex: 22,
  mitigated: false,
  time: '2026-03-21',
  volumeSpike: false,
}]);

const noLeftNeighbor = [
  ...validBullishOb.slice(20),
  candle('2026-03-24', 116, 118, 113, 117),
];
assertNoOrderBlock(noLeftNeighbor);

const bullishEqualLeft = [...validBullishOb];
bullishEqualLeft[19] = { ...bullishEqualLeft[19], low: 95 };
assertNoOrderBlock(bullishEqualLeft);

const bullishEqualRight = [...validBullishOb];
bullishEqualRight[21] = { ...bullishEqualRight[21], high: 120, low: 95 };
assertNoOrderBlock(bullishEqualRight);

const bullishHigherThanLeft = [...validBullishOb];
bullishHigherThanLeft[20] = { ...bullishHigherThanLeft[20], low: 100 };
bullishHigherThanLeft[21] = { ...bullishHigherThanLeft[21], high: 126, low: 101 };
assertNoOrderBlock(bullishHigherThanLeft);

const bearishEqualLeft = [...validBearishOb];
bearishEqualLeft[19] = { ...bearishEqualLeft[19], high: 122 };
assertNoOrderBlock(bearishEqualLeft);

const bearishEqualRight = [...validBearishOb];
bearishEqualRight[21] = { ...bearishEqualRight[21], high: 122, low: 97 };
assertNoOrderBlock(bearishEqualRight);

const bearishLowerThanLeft = [...validBearishOb];
bearishLowerThanLeft[19] = { ...bearishLowerThanLeft[19], high: 123 };
assertNoOrderBlock(bearishLowerThanLeft);

const wrongColorB = bullishObCandles();
wrongColorB[20] = candle('2026-03-21', 100, 112, 95, 105);
assertNoOrderBlock(wrongColorB);

const dojiB = bullishObCandles();
dojiB[20] = candle('2026-03-21', 100, 112, 95, 100);
assertNoOrderBlock(dojiB);

const wrongDirectionC = bullishObCandles();
wrongDirectionC[21] = candle('2026-03-22', 115, 116, 100, 114);
assertNoOrderBlock(wrongDirectionC);

assertNoOrderBlock(bullishObCandles({ bodyC: 15, rangeC: 26 }));
assertNoOrderBlock(bullishObCandles({ bodyC: 14, rangeC: 20 }));
assertNoOrderBlock(bullishObCandles({ baselineBodies: Array(20).fill(0) }));

assertNoOrderBlock(bullishObCandles({ bHighOffset: 15 }));
assertNoOrderBlock(bearishObCandles({ bLowOffset: 5 }));
assertNoOrderBlock(bullishObCandles({ dGapOffset: 0 }));
assertNoOrderBlock(bearishObCandles({ dGapOffset: 0 }));

const nonAdjacentFvgOnly = [
  ...bullishObCandles({ dGapOffset: 0 }),
  candle('2026-03-24', 126, 130, 126, 129),
];
assertNoOrderBlock(nonAdjacentFvgOnly);

const fvgFilledButObActive = [
  ...validBullishOb,
  candle('2026-03-24', 114, 115, 110, 111),
];
assertOrderBlockParity(fvgFilledButObActive, [{
  id: 'ob-bull-20',
  type: 'bullish',
  top: 110,
  bottom: 95,
  startIndex: 20,
  endIndex: 23,
  mitigated: false,
  time: '2026-03-21',
  volumeSpike: false,
}]);

const bullishEqualityAfterD = [
  ...validBullishOb,
  candle('2026-03-24', 114, 115, 94, 95),
];
assertOrderBlockParity(bullishEqualityAfterD, [{
  id: 'ob-bull-20',
  type: 'bullish',
  top: 110,
  bottom: 95,
  startIndex: 20,
  endIndex: 23,
  mitigated: false,
  time: '2026-03-21',
  volumeSpike: false,
}]);

const bullishInvalidatedAfterD = [
  ...validBullishOb,
  candle('2026-03-24', 114, 115, 90, 94),
];
assertNoOrderBlock(bullishInvalidatedAfterD);

const bearishEqualityAfterD = [
  ...validBearishOb,
  candle('2026-03-24', 108, 123, 107, 122),
];
assertOrderBlockParity(bearishEqualityAfterD, [{
  id: 'ob-bear-20',
  type: 'bearish',
  top: 122,
  bottom: 110,
  startIndex: 20,
  endIndex: 23,
  mitigated: false,
  time: '2026-03-21',
  volumeSpike: false,
}]);

const bearishInvalidatedAfterD = [
  ...validBearishOb,
  candle('2026-03-24', 108, 123, 107, 123),
];
assertNoOrderBlock(bearishInvalidatedAfterD);

assert.notDeepEqual(recommendationStatus(validBullishOb), ['TAPPED_POI_REBOUND', 'TAPPED_POI_REBOUND']);
const tappedAfterFormation = [
  ...validBullishOb,
  candle('2026-03-24', 116, 118, 109, 114),
];
assert.deepEqual(recommendationStatus(tappedAfterFormation), ['TAPPED_POI_REBOUND', 'TAPPED_POI_REBOUND']);

const broker = (brokerCode: string, netVol: number, netVal: number): BrokerInventoryItem => ({
  brokerCode,
  brokerName: brokerCode,
  type: 'RETAIL',
  totalBuyVol: 0,
  totalSellVol: 0,
  totalBuyVal: 0,
  totalSellVal: 0,
  netVol,
  netVal,
  avgBuyPrice: 0,
  avgSellPrice: 0,
  cleanTendency: 'NEUTRAL',
  cleanRatio: 0,
  churnRatio: 0,
  category: netVol >= 0 ? 'NET_BUY' : 'NET_SELL',
  color: '#fff',
  visible: false,
  rank: 0,
  dailyPoints: [],
});

const sorted = sortBrokerInventoryRows([
  broker('ZZ', -100, 900),
  broker('AA', 200, 100),
  broker('AB', 200, 200),
  broker('AC', 200, 200),
]);
assert.deepEqual(sorted.map((row) => row.brokerCode), ['AB', 'AC', 'AA', 'ZZ']);

console.log('SC-20260825-05 strict local-pivot Order Block, gap, OHLC, tapped, parity, and sorting fixtures passed');
