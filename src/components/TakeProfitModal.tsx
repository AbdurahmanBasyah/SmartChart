import React, { useState } from 'react';
import {
  Target,
  X,
  TrendingUp,
  ShieldCheck,
  Zap,
  ArrowUpRight,
  Calculator,
  CheckCircle2,
  DollarSign,
  AlertTriangle,
  Layers,
  Sparkles,
} from 'lucide-react';
import { StockData } from '../types';

interface TakeProfitModalProps {
  isOpen: boolean;
  onClose: () => void;
  stock: StockData;
}

export const TakeProfitModal: React.FC<TakeProfitModalProps> = ({
  isOpen,
  onClose,
  stock,
}) => {
  if (!isOpen || !stock) return null;

  const rec = stock.recommendation;
  const currentPrice = stock.currentPrice || 100;
  const entryMin = rec?.entryZone?.[0] || currentPrice * 0.98;
  const entryMax = rec?.entryZone?.[1] || currentPrice;
  const baseEntry = Math.round((entryMin + entryMax) / 2);
  const sl = rec?.stopLoss || Math.round(baseEntry * 0.96);
  const riskAmount = Math.max(1, baseEntry - sl);

  // Targets calculation
  const tp1Price = rec?.takeProfit1 || Math.round(baseEntry * 1.10);
  const tp1Upside = (((tp1Price - baseEntry) / baseEntry) * 100).toFixed(1);
  const tp1Rr = ( (tp1Price - baseEntry) / riskAmount ).toFixed(1);

  const tp2Price = rec?.takeProfit2 || Math.round(baseEntry * 1.20);
  const tp2Upside = (((tp2Price - baseEntry) / baseEntry) * 100).toFixed(1);
  const tp2Rr = ( (tp2Price - baseEntry) / riskAmount ).toFixed(1);

  const tp3Price = Math.round(baseEntry * 1.35);
  const tp3Upside = (((tp3Price - baseEntry) / baseEntry) * 100).toFixed(1);
  const tp3Rr = ( (tp3Price - baseEntry) / riskAmount ).toFixed(1);

  // Interactive Capital & Lot Size Calculator
  const [lotInput, setLotInput] = useState<number>(50); // 50 Lots default

  const totalShares = lotInput * 100;
  const totalCapital = totalShares * baseEntry;
  const profitAtTp1 = totalShares * (tp1Price - baseEntry);
  const profitAtTp2 = totalShares * (tp2Price - baseEntry);
  const profitAtTp3 = totalShares * (tp3Price - baseEntry);
  const riskAtSl = totalShares * (baseEntry - sl);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 relative text-slate-100 space-y-6">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-start gap-3.5 border-b border-slate-800 pb-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-white">Take Profit Target Matrix</h2>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono text-xs font-bold border border-emerald-500/30">
                {stock.ticker}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Multi-tiered institutional profit targets based on SMC Liquidity Pool, Fair Value Gap (FVG), and Order Blocks.
            </p>
          </div>
        </div>

        {/* Quick Baseline Info */}
        <div className="grid grid-cols-3 gap-3 bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 text-xs font-mono">
          <div>
            <span className="text-[10px] text-slate-400 block">Baseline Entry</span>
            <strong className="text-white text-sm">Rp {baseEntry.toLocaleString()}</strong>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block">Stop Loss (SL)</span>
            <strong className="text-rose-400 text-sm">Rp {sl.toLocaleString()}</strong>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block">Current Market Price</span>
            <strong className="text-emerald-400 text-sm">Rp {currentPrice.toLocaleString()}</strong>
          </div>
        </div>

        {/* 3 Tier Take Profit Target Cards */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Target Price Levels & Execution Rules</span>
          </h3>

          {/* TP 1 */}
          <div className="bg-slate-950/90 border border-emerald-500/40 rounded-xl p-4 space-y-2 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-black text-xs font-mono">
                  TP 1 — Conservative
                </span>
                <span className="text-xs text-slate-400">Min. Target</span>
              </div>
              <div className="text-right font-mono">
                <span className="text-base font-black text-emerald-400">Rp {tp1Price.toLocaleString()}</span>
                <span className="text-xs text-emerald-300 font-bold ml-2">(+{tp1Upside}%)</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between text-xs text-slate-300 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/80 gap-2">
              <div className="flex items-center gap-1 text-[11px]">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span><strong>R:R:</strong> 1 : {tp1Rr}</span>
              </div>
              <div className="text-[11px] text-slate-300">
                <strong>Action:</strong> Jual <strong>40% - 50%</strong> lot, geser Stop Loss ke <strong>BEP</strong> (Risk-Free).
              </div>
            </div>
            <div className="text-[11px] text-slate-400">
              📌 <em>Rationale:</em> Menembus Buy-side Liquidity minor terdekat atau FVG rebound awal.
            </div>
          </div>

          {/* TP 2 */}
          <div className="bg-slate-950/90 border border-teal-500/40 rounded-xl p-4 space-y-2 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 font-black text-xs font-mono">
                  TP 2 — Optimal SMC
                </span>
                <span className="text-xs text-slate-400">Swing Target</span>
              </div>
              <div className="text-right font-mono">
                <span className="text-base font-black text-teal-300">Rp {tp2Price.toLocaleString()}</span>
                <span className="text-xs text-teal-300 font-bold ml-2">(+{tp2Upside}%)</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between text-xs text-slate-300 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/80 gap-2">
              <div className="flex items-center gap-1 text-[11px]">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-300 shrink-0" />
                <span><strong>R:R:</strong> 1 : {tp2Rr}</span>
              </div>
              <div className="text-[11px] text-slate-300">
                <strong>Action:</strong> Jual <strong>30% - 40%</strong> lot, aktifkan <strong>Trailing Stop</strong> di bawah Higher Low harian.
              </div>
            </div>
            <div className="text-[11px] text-slate-400">
              📌 <em>Rationale:</em> Rebalancing Unmitigated 1D Fair Value Gap / Higher Timeframe Supply Zone.
            </div>
          </div>

          {/* TP 3 */}
          <div className="bg-slate-950/90 border border-cyan-500/40 rounded-xl p-4 space-y-2 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-black text-xs font-mono">
                  TP 3 — Trend Runner
                </span>
                <span className="text-xs text-slate-400">Major Target</span>
              </div>
              <div className="text-right font-mono">
                <span className="text-base font-black text-cyan-300">Rp {tp3Price.toLocaleString()}</span>
                <span className="text-xs text-cyan-300 font-bold ml-2">(+{tp3Upside}%)</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between text-xs text-slate-300 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/80 gap-2">
              <div className="flex items-center gap-1 text-[11px]">
                <CheckCircle2 className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                <span><strong>R:R:</strong> 1 : {tp3Rr}</span>
              </div>
              <div className="text-[11px] text-slate-300">
                <strong>Action:</strong> Sisa <strong>10% - 20%</strong> runner dibiarkan mengikuti tren hingga terjadi CHoCH breakdown.
              </div>
            </div>
            <div className="text-[11px] text-slate-400">
              📌 <em>Rationale:</em> Expansion menuju major structural swing high / 52-week liquidity pool.
            </div>
          </div>
        </div>

        {/* Live Nominal Profit Calculator Simulation */}
        <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
              <Calculator className="w-4 h-4 text-emerald-400" />
              <span>Simulasi Nominal Profit (Rupiah)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Jumlah Lot:</span>
              <input
                type="number"
                min="1"
                max="10000"
                value={lotInput}
                onChange={(e) => setLotInput(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono w-20 text-center font-bold focus:outline-none focus:border-emerald-400"
              />
            </div>
          </div>

          <div className="text-[11px] text-slate-400 font-mono">
            Modal Beli: <strong className="text-white">Rp {totalCapital.toLocaleString()}</strong> ({lotInput} lot × 100 lembar @ Rp {baseEntry.toLocaleString()})
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs font-mono">
            <div className="bg-slate-900 border border-emerald-500/30 p-2.5 rounded-lg text-center">
              <span className="text-[10px] text-slate-400 block">Profit di TP1 (+{tp1Upside}%)</span>
              <strong className="text-emerald-400 text-sm block mt-0.5">
                +Rp {Math.round(profitAtTp1).toLocaleString()}
              </strong>
            </div>

            <div className="bg-slate-900 border border-teal-500/30 p-2.5 rounded-lg text-center">
              <span className="text-[10px] text-slate-400 block">Profit di TP2 (+{tp2Upside}%)</span>
              <strong className="text-teal-300 text-sm block mt-0.5">
                +Rp {Math.round(profitAtTp2).toLocaleString()}
              </strong>
            </div>

            <div className="bg-slate-900 border border-cyan-500/30 p-2.5 rounded-lg text-center">
              <span className="text-[10px] text-slate-400 block">Profit di TP3 (+{tp3Upside}%)</span>
              <strong className="text-cyan-300 text-sm block mt-0.5">
                +Rp {Math.round(profitAtTp3).toLocaleString()}
              </strong>
            </div>
          </div>

          <div className="text-[10px] text-rose-400/90 font-mono flex items-center gap-1.5 pt-1">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>Maksimum Risiko di Stop Loss: -Rp {Math.round(riskAtSl).toLocaleString()} (-{(((baseEntry - sl) / baseEntry) * 100).toFixed(1)}%)</span>
          </div>
        </div>

        {/* Modal Footer Button */}
        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
          >
            Tutup Matrix
          </button>
        </div>
      </div>
    </div>
  );
};
