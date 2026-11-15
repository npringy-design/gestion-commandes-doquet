// Paramètres > Manuels opératoires > Allergènes : guide actuel du site, dépôt
// (manager + uniquement) avec aperçu obligatoire avant enregistrement. Le dépôt
// est refusé, avec un message clair, dès que la lecture du tableau est douteuse.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useToast } from './Toast';
import { canManageManuels } from '../lib/permissions';
import { validateImportFile } from '../utils/importFileValidation';
import {
  countDistinctPlats,
  deposerAllergenes,
  formatAllergenDate,
  getAllergenDocument,
  indexAllergenPdf,
  readIgnoredLines,
  urlAllergenPdf,
  type AllergenDocRecord,
} from '../lib/allergenes';
import { summarizeDishes, type AllergenDocument, type AllergenIgnoredLine } from '../utils/allergenReader';
import { ALLERGEN_LABELS } from '../utils/manualConstants';
import { toDisplayCase } from '../utils/manualIndexer';
import { AllergenChips } from './AllergenCard';
import {
  AlertTriangleIcon,
  CheckIcon,
  EyeIcon,
  IconButton,
  ItemCard,
  SectionHeader,
  Tag,
  UploadIcon,
  headerButtonClass,
} from './ManualUi';

interface Preview {
  file: File;
  document: AllergenDocument;
}

const primaryButton = 'rounded-md bg-[#512A16] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#3A2116] disabled:opacity-50';
const secondaryButton = 'rounded-md border border-[#C89245] bg-[#FFF8E8] px-3 py-1.5 text-xs font-bold text-[#512A16] hover:bg-[#FFF2CF] disabled:opacity-50';

