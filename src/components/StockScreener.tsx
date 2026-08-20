import React, { useState, useEffect, useMemo } from 'react';
import {
  Filter,
  Search,
  CheckCircle2,
  AlertCircle,
  Sliders,
  ChevronRight,
  ChevronLeft,
  TrendingUp,
  Layers,
  ArrowUpDown,
  Zap,
  Star,
  Target,
  Loader2,
  Database,
  Cpu,
} from 'lucide-react';
import { StockData, ScreenerFilter } from '../types';

interface StockScreenerProps {
  stocks: StockData[];
  onSelectStock: (stock: StockData) => void;
  onFetchNewStock?: (ticker: string) => Promise<void>;
  watchlist?: string[];
  onToggleWatchlist?: (ticker: string) => void;
  isStockFetching?: boolean;
  fetchingTicker?: string;
}

// Helper to calculate SMC Signal Priority (1 = Highest Priority)
export function getSmcSignalPriorityScore(stock: StockData): number {
  const rec = stock?.recommendation;
  const status = rec?.status;
  const currentP = stock?.currentPrice ?? 0;
  const entryMin = rec?.entryZone?.[0] ?? 0;
  const entryMax = rec?.entryZone?.[1] ?? 0;

  // 1. Kmrn tap fvg/ob
  if (status === 'TAPPED_POI_REBOUND') return 1;

  // 2. On buy area
  const isOnBuyArea =
    rec?.isOnBuyArea ||
    status === 'ON_BUY_AREA' ||
    (currentP >= entryMin && currentP <= entryMax && rec?.primaryZoneType !== 'NONE');
  if (isOnBuyArea && status !== 'NO_ENTRY') return 2;

  // 3. Dekat entry area 0-3%
  if (status === 'NEAR_ENTRY') return 3;

  // 4. Wait fvg
  if (status === 'WAIT_FVG_CREATION') return 4;

  // 5. Wait pullback fvg
  if (status === 'WAIT_PULLBACK_FVG') return 5;

  // 6. Diskon poi
  if (status === 'STRONG_BUY_POI') return 6;

  // 7. Akumulasi sideways
  if (status === 'SIDEWAYS_ACCUMULATION') return 7;

  return 8;
}

export const CONGLOMERATE_SECTOR_GROUPS: { id: string; label: string; tickers?: string[] }[] = [
  { id: 'ALL', label: '🏛️ Semua Grup & Sektor' },
  { id: 'WATCHLIST', label: '⭐ Watchlist Saya' },
  { id: 'IHSG', label: '📈 1. IHSG', tickers: ['IHSG', '^JKSE', 'JKSE'] },
  { id: 'PRAJOGO', label: '👑 2. Prajogo Pangestu', tickers: ['CDIA', 'CUAN', 'BREN', 'PTRO', 'TPIA', 'SINI', 'BRPT'] },
  { id: 'BAKRIE', label: '👑 3. Bakrie', tickers: ['ALII', 'BNBR', 'KOTA', 'MDIA', 'BRMS', 'BUMI', 'DEWA', 'ENRG', 'VKTR', 'JGLE', 'OASA', 'BIPI', 'UNSP', 'VIVA'] },
  { id: 'BOY_THOHIR', label: '👑 4. Boy Thohir', tickers: ['MBMA', 'ESSA', 'MDKA', 'AADI', 'ADMR', 'ADRO', 'EMAS'] },
  { id: 'AGUAN', label: '👑 5. Aguan', tickers: ['CBDK', 'ECII', 'ERAA', 'ERAL', 'INPC', 'JIHD', 'PANI'] },
  { id: 'HAPPY_HAPSORO', label: '👑 6. Happy Hapsoro', tickers: ['ARCI', 'BUVA', 'CBRE', 'MINA', 'PADDI', 'PADI', 'PSKT', 'RAJA', 'RATU', 'SINI', 'UANG', 'PSAB', 'FORU'] },
  { id: 'PERBANKAN', label: '🏦 7. Perbankan', tickers: ['AGRO', 'ARTO', 'BBYB', 'BGTG', 'BMRI', 'BBCA', 'BBNI', 'BBTN', 'BBRI', 'BRIS', 'BBHI', 'NOBU', 'PNBN', 'PNLF'] },
  { id: 'BUMN', label: '🏢 8. BUMN', tickers: ['ANTM', 'GIAA', 'GMFFI', 'GMFI', 'INCO', 'JSMR', 'KAEF', 'KRAS', 'SMBR', 'SMGR', 'TINS', 'TLKM'] },
  { id: 'COAL', label: '⚡ 9. COAL', tickers: ['BUMI', 'HRUM', 'ITMG', 'PTBA', 'BYAN'] },
  { id: 'HAJI_ISSAM', label: '👑 10. HAJI ISSAM', tickers: ['FAST', 'JARR', 'PGUN', 'TEBE'] },
  { id: 'HASYIM', label: '👑 11. HASYIM', tickers: ['DOOH', 'INET', 'KETR', 'WIFI'] },
  { id: 'SALIM', label: '👑 12. Salim', tickers: ['ICBP', 'LSIP', 'SIMP', 'META', 'INDF', 'AMRT', 'ROTI', 'DNET', 'IMAS', 'IMJS', 'AMMN', 'MEDC'] },
  { id: 'INTERNET', label: '🌐 13. Internet', tickers: ['MORA', 'DOOH', 'IRSX', 'INET', 'PADA', 'WIFI'] },
  { id: 'LOGISTIK', label: '🚢 14. Logistik dan perkapalan', tickers: ['SOCI', 'BULL', 'GTSI', 'HUMI', 'LEAD'] },
];

