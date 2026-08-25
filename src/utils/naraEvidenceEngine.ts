import type {
  BrokerInventorySummary,
  Candle,
  FvgZone,
  NaraDirection,
  NaraEvidenceFamily,
  NaraEvidenceItem,
  NaraEvidenceRole,
  NaraEvidenceSourceType,
  NaraEvidenceState,
  NaraFreshnessTier,
  NaraLifecycleMetadata,
  NaraProvenance,
  NaraQualityStatus,
  NaraStance,
  NaraSummary,
  OrderBlock,
  PriceGap,
  SupportResistance,
  SwingPoint,
  TechnicalIndicators,
  BosChochLine,
} from '../types';

export const NARA_RULE_VERSION = 'nara-evidence-v1';
export const NARA_TIMEFRAME = '1D' as const;

export interface NaraChartInput {
  ticker: string;
  isRealData?: boolean;
  candles: Candle[];
  swings: SwingPoint[];
  bosChochLines: BosChochLine[];
  fvgs: FvgZone[];
  orderBlocks: OrderBlock[];
  priceGaps?: PriceGap[];
  supportResistance: SupportResistance[];
  indicators?: TechnicalIndicators;
  asOfDate?: string;
  sourceSnapshotKey?: string;
  retrievedAt?: string;
  sourceMetadata?: {
    ticker?: string;
    timeframe?: string;
    asOfDate?: string;
    source?: 'REAL' | 'SYNTHETIC' | 'EXTERNAL' | 'UNKNOWN';
  };
}

export interface NaraInventoryInput {
  summary: BrokerInventorySummary;
  candles: Candle[];
  selectedBrokerCodes: string[];
  asOfDate?: string;
}

interface Candidate extends NaraEvidenceItem {
  sourceIndex: number;
  originIndex?: number;
  formationIndex?: number;
  zone?: { top: number; bottom: number };
  relationKey?: string;
  provenanceData: NaraProvenance;
}

interface ChartValidation {
  valid: boolean;
  reasons: string[];
  asOfDate: string;
  asOfIndex: number;
  source: 'REAL' | 'SYNTHETIC' | 'UNKNOWN';
}

function normalizeTicker(value: string): string {
  const clean = String(value || '').trim().toUpperCase().replace(/\.JK$/, '');
  if (clean === 'IHSG' || clean === 'JKSE' || clean === '^JKSE') return '^JKSE';
  return clean;
}

function normalizeDate(value: unknown): string {
  return String(value || '').trim().slice(0, 10);
}

function isDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function uniqueReasons(values: string[]): string[] {
  return uniqueSorted(values);
}

function directionOf(type: 'bullish' | 'bearish' | 'support' | 'resistance'): NaraDirection {
  return type === 'bullish' || type === 'support' ? 'BULLISH' : type === 'bearish' || type === 'resistance' ? 'BEARISH' : 'NEUTRAL';
}

function familyId(
  ticker: string,
  direction: NaraDirection,
  originIndex: number,
  formationIndex: number,
  linkRule: string,
): string {
  return `ef:v1:${ticker}:${NARA_TIMEFRAME}:${direction.toLowerCase()}:${originIndex}:${formationIndex}:${linkRule}`;
}

function formationId(ticker: string, direction: NaraDirection, originIndex: number, formationIndex: number): string {
  return `fm:v1:${ticker}:${NARA_TIMEFRAME}:${direction.toLowerCase()}:${originIndex}:${formationIndex}`;
}

function evidenceId(
  ticker: string,
  sourceType: NaraEvidenceSourceType,
  sourceIndex: number,
  asOfDate: string,
): string {
  return `ev:v1:${ticker}:${NARA_TIMEFRAME}:${sourceType.toLowerCase()}:${sourceIndex}:${asOfDate}`;
}

function freshness(ageTradingDays: number | undefined): NaraFreshnessTier {
  if (ageTradingDays === undefined || ageTradingDays < 0) return 'UNKNOWN';
  if (ageTradingDays <= 20) return 'FRESH';
  if (ageTradingDays <= 60) return 'AGING';
  return 'STALE';
}

function provenanceFor(
  ticker: string,
  source: NaraProvenance['source'],
  asOfDate: string,
  candles: Candle[],
  sourceSnapshotKey?: string,
  retrievedAt?: string,
): NaraProvenance {
  return {
    ruleVersion: NARA_RULE_VERSION,
    source,
    ticker,
    timeframe: NARA_TIMEFRAME,
    asOfDate,
    firstCandleDate: normalizeDate(candles[0]?.time),
    latestCandleDate: normalizeDate(candles[candles.length - 1]?.time),
    candleCount: candles.length,
    ...(sourceSnapshotKey ? { sourceSnapshotKey } : {}),
    ...(retrievedAt ? { retrievedAt } : {}),
  };
}

function provenanceKey(provenance: NaraProvenance): string {
  return [
    `ruleVersion=${provenance.ruleVersion}`,
    `source=${provenance.source}`,
    `ticker=${provenance.ticker}`,
    `timeframe=${provenance.timeframe}`,
    `asOfDate=${provenance.asOfDate}`,
    `firstCandleDate=${provenance.firstCandleDate || ''}`,
    `latestCandleDate=${provenance.latestCandleDate || ''}`,
    `candleCount=${provenance.candleCount ?? ''}`,
    `sourceSnapshotKey=${provenance.sourceSnapshotKey || ''}`,
    `retrievedAt=${provenance.retrievedAt || ''}`,
  ].join('|');
}

function idxTickSize(price: number, ticker: string): number {
  if (ticker === '^JKSE') return 1;
  if (price < 200) return 1;
  if (price < 500) return 2;
  if (price < 2_000) return 5;
  if (price < 5_000) return 10;
  return 25;
}

function zonesOverlap(
  left: { top: number; bottom: number },
  right: { top: number; bottom: number },
  ticker: string,
): boolean {
  const overlap = Math.min(left.top, right.top) - Math.max(left.bottom, right.bottom);
  const midpoint = (Math.max(left.bottom, right.bottom) + Math.min(left.top, right.top)) / 2;
  return overlap >= idxTickSize(midpoint, ticker);
}

function priceNearZone(price: number, zone: { top: number; bottom: number }, distance: number): boolean {
  return price >= zone.bottom - distance && price <= zone.top + distance;
}

