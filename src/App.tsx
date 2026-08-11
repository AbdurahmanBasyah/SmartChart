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
import { getMockStocks } from './data/mockStocks';
import { StockData } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'landing' | 'chart' | 'screener' | 'guide' | 'calculator' | 'watchlist'>('landing');
  const [stocks, setStocks] = useState<StockData[]>([]);
  const [selectedStock, setSelectedStock] = useState<StockData | null>(null);
  const [timeframe, setTimeframe] = useState<string>('1D');
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [isStockFetching, setIsStockFetching] = useState<boolean>(false);
  const [fetchingTicker, setFetchingTicker] = useState<string>('');

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
    async function loadStocks() {
      try {
        const res = await fetch('/api/stocks');
        if (res.ok) {
          const data: StockData[] = await res.json();
          if (data && data.length > 0) {
            setStocks(data);
            const brpt = data.find((s) => s.ticker === 'BRPT') || data[0];
            setSelectedStock(brpt);
            setLoading(false);
            return;
          }
        }
      } catch (e) {
        console.warn('Failed fetching from API, loading local stock dataset:', e);
      }

      const initial = getMockStocks();
      setStocks(initial);
      setSelectedStock(initial[0]);
      setLoading(false);
    }

    loadStocks();

    // Re-sync after server finishes preloading real market data
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/stocks');
        if (res.ok) {
          const freshData: StockData[] = await res.json();
          if (freshData && freshData.length > 0) {
            setStocks(freshData);
            setSelectedStock((curr) => {
              if (!curr) return freshData[0];
              const match = freshData.find((s) => s.ticker === curr.ticker);
              return match || curr;
            });
          }
        }
      } catch (e) {
        console.warn('Background sync failed:', e);
      }
    }, 3500);

    return () => clearTimeout(timer);
  }, []);

  const handleSelectStock = async (stock: StockData) => {
    setFetchingTicker(stock.ticker);
    setIsStockFetching(true);
    const minDelay = new Promise((resolve) => setTimeout(resolve, 2400));
    try {
      const [res] = await Promise.all([
        fetch(`/api/stock/${stock.ticker}`),
        minDelay,
      ]);
      if (res.ok) {
        const freshRealData: StockData = await res.json();
        setSelectedStock(freshRealData);
        setStocks((prev) =>
          prev.map((s) => (s.ticker === freshRealData.ticker ? freshRealData : s))
        );
      } else {
        setSelectedStock(stock);
      }
    } catch (e) {
      console.warn(`Failed updating real data for ${stock.ticker}:`, e);
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
    const minDelay = new Promise((resolve) => setTimeout(resolve, 2400));
    try {
      const [res] = await Promise.all([
        fetch(`/api/stock/${cleanTicker}`),
        minDelay,
      ]);
      if (res.ok) {
        const stockData: StockData = await res.json();
        setStocks((prev) => {
          const exists = prev.some((s) => s.ticker === stockData.ticker);
          return exists ? prev.map((s) => (s.ticker === stockData.ticker ? stockData : s)) : [stockData, ...prev];
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
          />
        )}

        {activeTab === 'chart' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
            {isStockFetching ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center gap-4 min-h-[500px]">
                <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
                <div>
                  <div className="text-base font-bold text-white mb-1">
                    Loading Real IDX Market Data ({fetchingTicker || selectedStock.ticker})
                  </div>
                  <div className="text-xs text-slate-400">
                    Connecting to Market API & Processing SMC Indicators...
                  </div>
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

      {/* Interactive 4-Step SMC Loading Progress Modal */}
      <SmcLoadingModal
        isOpen={isStockFetching}
        ticker={fetchingTicker || selectedStock?.ticker || ''}
      />

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <strong>SmartMoney.IDX</strong> — Smart Money Concepts Technical Analysis Platform for Indonesia Stocks
          </div>
          <div className="text-[11px] text-slate-400">
            Always LONG | Min R:R 1:1.5 | TP 10%-20% | SL 3%-5% | Volume Confirmation Indicator
          </div>
        </div>
      </footer>
    </div>
  );
}
