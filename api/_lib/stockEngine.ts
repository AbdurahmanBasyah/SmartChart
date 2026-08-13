export interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IndicatorData {
  ma5: (number | null)[];
  ma10: (number | null)[];
  ma20: (number | null)[];
  ma60: (number | null)[];
  ma200: (number | null)[];
  volumeMa20: (number | null)[];
  vwap: (number | null)[];
}

export interface SwingPoint {
  index: number;
  time: string;
  price: number;
  type: 'HIGH' | 'LOW';
  significance: 'STRONG' | 'WEAK';
  broken: boolean;
}

export interface BosChochLine {
  id: string;
  type: 'BOS' | 'CHOCH';
  direction: 'BULLISH' | 'BEARISH';
  startIndex: number;
  startTime: string;
  breakIndex: number;
  breakTime: string;
  price: number;
  broken: boolean;
}

export interface FVGItem {
  id: string;
  type: 'BULLISH' | 'BEARISH';
  top: number;
  bottom: number;
  midpoint: number;
  startIndex: number;
  startTime: string;
  mitigated: boolean;
  mitigationIndex?: number;
  mitigationTime?: string;
}

export interface OrderBlockItem {
  id: string;
  type: 'BULLISH' | 'BEARISH';
  top: number;
  bottom: number;
  startIndex: number;
  startTime: string;
  mitigated: boolean;
  mitigationIndex?: number;
  mitigationTime?: string;
  volumeProfile: 'HIGH' | 'MEDIUM';
}

export interface LiquiditySweepItem {
  id: string;
  type: 'BUY_SIDE' | 'SELL_SIDE';
  index: number;
  time: string;
  levelPrice: number;
  sweepPrice: number;
  reversalConfirmed: boolean;
}

export interface SupportResistanceItem {
  id: string;
  type: 'SUPPORT' | 'RESISTANCE';
  price: number;
  strength: number; // 1 to 5
  touchCount: number;
  firstTime: string;
  lastTime: string;
}

export interface SMCAnalysis {
  swings: SwingPoint[];
  bosChochLines: BosChochLine[];
  fvgs: FVGItem[];
  priceGaps: any[];
  orderBlocks: OrderBlockItem[];
  liquiditySweeps: LiquiditySweepItem[];
  supportResistance: SupportResistanceItem[];
}

export interface TradingRecommendation {
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
  indicators: IndicatorData;
  smc: SMCAnalysis;
  recommendation: TradingRecommendation;
}

export const liquidIDXStocks = [
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
  { t: 'MEDC', n: 'Medco Energi Internasional', s: 'Energy & Mining', p: 1250, cg: 'Panigoro Group' },
  { t: 'INKP', n: 'Indah Kiat Pulp & Paper', s: 'Basic Materials', p: 8450, cg: 'Sinarmas Group' },
  { t: 'TKIM', n: 'Pabrik Kertas Tjiwi Kimia', s: 'Basic Materials', p: 7200, cg: 'Sinarmas Group' },
  { t: 'CPIN', n: 'Charoen Pokphand Indonesia', s: 'Consumer Non-Cyclicals', p: 5100, cg: 'CP Group' },
  { t: 'MDKA', n: 'Merdeka Copper Gold', s: 'Basic Materials', p: 2450, cg: 'Saratoga Group' },
  { t: 'MBMA', n: 'Merdeka Battery Materials', s: 'Basic Materials', p: 580, cg: 'Saratoga Group' },
  { t: 'BRIS', n: 'Bank Syariah Indonesia', s: 'Financials', p: 2750, cg: 'BUMN Financial' },
  { t: 'ARTO', n: 'Bank Jago', s: 'Financials & Tech', p: 2650, cg: 'Jerry Ng & GoTo' },
  { t: 'ISAT', n: 'Indosat Ooredoo Hutchison', s: 'Telecommunication', p: 10800, cg: 'Ooredoo & CK Hutchison' },
  { t: 'EXCL', n: 'XL Axiata', s: 'Telecommunication', p: 2250, cg: 'Axiata Group' },
  { t: 'ACES', n: 'Aspirasi Hidup Indonesia', s: 'Consumer Cyclicals', p: 860, cg: 'Kawan Lama Group' },
  { t: 'AMRT', n: 'Sumber Alfaria Trijaya', s: 'Consumer Staples', p: 2950, cg: 'Djoko Susanto Group' },
];

