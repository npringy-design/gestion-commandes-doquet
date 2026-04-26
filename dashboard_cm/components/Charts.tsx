import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  BarChart,
  Bar,
  AreaChart,
  Area,
} from 'recharts';
import { MonthlyData, ItemTrend } from '../types';

interface CostChartProps {
  data: MonthlyData[];
}

export const FoodCostChart: React.FC<CostChartProps> = ({ data }) => {
  return (
    <div className="bg-[#FFF7EA]/90 backdrop-blur p-4 rounded-[22px] shadow-[0_12px_26px_rgba(80,38,18,0.12)] border border-[#D8AE77] h-full flex flex-col">
      <h3 className="text-[#2F1D14] font-extrabold mb-2 text-xs border-b border-[#E2C39B] pb-2 flex items-center gap-2">
        <span>📊</span>
        <span>Coût Matière (%)</span>
      </h3>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EAD7BD" />
            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#8B6B54', fontSize: 10 }} />
            <YAxis domain={[20, 'auto']} axisLine={false} tickLine={false} tick={{ fill: '#8B6B54', fontSize: 10 }} tickFormatter={(v) => Number(v).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} />
            <Tooltip contentStyle={{ borderRadius: '4px', border: 'none', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', fontSize: '10px' }} formatter={(v: any) => `${Number(v).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`} />
            <ReferenceLine y={data?.[0]?.target ?? 25.5} stroke="#7B4B2A" strokeDasharray="4 4" />
            <Bar dataKey="actual" name="Réalisé" fill="#C86F24" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export interface EcartTotalPoint {
  month: string;
  total: number;
}

interface EcartTotalChartProps {
  data: EcartTotalPoint[];
}

export const EcartTotalChart: React.FC<EcartTotalChartProps> = ({ data }) => {
  return (
    <div className="bg-[#FFF7EA]/90 backdrop-blur p-4 rounded-[22px] shadow-[0_12px_26px_rgba(80,38,18,0.12)] border border-[#D8AE77] h-full flex flex-col">
      <h3 className="text-[#2F1D14] font-extrabold mb-2 text-xs border-b border-[#E2C39B] pb-2 flex items-center gap-2">
        <span>🧾</span>
        <span>Écart total (€)</span>
      </h3>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EAD7BD" />
            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#8B6B54", fontSize: 10 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: "#8B6B54", fontSize: 10 }} />
            <Tooltip contentStyle={{ borderRadius: "4px", border: "none", boxShadow: "0 2px 4px rgba(0,0,0,0.1)", fontSize: "10px" }} />
            <ReferenceLine y={0} stroke="#D8AE77" />
            <Bar dataKey="total" name="Écart" fill="#A85F2A" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};



interface ItemTrendChartProps {
  data: ItemTrend[];
  title: string;
}

export const ItemTrendChart: React.FC<ItemTrendChartProps> = ({ data, title }) => {
  return (
    <div className="bg-[#FFF7EA]/90 backdrop-blur p-4 rounded-[22px] shadow-[0_12px_26px_rgba(80,38,18,0.12)] border border-[#D8AE77] h-full flex flex-col">
      <h3 className="text-[#2F1D14] font-extrabold mb-2 text-xs border-b border-[#E2C39B] pb-2 truncate" title={title}>
        📈 Trend : {title}
      </h3>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#C86F24" stopOpacity={0.24} />
                <stop offset="95%" stopColor="#C86F24" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EAD7BD" />
            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#8B6B54', fontSize: 10 }} />
            <YAxis domain={[20, 'auto']} axisLine={false} tickLine={false} tick={{ fill: '#8B6B54', fontSize: 10 }} tickFormatter={(v) => Number(v).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} />
            <Tooltip contentStyle={{ borderRadius: '4px', border: 'none', fontSize: '10px' }} />
            <ReferenceLine y={0} stroke="#D8AE77" />
            <Area type="monotone" dataKey="value" stroke="#C86F24" fill="url(#colorValue)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export interface ProductSeriesPoint {
  month: string;
  euro: number;
  qty: number;
}

interface ProductTrendChartProps {
  data: ProductSeriesPoint[];
  title: string;
  mode: 'euro' | 'qty';
}

export const ProductTrendChart: React.FC<ProductTrendChartProps> = ({ data, title, mode }) => {
  const dataKey = mode === 'euro' ? 'euro' : 'qty';
  const label = mode === 'euro' ? '€' : 'Qté';

  const formatValue = (v: any) => {
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(n)) return '';
    if (mode === 'euro') {
      return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
    }
    return n.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
  };

  return (
    <div className="bg-[#FFF7EA]/90 backdrop-blur p-4 rounded-[22px] shadow-[0_12px_26px_rgba(80,38,18,0.12)] border border-[#D8AE77] h-full flex flex-col">
      <h3 className="text-[#2F1D14] font-extrabold mb-2 text-xs border-b border-[#E2C39B] pb-2 truncate" title={title}>
        🔎 Évolution : {title} ({label})
      </h3>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EAD7BD" />
            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#8B6B54', fontSize: 10 }} />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#8B6B54', fontSize: 10 }}
              tickFormatter={(v) => (mode === 'euro' ? Number(v).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) : Number(v).toLocaleString('fr-FR', { maximumFractionDigits: 2 }))}
            />
            <Tooltip
              contentStyle={{ borderRadius: '6px', border: 'none', boxShadow: '0 6px 16px rgba(0,0,0,0.12)', fontSize: '11px' }}
              formatter={(value: any) => formatValue(value)}
              labelFormatter={(l) => `Mois : ${l}`}
            />
            <ReferenceLine y={0} stroke="#D8AE77" />
            <Bar dataKey={dataKey} name={label} fill={mode === 'euro' ? '#C86F24' : '#416D72'} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
