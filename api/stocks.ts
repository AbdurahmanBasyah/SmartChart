import { getAllStocksServer } from './_lib/stockEngine.js';
import { readStocksFromRedis } from './_lib/stockReadPath.js';

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
    let stocks;
    try {
      stocks = await readStocksFromRedis();
    } catch {
      // Redis is unavailable or not configured: preserve the existing
      // in-memory/mock response with its honest fallback flags.
      stocks = await getAllStocksServer();
    }
    if (req.method === 'GET') {
      res.removeHeader('Pragma');
      res.removeHeader('Expires');
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
      res.setHeader('Vercel-CDN-Cache-Control', 'public, s-maxage=900, stale-while-revalidate=86400');
    }
    return res.status(200).json(stocks);
  } catch (error) {
    console.error('API /stocks handler error:', error);
    return res.status(200).json([]);
  }
}

