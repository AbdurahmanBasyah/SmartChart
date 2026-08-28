import { CANONICAL_STOCK_COUNT } from "../shared/stockUniverse.js";
import { readCanonicalStocks } from "./_lib/stockReadPath.js";

function setHeaders(res: any): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
}

function queryValue(value: unknown): string {
  return Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "");
}

export default async function handler(req: any, res: any) {
  setHeaders(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });

  try {
    const result = await readCanonicalStocks();
    if (result.items.length === 0) {
      return res.status(503).json({
        success: false,
        error: "REAL_STOCK_DATA_UNAVAILABLE",
        coverage: result.coverage,
      });
    }

    const structure = queryValue(req.query?.structure);
    const minRr = Number.parseFloat(queryValue(req.query?.minRr));
    const volumeOnly = queryValue(req.query?.volumeOnly) === "true";
    let filtered = result.items;

    if (structure && structure !== "ALL") {
      filtered = filtered.filter((stock) => stock.recommendation.structure === structure);
    }
    if (Number.isFinite(minRr)) {
      filtered = filtered.filter(
        (stock) => stock.recommendation.riskRewardRatio >= minRr,
      );
    }
    if (volumeOnly) {
      filtered = filtered.filter((stock) => stock.recommendation.volumeConfirmation);
    }

    res.removeHeader("Pragma");
    res.removeHeader("Expires");
    res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
    res.setHeader("Vercel-CDN-Cache-Control", "public, s-maxage=900, stale-while-revalidate=86400");
    return res.status(200).json({
      success: true,
      source: result.source,
      data: filtered,
      filteredCount: filtered.length,
      coverage: result.coverage,
    });
  } catch (error) {
    console.error("API /screener handler error:", error instanceof Error ? error.message : "unknown");
    return res.status(503).json({
      success: false,
      error: "REAL_STOCK_DATA_UNAVAILABLE",
      coverage: {
        expected: CANONICAL_STOCK_COUNT,
        available: 0,
        missing: [],
        partial: true,
        fetchedAt: new Date().toISOString(),
      },
    });
  }
}