function inZone(price: number, zone: { top: number; bottom: number }): boolean {
  return price >= zone.bottom && price <= zone.top;
}

function candleTouchesZone(candle: Candle, zone: { top: number; bottom: number }): boolean {
  return candle.high >= zone.bottom && candle.low <= zone.top;
}

function calculateAtr14(candles: Candle[], asOfIndex: number): number | null {
  if (asOfIndex < 13) return null;
  const values: number[] = [];
  for (let index = Math.max(1, asOfIndex - 13); index <= asOfIndex; index += 1) {
    const candle = candles[index];
    const previous = candles[index - 1];
    if (!candle || !previous) return null;
    const trueRange = Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - previous.close),
      Math.abs(candle.low - previous.close),
    );
    if (!finite(trueRange) || trueRange < 0) return null;
    values.push(trueRange);
  }
  return values.length === 14 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function validCandle(candle: Candle | undefined): boolean {
  if (!candle) return false;
  if (!isDate(normalizeDate(candle.time))) return false;
  if (![candle.open, candle.high, candle.low, candle.close, candle.volume].every(finite)) return false;
  if (candle.volume < 0 || candle.high < Math.max(candle.open, candle.close) || candle.low > Math.min(candle.open, candle.close)) return false;
  return true;
}

function validateChartInput(input: NaraChartInput): ChartValidation {
  const ticker = normalizeTicker(input.ticker);
  const candles = input.candles || [];
  const latestDate = normalizeDate(candles[candles.length - 1]?.time);
  const requestedAsOf = input.asOfDate ? normalizeDate(input.asOfDate) : latestDate;
  const reasons: string[] = [];
  if (!ticker) reasons.push('TICKER_MISSING');
  if (!candles.length) reasons.push('OHLCV_EMPTY');
  if (candles.some((candle) => !validCandle(candle))) reasons.push('OHLCV_MALFORMED');
  if (candles.some((candle, index) => index > 0 && normalizeDate(candle.time) <= normalizeDate(candles[index - 1].time))) {
    reasons.push('CANDLE_ORDER_INVALID');
  }
  if (input.isRealData !== true) reasons.push('SYNTHETIC_SOURCE');
  if (input.sourceMetadata?.ticker && normalizeTicker(input.sourceMetadata.ticker) !== ticker) reasons.push('SOURCE_TICKER_MISMATCH');
  if (input.sourceMetadata?.timeframe && input.sourceMetadata.timeframe !== NARA_TIMEFRAME) reasons.push('TIMEFRAME_MISMATCH');
  const expectedSource = input.isRealData === true ? 'REAL' : input.isRealData === false ? 'SYNTHETIC' : 'UNKNOWN';
  if (input.sourceMetadata?.source && input.sourceMetadata.source !== expectedSource) reasons.push('SOURCE_MISMATCH');
  if (input.sourceMetadata?.asOfDate && normalizeDate(input.sourceMetadata.asOfDate) !== latestDate) reasons.push('SOURCE_AS_OF_MISMATCH');
  if (requestedAsOf !== latestDate) reasons.push('AS_OF_MISMATCH');
  const asOfIndex = candles.findIndex((candle) => normalizeDate(candle.time) === requestedAsOf);
  if (asOfIndex < 0) reasons.push('AS_OF_NOT_IN_CANDLES');
  return {
    valid: reasons.length === 0,
    reasons: uniqueReasons(reasons),
    asOfDate: requestedAsOf,
    asOfIndex,
    source: input.isRealData === true ? 'REAL' : input.isRealData === false ? 'SYNTHETIC' : 'UNKNOWN',
  };
}

function ageAt(asOfIndex: number, sourceIndex: number | undefined): number | undefined {
  if (sourceIndex === undefined || asOfIndex < 0 || sourceIndex > asOfIndex) return undefined;
  return asOfIndex - sourceIndex;
}

function zoneState(
  asOfIndex: number,
  formationIndex: number,
  mitigated: boolean,
): { state: NaraEvidenceState; reasons: string[] } {
  if (formationIndex > asOfIndex) return { state: 'UNKNOWN', reasons: ['FORMATION_AFTER_AS_OF'] };
  if (mitigated) return { state: 'FULLY_FILLED', reasons: ['ZONE_REMAINING_BOUNDS_NOT_ACTIVE'] };
  if (asOfIndex <= formationIndex) return { state: 'FORMED', reasons: ['FORMATION_CANDLE_NOT_TAPPED'] };
  return { state: 'ACTIVE', reasons: ['ACTIVE_REMAINING_BOUNDS'] };
}

function zoneLifecycleMetadata(args: {
  candles: Candle[];
  sourceType: 'ORDER_BLOCK' | 'FVG' | 'OPENING_GAP';
  direction: NaraDirection;
  originIndex: number;
  formationIndex: number;
  asOfIndex: number;
  state: NaraEvidenceState;
  remainingTop: number;
  remainingBottom: number;
}): NaraLifecycleMetadata {
  const origin = args.candles[args.originIndex];
  const formation = args.candles[args.formationIndex];
  let originalTop: number | undefined;
  let originalBottom: number | undefined;
  if (args.sourceType === 'ORDER_BLOCK' && origin) {
    originalTop = args.direction === 'BULLISH' ? Math.max(origin.open, origin.close) : origin.high;
    originalBottom = args.direction === 'BULLISH' ? origin.low : Math.min(origin.open, origin.close);
  } else if (args.sourceType === 'FVG' && origin && formation) {
    originalTop = args.direction === 'BULLISH' ? Math.round(formation.low) : Math.round(origin.low);
    originalBottom = args.direction === 'BULLISH' ? Math.round(origin.high) : Math.round(formation.high);
  } else if (args.sourceType === 'OPENING_GAP' && origin && formation) {
    originalTop = args.direction === 'BULLISH' ? formation.open : origin.close;
    originalBottom = args.direction === 'BULLISH' ? origin.close : formation.open;
  }
  return {
    originIndex: args.originIndex,
    formationIndex: args.formationIndex,
    asOfIndex: args.asOfIndex,
    ...(originalTop !== undefined ? { originalTop } : {}),
    ...(originalBottom !== undefined ? { originalBottom } : {}),
    remainingTop: args.remainingTop,
    remainingBottom: args.remainingBottom,
    transitionReason: args.state === 'FULLY_FILLED'
      ? 'EXISTING_MITIGATED_FLAG'
      : args.state === 'FORMED'
        ? 'FORMATION_NOT_TAPPED'
        : args.state === 'ACTIVE'
          ? 'ACTIVE_AFTER_FORMATION'
          : 'LIFECYCLE_UNSUPPORTED_OR_ASOF',
    ruleVersion: NARA_RULE_VERSION,
  };
}

