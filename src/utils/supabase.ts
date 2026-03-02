// =============================================================
// utils/supabase.ts
// Client Supabase + helpers de lecture/écriture de l'état app
//
// Table Supabase attendue :
//   app_state (key text PRIMARY KEY, value jsonb, updated_at timestamptz)
//
// Chaque clé localStorage devient une ligne dans cette table.
// =============================================================

// ── Types ────────────────────────────────────────────────────
interface SupabaseRow {
  key:        string;
  value:      unknown;
  updated_at: string;
}

// ── Config (variables d'env Vite) ────────────────────────────
const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL      as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const TABLE             = 'app_state';

// Vérifie que les variables sont présentes
export const isSupabaseConfigured = (): boolean =>
  Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// Headers communs
const headers = (): HeadersInit => ({
  'Content-Type':  'application/json',
  'apikey':        SUPABASE_ANON_KEY ?? '',
  'Authorization': `Bearer ${SUPABASE_ANON_KEY ?? ''}`,
  'Prefer':        'return=minimal',
});

// ── Chargement de TOUTES les clés au démarrage ───────────────
export const loadAllFromSupabase = async (): Promise<Record<string, unknown> | null> => {
  if (!isSupabaseConfigured()) return null;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${TABLE}?select=key,value`,
      { headers: headers() }
    );
    if (!res.ok) return null;
    const rows: SupabaseRow[] = await res.json();
    const result: Record<string, unknown> = {};
    rows.forEach(r => { result[r.key] = r.value; });
    return result;
  } catch {
    return null;
  }
};

// ── Sauvegarde d'une clé (upsert) ────────────────────────────
export const saveToSupabase = async (key: string, value: unknown): Promise<boolean> => {
  if (!isSupabaseConfigured()) return;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${TABLE}?on_conflict=key`,
      {
        method:  'POST',
        headers: { ...headers(), 'Prefer': 'resolution=merge-duplicates,return=minimal' },
        body:    JSON.stringify([{ key, value, updated_at: new Date().toISOString() }]),
      }
    );

    if (!res.ok) {
      let body = '';
      try { body = await res.text(); } catch {}
      console.error('[Supabase save error]', key, res.status, body);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[Supabase save exception]', key, err);
    return false;
  }
};

// ── Debounce pour éviter de spammer l'API à chaque frappe ────
const debounceTimers: Record<string, ReturnType<typeof setTimeout>> = {};

export const saveToSupabaseDebounced = (
  key:   string,
  value: unknown,
  ms    = 1500   // délai en ms (1.5s par défaut)
): void => {
  if (!isSupabaseConfigured()) return;
  if (debounceTimers[key]) clearTimeout(debounceTimers[key]);
  debounceTimers[key] = setTimeout(() => { void saveToSupabase(key, value); }, ms);
};
