// =============================================================
// utils/supabase.ts
// Client Supabase + helpers de lecture/écriture de l'état app
//
// Table Supabase attendue :
//   app_state (key text PRIMARY KEY, value jsonb, updated_at timestamptz)
//
// Stratégie de sync : LAST WRITE WINS basé sur updated_at
// → Aucun device n'est prioritaire. C'est la dernière modification
//   horodatée qui gagne, peu importe d'où elle vient.
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

export const isSupabaseConfigured = (): boolean =>
  Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const headers = (): HeadersInit => ({
  'Content-Type':  'application/json',
  'apikey':        SUPABASE_ANON_KEY ?? '',
  'Authorization': `Bearer ${SUPABASE_ANON_KEY ?? ''}`,
  'Prefer':        'return=minimal',
});

// ── Chargement de TOUTES les clés au démarrage ───────────────
export const loadAllFromSupabase = async (): Promise<Array<SupabaseRow> | null> => {
  if (!isSupabaseConfigured()) return null;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${TABLE}?select=key,value,updated_at`,
      { headers: headers() }
    );
    if (!res.ok) return null;
    return await res.json() as SupabaseRow[];
  } catch {
    return null;
  }
};

// ── Chargement léger (meta) : key + updated_at ──────────────
export const loadMetaFromSupabase = async (): Promise<Array<Pick<SupabaseRow, 'key' | 'updated_at'>> | null> => {
  if (!isSupabaseConfigured()) return null;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${TABLE}?select=key,updated_at`,
      { headers: headers() }
    );
    if (!res.ok) return null;
    return await res.json() as Array<Pick<SupabaseRow, 'key' | 'updated_at'>>;
  } catch {
    return null;
  }
};

// ── Chargement par clés : key + value + updated_at ──────────
export const loadKeysFromSupabase = async (keys: string[]): Promise<SupabaseRow[] | null> => {
  if (!isSupabaseConfigured()) return null;
  if (!keys || keys.length === 0) return [];
  try {
    const encoded = keys
      .map(k => `"${String(k).replace(/"/g, '\\"')}"`)
      .join(',');
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${TABLE}?select=key,value,updated_at&key=in.(${encoded})`,
      { headers: headers() }
    );
    if (!res.ok) return null;
    return await res.json() as SupabaseRow[];
  } catch {
    return null;
  }
};

// ── Sauvegarde d'une clé (upsert) ────────────────────────────
// Retourne le updated_at réel enregistré en base (ISO string) ou null si erreur.
export const saveToSupabase = async (
  key:   string,
  value: unknown,
  ts:    string  // timestamp ISO généré par l'appelant (utilisé comme fallback)
): Promise<string | null> => {
  if (!isSupabaseConfigured()) return null;
  try {
    // return=representation → on récupère la ligne telle qu'elle est en base
    // après le trigger, ce qui nous donne le vrai updated_at serveur.
    // C'est essentiel pour que le LWW compare des timestamps cohérents
    // (serveur vs serveur, pas client vs serveur).
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${TABLE}?on_conflict=key`,
      {
        method:  'POST',
        headers: { ...headers(), 'Prefer': 'resolution=merge-duplicates,return=representation' },
        body:    JSON.stringify([{ key, value, updated_at: ts }]),
      }
    );
    if (!res.ok) {
      let body = '';
      try { body = await res.text(); } catch {}
      console.error('[Supabase save error]', key, res.status, body);
      return null;
    }
    // Extraire le updated_at réel tel que Postgres l'a enregistré (après trigger)
    try {
      const rows = await res.json() as Array<{ updated_at: string }>;
      if (rows?.[0]?.updated_at) return rows[0].updated_at;
    } catch {}
    return ts; // fallback si la réponse est inattendue
  } catch (err) {
    console.error('[Supabase save exception]', key, err);
    return null;
  }
};

// ── Debounce avec last-write-wins ────────────────────────────
//
// Principe :
// - Chaque frappe génère un timestamp local (localTs).
// - Si une nouvelle frappe arrive avant le délai, on annule le timer
//   et on crée un nouveau avec le nouveau timestamp.
// - Au moment d'envoyer, on compare localTs avec ce que Supabase
//   a actuellement (via le curseur lastCloudTs fourni par l'appelant).
// - Si localTs > lastCloudTs → on envoie (notre modif est plus récente).
// - Si localTs < lastCloudTs → on n'envoie pas (quelqu'un d'autre a écrit
//   plus récemment, on doit accepter sa valeur à la prochaine tick poll).
// - onSaved(key, confirmedTs) est appelé si Supabase accepte.

const debounceTimers: Record<string, ReturnType<typeof setTimeout>> = {};

export const saveToSupabaseDebounced = (
  key:          string,
  value:        unknown,
  localTs:      string,                                 // ISO timestamp de cette frappe
  getCloudTs:   (key: string) => string | undefined,    // curseur de polling
  onSaved:      (key: string, confirmedTs: string) => void,
  ms           = 1500
): void => {
  if (!isSupabaseConfigured()) return;
  if (debounceTimers[key]) clearTimeout(debounceTimers[key]);
  debounceTimers[key] = setTimeout(async () => {
    // Vérifier last-write-wins avant d'envoyer
    const cloudTs = getCloudTs(key);
    if (cloudTs && cloudTs > localTs) {
      // Le cloud est plus récent → ne pas écraser
      // (un autre device a écrit après nous, le polling va appliquer sa valeur)
      console.log(`[LWW] Skipping save for "${key}" — cloud (${cloudTs}) > local (${localTs})`);
      return;
    }
    const confirmedTs = await saveToSupabase(key, value, localTs);
    if (confirmedTs) onSaved(key, confirmedTs);
  }, ms);
};
