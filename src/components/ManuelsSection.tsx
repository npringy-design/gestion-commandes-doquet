// Paramètres > Manuels opératoires : dépôt avec aperçu, réindexation, réglages
// d'indexation et synonymes du site actif. Consultation pour tous, modification
// réservée à « manager + » et au-dessus (et contrôlée aussi par la RLS).

import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useToast } from './Toast';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import { canManageManuels } from '../lib/permissions';
import { validateImportFile } from '../utils/importFileValidation';
import {
  EMPTY_SETTINGS,
  addSynonyme,
  deleteSynonyme,
  deposerManuel,
  guessPosteFromFileName,
  indexPdfData,
  listManuels,
  listSynonymes,
  loadSettings,
  reindexerManuel,
  saveSettings,
  supprimerManuel,
  urlPdf,
  type ManuelRecord,
  type SynonymeRecord,
} from '../lib/manuels';
import {
  SECTION_TYPES,
  SECTION_TYPE_LABELS,
  describeLevel,
  normalizeText,
  type ManualIndex,
  type ManualIndexSettings,
  type SectionType,
} from '../utils/manualIndexer';

interface Preview {
  file: File;
  poste: string;
  index: ManualIndex;
}

const LEVEL_LABELS: Record<number, string> = {
  1: 'Pages',
  2: 'Fiches',
  3: 'Fiches + rubriques',
};

const inputClass = 'rounded-md border border-[#C89245]/60 bg-white px-2 py-1.5 text-sm text-[#2F1D14]';
const primaryButton = 'rounded-md bg-[#512A16] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#3A2116] disabled:opacity-50';
const secondaryButton = 'rounded-md border border-[#C89245] bg-[#FFF8E8] px-3 py-1.5 text-xs font-bold text-[#512A16] hover:bg-[#FFF2CF] disabled:opacity-50';

