import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.warn('[api] Variables manquantes: VITE_SUPABASE_URL/SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY');
}

export const supabaseAdmin = createClient(supabaseUrl ?? '', serviceRoleKey ?? '', {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export const assertServerEnv = () => {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Configuration serveur Supabase incomplète. Vérifier SUPABASE_URL/VITE_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY.');
  }
};
