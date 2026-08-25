import React, { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, Clock3, Database, Info, ShieldCheck } from 'lucide-react';
import type { NaraEvidenceItem, NaraSummary } from '../types';

interface InventoryMeta {
  selectedBrokerCount: number;
  requestedStartDate: string;
  requestedEndDate: string;
  validPointCount: number;
  missingDateCount: number;
  source: string;
}

interface NaraSummaryPanelProps {
  summary?: NaraSummary;
  variant: 'CHART' | 'INVENTORY';
  loading?: boolean;
  inventoryMeta?: InventoryMeta;
}

const headlineLabels: Record<string, string> = {
  'nara.chart.bullish_context': 'Konteks bullish terdeteksi dari POI aktif',
  'nara.chart.risk_elevated': 'Konteks risiko dari POI bearish langsung',
  'nara.chart.neutral_context': 'Belum ada konteks arah yang dominan',
  'nara.chart.insufficient_data': 'Data chart belum cukup untuk ringkasan NARA',
  'nara.inventory.selected_flow_bullish_context': 'Selected-broker net flow pada periode terpilih bernilai positif',
  'nara.inventory.selected_flow_risk_context': 'Selected-broker net flow pada periode terpilih bernilai negatif',
  'nara.inventory.selected_flow_neutral_context': 'Selected-broker net flow pada periode terpilih belum mengarah',
  'nara.inventory.insufficient_data': 'Coverage flow broker belum cukup',
};

const stanceLabels: Record<NaraSummary['stance'], string> = {
  BULLISH_CONTEXT: 'BULLISH CONTEXT',
  RISK_ELEVATED: 'RISK ELEVATED',
  NEUTRAL: 'NEUTRAL',
  INSUFFICIENT_DATA: 'INSUFFICIENT DATA',
};

const sourceLabels: Record<string, string> = {
  REAL: 'OHLCV real',
  EXTERNAL: 'Provider eksternal',
  SYNTHETIC: 'Synthetic',
  UNKNOWN: 'Sumber tidak diketahui',
};

const sourceTypeLabels: Record<string, string> = {
  ORDER_BLOCK: 'Order Block',
  FVG: 'FVG',
  OPENING_GAP: 'Opening gap',
  SUPPORT: 'Support',
  RESISTANCE: 'Resistance',
  BOS: 'BOS',
  CHOCH: 'CHoCH',
  TREND: 'Trend',
  VOLUME: 'Volume',
  BROKER_FLOW: 'Broker flow terpilih',
  RISK_REWARD: 'Execution cost',
  DATA_QUALITY: 'Kualitas data',
};

