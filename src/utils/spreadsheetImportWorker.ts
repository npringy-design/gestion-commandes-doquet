import {
  createImportCancelledError,
  IMPORT_PROCESSING_TIMEOUTS,
  ImportProcessingError,
  throwIfImportAborted,
  withImportTimeout,
} from './importProcessing';

export interface MarginCatalogImportItem {
  label: string;
  normalized: string;
  costHt: number | null;
  sellPriceHt: number | null;
  marginPercent: number | null;
  marginEuro: number | null;
  sourceSheet: string;
  section: string;
}

type SpreadsheetWorkerOperation = 'to-csv' | 'margin-catalog';
type SpreadsheetWorkerResponse<T> = { ok: true; result: T } | { ok: false };

interface SpreadsheetWorkerLike {
  onmessage: ((event: MessageEvent<SpreadsheetWorkerResponse<unknown>>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage: (message: unknown, transfer: Transferable[]) => void;
  terminate: () => void;
}

type SpreadsheetWorkerFactory = () => SpreadsheetWorkerLike;

const createBrowserSpreadsheetWorker: SpreadsheetWorkerFactory = () =>
  new Worker(new URL('../workers/spreadsheetImport.worker.ts', import.meta.url), { type: 'module' });

interface SpreadsheetWorkerOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  workerFactory?: SpreadsheetWorkerFactory;
}

export const runSpreadsheetImportWorker = async <T>(
  operation: SpreadsheetWorkerOperation,
  buffer: ArrayBuffer,
  options: SpreadsheetWorkerOptions = {},
): Promise<T> => {
  const { signal, timeoutMs = IMPORT_PROCESSING_TIMEOUTS.spreadsheet } = options;
  throwIfImportAborted(signal);

  const worker = (options.workerFactory ?? createBrowserSpreadsheetWorker)();
  let abortHandler: (() => void) | null = null;

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => finish(() => reject(new ImportProcessingError(
      'timeout',
      'Le traitement Excel a dépassé 30 secondes et a été arrêté.',
    ))), timeoutMs);

    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.onmessage = null;
      worker.onerror = null;
      if (abortHandler) signal?.removeEventListener('abort', abortHandler);
      worker.terminate();
      callback();
    };

    abortHandler = () => finish(() => reject(createImportCancelledError()));
    signal?.addEventListener('abort', abortHandler, { once: true });

    worker.onmessage = (event) => {
      const response = event.data as SpreadsheetWorkerResponse<T>;
      if (response?.ok) finish(() => resolve(response.result));
      else finish(() => reject(new ImportProcessingError(
        'processing_failed',
        'Impossible de traiter ce fichier Excel. Vérifie qu’il n’est pas corrompu.',
      )));
    };
    worker.onerror = () => finish(() => reject(new ImportProcessingError(
      'processing_failed',
      'Le traitement Excel a échoué. Aucune donnée n’a été modifiée.',
    )));

    try {
      worker.postMessage({ operation, buffer }, [buffer]);
    } catch {
      finish(() => reject(new ImportProcessingError(
        'processing_failed',
        'Impossible de démarrer le traitement Excel.',
      )));
    }
  });
};

const readFileBuffer = (file: File, signal?: AbortSignal) => {
  throwIfImportAborted(signal);
  return withImportTimeout(
    file.arrayBuffer(),
    IMPORT_PROCESSING_TIMEOUTS.fileRead,
    'La lecture du fichier a dépassé 15 secondes.',
  );
};

export const readSpreadsheetAsCsv = async (file: File, signal?: AbortSignal) => {
  const buffer = await readFileBuffer(file, signal);
  return runSpreadsheetImportWorker<string>('to-csv', buffer, { signal });
};

export const buildMarginCatalogInWorker = async (file: File, signal?: AbortSignal) => {
  const buffer = await readFileBuffer(file, signal);
  return runSpreadsheetImportWorker<MarginCatalogImportItem[]>('margin-catalog', buffer, { signal });
};
