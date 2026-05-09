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
    indigo: 'border-[#D8AE77] text-[#2F1D14] bg-[#FFF7EA]/90',
    emerald: 'border-[#A8B69A] text-[#263A1D] bg-[#F1F5E9]/90',
    rose: 'border-[#D9A08B] text-[#6E2F1E] bg-[#FFF1EA]/90',
    orange: 'border-[#A7DEE5] text-[#111827] bg-[#DDF5F8]/90',
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
    <div className={`px-3 sm:px-4 py-3 rounded-[22px] border shadow-[0_12px_26px_rgba(80,38,18,0.12)] backdrop-blur ${colorMap[color]} flex flex-col justify-center h-full min-h-[84px]`}>
      <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#8B5A35] mb-1">{label}</p>
      <div className="flex items-baseline gap-1">
        <span className="text-lg sm:text-xl font-extrabold leading-tight tabular-nums">{displayValue}</span>
        {suffix && <span className="text-[10px] font-medium opacity-70">{suffix}</span>}
      </div>
      {(subLabel || subValue) && (
        <div className="mt-2 flex items-center justify-between gap-2">
          {subLabel && <span className="text-[10px] font-semibold text-[#8B6B54]">{subLabel}</span>}
          {subValue && (
            <span className="text-[10px] font-extrabold px-2 py-1 rounded-full bg-[#FFFDF8]/80 border border-[#E2C39B] text-[#6A432D] tabular-nums">
              {subValue}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default StatCard;
