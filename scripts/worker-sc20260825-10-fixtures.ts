import assert from 'node:assert/strict';
import { buildBrokerDataInventorySummary } from '../src/components/InventoryChart';
import { buildStockData as buildFrontendStockData } from '../src/data/mockStocks';
import { buildStockData as buildServerStockData } from '../api/_lib/stockEngine';
import { buildInventoryNaraSummary } from '../src/utils/naraEvidenceEngine';
import type { BrokerInventorySummary, Candle } from '../src/types';

let checks = 0;

function check(condition: unknown, message: string): void {
  checks += 1;
  assert.ok(condition, message);
}

const ticker = 'BBCA';
const dates = ['2026-01-01', '2026-01-02', '2026-01-03'];
const startDate = dates[0];
const endDate = dates[dates.length - 1];

function makeCandles(): Candle[] {
  return dates.map((time) => ({
    time,
    open: 100,
    high: 105,
    low: 95,
    close: 103,
    volume: 1_000,
  }));
}

function makeFallback(): BrokerInventorySummary {
  const candles = makeCandles();
  return {
    ticker,
    stockName: 'SC-10 Fixture',
    currentPrice: 103,
    dataSource: 'SYNTHETIC',
    sourceLabel: 'Fixture fallback',
    sourceNote: 'Offline corrective fixture',
    startDate,
    endDate,
    totalTradingDays: candles.length,
    candles,
    topNetBuyers: [],
    topNetSellers: [],
    allBrokers: [],
    autoSelectedBrokerCodes: [],
    stats: {
      totalVolumeLots: 0,
      totalValueIdr: 0,
      foreignNetVol: 0,
      foreignNetVal: 0,
      cleanAccumBrokerCount: 0,
      cleanDistBrokerCount: 0,
    },
  };
}

type FlowMode = 'positive' | 'negative' | 'mixed';

interface ScenarioOverrides {
  summaryStart?: string;
  summaryEnd?: string;
  accumulationStart?: string;
  accumulationEnd?: string;
  omitSummaryStart?: boolean;
  omitSummaryEnd?: boolean;
  omitAccumulationStart?: boolean;
  omitAccumulationEnd?: boolean;
  summaryTicker?: string;
  accumulationTicker?: string;
  flowMode?: FlowMode;
  omitProviderDate?: string;
}

function flowValues(mode: FlowMode): Record<string, number[]> {
  if (mode === 'negative') {
    return {
      AA: [-20, -20, -20],
      ZZ: [-10, -10, -10],
    };
  }
  if (mode === 'mixed') {
    return {
      AA: [20, 20, 20],
      ZZ: [-20, -20, -20],
    };
  }
  return {
    AA: [20, 20, 20],
    ZZ: [10, 10, 10],
  };
}

function makeProviderPayloads(overrides: ScenarioOverrides = {}) {
  const mode = overrides.flowMode || 'positive';
  const values = flowValues(mode);
  const summaryStart = overrides.omitSummaryStart ? undefined : overrides.summaryStart ?? startDate;
  const summaryEnd = overrides.omitSummaryEnd ? undefined : overrides.summaryEnd ?? endDate;
  const accumulationStart = overrides.omitAccumulationStart ? undefined : overrides.accumulationStart ?? startDate;
  const accumulationEnd = overrides.omitAccumulationEnd ? undefined : overrides.accumulationEnd ?? endDate;
  const summaryTicker = overrides.summaryTicker || ticker;
  const accumulationTicker = overrides.accumulationTicker || ticker;
  const brokers = Object.entries(values).map(([brokerCode, dailyValues]) => {
    const netLots = dailyValues.reduce((sum, value) => sum + value, 0);
    const netShares = netLots * 100;
    const buyShares = Math.max(0, netShares);
    const sellShares = Math.max(0, -netShares);
    return {
      broker_code: brokerCode,
      broker_name: `${brokerCode} Fixture`,
      bvol: buyShares,
      svol: sellShares,
      bval: buyShares * 100,
      sval: sellShares * 100,
      nvol: netShares,
      nval: netLots * 10_000,
    };
  });
  const series = Object.entries(values).map(([brokerCode, dailyValues]) => {
    let cumulativeLots = 0;
    const points = dates
      .filter((date) => date !== overrides.omitProviderDate)
      .map((date) => {
        const index = dates.indexOf(date);
        const netLots = dailyValues[index];
        cumulativeLots += netLots;
        return {
          date,
          nvol: netLots * 100,
          nval: netLots * 10_000,
          cum_nval: cumulativeLots * 10_000,
          bavg: 100,
          savg: 100,
        };
      });
    return {
      broker_code: brokerCode,
      broker_name: `${brokerCode} Fixture`,
      points,
    };
  });
  return {
    summary: {
      stock_code: summaryTicker,
      brokers,
      broker_start_date: summaryStart,
      broker_end_date: summaryEnd,
    },
    accumulation: {
      code: accumulationTicker,
      start_date: accumulationStart,
      end_date: accumulationEnd,
      series,
    },
  };
}

