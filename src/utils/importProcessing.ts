export const IMPORT_PROCESSING_TIMEOUTS = {
  fileRead: 15_000,
  spreadsheet: 30_000,
  pdfLoad: 20_000,
  pdfProcessing: 120_000,
} as const;

export type ImportProcessingErrorCode = 'timeout' | 'cancelled' | 'processing_failed';

export class ImportProcessingError extends Error {
  readonly code: ImportProcessingErrorCode;

  constructor(code: ImportProcessingErrorCode, message: string) {
    super(message);
    this.name = 'ImportProcessingError';
    this.code = code;
  }
}

export const createImportCancelledError = () =>
  new ImportProcessingError('cancelled', 'Import annulé. Aucune donnée n’a été modifiée.');

export const throwIfImportAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) throw createImportCancelledError();
};

export const withImportTimeout = <T>(
  task: Promise<T>,
  timeoutMs: number,
  message: string,
  onTimeout?: () => void | Promise<void>,
): Promise<T> => new Promise((resolve, reject) => {
  let settled = false;

  const timer = setTimeout(() => {
    if (settled) return;
    settled = true;
    try {
      void onTimeout?.();
    } catch {
      // Le nettoyage ne doit pas masquer l'erreur de délai dépassé.
    }
    reject(new ImportProcessingError('timeout', message));
  }, timeoutMs);

  task.then(
    (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    },
    (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    },
  );
});

const PUBLIC_IMPORT_ERROR_NAMES = new Set([
  'ImportFileValidationError',
  'ImportProcessingError',
]);

export const toSafeImportErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && PUBLIC_IMPORT_ERROR_NAMES.has(error.name)
    ? error.message
    : fallback;
