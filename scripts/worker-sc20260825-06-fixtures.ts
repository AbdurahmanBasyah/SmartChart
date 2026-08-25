import assert from 'node:assert/strict';
import {
  buildStockData as buildFrontendStockData,
} from '../src/data/mockStocks';
import {
  detectBosChoch as detectFrontendBosChoch,
  detectOrderBlocks as detectFrontendOrderBlocks,
  detectSwings as detectFrontendSwings,
} from '../src/utils/smcEngine';
import {
  detectBosChoch as detectServerBosChoch,
  detectOrderBlocks as detectServerOrderBlocks,
  detectSwings as detectServerSwings,
} from '../api/_lib/stockEngine';
import type { BosChochLine, Candle, OrderBlock, SwingPoint } from '../src/types';

function candle(index: number, open: number, high: number, low: number, close: number): Candle {
  return {
    time: `2026-04-${String(index + 1).padStart(2, '0')}`,
    open,
    high,
    low,
    close,
    volume: 1_000,
  };
}

function flatCandles(length: number, closeOverrides: Record<number, number> = {}): Candle[] {
  return Array.from({ length }, (_, index) => {
    const close = closeOverrides[index] ?? 90;
    return candle(index, close, Math.max(close, 90) + 1, Math.min(close, 90) - 1, close);
  });
}

function swing(index: number, price: number, type: SwingPoint['type']): SwingPoint {
  return {
    index,
    time: `2026-04-${String(index + 1).padStart(2, '0')}`,
    price,
    type,
  };
}

function normalizeLines(lines: BosChochLine[]) {
  return lines.map(({ id, type, direction, startIndex, endIndex, price, label, time }) => ({
    id,
    type,
    direction,
    startIndex,
    endIndex,
    price,
    label,
    time,
  }));
}

function normalizeOrderBlocks(orderBlocks: OrderBlock[]) {
  return orderBlocks.map((orderBlock) => ({
    id: orderBlock.id,
    type: orderBlock.type,
    top: orderBlock.top,
    bottom: orderBlock.bottom,
    startIndex: orderBlock.startIndex,
    endIndex: orderBlock.endIndex,
    mitigated: orderBlock.mitigated,
    time: orderBlock.time,
    volumeSpike: orderBlock.volumeSpike,
    structureConfirmation: orderBlock.structureConfirmation,
    structureLineId: orderBlock.structureLineId,
    formationIndex: orderBlock.formationIndex,
  }));
}

function baselineObCandles(base: number, bodies: number[] = Array(20).fill(10)): Candle[] {
  return Array.from({ length: 20 }, (_, index) => {
    const body = bodies[index] ?? 0;
    const bullish = index % 2 === 0;
    const open = bullish ? base : base + body;
    const close = bullish ? base + body : base;
    return candle(index, open, Math.max(open, close) + 1, Math.min(open, close) - 1, close);
  });
}

function bullishObCandles(): Candle[] {
  const base = 100;
  const b = candle(20, base + 10, base + 12, base - 5, base);
  const c = candle(21, base, base + 25, base, base + 15);
  const d = candle(22, c.close, c.close + 2, base + 13, c.close + 1);
  return [...baselineObCandles(base), b, c, d];
}

function bearishObCandles(): Candle[] {
  const base = 100;
  const b = candle(20, base + 10, base + 22, base + 9, base + 20);
  const c = candle(21, b.close, b.close, base - 5, b.close - 15);
  const d = candle(22, c.close, base + 8, c.close - 2, c.close - 1);
  return [...baselineObCandles(base), b, c, d];
}

// Confirmed pivot boundary, strict neighbor equality, and dual-side pivot output.
const pivotCandles = [
  candle(0, 8, 9, 6, 8),
  candle(1, 8, 8, 7, 8),
  candle(2, 7, 9, 6, 7),
  candle(3, 7, 10, 5, 8),
  candle(4, 8, 8, 6, 8),
  candle(5, 8, 9, 6, 8),
  candle(6, 8, 9, 6, 8),
];
const pivotSwingsFrontend = detectFrontendSwings(pivotCandles);
const pivotSwingsServer = detectServerSwings(pivotCandles);
assert.deepEqual(pivotSwingsFrontend, pivotSwingsServer);
assert.deepEqual(
  pivotSwingsFrontend.filter((point) => point.index === 3).map((point) => point.type),
  ['HH', 'LL'],
);

