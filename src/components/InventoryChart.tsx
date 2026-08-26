import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion } from "motion/react";
import {
    Layers,
    Calendar,
    Search,
    Plus,
    X,
    Eye,
    EyeOff,
    ArrowUpRight,
    ArrowDownRight,
    Info,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Building2,
    Activity,
    BarChart3,
    Sparkles,
    Zap,
    Check,
    Loader2,
    Table,
    LayoutGrid,
    Camera,
} from "lucide-react";
import {
    StockData,
    BrokerInventoryItem,
    BrokerInventorySummary,
    BrokerDailyPoint,
} from "../types";
import { buildInventoryNaraSummary } from "../utils/naraEvidenceEngine";
import {
    IDX_BROKER_CATALOG,
    searchExchangeMemberBrokers,
} from "../utils/brokerInventoryEngine";
import { sortBrokerInventoryRows } from "../utils/brokerSummarySorting";
import { DualCalendarPicker } from "./DualCalendarPicker";
import { NaraSummaryPanel } from "./NaraSummaryPanel";

interface InventoryChartProps {
    stocks: StockData[];
    selectedStock: StockData | null;
    onSelectStock: (stock: StockData) => void;
    onFetchNewStock?: (ticker: string) => Promise<void> | void;
    onNavigateToChart: (ticker: string) => void;
}

type TimeRangePreset = "1M" | "3M" | "6M" | "1Y" | "YTD" | "CUSTOM";

interface BrokerDataSummaryRow {
    broker_code?: string;
    broker_name?: string;
    bval?: number;
    bvol?: number;
    sval?: number;
    svol?: number;
    nval?: number;
    nvol?: number;
}

interface BrokerDataSummaryPayload {
    stock_code?: string;
    brokers?: BrokerDataSummaryRow[];
    broker_start_date?: string;
    broker_end_date?: string;
}

interface BrokerDataAccumulationPoint {
    date?: string;
    nval?: number;
    nvol?: number;
    cum_nval?: number;
    bavg?: number;
    savg?: number;
}

interface BrokerDataAccumulationSeries {
    broker_code?: string;
    broker_name?: string;
    points?: BrokerDataAccumulationPoint[];
}

interface BrokerDataAccumulationPayload {
    code?: string;
    start_date?: string;
    end_date?: string;
    series?: BrokerDataAccumulationSeries[];
}

function numberOrZero(value: unknown): number {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
}

function finiteNumber(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}

function normalizeBrokerCode(value: unknown): string {
    return String(value || "")
        .trim()
        .toUpperCase();
}

function normalizeDate(value: unknown): string {
    return String(value || "")
        .trim()
        .slice(0, 10);
}

function isValidIsoDate(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
    );
}

function normalizeProviderRange(
    startValue: unknown,
    endValue: unknown,
): {
    start: string;
    end: string;
    complete: boolean;
} {
    const start = normalizeDate(startValue);
    const end = normalizeDate(endValue);
    return {
        start,
        end,
        complete: Boolean(
            start && end && isValidIsoDate(start) && isValidIsoDate(end),
        ),
    };
}

function createEmptyInventorySummary(
    ticker: string,
    stock: StockData | null | undefined,
    startDate: string,
    endDate: string,
): BrokerInventorySummary {
    const candles = (stock?.candles || []).filter((candle) => {
        const date = normalizeDate(candle.time);
        return (
            (!startDate || date >= startDate) && (!endDate || date <= endDate)
        );
    });

    return {
        ticker: ticker.replace(".JK", "").toUpperCase(),
        stockName: stock?.name || ticker,
        currentPrice: stock?.currentPrice || 0,
        sourceLabel: "Data inventory real tidak tersedia",
        sourceNote: "Tidak ada histori broker real yang dapat digambar.",
        startDate,
        endDate,
        totalTradingDays: candles.length,
        candles,
        topNetBuyers: [],
        topNetSellers: [],
        allBrokers: [],
        autoSelectedBrokerCodes: [],
        stats: {
            totalVolumeLots: 0,
            totalValueIdr: 0,
            foreignNetVol: 0,
            foreignNetVal: 0,
            cleanAccumBrokerCount: 0,
            cleanDistBrokerCount: 0,
        },
        coverage: {
            normalizedTicker: ticker.replace(".JK", "").toUpperCase(),
            requestedStartDate: startDate,
            requestedEndDate: endDate,
            source: "UNKNOWN",
            selectedBrokerCodes: [],
            summaryBrokerCount: 0,
            accumulationBrokerCount: 0,
            validSeriesPointCount: 0,
            intersectionPointCount: 0,
            missingRequestedDates: candles.map((candle) =>
                normalizeDate(candle.time),
            ),
            missingReason: "REAL_BROKER_DATA_UNAVAILABLE",
            summaryValid: false,
            accumulationValid: false,
            rangeMatches: false,
            sourceSnapshotKey: "broker-summary+broker-accumulation",
        },
    };
}

function buildDailyPoints(
    series: BrokerDataAccumulationSeries,
): BrokerDailyPoint[] {
    const pointByDate = new Map<string, BrokerDataAccumulationPoint>();
    (series.points || []).forEach((point) => {
        const date = normalizeDate(point.date);
        if (date) pointByDate.set(date, point);
    });

    let runningNetVol = 0;
    let runningNetVal = 0;
    return Array.from(pointByDate.entries())
        .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
        .map(([date, point]) => {
            const netVol = numberOrZero(point.nvol) / 100;
            const netVal = numberOrZero(point.nval);
            runningNetVol += netVol;
            runningNetVal += netVal;
            const providerCumNetVal = finiteNumber(point.cum_nval);

            return {
                date,
                // The accumulation endpoint exposes net flow only. Buy/sell
                // components remain zero instead of being inferred.
                buyVol: 0,
                sellVol: 0,
                netVol,
                buyVal: 0,
                sellVal: 0,
                netVal,
                cumNetVol: runningNetVol,
                cumNetVal: providerCumNetVal ?? runningNetVal,
                avgBuyPrice: finiteNumber(point.bavg) ?? 0,
                avgSellPrice: finiteNumber(point.savg) ?? 0,
            };
        });
}

