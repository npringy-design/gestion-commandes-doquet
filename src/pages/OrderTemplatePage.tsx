// =============================================================
// pages/OrderTemplatePage.tsx
// Import d'un PDF Adoria "Bon de préparation de commande" et extraction
// d'un tableau Articles / Unité de stockage / Unité de conditionnement.
//
// Flux :
//  1. Extraction texte via pdf.js (rapide, fiable sur PDF natif).
//  2. Si le PDF est un scan vectorisé (aucun caractère extrait), repli
//     sur un rendu canvas + OCR tesseract.js (langue française).
// =============================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { SupplierId, View } from '../constants';
import AppNavTile from '../components/AppNavTile';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthProvider';
import { canAccessRatiosPage } from '../lib/permissions';
import { OrderLineField, OrderTemplateRow, SupplierConfig } from '../types';
import { ProductWithHistory } from '../data';
import {
  ExtractedWord,
  extractRowsFromDocumentWords,
  mergeTemplateExtractions,
  scoreTemplateExtraction,
} from '../utils/orderTemplateParser';
import { validateImportFile } from '../utils/importFileValidation';
import {
  IMPORT_PROCESSING_TIMEOUTS,
  throwIfImportAborted,
  toSafeImportErrorMessage,
  withImportTimeout,
} from '../utils/importProcessing';

GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

interface OrderTemplatePageProps {
  setView: (v: View) => void;
  orderTemplateRows: OrderTemplateRow[];
  setOrderTemplateRows: React.Dispatch<React.SetStateAction<OrderTemplateRow[]>>;
  products: ProductWithHistory[];
  setProducts: React.Dispatch<React.SetStateAction<ProductWithHistory[]>>;
  updateOrderLineField: (productId: string, field: OrderLineField, value: number | '') => void;
  supplierConfigs: Record<string, SupplierConfig>;
  ratioTab: SupplierId;
  setRatioTab: React.Dispatch<React.SetStateAction<SupplierId>>;
}

const normalizeProductKey = (supplierId: string, name: string) => `${supplierId}::${name.trim().toLowerCase()}`;

const normalizeProductName = (name: string) => name.replace(/\s+/g, ' ').trim();

// Extrait le premier nombre trouvé dans l'unité de conditionnement
// (ex: "carton x 24" -> 24), 1 par défaut si aucun nombre n'est présent.
const parsePackagingQuantity = (packagingUnit: string): number => {
  const match = packagingUnit.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 1;
};

type ProcessingStep = 'idle' | 'reading' | 'ocr' | 'done' | 'error';

interface ImportQualityReport {
  mode: 'texte' | 'OCR' | 'texte + OCR';
  attemptedOcr: boolean;
  rowCount: number;
  codeCount: number;
  incompleteCodeCount: number;
  suspiciousRowCount: number;
  needsReview: boolean;
}

