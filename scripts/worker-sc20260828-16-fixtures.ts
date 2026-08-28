import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CANONICAL_STOCK_COUNT,
  CANONICAL_STOCK_TICKERS,
  CANONICAL_STOCK_UNIVERSE,
  getCanonicalStockConfig,
  normalizeUniverseTicker,
} from "../shared/stockUniverse.js";
import type { CanonicalStockConfig } from "../shared/stockUniverse.js";
import {
  createRawOhlcvSnapshot,
  getLatestLogicalTradeDate,
  LEGACY_RAW_SNAPSHOT_SCHEMA_VERSION,
  RAW_OHLCV_ROLLING_MAX_CANDLES,
  RAW_SNAPSHOT_SCHEMA_VERSION,
  tickerToSnapshotSymbol,
} from "../api/_lib/rawOhlcvSnapshot.js";
import type { RawOhlcvCandle } from "../api/_lib/rawOhlcvSnapshot.js";
import {
  latestSnapshotKey,
  legacyRawSnapshotKey,
  rollingSnapshotKey,
  SnapshotRepository,
} from "../api/_lib/redisSnapshotStore.js";
import type {
  SnapshotStoreClient,
  SnapshotTransaction,
} from "../api/_lib/redisSnapshotStore.js";
import {
  makeMessageDerivedRunId,
  runSyncController,
  runSyncTicker,
} from "../api/_lib/stockSync.js";
import type { QStashPublisher } from "../api/_lib/qstash.js";
import { liquidIDXStocks as engineUniverse } from "../api/_lib/stockEngine.js";
import {
  readCanonicalStocks,
  toStockUniverseItem,
} from "../api/_lib/stockReadPath.js";
import type { StockData } from "../api/_lib/stockEngine.js";

type StoredValue = unknown;

function clone<T>(value: T): T {
  if (value == null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

class FakeRedis implements SnapshotStoreClient {
  private readonly values = new Map<string, StoredValue>();
  private readonly expirations = new Map<string, number>();
  private readonly sorted = new Map<string, Map<string, number>>();
  private readonly hashes = new Map<string, Map<string, number>>();
  now = 0;

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
    return Object.fromEntries(
      Array.from(hash.entries()).map(([field, value]) => [field, String(value)]),
    ) as T;
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

function makeCandles(startIndex: number, count: number): RawOhlcvCandle[] {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(2026, 0, 1 + startIndex + index));
    const close = 1000 + startIndex + index;
    return {
      time: date.toISOString().slice(0, 10),
      open: close - 5,
      high: close + 10,
      low: close - 10,
      close,
      volume: 100_000 + index,
    };
  });
}

function minimalRealStock(ticker: string): StockData {
  const item: CanonicalStockConfig =
    getCanonicalStockConfig(ticker) ?? CANONICAL_STOCK_UNIVERSE[1];
  const recommendation = {
    symbol: tickerToSnapshotSymbol(ticker),
    name: item.n,
    currentPrice: item.p,
    structure: "RALLYING" as const,
    entryZone: [item.p * 0.98, item.p] as [number, number],
    stopLoss: item.p * 0.95,
    stopLossPercent: 5,
    takeProfit1: item.p * 1.1,
    takeProfit1Percent: 10,
    takeProfit2: item.p * 1.2,
    takeProfit2Percent: 20,
    riskRewardRatio: 2,
    volumeConfirmation: true,
    volumeRatio: 1.5,
    decisionReasoning: [],
    smcCatalyst: "fixture",
    status: "NEAR_ENTRY" as const,
    primaryZoneType: "FVG" as const,
    primaryZonePrice: item.p,
  };
  return {
    symbol: tickerToSnapshotSymbol(ticker),
    ticker,
    name: item.n,
    sector: item.s,
    conglomerate: item.cg,
    candles: [],
    swings: [],
    bosChochLines: [],
    fvgs: [],
    orderBlocks: [],
    liquiditySweeps: [],
    supportResistance: [],
    indicators: { ma5: [], ma10: [], ma20: [], ma60: [], ma200: [], vwap: [], volumeMa20: [] },
    recommendation,
    currentPrice: item.p,
    change24h: 10,
    changePercent24h: 1,
    isRealData: true,
    source: "YAHOO",
    fetchedAt: "2026-08-28T10:00:00.000Z",
    tradeDate: "2026-08-28",
    snapshotSchemaVersion: 2,
  };
}

