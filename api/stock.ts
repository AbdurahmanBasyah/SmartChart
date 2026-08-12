import { fetchYahooStockData } from '../src/services/yahooFinance';
import { getMockStocks, buildStockData, generateCandles } from '../src/data/mockStocks';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Support query param ?symbol=... or URL path param
  const symbolQuery = req.query.symbol || req.query.ticker || req.query.s || 'IHSG';
  const rawSymbol = Array.isArray(symbolQuery) ? symbolQuery[0] : String(symbolQuery);

  let cleanTicker = rawSymbol.trim().toUpperCase().replace('.JK', '');
  if (cleanTicker === 'IHSG' || cleanTicker === 'JKSE' || cleanTicker === '^JKSE') {
    cleanTicker = '^JKSE';
  }

  const yahooSymbol = cleanTicker.startsWith('^') ? cleanTicker : `${cleanTicker}.JK`;

  // 1. Try fetching real market data from Yahoo Finance API
  try {
    const realData = await fetchYahooStockData(cleanTicker);
    if (realData && realData.candles && realData.candles.length > 0) {
      return res.status(200).json(realData);
    }
  } catch (err) {
    console.warn(`Vercel serverless Yahoo fetch failed for ${yahooSymbol}:`, err);
  }

  // 2. Check local mock dataset
  const mockList = getMockStocks();
  const matched = mockList.find(
    (s) =>
      s.ticker.toUpperCase() === cleanTicker ||
      (cleanTicker === '^JKSE' && (s.ticker === 'IHSG' || s.ticker === '^JKSE'))
  );

  if (matched) {
    return res.status(200).json(matched);
  }

  // 3. Fallback generator for unlisted IDX stock tickers
  const fallbackCandles = generateCandles(1500, 0.03, 0.001, 90);
  const fallbackStock = buildStockData(
    yahooSymbol,
    cleanTicker,
    `${cleanTicker} Indonesia Tbk.`,
    'IDX Market',
    fallbackCandles
  );

  return res.status(200).json(fallbackStock);
}
