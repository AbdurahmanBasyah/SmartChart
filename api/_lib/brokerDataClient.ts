export interface BrokerDataRow {
  broker_code?: string;
  broker_name?: string;
  bval?: number;
  bvol?: number;
  bfrq?: number;
  sfrq?: number;
  sval?: number;
  svol?: number;
  nval?: number;
  nvol?: number;
}

export interface BrokerDataLevel {
  buy?: BrokerDataRow;
  sell?: BrokerDataRow;
}

export interface BrokerDataSummaryResponse {
  stock_code: string;
  brokers: BrokerDataRow[];
  broker_levels?: BrokerDataLevel[];
  broker_start_date?: string;
  broker_end_date?: string;
  broker_date_min?: string;
  broker_date_max?: string;
  broker_net?: boolean;
  flow?: string;
}

export interface BrokerDataSummaryRequest {
  symbol: string;
  startDate: string;
  endDate: string;
  brokerLimit?: number;
  levelLimit?: number;
}

export interface BrokerDataAccumulationPoint {
  date?: string;
  nval?: number;
  nvol?: number;
  cum_nval?: number;
  bavg?: number;
  savg?: number;
}

export interface BrokerDataAccumulationSeries {
  broker_code?: string;
  broker_name?: string;
  points?: BrokerDataAccumulationPoint[];
}

export interface BrokerDataAccumulationResponse {
  code?: string;
  start_date?: string;
  end_date?: string;
  series: BrokerDataAccumulationSeries[];
  top_buyers?: BrokerDataRow[];
  top_sellers?: BrokerDataRow[];
}

export interface BrokerDataAccumulationRequest {
  symbol: string;
  startDate: string;
  endDate: string;
}

interface SummaryCacheEntry {
  expiresAt: number;
  data: BrokerDataSummaryResponse;
}

interface AccumulationCacheEntry {
  expiresAt: number;
  data: BrokerDataAccumulationResponse;
}

const responseCache = new Map<string, SummaryCacheEntry>();
const accumulationResponseCache = new Map<string, AccumulationCacheEntry>();
const CACHE_TTL_MS = 60_000;

function normalizeTicker(value: string): string {
  return value.trim().toUpperCase().replace(/\.JK$/, '');
}

export function normalizeBrokerDataTicker(value: string): string {
  return normalizeTicker(value);
}

export function isValidCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(date.getTime()) &&
    date.getUTCFullYear() === Number(value.slice(0, 4)) &&
    date.getUTCMonth() + 1 === Number(value.slice(5, 7)) &&
    date.getUTCDate() === Number(value.slice(8, 10))
  );
}

export function validateBrokerDataAccumulationRequest(params: BrokerDataAccumulationRequest): {
  symbol: string;
  startDate: string;
  endDate: string;
} {
  const symbol = normalizeTicker(params.symbol);
  const startDate = params.startDate.trim();
  const endDate = params.endDate.trim();

  if (!symbol || symbol === 'IHSG' || symbol === 'JKSE' || symbol === '^JKSE') {
    throw new Error('Broker data accumulation requires a stock ticker');
  }
  if (!isValidCalendarDate(startDate) || !isValidCalendarDate(endDate)) {
    throw new Error('Dates must use YYYY-MM-DD');
  }
  if (startDate > endDate) {
    throw new Error('start_date must not be after end_date');
  }

  return { symbol, startDate, endDate };
}

function getQueryNumber(value: number | undefined, fallback: number): string {
  const normalized = Number.isFinite(value) ? Math.floor(value as number) : fallback;
  return String(Math.max(1, normalized));
}

function getBrokerDataConfig(): { apiKey: string; baseUrl: string } {
  const apiKey = process.env.BROKER_DATA_API_KEY?.trim();
  const baseUrl = process.env.BROKER_DATA_API_BASE_URL?.trim().replace(/\/$/, '');
  if (!apiKey) throw new Error('BROKER_DATA_API_KEY is not configured');
  if (!baseUrl) throw new Error('BROKER_DATA_API_BASE_URL is not configured');
  return { apiKey, baseUrl };
}

export async function fetchBrokerDataSummary(
  params: BrokerDataSummaryRequest,
): Promise<BrokerDataSummaryResponse> {
  const { apiKey, baseUrl } = getBrokerDataConfig();
  const symbol = normalizeTicker(params.symbol);
  if (!symbol || symbol === 'IHSG' || symbol === 'JKSE' || symbol === '^JKSE') {
    throw new Error('Broker data summary requires a stock ticker');
  }

  const query = new URLSearchParams({
    net: 'false',
    broker_limit: getQueryNumber(params.brokerLimit, 20),
    level_limit: getQueryNumber(params.levelLimit, 25),
    all_data: 'false',
    flow: 'all',
    start_date: params.startDate,
    end_date: params.endDate,
  });
  const url = `${baseUrl}/broker-summary/${encodeURIComponent(symbol)}?${query.toString()}`;
  const cached = responseCache.get(url);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'X-API-Key': apiKey,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`External broker data API responded with HTTP ${response.status}`);
    }

    const data = (await response.json()) as BrokerDataSummaryResponse;
    if (!data || typeof data.stock_code !== 'string' || !Array.isArray(data.brokers)) {
      throw new Error('External broker data API returned an invalid broker summary payload');
    }

    responseCache.set(url, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchBrokerDataAccumulation(
  params: BrokerDataAccumulationRequest,
): Promise<BrokerDataAccumulationResponse> {
  const { symbol, startDate, endDate } = validateBrokerDataAccumulationRequest(params);
  const { apiKey, baseUrl } = getBrokerDataConfig();
  const query = new URLSearchParams({ start_date: startDate, end_date: endDate });
  const url = `${baseUrl}/broker-accumulation/${encodeURIComponent(symbol)}?${query.toString()}`;
  const cached = accumulationResponseCache.get(url);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'X-API-Key': apiKey,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`External broker data API responded with HTTP ${response.status}`);
    }

    const data = (await response.json()) as BrokerDataAccumulationResponse;
    if (!data || typeof data !== 'object' || !Array.isArray(data.series)) {
      throw new Error('External broker data API returned an invalid accumulation payload');
    }

    accumulationResponseCache.set(url, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    return data;
  } finally {
    clearTimeout(timeout);
  }
}
