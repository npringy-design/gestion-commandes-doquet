import React, { useMemo, useState } from 'react';
import { MONTHS } from '../constants';

export type CostByMonth = Record<string, number | null>;
export type SalesByMonth = Record<string, number | null>;

// UX: on conserve les valeurs des inputs en string.
// Sinon, "26," est immédiatement parsé en 26 et la virgule disparaît,
// ce qui donne l'impression qu'on ne peut pas saisir de virgule.
type DraftTextByMonth = Record<string, string>;

function parsePercent(input: string): number | null {
  const cleaned = input
    .trim()
    .replace(/\s/g, '')
    .replace('%', '')
    .replace(',', '.');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  if (Number.isNaN(n)) return null;
  return n;
}

function parseNumberFR(input: string): number | null {
  const cleaned = input
    .trim()
    .replace(/\s/g, '')
    .replace('€', '')
    .replace(',', '.');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  if (Number.isNaN(n)) return null;
  return n;
}

export interface CostSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  costByMonth: CostByMonth;
  salesByMonth: SalesByMonth;
  targetPercent: number;
  onSave: (next: { costByMonth: CostByMonth; salesByMonth: SalesByMonth; targetPercent: number }) => void;
}

const CostSettingsModal: React.FC<CostSettingsModalProps> = ({
  isOpen,
  onClose,
  costByMonth,
  salesByMonth,
  targetPercent,
  onSave,
}) => {
  const [draftCostsText, setDraftCostsText] = useState<DraftTextByMonth>({});
  const [draftSalesText, setDraftSalesText] = useState<DraftTextByMonth>({});
  const [draftTarget, setDraftTarget] = useState<string>(String(targetPercent));

  React.useEffect(() => {
    if (isOpen) {
      const nextCosts: DraftTextByMonth = {};
      const nextSales: DraftTextByMonth = {};
      for (const m of MONTHS) {
        const v = costByMonth[m];
        const ca = salesByMonth[m];
        nextCosts[m] = v == null ? '' : String(v).replace('.', ',');
        nextSales[m] = ca == null ? '' : String(ca).replace('.', ',');
      }
      setDraftCostsText(nextCosts);
      setDraftSalesText(nextSales);
      setDraftTarget(String(targetPercent));
    }
  }, [isOpen, costByMonth, salesByMonth, targetPercent]);

  const rows = useMemo(() => {
    return MONTHS.map((m) => {
      return {
        month: m,
        display: draftCostsText[m] ?? '',
        caDisplay: draftSalesText[m] ?? '',
      };
    });
  }, [draftCostsText, draftSalesText]);

  // Auto-save: les paramètres doivent rester pris en compte même si on ferme la fenêtre
  // sans cliquer explicitement sur "Enregistrer".
  const saveDraft = React.useCallback(() => {
    const t = parsePercent(draftTarget) ?? targetPercent;
    const nextCosts: CostByMonth = {};
    const nextSales: SalesByMonth = {};
    for (const m of MONTHS) {
      nextCosts[m] = parsePercent(draftCostsText[m] ?? '');
      nextSales[m] = parseNumberFR(draftSalesText[m] ?? '');
    }
    onSave({ costByMonth: nextCosts, salesByMonth: nextSales, targetPercent: t });
  }, [draftCostsText, draftSalesText, draftTarget, targetPercent, onSave]);

  const closeAndSave = React.useCallback(() => {
    saveDraft();
    onClose();
  }, [saveDraft, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={closeAndSave} />
      <div className="relative w-[520px] max-w-[95vw] max-h-[90vh] overflow-hidden rounded-xl bg-white shadow-2xl border border-slate-200 flex flex-col">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-slate-900">Paramètres</p>
            <p className="text-[11px] text-slate-500">Saisie manuelle : coût matière (%) + CA mensuel (pour calculer l'impact en points).</p>
          </div>
          <button
            onClick={closeAndSave}
            className="text-xs font-bold px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50"
          >
            Fermer
          </button>
        </div>

        <div className="p-4 overflow-auto flex-1 min-h-0">
          <div className="mb-4 flex items-center gap-2">
            <label className="text-xs font-bold text-slate-600 w-44">Objectif (ligne)</label>
            <input
              value={draftTarget}
              onChange={(e) => setDraftTarget(e.target.value)}
              className="w-24 text-xs px-2 py-1 rounded-md border border-slate-200 bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="25"
            />
            <span className="text-xs text-slate-500">%</span>
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="grid grid-cols-3 bg-slate-50 text-[10px] font-bold uppercase text-slate-500">
              <div className="px-3 py-2 border-r border-slate-200">Mois</div>
              <div className="px-3 py-2 border-r border-slate-200">Coût matière (%)</div>
              <div className="px-3 py-2">CA (€)</div>
            </div>
            {rows.map((r) => (
              <div key={r.month} className="grid grid-cols-3 border-t border-slate-200">
                <div className="px-3 py-2 text-xs font-semibold text-slate-700 border-r border-slate-200">
                  {r.month}
                </div>
                <div className="px-3 py-1.5 border-r border-slate-200">
                  <input
                    value={r.display}
                    onChange={(e) => {
                      const raw = e.target.value;
                      // On accepte chiffres + virgule/point + espaces + % (qui sera retiré au parse).
                      if (!/^[0-9\s.,%]*$/.test(raw)) return;
                      setDraftCostsText((prev) => ({ ...prev, [r.month]: raw }));
                    }}
                    inputMode="decimal"
                    className="w-full text-xs px-2 py-1 rounded-md border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="ex: 26,63"
                  />
                </div>
                <div className="px-3 py-1.5">
                  <input
                    value={r.caDisplay}
                    onChange={(e) => {
                      const raw = e.target.value;
                      // On accepte chiffres + virgule/point + espaces + symbole € (retiré au parse)
                      if (!/^[0-9\s.,€]*$/.test(raw)) return;
                      setDraftSalesText((prev) => ({ ...prev, [r.month]: raw }));
                    }}
                    inputMode="decimal"
                    className="w-full text-xs px-2 py-1 rounded-md border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="ex: 215000"
                  />
                </div>
              </div>
            ))}
          </div>

          <p className="mt-3 text-[11px] text-slate-500">
            Astuce : virgule ou point. Vide = non renseigné. Le CA sert à afficher l'impact d'un produit sur le coût matière (en points).
          </p>
        </div>

        <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-end gap-2 bg-white">
          <button
            onClick={() => {
              const empty: DraftTextByMonth = Object.fromEntries(MONTHS.map((m) => [m, ''])) as DraftTextByMonth;
              setDraftCostsText(empty);
              setDraftSalesText(empty);
              setDraftTarget('25');
            }}
            className="text-xs font-bold px-3 py-2 rounded border border-slate-200 bg-white hover:bg-slate-50"
          >
            Réinitialiser
          </button>
          <button
            onClick={() => {
              saveDraft();
              onClose();
            }}
            className="text-xs font-bold px-3 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-500"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
};

export default CostSettingsModal;
