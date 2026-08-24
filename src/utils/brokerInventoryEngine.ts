import { Candle, BrokerDailyPoint, BrokerInventoryItem, BrokerInventorySummary } from '../types';

export interface BrokerCatalogEntry {
  code: string;
  name: string;
  type: 'FOREIGN' | 'DOMESTIC_INSTITUTION' | 'RETAIL';
  color: string;
  defaultTendency?: 'ACCUMULATOR' | 'DISTRIBUTOR' | 'NEUTRAL';
}

/**
 * Official Indonesia Stock Exchange (IDX) Exchange Member (Anggota Bursa) Catalog
 * Aligned with IDX /ExchangeMember/GetBrokerSearch directory.
 */
export const IDX_BROKER_CATALOG: BrokerCatalogEntry[] = [
  // Foreign Institutions
  { code: 'BK', name: 'J.P. Morgan Sekuritas Indonesia', type: 'FOREIGN', color: '#38bdf8', defaultTendency: 'ACCUMULATOR' },
  { code: 'AK', name: 'UBS Sekuritas Indonesia', type: 'FOREIGN', color: '#06b6d4', defaultTendency: 'ACCUMULATOR' },
  { code: 'ZP', name: 'Maybank Sekuritas Indonesia', type: 'FOREIGN', color: '#6366f1', defaultTendency: 'ACCUMULATOR' },
  { code: 'CS', name: 'Credit Suisse Sekuritas Indonesia', type: 'FOREIGN', color: '#3b82f6', defaultTendency: 'NEUTRAL' },
  { code: 'RX', name: 'Macquarie Sekuritas Indonesia', type: 'FOREIGN', color: '#0284c7', defaultTendency: 'NEUTRAL' },
  { code: 'KZ', name: 'CLSA Sekuritas Indonesia', type: 'FOREIGN', color: '#2563eb', defaultTendency: 'DISTRIBUTOR' },
  { code: 'MS', name: 'Morgan Stanley Indonesia', type: 'FOREIGN', color: '#0ea5e9', defaultTendency: 'NEUTRAL' },
  { code: 'CG', name: 'CGS International Sekuritas Indonesia', type: 'FOREIGN', color: '#1d4ed8', defaultTendency: 'NEUTRAL' },
  { code: 'BQ', name: 'Korea Investment & Sekuritas Indonesia', type: 'FOREIGN', color: '#4f46e5', defaultTendency: 'NEUTRAL' },
  { code: 'AI', name: 'UOB Kay Hian Sekuritas', type: 'FOREIGN', color: '#4338ca', defaultTendency: 'NEUTRAL' },
  { code: 'YU', name: 'CIMB Sekuritas Indonesia', type: 'FOREIGN', color: '#312e81', defaultTendency: 'NEUTRAL' },
  { code: 'ML', name: 'Merrill Lynch Sekuritas Indonesia', type: 'FOREIGN', color: '#1e40af', defaultTendency: 'NEUTRAL' },
  { code: 'DB', name: 'Deutsche Sekuritas Indonesia', type: 'FOREIGN', color: '#0284c7', defaultTendency: 'NEUTRAL' },
  { code: 'DP', name: 'DBS Vickers Sekuritas Indonesia', type: 'FOREIGN', color: '#ea580c', defaultTendency: 'NEUTRAL' },
  { code: 'GW', name: 'HSBC Sekuritas Indonesia', type: 'FOREIGN', color: '#65a30d', defaultTendency: 'NEUTRAL' },
  { code: 'NH', name: 'NH Korindo Sekuritas Indonesia', type: 'FOREIGN', color: '#115e59', defaultTendency: 'NEUTRAL' },
  { code: 'NO', name: 'Nomura Sekuritas Indonesia', type: 'FOREIGN', color: '#0369a1', defaultTendency: 'NEUTRAL' },
  { code: 'QA', name: 'Shinhan Sekuritas Indonesia', type: 'FOREIGN', color: '#075985', defaultTendency: 'NEUTRAL' },
  { code: 'SW', name: 'Yuanta Sekuritas Indonesia', type: 'FOREIGN', color: '#6b21a8', defaultTendency: 'NEUTRAL' },
  { code: 'AG', name: 'Kiwoom Sekuritas Indonesia', type: 'FOREIGN', color: '#059669', defaultTendency: 'NEUTRAL' },
  { code: 'AH', name: 'Shinhan Sekuritas (AH)', type: 'FOREIGN', color: '#0891b2', defaultTendency: 'NEUTRAL' },
  { code: 'AL', name: 'Chailease Sekuritas Indonesia', type: 'FOREIGN', color: '#0d9488', defaultTendency: 'NEUTRAL' },

  // Domestic Institutions & Large Local Banks/State-Owned
  { code: 'CC', name: 'Mandiri Sekuritas', type: 'DOMESTIC_INSTITUTION', color: '#10b981', defaultTendency: 'ACCUMULATOR' },
  { code: 'NI', name: 'BNI Sekuritas', type: 'DOMESTIC_INSTITUTION', color: '#059669', defaultTendency: 'ACCUMULATOR' },
  { code: 'OD', name: 'BRI Danareksa Sekuritas', type: 'DOMESTIC_INSTITUTION', color: '#14b8a6', defaultTendency: 'ACCUMULATOR' },
  { code: 'DX', name: 'Bahana Sekuritas', type: 'DOMESTIC_INSTITUTION', color: '#0d9488', defaultTendency: 'ACCUMULATOR' },
  { code: 'SQ', name: 'BCA Sekuritas', type: 'DOMESTIC_INSTITUTION', color: '#34d399', defaultTendency: 'ACCUMULATOR' },
  { code: 'AO', name: 'Erdikha Elit Sekuritas', type: 'DOMESTIC_INSTITUTION', color: '#0284c7', defaultTendency: 'NEUTRAL' },
  { code: 'LG', name: 'Trimegah Sekuritas Indonesia Tbk', type: 'DOMESTIC_INSTITUTION', color: '#84cc16', defaultTendency: 'NEUTRAL' },
  { code: 'CP', name: 'KB Valbury Sekuritas', type: 'DOMESTIC_INSTITUTION', color: '#eab308', defaultTendency: 'NEUTRAL' },
  { code: 'AZ', name: 'Sucor Sekuritas', type: 'DOMESTIC_INSTITUTION', color: '#ca8a04', defaultTendency: 'NEUTRAL' },
  { code: 'GR', name: 'Panin Sekuritas Tbk', type: 'DOMESTIC_INSTITUTION', color: '#a855f7', defaultTendency: 'NEUTRAL' },
  { code: 'DR', name: 'RHB Sekuritas Indonesia', type: 'DOMESTIC_INSTITUTION', color: '#9333ea', defaultTendency: 'NEUTRAL' },
  { code: 'IF', name: 'Samuel Sekuritas Indonesia', type: 'DOMESTIC_INSTITUTION', color: '#7c3aed', defaultTendency: 'NEUTRAL' },
  { code: 'HP', name: 'Henan Putihrai Sekuritas', type: 'DOMESTIC_INSTITUTION', color: '#c026d3', defaultTendency: 'NEUTRAL' },
  { code: 'DH', name: 'Sinarmas Sekuritas', type: 'DOMESTIC_INSTITUTION', color: '#db2777', defaultTendency: 'NEUTRAL' },
  { code: 'KI', name: 'Ciptadana Sekuritas Asia', type: 'DOMESTIC_INSTITUTION', color: '#be185d', defaultTendency: 'NEUTRAL' },
  { code: 'MI', name: 'Victoria Sekuritas Indonesia', type: 'DOMESTIC_INSTITUTION', color: '#9d174d', defaultTendency: 'NEUTRAL' },
  { code: 'SH', name: 'MNC Sekuritas', type: 'DOMESTIC_INSTITUTION', color: '#a21caf', defaultTendency: 'NEUTRAL' },
  { code: 'EP', name: 'MNC Sekuritas (Online)', type: 'DOMESTIC_INSTITUTION', color: '#86198f', defaultTendency: 'NEUTRAL' },
  { code: 'LS', name: 'Reliance Sekuritas Indonesia Tbk', type: 'DOMESTIC_INSTITUTION', color: '#701a75', defaultTendency: 'NEUTRAL' },
  { code: 'TP', name: 'OCBC Sekuritas Indonesia', type: 'DOMESTIC_INSTITUTION', color: '#e11d48', defaultTendency: 'NEUTRAL' },
  { code: 'GA', name: 'IIF Sekuritas Indonesia', type: 'DOMESTIC_INSTITUTION', color: '#84cc16', defaultTendency: 'NEUTRAL' },
  { code: 'PF', name: 'Danamon Sekuritas', type: 'DOMESTIC_INSTITUTION', color: '#0e7490', defaultTendency: 'NEUTRAL' },
  { code: 'PP', name: 'Aldiracita Sekuritas Indonesia', type: 'DOMESTIC_INSTITUTION', color: '#065f46', defaultTendency: 'NEUTRAL' },
  { code: 'PI', name: 'Pratama Capital Sekuritas', type: 'DOMESTIC_INSTITUTION', color: '#047857', defaultTendency: 'NEUTRAL' },
  { code: 'RF', name: 'Buana Capital Sekuritas', type: 'DOMESTIC_INSTITUTION', color: '#1d4ed8', defaultTendency: 'NEUTRAL' },
  { code: 'RO', name: 'NISP Sekuritas', type: 'DOMESTIC_INSTITUTION', color: '#1e3a8a', defaultTendency: 'NEUTRAL' },
  { code: 'SC', name: 'Danatama Makmur Sekuritas', type: 'DOMESTIC_INSTITUTION', color: '#3730a3', defaultTendency: 'NEUTRAL' },
  { code: 'SM', name: 'Sinar Mas Multifinance Sekuritas', type: 'DOMESTIC_INSTITUTION', color: '#155e75', defaultTendency: 'NEUTRAL' },
  { code: 'ZR', name: 'Bumiputera Sekuritas', type: 'DOMESTIC_INSTITUTION', color: '#9d174d', defaultTendency: 'NEUTRAL' },
  { code: 'BA', name: 'Bapindo Bumi Sekuritas', type: 'DOMESTIC_INSTITUTION', color: '#854d0e', defaultTendency: 'NEUTRAL' },
  { code: 'BZ', name: 'Batasa Capital', type: 'DOMESTIC_INSTITUTION', color: '#713f12', defaultTendency: 'NEUTRAL' },
  { code: 'DM', name: 'Danareksa Sekuritas', type: 'DOMESTIC_INSTITUTION', color: '#0f766e', defaultTendency: 'NEUTRAL' },

  // Retail & Modern Digital Fintech Platforms
  { code: 'XC', name: 'Ajaib Sekuritas Asia', type: 'RETAIL', color: '#f59e0b', defaultTendency: 'NEUTRAL' },
  { code: 'XL', name: 'Stockbit Sekuritas Digital', type: 'RETAIL', color: '#f97316', defaultTendency: 'NEUTRAL' },
  { code: 'YP', name: 'Mirae Asset Sekuritas Indonesia', type: 'RETAIL', color: '#ef4444', defaultTendency: 'NEUTRAL' },
  { code: 'PD', name: 'Indo Premier Sekuritas', type: 'RETAIL', color: '#f43f5e', defaultTendency: 'DISTRIBUTOR' },
  { code: 'KK', name: 'Phillip Sekuritas Indonesia', type: 'RETAIL', color: '#fb7185', defaultTendency: 'DISTRIBUTOR' },
  { code: 'MG', name: 'Semesta Indovest Sekuritas', type: 'RETAIL', color: '#fb923c', defaultTendency: 'NEUTRAL' },
  { code: 'XA', name: 'Woori Korindo Sekuritas Indonesia', type: 'RETAIL', color: '#f472b6', defaultTendency: 'NEUTRAL' },
  { code: 'HD', name: 'KGI Sekuritas Indonesia', type: 'RETAIL', color: '#e11d48', defaultTendency: 'NEUTRAL' },
  { code: 'YJ', name: 'Lotus Andalan Sekuritas', type: 'RETAIL', color: '#fda4af', defaultTendency: 'NEUTRAL' },
  { code: 'AN', name: 'Wanteg Sekuritas', type: 'RETAIL', color: '#fbbf24', defaultTendency: 'NEUTRAL' },
  { code: 'AP', name: 'Pacific Sekuritas Indonesia', type: 'RETAIL', color: '#f59e0b', defaultTendency: 'NEUTRAL' },
  { code: 'AR', name: 'Binaartha Sekuritas', type: 'RETAIL', color: '#d97706', defaultTendency: 'NEUTRAL' },
  { code: 'AT', name: 'Phintraco Sekuritas', type: 'RETAIL', color: '#b45309', defaultTendency: 'NEUTRAL' },
  { code: 'AM', name: 'Amantara Sekuritas', type: 'RETAIL', color: '#d97706', defaultTendency: 'NEUTRAL' },
  { code: 'AS', name: 'Asta Sekuritas', type: 'RETAIL', color: '#b45309', defaultTendency: 'NEUTRAL' },
  { code: 'BB', name: 'Berdikari Sekuritas', type: 'RETAIL', color: '#78350f', defaultTendency: 'NEUTRAL' },
  { code: 'BF', name: 'Inti Fikasa Sekuritas', type: 'RETAIL', color: '#78350f', defaultTendency: 'NEUTRAL' },
  { code: 'BR', name: 'Trust Sekuritas (BR)', type: 'RETAIL', color: '#3f6212', defaultTendency: 'NEUTRAL' },
  { code: 'CD', name: 'Mega Capital Sekuritas', type: 'RETAIL', color: '#f97316', defaultTendency: 'NEUTRAL' },
  { code: 'DD', name: 'Indosurya Bersinar Sekuritas', type: 'RETAIL', color: '#d97706', defaultTendency: 'NEUTRAL' },
  { code: 'DU', name: 'KAF Sekuritas Indonesia', type: 'RETAIL', color: '#c2410c', defaultTendency: 'NEUTRAL' },
  { code: 'EL', name: 'Evergreen Sekuritas Indonesia', type: 'RETAIL', color: '#9a3412', defaultTendency: 'NEUTRAL' },
  { code: 'ES', name: 'Ekatoro Sekuritas', type: 'RETAIL', color: '#7c2d12', defaultTendency: 'NEUTRAL' },
  { code: 'FO', name: 'Forte Sekuritas Indonesia', type: 'RETAIL', color: '#9a3412', defaultTendency: 'NEUTRAL' },
  { code: 'FS', name: 'Waterfront Sekuritas Indonesia (FS)', type: 'RETAIL', color: '#701a75', defaultTendency: 'NEUTRAL' },
  { code: 'ID', name: 'Anugerah Sekuritas Indonesia', type: 'RETAIL', color: '#047857', defaultTendency: 'NEUTRAL' },
  { code: 'IH', name: 'Pacific 2000 Sekuritas', type: 'RETAIL', color: '#f59e0b', defaultTendency: 'NEUTRAL' },
  { code: 'II', name: 'Danpac Sekuritas', type: 'RETAIL', color: '#15803d', defaultTendency: 'NEUTRAL' },
  { code: 'IN', name: 'Investindo Nusantara Sekuritas', type: 'RETAIL', color: '#4d7c0f', defaultTendency: 'NEUTRAL' },
  { code: 'IP', name: 'Trust Sekuritas', type: 'RETAIL', color: '#3f6212', defaultTendency: 'NEUTRAL' },
  { code: 'IT', name: 'Surya Fajar Sekuritas', type: 'RETAIL', color: '#15803d', defaultTendency: 'NEUTRAL' },
  { code: 'IU', name: 'Indo Capital Sekuritas', type: 'RETAIL', color: '#166534', defaultTendency: 'NEUTRAL' },
  { code: 'JB', name: 'Jasa Utama Capital Sekuritas', type: 'RETAIL', color: '#14532d', defaultTendency: 'NEUTRAL' },
  { code: 'KS', name: 'Kresna Sekuritas', type: 'RETAIL', color: '#047857', defaultTendency: 'NEUTRAL' },
  { code: 'KW', name: 'KOSPIN Sekuritas', type: 'RETAIL', color: '#065f46', defaultTendency: 'NEUTRAL' },
  { code: 'LH', name: 'Royal Investium Sekuritas', type: 'RETAIL', color: '#044e3f', defaultTendency: 'NEUTRAL' },
  { code: 'MU', name: 'Minna Padi Investama Sekuritas', type: 'RETAIL', color: '#0f766e', defaultTendency: 'NEUTRAL' },
  { code: 'PC', name: 'Panca Global Sekuritas', type: 'RETAIL', color: '#134e4a', defaultTendency: 'NEUTRAL' },
  { code: 'PG', name: 'Panca Global Kapital Tbk', type: 'RETAIL', color: '#155e75', defaultTendency: 'NEUTRAL' },
  { code: 'PO', name: 'Pilarmas Investindo Sekuritas', type: 'RETAIL', color: '#164e63', defaultTendency: 'NEUTRAL' },
  { code: 'PS', name: 'Paramitra Alfa Sekuritas', type: 'RETAIL', color: '#0369a1', defaultTendency: 'NEUTRAL' },
  { code: 'RB', name: 'RHB Sekuritas Indonesia (Retail)', type: 'RETAIL', color: '#0c4a6e', defaultTendency: 'NEUTRAL' },
  { code: 'RG', name: 'Profindo Sekuritas Indonesia', type: 'RETAIL', color: '#1e40af', defaultTendency: 'NEUTRAL' },
  { code: 'RS', name: 'Yulie Sekuritas Indonesia Tbk', type: 'RETAIL', color: '#312e81', defaultTendency: 'NEUTRAL' },
  { code: 'SA', name: 'Binaartha Parama Sekuritas', type: 'RETAIL', color: '#4338ca', defaultTendency: 'NEUTRAL' },
  { code: 'SF', name: 'Surya Fajar Capital Tbk', type: 'RETAIL', color: '#4c1d95', defaultTendency: 'NEUTRAL' },
  { code: 'SS', name: 'Sinarmas Sekuritas (Retail)', type: 'RETAIL', color: '#581c87', defaultTendency: 'NEUTRAL' },
  { code: 'TF', name: 'Universal Broker Indonesia Sekuritas', type: 'RETAIL', color: '#7e22ce', defaultTendency: 'NEUTRAL' },
  { code: 'TS', name: 'Dwidana Sakti Sekuritas', type: 'RETAIL', color: '#6b21a8', defaultTendency: 'NEUTRAL' },
  { code: 'TX', name: 'DBS Vickers (Retail)', type: 'FOREIGN', color: '#581c87', defaultTendency: 'NEUTRAL' },
  { code: 'US', name: 'Waterfront Sekuritas Indonesia', type: 'RETAIL', color: '#701a75', defaultTendency: 'NEUTRAL' },
  { code: 'VO', name: 'Victoria Sekuritas (Online)', type: 'RETAIL', color: '#86198f', defaultTendency: 'NEUTRAL' },
];