function buildScenario(overrides: ScenarioOverrides = {}): BrokerInventorySummary {
  const payloads = makeProviderPayloads(overrides);
  return buildBrokerDataInventorySummary(
    payloads.summary,
    payloads.accumulation,
    makeFallback(),
    [],
  );
}

function naraFor(summary: BrokerInventorySummary, selectedBrokerCodes = ['AA']) {
  return buildInventoryNaraSummary({
    summary,
    candles: summary.candles,
    selectedBrokerCodes,
    asOfDate: endDate,
  });
}

function hasReason(summary: ReturnType<typeof naraFor>, reason: string): boolean {
  return summary.dataQuality.reasons.includes(reason)
    || summary.evidence.some((item) => item.reasons.includes(reason));
}

const valid = buildScenario();
const validCoverage = valid.coverage;
if (!validCoverage) throw new Error('valid fixture must include coverage');
check(validCoverage?.summaryReturnedStartDate === startDate, 'valid summary start must be preserved separately');
check(validCoverage?.summaryReturnedEndDate === endDate, 'valid summary end must be preserved separately');
check(validCoverage?.accumulationReturnedStartDate === startDate, 'valid accumulation start must be preserved separately');
check(validCoverage?.accumulationReturnedEndDate === endDate, 'valid accumulation end must be preserved separately');
check(validCoverage?.returnedStartDate === startDate && validCoverage.returnedEndDate === endDate, 'valid common range must populate legacy returned range');
check(validCoverage?.summaryValid === true && validCoverage.accumulationValid === true && validCoverage.rangeMatches === true, 'valid paired range must pass coverage');
check(naraFor(valid).stance === 'BULLISH_CONTEXT', 'valid positive flow must remain bullish context');

const { rangeMatches: _legacyRangeFlag, ...legacyCoverage } = validCoverage;
const legacyEnvelope = { ...valid, coverage: legacyCoverage };
const legacyEnvelopeNara = naraFor(legacyEnvelope);
check(legacyEnvelopeNara.stance === 'INSUFFICIENT_DATA', 'matching legacy returned dates without rangeMatches must be insufficient');
check(!legacyEnvelopeNara.opportunityEvidenceIds.some((id) => legacyEnvelopeNara.evidence.some((item) => item.evidenceId === id && item.sourceType === 'BROKER_FLOW')), 'range flag missing must not create broker-flow opportunity evidence');
check(!legacyEnvelopeNara.riskEvidenceIds.some((id) => legacyEnvelopeNara.evidence.some((item) => item.evidenceId === id && item.sourceType === 'BROKER_FLOW')), 'range flag missing must not create broker-flow risk evidence');
check(hasReason(legacyEnvelopeNara, 'BROKER_ENDPOINT_RANGE_MISMATCH'), 'range flag missing must expose safe endpoint mismatch reason');

function assertRangeFailure(overrides: ScenarioOverrides, reason: string, message: string): void {
  const summary = buildScenario(overrides);
  check(summary.coverage?.rangeMatches === false, `${message}: rangeMatches must be false`);
  check(naraFor(summary).stance === 'INSUFFICIENT_DATA', `${message}: NARA must abstain`);
  check(hasReason(naraFor(summary), reason), `${message}: NARA reason must be explicit`);
}

assertRangeFailure({ summaryStart: '2025-12-31' }, 'BROKER_SUMMARY_RANGE_MISMATCH', 'summary start mismatch');
assertRangeFailure({ summaryEnd: '2026-01-04' }, 'BROKER_SUMMARY_RANGE_MISMATCH', 'summary end mismatch');
assertRangeFailure({ summaryEnd: '2026-02-30' }, 'BROKER_SUMMARY_RANGE_MISSING', 'malformed summary date');
assertRangeFailure({ accumulationStart: '2025-12-31' }, 'BROKER_ACCUMULATION_RANGE_MISMATCH', 'accumulation start mismatch');
assertRangeFailure({ accumulationEnd: '2026-01-04' }, 'BROKER_ACCUMULATION_RANGE_MISMATCH', 'accumulation end mismatch');

