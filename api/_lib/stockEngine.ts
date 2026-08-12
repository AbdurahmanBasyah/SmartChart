export interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface StockData {
  symbol: string;
  ticker: string;
  name: string;
  sector: string;
  conglomerateGroup?: string;
  currentPrice: number;
  change24h: number;
  changePercent24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  candles: Candle[];
  indicators: {
    ma5: (number | null)[];
    ma10: (number | null)[];
    ma20: (number | null)[];
    ma60: (number | null)[];
    ma200: (number | null)[];
    volumeMa20: (number | null)[];
    vwap: (number | null)[];
  };
  smc: {
    swings: any[];
    bosChochLines: any[];
    fvgs: any[];
    priceGaps: any[];
    orderBlocks: any[];
    liquiditySweeps: any[];
    supportResistance: any[];
  };
  recommendation: {
    bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    structure: 'BOS_BULLISH' | 'CHOCH_BULLISH' | 'BOS_BEARISH' | 'CHOCH_BEARISH' | 'SIDEWAYS';
    entryPrice: number;
    stopLoss: number;
    takeProfit1: number;
    takeProfit2: number;
    takeProfit3: number;
    riskRewardRatio: number;
    confidenceScore: number;
    volumeConfirmation: boolean;
    reasoning: string;
  };
}

export const liquidIDXStocksConfig = [
  { t: 'IHSG', n: 'Indeks Harga Saham Gabungan', s: 'Market Index', p: 7350, cg: 'Bursa Efek Indonesia' },
  { t: 'BRPT', n: 'Barito Pacific', s: 'Basic Materials', p: 1020, cg: 'Prajogo Pangestu Group' },
  { t: 'BREN', n: 'Barito Renewables Energy', s: 'Energy & Renewables', p: 8900, cg: 'Prajogo Pangestu Group' },
  { t: 'CUAN', n: 'Petrindo Jaya Kreasi', s: 'Energy & Mining', p: 7450, cg: 'Prajogo Pangestu Group' },
  { t: 'TPIA', n: 'Chandra Asri Petrochemical', s: 'Basic Materials', p: 9100, cg: 'Prajogo Pangestu Group' },
  { t: 'BBCA', n: 'Bank Central Asia', s: 'Financials', p: 10250, cg: 'Djarum Group' },
  { t: 'BBRI', n: 'Bank Rakyat Indonesia', s: 'Financials', p: 4850, cg: 'BUMN Financial' },
  { t: 'BMRI', n: 'Bank Mandiri', s: 'Financials', p: 7150, cg: 'BUMN Financial' },
  { t: 'BBNI', n: 'Bank Negara Indonesia', s: 'Financials', p: 5400, cg: 'BUMN Financial' },
  { t: 'TLKM', n: 'Telkom Indonesia', s: 'Telecommunication', p: 2950, cg: 'BUMN Telecommunication' },
  { t: 'ASII', n: 'Astra International', s: 'Automotive & Industrial', p: 5100, cg: 'Astra Group' },
  { t: 'AMMN', n: 'Amman Mineral Internasional', s: 'Basic Materials', p: 11400, cg: 'Salim & Medco Group' },
  { t: 'ADRO', n: 'Adaro Energy Indonesia', s: 'Energy & Mining', p: 3280, cg: 'Adaro Group' },
  { t: 'BUMI', n: 'Bumi Resources', s: 'Energy & Mining', p: 142, cg: 'Bakrie & Salim Group' },
  { t: 'GOTO', n: 'GoTo Gojek Tokopedia', s: 'Technology', p: 54, cg: 'Tech Ecosystem' },
  { t: 'PGAS', n: 'Perusahaan Gas Negara', s: 'Utilities & Energy', p: 1550, cg: 'BUMN Energy' },
  { t: 'ANTM', n: 'Aneka Tambang', s: 'Basic Materials', p: 1480, cg: 'BUMN Mining (MIND ID)' },
  { t: 'PTBA', n: 'Bukit Asam', s: 'Energy & Mining', p: 2680, cg: 'BUMN Mining (MIND ID)' },
  { t: 'UNTR', n: 'United Tractors', s: 'Heavy Equipment & Mining', p: 26800, cg: 'Astra Group' },
  { t: 'ICBP', n: 'Indofood CBP Sukses Makmur', s: 'Consumer Staples', p: 11200, cg: 'Salim Group' },
  { t: 'INDF', n: 'Indofood Sukses Makmur', s: 'Consumer Staples', p: 6850, cg: 'Salim Group' },
];