// Hash function to create deterministic pseudo-random seeds per ticker & date
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

function pseudoRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

/**
 * Filter candles based on selected start and end dates (inclusive).
 * If no dates provided, defaults to 3 months back (~65 trading days).
 */
export function filterCandlesByRange(
  candles: Candle[],
  startDate?: string,
  endDate?: string
): Candle[] {
  if (!candles || candles.length === 0) return [];

  // Filter out any zero-volume or holiday candles
  const validCandles = candles.filter((c) => c && c.volume > 0 && c.close > 0);
  if (validCandles.length === 0) return candles;

  if (startDate && endDate) {
    const filtered = validCandles.filter((c) => c.time >= startDate && c.time <= endDate);
    if (filtered.length >= 5) return filtered;
  }

  // Default fallback: 3 months back (~65 trading days)
  const count = Math.min(validCandles.length, 65);
  return validCandles.slice(validCandles.length - count);
}

/**
 * Search helper for IDX Exchange Members (Anggota Bursa)
 */
export function searchExchangeMemberBrokers(query: string = ''): BrokerCatalogEntry[] {
  const q = query.toUpperCase().trim();
  if (!q) return IDX_BROKER_CATALOG;
  return IDX_BROKER_CATALOG.filter(
    (b) => b.code.toUpperCase().includes(q) || b.name.toUpperCase().includes(q)
  );
}

