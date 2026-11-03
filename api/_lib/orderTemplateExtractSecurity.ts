import { createFixedWindowRateLimiter } from './aiAssistantSecurity.js';
import {
  isColumnHint,
  ORDER_TEMPLATE_MAX_PAGES,
  type ColumnHint,
} from '../../src/utils/orderTemplateExtraction.js';

export const ORDER_TEMPLATE_EXTRACT_MAX_BODY_BYTES = 3 * 1024 * 1024;
export const ORDER_TEMPLATE_EXTRACT_RATE_LIMIT_MAX = 40;
export const ORDER_TEMPLATE_EXTRACT_RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
export const ORDER_TEMPLATE_EXTRACT_TIMEOUT_MS = 45_000;
export const ORDER_TEMPLATE_NATIVE_TEXT_MAX_CHARS = 8000;

export const JPEG_DATA_URL_PREFIX = 'data:image/jpeg;base64,';
// Tout fichier JPEG commence par les octets FF D8 FF, soit « /9j/ » en base64.
const JPEG_BASE64_SIGNATURE = '/9j/';
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;
const COLUMN_HINT_MAX_CHARS = 200;

// Quota dédié : la lecture vision est plus coûteuse que l'assistant texte.
const orderTemplateExtractRateLimiter = createFixedWindowRateLimiter(
  ORDER_TEMPLATE_EXTRACT_RATE_LIMIT_MAX,
  ORDER_TEMPLATE_EXTRACT_RATE_LIMIT_WINDOW_MS,
);

export const consumeOrderTemplateExtractRateLimit = (userId: string, now = Date.now()) =>
  orderTemplateExtractRateLimiter.consume(userId, now);

export interface OrderTemplateExtractRequest {
  pageImage: string;
  pageNumber: number;
  pageCount: number;
  nativeText: string;
  columnHint?: ColumnHint;
}

export type ParsedOrderTemplateExtractRequest =
  | { ok: true; value: OrderTemplateExtractRequest }
  | { ok: false; error: string };

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1;

const clampHintText = (value: string) => value.slice(0, COLUMN_HINT_MAX_CHARS);

export const parseOrderTemplateExtractRequest = (body: unknown): ParsedOrderTemplateExtractRequest => {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, error: 'Requête invalide.' };
  }
  const input = body as Record<string, unknown>;

  const { pageImage } = input;
  if (typeof pageImage !== 'string' || !pageImage.startsWith(JPEG_DATA_URL_PREFIX)) {
    return { ok: false, error: 'Image de page invalide : un JPEG est attendu.' };
  }
  if (pageImage.length > ORDER_TEMPLATE_EXTRACT_MAX_BODY_BYTES) {
    return { ok: false, error: 'Image de page trop volumineuse.' };
  }
  const base64 = pageImage.slice(JPEG_DATA_URL_PREFIX.length);
  if (!base64.startsWith(JPEG_BASE64_SIGNATURE) || !BASE64_PATTERN.test(base64)) {
    return { ok: false, error: 'Image de page invalide : un JPEG est attendu.' };
  }

  const { pageNumber, pageCount } = input;
  if (
    !isPositiveInteger(pageNumber)
    || !isPositiveInteger(pageCount)
    || pageCount > ORDER_TEMPLATE_MAX_PAGES
    || pageNumber > pageCount
  ) {
    return { ok: false, error: 'Numéro de page invalide.' };
  }

  const nativeText = typeof input.nativeText === 'string'
    ? input.nativeText.slice(0, ORDER_TEMPLATE_NATIVE_TEXT_MAX_CHARS)
    : '';

  let columnHint: ColumnHint | undefined;
  if (input.columnHint !== undefined && input.columnHint !== null) {
    if (!isColumnHint(input.columnHint)) {
      return { ok: false, error: 'Intitulés de colonnes invalides.' };
    }
    columnHint = {
      code: clampHintText(input.columnHint.code),
      article: clampHintText(input.columnHint.article),
      storage_unit: clampHintText(input.columnHint.storage_unit),
      packaging_unit: clampHintText(input.columnHint.packaging_unit),
    };
  }

  return { ok: true, value: { pageImage, pageNumber, pageCount, nativeText, columnHint } };
};
