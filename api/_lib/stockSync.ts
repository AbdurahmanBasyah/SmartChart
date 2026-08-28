import { createHash } from "node:crypto";
import {
  getLatestLogicalTradeDate,
  isValidIsoDate,
  normalizeTicker,
  RawOhlcvError,
  validateRawOhlcvSnapshot,
} from "./rawOhlcvSnapshot.js";
import type { RawOhlcvSnapshot } from "./rawOhlcvSnapshot.js";
import {
  SnapshotRepository,
} from "./redisSnapshotStore.js";
import type { SyncStatusRecord } from "./redisSnapshotStore.js";
import {
  STOCK_SYNC_FLOW_CONTROL_KEY,
  STOCK_SYNC_MAX_PARALLELISM,
  STOCK_SYNC_QSTASH_RETRIES,
} from "./qstash.js";
import type { QStashBatchMessage, QStashPublisher } from "./qstash.js";
import { CANONICAL_STOCK_TICKERS } from "../../shared/stockUniverse.js";

export const STOCK_SYNC_LOCK_TTL_SECONDS = 15 * 60;

// The scheduled path imports only this dependency-free metadata-derived list.
export const STOCK_SYNC_TICKERS = CANONICAL_STOCK_TICKERS;

const STOCK_SYNC_TICKER_SET = new Set<string>(STOCK_SYNC_TICKERS);

export type SyncTickerMessage = {
  runId: string;
  ticker: string;
  tradeDate: string;
};

export class SyncValidationError extends Error {
  readonly code = "INVALID_SYNC_PAYLOAD" as const;
  readonly retryable = false;
}

export class MissingQstashMessageIdError extends Error {
  readonly code = "MISSING_QSTASH_MESSAGE_ID" as const;
  readonly retryable = false;

  constructor() {
    super("MISSING_QSTASH_MESSAGE_ID");
    this.name = "MissingQstashMessageIdError";
  }
}

export class SyncProcessingError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, retryable: boolean) {
    super(code);
    this.name = "SyncProcessingError";
    this.code = code;
    this.retryable = retryable;
  }
}

export type SyncControllerInput = {
  body?: Partial<SyncTickerMessage> & { tickers?: string[] };
  repository: SnapshotRepository;
  publisher: QStashPublisher;
  destination: string;
  now?: Date;
  tickers?: readonly string[];
  messageId?: string;
};

export type SyncControllerResult = {
  runId: string;
  tradeDate: string;
  status: "queued" | "already-running" | "already-completed" | "failed";
  total: number;
  queued: number;
  statusRecord?: SyncStatusRecord | null;
};

export type SyncTickerInput = {
  message: unknown;
  repository: SnapshotRepository;
  fetchRaw: (ticker: string) => Promise<RawOhlcvSnapshot>;
};

export type SyncTickerResult = {
  runId: string;
  ticker: string;
  tradeDate: string;
  status: "completed" | "no-new-candle";
  idempotent: boolean;
  written?: boolean;
};

function validRunId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9._:-]{1,80}$/.test(value);
}

export function parseSyncMessage(value: unknown): SyncTickerMessage {
  if (!value || typeof value !== "object") {
    throw new SyncValidationError("Sync payload must be an object");
  }
  const body = value as Partial<SyncTickerMessage>;
  if (!validRunId(body.runId) || typeof body.tradeDate !== "string" || !isValidIsoDate(body.tradeDate)) {
    throw new SyncValidationError("Sync payload fields are invalid");
  }
  try {
    const ticker = normalizeTicker(body.ticker);
    if (!STOCK_SYNC_TICKER_SET.has(ticker)) {
      throw new SyncValidationError("Sync ticker is outside the configured universe");
    }
    return {
      runId: body.runId,
      ticker,
      tradeDate: body.tradeDate,
    };
  } catch {
    throw new SyncValidationError("Sync ticker is invalid");
  }
}

function normalizeQstashMessageId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function makeMessageDerivedRunId(messageId: string): string {
  const normalized = normalizeQstashMessageId(messageId);
  if (!normalized) throw new MissingQstashMessageIdError();
  const digest = createHash("sha256").update(normalized, "utf8").digest("hex");
  return `stock-sync-${digest.slice(0, 32)}`;
}

