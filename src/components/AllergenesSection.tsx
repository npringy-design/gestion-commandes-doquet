// Paramètres > Manuels opératoires > Allergènes : document actuel du site, dépôt
// (manager + uniquement) avec aperçu obligatoire avant enregistrement. Le dépôt
// est refusé, avec un message clair, dès que la lecture du tableau est douteuse.

import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useToast } from './Toast';
import { canManageManuels } from '../lib/permissions';
import { validateImportFile } from '../utils/importFileValidation';
import {
  deposerAllergenes,
  formatAllergenDate,
  getAllergenDocument,
  indexAllergenPdf,
  urlAllergenPdf,
  type AllergenDocRecord,
} from '../lib/allergenes';
import { type AllergenDocument } from '../utils/allergenReader';
import { toDisplayCase } from '../utils/manualIndexer';
import { AllergenChips } from './AllergenCard';

interface Preview {
  file: File;
  document: AllergenDocument;
}

const primaryButton = 'rounded-md bg-[#512A16] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#3A2116] disabled:opacity-50';
const secondaryButton = 'rounded-md border border-[#C89245] bg-[#FFF8E8] px-3 py-1.5 text-xs font-bold text-[#512A16] hover:bg-[#FFF2CF] disabled:opacity-50';

const AllergenesSection: React.FC = () => {
  const { activeSiteId, profile } = useAuth();
  const { showToast } = useToast();
  const canManage = canManageManuels(profile);

  const [current, setCurrent] = useState<AllergenDocRecord | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setCurrent(await getAllergenDocument(activeSiteId));
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Chargement des allergènes impossible.', 'error');
    }
  }, [activeSiteId, showToast]);

  useEffect(() => {
    setPreview(null);
    setRefusal(null);
    void refresh();
  }, [refresh]);

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy('Lecture du tableau des allergènes…');
    setPreview(null);
    setRefusal(null);
    try {
      await validateImportFile(file, 'order-template-pdf');
      const result = await indexAllergenPdf(await file.arrayBuffer());
      if (result.document) setPreview({ file, document: result.document });
      else setRefusal(result.error ?? 'Lecture du PDF impossible.');
    } catch (error) {
      setRefusal(error instanceof Error && error.message ? error.message : 'Lecture du PDF impossible.');
    } finally {
      setBusy(null);
    }
  };

  const confirmDeposit = async () => {
    if (!preview) return;
    setBusy('Enregistrement…');
    try {
      await deposerAllergenes({ site: activeSiteId, file: preview.file, document: preview.document });
      showToast('Tableau des allergènes enregistré.', 'success');
      setPreview(null);
      await refresh();
    } catch (error) {
      showToast(
        error instanceof Error && error.message ? error.message : 'Enregistrement impossible : le document précédent est conservé.',
        'error',
      );
    } finally {
      setBusy(null);
    }
  };

  const handleOpen = async () => {
    if (!current) return;
    try {
      window.open(await urlAllergenPdf(current.chemin_stockage, 1), '_blank', 'noopener,noreferrer');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Impossible d’ouvrir le PDF.', 'error');
    }
  };

  return (
    <div className="mt-8 border-t border-[#E2C79B] pt-4">
      <h3 className="text-lg font-black text-[#3A2116]">Allergènes</h3>
      <p className="mt-1 text-sm text-[#6B4A33]">
        Tableau des allergènes du site (PDF), consultable depuis la recherche de l’accueil. Un nouveau dépôt remplace le précédent.
      </p>
      {busy ? <p className="mt-2 text-sm font-bold text-[#8A4B1F]">{busy}</p> : null}

      <div className="mt-3 rounded-lg border border-[#E2C79B] bg-[#FFFBF2] p-3 text-sm">
        {current ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-bold text-[#2F1D14]">{current.nom_fichier}</div>
              <div className="text-[#6B4A33]">
                Mise à jour du {formatAllergenDate(current.date_mise_a_jour)}
                {current.date_trouvee ? '' : ' (date de dépôt, date non trouvée dans le PDF)'} · {current.nb_plats} plats
              </div>
            </div>
            <button type="button" className={secondaryButton} onClick={() => void handleOpen()}>Ouvrir</button>
          </div>
        ) : (
          <p className="text-[#6B4A33]">Aucun tableau des allergènes déposé pour ce site.</p>
        )}
      </div>

      {canManage ? (
        <>
          <label className={`${primaryButton} mt-3 inline-block cursor-pointer`}>
            Déposer
            <input type="file" accept="application/pdf,.pdf" className="hidden" disabled={busy !== null} onChange={(event) => void handleFile(event)} />
          </label>

          {refusal ? (
            <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-800" role="alert">{refusal}</p>
          ) : null}

          {preview ? (
            <div className="mt-4 rounded-lg border border-[#E2C79B] bg-[#FFFBF2] p-4">
              <h4 className="font-black text-[#3A2116]">Aperçu avant enregistrement</h4>
              <p className="mt-1 text-sm text-[#6B4A33]">{preview.file.name}</p>
              <p className="mt-2 text-sm font-bold text-[#2F1D14]">
                {preview.document.plats.length} plats · date de mise à jour :{' '}
                {preview.document.date
                  ? formatAllergenDate(preview.document.date)
                  : 'non trouvée dans le PDF (la date de dépôt sera utilisée)'}
              </p>
              {current ? (
                <p className="mt-2 rounded-md bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-900">
                  Un tableau existe déjà : il sera remplacé, sans historique.
                </p>
              ) : null}

              <div className="mt-3 max-h-96 overflow-auto rounded-md border border-[#F0E2C8] bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-[#FFF2CF] text-[#8A4B1F]">
                    <tr>
                      <th className="px-2 py-1.5">Catégorie</th>
                      <th className="px-2 py-1.5">Plat</th>
                      <th className="px-2 py-1.5">Allergènes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.document.plats.map((plat, index) => (
                      <tr key={index} className="border-t border-[#F0E2C8] align-top">
                        <td className="px-2 py-1.5 text-[#6B4A33]">{plat.categorie ? toDisplayCase(plat.categorie) : '—'}</td>
                        <td className="px-2 py-1.5 font-semibold text-[#2F1D14]">{toDisplayCase(plat.nom)}</td>
                        <td className="px-2 py-1.5">
                          {plat.allergenes.length > 0 ? (
                            <div className="flex flex-wrap gap-1"><AllergenChips codes={plat.allergenes} /></div>
                          ) : (
                            <span className="text-[#6B4A33]">Aucun signalé</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex gap-2">
                <button type="button" className={primaryButton} disabled={busy !== null} onClick={() => void confirmDeposit()}>
                  {current ? 'Confirmer le remplacement' : 'Confirmer'}
                </button>
                <button type="button" className={secondaryButton} disabled={busy !== null} onClick={() => setPreview(null)}>
                  Annuler
                </button>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <p className="mt-3 text-sm text-[#6B4A33]">Le dépôt est réservé aux rôles manager + et au-dessus.</p>
      )}
    </div>
  );
};

export default AllergenesSection;
