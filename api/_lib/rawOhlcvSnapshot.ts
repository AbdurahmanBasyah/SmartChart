export const RAW_SNAPSHOT_SCHEMA_VERSION = 2 as const;
export const LEGACY_RAW_SNAPSHOT_SCHEMA_VERSION = 1 as const;
export const RAW_OHLCV_ROLLING_MAX_CANDLES = 260;
export const DEFAULT_OHLCV_RETENTION_TRADING_DAYS = RAW_OHLCV_ROLLING_MAX_CANDLES;
export const ANALYSIS_ENGINE_VERSION = "sc20260828-16.v2";
export const QSTASH_STOCK_SYNC_CRON = "CRON_TZ=Asia/Jakarta 45 16 * * 1-5";

export type RawOhlcvCandle = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type RawOhlcvSnapshot = {
  schemaVersion: typeof RAW_SNAPSHOT_SCHEMA_VERSION;
  ticker: string;
  symbol: string;
  tradeDate: string;
  fetchedAt: string;
  source: "YAHOO";
  isRealData: true;
  candles: RawOhlcvCandle[];
};

export type LegacyRawOhlcvSnapshot = {
  schemaVersion: typeof LEGACY_RAW_SNAPSHOT_SCHEMA_VERSION;
  ticker: string;
  symbol: string;
  tradeDate: string;
  fetchedAt: string;
  source: "YAHOO";
  isRealData: true;
  candles: RawOhlcvCandle[];
};

export type AnyRawOhlcvSnapshot = RawOhlcvSnapshot | LegacyRawOhlcvSnapshot;

export type RawOhlcvValidation =
  | { valid: true; snapshot: RawOhlcvSnapshot }
  | { valid: false; code: RawOhlcvErrorCode; reason: string };

export type StoredRawOhlcvValidation =
  | { valid: true; snapshot: AnyRawOhlcvSnapshot }
  | { valid: false; code: RawOhlcvErrorCode; reason: string };

export type RawOhlcvErrorCode =
  | "INVALID_TICKER"
  | "INVALID_OHLC"
  | "EMPTY_RESPONSE"
  | "NO_NEW_CANDLE"
  | "PROVIDER_HTTP"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_UNAVAILABLE";

export class RawOhlcvError extends Error {
  readonly code: RawOhlcvErrorCode;
  readonly retryable: boolean;

  constructor(code: RawOhlcvErrorCode, reason: string, retryable = false) {
    super(reason);
    this.name = "RawOhlcvError";
    this.code = code;
    this.retryable = retryable;
  }
}

export function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function formatJakartaDate(dateOrTimestamp: Date | number): string {
  const date =
    typeof dateOrTimestamp === "number"
      ? new Date(dateOrTimestamp * 1000)
      : dateOrTimestamp;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = new Map(
    parts
      .filter(
        (part) =>
          part.type === "year" || part.type === "month" || part.type === "day",
      )
      .map((part) => [part.type, part.value]),
  );
  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
}

function jakartaDateParts(now: Date): Map<string, string> {
  return new Map(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Jakarta",
      weekday: "short",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
}

function previousWeekday(date: Date): Date {
  const result = new Date(date.getTime());
  do {
    result.setUTCDate(result.getUTCDate() - 1);
  } while (result.getUTCDay() === 0 || result.getUTCDay() === 6);
  return result;
}

export function getLatestLogicalTradeDate(now: Date = new Date()): string {
  const parts = jakartaDateParts(now);
  const weekday = parts.get("weekday");
  const target = new Date(
    Date.UTC(
      Number(parts.get("year")),
      Number(parts.get("month")) - 1,
      Number(parts.get("day")),
    ),
  );

  if (weekday === "Sat" || weekday === "Sun") {
    while (target.getUTCDay() === 0 || target.getUTCDay() === 6) {
      target.setUTCDate(target.getUTCDate() - 1);
    }
    return target.toISOString().slice(0, 10);
  }

  const hour = Number(parts.get("hour") ?? 0);
  const minute = Number(parts.get("minute") ?? 0);
  if (hour < 16 || (hour === 16 && minute < 45)) {
    return previousWeekday(target).toISOString().slice(0, 10);
  }
  return target.toISOString().slice(0, 10);
}

export function normalizeTicker(value: unknown): string {
  const raw = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\.JK$/, "");
  if (raw === "IHSG" || raw === "JKSE" || raw === "^JKSE") return "IHSG";
  if (!/^[A-Z0-9][A-Z0-9-]{0,15}$/.test(raw)) {
    throw new RawOhlcvError("INVALID_TICKER", "Ticker format is invalid");
  }
  return raw;
}