const makeRowId = () => `row_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

const extractWordsFromTextItem = (item: any, viewportHeight: number): ExtractedWord | null => {
  const text = typeof item.str === 'string' ? item.str.trim() : '';
  if (!text) return null;
  const x = item.transform[4];
  const y = item.transform[5];
  const height = Math.abs(Number(item.height ?? item.transform?.[3] ?? 0));
  return { text, x, yTop: viewportHeight - y, height };
};

type RotationDegrees = 0 | 90 | 180 | 270;

// Certains PDF "Print to PDF" (ex: export Adoria) dessinent le contenu
// pivoté dans le flux, sans poser le flag /Rotate de la page : pdf.js les
// rend donc "sur le côté". On détecte la rotation nécessaire une seule fois
// (page 1) en comparant la confiance OCR sur les 4 orientations possibles.
const rotateCanvas = (source: HTMLCanvasElement, degrees: RotationDegrees): HTMLCanvasElement => {
  if (degrees === 0) return source;

  const rotated = document.createElement('canvas');
  const context = rotated.getContext('2d');
  if (!context) throw new Error('Contexte 2D introuvable.');

  if (degrees === 180) {
    rotated.width = source.width;
    rotated.height = source.height;
    context.translate(rotated.width, rotated.height);
    context.rotate(Math.PI);
  } else if (degrees === 90) {
    rotated.width = source.height;
    rotated.height = source.width;
    context.translate(rotated.width, 0);
    context.rotate(Math.PI / 2);
  } else {
    rotated.width = source.height;
    rotated.height = source.width;
    context.translate(0, rotated.height);
    context.rotate(-Math.PI / 2);
  }

  context.drawImage(source, 0, 0);
  return rotated;
};

const ROTATION_CANDIDATES: RotationDegrees[] = [0, 90, 180, 270];
const OCR_RENDER_SCALE = 3;
const LANDSCAPE_USEFUL_TABLE_WIDTH_RATIO = 0.48;

const detectBestRotation = async (
  worker: any,
  canvas: HTMLCanvasElement,
  signal?: AbortSignal,
): Promise<RotationDegrees> => {
  let best: { degrees: RotationDegrees; confidence: number } = { degrees: 0, confidence: -1 };

  for (const degrees of ROTATION_CANDIDATES) {
    throwIfImportAborted(signal);
    const candidate = rotateCanvas(canvas, degrees);
    const { data } = await worker.recognize(candidate, {}, {});
    throwIfImportAborted(signal);
    if (data.confidence > best.confidence) {
      best = { degrees, confidence: data.confidence };
    }
  }

  return best.degrees;
};

const cropCanvas = (source: HTMLCanvasElement, crop: { x: number; y: number; width: number; height: number }): HTMLCanvasElement => {
  const cropped = document.createElement('canvas');
  const context = cropped.getContext('2d');
  if (!context) throw new Error('Contexte 2D introuvable.');

  cropped.width = Math.max(1, Math.floor(crop.width));
  cropped.height = Math.max(1, Math.floor(crop.height));
  context.drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, cropped.width, cropped.height);
  return cropped;
};

const cropOrderTemplateOcrArea = (source: HTMLCanvasElement): HTMLCanvasElement => {
  if (source.width <= source.height) return source;

  return cropCanvas(source, {
    x: 0,
    y: 0,
    width: source.width * LANDSCAPE_USEFUL_TABLE_WIDTH_RATIO,
    height: source.height,
  });
};

const OrderTemplatePage: React.FC<OrderTemplatePageProps> = ({
  setView,
  orderTemplateRows,
  setOrderTemplateRows,
  products,
  setProducts,
  updateOrderLineField,
  supplierConfigs,
  ratioTab,
  setRatioTab,
}) => {
  const { profile } = useAuth();
  const canImport = canAccessRatiosPage(profile);
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pdfAbortControllerRef = useRef<AbortController | null>(null);

  const [step, setStep] = useState<ProcessingStep>('idle');
  const [statusLabel, setStatusLabel] = useState('');
  const [ocrProgress, setOcrProgress] = useState(0);
  const [importQualityReport, setImportQualityReport] = useState<ImportQualityReport | null>(null);
  const supplierOptions = useMemo(
    () => (Object.values(supplierConfigs) as SupplierConfig[]).filter((config) => !config.isArchived),
    [supplierConfigs]
  );
  const selectedSupplierId: SupplierId | '' = supplierOptions.some((config) => config.id === ratioTab) ? ratioTab : '';

  const isProcessing = step === 'reading' || step === 'ocr';

  useEffect(() => () => pdfAbortControllerRef.current?.abort(), []);

  const handleCreateProducts = useCallback(() => {
    if (!canImport) return;
    if (!selectedSupplierId) {
      showToast('Sélectionne un fournisseur avant de créer les produits.', 'warning');
      return;
    }

    const existingKeys = new Set(
      products.map((p) => normalizeProductKey(p.supplierId ?? '', p.name))
    );
    const seenKeys = new Set<string>();
    const toCreate: ProductWithHistory[] = [];
    const packagingByProductId: Record<string, number> = {};
    let duplicateCount = 0;

    orderTemplateRows.forEach((row, index) => {
      const article = normalizeProductName(row.article);
      if (!article) return;

      const key = normalizeProductKey(selectedSupplierId, article);
      if (existingKeys.has(key) || seenKeys.has(key)) {
        duplicateCount += 1;
        return;
      }
      seenKeys.add(key);

      const id = `custom-${Date.now()}-${index}`;
      const packaging = parsePackagingQuantity(row.packagingUnit);
      packagingByProductId[id] = packaging;

      toCreate.push({
        id,
        supplierId: selectedSupplierId,
        name: article,
        searchName: article,
        storageUnit: row.storageUnit.trim() || undefined,
        packaging,
        defaultMargin: 0,
        salesHistory: {},
      });
    });

    if (duplicateCount > 0) {
      const proceed = window.confirm(
        `${duplicateCount} doublon(s) détecté(s) (même nom + fournisseur) et seront ignorés. Créer les ${toCreate.length} autre(s) produit(s) ?`
      );
      if (!proceed) return;
    }

    if (toCreate.length === 0) {
      showToast('Aucun produit à créer (lignes vides ou déjà existantes).', 'warning');
      return;
    }

    setProducts((prev) => [...toCreate, ...prev]);
    // Champs opérationnels (stock/livraison/cible/conditionnement) vivent
    // dans order_line_states : on seed la ligne de chaque nouveau produit.
    toCreate.forEach((p) => {
      updateOrderLineField(p.id, 'stock', 0);
      updateOrderLineField(p.id, 'upcomingDelivery', 0);
      updateOrderLineField(p.id, 'targetStock', 0);
      updateOrderLineField(p.id, 'packaging', packagingByProductId[p.id]);
    });
    showToast(`✓ ${toCreate.length} produit(s) créé(s)`, 'success');
  }, [canImport, orderTemplateRows, products, selectedSupplierId, setProducts, showToast, updateOrderLineField]);

  const extractViaText = useCallback(async (pdf: any, signal?: AbortSignal) => {
    const pagesWords: ExtractedWord[][] = [];
    let totalChars = 0;

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      throwIfImportAborted(signal);
      setStatusLabel(`Lecture du texte — page ${pageNum}/${pdf.numPages}`);
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1 });
      const textContent = await page.getTextContent();
      throwIfImportAborted(signal);
      const words: ExtractedWord[] = [];

      (textContent.items as any[]).forEach((item) => {
        const word = extractWordsFromTextItem(item, viewport.height);
        if (word) {
          words.push(word);
          totalChars += word.text.length;
        }
      });

      pagesWords.push(words);
    }

    return { pagesWords, totalChars };
  }, []);

  const extractViaOcr = useCallback(async (pdf: any, signal?: AbortSignal) => {
    const { createWorker, PSM } = await import('tesseract.js');
    setStatusLabel('Préparation de la reconnaissance de texte (OCR)…');
    const worker = await createWorker('fra', undefined, {
      logger: (m: { status: string; progress: number }) => {
        if (m.status === 'recognizing text') {
          setOcrProgress(Math.round(m.progress * 100));
        }
      },
    });
    // Le mode par défaut de Tesseract traite l'image comme un bloc de texte
    // unique. Il convient aux documents simples mais mélange les cellules des
    // tableaux denses. AUTO détecte les blocs et colonnes avant de reconnaître
    // les mots, sans dépendre d'un fournisseur ou d'un gabarit précis.
    await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });

    const pagesWords: ExtractedWord[][] = [];
    let rotationDegrees: RotationDegrees = 0;
    let terminated = false;
    const terminateWorker = async () => {
      if (terminated) return;
      terminated = true;
      await worker.terminate();
    };
    const abortWorker = () => { void terminateWorker().catch(() => undefined); };
    signal?.addEventListener('abort', abortWorker, { once: true });

    try {
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        throwIfImportAborted(signal);
        setOcrProgress(0);
        setStatusLabel(`OCR — page ${pageNum}/${pdf.numPages}`);
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: OCR_RENDER_SCALE });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);

        const context = canvas.getContext('2d');
        if (!context) throw new Error('Contexte 2D introuvable.');
        await page.render({ canvasContext: context, canvas, viewport }).promise;
        throwIfImportAborted(signal);

        if (pageNum === 1) {
          setStatusLabel('Détection de l’orientation du document…');
          rotationDegrees = await detectBestRotation(worker, canvas, signal);
          console.info(`[OrderTemplatePage] Rotation détectée : ${rotationDegrees}°`);
          setStatusLabel(`OCR — page ${pageNum}/${pdf.numPages}`);
        }

        const orientedCanvas = rotateCanvas(canvas, rotationDegrees);
        const ocrCanvas = cropOrderTemplateOcrArea(orientedCanvas);
        const { data } = await worker.recognize(ocrCanvas, {}, { blocks: true });
        throwIfImportAborted(signal);
        const words: ExtractedWord[] = [];
        let ocrLineIndex = 0;

        (data.blocks ?? []).forEach((block) => {
          block.paragraphs.forEach((paragraph) => {
            paragraph.lines.forEach((line) => {
              const lineId = `page-${pageNum}-line-${ocrLineIndex}`;
              ocrLineIndex += 1;
              line.words.forEach((word) => {
                const text = word.text.trim();
                if (!text) return;
                words.push({
                  text,
                  x: word.bbox.x0,
                  yTop: word.bbox.y0,
                  height: Math.max(1, word.bbox.y1 - word.bbox.y0),
                  lineId,
                });
              });
            });
          });
        });

        pagesWords.push(words);
      }
    } finally {
      signal?.removeEventListener('abort', abortWorker);
      await terminateWorker().catch(() => undefined);
    }

    return pagesWords;
  }, []);

  const handleFile = useCallback(async (file: File) => {
    if (!canImport || isProcessing) return;
    pdfAbortControllerRef.current?.abort();
    const controller = new AbortController();
    pdfAbortControllerRef.current = controller;
    let loadingTask: ReturnType<typeof getDocument> | null = null;
    let pdf: any = null;

    setStep('reading');
    setOcrProgress(0);
    setStatusLabel('Lecture du fichier PDF…');

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
      pdf = await withImportTimeout(
        loadingTask.promise,
        IMPORT_PROCESSING_TIMEOUTS.pdfLoad,
        'L’ouverture du PDF a dépassé 20 secondes.',
        () => { controller.abort(); void loadingTask?.destroy(); },
      );

      const processed = await withImportTimeout((async () => {
        const { pagesWords, totalChars } = await extractViaText(pdf, controller.signal);
        let finalPagesWords = pagesWords;
        let extraction = extractRowsFromDocumentWords(pagesWords);
        let usedOcr = false;
        let hybridMode = false;
        let attemptedOcr = false;
        let maximumDetectedCodeCount = extraction.codeCount;

        console.info(`[OrderTemplatePage] Extraction texte : ${pdf.numPages} page(s), ${totalChars} caractère(s) trouvé(s).`);
        console.info('[OrderTemplatePage] Qualité texte natif :', {
          score: scoreTemplateExtraction(extraction),
          codes: extraction.codeCount,
          rows: extraction.rows.length,
          incomplete: extraction.incompleteCodeCount,
          suspicious: extraction.suspiciousRowCount,
        });

        // Un PDF peut exposer beaucoup de caractères tout en ayant une table
        // mal encodée ou des cellules positionnées sur des baselines distinctes.
        // On relance alors automatiquement une lecture visuelle OCR, puis on
        // conserve objectivement la version la plus complète et la plus saine.
        if (totalChars < 20 || extraction.needsReview) {
          setStep('ocr');
          attemptedOcr = true;
          const ocrPagesWords = await extractViaOcr(pdf, controller.signal);
          const ocrExtraction = extractRowsFromDocumentWords(ocrPagesWords);
          maximumDetectedCodeCount = Math.max(maximumDetectedCodeCount, ocrExtraction.codeCount);
          console.info('[OrderTemplatePage] Qualité OCR :', {
            score: scoreTemplateExtraction(ocrExtraction),
            codes: ocrExtraction.codeCount,
            rows: ocrExtraction.rows.length,
            incomplete: ocrExtraction.incompleteCodeCount,
            suspicious: ocrExtraction.suspiciousRowCount,
          });

          if (totalChars < 20 || extraction.rows.length === 0) {
            finalPagesWords = ocrPagesWords;
            extraction = ocrExtraction;
            usedOcr = true;
          } else {
            // Sur un PDF natif, l'OCR ne remplace plus toute la table. Il ne
            // fait que compléter les cellules ou codes absents, afin de ne pas
            // transformer les accents, marques ou fins de libellés pourtant
            // correctement encodés dans le document.
            extraction = mergeTemplateExtractions(extraction, ocrExtraction);
            usedOcr = true;
            hybridMode = true;
          }
        }

        return { finalPagesWords, extraction, usedOcr, hybridMode, attemptedOcr, maximumDetectedCodeCount };
      })(), IMPORT_PROCESSING_TIMEOUTS.pdfProcessing,
      'Le traitement du PDF a dépassé 2 minutes et a été arrêté.',
      () => { controller.abort(); void pdf?.destroy(); });

      const {
        finalPagesWords,
        extraction,
        usedOcr,
        hybridMode,
        attemptedOcr,
        maximumDetectedCodeCount,
      } = processed;

      finalPagesWords.forEach((words, idx) => {
        console.info(`[OrderTemplatePage] Page ${idx + 1} (${usedOcr ? 'OCR' : 'texte'}) : ${words.length} mot(s) positionné(s).`);
      });

      const {
        rows: parsedRows,
        headerFound,
        pagesDebug,
        codeCount: selectedCodeCount,
        incompleteCodeCount: selectedIncompleteCodeCount,
        suspiciousRowCount,
        needsReview: selectedNeedsReview,
      } = extraction;
      const codeCount = Math.max(selectedCodeCount, maximumDetectedCodeCount);
      const incompleteCodeCount = Math.max(
        selectedIncompleteCodeCount,
        Math.max(0, codeCount - parsedRows.length),
      );
      const needsReview = selectedNeedsReview || incompleteCodeCount > 0;
      console.info('[OrderTemplatePage] En-tête détecté :', headerFound, pagesDebug, {
        selectedMode: usedOcr ? 'OCR' : 'texte',
        attemptedOcr,
      });
      setImportQualityReport({
        mode: hybridMode ? 'texte + OCR' : usedOcr ? 'OCR' : 'texte',
        attemptedOcr,
        rowCount: parsedRows.length,
        codeCount,
        incompleteCodeCount,
        suspiciousRowCount,
        needsReview,
      });

      if (parsedRows.length === 0) {
        if (!headerFound) {
          showToast(
            "En-tête du tableau introuvable dans ce PDF (Articles / Unité de Stock / Conditionnement). Vérifiez le fichier ou saisissez manuellement.",
            'warning'
          );
        } else {
          showToast('En-tête trouvé mais aucune ligne exploitable en dessous. Vérifiez le fichier ou saisissez manuellement.', 'warning');
        }
      } else if (needsReview) {
        const reviewReasons = [
          incompleteCodeCount > 0 ? `${incompleteCodeCount} code(s) sans article complet` : '',
          suspiciousRowCount > 0 ? `${suspiciousRowCount} ligne(s) à contrôler` : '',
        ].filter(Boolean).join(', ');
        showToast(
          `⚠ ${parsedRows.length} ligne(s) récupérée(s), mais la lecture reste incertaine${reviewReasons ? ` : ${reviewReasons}` : ''}. Contrôlez le tableau avant de créer les produits.`,
          'warning'
        );
      } else {
        showToast(`✓ ${parsedRows.length} ligne(s) importée(s)`, 'success');
      }

      setOrderTemplateRows(parsedRows.map((row) => ({
        id: makeRowId(),
        article: row.article,
        storageUnit: row.storageUnit,
        packagingUnit: row.packagingUnit,
      })));
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
      if (pdf) await pdf.destroy().catch(() => undefined);
      else if (loadingTask) await loadingTask.destroy().catch(() => undefined);
      if (pdfAbortControllerRef.current === controller) {
        pdfAbortControllerRef.current = null;
        setStatusLabel('');
        setOcrProgress(0);
      }
    }
  }, [canImport, isProcessing, extractViaText, extractViaOcr, setOrderTemplateRows, showToast]);

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
              Importe un PDF Adoria « Bon de préparation de commande ». Les colonnes Code, Articles, Unité de stockage
              et Conditionnement servent à reconstruire chaque ligne logique. Si la lecture texte paraît incomplète,
              l'application relance automatiquement une lecture visuelle OCR et affiche clairement tout contrôle restant.
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
                      style={{ width: `${ocrProgress}%` }}
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
                  {importQualityReport.needsReview ? 'Lecture à contrôler' : 'Lecture vérifiée'} — {importQualityReport.mode}
                  {importQualityReport.attemptedOcr ? ' après comparaison automatique avec l’OCR' : ''}
                </p>
                <p className="mt-1">
                  {importQualityReport.codeCount > 0
                    ? `${importQualityReport.codeCount} code(s) détecté(s), ${importQualityReport.rowCount} ligne(s) restituée(s).`
                    : `${importQualityReport.rowCount} ligne(s) restituée(s).`}
                  {importQualityReport.incompleteCodeCount > 0
                    ? ` ${importQualityReport.incompleteCodeCount} code(s) restent incomplets.`
                    : ''}
                  {importQualityReport.suspiciousRowCount > 0
                    ? ` ${importQualityReport.suspiciousRowCount} ligne(s) présentent encore un texte ou une unité atypique.`
                    : ''}
                </p>
              </div>
            )}
          </section>

          {/* Création des produits dans Vente calcul ratio */}
          <section className="mb-6 rounded-[24px] border border-[#D8AE77] bg-[#FFF7EA] p-6 shadow-[0_14px_30px_rgba(80,38,18,0.12)]">
            <h2 className="mb-4 text-lg font-black text-[#2F1D14]">Créer les produits (Vente calcul ratio)</h2>

            <p className="mb-4 text-sm text-[#6A432D]">
              Sélectionne le fournisseur associé à cette trame, puis crée les produits correspondants avec leur unité
              de stockage et leur conditionnement. Les doublons (même nom + fournisseur) sont ignorés.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={selectedSupplierId}
                onChange={(e) => setRatioTab(e.target.value as SupplierId)}
                disabled={!canImport}
                className="rounded-lg border-2 border-[#E2C39B] bg-[#FFFDF8] px-4 py-2 text-sm font-semibold text-[#2F1D14] focus:border-[#B66A2C] focus:outline-none disabled:cursor-not-allowed"
              >
                <option value="">Choisir un fournisseur…</option>
                {supplierOptions.map((config) => (
                  <option key={config.id} value={config.id}>
                    {config.name}
                  </option>
                ))}
              </select>

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
                Créer les produits
              </button>
            </div>
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
                      <tr key={row.id} className="border-b border-[#E8D8C8]">
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
