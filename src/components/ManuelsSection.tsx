// Paramètres > Manuels opératoires : liste, dépôt avec aperçu, réindexation et
// suppression pour le site actif. Aucun réglage : tout est automatique.
// Consultation pour tous, modification réservée à « manager + » et au-dessus
// (et contrôlée aussi par la RLS).

import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useToast } from './Toast';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import { canManageManuels } from '../lib/permissions';
import AllergenesSection from './AllergenesSection';
import {
  BowlIcon,
  DocumentIcon,
  EyeIcon,
  FlameIcon,
  IconButton,
  ItemCard,
  RefreshIcon,
  SectionHeader,
  SnowflakeIcon,
  Tag,
  TrashIcon,
  UploadIcon,
  headerButtonClass,
} from './ManualUi';
import { validateImportFile } from '../utils/importFileValidation';
import {
  deposerManuel,
  guessPosteFromFileName,
  indexPdfData,
  listManuels,
  listManuelsAReindexer,
  reindexerManuel,
  supprimerManuel,
  urlPdf,
  type ManuelRecord,
} from '../lib/manuels';
import {
  SECTION_TYPE_LABELS,
  describeLevel,
  normalizeText,
  type ManualIndex,
} from '../utils/manualIndexer';

interface Preview {
  file: File;
  poste: string;
  index: ManualIndex;
}

// Icône et teinte du poste, déduites du nom sans accents ni majuscules.
const posteVisual = (poste: string): { icon: React.ReactNode; className: string } => {
  const name = normalizeText(poste);
  if (name.includes('sous') && name.includes('fiche')) return { icon: <BowlIcon />, className: 'bg-violet-100 text-violet-600' };
  if (name.includes('chaud')) return { icon: <FlameIcon />, className: 'bg-orange-100 text-orange-600' };
  if (name.includes('froid')) return { icon: <SnowflakeIcon />, className: 'bg-sky-100 text-sky-600' };
  return { icon: <DocumentIcon />, className: 'bg-[#F5ECD9] text-[#8A4B1F]' };
};

const inputClass = 'rounded-md border border-[#C89245]/60 bg-white px-2 py-1.5 text-sm text-[#2F1D14]';
const primaryButton = 'rounded-md bg-[#512A16] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#3A2116] disabled:opacity-50';
const secondaryButton = 'rounded-md border border-[#C89245] bg-[#FFF8E8] px-3 py-1.5 text-xs font-bold text-[#512A16] hover:bg-[#FFF2CF] disabled:opacity-50';

const ManuelsSection: React.FC = () => {
  const { activeSiteId, profile } = useAuth();
  const { showToast } = useToast();
  const canManage = canManageManuels(profile);

  const [manuels, setManuels] = useState<ManuelRecord[]>([]);
  const [toReindex, setToReindex] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [openTitle, setOpenTitle] = useState<number | null>(null);

  const fail = useCallback((error: unknown, fallback: string) => {
    showToast(error instanceof Error && error.message ? error.message : fallback, 'error');
  }, [showToast]);

  const refresh = useCallback(async () => {
    try {
      const [list, old] = await Promise.all([listManuels(activeSiteId), listManuelsAReindexer(activeSiteId)]);
      setManuels(list);
      setToReindex(old);
    } catch (error) {
      fail(error, 'Chargement des manuels impossible.');
    }
  }, [activeSiteId, fail]);

  useEffect(() => {
    setPreview(null);
    void refresh();
  }, [refresh]);

  if (!isSupabaseConfigured()) return null;

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy('Lecture du PDF…');
    setPreview(null);
    try {
      await validateImportFile(file, 'order-template-pdf');
      const index = await indexPdfData(await file.arrayBuffer());
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
      const index = await reindexerManuel(manuel);
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

  const replaced = preview
    ? manuels.find((manuel) => normalizeText(manuel.poste) === normalizeText(preview.poste.trim()))
    : undefined;

  const depositButton = (
    <label className={`${headerButtonClass} ${busy !== null ? 'pointer-events-none opacity-50' : ''}`}>
      <UploadIcon />
      Déposer un manuel
      <input type="file" accept="application/pdf,.pdf" className="hidden" disabled={busy !== null} onChange={(event) => void handleFile(event)} />
    </label>
  );

  return (
    <section className="mt-6 rounded-[24px] border border-[#C89245]/55 bg-white/90 p-4 shadow-sm md:p-6">
      <SectionHeader
        title="Manuels opératoires"
        subtitle="Fiches techniques et process du site, consultables depuis la recherche de l’accueil."
        action={canManage ? depositButton : null}
      />
      {busy ? <p className="mt-2 text-sm font-bold text-[#8A4B1F]">{busy}</p> : null}

      {canManage ? (
        <>
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
        </>
      ) : null}

      <div className="mt-4 space-y-2">
        {manuels.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-[#E2C79B] bg-[#FFFBF2] p-6 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[#F5ECD9] text-[#8A4B1F]">
              <DocumentIcon />
            </div>
            <p className="mt-3 text-sm font-semibold text-[#512A16]">
              Dépose ton premier manuel pour le rendre consultable depuis l’accueil.
            </p>
            {canManage ? <div className="mt-3 flex justify-center">{depositButton}</div> : null}
          </div>
        ) : (
          manuels.map((manuel) => {
            const visual = posteVisual(manuel.poste);
            const fichesLabel = `${manuel.nb_fiches} fiche${manuel.nb_fiches > 1 ? 's' : ''}`;
            const pagesLabel = `${manuel.nb_pages} page${manuel.nb_pages > 1 ? 's' : ''}`;
            return (
              <ItemCard
                key={manuel.id}
                icon={visual.icon}
                iconClass={visual.className}
                actions={(
                  <>
                    <IconButton label={`Ouvrir le manuel ${manuel.poste}`} onClick={() => void handleOpen(manuel)}>
                      <EyeIcon />
                    </IconButton>
                    {canManage ? (
                      <>
                        <IconButton label={`Réindexer le manuel ${manuel.poste}`} disabled={busy !== null} onClick={() => void handleReindex(manuel)}>
                          <RefreshIcon />
                        </IconButton>
                        <IconButton label={`Supprimer le manuel ${manuel.poste}`} danger disabled={busy !== null} onClick={() => void handleDelete(manuel)}>
                          <TrashIcon />
                        </IconButton>
                      </>
                    ) : null}
                  </>
                )}
              >
                <div className="font-black text-[#3A2116]">{manuel.poste}</div>
                <div className="truncate text-xs text-[#8A7A6A]" title={manuel.nom_fichier}>{manuel.nom_fichier}</div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <Tag>{manuel.niveau_obtenu >= 2 ? fichesLabel : pagesLabel}</Tag>
                  <Tag>Déposé le {new Date(manuel.depose_le).toLocaleDateString('fr-FR')}</Tag>
                  {manuel.niveau_obtenu === 1 ? <Tag tone="orange">Pages seulement</Tag> : null}
                  {toReindex.has(manuel.id) ? <Tag tone="orange">À réindexer</Tag> : null}
                </div>
              </ItemCard>
            );
          })
        )}
      </div>

      <AllergenesSection />
    </section>
  );
};

export default ManuelsSection;