function makeControllerRunId(
  body: SyncControllerInput["body"],
  messageId?: string,
): string {
  if (body?.runId !== undefined) {
    if (!validRunId(body.runId)) throw new SyncValidationError("Sync run id is invalid");
    return body.runId;
  }
  // Date-only identifiers caused a manual invocation to suppress the official
  // QStash schedule. Every signed delivery without an explicit validated runId
  // must therefore derive its identity from the QStash message id.
  return makeMessageDerivedRunId(messageId ?? "");
}

function normalizeUniverse(tickers: readonly string[]): string[] {
  const normalized = new Set<string>();
  for (const ticker of tickers) {
    try {
      const candidate = normalizeTicker(ticker);
      if (STOCK_SYNC_TICKER_SET.has(candidate)) normalized.add(candidate);
    } catch {
      // The static universe is controlled code. Invalid custom entries are
      // ignored so a single malformed optional override cannot fan out.
    }
  }
  return Array.from(normalized);
}

function makeBatchMessages(
  destination: string,
  runId: string,
  tradeDate: string,
  tickers: readonly string[],
): QStashBatchMessage[] {
  return tickers.map((ticker) => ({
    url: destination,
    body: { runId, ticker, tradeDate },
    headers: { "Content-Type": "application/json" },
    retries: STOCK_SYNC_QSTASH_RETRIES,
    flowControl: {
      key: STOCK_SYNC_FLOW_CONTROL_KEY,
      parallelism: STOCK_SYNC_MAX_PARALLELISM,
    },
  }));
}

export async function runSyncController(
  input: SyncControllerInput,
): Promise<SyncControllerResult> {
  if (
    input.body !== undefined &&
    (!input.body || typeof input.body !== "object" || Array.isArray(input.body))
  ) {
    throw new SyncValidationError("Sync controller payload must be an object");
  }
  const requestedTradeDate = input.body?.tradeDate;
  const tradeDate = requestedTradeDate === undefined
    ? getLatestLogicalTradeDate(input.now ?? new Date())
    : requestedTradeDate;
  if (typeof tradeDate !== "string" || !isValidIsoDate(tradeDate)) {
    throw new SyncValidationError("Logical trade date is invalid");
  }
  const runId = makeControllerRunId(input.body, input.messageId);
  const tickers = normalizeUniverse(
    // The production controller has one canonical population. `input.tickers`
    // is retained only as a test/internal injection point and is never supplied
    // by the HTTP handler; request-body ticker lists cannot shrink the fanout.
    input.tickers ?? STOCK_SYNC_TICKERS,
  );
  if (tickers.length === 0) throw new SyncValidationError("Ticker universe is empty");

  const existing = await input.repository.getSyncStatus(runId);
  const retryableControllerFailure =
    existing?.status === "failed" &&
    (existing.errorCodes?.QSTASH_PUBLISH_FAILED ?? 0) > 0;
  if (
    existing &&
    ["completed", "failed", "no-new-candle"].includes(existing.status) &&
    !retryableControllerFailure
  ) {
    return {
      runId,
      tradeDate,
      status: "already-completed",
      total: existing.total,
      queued: existing.queued,
      statusRecord: existing,
    };
  }
  if (existing && ["queued", "running"].includes(existing.status)) {
    // A redelivered controller message must not publish a second fan-out even
    // if the short-lived lock has already expired. A new QStash message ID
    // gets a distinct run ID and can proceed independently once unlocked.
    return {
      runId,
      tradeDate,
      status: "already-running",
      total: existing.total,
      queued: existing.queued,
      statusRecord: existing,
    };
  }

  const acquired = await input.repository.acquireLock(
    runId,
    STOCK_SYNC_LOCK_TTL_SECONDS,
  );
  if (!acquired) {
    return {
      runId,
      tradeDate,
      status: "already-running",
      total: tickers.length,
      queued: 0,
      statusRecord: existing,
    };
  }

  await input.repository.setSyncStatus({
    runId,
    tradeDate,
    status: "queued",
    expected: tickers.length,
    total: tickers.length,
    queued: 0,
    completed: 0,
    failed: 0,
    noNewCandle: 0,
  });

  const messages = makeBatchMessages(input.destination, runId, tradeDate, tickers);
  try {
    const published = await input.publisher.batchJSON(messages);
    const queued = Array.isArray(published) ? Math.min(published.length, messages.length) : messages.length;
    if (queued < messages.length) {
      await input.repository.setSyncStatus({
        runId,
        tradeDate,
        status: "queued",
        expected: tickers.length,
        total: tickers.length,
        queued,
        completed: 0,
        failed: 0,
        noNewCandle: 0,
      });
      for (const ticker of tickers.slice(queued)) {
        await input.repository.recordSyncResult({
          runId,
          ticker,
          outcome: "failed",
          errorCode: "QSTASH_PARTIAL_BATCH",
        });
      }
      const partialStatus = await input.repository.getSyncStatus(runId);
      return {
        runId,
        tradeDate,
        status: "failed",
        total: tickers.length,
        queued,
        statusRecord: partialStatus,
      };
    }
    await input.repository.setSyncStatus({
      runId,
      tradeDate,
      status: "queued",
      expected: tickers.length,
      total: tickers.length,
      queued,
      completed: 0,
      failed: 0,
      noNewCandle: 0,
    });
    return {
      runId,
      tradeDate,
      status: "queued",
      total: tickers.length,
      queued,
      statusRecord: await input.repository.getSyncStatus(runId),
    };
  } catch {
    await input.repository.setSyncStatus({
      runId,
      tradeDate,
      status: "failed",
      expected: tickers.length,
      total: tickers.length,
      queued: 0,
      completed: 0,
      failed: tickers.length,
      noNewCandle: 0,
      finishedAt: new Date().toISOString(),
      errorCodes: { QSTASH_PUBLISH_FAILED: 1 },
    });
    await input.repository.releaseLock(runId);
    throw new SyncProcessingError("QSTASH_PUBLISH_FAILED", true);
  }
}

