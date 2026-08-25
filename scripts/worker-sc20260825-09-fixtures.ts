import assert from 'node:assert/strict';
import { buildStockData as buildFrontendStockData } from '../src/data/mockStocks';
import { buildStockData as buildServerStockData } from '../api/_lib/stockEngine';
import {
  buildChartNaraSummary,
  buildInventoryNaraSummary,
  type NaraChartInput,
} from '../src/utils/naraEvidenceEngine';
import type {
  BrokerDailyPoint,
  BrokerInventoryItem,
  BrokerInventorySummary,
  Candle,
  FvgZone,
  OrderBlock,
  PriceGap,
  SupportResistance,
} from '../src/types';

let checks = 0;

function check(condition: unknown, message: string): void {
  checks += 1;
  assert.ok(condition, message);
}

function dateAt(index: number): string {
  const date = new Date(Date.UTC(2026, 0, 1 + index));
  return date.toISOString().slice(0, 10);
}

function makeCandles(length: number, close = 105): Candle[] {
  return Array.from({ length }, (_, index) => ({
    time: dateAt(index),
    open: close - 1,
    high: close + 2,
    low: close - 2,
    close,
    volume: 1_000,
  }));
}

function makeIndicators(length: number) {
  return {
    ma5: Array(length).fill(105),
    ma10: Array(length).fill(105),
    ma20: Array(length).fill(105),
    ma60: Array(length).fill(105),
    ma200: Array(length).fill(null),
    vwap: Array(length).fill(105),
    volumeMa20: Array(length).fill(1_000),
  };
}

function makeOrderBlock(overrides: Partial<OrderBlock> = {}): OrderBlock {
  return {
    id: 'ob-bull-10',
    type: 'bullish',
    top: 110,
    bottom: 100,
    startIndex: 10,
    endIndex: 30,
    mitigated: false,
    time: dateAt(10),
    volumeSpike: false,
    structureConfirmation: 'NONE',
    formationIndex: 12,
    ...overrides,
  };
}

function makeFvg(overrides: Partial<FvgZone> = {}): FvgZone {
  return {
    id: 'fvg-bull-12',
    type: 'bullish',
    top: 109,
    bottom: 101,
    startIndex: 10,
    endIndex: 30,
    mitigated: false,
    time: dateAt(11),
    ...overrides,
  };
}

function makeGap(overrides: Partial<PriceGap> = {}): PriceGap {
  return {
    id: 'gap-bull-12',
    type: 'bullish',
    top: 109,
    bottom: 101,
    startIndex: 11,
    endIndex: 30,
    mitigated: false,
    time: dateAt(12),
    ...overrides,
  };
}

function chartInput(overrides: Partial<NaraChartInput> = {}): NaraChartInput {
  const candles = overrides.candles || makeCandles(31);
  return {
    ticker: 'BBCA',
    isRealData: true,
    candles,
    swings: [],
    bosChochLines: [],
    fvgs: [],
    orderBlocks: [],
    priceGaps: [],
    supportResistance: [],
    indicators: makeIndicators(candles.length),
    ...overrides,
  };
}

const exactInput = chartInput({
  orderBlocks: [makeOrderBlock()],
  fvgs: [makeFvg()],
  priceGaps: [makeGap()],
  supportResistance: [{
    id: 'support-105',
    type: 'support',
    price: 105,
    strength: 3,
    startIndex: 10,
    endIndex: 30,
  } as SupportResistance],
});

const exactSummary = buildChartNaraSummary(exactInput);
const exactSummaryRerun = buildChartNaraSummary(exactInput);
check(JSON.stringify(exactSummary) === JSON.stringify(exactSummaryRerun), 'stable rerun must be byte-equivalent');
check(exactSummary.opportunityEvidenceIds.length === 2, 'exact OB/FVG/gap family and support should each expose one primary opportunity');
check(exactSummary.stance === 'BULLISH_CONTEXT', 'direct bullish POI should create bullish context');

const retrievalChanged = buildChartNaraSummary({ ...exactInput, retrievedAt: '2026-08-25T09:00:00.000Z' });
check(
  JSON.stringify(exactSummary.evidence.map(({ evidenceId, evidenceFamilyId }) => ({ evidenceId, evidenceFamilyId }))) ===
    JSON.stringify(retrievalChanged.evidence.map(({ evidenceId, evidenceFamilyId }) => ({ evidenceId, evidenceFamilyId }))),
  'retrieval time must not change stable IDs',
);
check(exactSummary.stance === retrievalChanged.stance, 'retrieval time must not change stance');

