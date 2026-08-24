import React, { useState, useEffect, useRef } from 'react';
import { Loader2, Star } from 'lucide-react';
import { Navbar } from './components/Navbar';
import { ParallaxHero } from './components/ParallaxHero';
import { SmcCanvasChart } from './components/SmcCanvasChart';
import { RecommendationPanel } from './components/RecommendationPanel';
import { StockScreener } from './components/StockScreener';
import { Watchlist } from './components/Watchlist';
import { InventoryChart } from './components/InventoryChart';
import { SmcGuideModal } from './components/SmcGuideModal';
import { SmcLoadingModal } from './components/SmcLoadingModal';
import { SyncLoadingScreen } from './components/SyncLoadingScreen';
import { getMockStocks } from './data/mockStocks';
import { StockData } from './types';

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
  return clean === 'IHSG' || clean === 'JKSE' || clean === '^JKSE' ? '^JKSE' : clean;
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
  const [stocks, setStocks] = useState<StockData[]>([]);
  const [selectedStock, setSelectedStock] = useState<StockData | null>(null);
  const [timeframe, setTimeframe] = useState<string>('1D');
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [isStockFetching, setIsStockFetching] = useState<boolean>(false);
  const [fetchingTicker, setFetchingTicker] = useState<string>('');

  // Initial Sync HUD States (skip modal if directly opening an analysis or inventory URL)
  const [isSyncModalOpen, setIsSyncModalOpen] = useState<boolean>(
    !isDirectAnalysisRoute && !isDirectInventoryRoute && !isDirectScreener && !isDirectWatchlist
  );
  const [syncProgress, setSyncProgress] = useState<number>(5);
  const [syncedTickers, setSyncedTickers] = useState<string[]>([]);
  const [currentProcessingTicker, setCurrentProcessingTicker] = useState<string>('BRPT');
  const [isSyncComplete, setIsSyncComplete] = useState<boolean>(false);
  const [totalTargetCount, setTotalTargetCount] = useState<number>(85);

  // Synchronize browser history and popstate for back/forward navigation
  const stocksRef = useRef<StockData[]>(stocks);
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
          if (match) setSelectedStock(match);
        }
      } else if (path.startsWith('/inventory/') || path === '/inventory') {
        const t = safelyDecodeTicker(path, /^\/inventory\/?/);
        setActiveTab('inventory');
        if (t) {
          const match = stocksRef.current.find((s) => isMatchingTicker(s.ticker, t));
          if (match) setSelectedStock(match);
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
    const key = normalizeStockTicker(incoming.ticker);
    const existingAtCall = stocksRef.current.find((stock) => isMatchingTicker(stock.ticker, incoming.ticker));
    let accepted = existingAtCall?.isRealData && !incoming.isRealData ? existingAtCall : incoming;
    tickerCacheRef.current.set(key, { data: accepted, fetchedAt: Date.now() });
    setStocks((prev) => {
      const existing = prev.find((stock) => isMatchingTicker(stock.ticker, incoming.ticker));
      if (existing?.isRealData && !incoming.isRealData) accepted = existing;
      const exists = Boolean(existing);
      const updated = exists
        ? prev.map((stock) => (isMatchingTicker(stock.ticker, incoming.ticker) ? accepted : stock))
        : [accepted, ...prev];
      try {
        localStorage.setItem('smc_custom_stocks', JSON.stringify(updated.filter((stock) => stock.isRealData)));
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
          stockData = await response.json();
        } else {
          const fallbackResponse = await fetch(`/api/stock?symbol=${encodeURIComponent(key)}`);
          if (fallbackResponse.ok) stockData = await fallbackResponse.json();
        }
      } catch {
        // The client-side provider is the explicit fallback when the API route is unavailable.
      }

      if (!stockData || !Array.isArray(stockData.candles) || stockData.candles.length === 0) {
        try {
          const { fetchYahooStockData } = await import('./services/yahooFinance');
          stockData = await fetchYahooStockData(key);
        } catch {
          stockData = null;
        }
      }

      if (stockData && Array.isArray(stockData.candles) && stockData.candles.length > 0) {
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

  // Load stock data on mount
  useEffect(() => {
    let isMounted = true;

    async function loadStocks() {
      let initialList: StockData[] = [];
      let loadedFromSnapshot = false;
      try {
        const res = await fetch('/api/stocks');
        if (res.ok) {
          const data: StockData[] = await res.json();
          if (data && data.length > 0) {
            initialList = data;
            loadedFromSnapshot = true;
          }
        }
      } catch (e) {
        // Fallback to local stock data
      }

      if (initialList.length === 0) {
        initialList = getMockStocks();
      }

      // Merge saved custom/user-added stocks from localStorage
      try {
        const cachedCustom = localStorage.getItem('smc_custom_stocks');
        if (cachedCustom) {
          const parsed: StockData[] = JSON.parse(cachedCustom);
          if (parsed && Array.isArray(parsed)) {
            parsed.forEach((customStock) => {
              if (!customStock || !customStock.ticker || !Array.isArray(customStock.candles)) return;
              const idx = initialList.findIndex((s) => isMatchingTicker(s.ticker, customStock.ticker));
              if (idx >= 0) {
                initialList[idx] = customStock;
              } else {
                initialList.push(customStock);
              }
            });
          }
        }
      } catch (e) {
        // ignore
      }

      if (isMounted) {
        const fetchedAt = Date.now();
        initialList.forEach((stock) => {
          tickerCacheRef.current.set(normalizeStockTicker(stock.ticker), { data: stock, fetchedAt });
        });
        if (loadedFromSnapshot) universeFetchedAtRef.current = fetchedAt;
        setStocks(initialList);

        // If URL specified a ticker (e.g. /analysis/BBCA), find it or fetch it
        if (initialUrlTicker) {
          const matchedUrlStock = initialList.find((s) => isMatchingTicker(s.ticker, initialUrlTicker));
          if (matchedUrlStock) {
            setSelectedStock(matchedUrlStock);
          } else {
            const temp = initialList.find((s) => s.ticker === 'BRPT') || initialList[0];
            setSelectedStock(temp);
          }
        } else {
          const brpt = initialList.find((s) => s.ticker === 'BRPT') || initialList[0];
          setSelectedStock(brpt);
        }
        setLoading(false);
        setTotalTargetCount(initialList.length);
        setSyncedTickers(initialList.map((stock) => stock.ticker));
        setSyncProgress(100);
        setIsSyncComplete(true);
        setIsSyncModalOpen(false);
      }

      if (initialUrlTicker) {
        const liveDirect = await fetchTickerData(initialUrlTicker);
        if (isMounted && liveDirect) mergeStockIntoState(liveDirect, true);
      }

    }
    void loadStocks();

    const refreshUniverse = async () => {
      if (!isMounted || document.visibilityState !== 'visible') return;
      if (Date.now() - universeFetchedAtRef.current < 15 * 60 * 1000) return;
      try {
        const res = await fetch('/api/stocks');
        if (!res.ok) return;
        const freshData: StockData[] = await res.json();
        if (!isMounted || !Array.isArray(freshData) || freshData.length === 0) return;
        universeFetchedAtRef.current = Date.now();
        freshData.forEach((incoming) => {
          const key = normalizeStockTicker(incoming.ticker);
          tickerCacheRef.current.set(key, { data: incoming, fetchedAt: Date.now() });
        });
        setStocks((prev) => {
          const updated = [...prev];
          freshData.forEach((incoming) => {
            const idx = updated.findIndex((s) => isMatchingTicker(s.ticker, incoming.ticker));
            if (idx >= 0) {
              const existing = updated[idx];
              if (existing.isRealData && !incoming.isRealData) return;
              updated[idx] = incoming;
            } else {
              updated.push(incoming);
            }
          });
          return updated;
        });
      } catch {
        // Keep the current snapshot when the refresh provider is unavailable.
      }
    };

    const universeTimer = window.setInterval(refreshUniverse, 15 * 60 * 1000);
    document.addEventListener('visibilitychange', refreshUniverse);
    return () => {
      isMounted = false;
      window.clearInterval(universeTimer);
      document.removeEventListener('visibilitychange', refreshUniverse);
    };
  }, []);

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

  const handleSelectStock = async (stock: StockData) => {
    setFetchingTicker(stock.ticker);
    setIsStockFetching(true);
    const minDelay = new Promise((resolve) => setTimeout(resolve, 1200));
    try {
      const freshRealData = await fetchTickerData(stock.ticker);

      await minDelay;

      if (freshRealData && freshRealData.candles && freshRealData.candles.length > 0) {
        mergeStockIntoState(freshRealData, true);
      } else {
        setSelectedStock(stock);
      }
    } catch (e) {
      setSelectedStock(stock);
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
      let cleanTicker = ticker.trim().toUpperCase();
      if (cleanTicker === 'IHSG' || cleanTicker === 'JKSE' || cleanTicker === '^JKSE') {
        cleanTicker = '^JKSE';
      }
      const match = stocks.find(
        (s) =>
          s.ticker === cleanTicker ||
          (cleanTicker === '^JKSE' && (s.ticker === 'IHSG' || s.ticker === 'JKSE' || s.name.toLowerCase().includes('ihsg')))
      );
      if (match) {
        handleSelectStock(match);
      } else {
        handleFetchNewStock(cleanTicker);
      }
    }
  };

  if (loading || !selectedStock) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center font-mono text-xs">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span>Loading Smart Money Concepts IDX Data...</span>
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
        {activeTab === 'landing' && (
          <ParallaxHero
            onStartChart={handleStartChart}
            onOpenScreener={() => setActiveTab('screener')}
            stocks={stocks}
            onUpdateIhsgData={(liveData) => {
              setStocks((prev) =>
                prev.map((s) => (isMatchingTicker(s.ticker, liveData.ticker) ? liveData : s))
              );
            }}
          />
        )}

        {activeTab === 'inventory' && (
          <InventoryChart
            stocks={stocks}
            selectedStock={selectedStock}
            onSelectStock={(s) => {
              setSelectedStock(s);
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
                    <span className="font-bold text-emerald-400">REAL IDX MARKET DATA</span>
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
                setSelectedStock(s);
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
                setSelectedStock(s);
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