async function main(): Promise<void> {
  assert.equal(CANONICAL_STOCK_COUNT, 125);
  assert.equal(CANONICAL_STOCK_UNIVERSE.length, 125);
  assert.equal(new Set(CANONICAL_STOCK_TICKERS).size, 125);
  assert.equal(CANONICAL_STOCK_TICKERS.filter((ticker) => ticker === "IHSG").length, 1);
  assert.deepEqual(
    CANONICAL_STOCK_TICKERS,
    Array.from(CANONICAL_STOCK_UNIVERSE, (stock) => stock.t),
  );
  assert.deepEqual(
    Array.from(engineUniverse, (stock) => stock.t),
    CANONICAL_STOCK_TICKERS,
  );
  assert.equal(normalizeUniverseTicker("^JKSE"), "IHSG");
  assert.equal(normalizeUniverseTicker("JKSE"), "IHSG");
  assert.equal(normalizeUniverseTicker("IHSG.JK"), "IHSG");

  const beforeClose = new Date("2026-08-28T09:44:00.000Z");
  const atClose = new Date("2026-08-28T09:45:00.000Z");
  assert.equal(getLatestLogicalTradeDate(beforeClose), "2026-08-27");
  assert.equal(getLatestLogicalTradeDate(atClose), "2026-08-28");
  assert.equal(getLatestLogicalTradeDate(new Date("2026-08-29T04:00:00.000Z")), "2026-08-28");

  const expectedDigest = createHash("sha256").update("qstash-message-a", "utf8").digest("hex");
  assert.equal(
    makeMessageDerivedRunId(" qstash-message-a "),
    `stock-sync-${expectedDigest.slice(0, 32)}`,
  );
  assert.equal(makeMessageDerivedRunId("qstash-message-a"), makeMessageDerivedRunId(" qstash-message-a "));
  assert.notEqual(makeMessageDerivedRunId("qstash-message-a"), makeMessageDerivedRunId("qstash-message-b"));

  const syncStore = new FakeRedis();
  const syncRepository = new SnapshotRepository(syncStore);
  const published: any[] = [];
  const publisher: QStashPublisher = {
    batchJSON: async (messages) => {
      published.push(...messages);
      return messages.map((_, index) => ({ messageId: `fixture-${index}` }));
    },
  };
  const firstRun = await runSyncController({
    body: {},
    repository: syncRepository,
    publisher,
    destination: "https://example.invalid/api/jobs/stocks/sync-ticker",
    now: atClose,
    messageId: "qstash-message-a",
  });
  assert.equal(firstRun.total, CANONICAL_STOCK_COUNT);
  assert.equal(firstRun.queued, CANONICAL_STOCK_COUNT);
  const firstStatus = await syncRepository.getSyncStatus(firstRun.runId);
  assert.equal(firstStatus?.expected, CANONICAL_STOCK_COUNT);
  assert.equal(typeof firstStatus?.startedAt, "string");
  assert.equal(published.length, CANONICAL_STOCK_COUNT);
  assert.equal(new Set(published.map((message) => message.body.ticker)).size, CANONICAL_STOCK_COUNT);
  assert.deepEqual(
    new Set(published.map((message) => message.body.ticker)),
    new Set(CANONICAL_STOCK_TICKERS),
  );
  assert.equal(published.every((message) => message.body.tradeDate === "2026-08-28"), true);

  const sameDelivery = await runSyncController({
    body: {},
    repository: syncRepository,
    publisher,
    destination: "https://example.invalid/api/jobs/stocks/sync-ticker",
    now: atClose,
    messageId: "qstash-message-a",
  });
  assert.equal(sameDelivery.runId, firstRun.runId);
  assert.equal(sameDelivery.status, "already-running");
  const publishedBeforeReplayAfterLockRelease = published.length;
  await syncRepository.releaseLock(firstRun.runId);
  const sameDeliveryAfterLockRelease = await runSyncController({
    body: {},
    repository: syncRepository,
    publisher,
    destination: "https://example.invalid/api/jobs/stocks/sync-ticker",
    now: atClose,
    messageId: "qstash-message-a",
  });
  assert.equal(sameDeliveryAfterLockRelease.runId, firstRun.runId);
  assert.equal(sameDeliveryAfterLockRelease.status, "already-running");
  assert.equal(published.length, publishedBeforeReplayAfterLockRelease);
  await syncRepository.setSyncStatus({
    runId: firstRun.runId,
    tradeDate: firstRun.tradeDate,
    status: "completed",
    expected: CANONICAL_STOCK_COUNT,
    total: CANONICAL_STOCK_COUNT,
    queued: CANONICAL_STOCK_COUNT,
    completed: CANONICAL_STOCK_COUNT,
    failed: 0,
    noNewCandle: 0,
  });
  await syncRepository.releaseLock(firstRun.runId);
  const newDelivery = await runSyncController({
    body: {},
    repository: syncRepository,
    publisher,
    destination: "https://example.invalid/api/jobs/stocks/sync-ticker",
    now: atClose,
    messageId: "qstash-message-b",
  });
  assert.notEqual(newDelivery.runId, firstRun.runId);
  assert.equal(newDelivery.status, "queued");

  const earlyRepository = new SnapshotRepository(new FakeRedis());
  const earlyRun = await runSyncController({
    body: { runId: "early-manual", tradeDate: "2026-08-28" },
    repository: earlyRepository,
    publisher,
    destination: "https://example.invalid/api/jobs/stocks/sync-ticker",
    now: atClose,
    tickers: ["BBCA"],
  });
  const earlyNoNew = await runSyncTicker({
    message: {
      runId: earlyRun.runId,
      ticker: "BBCA",
      tradeDate: "2026-08-28",
    },
    repository: earlyRepository,
    fetchRaw: async () => createRawOhlcvSnapshot({
      ticker: "BBCA",
      candles: makeCandles(220, 5),
      fetchedAt: "2026-08-28T09:00:00.000Z",
    }),
  });
  assert.equal(earlyNoNew.status, "no-new-candle");
  await earlyRepository.releaseLock(earlyRun.runId);
  const postCloseAttempt = await runSyncController({
    body: {},
    repository: earlyRepository,
    publisher,
    destination: "https://example.invalid/api/jobs/stocks/sync-ticker",
    now: atClose,
    tickers: ["BBCA"],
    messageId: "post-close-delivery",
  });
  assert.equal(postCloseAttempt.status, "queued");
  assert.notEqual(postCloseAttempt.runId, earlyRun.runId);

  await assert.rejects(
    () => runSyncController({
      body: {},
      repository: new SnapshotRepository(new FakeRedis()),
      publisher,
      destination: "https://example.invalid/api/jobs/stocks/sync-ticker",
      now: atClose,
    }),
    (error: unknown) => error instanceof Error && error.message === "MISSING_QSTASH_MESSAGE_ID",
  );
  const explicitRun = await runSyncController({
    body: { runId: "manual-fixture", tickers: ["BBCA"] },
    repository: new SnapshotRepository(new FakeRedis()),
    publisher,
    destination: "https://example.invalid/api/jobs/stocks/sync-ticker",
    now: atClose,
    tickers: ["BBCA", "BBRI"],
  });
  assert.equal(explicitRun.runId, "manual-fixture");
  assert.equal(explicitRun.total, 2, "internal test injection remains available while HTTP body cannot shrink canonical fanout");

  const rollingStore = new FakeRedis();
  const rollingRepository = new SnapshotRepository(rollingStore);
  const firstSnapshot = createRawOhlcvSnapshot({
    ticker: "BBCA",
    candles: makeCandles(0, 200),
    fetchedAt: "2026-08-28T10:00:00.000Z",
  });
  const secondSnapshot = createRawOhlcvSnapshot({
    ticker: "BBCA",
    candles: makeCandles(100, 200),
    fetchedAt: "2026-08-28T10:01:00.000Z",
  });
  assert.equal((await rollingRepository.saveSnapshot(firstSnapshot)).written, true);
  assert.equal((await rollingRepository.saveSnapshot(secondSnapshot)).written, true);
  const rolling = await rollingRepository.getSnapshotAtKey(rollingSnapshotKey("BBCA"));
  assert.equal(rolling?.schemaVersion, RAW_SNAPSHOT_SCHEMA_VERSION);
  assert.equal(rolling?.candles.length, RAW_OHLCV_ROLLING_MAX_CANDLES);
  assert.equal(new Set(rolling?.candles.map((candle) => candle.time)).size, RAW_OHLCV_ROLLING_MAX_CANDLES);
  assert.equal((await rollingRepository.saveSnapshot(secondSnapshot)).written, false);
  const rollingPayloadBytes = JSON.stringify(rolling).length;
  const olderReplay = await rollingRepository.saveSnapshot(firstSnapshot);
  assert.equal(olderReplay.written, false);
  assert.equal((await rollingRepository.getLatestSnapshot("BBCA"))?.tradeDate, rolling?.tradeDate);

  const legacyCandles = makeCandles(0, 5);
  const legacyDate = legacyCandles[legacyCandles.length - 1].time;
  const legacyKey = legacyRawSnapshotKey(legacyDate, "TLKM");
  const legacySnapshot = {
    schemaVersion: LEGACY_RAW_SNAPSHOT_SCHEMA_VERSION,
    ticker: "TLKM",
    symbol: "TLKM.JK",
    tradeDate: legacyDate,
    fetchedAt: "2026-08-26T10:00:00.000Z",
    source: "YAHOO" as const,
    isRealData: true as const,
    candles: legacyCandles,
  };
  await rollingStore.set(legacyKey, legacySnapshot);
  await rollingStore.set(latestSnapshotKey("TLKM"), legacyKey);
  assert.equal((await rollingRepository.getLatestSnapshot("TLKM"))?.schemaVersion, 1);
  await rollingRepository.saveSnapshot(createRawOhlcvSnapshot({
    ticker: "TLKM",
    candles: legacyCandles,
    fetchedAt: "2026-08-28T10:00:00.000Z",
  }));
  assert.equal((await rollingRepository.getSnapshotAtKey(rollingSnapshotKey("TLKM")))?.schemaVersion, 2);
  assert.ok(await rollingStore.get(legacyKey), "schema supersession must not delete v1 data");

  const invalidLegacyKey = legacyRawSnapshotKey(legacyDate, "BBRI");
  await rollingStore.set(invalidLegacyKey, { ...legacySnapshot, ticker: "BBRI", symbol: "BBRI.JK", isRealData: false });
  await rollingStore.set(latestSnapshotKey("BBRI"), invalidLegacyKey);
  assert.equal(await rollingRepository.getLatestSnapshot("BBRI"), null);

  const missingProviderCalls: string[] = [];
  const missingProviderResult = await readCanonicalStocks({
    repository: new SnapshotRepository(new FakeRedis()),
    fetchReal: async (ticker) => {
      missingProviderCalls.push(ticker);
      return null;
    },
  });
  assert.equal(missingProviderCalls.length, CANONICAL_STOCK_COUNT);
  assert.equal(missingProviderResult.items.length, 0);
  assert.equal(missingProviderResult.coverage.expected, CANONICAL_STOCK_COUNT);
  assert.equal(missingProviderResult.coverage.available, 0);
  assert.equal(missingProviderResult.coverage.missing.length, CANONICAL_STOCK_COUNT);
  assert.equal(missingProviderResult.coverage.partial, true);

  const compactResult = await readCanonicalStocks({
    repository: new SnapshotRepository(new FakeRedis()),
    concurrency: 8,
    fetchReal: async (ticker) => minimalRealStock(ticker),
  });
  assert.equal(compactResult.items.length, CANONICAL_STOCK_COUNT);
  assert.equal(compactResult.coverage.expected, CANONICAL_STOCK_COUNT);
  assert.equal(compactResult.coverage.available, CANONICAL_STOCK_COUNT);
  assert.equal(compactResult.coverage.partial, false);
  assert.deepEqual(new Set(compactResult.items.map((item) => item.ticker)), new Set(CANONICAL_STOCK_TICKERS));
  const compactBody = JSON.stringify({ success: true, source: compactResult.source, data: compactResult.items, coverage: compactResult.coverage });
  assert.ok(compactBody.length < 2 * 1024 * 1024);
  assert.equal(compactResult.items.some((item) => "candles" in (item as any)), false);
  assert.equal(compactResult.items.some((item) => "indicators" in (item as any)), false);
  assert.equal(compactResult.items[0].isRealData, true);
  assert.equal(toStockUniverseItem(minimalRealStock("IHSG"), "REDIS").ticker, "IHSG");
  const compactPayloadBytes = compactBody.length;

  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const stockEngineSource = readFileSync(resolve(root, "api/_lib/stockEngine.ts"), "utf8");
  const stockRouteSource = readFileSync(resolve(root, "api/stock.ts"), "utf8");
  const stocksRouteSource = readFileSync(resolve(root, "api/stocks.ts"), "utf8");
  const screenerSource = readFileSync(resolve(root, "api/screener.ts"), "utf8");
  const serverSource = readFileSync(resolve(root, "server.ts"), "utf8");
  assert.equal(stockEngineSource.includes("naraEvidenceEngine.js"), true);
  assert.equal(stockEngineSource.includes("export function getMockStocks"), false);
  assert.equal(stockEngineSource.includes("generateCandles"), false);
  assert.equal(stockRouteSource.includes("REAL_STOCK_DATA_UNAVAILABLE"), true);
  assert.equal(stocksRouteSource.includes("success: true"), true);
  assert.equal(stocksRouteSource.includes("getMockStocks"), false);
  assert.equal(screenerSource.includes("filteredCount"), true);
  assert.equal(serverSource.includes("SMARTCHART_DEV_MOCKS"), true);
  assert.equal(serverSource.includes("generateCandles"), false);
  assert.equal(serverSource.includes("'GOTO'"), false);

  const stockHandler = (await import("../api/stock.ts")).default;
  const stocksHandler = (await import("../api/stocks.ts")).default;
  const screenerHandler = (await import("../api/screener.ts")).default;
  await import("../api/jobs/stocks/sync.ts");
  await import("../api/jobs/stocks/sync-ticker.ts");

  const makeResponse = () => {
    const state: { status?: number; payload?: any } = {};
    const response = {
      setHeader: () => response,
      removeHeader: () => response,
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
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error("fixture provider unavailable");
  }) as typeof fetch;
  try {
    const stockResponse = makeResponse();
    await stockHandler({ method: "GET", query: { symbol: "BBCA" }, url: "/api/stock?symbol=BBCA" }, stockResponse);
    assert.equal(stockResponse.state.status, 503);
    assert.deepEqual(stockResponse.state.payload, {
      success: false,
      error: "REAL_STOCK_DATA_UNAVAILABLE",
      ticker: "BBCA",
    });
    const stocksResponse = makeResponse();
    await stocksHandler({ method: "GET", query: {}, url: "/api/stocks" }, stocksResponse);
    assert.equal(stocksResponse.state.status, 503);
    assert.equal(stocksResponse.state.payload?.error, "REAL_STOCK_DATA_UNAVAILABLE");
    const screenerResponse = makeResponse();
    await screenerHandler({ method: "GET", query: {}, url: "/api/screener" }, screenerResponse);
    assert.equal(screenerResponse.state.status, 503);
    assert.equal(screenerResponse.state.payload?.error, "REAL_STOCK_DATA_UNAVAILABLE");
  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log("SC-20260828-16 fixture PASS");
  console.log("canonical 125 / normalized aliases / unique IHSG: PASS");
  console.log("SHA-256 delivery identity / 16:45 logical date / 125 fanout: PASS");
  console.log("rolling schema v2 / 260-candle cap / v1 read compatibility: PASS");
  console.log("compact real-only envelope / coverage / size guard: PASS");
  console.log(`fixture payload bytes: compact=${compactPayloadBytes}, rolling=${rollingPayloadBytes}`);
  console.log(`provider-missing fixture: ${missingProviderCalls.length} unavailable / zero synthetic success: PASS`);
  console.log("ESM route import and no-dummy static audit: PASS");
}

main().catch((error) => {
  console.error(
    "SC-20260828-16 fixture FAIL",
    error instanceof Error ? error.message : "unknown error",
  );
  process.exitCode = 1;
});
