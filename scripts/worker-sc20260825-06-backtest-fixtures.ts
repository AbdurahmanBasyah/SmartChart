import assert from 'node:assert/strict';
import {
  bootstrapIntervals,
  canonicalCandleHash,
  classifyFormationPartition,
  differenceOfMetricSummaries,
  drawTickerMultiset,
  evaluateFormation,
  metricSummary,
  pairedBootstrapSamples,
  snapshotRootHash,
} from './backtest-ob-structure';
import type { BacktestEvent, Formation } from './backtest-ob-structure';
import type { Candle } from '../src/types';

function candle(index: number, overrides: Partial<Candle> = {}): Candle {
  return {
    time: `2026-05-${String(index + 1).padStart(2, '0')}`,
    open: 100,
    high: 101,
    low: 99,
    close: 100,
    volume: 1_000,
    ...overrides,
  };
}

function baselineCandles(length: number): Candle[] {
  return Array.from({ length }, (_, index) => candle(index));
}

function formation(direction: 'bullish' | 'bearish', formationIndex: number): Formation {
  return {
    id: `${direction}-${formationIndex}`,
    direction,
    confirmation: 'NONE',
    startIndex: formationIndex - 2,
    formationIndex,
    top: direction === 'bullish' ? 100 : 110,
    bottom: direction === 'bullish' ? 90 : 100,
    invalidationIndex: null,
  };
}

const bullishCandles = baselineCandles(45);
bullishCandles[16] = candle(16, { high: 101, low: 95, close: 101 });
bullishCandles[17] = candle(17, { high: 103, low: 99, close: 101 });
bullishCandles[22] = candle(22, { high: 10_000, low: 99, close: 100 });
const bullishEvent = evaluateFormation('BULL', bullishCandles, formation('bullish', 15), 20);
assert.equal(bullishEvent.partition, 'calibration');
assert.equal(bullishEvent.status, 'RETESTED');
assert.equal(bullishEvent.primaryOutcome, 'SUCCESS');
assert.equal(bullishEvent.atr, 2);
assert.equal(bullishEvent.mfe['5'], 1.5);
assert.equal(bullishEvent.mae['5'], 0.5);
assert.equal(bullishEvent.mfe['10'], 4_950);

const bullishFutureChanged = bullishCandles.map((current, index) =>
  index > 16 ? { ...current, high: 10_000, low: 1, close: 100 } : current,
);
const bullishFutureChangedEvent = evaluateFormation('BULL', bullishFutureChanged, formation('bullish', 15), 20);
assert.equal(bullishFutureChangedEvent.atr, bullishEvent.atr);

const holdoutEvent = evaluateFormation('BULL', bullishCandles, formation('bullish', 20), 20);
assert.equal(holdoutEvent.partition, 'holdout');

const bearishCandles = baselineCandles(45);
bearishCandles[16] = candle(16, { high: 105, low: 99, close: 99 });
bearishCandles[17] = candle(17, { high: 101, low: 97, close: 99 });
const bearishEvent = evaluateFormation('BEAR', bearishCandles, formation('bearish', 15), 20);
assert.equal(bearishEvent.primaryOutcome, 'SUCCESS');
assert.equal(bearishEvent.atr, 2);
assert.equal(bearishEvent.mfe['5'], 1.5);
assert.equal(bearishEvent.mae['5'], 0.5);

const ambiguousCandles = baselineCandles(45);
ambiguousCandles[16] = candle(16, { high: 101, low: 89, close: 89 });
const ambiguousEvent = evaluateFormation('AMBIGUOUS', ambiguousCandles, formation('bullish', 15), 20);
assert.equal(ambiguousEvent.status, 'AMBIGUOUS_SAME_BAR');
assert.equal(ambiguousEvent.primaryOutcome, null);
assert.equal(ambiguousEvent.primaryFailureReason, 'FIRST_RETEST_AND_INVALIDATION_SAME_BAR');

const firstRetestTargetCandles = baselineCandles(45);
firstRetestTargetCandles[16] = candle(16, { high: 103, low: 95, close: 101 });
const firstRetestTargetEvent = evaluateFormation('FIRST_TARGET', firstRetestTargetCandles, formation('bullish', 15), 20);
assert.equal(firstRetestTargetEvent.status, 'AMBIGUOUS_SAME_BAR');
assert.equal(firstRetestTargetEvent.primaryOutcome, null);
assert.equal(firstRetestTargetEvent.primaryFailureReason, 'FIRST_RETEST_AND_TARGET_SAME_BAR');

