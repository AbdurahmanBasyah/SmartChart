import React from 'react';
import { BookOpen, CheckCircle2, TrendingUp, Layers, Zap, X, ShieldCheck } from 'lucide-react';

interface SmcGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SmcGuideModal: React.FC<SmcGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 text-slate-100 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6 border-b border-slate-800 pb-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Smart Money Concepts (SMC) Guide for Indonesia Stocks</h2>
            <p className="text-xs text-slate-400">Understand every line and overlay zone on the chart for precise execution</p>
          </div>
        </div>

        <div className="space-y-6 text-xs leading-relaxed text-slate-300">
          {/* BOS vs CHoCH */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2">
            <h3 className="font-bold text-sm text-emerald-400 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              <span>1. BOS (Break of Structure) vs CHoCH (Change of Character)</span>
            </h3>
            <p>
              <strong>BOS (Blue Line):</strong> Occurs when price breaks the previous High/Low level in the direction of the ongoing trend (Bullish/Bearish trend continuation).
            </p>
            <p>
              <strong>CHoCH (Yellow/Amber Line):</strong> Occurs when price breaks the opposite structure, marking the start of a trend reversal from Downtrend/Sideways to a Bullish Uptrend.
            </p>
          </div>

          {/* FVG */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2">
            <h3 className="font-bold text-sm text-teal-300 flex items-center gap-2">
              <Layers className="w-4 h-4" />
              <span>2. Fair Value Gap (FVG) / Imbalance Zone</span>
            </h3>
            <p>
              FVG is a 3-candle price jump (imbalance) area where rapid institutional buy execution leaves empty space between Candle 1 High and Candle 3 Low.
            </p>
            <p className="text-emerald-400 font-semibold">
              Entry Rule: Wait for price to pullback and refill the FVG zone as a low-risk entry point.
            </p>
          </div>

          {/* Order Block */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2">
            <h3 className="font-bold text-sm text-purple-400 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              <span>3. Demand Order Block (POI - Point of Interest)</span>
            </h3>
            <p>
              Demand Order Block (Purple Box) is the last red candle prior to a strong upward push that triggers a Break of Structure. This marks where institutions / smart money accumulated large buy positions.
            </p>
          </div>

          {/* Volume Indicator */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2">
            <h3 className="font-bold text-sm text-amber-400 flex items-center gap-2">
              <Zap className="w-4 h-4" />
              <span>4. Volume Confirmation Indicator (Spike &gt; 1.3x 20-MA)</span>
            </h3>
            <p>
              Whenever price touches an FVG or Order Block, check if current volume exceeds the 20-day average (20-MA). Volume spikes confirm smart money actively defending the price level.
            </p>
          </div>

          {/* Risk Management Profile */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>5. Risk Profile & Capital Management</span>
            </h3>
            <ul className="list-disc pl-4 space-y-1">
              <li>Always LONG Position (Buy).</li>
              <li>Min Risk : Reward ratio of 1 : 1.5.</li>
              <li>Target Profit: TP1 = +10%, TP2 = +20%.</li>
              <li>Stop Loss (SL): Set ~3% - 5% below Demand Zone boundary.</li>
            </ul>
          </div>
        </div>

        <div className="mt-6 text-right">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer transition-colors"
          >
            Understood, Back to Chart
          </button>
        </div>
      </div>
    </div>
  );
};
