import { Candle, StockData } from "../types";
import {
  calculateMA,
  calculateVolumeMA,
  calculateVWAP,
  detectSwings,
  detectFVGs,
  detectPriceGaps,
  detectOrderBlocks,
  detectLiquiditySweeps,
  detectSupportResistance,
  generateRecommendation,
} from "../utils/smcEngine";

// Seeded pseudo random generator for reproducible chart candles
function seededRandom(seed: number) {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

export function formatJakartaDate(dateOrTimestamp: Date | number): string {
  const date = typeof dateOrTimestamp === 'number' ? new Date(dateOrTimestamp * 1000) : dateOrTimestamp;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(date);
}

export function getLatestClosedTradingDateStr(now: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  let year = 2026, month = 1, day = 1, weekday = 'Mon', hour = 0, minute = 0;
  for (const p of parts) {
    if (p.type === 'year') year = parseInt(p.value, 10);
    if (p.type === 'month') month = parseInt(p.value, 10);
    if (p.type === 'day') day = parseInt(p.value, 10);
    if (p.type === 'weekday') weekday = p.value;
    if (p.type === 'hour') hour = parseInt(p.value, 10);
    if (p.type === 'minute') minute = parseInt(p.value, 10);
  }

  let daysToSubtract = 0;
  if (weekday === 'Sun') {
    daysToSubtract = 2; // Friday
  } else if (weekday === 'Sat') {
    daysToSubtract = 1; // Friday
  } else {
    // Weekdays (Mon-Fri) -> today is the active trading day!
    daysToSubtract = 0;
  }

  const targetDate = new Date(Date.UTC(year, month - 1, day));
  targetDate.setUTCDate(targetDate.getUTCDate() - daysToSubtract);
  const y = targetDate.getUTCFullYear();
  const m = String(targetDate.getUTCMonth() + 1).padStart(2, '0');
  const d = String(targetDate.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getTradingDayDates(count: number, latestDateStr: string): string[] {
  const [y, m, d] = latestDateStr.split('-').map(Number);
  const cur = new Date(Date.UTC(y, m - 1, d));
  const dates: string[] = [];

  while (dates.length < count) {
    const dayOfWeek = cur.getUTCDay(); // 0 = Sun, 6 = Sat
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      const cy = cur.getUTCFullYear();
      const cm = String(cur.getUTCMonth() + 1).padStart(2, '0');
      const cd = String(cur.getUTCDate()).padStart(2, '0');
      dates.push(`${cy}-${cm}-${cd}`);
    }
    cur.setUTCDate(cur.getUTCDate() - 1);
  }

  return dates.reverse();
}

/**
 * Generates realistic candle data for IDX stocks
 */
export function generateCandles(
  basePrice: number,
  volatility: number = 0.025,
  trendBias: number = 0.001,
  days: number = 100
): Candle[] {
  const candles: Candle[] = [];
  let currentPrice = basePrice;
  const latestDateStr = getLatestClosedTradingDateStr();
  const tradingDates = getTradingDayDates(days, latestDateStr);

  for (let i = 0; i < tradingDates.length; i++) {
    const dateStr = tradingDates[i];

    let cycle = Math.sin(i / 8) * (volatility * 1.5);
    if (i > 70 && i < 85) cycle -= volatility * 1.2;
    if (i >= 85) cycle += volatility * 2.0;

    const rand1 = seededRandom(i * 10 + 1) - 0.48;
    const changePercent = rand1 * volatility + trendBias + cycle;

    const open = Math.round(currentPrice);
    let close = Math.round(currentPrice * (1 + changePercent));

    if (open === close) close = open + (rand1 > 0 ? 5 : -5);

    const high = Math.round(Math.max(open, close) + Math.abs(seededRandom(i * 10 + 2)) * open * volatility * 1.2);
    const low = Math.round(Math.min(open, close) - Math.abs(seededRandom(i * 10 + 3)) * open * volatility * 1.2);

    let baseVolume = 15000000 + Math.floor(seededRandom(i * 10 + 4) * 20000000);
    if (i > 80 && i < 90) baseVolume *= 2.8;

    candles.push({
      time: dateStr,
      open: Math.max(50, open),
      high: Math.max(50, high),
      low: Math.max(50, low),
      close: Math.max(50, close),
      volume: Math.max(1000, baseVolume),
    });

    currentPrice = Math.max(50, close);
  }

  return candles;
}

export function buildStockData(
  symbol: string,
  ticker: string,
  name: string,
  sector: string,
  candles: Candle[],
  conglomerate?: string,
  isRealData?: boolean
): StockData {
  const currentPrice = candles[candles.length - 1]?.close || 100;
  const previousClose = candles.length > 1 ? candles[candles.length - 2]?.close || currentPrice : currentPrice;
  const change24h = currentPrice - previousClose;
  const changePercent24h = previousClose > 0 ? (change24h / previousClose) * 100 : 0;

  const ma5 = calculateMA(candles, 5);
  const ma10 = calculateMA(candles, 10);
  const ma20 = calculateMA(candles, 20);
  const ma60 = calculateMA(candles, 60);
  const ma200 = calculateMA(candles, 200);
  const volumeMa20 = calculateVolumeMA(candles, 20);
  const vwap = calculateVWAP(candles);

  const isIhsg = symbol.includes('JKSE') || ticker === 'IHSG';
  const swings = detectSwings(candles);
  const fvgs = detectFVGs(candles, isIhsg);
  const priceGaps = detectPriceGaps(candles);
  const orderBlocks = detectOrderBlocks(candles, swings, fvgs, volumeMa20);
  const liquiditySweeps = detectLiquiditySweeps(candles, swings);
  const supportResistance = detectSupportResistance(candles);

  const recommendation = generateRecommendation(
    symbol,
    name,
    candles,
    swings,
    fvgs,
    orderBlocks,
    supportResistance,
    volumeMa20,
    priceGaps
  );

  return {
    symbol,
    ticker,
    name,
    sector,
    conglomerate,
    candles,
    swings,
    fvgs,
    orderBlocks,
    priceGaps,
    liquiditySweeps,
    supportResistance,
    indicators: {
      ma5,
      ma10,
      ma20,
      ma60,
      ma200,
      vwap,
      volumeMa20,
    },
    recommendation,
    currentPrice,
    change24h,
    changePercent24h,
    isRealData,
  };
}

export interface StockRawConfig {
  t: string; // ticker
  n: string; // name
  s: string; // sector
  p: number; // base price
  cg?: string; // conglomerate group
}

// Complete database of top BEI / IDX stocks including all major Conglomerates & Blue Chips
export const liquidIDXStocks: StockRawConfig[] = [
  // --- 1. MARKET INDEX ---
  { t: "IHSG", n: "Indeks Harga Saham Gabungan (IHSG)", s: "Market Index", p: 7350, cg: "Bursa Efek Indonesia" },

  // --- 2. PRAJOGO PANGESTU (BARITO PACIFIC GROUP) ---
  { t: "CDIA", n: "PT Chandra Daya Investama Tbk.", s: "Basic Materials", p: 1850, cg: "Prajogo Pangestu" },
  { t: "CUAN", n: "PT Petrindo Jaya Kreasi Tbk.", s: "Energy", p: 7600, cg: "Prajogo Pangestu" },
  { t: "BREN", n: "PT Barito Renewables Energy Tbk.", s: "Energy", p: 7250, cg: "Prajogo Pangestu" },
  { t: "PTRO", n: "PT Petrosea Tbk.", s: "Energy", p: 14500, cg: "Prajogo Pangestu" },
  { t: "TPIA", n: "PT Chandra Asri Pacific Tbk.", s: "Basic Materials", p: 8800, cg: "Prajogo Pangestu" },
  { t: "SINI", n: "PT Singaraja Putra Tbk.", s: "Energy", p: 1250, cg: "Prajogo Pangestu" },
  { t: "BRPT", n: "PT Barito Pacific Tbk.", s: "Basic Materials", p: 1120, cg: "Prajogo Pangestu" },

  // --- 3. GRUP BAKRIE ---
  { t: "ALII", n: "PT Anugerah Logistik Indonesia Tbk.", s: "Industrials", p: 450, cg: "Grup Bakrie" },
  { t: "BNBR", n: "PT Bakrie & Brothers Tbk.", s: "Industrials", p: 60, cg: "Grup Bakrie" },
  { t: "KOTA", n: "PT DMS Propertindo Tbk.", s: "Properties", p: 50, cg: "Grup Bakrie" },
  { t: "MDIA", n: "PT Intermedia Capital Tbk.", s: "Telecommunication", p: 50, cg: "Grup Bakrie" },
  { t: "BRMS", n: "PT Bumi Resources Minerals Tbk.", s: "Basic Materials", p: 340, cg: "Grup Bakrie" },
  { t: "BUMI", n: "PT Bumi Resources Tbk.", s: "Energy", p: 140, cg: "Grup Bakrie" },
  { t: "DEWA", n: "PT Darma Henwa Tbk.", s: "Energy", p: 92, cg: "Grup Bakrie" },
  { t: "ENRG", n: "PT Energi Mega Persada Tbk.", s: "Energy", p: 230, cg: "Grup Bakrie" },
  { t: "VKTR", n: "PT VKTR Teknologi Mobilitas Tbk.", s: "Industrials", p: 145, cg: "Grup Bakrie" },
  { t: "JGLE", n: "PT Graha Andrasentra Propertindo Tbk.", s: "Properties", p: 50, cg: "Grup Bakrie" },
  { t: "OASA", n: "PT Maharaksa Biru Energi Tbk.", s: "Energy", p: 140, cg: "Grup Bakrie" },
  { t: "BIPI", n: "PT Astrindo Nusantara Infrastruktur Tbk.", s: "Energy", p: 68, cg: "Grup Bakrie" },
  { t: "UNSP", n: "PT Bakrie Sumatera Plantations Tbk.", s: "Consumer Staples", p: 110, cg: "Grup Bakrie" },
  { t: "VIVA", n: "PT Visi Media Asia Tbk.", s: "Telecommunication", p: 50, cg: "Grup Bakrie" },

  // --- 4. BOY THOHIR (GARIBALDI THOHIR) ---
  { t: "MBMA", n: "PT Merdeka Battery Materials Tbk.", s: "Basic Materials", p: 580, cg: "Boy Thohir" },
  { t: "ESSA", n: "PT ESSA Industries Indonesia Tbk.", s: "Basic Materials", p: 840, cg: "Boy Thohir" },
  { t: "MDKA", n: "PT Merdeka Copper Gold Tbk.", s: "Basic Materials", p: 2450, cg: "Boy Thohir" },
  { t: "AADI", n: "PT Adaro Andalan Indonesia Tbk.", s: "Energy", p: 5850, cg: "Boy Thohir" },
  { t: "ADMR", n: "PT Adaro Minerals Indonesia Tbk.", s: "Energy", p: 1420, cg: "Boy Thohir" },
  { t: "ADRO", n: "PT Adaro Energy Indonesia Tbk.", s: "Energy", p: 3650, cg: "Boy Thohir" },
  { t: "EMAS", n: "PT Wilton Makmur Indonesia Tbk.", s: "Basic Materials", p: 125, cg: "Boy Thohir" },

  // --- 5. AGUAN (AGUNG SEDAYU & ARTHA GRAHA) ---
  { t: "CBDK", n: "PT Cipta Bangun Dimensi Kreasi Tbk.", s: "Properties", p: 250, cg: "Agung Sedayu (Aguan)" },
  { t: "ECII", n: "PT Electronic City Indonesia Tbk.", s: "Consumer Cyclical", p: 280, cg: "Agung Sedayu (Aguan)" },
  { t: "ERAA", n: "PT Erajaya Swasembada Tbk.", s: "Consumer Cyclical", p: 430, cg: "Agung Sedayu (Aguan)" },
  { t: "ERAL", n: "PT Sinar Eka Selaras Tbk.", s: "Consumer Cyclical", p: 280, cg: "Agung Sedayu (Aguan)" },
  { t: "INPC", n: "PT Bank Artha Graha Internasional Tbk.", s: "Financials", p: 120, cg: "Agung Sedayu (Aguan)" },
  { t: "JIHD", n: "PT Jakarta International Hotels & Dev Tbk.", s: "Properties", p: 480, cg: "Agung Sedayu (Aguan)" },
  { t: "PANI", n: "PT Pantai Indah Kapuk Dua Tbk.", s: "Properties", p: 12800, cg: "Agung Sedayu (Aguan)" },

  // --- 6. HAPPY HAPSORO ---
  { t: "ARCI", n: "PT Archi Indonesia Tbk.", s: "Basic Materials", p: 310, cg: "Happy Hapsoro" },
  { t: "BUVA", n: "PT Bukit Uluwatu Villa Tbk.", s: "Consumer Cyclical", p: 70, cg: "Happy Hapsoro" },
  { t: "CBRE", n: "PT Cakra Buana Resources Energi Tbk.", s: "Energy", p: 75, cg: "Happy Hapsoro" },
  { t: "MINA", n: "PT Sanurhasta Mitra Tbk.", s: "Consumer Cyclical", p: 50, cg: "Happy Hapsoro" },
  { t: "PADI", n: "PT Minna Padi Investama Sekuritas Tbk.", s: "Financials", p: 50, cg: "Happy Hapsoro" },
  { t: "PSKT", n: "PT Red Planet Indonesia Tbk.", s: "Consumer Cyclical", p: 65, cg: "Happy Hapsoro" },
  { t: "RAJA", n: "PT Rukun Raharja Tbk.", s: "Energy", p: 1420, cg: "Happy Hapsoro" },
  { t: "RATU", n: "PT Ratu Prabu Energy Tbk.", s: "Energy", p: 95, cg: "Happy Hapsoro" },
  { t: "UANG", n: "PT Pakuan Tbk.", s: "Properties", p: 680, cg: "Happy Hapsoro" },
  { t: "PSAB", n: "PT J Resources Asia Pasifik Tbk.", s: "Basic Materials", p: 290, cg: "Happy Hapsoro" },
  { t: "FORU", n: "PT Fortune Indonesia Tbk.", s: "Consumer Cyclical", p: 1350, cg: "Happy Hapsoro" },

  // --- 7. PERBANKAN ---
  { t: "AGRO", n: "PT Bank Raya Indonesia Tbk.", s: "Financials", p: 260, cg: "Sektor Perbankan" },
  { t: "ARTO", n: "PT Bank Jago Tbk.", s: "Financials", p: 2850, cg: "Sektor Perbankan" },
  { t: "BBYB", n: "PT Bank Neo Commerce Tbk.", s: "Financials", p: 270, cg: "Sektor Perbankan" },
  { t: "BGTG", n: "PT Bank Ganesha Tbk.", s: "Financials", p: 85, cg: "Sektor Perbankan" },
  { t: "BMRI", n: "PT Bank Mandiri (Persero) Tbk.", s: "Financials", p: 6900, cg: "Sektor Perbankan" },
  { t: "BBCA", n: "PT Bank Central Asia Tbk.", s: "Financials", p: 10150, cg: "Sektor Perbankan" },
  { t: "BBNI", n: "PT Bank Negara Indonesia (Persero) Tbk.", s: "Financials", p: 5400, cg: "Sektor Perbankan" },
  { t: "BBTN", n: "PT Bank Tabungan Negara (Persero) Tbk.", s: "Financials", p: 1380, cg: "Sektor Perbankan" },
  { t: "BBRI", n: "PT Bank Rakyat Indonesia (Persero) Tbk.", s: "Financials", p: 4850, cg: "Sektor Perbankan" },
  { t: "BRIS", n: "PT Bank Syariah Indonesia Tbk.", s: "Financials", p: 2920, cg: "Sektor Perbankan" },
  { t: "BBHI", n: "PT Allo Bank Indonesia Tbk.", s: "Financials", p: 1180, cg: "Sektor Perbankan" },
  { t: "NOBU", n: "PT Bank Nationalnobu Tbk.", s: "Financials", p: 580, cg: "Sektor Perbankan" },
  { t: "PNBN", n: "PT Bank Pan Indonesia Tbk.", s: "Financials", p: 1250, cg: "Sektor Perbankan" },
  { t: "PNLF", n: "PT Panin Financial Tbk.", s: "Financials", p: 310, cg: "Sektor Perbankan" },

  // --- 8. BUMN ---
  { t: "ANTM", n: "PT Aneka Tambang Tbk.", s: "Basic Materials", p: 1520, cg: "BUMN" },
  { t: "GIAA", n: "PT Garuda Indonesia (Persero) Tbk.", s: "Industrials", p: 68, cg: "BUMN" },
  { t: "GMFI", n: "PT Garuda Maintenance Facility Aero Asia Tbk.", s: "Industrials", p: 60, cg: "BUMN" },
  { t: "INCO", n: "PT Vale Indonesia Tbk. / MIND ID", s: "Basic Materials", p: 3850, cg: "BUMN" },
  { t: "JSMR", n: "PT Jasa Marga (Persero) Tbk.", s: "Industrials", p: 4700, cg: "BUMN" },
  { t: "KAEF", n: "PT Kimia Farma Tbk.", s: "Healthcare", p: 680, cg: "BUMN" },
  { t: "KRAS", n: "PT Krakatau Steel (Persero) Tbk.", s: "Basic Materials", p: 110, cg: "BUMN" },
  { t: "SMBR", n: "PT Semen Baturaja Tbk.", s: "Industrials", p: 240, cg: "BUMN" },
  { t: "SMGR", n: "PT Semen Indonesia (Persero) Tbk.", s: "Industrials", p: 3950, cg: "BUMN" },
  { t: "TINS", n: "PT Timah Tbk.", s: "Basic Materials", p: 1150, cg: "BUMN" },
  { t: "TLKM", n: "PT Telkom Indonesia (Persero) Tbk.", s: "Telecommunication", p: 3050, cg: "BUMN" },

  // --- 9. COAL & ENERGY ---
  { t: "HRUM", n: "PT Harum Energy Tbk.", s: "Energy", p: 1380, cg: "Sektor COAL" },
  { t: "ITMG", n: "PT Indo Tambangraya Megah Tbk.", s: "Energy", p: 26200, cg: "Sektor COAL" },
  { t: "PTBA", n: "PT Bukit Asam Tbk.", s: "Energy", p: 2680, cg: "Sektor COAL" },
  { t: "BYAN", n: "PT Bayan Resources Tbk.", s: "Energy", p: 18500, cg: "Sektor COAL" },

  // --- 10. HAJI ISAM (JHOLIN GROUP) ---
  { t: "FAST", n: "PT Fast Food Indonesia Tbk.", s: "Consumer Cyclical", p: 450, cg: "Haji Isam (Jholin)" },
  { t: "JARR", n: "PT Jhonlin Agro Raya Tbk.", s: "Consumer Staples", p: 320, cg: "Haji Isam (Jholin)" },
  { t: "PGUN", n: "PT Pradiksi Gunatama Tbk.", s: "Consumer Staples", p: 460, cg: "Haji Isam (Jholin)" },
  { t: "TEBE", n: "PT Dana Brata Luhur Tbk.", s: "Energy", p: 780, cg: "Haji Isam (Jholin)" },

  // --- 11. HASYIM DJOJOHADIKUSUMO ---
  { t: "DOOH", n: "PT Era Media Sejahtera Tbk.", s: "Telecommunication", p: 50, cg: "Hasyim Djojohadikusumo" },
  { t: "INET", n: "PT Sinergi Inti Andalan Prima Tbk.", s: "Telecommunication", p: 110, cg: "Hasyim Djojohadikusumo" },
  { t: "KETR", n: "PT Ketrosden Triasmitra Tbk.", s: "Telecommunication", p: 210, cg: "Hasyim Djojohadikusumo" },
  { t: "WIFI", n: "PT Solusi Sinergi Digital Tbk.", s: "Telecommunication", p: 310, cg: "Hasyim Djojohadikusumo" },

  // --- 12. SALIM GROUP & MEDCO ---
  { t: "ICBP", n: "PT Indofood CBP Sukses Makmur Tbk.", s: "Consumer Staples", p: 11850, cg: "Grup Salim" },
  { t: "LSIP", n: "PT PP London Sumatra Indonesia Tbk.", s: "Consumer Staples", p: 1020, cg: "Grup Salim" },
  { t: "SIMP", n: "PT Salim Ivomas Pratama Tbk.", s: "Consumer Staples", p: 410, cg: "Grup Salim" },
  { t: "META", n: "PT Nusantara Infrastructure Tbk.", s: "Industrials", p: 238, cg: "Grup Salim" },
  { t: "INDF", n: "PT Indofood Sukses Makmur Tbk.", s: "Consumer Staples", p: 7150, cg: "Grup Salim" },
  { t: "AMRT", n: "PT Sumber Alfaria Trijaya Tbk.", s: "Consumer Cyclical", p: 2850, cg: "Grup Salim" },
  { t: "ROTI", n: "PT Nippon Indosari Corpindo Tbk.", s: "Consumer Staples", p: 1040, cg: "Grup Salim" },
  { t: "DNET", n: "PT Indoritel Makmur Internasional Tbk.", s: "Consumer Cyclical", p: 4100, cg: "Grup Salim" },
  { t: "IMAS", n: "PT Indomobil Sukses Internasional Tbk.", s: "Consumer Cyclical", p: 1320, cg: "Grup Salim" },
  { t: "IMJS", n: "PT Indomobil Multi Jasa Tbk.", s: "Financials", p: 170, cg: "Grup Salim" },
  { t: "AMMN", n: "PT Amman Mineral Internasional Tbk.", s: "Basic Materials", p: 8950, cg: "Grup Salim & Medco" },
  { t: "MEDC", n: "PT Medco Energi Internasional Tbk.", s: "Energy", p: 1320, cg: "Grup Salim & Medco" },

  // --- 13. SEKTOR INTERNET & TELCO ---
  { t: "MORA", n: "PT Mora Telematika Indonesia Tbk.", s: "Telecommunication", p: 280, cg: "Internet & Telco" },
  { t: "IRSX", n: "PT Aviana Sinar Abadi Tbk.", s: "Technology", p: 50, cg: "Internet & Telco" },
  { t: "PADA", n: "PT Personel Alih Daya Tbk.", s: "Industrials", p: 60, cg: "Internet & Telco" },

  // --- 14. LOGISTIK DAN PERKAPALAN ---
  { t: "SOCI", n: "PT Soechi Lines Tbk.", s: "Industrials & Energy", p: 195, cg: "Logistik & Perkapalan" },
  { t: "BULL", n: "PT Buana Lintas Lautan Tbk.", s: "Industrials & Energy", p: 135, cg: "Logistik & Perkapalan" },
  { t: "GTSI", n: "PT GTS Internasional Tbk.", s: "Energy", p: 50, cg: "Logistik & Perkapalan" },
  { t: "HUMI", n: "PT Humpuss Maritim Internasional Tbk.", s: "Energy", p: 65, cg: "Logistik & Perkapalan" },
  { t: "LEAD", n: "PT Logindo Samudramakmur Tbk.", s: "Energy", p: 60, cg: "Logistik & Perkapalan" },

  // --- BLUE CHIP & OTHER LIQUID IDX STOCKS ---
  { t: "ASII", n: "PT Astra International Tbk.", s: "Consumer Cyclical", p: 5150 },
  { t: "GOTO", n: "PT GoTo Gojek Tokopedia Tbk.", s: "Technology", p: 68 },
  { t: "UNVR", n: "PT Unilever Indonesia Tbk.", s: "Consumer Staples", p: 2350 },
  { t: "CPIN", n: "PT Charoen Pokphand Indonesia Tbk.", s: "Consumer Staples", p: 5150 },
  { t: "KLBF", n: "PT Kalbe Farma Tbk.", s: "Healthcare", p: 1650 },
  { t: "PGAS", n: "PT Perusahaan Gas Negara Tbk.", s: "Energy", p: 1540 },
  { t: "UNTR", n: "PT United Tractors Tbk.", s: "Industrials", p: 26800 },
  { t: "ISAT", n: "PT Indosat Ooredoo Hutchison Tbk.", s: "Telecommunication", p: 10250 },
  { t: "EXCL", n: "PT XL Axiata Tbk.", s: "Telecommunication", p: 2250 },
  { t: "TOWR", n: "PT Sarana Menara Nusantara Tbk.", s: "Telecommunication", p: 810 },
  { t: "INKP", n: "PT Indah Kiat Pulp & Paper Tbk.", s: "Basic Materials", p: 8150 },
  { t: "TKIM", n: "PT Pabrik Kertas Tjiwi Kimia Tbk.", s: "Basic Materials", p: 7100 },
  { t: "BSDE", n: "PT Bumi Serpong Damai Tbk.", s: "Properties", p: 1120 },
  { t: "CTRA", n: "PT Ciputra Development Tbk.", s: "Properties", p: 1280 }
];

export function getMockStocks(limit?: number): StockData[] {
  const stockMap = new Map<string, StockData>();

  const stocksToProcess = limit && limit < liquidIDXStocks.length 
    ? liquidIDXStocks.slice(0, limit) 
    : liquidIDXStocks;

  stocksToProcess.forEach((s) => {
    const isIhsg = s.t === 'IHSG' || s.t === '^JKSE';
    const ticker = isIhsg ? 'IHSG' : s.t;
    const symbol = isIhsg ? '^JKSE' : s.t + '.JK';
    const candles = generateCandles(s.p, 0.025, 0.001, 90);
    const stockData = buildStockData(symbol, ticker, s.n, s.s, candles, s.cg);
    stockMap.set(ticker, stockData);
  });

  return Array.from(stockMap.values());
}
