import {
  buildStockDataFromRawSnapshot,
  getMockStocks,
} from "./stockEngine.js";
import type { StockData } from "./stockEngine.js";
import {
  getSnapshotRepository,
  SnapshotRepository,
} from "./redisSnapshotStore.js";
import { ANALYSIS_ENGINE_VERSION } from "./rawOhlcvSnapshot.js";
import type { RawOhlcvSnapshot } from "./rawOhlcvSnapshot.js";

function isCachedStockData(
  value: unknown,
  snapshot: RawOhlcvSnapshot,
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

export async function readStocksFromRedis(
  repository: SnapshotRepository = getSnapshotRepository(),
  concurrency = 8,
): Promise<StockData[]> {
  const baseStocks = getMockStocks();
  const output = new Array<StockData>(baseStocks.length);
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, concurrency), baseStocks.length);

  const readWorker = async () => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= baseStocks.length) return;
      const base = baseStocks[index];
      const fromRedis = await readLatestStockFromRedis(base.ticker, repository);
      output[index] = fromRedis ?? base;
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => readWorker()));
  return output;
}
