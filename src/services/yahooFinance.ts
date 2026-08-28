import type { Candle, StockData } from '../types';
import { buildStockData, liquidIDXStocks, getLatestClosedTradingDateStr, formatJakartaDate } from '../data/mockStocks';
import { normalizeUniverseTicker } from '../../shared/stockUniverse';
import { roundToIdxTick } from '../utils/idxTickRules';
import { canonicalizeCandlePrices } from '../utils/candleNormalization';

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
 * from Yahoo Finance API or local/Vercel server API.
 */
export async function fetchYahooStockData(ticker: string): Promise<StockData | null> {
  const normalizedTicker = normalizeUniverseTicker(ticker);
  const cleanTicker = normalizedTicker === 'IHSG' ? '^JKSE' : normalizedTicker;

  const yahooSymbol = cleanTicker.startsWith('^') ? cleanTicker : `${cleanTicker}.JK`;
  const isBrowser = typeof window !== 'undefined';

  // 1. In Browser: Prefer internal /api/stock endpoint first (fast, pre-calculated SMC, zero CORS issues)
  if (isBrowser) {
    try {
      const apiEndpoints = [
        `/api/stock?symbol=${encodeURIComponent(cleanTicker)}`,
        `/api/stock/${encodeURIComponent(cleanTicker)}`,
      ];
      for (const ep of apiEndpoints) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 3500);
          const res = await fetch(ep, { signal: controller.signal });
          clearTimeout(timer);
          if (res.ok) {
            const data: StockData = await res.json();
            if (data?.isRealData === true && data.candles && data.candles.length > 0) {
              return data;
            }
          }
        } catch (e) {
          // continue to next endpoint
        }
      }
    } catch (e) {
      // continue to fallback
    }
  }

  // 2. Direct Yahoo Finance endpoints
  const targetUrls = [
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=1y&includePrePost=true&useYfid=true`,
    `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=1y&includePrePost=true&useYfid=true`
  ];

  // Build candidate fetch URLs depending on environment
  const candidates: { url: string; mode: 'direct' | 'allorigins' | 'raw_proxy' }[] = [];

  // Direct fetch (works on Node / Serverless / browser if allowed)
  for (const target of targetUrls) {
    candidates.push({ url: target, mode: 'direct' });
  }

  if (isBrowser) {
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
  }

  const todayDateStr = getLatestClosedTradingDateStr();

  for (const item of candidates) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

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

      const isIhsg = cleanTicker === '^JKSE';
      const roundPrice = (p: number) => isIhsg ? Math.round(p) : roundToIdxTick(p, false);

      const candles: Candle[] = [];
      const seenDates = new Set<string>();

      for (let i = 0; i < timestamps.length; i++) {
        const o = opens[i];
        const h = highs[i];
        const l = lows[i];
        const c = closes[i];
        const v = volumes[i];

        // Filter out non-trading days / holidays (volume <= 0 or zero prices)
        if (o != null && h != null && l != null && c != null && c > 0 && v != null && v > 0) {
          const dateStr = formatJakartaDate(timestamps[i]);
          if (dateStr > todayDateStr) continue;

          if (!seenDates.has(dateStr)) {
            seenDates.add(dateStr);
            const canonical = canonicalizeCandlePrices(o, h, l, c, roundPrice);
            candles.push({
              time: dateStr,
              ...canonical,
              volume: Math.round(v),
            });
          }
        }
      }

      const meta = result.meta || {};
      const latestPrice = meta.regularMarketPrice;
      const latestTime = meta.regularMarketTime;

      if (latestPrice && latestTime) {
        const metaDateStr = formatJakartaDate(latestTime);
        if (metaDateStr <= todayDateStr) {
          const lastCandle = candles[candles.length - 1];
          const vol = meta.regularMarketVolume || 0;

          // Only include latest candle if it has valid trading volume or exists
          if (vol > 0) {
            if (!lastCandle || lastCandle.time < metaDateStr) {
              const openPrice = meta.regularMarketDayOpen || lastCandle?.close || latestPrice;
              const highPrice = meta.regularMarketDayHigh || Math.max(openPrice, latestPrice);
              const lowPrice = meta.regularMarketDayLow || Math.min(openPrice, latestPrice);
              const canonical = canonicalizeCandlePrices(openPrice, highPrice, lowPrice, latestPrice, roundPrice);

              candles.push({
                time: metaDateStr,
                ...canonical,
                volume: Math.round(vol),
              });
            } else if (lastCandle.time === metaDateStr) {
              const canonical = canonicalizeCandlePrices(
                meta.regularMarketDayOpen || lastCandle.open,
                meta.regularMarketDayHigh || lastCandle.high,
                meta.regularMarketDayLow || lastCandle.low,
                latestPrice,
                roundPrice,
              );
              Object.assign(lastCandle, canonical);
              if (meta.regularMarketVolume && meta.regularMarketVolume > 0) lastCandle.volume = Math.round(meta.regularMarketVolume);
            }
          }
        }
      }

      if (candles.length >= 10) {
        const companyName = isIhsg
          ? 'Indeks Harga Saham Gabungan (IHSG)'
          : (meta.longName || meta.shortName || `${cleanTicker} Indonesia Tbk.`);
        const matchedConfig = liquidIDXStocks.find((s) => s.t === cleanTicker);
        const sectorName = isIhsg ? 'Market Index' : (matchedConfig?.s || getSectorByTicker(cleanTicker));
        const conglomerateGroup = isIhsg ? 'Bursa Efek Indonesia' : matchedConfig?.cg;

        const finalTicker = isIhsg ? 'IHSG' : cleanTicker;
        const stockData = buildStockData(
          yahooSymbol,
          finalTicker,
          companyName,
          sectorName,
          candles,
          conglomerateGroup,
          true,
        );
        stockData.source = 'YAHOO';
        stockData.isRealData = true;
        stockData.fetchedAt = new Date().toISOString();
        stockData.tradeDate = candles[candles.length - 1]?.time;
        return stockData;
      }
    } catch (err) {
      // Silent continue to next candidate
    }
  }

  // Production callers must surface provider unavailability to the UI/API.
  // Development mock data is opt-in at the application boundary and is never
  // silently returned by this real-provider function.
  return null;
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
