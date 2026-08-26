import { Redis } from "@upstash/redis";
import {
  ANALYSIS_ENGINE_VERSION,
  DEFAULT_OHLCV_RETENTION_TRADING_DAYS,
  stableSerializeSnapshot,
  validateRawOhlcvSnapshot,
} from "./rawOhlcvSnapshot.js";
import type { RawOhlcvSnapshot } from "./rawOhlcvSnapshot.js";

export const RAW_SNAPSHOT_KEY_PREFIX = "stock:ohlcv:";
export const LATEST_SNAPSHOT_KEY_PREFIX = "stock:latest:";
export const SNAPSHOT_DATES_KEY = "stock:dates";
export const SNAPSHOT_LOCK_KEY = "stock:lock";
export const SYNC_STATUS_KEY_PREFIX = "stock:sync:";
export const ANALYSIS_KEY_PREFIX = "analysis:";

const SYNC_STATUS_TTL_SECONDS = 7 * 24 * 60 * 60;
const LOCK_TTL_SECONDS = 15 * 60;

type SetOptions = { nx?: boolean; ex?: number };

export interface SnapshotTransaction {
  set(key: string, value: unknown, options?: SetOptions): SnapshotTransaction;
  zadd(key: string, entry: { score: number; member: string }): SnapshotTransaction;
  del(...keys: string[]): SnapshotTransaction;
  zrem(key: string, ...members: string[]): SnapshotTransaction;
  exec(): Promise<unknown>;
}

export interface SnapshotStoreClient {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown, options?: SetOptions): Promise<unknown>;
  del(...keys: string[]): Promise<unknown>;
  zadd(key: string, entry: { score: number; member: string }): Promise<unknown>;
  zrange<T = unknown>(key: string, min: number, max: number): Promise<T[]>;
  zrem(key: string, ...members: string[]): Promise<unknown>;
  hincrby(key: string, field: string, increment: number): Promise<number>;
  hgetall<T = Record<string, string>>(key: string): Promise<T | null>;
  multi(): SnapshotTransaction;
}

export type SyncRunStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "no-new-candle";

export type SyncStatusRecord = {
  runId: string;
  tradeDate: string;
  status: SyncRunStatus;
  total: number;
  queued: number;
  completed: number;
  failed: number;
  noNewCandle: number;
  startedAt?: string;
  finishedAt?: string;
  lastUpdatedAt: string;
  errorCodes?: Record<string, number>;
};

export type SnapshotWriteResult = {
  written: boolean;
  pointerAdvanced: boolean;
  tradeDate: string;
};

function parseStoredValue<T>(value: unknown): T | null {
  if (value == null) return null;
  if (typeof value !== "string") return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return value as T;
  }
}

function isSetAccepted(result: unknown): boolean {
  return result === "OK" || result === "ok" || result === true || result === 1;
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function tickerKeyPart(ticker: string): string {
  return ticker.trim().toUpperCase();
}

export function rawSnapshotKey(tradeDate: string, ticker: string): string {
  return `${RAW_SNAPSHOT_KEY_PREFIX}${tradeDate}:${tickerKeyPart(ticker)}`;
}

export function latestSnapshotKey(ticker: string): string {
  return `${LATEST_SNAPSHOT_KEY_PREFIX}${tickerKeyPart(ticker)}`;
}

export function tickerDatesKey(ticker: string): string {
  return `${SNAPSHOT_DATES_KEY}:${tickerKeyPart(ticker)}`;
}

export function snapshotDateMember(tradeDate: string, ticker: string): string {
  return `${tradeDate}:${tickerKeyPart(ticker)}`;
}

export function syncStatusKey(runId: string): string {
  return `${SYNC_STATUS_KEY_PREFIX}${runId}`;
}

export function analysisCacheKey(
  engineVersion: string,
  tradeDate: string,
  ticker: string,
): string {
  return `${ANALYSIS_KEY_PREFIX}${engineVersion}:${tradeDate}:${tickerKeyPart(ticker)}`;
}

function syncCounterKey(runId: string): string {
  return `${syncStatusKey(runId)}:counts`;
}

function syncErrorKey(runId: string): string {
  return `${syncStatusKey(runId)}:errors`;
}

function syncResultKey(runId: string, ticker: string): string {
  return `${syncStatusKey(runId)}:result:${tickerKeyPart(ticker)}`;
}

function coerceHash(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      String(item),
    ]),
  );
}

export class SnapshotRepository {
  readonly retentionTradingDays: number;
  private readonly store: SnapshotStoreClient;

  constructor(
    store: SnapshotStoreClient,
    retentionTradingDays = parsePositiveInteger(
      process.env.STOCK_OHLCV_RETENTION_DAYS,
      DEFAULT_OHLCV_RETENTION_TRADING_DAYS,
    ),
  ) {
    this.store = store;
    this.retentionTradingDays = retentionTradingDays;
  }

