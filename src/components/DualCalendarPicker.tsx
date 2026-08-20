import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Check, AlertCircle, X, Sparkles } from 'lucide-react';

interface DualCalendarPickerProps {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  onApply: (startDate: string, endDate: string) => void;
  onClose: () => void;
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const DAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

export const DualCalendarPicker: React.FC<DualCalendarPickerProps> = ({
  startDate,
  endDate,
  onApply,
  onClose,
}) => {
  const [tempStart, setTempStart] = useState<string>(startDate || getMonthsAgoDateStr(3));
  const [tempEnd, setTempEnd] = useState<string>(endDate || getTodayDateStr());

  // Parse start year/month for Calendar 1
  const startD = tempStart ? new Date(tempStart) : new Date();
  const [startYear, setStartYear] = useState<number>(
    isNaN(startD.getFullYear()) ? new Date().getFullYear() : startD.getFullYear()
  );
  const [startMonth, setStartMonth] = useState<number>(
    isNaN(startD.getMonth()) ? Math.max(0, new Date().getMonth() - 3) : startD.getMonth()
  );

  // Parse end year/month for Calendar 2
  const endD = tempEnd ? new Date(tempEnd) : new Date();
  const [endYear, setEndYear] = useState<number>(
    isNaN(endD.getFullYear()) ? new Date().getFullYear() : endD.getFullYear()
  );
  const [endMonth, setEndMonth] = useState<number>(
    isNaN(endD.getMonth()) ? new Date().getMonth() : endD.getMonth()
  );

  // Quick preset intervals
  const handlePreset = (monthsBack: number, isYtd = false) => {
    const today = new Date();
    const todayStr = formatDate(today);
    let sDateStr = '';

    if (isYtd) {
      sDateStr = `${today.getFullYear()}-01-01`;
    } else {
      const past = new Date(today);
      past.setMonth(past.getMonth() - monthsBack);
      sDateStr = formatDate(past);
    }

    setTempStart(sDateStr);
    setTempEnd(todayStr);

    const sD = new Date(sDateStr);
    setStartYear(sD.getFullYear());
    setStartMonth(sD.getMonth());

    setEndYear(today.getFullYear());
    setEndMonth(today.getMonth());
  };

  // Validation: End Date must be strictly greater than Start Date
  const isDateValid = Boolean(tempStart && tempEnd && tempEnd > tempStart);

  // Calculate day difference
  const daysDiff = isDateValid
    ? Math.round((new Date(tempEnd).getTime() - new Date(tempStart).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  // Month navigation for calendar 1 (Start)
  const prevStartMonth = () => {
    if (startMonth === 0) {
      setStartMonth(11);
      setStartYear((y) => y - 1);
    } else {
      setStartMonth((m) => m - 1);
    }
  };

  const nextStartMonth = () => {
    if (startMonth === 11) {
      setStartMonth(0);
      setStartYear((y) => y + 1);
    } else {
      setStartMonth((m) => m + 1);
    }
  };

  // Month navigation for calendar 2 (End)
  const prevEndMonth = () => {
    if (endMonth === 0) {
      setEndMonth(11);
      setEndYear((y) => y - 1);
    } else {
      setEndMonth((m) => m - 1);
    }
  };

  const nextEndMonth = () => {
    if (endMonth === 11) {
      setEndMonth(0);
      setEndYear((y) => y + 1);
    } else {
      setEndMonth((m) => m + 1);
    }
  };

  // Helper to build 42 cells grid (6 rows x 7 days)
  const renderCalendarDays = (
    year: number,
    month: number,
    isStartCalendar: boolean
  ) => {
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const cells = [];

    // Previous month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      cells.push(
        <div
          key={`prev-${dayNum}`}
          className="h-8 w-8 flex items-center justify-center text-[11px] text-slate-600 font-mono"
        >
          {dayNum}
        </div>
      );
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isStart = tempStart === dateStr;
      const isEnd = tempEnd === dateStr;
      const isInRange = tempStart && tempEnd && dateStr > tempStart && dateStr < tempEnd;

      let cellStyle = 'hover:bg-slate-800 text-slate-300';
      if (isStart) {
        cellStyle = 'bg-cyan-500 text-slate-950 font-black shadow-lg shadow-cyan-500/30 scale-105 z-10';
      } else if (isEnd) {
        cellStyle = 'bg-emerald-500 text-slate-950 font-black shadow-lg shadow-emerald-500/30 scale-105 z-10';
      } else if (isInRange) {
        cellStyle = 'bg-cyan-950/60 text-cyan-200 font-medium border-y border-cyan-800/30';
      }

      cells.push(
        <button
          key={dateStr}
          type="button"
          onClick={() => {
            if (isStartCalendar) {
              setTempStart(dateStr);
            } else {
              setTempEnd(dateStr);
            }
          }}
          className={`h-8 w-8 rounded-lg flex items-center justify-center text-xs font-mono transition-all cursor-pointer ${cellStyle}`}
        >
          {day}
        </button>
      );
    }

    // Next month padding
    const totalRendered = cells.length;
    const remaining = 42 - totalRendered;
    for (let i = 1; i <= remaining; i++) {
      cells.push(
        <div
          key={`next-${i}`}
          className="h-8 w-8 flex items-center justify-center text-[11px] text-slate-600 font-mono"
        >
          {i}
        </div>
      );
    }

    return cells;
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-3xl w-full shadow-2xl space-y-6 max-h-[95vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Interval Date Picker (2 Kalender)
              </h3>
              <p className="text-xs text-slate-400">
                Pilih tanggal mulai pada Kalender 1 dan tanggal selesai pada Kalender 2
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Presets Bar */}
        <div className="flex flex-wrap items-center gap-2 bg-slate-950 p-2 rounded-2xl border border-slate-800">
          <span className="text-xs text-slate-400 font-medium px-2 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Preset Cepat:</span>
          </span>
          <button
            onClick={() => handlePreset(1)}
            className="px-3 py-1 text-xs font-mono rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
          >
            1 Bulan
          </button>
          <button
            onClick={() => handlePreset(3)}
            className="px-3 py-1 text-xs font-mono rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
          >
            3 Bulan
          </button>
          <button
            onClick={() => handlePreset(6)}
            className="px-3 py-1 text-xs font-mono rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
          >
            6 Bulan
          </button>
          <button
            onClick={() => handlePreset(12)}
            className="px-3 py-1 text-xs font-mono rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
          >
            1 Tahun
          </button>
          <button
            onClick={() => handlePreset(0, true)}
            className="px-3 py-1 text-xs font-mono rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
          >
            Year-to-Date (YTD)
          </button>
        </div>

        {/* Side-by-Side Dual Calendars */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Calendar 1: Start Date */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div>
                <span className="text-[11px] uppercase tracking-wider text-cyan-400 font-bold font-mono">
                  Kalender 1: Tanggal Mulai
                </span>
                <div className="text-sm font-bold text-white font-mono">
                  {tempStart || 'Belum dipilih'}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={prevStartMonth}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-bold text-slate-200 font-mono min-w-[110px] text-center">
                  {MONTH_NAMES[startMonth]} {startYear}
                </span>
                <button
                  onClick={nextStartMonth}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Day Header */}
            <div className="grid grid-cols-7 gap-1 text-center font-mono text-[10px] font-bold text-slate-500 uppercase">
              {DAY_NAMES.map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1 place-items-center">
              {renderCalendarDays(startYear, startMonth, true)}
            </div>
          </div>

          {/* Calendar 2: End Date */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div>
                <span className="text-[11px] uppercase tracking-wider text-emerald-400 font-bold font-mono">
                  Kalender 2: Tanggal Selesai
                </span>
                <div className="text-sm font-bold text-white font-mono">
                  {tempEnd || 'Belum dipilih'}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={prevEndMonth}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-bold text-slate-200 font-mono min-w-[110px] text-center">
                  {MONTH_NAMES[endMonth]} {endYear}
                </span>
                <button
                  onClick={nextEndMonth}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Day Header */}
            <div className="grid grid-cols-7 gap-1 text-center font-mono text-[10px] font-bold text-slate-500 uppercase">
              {DAY_NAMES.map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1 place-items-center">
              {renderCalendarDays(endYear, endMonth, false)}
            </div>
          </div>
        </div>

        {/* Interval Validation Status Banner */}
        <div
          className={`p-3.5 rounded-2xl border text-xs font-mono flex items-center justify-between gap-3 ${
            isDateValid
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {isDateValid ? (
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <div>
              {isDateValid ? (
                <div>
                  <strong>Rentang Interval Valid:</strong> {tempStart} &rarr; {tempEnd} ({daysDiff} Hari Kalender)
                </div>
              ) : (
                <div>
                  <strong>Validasi Gagal:</strong> Tanggal Selesai harus lebih besar dari Tanggal Mulai (End Date &gt; Start Date).
                </div>
              )}
            </div>
          </div>

          <div className="text-[11px] text-slate-400 hidden sm:block">
            {isDateValid ? 'Siap diaplikasikan' : 'Pilih ulang tanggal'}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold font-mono transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            disabled={!isDateValid}
            onClick={() => {
              if (isDateValid) {
                onApply(tempStart, tempEnd);
                onClose();
              }
            }}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold font-mono transition-all flex items-center gap-2 ${
              isDateValid
                ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 cursor-pointer shadow-lg shadow-cyan-500/20'
                : 'bg-slate-800 text-slate-600 cursor-not-allowed opacity-50'
            }`}
          >
            <Check className="w-4 h-4" />
            <span>Terapkan Rentang Tanggal</span>
          </button>
        </div>
      </div>
    </div>
  );
};

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getTodayDateStr(): string {
  return formatDate(new Date());
}

function getMonthsAgoDateStr(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return formatDate(d);
}
