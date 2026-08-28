import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  TrendingUp,
  Search,
  Filter,
  BarChart2,
  BookOpen,
  Zap,
  Activity,
  Layers,
  Star,
  Menu,
  X,
  Home,
  ChevronRight,
} from 'lucide-react';
import { StockData, StockListItem } from '../types';
import { SmartMoneyIcon } from './SmartMoneyIcon';

interface NavbarProps {
  activeTab: 'landing' | 'chart' | 'inventory' | 'screener' | 'guide' | 'watchlist';
  setActiveTab: (tab: 'landing' | 'chart' | 'inventory' | 'screener' | 'guide' | 'watchlist') => void;
  stocks: StockListItem[];
  selectedStock: StockData | null;
  onSelectStock: (stock: StockListItem) => void;
  onFetchNewStock?: (ticker: string) => Promise<void>;
  watchlistCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  stocks,
  selectedStock,
  onSelectStock,
  onFetchNewStock,
  watchlistCount = 0,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [isSearchingApi, setIsSearchingApi] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const q = searchQuery.trim().toLowerCase();
  const filteredStocks = stocks.filter((s) => {
    if (!q) return false;
    const isIhsgQuery = q === 'ihsg' || q === 'jkse' || q === '^jkse';
    const isIhsgStock =
      s.ticker === '^JKSE' ||
      s.ticker === 'IHSG' ||
      s.ticker === 'JKSE' ||
      s.name.toLowerCase().includes('ihsg');
    if (isIhsgQuery && isIhsgStock) return true;
    return (
      s.ticker.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q)
    );
  });

  const handleSearchSubmit = async () => {
    if (!searchQuery.trim()) return;
    let tickerToSearch = searchQuery.trim().toUpperCase();
    if (tickerToSearch === 'IHSG' || tickerToSearch === 'JKSE' || tickerToSearch === '^JKSE') {
      tickerToSearch = '^JKSE';
    }

    const cleanDisplayTicker = tickerToSearch === '^JKSE' ? 'IHSG' : tickerToSearch;
    try {
      window.history.pushState(null, '', `/analysis/${encodeURIComponent(cleanDisplayTicker)}`);
    } catch (e) {}

    // Check if stock already exists in local list
    const existing = stocks.find(
      (s) =>
        s.ticker.toUpperCase() === tickerToSearch ||
        (tickerToSearch === '^JKSE' && (s.ticker === 'IHSG' || s.ticker === 'JKSE' || s.name.toLowerCase().includes('ihsg')))
    );
    if (existing) {
      onSelectStock(existing);
      setActiveTab('chart');
      setShowSearchDropdown(false);
      setSearchQuery('');
      setIsMobileMenuOpen(false);
      return;
    }

    // Otherwise fetch from API
    if (onFetchNewStock) {
      setIsSearchingApi(true);
      await onFetchNewStock(tickerToSearch);
      setIsSearchingApi(false);
      setShowSearchDropdown(false);
      setSearchQuery('');
      setIsMobileMenuOpen(false);
      setActiveTab('chart');
    }
  };

  // Prepare stocks list for auto rolling marquee ticker (looping infinitely without gap)
  const tickerList = stocks.length > 0 ? stocks : [];
  const repeatedTickerList =
    tickerList.length < 8
      ? [...tickerList, ...tickerList, ...tickerList, ...tickerList]
      : [...tickerList, ...tickerList];

  return (
    <header className="sticky top-0 z-[100] bg-slate-950 border-b border-slate-800 text-slate-100">
      {/* Live Market Ticker Tape with Seamless Horizontal Auto-Rolling Loop */}
      <div className="bg-slate-900/90 backdrop-blur-md text-xs border-b border-slate-800/80 px-2 sm:px-4 py-1 flex items-center overflow-hidden relative select-none">
        {/* Fixed Title Badge on Left */}
        <div className="flex items-center gap-1.5 font-bold text-emerald-400 shrink-0 z-20 bg-slate-900 pr-2 sm:pr-4 py-0.5 border-r border-slate-800/80 shadow-md">
          <Activity className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
          <span className="tracking-wide text-[10px] sm:text-[11px] font-extrabold uppercase">
            IDX RADAR
          </span>
        </div>

        {/* Rolling Marquee Container */}
        <div className="relative flex-1 overflow-hidden flex items-center">
          {/* Subtle Side Fade Gradients */}
          <div className="absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-slate-900 to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-slate-900 to-transparent z-10 pointer-events-none" />

          {/* Marquee Track */}
          <div className="animate-ticker flex items-center">
            <div className="flex items-center gap-4 sm:gap-6 shrink-0 px-3">
              {repeatedTickerList.map((s, idx) => (
                <button
                  key={`t1-${s.symbol}-${idx}`}
                  onClick={() => {
                    onSelectStock(s);
                    setActiveTab('chart');
                  }}
                  className="flex items-center gap-1.5 sm:gap-2 hover:bg-slate-800/70 px-2 py-0.5 rounded-md transition-colors cursor-pointer group shrink-0"
                >
                  <span className="font-bold text-slate-200 group-hover:text-emerald-300 transition-colors">
                    {s.ticker === '^JKSE' || s.ticker === 'JKSE' ? 'IHSG' : s.ticker}
                  </span>
                  <span className="text-slate-400 font-mono text-[11px]">
                    Rp {(s.currentPrice ?? 0).toLocaleString()}
                  </span>
                  <span
                    className={`font-semibold font-mono text-[10px] px-1 py-0.2 rounded ${
                      (s.changePercent24h ?? 0) >= 0
                        ? 'text-emerald-400 bg-emerald-500/10'
                        : 'text-rose-400 bg-rose-500/10'
                    }`}
                  >
                    {(s.changePercent24h ?? 0) >= 0 ? '+' : ''}
                    {(s.changePercent24h ?? 0).toFixed(2)}%
                  </span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-4 sm:gap-6 shrink-0 px-3" aria-hidden="true">
              {repeatedTickerList.map((s, idx) => (
                <button
                  key={`t2-${s.symbol}-${idx}`}
                  onClick={() => {
                    onSelectStock(s);
                    setActiveTab('chart');
                  }}
                  className="flex items-center gap-1.5 sm:gap-2 hover:bg-slate-800/70 px-2 py-0.5 rounded-md transition-colors cursor-pointer group shrink-0"
                >
                  <span className="font-bold text-slate-200 group-hover:text-emerald-300 transition-colors">
                    {s.ticker === '^JKSE' || s.ticker === 'JKSE' ? 'IHSG' : s.ticker}
                  </span>
                  <span className="text-slate-400 font-mono text-[11px]">
                    Rp {(s.currentPrice ?? 0).toLocaleString()}
                  </span>
                  <span
                    className={`font-semibold font-mono text-[10px] px-1 py-0.2 rounded ${
                      (s.changePercent24h ?? 0) >= 0
                        ? 'text-emerald-400 bg-emerald-500/10'
                        : 'text-rose-400 bg-rose-500/10'
                    }`}
                  >
                    {(s.changePercent24h ?? 0) >= 0 ? '+' : ''}
                    {(s.changePercent24h ?? 0).toFixed(2)}%
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        {/* Brand Logo - Smart Chart */}
        <button
          onClick={() => setActiveTab('landing')}
          className="flex items-center gap-2.5 text-left cursor-pointer group shrink-0"
        >
          <div className="w-9 h-9 rounded-xl bg-slate-900 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
            <SmartMoneyIcon size={22} className="text-emerald-400" glow />
          </div>
          <div>
            <div className="font-black text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-emerald-400 bg-clip-text text-transparent">
              Smart<span className="text-emerald-400">Chart</span>
            </div>
            <div className="text-[10px] text-slate-400 tracking-wider uppercase -mt-1 font-medium">
              SMC Technical Analysis
            </div>
          </div>
        </button>

        {/* Search Bar with Autocomplete (Desktop & Tablet) */}
        <div className="relative flex-1 max-w-xs sm:max-w-md hidden md:block">
          <div className="relative flex items-center">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search IDX ticker (e.g. BRPT, BBCA, ADRO)..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSearchDropdown(true);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearchSubmit();
                }
              }}
              onFocus={() => setShowSearchDropdown(true)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-20 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
            />
            {isSearchingApi ? (
              <div className="absolute right-3 top-2.5 flex items-center gap-1 text-[10px] text-emerald-400 font-mono">
                <div className="w-3 h-3 border border-emerald-400 border-t-transparent rounded-full animate-spin" />
                <span>IDX...</span>
              </div>
            ) : (
              <button
                onClick={handleSearchSubmit}
                className="absolute right-1.5 top-1 bottom-1 px-2.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 font-mono text-[11px] font-bold transition-colors cursor-pointer"
              >
                Search
              </button>
            )}
          </div>

          {showSearchDropdown && searchQuery && (
            <div
              className="absolute left-0 right-0 top-full mt-2 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 max-h-64 overflow-y-auto divide-y divide-slate-800/50"
              onMouseLeave={() => setShowSearchDropdown(false)}
            >
              {filteredStocks.length > 0 ? (
                filteredStocks.map((s) => (
                  <button
                    key={s.symbol}
                    onClick={() => {
                      const displayTicker = s.ticker === '^JKSE' || s.ticker === 'JKSE' ? 'IHSG' : s.ticker;
                      try {
                        window.history.pushState(null, '', `/analysis/${encodeURIComponent(displayTicker)}`);
                      } catch (e) {}
                      onSelectStock(s);
                      setActiveTab('chart');
                      setShowSearchDropdown(false);
                      setSearchQuery('');
                    }}
                    className="w-full px-4 py-2.5 text-left hover:bg-slate-800/80 flex items-center justify-between transition-colors text-xs cursor-pointer"
                  >
                    <div>
                      <div className="font-bold text-white flex items-center gap-2">
                        <span>{s.ticker === '^JKSE' || s.ticker === 'JKSE' ? 'IHSG' : s.ticker}</span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-emerald-400 font-mono">
                          {s.recommendation?.structure ?? ''}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 truncate max-w-[200px]">
                        {s.name}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-slate-200">
                        Rp {(s.currentPrice ?? 0).toLocaleString()}
                      </div>
                      <div className="text-[10px] text-emerald-400 font-medium">
                        R:R 1:{s.recommendation?.riskRewardRatio ?? 0}
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <button
                  onClick={handleSearchSubmit}
                  className="w-full p-4 text-center text-xs text-emerald-400 hover:bg-slate-800/80 transition-colors font-mono cursor-pointer flex flex-col items-center gap-1"
                >
                  <span className="font-bold">Press Enter or click here to search</span>
                  <span className="text-[11px] text-slate-400 font-sans">
                    Fetch real market data for "{searchQuery.toUpperCase()}" via Yahoo Finance API
                  </span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Desktop Tab Navigation */}
        <nav className="hidden md:flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => setActiveTab('chart')}
            className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'chart'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-lg shadow-emerald-500/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            <span>Interactive Chart</span>
          </button>

          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'inventory'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-lg shadow-cyan-500/10'
                : 'text-slate-400 hover:text-cyan-300 hover:bg-slate-900'
            }`}
          >
            <Layers className="w-4 h-4 text-cyan-400" />
            <span>Inventory Chart</span>
          </button>

          <button
            onClick={() => setActiveTab('screener')}
            className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'screener'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-lg shadow-emerald-500/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span>SMC Screener</span>
          </button>

          <button
            onClick={() => setActiveTab('watchlist')}
            className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer relative ${
              activeTab === 'watchlist'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-lg shadow-amber-500/10'
                : 'text-slate-400 hover:text-amber-300 hover:bg-slate-900'
            }`}
          >
            <Star className={`w-4 h-4 ${activeTab === 'watchlist' ? 'fill-amber-400 text-amber-400' : ''}`} />
            <span>Watchlist</span>
            {watchlistCount > 0 && (
              <span className="bg-amber-500 text-slate-950 text-[10px] font-black px-1.5 py-0.2 rounded-full font-mono">
                {watchlistCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('guide')}
            className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'guide'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-lg shadow-emerald-500/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span className="hidden lg:inline">SMC Guide</span>
          </button>
        </nav>

        {/* Mobile Hamburger Menu Toggle Button */}
        <div className="flex items-center gap-2 md:hidden relative z-[101]">
          <button
            onClick={() => setActiveTab('watchlist')}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-amber-400 relative"
          >
            <Star className="w-4 h-4 fill-amber-400" />
            {watchlistCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-amber-500 text-slate-950 text-[9px] font-black px-1.5 rounded-full">
                {watchlistCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 hover:text-white cursor-pointer transition-colors"
            aria-label="Toggle Navigation Menu"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer / Sidebar Backdrop & Panel with Liquid Animation */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ clipPath: 'circle(0% at calc(100% - 32px) 32px)', opacity: 0 }}
            animate={{ clipPath: 'circle(150% at calc(100% - 32px) 32px)', opacity: 1 }}
            exit={{ clipPath: 'circle(0% at calc(100% - 32px) 32px)', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 140, damping: 20 }}
            className="fixed top-0 left-0 w-screen h-[100dvh] min-h-[100dvh] z-[999] md:hidden flex flex-col bg-slate-950/98 backdrop-blur-2xl border-b border-slate-800 overflow-y-auto"
          >
            {/* Organic Liquid Fluid Wave Glow Decorative Layer */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-emerald-500/20 via-teal-500/10 to-transparent rounded-full blur-3xl pointer-events-none animate-pulse" />
            <div className="absolute bottom-10 left-0 w-64 h-64 bg-gradient-to-tr from-sky-500/15 via-emerald-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />

            <div className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0 relative z-10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-slate-900 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold shadow-lg shadow-emerald-500/30">
                  <SmartMoneyIcon size={18} className="text-emerald-400" glow />
                </div>
                <span className="font-bold text-white text-base tracking-tight">SmartChart Menu</span>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white cursor-pointer active:scale-95 transition-transform"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto flex-1 relative z-10">
              {/* Search Input on Mobile */}
              <motion.div
                initial={{ y: 15, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 200, damping: 20 }}
                className="relative"
              >
                <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search IDX ticker (e.g. BRPT, BBCA)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSearchSubmit();
                    }
                  }}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-16 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
                <button
                  onClick={handleSearchSubmit}
                  className="absolute right-1.5 top-1.5 bottom-1.5 px-3 bg-emerald-500 text-slate-950 font-bold text-xs rounded-lg active:scale-95 transition-transform"
                >
                  Go
                </button>
              </motion.div>

              {/* Mobile Navigation Links */}
              <div className="space-y-1.5 pt-2">
                <motion.button
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.15, type: 'spring', stiffness: 220, damping: 20 }}
                  onClick={() => {
                    setActiveTab('landing');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full p-3 rounded-xl text-left font-bold text-xs flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all ${
                    activeTab === 'landing' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-lg shadow-emerald-500/10' : 'text-slate-300 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Home className="w-4 h-4 text-emerald-400" />
                    <span>Dashboard Home</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-600" />
                </motion.button>

                <motion.button
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 220, damping: 20 }}
                  onClick={() => {
                    setActiveTab('chart');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full p-3 rounded-xl text-left font-bold text-xs flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all ${
                    activeTab === 'chart' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-lg shadow-emerald-500/10' : 'text-slate-300 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <BarChart2 className="w-4 h-4 text-emerald-400" />
                    <span>Interactive SMC Chart</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-600" />
                </motion.button>

                <motion.button
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.22, type: 'spring', stiffness: 220, damping: 20 }}
                  onClick={() => {
                    setActiveTab('inventory');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full p-3 rounded-xl text-left font-bold text-xs flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all ${
                    activeTab === 'inventory' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-lg shadow-cyan-500/10' : 'text-slate-300 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Layers className="w-4 h-4 text-cyan-400" />
                    <span>Broker Inventory Chart</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-600" />
                </motion.button>

                <motion.button
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.25, type: 'spring', stiffness: 220, damping: 20 }}
                  onClick={() => {
                    setActiveTab('screener');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full p-3 rounded-xl text-left font-bold text-xs flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all ${
                    activeTab === 'screener' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-lg shadow-emerald-500/10' : 'text-slate-300 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Filter className="w-4 h-4 text-emerald-400" />
                    <span>SMC Screener Radar</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-600" />
                </motion.button>

                <motion.button
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3, type: 'spring', stiffness: 220, damping: 20 }}
                  onClick={() => {
                    setActiveTab('watchlist');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full p-3 rounded-xl text-left font-bold text-xs flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all ${
                    activeTab === 'watchlist' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-lg shadow-amber-500/10' : 'text-slate-300 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                    <span>Watchlist ({watchlistCount})</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-600" />
                </motion.button>

                <motion.button
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4, type: 'spring', stiffness: 220, damping: 20 }}
                  onClick={() => {
                    setActiveTab('guide');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full p-3 rounded-xl text-left font-bold text-xs flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all ${
                    activeTab === 'guide' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-lg shadow-emerald-500/10' : 'text-slate-300 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <BookOpen className="w-4 h-4 text-cyan-400" />
                    <span>SMC Concepts Guide</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-600" />
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};