function makeCandidate(args: {
  ticker: string;
  asOfDate: string;
  asOfIndex: number;
  provenance: NaraProvenance;
  family: NaraEvidenceFamily;
  role: NaraEvidenceRole;
  sourceType: NaraEvidenceSourceType;
  direction: NaraDirection;
  state: NaraEvidenceState;
  sourceIndex: number;
  sourceDate?: string;
  ageIndex?: number;
  lifecycle?: NaraLifecycleMetadata;
  formationId?: string;
  evidenceFamilyId: string;
  value?: number;
  unit?: string;
  quality?: number;
  qualityStatus?: NaraQualityStatus;
  reasons?: string[];
  zone?: { top: number; bottom: number };
  originIndex?: number;
  formationIndex?: number;
  relationKey?: string;
}): Candidate {
  const ageTradingDays = ageAt(args.asOfIndex, args.ageIndex ?? args.sourceIndex);
  const reasons = uniqueReasons(args.reasons || []);
  return {
    evidenceId: evidenceId(args.ticker, args.sourceType, args.sourceIndex, args.asOfDate),
    evidenceFamilyId: args.evidenceFamilyId,
    ...(args.formationId ? { formationId: args.formationId } : {}),
    family: args.family,
    role: args.role,
    sourceType: args.sourceType,
    direction: args.direction,
    state: args.state,
    asOfDate: args.asOfDate,
    ...(args.sourceDate ? { sourceDate: args.sourceDate } : {}),
    timeframe: NARA_TIMEFRAME,
    ...(ageTradingDays !== undefined ? { ageTradingDays } : {}),
    freshnessTier: freshness(ageTradingDays),
    ...(args.value !== undefined ? { value: args.value } : {}),
    ...(args.unit ? { unit: args.unit } : {}),
    quality: Math.max(0, Math.min(1, args.quality ?? 1)),
    qualityStatus: args.qualityStatus || 'VALID',
    provenance: provenanceKey(args.provenance),
    ...(args.lifecycle ? { lifecycle: args.lifecycle } : {}),
    relatedEvidenceIds: [],
    reasons,
    sourceIndex: args.sourceIndex,
    ...(args.originIndex !== undefined ? { originIndex: args.originIndex } : {}),
    ...(args.formationIndex !== undefined ? { formationIndex: args.formationIndex } : {}),
    ...(args.zone ? { zone: args.zone } : {}),
    ...(args.relationKey ? { relationKey: args.relationKey } : {}),
    provenanceData: args.provenance,
  };
}

function directBullishRelevance(
  candle: Candle,
  zone: { top: number; bottom: number },
  atr14: number | null,
): boolean {
  if (inZone(candle.close, zone)) return true;
  if (atr14 === null) return candleTouchesZone(candle, zone);
  return candle.close > zone.top && candle.close - zone.top <= atr14;
}

function directBearishRelevance(candle: Candle, zone: { top: number; bottom: number }): boolean {
  return inZone(candle.close, zone) || candleTouchesZone(candle, zone);
}

function sortCandidates(candidates: Candidate[]): Candidate[] {
  const familyOrder: Record<NaraEvidenceFamily, number> = {
    STRUCTURE: 0,
    POI: 1,
    LIFECYCLE: 2,
    PARTICIPATION: 3,
    RISK: 4,
  };
  const roleOrder: Record<NaraEvidenceRole, number> = {
    OPPORTUNITY: 0,
    RISK: 1,
    CONTEXT: 2,
    UNKNOWN: 3,
  };
  return [...candidates].sort((left, right) =>
    familyOrder[left.family] - familyOrder[right.family] ||
    roleOrder[left.role] - roleOrder[right.role] ||
    left.sourceIndex - right.sourceIndex ||
    left.sourceDate?.localeCompare(right.sourceDate || '') ||
    left.evidenceId.localeCompare(right.evidenceId),
  );
}

function finalizeCandidates(candidates: Candidate[]): NaraEvidenceItem[] {
  const deduped = Array.from(new Map(candidates.map((candidate) => [candidate.evidenceId, candidate])).values());
  for (const left of deduped) {
    const related = new Set<string>();
    for (const right of deduped) {
      if (left.evidenceId === right.evidenceId) continue;
      const sameFamily = left.evidenceFamilyId === right.evidenceFamilyId;
      const relatedByZone = left.zone && right.zone && zonesOverlap(left.zone, right.zone, left.provenanceData.ticker) && left.direction === right.direction;
      const leftIsLevel = left.sourceType === 'SUPPORT' || left.sourceType === 'RESISTANCE';
      const rightIsLevel = right.sourceType === 'SUPPORT' || right.sourceType === 'RESISTANCE';
      const level = leftIsLevel ? left : rightIsLevel ? right : undefined;
      const zone = leftIsLevel ? right.zone : rightIsLevel ? left.zone : undefined;
      const relatedByLevel = Boolean(level && zone && level.direction === (leftIsLevel ? right.direction : left.direction) && level.zone && priceNearZone(level.zone.bottom, zone, idxTickSize(level.zone.bottom, left.provenanceData.ticker)));
      const relatedByLine = left.relationKey && left.relationKey === right.relationKey;
      if (sameFamily || relatedByZone || relatedByLevel || relatedByLine) related.add(right.evidenceId);
    }
    left.relatedEvidenceIds = uniqueSorted(Array.from(related));
  }
  return sortCandidates(deduped).map(({ sourceIndex: _sourceIndex, originIndex: _originIndex, formationIndex: _formationIndex, zone: _zone, relationKey: _relationKey, provenanceData: _provenanceData, ...item }) => item);
}