const obItem = exactSummary.evidence.find((item) => item.sourceType === 'ORDER_BLOCK');
const fvgItem = exactSummary.evidence.find((item) => item.sourceType === 'FVG');
const gapItem = exactSummary.evidence.find((item) => item.sourceType === 'OPENING_GAP');
const supportItem = exactSummary.evidence.find((item) => item.sourceType === 'SUPPORT');
check(Boolean(obItem && fvgItem && obItem.evidenceFamilyId === fvgItem.evidenceFamilyId), 'exact OB/FVG must share one family');
check(Boolean(obItem && fvgItem && exactSummary.opportunityEvidenceIds.includes(obItem.evidenceId) && !exactSummary.opportunityEvidenceIds.includes(fvgItem.evidenceId)), 'exact OB/FVG must have one primary opportunity');
check(Boolean(obItem && gapItem && obItem.evidenceFamilyId === gapItem.evidenceFamilyId), 'opening gap may join only the exact OB formation');
check(Boolean(fvgItem && fvgItem.relatedEvidenceIds.includes(gapItem?.evidenceId || '')), 'exact/nearby POI relationships must be explicit');
check(Boolean(obItem && supportItem && obItem.evidenceFamilyId !== supportItem.evidenceFamilyId && obItem.relatedEvidenceIds.includes(supportItem.evidenceId)), 'S/R must be related-only and never share the POI family');

const nearbyFvg = buildChartNaraSummary(chartInput({
  orderBlocks: [makeOrderBlock()],
  fvgs: [makeFvg({ id: 'fvg-bull-13', startIndex: 11, time: dateAt(12) })],
}));
const nearbyOb = nearbyFvg.evidence.find((item) => item.sourceType === 'ORDER_BLOCK');
const nearbyItem = nearbyFvg.evidence.find((item) => item.sourceType === 'FVG');
check(Boolean(nearbyOb && nearbyItem && nearbyOb.evidenceFamilyId !== nearbyItem.evidenceFamilyId), 'nearby FVG must remain a separate family');
check(Boolean(nearbyOb && nearbyItem && nearbyOb.relatedEvidenceIds.includes(nearbyItem.evidenceId)), 'nearby overlapping FVG may be related without family merge');

const wrongGap = buildChartNaraSummary(chartInput({
  orderBlocks: [makeOrderBlock()],
  priceGaps: [makeGap({ id: 'gap-bull-20', startIndex: 20, time: dateAt(21) })],
}));
const wrongGapOb = wrongGap.evidence.find((item) => item.sourceType === 'ORDER_BLOCK');
const wrongGapItem = wrongGap.evidence.find((item) => item.sourceType === 'OPENING_GAP');
check(Boolean(wrongGapOb && wrongGapItem && wrongGapOb.evidenceFamilyId !== wrongGapItem.evidenceFamilyId), 'gap with a different D index must not merge');

const dNotTapped = buildChartNaraSummary(chartInput({
  candles: makeCandles(13),
  indicators: makeIndicators(13),
  orderBlocks: [makeOrderBlock({ endIndex: 12, formationIndex: 12 })],
}));
const dItem = dNotTapped.evidence.find((item) => item.sourceType === 'ORDER_BLOCK');
check(dItem?.state === 'FORMED' && dItem.freshnessTier === 'FRESH', 'OB at D must remain formed and untapped');
check(dNotTapped.opportunityEvidenceIds.length === 0, 'OB at D must not become an opportunity before D+1');
check(!dNotTapped.evidence.some((item) => item.state === 'PARTIALLY_FILLED'), 'partial fill must remain unknown rather than invented');

const filled = buildChartNaraSummary(chartInput({
  orderBlocks: [makeOrderBlock({ mitigated: true })],
  fvgs: [makeFvg({ mitigated: true })],
}));
check(filled.opportunityEvidenceIds.length === 0, 'filled POI must not be an opportunity');
check(filled.evidence.filter((item) => item.sourceType === 'ORDER_BLOCK' || item.sourceType === 'FVG').every((item) => item.state === 'FULLY_FILLED'), 'filled POI lifecycle must be explicit');

