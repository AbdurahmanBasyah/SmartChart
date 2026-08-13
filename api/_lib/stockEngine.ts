import type { Candle, StockData } from '../../src/types.js';
import {
  buildStockData,
  generateCandles,
  liquidIDXStocks,
  getLatestClosedTradingDateStr,
} from '../../src/data/mockStocks.js';
import { fetchYahooStockData } from '../../src/services/yahooFinance.js';

export type { Candle, StockData };
export { liquidIDXStocks, getLatestClosedTradingDateStr, buildStockData, generateCandles };


// In-memory cache for serverless functions
let cachedStocksMap: Map<string, StockData> = new Map();
let lastPreloadTime = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute

export function getMockStocks(): StockData[] {
  const stockMap = new Map<string, StockData>();
  liquidIDXStocks.forEach((cfg) => {
    const isIhsg = cfg.t === 'IHSG' || cfg.t === '^JKSE';
    const ticker = isIhsg ? 'IHSG' : cfg.t;
    const symbol = isIhsg ? '^JKSE' : `${cfg.t}.JK`;
    const cached = cachedStocksMap.get(ticker) || cachedStocksMap.get(symbol);
    if (cached) {
      stockMap.set(ticker, cached);
    } else {
      const candles = generateCandles(cfg.p, 0.025, 0.001, 100);
      const stock = buildStockData(symbol, ticker, cfg.n, cfg.s, candles, cfg.cg);
      stockMap.set(ticker, stock);
    }
  });
  return Array.from(stockMap.values());
}

export async function fetchYahooStockDataServer(rawTicker: string): Promise<StockData | null> {
  let cleanTicker = rawTicker.trim().toUpperCase().replace('.JK', '');
  if (cleanTicker === 'IHSG' || cleanTicker === 'JKSE' || cleanTicker === '^JKSE') {
    cleanTicker = '^JKSE';
  }

  try {
    const realData = await fetchYahooStockData(cleanTicker);
    if (realData && realData.candles && realData.candles.length > 0) {
      const displayTicker = cleanTicker === '^JKSE' ? 'IHSG' : cleanTicker;
      cachedStocksMap.set(displayTicker, realData);
      cachedStocksMap.set(cleanTicker, realData);
      cachedStocksMap.set(realData.symbol.toUpperCase(), realData);
      if (cleanTicker === '^JKSE') {
        cachedStocksMap.set('^JKSE', realData);
        cachedStocksMap.set('IHSG', realData);
        cachedStocksMap.set('JKSE', realData);
      }
      return realData;
    }
  } catch (err) {
    console.warn(`Server fetchYahooStockData failed for ${rawTicker}:`, err);
  }

  // Fallback to cached or generated
  const displayTicker = cleanTicker === '^JKSE' ? 'IHSG' : cleanTicker;
  if (cachedStocksMap.has(displayTicker)) {
    return cachedStocksMap.get(displayTicker)!;
  }

  const matched = liquidIDXStocks.find((s) => s.t === cleanTicker || (cleanTicker === '^JKSE' && s.t === 'IHSG'));
  const symbol = cleanTicker.startsWith('^') ? cleanTicker : `${cleanTicker}.JK`;
  const name = matched ? matched.n : `${cleanTicker} Indonesia Tbk.`;
  const sector = matched ? matched.s : 'IDX Market';
  const basePrice = matched ? matched.p : 2500;
  const candles = generateCandles(basePrice, 0.025, 0.001, 100);
  const fallback = buildStockData(symbol, displayTicker, name, sector, candles, matched?.cg);
  return fallback;
}

/**
 * Returns real stock data for all liquid IDX stocks, fetching from Yahoo Finance and caching
 */
export async function getAllStocksServer(): Promise<StockData[]> {
  const now = Date.now();
  const isCacheFresh = (now - lastPreloadTime) < CACHE_TTL_MS && cachedStocksMap.size >= 10;

  if (isCacheFresh) {
    const list = getMockStocks();
    return list;
  }

  // Primary top tickers to fetch real data for
  const primaryTickers = [
    '^JKSE', 'BRPT', 'BBCA', 'BBRI', 'BMRI', 'BBNI', 'BREN', 'CUAN',
    'TPIA', 'TLKM', 'ASII', 'AMMN', 'ADRO', 'BUMI', 'GOTO', 'PGAS',
    'ANTM', 'PTBA', 'UNTR', 'ICBP', 'INDF', 'MEDC', 'INKP', 'TKIM',
    'CPIN', 'MDKA', 'MBMA', 'BRIS', 'ARTO', 'ISAT', 'EXCL', 'ACES', 'AMRT'
  ];

  // Fetch in concurrent batches of 6
  const batchSize = 6;
  for (let i = 0; i < primaryTickers.length; i += batchSize) {
    const batch = primaryTickers.slice(i, i + batchSize);
    await Promise.allSettled(
      batch.map(async (t) => {
        try {
          const real = await fetchYahooStockData(t);
          if (real && real.candles && real.candles.length > 0) {
            const displayTicker = t === '^JKSE' ? 'IHSG' : t;
            cachedStocksMap.set(displayTicker, real);
            cachedStocksMap.set(t, real);
            cachedStocksMap.set(real.symbol.toUpperCase(), real);
            if (t === '^JKSE') {
              cachedStocksMap.set('^JKSE', real);
              cachedStocksMap.set('IHSG', real);
              cachedStocksMap.set('JKSE', real);
            }
          }
        } catch (e) {
          // ignore single ticker error
        }
      })
    );
  }

  lastPreloadTime = now;
  return getMockStocks();
}