function choosePrimaryIds(evidence: NaraEvidenceItem[], role: NaraEvidenceRole): string[] {
  const candidates = evidence.filter((item) => item.role === role);
  const groups = new Map<string, NaraEvidenceItem[]>();
  candidates.forEach((item) => {
    const key = `${item.evidenceFamilyId}:${item.role}`;
    const group = groups.get(key) || [];
    group.push(item);
    groups.set(key, group);
  });
  const sourcePriority: Record<NaraEvidenceSourceType, number> = {
    ORDER_BLOCK: 0,
    FVG: 1,
    OPENING_GAP: 2,
    SUPPORT: 3,
    RESISTANCE: 4,
    BOS: 5,
    CHOCH: 6,
    TREND: 7,
    VOLUME: 8,
    BROKER_FLOW: 9,
    RISK_REWARD: 10,
    DATA_QUALITY: 11,
  };
  return Array.from(groups.values()).map((group) =>
    [...group].sort((left, right) =>
      (left.state === 'ACTIVE' ? 0 : 1) - (right.state === 'ACTIVE' ? 0 : 1) ||
      sourcePriority[left.sourceType] - sourcePriority[right.sourceType] ||
      (right.ageTradingDays ?? Number.MAX_SAFE_INTEGER) - (left.ageTradingDays ?? Number.MAX_SAFE_INTEGER) ||
      left.evidenceId.localeCompare(right.evidenceId),
    )[0].evidenceId,
  ).sort((left, right) => left.localeCompare(right));
}

function headlineFor(stance: NaraStance, inventory = false): { key: string; params: Record<string, string | number> } {
  if (inventory) {
    return {
      key: stance === 'INSUFFICIENT_DATA'
        ? 'nara.inventory.insufficient_data'
        : stance === 'BULLISH_CONTEXT'
          ? 'nara.inventory.selected_flow_bullish_context'
          : stance === 'RISK_ELEVATED'
            ? 'nara.inventory.selected_flow_risk_context'
            : 'nara.inventory.selected_flow_neutral_context',
      params: {},
    };
  }
  return {
    key: stance === 'INSUFFICIENT_DATA'
      ? 'nara.chart.insufficient_data'
      : stance === 'BULLISH_CONTEXT'
        ? 'nara.chart.bullish_context'
        : stance === 'RISK_ELEVATED'
          ? 'nara.chart.risk_elevated'
          : 'nara.chart.neutral_context',
    params: {},
  };
}

function buildSummary(args: {
  ticker: string;
  asOfDate: string;
  stance: NaraStance;
  evidence: Candidate[];
  provenance: NaraProvenance;
  dataQualityStatus: NaraSummary['dataQuality']['status'];
  dataQualityReasons: string[];
  freshnessTier: NaraFreshnessTier;
  inventory?: boolean;
}): NaraSummary {
  const evidence = finalizeCandidates(args.evidence);
  const opportunityEvidenceIds = choosePrimaryIds(evidence, 'OPPORTUNITY');
  const riskEvidenceIds = choosePrimaryIds(evidence, 'RISK');
  const unknownEvidenceIds = evidence.filter((item) => item.role === 'UNKNOWN' || item.qualityStatus === 'MISSING').map((item) => item.evidenceId).sort();
  const headline = headlineFor(args.stance, args.inventory);
  headline.params = { ticker: args.ticker, ...headline.params };
  return {
    ticker: args.ticker,
    timeframe: NARA_TIMEFRAME,
    asOfDate: args.asOfDate,
    headline,
    stance: args.stance,
    evidence,
    opportunityEvidenceIds,
    riskEvidenceIds,
    unknownEvidenceIds,
    dataQuality: {
      status: args.dataQualityStatus,
      reasons: uniqueReasons(args.dataQualityReasons),
      source: args.provenance.source,
      freshnessTier: args.freshnessTier,
    },
    provenance: args.provenance,
    ownership: { value: 0, status: 'UNAVAILABLE_OFFICIAL_DATED_DATA' },
    weightsVersion: 'NONE',
    disclaimerKey: 'RULE_BASED_CONTEXT_NOT_INVESTMENT_ADVICE',
  };
}

function invalidChartSummary(input: NaraChartInput, validation: ChartValidation): NaraSummary {
  const ticker = normalizeTicker(input.ticker);
  const provenance = provenanceFor(
    ticker,
    validation.source,
    validation.asOfDate,
    input.candles || [],
    input.sourceSnapshotKey,
    input.retrievedAt,
  );
  const item = makeCandidate({
    ticker,
    asOfDate: validation.asOfDate,
    asOfIndex: validation.asOfIndex,
    provenance,
    family: 'RISK',
    role: 'UNKNOWN',
    sourceType: 'DATA_QUALITY',
    direction: 'NEUTRAL',
    state: validation.reasons.includes('SYNTHETIC_SOURCE') ? 'UNKNOWN' : 'CONFLICT',
    sourceIndex: Math.max(0, validation.asOfIndex),
    sourceDate: validation.asOfDate,
    evidenceFamilyId: familyId(ticker, 'NEUTRAL', Math.max(0, validation.asOfIndex), Math.max(0, validation.asOfIndex), 'data-quality-v1'),
    quality: 0,
    qualityStatus: 'MISSING',
    reasons: validation.reasons,
  });
  return buildSummary({
    ticker,
    asOfDate: validation.asOfDate,
    stance: 'INSUFFICIENT_DATA',
    evidence: [item],
    provenance,
    dataQualityStatus: 'INSUFFICIENT_DATA',
    dataQualityReasons: validation.reasons,
    freshnessTier: 'UNKNOWN',
  });
}

function deriveTrend(
  candles: Candle[],
  swings: SwingPoint[],
  indicators: TechnicalIndicators | undefined,
  asOfIndex: number,
): NaraDirection {
  const close = candles[asOfIndex]?.close;
  const ma20 = indicators?.ma20?.[asOfIndex];
  const ma60 = indicators?.ma60?.[asOfIndex];
  if (finite(close) && finite(ma20)) {
    if (close > ma20 && (!finite(ma60) || ma20 >= ma60)) return 'BULLISH';
    if (close < ma20 && (!finite(ma60) || ma20 <= ma60)) return 'BEARISH';
  }
  const latest = [...(swings || [])].filter((swing) => swing.index <= asOfIndex).sort((a, b) => b.index - a.index || b.price - a.price)[0];
  if (latest && (latest.type === 'HH' || latest.type === 'HL')) return 'BULLISH';
  if (latest && (latest.type === 'LH' || latest.type === 'LL')) return 'BEARISH';
  return 'NEUTRAL';
}

