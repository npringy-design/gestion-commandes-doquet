// =============================================================
// pages/OrderTemplatePage.tsx
// Import d'un PDF de trame de commande (bon de préparation, bon de commande)
// de n'importe quel fournisseur : article, unité de stockage et unité de
// conditionnement de chaque produit.
//
// Flux déterministe, sans IA ni API externe :
//  1. texte natif pdf.js, orientation de la page, grille tracée dans le PDF ou
//     colonnes détectées par les espaces ;
//  2. PDF scanné (moins de 20 caractères de texte natif) : mots lus par OCR
//     Tesseract, mêmes colonnes, confirmation toujours obligatoire ;
//  3. rôle de chaque colonne proposé, confirmé par l'utilisateur quand il
//     est ambigu, puis mémorisé par fournisseur ;
//  4. valeurs recopiées telles quelles ; les lignes douteuses sont surlignées.
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
import type { TableLayout } from '../utils/pdfTableLayout';
import {
  NATIVE_TEXT_MIN_CHARS,
  buildPageLayouts,
  readNativePages,
  readScannedPages,
} from '../utils/orderTemplatePdfSource';
import {
  COLUMN_ROLES,
  COLUMN_ROLE_LABELS,
  applyStoredMapping,
  buildStoredMapping,
  getNonEmptyColumnIndexes,
  getPreviewRows,
  loadStoredColumnMapping,
  saveStoredColumnMapping,
  suggestColumnRoles,
  type ColumnRole,
  type ColumnRoleSuggestion,
} from '../utils/orderTemplateColumnRoles';
import { extractTemplateRows } from '../utils/orderTemplateRowExtraction';
import { createRasterScanSession, type RasterProgress, type RasterSession } from '../utils/orderTemplateRasterScan';
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

type ProcessingStep = 'idle' | 'reading' | 'ocr' | 'confirming' | 'done' | 'error';

type ImportMode = 'grille' | 'colonnes' | 'scan';

interface ImportQualityReport {
  mode: ImportMode;
  rowCount: number;
  flaggedRowCount: number;
  needsReview: boolean;
}

const IMPORT_MODE_LABELS: Record<ImportMode, string> = {
  grille: 'grille du tableau détectée',
  colonnes: 'colonnes détectées par les espaces',
  scan: 'PDF scanné (lecture visuelle)',
};

// Lecture d'un PDF en attente de confirmation des colonnes, ou déjà importée.
interface PendingImport {
  layouts: TableLayout[];
  mode: ImportMode;
  scanned: boolean;
  // Page 1 seulement lue (lecture cellule par cellule) : les pages suivantes
  // seront lues après la confirmation des colonnes.
  raster: boolean;
  suggestion: ColumnRoleSuggestion;
  roles: ColumnRole[];
  headerTexts: string[];
  // Tous les rôles sont sûrs (suggestion non ambiguë ou choix mémorisé).
  allSure: boolean;
  imported: boolean;
  editing: boolean;
  visibleColumns: number[];
  previewRows: string[][];
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
  // Lecture cellule par cellule d'un PDF sans texte : la session et le document
  // restent ouverts entre la page 1 et la confirmation des colonnes.
  const rasterSessionRef = useRef<RasterSession | null>(null);
  const rasterControllerRef = useRef<AbortController | null>(null);
  const rasterTaskRef = useRef<{ destroy: () => Promise<unknown> } | null>(null);

  const [step, setStep] = useState<ProcessingStep>('idle');
  const [statusLabel, setStatusLabel] = useState('');
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [importQualityReport, setImportQualityReport] = useState<ImportQualityReport | null>(null);
  // Lignes importées à contrôler, surlignées dans le tableau. Non persisté.
  const [flaggedRowIds, setFlaggedRowIds] = useState<Set<string>>(() => new Set());
  const [flaggedRowReasons, setFlaggedRowReasons] = useState<Record<string, string[]>>({});
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const supplierOptions = useMemo(
    () => getOrderTemplateSupplierOptions(supplierConfigs),
    [supplierConfigs]
  );
  const selectedSupplierId: SupplierId | '' = supplierOptions.some((config) => config.id === ratioTab) ? ratioTab : '';

