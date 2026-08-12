import { Candle, StockData } from '../types';
import { buildStockData, liquidIDXStocks } from '../data/mockStocks';
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

  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  ];

  const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];

  // Prepare full list of endpoints.
  // In browser environments (e.g. Vercel static deployment), direct calls to query1/query2.finance.yahoo.com fail CORS preflight.
  // We use CORS proxies directly in browser to avoid browser CORS errors.
  const isBrowser = typeof window !== 'undefined';
  const targetUrls = [
    `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=1y`,
    `https://query2.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=1y`
  ];

  const urls: string[] = [];
  if (isBrowser) {
    for (const target of targetUrls) {
      urls.push(`https://corsproxy.io/?${encodeURIComponent(target)}`);
      urls.push(`https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`);
      urls.push(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(target)}`);
    }
  } else {
    for (const target of targetUrls) {
      urls.push(target);
      urls.push(`https://corsproxy.io/?${encodeURIComponent(target)}`);
    }
  }

  for (const url of urls) {
    try {
      const isProxy = url.includes('allorigins') || url.includes('corsproxy') || url.includes('codetabs');
      const fetchOpts: RequestInit = (isProxy || isBrowser)
        ? {}
        : {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
              'Accept': 'application/json, text/plain, */*',
              'Accept-Language': 'en-US,en;q=0.9',
              'Cache-Control': 'no-cache',
            },
          };

      const res = await fetch(url, fetchOpts);

      if (!res.ok) continue;

      const json = await res.json();
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

      for (let i = 0; i < timestamps.length; i++) {
        const o = opens[i];
        const h = highs[i];
        const l = lows[i];
        const c = closes[i];
        const v = volumes[i];

        if (o != null && h != null && l != null && c != null && c > 0) {
          const date = new Date(timestamps[i] * 1000);
          const dateStr = date.toISOString().split('T')[0];

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

      if (candles.length >= 10) {
        const meta = result.meta || {};
        const isIhsg = cleanTicker === '^JKSE';
        const companyName = isIhsg ? 'Indeks Harga Saham Gabungan (IHSG)' : (meta.longName || meta.shortName || `${cleanTicker} Indonesia Tbk.`);
        const matchedConfig = liquidIDXStocks.find((s) => s.t === cleanTicker);
        const sectorName = isIhsg ? 'Market Index' : (matchedConfig?.s || getSectorByTicker(cleanTicker));
        const conglomerateGroup = isIhsg ? 'Bursa Efek Indonesia' : matchedConfig?.cg;

        const finalTicker = isIhsg ? 'IHSG' : cleanTicker;
        return buildStockData(yahooSymbol, finalTicker, companyName, sectorName, candles, conglomerateGroup);
      }
    } catch (err) {
      console.warn(`Error fetching ${yahooSymbol} from ${url}:`, err);
    }
  }

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
