import { createHash } from 'node:crypto';
import { canonicalizeCandlePrices } from '../src/utils/candleNormalization';
import { formatJakartaDate, liquidIDXStocks } from '../src/data/mockStocks';
import { roundToIdxTick } from '../src/utils/idxTickRules';
import type { BosChochLine, Candle, SwingPoint } from '../src/types';
import {
  detectBosChoch,
  detectSwings,
} from '../api/_lib/stockEngine';

const SOURCE_LABEL = 'Yahoo Finance chart API (direct, daily interval)';
const TIMEZONE = 'Asia/Jakarta';
const LOOKBACK = 3;
const MIN_CANDLES = 250;
const MIN_TICKERS = 30;
const CALIBRATION_FRACTION = 0.70;
const MAX_RETEST_DAYS = 60;
const PRIMARY_HORIZON = 20;
const ATR_PERIOD = 14;
const BOOTSTRAP_RESAMPLES = 2_000;
const BOOTSTRAP_SEED = 2026082506;
const HORIZONS = [5, 10, 20] as const;
const MAX_LABEL_SPAN = MAX_RETEST_DAYS + PRIMARY_HORIZON;
const BACKTEST_SCHEMA_VERSION = 'SC-20260825-08.backtest.v1';
const CANDLE_HASH_SCHEMA_VERSION = 'SC-20260825-08.candle-hash.v1';
const SNAPSHOT_HASH_SCHEMA_VERSION = 'SC-20260825-08.snapshot-hash.v1';
const HASH_ALGORITHM = 'SHA-256';

type Direction = 'bullish' | 'bearish';
type Confirmation = 'BOS' | 'CHOCH' | 'NONE';
type Partition = 'calibration' | 'holdout';
export type FormationPartition = Partition | 'PURGED_BOUNDARY';
type PrimaryOutcome = 'SUCCESS' | 'FAILURE';
export type MetricName =
  | 'successRate'
  | 'mfe5'
  | 'mfe10'
  | 'mfe20'
  | 'mae5'
  | 'mae10'
  | 'mae20'
  | 'invalidationRate';
type EventStatus =
  | 'RETESTED'
  | 'INVALID_BEFORE_RETEST'
  | 'NEVER_RETESTED'
  | 'CENSORED'
  | 'AMBIGUOUS_SAME_BAR'
  | 'ATR_EXCLUDED';

export interface Formation {
  id: string;
  direction: Direction;
  confirmation: Confirmation;
  structureLineId?: string;
  startIndex: number;
  formationIndex: number;
  top: number;
  bottom: number;
  invalidationIndex: number | null;
}

export interface BacktestEvent {
  ticker: string;
  partition: Partition;
  direction: Direction;
  confirmation: Confirmation;
  formationIndex: number;
  status: EventStatus;
  retestIndex: number | null;
  primaryOutcome: PrimaryOutcome | null;
  primaryFailureReason: string | null;
  atr: number | null;
  mfe: Record<string, number | null>;
  mae: Record<string, number | null>;
  entryAmbiguous: boolean;
  invalidationAfterRetest: boolean;
}

export interface MetricSummary {
  value: number | null;
  n: number;
  population: string;
}

export interface PairedBootstrapSamples {
  draws: string[][];
  groupValues: Array<number | null>;
  noneValues: Array<number | null>;
  differenceValues: Array<number | null>;
  groupNs: number[];
  noneNs: number[];
  validGroupResamples: number;
  validNoneResamples: number;
  validComparisonResamples: number;
}

interface TickerData {
  ticker: string;
  symbol: string;
  name: string;
  sector: string;
  candles: Candle[];
  startDate: string;
  endDate: string;
  sourceUrl: string;
  retrievedAt: string;
  providerTimestamp: string | null;
  providerTimestampReason: string | null;
  canonicalCandleHash: string;
}

interface FetchResult {
  ticker: string;
  symbol: string;
  ok: boolean;
  candles?: Candle[];
  error?: string;
  sourceUrl?: string;
  retrievedAt: string;
  providerTimestamp: string | null;
  providerTimestampReason: string | null;
}

