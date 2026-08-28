import {
  CANONICAL_STOCK_TICKERS,
  normalizeUniverseTicker,
} from "../../shared/stockUniverse.js";
import type {
  StockUniverseCoverage,
  StockUniverseEnvelope,
  StockUniverseItem,
  StockUniverseItemSource,
} from "../../src/types.js";
import {
  buildStockDataFromRawSnapshot,
} from "./stockEngine.js";
import type { StockData } from "./stockEngine.js";
import type { AnyRawOhlcvSnapshot } from "./rawOhlcvSnapshot.js";
import {
  getLatestLogicalTradeDate,
} from "./rawOhlcvSnapshot.js";
import {
  getSnapshotRepository,
  SnapshotRepository,
} from "./redisSnapshotStore.js";
import { ANALYSIS_ENGINE_VERSION } from "./rawOhlcvSnapshot.js";

function isCachedStockData(
  value: unknown,
  snapshot: AnyRawOhlcvSnapshot,
): value is StockData {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StockData>;
  return (
    candidate.ticker === snapshot.ticker &&
    candidate.tradeDate === snapshot.tradeDate &&
    candidate.isRealData === true &&
    candidate.source === "YAHOO" &&
    candidate.snapshotSchemaVersion === snapshot.schemaVersion &&
    Array.isArray(candidate.candles) &&
    candidate.candles.length > 0
  );
}

export async function readLatestStockFromRedis(
  ticker: string,
  repository: SnapshotRepository = getSnapshotRepository(),
): Promise<StockData | null> {
  const snapshot = await repository.getLatestSnapshot(ticker);
  if (!snapshot) return null;

  const cached = await repository.getAnalysis<StockData>(
    snapshot.ticker,
    snapshot.tradeDate,
    ANALYSIS_ENGINE_VERSION,
  );
  if (isCachedStockData(cached, snapshot)) return cached;

  const analyzed = buildStockDataFromRawSnapshot(snapshot);
  try {
    await repository.setAnalysis(
      snapshot.ticker,
      snapshot.tradeDate,
      analyzed,
      ANALYSIS_ENGINE_VERSION,
    );
  } catch {
    // Analysis cache is an optimization; a valid raw snapshot is still usable.
  }
  return analyzed;
}

