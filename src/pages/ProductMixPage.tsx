// =============================================================
// pages/ProductMixPage.tsx
// Analyse du mix produit - Répartition des ventes par catégorie
// =============================================================

import React, { useState, useMemo } from 'react';
import { View, MONTHS_DISPLAY_CONFIG } from '../constants';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ProductMixPageProps {
  setView: (v: View) => void;
  salesHtByMonth: Record<string, number>;
}

interface CategoryData {
  id: string;
  name: string;
  color: string;
  salesByMonth: Record<string, number>;
}

// Données de démonstration - À remplacer par vos vraies données
const DEMO_CATEGORIES: CategoryData[] = [
  {
    id: 'entrees',
    name: 'Entrées',
    color: '#3b82f6',
    salesByMonth: {
      jan: 12500, feb: 13200, mar: 14100, apr: 13800,
      may: 14500, jun: 13900, jul: 15200, aug: 15800,
      sep: 12100, oct: 16500, nov: 15200, dec: 18900,
    },
  },
  {
    id: 'plats',
    name: 'Plats',
    color: '#ef4444',
    salesByMonth: {
      jan: 28900, feb: 31200, mar: 29800, apr: 28500,
      may: 30200, jun: 27800, jul: 31500, aug: 32100,
      sep: 24900, oct: 35200, nov: 32800, dec: 42100,
    },
  },
  {
    id: 'desserts',
    name: 'Desserts',
    color: '#f59e0b',
    salesByMonth: {
      jan: 8900, feb: 9500, mar: 9200, apr: 8800,
      may: 9300, jun: 8600, jul: 9800, aug: 10100,
      sep: 7800, oct: 11200, nov: 10300, dec: 13500,
    },
  },
  {
    id: 'boissons',
    name: 'Boissons',
    color: '#10b981',
    salesByMonth: {
      jan: 7200, feb: 7800, mar: 7500, apr: 7100,
      may: 7600, jun: 7000, jul: 8100, aug: 8300,
      sep: 6400, oct: 9200, nov: 8500, dec: 11100,
    },
  },
  {
    id: 'vins',
    name: 'Vins & Alcools',
    color: '#8b5cf6',
    salesByMonth: {
      jan: 5800, feb: 6300, mar: 6100, apr: 5900,
      may: 6200, jun: 5700, jul: 6600, aug: 6800,
      sep: 5200, oct: 7500, nov: 6900, dec: 9200,
    },
  },
];

const formatEuro = (value: number) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatPercent = (value: number) => {
  return `${value.toFixed(1)} %`;
};