export const StockScreener: React.FC<StockScreenerProps> = ({
  stocks,
  onSelectStock,
  onFetchNewStock,
  watchlist = [],
  onToggleWatchlist,
  isStockFetching = false,
  fetchingTicker = '',
}) => {
  const [filters, setFilters] = useState<ScreenerFilter>({
    search: '',
    sector: 'ALL',
    conglomerateFilter: 'ALL',
    structure: 'ALL',
    minRiskReward: 1.5,
    volumeConfirmedOnly: false,
    zoneType: 'ALL',
    signalStatus: 'ALL',
  });

  const availableConglomerates = Array.from(
    new Set(stocks.map((s) => s.conglomerate).filter(Boolean) as string[])
  ).sort();

  const [isFetchingApi, setIsFetchingApi] = useState(false);

  const handleFetchTicker = async () => {
    if (!filters.search.trim() || !onFetchNewStock) return;
    setIsFetchingApi(true);
    await onFetchNewStock(filters.search.trim().toUpperCase());
    setIsFetchingApi(false);
  };

  const [sortField, setSortField] = useState<'signal' | 'ticker' | 'price' | 'rr' | 'change'>('signal');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [excludeDowntrend, setExcludeDowntrend] = useState<boolean>(true);

  // Pagination states
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number | 'ALL'>(10);

  // Identify Top Pick candidates based on SMC priority score, close to entry, & upside potential
  const topPickSet = useMemo(() => {
    const candidates = stocks
      .filter((s) => {
        const priority = getSmcSignalPriorityScore(s);
        const rec = s.recommendation;
        const cp = s.currentPrice ?? 0;
        const tp1 = rec?.takeProfit1 ?? 0;
        const entryMin = rec?.entryZone?.[0] ?? cp;
        const entryMax = rec?.entryZone?.[1] ?? cp;
        const isOnBuyArea = cp >= entryMin && cp <= entryMax;
        const isNearEntry =
          rec?.status === 'TAPPED_POI_REBOUND' ||
          rec?.status === 'ON_BUY_AREA' ||
          rec?.status === 'NEAR_ENTRY';

        const upside = cp > 0 && tp1 > cp ? ((tp1 - cp) / cp) * 100 : 0;

        return priority <= 3 && isNearEntry && upside >= 2.0 && rec?.status !== 'NO_ENTRY';
      })
      .sort((a, b) => {
        const pA = getSmcSignalPriorityScore(a);
        const pB = getSmcSignalPriorityScore(b);
        if (pA !== pB) return pA - pB;

        const cpA = a.currentPrice ?? 0;
        const cpB = b.currentPrice ?? 0;
        const tp1A = a.recommendation?.takeProfit1 ?? 0;
        const tp1B = b.recommendation?.takeProfit1 ?? 0;
        const upsideA = cpA > 0 && tp1A > cpA ? (tp1A - cpA) / cpA : 0;
        const upsideB = cpB > 0 && tp1B > cpB ? (tp1B - cpB) / cpB : 0;
        return upsideB - upsideA;
      })
      .slice(0, 6)
      .map((s) => s.ticker);

    return new Set(candidates);
  }, [stocks]);

  // Apply filters
  const filteredStocks = stocks.filter((stock) => {
    const rec = stock?.recommendation;

    // Smart Market Quality Filter: Eliminate severe downtrend / illiquid / AVOID stocks
    if (excludeDowntrend) {
      if ((stock.currentPrice ?? 0) < 50) return false; // Exclude penny stocks < Rp 50
      if (rec?.action === 'AVOID') return false; // Exclude stocks flagged AVOID
      if (rec?.status === 'NO_TRADE_ZONE') return false; // Exclude stocks in no-trade zone
    }

    // Search filter
    if (
      filters.search &&
      !stock?.ticker?.toLowerCase().includes(filters.search.toLowerCase()) &&
      !stock?.name?.toLowerCase().includes(filters.search.toLowerCase()) &&
      !stock?.conglomerate?.toLowerCase().includes(filters.search.toLowerCase())
    ) {
      return false;
    }

    // Conglomerate / Sector group filter
    if (filters.conglomerateFilter && filters.conglomerateFilter !== 'ALL') {
      if (filters.conglomerateFilter === 'WATCHLIST') {
        const isWl = watchlist.some((w) => {
          const cleanW = w.trim().toUpperCase().replace('.JK', '');
          const stockTick = stock.ticker.replace('.JK', '').toUpperCase();
          return stockTick === cleanW || (cleanW === 'IHSG' && stockTick === '^JKSE');
        });
        if (!isWl) return false;
      } else {
        const selectedGroup = CONGLOMERATE_SECTOR_GROUPS.find((g) => g.id === filters.conglomerateFilter);
        if (selectedGroup?.tickers && selectedGroup.tickers.length > 0) {
          const isMatch = selectedGroup.tickers.some((t) => {
            const cleanT = t.trim().toUpperCase().replace('.JK', '');
            const stockTick = stock.ticker.replace('.JK', '').toUpperCase();
            return (
              stockTick === cleanT ||
              (cleanT === '^JKSE' && (stockTick === 'IHSG' || stockTick === '^JKSE')) ||
              (cleanT === 'IHSG' && (stockTick === '^JKSE' || stockTick === 'IHSG')) ||
              (cleanT === 'PADDI' && stockTick === 'PADI') ||
              (cleanT === 'GMFFI' && stockTick === 'GMFI')
            );
          });
          if (!isMatch) return false;
        } else if (stock.conglomerate !== filters.conglomerateFilter) {
          return false;
        }
      }
    }

    // Structure filter
    if (filters.structure !== 'ALL' && rec?.structure !== filters.structure) {
      return false;
    }

    // Risk reward filter
    if ((rec?.riskRewardRatio ?? 0) < filters.minRiskReward) {
      return false;
    }

    // Volume filter
    if (filters.volumeConfirmedOnly && !rec?.volumeConfirmation) {
      return false;
    }

    // Zone type filter
    if (filters.zoneType !== 'ALL' && rec?.primaryZoneType !== filters.zoneType) {
      return false;
    }

    // Signal Status filter (includes Mendekati Titik Entry, On Buy Area & Menunggu FVG)
    if (filters.signalStatus && filters.signalStatus !== 'ALL') {
      if ((filters.signalStatus as string) === 'TOP_PICKS') {
        if (!topPickSet.has(stock.ticker)) return false;
      } else if (filters.signalStatus === 'ON_BUY_AREA') {
        const isBuyArea = rec?.isOnBuyArea || rec?.status === 'ON_BUY_AREA' || (
          (stock.currentPrice ?? 0) >= (rec?.entryZone?.[0] ?? 0) &&
          (stock.currentPrice ?? 0) <= (rec?.entryZone?.[1] ?? 0) &&
          rec?.primaryZoneType !== 'NONE'
        );
        if (!isBuyArea) return false;
      } else if (filters.signalStatus === 'NEAR_ENTRY') {
        if (rec?.status !== 'NEAR_ENTRY') return false;
      } else if (filters.signalStatus === 'WAIT_FVG_CREATION') {
        if (rec?.status !== 'WAIT_FVG_CREATION') return false;
      } else {
        if (rec?.status !== filters.signalStatus) return false;
      }
    }

    return true;
  });

  // Sort
  const sortedStocks = [...filteredStocks].sort((a, b) => {
    let result = 0;
    if (sortField === 'signal') {
      result = getSmcSignalPriorityScore(a) - getSmcSignalPriorityScore(b);
      // Tie-breaker: sort by Risk-Reward ratio descending
      if (result === 0) {
        result = (b.recommendation?.riskRewardRatio ?? 0) - (a.recommendation?.riskRewardRatio ?? 0);
      }
    } else if (sortField === 'ticker') {
      result = (a.ticker || '').localeCompare(b.ticker || '');
    } else if (sortField === 'price') {
      result = (a.currentPrice ?? 0) - (b.currentPrice ?? 0);
    } else if (sortField === 'rr') {
      result = (a.recommendation?.riskRewardRatio ?? 0) - (b.recommendation?.riskRewardRatio ?? 0);
    } else if (sortField === 'change') {
      result = (a.changePercent24h ?? 0) - (b.changePercent24h ?? 0);
    }

    return sortAsc ? result : -result;
  });

  // Pagination Math
  const totalItems = sortedStocks.length;
  const numPageSize = pageSize === 'ALL' ? totalItems : pageSize;
  const totalPages = pageSize === 'ALL' ? 1 : Math.max(1, Math.ceil(totalItems / (numPageSize || 1)));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedStocks = pageSize === 'ALL'
    ? sortedStocks
    : sortedStocks.slice((safePage - 1) * numPageSize, safePage * numPageSize);

  const startItemIndex = totalItems === 0 ? 0 : (safePage - 1) * numPageSize + 1;
  const endItemIndex = pageSize === 'ALL' ? totalItems : Math.min(safePage * numPageSize, totalItems);

  return (
    <div className="space-y-6">
      {/* Header & Filter Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Filter className="w-5 h-5 text-emerald-400" />
              <span>Smart Money Concepts Stock Screener (IDX)</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Filter stocks precisely based on FVG, Order Block setups, and Volume Confirmation
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setExcludeDowntrend(!excludeDowntrend)}
              className={`text-xs px-3 py-1.5 rounded-xl border font-medium transition-all flex items-center gap-1.5 ${
                excludeDowntrend
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                  : 'bg-slate-800/80 text-slate-400 border-slate-700/60 hover:text-slate-200'
              }`}
              title="Show only valid SMC setup stocks, eliminating severe downtrends & inactive stocks"
            >
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span>Quality Filter (Eliminate Downtrends)</span>
            </button>

            <div className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/30 font-bold">
              Found: {sortedStocks.length} Stocks
            </div>
          </div>
        </div>

        {/* Filter Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3 text-xs">
          {/* Search */}
          <div className="relative flex items-center">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search Ticker/Group..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && filters.search.trim()) {
                  handleFetchTicker();
                }
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-16 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
            {filters.search.trim() && (
              <button
                onClick={handleFetchTicker}
                disabled={isFetchingApi}
                className="absolute right-1 top-1 bottom-1 px-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[10px] rounded-lg cursor-pointer transition-colors"
              >
                {isFetchingApi ? 'Loading...' : 'Search IDX'}
              </button>
            )}
          </div>

          {/* Conglomerate / Sektor Group Selector */}
          <div>
            <select
              value={filters.conglomerateFilter || 'ALL'}
              onChange={(e) => setFilters({ ...filters, conglomerateFilter: e.target.value })}
              className="w-full bg-slate-950 border border-amber-500/30 text-amber-300 font-medium rounded-xl px-3 py-2 focus:outline-none focus:border-amber-400 cursor-pointer"
            >
              {CONGLOMERATE_SECTOR_GROUPS.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.label}
                </option>
              ))}
            </select>
          </div>

          {/* Sinyal Setup / Status Selector */}
          <div>
            <select
              value={filters.signalStatus}
              onChange={(e) => setFilters({ ...filters, signalStatus: e.target.value as any })}
              className="w-full bg-slate-950 border border-emerald-500/40 text-emerald-300 font-semibold rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-400"
            >
              <option value="ALL">All SMC Signals (Priority Sorted)</option>
              <option value="TOP_PICKS">🔥 TOP PICKS (Near Entry & High Upside)</option>
              <option value="TAPPED_POI_REBOUND">🎯 1. Tapped FVG/OB Recently (Rebound)</option>
              <option value="ON_BUY_AREA">🎯 2. In Buy Area (On Buy Area)</option>
              <option value="NEAR_ENTRY">📍 3. Near Entry Area (0-3%)</option>
              <option value="WAIT_FVG_CREATION">⏳ 4. Awaiting FVG Creation</option>
              <option value="WAIT_PULLBACK_FVG">📉 5. Wait Pullback FVG</option>
              <option value="STRONG_BUY_POI">🔥 6. Discount POI Zone</option>
              <option value="SIDEWAYS_ACCUMULATION">📦 7. Sideways Accumulation</option>
            </select>
          </div>

          {/* Structure Selector */}
          <div>
            <select
              value={filters.structure}
              onChange={(e) => setFilters({ ...filters, structure: e.target.value as any })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">All Trend Structures</option>
              <option value="RALLYING">Rallying (Pullback FVG)</option>
              <option value="SIDEWAYS">Sideways (OB Accumulation)</option>
            </select>
          </div>

          {/* Zone Type */}
          <div>
            <select
              value={filters.zoneType}
              onChange={(e) => setFilters({ ...filters, zoneType: e.target.value as any })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">All SMC Zones</option>
              <option value="FVG">Fair Value Gap (FVG)</option>
              <option value="ORDER_BLOCK">Order Block (POI)</option>
              <option value="SUPPORT">Support Area</option>
            </select>
          </div>

          {/* Min R:R */}
          <div>
            <select
              value={filters.minRiskReward}
              onChange={(e) => setFilters({ ...filters, minRiskReward: parseFloat(e.target.value) })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="1.0">Min R:R 1 : 1.0</option>
              <option value="1.5">Min R:R 1 : 1.5 (Recommended)</option>
              <option value="2.0">Min R:R 1 : 2.0</option>
              <option value="3.0">Min R:R 1 : 3.0+</option>
            </select>
          </div>

          {/* Volume Spike Only Toggle */}
          <button
            onClick={() => setFilters({ ...filters, volumeConfirmedOnly: !filters.volumeConfirmedOnly })}
            className={`w-full py-2 px-3 rounded-xl border font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
              filters.volumeConfirmedOnly
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Volume Spike Only</span>
          </button>
        </div>
      </div>

      {/* Table Results */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase font-mono tracking-wider">
              <tr>
                <th
                  onClick={() => {
                    setSortField('ticker');
                    setSortAsc(!sortAsc);
                  }}
                  className="px-4 py-3.5 cursor-pointer hover:text-white"
                >
                  <div className="flex items-center gap-1">
                    <span>Stock / Ticker</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => {
                    setSortField('price');
                    setSortAsc(!sortAsc);
                  }}
                  className="px-4 py-3.5 cursor-pointer hover:text-white"
                >
                  <div className="flex items-center gap-1">
                    <span>Current Price</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="px-4 py-3.5">Market Structure</th>
                <th className="px-4 py-3.5">Primary SMC Zone</th>
                <th className="px-4 py-3.5">Entry Zone (Long)</th>
                <th
                  onClick={() => {
                    setSortField('rr');
                    setSortAsc(!sortAsc);
                  }}
                  className="px-4 py-3.5 cursor-pointer hover:text-white"
                >
                  <div className="flex items-center gap-1">
                    <span>Risk : Reward</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="px-4 py-3.5">Volume Status</th>
                <th
                  onClick={() => {
                    setSortField('signal');
                    setSortAsc(!sortAsc);
                  }}
                  className="px-4 py-3.5 cursor-pointer hover:text-white"
                >
                  <div className="flex items-center gap-1">
                    <span>Setup Signal (Priority)</span>
                    <ArrowUpDown className="w-3 h-3 text-emerald-400" />
                  </div>
                </th>
                <th className="px-4 py-3.5 text-right">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/60 font-mono text-slate-200">
              {paginatedStocks.length > 0 ? (
                paginatedStocks.map((stock) => {
                  const rec = stock?.recommendation;
                  const currentPrice = stock?.currentPrice ?? 0;
                  const changePercent = stock?.changePercent24h ?? 0;
                  const zonePrice = rec?.primaryZonePrice ?? 0;
                  const entry0 = rec?.entryZone?.[0] ?? 0;
                  const entry1 = rec?.entryZone?.[1] ?? 0;
                  const rr = rec?.riskRewardRatio ?? 0;
                  const volRatio = rec?.volumeRatio ?? 1;
                  const statusText = rec?.status?.replace(/_/g, ' ') ?? '';

                  return (
                    <tr
                      key={stock.symbol}
                      onClick={() => {
                        const targetTicker = stock.ticker === '^JKSE' || stock.ticker === 'JKSE' ? 'IHSG' : stock.ticker;
                        window.open(`/analysis/${encodeURIComponent(targetTicker)}`, '_blank');
                        onSelectStock(stock);
                      }}
                      className="hover:bg-slate-800/60 transition-colors cursor-pointer group"
                    >
                      {/* Ticker & Name */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleWatchlist?.(stock.ticker);
                            }}
                            className="p-1 rounded-lg hover:bg-slate-700/60 transition-colors cursor-pointer"
                            title={
                              watchlist.includes(stock.ticker)
                                ? 'Remove from Watchlist'
                                : 'Add to Watchlist'
                            }
                          >
                            <Star
                              className={`w-4 h-4 ${
                                watchlist.includes(stock.ticker)
                                  ? 'text-amber-400 fill-amber-400'
                                  : 'text-slate-600 hover:text-amber-400'
                              }`}
                            />
                          </button>
                          <div className="relative">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-white text-sm group-hover:text-emerald-400 transition-colors">
                                {stock.ticker}
                              </span>
                              {topPickSet.has(stock.ticker) && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-amber-400 via-emerald-400 to-teal-300 text-slate-950 rounded-full shadow-lg shadow-emerald-500/20 ring-1 ring-amber-300/50 animate-pulse shrink-0">
                                  🔥 TOP PICK
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-sans truncate max-w-[140px]">
                              {stock.name}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Current Price */}
                      <td className="px-4 py-3.5 font-bold text-slate-100">
                        Rp {currentPrice.toLocaleString()}
                        <div
                          className={`text-[10px] font-semibold ${
                            changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {changePercent >= 0 ? '+' : ''}
                          {changePercent.toFixed(2)}%
                        </div>
                      </td>

                      {/* Structure */}
                      <td className="px-4 py-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            rec?.structure === 'RALLYING'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                          }`}
                        >
                          {rec?.structure ?? ''}
                        </span>
                      </td>

                      {/* Zone */}
                      <td className="px-4 py-3.5 text-slate-300 font-sans text-xs">
                        {rec?.primaryZoneType ?? ''} (Rp {zonePrice.toLocaleString()})
                      </td>

                      {/* Entry Area */}
                      <td className="px-4 py-3.5 text-slate-300">
                        {entry0.toLocaleString()} - {entry1.toLocaleString()}
                      </td>

                      {/* R:R Ratio */}
                      <td className="px-4 py-3.5">
                        <span className="font-bold text-teal-300">1 : {rr}</span>
                      </td>

                      {/* Volume Status */}
                      <td className="px-4 py-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            rec?.volumeConfirmation
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {rec?.volumeConfirmation ? `${volRatio}x Spike` : `${volRatio}x Neutral`}
                        </span>
                      </td>

                      {/* Signal */}
                      <td className="px-4 py-3.5">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase ${
                            rec?.status === 'TAPPED_POI_REBOUND'
                              ? 'bg-amber-500/30 text-amber-300 border border-amber-400 font-mono shadow-sm shadow-amber-500/20'
                              : rec?.status === 'ON_BUY_AREA' || (rec?.isOnBuyArea && rec?.status !== 'NO_ENTRY')
                              ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-400 font-mono shadow-sm shadow-emerald-500/20'
                              : rec?.status === 'NEAR_ENTRY'
                              ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-400 font-mono shadow-sm shadow-cyan-500/20'
                              : rec?.status === 'WAIT_FVG_CREATION'
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                              : rec?.status === 'WAIT_PULLBACK_FVG'
                              ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                              : rec?.status === 'STRONG_BUY_POI'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                              : rec?.status === 'SIDEWAYS_ACCUMULATION'
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {rec?.status === 'TAPPED_POI_REBOUND'
                            ? '🎯 RECENTLY TAPPED FVG/OB'
                            : rec?.status === 'ON_BUY_AREA' || rec?.isOnBuyArea
                            ? '🎯 IN BUY AREA'
                            : rec?.status === 'NEAR_ENTRY'
                            ? '📍 NEAR ENTRY (0-3%)'
                            : rec?.status === 'WAIT_FVG_CREATION'
                            ? '⏳ AWAITING FVG'
                            : rec?.status === 'WAIT_PULLBACK_FVG'
                            ? '📉 WAIT PULLBACK FVG'
                            : rec?.status === 'STRONG_BUY_POI'
                            ? '🔥 DISCOUNT POI'
                            : rec?.status === 'SIDEWAYS_ACCUMULATION'
                            ? '📦 SIDEWAYS ACCUMULATION'
                            : statusText}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3.5 text-right font-sans">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const targetTicker = stock.ticker === '^JKSE' || stock.ticker === 'JKSE' ? 'IHSG' : stock.ticker;
                            try {
                              window.history.pushState(null, '', `/analysis/${encodeURIComponent(targetTicker)}`);
                            } catch (err) {}
                            onSelectStock(stock);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <span>Analyze</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400 font-sans space-y-3">
                    <div>
                      No stocks match the current Smart Money filter criteria.
                    </div>
                    {filters.search.trim() && (
                      <button
                        onClick={handleFetchTicker}
                        disabled={isFetchingApi}
                        className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs inline-flex items-center gap-2 cursor-pointer transition-colors shadow-lg shadow-emerald-500/20"
                      >
                        <Zap className="w-4 h-4" />
                        <span>
                          {isFetchingApi
                            ? 'Fetching data from Yahoo Finance...'
                            : `Fetch & Analyze Ticker "${filters.search.toUpperCase()}" from IDX`}
                        </span>
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalItems > 0 && (
          <div className="bg-slate-950 border-t border-slate-800 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
            {/* Range info */}
            <div className="font-mono text-center sm:text-left">
              Showing <span className="font-bold text-slate-100">{startItemIndex} - {endItemIndex}</span> of{' '}
              <span className="font-bold text-emerald-400">{totalItems}</span> IDX Stocks
            </div>

            {/* Pagination controls */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              {/* Page size dropdown */}
              <div className="flex items-center gap-1.5">
                <span>Per Page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    const val = e.target.value === 'ALL' ? 'ALL' : parseInt(e.target.value, 10);
                    setPageSize(val);
                    setCurrentPage(1);
                  }}
                  className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-white font-mono focus:outline-none focus:border-emerald-500"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value="ALL">All</option>
                </select>
              </div>

              {/* Page buttons */}
              {pageSize !== 'ALL' && totalPages > 1 && (
                <div className="flex items-center gap-1 font-mono">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={safePage <= 1}
                    className="px-2.5 py-1 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Prev</span>
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-2.5 py-1 rounded-lg border text-xs font-bold transition-all ${
                        safePage === pageNum
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/20'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      {pageNum}
                    </button>
                  ))}

                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage >= totalPages}
                    className="px-2.5 py-1 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Fetching Market Data Modal for Screener */}
      {(isFetchingApi || isStockFetching) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-slate-900 border border-emerald-500/40 rounded-2xl p-6 shadow-2xl shadow-emerald-500/20 text-slate-100 relative overflow-hidden text-center">
            <div className="absolute -top-16 -left-16 w-32 h-32 bg-emerald-500/20 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-16 -right-16 w-32 h-32 bg-cyan-500/20 rounded-full blur-2xl pointer-events-none" />

            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto mb-4 shadow-inner">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>

            <h3 className="text-lg font-black text-white mb-1">
              Sinkronisasi Data Saham BEI ({fetchingTicker || filters.search.toUpperCase() || 'IDX'})
            </h3>
            <p className="text-xs text-slate-400 max-w-xs mx-auto mb-5 leading-relaxed">
              Sedang mengambil harga & candle historis dari API Pasar Saham Indonesia, serta memetakan indikator FVG, Order Block & Volume Confirmation...
            </p>

            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-[11px] font-mono text-emerald-300 flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Memproses SMC Indicator Engine...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
