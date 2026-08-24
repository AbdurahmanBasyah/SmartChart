import { fetchYahooStockDataServer, getMockStocks, buildStockData, generateCandles } from './_lib/stockEngine.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Support query param ?symbol=... or URL path param
    const symbolQuery = req?.query?.symbol || req?.query?.ticker || req?.query?.s || 'IHSG';
    const rawSymbol = Array.isArray(symbolQuery) ? symbolQuery[0] : String(symbolQuery);

    let cleanSymbol = rawSymbol;
    try {
      cleanSymbol = decodeURIComponent(rawSymbol);
    } catch (e) {
      // ignore
    }

    let cleanTicker = cleanSymbol.trim().toUpperCase().replace('.JK', '');
    if (cleanTicker === 'IHSG' || cleanTicker === 'JKSE' || cleanTicker === '^JKSE') {
      cleanTicker = '^JKSE';
    }

    const yahooSymbol = cleanTicker.startsWith('^') ? cleanTicker : `${cleanTicker}.JK`;

    // 1. Try fetching real market data from Yahoo Finance API via serverless function
    try {
      const realData = await fetchYahooStockDataServer(cleanTicker);
      if (realData && realData.candles && realData.candles.length > 0) {
        if (req.method === 'GET') {
          res.removeHeader('Pragma');
          res.removeHeader('Expires');
          res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
          res.setHeader('Vercel-CDN-Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
        }
        return res.status(200).json(realData);
      }
    } catch (err) {
      console.warn(`Vercel serverless Yahoo fetch failed for ${yahooSymbol}:`, err);
    }

    // 2. Check local dataset
    const mockList = getMockStocks();
    const matched = mockList.find(
      (s) =>
        s.ticker.toUpperCase() === cleanTicker ||
        (cleanTicker === '^JKSE' && (s.ticker === 'IHSG' || s.ticker === '^JKSE'))
    );

    if (matched) {
      if (req.method === 'GET') {
        res.removeHeader('Pragma');
        res.removeHeader('Expires');
        res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
        res.setHeader('Vercel-CDN-Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
      }
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

    if (req.method === 'GET') {
      res.removeHeader('Pragma');
      res.removeHeader('Expires');
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
      res.setHeader('Vercel-CDN-Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
    }
    return res.status(200).json(fallbackStock);
  } catch (globalErr) {
    console.error('Unhandled error in /api/stock:', globalErr);
    // Absolute fallback: Return 200 with generated stock so Vercel NEVER returns 500
    const fallbackCandles = generateCandles(142, 0.02, 0.001, 90);
    const fallbackStock = buildStockData(
      'BUMI.JK',
      'BUMI',
      'Bumi Resources Tbk.',
      'Energy & Mining',
      fallbackCandles
    );
    return res.status(200).json(fallbackStock);
  }
}
