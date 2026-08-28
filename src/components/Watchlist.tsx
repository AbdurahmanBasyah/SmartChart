import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Star,
  Trash2,
  BarChart2,
  TrendingUp,
  Search,
  Plus,
  Zap,
  Target,
  ArrowUpRight,
  ShieldAlert,
  Sparkles,
  Layers,
  Crown,
  Loader2,
} from 'lucide-react';
import { StockData, StockListItem } from '../types';
import { getSmcSignalPriorityScore } from './StockScreener';

interface WatchlistProps {
  watchlist: string[];
  stocks: StockListItem[];
  onSelectStock: (stock: StockListItem) => void;
  onRemoveFromWatchlist: (ticker: string) => void;
  onAddStockByTicker: (ticker: string) => Promise<void>;
  onOpenScreener: () => void;
  onToggleWatchlist?: (ticker: string) => void;
}

function isMatchingTicker(tickerA?: string, tickerB?: string): boolean {
  if (!tickerA || !tickerB) return false;
  const normA = tickerA.toUpperCase().replace('.JK', '');
  const normB = tickerB.toUpperCase().replace('.JK', '');
  if (normA === normB) return true;
  const isIhsgA = normA === '^JKSE' || normA === 'IHSG' || normA === 'JKSE';
  const isIhsgB = normB === '^JKSE' || normB === 'IHSG' || normB === 'JKSE';
  return isIhsgA && isIhsgB;
}

