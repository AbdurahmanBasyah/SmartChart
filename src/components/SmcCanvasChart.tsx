import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  Layers,
  Eye,
  EyeOff,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sliders,
  TrendingUp,
  Target,
  Maximize2,
  Info,
  Camera,
  Check,
  Copy,
  PenTool,
  Trash2,
  Star,
} from 'lucide-react';
import { StockData, Candle } from '../types';

interface SmcCanvasChartProps {
  stock: StockData;
  timeframe?: string;
  onTimeframeChange?: (tf: string) => void;
  isWatchlisted?: boolean;
  onToggleWatchlist?: (ticker: string) => void;
}

export const SmcCanvasChart: React.FC<SmcCanvasChartProps> = ({
  stock,
  timeframe = '1D',
  onTimeframeChange,
  isWatchlisted = false,
  onToggleWatchlist,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Overlay Toggles
  const [showOrderBlocks, setShowOrderBlocks] = useState(true);
  const [showFvg, setShowFvg] = useState(true);
  const [showGaps, setShowGaps] = useState(true);
  const [showBosChoch, setShowBosChoch] = useState(true);
  const [showLiquidity, setShowLiquidity] = useState(true);
  const [showSupportResistance, setShowSupportResistance] = useState(true);
  const [showRiskRewardBox, setShowRiskRewardBox] = useState(true);

  // Custom Trendline Drawing Tool State
  const [isDrawingLine, setIsDrawingLine] = useState(false);
  const [lineFirstPoint, setLineFirstPoint] = useState<{ candleIndex: number; price: number; time: string } | null>(null);
  const [customLines, setCustomLines] = useState<
    Array<{ id: string; p1: { candleIndex: number; price: number; time: string }; p2: { candleIndex: number; price: number; time: string }; color?: string }>
  >([]);

  // Endpoint dragging & hovering state
  const [hoveredEndpoint, setHoveredEndpoint] = useState<{ lineId: string; point: 'p1' | 'p2' } | null>(null);
  const [draggingEndpoint, setDraggingEndpoint] = useState<{ lineId: string; point: 'p1' | 'p2' } | null>(null);
  const mousePosRef = useRef<{ x: number; y: number } | null>(null);

  // Ref to track current canvas chart bounds for exact click-to-data mapping
  const currentChartBoundsRef = useRef<{
    minPrice: number;
    maxPrice: number;
    adjustedRange: number;
    paddingTop: number;
    priceChartHeight: number;
    startIndex: number;
    totalBarSpace: number;
    candleWidth: number;
    paddingLeft: number;
    paddingRight: number;
  } | null>(null);

  const dragDistanceRef = useRef(0);

  // Copy Image Chart Status State
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const handleCopyChartImage = () => {
    if (!canvasRef.current) return;
    try {
      const canvas = canvasRef.current;
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        try {
          // Try clipboard API
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          setCopyStatus('Copied to Clipboard!');
          setTimeout(() => setCopyStatus(null), 2500);
        } catch (err) {
          // Fallback: download PNG image directly
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${stock.ticker}_SMC_Chart.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          setCopyStatus('Image Downloaded!');
          setTimeout(() => setCopyStatus(null), 2500);
        }
      }, 'image/png');
    } catch (err) {
      console.error('Failed copying image chart:', err);
    }
  };

  // Pan and Zoom view state
  const [zoomLevel, setZoomLevel] = useState(1);
  const [scrollOffset, setScrollOffset] = useState(-6); // Negative offset gives right margin before price scale
  const [priceScale, setPriceScale] = useState(1.0); // Vertical price zoom (1.0 = default, >1 = expand, <1 = compress)
  const [priceOffset, setPriceOffset] = useState(0); // Vertical price shift offset (2D panning)
  const [hoveredCandle, setHoveredCandle] = useState<{ candle: Candle; index: number; x: number; y: number } | null>(null);
  const [isMouseOverAxis, setIsMouseOverAxis] = useState(false);
  const [isDraggingAxis, setIsDraggingAxis] = useState(false);
  const [isDraggingChart, setIsDraggingChart] = useState(false);

  const dragStartY = useRef(0);
  const dragStartScale = useRef(1.0);
  const dragStartX = useRef(0);
  const dragStartScrollOffset = useRef(-6);
  const dragStartPriceOffset = useRef(0);
  const pricePerPixelRef = useRef(0.01);

  // Mobile Touch Gesture state refs
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const touchStartPinchDistRef = useRef<number | null>(null);
  const touchStartZoomRef = useRef<number>(1);
  const touchStartScaleRef = useRef<number>(1);
  const touchStartScrollOffsetRef = useRef<number>(-6);
  const touchStartPriceOffsetRef = useRef<number>(0);
  const isTouchDraggingChart = useRef<boolean>(false);
  const isTouchDraggingAxis = useRef<boolean>(false);

  const candles = stock.candles;

  // Global drag listener for smooth 2D drag/pan on chart and price axis
  useEffect(() => {
    if (!isDraggingChart && !isDraggingAxis) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDraggingChart) {
        const baseCandleWidth = 10;
        const candleWidth = Math.max(3, Math.min(40, baseCandleWidth * zoomLevel));
        const candleGap = Math.max(1, candleWidth * 0.25);
        const totalBarSpace = candleWidth + candleGap;

        // 1. Horizontal Drag (X Axis)
        const deltaX = e.clientX - dragStartX.current;
        const candleOffset = deltaX / totalBarSpace;
        const maxOffset = Math.max(0, candles.length - 10);
        const minOffset = -20; // Allow ample blank space on the right side
        const newOffset = Math.max(minOffset, Math.min(maxOffset, dragStartScrollOffset.current + candleOffset));
        setScrollOffset(newOffset);

        // 2. Vertical Drag (Y Axis - 2D Pan in all directions)
        const deltaY = e.clientY - dragStartY.current;
        const newPriceOffset = dragStartPriceOffset.current + deltaY * pricePerPixelRef.current;
        setPriceOffset(newPriceOffset);
      } else if (isDraggingAxis) {
        const deltaY = dragStartY.current - e.clientY;
        const factor = 1 + deltaY * 0.008;
        const newScale = Math.max(0.1, Math.min(10.0, dragStartScale.current * factor));
        setPriceScale(newScale);
      }
    };

    const handleGlobalMouseUp = () => {
      setIsDraggingChart(false);
      setIsDraggingAxis(false);
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDraggingChart, isDraggingAxis, zoomLevel, candles.length]);

  // Wheel listener for vertical scaling on price scale & horizontal zoom/pan on chart area
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const paddingRight = 85;

      // If scrolling over right price axis label OR shift key held
      if (x >= rect.width - paddingRight || e.shiftKey) {
        if (e.deltaY < 0) {
          // Scroll UP -> expand vertically (melebar vertikal)
          setPriceScale((s) => Math.min(10.0, s * 1.12));
        } else {
          // Scroll DOWN -> compress vertically (berimpit vertikal)
          setPriceScale((s) => Math.max(0.1, s / 1.12));
        }
      } else {
        if (e.ctrlKey || e.metaKey) {
          if (e.deltaY < 0) setZoomLevel((z) => Math.min(3.0, z + 0.15));
          else setZoomLevel((z) => Math.max(0.4, z - 0.15));
        } else {
          // Scroll UP (deltaY < 0) -> geser kanan (decrease offset)
          // Scroll DOWN (deltaY > 0) -> geser kiri (increase offset)
          setScrollOffset((off) => {
            const step = e.deltaY < 0 ? -3 : 3;
            const maxOffset = Math.max(0, candles.length - 10);
            return Math.max(-20, Math.min(maxOffset, off + step));
          });
        }
      }
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [candles.length]);

  // Render Engine on Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || candles.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high-DPI crisp canvas rendering
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.scale(dpr, dpr);

    // Chart Dimensions Layout
    const paddingRight = 85; // Right price axis width
    const paddingBottom = 60; // Bottom volume & time axis height
    const paddingTop = 30;
    const paddingLeft = 15;

    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;
    const volumeHeight = chartHeight * 0.22;
    const priceChartHeight = chartHeight * 0.78;

    // Calculate visible candles range
    const baseCandleWidth = 10;
    const candleWidth = Math.max(3, Math.min(40, baseCandleWidth * zoomLevel));
    const candleGap = Math.max(1, candleWidth * 0.25);
    const totalBarSpace = candleWidth + candleGap;

    const visibleCandlesCount = Math.floor(chartWidth / totalBarSpace);
    const endIndex = Math.max(
      visibleCandlesCount,
      candles.length - Math.floor(scrollOffset)
    );
    const startIndex = Math.max(0, endIndex - visibleCandlesCount);

    const visibleCandles = candles.slice(startIndex, endIndex);
    if (visibleCandles.length === 0) return;

    // Determine min/max price for scaling
    let rawMinPrice = Infinity;
    let rawMaxPrice = -Infinity;

    visibleCandles.forEach((c) => {
      if (c.low < rawMinPrice) rawMinPrice = c.low;
      if (c.high > rawMaxPrice) rawMaxPrice = c.high;
    });

    // Center and scaled range for vertical zoom & 2D drag panning with generous top/bottom padding
    const priceCenter = (rawMinPrice + rawMaxPrice) / 2 + priceOffset;
    const baseHalfRange = (rawMaxPrice - rawMinPrice) / 2 || 1;
    const scaledHalfRange = (baseHalfRange * 1.25) / priceScale;

    const minPrice = priceCenter - scaledHalfRange;
    const maxPrice = priceCenter + scaledHalfRange;
    const adjustedRange = maxPrice - minPrice;

    // Cache pricePerPixel for smooth 2D dragging
    pricePerPixelRef.current = adjustedRange / priceChartHeight;

    // Cache current chart bounds for exact click-to-data mapping & trendline drawing
    currentChartBoundsRef.current = {
      minPrice,
      maxPrice,
      adjustedRange,
      paddingTop,
      priceChartHeight,
      startIndex,
      totalBarSpace,
      candleWidth,
      paddingLeft,
      paddingRight,
    };

    // Max volume for volume scaling
    let maxVol = 1;
    visibleCandles.forEach((c) => {
      if (c.volume > maxVol) maxVol = c.volume;
    });

    // Helper functions for coordinate translation
    const getX = (index: number) => {
      const relIndex = index - startIndex;
      return paddingLeft + relIndex * totalBarSpace + candleWidth / 2;
    };

    const getY = (price: number) => {
      return paddingTop + priceChartHeight - ((price - minPrice) / adjustedRange) * priceChartHeight;
    };

    const getVolY = (vol: number) => {
      return paddingTop + priceChartHeight + volumeHeight - (vol / maxVol) * volumeHeight;
    };

    // --- THEME COLOR DEFINITIONS ---
    const bgColor = '#0f172a';
    const gridColor = '#1e293b';
    const axisTextColor = '#94a3b8';
    const timeTextColor = '#64748b';

    // --- DRAW BACKGROUND ---
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    // --- DRAW GRID LINES & PRICE LABELS ---
    const targetTickCount = Math.max(3, Math.min(12, Math.floor(priceChartHeight / 50)));
    const rawStep = adjustedRange / targetTickCount;

    const calculateNicePriceStep = (raw: number): number => {
      if (raw <= 0) return 1;
      const exponent = Math.floor(Math.log10(raw));
      const fraction = raw / Math.pow(10, exponent);

      let niceFraction: number;
      if (fraction < 1.4) niceFraction = 1;
      else if (fraction < 2.8) niceFraction = 2;
      else if (fraction < 7.0) niceFraction = 5;
      else niceFraction = 10;

      return niceFraction * Math.pow(10, exponent);
    };

    const priceStep = calculateNicePriceStep(rawStep);
    const startTick = Math.ceil(minPrice / priceStep) * priceStep;

    for (let p = startTick; p <= maxPrice; p += priceStep) {
      const y = getY(p);

      if (y >= paddingTop - 2 && y <= paddingTop + priceChartHeight + 2) {
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(paddingLeft, y);
        ctx.lineTo(width - paddingRight, y);
        ctx.stroke();

        // Price Tag on Right Axis (Clean round numbers: 5, 10, 20, 50, 100, 500, etc.)
        ctx.fillStyle = axisTextColor;
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`Rp ${Math.round(p).toLocaleString()}`, width - paddingRight + 8, y + 3);
      }
    }

    // Vertical Time Grid Lines
    const timeStep = Math.max(1, Math.floor(visibleCandles.length / 5));
    for (let i = 0; i < visibleCandles.length; i += timeStep) {
      const x = getX(startIndex + i);
      ctx.strokeStyle = gridColor;
      ctx.beginPath();
      ctx.moveTo(x, paddingTop);
      ctx.lineTo(x, height - paddingBottom);
      ctx.stroke();

      ctx.fillStyle = timeTextColor;
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(visibleCandles[i].time.slice(5), x, height - paddingBottom + 16);
    }

    // --- DRAW FAIR VALUE GAPS (FVG) ---
    if (showFvg) {
      stock.fvgs
        .filter((fvg) => !fvg.mitigated)
        .forEach((fvg) => {
        if (fvg.endIndex >= startIndex && fvg.startIndex <= endIndex) {
          const startX = Math.max(paddingLeft, getX(fvg.startIndex));
          const endX = Math.min(width - paddingRight, getX(fvg.endIndex));
          const topY = getY(fvg.top);
          const bottomY = getY(fvg.bottom);
          const rectHeight = Math.abs(bottomY - topY);

          if (rectHeight > 0) {
            ctx.fillStyle = fvg.type === 'bullish' ? 'rgba(16, 185, 129, 0.18)' : 'rgba(244, 63, 94, 0.18)';
            ctx.fillRect(startX, Math.min(topY, bottomY), endX - startX, rectHeight);

            ctx.strokeStyle = fvg.type === 'bullish' ? 'rgba(16, 185, 129, 0.6)' : 'rgba(244, 63, 94, 0.6)';
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 2]);
            ctx.strokeRect(startX, Math.min(topY, bottomY), endX - startX, rectHeight);
            ctx.setLineDash([]);

            // Label
            ctx.fillStyle = fvg.type === 'bullish' ? '#34d399' : '#f87171';
            ctx.font = '9px Inter, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(fvg.type === 'bullish' ? '1D Bullish FVG' : '1D Bearish FVG', startX + 4, Math.min(topY, bottomY) + 11);
          }
        }
      });
    }

    // --- DRAW ORDINARY PRICE GAPS ---
    if (showGaps && stock.priceGaps) {
      stock.priceGaps
        .filter((gap) => !gap.mitigated)
        .forEach((gap) => {
        if (gap.endIndex >= startIndex && gap.startIndex <= endIndex) {
          const startX = Math.max(paddingLeft, getX(gap.startIndex));
          const endX = Math.min(width - paddingRight, getX(gap.endIndex));
          const topY = getY(gap.top);
          const bottomY = getY(gap.bottom);
          const rectHeight = Math.abs(bottomY - topY);

          if (rectHeight > 0) {
            ctx.fillStyle = gap.type === 'bullish' ? 'rgba(14, 165, 233, 0.18)' : 'rgba(234, 88, 12, 0.18)';
            ctx.fillRect(startX, Math.min(topY, bottomY), endX - startX, rectHeight);

            ctx.strokeStyle = gap.type === 'bullish' ? 'rgba(56, 189, 248, 0.7)' : 'rgba(251, 146, 60, 0.7)';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.strokeRect(startX, Math.min(topY, bottomY), endX - startX, rectHeight);
            ctx.setLineDash([]);

            // Label
            ctx.fillStyle = gap.type === 'bullish' ? '#38bdf8' : '#fb923c';
            ctx.font = 'bold 9px Inter, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(gap.type === 'bullish' ? 'Price Gap (Gap Up)' : 'Price Gap (Gap Down)', startX + 4, Math.min(topY, bottomY) + 11);
          }
        }
      });
    }

    // --- DRAW ORDER BLOCKS (POI Demand / Supply Zones) ---
    if (showOrderBlocks) {
      stock.orderBlocks
        .filter((ob) => !ob.mitigated)
        .forEach((ob) => {
        if (ob.endIndex >= startIndex && ob.startIndex <= endIndex) {
          const startX = Math.max(paddingLeft, getX(ob.startIndex));
          const endX = Math.min(width - paddingRight, getX(ob.endIndex));
          const topY = getY(ob.top);
          const bottomY = getY(ob.bottom);
          const rectHeight = Math.abs(bottomY - topY);

          if (rectHeight > 0) {
            // Dark purple translucent box for Order Block
            ctx.fillStyle = ob.type === 'bullish' ? 'rgba(147, 51, 234, 0.25)' : 'rgba(225, 29, 72, 0.25)';
            ctx.fillRect(startX, Math.min(topY, bottomY), endX - startX, rectHeight);

            ctx.strokeStyle = ob.type === 'bullish' ? '#a855f7' : '#f43f5e';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(startX, Math.min(topY, bottomY), endX - startX, rectHeight);

            // Label
            ctx.fillStyle = '#e9d5ff';
            ctx.font = 'bold 9px Inter, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(ob.type === 'bullish' ? 'Demand Order Block (POI)' : 'Supply Order Block', startX + 4, Math.min(topY, bottomY) + 12);
          }
        }
      });
    }

    // --- DRAW BOS & CHOCH LINES ---
    if (showBosChoch) {
      const drawnLabelPositions: { x: number; y: number }[] = [];

      stock.bosChochLines.forEach((line) => {
        if (line.endIndex >= startIndex && line.startIndex <= endIndex) {
          const startX = getX(line.startIndex);
          const endX = getX(line.endIndex);
          const y = getY(line.price);

          ctx.strokeStyle = line.type === 'CHoCH' ? '#f59e0b' : '#38bdf8'; // Amber for CHoCH, Sky blue for BOS
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(startX, y);
          ctx.lineTo(endX, y);
          ctx.stroke();

          // Text label with collision avoidance
          const midX = (startX + endX) / 2;
          let labelY = y - 4;

          const collision = drawnLabelPositions.some(
            (pos) => Math.abs(pos.y - labelY) < 14 && Math.abs(pos.x - midX) < 70
          );
          if (collision) {
            labelY = y + 12; // Shift label below line if overlapping
          }
          drawnLabelPositions.push({ x: midX, y: labelY });

          ctx.fillStyle = line.type === 'CHoCH' ? '#fbbf24' : '#7dd3fc';
          ctx.font = 'bold 10px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`— ${line.label} —`, midX, labelY);
        }
      });
    }

    // --- DRAW LIQUIDITY SWEEPS ---
    if (showLiquidity) {
      stock.liquiditySweeps.forEach((sweep) => {
        if (sweep.index >= startIndex && sweep.index < endIndex) {
          const x = getX(sweep.index);
          const y = getY(sweep.price);

          ctx.fillStyle = sweep.type === 'BSL' ? '#f43f5e' : '#10b981';
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#f8fafc';
          ctx.font = 'bold 8px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(sweep.type, x, sweep.type === 'BSL' ? y - 8 : y + 12);
        }
      });
    }

    // --- DRAW CANDLESTICKS & VOLUME BARS ---
    for (let i = startIndex; i < endIndex; i++) {
      const c = candles[i];
      if (!c) continue;

      const x = getX(i);

      const isBull = c.close >= c.open;
      const candleColor = isBull ? '#089981' : '#f23645'; // TradingView exact candle colors!

      // Candle Wicks
      const highY = getY(c.high);
      const lowY = getY(c.low);
      ctx.strokeStyle = candleColor;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();

      // Candle Body
      const openY = getY(c.open);
      const closeY = getY(c.close);
      const bodyTop = Math.min(openY, closeY);
      const bodyHeight = Math.max(2, Math.abs(closeY - openY));

      ctx.fillStyle = candleColor;
      ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);

      // Volume Bar
      const volY = getVolY(c.volume);
      const volBaseY = paddingTop + priceChartHeight + volumeHeight;
      const volBarHeight = volBaseY - volY;

      // Volume Spike Highlight
      const vMa = stock.indicators.volumeMa20[i];
      const isVolumeSpike = vMa != null && c.volume > vMa * 1.3;

      ctx.fillStyle = isVolumeSpike
        ? isBull
          ? '#10b981'
          : '#ef4444'
        : isBull
        ? 'rgba(8, 153, 129, 0.4)'
        : 'rgba(242, 54, 69, 0.4)';

      ctx.fillRect(x - candleWidth / 2, volY, candleWidth, volBarHeight);

      if (isVolumeSpike) {
        ctx.strokeStyle = '#f59e0b'; // Amber outline for volume spike!
        ctx.lineWidth = 1;
        ctx.strokeRect(x - candleWidth / 2, volY, candleWidth, volBarHeight);
      }
    }

    // --- DRAW VOLUME MA LINE ---
    ctx.beginPath();
    let volMaStarted = false;
    for (let i = startIndex; i < endIndex; i++) {
      const vMa = stock.indicators.volumeMa20[i];
      if (vMa != null) {
        const x = getX(i);
        const y = getVolY(vMa);
        if (!volMaStarted) {
          ctx.moveTo(x, y);
          volMaStarted = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
    }
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // --- DRAW TICKER & STOCK INFO BADGE DIRECTLY ON CANVAS (FOR COPIED IMAGES) ---
    ctx.save();
    const tickerName = stock.ticker === '^JKSE' || stock.ticker === 'JKSE' ? 'IHSG' : stock.ticker;
    const priceText = `Rp ${(stock?.currentPrice ?? 0).toLocaleString()}`;
    const changeVal = stock?.changePercent24h ?? 0;
    const changeText = `${changeVal >= 0 ? '+' : ''}${changeVal.toFixed(2)}%`;
    const isUp = changeVal >= 0;

    const isMobile = width < 600;

    if (isMobile) {
      // Compact, unobtrusive single-line overlay for mobile screens that doesn't block chart candles
      const mobX = paddingLeft + 6;
      const mobY = paddingTop + 4;
      const mobWidth = Math.min(220, width - paddingLeft - paddingRight - 12);
      const mobHeight = 24;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (typeof (ctx as any).roundRect === 'function') {
        (ctx as any).roundRect(mobX, mobY, mobWidth, mobHeight, 6);
      } else {
        ctx.rect(mobX, mobY, mobWidth, mobHeight);
      }
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${tickerName}  ${priceText}`, mobX + 8, mobY + 16);

      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.fillStyle = isUp ? '#34d399' : '#f87171';
      ctx.fillText(`(${changeText})`, mobX + mobWidth - 55, mobY + 16);

      // Watermark top right
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.fillStyle = 'rgba(56, 189, 248, 0.8)';
      ctx.textAlign = 'right';
      ctx.fillText('SmartChart', width - paddingRight - 8, paddingTop + 18);
    } else {
      // Full Desktop Stock Badge
      const boxX = paddingLeft + 10;
      const boxY = paddingTop + 8;
      const boxWidth = Math.min(320, width - paddingLeft - paddingRight - 20);
      const boxHeight = 54;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.8)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (typeof (ctx as any).roundRect === 'function') {
        (ctx as any).roundRect(boxX, boxY, boxWidth, boxHeight, 8);
      } else {
        ctx.rect(boxX, boxY, boxWidth, boxHeight);
      }
      ctx.fill();
      ctx.stroke();

      // Ticker Symbol
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(tickerName, boxX + 12, boxY + 23);

      // Price & Percentage Change
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.fillStyle = isUp ? '#34d399' : '#f87171';
      ctx.fillText(`${priceText} (${changeText})`, boxX + 100, boxY + 22);

      // Full Company Name & Conglomerate Group
      ctx.font = '10px Inter, sans-serif';
      ctx.fillStyle = '#94a3b8';
      const subText = `${stock.name.length > 32 ? stock.name.slice(0, 30) + '...' : stock.name}${
        stock.conglomerate ? ` • ${stock.conglomerate}` : ''
      }`;
      ctx.fillText(subText, boxX + 12, boxY + 43);

      // Platform Branding / Watermark
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.fillStyle = 'rgba(56, 189, 248, 0.7)';
      ctx.textAlign = 'right';
      ctx.fillText('SmartChart • 1D (Daily)', width - paddingRight - 12, paddingTop + 22);
    }

    ctx.restore();

    // --- DRAW SAVED CUSTOM TRENDLINES ---
    customLines.forEach((line) => {
      const x1 = getX(line.p1.candleIndex);
      const y1 = getY(line.p1.price);
      const x2 = getX(line.p2.candleIndex);
      const y2 = getY(line.p2.price);

      const isP1Active =
        (hoveredEndpoint?.lineId === line.id && hoveredEndpoint?.point === 'p1') ||
        (draggingEndpoint?.lineId === line.id && draggingEndpoint?.point === 'p1');
      const isP2Active =
        (hoveredEndpoint?.lineId === line.id && hoveredEndpoint?.point === 'p2') ||
        (draggingEndpoint?.lineId === line.id && draggingEndpoint?.point === 'p2');

      // Line Body
      ctx.strokeStyle = line.color || '#06b6d4'; // Bright cyan
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // Endpoint 1 Handle Dot
      ctx.beginPath();
      ctx.arc(x1, y1, isP1Active ? 7 : 5, 0, Math.PI * 2);
      ctx.fillStyle = isP1Active ? '#f59e0b' : '#0891b2';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = isP1Active ? 2 : 1;
      ctx.stroke();

      // Endpoint 2 Handle Dot
      ctx.beginPath();
      ctx.arc(x2, y2, isP2Active ? 7 : 5, 0, Math.PI * 2);
      ctx.fillStyle = isP2Active ? '#f59e0b' : '#0891b2';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = isP2Active ? 2 : 1;
      ctx.stroke();
    });

    // --- DRAW ACTIVE TRENDLINE PREVIEW WHILE DRAWING ---
    if (isDrawingLine && lineFirstPoint) {
      const x1 = getX(lineFirstPoint.candleIndex);
      const y1 = getY(lineFirstPoint.price);
      const x2 = mousePosRef.current ? mousePosRef.current.x : x1;
      const y2 = mousePosRef.current ? mousePosRef.current.y : y1;

      ctx.strokeStyle = '#f59e0b'; // Amber highlight for preview line
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Point 1 anchor dot
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(x1, y1, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Point 2 cursor dot
      ctx.beginPath();
      ctx.arc(x2, y2, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // --- DRAW INSTRUCTION BANNER WHEN DRAWING MODE IS ACTIVE ---
    if (isDrawingLine) {
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.strokeStyle = lineFirstPoint ? '#f59e0b' : '#06b6d4';
      ctx.lineWidth = 1;
      const bannerW = 310;
      const bannerH = 26;
      const bannerX = paddingLeft + 10;
      const bannerY = paddingTop + 68; // Positioned below stock header box

      ctx.beginPath();
      if (typeof (ctx as any).roundRect === 'function') {
        (ctx as any).roundRect(bannerX, bannerY, bannerW, bannerH, 6);
      } else {
        ctx.rect(bannerX, bannerY, bannerW, bannerH);
      }
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = lineFirstPoint ? '#fbbf24' : '#38bdf8';
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.textAlign = 'left';
      const msg = lineFirstPoint
        ? '📍 Klik titik kedua (bisa di area kosong kanan)'
        : '✏️ Klik titik pertama untuk tarik garis';
      ctx.fillText(msg, bannerX + 10, bannerY + 17);
      ctx.restore();
    }

    // --- DRAW CROSSHAIR ON HOVER ---
    if (hoveredCandle) {
      const { x, y } = hoveredCandle;

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);

      // Vertical line
      ctx.beginPath();
      ctx.moveTo(x, paddingTop);
      ctx.lineTo(x, height - paddingBottom);
      ctx.stroke();

      // Horizontal line
      ctx.beginPath();
      ctx.moveTo(paddingLeft, y);
      ctx.lineTo(width - paddingRight, y);
      ctx.stroke();

      ctx.setLineDash([]);

      // Highlighted Price Badge on Right Axis for Crosshair at exact mouse Y position
      const hoverPrice = minPrice + ((paddingTop + priceChartHeight - y) / priceChartHeight) * adjustedRange;

      if (y >= paddingTop - 5 && y <= paddingTop + priceChartHeight + 5) {
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(width - paddingRight, y - 9, 82, 18);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`Rp ${Math.round(hoverPrice).toLocaleString()}`, width - paddingRight + 6, y + 3);
      }
    }
  }, [
    stock,
    zoomLevel,
    scrollOffset,
    priceOffset,
    showOrderBlocks,
    showFvg,
    showBosChoch,
    showLiquidity,
    showSupportResistance,
    showRiskRewardBox,
    hoveredCandle,
    priceScale,
    isDrawingLine,
    lineFirstPoint,
    customLines,
    hoveredEndpoint,
    draggingEndpoint,
  ]);

  // Handle Mouse Down on Right Axis, Endpoint Handles, or Chart Area
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    dragDistanceRef.current = 0;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const paddingRight = 85;

    // Check if user clicked on a trendline handle
    if (hoveredEndpoint) {
      setDraggingEndpoint(hoveredEndpoint);
      return;
    }

    if (isDrawingLine) {
      // Drawing mode active - do not start chart drag
      return;
    }

    if (x >= rect.width - paddingRight) {
      setIsDraggingAxis(true);
      dragStartY.current = e.clientY;
      dragStartScale.current = priceScale;
    } else {
      setIsDraggingChart(true);
      dragStartX.current = e.clientX;
      dragStartY.current = e.clientY;
      dragStartScrollOffset.current = scrollOffset;
      dragStartPriceOffset.current = priceOffset;
    }
  };

  // Handle Mouse Up
  const handleMouseUp = () => {
    setIsDraggingAxis(false);
    setIsDraggingChart(false);
    setDraggingEndpoint(null);
  };

  // Handle Canvas Click to Draw Custom Trendlines
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Prevent triggering click when user was dragging the chart, axis, or handle
    if (dragDistanceRef.current > 5) return;

    if (isDrawingLine) {
      const canvas = canvasRef.current;
      const bounds = currentChartBoundsRef.current;
      if (!canvas || !bounds) return;

      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Ensure click is inside the active price chart area
      if (mouseX < bounds.paddingLeft || mouseX > rect.width - bounds.paddingRight) return;
      if (mouseY < bounds.paddingTop || mouseY > bounds.paddingTop + bounds.priceChartHeight) return;

      const relX = mouseX - bounds.paddingLeft;
      // Index can extend beyond candles.length - 1 into right blank space!
      const candleIndex = bounds.startIndex + (relX - bounds.candleWidth / 2) / bounds.totalBarSpace;

      const fraction = (bounds.paddingTop + bounds.priceChartHeight - mouseY) / bounds.priceChartHeight;
      const priceAtY = Math.round(bounds.minPrice + fraction * bounds.adjustedRange);

      const targetCandle = candles[Math.min(candles.length - 1, Math.max(0, Math.floor(candleIndex)))];

      if (!lineFirstPoint) {
        setLineFirstPoint({
          candleIndex,
          price: priceAtY,
          time: targetCandle?.time || '',
        });
      } else {
        const p2 = {
          candleIndex,
          price: priceAtY,
          time: targetCandle?.time || '',
        };
        setCustomLines((prev) => [
          ...prev,
          {
            id: `line-${Date.now()}`,
            p1: lineFirstPoint,
            p2,
            color: '#06b6d4',
          },
        ]);
        setLineFirstPoint(null);
        setIsDrawingLine(false);
      }
    }
  };

  // Handle Double Click to Reset Scale & View
  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const paddingRight = 85;

    if (x >= rect.width - paddingRight) {
      setPriceScale(1.0);
      setPriceOffset(0);
    } else {
      setZoomLevel(1);
      setScrollOffset(-6);
      setPriceScale(1.0);
      setPriceOffset(0);
    }
  };

  // Handle Mouse Move for Hover Tooltip, Line Dragging & Chart Panning
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    mousePosRef.current = { x, y };

    const paddingRight = 85;
    const paddingLeft = 15;
    const chartWidth = rect.width - paddingLeft - paddingRight;

    // Handle Active Trendline Endpoint Dragging
    if (draggingEndpoint && currentChartBoundsRef.current) {
      dragDistanceRef.current += Math.abs(e.movementX) + Math.abs(e.movementY);
      const bounds = currentChartBoundsRef.current;
      const relX = x - bounds.paddingLeft;
      const newIndex = bounds.startIndex + (relX - bounds.candleWidth / 2) / bounds.totalBarSpace;
      const fraction = (bounds.paddingTop + bounds.priceChartHeight - y) / bounds.priceChartHeight;
      const newPrice = Math.round(bounds.minPrice + fraction * bounds.adjustedRange);

      setCustomLines((prev) =>
        prev.map((line) => {
          if (line.id !== draggingEndpoint.lineId) return line;
          const targetCandle = candles[Math.min(candles.length - 1, Math.max(0, Math.floor(newIndex)))];
          return {
            ...line,
            [draggingEndpoint.point]: {
              candleIndex: newIndex,
              price: newPrice,
              time: targetCandle?.time || '',
            },
          };
        })
      );
      return;
    }

    // Check if mouse is over right price axis
    const overAxis = x >= rect.width - paddingRight;
    setIsMouseOverAxis(overAxis);

    if (isDraggingChart || isDraggingAxis) {
      dragDistanceRef.current += Math.abs(e.movementX) + Math.abs(e.movementY);
      return;
    }

    // Check if hovering over any trendline handle dot
    let foundEndpoint: { lineId: string; point: 'p1' | 'p2' } | null = null;
    if (!isDrawingLine && customLines.length > 0 && currentChartBoundsRef.current) {
      const bounds = currentChartBoundsRef.current;
      for (const line of customLines) {
        const x1 = bounds.paddingLeft + (line.p1.candleIndex - bounds.startIndex) * bounds.totalBarSpace + bounds.candleWidth / 2;
        const y1 = bounds.paddingTop + bounds.priceChartHeight - ((line.p1.price - bounds.minPrice) / bounds.adjustedRange) * bounds.priceChartHeight;
        const x2 = bounds.paddingLeft + (line.p2.candleIndex - bounds.startIndex) * bounds.totalBarSpace + bounds.candleWidth / 2;
        const y2 = bounds.paddingTop + bounds.priceChartHeight - ((line.p2.price - bounds.minPrice) / bounds.adjustedRange) * bounds.priceChartHeight;

        if (Math.hypot(x - x1, y - y1) <= 12) {
          foundEndpoint = { lineId: line.id, point: 'p1' };
          break;
        }
        if (Math.hypot(x - x2, y - y2) <= 12) {
          foundEndpoint = { lineId: line.id, point: 'p2' };
          break;
        }
      }
    }
    setHoveredEndpoint(foundEndpoint);

    // Standard Candle Hover Tooltip Calculation
    const baseCandleWidth = 10;
    const candleWidth = Math.max(3, Math.min(40, baseCandleWidth * zoomLevel));
    const candleGap = Math.max(1, candleWidth * 0.25);
    const totalBarSpace = candleWidth + candleGap;

    const visibleCandlesCount = Math.floor(chartWidth / totalBarSpace);
    const endIndex = Math.max(visibleCandlesCount, candles.length - Math.floor(scrollOffset));
    const startIndex = Math.max(0, endIndex - visibleCandlesCount);

    const relX = x - paddingLeft;
    const hoveredIdx = startIndex + Math.floor(relX / totalBarSpace);

    if (hoveredIdx >= 0 && hoveredIdx < candles.length) {
      setHoveredCandle({
        candle: candles[hoveredIdx],
        index: hoveredIdx,
        x,
        y,
      });
    } else {
      setHoveredCandle(null);
    }
  };

  // Touch Handlers for Mobile Chart Gesture Drag, Price Scale Adjust & Pinch Zoom
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    dragDistanceRef.current = 0;
    const rect = canvas.getBoundingClientRect();
    const paddingRight = 85;

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;

      touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
      dragStartX.current = touch.clientX;
      dragStartY.current = touch.clientY;
      dragStartScrollOffset.current = scrollOffset;
      dragStartPriceOffset.current = priceOffset;
      dragStartScale.current = priceScale;

      if (x >= rect.width - paddingRight) {
        setIsDraggingAxis(true);
        isTouchDraggingAxis.current = true;
      } else {
        setIsDraggingChart(true);
        isTouchDraggingChart.current = true;

        // Mobile touch readout tooltip for candle
        const paddingLeft = 15;
        const chartWidth = rect.width - paddingLeft - paddingRight;
        const baseCandleWidth = 10;
        const candleWidth = Math.max(3, Math.min(40, baseCandleWidth * zoomLevel));
        const candleGap = Math.max(1, candleWidth * 0.25);
        const totalBarSpace = candleWidth + candleGap;
        const visibleCandlesCount = Math.floor(chartWidth / totalBarSpace);
        const endIndex = Math.max(visibleCandlesCount, candles.length - Math.floor(scrollOffset));
        const startIndex = Math.max(0, endIndex - visibleCandlesCount);

        const relX = x - paddingLeft;
        const hoveredIdx = startIndex + Math.floor(relX / totalBarSpace);

        if (hoveredIdx >= 0 && hoveredIdx < candles.length) {
          setHoveredCandle({
            candle: candles[hoveredIdx],
            index: hoveredIdx,
            x,
            y,
          });
        }
      }
    } else if (e.touches.length === 2) {
      // 2-finger pinch gesture start
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      touchStartPinchDistRef.current = dist;
      touchStartZoomRef.current = zoomLevel;
      touchStartScaleRef.current = priceScale;
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (e.touches.length === 1 && touchStartPosRef.current) {
      const touch = e.touches[0];
      const deltaX = touch.clientX - dragStartX.current;
      const deltaY = touch.clientY - dragStartY.current;

      dragDistanceRef.current += Math.abs(deltaX) + Math.abs(deltaY);

      if (isTouchDraggingChart.current) {
        const baseCandleWidth = 10;
        const candleWidth = Math.max(3, Math.min(40, baseCandleWidth * zoomLevel));
        const candleGap = Math.max(1, candleWidth * 0.25);
        const totalBarSpace = candleWidth + candleGap;

        // 1. Horizontal Drag (X Axis)
        const candleOffset = deltaX / totalBarSpace;
        const maxOffset = Math.max(0, candles.length - 10);
        const minOffset = -20;
        const newOffset = Math.max(minOffset, Math.min(maxOffset, dragStartScrollOffset.current + candleOffset));
        setScrollOffset(newOffset);

        // 2. Vertical Drag (Y Axis)
        const newPriceOffset = dragStartPriceOffset.current + deltaY * pricePerPixelRef.current;
        setPriceOffset(newPriceOffset);
      } else if (isTouchDraggingAxis.current) {
        const deltaAxisY = dragStartY.current - touch.clientY;
        const factor = 1 + deltaAxisY * 0.008;
        const newScale = Math.max(0.1, Math.min(10.0, dragStartScale.current * factor));
        setPriceScale(newScale);
      }
    } else if (e.touches.length === 2 && touchStartPinchDistRef.current) {
      // Pinch zoom handling
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const currentDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const scaleFactor = currentDist / touchStartPinchDistRef.current;

      const newZoom = Math.max(0.4, Math.min(3.0, touchStartZoomRef.current * scaleFactor));
      setZoomLevel(newZoom);
    }
  };

  const handleTouchEnd = () => {
    setIsDraggingChart(false);
    setIsDraggingAxis(false);
    isTouchDraggingChart.current = false;
    isTouchDraggingAxis.current = false;
    touchStartPosRef.current = null;
    touchStartPinchDistRef.current = null;
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[620px]">
      {/* Top Controls Bar */}
      <div className="bg-slate-950 border-b border-slate-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Stock Title Info */}
        <div className="flex items-center gap-3">
          <div className="flex items-baseline gap-2">
            <span className="font-black text-lg text-white">
              {stock.ticker === '^JKSE' || stock.ticker === 'JKSE' ? 'IHSG' : stock.ticker}
            </span>
            <span className="text-slate-400 font-medium truncate max-w-[150px] sm:max-w-xs">
              {stock.name}
            </span>
          </div>
          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono text-[11px] font-bold border border-emerald-500/20">
            Rp {(stock?.currentPrice ?? 0).toLocaleString()}
          </span>
          <span
            className={`font-semibold font-mono ${
              (stock?.changePercent24h ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {(stock?.changePercent24h ?? 0) >= 0 ? '+' : ''}
            {(stock?.changePercent24h ?? 0).toFixed(2)}%
          </span>

          {/* Add to Watchlist Button */}
          {onToggleWatchlist && (
            <button
              onClick={() => onToggleWatchlist(stock.ticker)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                isWatchlisted
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
              title={isWatchlisted ? 'Hapus dari Watchlist' : 'Tambah ke Watchlist'}
            >
              <Star
                className={`w-3.5 h-3.5 ${
                  isWatchlisted ? 'fill-amber-400 text-amber-400' : 'text-slate-400'
                }`}
              />
              <span>{isWatchlisted ? 'In Watchlist' : 'Add to Watchlist'}</span>
            </button>
          )}
        </div>

        {/* Timeframe Selectors & Overlay Toggles */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Fixed 1D Daily Timeframe Badge */}
          <div className="bg-slate-900 border border-emerald-500/30 rounded-lg px-2.5 py-1 text-[11px] font-bold text-emerald-400 font-mono flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>1D (Daily)</span>
          </div>

          {/* Toggle Switches */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg p-1">
            <button
              onClick={() => setShowFvg(!showFvg)}
              className={`px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer ${
                showFvg ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-slate-500'
              }`}
              title="Toggle Fair Value Gaps (FVG)"
            >
              FVG
            </button>

            <button
              onClick={() => setShowGaps(!showGaps)}
              className={`px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer ${
                showGaps ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'text-slate-500'
              }`}
              title="Toggle Ordinary Price Jump Gaps"
            >
              Gaps
            </button>

            <button
              onClick={() => setShowOrderBlocks(!showOrderBlocks)}
              className={`px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer ${
                showOrderBlocks ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'text-slate-500'
              }`}
              title="Toggle Order Blocks / Point of Interest (POI)"
            >
              OrderBlock
            </button>

            <button
              onClick={() => setShowBosChoch(!showBosChoch)}
              className={`px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer ${
                showBosChoch ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-slate-500'
              }`}
              title="Toggle BOS & CHoCH Lines"
            >
              BOS/CHoCH
            </button>
          </div>

          {/* Trendline Drawing Tool */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
            <button
              onClick={() => {
                setIsDrawingLine(!isDrawingLine);
                if (isDrawingLine) setLineFirstPoint(null);
              }}
              className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                isDrawingLine
                  ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-400/60 shadow-sm animate-pulse'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
              title="Tambah Garis Tren (Klik 2 titik di chart)"
            >
              <PenTool className="w-3.5 h-3.5 text-cyan-400" />
              <span>
                {isDrawingLine
                  ? lineFirstPoint
                    ? 'Klik Titik 2...'
                    : 'Klik Titik 1...'
                  : 'Tambah Garis'}
              </span>
            </button>

            {customLines.length > 0 && (
              <button
                onClick={() => {
                  setCustomLines([]);
                  setLineFirstPoint(null);
                }}
                className="px-2 py-1 rounded text-[11px] font-bold text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 flex items-center gap-1 transition-all cursor-pointer"
                title="Hapus Semua Garis Tren"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="font-mono text-[10px]">({customLines.length})</span>
              </button>
            )}
          </div>

          {/* Copy Image Button */}
          <button
            onClick={handleCopyChartImage}
            className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-lg px-2.5 py-1 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
            title="Copy or download current chart snapshot"
          >
            {copyStatus ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-300 font-mono text-[11px]">{copyStatus}</span>
              </>
            ) : (
              <>
                <Camera className="w-3.5 h-3.5 text-emerald-400" />
                <span>Copy Chart Image</span>
              </>
            )}
          </button>

          {/* Zoom Buttons */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1 text-slate-400">
            <button
              onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.2))}
              className="p-1 hover:text-white cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.2))}
              className="p-1 hover:text-white cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                setZoomLevel(1);
                setScrollOffset(-6);
                setPriceScale(1.0);
                setPriceOffset(0);
              }}
              className="p-1 hover:text-white cursor-pointer"
              title="Reset View & Scale"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Interactive Canvas Area */}
      <div ref={containerRef} className="relative flex-1 bg-slate-950">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onClick={handleCanvasClick}
          onDoubleClick={handleDoubleClick}
          onMouseMove={handleMouseMove}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          onMouseLeave={() => {
            setHoveredCandle(null);
            setIsDraggingAxis(false);
            setIsDraggingChart(false);
            setIsMouseOverAxis(false);
            setHoveredEndpoint(null);
            setDraggingEndpoint(null);
          }}
          className={`w-full h-full block touch-none ${
            draggingEndpoint
              ? 'cursor-grabbing'
              : hoveredEndpoint
              ? 'cursor-grab'
              : isDraggingAxis || isMouseOverAxis
              ? 'cursor-ns-resize'
              : isDraggingChart
              ? 'cursor-grabbing'
              : 'cursor-crosshair'
          }`}
        />

        {/* Hover Candle Data Readout Tooltip */}
        {hoveredCandle && (
          <div className="absolute top-3 left-4 bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 shadow-xl text-[11px] font-mono flex items-center gap-4 z-20 backdrop-blur-md">
            <span className="text-slate-400">{hoveredCandle.candle.time}</span>
            <span className="text-slate-200">
              O: <strong className="text-white">{hoveredCandle.candle.open}</strong>
            </span>
            <span className="text-slate-200">
              H: <strong className="text-emerald-400">{hoveredCandle.candle.high}</strong>
            </span>
            <span className="text-slate-200">
              L: <strong className="text-rose-400">{hoveredCandle.candle.low}</strong>
            </span>
            <span className="text-slate-200">
              C: <strong className="text-white">{hoveredCandle.candle.close}</strong>
            </span>
            <span className="text-slate-200">
              Vol: <strong className="text-teal-300">{(hoveredCandle.candle.volume / 1000000).toFixed(1)}M</strong>
            </span>
          </div>
        )}

        {/* Chart Legend Footer */}
        <div className="absolute bottom-2 left-4 right-20 bg-slate-950/80 border border-slate-800/80 rounded-lg px-3 py-1.5 text-[10px] font-mono text-slate-400 flex flex-wrap items-center justify-between gap-3 pointer-events-none z-10">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-emerald-500/40 border border-emerald-400 inline-block" />
              <span>Bullish FVG</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-sky-500/40 border border-sky-400 inline-block" />
              <span>Price Gap</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-purple-500/40 border border-purple-400 inline-block" />
              <span>Demand Order Block (POI)</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-amber-400 inline-block" />
              <span>CHoCH Line</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-sky-400 inline-block" />
              <span>BOS Line</span>
            </span>
          </div>

          <div className="text-slate-300 font-bold">
            LONG Position: R:R 1:{stock?.recommendation?.riskRewardRatio ?? 0} | TP1 +10% | TP2 +20% | SL 4%
          </div>
        </div>
      </div>
    </div>
  );
};
