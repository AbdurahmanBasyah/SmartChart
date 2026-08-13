import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  BarChart2,
  ArrowRight,
  ShieldCheck,
  Zap,
  Activity,
  Layers,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { StockData } from '../types';

interface IhsgMarketWidgetProps {
  ihsgStock?: StockData;
  onOpenChart: (ticker: string) => void;
  onUpdateIhsgData?: (liveData: StockData) => void;
}

export const IhsgMarketWidget: React.FC<IhsgMarketWidgetProps> = ({
  ihsgStock,
  onOpenChart,
  onUpdateIhsgData,
}) => {
  const [activeStock, setActiveStock] = useState<StockData | undefined>(ihsgStock);
  const [isLiveLoading, setIsLiveLoading] = useState<boolean>(false);

  useEffect(() => {
    if (ihsgStock) {
      setActiveStock(ihsgStock);
    }
  }, [ihsgStock]);

  // Lazy load real-time IHSG market data on mount
  useEffect(() => {
    let isMounted = true;
    async function fetchLiveIhsg() {
      setIsLiveLoading(true);
      try {
        let fresh: StockData | null = null;
        try {
          const res = await fetch('/api/stock/%5EJKSE');
          if (res.ok) {
            fresh = await res.json();
          } else {
            const res2 = await fetch('/api/stock?symbol=^JKSE');
            if (res2.ok) {
              fresh = await res2.json();
            }
          }
        } catch (e) {
          // fallback to client fetch
        }

        if (!fresh) {
          const { fetchYahooStockData } = await import('../services/yahooFinance');
          fresh = await fetchYahooStockData('^JKSE');
        }

        if (isMounted && fresh && fresh.candles && fresh.candles.length > 0) {
          setActiveStock(fresh);
          if (onUpdateIhsgData) {
            onUpdateIhsgData(fresh);
          }
        }
      } catch (err) {
        console.warn('Lazy loading IHSG market data error:', err);
      } finally {
        if (isMounted) setIsLiveLoading(false);
      }
    }

    fetchLiveIhsg();

    return () => {
      isMounted = false;
    };
  }, []);

  const displayStock = activeStock || ihsgStock;
  if (!displayStock) return null;

  const candles = displayStock.candles || [];
  const recentCandles = candles.slice(-35); // last 35 candles for mini chart
  const currentPrice = displayStock.currentPrice || 7350;
  const changePercent = displayStock.changePercent24h || 0.45;
  const rec = displayStock.recommendation;

  // Find min/max for SVG scaling
  const highs = recentCandles.map((c) => c.high);
  const lows = recentCandles.map((c) => c.low);
  const minPrice = Math.min(...lows, currentPrice * 0.97);
  const maxPrice = Math.max(...highs, currentPrice * 1.03);
  const range = maxPrice - minPrice || 1;

  const width = 600;
  const height = 180;
  const padding = 15;

  const getY = (val: number) =>
    height - padding - ((val - minPrice) / range) * (height - 2 * padding);

  const candleWidth = Math.max(3, (width - 2 * padding) / recentCandles.length - 3);

  // Get key SMC levels
  const primaryZone0 = rec?.entryZone?.[0] ?? Math.round(currentPrice * 0.98);
  const primaryZone1 = rec?.entryZone?.[1] ?? Math.round(currentPrice * 0.995);
  const tp1 = rec?.takeProfit1 ?? Math.round(currentPrice * 1.05);

  return (
    <div className="bg-slate-900/90 border border-slate-800 hover:border-emerald-500/40 rounded-2xl p-6 shadow-2xl relative overflow-hidden transition-all">
      {/* Background Accent Glow */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Lazy Load Glass Overlay Cover */}
      {isLiveLoading && (
        <div className="absolute inset-0 z-20 bg-slate-950/75 backdrop-blur-sm flex flex-col items-center justify-center gap-2 p-4 text-center animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-slate-900/90 border border-emerald-500/40 shadow-lg shadow-emerald-500/10">
            <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
            <span className="text-xs font-bold text-emerald-300 font-mono tracking-wide">
              Menyiapkan & Mengabaikan Data IHSG Real-Time...
            </span>
          </div>
          <p className="text-[11px] text-slate-400 max-w-xs">
            Menghubungkan ke API Pasar BEI & Memproses Indikator SMC
          </p>
        </div>
      )}

      {/* Top Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-black text-xl shadow-inner">
            🇮🇩
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-extrabold text-white">IHSG</h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono border border-slate-700 flex items-center gap-1.5">
                {isLiveLoading ? (
                  <>
                    <Loader2 className="w-3 h-3 text-emerald-400 animate-spin" />
                    <span>Syncing Data BEI...</span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>Data Close Market (Daily)</span>
                  </>
                )}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Indonesia Stock Exchange (IDX Composite Index)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-2xl font-black text-white font-mono">
              {currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div
              className={`text-xs font-bold font-mono flex items-center justify-end gap-1 ${
                changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {changePercent >= 0 ? '+' : ''}
              {changePercent.toFixed(2)}%
            </div>
          </div>

          <button
            onClick={() => onOpenChart(displayStock.ticker || '^JKSE')}
            className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 flex items-center gap-2 cursor-pointer transition-all hover:scale-105"
          >
            <BarChart2 className="w-4 h-4" />
            <span>Full IHSG Chart</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Grid: Mini SVG Chart + SMC Analysis Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Left 7 cols: SVG Mini Chart */}
        <div className="lg:col-span-7 bg-slate-950/80 border border-slate-800/80 rounded-xl p-4 relative">
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2 font-mono">
            <span className="flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span>IHSG SMC Mini Chart (Daily)</span>
            </span>
            <span className="text-emerald-400">
              Demand POI: {primaryZone0.toLocaleString()} - {primaryZone1.toLocaleString()}
            </span>
          </div>

          {/* SVG Canvas Chart */}
          <div className="w-full overflow-hidden">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
              {/* Grid Lines */}
              <line x1={0} y1={getY(primaryZone1)} x2={width} y2={getY(primaryZone1)} stroke="#10b981" strokeOpacity="0.25" strokeDasharray="3,3" />
              <line x1={0} y1={getY(primaryZone0)} x2={width} y2={getY(primaryZone0)} stroke="#10b981" strokeOpacity="0.25" strokeDasharray="3,3" />

              {/* Demand POI Zone Box */}
              <rect
                x={0}
                y={Math.min(getY(primaryZone0), getY(primaryZone1))}
                width={width}
                height={Math.abs(getY(primaryZone0) - getY(primaryZone1)) || 12}
                fill="#10b981"
                fillOpacity="0.12"
              />

              {/* Target TP Line */}
              <line x1={0} y1={getY(tp1)} x2={width} y2={getY(tp1)} stroke="#34d399" strokeOpacity="0.4" strokeDasharray="4,4" />
              <text x={width - 70} y={getY(tp1) - 4} fill="#34d399" fontSize="10" fontFamily="monospace">
                Target TP: {tp1.toLocaleString()}
              </text>

              {/* Candlesticks */}
              {recentCandles.map((c, i) => {
                const x = padding + i * ((width - 2 * padding) / recentCandles.length) + candleWidth / 2;
                const openY = getY(c.open);
                const closeY = getY(c.close);
                const highY = getY(c.high);
                const lowY = getY(c.low);
                const isBull = c.close >= c.open;
                const color = isBull ? '#10b981' : '#f43f5e';

                return (
                  <g key={i}>
                    {/* Wick */}
                    <line x1={x} y1={highY} x2={x} y2={lowY} stroke={color} strokeWidth="1" opacity="0.8" />
                    {/* Body */}
                    <rect
                      x={x - candleWidth / 2}
                      y={Math.min(openY, closeY)}
                      width={candleWidth}
                      height={Math.max(2, Math.abs(openY - closeY))}
                      fill={color}
                      rx="1"
                    />
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono mt-1">
            <span>35-Day History</span>
            <span className="text-slate-400">Demand Buy Zone Area (Transparent Green)</span>
          </div>
        </div>

        {/* Right 5 cols: SMC Quick Analysis Summary */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span>IHSG Smart Money Analysis Summary</span>
            </span>
            <span
              className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                rec?.structure === 'RALLYING'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
              }`}
            >
              Structure: {rec?.structure || 'RALLYING'}
            </span>
          </div>

          <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs">
            <div className="flex items-start gap-2 text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong className="text-white">Trend Structure:</strong> IHSG is in a{' '}
                <strong className="text-emerald-400">{rec?.structure === 'RALLYING' ? 'Bullish Uptrend' : 'Accumulation Consolidation'}</strong>{' '}
                holding above 20/60 MA Support.
              </span>
            </div>

            <div className="flex items-start gap-2 text-slate-300">
              <Layers className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
              <span>
                <strong className="text-white">Demand POI / FVG Zone:</strong> Key support range sits at index level{' '}
                <strong className="text-teal-300">
                  {primaryZone0.toLocaleString()} - {primaryZone1.toLocaleString()}
                </strong>.
              </span>
            </div>

            <div className="flex items-start gap-2 text-slate-300">
              <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <span>
                <strong className="text-white">Institutional Cash Flow:</strong> Candle closes demonstrate Smart Money buying resilience on Demand retest.
              </span>
            </div>

            <div className="flex items-start gap-2 text-slate-300">
              <TrendingUp className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                <strong className="text-white">Market Strategy:</strong> Focus on stocks with{' '}
                <strong className="text-amber-300 font-mono">Recently Tapped FVG/OB</strong> or <strong className="text-emerald-400 font-mono">On Buy Area</strong> status.
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80 font-mono">
            <span className="text-slate-400">IHSG Signal Status:</span>
            <span className="font-bold text-emerald-400">
              {rec?.status?.replace(/_/g, ' ') || 'ON BUY AREA'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