const ProductMixPage: React.FC<ProductMixPageProps> = ({ setView, salesHtByMonth }) => {
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [categories] = useState<CategoryData[]>(DEMO_CATEGORIES);

  // Calcul des totaux par catégorie
  const categoryTotals = useMemo(() => {
    return categories.map(cat => {
      const total = Object.values(cat.salesByMonth).reduce((sum, val) => sum + val, 0);
      return { ...cat, total };
    });
  }, [categories]);

  // Total général
  const grandTotal = useMemo(() => {
    return categoryTotals.reduce((sum, cat) => sum + cat.total, 0);
  }, [categoryTotals]);

  // Données pour le graphique camembert (année complète ou mois sélectionné)
  const pieData = useMemo(() => {
    if (!selectedMonth) {
      // Année complète
      return categoryTotals.map(cat => ({
        name: cat.name,
        value: cat.total,
        color: cat.color,
      }));
    } else {
      // Mois spécifique
      return categories.map(cat => ({
        name: cat.name,
        value: cat.salesByMonth[selectedMonth] || 0,
        color: cat.color,
      }));
    }
  }, [categoryTotals, categories, selectedMonth]);

  // Données pour le graphique en barres (évolution mensuelle)
  const barData = useMemo(() => {
    return MONTHS_DISPLAY_CONFIG.map(month => {
      const dataPoint: any = { month: month.label };
      categories.forEach(cat => {
        dataPoint[cat.name] = cat.salesByMonth[month.key] || 0;
      });
      return dataPoint;
    });
  }, [categories]);

  // Total du mois sélectionné
  const selectedMonthTotal = useMemo(() => {
    if (!selectedMonth) return 0;
    return categories.reduce((sum, cat) => sum + (cat.salesByMonth[selectedMonth] || 0), 0);
  }, [categories, selectedMonth]);

  return (
    <div className="min-h-screen bg-[#1a0f0a] text-white pb-12">
      {/* Header */}
      <div className="bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 px-6 py-8 shadow-2xl border-b-4 border-purple-500">
        <div className="max-w-7xl mx-auto">
          <button
            onClick={() => setView('home')}
            className="mb-4 px-4 py-2 bg-white/10 backdrop-blur rounded-full text-xs font-black uppercase tracking-widest hover:bg-white/20 transition-all border border-white/20"
          >
            ← Retour
          </button>
          <h1 className="text-4xl font-black uppercase tracking-tight mb-2">
            Mix Produit
          </h1>
          <p className="text-purple-200 font-semibold text-sm">
            Répartition des ventes par catégorie
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Filtre par mois */}
        <div className="mb-8 bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10">
          <label className="block text-sm font-black uppercase tracking-widest text-purple-300 mb-3">
            Période d'analyse
          </label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-full md:w-64 px-4 py-3 bg-slate-800 border-2 border-slate-700 rounded-xl text-white font-semibold focus:border-purple-500 focus:outline-none"
          >
            <option value="">Année complète</option>
            {MONTHS_DISPLAY_CONFIG.map(month => (
              <option key={month.key} value={month.key}>
                {month.label}
              </option>
            ))}
          </select>
        </div>

        {/* Graphiques */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Graphique Camembert */}
          <div className="bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10">
            <h2 className="text-xl font-black uppercase tracking-tight mb-4 text-purple-300">
              Répartition des ventes
            </h2>
            <p className="text-sm text-slate-400 mb-4">
              {selectedMonth 
                ? `${MONTHS_DISPLAY_CONFIG.find(m => m.key === selectedMonth)?.label} - Total: ${formatEuro(selectedMonthTotal)}`
                : `Année complète - Total: ${formatEuro(grandTotal)}`
              }
            </p>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => formatEuro(value)}
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Graphique en Barres */}
          <div className="bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10">
            <h2 className="text-xl font-black uppercase tracking-tight mb-4 text-purple-300">
              Évolution mensuelle
            </h2>
            <p className="text-sm text-slate-400 mb-4">
              Comparaison par catégorie
            </p>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis 
                  dataKey="month" 
                  stroke="#94a3b8"
                  tick={{ fontSize: 10 }}
                />
                <YAxis 
                  stroke="#94a3b8"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip 
                  formatter={(value: number) => formatEuro(value)}
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                {categories.map(cat => (
                  <Bar key={cat.id} dataKey={cat.name} fill={cat.color} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tableau des statistiques */}
        <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 overflow-hidden">
          <div className="px-6 py-4 bg-purple-900/30 border-b border-white/10">
            <h2 className="text-xl font-black uppercase tracking-tight text-purple-300">
              Statistiques détaillées
            </h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800/50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-widest text-slate-300">
                    Catégorie
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-black uppercase tracking-widest text-slate-300">
                    Total Année
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-black uppercase tracking-widest text-slate-300">
                    Part du CA
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-black uppercase tracking-widest text-slate-300">
                    Moyenne Mensuelle
                  </th>
                  {selectedMonth && (
                    <>
                      <th className="px-6 py-4 text-right text-xs font-black uppercase tracking-widest text-purple-300">
                        {MONTHS_DISPLAY_CONFIG.find(m => m.key === selectedMonth)?.label}
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-black uppercase tracking-widest text-purple-300">
                        % du Mois
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {categoryTotals.map((cat, idx) => {
                  const monthValue = selectedMonth ? cat.salesByMonth[selectedMonth] || 0 : 0;
                  const monthPercent = selectedMonthTotal > 0 ? (monthValue / selectedMonthTotal) * 100 : 0;
                  
                  return (
                    <tr key={cat.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-4 h-4 rounded-full" 
                            style={{ backgroundColor: cat.color }}
                          />
                          <span className="font-bold text-white">{cat.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-white">
                        {formatEuro(cat.total)}
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-purple-300">
                        {formatPercent((cat.total / grandTotal) * 100)}
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-slate-300">
                        {formatEuro(cat.total / 12)}
                      </td>
                      {selectedMonth && (
                        <>
                          <td className="px-6 py-4 text-right font-bold text-purple-200">
                            {formatEuro(monthValue)}
                          </td>
                          <td className="px-6 py-4 text-right font-semibold text-purple-300">
                            {formatPercent(monthPercent)}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
                {/* Ligne de total */}
                <tr className="bg-purple-900/20 font-black">
                  <td className="px-6 py-4 text-white uppercase tracking-wider">
                    TOTAL
                  </td>
                  <td className="px-6 py-4 text-right text-white">
                    {formatEuro(grandTotal)}
                  </td>
                  <td className="px-6 py-4 text-right text-purple-300">
                    100.0 %
                  </td>
                  <td className="px-6 py-4 text-right text-slate-300">
                    {formatEuro(grandTotal / 12)}
                  </td>
                  {selectedMonth && (
                    <>
                      <td className="px-6 py-4 text-right text-purple-200">
                        {formatEuro(selectedMonthTotal)}
                      </td>
                      <td className="px-6 py-4 text-right text-purple-300">
                        100.0 %
                      </td>
                    </>
                  )}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Note d'information */}
        <div className="mt-8 bg-blue-900/20 backdrop-blur rounded-2xl p-6 border border-blue-500/30">
          <div className="flex items-start gap-3">
            <div className="text-2xl">ℹ️</div>
            <div>
              <h3 className="font-black uppercase tracking-tight text-blue-300 mb-2">
                Données de démonstration
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Cette page affiche actuellement des données de démonstration. Pour utiliser vos vraies données de ventes, 
                vous devrez connecter cette page à votre système de catégorisation de produits et vos données de ventes réelles.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductMixPage;