const equalHighNeighbor = [...pivotCandles];
equalHighNeighbor[2] = { ...equalHighNeighbor[2], high: 10 };
const equalHighSwings = detectFrontendSwings(equalHighNeighbor).filter((point) => point.index === 3);
assert.deepEqual(equalHighSwings.map((point) => point.type), ['LL']);

const equalLabelCandles = [
  candle(0, 8, 9, 6, 8),
  candle(1, 8, 8, 6, 8),
  candle(2, 8, 9, 6, 8),
  candle(3, 8, 10, 5, 8),
  candle(4, 8, 9, 6, 8),
  candle(5, 8, 9, 6, 8),
  candle(6, 8, 9, 6, 8),
  candle(7, 8, 10, 5, 8),
  candle(8, 8, 9, 6, 8),
  candle(9, 8, 9, 6, 8),
  candle(10, 8, 9, 6, 8),
];
const equalLabels = detectFrontendSwings(equalLabelCandles);
assert.deepEqual(
  equalLabels.filter((point) => point.type === 'HH' || point.type === 'LH').map((point) => point.type),
  ['HH', 'LH'],
);
assert.deepEqual(
  equalLabels.filter((point) => point.type === 'HL' || point.type === 'LL').map((point) => point.type),
  ['LL', 'LL'],
);

// A swing at index 1 is unavailable before candle 4; the line may only appear at candle 5 here.
const bullishStructureCandles = flatCandles(8, { 5: 101, 6: 79, 7: 79 });
const bullishStructureSwings = [swing(1, 100, 'HH'), swing(2, 80, 'HL')];
assert.deepEqual(
  normalizeLines(detectFrontendBosChoch(bullishStructureCandles.slice(0, 5), bullishStructureSwings)),
  [],
);
const bullishLinesFrontend = detectFrontendBosChoch(bullishStructureCandles, bullishStructureSwings);
const bullishLinesServer = detectServerBosChoch(bullishStructureCandles, bullishStructureSwings);
assert.deepEqual(normalizeLines(bullishLinesFrontend), normalizeLines(bullishLinesServer));
assert.deepEqual(
  bullishLinesFrontend.map(({ type, direction, startIndex, endIndex }) => ({ type, direction, startIndex, endIndex })),
  [
    { type: 'BOS', direction: 'bullish', startIndex: 1, endIndex: 5 },
    { type: 'CHoCH', direction: 'bearish', startIndex: 2, endIndex: 6 },
  ],
);

function assertStructureParity(
  candles: Candle[],
  swings: SwingPoint[],
  expected: Array<{ type: BosChochLine['type']; direction: BosChochLine['direction']; startIndex: number; endIndex: number }>,
) {
  const frontend = detectFrontendBosChoch(candles, swings);
  const server = detectServerBosChoch(candles, swings);
  assert.deepEqual(normalizeLines(frontend), normalizeLines(server));
  assert.deepEqual(
    frontend.map(({ type, direction, startIndex, endIndex }) => ({ type, direction, startIndex, endIndex })),
    expected,
  );
}

// Corrective regression: one close crossing nested highs must consume all stale levels.
const nestedHighCandles = flatCandles(8, { 5: 120, 6: 121, 7: 90 });
assertStructureParity(
  nestedHighCandles,
  [swing(1, 100, 'HH'), swing(2, 110, 'HH'), swing(1, 80, 'HL')],
  [{ type: 'BOS', direction: 'bullish', startIndex: 2, endIndex: 5 }],
);

