export const IMPORT_FILE_LIMITS = {
  text: 8 * 1024 * 1024,
  workbook: 15 * 1024 * 1024,
  pdf: 20 * 1024 * 1024,
} as const;

export type ImportFileKind = 'tabular' | 'margin-workbook' | 'order-template-pdf';
export type ImportFileFormat = 'text' | 'xlsx' | 'xls' | 'pdf';
export type ImportFileValidationCode =
  | 'empty_file'
  | 'unsupported_extension'
  | 'file_too_large'
  | 'invalid_signature';

type ImportFileLike = Pick<File, 'name' | 'size' | 'type' | 'slice' | 'arrayBuffer'>;

export class ImportFileValidationError extends Error {
  readonly code: ImportFileValidationCode;

  constructor(code: ImportFileValidationCode, message: string) {
    super(message);
    this.name = 'ImportFileValidationError';
    this.code = code;
  }
}

const extensionOf = (name: string) => {
  const normalized = name.trim().toLowerCase();
  const dotIndex = normalized.lastIndexOf('.');
  return dotIndex >= 0 ? normalized.slice(dotIndex) : '';
};

const formatForFile = (file: ImportFileLike, kind: ImportFileKind): ImportFileFormat => {
  const extension = extensionOf(file.name);

  if (kind === 'order-template-pdf' && extension === '.pdf') return 'pdf';
  if (kind === 'margin-workbook' && extension === '.xlsx') return 'xlsx';
  if (kind === 'margin-workbook' && extension === '.xls') return 'xls';
  if (kind === 'tabular' && (extension === '.csv' || extension === '.txt')) return 'text';
  if (kind === 'tabular' && extension === '.xlsx') return 'xlsx';
  if (kind === 'tabular' && extension === '.xls') return 'xls';

  const expected = kind === 'order-template-pdf'
    ? 'PDF'
    : kind === 'margin-workbook'
      ? 'XLS ou XLSX'
      : 'CSV, TXT, XLS ou XLSX';
  throw new ImportFileValidationError(
    'unsupported_extension',
    `Format de fichier non accepté. Formats attendus : ${expected}.`,
  );
};

const maxSizeForFormat = (format: ImportFileFormat) => {
  if (format === 'text') return IMPORT_FILE_LIMITS.text;
  if (format === 'pdf') return IMPORT_FILE_LIMITS.pdf;
  return IMPORT_FILE_LIMITS.workbook;
};

const maxSizeLabel = (bytes: number) => `${Math.round(bytes / (1024 * 1024))} Mo`;

const startsWithBytes = (bytes: Uint8Array, signature: number[]) =>
  signature.every((value, index) => bytes[index] === value);

const containsAscii = (bytes: Uint8Array, expected: string) => {
  const signature = Array.from(expected, (character) => character.charCodeAt(0));
  if (signature.length === 0 || bytes.length < signature.length) return false;

  for (let offset = 0; offset <= bytes.length - signature.length; offset += 1) {
    let matches = true;
    for (let index = 0; index < signature.length; index += 1) {
      if (bytes[offset + index] !== signature[index]) {
        matches = false;
        break;
      }
    }
    if (matches) return true;
  }

  return false;
};

const isPdf = async (file: ImportFileLike) => {
  const header = new Uint8Array(await file.slice(0, Math.min(file.size, 1024)).arrayBuffer());
  return containsAscii(header, '%PDF-');
};

const isLegacyWorkbook = async (file: ImportFileLike) => {
  const header = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  return startsWithBytes(header, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
};

const isModernWorkbook = async (file: ImportFileLike) => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const hasZipSignature =
    startsWithBytes(bytes, [0x50, 0x4b, 0x03, 0x04]) ||
    startsWithBytes(bytes, [0x50, 0x4b, 0x05, 0x06]) ||
    startsWithBytes(bytes, [0x50, 0x4b, 0x07, 0x08]);

  return hasZipSignature && containsAscii(bytes, '[Content_Types].xml') && containsAscii(bytes, 'xl/');
};

const isTextFile = async (file: ImportFileLike) => {
  const sample = new Uint8Array(
    await file.slice(0, Math.min(file.size, 64 * 1024)).arrayBuffer(),
  );
  if (sample.length === 0 || sample.includes(0)) return false;

  let forbiddenControls = 0;
  sample.forEach((value) => {
    const allowedWhitespace = value === 9 || value === 10 || value === 13;
    if (value < 32 && !allowedWhitespace) forbiddenControls += 1;
  });

  return forbiddenControls / sample.length <= 0.01;
};

export const validateImportFile = async (
  file: ImportFileLike,
  kind: ImportFileKind,
): Promise<{ format: ImportFileFormat; maxSizeBytes: number }> => {
  if (!file || file.size <= 0) {
    throw new ImportFileValidationError('empty_file', 'Le fichier est vide.');
  }

  const format = formatForFile(file, kind);
  const maxSizeBytes = maxSizeForFormat(format);
  if (file.size > maxSizeBytes) {
    throw new ImportFileValidationError(
      'file_too_large',
      `Fichier trop volumineux. Taille maximale : ${maxSizeLabel(maxSizeBytes)}.`,
    );
  }

  const signatureIsValid = format === 'pdf'
    ? await isPdf(file)
    : format === 'xls'
      ? await isLegacyWorkbook(file)
      : format === 'xlsx'
        ? await isModernWorkbook(file)
        : await isTextFile(file);

  if (!signatureIsValid) {
    throw new ImportFileValidationError(
      'invalid_signature',
      'Le contenu du fichier ne correspond pas à son format ou le fichier est corrompu.',
    );
  }

  return { format, maxSizeBytes };
};
