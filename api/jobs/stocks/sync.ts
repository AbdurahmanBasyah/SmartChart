import {
  authenticateQstashRequest,
  getPublicAppUrl,
  createQStashPublisher,
  parseRequestBody,
} from "../../_lib/qstash.js";
import {
  SyncValidationError,
  runSyncController,
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

  let body: Record<string, unknown>;
  try {
    body = parseRequestBody<Record<string, unknown>>(rawBody);
  } catch {
    return res.status(400).json({ error: "INVALID_SYNC_PAYLOAD" });
  }

  try {
    const destination = `${getPublicAppUrl(req)}/api/jobs/stocks/sync-ticker`;
    const result = await runSyncController({
      body,
      repository: getSnapshotRepository(),
      publisher: createQStashPublisher(),
      destination,
    });
    return res.status(202).json({
      runId: result.runId,
      tradeDate: result.tradeDate,
      status: result.status,
      total: result.total,
      queued: result.queued,
    });
  } catch (error) {
    if (error instanceof SyncValidationError) {
      return res.status(400).json({ error: "INVALID_SYNC_PAYLOAD" });
    }
    if (error instanceof Error && error.message === "APP_URL_NOT_CONFIGURED") {
      return res.status(503).json({ error: "APP_URL_NOT_CONFIGURED" });
    }
    if (error instanceof Error && error.message === "REDIS_NOT_CONFIGURED") {
      return res.status(503).json({ error: "REDIS_NOT_CONFIGURED" });
    }
    if (error instanceof Error && error.message === "QSTASH_TOKEN_NOT_CONFIGURED") {
      return res.status(503).json({ error: "QSTASH_NOT_CONFIGURED" });
    }
    return res.status(503).json({ error: "SYNC_CONTROLLER_FAILED" });
  }
}