function tradingDayDistance(fromDate: string, toDate: string): number {
  const from = Date.parse(`${fromDate}T00:00:00.000Z`);
  const to = Date.parse(`${toDate}T00:00:00.000Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.round((to - from) / 86_400_000));
}

function freshnessForTradeDate(tradeDate?: string): StockUniverseItem["freshness"] {
  if (!tradeDate) return "UNKNOWN";
  const logicalDate = getLatestLogicalTradeDate();
  const distance = tradingDayDistance(tradeDate, logicalDate);
  if (distance <= 1) return "FRESH";
  if (distance <= 5) return "AGING";
  return "STALE";
}

export function toStockUniverseItem(
  stock: StockData,
  source: StockUniverseItemSource,
): StockUniverseItem {
  const recommendation = stock.recommendation;
  return {
    symbol: stock.symbol,
    ticker: normalizeUniverseTicker(stock.ticker),
    name: stock.name,
    sector: stock.sector,
    conglomerate: stock.conglomerate,
    currentPrice: stock.currentPrice,
    change24h: stock.change24h,
    changePercent24h: stock.changePercent24h,
    recommendation: {
      structure: recommendation.structure,
      entryZone: recommendation.entryZone,
      stopLoss: recommendation.stopLoss,
      stopLossPercent: recommendation.stopLossPercent,
      takeProfit1: recommendation.takeProfit1,
      takeProfit1Percent: recommendation.takeProfit1Percent,
      takeProfit2: recommendation.takeProfit2,
      takeProfit2Percent: recommendation.takeProfit2Percent,
      riskRewardRatio: recommendation.riskRewardRatio,
      volumeConfirmation: recommendation.volumeConfirmation,
      volumeRatio: recommendation.volumeRatio,
      status: recommendation.status,
      primaryZoneType: recommendation.primaryZoneType,
      primaryZonePrice: recommendation.primaryZonePrice,
      isOnBuyArea: recommendation.isOnBuyArea,
    },
    source,
    isRealData: stock.isRealData === true,
    tradeDate: stock.tradeDate,
    fetchedAt: stock.fetchedAt,
    freshness: freshnessForTradeDate(stock.tradeDate),
  };
}

export type CanonicalStocksReadOptions = {
  repository?: SnapshotRepository;
  fetchReal?: (ticker: string) => Promise<StockData | null>;
  concurrency?: number;
  bypassCache?: boolean;
};

export type CanonicalStocksReadResult = {
  items: StockUniverseItem[];
  coverage: StockUniverseCoverage;
  source: StockUniverseEnvelope["source"];
};

let universeCache: { expiresAt: number; result: CanonicalStocksReadResult } | null = null;
let universeInFlight: Promise<CanonicalStocksReadResult> | null = null;
const UNIVERSE_CACHE_TTL_MS = 5 * 60 * 1000;

function resultSource(items: StockUniverseItem[]): StockUniverseEnvelope["source"] {
  if (items.length === 0) return "UNKNOWN";
  const sources = new Set(items.map((item) => item.source));
  if (sources.size === 1) return Array.from(sources)[0] as StockUniverseEnvelope["source"];
  return "MIXED";
}

function buildUniverseResult(items: StockUniverseItem[]): CanonicalStocksReadResult {
  const byTicker = new Map<string, StockUniverseItem>();
  for (const item of items) {
    const ticker = normalizeUniverseTicker(item.ticker);
    if (!byTicker.has(ticker)) byTicker.set(ticker, { ...item, ticker });
  }
  const ordered = CANONICAL_STOCK_TICKERS
    .map((ticker) => byTicker.get(ticker))
    .filter((item): item is StockUniverseItem => Boolean(item));
  const available = ordered.length;
  const logicalDates = ordered
    .map((item) => item.tradeDate)
    .filter((date): date is string => Boolean(date));
  return {
    items: ordered,
    coverage: {
      expected: CANONICAL_STOCK_TICKERS.length,
      available,
      missing: CANONICAL_STOCK_TICKERS.filter((ticker) => !byTicker.has(ticker)),
      partial: available < CANONICAL_STOCK_TICKERS.length,
      asOfDate: logicalDates.sort().at(-1),
      fetchedAt: new Date().toISOString(),
    },
    source: resultSource(ordered),
  };
}

async function readCanonicalStocksUncached(
  options: CanonicalStocksReadOptions,
): Promise<CanonicalStocksReadResult> {
  let repository = options.repository;
  if (!repository) {
    try {
      repository = getSnapshotRepository();
    } catch {
      repository = undefined;
    }
  }
  const fetchReal = options.fetchReal ?? (async (ticker: string) => {
    const { fetchYahooStockDataServer } = await import("./stockEngine.js");
    return fetchYahooStockDataServer(ticker);
  });
  const output = new Array<StockUniverseItem>();
  let nextIndex = 0;
  const workerCount = Math.min(
    Math.max(1, options.concurrency ?? 8),
    CANONICAL_STOCK_TICKERS.length,
  );

  const readWorker = async () => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= CANONICAL_STOCK_TICKERS.length) return;
      const ticker = CANONICAL_STOCK_TICKERS[index];
      let stock: StockData | null = null;
      let source: StockUniverseItemSource = "UNKNOWN";
      if (repository) {
        try {
          stock = await readLatestStockFromRedis(ticker, repository);
          if (stock) source = "REDIS";
        } catch {
          // Redis is an optional real-data cache; Yahoo remains the real source fallback.
        }
      }
      if (!stock) {
        try {
          stock = await fetchReal(ticker);
          if (stock?.isRealData === true) source = "YAHOO";
          else stock = null;
        } catch {
          stock = null;
        }
      }
      if (stock?.isRealData === true) output.push(toStockUniverseItem(stock, source));
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => readWorker()));
  return buildUniverseResult(output);
}

export async function readCanonicalStocks(
  options: CanonicalStocksReadOptions = {},
): Promise<CanonicalStocksReadResult> {
  const isDefaultRead =
    !options.repository && !options.fetchReal && options.concurrency === undefined;
  if (isDefaultRead && !options.bypassCache && universeCache && universeCache.expiresAt > Date.now()) {
    return universeCache.result;
  }
  if (isDefaultRead && !options.bypassCache && universeInFlight) return universeInFlight;
  const request = readCanonicalStocksUncached(options);
  if (!isDefaultRead) return request;
  universeInFlight = request;
  try {
    const result = await request;
    // A zero-real result is an outage signal, not a cacheable success. Keep
    // retrying the provider on the next request while still caching partial
    // real coverage for the bounded TTL.
    if (result.items.length > 0) {
      universeCache = { expiresAt: Date.now() + UNIVERSE_CACHE_TTL_MS, result };
    }
    return result;
  } finally {
    if (universeInFlight === request) universeInFlight = null;
  }
}

export async function readStocksFromRedis(
  repository?: SnapshotRepository,
  concurrency = 8,
): Promise<StockData[]> {
  let activeRepository = repository;
  if (!activeRepository) activeRepository = getSnapshotRepository();
  const output: StockData[] = [];
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, concurrency), CANONICAL_STOCK_TICKERS.length);
  const readWorker = async () => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= CANONICAL_STOCK_TICKERS.length) return;
      try {
        const stock = await readLatestStockFromRedis(CANONICAL_STOCK_TICKERS[index], activeRepository);
        if (stock?.isRealData === true) output.push(stock);
      } catch {
        // Keep only real Redis rows; callers decide whether to use Yahoo fallback.
      }
    }
  };
  await Promise.all(Array.from({ length: workerCount }, () => readWorker()));
  return output;
}
