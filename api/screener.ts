import { getMockStocks } from './_lib/stockEngine.js';

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
    const list = getMockStocks();
    const { structure, minRr, volumeOnly } = req.query || {};

    let filtered = list;

    if (structure && structure !== 'ALL') {
      filtered = filtered.filter((s) => s.recommendation.structure === structure);
    }

    if (minRr) {
      const minVal = parseFloat(minRr as string);
      filtered = filtered.filter((s) => s.recommendation.riskRewardRatio >= minVal);
    }

    if (volumeOnly === 'true') {
      filtered = filtered.filter((s) => s.recommendation.volumeConfirmation);
    }

    return res.status(200).json(filtered);
  } catch (err) {
    console.error('API /screener handler error:', err);
    return res.status(200).json([]);
  }
}
