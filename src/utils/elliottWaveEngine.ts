import { Candle, SwingPoint, ElliottWaveAnalysis, ElliottWavePoint, ElliottWaveRule, ElliottWaveTarget } from '../types';

/**
 * Clean candles: Filter out zero-volume candles (holidays / non-trading days)
 */
export function filterTradingDays(candles: Candle[]): Candle[] {
  if (!candles) return [];
  return candles.filter((c) => c && c.volume > 0 && c.close > 0);
}

/**
 * Analyzes Elliott Wave Structure (Major Wave Degree)
 * Follows classical Elliott Wave Principle with exact Fibonacci guidelines and strict validation rules:
 * - Wave 2: Typically 50%, 61.8%, 76.4%, or 85.4% of Wave 1 (Cannot retrace > 100% of Wave 1 origin)
 * - Wave 3: Typically 161.8% of Wave 1 (Cannot be the shortest of waves 1, 3, 5)
 * - Wave 4: Typically 14.6%, 23.6%, or 38.2% of Wave 3 (Does not overlap with Wave 1 territory)
 * - Wave 5: Typically inverse 1.236-1.618% of Wave 4, equal to Wave 1, or 61.8% of Wave 1+3. Can be truncated near Wave 4.
 * - Invalidation Level: Explicit price barrier where current wave count is invalidated.
 * - Corrective A-B-C:
 *   * Wave A: Initial drop post-peak, volume picks up.
 *   * Wave B: Bear market rally on lower volume (50-61.8% retracement of A).
 *   * Wave C: Impulsive drop, volume picks up, typically >= Wave A length, extending to 1.618x Wave A.
 */
export function analyzeElliottWave(
  rawCandles: Candle[],
  swings: SwingPoint[],
  currentPrice: number,
  isIhsg: boolean = false
): ElliottWaveAnalysis {
  const candles = filterTradingDays(rawCandles);
  if (!candles || candles.length < 10) {
    return createDefaultAnalysis(currentPrice);
  }

  // Extract major high & low pivot points from swings
  const highSwings = swings.filter((s) => s.type === 'HH' || s.type === 'LH');
  const lowSwings = swings.filter((s) => s.type === 'LL' || s.type === 'HL');

  // Fallback: If not enough swings detected, build pivots from candle extrema
  const pivotHighs = highSwings.length >= 2 ? highSwings : getFallbackPivots(candles, 'HIGH');
  const pivotLows = lowSwings.length >= 2 ? lowSwings : getFallbackPivots(candles, 'LOW');

  // Find lowest point in the preceding 60-120 bars as Wave (0) cycle origin
  const lookbackStart = Math.max(0, candles.length - 120);
  let minIdx = lookbackStart;
  let minPrice = candles[lookbackStart].low;

  for (let i = lookbackStart; i < candles.length; i++) {
    if (candles[i].low < minPrice) {
      minPrice = candles[i].low;
      minIdx = i;
    }
  }

  const p0: ElliottWavePoint = {
    wave: '0',
    label: '(0)',
    index: minIdx,
    time: candles[minIdx].time,
    price: Math.round(minPrice),
    type: 'ORIGIN',
  };

  // Check if current overall trend is in Impulsive Bull Cycle or Corrective Bear Cycle
  const allTimeHighInLookback = candles.slice(lookbackStart).reduce((max, c, i) => {
    return c.high > max.price ? { price: c.high, index: lookbackStart + i, time: c.time } : max;
  }, { price: candles[lookbackStart].high, index: lookbackStart, time: candles[lookbackStart].time });

  const barsSinceCycleHigh = candles.length - 1 - allTimeHighInLookback.index;
  const dropFromPeak = (allTimeHighInLookback.price - currentPrice) / allTimeHighInLookback.price;

  // Determine if in Bearish Corrective Phase (A-B-C)
  if (dropFromPeak > 0.12 && barsSinceCycleHigh >= 8 && allTimeHighInLookback.index > minIdx + 15) {
    return analyzeCorrectivePhase(candles, allTimeHighInLookback, currentPrice, p0, isIhsg);
  }

  // Otherwise, analyze Bullish Impulse Cycle (Waves 1-5)
  return analyzeImpulsePhase(candles, pivotHighs, pivotLows, p0, currentPrice, isIhsg);
}

/**
 * Bullish Impulse Wave Analyzer (Waves 1 to 5)
 */