const ManuelsSection: React.FC = () => {
  const { activeSiteId, profile } = useAuth();
  const { showToast } = useToast();
  const canManage = canManageManuels(profile);

  const [manuels, setManuels] = useState<ManuelRecord[]>([]);
  const [settings, setSettings] = useState<ManualIndexSettings>(EMPTY_SETTINGS);
  const [ignoredText, setIgnoredText] = useState('');
  const [synonymes, setSynonymes] = useState<SynonymeRecord[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [openTitle, setOpenTitle] = useState<number | null>(null);
  const [newSynonym, setNewSynonym] = useState('');
  const [newSynonymType, setNewSynonymType] = useState<SectionType>('ingredients');

  const fail = useCallback((error: unknown, fallback: string) => {
    showToast(error instanceof Error && error.message ? error.message : fallback, 'error');
  }, [showToast]);

  const refresh = useCallback(async () => {
    try {
      const [list, loaded, syn] = await Promise.all([
        listManuels(activeSiteId),
        loadSettings(activeSiteId),
        listSynonymes(activeSiteId),
      ]);
      setManuels(list);
      setSettings(loaded);
      setIgnoredText(loaded.ignoredLines.join('\n'));
      setSynonymes(syn);
    } catch (error) {
      fail(error, 'Chargement des manuels impossible.');
    }
  }, [activeSiteId, fail]);

  useEffect(() => {
    setPreview(null);
    void refresh();
  }, [refresh]);

  if (!isSupabaseConfigured()) return null;

  const currentSettings = (): ManualIndexSettings => ({
    ...settings,
    ignoredLines: ignoredText.split('\n').map((line) => line.trim()).filter((line) => line.length > 0),
  });

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy('Lecture du PDF…');
    setPreview(null);
    try {
      await validateImportFile(file, 'order-template-pdf');
      const index = await indexPdfData(await file.arrayBuffer(), currentSettings());
      setOpenTitle(null);
      setPreview({ file, poste: guessPosteFromFileName(file.name), index });
    } catch (error) {
      fail(error, 'Lecture du PDF impossible.');
    } finally {
      setBusy(null);
    }
  };

  // Un poste déjà présent (casse ou accents différents) est réutilisé tel quel.
  const resolvePoste = (poste: string) => {
    const trimmed = poste.trim();
    const match = manuels.find((manuel) => normalizeText(manuel.poste) === normalizeText(trimmed));
    return match ? match.poste : trimmed;
  };

  const confirmDeposit = async () => {
    if (!preview) return;
    const poste = resolvePoste(preview.poste);
    if (!poste) {
      showToast('Indiquez le poste du manuel.', 'error');
      return;
    }
    setBusy('Enregistrement…');
    try {
      await deposerManuel({ site: activeSiteId, poste, file: preview.file, index: preview.index });
      showToast(`Manuel « ${poste} » enregistré.`, 'success');
      setPreview(null);
      await refresh();
    } catch (error) {
      fail(error, 'Enregistrement impossible : le manuel précédent est conservé.');
    } finally {
      setBusy(null);
    }
  };

  const handleReindex = async (manuel: ManuelRecord) => {
    setBusy(`Réindexation de ${manuel.poste}…`);
    try {
      const index = await reindexerManuel(manuel, currentSettings());
      showToast(`${manuel.poste} : ${describeLevel(index)}.`, 'success');
      await refresh();
    } catch (error) {
      fail(error, 'Réindexation impossible.');
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async (manuel: ManuelRecord) => {
    if (!window.confirm(`Supprimer le manuel « ${manuel.poste} » et tout son contenu indexé ?`)) return;
    setBusy('Suppression…');
    try {
      await supprimerManuel(manuel);
      await refresh();
    } catch (error) {
      fail(error, 'Suppression impossible.');
    } finally {
      setBusy(null);
    }
  };

  const handleOpen = async (manuel: ManuelRecord) => {
    try {
      window.open(await urlPdf(manuel.chemin_stockage, 1), '_blank', 'noopener,noreferrer');
    } catch (error) {
      fail(error, 'Impossible d’ouvrir le PDF.');
    }
  };

  const handleSaveSettings = async () => {
    setBusy('Enregistrement des réglages…');
    try {
      const next = currentSettings();
      await saveSettings(activeSiteId, next);
      showToast('Réglages enregistrés. Utilisez « Réindexer » pour les appliquer aux manuels existants.', 'success');
      await refresh();
    } catch (error) {
      fail(error, 'Enregistrement des réglages impossible.');
    } finally {
      setBusy(null);
    }
  };

  const handleAddSynonym = async () => {
    try {
      await addSynonyme(activeSiteId, newSynonym, newSynonymType);
      setNewSynonym('');
      setSynonymes(await listSynonymes(activeSiteId));
    } catch (error) {
      fail(error, 'Ajout du synonyme impossible.');
    }
  };

  const handleDeleteSynonym = async (id: string) => {
    try {
      await deleteSynonyme(id);
      setSynonymes(await listSynonymes(activeSiteId));
    } catch (error) {
      fail(error, 'Suppression du synonyme impossible.');
    }
  };

  const replaced = preview
    ? manuels.find((manuel) => normalizeText(manuel.poste) === normalizeText(preview.poste.trim()))
    : undefined;

  return (
    <section className="mt-6 rounded-[24px] border border-[#C89245]/55 bg-white/90 p-4 shadow-sm md:p-6">
      <h2 className="text-xl font-black text-[#3A2116]">Manuels opératoires</h2>
      <p className="mt-1 text-sm text-[#6B4A33]">
        Un manuel PDF par poste, indexé pour la recherche de l’accueil. Ces manuels sont propres au site actif.
      </p>
      {busy ? <p className="mt-2 text-sm font-bold text-[#8A4B1F]">{busy}</p> : null}

      {/* Liste */}
      <div className="mt-4 overflow-x-auto">
        {manuels.length === 0 ? (
          <p className="text-sm text-[#6B4A33]">Aucun manuel déposé pour ce site.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#E2C79B] text-xs uppercase text-[#8A4B1F]">
                <th className="py-2 pr-3">Poste</th>
                <th className="py-2 pr-3">Fichier</th>
                <th className="py-2 pr-3">Déposé le</th>
                <th className="py-2 pr-3">Niveau</th>
                <th className="py-2 pr-3">Contenu</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {manuels.map((manuel) => (
                <tr key={manuel.id} className="border-b border-[#F0E2C8]">
                  <td className="py-2 pr-3 font-bold">{manuel.poste}</td>
                  <td className="py-2 pr-3 text-[#6B4A33]">{manuel.nom_fichier}</td>
                  <td className="py-2 pr-3">{new Date(manuel.depose_le).toLocaleDateString('fr-FR')}</td>
                  <td className="py-2 pr-3">{LEVEL_LABELS[manuel.niveau_obtenu] ?? manuel.niveau_obtenu}</td>
                  <td className="py-2 pr-3">
                    {manuel.niveau_obtenu >= 2 ? `${manuel.nb_fiches} fiches` : `${manuel.nb_pages} pages`}
                  </td>
                  <td className="py-2">
                    <div className="flex flex-wrap justify-end gap-2">
                      <button type="button" className={secondaryButton} onClick={() => void handleOpen(manuel)}>Ouvrir</button>
                      {canManage ? (
                        <>
                          <button type="button" className={secondaryButton} disabled={busy !== null} onClick={() => void handleReindex(manuel)}>Réindexer</button>
                          <button type="button" className={secondaryButton} disabled={busy !== null} onClick={() => void handleDelete(manuel)}>Supprimer</button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!canManage ? (
        <p className="mt-4 text-sm text-[#6B4A33]">Le dépôt et les réglages sont réservés aux rôles manager + et au-dessus.</p>
      ) : (
        <>
          {/* Dépôt */}
          <div className="mt-6 border-t border-[#E2C79B] pt-4">
            <h3 className="text-sm font-black uppercase text-[#512A16]">Déposer un manuel</h3>
            <label className={`${primaryButton} mt-2 inline-block cursor-pointer`}>
              Déposer un manuel
              <input type="file" accept="application/pdf,.pdf" className="hidden" disabled={busy !== null} onChange={(event) => void handleFile(event)} />
            </label>

            {preview ? (
              <div className="mt-4 rounded-lg border border-[#E2C79B] bg-[#FFFBF2] p-4">
                <h4 className="font-black text-[#3A2116]">Aperçu avant enregistrement</h4>
                <p className="mt-1 text-sm text-[#6B4A33]">{preview.file.name}</p>
                <label className="mt-3 block text-xs font-bold uppercase text-[#8A4B1F]">
                  Poste
                  <input
                    className={`${inputClass} mt-1 block w-full max-w-xs`}
                    value={preview.poste}
                    onChange={(event) => setPreview({ ...preview, poste: event.target.value })}
                  />
                </label>
                <p className="mt-3 text-sm font-bold text-[#2F1D14]">Niveau obtenu : {describeLevel(preview.index)}</p>
                {replaced ? (
                  <p className="mt-2 rounded-md bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-900">
                    Un manuel « {replaced.poste} » existe déjà : il sera remplacé, avec tout son contenu indexé.
                  </p>
                ) : null}

                {preview.index.fiches.length > 0 ? (
                  <ul className="mt-3 max-h-72 divide-y divide-[#F0E2C8] overflow-y-auto rounded-md border border-[#F0E2C8] bg-white text-sm">
                    {preview.index.fiches.map((fiche, position) => (
                      <li key={`${fiche.ordre}-${fiche.titre}`}>
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left hover:bg-[#FFF8E8]"
                          onClick={() => setOpenTitle(openTitle === position ? null : position)}
                        >
                          <span className="font-semibold">{fiche.titre}</span>
                          <span className="text-xs text-[#8A4B1F]">p. {fiche.page}</span>
                        </button>
                        {openTitle === position ? (
                          <div className="space-y-2 bg-[#FFFBF2] px-3 py-2 text-xs">
                            {fiche.sections.map((section, sectionIndex) => (
                              <div key={sectionIndex}>
                                <div className="font-black uppercase text-[#8A4B1F]">
                                  {SECTION_TYPE_LABELS[section.typeRubrique]}
                                  {section.libelle ? ` — ${section.libelle}` : ''}
                                </div>
                                <div className="whitespace-pre-line text-[#2F1D14]">{section.texte}</div>
                              </div>
                            ))}
                            {fiche.sousFiches.length > 0 ? (
                              <div className="font-bold text-[#512A16]">Sous-fiches : {fiche.sousFiches.join(', ')}</div>
                            ) : null}
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}

                <div className="mt-4 flex gap-2">
                  <button type="button" className={primaryButton} disabled={busy !== null} onClick={() => void confirmDeposit()}>
                    {replaced ? 'Confirmer le remplacement' : 'Confirmer'}
                  </button>
                  <button type="button" className={secondaryButton} disabled={busy !== null} onClick={() => setPreview(null)}>
                    Annuler
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {/* Réglages d'indexation */}
          <div className="mt-6 border-t border-[#E2C79B] pt-4">
            <h3 className="text-sm font-black uppercase text-[#512A16]">Réglages d’indexation du site</h3>
            <p className="mt-1 text-xs text-[#6B4A33]">
              Un en-tête est reconnu au début d’une ligne, sans tenir compte des majuscules ni des accents. Sans en-tête, les fiches restent en un seul bloc.
            </p>
            <div className="mt-3 space-y-2">
              {settings.headers.map((header, position) => (
                <div key={position} className="flex flex-wrap items-center gap-2">
                  <input
                    className={`${inputClass} w-64`}
                    value={header.text}
                    placeholder="Texte de l’en-tête"
                    onChange={(event) => setSettings({
                      ...settings,
                      headers: settings.headers.map((entry, i) => (i === position ? { ...entry, text: event.target.value } : entry)),
                    })}
                  />
                  <select
                    className={inputClass}
                    value={header.type}
                    onChange={(event) => setSettings({
                      ...settings,
                      headers: settings.headers.map((entry, i) => (
                        i === position ? { ...entry, type: SECTION_TYPES.find((type) => type === event.target.value) ?? 'autre' } : entry
                      )),
                    })}
                  >
                    {SECTION_TYPES.map((type) => <option key={type} value={type}>{SECTION_TYPE_LABELS[type]}</option>)}
                  </select>
                  <button
                    type="button"
                    className={secondaryButton}
                    onClick={() => setSettings({ ...settings, headers: settings.headers.filter((_, i) => i !== position) })}
                  >
                    Retirer
                  </button>
                </div>
              ))}
              <button
                type="button"
                className={secondaryButton}
                onClick={() => setSettings({ ...settings, headers: [...settings.headers, { text: '', type: 'autre' }] })}
              >
                Ajouter un en-tête
              </button>
            </div>
            <label className="mt-4 block text-xs font-bold uppercase text-[#8A4B1F]">
              Lignes à ignorer (une par ligne)
              <textarea
                className={`${inputClass} mt-1 block h-20 w-full max-w-md`}
                value={ignoredText}
                onChange={(event) => setIgnoredText(event.target.value)}
              />
            </label>
            <label className="mt-3 block text-xs font-bold uppercase text-[#8A4B1F]">
              Préfixe de sous-fiche
              <input
                className={`${inputClass} mt-1 block w-40`}
                value={settings.subFichePrefix}
                onChange={(event) => setSettings({ ...settings, subFichePrefix: event.target.value })}
              />
            </label>
            <button type="button" className={`${primaryButton} mt-4`} disabled={busy !== null} onClick={() => void handleSaveSettings()}>
              Enregistrer les réglages
            </button>
          </div>

          {/* Synonymes */}
          <div className="mt-6 border-t border-[#E2C79B] pt-4">
            <h3 className="text-sm font-black uppercase text-[#512A16]">Synonymes de recherche</h3>
            <p className="mt-1 text-xs text-[#6B4A33]">
              Ces mots sont retirés de la recherche et désignent la rubrique à mettre en avant (« poids » : ingrédients).
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {synonymes.map((synonyme) => (
                <span key={synonyme.id} className="inline-flex items-center gap-1 rounded-full border border-[#E2C79B] bg-[#FFF8E8] px-2 py-1 text-xs">
                  <strong>{synonyme.mot}</strong>
                  <span className="text-[#8A4B1F]">→ {SECTION_TYPE_LABELS[synonyme.type_rubrique]}</span>
                  <button type="button" className="ml-1 font-black text-red-700" aria-label={`Retirer ${synonyme.mot}`} onClick={() => void handleDeleteSynonym(synonyme.id)}>×</button>
                </span>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input className={`${inputClass} w-40`} value={newSynonym} placeholder="Nouveau mot" onChange={(event) => setNewSynonym(event.target.value)} />
              <select
                className={inputClass}
                value={newSynonymType}
                onChange={(event) => setNewSynonymType(SECTION_TYPES.find((type) => type === event.target.value) ?? 'autre')}
              >
                {SECTION_TYPES.map((type) => <option key={type} value={type}>{SECTION_TYPE_LABELS[type]}</option>)}
              </select>
              <button type="button" className={secondaryButton} disabled={newSynonym.trim().length === 0} onClick={() => void handleAddSynonym()}>
                Ajouter
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
};

export default ManuelsSection;