const firstRetestTargetInvalidationCandles = baselineCandles(45);
firstRetestTargetInvalidationCandles[16] = candle(16, { high: 103, low: 89, close: 89 });
const firstRetestTargetInvalidationEvent = evaluateFormation(
  'FIRST_TARGET_INVALIDATION',
  firstRetestTargetInvalidationCandles,
  formation('bullish', 15),
  20,
);
assert.equal(firstRetestTargetInvalidationEvent.status, 'AMBIGUOUS_SAME_BAR');
assert.equal(firstRetestTargetInvalidationEvent.primaryOutcome, null);
assert.equal(
  firstRetestTargetInvalidationEvent.primaryFailureReason,
  'FIRST_RETEST_TARGET_AND_INVALIDATION_SAME_BAR',
);

const futureTargetInvalidationCandles = baselineCandles(45);
futureTargetInvalidationCandles[16] = candle(16, { high: 101, low: 95, close: 101 });
futureTargetInvalidationCandles[17] = candle(17, { high: 103, low: 99, close: 89 });
const futureTargetInvalidationEvent = evaluateFormation(
  'FUTURE_TARGET_INVALIDATION',
  futureTargetInvalidationCandles,
  formation('bullish', 15),
  20,
);
assert.equal(futureTargetInvalidationEvent.status, 'AMBIGUOUS_SAME_BAR');
assert.equal(futureTargetInvalidationEvent.primaryOutcome, null);
assert.equal(futureTargetInvalidationEvent.primaryFailureReason, 'TARGET_AND_INVALIDATION_SAME_BAR');

const censoredEvent = evaluateFormation('CENSORED', baselineCandles(25), formation('bullish', 20), 20);
assert.equal(censoredEvent.status, 'CENSORED');
assert.equal(censoredEvent.primaryOutcome, null);

function clusteredEvent(ticker: string, confirmation: 'BOS' | 'NONE', success: boolean): BacktestEvent {
  return {
    ticker,
    partition: 'holdout',
    direction: 'bullish',
    confirmation,
    formationIndex: 30,
    status: 'RETESTED',
    retestIndex: 31,
    primaryOutcome: success ? 'SUCCESS' : 'FAILURE',
    primaryFailureReason: success ? 'TARGET_BEFORE_INVALIDATION' : 'NO_TARGET_WITHIN_20_DAYS',
    atr: 2,
    mfe: { '5': success ? 1.5 : 0.5, '10': success ? 2 : 0.75, '20': success ? 2.5 : 1 },
    mae: { '5': success ? 0.5 : 1, '10': success ? 0.75 : 1.5, '20': success ? 1 : 2 },
    entryAmbiguous: false,
    invalidationAfterRetest: !success,
  };
}

const clusteredEvents = [
  clusteredEvent('AAA', 'BOS', true),
  clusteredEvent('AAA', 'NONE', false),
  clusteredEvent('BBB', 'BOS', false),
  clusteredEvent('BBB', 'NONE', true),
];
const firstIntervals = bootstrapIntervals(clusteredEvents, ['AAA', 'BBB']);
const secondIntervals = bootstrapIntervals(clusteredEvents, ['AAA', 'BBB']);
assert.deepEqual(firstIntervals, secondIntervals);
assert.ok(firstIntervals.length > 0);
assert.ok(firstIntervals.every((interval) => interval.requestedResamples === 2_000));
assert.ok(firstIntervals.every((interval) => interval.samplingUnit === 'ticker'));
assert.ok(firstIntervals.every((interval) => typeof interval.validGroupResamples === 'number'));
assert.ok(firstIntervals.every((interval) => typeof interval.validNoneResamples === 'number'));
assert.ok(firstIntervals.every((interval) => typeof interval.validComparisonResamples === 'number'));
assert.ok(firstIntervals.filter((interval) => interval.kind === 'comparison').every((interval) => interval.paired === true));

const pairedSamples = pairedBootstrapSamples(
  clusteredEvents,
  ['AAA', 'BBB'],
  (event) => event.direction === 'bullish' && event.confirmation === 'BOS',
  (event) => event.direction === 'bullish' && event.confirmation === 'NONE',
  'successRate',
  0,
  1,
  true,
);
assert.deepEqual(pairedSamples.draws[0], ['AAA', 'AAA']);
assert.equal(pairedSamples.groupNs[0], 2);
assert.equal(pairedSamples.noneNs[0], 2);
assert.equal(pairedSamples.groupValues[0], 1);
assert.equal(pairedSamples.noneValues[0], 0);
assert.equal(pairedSamples.differenceValues[0], 1);