  async getSnapshotAtKey(key: string): Promise<RawOhlcvSnapshot | null> {
    const value = parseStoredValue<unknown>(await this.store.get(key));
    const validation = validateRawOhlcvSnapshot(value);
    return validation.valid ? validation.snapshot : null;
  }

  async getSnapshot(ticker: string, tradeDate: string): Promise<RawOhlcvSnapshot | null> {
    return this.getSnapshotAtKey(rawSnapshotKey(tradeDate, ticker));
  }

  async getLatestSnapshot(ticker: string): Promise<RawOhlcvSnapshot | null> {
    const pointer = parseStoredValue<unknown>(
      await this.store.get(latestSnapshotKey(ticker)),
    );
    if (!pointer) return null;
    if (typeof pointer === "object") {
      const validation = validateRawOhlcvSnapshot(pointer);
      return validation.valid ? validation.snapshot : null;
    }
    if (typeof pointer !== "string") return null;
    if (pointer.startsWith(RAW_SNAPSHOT_KEY_PREFIX)) {
      return this.getSnapshotAtKey(pointer);
    }
    const validation = validateRawOhlcvSnapshot(parseStoredValue(pointer));
    return validation.valid ? validation.snapshot : null;
  }

  async saveSnapshot(snapshot: RawOhlcvSnapshot): Promise<SnapshotWriteResult> {
    const validation = validateRawOhlcvSnapshot(snapshot);
    if (!validation.valid) {
      const invalid = validation as Extract<typeof validation, { valid: false }>;
      throw new Error(invalid.reason);
    }
    const normalized = validation.snapshot;
    const snapshotKey = rawSnapshotKey(normalized.tradeDate, normalized.ticker);
    const existing = await this.getSnapshotAtKey(snapshotKey);
    const currentLatest = await this.getLatestSnapshot(normalized.ticker);
    const pointerAdvanced =
      !currentLatest || currentLatest.tradeDate <= normalized.tradeDate;
    const shouldWritePayload =
      !existing ||
      stableSerializeSnapshot(existing) !== stableSerializeSnapshot(normalized);

    const transaction = this.store.multi();
    if (shouldWritePayload) transaction.set(snapshotKey, normalized);
    transaction.zadd(SNAPSHOT_DATES_KEY, {
      score: Date.parse(`${normalized.tradeDate}T00:00:00.000Z`),
      member: snapshotDateMember(normalized.tradeDate, normalized.ticker),
    });
    transaction.zadd(tickerDatesKey(normalized.ticker), {
      score: Date.parse(`${normalized.tradeDate}T00:00:00.000Z`),
      member: normalized.tradeDate,
    });
    if (pointerAdvanced) transaction.set(latestSnapshotKey(normalized.ticker), snapshotKey);
    await transaction.exec();

    await this.cleanupTicker(normalized.ticker);
    return {
      written: shouldWritePayload,
      pointerAdvanced,
      tradeDate: normalized.tradeDate,
    };
  }

  private async cleanupTicker(ticker: string): Promise<void> {
    const dates = await this.store.zrange<string>(tickerDatesKey(ticker), 0, -1);
    const staleDates = dates.slice(
      0,
      Math.max(0, dates.length - this.retentionTradingDays),
    );
    if (staleDates.length === 0) return;

    const transaction = this.store.multi();
    for (const date of staleDates) {
      transaction.del(rawSnapshotKey(date, ticker));
      transaction.zrem(tickerDatesKey(ticker), date);
      transaction.zrem(SNAPSHOT_DATES_KEY, snapshotDateMember(date, ticker));
    }
    await transaction.exec();
  }

  async getAnalysis<T = unknown>(
    ticker: string,
    tradeDate: string,
    engineVersion = ANALYSIS_ENGINE_VERSION,
  ): Promise<T | null> {
    return parseStoredValue<T>(
      await this.store.get(analysisCacheKey(engineVersion, tradeDate, ticker)),
    );
  }

  async setAnalysis(
    ticker: string,
    tradeDate: string,
    value: unknown,
    engineVersion = ANALYSIS_ENGINE_VERSION,
  ): Promise<void> {
    const ttl = parsePositiveInteger(
      process.env.STOCK_ANALYSIS_CACHE_TTL_SECONDS,
      24 * 60 * 60,
    );
    await this.store.set(
      analysisCacheKey(engineVersion, tradeDate, ticker),
      value,
      { ex: ttl },
    );
  }

  async acquireLock(runId: string, ttlSeconds = LOCK_TTL_SECONDS): Promise<boolean> {
    const result = await this.store.set(SNAPSHOT_LOCK_KEY, runId, {
      nx: true,
      ex: ttlSeconds,
    });
    return isSetAccepted(result);
  }

