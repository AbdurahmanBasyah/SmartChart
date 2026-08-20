import React from 'react';
import {
  Waves,
  TrendingUp,
  AlertOctagon,
  ShieldCheck,
  Target,
  Activity,
  CheckCircle2,
  Info,
  Layers,
  ArrowRight,
  TrendingDown,
} from 'lucide-react';
import { ElliottWaveAnalysis, StockData } from '../types';

interface ElliottWaveCardProps {
  stock: StockData;
}

export const ElliottWaveCard: React.FC<ElliottWaveCardProps> = ({ stock }) => {
  const ew = stock?.elliottWave;

  if (!ew) return null;

  const isImpulse = ew.phase === 'IMPULSE';
  const inv = ew.invalidationLevel;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
            <Waves className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <span>Elliott Wave Principle & Cycle Analysis</span>
            </div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2 mt-0.5">
              <span>{ew.waveLabel}</span>
              <span
                className={`text-[11px] px-2.5 py-0.5 rounded-full font-mono font-black uppercase tracking-wider border ${
                  isImpulse
                    ? 'bg-sky-500/20 text-sky-400 border-sky-500/40'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                }`}
              >
                {ew.phase} PHASE
              </span>
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400 font-mono">Possibility Confidence:</span>
          <span
            className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border ${
              ew.probability === 'VERY HIGH'
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                : ew.probability === 'HIGH'
                ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
            }`}
          >
            {ew.probability}
          </span>
        </div>
      </div>

      {/* Summary Narrative */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-200 leading-relaxed flex items-start gap-2.5">
        <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
        <div>
          <p>{ew.summary}</p>
        </div>
      </div>

      {/* Key Invalidation & Targets Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Invalidation Level (Level Batal) */}
        {inv && (
          <div className="bg-slate-950/80 border border-rose-500/30 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-semibold text-rose-400 uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <AlertOctagon className="w-4 h-4 text-rose-400" />
                <span>Level Batal (Invalidation Level)</span>
              </span>
              <span className="font-mono text-xs font-bold text-rose-400">
                {inv.percentFromCurrent >= 0 ? '+' : ''}
                {inv.percentFromCurrent}%
              </span>
            </div>
            <div className="text-xl font-black text-white font-mono">
              Rp {inv.price.toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
              {inv.description}
            </p>
          </div>
        )}

        {/* Projected Fibonacci Target */}
        <div className="bg-slate-950/80 border border-emerald-500/30 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Target className="w-4 h-4 text-emerald-400" />
              <span>Target Fibonacci Utama</span>
            </span>
            {ew.projectedTargets?.[0] && (
              <span className="font-mono text-xs font-bold text-emerald-400">
                +{ew.projectedTargets[0].percentGain}%
              </span>
            )}
          </div>
          {ew.projectedTargets?.[0] ? (
            <>
              <div className="text-xl font-black text-emerald-400 font-mono">
                Rp {ew.projectedTargets[0].targetPrice.toLocaleString()}
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                <strong className="text-white">{ew.projectedTargets[0].ratioLabel}:</strong>{' '}
                {ew.projectedTargets[0].description}
              </p>
            </>
          ) : (
            <div className="text-xs text-slate-400">Target terkonfirmasi pada area supply major.</div>
          )}
        </div>
      </div>

      {/* Fibonacci Targets Matrix */}
      {ew.projectedTargets && ew.projectedTargets.length > 0 && (
        <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 space-y-3">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Target className="w-4 h-4 text-cyan-400" />
            <span>Fibonacci Projection & Target Matrix</span>
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {ew.projectedTargets.map((target, idx) => (
              <div
                key={idx}
                className="bg-slate-900/90 border border-slate-800/80 rounded-lg p-3 space-y-1 hover:border-cyan-500/40 transition-colors"
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-cyan-300">{target.ratioLabel}</span>
                  <span
                    className={`font-mono font-bold text-[10px] ${
                      target.percentGain >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {target.percentGain >= 0 ? '+' : ''}
                    {target.percentGain}%
                  </span>
                </div>
                <div className="text-base font-black text-white font-mono">
                  Rp {target.targetPrice.toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-400 leading-tight font-sans">
                  {target.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Elliott Wave Principles & Strict Rules Compliance Checklist */}
      <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 space-y-3">
        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Aturan & Validasi Elliott Wave (Rules Compliance)</span>
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {ew.rules.map((rule, idx) => (
            <div
              key={idx}
              className="bg-slate-900/90 border border-slate-800/70 rounded-lg p-3 flex items-start gap-2.5"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-slate-100">{rule.rule}</div>
                <div className="text-[11px] text-slate-300 leading-relaxed font-sans">
                  {rule.note}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
