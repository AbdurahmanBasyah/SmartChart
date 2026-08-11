import React from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import {
  TrendingUp,
  ShieldCheck,
  Zap,
  BarChart2,
  ArrowRight,
  Layers,
  Target,
  CheckCircle2,
  Sliders,
  ChevronRight,
  Activity,
} from 'lucide-react';
import { StockData } from '../types';
import { IhsgMarketWidget } from './IhsgMarketWidget';

interface ParallaxHeroProps {
  onStartChart: (stockTicker?: string) => void;
  onOpenScreener: () => void;
  stocks: StockData[];
}

export const ParallaxHero: React.FC<ParallaxHeroProps> = ({
  onStartChart,
  onOpenScreener,
  stocks,
}) => {
  const { scrollY } = useScroll();
  const backgroundY = useTransform(scrollY, [0, 500], [0, 150]);
  const textY = useTransform(scrollY, [0, 500], [0, -50]);

  const brptStock = stocks.find((s) => s.ticker === 'BRPT') || stocks[0];
  const ihsgStock =
    stocks.find(
      (s) =>
        s.ticker === '^JKSE' ||
        s.ticker === 'IHSG' ||
        s.ticker === 'JKSE' ||
        s.name.toLowerCase().includes('ihsg')
    ) || stocks[0];

  return (
    <div className="relative overflow-hidden bg-slate-950 text-slate-100 min-h-screen pb-16">
      {/* Dynamic Background Motion Elements */}
      <motion.div
        style={{ y: backgroundY }}
        className="absolute inset-0 opacity-20 pointer-events-none"
      >
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-teal-500/20 rounded-full blur-3xl" />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px)`,
            backgroundSize: '32px 32px',
          }}
        />
      </motion.div>

      {/* Hero Section */}
      <section className="relative pt-12 lg:pt-20 pb-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div style={{ y: textY }} className="text-center max-w-4xl mx-auto">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold mb-6 shadow-inner"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Smart Money Concepts (SMC) Trading Engine — Indonesia Stocks (IDX)</span>
          </motion.div>

          {/* Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight text-white mb-6"
          >
            Institutional Precision Trading with{' '}
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
              Smart Money Overlay
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-3xl mx-auto mb-8 font-normal"
          >
            Automated mapping of <strong className="text-emerald-400">Point of Interest (POI)</strong>,{' '}
            <strong className="text-teal-300">Fair Value Gap (FVG)</strong>,{' '}
            <strong className="text-white">Break of Structure (BOS)</strong>,{' '}
            <strong className="text-white">Change of Character (CHoCH)</strong>, and{' '}
            <strong className="text-emerald-400">Liquidity Sweeps</strong> with real-time volume confirmation filters.
          </motion.p>

          {/* CTA Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-wrap items-center justify-center gap-4 mb-12"
          >
            <button
              onClick={() => onStartChart(brptStock?.ticker)}
              className="px-6 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm shadow-xl shadow-emerald-500/25 flex items-center gap-2 transition-all cursor-pointer hover:scale-105 active:scale-95"
            >
              <BarChart2 className="w-4 h-4" />
              <span>Open Interactive Chart ({brptStock?.ticker})</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={onOpenScreener}
              className="px-6 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold text-sm flex items-center gap-2 transition-all cursor-pointer"
            >
              <Sliders className="w-4 h-4 text-emerald-400" />
              <span>SMC Screener Radar</span>
            </button>
          </motion.div>

          {/* Core Rules Badges */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto text-left"
          >
            <div className="bg-slate-900/90 border border-slate-800/80 p-3.5 rounded-xl">
              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">
                Trading Position
              </div>
              <div className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Always LONG</span>
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800/80 p-3.5 rounded-xl">
              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">
                Min Risk Reward
              </div>
              <div className="text-sm font-bold text-teal-300 font-mono">1 : 1.5+ R:R</div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800/80 p-3.5 rounded-xl">
              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">
                Target Profit (TP)
              </div>
              <div className="text-sm font-bold text-white font-mono">10% - 20%</div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800/80 p-3.5 rounded-xl">
              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">
                Stop Loss (SL)
              </div>
              <div className="text-sm font-bold text-rose-400 font-mono">3% - 5%</div>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* IHSG Market Overview & Quick SMC Analysis Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <IhsgMarketWidget ihsgStock={ihsgStock} onOpenChart={(ticker) => onStartChart(ticker)} />
      </section>

      {/* Interactive SMC Strategy Breakdown */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-black text-white">
            SMC Strategy Decision Making Logic
          </h2>
          <p className="text-slate-400 text-sm mt-2 max-w-2xl mx-auto">
            Automatically adapts strategies based on technical trend conditions of Indonesian stocks
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Strategy 1: Rallying Stock */}
          <motion.div
            whileHover={{ y: -4 }}
            className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 relative overflow-hidden shadow-xl"
          >
            <div className="absolute top-0 right-0 px-4 py-1.5 bg-emerald-500/20 text-emerald-400 text-[11px] font-bold rounded-bl-xl border-l border-b border-emerald-500/30">
              Rallying Stock Setup
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Rallying Stock (Uptrend)</h3>
                <p className="text-xs text-slate-400">Continuous HH & HL structure formation</p>
              </div>
            </div>

            <ul className="space-y-3 text-xs text-slate-300 mb-6">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Core Rule:</strong> Waiting for a healthy pullback into <strong className="text-emerald-300">Fair Value Gap (FVG)</strong> or Order Block zones.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Validation Requirement:</strong> Pullback <strong className="text-white">MUST NOT</strong> create a new Lower Low (LL).
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Entry Confirmation:</strong> Followed by a buying volume spike (&gt;1.3x 20-MA) on FVG bounce.
                </span>
              </li>
            </ul>

            <button
              onClick={() => onStartChart(brptStock?.ticker)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <span>View Rally Chart Example ({brptStock?.ticker})</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </motion.div>

          {/* Strategy 2: Sideways Stock */}
          <motion.div
            whileHover={{ y: -4 }}
            className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 relative overflow-hidden shadow-xl"
          >
            <div className="absolute top-0 right-0 px-4 py-1.5 bg-cyan-500/20 text-cyan-400 text-[11px] font-bold rounded-bl-xl border-l border-b border-cyan-500/30">
              Sideways Stock Setup
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Consolidating Stock (Sideways)</h3>
                <p className="text-xs text-slate-400">Price moves within horizontal accumulation range</p>
              </div>
            </div>

            <ul className="space-y-3 text-xs text-slate-300 mb-6">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Core Rule:</strong> Waiting for precise retest in <strong className="text-cyan-300">Fair Value Gap</strong>, <strong className="text-cyan-300">Order Block (Demand Zone)</strong>, or strong Support bounds.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Risk Management:</strong> Tight Stop Loss placed below Demand zone (3% - 5%).
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Target Profit:</strong> Min TP1 +10% and TP2 +20% to maintain R:R ratio &gt;= 1:1.5.
                </span>
              </li>
            </ul>

            <button
              onClick={() => onStartChart('BBCA')}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <span>View Sideways Chart Example (BBCA)</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </motion.div>
        </div>
      </section>

      {/* Featured Stock Spotlight Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-400" />
              <span>IDX Stocks with Active Smart Money Setup</span>
            </h3>
            <p className="text-xs text-slate-400">Updated based on the latest SMC technical algorithms</p>
          </div>
          <button
            onClick={onOpenScreener}
            className="text-xs text-emerald-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
          >
            <span>View All Stocks</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stocks.slice(0, 4).map((s) => (
            <div
              key={s.symbol}
              onClick={() => onStartChart(s.ticker)}
              className="bg-slate-900/90 border border-slate-800 hover:border-emerald-500/50 rounded-2xl p-4 cursor-pointer transition-all hover:scale-[1.02] shadow-lg group"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-black text-lg text-white group-hover:text-emerald-400 transition-colors">
                  {s.ticker}
                </span>
                <span className="text-xs font-mono text-slate-300 font-bold">
                  Rp {(s.currentPrice ?? 0).toLocaleString()}
                </span>
              </div>
              <div className="text-xs text-slate-400 truncate mb-3">{s.name}</div>

              <div className="space-y-1.5 text-[11px] bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/60 font-mono mb-3">
                <div className="flex justify-between text-slate-300">
                  <span>Structure:</span>
                  <span className="text-emerald-400 font-bold">{s.recommendation?.structure ?? ''}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Entry Zone:</span>
                  <span className="text-slate-200">
                    {(s.recommendation?.entryZone?.[0] ?? 0).toLocaleString()} - {(s.recommendation?.entryZone?.[1] ?? 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Risk : Reward:</span>
                  <span className="text-teal-300 font-bold">1 : {s.recommendation?.riskRewardRatio ?? 0}</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">
                  {s.recommendation?.status?.replace(/_/g, ' ') ?? ''}
                </span>
                <span className="text-slate-400 font-medium">Click Chart →</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
