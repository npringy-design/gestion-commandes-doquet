import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const NORMALIZED_SUPABASE_URL = SUPABASE_URL?.replace(/\/+$/, '');

export const isSupabaseConfigured = () => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const getAuthProxyUrl = (input: RequestInfo | URL): string | null => {
  if (!NORMALIZED_SUPABASE_URL || typeof window === 'undefined') return null;
  const rawUrl =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

  const authBase = `${NORMALIZED_SUPABASE_URL}/auth/v1`;
  if (!rawUrl.startsWith(authBase)) return null;

  const target = rawUrl.slice(authBase.length) || '/';
  return `/api/auth/supabase?target=${encodeURIComponent(target)}`;
};

const isJsonResponse = (response: Response): boolean => {
  const contentType = response.headers.get('content-type') || '';
  return contentType.includes('application/json');
};

const supabaseFetch: typeof fetch = async (input, init) => {
  const proxyUrl = getAuthProxyUrl(input);
  if (!proxyUrl) return fetch(input, init);

  try {
    const directResponse = await fetch(input, init);
    if (isJsonResponse(directResponse)) return directResponse;
    console.warn('[supabase] Réponse directe non-JSON (probable blocage réseau), repli proxy.');
  } catch (error) {
    console.warn('[supabase] Auth directe indisponible, repli proxy:', error);
  }

  try {
    const proxyResponse = await fetch(proxyUrl, init);
    if (isJsonResponse(proxyResponse)) return proxyResponse;
    console.warn('[supabase] Réponse proxy également non-JSON.');
  } catch (error) {
    console.warn('[supabase] Repli proxy indisponible:', error);
  }

  throw new Error(
    "Connexion au service d'authentification impossible pour le moment. Réessaie dans quelques instants ou contacte le support."
  );
};

// Client unique (évite les doubles initialisations en dev)
export const supabase: SupabaseClient | null =
  isSupabaseConfigured()
    ? createClient(SUPABASE_URL as string, SUPABASE_ANON_KEY as string, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
        global: {
          fetch: supabaseFetch,
        },
      })
    : null;