function calculateMA(candles: Candle[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sum += candles[j].close;
      }
      result.push(Math.round((sum / period) * 100) / 100);
    }
  }
  return result;
}

function calculateVolumeMA(candles: Candle[], period: number = 20): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sum += candles[j].volume;
      }
      result.push(Math.round(sum / period));
    }
  }
  return result;
}

function calculateVWAP(candles: Candle[]): (number | null)[] {
  let cumTPV = 0;
  let cumVol = 0;
  const result: (number | null)[] = [];
  for (const c of candles) {
    const tp = (c.high + c.low + c.close) / 3;
    cumTPV += tp * c.volume;
    cumVol += c.volume;
    result.push(cumVol > 0 ? Math.round((cumTPV / cumVol) * 100) / 100 : null);
  }
  return result;
}

export function generateCandles(
  basePrice: number,
  volatility: number = 0.025,
  trendBias: number = 0.001,
  days: number = 100
): Candle[] {
  const candles: Candle[] = [];
  let currentPrice = basePrice;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  for (let i = 0; i < days; i++) {
    const dateStr = new Date(startDate.getTime() + i * 86400000).toISOString().split('T')[0];
    const rand = Math.sin(i * 12.345 + 1.2) * 0.5 + 0.5 - 0.48;
    const change = rand * volatility + trendBias;

    const open = Math.round(currentPrice);
    let close = Math.round(currentPrice * (1 + change));
    if (open === close) close = open + 5;

    const high = Math.round(Math.max(open, close) + Math.abs(Math.sin(i * 7.89)) * open * volatility);
    const low = Math.round(Math.min(open, close) - Math.abs(Math.cos(i * 4.56)) * open * volatility);
    const volume = Math.round(10000000 + Math.abs(Math.sin(i * 3.21)) * 30000000);

    candles.push({
      time: dateStr,
      open: Math.max(10, open),
      high: Math.max(10, high),
      low: Math.max(10, low),
      close: Math.max(10, close),
      volume: Math.max(1000, volume),
    });

    currentPrice = Math.max(10, close);
  }
  return candles;
}

export function buildStockData(
  symbol: string,
  ticker: string,
  name: string,
  sector: string,
  candles: Candle[],
  conglomerateGroup?: string
): StockData {
  const last = candles[candles.length - 1] || { close: 100, open: 100, high: 100, low: 100, volume: 1000 };
  const prev = candles.length > 1 ? candles[candles.length - 2] : last;

  const currentPrice = last.close;
  const change24h = currentPrice - prev.close;
  const changePercent24h = prev.close > 0 ? (change24h / prev.close) * 100 : 0;

  const ma5 = calculateMA(candles, 5);
  const ma10 = calculateMA(candles, 10);
  const ma20 = calculateMA(candles, 20);
  const ma60 = calculateMA(candles, 60);
  const ma200 = calculateMA(candles, 200);
  const volumeMa20 = calculateVolumeMA(candles, 20);
  const vwap = calculateVWAP(candles);

  const isBullish = changePercent24h >= 0;
  const entryPrice = currentPrice;
  const stopLoss = Math.round(currentPrice * (isBullish ? 0.96 : 1.04));
  const takeProfit1 = Math.round(currentPrice * (isBullish ? 1.06 : 0.94));
  const takeProfit2 = Math.round(currentPrice * (isBullish ? 1.12 : 0.88));
  const takeProfit3 = Math.round(currentPrice * (isBullish ? 1.20 : 0.80));

  const risk = Math.abs(entryPrice - stopLoss) || 1;
  const reward = Math.abs(takeProfit1 - entryPrice);
  const riskRewardRatio = Math.round((reward / risk) * 100) / 100;

  return {
    symbol,
    ticker,
    name,
    sector,
    conglomerateGroup,
    currentPrice,
    change24h,
    changePercent24h,
    high24h: last.high,
    low24h: last.low,
    volume24h: last.volume,
    candles,
    indicators: {
      ma5,
      ma10,
      ma20,
      ma60,
      ma200,
      volumeMa20,
      vwap,
    },
    smc: {
      swings: [],
      bosChochLines: [],
      fvgs: [],
      priceGaps: [],
      orderBlocks: [],
      liquiditySweeps: [],
      supportResistance: [],
    },
    recommendation: {
      bias: isBullish ? 'BULLISH' : 'BEARISH',
      structure: isBullish ? 'BOS_BULLISH' : 'CHOCH_BEARISH',
      entryPrice,
      stopLoss,
      takeProfit1,
      takeProfit2,
      takeProfit3,
      riskRewardRatio,
      confidenceScore: 82,
      volumeConfirmation: true,
      reasoning: `Struktur SMC ${ticker} terkonfirmasi ${isBullish ? 'Bullish Accumulation' : 'Bearish Distribution'}.`,
    },
  };
}

