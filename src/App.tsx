import React, { useState, useEffect } from 'react';
import { Loader2, Star } from 'lucide-react';
import { Navbar } from './components/Navbar';
import { ParallaxHero } from './components/ParallaxHero';
import { SmcCanvasChart } from './components/SmcCanvasChart';
import { RecommendationPanel } from './components/RecommendationPanel';
import { StockScreener } from './components/StockScreener';
import { PositionCalculator } from './components/PositionCalculator';
import { Watchlist } from './components/Watchlist';
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

export default function App() {
  const [activeTab, setActiveTab] = useState<'landing' | 'chart' | 'screener' | 'guide' | 'calculator' | 'watchlist'>('landing');
  const [stocks, setStocks] = useState<StockData[]>([]);
  const [selectedStock, setSelectedStock] = useState<StockData | null>(null);
  const [timeframe, setTimeframe] = useState<string>('1D');
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [isStockFetching, setIsStockFetching] = useState<boolean>(false);
  const [fetchingTicker, setFetchingTicker] = useState<string>('');

  // Initial Sync HUD States
  const [isSyncModalOpen, setIsSyncModalOpen] = useState<boolean>(true);
  const [syncProgress, setSyncProgress] = useState<number>(10);
  const [syncedTickers, setSyncedTickers] = useState<string[]>([]);
  const [currentProcessingTicker, setCurrentProcessingTicker] = useState<string>('BRPT');
  const [isSyncComplete, setIsSyncComplete] = useState<boolean>(false);

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

  // Load stock data on mount
  useEffect(() => {
    let isMounted = true;

    async function loadStocks() {
      let initialList: StockData[] = [];
      try {
        const res = await fetch('/api/stocks');
        if (res.ok) {
          const data: StockData[] = await res.json();
          if (data && data.length > 0) {
            initialList = data;
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
        setStocks(initialList);
        const brpt = initialList.find((s) => s.ticker === 'BRPT') || initialList[0];
        setSelectedStock(brpt);
        setLoading(false);
      }

      // Immediately fetch real live market data for top liquid stocks and all watchlist items
      const syncRealData = async () => {
        if (!isMounted) return;
        try {
          const { fetchYahooStockData } = await import('./services/yahooFinance');
          const primaryTickers = Array.from(
            new Set([
              'BRPT', 'BBCA', 'BBRI', 'BMRI', 'ADRO', 'BUMI', 'CUAN', 'BREN', 'GOTO',
              'TLKM', 'ASII', 'ANTM', 'AMMN', 'TPIA', 'INDF', 'PANI', 'PTRO', 'MDKA',
              'ICBP', 'UNVR', 'KLBF', 'CPIN', 'MEDC', 'AKRA', 'PGAS', '^JKSE',
              ...watchlist,
            ])
          );

          let completedCount = 0;
          const batchSize = 4;

          for (let i = 0; i < primaryTickers.length; i += batchSize) {
            if (!isMounted) break;
            const chunk = primaryTickers.slice(i, i + batchSize);
            
            await Promise.allSettled(
              chunk.map(async (t) => {
                try {
                  if (isMounted) setCurrentProcessingTicker(t);
                  const live = await fetchYahooStockData(t);
                  completedCount++;
                  
                  if (isMounted && live && live.candles && live.candles.length > 0) {
                    setStocks((prev) => {
                      const exists = prev.some((s) => isMatchingTicker(s.ticker, live.ticker));
                      const updated = exists
                        ? prev.map((s) => (isMatchingTicker(s.ticker, live.ticker) ? live : s))
                        : [live, ...prev];
                      
                      try {
                        const toCache = updated.filter((s) => s.isRealData);
                        localStorage.setItem('smc_custom_stocks', JSON.stringify(toCache));
                      } catch (e) {}

                      return updated;
                    });
                    
                    setSyncedTickers((prev) => Array.from(new Set([...prev, live.ticker])));
                    setSelectedStock((curr) => (isMatchingTicker(curr?.ticker, live.ticker) ? live : curr));
                  }
                  
                  if (isMounted) {
                    const rawProg = (completedCount / primaryTickers.length) * 100;
                    setSyncProgress(Math.min(98, Math.round(rawProg)));
                  }
                } catch (err) {
                  completedCount++;
                }
              })
            );
          }

          if (isMounted) {
            setSyncProgress(100);
            setIsSyncComplete(true);
            // Smoothly auto-close after 600ms
            setTimeout(() => {
              if (isMounted) {
                setIsSyncModalOpen(false);
              }
            }, 600);
          }
        } catch (e) {
          if (isMounted) {
            setIsSyncComplete(true);
            setIsSyncModalOpen(false);
          }
        }
      };

      // Run live real sync immediately
      syncRealData();
    }

    const cleanupPromise = loadStocks();

    // Re-sync with server periodically without overwriting real stock data
    const interval = setInterval(async () => {
      if (!isMounted) return;
      try {
        const res = await fetch('/api/stocks');
        if (res.ok) {
          const freshData: StockData[] = await res.json();
          if (isMounted && freshData && freshData.length > 0) {
            setStocks((prev) => {
              const updated = [...prev];
              freshData.forEach((incoming) => {
                const idx = updated.findIndex((s) => isMatchingTicker(s.ticker, incoming.ticker));
                if (idx >= 0) {
                  const existing = updated[idx];
                  // Never overwrite real data with mock fallback data
                  if (existing.isRealData && !incoming.isRealData) {
                    return;
                  }
                  updated[idx] = incoming;
                } else {
                  updated.push(incoming);
                }
              });
              return updated;
            });

            setSelectedStock((curr) => {
              if (!curr) return freshData[0];
              const match = freshData.find((s) => isMatchingTicker(s.ticker, curr.ticker));
              if (match) {
                if (curr.isRealData && !match.isRealData) {
                  return curr; // Keep real data
                }
                return match;
              }
              return curr;
            });
          }
        }
      } catch (e) {
        // silent continue
      }
    }, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleSelectStock = async (stock: StockData) => {
    setFetchingTicker(stock.ticker);
    setIsStockFetching(true);
    const minDelay = new Promise((resolve) => setTimeout(resolve, 1200));
    try {
      let freshRealData: StockData | null = null;
      try {
        const res = await fetch(`/api/stock/${encodeURIComponent(stock.ticker)}`);
        if (res.ok) {
          freshRealData = await res.json();
        } else {
          const res2 = await fetch(`/api/stock?symbol=${encodeURIComponent(stock.ticker)}`);
          if (res2.ok) {
            freshRealData = await res2.json();
          }
        }
      } catch (e) {
        // Fallback to client fetch
      }

      // If backend API failed or unavailable (e.g. Vercel deployment), fetch client-side with CORS proxy
      if (!freshRealData) {
        const { fetchYahooStockData } = await import('./services/yahooFinance');
        freshRealData = await fetchYahooStockData(stock.ticker);
      }

      await minDelay;

      if (freshRealData && freshRealData.candles && freshRealData.candles.length > 0) {
        setSelectedStock(freshRealData);
        setStocks((prev) =>
          prev.map((s) => (isMatchingTicker(s.ticker, freshRealData!.ticker) ? freshRealData! : s))
        );
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
    let cleanTicker = ticker.trim().toUpperCase();
    if (cleanTicker === 'IHSG' || cleanTicker === 'JKSE' || cleanTicker === '^JKSE') {
      cleanTicker = '^JKSE';
    }
    setFetchingTicker(cleanTicker);
    setIsStockFetching(true);
    const minDelay = new Promise((resolve) => setTimeout(resolve, 1200));
    try {
      let stockData: StockData | null = null;
      try {
        const res = await fetch(`/api/stock/${encodeURIComponent(cleanTicker)}`);
        if (res.ok) {
          stockData = await res.json();
        } else {
          const res2 = await fetch(`/api/stock?symbol=${encodeURIComponent(cleanTicker)}`);
          if (res2.ok) {
            stockData = await res2.json();
          }
        }
      } catch (e) {
        // Fallback to client fetch
      }

      if (!stockData) {
        const { fetchYahooStockData } = await import('./services/yahooFinance');
        stockData = await fetchYahooStockData(cleanTicker);
      }

      await minDelay;

      if (stockData && stockData.candles && stockData.candles.length > 0) {
        setStocks((prev) => {
          const exists = prev.some((s) => isMatchingTicker(s.ticker, stockData!.ticker));
          const updated = exists
            ? prev.map((s) => (isMatchingTicker(s.ticker, stockData!.ticker) ? stockData! : s))
            : [stockData!, ...prev];
          
          try {
            const toCache = updated.filter((s) => s.isRealData);
            localStorage.setItem('smc_custom_stocks', JSON.stringify(toCache));
          } catch (e) {}

          return updated;
        });
        setSelectedStock(stockData);
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
          }
        }}
        stocks={stocks}
        selectedStock={selectedStock}
        onSelectStock={handleSelectStock}
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

        {activeTab === 'calculator' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <PositionCalculator />
          </div>
        )}
      </main>

      {/* Educational Guide Drawer/Modal */}
      <SmcGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />

      {/* Real-time Initial Live Market Data Syncing Overlay */}
      {isSyncModalOpen && (
        <SyncLoadingScreen
          progress={syncProgress}
          totalStocks={26}
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