export function tickerToYahooSymbol(ticker: string): string {
  return normalizeTicker(ticker) === "IHSG"
    ? "^JKSE"
    : `${normalizeTicker(ticker)}.JK`;
}

export function tickerToSnapshotSymbol(ticker: string): string {
  return normalizeTicker(ticker) === "IHSG"
    ? "^JKSE"
    : `${normalizeTicker(ticker)}.JK`;
}

function isRawCandle(value: unknown): value is RawOhlcvCandle {
  if (!value || typeof value !== "object") return false;
  const candle = value as Partial<RawOhlcvCandle>;
  return (
    typeof candle.time === "string" &&
    typeof candle.open === "number" &&
    typeof candle.high === "number" &&
    typeof candle.low === "number" &&
    typeof candle.close === "number" &&
    typeof candle.volume === "number"
  );
}

function validateCandle(candle: RawOhlcvCandle): boolean {
  return (
    isValidIsoDate(candle.time) &&
    Number.isFinite(candle.open) &&
    Number.isFinite(candle.high) &&
    Number.isFinite(candle.low) &&
    Number.isFinite(candle.close) &&
    Number.isFinite(candle.volume) &&
    candle.open > 0 &&
    candle.high > 0 &&
    candle.low > 0 &&
    candle.close > 0 &&
    candle.volume >= 0 &&
    candle.high >= Math.max(candle.open, candle.close) &&
    candle.low <= Math.min(candle.open, candle.close)
  );
}

export function sortAndDedupeCandles(
  candles: RawOhlcvCandle[],
  maxCandles = RAW_OHLCV_ROLLING_MAX_CANDLES,
): RawOhlcvCandle[] {
  const byDate = new Map<string, RawOhlcvCandle>();
  for (const candle of candles) {
    if (isRawCandle(candle)) byDate.set(candle.time, { ...candle });
  }
  const sorted = Array.from(byDate.values()).sort((left, right) =>
    left.time.localeCompare(right.time),
  );
  return maxCandles > 0 ? sorted.slice(-maxCandles) : sorted;
}