// Corrective regression: nested lows are symmetric and must not emit a stale bearish line.
const nestedLowCandles = flatCandles(8, { 5: 60, 6: 59, 7: 90 });
assertStructureParity(
  nestedLowCandles,
  [swing(1, 100, 'LH'), swing(1, 80, 'LL'), swing(2, 70, 'LL')],
  [{ type: 'BOS', direction: 'bearish', startIndex: 2, endIndex: 5 }],
);

// Three stale references are all consumed on the first break; no later retroactive lines appear.
const threeNestedHighCandles = flatCandles(9, { 6: 120, 7: 121, 8: 90 });
assertStructureParity(
  threeNestedHighCandles,
  [swing(1, 100, 'HH'), swing(2, 110, 'HH'), swing(3, 115, 'HH'), swing(1, 80, 'HL')],
  [{ type: 'BOS', direction: 'bullish', startIndex: 3, endIndex: 6 }],
);

// Crossing only an old level consumes it silently until the latest eligible level is crossed.
const oldOnlyHighCandles = flatCandles(8, { 5: 105, 6: 105, 7: 111 });
assertStructureParity(
  oldOnlyHighCandles,
  [swing(1, 100, 'HH'), swing(2, 110, 'HH'), swing(1, 80, 'HL')],
  [{ type: 'BOS', direction: 'bullish', startIndex: 2, endIndex: 7 }],
);

const oldOnlyLowCandles = flatCandles(8, { 5: 75, 6: 75, 7: 69 });
assertStructureParity(
  oldOnlyLowCandles,
  [swing(1, 100, 'LH'), swing(1, 80, 'LL'), swing(2, 70, 'LL')],
  [{ type: 'BOS', direction: 'bearish', startIndex: 2, endIndex: 7 }],
);

// Neutral crossed references are consumed without a current or next-candle line.
const nestedNeutralCandles = flatCandles(8, { 5: 120, 6: 121, 7: 90 });
assertStructureParity(
  nestedNeutralCandles,
  [swing(1, 100, 'HH'), swing(2, 110, 'HH'), swing(1, 80, 'LL')],
  [],
);

// A later confirmed reference remains eligible for a new event after the prior reference was consumed.
const newReferenceCandles = flatCandles(8, { 5: 105, 6: 111, 7: 90 });
assertStructureParity(
  newReferenceCandles,
  [swing(1, 100, 'HH'), swing(2, 110, 'HH'), swing(1, 80, 'HL')],
  [{ type: 'BOS', direction: 'bullish', startIndex: 2, endIndex: 6 }],
);

// Same-index same-side swings follow the deterministic price/type comparator.
const sameIndexReferenceCandles = flatCandles(7, { 5: 120, 6: 90 });
assertStructureParity(
  sameIndexReferenceCandles,
  [swing(2, 100, 'HH'), swing(2, 110, 'HH'), swing(1, 80, 'HL')],
  [{ type: 'BOS', direction: 'bullish', startIndex: 2, endIndex: 5 }],
);

// All four contextual combinations, neutral consumption, strict close, and no duplicates.
const bearishStructureCandles = flatCandles(8, { 5: 101, 6: 79, 7: 79 });
const bearishStructureLines = detectFrontendBosChoch(
  bearishStructureCandles,
  [swing(1, 100, 'LH'), swing(2, 80, 'LL')],
);
assert.deepEqual(
  bearishStructureLines.map(({ type, direction }) => ({ type, direction })),
  [
    { type: 'CHoCH', direction: 'bullish' },
    { type: 'BOS', direction: 'bearish' },
  ],
);

const neutralLines = detectFrontendBosChoch(
  flatCandles(8, { 5: 101, 6: 79, 7: 79 }),
  [swing(1, 100, 'HH'), swing(2, 80, 'LL')],
);
assert.deepEqual(neutralLines, []);

const equalityAndWickOnly = flatCandles(8, { 5: 100, 6: 90, 7: 90 });
equalityAndWickOnly[5] = { ...equalityAndWickOnly[5], high: 110 };
assert.deepEqual(
  detectFrontendBosChoch(equalityAndWickOnly, [swing(1, 100, 'HH'), swing(2, 80, 'HL')]),
  [],
);

