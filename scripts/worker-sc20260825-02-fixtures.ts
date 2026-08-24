import assert from 'node:assert/strict';
import {
  canonicalizeCandlePrices as canonicalizeFrontendCandle,
} from '../src/utils/candleNormalization';
import {
  detectPriceGaps as detectFrontendGaps,
  generateRecommendation as generateFrontendRecommendation,
} from '../src/utils/smcEngine';
import {
  canonicalizeCandlePrices as canonicalizeServerCandle,
  detectPriceGaps as detectServerGaps,
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

console.log('SC-20260825-02 gap, OHLC, tapped, parity, and sorting fixtures passed');
