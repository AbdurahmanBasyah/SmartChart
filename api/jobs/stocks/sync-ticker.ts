import {
  authenticateQstashRequest,
  parseRequestBody,
} from "../../_lib/qstash.js";
import { fetchYahooRawOhlcv } from "../../_lib/rawOhlcvSnapshot.js";
import {
  SyncProcessingError,
  SyncValidationError,
  runSyncTicker,
} from "../../_lib/stockSync.js";
import { getSnapshotRepository } from "../../_lib/redisSnapshotStore.js";

export const config = { api: { bodyParser: false } };

export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Upstash-Signature");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });

  const authentication = await authenticateQstashRequest(req);
  if (authentication.ok === false) {
    return res.status(authentication.status).json({ error: authentication.code });
  }
  const { rawBody } = authentication;

  let body: unknown;
  try {
    body = parseRequestBody<unknown>(rawBody);
  } catch {
    return res.status(400).json({ error: "INVALID_SYNC_PAYLOAD" });
  }

  try {
    const result = await runSyncTicker({
      message: body,
      repository: getSnapshotRepository(),
      fetchRaw: (ticker) => fetchYahooRawOhlcv(ticker),
    });
    return res.status(200).json({
      runId: result.runId,
      ticker: result.ticker,
      tradeDate: result.tradeDate,
      status: result.status,
      idempotent: result.idempotent,
      written: result.written ?? false,
    });
  } catch (error) {
    if (error instanceof SyncValidationError) {
      return res.status(400).json({ error: "INVALID_SYNC_PAYLOAD" });
    }
    if (error instanceof SyncProcessingError) {
      return res
        .status(error.retryable ? 503 : 422)
        .json({ error: error.code });
    }
    if (error instanceof Error && error.message === "REDIS_NOT_CONFIGURED") {
      return res.status(503).json({ error: "REDIS_NOT_CONFIGURED" });
    }
    return res.status(503).json({ error: "SYNC_TICKER_FAILED" });
  }
}