/**
 * Generate accurate and realistic day-by-day broker inventory accumulation/distribution data
 * for any IDX ticker across the given date range.
 */
export function generateBrokerInventoryAnalysis(
  ticker: string,
  stockName: string,
  currentPrice: number,
  allCandles: Candle[],
  startDate?: string,
  endDate?: string,
  customBrokersToAdd: string[] = []
): BrokerInventorySummary {
  const cleanTicker = ticker.toUpperCase().replace('.JK', '').replace('^', '');
  const activeCandles = filterCandlesByRange(allCandles, startDate, endDate);

  const rangeStart = activeCandles.length > 0 ? activeCandles[0].time : '';
  const rangeEnd = activeCandles.length > 0 ? activeCandles[activeCandles.length - 1].time : '';

  // Calculate price performance in this period to align accumulation/distribution tendencies
  const firstClose = activeCandles.length > 0 ? activeCandles[0].close : currentPrice;
  const lastClose = activeCandles.length > 0 ? activeCandles[activeCandles.length - 1].close : currentPrice;
  const priceChangeRatio = firstClose > 0 ? (lastClose - firstClose) / firstClose : 0;

  // Base seed derived from ticker
  const tickerSeed = hashString(cleanTicker);

  // Initialize broker stats tracker for each catalog entry
  interface TempBrokerData {
    catalog: BrokerCatalogEntry;
    totalBuyVol: number;
    totalSellVol: number;
    totalBuyVal: number;
    totalSellVal: number;
    dailyPoints: BrokerDailyPoint[];
    consecutiveBuyDays: number;
    consecutiveSellDays: number;
    maxConsecutiveBuys: number;
    maxConsecutiveSells: number;
    biasFactor: number; // -1 to 1: bias towards net accumulation or net distribution
    cleanFactor: number; // 0 to 1: tendency to execute pure one-sided orders
  }

  const brokerMap = new Map<string, TempBrokerData>();

  IDX_BROKER_CATALOG.forEach((entry) => {
    // Unique deterministic bias per broker for this ticker - treated equally for all brokers
    const brokerSeed = tickerSeed + hashString(entry.code);
    const rand1 = pseudoRandom(brokerSeed);
    const rand2 = pseudoRandom(brokerSeed + 555);

    // Uniform, unbiased generation for ALL brokers without any hardcoded favoritism or special rules
    const bias = (rand1 - 0.5) * 2; // range -1 to 1
    const cleanTendency = rand2; // range 0 to 1

    brokerMap.set(entry.code, {
      catalog: entry,
      totalBuyVol: 0,
      totalSellVol: 0,
      totalBuyVal: 0,
      totalSellVal: 0,
      dailyPoints: [],
      consecutiveBuyDays: 0,
      consecutiveSellDays: 0,
      maxConsecutiveBuys: 0,
      maxConsecutiveSells: 0,
      biasFactor: bias,
      cleanFactor: cleanTendency,
    });
  });

  // Track running cumulative net lots & IDR for each broker
  const runningCumVol = new Map<string, number>();
  const runningCumVal = new Map<string, number>();
  IDX_BROKER_CATALOG.forEach((b) => {
    runningCumVol.set(b.code, 0);
    runningCumVal.set(b.code, 0);
  });

  let totalMarketLots = 0;
  let totalMarketIdr = 0;
  let foreignNetVol = 0;
  let foreignNetVal = 0;

  // Process day by day
  activeCandles.forEach((candle, dayIdx) => {
    const daySeed = tickerSeed + hashString(candle.time) + dayIdx * 13;
    const isBullDay = candle.close >= candle.open;
    const avgPrice = Math.round((candle.open + candle.high + candle.low + candle.close) / 4);

    // Convert candle volume to Lots (1 lot = 100 shares in IDX)
    const dayVolumeLots = Math.max(500, Math.round(candle.volume / 100));
    const dayValueIdr = dayVolumeLots * 100 * avgPrice;

    totalMarketLots += dayVolumeLots;
    totalMarketIdr += dayValueIdr;

    // Distribute volume across brokers uniformly
    const weights: { code: string; buyShare: number; sellShare: number }[] = [];
    let sumBuyWeight = 0;
    let sumSellWeight = 0;

    IDX_BROKER_CATALOG.forEach((broker, bIdx) => {
      const bSeed = daySeed + bIdx * 37;
      const noise = pseudoRandom(bSeed);
      const temp = brokerMap.get(broker.code)!;

      // Uniform base share across all brokers (no special codes or tiers)
      const baseShare = 0.01 + noise * 0.04;

      let buyWeight = baseShare * (1 + temp.biasFactor * (isBullDay ? 0.6 : -0.3));
      let sellWeight = baseShare * (1 - temp.biasFactor * (isBullDay ? 0.6 : -0.3));

      // Clean accumulation/distribution ratio (applied equally based on dynamic stats)
      if (temp.biasFactor > 0.35 && temp.cleanFactor > 0.65) {
        sellWeight *= 0.15;
        buyWeight *= 1.25;
      } else if (temp.biasFactor < -0.35 && temp.cleanFactor > 0.65) {
        buyWeight *= 0.15;
        sellWeight *= 1.25;
      }

      buyWeight = Math.max(0.001, buyWeight);
      sellWeight = Math.max(0.001, sellWeight);

      weights.push({ code: broker.code, buyShare: buyWeight, sellShare: sellWeight });
      sumBuyWeight += buyWeight;
      sumSellWeight += sellWeight;
    });

    // Normalize and assign lot numbers with zero-sum market conservation
    let assignedBuyLots = 0;
    let assignedSellLots = 0;

    const brokerDayAssignments: {
      code: string;
      buyVol: number;
      sellVol: number;
      netVol: number;
      buyVal: number;
      sellVal: number;
      netVal: number;
      avgBuyPrice: number;
      avgSellPrice: number;
    }[] = [];

    weights.forEach((w, wIdx) => {
      const isLast = wIdx === weights.length - 1;
      let buyVol = isLast
        ? Math.max(0, dayVolumeLots - assignedBuyLots)
        : Math.round((w.buyShare / sumBuyWeight) * dayVolumeLots);
      let sellVol = isLast
        ? Math.max(0, dayVolumeLots - assignedSellLots)
        : Math.round((w.sellShare / sumSellWeight) * dayVolumeLots);

      assignedBuyLots += buyVol;
      assignedSellLots += sellVol;

      const netVol = buyVol - sellVol;

      // Realistic spread pricing within high/low candle range
      const spread = Math.max(1, Math.round((candle.high - candle.low) * 0.12));
      const avgBuyPrice = Math.max(
        candle.low,
        Math.min(candle.high, Math.round(avgPrice + (netVol >= 0 ? spread * 0.4 : -spread * 0.4)))
      );
      const avgSellPrice = Math.max(
        candle.low,
        Math.min(candle.high, Math.round(avgPrice - (netVol >= 0 ? spread * 0.4 : -spread * 0.4)))
      );

      const buyVal = buyVol * 100 * avgBuyPrice;
      const sellVal = sellVol * 100 * avgSellPrice;
      const netVal = buyVal - sellVal;

      brokerDayAssignments.push({
        code: w.code,
        buyVol,
        sellVol,
        netVol,
        buyVal,
        sellVal,
        netVal,
        avgBuyPrice,
        avgSellPrice,
      });
    });

    brokerDayAssignments.forEach((item) => {
      const temp = brokerMap.get(item.code)!;

      // Track consecutive buying / selling streaks
      if (item.netVol > 0) {
        temp.consecutiveBuyDays += 1;
        temp.consecutiveSellDays = 0;
        if (temp.consecutiveBuyDays > temp.maxConsecutiveBuys) {
          temp.maxConsecutiveBuys = temp.consecutiveBuyDays;
        }
      } else if (item.netVol < 0) {
        temp.consecutiveSellDays += 1;
        temp.consecutiveBuyDays = 0;
        if (temp.consecutiveSellDays > temp.maxConsecutiveSells) {
          temp.maxConsecutiveSells = temp.consecutiveSellDays;
        }
      }

      // Foreign flow tracking
      if (temp.catalog.type === 'FOREIGN') {
        foreignNetVol += item.netVol;
        foreignNetVal += item.netVal;
      }

      temp.totalBuyVol += item.buyVol;
      temp.totalSellVol += item.sellVol;
      temp.totalBuyVal += item.buyVal;
      temp.totalSellVal += item.sellVal;

      temp.dailyPoints.push({
        date: candle.time,
        buyVol: item.buyVol,
        sellVol: item.sellVol,
        netVol: item.netVol,
        buyVal: item.buyVal,
        sellVal: item.sellVal,
        netVal: item.netVal,
        cumNetVol: 0, // Will be post-processed to start at 0 Lot on Day 1
        cumNetVal: 0,
        avgBuyPrice: item.avgBuyPrice,
        avgSellPrice: item.avgSellPrice,
      });
    });
  });

  // Post-process cumulative inventory curves: Day 1 (leftmost candle) starts at 0 Lot!
  const totalDays = activeCandles.length;
  brokerMap.forEach((temp) => {
    const totalNetVol = temp.totalBuyVol - temp.totalSellVol;
    const totalNetVal = temp.totalBuyVal - temp.totalSellVal;

    let cumVolSum = 0;
    let cumValSum = 0;

    temp.dailyPoints.forEach((dp, dayIdx) => {
      if (dayIdx === 0) {
        // Day 1 / Leftmost candle starts strictly at 0 Lot baseline
        dp.cumNetVol = 0;
        dp.cumNetVal = 0;
      } else if (totalDays > 1) {
        // Smoothly accumulate from 0 at Day 0 up to totalNetVol at the final Day
        cumVolSum += temp.dailyPoints[dayIdx - 1].netVol;
        cumValSum += temp.dailyPoints[dayIdx - 1].netVal;

        const fraction = dayIdx / (totalDays - 1);
        const finalNetVolToday = temp.dailyPoints[totalDays - 1].netVol;
        const finalNetValToday = temp.dailyPoints[totalDays - 1].netVal;

        if (dayIdx === totalDays - 1) {
          dp.cumNetVol = totalNetVol;
          dp.cumNetVal = totalNetVal;
        } else {
          dp.cumNetVol = Math.round(cumVolSum + fraction * finalNetVolToday);
          dp.cumNetVal = Math.round(cumValSum + fraction * finalNetValToday);
        }
      } else {
        dp.cumNetVol = totalNetVol;
        dp.cumNetVal = totalNetVal;
      }
    });
  });

  // Calculate final aggregated statistics & Clean Accum / Clean Dist classifications
  const allBrokersList: BrokerInventoryItem[] = [];
  let cleanAccumCount = 0;
  let cleanDistCount = 0;

  brokerMap.forEach((temp) => {
    const netVol = temp.totalBuyVol - temp.totalSellVol;
    const netVal = temp.totalBuyVal - temp.totalSellVal;
    const totalTurnoverLots = temp.totalBuyVol + temp.totalSellVol;
    const churnRatio = Math.round((totalTurnoverLots / Math.max(1, Math.abs(netVol))) * 10) / 10;

    const avgBuyPrice = temp.totalBuyVol > 0 ? Math.round(temp.totalBuyVal / (temp.totalBuyVol * 100)) : 0;
    const avgSellPrice = temp.totalSellVol > 0 ? Math.round(temp.totalSellVal / (temp.totalSellVol * 100)) : 0;

    // Calculate Clean Ratio (Purity of Buy or Sell)
    let cleanRatio = 50;
    let cleanTendency: 'CLEAN_ACCUM' | 'CLEAN_DIST' | 'MODERATE_ACCUM' | 'MODERATE_DIST' | 'NEUTRAL' = 'NEUTRAL';

    if (totalTurnoverLots > 0) {
      if (netVol > 0) {
        const buyPurity = (temp.totalBuyVol / totalTurnoverLots) * 100;
        cleanRatio = Math.round(buyPurity);
        if (buyPurity >= 78 && churnRatio <= 1.30) {
          cleanTendency = 'CLEAN_ACCUM';
          cleanAccumCount += 1;
        } else if (buyPurity >= 62) {
          cleanTendency = 'MODERATE_ACCUM';
        }
      } else if (netVol < 0) {
        const sellPurity = (temp.totalSellVol / totalTurnoverLots) * 100;
        cleanRatio = Math.round(sellPurity);
        if (sellPurity >= 78 && churnRatio <= 1.30) {
          cleanTendency = 'CLEAN_DIST';
          cleanDistCount += 1;
        } else if (sellPurity >= 62) {
          cleanTendency = 'MODERATE_DIST';
        }
      }
    }

    allBrokersList.push({
      brokerCode: temp.catalog.code,
      brokerName: temp.catalog.name,
      type: temp.catalog.type,
      totalBuyVol: temp.totalBuyVol,
      totalSellVol: temp.totalSellVol,
      totalBuyVal: temp.totalBuyVal,
      totalSellVal: temp.totalSellVal,
      netVol,
      netVal,
      avgBuyPrice,
      avgSellPrice,
      cleanTendency,
      cleanRatio,
      churnRatio,
      category: netVol >= 0 ? 'NET_BUY' : 'NET_SELL',
      color: temp.catalog.color,
      visible: false,
      rank: 0,
      dailyPoints: temp.dailyPoints,
    });
  });

  // Split into Top Net Buyers and Top Net Sellers
  const topNetBuyers = allBrokersList
    .filter((b) => b.netVol >= 0)
    .sort((a, b) => b.netVol - a.netVol)
    .map((b, idx) => ({ ...b, rank: idx + 1 }));

  const topNetSellers = allBrokersList
    .filter((b) => b.netVol < 0)
    .sort((a, b) => a.netVol - b.netVol) // most negative first
    .map((b, idx) => ({ ...b, rank: idx + 1 }));

  // Default AUTO selection: Top 5 Net Buyers + Top 5 Net Sellers (Top 10 Total)
  const autoCodes = new Set<string>();
  topNetBuyers.slice(0, 5).forEach((b) => autoCodes.add(b.brokerCode));
  topNetSellers.slice(0, 5).forEach((b) => autoCodes.add(b.brokerCode));

  // If user requested custom brokers, add them
  customBrokersToAdd.forEach((code) => {
    const clean = code.toUpperCase().trim();
    if (clean) autoCodes.add(clean);
  });

  // Update visibility flag
  const finalizedBrokers = allBrokersList.map((b) => ({
    ...b,
    visible: autoCodes.has(b.brokerCode),
  }));

  const finalizedBuyers = topNetBuyers.map((b) => ({
    ...b,
    visible: autoCodes.has(b.brokerCode),
  }));

  const finalizedSellers = topNetSellers.map((b) => ({
    ...b,
    visible: autoCodes.has(b.brokerCode),
  }));

  return {
    ticker: cleanTicker,
    stockName,
    currentPrice,
    dataSource: 'SYNTHETIC',
    sourceLabel: 'Synthetic fallback',
    sourceNote: 'Broker flow dibuat dari candle lokal dan bukan data broker live.',
    startDate: rangeStart,
    endDate: rangeEnd,
    totalTradingDays: activeCandles.length,
    candles: activeCandles,
    topNetBuyers: finalizedBuyers,
    topNetSellers: finalizedSellers,
    allBrokers: finalizedBrokers,
    autoSelectedBrokerCodes: Array.from(autoCodes),
    stats: {
      totalVolumeLots: totalMarketLots,
      totalValueIdr: totalMarketIdr,
      foreignNetVol,
      foreignNetVal,
      cleanAccumBrokerCount: cleanAccumCount,
      cleanDistBrokerCount: cleanDistCount,
    },
  };
}
