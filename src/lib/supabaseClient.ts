import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = () => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// Client unique (évite les doubles initialisations en dev)
export const supabase: SupabaseClient | null =
  isSupabaseConfigured()
    ? createClient(SUPABASE_URL as string, SUPABASE_ANON_KEY as string, {
        auth: {
          persistSession: true,
          autoRefreshToken: false,
          detectSessionInUrl: true,
        },
      })
    : null;