const reasonLabels: Record<string, string> = {
  ACTIVE_REMAINING_BOUNDS: 'Zona masih memiliki bounds aktif',
  FORMATION_CANDLE_NOT_TAPPED: 'Candle formation belum memasuki fase tap',
  ZONE_REMAINING_BOUNDS_NOT_ACTIVE: 'Bounds tersisa tidak aktif',
  CURRENT_PRICE_RELEVANT_BULLISH_POI: 'Harga saat ini relevan dengan bullish POI',
  DIRECT_OPPOSING_BEARISH_POI: 'Ada POI bearish yang berhadapan langsung',
  EXACT_OB_FVG_SEQUENCE: 'OB dan FVG berasal dari sequence yang sama',
  FVG_SEPARATE_FROM_NEARBY_POI_UNLESS_EXACT: 'FVG nearby tetap dipisahkan bila sequence tidak exact',
  OPENING_GAP_CURRENT_OPEN_EQUALS_OB_FORMATION: 'Opening gap cocok dengan candle formation OB',
  OPENING_GAP_UNPROVEN_LINK_SEPARATE_FAMILY: 'Link opening gap tidak terbukti, jadi dipisahkan',
  SUPPORT_RESISTANCE_CONTEXT: 'Level support/resistance sebagai konteks',
  CURRENT_PRICE_NEAR_LEVEL: 'Harga saat ini dekat dengan level',
  SR_RELATED_TO_POI_ONLY_IF_WITHIN_ONE_TICK: 'Relasi ke POI dibatasi satu tick',
  STRUCTURE_CONTEXT_ONLY_NO_WEIGHT: 'Struktur hanya konteks dan tidak diberi bobot',
  BEARISH_CHOCH_RISK_CONTEXT_ONLY: 'Bearish CHoCH hanya konteks risiko',
  TREND_CONTEXT_ONLY_NO_WEIGHT: 'Trend hanya konteks dan tidak diberi bobot',
  VOLUME_PARTICIPATION_CONTEXT: 'Volume sebagai konteks partisipasi',
  EXECUTION_COST_UNAVAILABLE: 'Execution cost tidak tersedia; hanya konteks',
  SELECTED_BROKER_FLOW_ONLY: 'Selected-broker net flow pada periode terpilih',
  NET_LOTS_VALUE_CONFLICT: 'Net lots dan net value memiliki arah yang konflik',
  MISSING_PROVIDER_DATES_NO_ZERO_FILL: 'Tanggal provider yang hilang tidak diisi nol',
  PROVIDER_DATE_COVERAGE_PARTIAL_NO_ZERO_FILL: 'Coverage tanggal parsial; tidak ada zero-fill',
  SYNTHETIC_SOURCE: 'Sumber synthetic tidak dipakai sebagai bukti positif',
  SOURCE_TICKER_MISMATCH: 'Ticker sumber tidak cocok',
  SOURCE_MISMATCH: 'Source discriminator tidak cocok',
  TIMEFRAME_MISMATCH: 'Timeframe sumber tidak cocok',
  SOURCE_AS_OF_MISMATCH: 'As-of sumber tidak cocok',
  AS_OF_MISMATCH: 'As-of tidak sama dengan candle terakhir',
  AS_OF_NOT_IN_CANDLES: 'As-of tidak ditemukan di candle',
  OHLCV_EMPTY: 'Candle OHLCV kosong',
  OHLCV_MALFORMED: 'Ada candle OHLCV malformed',
  CANDLE_ORDER_INVALID: 'Urutan candle tidak valid',
  TICKER_MISSING: 'Ticker tidak tersedia',
  EXTERNAL_SOURCE_REQUIRED: 'Memerlukan source broker eksternal',
  COVERAGE_METADATA_MISSING: 'Metadata coverage tidak tersedia',
  BROKER_SUMMARY_INCOMPLETE: 'Broker summary belum lengkap',
  BROKER_ACCUMULATION_INCOMPLETE: 'Broker accumulation belum lengkap',
  SELECTED_BROKER_EMPTY: 'Belum ada broker yang dipilih',
  SELECTED_BROKER_SERIES_MISSING: 'Series broker terpilih tidak tersedia',
  CANDLE_FLOW_DATE_INTERSECTION_MISSING: 'Tanggal flow tidak beririsan dengan candle',
  REQUESTED_START_MISMATCH: 'Awal periode request tidak cocok',
  REQUESTED_END_MISMATCH: 'Akhir periode request tidak cocok',
  RETURNED_START_MISMATCH: 'Awal periode provider tidak cocok',
  RETURNED_END_MISMATCH: 'Akhir periode provider tidak cocok',
  BROKER_SUMMARY_RANGE_MISSING: 'Rentang broker summary tidak tersedia',
  BROKER_ACCUMULATION_RANGE_MISSING: 'Rentang broker accumulation tidak tersedia',
  BROKER_SUMMARY_RANGE_MISMATCH: 'Rentang broker summary tidak cocok dengan request',
  BROKER_ACCUMULATION_RANGE_MISMATCH: 'Rentang broker accumulation tidak cocok dengan request',
  BROKER_ENDPOINT_RANGE_MISMATCH: 'Rentang summary dan accumulation tidak sama',
  TICKER_MISMATCH: 'Ticker summary dan accumulation tidak cocok',
};

