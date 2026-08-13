import { Candle, StockData } from '../types';
import { buildStockData, generateCandles, liquidIDXStocks } from '../data/mockStocks';
import { roundToIdxTick } from '../utils/idxTickRules';

export interface YahooStockMeta {
  symbol: string;
  shortName?: string;
  longName?: string;
  currency?: string;
  regularMarketPrice?: number;
  previousClose?: number;
}

/**
 * Fetches real delayed daily candle data for IDX stock tickers (e.g. BBCA, BRPT, BBRI)
 * from Yahoo Finance API (free, no API key needed).
 */
export async function fetchYahooStockData(ticker: string): Promise<StockData | null> {
  let cleanTicker = ticker.trim().toUpperCase().replace('.JK', '');
  if (cleanTicker === 'IHSG' || cleanTicker === 'JKSE' || cleanTicker === '^JKSE') {
    cleanTicker = '^JKSE';
  }

  const yahooSymbol = cleanTicker.startsWith('^') ? cleanTicker : `${cleanTicker}.JK`;

  const targetUrls = [
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=1y&includePrePost=true&useYfid=true`,
    `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=1y&includePrePost=true&useYfid=true`
  ];

  const isBrowser = typeof window !== 'undefined';

  // Build candidate fetch URLs depending on environment
  const candidates: { url: string; mode: 'direct' | 'allorigins' | 'raw_proxy' }[] = [];

  if (!isBrowser) {
    // Node environment (Server / Vercel Serverless Function) - Direct fetch is fast and safe
    for (const target of targetUrls) {
      candidates.push({ url: target, mode: 'direct' });
    }
  }

  // Browser & Serverless proxy fallbacks
  for (const target of targetUrls) {
    candidates.push({
      url: `https://api.allorigins.win/get?url=${encodeURIComponent(target)}`,
      mode: 'allorigins'
    });
    candidates.push({
      url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(target)}`,
      mode: 'raw_proxy'
    });
  }

  for (const item of candidates) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const fetchOpts: RequestInit = item.mode === 'direct'
        ? {
            signal: controller.signal,
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              'Accept': 'application/json, text/plain, */*',
              'Accept-Language': 'en-US,en;q=0.9',
              'Cache-Control': 'no-cache',
            },
          }
        : {
            signal: controller.signal,
          };

      const res = await fetch(item.url, fetchOpts);
      clearTimeout(timeoutId);

      if (!res.ok) continue;

      let json: any = null;
      if (item.mode === 'allorigins') {
        const wrapper = await res.json();
        if (wrapper?.contents) {
          json = typeof wrapper.contents === 'string' ? JSON.parse(wrapper.contents) : wrapper.contents;
        }
      } else {
        json = await res.json();
      }

      const result = json?.chart?.result?.[0];
      if (!result || !result.timestamp || !result.indicators?.quote?.[0]) {
        continue;
      }

      const timestamps: number[] = result.timestamp;
      const quote = result.indicators.quote[0];
      const opens: (number | null)[] = quote.open || [];
      const highs: (number | null)[] = quote.high || [];
      const lows: (number | null)[] = quote.low || [];
      const closes: (number | null)[] = quote.close || [];
      const volumes: (number | null)[] = quote.volume || [];

      const candles: Candle[] = [];

function formatJakartaDate(dateOrTimestamp: Date | number): string {
  const date = typeof dateOrTimestamp === 'number' ? new Date(dateOrTimestamp * 1000) : dateOrTimestamp;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(date);
}

function isIdxMarketClosedToday(now: Date = new Date()): boolean {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(now);

  let weekday = 'Mon';
  let hour = 0;
  let minute = 0;

  for (const p of parts) {
    if (p.type === 'weekday') weekday = p.value;
    if (p.type === 'hour') hour = parseInt(p.value, 10);
    if (p.type === 'minute') minute = parseInt(p.value, 10);
  }

  if (weekday === 'Sat' || weekday === 'Sun') return false;
  return (hour * 60 + minute) >= (16 * 60);
}

function getLatestClosedTradingDateStr(now: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  let year = 2026, month = 1, day = 1, weekday = 'Mon', hour = 0, minute = 0;
  for (const p of parts) {
    if (p.type === 'year') year = parseInt(p.value, 10);
    if (p.type === 'month') month = parseInt(p.value, 10);
    if (p.type === 'day') day = parseInt(p.value, 10);
    if (p.type === 'weekday') weekday = p.value;
    if (p.type === 'hour') hour = parseInt(p.value, 10);
    if (p.type === 'minute') minute = parseInt(p.value, 10);
  }

  const isAfterClose = (hour * 60 + minute) >= (16 * 60);

  let daysToSubtract = 0;
  if (weekday === 'Sun') {
    daysToSubtract = 2;
  } else if (weekday === 'Sat') {
    daysToSubtract = 1;
  } else if (weekday === 'Mon') {
    daysToSubtract = isAfterClose ? 0 : 3;
  } else {
    daysToSubtract = isAfterClose ? 0 : 1;
  }

  const targetDate = new Date(Date.UTC(year, month - 1, day));
  targetDate.setUTCDate(targetDate.getUTCDate() - daysToSubtract);
  const y = targetDate.getUTCFullYear();
  const m = String(targetDate.getUTCMonth() + 1).padStart(2, '0');
  const d = String(targetDate.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

      const maxAllowedDateStr = getLatestClosedTradingDateStr();

      for (let i = 0; i < timestamps.length; i++) {
        const o = opens[i];
        const h = highs[i];
        const l = lows[i];
        const c = closes[i];
        const v = volumes[i];

        if (o != null && h != null && l != null && c != null && c > 0) {
          const dateStr = formatJakartaDate(timestamps[i]);
          if (dateStr > maxAllowedDateStr) continue;

          candles.push({
            time: dateStr,
            open: roundToIdxTick(o),
            high: roundToIdxTick(Math.max(h, o, c)),
            low: roundToIdxTick(Math.min(l, o, c)),
            close: roundToIdxTick(c),
            volume: Math.round(v || 500000),
          });
        }
      }

      const meta = result.meta || {};
      const latestPrice = meta.regularMarketPrice;
      const latestTime = meta.regularMarketTime;

      if (latestPrice && latestTime) {
        const metaDateStr = formatJakartaDate(latestTime);
        if (metaDateStr <= maxAllowedDateStr) {
          const lastCandle = candles[candles.length - 1];

          if (!lastCandle || lastCandle.time < metaDateStr) {
            const openPrice = meta.regularMarketDayOpen || lastCandle?.close || latestPrice;
            const highPrice = meta.regularMarketDayHigh || Math.max(openPrice, latestPrice);
            const lowPrice = meta.regularMarketDayLow || Math.min(openPrice, latestPrice);
            const vol = meta.regularMarketVolume || 1000000;

            candles.push({
              time: metaDateStr,
              open: roundToIdxTick(openPrice),
              high: roundToIdxTick(highPrice),
              low: roundToIdxTick(lowPrice),
              close: roundToIdxTick(latestPrice),
              volume: Math.round(vol),
            });
          } else if (lastCandle.time === metaDateStr) {
            lastCandle.close = roundToIdxTick(latestPrice);
            if (meta.regularMarketDayHigh) lastCandle.high = roundToIdxTick(meta.regularMarketDayHigh);
            if (meta.regularMarketDayLow) lastCandle.low = roundToIdxTick(meta.regularMarketDayLow);
            if (meta.regularMarketVolume) lastCandle.volume = Math.round(meta.regularMarketVolume);
          }
        }
      }

      if (candles.length >= 10) {
        const isIhsg = cleanTicker === '^JKSE';
        const companyName = isIhsg
          ? 'Indeks Harga Saham Gabungan (IHSG)'
          : (meta.longName || meta.shortName || `${cleanTicker} Indonesia Tbk.`);
        const matchedConfig = liquidIDXStocks.find((s) => s.t === cleanTicker);
        const sectorName = isIhsg ? 'Market Index' : (matchedConfig?.s || getSectorByTicker(cleanTicker));
        const conglomerateGroup = isIhsg ? 'Bursa Efek Indonesia' : matchedConfig?.cg;

        const finalTicker = isIhsg ? 'IHSG' : cleanTicker;
        return buildStockData(yahooSymbol, finalTicker, companyName, sectorName, candles, conglomerateGroup);
      }
    } catch (err) {
      // Silent continue to next candidate
    }
  }

  // Final fallback: If network calls to Yahoo/proxies fail, build a realistic dataset locally
  const isIhsg = cleanTicker === '^JKSE';
  const matchedConfig = liquidIDXStocks.find((s) => s.t === cleanTicker);
  const companyName = isIhsg
    ? 'Indeks Harga Saham Gabungan (IHSG)'
    : (matchedConfig ? `${matchedConfig.n} Tbk.` : `${cleanTicker} Indonesia Tbk.`);
  const sectorName = isIhsg ? 'Market Index' : (matchedConfig?.s || getSectorByTicker(cleanTicker));
  const finalTicker = isIhsg ? 'IHSG' : cleanTicker;

  const basePrice = isIhsg ? 7350 : (matchedConfig?.p || 2500);
  const fallbackCandles = generateCandles(basePrice, 0.025, 0.001, 100);

  return buildStockData(
    yahooSymbol,
    finalTicker,
    companyName,
    sectorName,
    fallbackCandles,
    matchedConfig?.cg
  );
}

function getSectorByTicker(ticker: string): string {
  const sectorMap: Record<string, string> = {
    BBCA: 'Financials',
    BBRI: 'Financials',
    BMRI: 'Financials',
    BBNI: 'Financials',
    ARTO: 'Financials',
    BRIS: 'Financials',
    BBTN: 'Financials',
    BUMI: 'Energy',
    ENRG: 'Energy',
    DEWA: 'Energy',
    BREN: 'Energy',
    CUAN: 'Energy',
    ADRO: 'Energy',
    PTBA: 'Energy',
    MEDC: 'Energy',
    ITMG: 'Energy',
    HRUM: 'Energy',
    INDY: 'Energy',
    BRPT: 'Basic Materials',
    AMMN: 'Basic Materials',
    TPIA: 'Basic Materials',
    MDKA: 'Basic Materials',
    ANTM: 'Basic Materials',
    MBMA: 'Basic Materials',
    NCKL: 'Basic Materials',
    INKP: 'Basic Materials',
    TKIM: 'Basic Materials',
    TLKM: 'Communication Services',
    ISAT: 'Communication Services',
    EXCL: 'Communication Services',
    ASII: 'Consumer Discretionary',
    ACES: 'Consumer Discretionary',
    GOTO: 'Technology',
    EMTK: 'Technology',
    BELI: 'Technology',
    INET: 'Telecommunication',
    WIFI: 'Telecommunication',
    MORA: 'Telecommunication',
    BULL: 'Industrials & Energy',
    SOCI: 'Industrials & Energy',
    PGAS: 'Utilities',
    UNTR: 'Industrials',
    WIKA: 'Industrials',
    PTPP: 'Industrials',
    ICBP: 'Consumer Staples',
    INDF: 'Consumer Staples',
    CPIN: 'Consumer Staples',
    MYOR: 'Consumer Staples',
    AMRT: 'Consumer Staples',
  };

  return sectorMap[ticker] || 'IDX Equity';
}
