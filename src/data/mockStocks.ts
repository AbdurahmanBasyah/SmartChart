import { Candle, StockData } from "../types";
import {
  calculateMA,
  calculateVolumeMA,
  calculateVWAP,
  detectSwings,
  detectBosChoch,
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
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  for (let i = 0; i < days; i++) {
    const dateStr = new Date(startDate.getTime() + i * 86400000).toISOString().split("T")[0];

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
  conglomerate?: string
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
  const bosChochLines = detectBosChoch(candles, swings);
  const fvgs = detectFVGs(candles, isIhsg);
  const priceGaps = detectPriceGaps(candles);
  const orderBlocks = detectOrderBlocks(candles, swings, bosChochLines, fvgs, volumeMa20);
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
    bosChochLines,
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
  // --- UTAMA: MARKET INDEX ---
  { t: "IHSG", n: "Indeks Harga Saham Gabungan (IHSG)", s: "Market Index", p: 7350, cg: "Bursa Efek Indonesia" },

  // --- PRAJOGO PANGESTU (GRUP BARITO / PP) ---
  { t: "BREN", n: "PT Barito Renewables Energy Tbk.", s: "Energy", p: 7250, cg: "Prajogo Pangestu" },
  { t: "TPIA", n: "PT Chandra Asri Pacific Tbk.", s: "Basic Materials", p: 8800, cg: "Prajogo Pangestu" },
  { t: "BRPT", n: "PT Barito Pacific Tbk.", s: "Basic Materials", p: 1120, cg: "Prajogo Pangestu" },
  { t: "CUAN", n: "PT Petrindo Jaya Kreasi Tbk.", s: "Energy", p: 7600, cg: "Prajogo Pangestu" },
  { t: "PTRO", n: "PT Petrosea Tbk.", s: "Energy", p: 14500, cg: "Prajogo Pangestu" },
  { t: "CDIA", n: "PT Chandra Daya Investama Tbk.", s: "Basic Materials", p: 1850, cg: "Prajogo Pangestu" },

  // --- GRUP BAKRIE ---
  { t: "BUMI", n: "PT Bumi Resources Tbk.", s: "Energy", p: 140, cg: "Grup Bakrie" },
  { t: "BRMS", n: "PT Bumi Resources Minerals Tbk.", s: "Basic Materials", p: 340, cg: "Grup Bakrie" },
  { t: "ENRG", n: "PT Energi Mega Persada Tbk.", s: "Energy", p: 230, cg: "Grup Bakrie" },
  { t: "DEWA", n: "PT Darma Henwa Tbk.", s: "Energy", p: 92, cg: "Grup Bakrie" },
  { t: "VKTR", n: "PT VKTR Teknologi Mobilitas Tbk.", s: "Industrials", p: 145, cg: "Grup Bakrie" },
  { t: "UNSP", n: "PT Bakrie Sumatera Plantations Tbk.", s: "Consumer Staples", p: 110, cg: "Grup Bakrie" },
  { t: "VIVA", n: "PT Visi Media Asia Tbk.", s: "Telecommunication", p: 50, cg: "Grup Bakrie" },
  { t: "MDIA", n: "PT Intermedia Capital Tbk.", s: "Telecommunication", p: 50, cg: "Grup Bakrie" },

  // --- HAPPY HAPSORO GROUP ---
  { t: "PSAB", n: "PT J Resources Asia Pasifik Tbk.", s: "Basic Materials", p: 290, cg: "Happy Hapsoro" },
  { t: "RAJA", n: "PT Rukun Raharja Tbk.", s: "Energy", p: 1420, cg: "Happy Hapsoro" },
  { t: "MINA", n: "PT Sanurhasta Mitra Tbk.", s: "Consumer Cyclical", p: 50, cg: "Happy Hapsoro" },
  { t: "BUVA", n: "PT Bukit Uluwatu Villa Tbk.", s: "Consumer Cyclical", p: 70, cg: "Happy Hapsoro" },
  { t: "RATU", n: "PT Ratu Prabu Energy Tbk.", s: "Energy", p: 95, cg: "Happy Hapsoro" },
  { t: "CBRE", n: "PT Cakra Buana Resources Energi Tbk.", s: "Energy", p: 75, cg: "Happy Hapsoro" },
  { t: "PSKT", n: "PT Red Planet Indonesia Tbk.", s: "Consumer Cyclical", p: 65, cg: "Happy Hapsoro" },
  { t: "PADI", n: "PT Minna Padi Investama Sekuritas Tbk.", s: "Financials", p: 50, cg: "Happy Hapsoro" },
  { t: "FORU", n: "PT Fortune Indonesia Tbk.", s: "Consumer Cyclical", p: 1350, cg: "Happy Hapsoro" },

  // --- HAJI ISAM GROUP (JHOLIN & ENERGY) ---
  { t: "JARR", n: "PT JLM / Jholin Agro Raya Tbk.", s: "Consumer Staples", p: 320, cg: "Haji Isam (Jholin)" },
  { t: "TEBE", n: "PT Dana Brata Lupur Tbk.", s: "Energy", p: 780, cg: "Haji Isam (Jholin)" },
  { t: "SINI", n: "PT Singaraja Putra Tbk.", s: "Energy", p: 1250, cg: "Haji Isam & Happy Hapsoro" },

  // --- RAJAWALI GROUP (PETER SONDAKH) ---
  { t: "ARCI", n: "PT Archi Indonesia Tbk.", s: "Basic Materials", p: 310, cg: "Rajawali Group (Peter Sondakh)" },
  { t: "EMAS", n: "PT Wilton Makmur Indonesia Tbk.", s: "Basic Materials", p: 125, cg: "Rajawali Group (Peter Sondakh)" },

  // --- GOZALI FAMILY (GOZCO) ---
  { t: "GZCO", n: "PT Gozco Plantations Tbk.", s: "Consumer Staples", p: 90, cg: "Gozali Family (Gozco)" },

  // --- INTERNET RAKYAT & TELECOM INFRASTRUCTURE ---
  { t: "INET", n: "PT Sinergi Inti Andalan Dinamika Tbk.", s: "Telecommunication", p: 110, cg: "Internet Rakyat (Sinergi)" },
  { t: "WIFI", n: "PT Solusi Sinergi Digital Tbk.", s: "Telecommunication", p: 310, cg: "Internet Rakyat (Surge)" },
  { t: "MORA", n: "PT Mora Telematika Indonesia Tbk.", s: "Telecommunication", p: 280, cg: "Internet Rakyat (Moratelindo)" },

  // --- PERKAPALAN & LOGISTIK MARITIM ---
  { t: "BULL", n: "PT Buana Lintas Lautan Tbk.", s: "Industrials & Energy", p: 135, cg: "Perkapalan & Logistik" },
  { t: "SOCI", n: "PT Soechi Lines Tbk.", s: "Industrials & Energy", p: 195, cg: "Perkapalan & Logistik" },

  // --- AGUNG SEDAYU & ARTHA GRAHA (AGUAN & TOMMY WINATA) ---
  { t: "PANI", n: "PT Pantai Indah Kapuk Dua Tbk.", s: "Properties", p: 12800, cg: "Agung Sedayu (Aguan)" },

  // --- LOW TUCK KWONG ---
  { t: "BYAN", n: "PT Bayan Resources Tbk.", s: "Energy", p: 18500, cg: "Low Tuck Kwong" },

  // --- BOY THOHIR / GARIBALDI THOHIR ---
  { t: "ADRO", n: "PT Adaro Energy Indonesia Tbk.", s: "Energy", p: 3650, cg: "Boy Thohir" },
  { t: "ADMR", n: "PT Adaro Minerals Indonesia Tbk.", s: "Energy", p: 1420, cg: "Boy Thohir" },
  { t: "AADI", n: "PT Adaro Andalan Indonesia Tbk.", s: "Energy", p: 5850, cg: "Boy Thohir" },
  { t: "ESSA", n: "PT ESSA Industries Indonesia Tbk.", s: "Basic Materials", p: 840, cg: "Boy Thohir" },
  { t: "MDKA", n: "PT Merdeka Copper Gold Tbk.", s: "Basic Materials", p: 2450, cg: "Boy Thohir" },
  { t: "MBMA", n: "PT Merdeka Battery Materials Tbk.", s: "Basic Materials", p: 580, cg: "Boy Thohir" },

  // --- SALIM GROUP & MEDCO (ANTHONI SALIM & AGUS PROJOSASMITO) ---
  { t: "INDF", n: "PT Indofood Sukses Makmur Tbk.", s: "Consumer Staples", p: 7150, cg: "Grup Salim" },
  { t: "ICBP", n: "PT Indofood CBP Sukses Makmur Tbk.", s: "Consumer Staples", p: 11850, cg: "Grup Salim" },
  { t: "AMRT", n: "PT Sumber Alfaria Trijaya Tbk.", s: "Consumer Cyclical", p: 2850, cg: "Grup Salim" },
  { t: "DNET", n: "PT Indoretail Makmur Tbk.", s: "Consumer Cyclical", p: 4100, cg: "Grup Salim" },
  { t: "LSIP", n: "PT PP London Sumatra Indonesia Tbk.", s: "Consumer Staples", p: 1020, cg: "Grup Salim" },
  { t: "SIMP", n: "PT Salim Ivomas Pratama Tbk.", s: "Consumer Staples", p: 410, cg: "Grup Salim" },
  { t: "META", n: "PT Nusantara Infrastructure Tbk.", s: "Industrials", p: 238, cg: "Grup Salim" },
  { t: "AMMN", n: "PT Amman Mineral Internasional Tbk.", s: "Basic Materials", p: 8950, cg: "Grup Salim & Medco" },

  // --- DJARUM GROUP (HARTONO FAMILY) ---
  { t: "BBCA", n: "PT Bank Central Asia Tbk.", s: "Financials", p: 10150, cg: "Grup Djarum" },
  { t: "TOWR", n: "PT Sarana Menara Nusantara Tbk.", s: "Telecommunication", p: 810, cg: "Grup Djarum" },
  { t: "BELI", n: "PT Global Digital Niaga Tbk.", s: "Technology", p: 450, cg: "Grup Djarum" },

  // --- CHAIRUL TANJUNG (CT CORP) ---
  { t: "BBHI", n: "PT Allo Bank Indonesia Tbk.", s: "Financials", p: 1180, cg: "Chairul Tanjung (CT Corp)" },
  { t: "GIAA", n: "PT Garuda Indonesia Tbk.", s: "Industrials", p: 68, cg: "Chairul Tanjung (CT Corp)" },

  // --- SINAR MAS GROUP (WIDJAJA FAMILY) ---
  { t: "INKP", n: "PT Indah Kiat Pulp & Paper Tbk.", s: "Basic Materials", p: 8150, cg: "Grup Sinar Mas" },
  { t: "TKIM", n: "PT Pabrik Kertas Tjiwi Kimia Tbk.", s: "Basic Materials", p: 7100, cg: "Grup Sinar Mas" },
  { t: "BSDE", n: "PT Bumi Serpong Damai Tbk.", s: "Properties", p: 1120, cg: "Grup Sinar Mas" },
  { t: "BSIM", n: "PT Bank Sinarmas Tbk.", s: "Financials", p: 510, cg: "Grup Sinar Mas" },
  { t: "SMAR", n: "PT Smart Tbk.", s: "Consumer Staples", p: 4200, cg: "Grup Sinar Mas" },

  // --- LIPPO GROUP (RIADY FAMILY) ---
  { t: "LPKR", n: "PT Lippo Karawaci Tbk.", s: "Properties", p: 110, cg: "Grup Lippo" },
  { t: "LPCK", n: "PT Lippo Cikarang Tbk.", s: "Properties", p: 720, cg: "Grup Lippo" },
  { t: "MPPA", n: "PT Matahari Putra Prima Tbk.", s: "Consumer Cyclical", p: 78, cg: "Grup Lippo" },
  { t: "LPPF", n: "PT Matahari Department Store Tbk.", s: "Consumer Cyclical", p: 1480, cg: "Grup Lippo" },
  { t: "SILO", n: "PT Siloam International Hospitals Tbk.", s: "Healthcare", p: 2890, cg: "Grup Lippo" },
  { t: "MLPL", n: "PT Multipolar Tbk.", s: "Technology", p: 120, cg: "Grup Lippo" },
  { t: "NOBU", n: "PT Bank Nationalnobu Tbk.", s: "Financials", p: 580, cg: "Grup Lippo" },

  // --- TRIPUTRA GROUP (TP RACHMAT) ---
  { t: "TAPG", n: "PT Triputra Agro Persada Tbk.", s: "Consumer Staples", p: 880, cg: "Grup Triputra" },
  { t: "DRMA", n: "PT Dharma Polimetal Tbk.", s: "Industrials", p: 1150, cg: "Grup Triputra" },
  { t: "ASSA", n: "PT Adi Sarana Armada Tbk.", s: "Industrials", p: 780, cg: "Grup Triputra" },

  // --- SARATOGA GROUP (SANDIAGA UNO & EDWIN SOERYADJAYA) ---
  { t: "SRTG", n: "PT Saratoga Investama Sedaya Tbk.", s: "Financials", p: 2350, cg: "Grup Saratoga" },
  { t: "PALM", n: "PT Provident Investama Tbk.", s: "Financials", p: 420, cg: "Grup Saratoga" },

  // --- MNC GROUP (HARY TANOESOEDIBJO) ---
  { t: "MNCN", n: "PT Media Nusantara Citra Tbk.", s: "Telecommunication", p: 320, cg: "Grup MNC" },
  { t: "BHIT", n: "PT MNC Asia Holding Tbk.", s: "Financials", p: 50, cg: "Grup MNC" },
  { t: "KPIG", n: "PT MNC Land Tbk.", s: "Properties", p: 180, cg: "Grup MNC" },
  { t: "BCAP", n: "PT MNC Kapital Indonesia Tbk.", s: "Financials", p: 85, cg: "Grup MNC" },

  // --- PANIN GROUP (MU'MIN ALI GUNAWAN) ---
  { t: "PNBN", n: "PT Bank Pan Indonesia Tbk.", s: "Financials", p: 1250, cg: "Grup Panin" },
  { t: "PNLF", n: "PT Panin Financial Tbk.", s: "Financials", p: 310, cg: "Grup Panin" },

  // --- OTHER MAJOR LIQUID & BLUE CHIP IDX STOCKS ---
  { t: "BBRI", n: "PT Bank Rakyat Indonesia Tbk.", s: "Financials", p: 4850 },
  { t: "BMRI", n: "PT Bank Mandiri Tbk.", s: "Financials", p: 6900 },
  { t: "BBNI", n: "PT Bank Negara Indonesia Tbk.", s: "Financials", p: 5400 },
  { t: "BRIS", n: "PT Bank Syariah Indonesia Tbk.", s: "Financials", p: 2920 },
  { t: "ARTO", n: "PT Bank Jago Tbk.", s: "Financials", p: 2850 },
  { t: "BBTN", n: "PT Bank Tabungan Negara Tbk.", s: "Financials", p: 1380 },
  { t: "BFIN", n: "PT BFI Finance Indonesia Tbk.", s: "Financials", p: 1020 },
  { t: "PGAS", n: "PT Perusahaan Gas Negara Tbk.", s: "Energy", p: 1540 },
  { t: "PTBA", n: "PT Bukit Asam Tbk.", s: "Energy", p: 2680 },
  { t: "ITMG", n: "PT Indo Tambangraya Megah Tbk.", s: "Energy", p: 26200 },
  { t: "MEDC", n: "PT Medco Energi Internasional Tbk.", s: "Energy", p: 1320 },
  { t: "HRUM", n: "PT Harum Energy Tbk.", s: "Energy", p: 1380 },
  { t: "ANTM", n: "PT Aneka Tambang Tbk.", s: "Basic Materials", p: 1520 },
  { t: "INCO", n: "PT Vale Indonesia Tbk.", s: "Basic Materials", p: 3850 },
  { t: "UNVR", n: "PT Unilever Indonesia Tbk.", s: "Consumer Staples", p: 2350 },
  { t: "CPIN", n: "PT Charoen Pokphand Indonesia Tbk.", s: "Consumer Staples", p: 5150 },
  { t: "MYOR", n: "PT Mayora Indah Tbk.", s: "Consumer Staples", p: 2580 },
  { t: "ASII", n: "PT Astra International Tbk.", s: "Consumer Cyclical", p: 5150 },
  { t: "ACES", n: "PT Aspirasi Hidup Indonesia Tbk.", s: "Consumer Cyclical", p: 820 },
  { t: "MAPI", n: "PT Mitra Adiperkasa Tbk.", s: "Consumer Cyclical", p: 1650 },
  { t: "TLKM", n: "PT Telkom Indonesia (Persero) Tbk.", s: "Telecommunication", p: 3050 },
  { t: "ISAT", n: "PT Indosat Ooredoo Hutchison Tbk.", s: "Telecommunication", p: 10250 },
  { t: "EXCL", n: "PT XL Axiata Tbk.", s: "Telecommunication", p: 2250 },
  { t: "GOTO", n: "PT GoTo Gojek Tokopedia Tbk.", s: "Technology", p: 68 },
  { t: "UNTR", n: "PT United Tractors Tbk.", s: "Industrials", p: 26800 },
  { t: "SMGR", n: "PT Semen Indonesia (Persero) Tbk.", s: "Industrials", p: 3950 },
  { t: "KLBF", n: "PT Kalbe Farma Tbk.", s: "Healthcare", p: 1650 },
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
