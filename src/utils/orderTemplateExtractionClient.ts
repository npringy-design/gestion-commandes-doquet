import { supabase } from '../lib/supabaseClient';
import { ImportProcessingError } from './importProcessing';
import { isPageExtraction, type ColumnHint, type PageExtraction } from './orderTemplateExtraction';

const EXTRACT_ENDPOINT = '/api/order-template-extract';

export class OrderTemplateApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ImportProcessingError';
    this.status = status;
  }
}

export interface OrderTemplatePageRequest {
  pageImage: string;
  pageNumber: number;
  pageCount: number;
  nativeText: string;
  columnHint?: ColumnHint;
}

const messageForStatus = (status: number): string => {
  if (status === 401) return 'Ta session a expiré. Reconnecte-toi puis relance l’import.';
  if (status === 403) return 'Ton compte n’a pas accès à l’analyse des trames.';
  if (status === 413 || status === 400) return 'Une page est trop volumineuse ou illisible pour être analysée.';
  if (status === 429) return 'Trop d’analyses en peu de temps. Attends quelques minutes puis relance l’import.';
  if (status === 504) return 'L’analyse d’une page a pris trop de temps.';
  return 'L’analyse des pages est temporairement indisponible.';
};

// Erreurs après lesquelles analyser les pages restantes serait inutile.
export const isFatalOrderTemplateError = (error: unknown): boolean =>
  error instanceof OrderTemplateApiError && [401, 403, 429].includes(error.status);

export const requestOrderTemplatePage = async (
  request: OrderTemplatePageRequest,
  signal?: AbortSignal,
): Promise<PageExtraction> => {
  const { data, error: sessionError } = await supabase?.auth.getSession() ?? { data: { session: null }, error: null };
  const accessToken = data.session?.access_token;
  if (sessionError || !accessToken) {
    throw new OrderTemplateApiError(401, messageForStatus(401));
  }

  let response: Response;
  try {
    response = await fetch(EXTRACT_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ImportProcessingError('cancelled', 'Import annulé. Aucune donnée n’a été modifiée.');
    }
    throw new OrderTemplateApiError(0, 'Connexion impossible. Vérifie ta connexion puis relance l’import.');
  }

  if (!response.ok) throw new OrderTemplateApiError(response.status, messageForStatus(response.status));

  const payload: unknown = await response.json().catch(() => null);
  const extraction = typeof payload === 'object' && payload !== null
    ? (payload as { extraction?: unknown }).extraction
    : undefined;
  if (!isPageExtraction(extraction)) {
    throw new OrderTemplateApiError(502, messageForStatus(502));
  }
  return extraction;
};