function reasonLabel(reason: string): string {
  const [key, value] = reason.split(':', 2);
  if (key === 'SELECTED_BROKER_COUNT') return `Broker terpilih: ${value || '0'}`;
  if (key === 'BREADTH_POSITIVE') return `Breadth positif: ${value || '0'}`;
  if (key === 'BREADTH_NEGATIVE') return `Breadth negatif: ${value || '0'}`;
  if (key === 'BREADTH_NET') return `Breadth net: ${value || '0'}`;
  if (key === 'PERSISTENCE_POINTS') return `Titik persistence valid: ${value || '0'}`;
  return reasonLabels[reason] || reasonLabels[key] || 'Fakta rule-based tersedia';
}

function evidenceLabel(item: NaraEvidenceItem): string {
  return sourceTypeLabels[item.sourceType] || 'Evidence';
}

function EvidenceRow({ item, kind }: { item: NaraEvidenceItem; kind: 'opportunity' | 'risk' | 'context' | 'unknown' }) {
  const tone = kind === 'opportunity'
    ? 'border-emerald-500/25 bg-emerald-500/5'
    : kind === 'risk'
      ? 'border-rose-500/25 bg-rose-500/5'
      : kind === 'unknown'
        ? 'border-amber-500/25 bg-amber-500/5'
        : 'border-slate-700/80 bg-slate-950/50';
  return (
    <div className={`rounded-xl border p-2.5 ${tone}`}>
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="font-bold text-slate-200">{evidenceLabel(item)}</span>
        <span className="font-mono text-slate-500">{item.state}</span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-slate-400">
        <span>{item.direction}</span>
        <span>{item.freshnessTier}</span>
        {item.ageTradingDays !== undefined && <span>{item.ageTradingDays} hari bursa</span>}
        {item.relatedEvidenceIds.length > 0 && <span>{item.relatedEvidenceIds.length} related</span>}
      </div>
      {item.reasons.length > 0 && (
        <div className="mt-1.5 text-[10px] leading-relaxed text-slate-400">
          {item.reasons.slice(0, 3).map((reason) => reasonLabel(reason)).join(' · ')}
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  items,
  kind,
  defaultOpen = true,
}: {
  title: string;
  items: NaraEvidenceItem[];
  kind: 'opportunity' | 'risk' | 'context' | 'unknown';
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/35">
      <button className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left" onClick={() => setOpen((value) => !value)}>
        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-300">{title} ({items.length})</span>
        <ChevronDown className={`h-3.5 w-3.5 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && items.length > 0 && (
        <div className="space-y-2 border-t border-slate-800/80 p-2.5">
          {items.map((item) => <EvidenceRow key={item.evidenceId} item={item} kind={kind} />)}
        </div>
      )}
      {open && items.length === 0 && <div className="border-t border-slate-800/80 px-3 py-2 text-[10px] text-slate-500">Tidak ada evidence pada kelompok ini.</div>}
    </div>
  );
}

export const NaraSummaryPanel: React.FC<NaraSummaryPanelProps> = ({ summary, variant, loading = false, inventoryMeta }) => {
  const [showDetails, setShowDetails] = useState(false);
  const grouped = useMemo(() => {
    if (!summary) return { opportunity: [], risk: [], context: [], unknown: [] };
    const opportunity = new Set(summary.opportunityEvidenceIds);
    const risk = new Set(summary.riskEvidenceIds);
    const unknown = new Set(summary.unknownEvidenceIds);
    return {
      opportunity: summary.evidence.filter((item) => opportunity.has(item.evidenceId)),
      risk: summary.evidence.filter((item) => risk.has(item.evidenceId)),
      context: summary.evidence.filter((item) => !opportunity.has(item.evidenceId) && !risk.has(item.evidenceId) && !unknown.has(item.evidenceId)),
      unknown: summary.evidence.filter((item) => unknown.has(item.evidenceId)),
    };
  }, [summary]);

  if (loading) {
    return <div className="min-h-[180px] animate-pulse rounded-2xl border border-slate-800 bg-slate-900/70 p-4" aria-label="NARA sedang memuat" />;
  }

  if (!summary) {
    return <div className="min-h-[180px] rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-xs text-slate-400">NARA Summary belum tersedia.</div>;
  }

  const tone = summary.stance === 'BULLISH_CONTEXT'
    ? 'border-emerald-500/30 bg-emerald-500/5'
    : summary.stance === 'RISK_ELEVATED'
      ? 'border-rose-500/30 bg-rose-500/5'
      : summary.stance === 'INSUFFICIENT_DATA'
        ? 'border-amber-500/30 bg-amber-500/5'
        : 'border-cyan-500/25 bg-cyan-500/5';

  return (
    <section className={`rounded-2xl border p-4 shadow-xl ${tone}`} aria-label={`${variant} NARA Summary`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-black tracking-wide text-white">NARA Summary</h2>
            <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold text-cyan-300">Rule-based</span>
            <span className="rounded-full border border-slate-700 bg-slate-950/70 px-2 py-0.5 text-[10px] font-bold text-slate-300">{stanceLabels[summary.stance]}</span>
          </div>
          <p className="mt-1 text-xs text-slate-300">{headlineLabels[summary.headline.key] || 'Ringkasan rule-based tersedia'}</p>
        </div>
        <div className="text-right text-[10px] text-slate-400">
          <div className="flex items-center justify-end gap-1"><Clock3 className="h-3 w-3" /> As-of {summary.asOfDate || '—'} · 1D</div>
          <div className="mt-1 flex items-center justify-end gap-1"><Database className="h-3 w-3" /> {sourceLabels[summary.provenance.source] || summary.provenance.source}</div>
        </div>
      </div>

      {variant === 'INVENTORY' && inventoryMeta && (
        <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-slate-800 bg-slate-950/50 p-2.5 text-[10px] text-slate-400 sm:grid-cols-4">
          <span>Broker dipilih<strong className="block text-slate-200">{inventoryMeta.selectedBrokerCount}</strong></span>
          <span>Periode<strong className="block text-slate-200">{inventoryMeta.requestedStartDate} → {inventoryMeta.requestedEndDate}</strong></span>
          <span>Titik valid<strong className="block text-slate-200">{inventoryMeta.validPointCount}</strong></span>
          <span>Source<strong className="block text-slate-200">{sourceLabels[inventoryMeta.source] || inventoryMeta.source}</strong></span>
        </div>
      )}

      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <Section title="Opportunity" items={grouped.opportunity} kind="opportunity" />
        <Section title="Risk" items={grouped.risk} kind="risk" />
      </div>

      <button className="mt-3 flex items-center gap-1 text-[10px] font-bold text-cyan-300" onClick={() => setShowDetails((value) => !value)}>
        <Info className="h-3 w-3" /> {showDetails ? 'Sembunyikan detail konteks' : 'Tampilkan konteks dan data quality'}
        <ChevronDown className={`h-3 w-3 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
      </button>
      {showDetails && (
        <div className="mt-2 space-y-2">
          <Section title="Context / related" items={grouped.context} kind="context" />
          <Section title="Unknown / batasan" items={grouped.unknown} kind="unknown" />
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-[10px] leading-relaxed text-slate-400">
            <div className="flex items-center gap-1 font-bold text-slate-300"><ShieldCheck className="h-3 w-3 text-cyan-400" /> Data quality: {summary.dataQuality.status}</div>
            <div className="mt-1">Freshness display: {summary.dataQuality.freshnessTier}. Provenance rule: {summary.provenance.ruleVersion}.</div>
            {summary.dataQuality.reasons.length > 0 && <div className="mt-1">{summary.dataQuality.reasons.map(reasonLabel).join(' · ')}</div>}
            {inventoryMeta && inventoryMeta.missingDateCount > 0 && <div className="mt-1">Tanggal provider hilang: {inventoryMeta.missingDateCount}; persistence tidak di-zero-fill.</div>}
          </div>
        </div>
      )}

      <div className="mt-3 flex items-start gap-2 border-t border-slate-800/80 pt-3 text-[10px] leading-relaxed text-slate-500">
        {summary.stance === 'INSUFFICIENT_DATA' ? <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-400" /> : <Info className="mt-0.5 h-3 w-3 shrink-0 text-slate-500" />}
        <span>Data kepemilikan resmi bertanggal tidak tersedia; broker flow bukan ownership. Konteks berbasis aturan, bukan nasihat investasi.</span>
      </div>
    </section>
  );
};