for (const age of [20, 21, 60, 61]) {
  const asOfIndex = 79;
  const formationIndex = asOfIndex - age;
  const aged = buildChartNaraSummary(chartInput({
    candles: makeCandles(80),
    indicators: makeIndicators(80),
    orderBlocks: [makeOrderBlock({ startIndex: formationIndex - 2, formationIndex, time: dateAt(formationIndex) })],
  }));
  const agedItem = aged.evidence.find((item) => item.sourceType === 'ORDER_BLOCK');
  check(agedItem?.ageTradingDays === age, `age must use formation index at ${age}`);
  check(agedItem?.freshnessTier === (age <= 20 ? 'FRESH' : age <= 60 ? 'AGING' : 'STALE'), `freshness boundary ${age} must be deterministic`);
  check(aged.stance === 'BULLISH_CONTEXT', `freshness ${age} must not change stance`);
}

const bearishChochOnly = buildChartNaraSummary(chartInput({
  bosChochLines: [{
    id: 'choch-bear-25',
    type: 'CHoCH',
    direction: 'bearish',
    startIndex: 20,
    endIndex: 25,
    price: 100,
    label: 'CHoCH',
    time: dateAt(25),
  }],
}));
check(bearishChochOnly.stance !== 'RISK_ELEVATED', 'bearish CHoCH alone must not elevate stance');
check(bearishChochOnly.evidence.some((item) => item.reasons.includes('BEARISH_CHOCH_RISK_CONTEXT_ONLY')), 'bearish CHoCH must remain visible as context');

const directBearish = buildChartNaraSummary(chartInput({
  orderBlocks: [makeOrderBlock({ type: 'bearish', id: 'ob-bear-10', top: 110, bottom: 100 })],
}));
check(directBearish.stance === 'RISK_ELEVATED', 'direct opposing bearish POI must elevate stance');

check(exactSummary.evidence.some((item) => item.sourceType === 'RISK_REWARD' && item.qualityStatus === 'MISSING'), 'missing execution cost must be explicit unknown context');
check(exactSummary.stance === 'BULLISH_CONTEXT', 'missing execution cost must not override bullish context');

const synthetic = buildChartNaraSummary(chartInput({ isRealData: false }));
const malformed = buildChartNaraSummary(chartInput({ candles: [{ ...makeCandles(31)[0], high: 90 }] }));
const mixed = buildChartNaraSummary(chartInput({ sourceMetadata: { ticker: 'TLKM', timeframe: '1D', asOfDate: dateAt(30), source: 'REAL' } }));
const mixedTimeframe = buildChartNaraSummary(chartInput({ sourceMetadata: { ticker: 'BBCA', timeframe: '4H', asOfDate: dateAt(30), source: 'REAL' } }));
const mixedAsOf = buildChartNaraSummary(chartInput({ sourceMetadata: { ticker: 'BBCA', timeframe: '1D', asOfDate: dateAt(29), source: 'REAL' } }));
const mixedSource = buildChartNaraSummary(chartInput({ sourceMetadata: { ticker: 'BBCA', timeframe: '1D', asOfDate: dateAt(30), source: 'SYNTHETIC' } }));
check(synthetic.stance === 'INSUFFICIENT_DATA' && synthetic.opportunityEvidenceIds.length === 0, 'synthetic chart cannot create positive evidence');
check(malformed.stance === 'INSUFFICIENT_DATA', 'malformed OHLCV must fail quality gate');
check(mixed.stance === 'INSUFFICIENT_DATA', 'mixed ticker metadata must fail quality gate');
check(mixedTimeframe.stance === 'INSUFFICIENT_DATA', 'mixed timeframe metadata must fail quality gate');
check(mixedAsOf.stance === 'INSUFFICIENT_DATA', 'mixed as-of metadata must fail quality gate');
check(mixedSource.stance === 'INSUFFICIENT_DATA', 'mixed source metadata must fail quality gate');