function stableSerialize(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Cannot hash non-finite number');
    return Object.is(value, -0) ? '0' : String(value);
  }
  if (Array.isArray(value)) return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(',')}}`;
  }
  throw new Error('Cannot hash unsupported value');
}

function sha256(value: string): string {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

export function canonicalCandleHash(ticker: string, symbol: string, candles: Candle[]): string {
  return sha256(stableSerialize({
    hashSchemaVersion: CANDLE_HASH_SCHEMA_VERSION,
    ticker,
    symbol,
    interval: '1d',
    timezone: TIMEZONE,
    candles: candles.map((candle) => ({
      time: candle.time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
    })),
  }));
}

export function snapshotRootHash(
  entries: Array<{ ticker: string; candleHash: string }>,
  parameters: Record<string, unknown>,
): string {
  const sortedEntries = [...entries]
    .map((entry) => ({ ticker: entry.ticker, candleHash: entry.candleHash }))
    .sort((a, b) => a.ticker.localeCompare(b.ticker) || a.candleHash.localeCompare(b.candleHash));
  return sha256(stableSerialize({
    hashSchemaVersion: SNAPSHOT_HASH_SCHEMA_VERSION,
    backtestSchemaVersion: BACKTEST_SCHEMA_VERSION,
    parameters,
    tickers: sortedEntries,
  }));
}

export function classifyFormationPartition(formationIndex: number, splitIndex: number): FormationPartition {
  if (formationIndex >= splitIndex) return 'holdout';
  return formationIndex + MAX_LABEL_SPAN < splitIndex ? 'calibration' : 'PURGED_BOUNDARY';
}

function emptyExcursion(): Record<string, number | null> {
  return { '5': null, '10': null, '20': null };
}

function finitePositive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
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

function isDisplacementCandle(candles: Candle[], index: number): boolean {
  const candle = candles[index];
  if (!candle) return false;
  const body = Math.abs(candle.close - candle.open);
  const range = candle.high - candle.low;
  const medianBody = medianPositiveBodyBefore(candles, index);
  return medianBody !== null && range > 0 && body >= 1.5 * medianBody && body / range >= 0.60;
}

function chooseStructureLine(
  lines: BosChochLine[],
  direction: Direction,
  originIndex: number,
): { confirmation: Confirmation; structureLineId?: string } {
  const candidates = lines
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
    ? { confirmation: line.type === 'CHoCH' ? 'CHOCH' : 'BOS', structureLineId: line.id }
    : { confirmation: 'NONE' };
}

/** Enumerate every strict A-B-C-D formation, including formations later invalidated. */
export function enumerateFormations(candles: Candle[], lines: BosChochLine[]): Formation[] {
  const formations: Formation[] = [];
  if (!candles || candles.length < 4) return formations;

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

    const direction: Direction = bullish ? 'bullish' : 'bearish';
    const invalidationLevel = bullish ? b.low : b.high;
    let invalidationIndex: number | null = null;
    for (let j = i + 3; j < candles.length; j++) {
      if ((bullish && candles[j].close < invalidationLevel) || (bearish && candles[j].close > invalidationLevel)) {
        invalidationIndex = j;
        break;
      }
    }

    const structure = chooseStructureLine(lines, direction, i);
    formations.push({
      id: `${bullish ? 'ob-bull' : 'ob-bear'}-${i}`,
      direction,
      confirmation: structure.confirmation,
      structureLineId: structure.structureLineId,
      startIndex: i,
      formationIndex: i + 2,
      top: Math.round(bullish ? Math.max(b.open, b.close) : b.high),
      bottom: Math.round(bullish ? b.low : Math.min(b.open, b.close)),
      invalidationIndex,
    });
  }

  return formations;
}

function trueRange(candles: Candle[], index: number): number | null {
  if (index <= 0 || !candles[index] || !candles[index - 1]) return null;
  const current = candles[index];
  const previous = candles[index - 1];
  return Math.max(
    current.high - current.low,
    Math.abs(current.high - previous.close),
    Math.abs(current.low - previous.close),
  );
}

function atrBeforeRetest(candles: Candle[], retestIndex: number): number | null {
  const ranges: number[] = [];
  for (let i = 1; i < retestIndex; i++) {
    const range = trueRange(candles, i);
    if (range !== null && Number.isFinite(range)) ranges.push(range);
  }
  if (ranges.length < ATR_PERIOD) return null;
  const recent = ranges.slice(-ATR_PERIOD);
  const atr = recent.reduce((sum, value) => sum + value, 0) / recent.length;
  return atr > 0 && Number.isFinite(atr) ? atr : null;
}

function intersectsZone(candle: Candle, top: number, bottom: number): boolean {
  return candle.low <= top && candle.high >= bottom;
}

export function evaluateFormation(
  ticker: string,
  candles: Candle[],
  formation: Formation,
  splitIndex: number,
): BacktestEvent {
  const { direction, top, bottom, formationIndex } = formation;
  const partition: Partition = formationIndex < splitIndex ? 'calibration' : 'holdout';
  const maxIndex = Math.min(candles.length - 1, formationIndex + MAX_RETEST_DAYS);
  const createEvent = (overrides: Partial<BacktestEvent>): BacktestEvent => ({
    ticker,
    partition,
    direction,
    confirmation: formation.confirmation,
    formationIndex,
    status: 'NEVER_RETESTED',
    retestIndex: null,
    primaryOutcome: null,
    primaryFailureReason: null,
    atr: null,
    mfe: emptyExcursion(),
    mae: emptyExcursion(),
    entryAmbiguous: false,
    invalidationAfterRetest: false,
    ...overrides,
  });
  const hasCloseInvalidation = (startExclusive: number, endInclusive: number): boolean => {
    if (endInclusive <= startExclusive) return false;
    return candles
      .slice(startExclusive + 1, endInclusive + 1)
      .some((current) => direction === 'bullish' ? current.close < bottom : current.close > top);
  };
  let retestIndex: number | null = null;

  for (let index = formationIndex + 1; index <= maxIndex; index++) {
    const current = candles[index];
    const invalidated = direction === 'bullish' ? current.close < bottom : current.close > top;
    const retests = intersectsZone(current, top, bottom);
    if (retests) {
      const firstRetestAtr = atrBeforeRetest(candles, index);
      const entry = direction === 'bullish' ? top : bottom;
      const target = firstRetestAtr === null
        ? null
        : direction === 'bullish'
          ? entry + firstRetestAtr
          : entry - firstRetestAtr;
      const reachesTarget = target !== null && (
        direction === 'bullish' ? current.high >= target : current.low <= target
      );
      const futureInvalidation = hasCloseInvalidation(
        index,
        Math.min(candles.length - 1, index + PRIMARY_HORIZON),
      );

      if (invalidated) {
        return createEvent({
          status: 'AMBIGUOUS_SAME_BAR',
          entryAmbiguous: true,
          retestIndex: index,
          primaryFailureReason: reachesTarget
            ? 'FIRST_RETEST_TARGET_AND_INVALIDATION_SAME_BAR'
            : 'FIRST_RETEST_AND_INVALIDATION_SAME_BAR',
          atr: firstRetestAtr,
          invalidationAfterRetest: true,
        });
      }
      if (reachesTarget) {
        return createEvent({
          status: 'AMBIGUOUS_SAME_BAR',
          entryAmbiguous: true,
          retestIndex: index,
          primaryFailureReason: 'FIRST_RETEST_AND_TARGET_SAME_BAR',
          atr: firstRetestAtr,
          invalidationAfterRetest: futureInvalidation,
        });
      }
      retestIndex = index;
      break;
    }
    if (invalidated) {
      return createEvent({
        status: 'INVALID_BEFORE_RETEST',
        primaryFailureReason: 'INVALID_BEFORE_RETEST',
      });
    }
  }

  if (retestIndex === null) {
    const status: EventStatus = maxIndex < formationIndex + MAX_RETEST_DAYS ? 'CENSORED' : 'NEVER_RETESTED';
    return createEvent({
      status,
      primaryFailureReason: status,
    });
  }

  const atr = atrBeforeRetest(candles, retestIndex);
  const primaryEnd = retestIndex + PRIMARY_HORIZON;
  const invalidationAfterRetest = primaryEnd < candles.length
    ? hasCloseInvalidation(retestIndex, primaryEnd)
    : false;
  const mfe: Record<string, number | null> = {};
  const mae: Record<string, number | null> = {};

  for (const horizon of HORIZONS) {
    const horizonEnd = retestIndex + horizon;
    if (atr === null || horizonEnd >= candles.length) {
      mfe[String(horizon)] = null;
      mae[String(horizon)] = null;
      continue;
    }
    const window = candles.slice(retestIndex + 1, horizonEnd + 1);
    const entry = direction === 'bullish' ? top : bottom;
    if (direction === 'bullish') {
      mfe[String(horizon)] = (Math.max(...window.map((current) => current.high)) - entry) / atr;
      mae[String(horizon)] = (entry - Math.min(...window.map((current) => current.low))) / atr;
    } else {
      mfe[String(horizon)] = (entry - Math.min(...window.map((current) => current.low))) / atr;
      mae[String(horizon)] = (Math.max(...window.map((current) => current.high)) - entry) / atr;
    }
  }

  if (atr === null) {
    return createEvent({
      status: 'ATR_EXCLUDED',
      retestIndex,
      primaryFailureReason: 'ATR14_UNAVAILABLE_OR_NONPOSITIVE',
      atr,
      mfe,
      mae,
      invalidationAfterRetest,
    });
  }

  if (primaryEnd >= candles.length) {
    return createEvent({
      status: 'CENSORED',
      retestIndex,
      primaryFailureReason: 'PRIMARY_HORIZON_CENSORED',
      atr,
      mfe,
      mae,
      invalidationAfterRetest,
    });
  }

  const entry = direction === 'bullish' ? top : bottom;
  const target = direction === 'bullish' ? entry + atr : entry - atr;
  let primaryOutcome: PrimaryOutcome | null = null;
  let primaryFailureReason: string | null = null;
  for (let index = retestIndex + 1; index <= primaryEnd; index++) {
    const current = candles[index];
    const favorable = direction === 'bullish' ? current.high >= target : current.low <= target;
    const invalidated = direction === 'bullish' ? current.close < bottom : current.close > top;
    if (favorable && invalidated) {
      primaryFailureReason = 'TARGET_AND_INVALIDATION_SAME_BAR';
      break;
    }
    if (favorable) {
      primaryOutcome = 'SUCCESS';
      primaryFailureReason = 'TARGET_BEFORE_INVALIDATION';
      break;
    }
    if (invalidated) {
      primaryOutcome = 'FAILURE';
      primaryFailureReason = 'INVALIDATION_BEFORE_TARGET';
      break;
    }
  }

  if (primaryOutcome === null && primaryFailureReason === null) {
    primaryOutcome = 'FAILURE';
    primaryFailureReason = 'NO_TARGET_WITHIN_20_DAYS';
  }

  return createEvent({
    status: primaryOutcome === null ? 'AMBIGUOUS_SAME_BAR' : 'RETESTED',
    retestIndex,
    primaryOutcome,
    primaryFailureReason,
    atr,
    mfe,
    mae,
    invalidationAfterRetest,
  });
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  return Number.isFinite(value) ? value : null;
}

function roundMetric(value: number | null): number | null {
  return value === null ? null : Math.round(value * 1_000_000) / 1_000_000;
}

function metricPopulation(metric: MetricName): string {
  if (metric === 'successRate') return 'PRIMARY_EVALUABLE_20D';
  if (metric === 'invalidationRate') return 'POST_RETEST_FULL_20D_NON_ENTRY_AMBIGUOUS';
  const match = /^(?:mfe|mae)(5|10|20)$/.exec(metric);
  return `POST_RETEST_ATR_FULL_HORIZON_${match?.[1] || 'UNKNOWN'}D`;
}

function isFullExcursionEvent(event: BacktestEvent, horizon: string): boolean {
  return (
    event.retestIndex !== null &&
    !event.entryAmbiguous &&
    event.atr !== null &&
    event.mfe[horizon] !== null &&
    event.mae[horizon] !== null
  );
}

export function metricSummary(events: BacktestEvent[], metric: MetricName): MetricSummary {
  if (metric === 'successRate') {
    const evaluable = events.filter(
      (event) => event.primaryOutcome === 'SUCCESS' || event.primaryOutcome === 'FAILURE',
    );
    const success = evaluable.filter((event) => event.primaryOutcome === 'SUCCESS').length;
    return {
      value: evaluable.length > 0 ? roundMetric(success / evaluable.length) : null,
      n: evaluable.length,
      population: metricPopulation(metric),
    };
  }

  if (metric === 'invalidationRate') {
    const eligible = events.filter((event) => isFullExcursionEvent(event, '20'));
    const invalidated = eligible.filter((event) => event.invalidationAfterRetest).length;
    return {
      value: eligible.length > 0 ? roundMetric(invalidated / eligible.length) : null,
      n: eligible.length,
      population: metricPopulation(metric),
    };
  }

  const match = /^(mfe|mae)(5|10|20)$/.exec(metric);
  if (!match) {
    return { value: null, n: 0, population: metricPopulation(metric) };
  }
  const field = match[1] === 'mfe' ? 'mfe' : 'mae';
  const horizon = match[2];
  const eligible = events.filter((event) => isFullExcursionEvent(event, horizon));
  const values = eligible
    .map((event) => event[field][horizon])
    .filter((value): value is number => value !== null);
  return {
    value: roundMetric(median(values)),
    n: values.length,
    population: metricPopulation(metric),
  };
}

export interface MetricDifference {
  value: number | null;
  groupN: number;
  noneN: number;
  population: string | null;
  groupPopulation: string;
  nonePopulation: string;
  groupValue: number | null;
  noneValue: number | null;
  reason: string | null;
}

export function differenceOfMetricSummaries(
  group: MetricSummary,
  none: MetricSummary,
): MetricDifference {
  const populationMatches = group.population === none.population;
  let reason: string | null = null;
  if (!populationMatches) reason = 'POPULATION_MISMATCH';
  else if (group.n === 0) reason = 'GROUP_ZERO_DENOMINATOR';
  else if (none.n === 0) reason = 'NONE_ZERO_DENOMINATOR';
  else if (group.value === null) reason = 'GROUP_VALUE_UNAVAILABLE';
  else if (none.value === null) reason = 'NONE_VALUE_UNAVAILABLE';

  return {
    value: reason === null ? roundMetric((group.value as number) - (none.value as number)) : null,
    groupN: group.n,
    noneN: none.n,
    population: populationMatches ? group.population : null,
    groupPopulation: group.population,
    nonePopulation: none.population,
    groupValue: group.value,
    noneValue: none.value,
    reason,
  };
}

function summarizeEvents(events: BacktestEvent[], partition: Partition) {
  const retested = events.filter((event) => event.retestIndex !== null);
  const primary = metricSummary(events, 'successRate');
  const mfe = {
    '5': metricSummary(events, 'mfe5'),
    '10': metricSummary(events, 'mfe10'),
    '20': metricSummary(events, 'mfe20'),
  };
  const mae = {
    '5': metricSummary(events, 'mae5'),
    '10': metricSummary(events, 'mae10'),
    '20': metricSummary(events, 'mae20'),
  };
  const invalidation = metricSummary(events, 'invalidationRate');
  const success = events.filter((event) => event.primaryOutcome === 'SUCCESS').length;
  const failure = events.filter((event) => event.primaryOutcome === 'FAILURE').length;
  const statusCounts = Object.fromEntries(
    (['RETESTED', 'INVALID_BEFORE_RETEST', 'NEVER_RETESTED', 'CENSORED', 'AMBIGUOUS_SAME_BAR', 'ATR_EXCLUDED'] as EventStatus[])
      .map((status) => [status, events.filter((event) => event.status === status).length]),
  );

  return {
    formed: events.length,
    retested: retested.length,
    neverRetested: events.filter((event) => event.status === 'NEVER_RETESTED').length,
    invalidBeforeRetest: events.filter((event) => event.status === 'INVALID_BEFORE_RETEST').length,
    censored: events.filter((event) => event.status === 'CENSORED').length,
    ambiguous: events.filter((event) => event.status === 'AMBIGUOUS_SAME_BAR').length,
    atrExcluded: events.filter((event) => event.status === 'ATR_EXCLUDED').length,
    evaluable: primary.n,
    success,
    failure,
    successRate: primary,
    medianMfe: mfe,
    medianMae: mae,
    invalidated: invalidation.n > 0
      ? events.filter((event) => isFullExcursionEvent(event, '20') && event.invalidationAfterRetest).length
      : 0,
    notInvalidated: invalidation.n > 0
      ? events.filter((event) => isFullExcursionEvent(event, '20') && !event.invalidationAfterRetest).length
      : 0,
    invalidationRate: invalidation,
    statusCounts,
    sampleStatus: partition === 'holdout' && primary.n < 100
      ? 'INSUFFICIENT_SAMPLE'
      : 'DESCRIPTIVE',
  };
}

function buildMetricGroups(events: BacktestEvent[]) {
  const groups: Array<Record<string, unknown>> = [];
  const partitions: Partition[] = ['calibration', 'holdout'];
  const confirmations: Confirmation[] = ['BOS', 'CHOCH', 'NONE'];
  const directions: Direction[] = ['bullish', 'bearish'];

  for (const partition of partitions) {
    for (const confirmation of confirmations) {
      for (const direction of directions) {
        const groupEvents = events.filter(
          (event) =>
            event.partition === partition &&
            event.confirmation === confirmation &&
            event.direction === direction,
        );
        groups.push({
          partition,
          confirmation,
          direction,
          ...summarizeEvents(groupEvents, partition),
        });
      }
    }
  }
  return groups;
}

function buildDifferencesVsNone(events: BacktestEvent[]) {
  const differences: Array<Record<string, unknown>> = [];
  const directions: Direction[] = ['bullish', 'bearish'];
  const confirmations: Confirmation[] = ['BOS', 'CHOCH'];

  for (const direction of directions) {
    const noneEvents = events.filter(
      (event) => event.partition === 'holdout' && event.direction === direction && event.confirmation === 'NONE',
    );
    for (const confirmation of confirmations) {
      const groupEvents = events.filter(
        (event) => event.partition === 'holdout' && event.direction === direction && event.confirmation === confirmation,
      );
      const difference = (metric: MetricName) => differenceOfMetricSummaries(
        metricSummary(groupEvents, metric),
        metricSummary(noneEvents, metric),
      );
      differences.push({
        partition: 'holdout',
        direction,
        confirmation,
        comparison: `${confirmation}-vs-NONE`,
        successRate: difference('successRate'),
        medianMfe: {
          '5': difference('mfe5'),
          '10': difference('mfe10'),
          '20': difference('mfe20'),
        },
        medianMae: {
          '5': difference('mae5'),
          '10': difference('mae10'),
          '20': difference('mae20'),
        },
        invalidationRate: difference('invalidationRate'),
      });
    }
  }
  return differences;
}

function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
}

export function drawTickerMultiset(tickers: string[], rng: () => number): string[] {
  if (tickers.length === 0) return [];
  return Array.from({ length: tickers.length }, () => tickers[Math.floor(rng() * tickers.length)]);
}

function eventsForTickerDraw(
  eventsByTicker: Map<string, BacktestEvent[]>,
  drawnTickers: string[],
  predicate: (event: BacktestEvent) => boolean,
): BacktestEvent[] {
  const events: BacktestEvent[] = [];
  for (const ticker of drawnTickers) {
    for (const event of eventsByTicker.get(ticker) || []) {
      if (predicate(event)) events.push(event);
    }
  }
  return events;
}

export function pairedBootstrapSamples(
  events: BacktestEvent[],
  includedTickers: string[],
  groupPredicate: (event: BacktestEvent) => boolean,
  nonePredicate: (event: BacktestEvent) => boolean,
  metric: MetricName,
  seed: number,
  requestedResamples = BOOTSTRAP_RESAMPLES,
  captureAudit = false,
): PairedBootstrapSamples {
  const eventsByTicker = new Map<string, BacktestEvent[]>();
  for (const ticker of includedTickers) eventsByTicker.set(ticker, []);
  for (const event of events) eventsByTicker.get(event.ticker)?.push(event);

  const rng = createRng(seed);
  const draws: string[][] = [];
  const groupValues: Array<number | null> = [];
  const noneValues: Array<number | null> = [];
  const differenceValues: Array<number | null> = [];
  const groupNs: number[] = [];
  const noneNs: number[] = [];

  for (let resample = 0; resample < requestedResamples; resample++) {
    const drawnTickers = drawTickerMultiset(includedTickers, rng);
    if (captureAudit) draws.push(drawnTickers);
    const sampledGroup = eventsForTickerDraw(eventsByTicker, drawnTickers, groupPredicate);
    const sampledNone = eventsForTickerDraw(eventsByTicker, drawnTickers, nonePredicate);
    const groupSummary = metricSummary(sampledGroup, metric);
    const noneSummary = metricSummary(sampledNone, metric);
    const groupValue = groupSummary.value;
    const noneValue = noneSummary.value;
    groupValues.push(groupValue);
    noneValues.push(noneValue);
    if (captureAudit) {
      groupNs.push(groupSummary.n);
      noneNs.push(noneSummary.n);
    }
    differenceValues.push(groupValue === null || noneValue === null ? null : groupValue - noneValue);
  }

  return {
    draws,
    groupValues,
    noneValues,
    differenceValues,
    groupNs,
    noneNs,
    validGroupResamples: groupValues.filter((value) => value !== null).length,
    validNoneResamples: noneValues.filter((value) => value !== null).length,
    validComparisonResamples: differenceValues.filter((value) => value !== null).length,
  };
}

function percentile(values: number[], fraction: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

export function bootstrapIntervals(events: BacktestEvent[], includedTickers: string[]) {
  const metrics: MetricName[] = [
    'successRate',
    'mfe5',
    'mfe10',
    'mfe20',
    'mae5',
    'mae10',
    'mae20',
    'invalidationRate',
  ];
  const intervals: Array<Record<string, unknown>> = [];
  const directions: Direction[] = ['bullish', 'bearish'];
  const confirmations: Confirmation[] = ['BOS', 'CHOCH'];
  let seedOffset = 0;

  const basePredicate = (direction: Direction, confirmation: Confirmation) =>
    (event: BacktestEvent) =>
      event.partition === 'holdout' && event.direction === direction && event.confirmation === confirmation;
  const nonePredicate = (direction: Direction) =>
    (event: BacktestEvent) =>
      event.partition === 'holdout' && event.direction === direction && event.confirmation === 'NONE';

  for (const direction of directions) {
    for (const confirmation of confirmations) {
      const groupEvents = events.filter(basePredicate(direction, confirmation));
      const noneEvents = events.filter(nonePredicate(direction));
      for (const metric of metrics) {
        const seed = BOOTSTRAP_SEED + seedOffset++;
        const samples = pairedBootstrapSamples(
          events,
          includedTickers,
          basePredicate(direction, confirmation),
          nonePredicate(direction),
          metric,
          seed,
        );
        const groupSummary = metricSummary(groupEvents, metric);
        const noneSummary = metricSummary(noneEvents, metric);
        const differenceSummary = differenceOfMetricSummaries(groupSummary, noneSummary);
        const intervalStatus = (validResamples: number) =>
          validResamples < 1_000 ? 'INSUFFICIENT_VALID_RESAMPLES' : 'COMPLETED';
        const sharedMetadata = {
          requestedResamples: BOOTSTRAP_RESAMPLES,
          validGroupResamples: samples.validGroupResamples,
          validNoneResamples: samples.validNoneResamples,
          validComparisonResamples: samples.validComparisonResamples,
          samplingUnit: 'ticker',
          paired: true,
          seed,
        };

        intervals.push({
          kind: 'group',
          partition: 'holdout',
          direction,
          confirmation,
          metric,
          estimate: groupSummary.value,
          estimateN: groupSummary.n,
          population: groupSummary.population,
          lower95: roundMetric(percentile(samples.groupValues.filter((value): value is number => value !== null), 0.025)),
          upper95: roundMetric(percentile(samples.groupValues.filter((value): value is number => value !== null), 0.975)),
          status: intervalStatus(samples.validGroupResamples),
          ...sharedMetadata,
        });
        intervals.push({
          kind: 'none',
          partition: 'holdout',
          direction,
          confirmation: 'NONE',
          metric,
          estimate: noneSummary.value,
          estimateN: noneSummary.n,
          population: noneSummary.population,
          lower95: roundMetric(percentile(samples.noneValues.filter((value): value is number => value !== null), 0.025)),
          upper95: roundMetric(percentile(samples.noneValues.filter((value): value is number => value !== null), 0.975)),
          status: intervalStatus(samples.validNoneResamples),
          ...sharedMetadata,
        });
        intervals.push({
          kind: 'comparison',
          partition: 'holdout',
          direction,
          comparison: `${confirmation}-vs-NONE`,
          metric,
          estimateDifference: differenceSummary.value,
          groupEstimate: groupSummary.value,
          noneEstimate: noneSummary.value,
          groupN: differenceSummary.groupN,
          noneN: differenceSummary.noneN,
          population: differenceSummary.population,
          groupPopulation: differenceSummary.groupPopulation,
          nonePopulation: differenceSummary.nonePopulation,
          differenceReason: differenceSummary.reason,
          lower95: roundMetric(percentile(samples.differenceValues.filter((value): value is number => value !== null), 0.025)),
          upper95: roundMetric(percentile(samples.differenceValues.filter((value): value is number => value !== null), 0.975)),
          status: intervalStatus(samples.validComparisonResamples),
          ...sharedMetadata,
        });
      }
    }
  }
  return intervals;
}

function cleanTicker(rawTicker: string): string {
  const upper = rawTicker.trim().toUpperCase().replace(/\.JK$/, '');
  if (upper === 'IHSG' || upper === 'JKSE' || upper === '^JKSE') return '^JKSE';
  return upper;
}

function validateCandle(candle: Candle): boolean {
  return (
    typeof candle.time === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(candle.time) &&
    finitePositive(candle.open) && finitePositive(candle.high) && finitePositive(candle.low) && finitePositive(candle.close) &&
    Number.isFinite(candle.volume) && candle.volume > 0 &&
    candle.high >= Math.max(candle.open, candle.close) && candle.low <= Math.min(candle.open, candle.close)
  );
}

async function fetchRealTicker(ticker: string): Promise<FetchResult> {
  const clean = cleanTicker(ticker);
  const symbol = clean.startsWith('^') ? clean : `${clean}.JK`;
  const retrievedAt = new Date().toISOString();
  const urls = [
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5y&includePrePost=false&events=history`,
    `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5y&includePrePost=false&events=history`,
  ];
  const errors: string[] = [];

  for (const url of urls) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'SmartChart/SC-20260825-08 backtest',
          Accept: 'application/json',
        },
      });
      if (!response.ok) {
        errors.push(`HTTP_${response.status}`);
        continue;
      }
      const payload = await response.json() as any;
      const result = payload?.chart?.result?.[0];
      const timestamps = result?.timestamp;
      const quote = result?.indicators?.quote?.[0];
      if (!Array.isArray(timestamps) || !quote) {
        errors.push('INVALID_SCHEMA');
        continue;
      }

      const providerTimestampRaw = result?.meta?.regularMarketTime;
      const providerTimestamp = typeof providerTimestampRaw === 'number' && Number.isFinite(providerTimestampRaw)
        ? new Date(providerTimestampRaw * 1_000).toISOString()
        : null;
      const providerTimestampReason = providerTimestamp === null
        ? 'PROVIDER_REGULAR_MARKET_TIME_UNAVAILABLE'
        : null;

      const candles: Candle[] = [];
      const seenDates = new Set<string>();
      const isIhsg = clean === '^JKSE';
      const roundPrice = (value: number) => isIhsg ? Math.round(value) : roundToIdxTick(value, false);
      let invalidPoint = false;

      for (let i = 0; i < timestamps.length; i++) {
        const open = quote.open?.[i];
        const high = quote.high?.[i];
        const low = quote.low?.[i];
        const close = quote.close?.[i];
        const volume = quote.volume?.[i];
        if (![open, high, low, close, volume].every((value) => typeof value === 'number' && Number.isFinite(value))) {
          continue;
        }
        if (volume <= 0 || close <= 0) continue;
        const date = formatJakartaDate(timestamps[i]);
        if (seenDates.has(date)) {
          invalidPoint = true;
          break;
        }
        seenDates.add(date);
        const canonical = canonicalizeCandlePrices(open, high, low, close, roundPrice);
        const normalized: Candle = { time: date, ...canonical, volume: Math.round(volume) };
        if (!validateCandle(normalized)) {
          invalidPoint = true;
          break;
        }
        candles.push(normalized);
      }

      if (invalidPoint) {
        errors.push('DUPLICATE_OR_INVALID_CANDLE');
        continue;
      }
      candles.sort((a, b) => a.time.localeCompare(b.time));
      if (candles.length < MIN_CANDLES) {
        errors.push(`UNDER_MIN_CANDLES_${candles.length}`);
        continue;
      }
      return {
        ticker: clean,
        symbol,
        ok: true,
        candles,
        sourceUrl: url,
        retrievedAt,
        providerTimestamp,
        providerTimestampReason,
      };
    } catch (error) {
      errors.push(error instanceof Error ? error.name : 'FETCH_ERROR');
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    ticker: clean,
    symbol,
    ok: false,
    error: errors.length > 0 ? errors.join('|') : 'NO_DATA',
    retrievedAt,
    providerTimestamp: null,
    providerTimestampReason: 'PROVIDER_TIMESTAMP_UNAVAILABLE_DUE_TO_FETCH_FAILURE',
  };
}

