import React, { useState, useEffect, useRef } from 'react';
import { Loader2, Star } from 'lucide-react';
import { Navbar } from './components/Navbar';
import { ParallaxHero } from './components/ParallaxHero';
import { SmcCanvasChart } from './components/SmcCanvasChart';
import { RecommendationPanel } from './components/RecommendationPanel';
import { NaraSummaryPanel } from './components/NaraSummaryPanel';
import { StockScreener } from './components/StockScreener';
import { Watchlist } from './components/Watchlist';
import { InventoryChart } from './components/InventoryChart';
import { SmcGuideModal } from './components/SmcGuideModal';
import { SmcLoadingModal } from './components/SmcLoadingModal';
import { SyncLoadingScreen } from './components/SyncLoadingScreen';
import type { StockData, StockListItem, StockUniverseEnvelope } from './types';
import { CANONICAL_STOCK_COUNT, isCanonicalTicker } from '../shared/stockUniverse';

function isMatchingTicker(tickerA?: string, tickerB?: string): boolean {
  if (!tickerA || !tickerB) return false;
  const normA = tickerA.toUpperCase().replace('.JK', '');
  const normB = tickerB.toUpperCase().replace('.JK', '');
  if (normA === normB) return true;
  const isIhsgA = normA === '^JKSE' || normA === 'IHSG' || normA === 'JKSE';
  const isIhsgB = normB === '^JKSE' || normB === 'IHSG' || normB === 'JKSE';
  return isIhsgA && isIhsgB;
}

function safelyDecodeTicker(pathname: string, prefix: RegExp): string {
  const rawTicker = pathname.replace(prefix, '').split('/')[0].trim();
  if (!rawTicker) return '';
  try {
    return decodeURIComponent(rawTicker).trim().toUpperCase();
  } catch {
    return rawTicker.toUpperCase();
  }
}

function normalizeStockTicker(value: string): string {
  const clean = value.trim().toUpperCase().replace(/\.JK$/, '');
  return clean === 'IHSG' || clean === 'JKSE' || clean === '^JKSE' ? 'IHSG' : clean;
}

function isFullStockData(value: unknown): value is StockData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<StockData>;
  return (
    typeof candidate.ticker === 'string' &&
    Array.isArray(candidate.candles) &&
    candidate.candles.length > 0 &&
    Boolean(candidate.recommendation)
  );
}

function isRealStockData(value: unknown): value is StockData {
  return isFullStockData(value) && value.isRealData === true;
}