export const Watchlist: React.FC<WatchlistProps> = ({
  watchlist,
  stocks,
  onSelectStock,
  onRemoveFromWatchlist,
  onAddStockByTicker,
  onOpenScreener,
  onToggleWatchlist,
}) => {
  const [addTickerInput, setAddTickerInput] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Find tickers in watchlist that are already loaded in `stocks`
  const watchlistStocks = watchlist
    .map((ticker) => stocks.find((s) => isMatchingTicker(s.ticker, ticker)))
    .filter(Boolean) as StockListItem[];

  // Find tickers that were saved to watchlist but are not yet in `stocks` (e.g. non-liquid or custom added stocks)
  const missingTickers = watchlist.filter(
    (ticker) => !stocks.some((s) => isMatchingTicker(s.ticker, ticker))
  );

  // Automatically trigger fetch for any missing watchlist stock in the background
  useEffect(() => {
    if (missingTickers.length > 0) {
      missingTickers.forEach((ticker) => {
        onAddStockByTicker(ticker);
      });
    }
  }, [missingTickers.join(',')]);

  watchlistStocks.sort((a, b) => getSmcSignalPriorityScore(a) - getSmcSignalPriorityScore(b));

  const pageSize = 9;
  const totalPages = Math.max(1, Math.ceil(watchlistStocks.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedWatchlistStocks = watchlistStocks.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [watchlist.join(','), stocks.length]);

  const onBuyAreaCount = watchlistStocks.filter(
    (s) => s.recommendation?.isOnBuyArea || s.recommendation?.status === 'ON_BUY_AREA'
  ).length;

  const handleAddSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!addTickerInput.trim()) return;
    const clean = addTickerInput.trim().toUpperCase();
    setIsAdding(true);
    
    // Ensure ticker is added to watchlist if not present
    if (!watchlist.includes(clean) && onToggleWatchlist) {
      onToggleWatchlist(clean);
    }
    
    await onAddStockByTicker(clean);
    setIsAdding(false);
    setAddTickerInput('');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="space-y-6"
    >
      {/* Top Banner & Stats */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold font-mono tracking-wider uppercase mb-1">
              <Star className="w-4 h-4 fill-amber-400" />
              <span>SMC Preferred Stock Watchlist</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Potential Stock Watchlist
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-1 max-w-2xl">
              Monitor real-time price movements, SMC entry areas, and automatic alerts when prices enter the Buy Area (On Buy Area).
            </p>
          </div>

          {/* Quick Add Form */}
          <form onSubmit={handleAddSubmit} className="flex items-center gap-2 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Add Ticker (e.g. ADRO, BBNI)..."
                value={addTickerInput}
                onChange={(e) => setAddTickerInput(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 w-48 sm:w-56 font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={isAdding}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-amber-500/10 disabled:opacity-50"
            >
              {isAdding ? (
                <div className="w-3.5 h-3.5 border border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Plus className="w-4 h-4 font-bold" />
              )}
              <span>Add</span>
            </button>
          </form>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800/80 text-xs">
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
            <div className="text-slate-400 text-[11px]">Total Monitored Stocks</div>
            <div className="text-lg font-black text-white mt-0.5 font-mono">
              {watchlist.length} Tickers
            </div>
          </div>

          <div className="bg-slate-950/60 border border-emerald-500/30 rounded-xl p-3">
            <div className="text-emerald-400 text-[11px] font-bold flex items-center gap-1">
              <Target className="w-3 h-3" />
              <span>In Buy Area (On Buy Area)</span>
            </div>
            <div className="text-lg font-black text-emerald-400 mt-0.5 font-mono">
              {onBuyAreaCount} Stocks
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
            <div className="text-slate-400 text-[11px]">Rallying Structure</div>
            <div className="text-lg font-black text-sky-400 mt-0.5 font-mono">
              {watchlistStocks.filter((s) => s.recommendation?.structure === 'RALLYING').length} Tickers
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
            <div className="text-slate-400 text-[11px]">Average R:R Ratio</div>
            <div className="text-lg font-black text-amber-400 mt-0.5 font-mono">
              1:
              {(
                watchlistStocks.reduce(
                  (acc, s) => acc + (s.recommendation?.riskRewardRatio ?? 1.5),
                  0
                ) / Math.max(1, watchlistStocks.length)
              ).toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Main Watchlist Cards Grid */}
      {watchlist.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mx-auto">
            <Star className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Watchlist Masih Kosong</h3>
            <p className="text-slate-400 text-xs mt-1 max-w-md mx-auto">
              Belum ada saham yang disimpan ke watchlist. Gunakan pencarian di atas atau jelajahi Screener untuk menandai saham pilihan Anda.
            </p>
          </div>
          <button
            onClick={onOpenScreener}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs inline-flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20"
          >
            <Sparkles className="w-4 h-4" />
            <span>Buka SMC Stock Screener</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Missing / Fetching in Background Placeholders */}
          {missingTickers.map((ticker) => (
            <div
              key={ticker}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl animate-pulse"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-lg font-black text-white font-mono">{ticker}</span>
                  <div className="text-xs text-amber-400 mt-1 flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Memuat data pasar terkini...</span>
                  </div>
                </div>
                <button
                  onClick={() => onRemoveFromWatchlist(ticker)}
                  className="text-slate-500 hover:text-rose-400 p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Hapus dari Watchlist"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="bg-slate-950/80 rounded-xl p-3 h-24 flex items-center justify-center text-xs text-slate-500">
                Mengambil data candlestick & SMC engine...
              </div>
            </div>
          ))}

          {paginatedWatchlistStocks.map((stock) => {
            const rec = stock.recommendation;
            const entryMin = rec?.entryZone?.[0] ?? 0;
            const entryMax = rec?.entryZone?.[1] ?? 0;
            const isOnBuy = rec?.isOnBuyArea || rec?.status === 'ON_BUY_AREA' || (
              stock.currentPrice >= entryMin && stock.currentPrice <= entryMax
            );

            return (
              <div
                key={stock.ticker}
                className={`bg-slate-900 border rounded-2xl p-5 space-y-4 shadow-xl transition-all relative group hover:border-slate-700 ${
                  isOnBuy
                    ? 'border-emerald-500/50 bg-gradient-to-b from-emerald-950/20 via-slate-900 to-slate-900 shadow-emerald-500/10'
                    : 'border-slate-800'
                }`}
              >
                {/* Header Strip */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-black text-white font-mono tracking-tight">
                        {stock.ticker}
                      </span>
                      {stock.conglomerate && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-[10px] text-amber-300 font-medium flex items-center gap-1">
                          <Crown className="w-2.5 h-2.5 text-amber-400" />
                          <span>{stock.conglomerate}</span>
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 truncate max-w-[200px] mt-0.5">
                      {stock.name}
                    </div>
                  </div>

                  {/* Remove Button */}
                  <button
                    onClick={() => onRemoveFromWatchlist(stock.ticker)}
                    className="text-slate-500 hover:text-rose-400 p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Remove from Watchlist"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Status / On Buy Area Banner */}
                {rec?.status === 'TAPPED_POI_REBOUND' ? (
                  <div className="bg-amber-500/15 border border-amber-500/50 rounded-xl p-2.5 px-3 flex items-center justify-between text-xs text-amber-300 font-bold font-mono shadow-sm">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                      <span>🎯 RECENTLY TAPPED FVG/OB</span>
                    </span>
                    <span className="text-white text-[11px]">REBOUND DEMAND</span>
                  </div>
                ) : isOnBuy ? (
                  <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-xl p-2.5 px-3 flex items-center justify-between text-xs text-emerald-300 font-bold font-mono">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      <span>🎯 IN BUY AREA</span>
                    </span>
                    <span className="text-white">
                      Rp {entryMin.toLocaleString()} - {entryMax.toLocaleString()}
                    </span>
                  </div>
                ) : (
                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2 px-3 flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400 text-[11px]">Signal Status:</span>
                    <span className="text-amber-400 font-bold text-[11px]">
                      {rec?.status?.replace(/_/g, ' ')}
                    </span>
                  </div>
                )}

                {/* Price & Target Stats */}
                <div className="grid grid-cols-2 gap-2 bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 text-xs font-mono">
                  <div>
                    <div className="text-[10px] text-slate-500">Last Price</div>
                    <div className="text-sm font-bold text-white mt-0.5">
                      Rp {stock.currentPrice?.toLocaleString()}
                    </div>
                    <div
                      className={`text-[10px] font-semibold mt-0.5 ${
                        (stock.changePercent24h ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {(stock.changePercent24h ?? 0) >= 0 ? '+' : ''}
                      {(stock.changePercent24h ?? 0).toFixed(2)}%
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] text-slate-500">Target TP1 / TP2</div>
                    <div className="text-xs font-bold text-emerald-400 mt-0.5">
                      Rp {rec?.takeProfit1?.toLocaleString()} (+{rec?.takeProfit1Percent}%)
                    </div>
                    <div className="text-[10px] text-emerald-300/80">
                      TP2: Rp {rec?.takeProfit2?.toLocaleString()} (+{rec?.takeProfit2Percent}%)
                    </div>
                  </div>
                </div>

                {/* Key Metrics Footnote */}
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-800/60">
                  <span>
                    SL: <strong className="text-rose-400">Rp {rec?.stopLoss?.toLocaleString()}</strong> ({rec?.stopLossPercent}%)
                  </span>
                  <span>
                    R:R <strong className="text-emerald-400">1:{rec?.riskRewardRatio}</strong>
                  </span>
                </div>

                {/* Action Buttons: Analyze Stock & View Inventory */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      const displayTicker = stock.ticker === '^JKSE' || stock.ticker === 'JKSE' ? 'IHSG' : stock.ticker;
                      try {
                        window.history.pushState(null, '', `/analysis/${encodeURIComponent(displayTicker)}`);
                      } catch (e) {}
                      onSelectStock(stock);
                    }}
                    className="w-full bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 border border-emerald-500/30 font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                  >
                    <BarChart2 className="w-3.5 h-3.5" />
                    <span>Analyze Chart</span>
                  </button>

                  <button
                    onClick={() => {
                      const displayTicker = stock.ticker === '^JKSE' || stock.ticker === 'JKSE' ? 'IHSG' : stock.ticker;
                      try {
                        window.history.pushState(null, '', `/inventory/${encodeURIComponent(displayTicker)}`);
                      } catch (e) {}
                      onSelectStock(stock);
                    }}
                    className="w-full bg-cyan-500/20 hover:bg-cyan-500 text-cyan-300 hover:text-slate-950 border border-cyan-500/30 font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Broker Flow</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {watchlistStocks.length > pageSize && (
        <div className="flex items-center justify-between gap-3 text-xs font-mono text-slate-400">
          <span>
            Menampilkan {(safePage - 1) * pageSize + 1}-{Math.min(safePage * pageSize, watchlistStocks.length)} dari {watchlistStocks.length} saham
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={safePage <= 1}
              className="px-2.5 py-1.5 rounded-lg border border-slate-700 hover:border-amber-500/50 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Sebelumnya
            </button>
            <span className="text-slate-300">{safePage}/{totalPages}</span>
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={safePage >= totalPages}
              className="px-2.5 py-1.5 rounded-lg border border-slate-700 hover:border-amber-500/50 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Berikutnya
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
};