export function buildBrokerDataInventorySummary(
    summaryPayload: BrokerDataSummaryPayload | null,
    accumulationPayload: BrokerDataAccumulationPayload | null,
    fallback: BrokerInventorySummary,
    customBrokersToAdd: string[],
): BrokerInventorySummary {
    const rows = Array.isArray(summaryPayload?.brokers)
        ? summaryPayload.brokers
        : [];
    const series = Array.isArray(accumulationPayload?.series)
        ? accumulationPayload.series
        : [];
    const rowByCode = new Map<string, BrokerDataSummaryRow>();
    rows.forEach((row) => {
        const code = normalizeBrokerCode(row.broker_code);
        if (code) rowByCode.set(code, row);
    });
    const seriesByCode = new Map<
        string,
        { series: BrokerDataAccumulationSeries; points: BrokerDailyPoint[] }
    >();
    series.forEach((entry) => {
        const code = normalizeBrokerCode(entry.broker_code);
        if (code)
            seriesByCode.set(code, {
                series: entry,
                points: buildDailyPoints(entry),
            });
    });

    const codes = Array.from(
        new Set([...rowByCode.keys(), ...seriesByCode.keys()]),
    );
    const allBrokers: BrokerInventoryItem[] = codes.map((code, index) => {
        const row = rowByCode.get(code);
        const history = seriesByCode.get(code);
        const catalog = IDX_BROKER_CATALOG.find((entry) => entry.code === code);
        const dailyPoints = history?.points || [];
        const buyShares = numberOrZero(row?.bvol);
        const sellShares = numberOrZero(row?.svol);
        const buyLots = buyShares / 100;
        const sellLots = sellShares / 100;
        const explicitNetLots = finiteNumber(row?.nvol);
        const explicitNetValue = finiteNumber(row?.nval);
        const netLots =
            explicitNetLots !== null
                ? explicitNetLots / 100
                : row
                  ? buyLots - sellLots
                  : dailyPoints.reduce((sum, point) => sum + point.netVol, 0);
        const buyValue = numberOrZero(row?.bval);
        const sellValue = numberOrZero(row?.sval);
        const netValue =
            explicitNetValue !== null
                ? explicitNetValue
                : row
                  ? buyValue - sellValue
                  : dailyPoints.reduce((sum, point) => sum + point.netVal, 0);
        const turnoverLots = buyLots + sellLots;
        const buyPurity = turnoverLots > 0 ? (buyLots / turnoverLots) * 100 : 0;
        const sellPurity =
            turnoverLots > 0 ? (sellLots / turnoverLots) * 100 : 0;
        const cleanRatio = Math.round(netLots >= 0 ? buyPurity : sellPurity);
        const churnRatio =
            turnoverLots > 0
                ? Math.round(
                      (turnoverLots / Math.max(1, Math.abs(netLots))) * 10,
                  ) / 10
                : 0;
        let cleanTendency: BrokerInventoryItem["cleanTendency"] = "NEUTRAL";
        if (turnoverLots > 0 && netLots > 0) {
            cleanTendency =
                buyPurity >= 78 && churnRatio <= 1.3
                    ? "CLEAN_ACCUM"
                    : buyPurity >= 62
                      ? "MODERATE_ACCUM"
                      : "NEUTRAL";
        } else if (turnoverLots > 0 && netLots < 0) {
            cleanTendency =
                sellPurity >= 78 && churnRatio <= 1.3
                    ? "CLEAN_DIST"
                    : sellPurity >= 62
                      ? "MODERATE_DIST"
                      : "NEUTRAL";
        }
        const lastBuyAverage = [...dailyPoints]
            .reverse()
            .find((point) => point.avgBuyPrice > 0)?.avgBuyPrice;
        const lastSellAverage = [...dailyPoints]
            .reverse()
            .find((point) => point.avgSellPrice > 0)?.avgSellPrice;

        return {
            brokerCode: code,
            brokerName:
                row?.broker_name ||
                history?.series.broker_name ||
                catalog?.name ||
                code,
            type: catalog?.type || "RETAIL",
            totalBuyVol: buyLots,
            totalSellVol: sellLots,
            totalBuyVal: buyValue,
            totalSellVal: sellValue,
            netVol: netLots,
            netVal: netValue,
            avgBuyPrice:
                buyShares > 0
                    ? Math.round(buyValue / buyShares)
                    : lastBuyAverage || 0,
            avgSellPrice:
                sellShares > 0
                    ? Math.round(sellValue / sellShares)
                    : lastSellAverage || 0,
            cleanTendency,
            cleanRatio,
            churnRatio,
            category: netLots >= 0 ? "NET_BUY" : "NET_SELL",
            color: catalog?.color || `hsl(${(index * 47) % 360} 75% 60%)`,
            visible: false,
            rank: index + 1,
            dailyPoints,
        };
    });

    const topNetBuyers = allBrokers
        .filter((broker) => broker.netVol >= 0)
        .sort((a, b) => b.netVol - a.netVol)
        .map((broker, index) => ({ ...broker, rank: index + 1 }));
    const topNetSellers = allBrokers
        .filter((broker) => broker.netVol < 0)
        .sort((a, b) => a.netVol - b.netVol)
        .map((broker, index) => ({ ...broker, rank: index + 1 }));

    const autoCodes = new Set<string>();
    topNetBuyers
        .slice(0, 5)
        .filter((broker) => broker.dailyPoints.length > 0)
        .forEach((broker) => autoCodes.add(broker.brokerCode));
    topNetSellers
        .slice(0, 5)
        .filter((broker) => broker.dailyPoints.length > 0)
        .forEach((broker) => autoCodes.add(broker.brokerCode));
    customBrokersToAdd.forEach((code) => {
        const normalized = code.trim().toUpperCase();
        if (normalized && seriesByCode.get(normalized)?.points.length)
            autoCodes.add(normalized);
    });

    const finalize = (broker: BrokerInventoryItem) => ({
        ...broker,
        visible: autoCodes.has(broker.brokerCode),
    });
    const finalizedBrokers = allBrokers.map(finalize);
    const finalizedBuyers = topNetBuyers.map(finalize);
    const finalizedSellers = topNetSellers.map(finalize);
    const foreignBrokers = allBrokers.filter(
        (broker) => broker.type === "FOREIGN",
    );
    const normalizedFallbackTicker = fallback.ticker
        .replace(".JK", "")
        .toUpperCase();
    const normalizedSummaryTicker = normalizeBrokerCode(
        summaryPayload?.stock_code || normalizedFallbackTicker,
    ).replace(".JK", "");
    const normalizedAccumulationTicker = normalizeBrokerCode(
        accumulationPayload?.code || normalizedFallbackTicker,
    ).replace(".JK", "");
    const summaryTickerMatches =
        normalizedSummaryTicker === normalizedFallbackTicker;
    const accumulationTickerMatches =
        normalizedAccumulationTicker === normalizedFallbackTicker;
    const tickerMatches = summaryTickerMatches && accumulationTickerMatches;
    const summaryRange = normalizeProviderRange(
        summaryPayload?.broker_start_date,
        summaryPayload?.broker_end_date,
    );
    const accumulationRange = normalizeProviderRange(
        accumulationPayload?.start_date,
        accumulationPayload?.end_date,
    );
    const requestedStartDate = normalizeDate(fallback.startDate);
    const requestedEndDate = normalizeDate(fallback.endDate);
    const summaryRangeMatches =
        summaryRange.complete &&
        summaryRange.start === requestedStartDate &&
        summaryRange.end === requestedEndDate;
    const accumulationRangeMatches =
        accumulationRange.complete &&
        accumulationRange.start === requestedStartDate &&
        accumulationRange.end === requestedEndDate;
    const endpointRangeMatches =
        summaryRange.complete &&
        accumulationRange.complete &&
        summaryRange.start === accumulationRange.start &&
        summaryRange.end === accumulationRange.end;
    const rangeMatches =
        summaryRangeMatches && accumulationRangeMatches && endpointRangeMatches;
    const candleDates = new Set(
        fallback.candles.map((candle) => normalizeDate(candle.time)),
    );
    const validSeriesPointCount = Array.from(seriesByCode.values()).reduce(
        (sum, entry) =>
            sum + entry.points.filter((point) => Boolean(point.date)).length,
        0,
    );
    const intersectionPointCount = Array.from(seriesByCode.values()).reduce(
        (sum, entry) =>
            sum +
            entry.points.filter((point) => candleDates.has(point.date)).length,
        0,
    );
    const providerDates = new Set(
        Array.from(seriesByCode.values()).flatMap((entry) =>
            entry.points.map((point) => point.date),
        ),
    );
    const missingRequestedDates = Array.from(candleDates)
        .filter((date) => !providerDates.has(date))
        .sort();
    const summaryValid = Boolean(
        summaryPayload &&
        rowByCode.size > 0 &&
        summaryTickerMatches &&
        summaryRangeMatches,
    );
    const accumulationValid = Boolean(
        accumulationPayload &&
        validSeriesPointCount > 0 &&
        accumulationTickerMatches &&
        accumulationRangeMatches,
    );
    const coverageReasons: string[] = [];
    if (!summaryRange.complete) {
        coverageReasons.push("BROKER_SUMMARY_RANGE_MISSING");
    } else if (!summaryRangeMatches) {
        coverageReasons.push("BROKER_SUMMARY_RANGE_MISMATCH");
    }
    if (!accumulationRange.complete) {
        coverageReasons.push("BROKER_ACCUMULATION_RANGE_MISSING");
    } else if (!accumulationRangeMatches) {
        coverageReasons.push("BROKER_ACCUMULATION_RANGE_MISMATCH");
    }
    if (
        summaryRange.complete &&
        accumulationRange.complete &&
        !endpointRangeMatches
    ) {
        coverageReasons.push("BROKER_ENDPOINT_RANGE_MISMATCH");
    }
    if (!tickerMatches) coverageReasons.push("TICKER_MISMATCH");
    if (!summaryValid || !accumulationValid)
        coverageReasons.push("SUMMARY_OR_ACCUMULATION_INCOMPLETE");
    if (summaryValid && accumulationValid && missingRequestedDates.length > 0) {
        coverageReasons.push("PROVIDER_DATES_MISSING_NO_ZERO_FILL");
    }
    const missingReason =
        Array.from(new Set(coverageReasons)).join("|") || undefined;
    const commonReturnedStartDate = rangeMatches
        ? summaryRange.start
        : undefined;
    const commonReturnedEndDate = rangeMatches ? summaryRange.end : undefined;

    return {
        ...fallback,
        ticker: String(
            summaryPayload?.stock_code ||
                accumulationPayload?.code ||
                fallback.ticker,
        )
            .toUpperCase()
            .replace(".JK", ""),
        dataSource: "EXTERNAL",
        sourceLabel:
            summaryPayload && accumulationPayload
                ? "External summary + histori broker"
                : summaryPayload
                  ? "External broker summary (histori tidak tersedia)"
                  : "External histori broker (summary tidak tersedia)",
        sourceNote:
            "Data broker dan histori berasal dari provider eksternal; titik tanpa candle yang cocok tidak digambar.",
        startDate: commonReturnedStartDate || fallback.startDate,
        endDate: commonReturnedEndDate || fallback.endDate,
        topNetBuyers: finalizedBuyers,
        topNetSellers: finalizedSellers,
        allBrokers: finalizedBrokers,
        autoSelectedBrokerCodes: Array.from(autoCodes).sort(),
        stats: {
            totalVolumeLots: allBrokers.reduce(
                (sum, broker) => sum + broker.totalBuyVol + broker.totalSellVol,
                0,
            ),
            totalValueIdr: allBrokers.reduce(
                (sum, broker) => sum + broker.totalBuyVal + broker.totalSellVal,
                0,
            ),
            foreignNetVol: foreignBrokers.reduce(
                (sum, broker) => sum + broker.netVol,
                0,
            ),
            foreignNetVal: foreignBrokers.reduce(
                (sum, broker) => sum + broker.netVal,
                0,
            ),
            cleanAccumBrokerCount: allBrokers.filter(
                (broker) => broker.cleanTendency === "CLEAN_ACCUM",
            ).length,
            cleanDistBrokerCount: allBrokers.filter(
                (broker) => broker.cleanTendency === "CLEAN_DIST",
            ).length,
        },
        coverage: {
            normalizedTicker: normalizedFallbackTicker,
            requestedStartDate: fallback.startDate,
            requestedEndDate: fallback.endDate,
            returnedStartDate: commonReturnedStartDate,
            returnedEndDate: commonReturnedEndDate,
            summaryReturnedStartDate: summaryRange.start || undefined,
            summaryReturnedEndDate: summaryRange.end || undefined,
            accumulationReturnedStartDate: accumulationRange.start || undefined,
            accumulationReturnedEndDate: accumulationRange.end || undefined,
            rangeMatches,
            retrievedAt: new Date().toISOString(),
            source: "EXTERNAL",
            brokerLimit: 20,
            selectedBrokerCodes: Array.from(autoCodes).sort(),
            summaryBrokerCount: rows.length,
            accumulationBrokerCount: series.length,
            validSeriesPointCount,
            intersectionPointCount,
            missingRequestedDates,
            missingReason,
            summaryValid,
            accumulationValid,
            sourceSnapshotKey: "broker-summary+broker-accumulation",
        },
    };
}

