// =============================================================
// pages/OrderTemplatePage.tsx
// Import d'un PDF de trame de commande (bon de préparation, bon de commande)
// de n'importe quel fournisseur : article, unité de stockage et unité de
// conditionnement de chaque produit.
//
// Flux : chaque page est rendue en image par pdf.js puis lue côté serveur
// par un modèle vision (/api/order-template-extract), qui identifie les
// colonnes par leur sens. Les lignes incertaines sont surlignées pour contrôle.
// =============================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { SupplierId, View } from '../constants';
import AppNavTile from '../components/AppNavTile';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthProvider';
import { canAccessRatiosPage } from '../lib/permissions';
import { OrderLineField, OrderTemplateRow, OrderTemplatesBySupplier, SupplierConfig } from '../types';
import { ProductWithHistory } from '../data';
import { finalizeExtraction, runPageExtractions } from '../utils/orderTemplateExtraction';
import {
  isFatalOrderTemplateError,
  requestOrderTemplatePage,
} from '../utils/orderTemplateExtractionClient';
import { assertOrderTemplatePageCount, renderOrderTemplatePage } from '../utils/orderTemplatePdfPages';
import { validateImportFile } from '../utils/importFileValidation';
import {
  IMPORT_PROCESSING_TIMEOUTS,
  throwIfImportAborted,
  toSafeImportErrorMessage,
  withImportTimeout,
} from '../utils/importProcessing';
import {
  resolveTemplateRowsForSupplier,
  shouldMigrateLegacyTemplate,
  getLinkedTemplateProductUpdates,
  getOrderTemplateSupplierOptions,
  linkTemplateRowsToExistingProducts,
  mergeTemplateProductChanges,
  synchronizeOrderTemplateProducts,
} from '../utils/orderTemplateCatalog';

GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

interface OrderTemplatePageProps {
  setView: (v: View) => void;
  orderTemplateRows: OrderTemplateRow[];
  setOrderTemplateRows: React.Dispatch<React.SetStateAction<OrderTemplateRow[]>>;
  orderTemplatesBySupplier: OrderTemplatesBySupplier;
  setOrderTemplatesBySupplier: React.Dispatch<React.SetStateAction<OrderTemplatesBySupplier>>;
  products: ProductWithHistory[];
  setProducts: React.Dispatch<React.SetStateAction<ProductWithHistory[]>>;
  updateOrderLineField: (productId: string, field: OrderLineField, value: number | '') => void;
  supplierConfigs: Record<string, SupplierConfig>;
  ratioTab: SupplierId;
  setRatioTab: React.Dispatch<React.SetStateAction<SupplierId>>;
  openNewRatioProducts: (supplierId: string, productIds: string[]) => void;
  supabaseLoaded: boolean;
}

type ProcessingStep = 'idle' | 'reading' | 'analysing' | 'done' | 'error';

interface ImportQualityReport {
  mode: 'vision';
  rowCount: number;
  declaredRowCount: number;
  flaggedRowCount: number;
  failedPages: number[];
  needsReview: boolean;
}