const endpointMismatch = buildScenario({ accumulationStart: dates[1], accumulationEnd: '2026-01-04' });
check(endpointMismatch.coverage?.returnedStartDate === undefined && endpointMismatch.coverage?.returnedEndDate === undefined, 'mismatched endpoints must not create a common legacy range');
check(hasReason(naraFor(endpointMismatch), 'BROKER_ENDPOINT_RANGE_MISMATCH'), 'mismatched endpoints must expose endpoint reason');
check(naraFor(endpointMismatch).stance === 'INSUFFICIENT_DATA', 'mismatched endpoints must be insufficient');

const missingSummaryDate = buildScenario({ omitSummaryStart: true });
check(missingSummaryDate.coverage?.summaryValid === false, 'missing summary date must invalidate summary');
check(missingSummaryDate.coverage?.returnedStartDate === undefined, 'missing summary date must not fall back to accumulation start');
check(hasReason(naraFor(missingSummaryDate), 'BROKER_SUMMARY_RANGE_MISSING'), 'missing summary date must expose summary reason');

const missingAccumulationDate = buildScenario({ omitAccumulationEnd: true });
check(missingAccumulationDate.coverage?.accumulationValid === false, 'missing accumulation date must invalidate accumulation');
check(missingAccumulationDate.coverage?.returnedEndDate === undefined, 'missing accumulation date must not fall back to summary end');
check(hasReason(naraFor(missingAccumulationDate), 'BROKER_ACCUMULATION_RANGE_MISSING'), 'missing accumulation date must expose accumulation reason');

const tickerMismatch = buildScenario({ accumulationTicker: 'TLKM' });
check(tickerMismatch.coverage?.summaryValid === true && tickerMismatch.coverage.accumulationValid === false, 'accumulation ticker mismatch must invalidate only the mismatched endpoint');
check(naraFor(tickerMismatch).stance === 'INSUFFICIENT_DATA', 'ticker mismatch must be insufficient');
check(hasReason(naraFor(tickerMismatch), 'TICKER_INVALID'), 'ticker mismatch must expose safe ticker reason');

const summaryTickerMismatch = buildScenario({ summaryTicker: 'TLKM' });
check(summaryTickerMismatch.coverage?.summaryValid === false && summaryTickerMismatch.coverage.accumulationValid === true, 'summary ticker mismatch must invalidate only the mismatched endpoint');
check(naraFor(summaryTickerMismatch).stance === 'INSUFFICIENT_DATA', 'summary ticker mismatch must be insufficient');
check(hasReason(naraFor(summaryTickerMismatch), 'TICKER_INVALID'), 'summary ticker mismatch must expose safe ticker reason');

const missingProviderDate = buildScenario({ omitProviderDate: dates[1] });
const missingProviderNara = naraFor(missingProviderDate);
check(missingProviderDate.coverage?.rangeMatches === true, 'missing provider point with matching metadata must keep range valid');
check(missingProviderDate.coverage?.missingRequestedDates.includes(dates[1]), 'missing provider point must remain explicitly missing');
check(missingProviderNara.stance === 'BULLISH_CONTEXT', 'missing provider date must not change positive flow stance');
check(hasReason(missingProviderNara, 'MISSING_PROVIDER_DATES_NO_ZERO_FILL'), 'missing provider date must not be zero-filled');

const negative = buildScenario({ flowMode: 'negative' });
const mixed = buildScenario({ flowMode: 'mixed' });
check(naraFor(negative).stance === 'RISK_ELEVATED', 'valid negative flow must remain risk context');
check(naraFor(mixed, ['AA', 'ZZ']).stance === 'NEUTRAL', 'valid mixed flow must remain neutral');

const parityCandles = makeCandles().concat(makeCandles().map((candle, index) => ({
  ...candle,
  time: `2026-01-0${index + 4}`,
})));
const frontendParity = buildFrontendStockData('BBCA.JK', 'BBCA', 'Fixture', 'Finance', parityCandles, undefined, true);
const serverParity = buildServerStockData('BBCA.JK', 'BBCA', 'Fixture', 'Finance', parityCandles, undefined, true);
check(JSON.stringify(frontendParity.naraSummary) === JSON.stringify(serverParity.naraSummary), 'frontend NARA summary must remain unchanged by Inventory corrective');

const serializedFixture = JSON.stringify({ valid, endpointMismatch, missingSummaryDate, missingAccumulationDate, tickerMismatch });
check(!/(api[_-]?key|authorization|cookie|x-api-key|https?:\/\/)/i.test(serializedFixture), 'fixture output must not contain secrets or private URLs');

console.log(`SC-20260825-10 fixtures passed: ${checks} assertions`);
