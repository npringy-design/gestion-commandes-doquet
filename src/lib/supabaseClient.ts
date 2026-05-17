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

const supabaseFetch: typeof fetch = (input, init) => {
  const proxyUrl = getAuthProxyUrl(input);
  if (!proxyUrl) return fetch(input, init);
  return fetch(proxyUrl, init);
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
