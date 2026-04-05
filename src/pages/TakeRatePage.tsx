import React, { useMemo, useState } from 'react';
import { View } from '../constants';

export interface TakeRateMappingRow {
  id: string;
  label: string;
  family: string;
  linkedImports: string[];
}

interface TakeRatePageProps {
  setView: (view: View) => void;
  rows: TakeRateMappingRow[];
  setRows: React.Dispatch<React.SetStateAction<TakeRateMappingRow[]>>;
  availableImports?: string[];
}

const createEmptyRow = (): TakeRateMappingRow => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  label: '',
  family: '',
  linkedImports: [],
});

const TakeRatePage: React.FC<TakeRatePageProps> = ({
  setView,
  rows,
  setRows,
  availableImports = [],
}) => {
  const [searchByRow, setSearchByRow] = useState<Record<string, string>>({});
  const [openSearchRow, setOpenSearchRow] = useState<string | null>(null);
  const [openLinkedRow, setOpenLinkedRow] = useState<string | null>(null);

  const addRow = () => {
    setRows((prev) => [...prev, createEmptyRow()]);
  };

  const updateRow = (rowId: string, patch: Partial<TakeRateMappingRow>) => {
    setRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
  };

  const removeRow = (rowId: string) => {
    setRows((prev) => prev.filter((row) => row.id !== rowId));
    setSearchByRow((prev) => {
      const next = { ...prev };
      delete next[rowId];
      return next;
    });
    if (openSearchRow === rowId) setOpenSearchRow(null);
    if (openLinkedRow === rowId) setOpenLinkedRow(null);
  };

  const addImportToRow = (rowId: string, importLabel: string) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        if (row.linkedImports.includes(importLabel)) return row;
        return { ...row, linkedImports: [...row.linkedImports, importLabel] };
      })
    );
  };

  const removeImportFromRow = (rowId: string, importLabel: string) => {
    setRows((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? { ...row, linkedImports: row.linkedImports.filter((item) => item !== importLabel) }
          : row
      )
    );
  };

  const filteredImportsByRow = useMemo(() => {
    const result: Record<string, string[]> = {};

    for (const row of rows) {
      const query = (searchByRow[row.id] ?? '').trim().toLowerCase();
      const base = availableImports.filter((item) => !row.linkedImports.includes(item));
      result[row.id] = query ? base.filter((item) => item.toLowerCase().includes(query)) : base.slice(0, 30);
    }

    return result;
  }, [availableImports, rows, searchByRow]);

  return (
    <div className="flex h-full min-h-screen bg-[#EDE2D6] text-[#4B2D22]">
      <aside className="hidden w-[250px] shrink-0 border-r border-[#D2B8A1] bg-[linear-gradient(180deg,#F4E8DC_0%,#E9D8C8_100%)] px-4 py-5 xl:flex xl:flex-col xl:gap-4">
        <div className="overflow-hidden rounded-[26px] border border-[#2E8D63] bg-[linear-gradient(180deg,#39B37D_0%,#239062_100%)] shadow-[0_10px_20px_rgba(30,96,68,0.18)]">
          <div className="h-1.5 bg-gradient-to-r from-[#D4F3E4] via-[#8AE0B9] to-[#239062]" />
          <div className="p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#E7FFF3]">Pilotage carte</p>
            <h1 className="mt-2 text-[21px] font-black leading-none text-white xl:text-[23px]">
              Calcul
              <br />
              taux de prise
            </h1>
          </div>
        </div>

        <button
          onClick={() => setView('stats')}
          className="rounded-[22px] border border-[#D9A72B] bg-[linear-gradient(180deg,#F3C63D_0%,#E3A91F_100%)] px-4 py-3.5 text-center text-[13px] font-black uppercase tracking-[0.12em] text-[#4D2B18] shadow-[0_4px_0_#B8810F] transition-all hover:brightness-105 active:translate-y-[2px] active:shadow-[0_2px_0_#B8810F]"
        >
          Retour paramètres
        </button>

        <div className="rounded-[22px] border border-[#D7BFAB] bg-[#FFF8F1] px-4 py-4 shadow-[0_8px_18px_rgba(96,56,34,0.08)]">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#93644D]">Version 1</p>
          <p className="mt-2 text-[13px] font-semibold leading-5 text-[#6E4736]">
            Page de paramétrage manuel pour regrouper les produits import avant la feuille de taux de prise.
          </p>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden p-4 xl:p-5">
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-[#D8BEA8] bg-[#FFF8F1] shadow-[0_18px_40px_rgba(104,63,39,0.10)]">
          <div className="border-b border-[#E6D4C4] bg-[linear-gradient(180deg,#FBF4EC_0%,#F5EADD_100%)] px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.20em] text-[#8F624B]">Préparation manuelle</p>
                <h2 className="mt-1 text-[21px] font-black text-[#582F21]">Calcul taux de prise</h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={addRow}
                  className="rounded-[16px] border border-[#2E8D63] bg-[linear-gradient(180deg,#39B37D_0%,#239062_100%)] px-4 py-2.5 text-[12px] font-black uppercase tracking-[0.08em] text-white shadow-[0_4px_0_#196A48] transition-all hover:brightness-105 active:translate-y-[2px] active:shadow-[0_2px_0_#196A48]"
                >
                  Ajouter une ligne
                </button>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto bg-[#F7F0E7]">
            <table className="w-full min-w-[1280px] table-fixed border-separate border-spacing-0">
              <colgroup>
                <col className="w-[24%]" />
                <col className="w-[16%]" />
                <col className="w-[22%]" />
                <col className="w-[34%]" />
                <col className="w-[4%]" />
              </colgroup>

              <thead className="sticky top-0 z-10">
                <tr className="bg-[#EADACA] text-[#71402D]">
                  <th className="border-b border-[#DCC2AB] px-3 py-4 text-left text-[12px] font-black uppercase tracking-[0.07em]">Produit affiché</th>
                  <th className="border-b border-[#DCC2AB] px-3 py-4 text-left text-[12px] font-black uppercase tracking-[0.07em]">Famille</th>
                  <th className="border-b border-[#DCC2AB] px-3 py-4 text-left text-[12px] font-black uppercase tracking-[0.07em]">Recherche import</th>
                  <th className="border-b border-[#DCC2AB] px-3 py-4 text-left text-[12px] font-black uppercase tracking-[0.07em]">Produits liés</th>
                  <th className="border-b border-[#DCC2AB] px-3 py-4 text-center text-[12px] font-black uppercase tracking-[0.07em]">—</th>
                </tr>
              </thead>

              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-[14px] font-semibold text-[#8B6650]">
                      Aucune ligne pour le moment. Ajoute un produit final puis rattache les références import correspondantes.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, rowIndex) => {
                    const searchValue = searchByRow[row.id] ?? '';
                    const suggestions = filteredImportsByRow[row.id] ?? [];
                    const isSearchOpen = openSearchRow === row.id;
                    const isLinkedOpen = openLinkedRow === row.id;

                    return (
                      <tr key={row.id} className={rowIndex % 2 === 0 ? 'bg-[#FFF9F2]' : 'bg-[#FCF4EB]'}>
                        <td className="border-b border-[#E8D8C8] px-3 py-3 align-top">
                          <input
                            type="text"
                            value={row.label}
                            onChange={(e) => updateRow(row.id, { label: e.target.value })}
                            placeholder="Ex. Steak au poivre"
                            className="w-full rounded-[14px] border border-[#D7BEA9] bg-white px-3 py-2.5 text-[13px] font-semibold text-[#4F2E22] outline-none transition focus:border-[#B55A3C] focus:ring-2 focus:ring-[#E8B59E]"
                          />
                        </td>

                        <td className="border-b border-[#E8D8C8] px-3 py-3 align-top">
                          <input
                            type="text"
                            value={row.family}
                            onChange={(e) => updateRow(row.id, { family: e.target.value })}
                            placeholder="Ex. Desserts"
                            className="w-full rounded-[14px] border border-[#D7BEA9] bg-white px-3 py-2.5 text-[13px] font-semibold text-[#4F2E22] outline-none transition focus:border-[#B55A3C] focus:ring-2 focus:ring-[#E8B59E]"
                          />
                        </td>

                        <td className="border-b border-[#E8D8C8] px-3 py-3 align-top">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setOpenSearchRow((prev) => (prev === row.id ? null : row.id))}
                                className="rounded-[12px] border border-[#B55A3C] bg-[#F7E8DE] px-3 py-2 text-[11px] font-black uppercase tracking-[0.08em] text-[#8D4F35] transition hover:bg-[#F2DDCF]"
                              >
                                Rechercher
                              </button>

                              <input
                                type="text"
                                value={searchValue}
                                onChange={(e) => {
                                  setSearchByRow((prev) => ({ ...prev, [row.id]: e.target.value }));
                                  setOpenSearchRow(row.id);
                                }}
                                placeholder="Nom import..."
                                className="min-w-0 flex-1 rounded-[12px] border border-[#D7BEA9] bg-white px-3 py-2 text-[12px] font-medium text-[#4F2E22] outline-none transition focus:border-[#B55A3C] focus:ring-2 focus:ring-[#E8B59E]"
                              />
                            </div>

                            {isSearchOpen && (
                              <div className="max-h-44 overflow-auto rounded-[16px] border border-[#DCC5B1] bg-[#FFFDF9] p-2 shadow-[0_12px_24px_rgba(87,52,33,0.10)]">
                                {suggestions.length > 0 ? (
                                  <div className="space-y-1.5">
                                    {suggestions.map((item) => (
                                      <button
                                        key={item}
                                        type="button"
                                        onClick={() => addImportToRow(row.id, item)}
                                        className="flex w-full items-center justify-between rounded-[12px] border border-[#E8D8C8] bg-white px-3 py-2 text-left text-[12px] font-semibold text-[#5B3728] transition hover:border-[#B55A3C] hover:bg-[#FFF4EC]"
                                      >
                                        <span className="pr-3">{item}</span>
                                        <span className="text-[10px] font-black uppercase tracking-[0.06em] text-[#A15839]">Ajouter</span>
                                      </button>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="px-2 py-3 text-[12px] font-medium text-[#8B6650]">Aucun résultat.</div>
                                )}
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="border-b border-[#E8D8C8] px-3 py-3 align-top">
                          <div className="space-y-2">
                            <button
                              type="button"
                              onClick={() => setOpenLinkedRow((prev) => (prev === row.id ? null : row.id))}
                              className="rounded-[12px] border border-[#D2B39C] bg-[#F8EDE1] px-3 py-2 text-[11px] font-black uppercase tracking-[0.08em] text-[#7F563F] transition hover:bg-[#F2E2D0]"
                            >
                              {row.linkedImports.length} lié{row.linkedImports.length > 1 ? 's' : ''}
                            </button>

                            {isLinkedOpen && (
                              <div className="space-y-1.5 rounded-[16px] border border-[#DCC5B1] bg-[#FFFDF9] p-2 shadow-[0_12px_24px_rgba(87,52,33,0.10)]">
                                {row.linkedImports.length > 0 ? (
                                  row.linkedImports.map((item) => (
                                    <div
                                      key={item}
                                      className="flex items-center justify-between gap-2 rounded-[12px] border border-[#E8D8C8] bg-white px-3 py-2"
                                    >
                                      <span className="text-[12px] font-semibold text-[#5B3728]">{item}</span>
                                      <button
                                        type="button"
                                        onClick={() => removeImportFromRow(row.id, item)}
                                        className="rounded-[10px] border border-[#E6B9A5] bg-[#FCEEE7] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.05em] text-[#A24E30] transition hover:bg-[#F9E2D6]"
                                      >
                                        Retirer
                                      </button>
                                    </div>
                                  ))
                                ) : (
                                  <div className="px-2 py-3 text-[12px] font-medium text-[#8B6650]">Aucun produit lié.</div>
                                )}
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="border-b border-[#E8D8C8] px-2 py-3 align-top">
                          <button
                            type="button"
                            onClick={() => removeRow(row.id)}
                            className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-[#D8B39E] bg-[#F6E7DA] text-[#A5502F] transition hover:bg-[#EFDCC8]"
                            title="Supprimer la ligne"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.8" d="M6 6l12 12M18 6L6 18" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
};

export default TakeRatePage;