  const isProcessing = step === 'reading' || step === 'ocr';
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

  const disposeRasterSession = useCallback(() => {
    rasterControllerRef.current?.abort();
    rasterControllerRef.current = null;
    const session = rasterSessionRef.current;
    rasterSessionRef.current = null;
    if (session) void session.dispose();
    const task = rasterTaskRef.current;
    rasterTaskRef.current = null;
    if (task) void task.destroy().catch(() => undefined);
  }, []);

  useEffect(() => () => {
    pdfAbortControllerRef.current?.abort();
    disposeRasterSession();
  }, [disposeRasterSession]);

  const reportRasterProgress = useCallback(({ page, pageCount, cell, cellCount }: RasterProgress) => {
    setStatusLabel(`Lecture de la page ${page}/${pageCount}, cellule ${cell}/${cellCount}`);
    setAnalysisProgress(Math.round(((page - 1 + cell / Math.max(1, cellCount)) / pageCount) * 100));
  }, []);

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
    setFlaggedRowReasons({});
    setPendingImport(null);
    disposeRasterSession();
  }, [disposeRasterSession, orderTemplateRows, orderTemplatesBySupplier, products, selectedSupplierId, setOrderTemplateRows, setOrderTemplatesBySupplier, setRatioTab]);

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

  // Importe les lignes d'une lecture avec les rôles de colonnes retenus.
  const importWithRoles = useCallback((pending: PendingImport, roles: ColumnRole[]): boolean => {
    const extracted = extractTemplateRows(pending.layouts, roles, pending.headerTexts);
    const importedRows: OrderTemplateRow[] = extracted.rows.map((row) => ({
      id: makeRowId(),
      sourceCode: row.code || undefined,
      article: row.article,
      storageUnit: row.storageUnit,
      packagingUnit: row.packagingUnit,
    }));

    const needsReview = extracted.flaggedCount > 0 || pending.scanned;
    setImportQualityReport({
      mode: pending.mode,
      rowCount: importedRows.length,
      flaggedRowCount: extracted.flaggedCount,
      needsReview,
    });

    if (importedRows.length === 0) {
      // Le tableau existant n'est pas écrasé par un import qui n'a rien produit.
      showToast('Aucune ligne produit trouvée avec ces colonnes. Vérifie leur rôle ou saisis la trame manuellement.', 'warning');
      return false;
    }

    setOrderTemplateRows(importedRows);
    setFlaggedRowIds(new Set(
      extracted.rows.flatMap((row, index) => (row.reasons.length > 0 ? [importedRows[index].id] : [])),
    ));
    setFlaggedRowReasons(Object.fromEntries(
      extracted.rows.flatMap((row, index) => (row.reasons.length > 0 ? [[importedRows[index].id, row.reasons]] : [])),
    ));
    if (selectedSupplierId) {
      saveStoredColumnMapping(selectedSupplierId, buildStoredMapping(pending.headerTexts, roles));
    }

    if (needsReview) {
      showToast(
        extracted.flaggedCount > 0
          ? `⚠ ${importedRows.length} ligne(s) importée(s) : ${extracted.flaggedCount} surlignée(s) à contrôler`
          : `⚠ ${importedRows.length} ligne(s) importée(s) : lecture d’un PDF scanné à contrôler`,
        'warning',
      );
    } else {
      showToast(`✓ ${importedRows.length} ligne(s) importée(s)`, 'success');
    }
    return true;
  }, [selectedSupplierId, setOrderTemplateRows, showToast]);

  const handleFile = useCallback(async (file: File) => {
    if (!canImport || isProcessing) return;
    pdfAbortControllerRef.current?.abort();
    disposeRasterSession();
    const controller = new AbortController();
    pdfAbortControllerRef.current = controller;
    let loadingTask: ReturnType<typeof getDocument> | null = null;

    setStep('reading');
    setStatusLabel('Lecture du PDF…');
    setAnalysisProgress(0);
    setImportQualityReport(null);
    setFlaggedRowIds(new Set());
    setFlaggedRowReasons({});
    setPendingImport(null);

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
      const pdf = await withImportTimeout(
        loadingTask.promise,
        IMPORT_PROCESSING_TIMEOUTS.pdfLoad,
        'L’ouverture du PDF a dépassé 20 secondes.',
        () => { controller.abort(); void loadingTask?.destroy(); },
      );

      setStatusLabel('Lecture du tableau du PDF…');
      const native = await withImportTimeout(
        readNativePages(pdf, controller.signal),
        IMPORT_PROCESSING_TIMEOUTS.pdfProcessing,
        'La lecture du PDF a dépassé 2 minutes et a été arrêtée.',
        () => { controller.abort(); void loadingTask?.destroy(); },
      );

      // Moins de 20 caractères de texte natif : PDF scanné ou texte converti en tracés.
      const scanned = native.totalChars < NATIVE_TEXT_MIN_CHARS;
      let pages = native.pages;
      let rasterLayout: TableLayout | null = null;
      if (scanned) {
        setStep('ocr');
        // Quadrillage détecté sur l'image puis OCR cellule par cellule : seule la
        // page 1 est lue ici, les colonnes sont confirmées avant les autres pages.
        const rasterController = new AbortController();
        rasterControllerRef.current = rasterController;
        const session = createRasterScanSession({
          pdf,
          signal: rasterController.signal,
          onProgress: reportRasterProgress,
        });
        rasterSessionRef.current = session;
        rasterLayout = await withImportTimeout(
          session.readFirstPage(),
          IMPORT_PROCESSING_TIMEOUTS.pdfScanOcr,
          'La lecture de la première page a dépassé 8 minutes et a été arrêtée.',
          () => { disposeRasterSession(); controller.abort(); },
        );

        if (rasterLayout) {
          rasterTaskRef.current = loadingTask;
        } else {
          // Aucun quadrillage : repli sur la lecture visuelle par colonnes.
          await session.dispose();
          rasterSessionRef.current = null;
          rasterControllerRef.current = null;
          showToast('Aucun quadrillage détecté : lecture visuelle par colonnes, contrôle obligatoire.', 'warning');
          pages = await withImportTimeout(
            readScannedPages(pdf, {
              signal: controller.signal,
              onPage: (pageNumber, pageCount) => {
                setStatusLabel(`Lecture visuelle — page ${pageNumber}/${pageCount}`);
                setAnalysisProgress(Math.round(((pageNumber - 1) / pageCount) * 100));
              },
            }),
            IMPORT_PROCESSING_TIMEOUTS.pdfScanOcr,
            'La lecture visuelle du PDF a dépassé 8 minutes et a été arrêtée.',
            () => { controller.abort(); void loadingTask?.destroy(); },
          );
        }
      }
      throwIfImportAborted(controller.signal);

      const layouts = rasterLayout ? [rasterLayout] : buildPageLayouts(pages);
      if (layouts.length === 0) {
        showToast('Aucun tableau reconnu dans ce PDF. Vérifie le fichier ou saisis la trame manuellement.', 'warning');
        setStep('done');
        return;
      }

      const reference = layouts[0];
      const suggestion = suggestColumnRoles(reference);
      const storedRoles = selectedSupplierId
        ? applyStoredMapping(loadStoredColumnMapping(selectedSupplierId), suggestion.headerTexts, suggestion.roles)
        : null;
      const roles = storedRoles ?? suggestion.roles;
      const pending: PendingImport = {
        layouts,
        mode: scanned ? 'scan' : reference.source,
        scanned,
        raster: rasterLayout !== null,
        suggestion,
        roles,
        headerTexts: suggestion.headerTexts,
        allSure: storedRoles !== null || suggestion.overall === 'sure',
        imported: false,
        editing: false,
        visibleColumns: getNonEmptyColumnIndexes(reference, suggestion.bodyStart),
        previewRows: getPreviewRows(reference, suggestion.bodyStart),
      };

      if (scanned) showToast('PDF scanné : lecture moins fiable, contrôle obligatoire.', 'warning');

      if (!scanned && pending.allSure) {
        // Colonnes sûres : import direct, le résumé reste modifiable.
        const imported = importWithRoles(pending, roles);
        setPendingImport({ ...pending, imported });
        setStep('done');
      } else {
        setPendingImport(pending);
        setStep('confirming');
      }
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
      // Détruire la tâche de chargement libère aussi le document et son Worker,
      // sauf quand la lecture cellule par cellule en a encore besoin.
      if (loadingTask && rasterTaskRef.current !== loadingTask) await loadingTask.destroy().catch(() => undefined);
      if (pdfAbortControllerRef.current === controller) {
        pdfAbortControllerRef.current = null;
        setStatusLabel('');
        setAnalysisProgress(0);
      }
    }
  }, [canImport, disposeRasterSession, importWithRoles, isProcessing, reportRasterProgress, selectedSupplierId, showToast]);

  // Un rôle ne peut désigner qu'une colonne : le choisir ailleurs libère l'ancienne.
  const changeColumnRole = (columnIndex: number, role: ColumnRole) => {
    setPendingImport((current) => {
      if (!current) return current;
      const roles = current.roles.map((existing, index) => {
        if (index === columnIndex) return role;
        return role !== 'ignore' && existing === role ? 'ignore' : existing;
      });
      return { ...current, roles };
    });
  };

  const confirmImport = async () => {
    if (!pendingImport) return;
    const session = rasterSessionRef.current;

    if (pendingImport.raster && session) {
      // Lecture cellule par cellule des pages suivantes, avec les colonnes confirmées.
      const { roles } = pendingImport;
      setStep('ocr');
      setStatusLabel('Lecture des pages suivantes…');
      setAnalysisProgress(0);
      try {
        const result = await withImportTimeout(
          (async () => {
            const first = await session.completeFirstPage(pendingImport.layouts[0], roles);
            const others = await session.readRemainingPages(roles, first);
            return { first, ...others };
          })(),
          IMPORT_PROCESSING_TIMEOUTS.pdfScanOcr,
          'La lecture des pages a dépassé 8 minutes et a été arrêtée.',
          () => disposeRasterSession(),
        );
        const pending: PendingImport = { ...pendingImport, layouts: [result.first, ...result.layouts], raster: false };
        if (result.wordPages.length > 0) {
          showToast(
            `Page(s) ${result.wordPages.join(', ')} sans quadrillage détecté : lues par colonnes, à contrôler.`,
            'warning',
          );
        }
        const imported = importWithRoles(pending, roles);
        setPendingImport({ ...pending, imported, editing: !imported });
        setStep('done');
      } catch (err) {
        showToast(toSafeImportErrorMessage(err, 'La lecture des pages suivantes a échoué.'), 'error');
        setPendingImport(null);
        setStep('error');
      } finally {
        disposeRasterSession();
        setStatusLabel('');
        setAnalysisProgress(0);
      }
      return;
    }

    const imported = importWithRoles(pendingImport, pendingImport.roles);
    setPendingImport({ ...pendingImport, imported, editing: !imported });
    setStep('done');
  };

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
    disposeRasterSession();
    setImportQualityReport(null);
    setFlaggedRowIds(new Set());
    setFlaggedRowReasons({});
    setPendingImport(null);
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
              Importe le PDF d'une trame de commande, quel que soit le fournisseur. L'application lit le tableau,
              propose le rôle de chaque colonne (article, unité de stockage, conditionnement) et te demande de le
              confirmer quand elle hésite ; ton choix est mémorisé pour ce fournisseur. Les lignes douteuses sont
              surlignées, jamais corrigées.
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
                {step === 'ocr' && (
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#F4E8D8]">
                    <div
                      className="h-full rounded-full bg-[#C86F24] transition-all"
                      style={{ width: `${analysisProgress}%` }}
                    />
                  </div>
                )}
              </div>
            )}

            {!isProcessing && pendingImport && (
              <div className="mt-4 rounded-lg border border-[#E2C39B] bg-white/70 p-3 text-sm text-[#2F1D14]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-black">Colonnes de la trame</p>
                  {pendingImport.imported && !pendingImport.editing && (
                    <button
                      type="button"
                      onClick={() => setPendingImport({ ...pendingImport, editing: true })}
                      className="rounded-lg border-2 border-[#E2C39B] bg-[#FFFDF8] px-3 py-1 text-xs font-black text-[#6A432D] transition hover:bg-white"
                    >
                      Modifier
                    </button>
                  )}
                </div>

                {pendingImport.scanned && (
                  <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 font-semibold text-amber-900">
                    PDF scanné : lecture moins fiable, contrôle obligatoire.
                  </p>
                )}

                {pendingImport.imported && !pendingImport.editing && pendingImport.allSure && !pendingImport.scanned ? (
                  <p className="mt-2 text-[#6A432D]">
                    {([
                      ['article', 'Article'],
                      ['storageUnit', 'Unité de stockage'],
                      ['packagingUnit', 'Conditionnement'],
                    ] as const).map(([role, label]) => {
                      const column = pendingImport.roles.indexOf(role);
                      return `${label} : « ${column >= 0 ? pendingImport.headerTexts[column] || `colonne ${column + 1}` : 'aucune'} »`;
                    }).join(' · ')}
                  </p>
                ) : (
                  <>
                    <p className="mt-2 text-[#6A432D]">
                      {pendingImport.allSure && !pendingImport.scanned
                        ? 'Vérifie le rôle de chaque colonne avant de réimporter.'
                        : 'Confirme le rôle de chaque colonne avant l’import : l’application hésite ou le PDF est scanné.'}
                    </p>
                    <div className="mt-2 overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr>
                            {pendingImport.visibleColumns.map((column) => (
                              <th key={column} className="min-w-[140px] pb-2 pr-3 align-top">
                                <span className="mb-1 block font-bold text-[#8B6B54]">
                                  {pendingImport.headerTexts[column] || `Colonne ${column + 1}`}
                                </span>
                                <select
                                  value={pendingImport.roles[column] ?? 'ignore'}
                                  onChange={(event) => changeColumnRole(column, event.target.value as ColumnRole)}
                                  className="w-full rounded-md border-2 border-[#E2C39B] bg-[#FFFDF8] px-2 py-1 text-xs font-semibold text-[#2F1D14] focus:border-[#B66A2C] focus:outline-none"
                                >
                                  {COLUMN_ROLES.map((role) => (
                                    <option key={role} value={role}>{COLUMN_ROLE_LABELS[role]}</option>
                                  ))}
                                </select>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {pendingImport.previewRows.map((row, rowIndex) => (
                            <tr key={rowIndex} className="border-t border-[#E8D8C8]">
                              {pendingImport.visibleColumns.map((column) => (
                                <td key={column} className="py-1 pr-3 align-top">{row[column]}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <button
                      type="button"
                      onClick={confirmImport}
                      disabled={!canImport || !pendingImport.roles.includes('article')}
                      className={`mt-3 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                        canImport && pendingImport.roles.includes('article')
                          ? 'bg-[#C86F24] text-white shadow-[0_4px_0_#8B431C] hover:bg-[#B85F1D]'
                          : 'cursor-not-allowed bg-[#F4E8D8] text-[#9A806A]'
                      }`}
                    >
                      {pendingImport.imported ? 'Réimporter avec ces colonnes' : 'Importer avec ces colonnes'}
                    </button>
                    {!pendingImport.roles.includes('article') && (
                      <p className="mt-1 text-xs font-semibold text-[#9B3F21]">Désigne la colonne Article pour importer.</p>
                    )}
                  </>
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
                  {importQualityReport.needsReview ? 'Lecture à contrôler' : 'Lecture vérifiée'} — {IMPORT_MODE_LABELS[importQualityReport.mode]}
                </p>
                <p className="mt-1">
                  {importQualityReport.rowCount} ligne(s) lue(s), {importQualityReport.flaggedRowCount} à contrôler
                  {importQualityReport.flaggedRowCount > 0 ? ' (surlignées, avec la raison sous l’article).' : '.'}
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
                          {flaggedRowReasons[row.id] && (
                            <p className="mt-1 text-xs font-semibold text-amber-800">
                              ⚠ À contrôler : {flaggedRowReasons[row.id].join(' · ')}
                            </p>
                          )}
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