export const InventoryChart: React.FC<InventoryChartProps> = ({
    stocks,
    selectedStock,
    onSelectStock,
    onFetchNewStock,
    onNavigateToChart,
}) => {
    // Current active stock
    const currentStock = selectedStock || stocks[0];
    const ticker = currentStock?.ticker || "BBCA";

    // Time range state (Default 3 Months back)
    const [timePreset, setTimePreset] = useState<TimeRangePreset>("3M");
    const [customStartDate, setCustomStartDate] = useState<string>("");
    const [customEndDate, setCustomEndDate] = useState<string>("");
    const [isDualCalendarOpen, setIsDualCalendarOpen] = useState(false);

    // Broker filter state
    const [isAutoSelected, setIsAutoSelected] = useState<boolean>(true);
    const [customActiveBrokers, setCustomActiveBrokers] = useState<string[]>(
        [],
    );
    const [brokerSearchQuery, setBrokerSearchQuery] = useState<string>("");
    const [stockSearchQuery, setStockSearchQuery] = useState<string>("");
    const [showStockDropdown, setShowStockDropdown] = useState<boolean>(false);
    const [showBrokerCatalogModal, setShowBrokerCatalogModal] =
        useState<boolean>(false);
    const [modalSearchQuery, setModalSearchQuery] = useState<string>("");
    const [isSearchingStock, setIsSearchingStock] = useState<boolean>(false);
    const [brokerApiData, setBrokerApiData] =
        useState<BrokerInventorySummary | null>(null);
    const [isBrokerApiLoading, setIsBrokerApiLoading] =
        useState<boolean>(false);
    const [brokerApiError, setBrokerApiError] = useState<string>("");
    const [brokerTablePage, setBrokerTablePage] = useState<number>(1);

    // Expanded toggles for Class 1 & Class 2 (default show top 5)
    const [showAllBuyers, setShowAllBuyers] = useState<boolean>(false);
    const [showAllSellers, setShowAllSellers] = useState<boolean>(false);
    const [brokerViewMode, setBrokerViewMode] = useState<
        "CARDS" | "SUMMARY_TABLE"
    >("CARDS");

    // Chart interactivity states
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [hoveredCandleIndex, setHoveredCandleIndex] = useState<number | null>(
        null,
    );
    const [copyStatus, setCopyStatus] = useState<string | null>(null);
    const copyStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
        null,
    );

    useEffect(() => {
        return () => {
            if (copyStatusTimerRef.current) {
                clearTimeout(copyStatusTimerRef.current);
            }
        };
    }, []);

    const announceCopyStatus = (status: string) => {
        if (copyStatusTimerRef.current) {
            clearTimeout(copyStatusTimerRef.current);
        }
        setCopyStatus(status);
        copyStatusTimerRef.current = setTimeout(() => {
            setCopyStatus(null);
            copyStatusTimerRef.current = null;
        }, 2500);
    };

    const handleCopyInventoryImage = () => {
        const sourceCanvas = canvasRef.current;
        if (!sourceCanvas) {
            announceCopyStatus("Chart belum siap");
            return;
        }

        const sourceWidth = sourceCanvas.width > 0 ? sourceCanvas.width : 1200;
        const sourceHeight =
            sourceCanvas.height > 0 ? sourceCanvas.height : 520;
        const scale = Math.max(1, sourceWidth / 1200);
        const headerHeight = Math.round(72 * scale);
        const exportCanvas = document.createElement("canvas");
        exportCanvas.width = sourceWidth;
        exportCanvas.height = sourceHeight + headerHeight;
        const exportContext = exportCanvas.getContext("2d");
        if (!exportContext) {
            announceCopyStatus("Copy gagal");
            return;
        }

        const normalizedTicker =
            ticker
                .replace(/\.JK$/i, "")
                .replace(/^\^?JKSE$/i, "IHSG")
                .toUpperCase()
                .replace(/[^A-Z0-9-]/g, "") || "STOCK";
        const periodStart = startDateStr || "N/A";
        const periodEnd = endDateStr || "N/A";
        const safePeriodStart = periodStart.replace(/[^0-9A-Za-z-]/g, "_");
        const safePeriodEnd = periodEnd.replace(/[^0-9A-Za-z-]/g, "_");
        exportContext.fillStyle = "#0f172a";
        exportContext.fillRect(0, 0, sourceWidth, headerHeight);
        exportContext.fillStyle = "#22d3ee";
        exportContext.font = `700 ${Math.max(16, Math.round(18 * scale))}px Inter, sans-serif`;
        exportContext.textAlign = "left";
        exportContext.fillText(
            `${normalizedTicker} · Inventory Chart`,
            Math.round(24 * scale),
            Math.round(30 * scale),
        );
        exportContext.fillStyle = "#cbd5e1";
        exportContext.font = `${Math.max(11, Math.round(12 * scale))}px JetBrains Mono, monospace`;
        exportContext.fillText(
            `Periode: ${periodStart} – ${periodEnd}`,
            Math.round(24 * scale),
            Math.round(54 * scale),
        );

        if (sourceCanvas.width > 0 && sourceCanvas.height > 0) {
            exportContext.drawImage(
                sourceCanvas,
                0,
                headerHeight,
                sourceWidth,
                sourceHeight,
            );
        } else {
            exportContext.fillStyle = "#080c14";
            exportContext.fillRect(0, headerHeight, sourceWidth, sourceHeight);
            exportContext.fillStyle = "#64748b";
            exportContext.font = `${Math.max(12, Math.round(14 * scale))}px Inter, sans-serif`;
            exportContext.textAlign = "center";
            exportContext.fillText(
                "Tidak ada data candle untuk rentang tanggal ini.",
                sourceWidth / 2,
                headerHeight + sourceHeight / 2,
            );
        }

        exportCanvas.toBlob(async (blob) => {
            if (!blob) {
                announceCopyStatus("Copy gagal");
                return;
            }
            try {
                if (
                    typeof navigator !== "undefined" &&
                    navigator.clipboard?.write &&
                    typeof ClipboardItem !== "undefined"
                ) {
                    await navigator.clipboard.write([
                        new ClipboardItem({ "image/png": blob }),
                    ]);
                    announceCopyStatus("Copied to Clipboard!");
                    return;
                }
                throw new Error("Clipboard PNG tidak didukung");
            } catch {
                try {
                    const url = URL.createObjectURL(blob);
                    const anchor = document.createElement("a");
                    anchor.href = url;
                    anchor.download = `${normalizedTicker}_Inventory_${safePeriodStart}_${safePeriodEnd}.png`;
                    document.body.appendChild(anchor);
                    anchor.click();
                    anchor.remove();
                    URL.revokeObjectURL(url);
                    announceCopyStatus("Image Downloaded");
                } catch {
                    announceCopyStatus("Copy gagal");
                }
            }
        }, "image/png");
    };

    // Calculate start & end date strings based on preset
    const { startDateStr, endDateStr } = useMemo(() => {
        const candles = currentStock?.candles || [];
        if (candles.length === 0) return { startDateStr: "", endDateStr: "" };

        const lastCandle = candles[candles.length - 1];
        const endDate = lastCandle
            ? normalizeDate(lastCandle.time)
            : new Date().toISOString().split("T")[0];

        if (timePreset === "CUSTOM" && customStartDate && customEndDate) {
            return { startDateStr: customStartDate, endDateStr: customEndDate };
        }

        let daysBack = 65; // ~3 Months (default)
        if (timePreset === "1M") daysBack = 22;
        if (timePreset === "3M") daysBack = 65;
        if (timePreset === "6M") daysBack = 130;
        if (timePreset === "1Y") daysBack = 260;
        if (timePreset === "YTD") {
            const year = new Date().getFullYear();
            const firstDayOfYear = `${year}-01-01`;
            return { startDateStr: firstDayOfYear, endDateStr: endDate };
        }

        const startIndex = Math.max(0, candles.length - daysBack);
        const startDate = normalizeDate(
            candles[startIndex]?.time || candles[0]?.time || "",
        );
        return { startDateStr: startDate, endDateStr: endDate };
    }, [currentStock, timePreset, customStartDate, customEndDate]);

    const emptyInventoryData = useMemo(
        () =>
            createEmptyInventorySummary(
                ticker,
                currentStock,
                startDateStr,
                endDateStr,
            ),
        [ticker, currentStock, startDateStr, endDateStr],
    );

    useEffect(() => {
        if (!currentStock || !startDateStr || !endDateStr) {
            setBrokerApiData(null);
            setBrokerApiError("");
            setIsBrokerApiLoading(false);
            return;
        }

        const controller = new AbortController();
        setIsBrokerApiLoading(true);
        setBrokerApiError("");

        const fetchPayload = async <T,>(
            url: string,
            label: string,
        ): Promise<T> => {
            let response = await fetch(url, { signal: controller.signal });
            let body = await response.json().catch(() => null);

            // A conditional browser/CDN request can expose 304 without a JSON body.
            // Retry once with a unique query key so the chart can still receive the
            // cached provider payload instead of treating cache validation as an API error.
            if (response.status === 304) {
                const retryUrl = `${url}${url.includes("?") ? "&" : "?"}_cache_bust=${Date.now()}`;
                response = await fetch(retryUrl, {
                    signal: controller.signal,
                    cache: "no-store",
                });
                body = await response.json().catch(() => null);
            }

            if (!response.ok || !body?.success || !body?.data) {
                throw new Error(body?.error || `${label} tidak tersedia`);
            }
            return body.data as T;
        };

        Promise.allSettled([
            fetchPayload<BrokerDataSummaryPayload>(
                `/api/broker-summary?symbol=${encodeURIComponent(ticker)}&start_date=${encodeURIComponent(startDateStr)}&end_date=${encodeURIComponent(endDateStr)}&broker_limit=20&level_limit=25`,
                "Broker summary",
            ),
            fetchPayload<BrokerDataAccumulationPayload>(
                `/api/broker-accumulation?symbol=${encodeURIComponent(ticker)}&start_date=${encodeURIComponent(startDateStr)}&end_date=${encodeURIComponent(endDateStr)}`,
                "Broker accumulation",
            ),
        ])
            .then(([summaryResult, accumulationResult]) => {
                if (controller.signal.aborted) return;

                const summaryPayload =
                    summaryResult.status === "fulfilled"
                        ? summaryResult.value
                        : null;
                const accumulationPayload =
                    accumulationResult.status === "fulfilled"
                        ? accumulationResult.value
                        : null;
                const summaryHasData = Boolean(summaryPayload?.brokers?.length);
                const accumulationHasData = Boolean(
                    accumulationPayload?.series?.some(
                        (entry) => (entry.points || []).length > 0,
                    ),
                );
                const errors = [summaryResult, accumulationResult]
                    .filter(
                        (result): result is PromiseRejectedResult =>
                            result.status === "rejected",
                    )
                    .map((result) =>
                        result.reason instanceof Error
                            ? result.reason.message
                            : "Provider tidak tersedia",
                    );

                if (!summaryHasData && !accumulationHasData) {
                    setBrokerApiData(null);
                    setBrokerApiError(
                        errors[0] || "Data inventory real tidak tersedia",
                    );
                } else {
                    setBrokerApiData(
                        buildBrokerDataInventorySummary(
                            summaryPayload,
                            accumulationPayload,
                            emptyInventoryData,
                            customActiveBrokers,
                        ),
                    );
                    setBrokerApiError(errors.join(" · "));
                }
            })
            .catch((error: unknown) => {
                if (controller.signal.aborted) return;
                setBrokerApiData(null);
                setBrokerApiError(
                    error instanceof Error
                        ? error.message
                        : "Data inventory real tidak tersedia",
                );
            })
            .finally(() => {
                if (!controller.signal.aborted) setIsBrokerApiLoading(false);
            });

        return () => controller.abort();
    }, [
        ticker,
        startDateStr,
        endDateStr,
        currentStock,
        emptyInventoryData,
        customActiveBrokers,
    ]);

    const inventoryData =
        brokerApiData?.ticker === ticker.replace(".JK", "").toUpperCase()
            ? brokerApiData
            : emptyInventoryData;

    // Derive active broker codes
    const activeBrokerCodes = useMemo(() => {
        if (isAutoSelected) {
            return inventoryData.autoSelectedBrokerCodes;
        }
        return customActiveBrokers;
    }, [
        isAutoSelected,
        inventoryData.autoSelectedBrokerCodes,
        customActiveBrokers,
    ]);

    const inventoryNaraSummary = useMemo(
        () =>
            buildInventoryNaraSummary({
                summary: {
                    ...inventoryData,
                    coverage: inventoryData.coverage
                        ? {
                              ...inventoryData.coverage,
                              selectedBrokerCodes: [
                                  ...activeBrokerCodes,
                              ].sort(),
                          }
                        : inventoryData.coverage,
                },
                candles: inventoryData.candles,
                selectedBrokerCodes: activeBrokerCodes,
                asOfDate: endDateStr,
            }),
        [inventoryData, activeBrokerCodes, endDateStr],
    );

    const inventoryNaraMeta = useMemo(() => {
        const selected = new Set(
            activeBrokerCodes.map((code) => code.toUpperCase()),
        );
        const selectedPoints = inventoryData.allBrokers
            .filter((broker) => selected.has(broker.brokerCode.toUpperCase()))
            .flatMap((broker) => broker.dailyPoints);
        const candleDates = new Set(
            inventoryData.candles.map((candle) => normalizeDate(candle.time)),
        );
        return {
            selectedBrokerCount: selected.size,
            requestedStartDate: inventoryData.startDate,
            requestedEndDate: inventoryData.endDate,
            validPointCount: selectedPoints.filter((point) =>
                candleDates.has(normalizeDate(point.date)),
            ).length,
            missingDateCount:
                inventoryData.coverage?.missingRequestedDates.length || 0,
            source:
                inventoryData.coverage?.source ||
                inventoryData.dataSource ||
                "UNKNOWN",
        };
    }, [inventoryData, activeBrokerCodes]);

    // Toggle broker visibility
    const handleToggleBroker = (code: string) => {
        const clean = code.toUpperCase();
        if (isAutoSelected) {
            setIsAutoSelected(false);
            const current = inventoryData.autoSelectedBrokerCodes;
            if (current.includes(clean)) {
                setCustomActiveBrokers(current.filter((c) => c !== clean));
            } else {
                setCustomActiveBrokers([...current, clean]);
            }
        } else {
            if (customActiveBrokers.includes(clean)) {
                setCustomActiveBrokers(
                    customActiveBrokers.filter((c) => c !== clean),
                );
            } else {
                setCustomActiveBrokers([...customActiveBrokers, clean]);
            }
        }
    };

    // Filter stocks in dropdown
    const filteredStockList = useMemo(() => {
        const q = stockSearchQuery.toUpperCase().trim();
        if (!q) return stocks;
        return stocks.filter(
            (s) =>
                s.ticker.toUpperCase().includes(q) ||
                s.name.toUpperCase().includes(q),
        );
    }, [stocks, stockSearchQuery]);

    // Handle Free Text Search on ENTER (including illiquid / micro-cap / second-third liner stocks)
    const handleExecuteFreeStockSearch = async (rawQuery: string) => {
        const clean = rawQuery.trim().toUpperCase().replace(".JK", "");
        if (!clean) return;

        setShowStockDropdown(false);
        setStockSearchQuery("");

        // 1. Check if already in existing list
        const existing = stocks.find((s) => s.ticker.toUpperCase() === clean);
        if (existing) {
            onSelectStock(existing);
            return;
        }

        // 2. Fetch stock data through the application data source.
        setIsSearchingStock(true);
        try {
            if (onFetchNewStock) {
                await onFetchNewStock(clean);
            } else {
                // Direct backend lookup when the parent has no fetch callback.
                const res = await fetch(
                    `/api/stock/${encodeURIComponent(clean)}`,
                );
                if (res.ok) {
                    const freshData: StockData = await res.json();
                    if (
                        freshData &&
                        freshData.candles &&
                        freshData.candles.length > 0
                    ) {
                        onSelectStock(freshData);
                        return;
                    }
                }
            }
        } catch (e) {
            console.warn("Error fetching custom stock:", e);
        } finally {
            setIsSearchingStock(false);
        }
    };

    // Filter brokers in side panel
    const { filteredBuyers, filteredSellers } = useMemo(() => {
        const q = brokerSearchQuery.toUpperCase().trim();
        const match = (b: BrokerInventoryItem) =>
            !q ||
            b.brokerCode.includes(q) ||
            b.brokerName.toUpperCase().includes(q);

        return {
            filteredBuyers: inventoryData.topNetBuyers.filter(match),
            filteredSellers: inventoryData.topNetSellers.filter(match),
        };
    }, [inventoryData, brokerSearchQuery]);

    // Displayed Buyers & Sellers (Top 5 by default, expandable to all)
    const displayedBuyers = useMemo(() => {
        if (showAllBuyers || brokerSearchQuery) return filteredBuyers;
        return filteredBuyers.slice(0, 5);
    }, [filteredBuyers, showAllBuyers, brokerSearchQuery]);

    const displayedSellers = useMemo(() => {
        if (showAllSellers || brokerSearchQuery) return filteredSellers;
        return filteredSellers.slice(0, 5);
    }, [filteredSellers, showAllSellers, brokerSearchQuery]);

    const filteredBrokerRows = useMemo(() => {
        const q = brokerSearchQuery.toUpperCase().trim();
        return sortBrokerInventoryRows(
            inventoryData.allBrokers.filter(
                (broker) =>
                    !q ||
                    broker.brokerCode.includes(q) ||
                    broker.brokerName.toUpperCase().includes(q),
            ),
        );
    }, [inventoryData.allBrokers, brokerSearchQuery]);

    const brokerTablePageSize = 10;
    const brokerTableTotalPages = Math.max(
        1,
        Math.ceil(filteredBrokerRows.length / brokerTablePageSize),
    );
    const safeBrokerTablePage = Math.min(
        brokerTablePage,
        brokerTableTotalPages,
    );
    const paginatedBrokerRows = filteredBrokerRows.slice(
        (safeBrokerTablePage - 1) * brokerTablePageSize,
        safeBrokerTablePage * brokerTablePageSize,
    );

    useEffect(() => {
        setBrokerTablePage(1);
    }, [brokerSearchQuery, ticker, startDateStr, endDateStr, brokerViewMode]);

    // Filter IDX exchange members directory in modal
    const filteredBrokerCatalog = useMemo(() => {
        return searchExchangeMemberBrokers(modalSearchQuery);
    }, [modalSearchQuery]);

    // Calculate Volume MA20
    const volumeMa20 = useMemo(() => {
        const candles = inventoryData.candles;
        const ma: (number | null)[] = [];
        for (let i = 0; i < candles.length; i++) {
            if (i < 4) {
                ma.push(null);
            } else {
                const windowSize = Math.min(20, i + 1);
                let sum = 0;
                for (let j = i - windowSize + 1; j <= i; j++) {
                    sum += candles[j].volume;
                }
                ma.push(sum / windowSize);
            }
        }
        return ma;
    }, [inventoryData.candles]);

    // -------------------------------------------------------------
    // UNIFIED CANVAS DRAWING: Candlestick + Volume + Broker Lines
    // -------------------------------------------------------------
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        // Padding configuration
        const paddingLeft = 70; // Left Axis: Broker Net Lots
        const paddingRight = 75; // Right Axis: Price (Rp) & Volume
        const paddingTop = 28;
        const paddingBottom = 38; // X-axis dates

        const chartWidth = Math.max(10, width - paddingLeft - paddingRight);
        const totalHeight = Math.max(10, height - paddingTop - paddingBottom);

        const priceChartHeight = totalHeight * 0.72; // Main price & broker lines
        const volumeChartHeight = totalHeight * 0.28; // Volume area at bottom

        const priceTop = paddingTop;
        const volumeTop = priceTop + priceChartHeight;

        // Clear background
        ctx.fillStyle = "#080c14";
        ctx.fillRect(0, 0, width, height);

        const candles = inventoryData.candles;
        if (!candles || candles.length === 0) {
            ctx.fillStyle = "#64748b";
            ctx.font = "14px Inter, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(
                "Tidak ada data candle untuk rentang tanggal ini.",
                width / 2,
                height / 2,
            );
            return;
        }

        const n = candles.length;
        const candleSpacing = chartWidth / n;
        const candleWidth = Math.max(2, Math.min(16, candleSpacing * 0.62));

        // Calculate Price Min & Max
        let minPrice = Infinity;
        let maxPrice = -Infinity;
        let maxVolume = 0;

        candles.forEach((c) => {
            if (c.low < minPrice) minPrice = c.low;
            if (c.high > maxPrice) maxPrice = c.high;
            if (c.volume > maxVolume) maxVolume = c.volume;
        });

        const priceBuffer = Math.max(1, (maxPrice - minPrice) * 0.08);
        const chartMinPrice = Math.max(1, minPrice - priceBuffer);
        const chartMaxPrice = maxPrice + priceBuffer;
        const priceRange = Math.max(1, chartMaxPrice - chartMinPrice);

        const getPriceY = (price: number) => {
            return (
                priceTop +
                priceChartHeight -
                ((price - chartMinPrice) / priceRange) * priceChartHeight
            );
        };

        const getCandleX = (index: number) => {
            return paddingLeft + index * candleSpacing + candleSpacing / 2;
        };
        const candleIndexByDate = new Map(
            candles.map((candle, index) => [normalizeDate(candle.time), index]),
        );

        // Calculate Broker Cumulative Net Volume Min & Max
        const activeBrokers = inventoryData.allBrokers.filter((b) =>
            activeBrokerCodes.includes(b.brokerCode),
        );

        let maxCumVol = 0;
        activeBrokers.forEach((b) => {
            b.dailyPoints.forEach((dp) => {
                const absVal = Math.abs(dp.cumNetVol);
                if (absVal > maxCumVol) maxCumVol = absVal;
            });
        });

        if (maxCumVol === 0) maxCumVol = 10000;
        const cumVolRange = maxCumVol * 1.15;

        // Zero-line Y coordinate for Broker Cumulative Overlay
        const invZeroY = priceTop + priceChartHeight / 2;
        const getInvY = (cumVol: number) => {
            return (
                invZeroY - (cumVol / cumVolRange) * (priceChartHeight / 2 - 12)
            );
        };

        // 1. Draw Grid lines
        ctx.strokeStyle = "#172033";
        ctx.lineWidth = 1;

        // Horizontal Price Grids
        for (let i = 0; i <= 4; i++) {
            const p = chartMinPrice + (priceRange / 4) * i;
            const y = getPriceY(p);
            ctx.beginPath();
            ctx.moveTo(paddingLeft, y);
            ctx.lineTo(width - paddingRight, y);
            ctx.stroke();

            // Right Y-Axis: Price (Rp)
            ctx.fillStyle = "#94a3b8";
            ctx.font = "10px JetBrains Mono, monospace";
            ctx.textAlign = "left";
            ctx.fillText(
                `Rp ${Math.round(p).toLocaleString()}`,
                width - paddingRight + 6,
                y + 3,
            );
        }

        // Left Y-Axis: Broker Cumulative Net Lot Levels
        ctx.fillStyle = "#38bdf8";
        ctx.font = "9px JetBrains Mono, monospace";
        ctx.textAlign = "right";
        const topLotK = Math.round(maxCumVol / 1000);
        ctx.fillText(
            `+${topLotK.toLocaleString()}K Lot`,
            paddingLeft - 8,
            priceTop + 12,
        );
        ctx.fillText(`0 Lot`, paddingLeft - 8, invZeroY + 3);
        ctx.fillText(
            `-${topLotK.toLocaleString()}K Lot`,
            paddingLeft - 8,
            priceTop + priceChartHeight - 6,
        );

        // Baseline 0 Lot dashed line across price canvas
        ctx.save();
        ctx.strokeStyle = "rgba(56, 189, 248, 0.25)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(paddingLeft, invZeroY);
        ctx.lineTo(width - paddingRight, invZeroY);
        ctx.stroke();
        ctx.restore();

        // Volume Separator line
        ctx.strokeStyle = "#1e293b";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(paddingLeft, volumeTop);
        ctx.lineTo(width - paddingRight, volumeTop);
        ctx.stroke();

        // Volume label
        ctx.fillStyle = "#64748b";
        ctx.font = "9px Inter, sans-serif";
        ctx.textAlign = "left";
        ctx.fillText("Volume (Lot) & MA20", paddingLeft + 4, volumeTop + 12);

        // 2. Draw Candlesticks & Volume Bars
        candles.forEach((c, idx) => {
            const cx = getCandleX(idx);
            const isBull = c.close >= c.open;

            const openY = getPriceY(c.open);
            const closeY = getPriceY(c.close);
            const highY = getPriceY(c.high);
            const lowY = getPriceY(c.low);

            const topBodyY = Math.min(openY, closeY);
            const bodyHeight = Math.max(1.5, Math.abs(closeY - openY));

            const candleColor = isBull ? "#089981" : "#f23645";

            // Candlestick Wick
            ctx.strokeStyle = candleColor;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(cx, highY);
            ctx.lineTo(cx, lowY);
            ctx.stroke();

            // Candlestick Body
            ctx.fillStyle = candleColor;
            ctx.fillRect(
                cx - candleWidth / 2,
                topBodyY,
                candleWidth,
                bodyHeight,
            );

            // Volume Calculation & High Volume Spike Highlights
            if (maxVolume > 0) {
                const vMa = volumeMa20[idx];
                const isVolumeSpike = vMa != null && c.volume > vMa * 1.3;

                const volHeight =
                    (c.volume / maxVolume) * (volumeChartHeight - 16);
                const volY = volumeTop + volumeChartHeight - volHeight;

                // Volume Bar Fill
                if (isVolumeSpike) {
                    ctx.fillStyle = isBull ? "#10b981" : "#ef4444";
                    ctx.fillRect(
                        cx - candleWidth / 2,
                        volY,
                        candleWidth,
                        volHeight,
                    );

                    ctx.strokeStyle = "#f59e0b"; // Amber border highlight for high volume spike
                    ctx.lineWidth = 1.2;
                    ctx.strokeRect(
                        cx - candleWidth / 2,
                        volY,
                        candleWidth,
                        volHeight,
                    );
                } else {
                    ctx.fillStyle = isBull
                        ? "rgba(8, 153, 129, 0.4)"
                        : "rgba(242, 54, 69, 0.4)";
                    ctx.fillRect(
                        cx - candleWidth / 2,
                        volY,
                        candleWidth,
                        volHeight,
                    );
                }
            }

            // X-axis Date labels (~6 evenly spaced labels)
            const labelInterval = Math.max(1, Math.floor(n / 6));
            if (idx % labelInterval === 0 || idx === n - 1) {
                ctx.fillStyle = "#64748b";
                ctx.font = "10px Inter, sans-serif";
                ctx.textAlign = "center";
                ctx.fillText(c.time.slice(5), cx, height - 10);
            }
        });

        // Draw Volume MA20 Line
        ctx.beginPath();
        let volMaStarted = false;
        for (let i = 0; i < n; i++) {
            const vMa = volumeMa20[i];
            if (vMa != null && maxVolume > 0) {
                const cx = getCandleX(i);
                const vHeight = (vMa / maxVolume) * (volumeChartHeight - 16);
                const vy = volumeTop + volumeChartHeight - vHeight;
                if (!volMaStarted) {
                    ctx.moveTo(cx, vy);
                    volMaStarted = true;
                } else {
                    ctx.lineTo(cx, vy);
                }
            }
        }
        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // 3. Draw UNIFIED Broker Cumulative Inventory Overlay Curves
        activeBrokers.forEach((broker) => {
            if (broker.dailyPoints.length === 0) return;

            const alignedPoints = broker.dailyPoints
                .map((point) => ({
                    point,
                    candleIndex: candleIndexByDate.get(
                        normalizeDate(point.date),
                    ),
                }))
                .filter(
                    (
                        entry,
                    ): entry is {
                        point: (typeof broker.dailyPoints)[number];
                        candleIndex: number;
                    } => entry.candleIndex !== undefined,
                )
                .sort((a, b) => a.candleIndex - b.candleIndex);
            if (alignedPoints.length === 0) return;

            ctx.save();
            ctx.strokeStyle = broker.color;
            ctx.lineWidth = 2.4;
            ctx.beginPath();

            alignedPoints.forEach(({ point, candleIndex }, idx) => {
                const x = getCandleX(candleIndex);
                const y = getInvY(point.cumNetVol);
                const previousIndex =
                    idx > 0 ? alignedPoints[idx - 1].candleIndex : null;
                // Keep the real curve visually continuous across provider date gaps.
                // Missing dates are not filled with synthetic zero-valued points.
                if (previousIndex === null) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            });
            ctx.stroke();

            // Glowing dot & label on the latest point
            const lastAlignedPoint = alignedPoints[alignedPoints.length - 1];
            const lastPoint = lastAlignedPoint?.point;
            if (lastPoint) {
                const lastX = getCandleX(lastAlignedPoint.candleIndex);
                const lastY = getInvY(lastPoint.cumNetVol);

                // Terminal glowing dot
                ctx.beginPath();
                ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
                ctx.fillStyle = broker.color;
                ctx.fill();
                ctx.strokeStyle = "#ffffff";
                ctx.lineWidth = 1.5;
                ctx.stroke();

                // Broker Code badge directly on line end
                ctx.fillStyle = broker.color;
                ctx.font = "bold 10px JetBrains Mono, monospace";
                ctx.textAlign = "left";
                const lotsK = Math.round(lastPoint.cumNetVol / 1000);
                const text = `${broker.brokerCode} (${lotsK >= 0 ? "+" : ""}${lotsK}K)`;
                ctx.fillText(
                    text,
                    Math.min(width - paddingRight - 80, lastX + 6),
                    lastY - 3,
                );
            }
            ctx.restore();
        });

        // 4. Draw Crosshair & Hover Tooltip Line
        if (
            hoveredCandleIndex !== null &&
            hoveredCandleIndex >= 0 &&
            hoveredCandleIndex < n
        ) {
            const hCandle = candles[hoveredCandleIndex];
            const hX = getCandleX(hoveredCandleIndex);

            ctx.save();
            ctx.strokeStyle = "#38bdf8";
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);

            // Vertical crosshair through entire chart
            ctx.beginPath();
            ctx.moveTo(hX, paddingTop);
            ctx.lineTo(hX, height - paddingBottom);
            ctx.stroke();

            // Hover dot on Close Price
            const hPriceY = getPriceY(hCandle.close);
            ctx.beginPath();
            ctx.arc(hX, hPriceY, 4, 0, Math.PI * 2);
            ctx.fillStyle = "#38bdf8";
            ctx.fill();

            // Hover dots on all active broker points for this date
            activeBrokers.forEach((b) => {
                const hoverDate = normalizeDate(hCandle.time);
                const dp = b.dailyPoints.find(
                    (point) => normalizeDate(point.date) === hoverDate,
                );
                if (dp) {
                    const by = getInvY(dp.cumNetVol);
                    ctx.beginPath();
                    ctx.arc(hX, by, 3.5, 0, Math.PI * 2);
                    ctx.fillStyle = b.color;
                    ctx.fill();
                    ctx.strokeStyle = "#ffffff";
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
            });

            ctx.restore();
        }
    }, [inventoryData, activeBrokerCodes, hoveredCandleIndex, volumeMa20]);

    // Handle mouse move on unified canvas
    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;

        const paddingLeft = 70;
        const paddingRight = 75;
        const chartWidth = rect.width - paddingLeft - paddingRight;
        const n = inventoryData.candles.length;

        if (n > 0 && x >= paddingLeft && x <= rect.width - paddingRight) {
            const candleSpacing = chartWidth / n;
            const index = Math.floor((x - paddingLeft) / candleSpacing);
            const clampedIndex = Math.max(0, Math.min(n - 1, index));
            setHoveredCandleIndex(clampedIndex);
        } else {
            setHoveredCandleIndex(null);
        }
    };

    const handleMouseLeave = () => {
        setHoveredCandleIndex(null);
    };

    // Derived hovered / latest candle data for zero-shift fixed ribbon
    const candles = inventoryData.candles;
    const latestCandle =
        candles.length > 0 ? candles[candles.length - 1] : null;
    const activeCandle =
        hoveredCandleIndex !== null
            ? candles[hoveredCandleIndex]
            : latestCandle;
    const activeVMa =
        hoveredCandleIndex !== null
            ? volumeMa20[hoveredCandleIndex]
            : volumeMa20[candles.length - 1];
    const isActiveSpike =
        activeCandle && activeVMa
            ? activeCandle.volume > activeVMa * 1.3
            : false;
    const isHoverActive = hoveredCandleIndex !== null && activeCandle != null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="min-h-screen bg-slate-950 text-slate-100 flex flex-col"
        >
            {/* Top Header Bar */}
            <div className="border-b border-slate-800/80 bg-slate-900/90 backdrop-blur sticky top-0 z-30 px-4 py-3">
                <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
                    {/* Ticker Selector & Free Search */}
                    <div className="flex items-center gap-3 relative">
                        <div className="relative">
                            <button
                                onClick={() =>
                                    setShowStockDropdown(!showStockDropdown)
                                }
                                className="flex items-center gap-2 bg-slate-950 border border-slate-700 hover:border-cyan-500/60 px-3.5 py-1.5 rounded-xl transition-all shadow-md group cursor-pointer"
                            >
                                <div className="flex items-center gap-2">
                                    <span className="font-mono font-black text-base text-white group-hover:text-cyan-400 transition-colors">
                                        {ticker}
                                    </span>
                                    <span className="text-xs text-slate-400 max-w-[140px] truncate hidden sm:inline">
                                        {currentStock?.name}
                                    </span>
                                </div>
                                <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-cyan-400 transition-colors" />
                            </button>

                            {/* Stock Search Dropdown with Free-Search on ENTER */}
                            {showStockDropdown && (
                                <div className="absolute left-0 top-full mt-2 w-80 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-50 p-2.5 space-y-2">
                                    <div className="relative">
                                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                        <input
                                            type="text"
                                            placeholder="Ketik ticker lalu tekan ENTER..."
                                            value={stockSearchQuery}
                                            onChange={(e) =>
                                                setStockSearchQuery(
                                                    e.target.value,
                                                )
                                            }
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    e.preventDefault();
                                                    handleExecuteFreeStockSearch(
                                                        stockSearchQuery,
                                                    );
                                                }
                                            }}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
                                            autoFocus
                                        />
                                    </div>

                                    {/* Free Search Action Item for Any Stock (including illiquid / micro-caps) */}
                                    {stockSearchQuery.trim().length > 0 && (
                                        <button
                                            onClick={() =>
                                                handleExecuteFreeStockSearch(
                                                    stockSearchQuery,
                                                )
                                            }
                                            className="w-full text-left p-2 rounded-xl text-xs bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 flex items-center justify-between transition-colors cursor-pointer"
                                        >
                                            <div className="flex items-center gap-2">
                                                <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                                <div>
                                                    <div className="font-mono font-bold">
                                                        Cari Saham: &quot;
                                                        {stockSearchQuery.toUpperCase()}
                                                        &quot;
                                                    </div>
                                                    <div className="text-[10px] text-slate-400">
                                                        Tekan ENTER untuk memuat
                                                        emiten apa pun
                                                    </div>
                                                </div>
                                            </div>
                                            <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-cyan-300 border border-slate-700">
                                                ENTER
                                            </kbd>
                                        </button>
                                    )}

                                    {/* Stock List */}
                                    <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                                        {filteredStockList.map((s) => (
                                            <button
                                                key={s.ticker}
                                                onClick={() => {
                                                    onSelectStock(s);
                                                    setShowStockDropdown(false);
                                                    setStockSearchQuery("");
                                                }}
                                                className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer ${
                                                    s.ticker === ticker
                                                        ? "bg-cyan-500/10 text-cyan-400 font-bold border border-cyan-500/30"
                                                        : "hover:bg-slate-800 text-slate-300"
                                                }`}
                                            >
                                                <span className="font-mono font-bold">
                                                    {s.ticker}
                                                </span>
                                                <span className="text-slate-400 text-[11px] truncate max-w-[140px]">
                                                    {s.name}
                                                </span>
                                            </button>
                                        ))}
                                        {filteredStockList.length === 0 && (
                                            <div className="text-xs text-slate-400 p-2 text-center">
                                                Tekan{" "}
                                                <strong className="text-cyan-400">
                                                    ENTER
                                                </strong>{" "}
                                                untuk memuat saham bebas{" "}
                                                <strong className="text-white">
                                                    &quot;
                                                    {stockSearchQuery.toUpperCase()}
                                                    &quot;
                                                </strong>
                                                .
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Current Price & Quick Badge */}
                        <div className="flex items-center gap-2">
                            {isSearchingStock ? (
                                <span className="flex items-center gap-1.5 text-xs text-cyan-400 font-mono">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>Memuat emiten...</span>
                                </span>
                            ) : (
                                <span className="font-mono font-black text-lg text-white">
                                    Rp{" "}
                                    {currentStock?.currentPrice?.toLocaleString()}
                                </span>
                            )}
                            <button
                                onClick={() => onNavigateToChart(ticker)}
                                className="hidden md:flex items-center gap-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-cyan-400 px-2.5 py-1 rounded-lg transition-colors font-medium border border-slate-700 cursor-pointer"
                                title="Buka Smart Money Concept & Interactive Chart"
                            >
                                <BarChart3 className="w-3 h-3" />
                                <span>Buka Chart SMC</span>
                            </button>
                        </div>
                    </div>

                    {/* Time Range Preset & Interval Date Picker Bar */}
                    <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-mono font-medium">
                        {(
                            ["1M", "3M", "6M", "1Y", "YTD"] as TimeRangePreset[]
                        ).map((preset) => (
                            <button
                                key={preset}
                                onClick={() => {
                                    setTimePreset(preset);
                                    setCustomStartDate("");
                                    setCustomEndDate("");
                                }}
                                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                                    timePreset === preset
                                        ? "bg-cyan-500 text-slate-950 font-bold shadow-sm"
                                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                                }`}
                            >
                                {preset}
                            </button>
                        ))}

                        {/* Interval Date Picker (2 Calendars) Trigger */}
                        <button
                            onClick={() => setIsDualCalendarOpen(true)}
                            className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                                timePreset === "CUSTOM"
                                    ? "bg-cyan-500 text-slate-950 font-bold shadow-sm"
                                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                            }`}
                            title="Pilih rentang tanggal interval (2 Kalender)"
                        >
                            <Calendar className="w-3.5 h-3.5" />
                            <span>Interval (2 Kalender)</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="max-w-7xl mx-auto w-full p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1">
                {/* Left 8 Cols: Unified Candlestick & Broker Inventory Chart */}
                <div className="lg:col-span-8 space-y-3">
                    {/* Main Chart Container Card */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-2xl space-y-3">
                        {/* Chart Toolbar & Active Broker Chips */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                                    <Activity className="w-3.5 h-3.5 text-cyan-400" />
                                    <span>Broker Inventory Overlay</span>
                                </span>

                                {/* Auto Top 10 (Top 5 Net Buy + Top 5 Net Sell) Selection Button */}
                                <button
                                    onClick={() => {
                                        setIsAutoSelected(true);
                                        setCustomActiveBrokers([]);
                                    }}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono uppercase transition-all flex items-center gap-1 cursor-pointer border ${
                                        isAutoSelected
                                            ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/40 shadow-sm"
                                            : "bg-slate-800/80 text-slate-400 border-slate-700 hover:text-white"
                                    }`}
                                    title="Tampilkan Top 5 Net Buyer + Top 5 Net Seller Otomatis"
                                >
                                    <Sparkles className="w-3 h-3" />
                                    <span>Auto Top 10</span>
                                </button>

                                {/* Add Broker from Official IDX /ExchangeMember/GetBrokerSearch Directory */}
                                <button
                                    onClick={() =>
                                        setShowBrokerCatalogModal(true)
                                    }
                                    className="px-2.5 py-1 rounded-lg text-xs font-bold font-mono transition-all flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
                                    title="Cari dan tambahkan broker dari direktori resmi BEI"
                                >
                                    <Plus className="w-3 h-3 text-cyan-400" />
                                    <span>Tambah Broker</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={handleCopyInventoryImage}
                                    className="px-2.5 py-1 rounded-lg text-xs font-bold font-mono transition-all flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
                                    title="Salin unified Inventory Chart sebagai PNG"
                                >
                                    <Camera className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>{copyStatus || "Salin Gambar"}</span>
                                </button>
                            </div>

                            {/* Active Broker Legend Chips */}
                            <div className="flex flex-wrap items-center gap-1.5">
                                {inventoryData.allBrokers
                                    .filter((b) =>
                                        activeBrokerCodes.includes(
                                            b.brokerCode,
                                        ),
                                    )
                                    .map((b) => (
                                        <div
                                            key={b.brokerCode}
                                            className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 px-2 py-0.5 rounded-lg text-xs font-mono"
                                        >
                                            <span
                                                className="w-2.5 h-2.5 rounded-full"
                                                style={{
                                                    backgroundColor: b.color,
                                                }}
                                            />
                                            <span className="font-bold text-white">
                                                {b.brokerCode}
                                            </span>
                                            <button
                                                onClick={() =>
                                                    handleToggleBroker(
                                                        b.brokerCode,
                                                    )
                                                }
                                                className="text-slate-500 hover:text-rose-400 p-0.5 rounded"
                                                title={`Sembunyikan ${b.brokerCode}`}
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}
                            </div>
                        </div>

                        {/* Date Range & Foreign Flow Subheader */}
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-slate-400">
                            <div className="flex items-center gap-2">
                                <span
                                    className={`px-2 py-0.5 rounded border text-[10px] font-bold ${
                                        isBrokerApiLoading
                                            ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
                                            : inventoryData.dataSource ===
                                                "EXTERNAL"
                                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                                              : "border-rose-500/30 bg-rose-500/10 text-rose-300"
                                    }`}
                                >
                                    {isBrokerApiLoading
                                        ? "Memuat data broker eksternal..."
                                        : inventoryData.sourceLabel ||
                                          "Broker flow"}
                                </span>
                                <span>
                                    Periode:{" "}
                                    <strong className="text-slate-200">
                                        {inventoryData.startDate}
                                    </strong>{" "}
                                    s/d{" "}
                                    <strong className="text-slate-200">
                                        {inventoryData.endDate}
                                    </strong>{" "}
                                    ({inventoryData.totalTradingDays} Hari
                                    Bursa)
                                </span>
                            </div>

                            {brokerApiError && (
                                <span className="text-[10px] text-rose-300">
                                    {brokerApiError}
                                </span>
                            )}

                            {/* Foreign Flow Badge */}
                            {inventoryData.dataSource === "EXTERNAL" ? (
                                <div className="flex items-center gap-2">
                                    <span className="text-slate-400">
                                        Foreign Net:
                                    </span>
                                    <span
                                        className={`font-bold px-2 py-0.5 rounded ${
                                            inventoryData.stats.foreignNetVol >=
                                            0
                                                ? "bg-emerald-500/20 text-emerald-400"
                                                : "bg-rose-500/20 text-rose-400"
                                        }`}
                                    >
                                        {inventoryData.stats.foreignNetVol >= 0
                                            ? "+"
                                            : ""}
                                        {Math.round(
                                            inventoryData.stats.foreignNetVol,
                                        ).toLocaleString()}{" "}
                                        Lot (
                                        {inventoryData.stats.foreignNetVal >= 0
                                            ? "+"
                                            : ""}
                                        Rp{" "}
                                        {(
                                            inventoryData.stats.foreignNetVal /
                                            1e9
                                        ).toFixed(2)}{" "}
                                        M)
                                    </span>
                                </div>
                            ) : (
                                <span className="text-rose-300 text-[10px]">
                                    Ringkasan foreign real tidak tersedia
                                </span>
                            )}
                        </div>

                        <NaraSummaryPanel
                            summary={inventoryNaraSummary}
                            variant="INVENTORY"
                            loading={isBrokerApiLoading}
                            inventoryMeta={inventoryNaraMeta}
                        />

                        {/* PERMANENT FIXED-HEIGHT HOVER & DAILY RIBBON (GLITCH FIX: ZERO LAYOUT SHIFT) */}
                        <div className="min-h-[46px] bg-slate-950/95 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono flex flex-wrap items-center justify-between gap-2 shadow-inner">
                            {activeCandle ? (
                                <>
                                    <div className="flex flex-wrap items-center gap-2.5">
                                        <span className="text-cyan-400 font-bold flex items-center gap-1">
                                            {isHoverActive && (
                                                <Sparkles className="w-3 h-3 text-cyan-400" />
                                            )}
                                            <span>{activeCandle.time}</span>
                                        </span>
                                        <span className="text-slate-400">
                                            O:{" "}
                                            <strong className="text-slate-200">
                                                {activeCandle.open.toLocaleString()}
                                            </strong>
                                        </span>
                                        <span className="text-slate-400">
                                            H:{" "}
                                            <strong className="text-slate-200">
                                                {activeCandle.high.toLocaleString()}
                                            </strong>
                                        </span>
                                        <span className="text-slate-400">
                                            L:{" "}
                                            <strong className="text-slate-200">
                                                {activeCandle.low.toLocaleString()}
                                            </strong>
                                        </span>
                                        <span className="text-slate-400">
                                            C:{" "}
                                            <strong
                                                className={
                                                    activeCandle.close >=
                                                    activeCandle.open
                                                        ? "text-emerald-400"
                                                        : "text-rose-400"
                                                }
                                            >
                                                {activeCandle.close.toLocaleString()}
                                            </strong>
                                        </span>
                                        <span className="text-slate-400">
                                            Vol:{" "}
                                            <strong className="text-slate-200">
                                                {Math.round(
                                                    activeCandle.volume / 100,
                                                ).toLocaleString()}{" "}
                                                Lot
                                            </strong>
                                        </span>
                                        {isActiveSpike && (
                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-0.5">
                                                <Zap className="w-3 h-3 text-amber-400" />
                                                <span>Vol Spike</span>
                                            </span>
                                        )}
                                    </div>

                                    {/* Daily Active Broker Contribution on this date */}
                                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                                        {isHoverActive ? (
                                            <div className="flex items-center gap-2 overflow-x-auto">
                                                <span className="text-slate-500">
                                                    Arus Harian:
                                                </span>
                                                {inventoryData.allBrokers
                                                    .filter((b) =>
                                                        activeBrokerCodes.includes(
                                                            b.brokerCode,
                                                        ),
                                                    )
                                                    .slice(0, 4)
                                                    .map((b) => {
                                                        const activeDate =
                                                            normalizeDate(
                                                                activeCandle.time,
                                                            );
                                                        const dp =
                                                            b.dailyPoints.find(
                                                                (point) =>
                                                                    normalizeDate(
                                                                        point.date,
                                                                    ) ===
                                                                    activeDate,
                                                            );
                                                        if (!dp) return null;
                                                        return (
                                                            <span
                                                                key={
                                                                    b.brokerCode
                                                                }
                                                                className="flex items-center gap-1"
                                                            >
                                                                <span
                                                                    className="w-2 h-2 rounded-full"
                                                                    style={{
                                                                        backgroundColor:
                                                                            b.color,
                                                                    }}
                                                                />
                                                                <strong className="text-slate-200">
                                                                    {
                                                                        b.brokerCode
                                                                    }
                                                                    :
                                                                </strong>
                                                                <span
                                                                    className={
                                                                        dp.netVol >=
                                                                        0
                                                                            ? "text-emerald-400"
                                                                            : "text-rose-400"
                                                                    }
                                                                >
                                                                    {dp.netVol >=
                                                                    0
                                                                        ? "+"
                                                                        : ""}
                                                                    {Math.round(
                                                                        dp.netVol,
                                                                    ).toLocaleString()}
                                                                </span>
                                                            </span>
                                                        );
                                                    })}
                                            </div>
                                        ) : (
                                            <span className="text-slate-500 italic text-[11px]">
                                                {inventoryData.dataSource ===
                                                "EXTERNAL"
                                                    ? "Pilih candle untuk melihat histori broker pada tanggal tersebut."
                                                    : "Data inventory real tidak tersedia."}
                                            </span>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div className="text-slate-500 text-xs">
                                    Memuat data transaksi...
                                </div>
                            )}
                        </div>

                        {/* Unified Canvas (Candle + Volume + Broker Overlay) */}
                        <div className="w-full h-[520px] relative">
                            <canvas
                                ref={canvasRef}
                                onMouseMove={handleMouseMove}
                                onMouseLeave={handleMouseLeave}
                                className="w-full h-full block rounded-xl cursor-crosshair"
                            />
                        </div>
                    </div>
                </div>

                {/* Right 4 Cols: 2 Classes Panel (Top 5 Net Buy & Top 5 Net Sell) */}
                <div
                    className="
    lg:col-span-4
    lg:sticky
    lg:top-[76px]
    lg:self-start
    lg:max-h-[calc(100vh-92px)]
    lg:overflow-y-auto
    lg:[scrollbar-width:none]
    lg:[&::-webkit-scrollbar]:hidden
    space-y-4
"
                >
                    {" "}
                    {/* Panel Card */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-2xl space-y-4">
                        {/* Panel Header & Broker Search */}
                        <div className="space-y-2.5 border-b border-slate-800 pb-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                    <Layers className="w-4 h-4 text-cyan-400" />
                                    <span>Broker Inventory Summary</span>
                                </h3>
                                <span className="text-[11px] font-mono text-slate-400">
                                    {activeBrokerCodes.length} Aktif di Chart
                                </span>
                            </div>

                            {/* View Switcher: Cards vs SUMMARY Table */}
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-xs font-mono">
                                    <button
                                        onClick={() =>
                                            setBrokerViewMode("CARDS")
                                        }
                                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                                            brokerViewMode === "CARDS"
                                                ? "bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30"
                                                : "text-slate-400 hover:text-white"
                                        }`}
                                    >
                                        <LayoutGrid className="w-3.5 h-3.5" />
                                        <span>Kartu</span>
                                    </button>
                                    <button
                                        onClick={() =>
                                            setBrokerViewMode("SUMMARY_TABLE")
                                        }
                                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                                            brokerViewMode === "SUMMARY_TABLE"
                                                ? "bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30"
                                                : "text-slate-400 hover:text-white"
                                        }`}
                                    >
                                        <Table className="w-3.5 h-3.5" />
                                        <span>Summary</span>
                                    </button>
                                </div>

                                <span className="text-[10px] text-slate-500 font-mono">
                                    {inventoryData.allBrokers.length} Brokers
                                    IDX
                                </span>
                            </div>

                            {/* Search input for brokers */}
                            <div className="relative">
                                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    placeholder="Cari kode broker (misal: AO, BK, YP)..."
                                    value={brokerSearchQuery}
                                    onChange={(e) =>
                                        setBrokerSearchQuery(e.target.value)
                                    }
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
                                />
                            </div>
                        </div>

                        {brokerViewMode === "SUMMARY_TABLE" ? (
                            /* TABULAR SUMMARY VIEW */
                            <div className="space-y-3">
                                <div className="text-[11px] text-slate-400 font-mono flex items-center justify-between pb-1 border-b border-slate-800/80">
                                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                                        <ArrowUpRight className="w-3.5 h-3.5" />
                                        <span>
                                            Net Accumulation - Selected Period
                                        </span>
                                    </span>
                                    <span className="text-slate-500 text-right">
                                        Signed flow, bukan saldo custody
                                    </span>
                                </div>

                                <div className="overflow-x-auto max-h-96 pr-1 space-y-1">
                                    <table className="w-full text-left text-[11px] font-mono">
                                        <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 sticky top-0">
                                            <tr>
                                                <th className="py-1.5 px-1 font-semibold">
                                                    Bk
                                                </th>
                                                <th className="py-1.5 px-1 font-semibold text-right text-emerald-400">
                                                    B.Vol
                                                </th>
                                                <th className="py-1.5 px-1 font-semibold text-right text-emerald-400">
                                                    B.Avg
                                                </th>
                                                <th className="py-1.5 px-1 font-semibold text-right text-rose-400">
                                                    S.Vol
                                                </th>
                                                <th className="py-1.5 px-1 font-semibold text-right text-rose-400">
                                                    S.Avg
                                                </th>
                                                <th className="py-1.5 px-1 font-semibold text-right">
                                                    Net Vol
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800/50">
                                            {paginatedBrokerRows.map((b) => {
                                                const isVis =
                                                    activeBrokerCodes.includes(
                                                        b.brokerCode,
                                                    );
                                                return (
                                                    <tr
                                                        key={b.brokerCode}
                                                        onClick={() =>
                                                            handleToggleBroker(
                                                                b.brokerCode,
                                                            )
                                                        }
                                                        className={`hover:bg-slate-800/50 cursor-pointer transition-colors ${
                                                            isVis
                                                                ? "bg-slate-950/40"
                                                                : "opacity-60"
                                                        }`}
                                                    >
                                                        <td className="py-1 px-1 flex items-center gap-1">
                                                            <span
                                                                className="w-2 h-2 rounded-full flex-shrink-0"
                                                                style={{
                                                                    backgroundColor:
                                                                        b.color,
                                                                }}
                                                            />
                                                            <span className="font-bold text-white">
                                                                {b.brokerCode}
                                                            </span>
                                                            {b.cleanTendency ===
                                                                "CLEAN_ACCUM" && (
                                                                <span className="text-[8px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300">
                                                                    CA
                                                                </span>
                                                            )}
                                                            {b.cleanTendency ===
                                                                "CLEAN_DIST" && (
                                                                <span className="text-[8px] px-1 py-0.2 rounded bg-rose-500/20 text-rose-300">
                                                                    CD
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="py-1 px-1 text-right text-slate-300">
                                                            {Math.round(
                                                                b.totalBuyVol,
                                                            ).toLocaleString()}
                                                        </td>
                                                        <td className="py-1 px-1 text-right text-slate-400">
                                                            {b.avgBuyPrice.toLocaleString()}
                                                        </td>
                                                        <td className="py-1 px-1 text-right text-slate-300">
                                                            {Math.round(
                                                                b.totalSellVol,
                                                            ).toLocaleString()}
                                                        </td>
                                                        <td className="py-1 px-1 text-right text-slate-400">
                                                            {b.avgSellPrice.toLocaleString()}
                                                        </td>
                                                        <td
                                                            className={`py-1 px-1 text-right font-bold ${
                                                                b.netVol >= 0
                                                                    ? "text-emerald-400"
                                                                    : "text-rose-400"
                                                            }`}
                                                        >
                                                            {b.netVol >= 0
                                                                ? "+"
                                                                : ""}
                                                            {Math.round(
                                                                b.netVol,
                                                            ).toLocaleString()}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-slate-500">
                                    <span>
                                        {filteredBrokerRows.length === 0
                                            ? "Tidak ada broker"
                                            : `${(safeBrokerTablePage - 1) * brokerTablePageSize + 1}-${Math.min(safeBrokerTablePage * brokerTablePageSize, filteredBrokerRows.length)} dari ${filteredBrokerRows.length}`}
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setBrokerTablePage((page) =>
                                                    Math.max(1, page - 1),
                                                )
                                            }
                                            disabled={safeBrokerTablePage <= 1}
                                            className="p-1 rounded-md border border-slate-700 text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                                            aria-label="Halaman broker sebelumnya"
                                        >
                                            <ChevronLeft className="w-3.5 h-3.5" />
                                        </button>
                                        <span className="px-1.5 text-slate-300">
                                            {safeBrokerTablePage}/
                                            {brokerTableTotalPages}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setBrokerTablePage((page) =>
                                                    Math.min(
                                                        brokerTableTotalPages,
                                                        page + 1,
                                                    ),
                                                )
                                            }
                                            disabled={
                                                safeBrokerTablePage >=
                                                brokerTableTotalPages
                                            }
                                            className="p-1 rounded-md border border-slate-700 text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                                            aria-label="Halaman broker berikutnya"
                                        >
                                            <ChevronRight className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>

                                <div className="text-[10px] text-slate-500 font-mono text-center pt-1 border-t border-slate-800/80">
                                    Klik baris broker untuk toggle overlay kurva
                                    di chart
                                </div>
                            </div>
                        ) : (
                            /* CARD VIEW (CLASS 1 & CLASS 2) */
                            <>
                                {/* CLASS 1: TOP NET BUY (Akumulasi - Top 5 Default) */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                                            <ArrowUpRight className="w-4 h-4" />
                                            <span>
                                                Kelas 1: Top Net Buy (Top 5)
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-mono text-slate-400">
                                                {filteredBuyers.length} Broker
                                            </span>
                                            {filteredBuyers.length > 5 &&
                                                !brokerSearchQuery && (
                                                    <button
                                                        onClick={() =>
                                                            setShowAllBuyers(
                                                                !showAllBuyers,
                                                            )
                                                        }
                                                        className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
                                                    >
                                                        {showAllBuyers
                                                            ? "Top 5 Saja"
                                                            : "Lihat Semua"}
                                                    </button>
                                                )}
                                        </div>
                                    </div>

                                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                        {" "}
                                        {displayedBuyers.length === 0 ? (
                                            <div className="text-xs text-slate-500 py-3 text-center">
                                                Tidak ada data broker net buy.
                                            </div>
                                        ) : (
                                            displayedBuyers.map((broker) => {
                                                const isVisible =
                                                    activeBrokerCodes.includes(
                                                        broker.brokerCode,
                                                    );
                                                const isClean =
                                                    broker.cleanTendency ===
                                                    "CLEAN_ACCUM";
                                                return (
                                                    <div
                                                        key={broker.brokerCode}
                                                        className={`p-2.5 rounded-xl border transition-all ${
                                                            isVisible
                                                                ? "bg-slate-950/90 border-slate-700 shadow-sm"
                                                                : "bg-slate-950/40 border-slate-800/60 opacity-60"
                                                        }`}
                                                    >
                                                        <div className="flex items-center justify-between gap-2">
                                                            <div className="flex items-center gap-2">
                                                                {/* Color indicator / toggle eye */}
                                                                <button
                                                                    onClick={() =>
                                                                        handleToggleBroker(
                                                                            broker.brokerCode,
                                                                        )
                                                                    }
                                                                    className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                                                                    title={
                                                                        isVisible
                                                                            ? "Sembunyikan dari chart"
                                                                            : "Tampilkan di chart"
                                                                    }
                                                                >
                                                                    {isVisible ? (
                                                                        <Eye className="w-3.5 h-3.5 text-emerald-400" />
                                                                    ) : (
                                                                        <EyeOff className="w-3.5 h-3.5 text-slate-600" />
                                                                    )}
                                                                </button>

                                                                <span
                                                                    className="w-2.5 h-2.5 rounded-full"
                                                                    style={{
                                                                        backgroundColor:
                                                                            broker.color,
                                                                    }}
                                                                />

                                                                <span className="font-mono font-black text-sm text-white">
                                                                    {
                                                                        broker.brokerCode
                                                                    }
                                                                </span>

                                                                {/* Clean Accum Badge */}
                                                                {isClean && (
                                                                    <span
                                                                        className="px-1.5 py-0.5 rounded text-[9px] font-bold font-mono uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-0.5"
                                                                        title={`Purity Beli: ${broker.cleanRatio}% (Beli terus-menerus tanpa jualan signifikan)`}
                                                                    >
                                                                        <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
                                                                        <span>
                                                                            Clean
                                                                            Accum
                                                                        </span>
                                                                    </span>
                                                                )}

                                                                {/* Type tag */}
                                                                <span className="text-[9px] text-slate-400 uppercase font-mono">
                                                                    {broker.type ===
                                                                    "FOREIGN"
                                                                        ? "Asing"
                                                                        : broker.type ===
                                                                            "DOMESTIC_INSTITUTION"
                                                                          ? "Inst"
                                                                          : "Retail"}
                                                                </span>
                                                            </div>

                                                            {/* Net Lots */}
                                                            <div className="text-right font-mono">
                                                                <div className="text-xs font-bold text-emerald-400">
                                                                    +
                                                                    {Math.round(
                                                                        broker.netVol,
                                                                    ).toLocaleString()}{" "}
                                                                    Lot
                                                                </div>
                                                                <div className="text-[10px] text-slate-400">
                                                                    Avg Rp{" "}
                                                                    {broker.avgBuyPrice.toLocaleString()}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>

                                {/* CLASS 2: TOP NET SELL (Distribusi - Top 5 Default) */}
                                <div className="space-y-2 pt-2 border-t border-slate-800">
                                    <div className="flex items-center justify-between">
                                        <div className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                                            <ArrowDownRight className="w-4 h-4" />
                                            <span>
                                                Kelas 2: Top Net Sell (Top 5)
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-mono text-slate-400">
                                                {filteredSellers.length} Broker
                                            </span>
                                            {filteredSellers.length > 5 &&
                                                !brokerSearchQuery && (
                                                    <button
                                                        onClick={() =>
                                                            setShowAllSellers(
                                                                !showAllSellers,
                                                            )
                                                        }
                                                        className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
                                                    >
                                                        {showAllSellers
                                                            ? "Top 5 Saja"
                                                            : "Lihat Semua"}
                                                    </button>
                                                )}
                                        </div>
                                    </div>

                                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                        {" "}
                                        {displayedSellers.length === 0 ? (
                                            <div className="text-xs text-slate-500 py-3 text-center">
                                                Tidak ada data broker net sell.
                                            </div>
                                        ) : (
                                            displayedSellers.map((broker) => {
                                                const isVisible =
                                                    activeBrokerCodes.includes(
                                                        broker.brokerCode,
                                                    );
                                                const isClean =
                                                    broker.cleanTendency ===
                                                    "CLEAN_DIST";
                                                return (
                                                    <div
                                                        key={broker.brokerCode}
                                                        className={`p-2.5 rounded-xl border transition-all ${
                                                            isVisible
                                                                ? "bg-slate-950/90 border-slate-700 shadow-sm"
                                                                : "bg-slate-950/40 border-slate-800/60 opacity-60"
                                                        }`}
                                                    >
                                                        <div className="flex items-center justify-between gap-2">
                                                            <div className="flex items-center gap-2">
                                                                {/* Color indicator / toggle eye */}
                                                                <button
                                                                    onClick={() =>
                                                                        handleToggleBroker(
                                                                            broker.brokerCode,
                                                                        )
                                                                    }
                                                                    className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                                                                    title={
                                                                        isVisible
                                                                            ? "Sembunyikan dari chart"
                                                                            : "Tampilkan di chart"
                                                                    }
                                                                >
                                                                    {isVisible ? (
                                                                        <Eye className="w-3.5 h-3.5 text-rose-400" />
                                                                    ) : (
                                                                        <EyeOff className="w-3.5 h-3.5 text-slate-600" />
                                                                    )}
                                                                </button>

                                                                <span
                                                                    className="w-2.5 h-2.5 rounded-full"
                                                                    style={{
                                                                        backgroundColor:
                                                                            broker.color,
                                                                    }}
                                                                />

                                                                <span className="font-mono font-black text-sm text-white">
                                                                    {
                                                                        broker.brokerCode
                                                                    }
                                                                </span>

                                                                {/* Clean Dist Badge */}
                                                                {isClean && (
                                                                    <span
                                                                        className="px-1.5 py-0.5 rounded text-[9px] font-bold font-mono uppercase bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-0.5"
                                                                        title={`Purity Jual: ${broker.cleanRatio}% (Jual terus-menerus tanpa tampung beli signifikan)`}
                                                                    >
                                                                        <ArrowDownRight className="w-2.5 h-2.5 text-rose-400" />
                                                                        <span>
                                                                            Clean
                                                                            Dist
                                                                        </span>
                                                                    </span>
                                                                )}

                                                                {/* Type tag */}
                                                                <span className="text-[9px] text-slate-400 uppercase font-mono">
                                                                    {broker.type ===
                                                                    "FOREIGN"
                                                                        ? "Asing"
                                                                        : broker.type ===
                                                                            "DOMESTIC_INSTITUTION"
                                                                          ? "Inst"
                                                                          : "Retail"}
                                                                </span>
                                                            </div>

                                                            {/* Net Lots */}
                                                            <div className="text-right font-mono">
                                                                <div className="text-xs font-bold text-rose-400">
                                                                    {Math.round(
                                                                        broker.netVol,
                                                                    ).toLocaleString()}{" "}
                                                                    Lot
                                                                </div>
                                                                <div className="text-[10px] text-slate-400">
                                                                    Avg Rp{" "}
                                                                    {broker.avgSellPrice.toLocaleString()}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                    {/* Educational Footnote */}
                    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-400 space-y-2 leading-relaxed">
                        <div className="font-bold text-slate-200 flex items-center gap-1.5">
                            <Info className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Panduan Bandarmologi & Purity Label</span>
                        </div>
                        <p>
                            Overlay kurva dihitung dari akumulasi kepemilikan
                            bersih harian broker (Lot) langsung digabung pada
                            canvas candle.
                        </p>
                        <div className="space-y-1 text-[11px] font-mono">
                            <div className="flex items-center gap-1.5 text-emerald-400">
                                <Sparkles className="w-3 h-3" />
                                <strong>Clean Accum:</strong> Broker konsisten
                                beli satu arah dengan penjualan minimal (&ge;78%
                                Buy Purity).
                            </div>
                            <div className="flex items-center gap-1.5 text-rose-400">
                                <ArrowDownRight className="w-3 h-3" />
                                <strong>Clean Dist:</strong> Broker konsisten
                                distribusi satu arah dengan pembelian minimal
                                (&ge;78% Sell Purity).
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Official IDX Broker Member Directory Modal (GetBrokerSearch) */}
            {showBrokerCatalogModal && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-lg w-full shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <div className="flex items-center gap-2">
                                <Building2 className="w-5 h-5 text-cyan-400" />
                                <div>
                                    <h3 className="text-sm font-bold text-white">
                                        Direktori Anggota Bursa (BEI)
                                    </h3>
                                    <span className="text-[11px] text-slate-400 font-mono">
                                        /ExchangeMember/GetBrokerSearch
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowBrokerCatalogModal(false)}
                                className="text-slate-400 hover:text-white p-1 cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Search Input */}
                        <div className="relative">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder="Cari kode (misal: BK, CC, YP) atau nama sekuritas..."
                                value={modalSearchQuery}
                                onChange={(e) =>
                                    setModalSearchQuery(e.target.value)
                                }
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
                                autoFocus
                            />
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 max-h-72">
                            {filteredBrokerCatalog.map((b) => {
                                const isSelected = activeBrokerCodes.includes(
                                    b.code,
                                );
                                return (
                                    <div
                                        key={b.code}
                                        onClick={() =>
                                            handleToggleBroker(b.code)
                                        }
                                        className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                                            isSelected
                                                ? "bg-cyan-500/10 border-cyan-500/40 text-cyan-300"
                                                : "bg-slate-950/60 border-slate-800 hover:bg-slate-800/80 text-slate-200"
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span
                                                className="w-3 h-3 rounded-full shrink-0"
                                                style={{
                                                    backgroundColor: b.color,
                                                }}
                                            />
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono font-black text-sm text-white">
                                                        {b.code}
                                                    </span>
                                                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                                                        {b.type === "FOREIGN"
                                                            ? "Foreign"
                                                            : b.type ===
                                                                "DOMESTIC_INSTITUTION"
                                                              ? "Domestic Inst"
                                                              : "Retail"}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-slate-400 truncate max-w-[280px]">
                                                    {b.name}
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            className={`p-1.5 rounded-lg text-xs font-bold font-mono transition-colors ${
                                                isSelected
                                                    ? "bg-cyan-500 text-slate-950"
                                                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                                            }`}
                                        >
                                            {isSelected ? (
                                                <Check className="w-4 h-4" />
                                            ) : (
                                                <Plus className="w-4 h-4" />
                                            )}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="border-t border-slate-800 pt-3 flex justify-end">
                            <button
                                onClick={() => setShowBrokerCatalogModal(false)}
                                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs cursor-pointer"
                            >
                                Selesai
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Interval Date Picker (2 Calendars) Modal with end > start validation */}
            {isDualCalendarOpen && (
                <DualCalendarPicker
                    startDate={customStartDate || startDateStr}
                    endDate={customEndDate || endDateStr}
                    onApply={(start, end) => {
                        setCustomStartDate(start);
                        setCustomEndDate(end);
                        setTimePreset("CUSTOM");
                    }}
                    onClose={() => setIsDualCalendarOpen(false)}
                />
            )}
        </motion.div>
    );
};