function validateSnapshotEnvelope(
  candidate: unknown,
  expectedVersion: 1 | 2,
): { valid: true; snapshot: AnyRawOhlcvSnapshot } | { valid: false; code: RawOhlcvErrorCode; reason: string } {
  if (!candidate || typeof candidate !== "object") {
    return { valid: false, code: "EMPTY_RESPONSE", reason: "Snapshot is empty" };
  }

  const value = candidate as Partial<AnyRawOhlcvSnapshot>;
  let ticker: string;
  try {
    ticker = normalizeTicker(value.ticker);
  } catch (error) {
    return {
      valid: false,
      code: "INVALID_TICKER",
      reason: error instanceof Error ? error.message : "Ticker format is invalid",
    };
  }

  const inputCandles = Array.isArray(value.candles) ? value.candles : [];
  const candles = sortAndDedupeCandles(inputCandles as RawOhlcvCandle[]);
  if (
    value.schemaVersion !== expectedVersion ||
    value.source !== "YAHOO" ||
    value.isRealData !== true ||
    value.symbol !== tickerToSnapshotSymbol(ticker) ||
    !isValidIsoDate(String(value.tradeDate ?? "")) ||
    typeof value.fetchedAt !== "string" ||
    Number.isNaN(Date.parse(value.fetchedAt)) ||
    inputCandles.length === 0 ||
    candles.length === 0 ||
    (expectedVersion === RAW_SNAPSHOT_SCHEMA_VERSION &&
      inputCandles.length > RAW_OHLCV_ROLLING_MAX_CANDLES)
  ) {
    return { valid: false, code: "INVALID_OHLC", reason: "Snapshot envelope is invalid" };
  }

  for (const candle of inputCandles) {
    if (!isRawCandle(candle) || !validateCandle(candle)) {
      return { valid: false, code: "INVALID_OHLC", reason: "Candle OHLCV is invalid" };
    }
  }

  for (let index = 1; index < candles.length; index += 1) {
    if (candles[index - 1].time >= candles[index].time) {
      return {
        valid: false,
        code: "INVALID_OHLC",
        reason: "Candle dates are not strictly increasing",
      };
    }
  }

  const tradeDate = String(value.tradeDate);
  if (candles[candles.length - 1].time !== tradeDate) {
    return {
      valid: false,
      code: "INVALID_OHLC",
      reason: "Trade date is not the last candle date",
    };
  }

  const normalizedBase = {
    ticker,
    symbol: tickerToSnapshotSymbol(ticker),
    tradeDate,
    fetchedAt: new Date(value.fetchedAt as string).toISOString(),
    source: "YAHOO" as const,
    isRealData: true as const,
    candles,
  };
  return expectedVersion === RAW_SNAPSHOT_SCHEMA_VERSION
    ? { valid: true, snapshot: { schemaVersion: 2, ...normalizedBase } }
    : { valid: true, snapshot: { schemaVersion: 1, ...normalizedBase } };
}

export function validateRawOhlcvSnapshot(
  candidate: unknown,
): RawOhlcvValidation {
  const validation = validateSnapshotEnvelope(candidate, RAW_SNAPSHOT_SCHEMA_VERSION);
  if (validation.valid === false) {
    return validation as Extract<RawOhlcvValidation, { valid: false }>;
  }
  return { valid: true, snapshot: validation.snapshot as RawOhlcvSnapshot };
}

export function validateStoredRawOhlcvSnapshot(
  candidate: unknown,
): StoredRawOhlcvValidation {
  if (
    candidate &&
    typeof candidate === "object" &&
    (candidate as { schemaVersion?: unknown }).schemaVersion ===
      LEGACY_RAW_SNAPSHOT_SCHEMA_VERSION
  ) {
    const validation = validateSnapshotEnvelope(
      candidate,
      LEGACY_RAW_SNAPSHOT_SCHEMA_VERSION,
    );
    return validation.valid
      ? { valid: true, snapshot: validation.snapshot as LegacyRawOhlcvSnapshot }
      : validation;
  }
  return validateRawOhlcvSnapshot(candidate);
}

export function createRawOhlcvSnapshot(args: {
  ticker: string;
  candles: RawOhlcvCandle[];
  fetchedAt?: string;
}): RawOhlcvSnapshot {
  const ticker = normalizeTicker(args.ticker);
  const candles = sortAndDedupeCandles(args.candles);
  const validation = validateRawOhlcvSnapshot({
    schemaVersion: RAW_SNAPSHOT_SCHEMA_VERSION,
    ticker,
    symbol: tickerToSnapshotSymbol(ticker),
    tradeDate: candles[candles.length - 1]?.time ?? "",
    fetchedAt: args.fetchedAt ?? new Date().toISOString(),
    source: "YAHOO",
    isRealData: true,
    candles,
  });
  if (!validation.valid) {
    const invalid = validation as Extract<RawOhlcvValidation, { valid: false }>;
    throw new RawOhlcvError(invalid.code, invalid.reason);
  }
  return validation.snapshot;
}

