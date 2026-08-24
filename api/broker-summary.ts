import { fetchBrokerDataSummary } from './_lib/brokerDataClient.js';

function queryValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const symbol = queryValue(req.query.symbol ?? req.query.ticker)?.trim();
  const startDate = queryValue(req.query.start_date)?.trim();
  const endDate = queryValue(req.query.end_date)?.trim();

  if (!symbol || !startDate || !endDate) {
    return res.status(400).json({
      success: false,
      error: 'symbol, start_date, and end_date are required',
    });
  }

  try {
    const data = await fetchBrokerDataSummary({
      symbol,
      startDate,
      endDate,
      brokerLimit: Number(queryValue(req.query.broker_limit) || 20),
      levelLimit: Number(queryValue(req.query.level_limit) || 25),
    });

    res.removeHeader('Pragma');
    res.removeHeader('Expires');
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    res.setHeader('Vercel-CDN-Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
    return res.status(200).json({ success: true, source: 'EXTERNAL', data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown provider error';
    console.error(`[broker-summary] ${message}`);
    return res.status(502).json({
      success: false,
      source: 'EXTERNAL',
      error: 'Broker summary is temporarily unavailable',
    });
  }
}