function errorDetails(error: unknown): { code: string; retryable: boolean } {
  if (error instanceof RawOhlcvError) {
    return { code: error.code, retryable: error.retryable };
  }
  if (error instanceof SyncProcessingError) {
    return { code: error.code, retryable: error.retryable };
  }
  return { code: "PROVIDER_UNAVAILABLE", retryable: true };
}

export async function runSyncTicker(
  input: SyncTickerInput,
): Promise<SyncTickerResult> {
  const message = parseSyncMessage(input.message);
  try {
    const snapshot = await input.fetchRaw(message.ticker);
    const validation = validateRawOhlcvSnapshot(snapshot);
    if (!validation.valid) {
      const invalid = validation as Extract<typeof validation, { valid: false }>;
      throw new SyncProcessingError(invalid.code, false);
    }
    if (validation.snapshot.tradeDate < message.tradeDate) {
      const record = await input.repository.recordSyncResult({
        runId: message.runId,
        ticker: message.ticker,
        outcome: "no-new-candle",
        errorCode: "NO_NEW_CANDLE",
      });
      return {
        runId: message.runId,
        ticker: message.ticker,
        tradeDate: message.tradeDate,
        status: "no-new-candle",
        idempotent: !record.accepted,
      };
    }

    const write = await input.repository.saveSnapshot(validation.snapshot);
    const record = await input.repository.recordSyncResult({
      runId: message.runId,
      ticker: message.ticker,
      outcome: "completed",
    });
    return {
      runId: message.runId,
      ticker: message.ticker,
      tradeDate: validation.snapshot.tradeDate,
      status: "completed",
      idempotent: !record.accepted || !write.written,
      written: write.written,
    };
  } catch (error) {
    const details = errorDetails(error);
    if (details.code === "NO_NEW_CANDLE" || details.code === "EMPTY_RESPONSE") {
      const record = await input.repository.recordSyncResult({
        runId: message.runId,
        ticker: message.ticker,
        outcome: "no-new-candle",
        errorCode: "NO_NEW_CANDLE",
      });
      return {
        runId: message.runId,
        ticker: message.ticker,
        tradeDate: message.tradeDate,
        status: "no-new-candle",
        idempotent: !record.accepted,
      };
    }

    await input.repository.recordSyncResult({
      runId: message.runId,
      ticker: message.ticker,
      outcome: "failed",
      errorCode: details.code,
    });
    throw new SyncProcessingError(details.code, details.retryable);
  }
}