function isDevelopmentBuild(): boolean {
  return Boolean(
    (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV,
  );
}

function isAllowedDetailData(value: unknown): value is StockData {
  if (!isFullStockData(value)) return false;
  return value.isRealData === true ||
    (isDevelopmentBuild() && value.source === 'SYNTHETIC');
}

function isUniverseItem(value: unknown): value is StockListItem {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<StockListItem>;
  return (
    typeof candidate.ticker === 'string' &&
    isCanonicalTicker(candidate.ticker) &&
    candidate.isRealData === true &&
    typeof candidate.currentPrice === 'number' &&
    Boolean(candidate.recommendation)
  );
}

function parseUniverseEnvelope(value: unknown): {
  items: StockListItem[];
  expected: number;
  fetchedAt?: string;
} | null {
  if (!value || typeof value !== 'object') return null;
  const payload = value as Partial<StockUniverseEnvelope>;
  if (payload.success !== true || !Array.isArray(payload.data)) return null;
  const items = payload.data.filter(isUniverseItem);
  return {
    items,
    expected: payload.coverage?.expected ?? CANONICAL_STOCK_COUNT,
    fetchedAt: payload.coverage?.fetchedAt,
  };
}

export default function App() {
  // Check initial path (e.g. /analysis/BRPT, /inventory/BBCA, /screener, etc.)
  const initialPathname = typeof window !== 'undefined' ? window.location.pathname : '/';
  const isDirectAnalysisRoute = initialPathname.startsWith('/analysis/');
  const isDirectInventoryRoute = initialPathname.startsWith('/inventory/') || initialPathname === '/inventory';
  const isDirectScreener = initialPathname === '/screener';
  const isDirectWatchlist = initialPathname === '/watchlist';

  const initialUrlTicker = isDirectAnalysisRoute
    ? safelyDecodeTicker(initialPathname, /^\/analysis\//)
    : isDirectInventoryRoute
    ? safelyDecodeTicker(initialPathname, /^\/inventory\/?/)
    : '';

  const initialTab: 'landing' | 'chart' | 'inventory' | 'screener' | 'guide' | 'watchlist' =
    isDirectAnalysisRoute
      ? 'chart'
      : isDirectInventoryRoute
      ? 'inventory'
      : isDirectScreener
      ? 'screener'
      : isDirectWatchlist
      ? 'watchlist'
      : 'landing';

  const [activeTab, setActiveTab] = useState<'landing' | 'chart' | 'inventory' | 'screener' | 'guide' | 'watchlist'>(
    initialTab
  );
  const [stocks, setStocks] = useState<StockListItem[]>([]);
  const [selectedStock, setSelectedStock] = useState<StockData | null>(null);
  const [timeframe, setTimeframe] = useState<string>('1D');
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [isStockFetching, setIsStockFetching] = useState<boolean>(false);
  const [fetchingTicker, setFetchingTicker] = useState<string>('');
  const [universeError, setUniverseError] = useState<string>('');
  const [loadAttempt, setLoadAttempt] = useState(0);

  // Initial Sync HUD States (skip modal if directly opening an analysis or inventory URL)
  const [isSyncModalOpen, setIsSyncModalOpen] = useState<boolean>(
    !isDirectAnalysisRoute && !isDirectInventoryRoute && !isDirectScreener && !isDirectWatchlist
  );
  const [syncProgress, setSyncProgress] = useState<number>(5);
  const [syncedTickers, setSyncedTickers] = useState<string[]>([]);
  const [currentProcessingTicker, setCurrentProcessingTicker] = useState<string>('BRPT');
  const [isSyncComplete, setIsSyncComplete] = useState<boolean>(false);
  const [totalTargetCount, setTotalTargetCount] = useState<number>(CANONICAL_STOCK_COUNT);

  // Synchronize browser history and popstate for back/forward navigation
  const stocksRef = useRef<StockListItem[]>(stocks);
  const tickerCacheRef = useRef(new Map<string, { data: StockData; fetchedAt: number }>());
  const tickerRequestsRef = useRef(new Map<string, Promise<StockData | null>>());
  const universeFetchedAtRef = useRef(0);
  useEffect(() => {
    stocksRef.current = stocks;
  }, [stocks]);

  useEffect(() => {
    if (window.location.pathname === '/calculator') {
      window.history.replaceState(null, '', '/');
    }

    const handlePopState = () => {
      const path = window.location.pathname;
      if (path.startsWith('/analysis/')) {
        const t = safelyDecodeTicker(path, /^\/analysis\//);
        setActiveTab('chart');
        if (t) {
          const match = stocksRef.current.find((s) => isMatchingTicker(s.ticker, t));
          if (match && isAllowedDetailData(match)) setSelectedStock(match);
          else if (match) void fetchTickerData(t).then((detail) => {
            if (detail) mergeStockIntoState(detail, true);
          });
        }
      } else if (path.startsWith('/inventory/') || path === '/inventory') {
        const t = safelyDecodeTicker(path, /^\/inventory\/?/);
        setActiveTab('inventory');
        if (t) {
          const match = stocksRef.current.find((s) => isMatchingTicker(s.ticker, t));
          if (match && isAllowedDetailData(match)) setSelectedStock(match);
          else if (match) void fetchTickerData(t).then((detail) => {
            if (detail) mergeStockIntoState(detail, true);
          });
        }
      } else if (path === '/screener') {
        setActiveTab('screener');
      } else if (path === '/watchlist') {
        setActiveTab('watchlist');
      } else if (path === '/calculator') {
        window.history.replaceState(null, '', '/');
        setActiveTab('landing');
      } else if (path === '/') {
        setActiveTab('landing');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Watchlist State persisted in localStorage
  const [watchlist, setWatchlist] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('smc_watchlist');
      return saved ? JSON.parse(saved) : ['BRPT', 'ADRO', 'BBCA', 'BUMI', 'CUAN'];
    } catch (e) {
      return ['BRPT', 'ADRO', 'BBCA', 'BUMI', 'CUAN'];
    }
  });

  const handleToggleWatchlist = (ticker: string) => {
    const clean = ticker.toUpperCase();
    setWatchlist((prev) => {
      const next = prev.includes(clean)
        ? prev.filter((t) => t !== clean)
        : [...prev, clean];
      try {
        localStorage.setItem('smc_watchlist', JSON.stringify(next));
      } catch (e) {
        console.warn('Failed saving watchlist:', e);
      }
      return next;
    });
  };

  const mergeStockIntoState = (incoming: StockData, select = false) => {
    if (!isAllowedDetailData(incoming)) return;
    const key = normalizeStockTicker(incoming.ticker);
    let accepted: StockData = incoming;
    tickerCacheRef.current.set(key, { data: accepted, fetchedAt: Date.now() });
    setStocks((prev) => {
      const existing = prev.find((stock) => isMatchingTicker(stock.ticker, incoming.ticker));
      const exists = Boolean(existing);
      const updated = exists
        ? prev.map((stock) => (isMatchingTicker(stock.ticker, incoming.ticker) ? accepted : stock))
        : [accepted, ...prev];
      try {
        localStorage.setItem(
          'smc_custom_stocks',
          JSON.stringify(updated.filter((stock): stock is StockData => isRealStockData(stock))),
        );
      } catch {
        // Storage is optional and must not affect market data state.
      }
      return updated;
    });
    if (select) setSelectedStock(accepted);
  };

  const fetchTickerData = async (ticker: string, force = false): Promise<StockData | null> => {
    const key = normalizeStockTicker(ticker);
    const cached = tickerCacheRef.current.get(key);
    if (!force && cached && Date.now() - cached.fetchedAt < 5 * 60 * 1000) {
      return cached.data;
    }

    const inFlight = tickerRequestsRef.current.get(key);
    if (inFlight) return inFlight;

    let request: Promise<StockData | null>;
    request = (async () => {
      let stockData: StockData | null = null;
      try {
        const response = await fetch(`/api/stock/${encodeURIComponent(key)}`);
        if (response.ok) {
          const candidate: unknown = await response.json();
          if (isAllowedDetailData(candidate)) stockData = candidate;
        } else {
          const fallbackResponse = await fetch(`/api/stock?symbol=${encodeURIComponent(key)}`);
          if (fallbackResponse.ok) {
            const candidate: unknown = await fallbackResponse.json();
            if (isAllowedDetailData(candidate)) stockData = candidate;
          }
        }
      } catch {
        // The browser provider below is a second real-data path.
      }

      if (!stockData || !Array.isArray(stockData.candles) || stockData.candles.length === 0) {
        try {
          const { fetchYahooStockData } = await import('./services/yahooFinance');
          stockData = await fetchYahooStockData(key);
        } catch {
          stockData = null;
        }
      }

      if (!stockData && isDevelopmentBuild()) {
        try {
          const { getMockStocks } = await import('./data/mockStocks');
          stockData = getMockStocks().find((candidate) =>
            isMatchingTicker(candidate.ticker, key),
          ) ?? null;
        } catch {
          stockData = null;
        }
      }

      if (isAllowedDetailData(stockData)) {
        tickerCacheRef.current.set(key, { data: stockData, fetchedAt: Date.now() });
        return stockData;
      }
      return null;
    })();
    tickerRequestsRef.current.set(key, request);
    void request.finally(() => {
      if (tickerRequestsRef.current.get(key) === request) tickerRequestsRef.current.delete(key);
    });
    return request;
  };

  // Load the compact real-data universe on mount. Detail candles are fetched
  // lazily for the selected ticker, so the list response never carries full
  // candle/indicator/SMC arrays.
  useEffect(() => {
    let isMounted = true;

    async function loadStocks() {
      let initialList: StockListItem[] = [];
      let expectedCount: number = CANONICAL_STOCK_COUNT;
      let loadedFromApi = false;
      let usedDevelopmentMocks = false;
      try {
        const res = await fetch('/api/stocks');
        const payload: unknown = await res.json().catch(() => null);
        const parsed = res.ok ? parseUniverseEnvelope(payload) : null;
        if (parsed) {
          initialList = parsed.items;
          expectedCount = parsed.expected;
          loadedFromApi = true;
        }
      } catch {
        // The controlled error state below distinguishes unavailable real data.
      }

      // Mock data is an explicit development-only escape hatch and is labeled
      // synthetic by getMockStocks. It is not bundled into production success.
      if (initialList.length === 0 && isDevelopmentBuild()) {
        const { getMockStocks } = await import('./data/mockStocks');
        initialList = getMockStocks();
        expectedCount = initialList.length;
        usedDevelopmentMocks = true;
      }

      // Last-known custom data is allowed only when it is a full, explicitly
      // real snapshot. Synthetic localStorage entries never enter production
      // state, and custom entries do not inflate canonical coverage.
      try {
        const cachedCustom = localStorage.getItem('smc_custom_stocks');
        const parsedCustom: unknown = cachedCustom ? JSON.parse(cachedCustom) : null;
        if (Array.isArray(parsedCustom)) {
          parsedCustom.forEach((candidate: unknown) => {
            if (!isRealStockData(candidate)) return;
            const index = initialList.findIndex((stock) => isMatchingTicker(stock.ticker, candidate.ticker));
            if (index >= 0) initialList[index] = candidate;
            else initialList.push(candidate);
          });
        }
      } catch {
        // Last-known storage is optional and must never block real loading.
      }

      if (!isMounted) return;
      const canonicalAvailableCount = initialList.filter((stock) => isCanonicalTicker(stock.ticker)).length;
      const canonicalTickers = initialList
        .filter((stock) => isCanonicalTicker(stock.ticker))
        .map((stock) => stock.ticker);
      const cachedAt = Date.now();
      initialList.forEach((stock) => {
        if (isRealStockData(stock)) {
          tickerCacheRef.current.set(normalizeStockTicker(stock.ticker), { data: stock, fetchedAt: cachedAt });
        }
      });
      setStocks(initialList);
      setTotalTargetCount(expectedCount);
      setSyncedTickers(canonicalTickers);
      setSyncProgress(expectedCount > 0 ? Math.min(100, Math.round((canonicalAvailableCount / expectedCount) * 100)) : 0);
      setIsSyncComplete(true);
      setIsSyncModalOpen(false);
      if (loadedFromApi) universeFetchedAtRef.current = Date.now();
      if (usedDevelopmentMocks) {
        setUniverseError('DEVELOPMENT ONLY: menampilkan fixture synthetic karena data real belum tersedia.');
      } else if (canonicalAvailableCount < expectedCount) {
        setUniverseError('Sebagian data pasar real belum tersedia. Data yang tersedia tetap ditampilkan.');
      } else {
        setUniverseError('');
      }

      const preferredTicker = initialUrlTicker ||
        (initialList.find((stock) => isMatchingTicker(stock.ticker, 'BRPT'))?.ticker ?? initialList[0]?.ticker);
      let selectedDetail: StockData | null = null;
      if (preferredTicker) selectedDetail = await fetchTickerData(preferredTicker);

      if (!isMounted) return;
      if (selectedDetail) {
        mergeStockIntoState(selectedDetail, true);
      } else {
        setUniverseError((current) => current || 'Data OHLCV real belum tersedia untuk ticker awal.');
      }
      setLoading(false);
    }
    void loadStocks();

    const refreshUniverse = async () => {
      if (!isMounted || document.visibilityState !== 'visible') return;
      if (Date.now() - universeFetchedAtRef.current < 15 * 60 * 1000) return;
      try {
        const res = await fetch('/api/stocks');
        const payload: unknown = await res.json().catch(() => null);
        const parsed = res.ok ? parseUniverseEnvelope(payload) : null;
        if (!isMounted || !parsed || parsed.items.length === 0) return;
        universeFetchedAtRef.current = Date.now();
        setTotalTargetCount(parsed.expected);
        setSyncedTickers(parsed.items.map((stock) => stock.ticker));
        setStocks((prev) => {
          const updated = [...prev];
          parsed.items.forEach((incoming) => {
            const idx = updated.findIndex((stock) => isMatchingTicker(stock.ticker, incoming.ticker));
            if (idx >= 0) {
              if (!isRealStockData(updated[idx])) updated[idx] = incoming;
            }
            else updated.push(incoming);
          });
          return updated;
        });
        setUniverseError(parsed.items.length < parsed.expected
          ? 'Sebagian data pasar real belum tersedia. Data yang tersedia tetap ditampilkan.'
          : '');
      } catch {
        // Keep the current real snapshot when refresh is unavailable.
      }
    };

    const universeTimer = window.setInterval(refreshUniverse, 15 * 60 * 1000);
    document.addEventListener('visibilitychange', refreshUniverse);
    return () => {
      isMounted = false;
      window.clearInterval(universeTimer);
      document.removeEventListener('visibilitychange', refreshUniverse);
    };
  }, [loadAttempt]);

  // Watchlist refresh is lazy, visible-tab only, and capped at three requests.
  useEffect(() => {
    if (activeTab !== 'watchlist' || document.visibilityState !== 'visible') return;
    let isActive = true;
    let nextIndex = 0;
    let workersRunning = false;
    const tickers = Array.from(new Set(watchlist.map(normalizeStockTicker).filter(Boolean)));

    const worker = async () => {
      while (isActive && document.visibilityState === 'visible' && nextIndex < tickers.length) {
        const ticker = tickers[nextIndex++];
        const cached = tickerCacheRef.current.get(ticker);
        if (cached && Date.now() - cached.fetchedAt < 5 * 60 * 1000) continue;
        const fresh = await fetchTickerData(ticker);
        if (isActive && document.visibilityState === 'visible' && fresh) {
          mergeStockIntoState(fresh);
        }
      }
    };

    const startWorkers = () => {
      if (workersRunning || !isActive || document.visibilityState !== 'visible') return;
      workersRunning = true;
      void Promise.all(Array.from({ length: Math.min(3, tickers.length) }, () => worker())).finally(() => {
        workersRunning = false;
      });
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') startWorkers();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    startWorkers();
    return () => {
      isActive = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [activeTab, watchlist.join(',')]);

  const handleSelectStock = async (stock: StockListItem) => {
    setFetchingTicker(stock.ticker);
    setIsStockFetching(true);
    const minDelay = new Promise((resolve) => setTimeout(resolve, 1200));
    try {
      const freshRealData = await fetchTickerData(stock.ticker);

      await minDelay;

      if (freshRealData && freshRealData.candles && freshRealData.candles.length > 0) {
        mergeStockIntoState(freshRealData, true);
      } else if (isAllowedDetailData(stock)) {
        setSelectedStock(stock);
      } else {
        setUniverseError(`Data OHLCV real untuk ${stock.ticker} belum tersedia.`);
      }
    } catch (e) {
      if (isAllowedDetailData(stock)) setSelectedStock(stock);
      else setUniverseError(`Data OHLCV real untuk ${stock.ticker} belum tersedia.`);
    } finally {
      setIsStockFetching(false);
    }
  };

  const handleFetchNewStock = async (ticker: string) => {
    const cleanTicker = normalizeStockTicker(ticker);
    setFetchingTicker(cleanTicker);
    setIsStockFetching(true);
    const minDelay = new Promise((resolve) => setTimeout(resolve, 1200));
    try {
      const stockData = await fetchTickerData(cleanTicker);

      await minDelay;

      if (stockData && stockData.candles && stockData.candles.length > 0) {
        mergeStockIntoState(stockData, true);
      }
    } catch (e) {
      console.warn(`Failed fetching stock ${cleanTicker}:`, e);
    } finally {
      setIsStockFetching(false);
    }
  };


  const handleStartChart = (ticker?: string) => {
    setActiveTab('chart');
    if (ticker) {
      const cleanTicker = normalizeStockTicker(ticker);
      const match = stocks.find(
        (s) =>
          isMatchingTicker(s.ticker, cleanTicker) ||
          (cleanTicker === 'IHSG' && s.name.toLowerCase().includes('ihsg'))
      );
      if (match) {
        handleSelectStock(match);
      } else {
        handleFetchNewStock(cleanTicker);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center font-mono text-xs">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span>Loading Smart Money Concepts IDX Data...</span>
        </div>
      </div>
    );
  }

  if (!selectedStock) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center font-mono text-xs p-6">
        <div className="max-w-lg w-full rounded-2xl border border-rose-500/30 bg-slate-900/90 p-8 text-center shadow-2xl">
          <div className="text-rose-400 font-black text-lg mb-3">Data pasar real belum tersedia</div>
          <p className="text-slate-400 leading-relaxed mb-5">
            {universeError || 'SmartChart tidak menerima OHLCV real dari Redis atau Yahoo Finance.'}
          </p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setUniverseError('');
              setLoadAttempt((attempt) => attempt + 1);
            }}
            className="rounded-xl bg-emerald-500 px-4 py-2.5 font-bold text-slate-950 hover:bg-emerald-400 transition-colors"
          >
            Coba lagi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          if (tab === 'guide') {
            setIsGuideOpen(true);
          } else {
            setActiveTab(tab);
            try {
              const currentT = selectedStock?.ticker ? (selectedStock.ticker === '^JKSE' ? 'IHSG' : selectedStock.ticker) : 'BBCA';
              if (tab === 'chart') {
                window.history.pushState(null, '', `/analysis/${encodeURIComponent(currentT)}`);
              } else if (tab === 'inventory') {
                window.history.pushState(null, '', `/inventory/${encodeURIComponent(currentT)}`);
              } else if (tab === 'screener') {
                window.history.pushState(null, '', '/screener');
              } else if (tab === 'watchlist') {
                window.history.pushState(null, '', '/watchlist');
              } else if (tab === 'landing') {
                window.history.pushState(null, '', '/');
              }
            } catch (e) {}
          }
        }}
        stocks={stocks}
        selectedStock={selectedStock}
        onSelectStock={(s) => {
          handleSelectStock(s);
          try {
            const displayT = s.ticker === '^JKSE' ? 'IHSG' : s.ticker;
            if (activeTab === 'inventory') {
              window.history.pushState(null, '', `/inventory/${encodeURIComponent(displayT)}`);
            } else {
              window.history.pushState(null, '', `/analysis/${encodeURIComponent(displayT)}`);
            }
          } catch (e) {}
        }}
        onFetchNewStock={handleFetchNewStock}
        watchlistCount={watchlist.length}
      />

      {/* Main Content Body */}
      <main className="flex-1">
        {universeError && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs font-mono text-amber-200">
              {universeError}
            </div>
          </div>
        )}
        {activeTab === 'landing' && (
          <ParallaxHero
            onStartChart={handleStartChart}
            onOpenScreener={() => setActiveTab('screener')}
            stocks={stocks}
            onUpdateIhsgData={(liveData) => {
              mergeStockIntoState(liveData);
            }}
          />
        )}

        {activeTab === 'inventory' && (
          <InventoryChart
            stocks={stocks}
            selectedStock={selectedStock}
            onSelectStock={(s) => {
              handleSelectStock(s);
              try {
                const displayT = s.ticker === '^JKSE' ? 'IHSG' : s.ticker;
                window.history.pushState(null, '', `/inventory/${encodeURIComponent(displayT)}`);
              } catch (e) {}
            }}
            onFetchNewStock={handleFetchNewStock}
            onNavigateToChart={(t) => {
              handleStartChart(t);
              try {
                window.history.pushState(null, '', `/analysis/${encodeURIComponent(t)}`);
              } catch (e) {}
            }}
          />
        )}

        {activeTab === 'chart' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
            {isStockFetching ? (
              <div className="bg-slate-900/90 border border-emerald-500/30 rounded-2xl p-12 text-center flex flex-col items-center justify-center gap-4 min-h-[520px] shadow-2xl relative overflow-hidden backdrop-blur-md">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-inner">
                  <Loader2 className="w-7 h-7 animate-spin" />
                </div>
                <div>
                  <div className="text-lg font-black text-white mb-1">
                    Menyiapkan Data Pasar BEI & Structure SMC ({fetchingTicker || selectedStock.ticker})
                  </div>
                  <div className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                    Sedang mengunduh data OHLCV pasar real-time dari API BEI, memetakan Fair Value Gap (FVG), Order Block (OB), dan kalkulasi otomatis Risk-Reward Ratio...
                  </div>
                </div>
                <div className="mt-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[11px] font-mono text-emerald-300 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>SMC Engine: Menyiapkan Data...</span>
                </div>
              </div>
            ) : (
              <>
                {/* Real Data Banner */}
                <div className="bg-slate-900/90 border border-emerald-500/30 rounded-2xl p-3 px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                    <span className={`font-bold ${selectedStock.isRealData === true ? 'text-emerald-400' : 'text-amber-300'}`}>
                      {selectedStock.isRealData === true ? 'REAL IDX MARKET DATA' : 'DEVELOPMENT SYNTHETIC DATA'}
                    </span>
                    <span className="text-slate-400 hidden md:inline">|</span>
                    <span className="text-slate-300">
                      Powered by Market Data API (Delayed ~15 min)
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold text-[11px]">
                      {selectedStock.symbol}
                    </span>
                    <span>Last: <strong className="text-white">Rp {selectedStock.currentPrice?.toLocaleString()}</strong></span>
                  </div>
                </div>

                {/* Main Interactive SMC Canvas Chart */}
                <SmcCanvasChart
                  stock={selectedStock}
                  timeframe={timeframe}
                  onTimeframeChange={setTimeframe}
                  isWatchlisted={watchlist.includes(selectedStock.ticker.toUpperCase())}
                  onToggleWatchlist={handleToggleWatchlist}
                />

                <NaraSummaryPanel
                  summary={selectedStock.naraSummary}
                  variant="CHART"
                />

                {/* Smart Money Trade Plan & Recommendation Panel */}
                <RecommendationPanel stock={selectedStock} />
              </>
            )}
          </div>
        )}

        {activeTab === 'screener' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <StockScreener
              stocks={stocks}
              onSelectStock={(s) => {
                handleSelectStock(s);
                setActiveTab('chart');
              }}
              onFetchNewStock={handleFetchNewStock}
              watchlist={watchlist}
              onToggleWatchlist={handleToggleWatchlist}
              isStockFetching={isStockFetching}
              fetchingTicker={fetchingTicker}
            />
          </div>
        )}

        {activeTab === 'watchlist' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <Watchlist
              watchlist={watchlist}
              stocks={stocks}
              onSelectStock={(s) => {
                handleSelectStock(s);
                setActiveTab('chart');
              }}
              onRemoveFromWatchlist={handleToggleWatchlist}
              onAddStockByTicker={handleFetchNewStock}
              onOpenScreener={() => setActiveTab('screener')}
              onToggleWatchlist={handleToggleWatchlist}
            />
          </div>
        )}

      </main>

      {/* Educational Guide Drawer/Modal */}
      <SmcGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />

      {/* Real-time Initial Live Market Data Syncing Overlay */}
      {isSyncModalOpen && (
        <SyncLoadingScreen
          progress={syncProgress}
          totalStocks={totalTargetCount}
          syncedCount={syncedTickers.length}
          currentTicker={currentProcessingTicker}
          syncedTickers={syncedTickers}
          isComplete={isSyncComplete}
          onContinue={() => setIsSyncModalOpen(false)}
        />
      )}

      {/* Interactive 4-Step SMC Loading Progress Modal */}
      <SmcLoadingModal
        isOpen={isStockFetching}
        ticker={fetchingTicker || selectedStock?.ticker || ''}
      />

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <strong>SmartChart</strong> — Smart Money Concepts Technical Analysis Platform for Indonesia Stocks
          </div>
          <div className="text-[11px] text-slate-400">
            Always LONG | Min R:R 1:1.5 | TP 10%-20% | SL 3%-5% | Volume Confirmation Indicator
          </div>
        </div>
      </footer>
    </div>
  );
}
