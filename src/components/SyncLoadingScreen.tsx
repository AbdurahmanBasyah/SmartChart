import React, { useEffect, useState } from 'react';
import {
  Cpu,
  Database,
  Activity,
  CheckCircle2,
  TrendingUp,
  Sparkles,
  Layers,
  ArrowRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SyncLoadingScreenProps {
  progress: number; // 0 to 100
  totalStocks: number;
  syncedCount: number;
  currentTicker: string;
  syncedTickers: string[];
  isComplete: boolean;
  onContinue: () => void;
}

export const SyncLoadingScreen: React.FC<SyncLoadingScreenProps> = ({
  progress,
  totalStocks,
  syncedCount,
  currentTicker,
  syncedTickers,
  isComplete,
  onContinue,
}) => {
  const [showSkipButton, setShowSkipButton] = useState(false);

  // Show manual continue/skip button after 3.5 seconds as a safe fallback for slow networks
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSkipButton(true);
    }, 3500);
    return () => clearTimeout(timer);
  }, []);

  const getStatusText = (prog: number) => {
    if (prog < 20) return 'Menginisialisasi SMC Algorithmic Engine...';
    if (prog < 45) return 'Mengunduh candlestick feed 1-tahun BEI / IDX...';
    if (prog < 70) return 'Mendeteksi Order Blocks (OB) & Fair Value Gaps (FVG)...';
    if (prog < 90) return 'Menghitung POI, Break of Structure & CHoCH...';
    if (prog < 100) return 'Memverifikasi SMC Screener & Kalkulasi R:R...';
    return 'Sinkronisasi Pasar Selesai! Menyiapkan Dashboard...';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 backdrop-blur-xl p-4 overflow-hidden select-none">
      {/* Background Subtle Tech Glow */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.3 } }}
        className="max-w-lg w-full bg-slate-900/90 border border-slate-800/90 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden space-y-6"
      >
        {/* Top Header Branding */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
              <Activity className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white tracking-wide">
                  SMC Market Engine
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono text-[10px] font-bold border border-emerald-500/30">
                  LIVE SYNC
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Memuat data pasar aktual & menghitung setup Smart Money Concepts
              </p>
            </div>
          </div>
        </div>

        {/* Progress Bar & Percentage */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-slate-300 font-semibold flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
              <span>{getStatusText(progress)}</span>
            </span>
            <span className="text-emerald-400 font-bold text-sm">{Math.round(progress)}%</span>
          </div>

          {/* Glowing Animated Progress Bar */}
          <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800 relative">
            <motion.div
              className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 rounded-full shadow-[0_0_12px_rgba(16,185,129,0.5)]"
              style={{ width: `${Math.max(8, progress)}%` }}
              transition={{ ease: 'easeOut', duration: 0.2 }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-1">
            <span>
              Tersinkronisasi: <strong className="text-white font-bold">{syncedCount}</strong> dari {totalStocks} saham utama
            </span>
            {currentTicker && (
              <span className="text-cyan-400 font-bold flex items-center gap-1">
                <Zap className="w-3 h-3" />
                <span>Memproses: {currentTicker}</span>
              </span>
            )}
          </div>
        </div>

        {/* Dynamic Synced Stock Chips Stream */}
        <div className="space-y-2">
          <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Database className="w-3.5 h-3.5 text-slate-400" />
              <span>Verifikasi Data Real-Time:</span>
            </span>
            <span className="text-[10px] text-emerald-400 font-mono">
              Yahoo Finance IDX Feed
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-2 bg-slate-950/70 rounded-xl border border-slate-800/80">
            {syncedTickers.slice(-16).map((ticker) => (
              <motion.span
                key={ticker}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="px-2 py-1 rounded-lg bg-emerald-950/50 border border-emerald-500/30 text-emerald-300 font-mono text-[10px] font-bold flex items-center gap-1 shrink-0"
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>{ticker}</span>
              </motion.span>
            ))}

            {syncedTickers.length === 0 && (
              <div className="text-xs text-slate-500 italic p-1">
                Menghubungkan ke server data bursa...
              </div>
            )}
          </div>
        </div>

        {/* Feature Highlights while loading */}
        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-300">
          <div className="bg-slate-950/50 p-2 rounded-xl border border-slate-800/60 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>IDX Live Candlestick Feed</span>
          </div>
          <div className="bg-slate-950/50 p-2 rounded-xl border border-slate-800/60 flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>Kalkulasi SMC Otomatis</span>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-2">
          {isComplete ? (
            <button
              onClick={onContinue}
              className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/25 cursor-pointer"
            >
              <span>Buka SMC Screener & Chart</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : showSkipButton ? (
            <button
              onClick={onContinue}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
            >
              <span>Lanjutkan ke Dashboard (Sinkronisasi di Background)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div className="text-center text-[11px] text-slate-500 font-mono animate-pulse py-1">
              Mohon tunggu sejenak, mengompilasi algoritma Smart Money...
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