export function buildChartNaraSummary(input: NaraChartInput): NaraSummary {
  const validation = validateChartInput(input);
  if (!validation.valid) return invalidChartSummary(input, validation);

  const ticker = normalizeTicker(input.ticker);
  const candles = input.candles;
  const asOfDate = validation.asOfDate;
  const asOfIndex = validation.asOfIndex;
  const currentCandle = candles[asOfIndex];
  const provenance = provenanceFor(ticker, 'REAL', asOfDate, candles, input.sourceSnapshotKey, input.retrievedAt);
  const evidence: Candidate[] = [];
  const atr14 = calculateAtr14(candles, asOfIndex);
  const bullishRelevantKeys = new Set<string>();
  const directBearishKeys = new Set<string>();
  const obByKey = new Map<string, OrderBlock>();

  for (const orderBlock of input.orderBlocks || []) {
    const direction = directionOf(orderBlock.type);
    const originIndex = orderBlock.startIndex;
    const formationIndex = orderBlock.formationIndex;
    const relationKey = orderBlock.structureLineId ? `structure:${orderBlock.structureLineId}` : undefined;
    const exactKey = `${direction}:${originIndex}:${formationIndex}`;
    obByKey.set(exactKey, orderBlock);
    const zone = { top: Math.max(orderBlock.top, orderBlock.bottom), bottom: Math.min(orderBlock.top, orderBlock.bottom) };
    const lifecycle = zoneState(asOfIndex, formationIndex, orderBlock.mitigated);
    const active = lifecycle.state === 'ACTIVE';
    const relevant = active && (direction === 'BULLISH'
      ? directBullishRelevance(currentCandle, zone, atr14)
      : directBearishRelevance(currentCandle, zone));
    const role: NaraEvidenceRole = direction === 'BULLISH'
      ? relevant ? 'OPPORTUNITY' : 'CONTEXT'
      : relevant ? 'RISK' : 'CONTEXT';
    if (relevant && direction === 'BULLISH') bullishRelevantKeys.add(exactKey);
    if (relevant && direction === 'BEARISH') directBearishKeys.add(exactKey);
    evidence.push(makeCandidate({
      ticker,
      asOfDate,
      asOfIndex,
      provenance,
      family: 'POI',
      role,
      sourceType: 'ORDER_BLOCK',
      direction,
      state: lifecycle.state,
      sourceIndex: originIndex,
      sourceDate: normalizeDate(orderBlock.time || candles[originIndex]?.time),
      ageIndex: formationIndex,
      formationId: formationId(ticker, direction, originIndex, formationIndex),
      evidenceFamilyId: familyId(ticker, direction, originIndex, formationIndex, 'ob-fvg-exact-v1'),
      qualityStatus: lifecycle.state === 'UNKNOWN' ? 'MISSING' : 'VALID',
      lifecycle: zoneLifecycleMetadata({
        candles,
        sourceType: 'ORDER_BLOCK',
        direction,
        originIndex,
        formationIndex,
        asOfIndex,
        state: lifecycle.state,
        remainingTop: zone.top,
        remainingBottom: zone.bottom,
      }),
      reasons: [
        ...lifecycle.reasons,
        ...(relevant && direction === 'BULLISH' ? ['CURRENT_PRICE_RELEVANT_BULLISH_POI'] : []),
        ...(relevant && direction === 'BEARISH' ? ['DIRECT_OPPOSING_BEARISH_POI'] : []),
        ...(atr14 === null ? ['ATR14_UNAVAILABLE_DIRECT_TOUCH_ONLY'] : []),
      ],
      zone,
      originIndex,
      formationIndex,
      relationKey,
    }));
  }

  for (const fvg of input.fvgs || []) {
    const direction = directionOf(fvg.type);
    const originIndex = fvg.startIndex;
    const formationIndex = fvg.startIndex + 2;
    const exactKey = `${direction}:${originIndex}:${formationIndex}`;
    const exactOrderBlock = obByKey.get(exactKey);
    const linkRule = exactOrderBlock ? 'ob-fvg-exact-v1' : 'fvg-standalone-v1';
    const zone = { top: Math.max(fvg.top, fvg.bottom), bottom: Math.min(fvg.top, fvg.bottom) };
    const lifecycle = zoneState(asOfIndex, formationIndex, fvg.mitigated);
    const active = lifecycle.state === 'ACTIVE';
    const relevant = active && (direction === 'BULLISH'
      ? directBullishRelevance(currentCandle, zone, atr14)
      : directBearishRelevance(currentCandle, zone));
    const role: NaraEvidenceRole = direction === 'BULLISH'
      ? relevant ? 'OPPORTUNITY' : 'CONTEXT'
      : relevant ? 'RISK' : 'CONTEXT';
    if (relevant && direction === 'BULLISH') bullishRelevantKeys.add(exactKey);
    if (relevant && direction === 'BEARISH') directBearishKeys.add(exactKey);
    evidence.push(makeCandidate({
      ticker,
      asOfDate,
      asOfIndex,
      provenance,
      family: 'POI',
      role,
      sourceType: 'FVG',
      direction,
      state: lifecycle.state,
      sourceIndex: originIndex,
      sourceDate: normalizeDate(fvg.time || candles[formationIndex - 1]?.time),
      ageIndex: formationIndex,
      formationId: formationId(ticker, direction, originIndex, formationIndex),
      evidenceFamilyId: familyId(ticker, direction, originIndex, formationIndex, linkRule),
      qualityStatus: lifecycle.state === 'UNKNOWN' ? 'MISSING' : 'VALID',
      lifecycle: zoneLifecycleMetadata({
        candles,
        sourceType: 'FVG',
        direction,
        originIndex,
        formationIndex,
        asOfIndex,
        state: lifecycle.state,
        remainingTop: zone.top,
        remainingBottom: zone.bottom,
      }),
      reasons: [
        ...lifecycle.reasons,
        ...(exactOrderBlock ? ['EXACT_OB_FVG_SEQUENCE'] : ['FVG_SEPARATE_FROM_NEARBY_POI_UNLESS_EXACT']),
        ...(relevant && direction === 'BULLISH' ? ['CURRENT_PRICE_RELEVANT_BULLISH_POI'] : []),
        ...(relevant && direction === 'BEARISH' ? ['DIRECT_OPPOSING_BEARISH_POI'] : []),
        ...(atr14 === null ? ['ATR14_UNAVAILABLE_DIRECT_TOUCH_ONLY'] : []),
      ],
      zone,
      originIndex,
      formationIndex,
    }));
  }

  for (const gap of input.priceGaps || []) {
    const direction = directionOf(gap.type);
    const originIndex = gap.startIndex;
    const formationIndex = gap.startIndex + 1;
    const matchingOb = [...obByKey.entries()].find(([, orderBlock]) => {
      return orderBlock.type === gap.type && orderBlock.formationIndex === formationIndex && zonesOverlap(
        { top: orderBlock.top, bottom: orderBlock.bottom },
        { top: gap.top, bottom: gap.bottom },
        ticker,
      );
    });
    const exactOrderBlock = matchingOb?.[1];
    const linkRule = exactOrderBlock ? 'ob-fvg-exact-v1' : 'opening-gap-standalone-v1';
    const zone = { top: Math.max(gap.top, gap.bottom), bottom: Math.min(gap.top, gap.bottom) };
    const lifecycle = zoneState(asOfIndex, formationIndex, gap.mitigated);
    const active = lifecycle.state === 'ACTIVE';
    const relevant = active && (direction === 'BULLISH'
      ? directBullishRelevance(currentCandle, zone, atr14)
      : directBearishRelevance(currentCandle, zone));
    const role: NaraEvidenceRole = direction === 'BULLISH'
      ? relevant ? 'OPPORTUNITY' : 'CONTEXT'
      : relevant ? 'RISK' : 'CONTEXT';
    if (relevant && direction === 'BULLISH') bullishRelevantKeys.add(`${direction}:${originIndex}:${formationIndex}`);
    if (relevant && direction === 'BEARISH') directBearishKeys.add(`${direction}:${originIndex}:${formationIndex}`);
    const matchedFamily = exactOrderBlock
      ? familyId(ticker, direction, exactOrderBlock.startIndex, exactOrderBlock.formationIndex, linkRule)
      : familyId(ticker, direction, originIndex, formationIndex, linkRule);
    evidence.push(makeCandidate({
      ticker,
      asOfDate,
      asOfIndex,
      provenance,
      family: 'POI',
      role,
      sourceType: 'OPENING_GAP',
      direction,
      state: lifecycle.state,
      sourceIndex: originIndex,
      sourceDate: normalizeDate(gap.time || candles[formationIndex]?.time),
      ageIndex: formationIndex,
      formationId: formationId(ticker, direction, originIndex, formationIndex),
      evidenceFamilyId: matchedFamily,
      qualityStatus: lifecycle.state === 'UNKNOWN' ? 'MISSING' : 'VALID',
      lifecycle: zoneLifecycleMetadata({
        candles,
        sourceType: 'OPENING_GAP',
        direction,
        originIndex,
        formationIndex,
        asOfIndex,
        state: lifecycle.state,
        remainingTop: zone.top,
        remainingBottom: zone.bottom,
      }),
      reasons: [
        ...lifecycle.reasons,
        ...(exactOrderBlock ? ['OPENING_GAP_CURRENT_OPEN_EQUALS_OB_FORMATION'] : ['OPENING_GAP_UNPROVEN_LINK_SEPARATE_FAMILY']),
        ...(relevant && direction === 'BULLISH' ? ['CURRENT_PRICE_RELEVANT_BULLISH_POI'] : []),
        ...(relevant && direction === 'BEARISH' ? ['DIRECT_OPPOSING_BEARISH_POI'] : []),
      ],
      zone,
      originIndex,
      formationIndex,
    }));
  }

  for (const supportResistance of input.supportResistance || []) {
    const direction = directionOf(supportResistance.type);
    const zone = { top: supportResistance.price, bottom: supportResistance.price };
    const atrDistance = atr14 ?? idxTickSize(supportResistance.price, ticker);
    const direct = priceNearZone(currentCandle.close, zone, atrDistance) || candleTouchesZone(currentCandle, zone);
    const role: NaraEvidenceRole = direction === 'BULLISH' ? direct ? 'OPPORTUNITY' : 'CONTEXT' : direct ? 'RISK' : 'CONTEXT';
    const sourceIndex = supportResistance.startIndex;
    const formationIndex = supportResistance.endIndex;
    evidence.push(makeCandidate({
      ticker,
      asOfDate,
      asOfIndex,
      provenance,
      family: 'POI',
      role,
      sourceType: direction === 'BULLISH' ? 'SUPPORT' : 'RESISTANCE',
      direction,
      state: 'ACTIVE',
      sourceIndex,
      sourceDate: normalizeDate(candles[sourceIndex]?.time),
      evidenceFamilyId: familyId(ticker, direction, sourceIndex, formationIndex, 'sr-standalone-v1'),
      value: supportResistance.price,
      unit: 'PRICE',
      reasons: [
        'SUPPORT_RESISTANCE_CONTEXT',
        ...(direct ? ['CURRENT_PRICE_NEAR_LEVEL'] : []),
        'SR_RELATED_TO_POI_ONLY_IF_WITHIN_ONE_TICK',
      ],
      zone,
      originIndex: sourceIndex,
      formationIndex,
    }));
    if (direct && direction === 'BULLISH') bullishRelevantKeys.add(`SR:${supportResistance.id}`);
    if (direct && direction === 'BEARISH') directBearishKeys.add(`SR:${supportResistance.id}`);
  }

  for (const line of input.bosChochLines || []) {
    if (line.endIndex > asOfIndex) continue;
    const direction: NaraDirection = line.direction === 'bullish' ? 'BULLISH' : 'BEARISH';
    const sourceType: NaraEvidenceSourceType = line.type === 'CHoCH' ? 'CHOCH' : 'BOS';
    const role: NaraEvidenceRole = line.direction === 'bearish' ? 'RISK' : 'CONTEXT';
    evidence.push(makeCandidate({
      ticker,
      asOfDate,
      asOfIndex,
      provenance,
      family: 'STRUCTURE',
      role,
      sourceType,
      direction,
      state: 'FORMED',
      sourceIndex: line.startIndex,
      sourceDate: normalizeDate(line.time || candles[line.endIndex]?.time),
      ageIndex: line.endIndex,
      evidenceFamilyId: familyId(ticker, direction, 0, asOfIndex, 'structure-v1'),
      reasons: line.type === 'CHoCH' && line.direction === 'bearish'
        ? ['BEARISH_CHOCH_RISK_CONTEXT_ONLY']
        : ['STRUCTURE_CONTEXT_ONLY_NO_WEIGHT'],
      relationKey: `structure:${line.id}`,
      originIndex: line.startIndex,
      formationIndex: line.endIndex,
    }));
  }

  const trend = deriveTrend(candles, input.swings, input.indicators, asOfIndex);
  evidence.push(makeCandidate({
    ticker,
    asOfDate,
    asOfIndex,
    provenance,
    family: 'STRUCTURE',
    role: 'CONTEXT',
    sourceType: 'TREND',
    direction: trend,
    state: 'FORMED',
    sourceIndex: asOfIndex,
    sourceDate: asOfDate,
    evidenceFamilyId: familyId(ticker, trend, 0, asOfIndex, 'structure-v1'),
    reasons: ['TREND_CONTEXT_ONLY_NO_WEIGHT'],
    originIndex: 0,
    formationIndex: asOfIndex,
  }));

  const latestVolume = currentCandle.volume;
  const latestVolumeMa = input.indicators?.volumeMa20?.[asOfIndex];
  if (finite(latestVolume) && finite(latestVolumeMa) && latestVolumeMa > 0) {
    evidence.push(makeCandidate({
      ticker,
      asOfDate,
      asOfIndex,
      provenance,
      family: 'PARTICIPATION',
      role: 'CONTEXT',
      sourceType: 'VOLUME',
      direction: 'NEUTRAL',
      state: 'FORMED',
      sourceIndex: asOfIndex,
      sourceDate: asOfDate,
      evidenceFamilyId: familyId(ticker, 'NEUTRAL', 0, asOfIndex, 'participation-v1'),
      value: latestVolume / latestVolumeMa,
      unit: 'VOLUME_RATIO',
      reasons: ['VOLUME_PARTICIPATION_CONTEXT'],
      originIndex: asOfIndex,
      formationIndex: asOfIndex,
    }));
  }

  evidence.push(makeCandidate({
    ticker,
    asOfDate,
    asOfIndex,
    provenance,
    family: 'RISK',
    role: 'UNKNOWN',
    sourceType: 'RISK_REWARD',
    direction: 'NEUTRAL',
    state: 'UNKNOWN',
    sourceIndex: asOfIndex,
    sourceDate: asOfDate,
    evidenceFamilyId: familyId(ticker, 'NEUTRAL', asOfIndex, asOfIndex, 'execution-cost-v1'),
    quality: 0,
    qualityStatus: 'MISSING',
    reasons: ['EXECUTION_COST_UNAVAILABLE'],
    originIndex: asOfIndex,
    formationIndex: asOfIndex,
  }));

  const directOpposingBearish = directBearishKeys.size > 0;
  const hasRelevantBullish = bullishRelevantKeys.size > 0;
  const stance: NaraStance = directOpposingBearish
    ? 'RISK_ELEVATED'
    : hasRelevantBullish
      ? 'BULLISH_CONTEXT'
      : 'NEUTRAL';
  const freshnessTier = freshness(0);
  return buildSummary({
    ticker,
    asOfDate,
    stance,
    evidence,
    provenance,
    dataQualityStatus: 'DEGRADED',
    dataQualityReasons: ['EXECUTION_COST_UNAVAILABLE'],
    freshnessTier,
  });
}

