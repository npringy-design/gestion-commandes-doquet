import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  suffix?: string;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'indigo' | 'emerald' | 'rose' | 'orange';
  subLabel?: string;
  subValue?: string;
}

const formatNumberFR = (n: number, opts?: { min?: number; max?: number }) => {
  const min = opts?.min ?? 0;
  const max = opts?.max ?? 2;
  return n.toLocaleString('fr-FR', {
    minimumFractionDigits: min,
    maximumFractionDigits: max,
  });
};

const StatCard: React.FC<StatCardProps> = ({ label, value, suffix, color = 'indigo', subLabel, subValue }) => {
  const colorMap = {
    indigo: 'border-indigo-200 text-indigo-900 bg-white/70',
    emerald: 'border-emerald-200 text-emerald-900 bg-white/70',
    rose: 'border-rose-200 text-rose-900 bg-white/70',
    orange: 'border-orange-200 text-orange-900 bg-white/70',
  } as const;

  const displayValue = (() => {
    if (typeof value !== 'number' || Number.isNaN(value)) return value;

    // Keep integers without decimals (ex: couverts).
    if (Number.isInteger(value) && suffix === 'Pax') return formatNumberFR(value, { min: 0, max: 0 });

    // Currency and percent: 2 decimals.
    if (suffix === '€' || suffix === '%') return formatNumberFR(value, { min: 2, max: 2 });

    // Default: max 2 decimals.
    return formatNumberFR(value, { min: 0, max: 2 });
  })();

  return (
    <div className={`px-4 py-3 rounded-2xl border shadow-sm backdrop-blur ${colorMap[color]} flex flex-col justify-center h-full`}>
      <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">{label}</p>
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-extrabold leading-tight tabular-nums">{displayValue}</span>
        {suffix && <span className="text-[10px] font-medium opacity-70">{suffix}</span>}
      </div>
      {(subLabel || subValue) && (
        <div className="mt-2 flex items-center justify-between gap-2">
          {subLabel && <span className="text-[10px] font-semibold text-slate-500">{subLabel}</span>}
          {subValue && (
            <span className="text-[10px] font-extrabold px-2 py-1 rounded-full bg-white/70 border border-white/70 text-slate-700 tabular-nums">
              {subValue}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default StatCard;
