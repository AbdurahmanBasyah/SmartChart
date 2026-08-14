import React, { useRef, useState, useEffect } from 'react';
import { motion, useScroll, useTransform, useMotionValue, useSpring } from 'motion/react';
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
  Box,
  Compass,
  Sparkles,
} from 'lucide-react';
import { StockData } from '../types';
import { IhsgMarketWidget } from './IhsgMarketWidget';

// --- 3D Interactive SMC Candlestick Model Canvas Component ---
const Interactive3dSmcModel: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let angle = 0;

    const render = () => {
      angle += 0.012;
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2 + 10;

      // Draw glowing 3D floor grid with perspective
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.15)';
      ctx.lineWidth = 1;
      for (let i = -5; i <= 5; i++) {
        const x1 = centerX + i * 28 + Math.sin(angle) * 15;
        const y1 = centerY + 90;
        const x2 = centerX + i * 55 + Math.sin(angle) * 30;
        const y2 = centerY + 180;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      // 3D Floating Demand OrderBlock Zone (Purple/Teal Box)
      const obY = centerY + 40 + Math.sin(angle * 1.5) * 8;
      const obWidth = 180;
      const obHeight = 28;
      const obDepth = 40;

      ctx.fillStyle = 'rgba(168, 85, 247, 0.22)';
      ctx.strokeStyle = 'rgba(192, 132, 252, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(centerX - obWidth / 2, obY, obWidth, obHeight, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = 'rgba(192, 132, 252, 0.9)';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('DEMAND ORDER BLOCK (POI)', centerX, obY + 18);

      // 3D Floating FVG Zone (Green Box)
      const fvgY = centerY - 30 + Math.cos(angle * 1.5) * 8;
      ctx.fillStyle = 'rgba(16, 185, 129, 0.18)';
      ctx.strokeStyle = 'rgba(52, 211, 153, 0.7)';
      ctx.beginPath();
      ctx.roundRect(centerX - 130, fvgY, 260, 24, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#34d399';
      ctx.font = 'bold 10px monospace';
      ctx.fillText('1D FAIR VALUE GAP (FVG)', centerX, fvgY + 16);

      // 3D Metallic Bullish Candlesticks
      const candleData = [
        { offset: -90, open: 60, close: 20, high: 10, low: 75, isBull: true },
        { offset: -45, open: 35, close: 55, high: 25, low: 70, isBull: false },
        { offset: 0, open: 65, close: 15, high: 5, low: 80, isBull: true },
        { offset: 45, open: 25, close: -20, high: -30, low: 35, isBull: true },
        { offset: 90, open: -15, close: -65, high: -75, low: 0, isBull: true },
      ];

      candleData.forEach((c) => {
        const x = centerX + c.offset;
        const floatShift = Math.sin(angle + c.offset * 0.02) * 5;

        const openY = centerY + c.open + floatShift;
        const closeY = centerY + c.close + floatShift;
        const highY = centerY + c.high + floatShift;
        const lowY = centerY + c.low + floatShift;

        const bodyTop = Math.min(openY, closeY);
        const bodyH = Math.max(8, Math.abs(openY - closeY));
        const color = c.isBull ? '#10b981' : '#f43f5e';
        const glowColor = c.isBull ? 'rgba(16, 185, 129, 0.6)' : 'rgba(244, 63, 94, 0.6)';

        // Wick
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, highY);
        ctx.lineTo(x, lowY);
        ctx.stroke();

        // Candle Body
        ctx.fillStyle = color;
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 12;
        ctx.fillRect(x - 10, bodyTop, 20, bodyH);
        ctx.shadowBlur = 0;

        // 3D Bevel Edge
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(x - 10, bodyTop, 3, bodyH);
      });

      // Break of Structure Line (BOS)
      const bosY = centerY - 50 + Math.sin(angle) * 4;
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(centerX - 120, bosY);
      ctx.lineTo(centerX + 120, bosY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 9px monospace';
      ctx.fillText('BOS (Break of Structure)', centerX + 60, bosY - 6);

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="relative w-full max-w-lg mx-auto aspect-[4/3] flex items-center justify-center">
      <canvas
        ref={canvasRef}
        width={420}
        height={320}
        className="w-full h-full object-contain drop-shadow-[0_20px_35px_rgba(16,185,129,0.2)]"
      />
    </div>
  );
};