function inventoryReasonCodes(
  input: NaraInventoryInput,
  selectedCodes: string[],
  selectedPointDates: string[],
): string[] {
  const summary = input.summary;
  const coverage = summary.coverage;
  const reasons: string[] = [];
  const ticker = normalizeTicker(summary.ticker);
  if (!coverage) reasons.push('COVERAGE_METADATA_MISSING');
  if (summary.dataSource !== 'EXTERNAL') reasons.push('EXTERNAL_SOURCE_REQUIRED');
  if (coverage && coverage.source !== 'EXTERNAL') reasons.push('EXTERNAL_SOURCE_REQUIRED');
  if (coverage && !coverage.summaryValid) reasons.push('BROKER_SUMMARY_INCOMPLETE');
  if (coverage && !coverage.accumulationValid) reasons.push('BROKER_ACCUMULATION_INCOMPLETE');
  const rangeMatches = coverage?.rangeMatches === true;
  if (coverage && String(coverage.missingReason || '').split('|').includes('TICKER_MISMATCH')) {
    reasons.push('TICKER_INVALID');
  }
  if (coverage && !rangeMatches) {
    const knownCoverageReasons = new Set([
      'BROKER_SUMMARY_RANGE_MISSING',
      'BROKER_ACCUMULATION_RANGE_MISSING',
      'BROKER_SUMMARY_RANGE_MISMATCH',
      'BROKER_ACCUMULATION_RANGE_MISMATCH',
      'BROKER_ENDPOINT_RANGE_MISMATCH',
    ]);
    const explicitReasons = String(coverage.missingReason || '')
      .split('|')
      .filter((reason) => knownCoverageReasons.has(reason));
    reasons.push(...explicitReasons);
    if (explicitReasons.length === 0) {
      reasons.push('BROKER_ENDPOINT_RANGE_MISMATCH');
    }
  }
  if (normalizeTicker(input.summary.ticker) !== ticker || (coverage && normalizeTicker(coverage.normalizedTicker) !== ticker)) reasons.push('TICKER_INVALID');
  if (selectedCodes.length === 0) reasons.push('SELECTED_BROKER_EMPTY');
  if (coverage && coverage.requestedStartDate !== summary.startDate) reasons.push('REQUESTED_START_MISMATCH');
  if (coverage && coverage.requestedEndDate !== summary.endDate) reasons.push('REQUESTED_END_MISMATCH');
  if (coverage && coverage.returnedStartDate && coverage.returnedStartDate !== coverage.requestedStartDate) reasons.push('RETURNED_START_MISMATCH');
  if (coverage && coverage.returnedEndDate && coverage.returnedEndDate !== coverage.requestedEndDate) reasons.push('RETURNED_END_MISMATCH');
  if (selectedPointDates.length === 0) reasons.push('SELECTED_BROKER_SERIES_MISSING');
  const candleDates = new Set(input.candles.map((candle) => normalizeDate(candle.time)).filter(Boolean));
  if (!selectedPointDates.some((date) => candleDates.has(date))) reasons.push('CANDLE_FLOW_DATE_INTERSECTION_MISSING');
  return uniqueReasons(reasons);
}