export function formatJakartaDate(dateOrTimestamp: Date | number): string {
  const date = typeof dateOrTimestamp === 'number' ? new Date(dateOrTimestamp * 1000) : dateOrTimestamp;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(date);
}

export function getLatestClosedTradingDateStr(now: Date = new Date()): string {
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

export function getTradingDayDates(count: number, latestDateStr: string): string[] {
  const [y, m, d] = latestDateStr.split('-').map(Number);
  const cur = new Date(Date.UTC(y, m - 1, d));
  const dates: string[] = [];

  while (dates.length < count) {
    const dayOfWeek = cur.getUTCDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      const cy = cur.getUTCFullYear();
      const cm = String(cur.getUTCMonth() + 1).padStart(2, '0');
      const cd = String(cur.getUTCDate()).padStart(2, '0');
      dates.push(`${cy}-${cm}-${cd}`);
    }
    cur.setUTCDate(cur.getUTCDate() - 1);
  }

  return dates.reverse();
}

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

export function computeSMC(candles: Candle[]): { smc: SMCAnalysis; recommendation: TradingRecommendation } {
  const n = candles.length;
  if (n < 10) {
    return {
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
        bias: 'NEUTRAL',
        structure: 'SIDEWAYS',
        entryPrice: candles[n - 1]?.close || 1000,
        stopLoss: Math.round((candles[n - 1]?.close || 1000) * 0.95),
        takeProfit1: Math.round((candles[n - 1]?.close || 1000) * 1.05),
        takeProfit2: Math.round((candles[n - 1]?.close || 1000) * 1.10),
        takeProfit3: Math.round((candles[n - 1]?.close || 1000) * 1.15),
        riskRewardRatio: 1.5,
        confidenceScore: 50,
        volumeConfirmation: false,
        reasoning: 'Data candle tidak cukup untuk analisis SMC lengkap.',
      },
    };
  }

  // 1. Swing High / Swing Low Detection
  const swings: SwingPoint[] = [];
  const lookback = 3;
  for (let i = lookback; i < n - lookback; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue;
      if (candles[j].high >= candles[i].high) isHigh = false;
      if (candles[j].low <= candles[i].low) isLow = false;
    }
    if (isHigh) {
      swings.push({
        index: i,
        time: candles[i].time,
        price: candles[i].high,
        type: 'HIGH',
        significance: 'STRONG',
        broken: false,
      });
    }
    if (isLow) {
      swings.push({
        index: i,
        time: candles[i].time,
        price: candles[i].low,
        type: 'LOW',
        significance: 'STRONG',
        broken: false,
      });
    }
  }

  // 2. BOS and CHoCH Detection
  const bosChochLines: BosChochLine[] = [];
  let currentTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  let lastSwingHigh: SwingPoint | null = null;
  let lastSwingLow: SwingPoint | null = null;

  for (const s of swings) {
    if (s.type === 'HIGH') {
      if (lastSwingHigh) {
        // check if broken
        for (let i = s.index + 1; i < n; i++) {
          if (candles[i].close > lastSwingHigh.price) {
            const isChoch = currentTrend === 'BEARISH';
            bosChochLines.push({
              id: `line-${lastSwingHigh.index}-${i}`,
              type: isChoch ? 'CHOCH' : 'BOS',
              direction: 'BULLISH',
              startIndex: lastSwingHigh.index,
              startTime: lastSwingHigh.time,
              breakIndex: i,
              breakTime: candles[i].time,
              price: lastSwingHigh.price,
              broken: true,
            });
            currentTrend = 'BULLISH';
            lastSwingHigh.broken = true;
            break;
          }
        }
      }
      lastSwingHigh = s;
    } else {
      if (lastSwingLow) {
        for (let i = s.index + 1; i < n; i++) {
          if (candles[i].close < lastSwingLow.price) {
            const isChoch = currentTrend === 'BULLISH';
            bosChochLines.push({
              id: `line-${lastSwingLow.index}-${i}`,
              type: isChoch ? 'CHOCH' : 'BOS',
              direction: 'BEARISH',
              startIndex: lastSwingLow.index,
              startTime: lastSwingLow.time,
              breakIndex: i,
              breakTime: candles[i].time,
              price: lastSwingLow.price,
              broken: true,
            });
            currentTrend = 'BEARISH';
            lastSwingLow.broken = true;
            break;
          }
        }
      }
      lastSwingLow = s;
    }
  }

  // 3. Fair Value Gaps (FVG)
  const fvgs: FVGItem[] = [];
  for (let i = 2; i < n; i++) {
    const c1 = candles[i - 2];
    const c3 = candles[i];
    // Bullish FVG: Low of candle 3 > High of candle 1
    if (c3.low > c1.high) {
      const top = c3.low;
      const bottom = c1.high;
      let mitigated = false;
      let mitIdx: number | undefined;
      let mitTime: string | undefined;
      for (let j = i + 1; j < n; j++) {
        if (candles[j].low <= bottom) {
          mitigated = true;
          mitIdx = j;
          mitTime = candles[j].time;
          break;
        }
      }
      fvgs.push({
        id: `fvg-bull-${i}`,
        type: 'BULLISH',
        top,
        bottom,
        midpoint: Math.round(((top + bottom) / 2) * 100) / 100,
        startIndex: i - 1,
        startTime: candles[i - 1].time,
        mitigated,
        mitigationIndex: mitIdx,
        mitigationTime: mitTime,
      });
    }
    // Bearish FVG: High of candle 3 < Low of candle 1
    if (c3.high < c1.low) {
      const top = c1.low;
      const bottom = c3.high;
      let mitigated = false;
      let mitIdx: number | undefined;
      let mitTime: string | undefined;
      for (let j = i + 1; j < n; j++) {
        if (candles[j].high >= top) {
          mitigated = true;
          mitIdx = j;
          mitTime = candles[j].time;
          break;
        }
      }
      fvgs.push({
        id: `fvg-bear-${i}`,
        type: 'BEARISH',
        top,
        bottom,
        midpoint: Math.round(((top + bottom) / 2) * 100) / 100,
        startIndex: i - 1,
        startTime: candles[i - 1].time,
        mitigated,
        mitigationIndex: mitIdx,
        mitigationTime: mitTime,
      });
    }
  }

  // 4. Order Blocks (OB)
  const orderBlocks: OrderBlockItem[] = [];
  for (let i = 1; i < n - 2; i++) {
    const curr = candles[i];
    const next1 = candles[i + 1];
    const next2 = candles[i + 2];

    // Bullish OB: Last down candle before sharp expansion up
    if (curr.close < curr.open && next1.close > next1.open && next2.close > curr.high) {
      let mitigated = false;
      let mitIdx: number | undefined;
      let mitTime: string | undefined;
      for (let j = i + 3; j < n; j++) {
        if (candles[j].low <= curr.low) {
          mitigated = true;
          mitIdx = j;
          mitTime = candles[j].time;
          break;
        }
      }
      orderBlocks.push({
        id: `ob-bull-${i}`,
        type: 'BULLISH',
        top: curr.high,
        bottom: curr.low,
        startIndex: i,
        startTime: curr.time,
        mitigated,
        mitigationIndex: mitIdx,
        mitigationTime: mitTime,
        volumeProfile: curr.volume > next1.volume ? 'HIGH' : 'MEDIUM',
      });
    }

    // Bearish OB: Last up candle before sharp expansion down
    if (curr.close > curr.open && next1.close < next1.open && next2.close < curr.low) {
      let mitigated = false;
      let mitIdx: number | undefined;
      let mitTime: string | undefined;
      for (let j = i + 3; j < n; j++) {
        if (candles[j].high >= curr.high) {
          mitigated = true;
          mitIdx = j;
          mitTime = candles[j].time;
          break;
        }
      }
      orderBlocks.push({
        id: `ob-bear-${i}`,
        type: 'BEARISH',
        top: curr.high,
        bottom: curr.low,
        startIndex: i,
        startTime: curr.time,
        mitigated,
        mitigationIndex: mitIdx,
        mitigationTime: mitTime,
        volumeProfile: curr.volume > next1.volume ? 'HIGH' : 'MEDIUM',
      });
    }
  }

  // 5. Liquidity Sweeps
  const liquiditySweeps: LiquiditySweepItem[] = [];
  for (let i = 5; i < n; i++) {
    const c = candles[i];
    // Check if candle swept high of previous 5 candles but closed below
    const prev5High = Math.max(...candles.slice(i - 5, i).map((x) => x.high));
    if (c.high > prev5High && c.close < prev5High) {
      liquiditySweeps.push({
        id: `sweep-bsl-${i}`,
        type: 'BUY_SIDE',
        index: i,
        time: c.time,
        levelPrice: prev5High,
        sweepPrice: c.high,
        reversalConfirmed: c.close < c.open,
      });
    }

    const prev5Low = Math.min(...candles.slice(i - 5, i).map((x) => x.low));
    if (c.low < prev5Low && c.close > prev5Low) {
      liquiditySweeps.push({
        id: `sweep-ssl-${i}`,
        type: 'SELL_SIDE',
        index: i,
        time: c.time,
        levelPrice: prev5Low,
        sweepPrice: c.low,
        reversalConfirmed: c.close > c.open,
      });
    }
  }

  // 6. Support & Resistance Levels
  const supportResistance: SupportResistanceItem[] = [];
  const priceClusters: { price: number; type: 'SUPPORT' | 'RESISTANCE'; count: number; times: string[] }[] = [];
  const tolerance = (candles[n - 1].close * 0.015);

  for (const s of swings) {
    const existing = priceClusters.find((cl) => Math.abs(cl.price - s.price) <= tolerance && cl.type === (s.type === 'HIGH' ? 'RESISTANCE' : 'SUPPORT'));
    if (existing) {
      existing.count += 1;
      existing.times.push(s.time);
    } else {
      priceClusters.push({
        price: s.price,
        type: s.type === 'HIGH' ? 'RESISTANCE' : 'SUPPORT',
        count: 1,
        times: [s.time],
      });
    }
  }

  for (let idx = 0; idx < priceClusters.length; idx++) {
    const cl = priceClusters[idx];
    if (cl.count >= 1) {
      supportResistance.push({
        id: `sr-${idx}`,
        type: cl.type,
        price: Math.round(cl.price),
        strength: Math.min(5, cl.count + 1),
        touchCount: cl.count,
        firstTime: cl.times[0] || candles[0].time,
        lastTime: cl.times[cl.times.length - 1] || candles[n - 1].time,
      });
    }
  }

  // 7. Trading Recommendation & Bias
  const lastCandle = candles[n - 1];
  const lastBos = bosChochLines[bosChochLines.length - 1];
  const lastFvg = fvgs.filter((f) => !f.mitigated).pop();
  const lastOb = orderBlocks.filter((o) => !o.mitigated).pop();

  const isBullishBias = lastBos ? lastBos.direction === 'BULLISH' : lastCandle.close >= candles[Math.max(0, n - 20)].close;
  const bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = isBullishBias ? 'BULLISH' : 'BEARISH';
  const structure = lastBos
    ? `${lastBos.type}_${lastBos.direction}` as any
    : isBullishBias
    ? 'BOS_BULLISH'
    : 'BOS_BEARISH';

  const entryPrice = lastCandle.close;
  const slBuffer = isBullishBias ? (lastOb?.bottom || entryPrice * 0.96) : (lastOb?.top || entryPrice * 1.04);
  const stopLoss = Math.round(slBuffer);

  const risk = Math.abs(entryPrice - stopLoss) || (entryPrice * 0.04);
  const takeProfit1 = Math.round(entryPrice + (isBullishBias ? 1.5 * risk : -1.5 * risk));
  const takeProfit2 = Math.round(entryPrice + (isBullishBias ? 2.5 * risk : -2.5 * risk));
  const takeProfit3 = Math.round(entryPrice + (isBullishBias ? 3.5 * risk : -3.5 * risk));
  const riskRewardRatio = Math.round(((Math.abs(takeProfit1 - entryPrice)) / risk) * 100) / 100;

  const volMa = calculateVolumeMA(candles, 20);
  const lastVolMa = volMa[n - 1] || 1;
  const volumeConfirmation = lastCandle.volume >= lastVolMa * 0.9;

  let confidenceScore = 70;
  if (lastBos) confidenceScore += 10;
  if (lastOb && !lastOb.mitigated) confidenceScore += 8;
  if (lastFvg && !lastFvg.mitigated) confidenceScore += 6;
  if (volumeConfirmation) confidenceScore += 6;
  confidenceScore = Math.min(95, confidenceScore);

  const reasoning = `Struktur SMC terkonfirmasi ${structure.replace('_', ' ')}. ${
    lastOb ? `Order Block ${lastOb.type} berada di area ${lastOb.bottom} - ${lastOb.top}. ` : ''
  }${lastFvg ? `FVG ${lastFvg.type} terbuka di ${lastFvg.bottom} - ${lastFvg.top}. ` : ''}Rekomendasi ${bias} dengan R:R 1:${riskRewardRatio}.`;

  return {
    smc: {
      swings,
      bosChochLines,
      fvgs,
      priceGaps: [],
      orderBlocks,
      liquiditySweeps,
      supportResistance,
    },
    recommendation: {
      bias,
      structure,
      entryPrice,
      stopLoss,
      takeProfit1,
      takeProfit2,
      takeProfit3,
      riskRewardRatio,
      confidenceScore,
      volumeConfirmation,
      reasoning,
    },
  };
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

  const { smc, recommendation } = computeSMC(candles);

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
    smc,
    recommendation,
  };
}