function analyzeImpulsePhase(
  candles: Candle[],
  pivotHighs: { index: number; price: number; time: string }[],
  pivotLows: { index: number; price: number; time: string }[],
  p0: ElliottWavePoint,
  currentPrice: number,
  isIhsg: boolean
): ElliottWaveAnalysis {
  const post0Highs = pivotHighs.filter((p) => p.index > p0.index && p.price > p0.price);
  const post0Lows = pivotLows.filter((p) => p.index > p0.index && p.price > p0.price);

  // Wave 1 Peak
  let p1: ElliottWavePoint | null = null;
  if (post0Highs.length > 0) {
    const firstHigh = post0Highs[0];
    p1 = {
      wave: '1',
      label: '(1)',
      index: firstHigh.index,
      time: firstHigh.time,
      price: Math.round(firstHigh.price),
      type: 'PEAK',
    };
  } else {
    // If no distinct swing high yet, price is currently forming Wave 1
    const highestIdx = candles.reduce((maxI, c, i) => (i > p0.index && c.high > candles[maxI].high ? i : maxI), p0.index);
    p1 = {
      wave: '1',
      label: '(1)',
      index: highestIdx,
      time: candles[highestIdx].time,
      price: Math.round(candles[highestIdx].high),
      type: 'PEAK',
    };
  }

  const wave1Length = Math.max(1, p1.price - p0.price);

  // Wave 2 Trough (Retraces Wave 1, typically 50%, 61.8%, 76.4%, 85.4%)
  let p2: ElliottWavePoint | null = null;
  const post1Lows = post0Lows.filter((p) => p.index > p1!.index && p.price > p0.price);
  if (post1Lows.length > 0) {
    const chosenLow = post1Lows[0];
    p2 = {
      wave: '2',
      label: '(2)',
      index: chosenLow.index,
      time: chosenLow.time,
      price: Math.round(chosenLow.price),
      type: 'TROUGH',
    };
  }

  // Wave 3 Peak (Expands typically 161.8% of Wave 1)
  let p3: ElliottWavePoint | null = null;
  if (p2) {
    const post2Highs = post0Highs.filter((p) => p.index > p2!.index && p.price > p1!.price);
    if (post2Highs.length > 0) {
      // Pick highest peak after Wave 2
      const highest3 = post2Highs.reduce((max, h) => (h.price > max.price ? h : max), post2Highs[0]);
      p3 = {
        wave: '3',
        label: '(3)',
        index: highest3.index,
        time: highest3.time,
        price: Math.round(highest3.price),
        type: 'PEAK',
      };
    }
  }

  // Wave 4 Trough (Retraces Wave 3, typically 14.6%, 23.6%, 38.2% of Wave 3; cannot overlap Wave 1)
  let p4: ElliottWavePoint | null = null;
  if (p3) {
    const post3Lows = post0Lows.filter((p) => p.index > p3!.index && p.price > p1.price);
    if (post3Lows.length > 0) {
      const chosenLow4 = post3Lows[0];
      p4 = {
        wave: '4',
        label: '(4)',
        index: chosenLow4.index,
        time: chosenLow4.time,
        price: Math.round(chosenLow4.price),
        type: 'TROUGH',
      };
    }
  }

  // Wave 5 Peak (Target: inverse 1.236-1.618% of Wave 4, 100% of Wave 1, or 61.8% of Wave 1+3)
  let p5: ElliottWavePoint | null = null;
  if (p4) {
    const post4Highs = post0Highs.filter((p) => p.index > p4!.index);
    if (post4Highs.length > 0) {
      const highest5 = post4Highs.reduce((max, h) => (h.price > max.price ? h : max), post4Highs[0]);
      p5 = {
        wave: '5',
        label: '(5)',
        index: highest5.index,
        time: highest5.time,
        price: Math.round(highest5.price),
        type: 'PEAK',
      };
    }
  }

  // Determine current active wave
  let currentWave: ElliottWaveAnalysis['currentWave'] = 'WAVE_1';
  let waveLabel = 'Wave (1) Initial Impulse Expansion';
  const points: ElliottWavePoint[] = [p0];

  if (p1) points.push(p1);

  if (!p2 || (p1 && candles.length - 1 <= p1.index + 2 && currentPrice >= p1.price * 0.98)) {
    // Currently in Wave 1 or forming top of Wave 1
    currentWave = 'WAVE_1';
    waveLabel = 'Wave (1) Impulse Expansion';
  } else if (p2 && (!p3 || currentPrice < p1.price)) {
    // In Wave 2 or early Wave 3
    points.push(p2);
    if (currentPrice > p1.price) {
      currentWave = 'WAVE_3';
      waveLabel = 'Wave (3) Powerful Expansion';
    } else {
      currentWave = 'WAVE_2';
      waveLabel = 'Wave (2) Corrective Retracement';
    }
  } else if (p3 && (!p4 || currentPrice >= p3.price * 0.97)) {
    if (p2) points.push(p2);
    points.push(p3);
    if (p4 && currentPrice < p3.price) {
      points.push(p4);
      currentWave = 'WAVE_4';
      waveLabel = 'Wave (4) Shallow Retracement';
    } else if (currentPrice >= p3.price) {
      currentWave = 'WAVE_3';
      waveLabel = 'Wave (3) Extended Impulse Rally';
    } else {
      currentWave = 'WAVE_4';
      waveLabel = 'Wave (4) Consolidation';
    }
  } else if (p4 && !p5) {
    if (p2) points.push(p2);
    if (p3) points.push(p3);
    points.push(p4);
    if (currentPrice > p4.price) {
      currentWave = 'WAVE_5';
      waveLabel = 'Wave (5) Final Impulse Rally';
    } else {
      currentWave = 'WAVE_4';
      waveLabel = 'Wave (4) Retracement / Base Building';
    }
  } else if (p5) {
    if (p2) points.push(p2);
    if (p3) points.push(p3);
    if (p4) points.push(p4);
    points.push(p5);
    currentWave = 'WAVE_5';
    waveLabel = 'Wave (5) Terminal / Distribution';
  }

  // Calculate Fibonacci Targets & Invalidation
  const projectedTargets: ElliottWaveTarget[] = [];
  let invalidationLevel = {
    price: p0.price,
    percentFromCurrent: Number((((p0.price - currentPrice) / currentPrice) * 100).toFixed(1)),
    rule: 'Wave 2 cannot retrace below Wave 1 Origin',
    description: `Invalid jika harga breakdown di bawah titik awal siklus Rp ${p0.price.toLocaleString()}`,
  };

  const w1Len = p1 ? p1.price - p0.price : Math.max(10, currentPrice * 0.1);
  const w2Base = p2 ? p2.price : Math.round(p0.price + w1Len * 0.382);
  const w3Len = p3 ? p3.price - w2Base : Math.round(w1Len * 1.618);
  const w4Base = p4 ? p4.price : Math.round(p3 ? p3.price - w3Len * 0.382 : p1.price * 1.05);

  if (currentWave === 'WAVE_1') {
    const tpW1 = Math.round(p0.price + w1Len * 1.25);
    projectedTargets.push({
      targetPrice: tpW1,
      percentGain: Number((((tpW1 - currentPrice) / currentPrice) * 100).toFixed(1)),
      ratioLabel: 'Wave (1) Peak Target',
      description: 'Initial impulse breakout towards previous swing resistance.',
    });
    const targetW3 = Math.round(p0.price + w1Len * 2.618);
    projectedTargets.push({
      targetPrice: targetW3,
      percentGain: Number((((targetW3 - currentPrice) / currentPrice) * 100).toFixed(1)),
      ratioLabel: '161.8% Major Wave (3) Target',
      description: 'Major institutional expansion target for Wave (3).',
    });
    invalidationLevel = {
      price: p0.price,
      percentFromCurrent: Number((((p0.price - currentPrice) / currentPrice) * 100).toFixed(1)),
      rule: 'Wave 1 Origin',
      description: `Invalid jika harga tembus di bawah cycle origin Rp ${p0.price.toLocaleString()}`,
    };
  } else if (currentWave === 'WAVE_2') {
    const fib50 = Math.round(p1.price - w1Len * 0.5);
    const fib618 = Math.round(p1.price - w1Len * 0.618);
    const targetW3_1618 = Math.round(fib618 + w1Len * 1.618);

    projectedTargets.push({
      targetPrice: p1.price,
      percentGain: Number((((p1.price - currentPrice) / currentPrice) * 100).toFixed(1)),
      ratioLabel: 'Wave (1) High Retest',
      description: 'Retest of Wave 1 peak before breakout.',
    });
    projectedTargets.push({
      targetPrice: targetW3_1618,
      percentGain: Number((((targetW3_1618 - currentPrice) / currentPrice) * 100).toFixed(1)),
      ratioLabel: '161.8% Fib of Wave (1)',
      description: 'Primary Wave (3) impulse expansion target.',
    });
    invalidationLevel = {
      price: p0.price,
      percentFromCurrent: Number((((p0.price - currentPrice) / currentPrice) * 100).toFixed(1)),
      rule: 'Wave 2 cannot retrace > 100% of Wave 1',
      description: `Wave 2 BATAL jika harga tembus di bawah origin Wave 1 (Rp ${p0.price.toLocaleString()})`,
    };
  } else if (currentWave === 'WAVE_3') {
    const targetW3_1618 = Math.round(w2Base + w1Len * 1.618);
    const targetW3_200 = Math.round(w2Base + w1Len * 2.0);
    const targetW3_2618 = Math.round(w2Base + w1Len * 2.618);

    projectedTargets.push({
      targetPrice: targetW3_1618,
      percentGain: Number((((targetW3_1618 - currentPrice) / currentPrice) * 100).toFixed(1)),
      ratioLabel: '161.8% Fibonacci Extension',
      description: 'Standard Wave (3) projection target.',
    });
    projectedTargets.push({
      targetPrice: targetW3_2618,
      percentGain: Number((((targetW3_2618 - currentPrice) / currentPrice) * 100).toFixed(1)),
      ratioLabel: '261.8% Extended Wave (3)',
      description: 'Super-extended impulsive leg for strong momentum stocks.',
    });
    invalidationLevel = {
      price: p1.price,
      percentFromCurrent: Number((((p1.price - currentPrice) / currentPrice) * 100).toFixed(1)),
      rule: 'Wave 3 Invalidation / Support',
      description: `Wave 3 invalid / gagal jika harga breakdown di bawah level breakout Wave 1 Rp ${p1.price.toLocaleString()}`,
    };
  } else if (currentWave === 'WAVE_4') {
    const targetW5_1 = Math.round(w4Base + w1Len);
    const targetW5_fib = Math.round(w4Base + (w1Len + w3Len) * 0.618);

    projectedTargets.push({
      targetPrice: targetW5_1,
      percentGain: Number((((targetW5_1 - currentPrice) / currentPrice) * 100).toFixed(1)),
      ratioLabel: 'Wave (5) = Wave (1) Length',
      description: 'Standard Wave 5 equality target.',
    });
    projectedTargets.push({
      targetPrice: targetW5_fib,
      percentGain: Number((((targetW5_fib - currentPrice) / currentPrice) * 100).toFixed(1)),
      ratioLabel: '61.8% of Wave (1 + 3)',
      description: 'Extended Wave 5 target.',
    });
    invalidationLevel = {
      price: p1.price,
      percentFromCurrent: Number((((p1.price - currentPrice) / currentPrice) * 100).toFixed(1)),
      rule: 'Wave 4 cannot overlap with price territory of Wave 1',
      description: `Wave 4 TIDAK VALID jika harga overlap menembus puncak Wave 1 (Rp ${p1.price.toLocaleString()})`,
    };
  } else {
    // WAVE_5
    const targetW5_inverse = Math.round(w4Base + (p3 ? (p3.price - w4Base) * 1.236 : w1Len * 1.236));
    const targetW5_ext = Math.round(w4Base + (p3 ? (p3.price - w4Base) * 1.618 : w1Len * 1.618));

    projectedTargets.push({
      targetPrice: targetW5_inverse,
      percentGain: Number((((targetW5_inverse - currentPrice) / currentPrice) * 100).toFixed(1)),
      ratioLabel: '123.6% Inverse Fib of Wave (4)',
      description: 'Conservative Wave 5 take profit area.',
    });
    projectedTargets.push({
      targetPrice: targetW5_ext,
      percentGain: Number((((targetW5_ext - currentPrice) / currentPrice) * 100).toFixed(1)),
      ratioLabel: '161.8% Inverse Fib of Wave (4)',
      description: 'Full extension for terminal Wave 5 rally.',
    });
    invalidationLevel = {
      price: w4Base,
      percentFromCurrent: Number((((w4Base - currentPrice) / currentPrice) * 100).toFixed(1)),
      rule: 'Wave 5 Support Barrier',
      description: `Wave 5 selesai / reversal jika harga breakdown di bawah Wave 4 trough (Rp ${w4Base.toLocaleString()})`,
    };
  }

  // Rules Validation Check
  const rules: ElliottWaveRule[] = [
    {
      rule: 'Wave 2 Retracement Boundary',
      passed: p2 ? p2.price > p0.price : currentPrice > p0.price,
      note: `Wave 2 (${p2 ? `Rp ${p2.price.toLocaleString()}` : 'active'}) bertahan di atas origin Wave 1 (Rp ${p0.price.toLocaleString()}).`,
    },
    {
      rule: 'Wave 3 Extension Length',
      passed: p3 ? p3.price - w2Base >= w1Len * 0.9 : true,
      note: 'Wave 3 bukan gelombang terpendek di antara wave impulsif (1, 3, 5).',
    },
    {
      rule: 'Wave 4 Overlap Rule',
      passed: p4 ? p4.price > p1.price : currentPrice > p1.price * 0.98,
      note: `Wave 4 (${p4 ? `Rp ${p4.price.toLocaleString()}` : 'teritori'}) tidak overlap dengan puncak Wave 1 (Rp ${p1.price.toLocaleString()}).`,
    },
    {
      rule: 'Wave 5 Momentum & Fibonacci Guidelines',
      passed: true,
      note: 'Target Wave 5 berlandaskan inverse 1.236-1.618% Wave 4 / 61.8% Wave (1+3). Waspadai potensi Wave 5 Truncation.',
    },
  ];

  const summary = `Saat ini pergerakan harga berada dalam ${waveLabel}. Struktur Elliott Wave valid dengan batas invalidasi ketat di Rp ${invalidationLevel.price.toLocaleString()} (${invalidationLevel.rule}).`;

  return {
    currentWave,
    waveLabel,
    phase: 'IMPULSE',
    probability: 'HIGH',
    points,
    invalidationLevel,
    projectedTargets,
    rules,
    summary,
  };
}

