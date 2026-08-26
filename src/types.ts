export interface Candle {
  time: string; // YYYY-MM-DD or Unix timestamp
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

export interface BrokerDailyPoint {
  date: string; // YYYY-MM-DD
  buyVol: number; // in lots
  sellVol: number; // in lots
  netVol: number; // buyVol - sellVol in lots
  buyVal: number; // in IDR
  sellVal: number; // in IDR
  netVal: number; // buyVal - sellVal in IDR
  cumNetVol: number; // Running cumulative net lots from range start
  cumNetVal: number; // Running cumulative net IDR from range start
  avgBuyPrice: number;
  avgSellPrice: number;
}

export interface BrokerInventoryItem {
  brokerCode: string; // 2-letter IDX broker code (e.g. "YP", "CC", "BK", "AK", "XC", "XL")
  brokerName: string; // Full broker name
  type: 'FOREIGN' | 'DOMESTIC_INSTITUTION' | 'RETAIL';
  totalBuyVol: number; // lots
  totalSellVol: number; // lots
  totalBuyVal: number; // IDR
  totalSellVal: number; // IDR
  netVol: number; // totalBuyVol - totalSellVol (in lots)
  netVal: number; // totalBuyVal - totalSellVal (in IDR)
  avgBuyPrice: number;
  avgSellPrice: number;
  cleanTendency: 'CLEAN_ACCUM' | 'CLEAN_DIST' | 'MODERATE_ACCUM' | 'MODERATE_DIST' | 'NEUTRAL';
  cleanRatio: number; // Buy or Sell purity percentage (0 - 100%)
  churnRatio: number; // Turnover vs net volume ratio
  category: 'NET_BUY' | 'NET_SELL';
  color: string; // Distinct hex color for chart overlay
  visible: boolean; // Chart overlay visibility toggle
  rank: number;
  dailyPoints: BrokerDailyPoint[];
}

export interface BrokerInventorySummary {
  ticker: string;
  stockName: string;
  currentPrice: number;
  dataSource?: 'EXTERNAL' | 'SYNTHETIC';
  sourceLabel?: string;
  sourceNote?: string;
  startDate: string;
  endDate: string;
  totalTradingDays: number;
  candles: Candle[];
  topNetBuyers: BrokerInventoryItem[];
  topNetSellers: BrokerInventoryItem[];
  allBrokers: BrokerInventoryItem[];
  autoSelectedBrokerCodes: string[]; // Default top buyers & sellers
  stats: {
    totalVolumeLots: number;
    totalValueIdr: number;
    foreignNetVol: number;
    foreignNetVal: number;
    cleanAccumBrokerCount: number;
    cleanDistBrokerCount: number;
  };
  coverage?: BrokerInventoryCoverage;
}

export interface BrokerInventoryCoverage {
  normalizedTicker: string;
  requestedStartDate: string;
  requestedEndDate: string;
  returnedStartDate?: string;
  returnedEndDate?: string;
  summaryReturnedStartDate?: string;
  summaryReturnedEndDate?: string;
  accumulationReturnedStartDate?: string;
  accumulationReturnedEndDate?: string;
  rangeMatches?: boolean;
  retrievedAt?: string;
  source: 'EXTERNAL' | 'SYNTHETIC' | 'UNKNOWN';
  brokerLimit?: number;
  selectedBrokerCodes?: string[];
  summaryBrokerCount: number;
  accumulationBrokerCount: number;
  validSeriesPointCount: number;
  intersectionPointCount: number;
  missingRequestedDates: string[];
  missingReason?: string;
  summaryValid: boolean;
  accumulationValid: boolean;
  sourceSnapshotKey?: string;
}

export type NaraEvidenceFamily =
  | 'STRUCTURE'
  | 'POI'
  | 'LIFECYCLE'
  | 'PARTICIPATION'
  | 'RISK';

export type NaraEvidenceRole = 'OPPORTUNITY' | 'RISK' | 'CONTEXT' | 'UNKNOWN';

export type NaraDirection = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

export type NaraQualityStatus =
  | 'VALID'
  | 'DEGRADED'
  | 'STALE'
  | 'MISSING'
  | 'CONFLICT';

export type NaraEvidenceSourceType =
  | 'BOS'
  | 'CHOCH'
  | 'TREND'
  | 'ORDER_BLOCK'
  | 'FVG'
  | 'OPENING_GAP'
  | 'SUPPORT'
  | 'RESISTANCE'
  | 'VOLUME'
  | 'BROKER_FLOW'
  | 'RISK_REWARD'
  | 'DATA_QUALITY';

export type NaraEvidenceState =
  | 'FORMED'
  | 'ACTIVE'
  | 'TAPPED'
  | 'PARTIALLY_FILLED'
  | 'FULLY_FILLED'
  | 'INVALIDATED'
  | 'BROKEN'
  | 'SUPERSEDED'
  | 'EXPIRED'
  | 'STALE'
  | 'CONFLICT'
  | 'UNKNOWN';

export type NaraFreshnessTier = 'FRESH' | 'AGING' | 'STALE' | 'UNKNOWN';

export interface NaraProvenance {
  ruleVersion: string;
  source: 'REAL' | 'EXTERNAL' | 'SYNTHETIC' | 'UNKNOWN';
  ticker: string;
  timeframe: '1D';
  asOfDate: string;
  firstCandleDate?: string;
  latestCandleDate?: string;
  candleCount?: number;
  sourceSnapshotKey?: string;
  retrievedAt?: string;
}

export interface NaraLifecycleMetadata {
  originIndex?: number;
  formationIndex?: number;
  asOfIndex?: number;
  originalTop?: number;
  originalBottom?: number;
  remainingTop?: number;
  remainingBottom?: number;
  firstTapIndex?: number;
  firstTapDate?: string;
  transitionIndex?: number;
  transitionDate?: string;
  transitionReason?: string;
  ruleVersion: string;
}

export interface NaraEvidenceItem {
  evidenceId: string;
  evidenceFamilyId: string;
  formationId?: string;
  family: NaraEvidenceFamily;
  role: NaraEvidenceRole;
  sourceType: NaraEvidenceSourceType;
  direction: NaraDirection;
  state: NaraEvidenceState;
  asOfDate: string;
  sourceDate?: string;
  timeframe: '1D';
  ageTradingDays?: number;
  freshnessTier: NaraFreshnessTier;
  value?: number;
  unit?: string;
  quality: number;
  qualityStatus: NaraQualityStatus;
  provenance: string;
  lifecycle?: NaraLifecycleMetadata;
  relatedEvidenceIds: string[];
  reasons: string[];
}

export type NaraStance =
  | 'BULLISH_CONTEXT'
  | 'NEUTRAL'
  | 'RISK_ELEVATED'
  | 'INSUFFICIENT_DATA';

export interface NaraSummary {
  ticker: string;
  timeframe: '1D';
  asOfDate: string;
  headline: {
    key: string;
    params: Record<string, string | number>;
  };
  stance: NaraStance;
  evidence: NaraEvidenceItem[];
  opportunityEvidenceIds: string[];
  riskEvidenceIds: string[];
  unknownEvidenceIds: string[];
  dataQuality: {
    status: 'VALID' | 'DEGRADED' | 'INSUFFICIENT_DATA' | 'CONFLICT';
    reasons: string[];
    source: 'REAL' | 'EXTERNAL' | 'SYNTHETIC' | 'UNKNOWN';
    freshnessTier: NaraFreshnessTier;
  };
  provenance: NaraProvenance;
  ownership: {
    value: 0;
    status: 'UNAVAILABLE_OFFICIAL_DATED_DATA';
  };
  weightsVersion: 'NONE';
  disclaimerKey: 'RULE_BASED_CONTEXT_NOT_INVESTMENT_ADVICE';
}

export interface FvgZone {
  id: string;
  type: 'bullish' | 'bearish';
  top: number; // Candle 3 Low for bullish, Candle 1 Low for bearish
  bottom: number; // Candle 1 High for bullish, Candle 3 High for bearish
  startIndex: number;
  endIndex: number;
  mitigated: boolean; // Has price filled this gap?
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
  type: 'BSL' | 'SSL'; // Buy-side liquidity or Sell-side liquidity
  price: number;
  index: number;
  time: string;
  swept: boolean;
}

export interface PriceGap {
  id: string;
  type: 'bullish' | 'bearish'; // bullish = gap up, bearish = gap down
  top: number;
  bottom: number;
  startIndex: number;
  endIndex: number;
  mitigated: boolean; // Has price filled this gap?
  time: string;
}

export interface SupportResistance {
  id: string;
  type: 'support' | 'resistance';
  price: number;
  strength: number; // 1-5 touches
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

export interface TradeRecommendation {
  symbol: string;
  name: string;
  currentPrice: number;
  structure: MarketStructureType;
  entryZone: [number, number]; // [minEntry, maxEntry]
  stopLoss: number; // CL ~ 3% - 5%
  stopLossPercent: number;
  takeProfit1: number; // TP1 ~ 10%
  takeProfit1Percent: number;
  takeProfit2: number; // TP2 ~ 20%
  takeProfit2Percent: number;
  takeProfit3?: number; // TP3 ~ 30-35%
  takeProfit3Percent?: number;
  riskRewardRatio: number; // Minimum 1:1.5
  volumeConfirmation: boolean;
  volumeRatio: number; // Volume / Volume MA20
  decisionReasoning: string[];
  smcCatalyst: string;
  status: 'STRONG_BUY_POI' | 'WAIT_PULLBACK_FVG' | 'WAIT_VOLUME_CONFIRMATION' | 'SIDEWAYS_ACCUMULATION' | 'NO_ENTRY' | 'WAIT_FVG_CREATION' | 'ON_BUY_AREA' | 'TAPPED_POI_REBOUND' | 'NEAR_ENTRY';
  primaryZoneType: 'GAP' | 'FVG' | 'ORDER_BLOCK' | 'SUPPORT' | 'NONE';
  primaryZonePrice: number;
  isOnBuyArea?: boolean;
  mostLikelyScenario?: SmcScenario;
}

export interface SmcScenario {
  title: string;
  type: 'IMPULSE_EXPANSION' | 'PULLBACK_RETEST' | 'MOMENTUM_REVERSAL' | 'SIDEWAYS_ACCUMULATION' | 'BREAKDOWN_RISK';
  probability: 'VERY HIGH' | 'HIGH' | 'MEDIUM';
  targetDescription: string;
  steps: string[];
}

export interface StockData {
  symbol: string; // e.g., "BRPT.JK"
  ticker: string; // e.g., "BRPT"
  name: string; // e.g., "Barito Pacific Tbk."
  sector: string;
  conglomerate?: string; // e.g., "Prajogo Pangestu", "Grup Bakrie", "Happy Hapsoro", "Haji Isam"
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

export interface ScreenerFilter {
  search: string;
  sector: string;
  conglomerateFilter?: string;
  structure: 'ALL' | 'RALLYING' | 'SIDEWAYS';
  minRiskReward: number; // default 1.5
  volumeConfirmedOnly: boolean;
  zoneType: 'ALL' | 'FVG' | 'ORDER_BLOCK' | 'SUPPORT';
  signalStatus: 'ALL' | 'STRONG_BUY_POI' | 'WAIT_PULLBACK_FVG' | 'WAIT_FVG_CREATION' | 'NEAR_ENTRY' | 'SIDEWAYS_ACCUMULATION' | 'ON_BUY_AREA' | 'TAPPED_POI_REBOUND';
}