export function generateCandles(
  basePrice: number,
  volatility: number = 0.025,
  trendBias: number = 0.001,
  days: number = 100
): Candle[] {
  const candles: Candle[] = [];
  let currentPrice = basePrice;
  const latestDateStr = getLatestClosedTradingDateStr();
  const tradingDates = getTradingDayDates(days, latestDateStr);

  for (let i = 0; i < tradingDates.length; i++) {
    const dateStr = tradingDates[i];
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

// In-memory cache for serverless functions
const cachedStocksMap: Map<string, StockData> = new Map();

export function getMockStocks(): StockData[] {
  const stockMap = new Map<string, StockData>();
  liquidIDXStocks.forEach((cfg) => {
    const isIhsg = cfg.t === 'IHSG' || cfg.t === '^JKSE';
    const ticker = isIhsg ? 'IHSG' : cfg.t;
    const symbol = isIhsg ? '^JKSE' : `${cfg.t}.JK`;
    const cached = cachedStocksMap.get(ticker) || cachedStocksMap.get(symbol);
    if (cached) {
      stockMap.set(ticker, cached);
    } else {
      const candles = generateCandles(cfg.p, 0.025, 0.001, 100);
      const stock = buildStockData(symbol, ticker, cfg.n, cfg.s, candles, cfg.cg);
      stockMap.set(ticker, stock);
    }
  });
  return Array.from(stockMap.values());
}

export async function fetchYahooStockDataServer(rawTicker: string): Promise<StockData | null> {
  let cleanTicker = rawTicker.trim().toUpperCase().replace('.JK', '');
  if (cleanTicker === 'IHSG' || cleanTicker === 'JKSE' || cleanTicker === '^JKSE') {
    cleanTicker = '^JKSE';
  }
  const yahooSymbol = cleanTicker.startsWith('^') ? cleanTicker : `${cleanTicker}.JK`;

  const targets = [
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=1y&includePrePost=true&useYfid=true`,
    `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=1y&includePrePost=true&useYfid=true`,
  ];

  for (const target of targets) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2800);

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

      const maxAllowedDateStr = getLatestClosedTradingDateStr();

      const candles: Candle[] = [];
      for (let i = 0; i < timestamps.length; i++) {
        const o = opens[i];
        const h = highs[i];
        const l = lows[i];
        const c = closes[i];
        const v = volumes[i];

        if (o == null || h == null || l == null || c == null || c <= 0) continue;

        const dateStr = formatJakartaDate(timestamps[i]);
        if (dateStr > maxAllowedDateStr) continue;

        candles.push({
          time: dateStr,
          open: Math.round(o),
          high: Math.round(Math.max(h, o, c)),
          low: Math.round(Math.min(l, o, c)),
          close: Math.round(c),
          volume: Math.round(v || 1000),
        });
      }

      // Check meta for real-time / live market price updates that fall on or before the max allowed closed date
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
              open: Math.round(openPrice),
              high: Math.round(highPrice),
              low: Math.round(lowPrice),
              close: Math.round(latestPrice),
              volume: Math.round(vol),
            });
          } else if (lastCandle.time === metaDateStr) {
            lastCandle.close = Math.round(latestPrice);
            if (meta.regularMarketDayHigh) lastCandle.high = Math.round(meta.regularMarketDayHigh);
            if (meta.regularMarketDayLow) lastCandle.low = Math.round(meta.regularMarketDayLow);
            if (meta.regularMarketVolume) lastCandle.volume = Math.round(meta.regularMarketVolume);
          }
        }
      }

      if (candles.length >= 10) {
        const isIhsg = cleanTicker === '^JKSE';
        const finalTicker = isIhsg ? 'IHSG' : cleanTicker;
        const companyName = isIhsg
          ? 'Indeks Harga Saham Gabungan (IHSG)'
          : (meta.longName || meta.shortName || `${cleanTicker} Indonesia Tbk.`);

        const matchedConfig = liquidIDXStocks.find((s) => s.t === cleanTicker);
        const sectorName = isIhsg ? 'Market Index' : (matchedConfig?.s || 'IDX Market');
        const stockData = buildStockData(
          yahooSymbol,
          finalTicker,
          companyName,
          sectorName,
          candles,
          matchedConfig?.cg
        );

        cachedStocksMap.set(finalTicker, stockData);
        cachedStocksMap.set(cleanTicker, stockData);
        cachedStocksMap.set(yahooSymbol.toUpperCase(), stockData);
        if (cleanTicker === '^JKSE') {
          cachedStocksMap.set('^JKSE', stockData);
          cachedStocksMap.set('IHSG', stockData);
          cachedStocksMap.set('JKSE', stockData);
        }

        return stockData;
      }
    } catch (e) {
      // Continue to next target
    }
  }

  // Fallback to cache if available
  const isIhsg = cleanTicker === '^JKSE';
  const finalTicker = isIhsg ? 'IHSG' : cleanTicker;
  if (cachedStocksMap.has(finalTicker)) {
    return cachedStocksMap.get(finalTicker)!;
  }
  if (cachedStocksMap.has(cleanTicker)) {
    return cachedStocksMap.get(cleanTicker)!;
  }

  const matchedConfig = liquidIDXStocks.find((s) => s.t === cleanTicker);
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

/**
 * Returns real stock data for liquid IDX stocks, fetching top priority ones quickly without timeout
 */
export async function getAllStocksServer(): Promise<StockData[]> {
  // Always ensure ^JKSE, BRPT, BBCA are fetched or cached
  const priority = ['^JKSE', 'BRPT', 'BBCA', 'BBRI', 'BMRI'];
  await Promise.allSettled(
    priority.map(async (t) => {
      if (!cachedStocksMap.has(t)) {
        await fetchYahooStockDataServer(t);
      }
    })
  );

  return getMockStocks();
}
