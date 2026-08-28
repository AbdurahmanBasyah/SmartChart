import { normalizeTicker } from "./_lib/rawOhlcvSnapshot.js";
import { fetchYahooStockDataServer } from "./_lib/stockEngine.js";
import { readLatestStockFromRedis } from "./_lib/stockReadPath.js";

function setHeaders(res: any): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
}

function queryValue(value: unknown): string | undefined {
  if (Array.isArray(value)) return value[0] == null ? undefined : String(value[0]);
  return value == null ? undefined : String(value);
}

function requestTicker(req: any): string {
  const pathParts = String(req?.url ?? "")
    .split("?")[0]
    .split("/")
    .filter(Boolean);
  const pathTicker = pathParts.length > 2 ? pathParts[pathParts.length - 1] : undefined;
  const raw = queryValue(req?.query?.symbol) ??
    queryValue(req?.query?.ticker) ??
    queryValue(req?.query?.s) ??
    pathTicker ??
    "IHSG";
  try {
    return normalizeTicker(decodeURIComponent(raw));
  } catch {
    throw new Error("INVALID_TICKER");
  }
}

function successCache(res: any): void {
  res.removeHeader("Pragma");
  res.removeHeader("Expires");
  res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
  res.setHeader("Vercel-CDN-Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
}

export default async function handler(req: any, res: any) {
  setHeaders(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });

  let ticker = "IHSG";
  try {
    ticker = requestTicker(req);
    try {
      const snapshotStock = await readLatestStockFromRedis(ticker);
      if (snapshotStock?.isRealData === true && snapshotStock.candles.length > 0) {
        successCache(res);
        return res.status(200).json(snapshotStock);
      }
    } catch {
      // Redis is an optimization; the direct real provider path remains available.
    }

    const realData = await fetchYahooStockDataServer(ticker);
    if (realData?.isRealData === true && realData.candles.length > 0) {
      successCache(res);
      return res.status(200).json(realData);
    }
    return res.status(503).json({
      success: false,
      error: "REAL_STOCK_DATA_UNAVAILABLE",
      ticker,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_TICKER") {
      return res.status(400).json({ success: false, error: "INVALID_TICKER", ticker });
    }
    console.error("Unhandled error in /api/stock:", error instanceof Error ? error.message : "unknown");
    return res.status(503).json({
      success: false,
      error: "REAL_STOCK_DATA_UNAVAILABLE",
      ticker,
    });
  }
}
