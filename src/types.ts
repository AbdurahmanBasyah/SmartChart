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

export interface ElliottWavePoint {
  wave: '0' | '1' | '2' | '3' | '4' | '5' | 'A' | 'B' | 'C';
  label: string; // e.g. "(1)", "(2)", "(3)", "(4)", "(5)", "(A)", "(B)", "(C)"
  index: number;
  time: string;
  price: number;
  type: 'PEAK' | 'TROUGH' | 'ORIGIN';
}

export interface ElliottWaveRule {
  rule: string;
  passed: boolean;
  note: string;
}

export interface ElliottWaveTarget {
  targetPrice: number;
  percentGain: number;
  ratioLabel: string;
  description: string;
}

export interface ElliottWaveAnalysis {
  currentWave: 'WAVE_1' | 'WAVE_2' | 'WAVE_3' | 'WAVE_4' | 'WAVE_5' | 'WAVE_A' | 'WAVE_B' | 'WAVE_C';
  waveLabel: string; // e.g. "Wave (3) Impulse Expansion"
  phase: 'IMPULSE' | 'CORRECTION';
  probability: 'VERY HIGH' | 'HIGH' | 'MEDIUM';
  points: ElliottWavePoint[];
  invalidationLevel: {
    price: number;
    percentFromCurrent: number;
    rule: string;
    description: string;
  };
  projectedTargets: ElliottWaveTarget[];
  rules: ElliottWaveRule[];
  summary: string;
  momentumDivergence?: boolean;
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
  type: 'ELLIOTT_IMPULSE_EXPANSION' | 'PULLBACK_RETEST' | 'ELLIOTT_WAVE_REVERSAL' | 'SIDEWAYS_ACCUMULATION' | 'BREAKDOWN_RISK';
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
  elliottWave?: ElliottWaveAnalysis;
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
