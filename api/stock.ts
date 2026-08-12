import { fetchYahooStockData } from "../src/services/yahooFinance";
import {
    getMockStocks,
    buildStockData,
    generateCandles,
} from "../src/data/mockStocks";

export default async function handler(req: any, res: any) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    try {
        const symbolQuery =
            req?.query?.symbol || req?.query?.ticker || req?.query?.s || "IHSG";
        const rawSymbol = decodeURIComponent(
            Array.isArray(symbolQuery) ? symbolQuery[0] : String(symbolQuery)
        );

        let cleanTicker = rawSymbol.trim().toUpperCase().replace(".JK", "");
        if (
            cleanTicker === "IHSG" ||
            cleanTicker === "JKSE" ||
            cleanTicker === "^JKSE" ||
            cleanTicker === "%5EJKSE"
        ) {
            cleanTicker = "^JKSE";
        }

        const yahooSymbol = cleanTicker.startsWith("^")
            ? cleanTicker
            : `${cleanTicker}.JK`;

        // 1. Attempt live / delayed Yahoo Finance fetch via backend serverless function
        try {
            const realData = await fetchYahooStockData(cleanTicker);
            if (realData && realData.candles && realData.candles.length > 0) {
                return res.status(200).json(realData);
            }
        } catch (err) {
            console.warn(
                `Vercel serverless Yahoo fetch failed for ${yahooSymbol}:`,
                err
            );
        }

        // 2. Check local dataset
        const mockList = getMockStocks();
        const matched = mockList.find(
            (s) =>
                s.ticker.toUpperCase() === cleanTicker ||
                (cleanTicker === "^JKSE" &&
                    (s.ticker === "IHSG" || s.ticker === "^JKSE"))
        );

        if (matched) {
            return res.status(200).json(matched);
        }

        // 3. Fallback generator for unknown IDX stock tickers
        const displayTicker = cleanTicker === "^JKSE" ? "IHSG" : cleanTicker;
        const displayName =
            cleanTicker === "^JKSE"
                ? "Indeks Harga Saham Gabungan (IHSG)"
                : `${cleanTicker} Indonesia Tbk.`;
        const fallbackCandles = generateCandles(
            cleanTicker === "^JKSE" ? 7350 : 1500,
            0.03,
            0.001,
            90
        );
        const fallbackStock = buildStockData(
            yahooSymbol,
            displayTicker,
            displayName,
            cleanTicker === "^JKSE" ? "Market Index" : "IDX Market",
            fallbackCandles
        );

        return res.status(200).json(fallbackStock);
    } catch (globalErr) {
        console.error("Unhandled error in /api/stock:", globalErr);
        // Absolute fallback: Return 200 with generated stock so Vercel NEVER returns 500
        const fallbackCandles = generateCandles(7350, 0.02, 0.001, 90);
        const fallbackStock = buildStockData(
            "^JKSE",
            "IHSG",
            "Indeks Harga Saham Gabungan (IHSG)",
            "Market Index",
            fallbackCandles
        );
        return res.status(200).json(fallbackStock);
    }
}