export function buildInventoryNaraSummary(input: NaraInventoryInput): NaraSummary {
  const ticker = normalizeTicker(input.summary.ticker);
  const candles = input.candles || [];
  const asOfDate = normalizeDate(input.asOfDate || input.summary.endDate || candles[candles.length - 1]?.time);
  const source = input.summary.coverage?.source === 'EXTERNAL' && input.summary.dataSource === 'EXTERNAL' ? 'EXTERNAL' : input.summary.dataSource === 'SYNTHETIC' ? 'SYNTHETIC' : 'UNKNOWN';
  const provenance = provenanceFor(
    ticker,
    source,
    asOfDate,
    candles,
    input.summary.coverage?.sourceSnapshotKey || 'broker-summary+broker-accumulation',
    input.summary.coverage?.retrievedAt,
  );
  const selectedCodes = uniqueSorted((input.selectedBrokerCodes || []).map(normalizeBrokerCode));
  const selectedBrokers = selectedCodes.map((code) => input.summary.allBrokers.find((broker) => normalizeBrokerCode(broker.brokerCode) === code)).filter(Boolean);
  const selectedPointDates = uniqueSorted(selectedBrokers.flatMap((broker) => (broker?.dailyPoints || []).map((point) => normalizeDate(point.date)).filter(Boolean)));
  const reasons = inventoryReasonCodes(input, selectedCodes, selectedPointDates);
  const candleDates = new Set(candles.map((candle) => normalizeDate(candle.time)).filter(Boolean));
  const intersectedDates = selectedPointDates.filter((date) => candleDates.has(date));
  const missingDates = Array.from(candleDates).filter((date) => date >= input.summary.startDate && date <= input.summary.endDate && !intersectedDates.includes(date)).sort();
  const validSelectedBrokers = selectedBrokers.filter((broker) => (broker?.dailyPoints || []).some((point) => intersectedDates.includes(normalizeDate(point.date))));
  const latestPoints = validSelectedBrokers.map((broker) => [...(broker?.dailyPoints || [])].filter((point) => intersectedDates.includes(normalizeDate(point.date))).sort((a, b) => a.date.localeCompare(b.date)).at(-1)).filter(Boolean);
  const aggregateNetLots = latestPoints.reduce((sum, point) => sum + (point?.cumNetVol || 0), 0);
  const aggregateNetValue = latestPoints.reduce((sum, point) => sum + (point?.cumNetVal || 0), 0);
  const positiveBreadth = latestPoints.filter((point) => (point?.cumNetVol || 0) > 0).length;
  const negativeBreadth = latestPoints.filter((point) => (point?.cumNetVol || 0) < 0).length;
  const breadthNet = positiveBreadth - negativeBreadth;
  const netLotsValueConflict = (aggregateNetLots > 0 && aggregateNetValue < 0) || (aggregateNetLots < 0 && aggregateNetValue > 0);
  const complete = reasons.length === 0 && validSelectedBrokers.length > 0 && intersectedDates.length > 0;
  const evidence: Candidate[] = [];
  const flowSourceIndex = Math.max(0, candles.findIndex((candle) => normalizeDate(candle.time) === asOfDate));
  const flowDirection: NaraDirection = netLotsValueConflict
    ? 'NEUTRAL'
    : aggregateNetLots > 0 && breadthNet > 0
      ? 'BULLISH'
      : aggregateNetLots < 0 && breadthNet < 0
        ? 'BEARISH'
        : 'NEUTRAL';
  const flowRole: NaraEvidenceRole = complete
    ? flowDirection === 'BULLISH' ? 'OPPORTUNITY' : flowDirection === 'BEARISH' ? 'RISK' : 'CONTEXT'
    : 'UNKNOWN';
  evidence.push(makeCandidate({
    ticker,
    asOfDate,
    asOfIndex: flowSourceIndex,
    provenance,
    family: 'PARTICIPATION',
    role: flowRole,
    sourceType: 'BROKER_FLOW',
    direction: flowDirection,
    state: complete ? 'ACTIVE' : 'UNKNOWN',
    sourceIndex: flowSourceIndex,
    sourceDate: asOfDate,
    evidenceFamilyId: familyId(ticker, flowDirection, 0, flowSourceIndex, 'broker-flow-selected-v1'),
    value: complete ? aggregateNetLots : undefined,
    unit: 'SELECTED_BROKER_NET_LOTS',
    quality: complete ? 1 : 0,
    qualityStatus: complete ? 'VALID' : 'MISSING',
    reasons: complete
      ? [
        'SELECTED_BROKER_FLOW_ONLY',
        `SELECTED_BROKER_COUNT:${selectedCodes.length}`,
        `BREADTH_POSITIVE:${positiveBreadth}`,
        `BREADTH_NEGATIVE:${negativeBreadth}`,
        `BREADTH_NET:${breadthNet}`,
        `PERSISTENCE_POINTS:${intersectedDates.length}`,
        ...(netLotsValueConflict ? ['NET_LOTS_VALUE_CONFLICT'] : []),
        ...(missingDates.length ? ['MISSING_PROVIDER_DATES_NO_ZERO_FILL'] : []),
      ]
      : reasons,
    originIndex: 0,
    formationIndex: flowSourceIndex,
  }));

  const stance: NaraStance = !complete
    ? 'INSUFFICIENT_DATA'
    : flowDirection === 'BULLISH'
      ? 'BULLISH_CONTEXT'
      : flowDirection === 'BEARISH'
        ? 'RISK_ELEVATED'
        : 'NEUTRAL';
  const flowAge = intersectedDates.length ? Math.max(0, candles.filter((candle) => normalizeDate(candle.time) > intersectedDates[intersectedDates.length - 1]).length) : undefined;
  const freshnessTier = freshness(flowAge);
  return buildSummary({
    ticker,
    asOfDate,
    stance,
    evidence,
    provenance,
    dataQualityStatus: complete ? 'VALID' : 'INSUFFICIENT_DATA',
    dataQualityReasons: complete ? uniqueReasons([
      ...(missingDates.length ? ['PROVIDER_DATE_COVERAGE_PARTIAL_NO_ZERO_FILL'] : []),
      ...(netLotsValueConflict ? ['NET_LOTS_VALUE_CONFLICT'] : []),
    ]) : reasons,
    freshnessTier,
    inventory: true,
  });
}

function normalizeBrokerCode(value: unknown): string {
  return String(value || '').trim().toUpperCase();
}
