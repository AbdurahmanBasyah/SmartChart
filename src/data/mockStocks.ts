import type { Candle, StockData } from "../types";
import { CANONICAL_STOCK_UNIVERSE } from "../../shared/stockUniverse";
import type { CanonicalStockConfig } from "../../shared/stockUniverse";
import {
    calculateMA,
    calculateVolumeMA,
    calculateVWAP,
    detectSwings,
    detectBosChoch,
    detectFVGs,
    detectPriceGaps,
    detectOrderBlocks,
    detectLiquiditySweeps,
    detectSupportResistance,
    generateRecommendation,
} from "../utils/smcEngine";
import { buildChartNaraSummary } from "../utils/naraEvidenceEngine";

// Seeded pseudo random generator for reproducible chart candles
function seededRandom(seed: number) {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
}

export function formatJakartaDate(dateOrTimestamp: Date | number): string {
    const date =
        typeof dateOrTimestamp === "number"
            ? new Date(dateOrTimestamp * 1000)
            : dateOrTimestamp;
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Jakarta",
    }).format(date);
}

export function getLatestClosedTradingDateStr(now: Date = new Date()): string {
    const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Jakarta",
        year: "numeric",
        month: "numeric",
        day: "numeric",
        weekday: "short",
        hour: "numeric",
        minute: "numeric",
        hour12: false,
        hourCycle: "h23",
    });

    const parts = formatter.formatToParts(now);
    let year = 2026,
        month = 1,
        day = 1,
        weekday = "Mon",
        hour = 0,
        minute = 0;
    for (const p of parts) {
        if (p.type === "year") year = parseInt(p.value, 10);
        if (p.type === "month") month = parseInt(p.value, 10);
        if (p.type === "day") day = parseInt(p.value, 10);
        if (p.type === "weekday") weekday = p.value;
        if (p.type === "hour") hour = parseInt(p.value, 10);
        if (p.type === "minute") minute = parseInt(p.value, 10);
    }

    const targetDate = new Date(Date.UTC(year, month - 1, day));
    if (weekday === "Sat" || weekday === "Sun") {
        while (targetDate.getUTCDay() === 0 || targetDate.getUTCDay() === 6) {
            targetDate.setUTCDate(targetDate.getUTCDate() - 1);
        }
    } else if (hour < 16 || (hour === 16 && minute < 45)) {
        do {
            targetDate.setUTCDate(targetDate.getUTCDate() - 1);
        } while (targetDate.getUTCDay() === 0 || targetDate.getUTCDay() === 6);
    }
    const y = targetDate.getUTCFullYear();
    const m = String(targetDate.getUTCMonth() + 1).padStart(2, "0");
    const d = String(targetDate.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

export function getTradingDayDates(
    count: number,
    latestDateStr: string,
): string[] {
    const [y, m, d] = latestDateStr.split("-").map(Number);
    const cur = new Date(Date.UTC(y, m - 1, d));
    const dates: string[] = [];

    while (dates.length < count) {
        const dayOfWeek = cur.getUTCDay(); // 0 = Sun, 6 = Sat
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            const cy = cur.getUTCFullYear();
            const cm = String(cur.getUTCMonth() + 1).padStart(2, "0");
            const cd = String(cur.getUTCDate()).padStart(2, "0");
            dates.push(`${cy}-${cm}-${cd}`);
        }
        cur.setUTCDate(cur.getUTCDate() - 1);
    }

    return dates.reverse();
}

/**
 * Generates realistic candle data for IDX stocks
 */
export function generateCandles(
    basePrice: number,
    volatility: number = 0.025,
    trendBias: number = 0.001,
    days: number = 100,
): Candle[] {
    const candles: Candle[] = [];
    let currentPrice = basePrice;
    const latestDateStr = getLatestClosedTradingDateStr();
    const tradingDates = getTradingDayDates(days, latestDateStr);

    for (let i = 0; i < tradingDates.length; i++) {
        const dateStr = tradingDates[i];

        let cycle = Math.sin(i / 8) * (volatility * 1.5);
        if (i > 70 && i < 85) cycle -= volatility * 1.2;
        if (i >= 85) cycle += volatility * 2.0;

        const rand1 = seededRandom(i * 10 + 1) - 0.48;
        const changePercent = rand1 * volatility + trendBias + cycle;

        const open = Math.round(currentPrice);
        let close = Math.round(currentPrice * (1 + changePercent));

        if (open === close) close = open + (rand1 > 0 ? 5 : -5);

        const high = Math.round(
            Math.max(open, close) +
                Math.abs(seededRandom(i * 10 + 2)) * open * volatility * 1.2,
        );
        const low = Math.round(
            Math.min(open, close) -
                Math.abs(seededRandom(i * 10 + 3)) * open * volatility * 1.2,
        );

        let baseVolume =
            15000000 + Math.floor(seededRandom(i * 10 + 4) * 20000000);
        if (i > 80 && i < 90) baseVolume *= 2.8;

        candles.push({
            time: dateStr,
            open: Math.max(50, open),
            high: Math.max(50, high),
            low: Math.max(50, low),
            close: Math.max(50, close),
            volume: Math.max(1000, baseVolume),
        });

        currentPrice = Math.max(50, close);
    }

    return candles;
}