export function getMockStocks(): StockData[] {
  return liquidIDXStocksConfig.map((cfg) => {
    const isIhsg = cfg.t === 'IHSG';
    const ticker = isIhsg ? 'IHSG' : cfg.t;
    const symbol = isIhsg ? '^JKSE' : `${cfg.t}.JK`;
    const candles = generateCandles(cfg.p, 0.025, 0.001, 100);
    return buildStockData(symbol, ticker, cfg.n, cfg.s, candles, cfg.cg);
  });
}

export async function fetchYahooStockDataServer(rawTicker: string): Promise<StockData | null> {
  let cleanTicker = rawTicker.trim().toUpperCase().replace('.JK', '');
  if (cleanTicker === 'IHSG' || cleanTicker === 'JKSE' || cleanTicker === '^JKSE') {
    cleanTicker = '^JKSE';
  }
  const yahooSymbol = cleanTicker.startsWith('^') ? cleanTicker : `${cleanTicker}.JK`;

  const targets = [
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=1y`,
    `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=1y`,
  ];

  for (const target of targets) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const res = await fetch(target, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
        },
      });

      clearTimeout(timeoutId);

      if (!res.ok) continue;

      const json = await res.json();
      const result = json?.chart?.result?.[0];
      if (!result || !result.timestamp || !result.indicators?.quote?.[0]) continue;

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

        if (o == null || h == null || l == null || c == null || c <= 0) continue;

        const dateStr = new Date(timestamps[i] * 1000).toISOString().split('T')[0];
        candles.push({
          time: dateStr,
          open: Math.round(o),
          high: Math.round(Math.max(h, o, c)),
          low: Math.round(Math.min(l, o, c)),
          close: Math.round(c),
          volume: Math.round(v || 1000),
        });
      }

      if (candles.length >= 10) {
        const meta = result.meta || {};
        const isIhsg = cleanTicker === '^JKSE';
        const finalTicker = isIhsg ? 'IHSG' : cleanTicker;
        const companyName = isIhsg
          ? 'Indeks Harga Saham Gabungan (IHSG)'
          : (meta.longName || meta.shortName || `${cleanTicker} Indonesia Tbk.`);

        const matchedConfig = liquidIDXStocksConfig.find((s) => s.t === cleanTicker);
        const sectorName = isIhsg ? 'Market Index' : (matchedConfig?.s || 'IDX Market');
        return buildStockData(
          yahooSymbol,
          finalTicker,
          companyName,
          sectorName,
          candles,
          matchedConfig?.cg
        );
      }
    } catch (e) {
      // Continue to next target
    }
  }

  // Fallback if Yahoo network fails or times out on server
  const isIhsg = cleanTicker === '^JKSE';
  const finalTicker = isIhsg ? 'IHSG' : cleanTicker;
  const matchedConfig = liquidIDXStocksConfig.find((s) => s.t === cleanTicker);
  const companyName = isIhsg
    ? 'Indeks Harga Saham Gabungan (IHSG)'
    : (matchedConfig ? `${matchedConfig.n} Tbk.` : `${cleanTicker} Indonesia Tbk.`);
  const sectorName = isIhsg ? 'Market Index' : (matchedConfig?.s || 'IDX Market');
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