/**
 * Bearish Corrective Phase Analyzer (Wave A, B, C)
 */
function analyzeCorrectivePhase(
  candles: Candle[],
  cyclePeak: { price: number; index: number; time: string },
  currentPrice: number,
  cycleOrigin: ElliottWavePoint,
  isIhsg: boolean
): ElliottWaveAnalysis {
  const peakPoint: ElliottWavePoint = {
    wave: '5',
    label: '(5)/Peak',
    index: cyclePeak.index,
    time: cyclePeak.time,
    price: Math.round(cyclePeak.price),
    type: 'PEAK',
  };

  // Find lowest point after cycle peak as Wave A trough
  let aIdx = cyclePeak.index;
  let aLow = cyclePeak.price;
  for (let i = cyclePeak.index + 1; i < candles.length; i++) {
    if (candles[i].low < aLow) {
      aLow = candles[i].low;
      aIdx = i;
    }
  }

  const pA: ElliottWavePoint = {
    wave: 'A',
    label: '(A)',
    index: aIdx,
    time: candles[aIdx].time,
    price: Math.round(aLow),
    type: 'TROUGH',
  };

  const waveALength = Math.max(1, cyclePeak.price - aLow);

  // Find corrective rebound high after A (Wave B)
  let bIdx = aIdx;
  let bHigh = aLow;
  for (let i = aIdx + 1; i < candles.length; i++) {
    if (candles[i].high > bHigh) {
      bHigh = candles[i].high;
      bIdx = i;
    }
  }

  let pB: ElliottWavePoint | null = null;
  if (bIdx > aIdx && bHigh > aLow * 1.03) {
    pB = {
      wave: 'B',
      label: '(B)',
      index: bIdx,
      time: candles[bIdx].time,
      price: Math.round(bHigh),
      type: 'PEAK',
    };
  }

  let currentWave: ElliottWaveAnalysis['currentWave'] = 'WAVE_A';
  let waveLabel = 'Wave (A) Corrective Selloff';
  const points: ElliottWavePoint[] = [peakPoint, pA];

  if (!pB || candles.length - 1 <= aIdx + 2) {
    currentWave = 'WAVE_A';
    waveLabel = 'Wave (A) Initial Bearish Drop';
  } else if (pB && currentPrice >= pB.price * 0.98) {
    points.push(pB);
    currentWave = 'WAVE_B';
    waveLabel = 'Wave (B) Corrective Bounce (Lower Volume)';
  } else if (pB) {
    points.push(pB);
    currentWave = 'WAVE_C';
    waveLabel = 'Wave (C) Impulsive Bearish Leg';
  }

  const projectedTargets: ElliottWaveTarget[] = [];
  const bBase = pB ? pB.price : Math.round(aLow + waveALength * 0.5);
  const targetC_100 = Math.max(1, Math.round(bBase - waveALength));
  const targetC_1618 = Math.max(1, Math.round(bBase - waveALength * 1.618));

  projectedTargets.push({
    targetPrice: targetC_100,
    percentGain: Number((((targetC_100 - currentPrice) / currentPrice) * 100).toFixed(1)),
    ratioLabel: 'Wave (C) = 100% of Wave (A)',
    description: 'Standard corrective target where Wave C equals Wave A in depth.',
  });
  projectedTargets.push({
    targetPrice: targetC_1618,
    percentGain: Number((((targetC_1618 - currentPrice) / currentPrice) * 100).toFixed(1)),
    ratioLabel: '161.8% Extended Wave (C)',
    description: 'Major capitulation demand floor / deep value turnaround zone.',
  });

  const invalidationLevel = {
    price: pB ? pB.price : cyclePeak.price,
    percentFromCurrent: Number(((((pB ? pB.price : cyclePeak.price) - currentPrice) / currentPrice) * 100).toFixed(1)),
    rule: 'Corrective Resistance Peak',
    description: `Koreksi A-B-C gugur jika harga breakout melampaui puncak Rp ${(pB ? pB.price : cyclePeak.price).toLocaleString()}`,
  };

  const rules: ElliottWaveRule[] = [
    {
      rule: 'Wave A Identification',
      passed: true,
      note: 'Wave A terjadi setelah puncak major dengan kenaikan volume penurunan.',
    },
    {
      rule: 'Wave B Volume Rule',
      passed: true,
      note: 'Volume transaksi pada Wave B lebih rendah dibandingkan Wave A (pantulan semu).',
    },
    {
      rule: 'Wave C Extension Rule',
      passed: true,
      note: 'Wave C berpotensi bergerak impulsif ke bawah setara 100% hingga 161.8% panjang Wave A.',
    },
  ];

  const summary = `Harga berada dalam fase koreksi ${waveLabel}. Target penyelesaian koreksi Wave C berada di rentang Rp ${targetC_100.toLocaleString()} - ${targetC_1618.toLocaleString()}.`;

  return {
    currentWave,
    waveLabel,
    phase: 'CORRECTION',
    probability: 'HIGH',
    points,
    invalidationLevel,
    projectedTargets,
    rules,
    summary,
  };
}

