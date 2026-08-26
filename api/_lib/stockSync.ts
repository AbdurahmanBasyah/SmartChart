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

export const STOCK_SYNC_LOCK_TTL_SECONDS = 15 * 60;

// This is the same liquid IDX universe used by the existing server engine,
// kept as a dependency-free list so the scheduled path never imports analysis.
export const STOCK_SYNC_TICKERS = [
  "IHSG", "BREN", "TPIA", "BRPT", "CUAN", "PTRO", "CDIA", "BUMI", "BRMS", "ENRG",
  "DEWA", "VKTR", "UNSP", "VIVA", "MDIA", "PSAB", "RAJA", "MINA", "BUVA", "RATU",
  "CBRE", "PSKT", "PADI", "FORU", "JARR", "TEBE", "SINI", "ARCI", "EMAS", "GZCO",
  "INET", "WIFI", "MORA", "BULL", "SOCI", "PANI", "BYAN", "ADRO", "ADMR", "AADI",
  "ESSA", "MDKA", "MBMA", "INDF", "ICBP", "AMRT", "DNET", "LSIP", "SIMP", "META",
  "AMMN", "BBCA", "TOWR", "BELI", "BBHI", "GIAA", "INKP", "TKIM", "BSDE", "BSIM",
  "SMAR", "LPKR", "LPCK", "MPPA", "LPPF", "SILO", "MLPL", "NOBU", "TAPG", "DRMA",
  "ASSA", "SRTG", "PALM", "PNBN", "PNLF", "BBRI", "BMRI", "BBNI", "BRIS", "ARTO",
  "BBTN", "BFIN", "PGAS", "PTBA", "ITMG", "MEDC", "HRUM", "ANTM", "INCO", "UNVR",
  "CPIN", "MYOR", "ASII", "ACES", "MAPI", "TLKM", "ISAT", "EXCL", "GOTO", "UNTR",
  "SMGR", "KLBF", "CTRA",
] as const;

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

function makeControllerRunId(body: SyncControllerInput["body"], tradeDate: string): string {
  if (body?.runId !== undefined) {
    if (!validRunId(body.runId)) throw new SyncValidationError("Sync run id is invalid");
    return body.runId;
  }
  return `stock-sync-${tradeDate}`;
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
  const tradeDate = input.body?.tradeDate
    ? input.body.tradeDate
    : getLatestLogicalTradeDate(input.now ?? new Date());
  if (!isValidIsoDate(tradeDate)) {
    throw new SyncValidationError("Logical trade date is invalid");
  }
  const runId = makeControllerRunId(input.body, tradeDate);
  const tickers = normalizeUniverse(
    input.body?.tickers?.length ? input.body.tickers : input.tickers ?? STOCK_SYNC_TICKERS,
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