const makeRowId = () => `row_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
const TEMPLATE_AUTO_SAVE_DELAY_MS = 400;

const OrderTemplatePage: React.FC<OrderTemplatePageProps> = ({
  setView,
  orderTemplateRows,
  setOrderTemplateRows,
  orderTemplatesBySupplier,
  setOrderTemplatesBySupplier,
  products,
  setProducts,
  updateOrderLineField,
  supplierConfigs,
  ratioTab,
  setRatioTab,
  openNewRatioProducts,
  supabaseLoaded,
}) => {
  const { profile } = useAuth();
  const canImport = canAccessRatiosPage(profile);
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pdfAbortControllerRef = useRef<AbortController | null>(null);

  const [step, setStep] = useState<ProcessingStep>('idle');
  const [statusLabel, setStatusLabel] = useState('');
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [importQualityReport, setImportQualityReport] = useState<ImportQualityReport | null>(null);
  // Lignes importées à contrôler, surlignées dans le tableau. Non persisté.
  const [flaggedRowIds, setFlaggedRowIds] = useState<Set<string>>(() => new Set());
  const supplierOptions = useMemo(
    () => getOrderTemplateSupplierOptions(supplierConfigs),
    [supplierConfigs]
  );
  const selectedSupplierId: SupplierId | '' = supplierOptions.some((config) => config.id === ratioTab) ? ratioTab : '';

  const isProcessing = step === 'reading' || step === 'analysing';
  // Fournisseur auquel appartient le tableau de travail affiché. Tant qu'il ne
  // correspond pas au fournisseur sélectionné, rien n'est enregistré.
  const [hydratedSupplierId, setHydratedSupplierId] = useState<SupplierId | ''>('');

  const templateSupplierIds = useMemo(
    () => supplierOptions.map(config => config.id),
    [supplierOptions],
  );

  const currentSupplierHasProducts = !!selectedSupplierId
    && products.some(product => product.supplierId === selectedSupplierId);
  const hasRowsToCreate = !!selectedSupplierId && orderTemplateRows.some(row => {
    if (!row.article.trim()) return false;
    return !row.productId || !products.some(product => (
      product.id === row.productId && product.supplierId === selectedSupplierId
    ));
  });

  useEffect(() => () => pdfAbortControllerRef.current?.abort(), []);

  // À l'ouverture de la page, le tableau de travail est rechargé depuis la trame
  // du fournisseur sélectionné : l'onglet fournisseur est partagé avec Calcul
  // vente ratio et peut avoir changé depuis le dernier affichage de cette page.
  // L'ancienne trame unique n'est migrée que si aucune trame n'existe encore.
  // On attend la fin du chargement cloud pour ne jamais sauver les valeurs
  // initiales à la place des données réelles.
  useEffect(() => {
    if (!supabaseLoaded || !selectedSupplierId || hydratedSupplierId === selectedSupplierId) return;

    if (orderTemplateRows.length > 0 && shouldMigrateLegacyTemplate(orderTemplatesBySupplier, templateSupplierIds)) {
      const linkedRows = linkTemplateRowsToExistingProducts(orderTemplateRows, products, selectedSupplierId);
      setOrderTemplateRows(linkedRows);
      setOrderTemplatesBySupplier(prev => ({ ...prev, [selectedSupplierId]: linkedRows }));
    } else {
      setOrderTemplateRows(resolveTemplateRowsForSupplier(orderTemplatesBySupplier, products, selectedSupplierId));
    }
    setHydratedSupplierId(selectedSupplierId);
  }, [hydratedSupplierId, orderTemplateRows, orderTemplatesBySupplier, products, selectedSupplierId, setOrderTemplateRows, setOrderTemplatesBySupplier, supabaseLoaded, templateSupplierIds]);

  // Les lignes déjà rattachées sont enregistrées automatiquement après une
  // courte pause de saisie. Le catalogue, le produit et le colisage utilisé
  // par la page Commandes évoluent ensemble, sans bouton de validation.
  useEffect(() => {
    if (!canImport || !supabaseLoaded || !selectedSupplierId || hydratedSupplierId !== selectedSupplierId) return;

    const timeoutId = window.setTimeout(() => {
      setOrderTemplatesBySupplier(prev => {
        const savedRows = prev[selectedSupplierId];
        if (savedRows === orderTemplateRows) return prev;
        return { ...prev, [selectedSupplierId]: orderTemplateRows };
      });

      const updates = getLinkedTemplateProductUpdates({
        rows: orderTemplateRows,
        products,
        supplierId: selectedSupplierId,
      });
      if (updates.length === 0) return;

      const updatesById = new Map(updates.map(update => [update.id, update]));
      setProducts(prev => prev.map(product => {
        const update = updatesById.get(product.id);
        return update ? { ...product, ...update } : product;
      }));

      updates.forEach(update => {
        const previousProduct = products.find(product => product.id === update.id);
        if (previousProduct?.packaging !== update.packaging) {
          updateOrderLineField(update.id, 'packaging', update.packaging);
        }
      });
    }, TEMPLATE_AUTO_SAVE_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [
    canImport,
    hydratedSupplierId,
    orderTemplateRows,
    products,
    selectedSupplierId,
    setOrderTemplatesBySupplier,
    setProducts,
    supabaseLoaded,
    updateOrderLineField,
  ]);

  const openSupplierTemplate = useCallback((supplierId: SupplierId) => {
    if (supplierId === selectedSupplierId) return;

    if (selectedSupplierId && orderTemplateRows.length > 0) {
      const linkedCurrentRows = linkTemplateRowsToExistingProducts(orderTemplateRows, products, selectedSupplierId);
      setOrderTemplatesBySupplier(prev => ({ ...prev, [selectedSupplierId]: linkedCurrentRows }));
    }

    setRatioTab(supplierId);
    setOrderTemplateRows(resolveTemplateRowsForSupplier(orderTemplatesBySupplier, products, supplierId));
    setHydratedSupplierId(supplierId);
    setImportQualityReport(null);
    setFlaggedRowIds(new Set());
  }, [orderTemplateRows, orderTemplatesBySupplier, products, selectedSupplierId, setOrderTemplateRows, setOrderTemplatesBySupplier, setRatioTab]);

  const handleCreateProducts = useCallback(() => {
    if (!canImport) return;
    if (!selectedSupplierId) {
      showToast('Sélectionne un fournisseur avant de créer les produits.', 'warning');
      return;
    }

    const creationTimestamp = Date.now();
    const result = synchronizeOrderTemplateProducts({
      rows: orderTemplateRows,
      products,
      supplierId: selectedSupplierId,
      makeProductId: index => `custom-${creationTimestamp}-${index}`,
    });

    if (result.duplicateCount > 0) {
      const proceed = window.confirm(
        `${result.duplicateCount} doublon(s) détecté(s) dans la trame seront ignorés. Continuer l'enregistrement ?`
      );
      if (!proceed) return;
    }

    if (result.linkedRows.length === 0) {
      showToast('Aucune ligne exploitable à enregistrer.', 'warning');
      return;
    }

    if (result.removals.length > 0) {
      const proceed = window.confirm(
        `${result.removals.length} produit(s) absent(s) de la nouvelle trame seront supprimés définitivement du catalogue :\n\n${result.removals.map(product => `- ${product.name}`).join('\n')}\n\nContinuer ?`
      );
      if (!proceed) return;
    }

    setProducts(prev => mergeTemplateProductChanges({
      products: prev,
      updates: result.updates,
      creations: result.creations,
      removals: result.removals,
      supplierId: selectedSupplierId,
    }));
    openNewRatioProducts(selectedSupplierId, result.productIdsToOpen);

    result.creations.forEach((p) => {
      updateOrderLineField(p.id, 'stock', 0);
      updateOrderLineField(p.id, 'upcomingDelivery', 0);
      updateOrderLineField(p.id, 'targetStock', 0);
      updateOrderLineField(p.id, 'packaging', p.packaging);
    });
    result.updates.forEach(update => {
      updateOrderLineField(update.id, 'packaging', update.packaging);
    });

    setOrderTemplateRows(result.linkedRows);
    setOrderTemplatesBySupplier(prev => ({ ...prev, [selectedSupplierId]: result.linkedRows }));
    showToast(
      `✓ Trame enregistrée : ${result.creations.length} création(s), ${result.updates.length} mise(s) à jour, ${result.removals.length} suppression(s)`,
      'success',
    );
  }, [canImport, openNewRatioProducts, orderTemplateRows, products, selectedSupplierId, setOrderTemplateRows, setOrderTemplatesBySupplier, setProducts, showToast, updateOrderLineField]);

  const handleFile = useCallback(async (file: File) => {
    if (!canImport || isProcessing) return;
    pdfAbortControllerRef.current?.abort();
    const controller = new AbortController();
    pdfAbortControllerRef.current = controller;
    let loadingTask: ReturnType<typeof getDocument> | null = null;

    setStep('reading');
    setStatusLabel('Lecture du PDF…');
    setAnalysisProgress(0);
    setImportQualityReport(null);
    setFlaggedRowIds(new Set());

    try {
      await validateImportFile(file, 'order-template-pdf');
      throwIfImportAborted(controller.signal);
      const arrayBuffer = await withImportTimeout(
        file.arrayBuffer(),
        IMPORT_PROCESSING_TIMEOUTS.fileRead,
        'La lecture du PDF a dépassé 15 secondes.',
      );
      throwIfImportAborted(controller.signal);
      loadingTask = getDocument({ data: arrayBuffer });
      const loadedPdf = await withImportTimeout(
        loadingTask.promise,
        IMPORT_PROCESSING_TIMEOUTS.pdfLoad,
        'L’ouverture du PDF a dépassé 20 secondes.',
        () => { controller.abort(); void loadingTask?.destroy(); },
      );

      const pageCount = loadedPdf.numPages;
      assertOrderTemplatePageCount(pageCount);

      setStep('analysing');
      setStatusLabel(`Analyse de la page 1/${pageCount}`);

      const { outcomes, firstError } = await withImportTimeout(
        runPageExtractions({
          pageCount,
          concurrency: 3,
          shouldStop: () => controller.signal.aborted,
          isFatalError: isFatalOrderTemplateError,
          onPageDone: (_pageNumber, doneCount) => {
            setAnalysisProgress(Math.round((doneCount / pageCount) * 100));
            setStatusLabel(`Analyse de la page ${Math.min(pageCount, doneCount + 1)}/${pageCount}`);
          },
          extractPage: async ({ pageNumber, columnHint }) => {
            const rendered = await renderOrderTemplatePage(loadedPdf, pageNumber, controller.signal);
            return requestOrderTemplatePage({
              pageImage: rendered.pageImage,
              pageNumber,
              pageCount,
              nativeText: rendered.nativeText,
              columnHint,
            }, controller.signal);
          },
        }),
        IMPORT_PROCESSING_TIMEOUTS.pdfAnalysis,
        'L’analyse du PDF a dépassé 4 minutes et a été arrêtée.',
        () => { controller.abort(); void loadingTask?.destroy(); },
      );
      throwIfImportAborted(controller.signal);

      const { rows: extractedRows, flaggedIndexes, report } = finalizeExtraction(outcomes);
      const importedRows: OrderTemplateRow[] = extractedRows.map((row) => ({
        id: makeRowId(),
        sourceCode: row.code || undefined,
        article: row.article,
        storageUnit: row.storageUnit,
        packagingUnit: row.packagingUnit,
      }));

      const needsReview = report.flaggedRowCount > 0
        || report.failedPages.length > 0
        || report.rowCount !== report.declaredRowCount;
      setImportQualityReport({
        mode: 'vision',
        rowCount: report.rowCount,
        declaredRowCount: report.declaredRowCount,
        flaggedRowCount: report.flaggedRowCount,
        failedPages: report.failedPages,
        needsReview,
      });

      const errorMessage = firstError === null
        ? ''
        : toSafeImportErrorMessage(firstError, 'L’analyse de certaines pages a échoué.');

      if (importedRows.length === 0) {
        // Le tableau existant n'est pas écrasé par un import qui n'a rien produit.
        showToast(
          errorMessage || 'Aucune ligne produit trouvée dans ce PDF. Vérifie le fichier ou saisis la trame manuellement.',
          errorMessage ? 'error' : 'warning',
        );
      } else {
        setOrderTemplateRows(importedRows);
        setFlaggedRowIds(new Set(flaggedIndexes.map((index) => importedRows[index].id)));

        if (needsReview) {
          const reviewReasons = [
            report.flaggedRowCount > 0 ? `${report.flaggedRowCount} ligne(s) surlignée(s) à contrôler` : '',
            report.failedPages.length > 0 ? `page(s) ${report.failedPages.join(', ')} non analysée(s)` : '',
          ].filter(Boolean).join(', ');
          showToast(
            `⚠ ${importedRows.length} ligne(s) importée(s)${reviewReasons ? ` : ${reviewReasons}` : ''}. ${errorMessage}`.trim(),
            'warning',
          );
        } else {
          showToast(`✓ ${importedRows.length} ligne(s) importée(s)`, 'success');
        }
      }
      setStep('done');
    } catch (err) {
      if (pdfAbortControllerRef.current === controller) {
        console.warn('[OrderTemplatePage] Import PDF refusé ou interrompu.');
        showToast(toSafeImportErrorMessage(
          err,
          'Impossible de traiter ce PDF. Vérifie qu’il n’est pas corrompu.',
        ), 'error');
        setStep('error');
      }
    } finally {
      controller.abort();
      // Détruire la tâche de chargement libère aussi le document et son Worker.
      if (loadingTask) await loadingTask.destroy().catch(() => undefined);
      if (pdfAbortControllerRef.current === controller) {
        pdfAbortControllerRef.current = null;
        setStatusLabel('');
        setAnalysisProgress(0);
      }
    }
  }, [canImport, isProcessing, setOrderTemplateRows, showToast]);

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    e.target.value = '';
  };

  const updateRow = (id: string, field: keyof Omit<OrderTemplateRow, 'id'>, value: string) => {
    setOrderTemplateRows((prev) => prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  };

  const deleteRow = (id: string) => {
    setOrderTemplateRows((prev) => prev.filter((row) => row.id !== id));
  };

  const addEmptyRow = () => {
    setOrderTemplateRows((prev) => [...prev, { id: makeRowId(), article: '', storageUnit: '', packagingUnit: '' }]);
  };

  const clearAll = () => {
    if (orderTemplateRows.length === 0) return;
    if (!window.confirm('Vider entièrement la trame de commande ?')) return;
    setOrderTemplateRows([]);
    setImportQualityReport(null);
    setFlaggedRowIds(new Set());
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_0%,rgba(245,166,58,0.28),transparent_30%),linear-gradient(180deg,#FFF7EA_0%,#F3DDC0_46%,#C97933_100%)] text-[#2F1D14]">
      <div className="mx-auto max-w-7xl">
        <main className="p-4 md:p-6">
          {/* En-tête */}
          <div className="mb-6 flex flex-col gap-4 rounded-[24px] border border-[#C89245]/55 bg-[linear-gradient(135deg,#3A2116_0%,#69331F_58%,#A85F2A_100%)] p-4 shadow-[0_18px_42px_rgba(54,24,12,0.18)] xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <h1 className="text-3xl font-black tracking-tight text-[#FFF7EA]">Trame commande</h1>
              <AppNavTile
                type="button"
                onClick={() => setView('stats')}
                eyebrow="Retour"
                icon="back"
                tone="dark"
                size="md"
              >
                Paramètres
              </AppNavTile>
              <AppNavTile
                type="button"
                onClick={() => setView('home')}
                eyebrow="Retour"
                icon="home"
                tone="dark"
                size="md"
              >
                Accueil
              </AppNavTile>
            </div>
          </div>

          {/* Import PDF */}
          <section className="mb-6 rounded-[24px] border border-[#D8AE77] bg-[#FFF7EA] p-6 shadow-[0_14px_30px_rgba(80,38,18,0.12)]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-black text-[#2F1D14]">Import du bon de préparation (PDF)</h2>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  orderTemplateRows.length > 0 ? 'bg-[#E8F0DE] text-[#4D613C]' : 'bg-[#F6DEB1] text-[#7B4B2A]'
                }`}
              >
                {orderTemplateRows.length > 0 ? `${orderTemplateRows.length} ligne(s)` : 'Aucune ligne'}
              </span>
            </div>

            <p className="mb-4 text-sm text-[#6A432D]">
              Importe le PDF d'une trame de commande, quel que soit le fournisseur. Chaque page est lue visuellement :
              l'application repère les colonnes article, unité de stockage et conditionnement d'après leur sens, sans
              dépendre des intitulés ni de l'ordre. Les lignes incertaines sont surlignées pour que tu les contrôles.
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={onFileInputChange}
              className="hidden"
            />

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => canImport && fileInputRef.current?.click()}
                disabled={!canImport || isProcessing}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  canImport && !isProcessing
                    ? 'bg-[#C86F24] text-white shadow-[0_4px_0_#8B431C] hover:bg-[#B85F1D]'
                    : 'cursor-not-allowed bg-[#F4E8D8] text-[#9A806A]'
                }`}
              >
                {isProcessing ? 'Traitement en cours…' : 'Importer un PDF'}
              </button>

              <button
                type="button"
                onClick={clearAll}
                disabled={!canImport || isProcessing || orderTemplateRows.length === 0}
                className="rounded-lg border-2 border-[#E7B7A0] bg-[#FFF1EA] px-4 py-2 text-sm font-black text-[#9B3F21] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Vider le tableau
              </button>
            </div>

            {isProcessing && (
              <div className="mt-4 rounded-lg bg-white/60 p-3">
                <p className="text-sm font-semibold text-[#6A432D]">{statusLabel || 'Traitement en cours…'}</p>
                {step === 'analysing' && (
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#F4E8D8]">
                    <div
                      className="h-full rounded-full bg-[#C86F24] transition-all"
                      style={{ width: `${analysisProgress}%` }}
                    />
                  </div>
                )}
              </div>
            )}

            {!isProcessing && importQualityReport && (
              <div
                className={`mt-4 rounded-lg border p-3 text-sm ${
                  importQualityReport.needsReview
                    ? 'border-amber-300 bg-amber-50 text-amber-900'
                    : 'border-emerald-300 bg-emerald-50 text-emerald-900'
                }`}
              >
                <p className="font-black">
                  {importQualityReport.needsReview ? 'Lecture à contrôler' : 'Lecture vérifiée'} — lecture visuelle des pages
                </p>
                <p className="mt-1">
                  {importQualityReport.declaredRowCount} ligne(s) comptée(s) sur le PDF, {importQualityReport.rowCount} ligne(s) restituée(s).
                  {importQualityReport.flaggedRowCount > 0
                    ? ` ${importQualityReport.flaggedRowCount} ligne(s) surlignée(s) à contrôler : cellule vide, lecture incertaine ou nombre de lignes de la page différent.`
                    : ''}
                  {importQualityReport.failedPages.length > 0
                    ? ` Page(s) non analysée(s) : ${importQualityReport.failedPages.join(', ')}.`
                    : ''}
                </p>
              </div>
            )}
          </section>

          {/* Création des produits dans Vente calcul ratio */}
          <section className="mb-6 rounded-[24px] border border-[#D8AE77] bg-[#FFF7EA] p-6 shadow-[0_14px_30px_rgba(80,38,18,0.12)]">
            <h2 className="mb-4 text-lg font-black text-[#2F1D14]">Produits (Vente calcul ratio)</h2>

            <p className="mb-4 text-sm text-[#6A432D]">
              Les modifications des produits existants sont enregistrées automatiquement et répercutées dans Commandes.
              Le bouton de création reste toujours disponible : il crée les nouvelles lignes et retire les produits absents de la trame.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-lg border-2 border-[#E2C39B] bg-[#FFFDF8] px-4 py-2 text-sm font-semibold text-[#2F1D14]">
                {selectedSupplierId
                  ? supplierConfigs[selectedSupplierId]?.name || selectedSupplierId
                  : 'Choisis une trame ci-dessous'}
              </span>

              <button
                type="button"
                onClick={handleCreateProducts}
                disabled={!canImport || !selectedSupplierId || orderTemplateRows.length === 0}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  canImport && selectedSupplierId && orderTemplateRows.length > 0
                    ? 'bg-[#C86F24] text-white shadow-[0_4px_0_#8B431C] hover:bg-[#B85F1D]'
                    : 'cursor-not-allowed bg-[#F4E8D8] text-[#9A806A]'
                }`}
              >
                {currentSupplierHasProducts ? 'Créer les nouveaux produits' : 'Créer les produits'}
              </button>

              {!hasRowsToCreate && selectedSupplierId && orderTemplateRows.length > 0 ? (
                <span className="rounded-full bg-[#E8F0DE] px-3 py-2 text-xs font-black text-[#4D613C]">
                  Modifications enregistrées automatiquement
                </span>
              ) : null}
            </div>
          </section>

          {/* Catalogue durable des trames déjà créées */}
          <section className="mb-6 rounded-[24px] border border-[#D8AE77] bg-[#FFF7EA] p-6 shadow-[0_14px_30px_rgba(80,38,18,0.12)]">
            <h2 className="text-lg font-black text-[#2F1D14]">Trames enregistrées</h2>
            <p className="mt-2 text-sm text-[#6A432D]">
              Ouvre une trame existante et modifie les unités nécessaires : les changements sont enregistrés automatiquement.
              Les mappings, historiques et ratios des produits sont conservés. Un fournisseur à 0 ligne permet de démarrer une nouvelle trame.
            </p>

            {templateSupplierIds.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-[#D8AE77] bg-white/50 p-3 text-sm font-semibold text-[#8B6B54]">
                Aucune trame enregistrée pour le moment.
              </p>
            ) : (
              <div className="mt-4 flex flex-wrap gap-3">
                {templateSupplierIds.map((supplierId) => {
                  const config = supplierConfigs[supplierId];
                  const rowCount = orderTemplatesBySupplier[supplierId]?.length
                    || products.filter(product => product.supplierId === supplierId).length;
                  const active = selectedSupplierId === supplierId;
                  return (
                    <button
                      key={`saved-template-${supplierId}`}
                      type="button"
                      onClick={() => openSupplierTemplate(supplierId as SupplierId)}
                      disabled={!canImport}
                      className={`rounded-2xl border px-4 py-3 text-left transition disabled:opacity-50 ${
                        active
                          ? 'border-[#9A5525] bg-[#C86F24] text-white shadow-[0_5px_0_#8B431C]'
                          : 'border-[#D8AE77] bg-[#FFFDF8] text-[#3A2116] hover:bg-white'
                      }`}
                    >
                      <span className="block text-sm font-black">{config?.name || supplierId}</span>
                      <span className={`mt-1 block text-xs font-semibold ${active ? 'text-[#FFE4C4]' : 'text-[#8B6B54]'}`}>
                        {rowCount > 0 ? `${rowCount} ligne(s)` : 'Nouvelle trame · 0 ligne'}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Tableau éditable */}
          <section className="rounded-[24px] border border-[#D8AE77] bg-[#FFF7EA] p-6 shadow-[0_14px_30px_rgba(80,38,18,0.12)]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-black text-[#2F1D14]">Trame</h2>
              <button
                type="button"
                onClick={addEmptyRow}
                disabled={!canImport}
                className="rounded-lg border-2 border-[#E2C39B] bg-[#FFFDF8] px-3 py-1.5 text-xs font-black uppercase tracking-wide text-[#6A432D] transition hover:border-[#C89245] hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                + Ajouter une ligne
              </button>
            </div>

            {orderTemplateRows.length === 0 ? (
              <p className="rounded-lg bg-white/60 p-4 text-sm text-[#9A806A]">
                Aucune ligne pour le moment. Importe un PDF ou ajoute une ligne manuellement.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b-2 border-[#E2C39B]">
                      <th className="pb-3 pr-4 font-black text-[#2F1D14]">Articles</th>
                      <th className="pb-3 pr-4 font-black text-[#2F1D14]">Unité de stockage</th>
                      <th className="pb-3 pr-4 font-black text-[#2F1D14]">Unité de conditionnement</th>
                      <th className="pb-3 font-black text-[#2F1D14]" />
                    </tr>
                  </thead>
                  <tbody>
                    {orderTemplateRows.map((row) => (
                      <tr
                        key={row.id}
                        className={`border-b border-[#E8D8C8] ${flaggedRowIds.has(row.id) ? 'bg-amber-100' : ''}`}
                      >
                        <td className="py-2 pr-4">
                          <textarea
                            value={row.article}
                            onChange={(e) => updateRow(row.id, 'article', e.target.value)}
                            disabled={!canImport}
                            rows={Math.max(1, row.article.split('\n').length)}
                            className="min-h-[42px] w-full resize-y rounded-lg border-2 border-[#E2C39B] bg-[#FFFDF8] px-3 py-2 font-semibold text-[#2F1D14] focus:border-[#B66A2C] focus:outline-none disabled:cursor-not-allowed"
                          />
                        </td>
                        <td className="py-2 pr-4">
                          <input
                            type="text"
                            value={row.storageUnit}
                            onChange={(e) => updateRow(row.id, 'storageUnit', e.target.value)}
                            disabled={!canImport}
                            className="w-full rounded-lg border-2 border-[#E2C39B] bg-[#FFFDF8] px-3 py-2 font-semibold text-[#2F1D14] focus:border-[#B66A2C] focus:outline-none disabled:cursor-not-allowed"
                          />
                        </td>
                        <td className="py-2 pr-4">
                          <input
                            type="text"
                            value={row.packagingUnit}
                            onChange={(e) => updateRow(row.id, 'packagingUnit', e.target.value)}
                            disabled={!canImport}
                            className="w-full rounded-lg border-2 border-[#E2C39B] bg-[#FFFDF8] px-3 py-2 font-semibold text-[#2F1D14] focus:border-[#B66A2C] focus:outline-none disabled:cursor-not-allowed"
                          />
                        </td>
                        <td className="py-2">
                          <button
                            type="button"
                            onClick={() => deleteRow(row.id)}
                            disabled={!canImport}
                            className="rounded-lg border-2 border-[#E7B7A0] bg-[#FFF1EA] px-3 py-2 text-xs font-black text-[#9B3F21] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Supprimer
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
};

export default OrderTemplatePage;