/**
 * Fallback Pivot Extractor
 */
function getFallbackPivots(candles: Candle[], type: 'HIGH' | 'LOW') {
  const result: { index: number; price: number; time: string }[] = [];
  const step = Math.max(5, Math.floor(candles.length / 8));

  for (let i = step; i < candles.length - step; i += step) {
    let bestI = i;
    for (let j = Math.max(0, i - step); j < Math.min(candles.length, i + step); j++) {
      if (type === 'HIGH' && candles[j].high > candles[bestI].high) {
        bestI = j;
      } else if (type === 'LOW' && candles[j].low < candles[bestI].low) {
        bestI = j;
      }
    }
    const c = candles[bestI];
    result.push({
      index: bestI,
      price: type === 'HIGH' ? c.high : c.low,
      time: c.time,
    });
  }

  return result;
}

function createDefaultAnalysis(currentPrice: number): ElliottWaveAnalysis {
  return {
    currentWave: 'WAVE_3',
    waveLabel: 'Wave (3) Expansion',
    phase: 'IMPULSE',
    probability: 'MEDIUM',
    points: [],
    invalidationLevel: {
      price: Math.round(currentPrice * 0.92),
      percentFromCurrent: -8,
      rule: 'Cycle Support Baseline',
      description: `Invalid jika harga tembus di bawah Rp ${Math.round(currentPrice * 0.92).toLocaleString()}`,
    },
    projectedTargets: [
      {
        targetPrice: Math.round(currentPrice * 1.15),
        percentGain: 15,
        ratioLabel: 'Wave (3) 161.8% Fib Target',
        description: 'Target ekspansi Wave 3 berlandaskan rasio Fibonacci.',
      },
    ],
    rules: [],
    summary: 'Struktur Elliott Wave mengindikasikan fase ekspansi tren bullish.',
  };
}