function dailyPoint(date: string, cumNetVol: number, netVol = cumNetVol): BrokerDailyPoint {
  return {
    date,
    buyVol: Math.max(0, netVol),
    sellVol: Math.max(0, -netVol),
    netVol,
    buyVal: Math.max(0, netVol) * 100,
    sellVal: Math.max(0, -netVol) * 100,
    netVal: netVol * 100,
    cumNetVol,
    cumNetVal: cumNetVol * 100,
    avgBuyPrice: 100,
    avgSellPrice: 100,
  };
}

function broker(code: string, points: BrokerDailyPoint[]): BrokerInventoryItem {
  const netVol = points.at(-1)?.cumNetVol || 0;
  return {
    brokerCode: code,
    brokerName: `${code} Fixture`,
    type: 'DOMESTIC_INSTITUTION',
    totalBuyVol: Math.max(0, netVol),
    totalSellVol: Math.max(0, -netVol),
    totalBuyVal: Math.max(0, netVol) * 100,
    totalSellVal: Math.max(0, -netVol) * 100,
    netVol,
    netVal: netVol * 100,
    avgBuyPrice: 100,
    avgSellPrice: 100,
    cleanTendency: netVol >= 0 ? 'CLEAN_ACCUM' : 'CLEAN_DIST',
    cleanRatio: 90,
    churnRatio: 1,
    category: netVol >= 0 ? 'NET_BUY' : 'NET_SELL',
    color: '#22d3ee',
    visible: true,
    rank: 1,
    dailyPoints: points,
  };
}

function inventorySummary(
  brokerRows: BrokerInventoryItem[],
  coverageOverrides: Partial<NonNullable<BrokerInventorySummary['coverage']>> = {},
): BrokerInventorySummary {
  const candles = makeCandles(3);
  const startDate = candles[0].time;
  const endDate = candles[2].time;
  return {
    ticker: 'BBCA',
    stockName: 'Fixture',
    currentPrice: 105,
    dataSource: 'EXTERNAL',
    sourceLabel: 'Fixture external',
    sourceNote: 'Fixture',
    startDate,
    endDate,
    totalTradingDays: candles.length,
    candles,
    topNetBuyers: brokerRows.filter((row) => row.netVol >= 0),
    topNetSellers: brokerRows.filter((row) => row.netVol < 0),
    allBrokers: brokerRows,
    autoSelectedBrokerCodes: brokerRows.map((row) => row.brokerCode).sort(),
    stats: {
      totalVolumeLots: brokerRows.reduce((sum, row) => sum + row.totalBuyVol + row.totalSellVol, 0),
      totalValueIdr: brokerRows.reduce((sum, row) => sum + row.totalBuyVal + row.totalSellVal, 0),
      foreignNetVol: 0,
      foreignNetVal: 0,
      cleanAccumBrokerCount: brokerRows.filter((row) => row.netVol > 0).length,
      cleanDistBrokerCount: brokerRows.filter((row) => row.netVol < 0).length,
    },
    coverage: {
      normalizedTicker: 'BBCA',
      requestedStartDate: startDate,
      requestedEndDate: endDate,
      returnedStartDate: startDate,
      returnedEndDate: endDate,
      retrievedAt: '2026-08-25T09:00:00.000Z',
      source: 'EXTERNAL',
      brokerLimit: 20,
      summaryBrokerCount: brokerRows.length,
      accumulationBrokerCount: brokerRows.length,
      validSeriesPointCount: brokerRows.reduce((sum, row) => sum + row.dailyPoints.length, 0),
      intersectionPointCount: brokerRows.reduce((sum, row) => sum + row.dailyPoints.length, 0),
      missingRequestedDates: [],
      summaryValid: true,
      accumulationValid: true,
      rangeMatches: true,
      sourceSnapshotKey: 'fixture:broker-summary+broker-accumulation',
      ...coverageOverrides,
    },
  };
}

const inventoryDates = [dateAt(0), dateAt(1), dateAt(2)];
const positiveInventory = inventorySummary([
  broker('ZZ', inventoryDates.map((date, index) => dailyPoint(date, (index + 1) * 10, 10))),
  broker('AA', inventoryDates.map((date, index) => dailyPoint(date, (index + 1) * 20, 20))),
]);
const positiveNara = buildInventoryNaraSummary({ summary: positiveInventory, candles: positiveInventory.candles, selectedBrokerCodes: ['ZZ', 'AA'] });
check(positiveNara.stance === 'BULLISH_CONTEXT', 'positive selected flow and breadth must be bullish context');
check(positiveNara.evidence.some((item) => item.sourceType === 'BROKER_FLOW' && item.value === 90), 'aggregate flow must use selected broker cumulative values');