export function stableSerializeSnapshot(snapshot: AnyRawOhlcvSnapshot): string {
  return JSON.stringify({
    schemaVersion: snapshot.schemaVersion,
    ticker: snapshot.ticker,
    symbol: snapshot.symbol,
    tradeDate: snapshot.tradeDate,
    fetchedAt: snapshot.fetchedAt,
    source: snapshot.source,
    isRealData: snapshot.isRealData,
    candles: snapshot.candles.map((candle) => ({
      time: candle.time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
    })),
  });
}

type YahooFetchOptions = {
  fetchImpl?: typeof fetch;
  now?: Date;
  timeoutMs?: number;
};

export async function fetchYahooRawOhlcv(
  tickerInput: string,
  options: YahooFetchOptions = {},
): Promise<RawOhlcvSnapshot> {
  const ticker = normalizeTicker(tickerInput);
  const yahooSymbol = tickerToYahooSymbol(ticker);
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=1y&includePrePost=true&useYfid=true`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetchImpl(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "SmartChart/1.0",
        Accept: "application/json, text/plain, */*",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    clearTimeout(timeout);
    if (controller.signal.aborted) {
      throw new RawOhlcvError("PROVIDER_TIMEOUT", "Yahoo request timed out", true);
    }
    throw new RawOhlcvError(
      "PROVIDER_UNAVAILABLE",
      error instanceof Error
        ? "Yahoo provider request failed"
        : "Yahoo provider unavailable",
      true,
    );
  }
  clearTimeout(timeout);

  if (!response.ok) {
    const retryable =
      response.status === 408 || response.status === 429 || response.status >= 500;
    throw new RawOhlcvError(
      "PROVIDER_HTTP",
      `Yahoo provider returned HTTP ${response.status}`,
      retryable,
    );
  }

  let json: any;
  try {
    json = await response.json();
  } catch {
    throw new RawOhlcvError("EMPTY_RESPONSE", "Yahoo provider returned invalid JSON", true);
  }

  const result = json?.chart?.result?.[0];
  const timestamps = result?.timestamp;
  const quote = result?.indicators?.quote?.[0];
  if (!Array.isArray(timestamps) || !quote || !Array.isArray(quote.open)) {
    throw new RawOhlcvError("EMPTY_RESPONSE", "Yahoo provider returned no OHLCV candles");
  }

  const latestAllowedDate = getLatestLogicalTradeDate(options.now ?? new Date());
  const candles: RawOhlcvCandle[] = [];
  const seenDates = new Set<string>();
  for (let index = 0; index < timestamps.length; index += 1) {
    const timestamp = Number(timestamps[index]);
    const open = quote.open[index];
    const high = quote.high?.[index];
    const low = quote.low?.[index];
    const close = quote.close?.[index];
    const volume = quote.volume?.[index] ?? 0;
    if ([open, high, low, close].every((item) => item == null)) continue;
    if ([open, high, low, close, volume].some((item) => item == null)) continue;
    const time = formatJakartaDate(timestamp);
    if (!isValidIsoDate(time) || time > latestAllowedDate || seenDates.has(time)) continue;
    const candle = {
      time,
      open: Number(open),
      high: Number(high),
      low: Number(low),
      close: Number(close),
      volume: Number(volume),
    };
    if (!validateCandle(candle)) {
      throw new RawOhlcvError("INVALID_OHLC", "Yahoo provider returned invalid OHLCV", false);
    }
    seenDates.add(time);
    candles.push(candle);
  }

  const normalizedCandles = sortAndDedupeCandles(candles);
  if (normalizedCandles.length < 5) {
    throw new RawOhlcvError("NO_NEW_CANDLE", "Yahoo provider has no usable closed candle", false);
  }
  return createRawOhlcvSnapshot({ ticker, candles: normalizedCandles });
}