export function buildStockData(
    symbol: string,
    ticker: string,
    name: string,
    sector: string,
    candles: Candle[],
    conglomerate?: string,
    isRealData?: boolean,
): StockData {
    const currentPrice = candles[candles.length - 1]?.close || 100;
    const previousClose =
        candles.length > 1
            ? candles[candles.length - 2]?.close || currentPrice
            : currentPrice;
    const change24h = currentPrice - previousClose;
    const changePercent24h =
        previousClose > 0 ? (change24h / previousClose) * 100 : 0;

    const ma5 = calculateMA(candles, 5);
    const ma10 = calculateMA(candles, 10);
    const ma20 = calculateMA(candles, 20);
    const ma60 = calculateMA(candles, 60);
    const ma200 = calculateMA(candles, 200);
    const volumeMa20 = calculateVolumeMA(candles, 20);
    const vwap = calculateVWAP(candles);

    const isIhsg = symbol.includes("JKSE") || ticker === "IHSG";
    const swings = detectSwings(candles);
    const bosChochLines = detectBosChoch(candles, swings);
    const fvgs = detectFVGs(candles, isIhsg);
    const priceGaps = detectPriceGaps(candles);
    const orderBlocks = detectOrderBlocks(candles, volumeMa20, bosChochLines);
    const liquiditySweeps = detectLiquiditySweeps(candles, swings);
    const supportResistance = detectSupportResistance(candles);

    const recommendation = generateRecommendation(
        symbol,
        name,
        candles,
        swings,
        fvgs,
        orderBlocks,
        supportResistance,
        volumeMa20,
        priceGaps,
    );

    const stockData: StockData = {
        symbol,
        ticker,
        name,
        sector,
        conglomerate,
        candles,
        swings,
        bosChochLines,
        fvgs,
        orderBlocks,
        priceGaps,
        liquiditySweeps,
        supportResistance,
        indicators: {
            ma5,
            ma10,
            ma20,
            ma60,
            ma200,
            vwap,
            volumeMa20,
        },
        recommendation,
        currentPrice,
        change24h,
        changePercent24h,
        isRealData,
    };

    stockData.naraSummary = buildChartNaraSummary({
        ticker,
        isRealData,
        candles,
        swings,
        bosChochLines,
        fvgs,
        orderBlocks,
        priceGaps,
        supportResistance,
        indicators: stockData.indicators,
        asOfDate: candles[candles.length - 1]?.time,
        sourceMetadata: {
            ticker,
            timeframe: "1D",
            asOfDate: candles[candles.length - 1]?.time,
            source:
                isRealData === true
                    ? "REAL"
                    : isRealData === false
                      ? "SYNTHETIC"
                      : "UNKNOWN",
        },
    });

    return stockData;
}

export type StockRawConfig = CanonicalStockConfig;

export const liquidIDXStocks: readonly StockRawConfig[] = CANONICAL_STOCK_UNIVERSE;

export function getMockStocks(limit?: number): StockData[] {
    const stockMap = new Map<string, StockData>();

    const stocksToProcess =
        limit && limit < liquidIDXStocks.length
            ? liquidIDXStocks.slice(0, limit)
            : liquidIDXStocks;

    stocksToProcess.forEach((s) => {
        const isIhsg = s.t === "IHSG" || s.t === "^JKSE";
        const ticker = isIhsg ? "IHSG" : s.t;
        const symbol = isIhsg ? "^JKSE" : s.t + ".JK";
        const candles = generateCandles(s.p, 0.025, 0.001, 90);
        const stockData = buildStockData(
            symbol,
            ticker,
            s.n,
            s.s,
            candles,
            s.cg,
            false,
        );
        stockData.source = "SYNTHETIC";
        stockData.isRealData = false;
        stockData.fetchedAt = new Date().toISOString();
        stockData.tradeDate = candles[candles.length - 1]?.time;
        stockMap.set(ticker, stockData);
    });

    return Array.from(stockMap.values());
}
