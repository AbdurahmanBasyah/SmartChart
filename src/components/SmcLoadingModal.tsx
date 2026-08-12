import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Database,
  BarChart3,
  Cpu,
  CheckCircle2,
  Zap,
  TrendingUp,
  ShieldCheck,
  Compass,
} from 'lucide-react';

interface SmcLoadingModalProps {
  isOpen: boolean;
  ticker: string;
}

const STEPS = [
  {
    id: 1,
    title: 'Fetching Market OHLCV Data',
    sub: 'Connecting to Market API & Fetching Real-time IDX Candle Data',
    icon: Database,
  },
  {
    id: 2,
    title: 'Calculating Indicators & Volume Ratio',
    sub: 'Computing 20-MA Volume Average & Quantitative Institutional Spike Filters',
    icon: BarChart3,
  },
  {
    id: 3,
    title: 'Mapping SMC Engine Structure',
    sub: 'Detecting Swing HH/HL/LH/LL, BOS & CHoCH Lines, Demand Order Blocks, and FVGs',
    icon: Cpu,
  },
  {
    id: 4,
    title: 'Generating Trading Plan & Roadmap',
    sub: 'Creating Take Profit (10%-20%), Stop Loss (3%-5%), and SMC Projections',
    icon: Compass,
  },
];

export const SmcLoadingModal: React.FC<SmcLoadingModalProps> = ({ isOpen, ticker }) => {
  const [currentStep, setCurrentStep] = useState<number>(1);

  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(1);
      return;
    }

    // Step progression timer
    const t1 = setTimeout(() => setCurrentStep(2), 600);
    const t2 = setTimeout(() => setCurrentStep(3), 1200);
    const t3 = setTimeout(() => setCurrentStep(4), 1800);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-lg bg-slate-900 border border-emerald-500/30 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-emerald-500/10 text-slate-100 relative overflow-hidden"
        >
          {/* Top Background Glow */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />

          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-6">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Zap className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="text-xs font-bold text-emerald-400 uppercase tracking-widest">
                  SMC Market Processing Engine
                </div>
                <div className="text-base font-black text-white flex items-center gap-2">
                  <span>Loading Stock</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono text-sm">
                    {ticker || 'IDX'}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 uppercase font-mono block">Progress</span>
              <span className="text-sm font-bold font-mono text-emerald-400">
                {Math.min(100, Math.round((currentStep / 4) * 100))}%
              </span>
            </div>
          </div>

          {/* 4 Interactive Node Circles Progress Bar */}
          <div className="relative mb-8 px-2">
            {/* Connecting Bar Line */}
            <div className="absolute top-4 left-6 right-6 h-1 bg-slate-800 -z-0 rounded-full" />
            <motion.div
              className="absolute top-4 left-6 h-1 bg-gradient-to-r from-emerald-500 to-cyan-400 -z-0 rounded-full"
              initial={{ width: '0%' }}
              animate={{ width: `${((currentStep - 1) / 3) * 100}%` }}
              transition={{ duration: 0.4 }}
            />

            {/* 4 Step Nodes */}
            <div className="flex items-center justify-between relative z-10">
              {STEPS.map((step) => {
                const isDone = currentStep > step.id;
                const isCurrent = currentStep === step.id;

                return (
                  <div key={step.id} className="flex flex-col items-center">
                    <motion.div
                      animate={isCurrent ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                      transition={isCurrent ? { repeat: Infinity, duration: 1.2 } : {}}
                      className={`w-9 h-9 rounded-full flex items-center justify-center font-mono font-bold text-xs transition-all ${
                        isDone
                          ? 'bg-emerald-500 text-slate-950 border-2 border-emerald-400 shadow-md shadow-emerald-500/30'
                          : isCurrent
                          ? 'bg-slate-900 border-2 border-cyan-400 text-cyan-300 shadow-lg shadow-cyan-400/30'
                          : 'bg-slate-950 border border-slate-800 text-slate-500'
                      }`}
                    >
                      {isDone ? (
                        <CheckCircle2 className="w-5 h-5 text-slate-950 stroke-[3]" />
                      ) : (
                        step.id
                      )}
                    </motion.div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step Detail Cards */}
          <div className="space-y-3">
            {STEPS.map((step) => {
              const isDone = currentStep > step.id;
              const isCurrent = currentStep === step.id;
              const Icon = step.icon;

              return (
                <div
                  key={step.id}
                  className={`p-3.5 rounded-xl border transition-all flex items-start gap-3.5 ${
                    isCurrent
                      ? 'bg-slate-800/90 border-cyan-500/50 text-white shadow-lg shadow-cyan-500/5 scale-[1.02]'
                      : isDone
                      ? 'bg-slate-950/60 border-slate-800/80 text-slate-300 opacity-90'
                      : 'bg-slate-950/30 border-slate-900/50 text-slate-600'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                      isCurrent
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/30'
                        : isDone
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-slate-900 text-slate-600'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-bold truncate">
                        Step {step.id}: {step.title}
                      </div>
                      {isCurrent && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono animate-pulse">
                          Processing...
                        </span>
                      )}
                      {isDone && (
                        <span className="text-[10px] font-mono text-emerald-400 font-semibold">
                          Done
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 leading-relaxed truncate">
                      {step.sub}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer Note */}
          <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Validasi Aturan SMC Body Close</span>
            </span>
            <span className="text-slate-400">BEI (IDX) Data Sync</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
