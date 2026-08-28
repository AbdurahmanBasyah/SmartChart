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
        coverage: {
          expected: CANONICAL_STOCK_COUNT,
          available: 0,
          missing: result.coverage.missing,
          partial: true,
          fetchedAt: result.coverage.fetchedAt,
        },
      });
    }
    res.removeHeader("Pragma");
    res.removeHeader("Expires");
    res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
    res.setHeader("Vercel-CDN-Cache-Control", "public, s-maxage=900, stale-while-revalidate=86400");
    return res.status(200).json({
      success: true,
      source: result.source,
      data: result.items,
      coverage: result.coverage,
    });
  } catch (error) {
    console.error("API /stocks handler error:", error instanceof Error ? error.message : "unknown");
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