  async releaseLock(runId: string): Promise<boolean> {
    const current = await this.store.get<string>(SNAPSHOT_LOCK_KEY);
    if (current !== runId) return false;
    await this.store.del(SNAPSHOT_LOCK_KEY);
    return true;
  }

  async getSyncStatus(runId: string): Promise<SyncStatusRecord | null> {
    const base = parseStoredValue<SyncStatusRecord>(
      await this.store.get(syncStatusKey(runId)),
    );
    if (!base) return null;
    const counters = coerceHash(await this.store.hgetall(syncCounterKey(runId)));
    const errors = coerceHash(await this.store.hgetall(syncErrorKey(runId)));
    const completed = Number(counters.completed ?? base.completed ?? 0);
    const failed = Number(counters.failed ?? base.failed ?? 0);
    const noNewCandle = Number(
      counters["no-new-candle"] ?? base.noNewCandle ?? 0,
    );
    const processed = completed + failed + noNewCandle;
    const total = Number(base.total ?? 0);
    let status = base.status;
    if (total > 0 && processed >= total) {
      status = failed > 0
        ? "failed"
        : noNewCandle === total
          ? "no-new-candle"
          : "completed";
    } else if (processed > 0 && status === "queued") {
      status = "running";
    }
    const mergedErrors = Object.keys(errors).length
      ? Object.fromEntries(
          Object.entries(errors).map(([code, count]) => [code, Number(count)]),
        )
      : base.errorCodes ?? {};
    return {
      ...base,
      status,
      completed,
      failed,
      noNewCandle,
      errorCodes: mergedErrors,
    };
  }

  async setSyncStatus(
    status: Omit<SyncStatusRecord, "lastUpdatedAt"> & { lastUpdatedAt?: string },
  ): Promise<void> {
    const now = new Date().toISOString();
    await this.store.set(
      syncStatusKey(status.runId),
      {
        ...status,
        lastUpdatedAt: status.lastUpdatedAt ?? now,
      },
      { ex: SYNC_STATUS_TTL_SECONDS },
    );
  }

  async recordSyncResult(args: {
    runId: string;
    ticker: string;
    outcome: "completed" | "failed" | "no-new-candle";
    errorCode?: string;
  }): Promise<{ accepted: boolean; status: SyncStatusRecord | null }> {
    const resultKey = syncResultKey(args.runId, args.ticker);
    const previous = parseStoredValue<string>(await this.store.get(resultKey));
    if (previous === args.outcome) {
      if (args.errorCode) {
        await this.store.hincrby(syncErrorKey(args.runId), args.errorCode, 1);
      }
      return { accepted: false, status: await this.getSyncStatus(args.runId) };
    }

    if (previous == null) {
      const claim = await this.store.set(resultKey, args.outcome, {
        nx: true,
        ex: SYNC_STATUS_TTL_SECONDS,
      });
      if (!isSetAccepted(claim)) {
        return { accepted: false, status: await this.getSyncStatus(args.runId) };
      }
    } else {
      await this.store.set(resultKey, args.outcome, { ex: SYNC_STATUS_TTL_SECONDS });
    }
    if (
      previous === "completed" ||
      previous === "failed" ||
      previous === "no-new-candle"
    ) {
      await this.store.hincrby(syncCounterKey(args.runId), previous, -1);
    }
    await this.store.hincrby(syncCounterKey(args.runId), args.outcome, 1);
    if (args.errorCode) {
      await this.store.hincrby(syncErrorKey(args.runId), args.errorCode, 1);
    }
    const status = await this.getSyncStatus(args.runId);
    if (status) {
      const now = new Date().toISOString();
      const processed = status.completed + status.failed + status.noNewCandle;
      const finished = status.total > 0 && processed >= status.total;
      await this.setSyncStatus({
        ...status,
        status: finished ? status.status : "running",
        startedAt: status.startedAt ?? now,
        finishedAt: finished ? status.finishedAt ?? now : undefined,
        lastUpdatedAt: now,
      });
      if (finished) await this.releaseLock(args.runId);
    }
    return { accepted: true, status: await this.getSyncStatus(args.runId) };
  }
}

let defaultRepository: SnapshotRepository | null = null;

export function createRedisSnapshotStore(): SnapshotStoreClient {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) throw new Error("REDIS_NOT_CONFIGURED");
  return new Redis({ url, token }) as unknown as SnapshotStoreClient;
}

export function getSnapshotRepository(): SnapshotRepository {
  if (!defaultRepository) {
    defaultRepository = new SnapshotRepository(createRedisSnapshotStore());
  }
  return defaultRepository;
}

export function resetSnapshotRepositoryForTests(): void {
  defaultRepository = null;
}