interface ParallaxHeroProps {
  onStartChart: (stockTicker?: string) => void;
  onOpenScreener: () => void;
  stocks: StockData[];
  onUpdateIhsgData?: (liveData: StockData) => void;
}

export const ParallaxHero: React.FC<ParallaxHeroProps> = ({
  onStartChart,
  onOpenScreener,
  stocks,
  onUpdateIhsgData,
}) => {
  const { scrollY } = useScroll();
  const backgroundY = useTransform(scrollY, [0, 500], [0, 150]);
  const textY = useTransform(scrollY, [0, 500], [0, -40]);
  const modelY = useTransform(scrollY, [0, 500], [0, 60]);

  // 3D Parallax Mouse Tilt state
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [12, -12]), {
    stiffness: 120,
    damping: 20,
  });
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-12, 12]), {
    stiffness: 120,
    damping: 20,
  });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    mouseX.set(x);
    mouseY.set(y);
  };

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
    <div
      onMouseMove={handleMouseMove}
      className="relative overflow-hidden bg-slate-950 text-slate-100 min-h-screen pb-16 perspective-1000"
    >
      {/* Dynamic Parallax Background Orbs */}
      <motion.div
        style={{ y: backgroundY }}
        className="absolute inset-0 opacity-30 pointer-events-none"
      >
        <div className="absolute top-10 left-10 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/3 right-10 w-96 h-96 bg-teal-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-1/3 w-80 h-80 bg-cyan-500/15 rounded-full blur-3xl" />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(rgba(16, 185, 129, 0.12) 1px, transparent 1px)`,
            backgroundSize: '36px 36px',
          }}
        />
      </motion.div>

      {/* Hero Section */}
      <section className="relative pt-10 lg:pt-16 pb-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Hero Text Column */}
          <motion.div style={{ y: textY }} className="lg:col-span-7 text-left">
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
              className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl mb-8 font-normal"
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
              className="flex flex-wrap items-center gap-4 mb-10"
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
              className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left"
            >
              <div className="bg-slate-900/90 border border-slate-800/80 p-3 rounded-xl">
                <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">
                  Trading Position
                </div>
                <div className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Always LONG</span>
                </div>
              </div>

              <div className="bg-slate-900/90 border border-slate-800/80 p-3 rounded-xl">
                <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">
                  Min Risk Reward
                </div>
                <div className="text-xs font-bold text-teal-300 font-mono">1 : 1.5+ R:R</div>
              </div>

              <div className="bg-slate-900/90 border border-slate-800/80 p-3 rounded-xl">
                <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">
                  Target Profit
                </div>
                <div className="text-xs font-bold text-white font-mono">10% - 20%</div>
              </div>

              <div className="bg-slate-900/90 border border-slate-800/80 p-3 rounded-xl">
                <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">
                  Stop Loss (SL)
                </div>
                <div className="text-xs font-bold text-rose-400 font-mono">3% - 5%</div>
              </div>
            </motion.div>
          </motion.div>

          {/* Right Column: 3D Interactive Model Showcase with Mouse Parallax Tilt */}
          <motion.div style={{ y: modelY }} className="lg:col-span-5 flex justify-center items-center">
            <motion.div
              style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
              className="w-full bg-transparent border-0 p-0 sm:p-2 relative overflow-hidden flex items-center justify-center"
            >
              {/* 3D Canvas Rendering */}
              <Interactive3dSmcModel />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* IHSG Market Overview & Quick SMC Analysis Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <IhsgMarketWidget
          ihsgStock={ihsgStock}
          onOpenChart={(ticker) => onStartChart(ticker)}
          onUpdateIhsgData={onUpdateIhsgData}
        />
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
