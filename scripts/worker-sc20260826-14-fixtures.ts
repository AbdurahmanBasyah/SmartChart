import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createRawOhlcvSnapshot,
  fetchYahooRawOhlcv,
  getLatestLogicalTradeDate,
  normalizeTicker,
  QSTASH_STOCK_SYNC_CRON,
  RawOhlcvError,
} from "../api/_lib/rawOhlcvSnapshot.js";
import {
  analysisCacheKey,
  SnapshotRepository,
} from "../api/_lib/redisSnapshotStore.js";
import type {
  SnapshotStoreClient,
  SnapshotTransaction,
} from "../api/_lib/redisSnapshotStore.js";
import {
  buildStockSyncScheduleRequest,
  STOCK_SYNC_MAX_PARALLELISM,
  STOCK_SYNC_QSTASH_RETRIES,
  verifyQstashRequest,
} from "../api/_lib/qstash.js";
import type { QStashPublisher } from "../api/_lib/qstash.js";
import {
  runSyncController,
  runSyncTicker,
  STOCK_SYNC_TICKERS,
} from "../api/_lib/stockSync.js";
import { readLatestStockFromRedis } from "../api/_lib/stockReadPath.js";
import syncControllerHandler from "../api/jobs/stocks/sync.js";
import syncTickerHandler from "../api/jobs/stocks/sync-ticker.js";

type StoredValue = unknown;