const dualSideLines = detectFrontendBosChoch(
  flatCandles(7, { 5: 97 }),
  [swing(1, 95, 'HH'), swing(2, 100, 'HL')],
);
assert.deepEqual(
  dualSideLines.map(({ direction }) => direction),
  ['bullish', 'bearish'],
);

const bullishAssociationLines: BosChochLine[] = [
  { id: 'before', type: 'CHoCH', direction: 'bullish', startIndex: 2, endIndex: 20, price: 100, label: 'CHoCH', time: '2026-04-21' },
  { id: 'after', type: 'BOS', direction: 'bullish', startIndex: 2, endIndex: 23, price: 100, label: 'BOS', time: '2026-04-24' },
  { id: 'later-end', type: 'BOS', direction: 'bullish', startIndex: 8, endIndex: 22, price: 100, label: 'BOS', time: '2026-04-23' },
  { id: 'same-end-bos', type: 'BOS', direction: 'bullish', startIndex: 15, endIndex: 21, price: 100, label: 'BOS', time: '2026-04-22' },
  { id: 'same-end-choch-old', type: 'CHoCH', direction: 'bullish', startIndex: 14, endIndex: 21, price: 100, label: 'CHoCH', time: '2026-04-22' },
  { id: 'same-end-choch-latest', type: 'CHoCH', direction: 'bullish', startIndex: 16, endIndex: 21, price: 100, label: 'CHoCH', time: '2026-04-22' },
  { id: 'opposite', type: 'BOS', direction: 'bearish', startIndex: 16, endIndex: 21, price: 100, label: 'BOS', time: '2026-04-22' },
];
const bullishOb = bullishObCandles();
const bullishObFrontend = detectFrontendOrderBlocks(bullishOb, bullishOb.map(() => 1_000), bullishAssociationLines);
const bullishObServer = detectServerOrderBlocks(bullishOb, bullishOb.map(() => 1_000), bullishAssociationLines);
assert.deepEqual(normalizeOrderBlocks(bullishObFrontend), normalizeOrderBlocks(bullishObServer));
assert.equal(bullishObFrontend[0]?.structureConfirmation, 'CHOCH');
assert.equal(bullishObFrontend[0]?.structureLineId, 'same-end-choch-latest');
assert.equal(bullishObFrontend[0]?.formationIndex, 22);

const bearishOb = bearishObCandles();
const bearishOnlyLine: BosChochLine[] = [
  { id: 'bear-bos', type: 'BOS', direction: 'bearish', startIndex: 15, endIndex: 22, price: 120, label: 'BOS', time: '2026-04-23' },
];
const bearishObFrontend = detectFrontendOrderBlocks(bearishOb, bearishOb.map(() => 1_000), bearishOnlyLine);
assert.equal(bearishObFrontend[0]?.structureConfirmation, 'BOS');
assert.equal(bearishObFrontend[0]?.structureLineId, 'bear-bos');
assert.equal(bearishObFrontend[0]?.formationIndex, 22);

const noneObFrontend = detectFrontendOrderBlocks(bullishOb, bullishOb.map(() => 1_000));
assert.equal(noneObFrontend[0]?.structureConfirmation, 'NONE');
assert.equal(noneObFrontend[0]?.structureLineId, undefined);
assert.deepEqual(
  noneObFrontend.map(({ id, type, top, bottom, startIndex, endIndex, mitigated }) => ({ id, type, top, bottom, startIndex, endIndex, mitigated })),
  bullishObFrontend.map(({ id, type, top, bottom, startIndex, endIndex, mitigated }) => ({ id, type, top, bottom, startIndex, endIndex, mitigated })),
);

const emptyStock = buildFrontendStockData('EMPTY.JK', 'EMPTY', 'Empty Fixture', 'Fixture', []);
assert.deepEqual(emptyStock.bosChochLines, []);
assert.deepEqual(emptyStock.orderBlocks, []);

console.log('SC-20260825-06 structure, association, parity, and regression fixtures passed.');