const independentGroupDraw = drawTickerMultiset(['AAA', 'BBB'], () => 0);
const independentNoneDraw = drawTickerMultiset(['AAA', 'BBB'], () => 0.999999);
const independentGroup = independentGroupDraw.flatMap((ticker) => clusteredEvents.filter(
  (event) => event.ticker === ticker && event.confirmation === 'BOS',
));
const independentNone = independentNoneDraw.flatMap((ticker) => clusteredEvents.filter(
  (event) => event.ticker === ticker && event.confirmation === 'NONE',
));
const independentDifference = differenceOfMetricSummaries(
  metricSummary(independentGroup, 'successRate'),
  metricSummary(independentNone, 'successRate'),
);
assert.notEqual(independentDifference.value, pairedSamples.differenceValues[0]);

assert.equal(classifyFormationPartition(19, 100), 'calibration');
assert.equal(classifyFormationPartition(20, 100), 'PURGED_BOUNDARY');
assert.equal(classifyFormationPartition(99, 100), 'PURGED_BOUNDARY');
assert.equal(classifyFormationPartition(100, 100), 'holdout');

const primarySummary = metricSummary(clusteredEvents, 'successRate');
assert.equal(primarySummary.n, 4);
assert.equal(primarySummary.population, 'PRIMARY_EVALUABLE_20D');
assert.equal(primarySummary.value, 0.5);
const horizonShortEvent: BacktestEvent = {
  ...clusteredEvents[0],
  mfe: { '5': 1, '10': null, '20': null },
  mae: { '5': 0.5, '10': null, '20': null },
};
const horizonEvents = [clusteredEvents[1], horizonShortEvent];
assert.equal(metricSummary(horizonEvents, 'mfe5').n, 2);
assert.equal(metricSummary(horizonEvents, 'mfe10').n, 1);
assert.equal(metricSummary(horizonEvents, 'mfe20').n, 1);
assert.equal(metricSummary(horizonEvents, 'mfe10').population, 'POST_RETEST_ATR_FULL_HORIZON_10D');
const invalidationSummary = metricSummary(clusteredEvents, 'invalidationRate');
assert.equal(invalidationSummary.n, 4);
assert.equal(invalidationSummary.population, 'POST_RETEST_FULL_20D_NON_ENTRY_AMBIGUOUS');
assert.equal(invalidationSummary.value, 0.5);

assert.equal(metricSummary([ambiguousEvent], 'mfe5').n, 0);
assert.equal(metricSummary([futureTargetInvalidationEvent], 'mfe5').n, 1);
assert.equal(
  differenceOfMetricSummaries(
    { value: 1, n: 1, population: 'A' },
    { value: 0, n: 1, population: 'B' },
  ).reason,
  'POPULATION_MISMATCH',
);
assert.equal(
  differenceOfMetricSummaries(
    { value: null, n: 0, population: 'A' },
    { value: 0, n: 1, population: 'A' },
  ).reason,
  'GROUP_ZERO_DENOMINATOR',
);

const hashCandles = baselineCandles(3);
const hashOne = canonicalCandleHash('AAA', 'AAA.JK', hashCandles);
const hashSame = canonicalCandleHash('AAA', 'AAA.JK', hashCandles.map((current) => ({ ...current })));
const hashChanged = canonicalCandleHash('AAA', 'AAA.JK', hashCandles.map((current, index) =>
  index === 1 ? { ...current, close: current.close + 1 } : current,
));
assert.equal(hashOne, hashSame);
assert.notEqual(hashOne, hashChanged);
assert.match(hashOne, /^sha256:[0-9a-f]{64}$/);
const snapshotParameters = { interval: '1d', maxLabelSpan: 80, schema: 'SC-20260825-08.backtest.v1' };
const snapshotOne = snapshotRootHash(
  [{ ticker: 'BBB', candleHash: hashChanged }, { ticker: 'AAA', candleHash: hashOne }],
  snapshotParameters,
);
const snapshotSame = snapshotRootHash(
  [{ ticker: 'AAA', candleHash: hashOne }, { ticker: 'BBB', candleHash: hashChanged }],
  snapshotParameters,
);
const snapshotChangedParameter = snapshotRootHash(
  [{ ticker: 'AAA', candleHash: hashOne }, { ticker: 'BBB', candleHash: hashChanged }],
  { ...snapshotParameters, maxLabelSpan: 81 },
);
assert.equal(snapshotOne, snapshotSame);
assert.notEqual(snapshotOne, snapshotChangedParameter);
assert.match(snapshotOne, /^sha256:[0-9a-f]{64}$/);

console.log('SC-20260825-08 backtest local fixtures passed.');