function clone<T>(value: T): T {
  if (value == null || typeof value === "string" || typeof value === "number") return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

class FakeRedis implements SnapshotStoreClient {
  private readonly values = new Map<string, StoredValue>();
  private readonly expirations = new Map<string, number>();
  private readonly sorted = new Map<string, Map<string, number>>();
  private readonly hashes = new Map<string, Map<string, number>>();
  now = 0;

  advance(ms: number): void {
    this.now += ms;
  }

  private expire(key: string): void {
    const expiry = this.expirations.get(key);
    if (expiry !== undefined && expiry <= this.now) {
      this.values.delete(key);
      this.expirations.delete(key);
    }
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    this.expire(key);
    return this.values.has(key) ? clone(this.values.get(key)) as T : null;
  }

  async set(key: string, value: unknown, options?: { nx?: boolean; ex?: number }): Promise<unknown> {
    this.expire(key);
    if (options?.nx && this.values.has(key)) return null;
    this.values.set(key, clone(value));
    if (options?.ex) this.expirations.set(key, this.now + options.ex * 1000);
    else this.expirations.delete(key);
    return "OK";
  }

  async del(...keys: string[]): Promise<unknown> {
    let deleted = 0;
    for (const key of keys) {
      this.expire(key);
      if (this.values.delete(key)) deleted += 1;
      this.expirations.delete(key);
    }
    return deleted;
  }

  async zadd(key: string, entry: { score: number; member: string }): Promise<unknown> {
    const set = this.sorted.get(key) ?? new Map<string, number>();
    set.set(entry.member, entry.score);
    this.sorted.set(key, set);
    return 1;
  }

  async zrange<T = unknown>(key: string, min: number, max: number): Promise<T[]> {
    const members = Array.from(this.sorted.get(key)?.entries() ?? [])
      .sort(([leftMember, leftScore], [rightMember, rightScore]) =>
        leftScore - rightScore || leftMember.localeCompare(rightMember),
      )
      .map(([member]) => member);
    const start = min < 0 ? Math.max(0, members.length + min) : min;
    const end = max < 0 ? members.length + max : max;
    return members.slice(start, end + 1) as T[];
  }

  async zrem(key: string, ...members: string[]): Promise<unknown> {
    const set = this.sorted.get(key);
    if (!set) return 0;
    let removed = 0;
    for (const member of members) if (set.delete(member)) removed += 1;
    return removed;
  }

  async hincrby(key: string, field: string, increment: number): Promise<number> {
    const hash = this.hashes.get(key) ?? new Map<string, number>();
    const next = (hash.get(field) ?? 0) + increment;
    hash.set(field, next);
    this.hashes.set(key, hash);
    return next;
  }

  async hgetall<T = Record<string, string>>(key: string): Promise<T | null> {
    const hash = this.hashes.get(key);
    if (!hash) return null;
    return Object.fromEntries(Array.from(hash.entries()).map(([field, value]) => [field, String(value)])) as T;
  }

  multi(): SnapshotTransaction {
    const operations: Array<() => Promise<unknown>> = [];
    const transaction: SnapshotTransaction = {
      set: (key, value, options) => {
        operations.push(() => this.set(key, value, options));
        return transaction;
      },
      zadd: (key, entry) => {
        operations.push(() => this.zadd(key, entry));
        return transaction;
      },
      del: (...keys) => {
        operations.push(() => this.del(...keys));
        return transaction;
      },
      zrem: (key, ...members) => {
        operations.push(() => this.zrem(key, ...members));
        return transaction;
      },
      exec: async () => {
        const results: unknown[] = [];
        for (const operation of operations) results.push(await operation());
        return results;
      },
    };
    return transaction;
  }
}

function makeSnapshot(ticker: string, lastDate: string, fetchedAt = "2026-08-26T10:00:00.000Z") {
  const last = Date.parse(`${lastDate}T00:00:00.000Z`);
  const candles = Array.from({ length: 5 }, (_, index) => {
    const time = new Date(last - (4 - index) * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const close = 1000 + index * 10;
    return {
      time,
      open: close - 5,
      high: close + 10,
      low: close - 10,
      close,
      volume: 100_000 + index * 1000,
    };
  });
  return createRawOhlcvSnapshot({ ticker, candles, fetchedAt });
}

function responseForYahoo(timestamps: number[], invalid = false): Response {
  const values = timestamps.map((_, index) => 1000 + index * 10);
  return new Response(
    JSON.stringify({
      chart: {
        result: [{
          timestamp: timestamps,
          indicators: {
            quote: [{
              open: values.map((value) => value - 5),
              high: values.map((value) => invalid ? value - 20 : value + 10),
              low: values.map((value) => value - 10),
              close: values,
              volume: values.map(() => 100_000),
            }],
          },
        }],
      },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

async function main(): Promise<void> {
  assert.equal(normalizeTicker("bbca.jk"), "BBCA");
  assert.equal(normalizeTicker("^jkse"), "IHSG");
  assert.equal(
    getLatestLogicalTradeDate(new Date("2026-08-29T04:00:00.000Z")),
    "2026-08-28",
  );

  const store = new FakeRedis();
  const repository = new SnapshotRepository(store, 2);
  const bbca = makeSnapshot("BBCA", "2026-08-26");
  const firstWrite = await repository.saveSnapshot(bbca);
  const replayWrite = await repository.saveSnapshot(bbca);
  assert.equal(firstWrite.written, true);
  assert.equal(replayWrite.written, false);
  assert.equal((await repository.getLatestSnapshot("BBCA"))?.tradeDate, "2026-08-26");

  await assert.rejects(
    () => repository.saveSnapshot({ ...bbca, isRealData: false } as any),
    /invalid/i,
  );
  await assert.rejects(
    () => repository.saveSnapshot({ ...bbca, candles: [] } as any),
    /invalid|empty/i,
  );
  await assert.rejects(
    () => repository.saveSnapshot({
      ...bbca,
      candles: bbca.candles.map((candle, index) => index === 4 ? { ...candle, high: candle.close - 1 } : candle),
    }),
    /invalid/i,
  );
  assert.equal((await repository.getLatestSnapshot("BBCA"))?.isRealData, true);

  const retentionRepository = new SnapshotRepository(new FakeRedis(), 2);
  await retentionRepository.saveSnapshot(makeSnapshot("TLKM", "2026-08-24"));
  await retentionRepository.saveSnapshot(makeSnapshot("TLKM", "2026-08-25"));
  await retentionRepository.saveSnapshot(makeSnapshot("TLKM", "2026-08-26"));
  assert.equal(await retentionRepository.getSnapshot("TLKM", "2026-08-24"), null);
  assert.equal((await retentionRepository.getLatestSnapshot("TLKM"))?.tradeDate, "2026-08-26");

  assert.notEqual(
    analysisCacheKey("engine-v1", "2026-08-26", "BBCA"),
    analysisCacheKey("engine-v1", "2026-08-27", "BBCA"),
  );
  assert.notEqual(
    analysisCacheKey("engine-v1", "2026-08-26", "BBCA"),
    analysisCacheKey("engine-v2", "2026-08-26", "BBCA"),
  );

  assert.equal(await repository.acquireLock("stale-run", 10), true);
  assert.equal(await repository.acquireLock("blocked-run", 10), false);
  store.advance(10_001);
  assert.equal(await repository.acquireLock("new-run", 10), true);
  await repository.releaseLock("new-run");

  const otherTicker = makeSnapshot("BBRI", "2026-08-26");
  await repository.saveSnapshot(otherTicker);
  await repository.setSyncStatus({
    runId: "duplicate-run",
    tradeDate: "2026-08-26",
    status: "queued",
    total: 1,
    queued: 1,
    completed: 0,
    failed: 0,
    noNewCandle: 0,
  });
  const fetchCalls: string[] = [];
  const successfulTickerRun = {
    message: { runId: "duplicate-run", ticker: "BBCA", tradeDate: "2026-08-26" },
    repository,
    fetchRaw: async (ticker: string) => {
      fetchCalls.push(ticker);
      return bbca;
    },
  };
  const firstTickerResult = await runSyncTicker(successfulTickerRun);
  const replayTickerResult = await runSyncTicker(successfulTickerRun);
  assert.equal(firstTickerResult.status, "completed");
  assert.equal(firstTickerResult.written, false);
  assert.equal(firstTickerResult.idempotent, true);
  assert.equal(replayTickerResult.idempotent, true);
  assert.equal((await repository.getSyncStatus("duplicate-run"))?.completed, 1);
  assert.equal(fetchCalls.length, 2);
  assert.equal((await repository.getLatestSnapshot("BBRI"))?.tradeDate, "2026-08-26");

  const publisherMessages: any[] = [];
  const publisher: QStashPublisher = {
    batchJSON: async (messages) => {
      publisherMessages.push(...messages);
      return messages.map((_, index) => ({ messageId: `fixture-${index}` }));
    },
  };
  const controllerResult = await runSyncController({
    body: {},
    repository,
    publisher,
    destination: "https://example.invalid/api/jobs/stocks/sync-ticker",
    now: new Date("2026-08-26T10:00:00.000Z"),
    tickers: ["BBCA", "BBRI"],
  });
  assert.equal(controllerResult.status, "queued");
  assert.equal(controllerResult.queued, 2);
  assert.equal(publisherMessages[0].flowControl.parallelism, STOCK_SYNC_MAX_PARALLELISM);
  assert.equal(publisherMessages[0].retries, STOCK_SYNC_QSTASH_RETRIES);
  assert.ok(publisherMessages.every((message) => !JSON.stringify(message).includes("buildStockData")));

  const partialPublisher: QStashPublisher = {
    batchJSON: async (messages) => messages.slice(0, 1),
  };
  const partialRepository = new SnapshotRepository(new FakeRedis(), 2);
  const partialResult = await runSyncController({
    body: { runId: "partial-run", tradeDate: "2026-08-26" },
    repository: partialRepository,
    publisher: partialPublisher,
    destination: "https://example.invalid/api/jobs/stocks/sync-ticker",
    tickers: ["BBCA", "BBRI"],
  });
  assert.equal(partialResult.status, "failed");
  assert.equal(partialResult.queued, 1);
  assert.equal((await partialRepository.getSyncStatus("partial-run"))?.errorCodes?.QSTASH_PARTIAL_BATCH, 1);

  await repository.setSyncStatus({
    runId: "failure-run",
    tradeDate: "2026-08-26",
    status: "queued",
    total: 1,
    queued: 1,
    completed: 0,
    failed: 0,
    noNewCandle: 0,
  });
  await assert.rejects(
    () => runSyncTicker({
      message: { runId: "failure-run", ticker: "BBCA", tradeDate: "2026-08-26" },
      repository,
      fetchRaw: async () => {
        throw new RawOhlcvError("PROVIDER_TIMEOUT", "fixture timeout", true);
      },
    }),
    /PROVIDER_TIMEOUT/,
  );
  assert.equal((await repository.getLatestSnapshot("BBRI"))?.ticker, "BBRI");

  await repository.setSyncStatus({
    runId: "retry-run",
    tradeDate: "2026-08-26",
    status: "queued",
    total: 1,
    queued: 1,
    completed: 0,
    failed: 0,
    noNewCandle: 0,
  });
  await repository.recordSyncResult({
    runId: "retry-run",
    ticker: "BBCA",
    outcome: "failed",
    errorCode: "PROVIDER_TIMEOUT",
  });
  await repository.recordSyncResult({
    runId: "retry-run",
    ticker: "BBCA",
    outcome: "completed",
  });
  const recoveredStatus = await repository.getSyncStatus("retry-run");
  assert.equal(recoveredStatus?.failed, 0);
  assert.equal(recoveredStatus?.completed, 1);

  await repository.setSyncStatus({
    runId: "holiday-run",
    tradeDate: "2026-08-26",
    status: "queued",
    total: 1,
    queued: 1,
    completed: 0,
    failed: 0,
    noNewCandle: 0,
  });
  const noNewResult = await runSyncTicker({
    message: { runId: "holiday-run", ticker: "BBCA", tradeDate: "2026-08-26" },
    repository,
    fetchRaw: async () => makeSnapshot("BBCA", "2026-08-25"),
  });
  assert.equal(noNewResult.status, "no-new-candle");
  assert.equal((await repository.getSyncStatus("holiday-run"))?.noNewCandle, 1);

  const dates = ["2026-08-24", "2026-08-25", "2026-08-26", "2026-08-27", "2026-08-28"]
    .map((date) => Math.floor(Date.parse(`${date}T00:00:00.000Z`) / 1000));
  const raw = await fetchYahooRawOhlcv("BBCA.JK", {
    now: new Date("2026-08-29T04:00:00.000Z"),
    fetchImpl: async () => responseForYahoo(dates),
  });
  assert.equal(raw.ticker, "BBCA");
  assert.equal(raw.tradeDate, "2026-08-28");
  assert.equal(raw.isRealData, true);
  assert.equal("recommendation" in (raw as any), false);
  await assert.rejects(
    () => fetchYahooRawOhlcv("BBCA", {
      now: new Date("2026-08-29T04:00:00.000Z"),
      fetchImpl: async () => responseForYahoo(dates, true),
    }),
    /invalid OHLCV/i,
  );

  await repository.saveSnapshot(raw);
  const analyzed = await readLatestStockFromRedis("BBCA", repository);
  assert.equal(analyzed?.isRealData, true);
  assert.equal(analyzed?.tradeDate, "2026-08-28");
  const cached = await repository.getAnalysis("BBCA", "2026-08-28");
  assert.ok(cached);
  const analyzedAgain = await readLatestStockFromRedis("BBCA", repository);
  assert.equal(analyzedAgain?.tradeDate, analyzed?.tradeDate);

  const previousCurrent = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const previousNext = process.env.QSTASH_NEXT_SIGNING_KEY;
  process.env.QSTASH_CURRENT_SIGNING_KEY = "fixture-current-signing-key";
  process.env.QSTASH_NEXT_SIGNING_KEY = "fixture-next-signing-key";
  try {
    const verification = await verifyQstashRequest(
      { body: "{}", headers: { "Upstash-Signature": "invalid-fixture-signature" } },
      "{}",
    );
    assert.equal(verification.ok, false);
    assert.equal(verification.status, 401);

    const makeResponse = () => {
      const state: { status?: number; payload?: unknown } = {};
      const response = {
        setHeader: () => response,
        status: (status: number) => {
          state.status = status;
          return response;
        },
        json: (payload: unknown) => {
          state.payload = payload;
          return response;
        },
        end: () => response,
        state,
      };
      return response;
    };
    const invalidControllerResponse = makeResponse();
    await syncControllerHandler(
      { method: "POST", body: "{}", headers: { "Upstash-Signature": "invalid-fixture-signature" } },
      invalidControllerResponse,
    );
    assert.equal(invalidControllerResponse.state.status, 401);
    assert.deepEqual(invalidControllerResponse.state.payload, { error: "INVALID_QSTASH_SIGNATURE" });

    const invalidTickerResponse = makeResponse();
    await syncTickerHandler(
      { method: "POST", body: JSON.stringify({ runId: "fixture", ticker: "BBCA", tradeDate: "2026-08-26" }), headers: { "Upstash-Signature": "invalid-fixture-signature" } },
      invalidTickerResponse,
    );
    assert.equal(invalidTickerResponse.state.status, 401);
    assert.deepEqual(invalidTickerResponse.state.payload, { error: "INVALID_QSTASH_SIGNATURE" });
  } finally {
    if (previousCurrent === undefined) delete process.env.QSTASH_CURRENT_SIGNING_KEY;
    else process.env.QSTASH_CURRENT_SIGNING_KEY = previousCurrent;
    if (previousNext === undefined) delete process.env.QSTASH_NEXT_SIGNING_KEY;
    else process.env.QSTASH_NEXT_SIGNING_KEY = previousNext;
  }

  const schedule = buildStockSyncScheduleRequest(
    "https://example.invalid/api/jobs/stocks/sync",
  );
  assert.equal(schedule.cron, QSTASH_STOCK_SYNC_CRON);
  assert.equal(schedule.method, "POST");
  assert.equal(schedule.body, "{}");
  assert.equal(STOCK_SYNC_TICKERS.includes("BBCA"), true);

  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const syncSource = readFileSync(resolve(root, "api/_lib/stockSync.ts"), "utf8");
  assert.equal(syncSource.includes("buildStockData"), false);
  assert.equal(syncSource.includes("detectOrderBlocks"), false);
  const inventorySource = readFileSync(resolve(root, "src/components/InventoryChart.tsx"), "utf8");
  assert.equal(inventorySource.includes("navigator.clipboard.write"), true);
  assert.equal(inventorySource.includes("Inventory Chart"), true);
  assert.equal(inventorySource.includes("lg:sticky"), true);
  assert.equal(inventorySource.includes("lg:overflow-y-auto"), true);

  console.log("SC-20260826-14 fixture PASS");
  console.log("raw schema/idempotency: PASS");
  console.log("lock/retention/failure modes: PASS");
  console.log("qstash/signature/scheduled-path contract: PASS");
  console.log("read-through analysis cache: PASS");
  console.log("inventory static UI contract: PASS");
}

main().catch((error) => {
  console.error("SC-20260826-14 fixture FAIL", error instanceof Error ? error.message : "unknown error");
  process.exitCode = 1;
});
