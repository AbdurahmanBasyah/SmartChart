import React, { useState } from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  ArrowUpRight,
  Zap,
  Target,
  DollarSign,
  Calculator,
  SlidersHorizontal,
  ChevronRight,
  Layers,
  HelpCircle,
  Compass,
  GitBranch,
  ArrowRight,
} from 'lucide-react';
import { StockData, TradeRecommendation } from '../types';

interface RecommendationPanelProps {
  stock: StockData;
}

export const RecommendationPanel: React.FC<RecommendationPanelProps> = ({ stock }) => {
  const rec = stock?.recommendation;

  // Position Sizing Interactive Calculator
  const [capitalInput, setCapitalInput] = useState<number>(50000000); // Rp 50 Juta
  const [riskPercent, setRiskPercent] = useState<number>(2); // 2% risk per trade

  // Position Math
  const maxRiskAmount = (capitalInput * riskPercent) / 100;
  const entryPrice = rec?.entryZone?.[1] ?? stock?.currentPrice ?? 0;
  const slPrice = rec?.stopLoss ?? (entryPrice * 0.96);
  const riskPerShare = Math.max(1, entryPrice - slPrice);

  const totalSharesToBuy = Math.floor(maxRiskAmount / riskPerShare);
  const totalLotsToBuy = Math.floor(totalSharesToBuy / 100);
  const totalCapitalRequired = totalLotsToBuy * 100 * entryPrice;

  const potentialProfitTp1 = totalLotsToBuy * 100 * ((rec?.takeProfit1 ?? entryPrice * 1.1) - entryPrice);
  const potentialProfitTp2 = totalLotsToBuy * 100 * ((rec?.takeProfit2 ?? entryPrice * 1.2) - entryPrice);

  const statusStr = rec?.status?.replace(/_/g, ' ') ?? 'NEUTRAL';
  const entryZone0 = rec?.entryZone?.[0] ?? 0;
  const entryZone1 = rec?.entryZone?.[1] ?? 0;
  const primaryZonePrice = rec?.primaryZonePrice ?? 0;
  const tp1 = rec?.takeProfit1 ?? 0;
  const tp2 = rec?.takeProfit2 ?? 0;
  const sl = rec?.stopLoss ?? 0;
  const slPercent = rec?.stopLossPercent ?? 0;
  const rr = rec?.riskRewardRatio ?? 0;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-6">
      {/* Top Header & Signal Badge */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
            <span>SMC Smart Money Decision Engine</span>
          </div>
          <h2 className="text-xl font-bold text-white mt-0.5">Recommendation & Trading Plan (Long Position)</h2>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1.5 rounded-xl font-black text-xs font-mono uppercase tracking-wider border shadow-lg ${
              rec?.status === 'TAPPED_POI_REBOUND'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-amber-500/10'
                : rec?.status === 'STRONG_BUY_POI'
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-emerald-500/10'
                : rec?.status === 'WAIT_PULLBACK_FVG'
                ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                : rec?.status === 'WAIT_FVG_CREATION'
                ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-purple-500/10'
                : rec?.status === 'SIDEWAYS_ACCUMULATION'
                ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40'
                : rec?.status === 'WAIT_VOLUME_CONFIRMATION'
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                : 'bg-rose-500/20 text-rose-400 border-rose-500/40'
            }`}
          >
            {rec?.status === 'TAPPED_POI_REBOUND'
              ? '🎯 RECENTLY TAPPED FVG/OB (REBOUND)'
              : rec?.status === 'WAIT_FVG_CREATION'
              ? 'AWAITING FVG CREATION'
              : statusStr}
          </span>
        </div>
      </div>

      {/* Grid Trade Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Entry Zone Area */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4">
          <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Entry Zone (Long)</span>
            <span className="text-emerald-400 text-[10px]">{rec?.primaryZoneType ?? ''}</span>
          </div>
          <div className="text-lg font-black text-white font-mono">
            Rp {entryZone0.toLocaleString()} - {entryZone1.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            POI Zone: Rp {primaryZonePrice.toLocaleString()}
          </div>
        </div>

        {/* Target Profit 1 & 2 */}
        <div className="bg-slate-950/80 border border-emerald-500/30 rounded-xl p-4 relative overflow-hidden">
          <div className="text-[11px] text-emerald-400 font-semibold uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Take Profit (TP)</span>
            <span className="text-xs font-bold">+10% / +20%</span>
          </div>
          <div className="text-lg font-black text-emerald-400 font-mono">
            Rp {tp1.toLocaleString()} <span className="text-xs text-slate-400 font-normal">/ {tp2.toLocaleString()}</span>
          </div>
          <div className="text-[11px] text-slate-300 mt-1">
            Potential Profit: +{rec?.takeProfit1Percent ?? 0}% (TP1) | +{rec?.takeProfit2Percent ?? 0}% (TP2)
          </div>
        </div>

        {/* Stop Loss / Cut Loss */}
        <div className="bg-slate-950/80 border border-rose-500/30 rounded-xl p-4">
          <div className="text-[11px] text-rose-400 font-semibold uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Stop Loss / Cut Loss</span>
            <span className="text-xs font-bold">-{slPercent.toFixed(1)}%</span>
          </div>
          <div className="text-lg font-black text-rose-400 font-mono">
            Rp {sl.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Risk Limit: ~{slPercent.toFixed(1)}% below Demand Zone
          </div>
        </div>

        {/* Risk Reward Ratio Gauge */}
        <div className="bg-slate-950/80 border border-teal-500/30 rounded-xl p-4">
          <div className="text-[11px] text-teal-300 font-semibold uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Risk : Reward Ratio</span>
            <span className={`text-xs font-bold ${rr >= 1.5 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {rr >= 1.5 ? 'OK (≥ 1:1.5)' : 'Low'}
            </span>
          </div>
          <div className="text-lg font-black text-teal-300 font-mono">
            1 : {rr}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Min requirement 1:1.5 met
          </div>
        </div>
      </div>

      {/* Decision Making SMC Reasoning Breakdown */}
      <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 space-y-3">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <Layers className="w-4 h-4 text-emerald-400" />
          <span>Smart Money Decision Making Analysis</span>
        </h3>

        <div className="space-y-2">
          {(rec?.decisionReasoning ?? []).map((reason, idx) => (
            <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{reason}</span>
            </div>
          ))}
        </div>

        {/* Volume Confirmation Badge */}
        <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium">Volume Indicator Confirmation:</span>
            <span
              className={`px-2 py-0.5 rounded font-mono font-bold text-[11px] ${
                rec?.volumeConfirmation
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}
            >
              {rec?.volumeConfirmation
                ? `VOLUME SPIKE (${rec?.volumeRatio ?? 1}x 20-MA)`
                : `NEUTRAL VOLUME (${rec?.volumeRatio ?? 1}x 20-MA)`}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            Market Structure: <strong className="text-white">{rec?.structure ?? ''}</strong>
          </span>
        </div>
      </div>

      {/* SMC Scenario Roadmap Projection Card */}
      {rec?.mostLikelyScenario && (
        <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/40 border border-indigo-500/30 rounded-xl p-4 space-y-3.5 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-500/20 pb-2.5">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-cyan-400 animate-pulse" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Most Likely SMC Scenario Projection (SMC Roadmap)
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 font-mono">Probability:</span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                  rec.mostLikelyScenario.probability === 'VERY HIGH'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : rec.mostLikelyScenario.probability === 'HIGH'
                    ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}
              >
                {rec.mostLikelyScenario.probability}
              </span>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-bold text-cyan-300 flex items-center gap-1.5">
              <GitBranch className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>{rec.mostLikelyScenario.title}</span>
            </h4>
            <p className="text-[11px] text-slate-300 mt-0.5 font-mono">
              {rec.mostLikelyScenario.targetDescription}
            </p>
          </div>

          {/* Sequential Steps Roadmap */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            {rec.mostLikelyScenario.steps.map((step, idx) => (
              <div
                key={idx}
                className="bg-slate-900/90 border border-slate-800 rounded-lg p-3 flex items-start gap-2.5 hover:border-indigo-500/40 transition-colors"
              >
                <div className="w-5 h-5 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 flex items-center justify-center font-mono text-[10px] font-black shrink-0 mt-0.5">
                  {idx + 1}
                </div>
                <div className="text-xs text-slate-200 leading-relaxed">
                  {step}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Interactive Position & Money Management Calculator */}
      <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Lot Sizing & Capital Risk Management Calculator
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">1 Lot = 100 Shares</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Inputs */}
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1 font-medium">
                Total Trading Capital (Rp):
              </label>
              <input
                type="number"
                value={capitalInput}
                onChange={(e) => setCapitalInput(Number(e.target.value) || 0)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1 font-medium">
                Max Risk per Trade (% Capital):
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="0.5"
                  value={riskPercent}
                  onChange={(e) => setRiskPercent(Number(e.target.value))}
                  className="flex-1 accent-emerald-500 cursor-pointer"
                />
                <span className="text-xs font-mono font-bold text-emerald-400 w-12 text-right">
                  {riskPercent}%
                </span>
              </div>
            </div>
          </div>

          {/* Outputs */}
          <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-3.5 space-y-2.5 text-xs font-mono">
            <div className="flex justify-between text-slate-300">
              <span>Max Loss Tolerance:</span>
              <span className="text-rose-400 font-bold">
                Rp {maxRiskAmount.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Recommended Lot Purchase:</span>
              <span className="text-emerald-400 font-black text-sm">
                {totalLotsToBuy.toLocaleString()} LOTS ({totalSharesToBuy.toLocaleString()} Shares)
              </span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Estimated Capital Required:</span>
              <span className="text-white font-bold">
                Rp {totalCapitalRequired.toLocaleString()}
              </span>
            </div>
            <div className="pt-2 border-t border-slate-800 flex justify-between text-[11px]">
              <span className="text-slate-400">TP1 Potential (+10%):</span>
              <span className="text-emerald-400 font-bold">+Rp {potentialProfitTp1.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400">TP2 Potential (+20%):</span>
              <span className="text-emerald-400 font-bold">+Rp {potentialProfitTp2.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
