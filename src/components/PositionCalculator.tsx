import React, { useState } from 'react';
import { Calculator, DollarSign, ShieldAlert, TrendingUp, CheckCircle2, Plus, Minus } from 'lucide-react';
import { getIdxTickSize, addIdxTicks, roundToIdxTick } from '../utils/idxTickRules';

export const PositionCalculator: React.FC = () => {
  const [portfolioCapital, setPortfolioCapital] = useState<number>(100000000); // Rp 100 Juta
  const [riskPerTradePercent, setRiskPerTradePercent] = useState<number>(2); // 2%
  const [entryPrice, setEntryPrice] = useState<number>(1845); // e.g. BRPT 1,845
  const [stopLossPrice, setStopLossPrice] = useState<number>(1775); // e.g. BRPT 1,775 (-3.8%)
  const [targetProfitPrice, setTargetProfitPrice] = useState<number>(2080); // e.g. BRPT 2,080 (+12.7%)

  // Calculations
  const maxRiskRp = (portfolioCapital * riskPerTradePercent) / 100;
  const riskPerShare = Math.max(1, entryPrice - stopLossPrice);
  const rewardPerShare = Math.max(0, targetProfitPrice - entryPrice);

  const riskPercentVal = entryPrice > 0 ? ((entryPrice - stopLossPrice) / entryPrice) * 100 : 0;
  const rewardPercentVal = entryPrice > 0 ? ((targetProfitPrice - entryPrice) / entryPrice) * 100 : 0;

  const totalShares = Math.floor(maxRiskRp / riskPerShare);
  const totalLots = Math.floor(totalShares / 100);
  const capitalRequired = totalLots * 100 * entryPrice;

  const totalLossRp = totalLots * 100 * (entryPrice - stopLossPrice);
  const totalProfitRp = totalLots * 100 * (targetProfitPrice - entryPrice);

  const riskRewardRatio = riskPerShare > 0 ? (rewardPerShare / riskPerShare).toFixed(2) : '0';

  const currentTickSize = getIdxTickSize(entryPrice);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
        <div className="border-b border-slate-800 pb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Calculator className="w-5 h-5 text-emerald-400" />
            <span>Lot Sizing & Risk Reward Calculator (Indonesia Stocks - IDX)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Calculate ideal position lot size based on capital risk tolerance and official IDX Tick Size rules
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Inputs Form */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Total Portfolio Capital (Rp):
              </label>
              <input
                type="number"
                value={portfolioCapital}
                onChange={(e) => setPortfolioCapital(Number(e.target.value) || 0)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Max Risk per Trade (% Capital):
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0.5"
                  max="5"
                  step="0.5"
                  value={riskPerTradePercent}
                  onChange={(e) => setRiskPerTradePercent(Number(e.target.value))}
                  className="flex-1 accent-emerald-500 cursor-pointer"
                />
                <span className="text-xs font-mono font-bold text-emerald-400 w-12">
                  {riskPerTradePercent}%
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2">
              {/* Entry Price */}
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Entry Price (Rp):</label>
                <div className="relative">
                  <input
                    type="number"
                    value={entryPrice}
                    onChange={(e) => setEntryPrice(roundToIdxTick(Number(e.target.value) || 0))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                  />
                  <div className="flex items-center gap-0.5 mt-1">
                    <button
                      onClick={() => setEntryPrice(addIdxTicks(entryPrice, -1))}
                      className="flex-1 bg-slate-800 hover:bg-slate-700 py-1 rounded text-[10px] text-slate-300 flex items-center justify-center font-mono cursor-pointer"
                      title="-1 Tick"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => setEntryPrice(addIdxTicks(entryPrice, 1))}
                      className="flex-1 bg-slate-800 hover:bg-slate-700 py-1 rounded text-[10px] text-slate-300 flex items-center justify-center font-mono cursor-pointer"
                      title="+1 Tick"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Stop Loss Price */}
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Stop Loss / SL (Rp):</label>
                <div className="relative">
                  <input
                    type="number"
                    value={stopLossPrice}
                    onChange={(e) => setStopLossPrice(roundToIdxTick(Number(e.target.value) || 0))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs font-mono text-rose-400 focus:outline-none focus:border-rose-500"
                  />
                  <div className="flex items-center gap-0.5 mt-1">
                    <button
                      onClick={() => setStopLossPrice(addIdxTicks(stopLossPrice, -1))}
                      className="flex-1 bg-slate-800 hover:bg-slate-700 py-1 rounded text-[10px] text-rose-300 flex items-center justify-center font-mono cursor-pointer"
                      title="-1 Tick"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => setStopLossPrice(addIdxTicks(stopLossPrice, 1))}
                      className="flex-1 bg-slate-800 hover:bg-slate-700 py-1 rounded text-[10px] text-rose-300 flex items-center justify-center font-mono cursor-pointer"
                      title="+1 Tick"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Target Profit Price */}
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Target TP (Rp):</label>
                <div className="relative">
                  <input
                    type="number"
                    value={targetProfitPrice}
                    onChange={(e) => setTargetProfitPrice(roundToIdxTick(Number(e.target.value) || 0))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs font-mono text-emerald-400 focus:outline-none focus:border-emerald-500"
                  />
                  <div className="flex items-center gap-0.5 mt-1">
                    <button
                      onClick={() => setTargetProfitPrice(addIdxTicks(targetProfitPrice, -1))}
                      className="flex-1 bg-slate-800 hover:bg-slate-700 py-1 rounded text-[10px] text-emerald-300 flex items-center justify-center font-mono cursor-pointer"
                      title="-1 Tick"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => setTargetProfitPrice(addIdxTicks(targetProfitPrice, 1))}
                      className="flex-1 bg-slate-800 hover:bg-slate-700 py-1 rounded text-[10px] text-emerald-300 flex items-center justify-center font-mono cursor-pointer"
                      title="+1 Tick"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Official BEI Fractional Tick Rules Reference Box */}
            <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 text-[11px] text-slate-300 space-y-2">
              <div className="font-bold text-amber-400 flex items-center justify-between">
                <span>Official IDX Fractional Price Rules (Tick Rules):</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono">
                  Active: Rp {currentTickSize} / tick
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-[10px] text-slate-400 font-mono">
                <div>&lt; Rp 200: <strong className="text-white">Rp 1 / tick</strong></div>
                <div>Rp 200 - &lt; Rp 500: <strong className="text-white">Rp 2 / tick</strong></div>
                <div>Rp 500 - &lt; Rp 2,000: <strong className="text-white">Rp 5 / tick</strong></div>
                <div>Rp 2,000 - &lt; Rp 5,000: <strong className="text-white">Rp 10 / tick</strong></div>
                <div className="col-span-2">≥ Rp 5,000: <strong className="text-white">Rp 25 / tick</strong></div>
              </div>
            </div>
          </div>

          {/* Results Summary Box */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400 font-sans font-bold">Max Loss Tolerance:</span>
              <span className="text-rose-400 font-bold text-sm">Rp {(maxRiskRp || 0).toLocaleString()}</span>
            </div>

            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-center space-y-1">
              <div className="text-[10px] text-slate-400 uppercase font-sans font-bold">
                Recommended Lot Purchase
              </div>
              <div className="text-2xl font-black text-emerald-400">
                {(totalLots || 0).toLocaleString()} LOTS
              </div>
              <div className="text-[11px] text-slate-300">
                Equivalent to {(totalShares || 0).toLocaleString()} Shares
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <div className="flex justify-between text-slate-300">
                <span>Capital Required:</span>
                <span className="text-white font-bold">Rp {(capitalRequired || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Potential Loss (Stop Loss):</span>
                <span className="text-rose-400 font-bold">-Rp {(totalLossRp || 0).toLocaleString()} (-{(riskPercentVal || 0).toFixed(1)}%)</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Potential Profit (Target TP):</span>
                <span className="text-emerald-400 font-bold">+Rp {(totalProfitRp || 0).toLocaleString()} (+{(rewardPercentVal || 0).toFixed(1)}%)</span>
              </div>
              <div className="flex justify-between text-slate-300 pt-2 border-t border-slate-800">
                <span>Risk : Reward Ratio:</span>
                <span className={`font-bold ${parseFloat(riskRewardRatio) >= 1.5 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  1 : {riskRewardRatio} {parseFloat(riskRewardRatio) >= 1.5 ? '✓ Valid' : '⚠ Improve R:R'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