async function mapLimit<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let cursor = 0;
  const runWorker = async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await worker(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => runWorker()));
  return results;
}

function exclusionReason(error: string | undefined): string {
  if (!error) return 'FETCH_ERROR';
  if (error.includes('UNDER_MIN_CANDLES')) return 'UNDER_MIN_CANDLES';
  if (error.includes('DUPLICATE_OR_INVALID_CANDLE')) return 'DUPLICATE_OR_INVALID_CANDLE';
  if (error.includes('INVALID_SCHEMA')) return 'INVALID_SCHEMA';
  return 'FETCH_ERROR';
}

export async function runBacktest() {
  const retrievalStartedAt = new Date().toISOString();
  const candidateConfigs = Array.from(
    new Map(
      liquidIDXStocks
        .filter((config) => cleanTicker(config.t) !== '^JKSE')
        .map((config) => [cleanTicker(config.t), config]),
    ).values(),
  );
  const fetchResults = await mapLimit(candidateConfigs, 6, async (config) => fetchRealTicker(config.t));
  const included: TickerData[] = [];
  const excluded: Array<Record<string, unknown>> = [];
  const exclusionCounts: Record<string, number> = {};
  const tickerProvenance: Array<Record<string, unknown>> = [];

  for (let i = 0; i < fetchResults.length; i++) {
    const result = fetchResults[i];
    const config = candidateConfigs[i];
    if (result.ok && result.candles) {
      const canonicalHash = canonicalCandleHash(result.ticker, result.symbol, result.candles);
      included.push({
        ticker: result.ticker,
        symbol: result.symbol,
        name: config.n,
        sector: config.s,
        candles: result.candles,
        startDate: result.candles[0].time,
        endDate: result.candles[result.candles.length - 1].time,
        sourceUrl: result.sourceUrl || '',
        retrievedAt: result.retrievedAt,
        providerTimestamp: result.providerTimestamp,
        providerTimestampReason: result.providerTimestampReason,
        canonicalCandleHash: canonicalHash,
      });
      tickerProvenance.push({
        ticker: result.ticker,
        symbol: result.symbol,
        sourceLabel: SOURCE_LABEL,
        sourceUrl: result.sourceUrl || null,
        retrievalTimestamp: result.retrievedAt,
        providerTimestamp: result.providerTimestamp,
        providerTimestampReason: result.providerTimestampReason,
        firstCandleDate: result.candles[0].time,
        latestCandleDate: result.candles[result.candles.length - 1].time,
        candleCount: result.candles.length,
        canonicalCandleHash: canonicalHash,
        inclusionReason: 'INCLUDED',
        exclusionReason: null,
      });
    } else {
      const reason = exclusionReason(result.error);
      exclusionCounts[reason] = (exclusionCounts[reason] || 0) + 1;
      excluded.push({
        ticker: result.ticker,
        symbol: result.symbol,
        reason,
        detail: result.error || 'NO_DATA',
      });
      tickerProvenance.push({
        ticker: result.ticker,
        symbol: result.symbol,
        sourceLabel: SOURCE_LABEL,
        sourceUrl: result.sourceUrl || null,
        retrievalTimestamp: result.retrievedAt,
        providerTimestamp: result.providerTimestamp,
        providerTimestampReason: result.providerTimestampReason,
        firstCandleDate: null,
        latestCandleDate: null,
        candleCount: 0,
        canonicalCandleHash: null,
        inclusionReason: 'EXCLUDED',
        exclusionReason: reason,
      });
    }
  }

  const allEvents: BacktestEvent[] = [];
  const tickerSummaries: Array<Record<string, unknown>> = [];
  const partitionCounts = {
    calibrationEvents: 0,
    purgedBoundaryEvents: 0,
    holdoutEvents: 0,
  };
  const totalFormationCounts = {
    formations: 0,
    bullish: 0,
    bearish: 0,
    BOS: 0,
    CHOCH: 0,
    NONE: 0,
  };
  for (const tickerData of included) {
    const swings: SwingPoint[] = detectSwings(tickerData.candles, LOOKBACK);
    const lines = detectBosChoch(tickerData.candles, swings);
    const formations = enumerateFormations(tickerData.candles, lines);
    const splitIndex = Math.floor(tickerData.candles.length * CALIBRATION_FRACTION);
    const perTickerPartitionCounts = {
      calibrationEvents: 0,
      purgedBoundaryEvents: 0,
      holdoutEvents: 0,
    };
    for (const formation of formations) {
      totalFormationCounts.formations += 1;
      totalFormationCounts[formation.direction] += 1;
      totalFormationCounts[formation.confirmation] += 1;
      const partition = classifyFormationPartition(formation.formationIndex, splitIndex);
      if (partition === 'PURGED_BOUNDARY') {
        partitionCounts.purgedBoundaryEvents += 1;
        perTickerPartitionCounts.purgedBoundaryEvents += 1;
        continue;
      }
      if (partition === 'calibration') {
        partitionCounts.calibrationEvents += 1;
        perTickerPartitionCounts.calibrationEvents += 1;
      } else {
        partitionCounts.holdoutEvents += 1;
        perTickerPartitionCounts.holdoutEvents += 1;
      }
      const event = evaluateFormation(tickerData.ticker, tickerData.candles, formation, splitIndex);
      if (event.partition === 'calibration' && formation.formationIndex + MAX_LABEL_SPAN >= splitIndex) {
        throw new Error(`PURGE_INVARIANT_FAILED:${tickerData.ticker}:${formation.formationIndex}`);
      }
      allEvents.push(event);
    }
    if (formations.length !== perTickerPartitionCounts.calibrationEvents + perTickerPartitionCounts.purgedBoundaryEvents + perTickerPartitionCounts.holdoutEvents) {
      throw new Error(`PARTITION_COUNT_INVARIANT_FAILED:${tickerData.ticker}`);
    }
    tickerSummaries.push({
      ticker: tickerData.ticker,
      symbol: tickerData.symbol,
      startDate: tickerData.startDate,
      endDate: tickerData.endDate,
      candles: tickerData.candles.length,
      splitIndex,
      splitDate: tickerData.candles[splitIndex]?.time || null,
      maxLabelSpan: MAX_LABEL_SPAN,
      calibrationEvents: perTickerPartitionCounts.calibrationEvents,
      purgedBoundaryEvents: perTickerPartitionCounts.purgedBoundaryEvents,
      holdoutEvents: perTickerPartitionCounts.holdoutEvents,
      confirmedSwings: swings.length,
      bosChochLines: lines.length,
      formations: formations.length,
      events: perTickerPartitionCounts.calibrationEvents + perTickerPartitionCounts.holdoutEvents,
    });
  }

  const includedTickers = included.map((ticker) => ticker.ticker).sort();
  const metrics = buildMetricGroups(allEvents);
  const intervals = bootstrapIntervals(allEvents, includedTickers);
  const retrievalFinishedAt = new Date().toISOString();
  const snapshotParameters = {
    source: SOURCE_LABEL,
    interval: '1d',
    timezone: TIMEZONE,
    swingLookback: LOOKBACK,
    minimumCandles: MIN_CANDLES,
    calibrationFraction: CALIBRATION_FRACTION,
    maxRetestDays: MAX_RETEST_DAYS,
    primaryHorizonDays: PRIMARY_HORIZON,
    maxLabelSpan: MAX_LABEL_SPAN,
    atrPeriod: ATR_PERIOD,
    bootstrapResamples: BOOTSTRAP_RESAMPLES,
    bootstrapSeed: BOOTSTRAP_SEED,
    backtestSchemaVersion: BACKTEST_SCHEMA_VERSION,
    candleHashSchemaVersion: CANDLE_HASH_SCHEMA_VERSION,
    snapshotHashSchemaVersion: SNAPSHOT_HASH_SCHEMA_VERSION,
  };
  const snapshotId = snapshotRootHash(
    included.map((tickerData) => ({ ticker: tickerData.ticker, candleHash: tickerData.canonicalCandleHash })),
    snapshotParameters,
  );

  return {
    schemaVersion: BACKTEST_SCHEMA_VERSION,
    supersedes: 'SC-20260825-07.backtest.v1',
    corrections: {
      pairedTickerClusterBootstrap: true,
      purgedChronologicalSplit: true,
      explicitMetricPopulations: true,
      immutableCandleAndSnapshotProvenance: true,
    },
    status: included.length >= MIN_TICKERS ? 'COMPLETED' : 'BLOCKED_INSUFFICIENT_REAL_DATA',
    parameters: {
      source: SOURCE_LABEL,
      interval: '1d',
      rangeRequested: '5y',
      timezone: TIMEZONE,
      swingLookback: LOOKBACK,
      minimumCandles: MIN_CANDLES,
      minimumIncludedTickers: MIN_TICKERS,
      calibrationFraction: CALIBRATION_FRACTION,
      maxRetestDays: MAX_RETEST_DAYS,
      maxLabelSpan: MAX_LABEL_SPAN,
      atrPeriod: ATR_PERIOD,
      primaryTargetAtr: 1,
      primaryHorizonDays: PRIMARY_HORIZON,
      primaryStartsAfterRetest: true,
      mfeMaeHorizons: HORIZONS,
      mfeMaeStartsAfterRetest: true,
      sameBarRetestTargetIsAmbiguous: true,
      bootstrapResamples: BOOTSTRAP_RESAMPLES,
      bootstrapSeed: BOOTSTRAP_SEED,
      bootstrapSamplingUnit: 'ticker',
      pairedComparisonBootstrap: true,
      minimumValidComparisonResamples: 1_000,
      primaryPopulation: 'PRIMARY_EVALUABLE_20D',
      mfeMaePopulationTemplate: 'POST_RETEST_ATR_FULL_HORIZON_{H}D',
      invalidationPopulation: 'POST_RETEST_FULL_20D_NON_ENTRY_AMBIGUOUS',
      dataThroughDForStructure: true,
      syntheticFallbackUsed: false,
    },
    methodContract: {
      pairedTickerClusterBootstrap: {
        samplingUnit: 'ticker',
        paired: true,
        requestedResamples: BOOTSTRAP_RESAMPLES,
        minimumValidComparisonResamples: 1_000,
        seedBase: BOOTSTRAP_SEED,
        sameOrderedMultisetForGroupAndNone: true,
      },
      purgedChronologicalSplit: {
        splitFraction: CALIBRATION_FRACTION,
        maxRetestDays: MAX_RETEST_DAYS,
        primaryHorizonDays: PRIMARY_HORIZON,
        maxLabelSpan: MAX_LABEL_SPAN,
        calibrationRule: 'formationIndex + maxLabelSpan < splitIndex',
        purgedBoundaryRule: 'formationIndex < splitIndex && formationIndex + maxLabelSpan >= splitIndex',
        holdoutRule: 'formationIndex >= splitIndex',
      },
      metricPopulations: {
        primarySuccess: 'PRIMARY_EVALUABLE_20D',
        mfeMae: 'POST_RETEST_ATR_FULL_HORIZON_{H}D',
        invalidation: 'POST_RETEST_FULL_20D_NON_ENTRY_AMBIGUOUS',
      },
      ambiguityAndCensorship: {
        firstRetestAmbiguityExcludedFromExcursion: true,
        futureSameBarAmbiguityMayEnterFullExcursion: true,
        incompleteHorizonIsNullAndCensored: true,
      },
      provenance: {
        hashAlgorithm: HASH_ALGORITHM,
        candleHashSchemaVersion: CANDLE_HASH_SCHEMA_VERSION,
        snapshotHashSchemaVersion: SNAPSHOT_HASH_SCHEMA_VERSION,
        syntheticFallbackUsed: false,
      },
    },
    retrieval: {
      startedAt: retrievalStartedAt,
      finishedAt: retrievalFinishedAt,
      timezone: TIMEZONE,
      candidateUniverse: candidateConfigs.length,
      includedTickers: included.length,
      excludedTickers: excluded.length,
      sourceLabel: SOURCE_LABEL,
    },
    partition: {
      splitFraction: CALIBRATION_FRACTION,
      maxLabelSpan: MAX_LABEL_SPAN,
      calibrationEvents: partitionCounts.calibrationEvents,
      purgedBoundaryEvents: partitionCounts.purgedBoundaryEvents,
      holdoutEvents: partitionCounts.holdoutEvents,
      totalFormations: totalFormationCounts.formations,
      invariant: totalFormationCounts.formations === partitionCounts.calibrationEvents + partitionCounts.purgedBoundaryEvents + partitionCounts.holdoutEvents,
    },
    universe: {
      included: tickerSummaries,
      excluded,
      exclusionReasonCounts: exclusionCounts,
      survivorshipAndSelectionBias: 'Universe is the existing liquidIDXStocks list; it is not representative of all IDX and has survivorship/liquidity selection bias.',
    },
    provenance: {
      hashAlgorithm: HASH_ALGORITHM,
      candleHashSchemaVersion: CANDLE_HASH_SCHEMA_VERSION,
      snapshotHashSchemaVersion: SNAPSHOT_HASH_SCHEMA_VERSION,
      snapshotId,
      includedTickerCount: included.length,
      retrievalStartedAt: retrievalStartedAt,
      retrievalFinishedAt,
      tickers: tickerProvenance,
    },
    eventSet: {
      ...totalFormationCounts,
      eligibleEvents: allEvents.length,
      purgedBoundaryEvents: partitionCounts.purgedBoundaryEvents,
    },
    metrics,
    differencesVsNone: buildDifferencesVsNone(allEvents),
    intervals,
    limitations: [
      'Daily OHLC cannot determine intraday order for target/invalidation on the same candle; ambiguous cases are excluded from primary success rate.',
      'MFE/MAE are excursion statistics in ATR units and do not model fees, slippage, liquidity, or position sizing.',
      'Structure lines and formations use the fixed detector contract; no holdout optimizer or threshold tuning is run.',
      'End-of-series outcomes are censored and are not treated as failures.',
      'Events within a ticker are correlated and formations overlap; paired ticker-cluster bootstrap preserves ticker-level covariance but does not remove all dependence.',
      'The snapshot ID identifies canonical included candle inputs and method parameters but does not archive the provider payload permanently.',
    ],
  };
}

const invokedPath = process.argv[1]?.replaceAll('\\', '/') || '';
if (invokedPath.endsWith('/backtest-ob-structure.ts')) {
  runBacktest()
    .then((report) => {
      process.stdout.write(`${JSON.stringify(report)}\n`);
    })
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
      process.exitCode = 1;
    });
}