const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? 's' : ''}`;

const AllergenesSection: React.FC = () => {
  const { activeSiteId, profile } = useAuth();
  const { showToast } = useToast();
  const canManage = canManageManuels(profile);

  const [current, setCurrent] = useState<AllergenDocRecord | null>(null);
  const [distinct, setDistinct] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  // Liste des lignes non reconnues du guide enregistré : relue dans le PDF au premier clic.
  const [ignoredOpen, setIgnoredOpen] = useState(false);
  const [ignoredLines, setIgnoredLines] = useState<AllergenIgnoredLine[] | null>(null);

  const refresh = useCallback(async () => {
    try {
      const document = await getAllergenDocument(activeSiteId);
      setCurrent(document);
      setDistinct(document ? await countDistinctPlats(activeSiteId) : null);
      setIgnoredOpen(false);
      setIgnoredLines(null);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Chargement des allergènes impossible.', 'error');
    }
  }, [activeSiteId, showToast]);

  useEffect(() => {
    setPreview(null);
    setRefusal(null);
    void refresh();
  }, [refresh]);

  const summary = useMemo(() => (preview ? summarizeDishes(preview.document.plats) : null), [preview]);

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
    const ignored = preview.document.ignorees.length;
    // Lignes non reconnues : seconde confirmation explicite avant d'enregistrer.
    if (ignored > 0 && !window.confirm(`${ignored} ligne(s) du tableau n’ont pas été reconnues et seront absentes de la recherche. Enregistrer malgré tout ?`)) return;
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

  const toggleIgnored = async () => {
    if (!current) return;
    if (ignoredOpen) {
      setIgnoredOpen(false);
      return;
    }
    setIgnoredOpen(true);
    if (ignoredLines !== null) return;
    try {
      setIgnoredLines(await readIgnoredLines(current.chemin_stockage));
    } catch (error) {
      setIgnoredOpen(false);
      showToast(error instanceof Error ? error.message : 'Impossible de relire le guide.', 'error');
    }
  };

  const depositButton = (
    <label className={`${headerButtonClass} ${busy !== null ? 'pointer-events-none opacity-50' : ''}`}>
      <UploadIcon />
      {current ? 'Remplacer' : 'Déposer'}
      <input type="file" accept="application/pdf,.pdf" className="hidden" disabled={busy !== null} onChange={(event) => void handleFile(event)} />
    </label>
  );

  return (
    <div className="mt-8 border-t border-[#E2C79B] pt-6">
      <SectionHeader
        level={3}
        title="Allergènes"
        subtitle="Guide officiel des allergènes du site. Un nouveau dépôt remplace le précédent."
        action={canManage ? depositButton : null}
      />
      {busy ? <p className="mt-2 text-sm font-bold text-[#8A4B1F]">{busy}</p> : null}

      {canManage && refusal ? (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-800" role="alert">{refusal}</p>
      ) : null}

      {canManage && preview && summary ? (
        <div className="mt-4 rounded-lg border border-[#E2C79B] bg-[#FFFBF2] p-4">
          <h4 className="font-black text-[#3A2116]">Aperçu avant enregistrement</h4>
          <p className="mt-1 text-sm text-[#6B4A33]">{preview.file.name}</p>
          <p className="mt-2 text-sm font-bold text-[#2F1D14]">
            {summary.lignes} lignes, {summary.distincts} plats distincts · date de mise à jour :{' '}
            {preview.document.date
              ? formatAllergenDate(preview.document.date)
              : 'non trouvée dans le PDF (la date de dépôt sera utilisée)'}
          </p>
          {preview.document.ignorees.length > 0 ? (
            <div className="mt-3 rounded-md border-2 border-red-400 bg-red-50 p-3 text-sm text-red-900" role="alert">
              <p className="font-black">{plural(preview.document.ignorees.length, 'ligne')} non reconnue{preview.document.ignorees.length > 1 ? 's' : ''}</p>
              <p className="mt-1">Ces textes de la première colonne ne sont devenus ni un plat ni une catégorie : ils ne seront pas cherchables.</p>
              <ul className="mt-2 max-h-40 list-disc space-y-0.5 overflow-auto pl-5 text-xs">
                {preview.document.ignorees.map((line, index) => (
                  <li key={index}>Page {line.page} : {line.text}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {summary.conflits.length > 0 ? (
            <div className="mt-3 rounded-md border border-orange-300 bg-orange-50 p-3 text-sm text-orange-900" role="alert">
              <p className="font-black">
                {plural(summary.conflits.length, 'nom')} en double avec des allergènes différents
              </p>
              <p className="mt-1">Ces plats ne seront pas regroupés dans la recherche ; vérifie que c’est bien voulu.</p>
              <ul className="mt-2 max-h-40 list-disc space-y-0.5 overflow-auto pl-5 text-xs">
                {summary.conflits.map((conflit) => (
                  <li key={conflit.nom}>
                    <strong>{toDisplayCase(conflit.nom)}</strong> :{' '}
                    {conflit.variantes
                      .map((variante) => `${variante.categorie ? toDisplayCase(variante.categorie) : 'sans catégorie'} (${variante.allergenes.length > 0 ? variante.allergenes.map((code) => ALLERGEN_LABELS[code]).join(', ') : 'aucun signalé'})`)
                      .join(' / ')}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {current ? (
            <p className="mt-2 rounded-md bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-900">
              Un guide existe déjà : il sera remplacé, sans historique.
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
              {preview.document.ignorees.length > 0 ? 'Confirmer malgré tout' : current ? 'Confirmer le remplacement' : 'Confirmer'}
            </button>
            <button type="button" className={secondaryButton} disabled={busy !== null} onClick={() => setPreview(null)}>
              Annuler
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-4">
        {current ? (
          <>
            <ItemCard
              icon={<AlertTriangleIcon />}
              iconClass="bg-red-100 text-red-600"
              actions={(
                <IconButton label="Ouvrir le guide allergènes" onClick={() => void handleOpen()}>
                  <EyeIcon />
                </IconButton>
              )}
            >
              <div className="font-black text-[#3A2116]">Guide allergènes</div>
              <div className="truncate text-xs text-[#8A7A6A]" title={current.nom_fichier}>{current.nom_fichier}</div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <Tag>{plural(distinct ?? current.nb_plats, 'plat')}</Tag>
                <Tag>Mis à jour le {formatAllergenDate(current.date_mise_a_jour)}</Tag>
                {current.date_trouvee ? null : <Tag tone="orange">Date de dépôt</Tag>}
                {current.lignes_ignorees > 0 ? (
                  <button
                    type="button"
                    onClick={() => void toggleIgnored()}
                    aria-expanded={ignoredOpen}
                    className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-800 hover:bg-red-200"
                  >
                    {plural(current.lignes_ignorees, 'ligne')} non reconnue{current.lignes_ignorees > 1 ? 's' : ''}
                  </button>
                ) : (
                  <Tag tone="green"><CheckIcon className="h-3 w-3" /> Lecture complète</Tag>
                )}
              </div>
            </ItemCard>
            {ignoredOpen ? (
              <div className="mt-2 rounded-xl border border-red-300 bg-red-50 p-3 text-xs text-red-900">
                {ignoredLines === null ? (
                  <p>Relecture du guide…</p>
                ) : ignoredLines.length === 0 ? (
                  <p>Aucune ligne non reconnue à la relecture : redépose le guide pour mettre à jour ce compteur.</p>
                ) : (
                  <ul className="max-h-40 list-disc space-y-0.5 overflow-auto pl-5">
                    {ignoredLines.map((line, index) => (
                      <li key={index}>Page {line.page} : {line.text}</li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </>
        ) : (
          <div className="rounded-xl border-2 border-dashed border-[#E2C79B] bg-[#FFFBF2] p-6 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-red-100 text-red-600">
              <AlertTriangleIcon />
            </div>
            <p className="mt-3 text-sm font-semibold text-[#512A16]">Aucun guide des allergènes déposé pour ce site.</p>
            {canManage ? <div className="mt-3 flex justify-center">{depositButton}</div> : null}
          </div>
        )}
      </div>
    </div>
  );
};

export default AllergenesSection;
