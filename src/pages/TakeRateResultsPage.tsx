import React, { useMemo, useState } from 'react';
import { MONTHS_DISPLAY_CONFIG, type MonthKey, type View } from '../constants';
import type { TakeRateMappingRow } from './TakeRatePage';

interface TakeRateResultsPageProps {
  setView: (view: View) => void;
  rows: TakeRateMappingRow[];
  covers: Record<string, number>;
}

type SortMode = 'label' | 'family' | 'linked';

const TakeRateResultsPage: React.FC<TakeRateResultsPageProps> = ({ setView, rows, covers }) => {
  const [selectedMonth, setSelectedMonth] = useState<MonthKey>('jan');
  const [search, setSearch] = useState('');
  const [familyFilter, setFamilyFilter] = useState('all');
  const [sortMode, setSortMode] = useState<SortMode>('label');

  const families = useMemo(() => {
    return Array.from(new Set(rows.map((row) => row.family.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    const base = rows.filter((row) => {
      const matchFamily = familyFilter === 'all' || row.family === familyFilter;
      const matchSearch =
        !searchValue ||
        row.label.toLowerCase().includes(searchValue) ||
        row.family.toLowerCase().includes(searchValue) ||
        row.linkedImports.some((item) => item.toLowerCase().includes(searchValue));

      return matchFamily && matchSearch;
    });

    return [...base].sort((a, b) => {
      if (sortMode === 'family') {
        return `${a.family} ${a.label}`.localeCompare(`${b.family} ${b.label}`);
      }
      if (sortMode === 'linked') {
        return b.linkedImports.length - a.linkedImports.length || a.label.localeCompare(b.label);
      }
      return a.label.localeCompare(b.label);
    });
  }, [rows, familyFilter, search, sortMode]);

  const mappedProducts = rows.filter((row) => row.label.trim()).length;
  const mappedFamilies = families.length;
  const monthCovers = covers[selectedMonth] ?? 0;

  return (
    <div className="flex h-full min-h-screen bg-[#EDE2D6] text-[#4B2D22]">
      <aside className="hidden w-[250px] shrink-0 border-r border-[#D2B8A1] bg-[linear-gradient(180deg,#F4E8DC_0%,#E9D8C8_100%)] px-4 py-5 xl:flex xl:flex-col xl:gap-4">
        <div className="overflow-hidden rounded-[26px] border border-[#B55A3C] bg-[linear-gradient(180deg,#D46845_0%,#B94828_100%)] shadow-[0_10px_20px_rgba(126,54,29,0.18)]">
          <div className="h-1.5 bg-gradient-to-r from-[#FFD7C4] via-[#F3A989] to-[#B94828]" />
          <div className="p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#FFF0E8]">Lecture finale</p>
            <h1 className="mt-2 text-[21px] font-black leading-none text-white xl:text-[23px]">
              Feuille
              <br />
              taux de prise
            </h1>
          </div>
        </div>

        <button
          onClick={() => setView('take_rate')}
          className="rounded-[22px] border border-[#D9A72B] bg-[linear-gradient(180deg,#F3C63D_0%,#E3A91F_100%)] px-4 py-3.5 text-center text-[13px] font-black uppercase tracking-[0.12em] text-[#4D2B18] shadow-[0_4px_0_#B8810F] transition-all hover:brightness-105 active:translate-y-[2px] active:shadow-[0_2px_0_#B8810F]"
        >
          Retour paramétrage
        </button>

        <div className="rounded-[22px] border border-[#D7BFAB] bg-[#FFF8F1] px-4 py-4 shadow-[0_8px_18px_rgba(96,56,34,0.08)]">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#93644D]">Ébauche</p>
          <p className="mt-2 text-[13px] font-semibold leading-5 text-[#6E4736]">
            La structure finale est prête. Les ventes et le taux seront branchés ensuite sur l'import production.
          </p>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden p-4 xl:p-5">
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-[#D8BEA8] bg-[#FFF8F1] shadow-[0_18px_40px_rgba(104,63,39,0.10)]">
          <div className="border-b border-[#E6D4C4] bg-[linear-gradient(180deg,#FBF4EC_0%,#F5EADD_100%)] px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.20em] text-[#8F624B]">Résultats finaux</p>
                <h2 className="mt-1 text-[21px] font-black text-[#582F21]">Feuille taux de prise</h2>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value as MonthKey)}
                  className="rounded-[14px] border border-[#D7BEA9] bg-white px-3 py-2.5 text-[12px] font-black uppercase tracking-[0.06em] text-[#4F2E22] outline-none"
                >
                  {MONTHS_DISPLAY_CONFIG.map((month) => (
                    <option key={month.key} value={month.key}>
                      {month.label}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => setView('take_rate')}
                  className="rounded-[14px] border border-[#B55A3C] bg-[#F7E8DE] px-4 py-2.5 text-[12px] font-black uppercase tracking-[0.08em] text-[#8D4F35] transition hover:bg-[#F2DDCF]"
                >
                  Modifier le mapping
                </button>
              </div>
            </div>
          </div>

          <div className="border-b border-[#E8D8C8] bg-[#FCF6EF] px-5 py-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-[18px] border border-[#E2CCB8] bg-white px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#93644D]">Produits mappés</p>
                <p className="mt-2 text-[26px] font-black text-[#582F21]">{mappedProducts}</p>
              </div>
              <div className="rounded-[18px] border border-[#E2CCB8] bg-white px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#93644D]">Familles</p>
                <p className="mt-2 text-[26px] font-black text-[#582F21]">{mappedFamilies}</p>
              </div>
              <div className="rounded-[18px] border border-[#E2CCB8] bg-white px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#93644D]">Couverts mois</p>
                <p className="mt-2 text-[26px] font-black text-[#582F21]">{monthCovers}</p>
              </div>
            </div>

            <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(240px,1fr)_220px_220px]">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un produit ou une référence liée"
                className="w-full rounded-[14px] border border-[#D7BEA9] bg-white px-3 py-2.5 text-[13px] font-semibold text-[#4F2E22] outline-none"
              />

              <select
                value={familyFilter}
                onChange={(e) => setFamilyFilter(e.target.value)}
                className="rounded-[14px] border border-[#D7BEA9] bg-white px-3 py-2.5 text-[12px] font-black uppercase tracking-[0.06em] text-[#4F2E22] outline-none"
              >
                <option value="all">Toutes les familles</option>
                {families.map((family) => (
                  <option key={family} value={family}>
                    {family}
                  </option>
                ))}
              </select>

              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                className="rounded-[14px] border border-[#D7BEA9] bg-white px-3 py-2.5 text-[12px] font-black uppercase tracking-[0.06em] text-[#4F2E22] outline-none"
              >
                <option value="label">Tri : produit</option>
                <option value="family">Tri : famille</option>
                <option value="linked">Tri : nb liés</option>
              </select>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto bg-[#F7F0E7]">
            <table className="w-full min-w-[1220px] table-fixed border-separate border-spacing-0">
              <colgroup>
                <col className="w-[24%]" />
                <col className="w-[16%]" />
                <col className="w-[22%]" />
                <col className="w-[12%]" />
                <col className="w-[12%]" />
                <col className="w-[14%]" />
              </colgroup>
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#EADACA] text-[#71402D]">
                  <th className="border-b border-[#DCC2AB] px-3 py-4 text-left text-[12px] font-black uppercase tracking-[0.07em]">Produit</th>
                  <th className="border-b border-[#DCC2AB] px-3 py-4 text-left text-[12px] font-black uppercase tracking-[0.07em]">Famille</th>
                  <th className="border-b border-[#DCC2AB] px-3 py-4 text-left text-[12px] font-black uppercase tracking-[0.07em]">Références liées</th>
                  <th className="border-b border-[#DCC2AB] px-3 py-4 text-right text-[12px] font-black uppercase tracking-[0.07em]">Ventes</th>
                  <th className="border-b border-[#DCC2AB] px-3 py-4 text-right text-[12px] font-black uppercase tracking-[0.07em]">Couverts</th>
                  <th className="border-b border-[#DCC2AB] px-3 py-4 text-right text-[12px] font-black uppercase tracking-[0.07em]">Taux de prise</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-[14px] font-semibold text-[#8B6650]">
                      Aucun résultat pour le moment.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row, index) => (
                    <tr key={row.id} className={index % 2 === 0 ? 'bg-[#FFF9F2]' : 'bg-[#FCF4EB]'}>
                      <td className="border-b border-[#E8D8C8] px-3 py-3 align-top">
                        <div className="text-[13px] font-black text-[#4F2E22]">{row.label || '—'}</div>
                      </td>
                      <td className="border-b border-[#E8D8C8] px-3 py-3 align-top">
                        <div className="text-[13px] font-semibold text-[#6E4736]">{row.family || '—'}</div>
                      </td>
                      <td className="border-b border-[#E8D8C8] px-3 py-3 align-top">
                        {row.linkedImports.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {row.linkedImports.slice(0, 4).map((item) => (
                              <span
                                key={item}
                                className="rounded-full border border-[#E1C5AF] bg-[#FFF4EA] px-2.5 py-1 text-[11px] font-bold text-[#85523B]"
                              >
                                {item}
                              </span>
                            ))}
                            {row.linkedImports.length > 4 && (
                              <span className="rounded-full border border-[#E1C5AF] bg-[#FFF4EA] px-2.5 py-1 text-[11px] font-bold text-[#85523B]">
                                +{row.linkedImports.length - 4}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[12px] font-semibold text-[#8B6650]">Aucune</span>
                        )}
                      </td>
                      <td className="border-b border-[#E8D8C8] px-3 py-3 text-right align-top">
                        <span className="inline-flex rounded-full border border-[#E1C5AF] bg-[#FFF4EA] px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.05em] text-[#85523B]">
                          À brancher
                        </span>
                      </td>
                      <td className="border-b border-[#E8D8C8] px-3 py-3 text-right align-top text-[13px] font-black text-[#4F2E22]">
                        {monthCovers}
                      </td>
                      <td className="border-b border-[#E8D8C8] px-3 py-3 text-right align-top">
                        <span className="inline-flex rounded-full border border-[#E1C5AF] bg-[#FFF4EA] px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.05em] text-[#85523B]">
                          À brancher
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
};

export default TakeRateResultsPage;