const negativeInventory = inventorySummary([
  broker('ZZ', inventoryDates.map((date, index) => dailyPoint(date, -(index + 1) * 10, -10))),
  broker('AA', inventoryDates.map((date, index) => dailyPoint(date, -(index + 1) * 20, -20))),
]);
check(buildInventoryNaraSummary({ summary: negativeInventory, candles: negativeInventory.candles, selectedBrokerCodes: ['AA', 'ZZ'] }).stance === 'RISK_ELEVATED', 'negative selected flow and breadth must be risk context');

const mixedInventory = inventorySummary([
  broker('ZZ', inventoryDates.map((date, index) => dailyPoint(date, (index + 1) * 10, 10))),
  broker('AA', inventoryDates.map((date, index) => dailyPoint(date, -(index + 1) * 10, -10))),
]);
check(buildInventoryNaraSummary({ summary: mixedInventory, candles: mixedInventory.candles, selectedBrokerCodes: ['AA', 'ZZ'] }).stance === 'NEUTRAL', 'zero aggregate flow must remain neutral');

const partialInventory = inventorySummary(positiveInventory.allBrokers, { accumulationValid: false, rangeMatches: false });
const partialNara = buildInventoryNaraSummary({ summary: partialInventory, candles: partialInventory.candles, selectedBrokerCodes: ['AA'] });
check(partialInventory.coverage?.rangeMatches === false, 'partial provider coverage must not carry a valid range flag');
check(partialNara.stance === 'INSUFFICIENT_DATA' && partialNara.dataQuality.reasons.includes('BROKER_ACCUMULATION_INCOMPLETE'), 'partial provider coverage must be insufficient');

const missingDateInventory = inventorySummary([
  broker('AA', [dailyPoint(inventoryDates[0], 10, 10), dailyPoint(inventoryDates[2], 20, 10)]),
], { accumulationBrokerCount: 1, validSeriesPointCount: 2, intersectionPointCount: 2, missingRequestedDates: [inventoryDates[1]] });
const missingDateNara = buildInventoryNaraSummary({ summary: missingDateInventory, candles: missingDateInventory.candles, selectedBrokerCodes: ['AA'] });
const missingFlow = missingDateNara.evidence.find((item) => item.sourceType === 'BROKER_FLOW');
check(missingDateNara.stance === 'BULLISH_CONTEXT', 'missing provider dates do not automatically change flow stance');
check(Boolean(missingFlow?.reasons.includes('MISSING_PROVIDER_DATES_NO_ZERO_FILL') && missingFlow?.reasons.includes('PERSISTENCE_POINTS:2')), 'missing provider dates must remain missing, not zero-filled');

const sortedSelection = buildInventoryNaraSummary({ summary: positiveInventory, candles: positiveInventory.candles, selectedBrokerCodes: ['AA', 'ZZ'] });
check(JSON.stringify(positiveNara) === JSON.stringify(sortedSelection), 'selected broker toggles must be sorted and deterministic');
check(positiveNara.ownership.value === 0 && positiveNara.ownership.status === 'UNAVAILABLE_OFFICIAL_DATED_DATA', 'ownership must stay unavailable without dated official data');
check(!JSON.stringify(positiveNara).includes('institutional ownership'), 'flow evidence must not claim ownership');

const parityCandles = makeCandles(45, 105).map((candle, index) => ({
  ...candle,
  open: 100 + index * 0.1,
  close: 100 + index * 0.1,
  high: 101 + index * 0.1,
  low: 99 + index * 0.1,
}));
const frontendParity = buildFrontendStockData('BBCA.JK', 'BBCA', 'Fixture', 'Finance', parityCandles, undefined, true);
const serverParity = buildServerStockData('BBCA.JK', 'BBCA', 'Fixture', 'Finance', parityCandles, undefined, true);
check(JSON.stringify(frontendParity.naraSummary) === JSON.stringify(serverParity.naraSummary), 'frontend/serverless chart NARA summary must be deep-equal');

console.log(`SC-20260825-09 fixtures passed: ${checks} assertions`);
