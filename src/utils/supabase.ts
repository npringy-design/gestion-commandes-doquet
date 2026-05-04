// =============================================================
// utils/supabase.ts
// Client Supabase + helpers de lecture/écriture de l'état app
//
// Table Supabase attendue :
//   app_state (site_id text, key text, value jsonb, updated_at timestamptz)
//   contrainte unique ou clé primaire : (site_id, key)
//
// Stratégie de sync : LAST WRITE WINS basé sur updated_at
// → Aucun device n'est prioritaire. C'est la dernière modification
//   horodatée qui gagne, peu importe d'où elle vient.
// =============================================================

// ── Types ────────────────────────────────────────────────────
import { CURRENT_SITE_ID } from '../constants';

interface SupabaseRow {
  site_id:    string;
  key:        string;
  value:      unknown;
  updated_at: string;
}

// ── Config (variables d'env Vite) ────────────────────────────
const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL      as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const TABLE             = 'app_state';
const SITE_ID_QUERY     = encodeURIComponent(CURRENT_SITE_ID);
const SITE_KEY_CONFLICT = 'site_id,key';

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
      `${SUPABASE_URL}/rest/v1/${TABLE}?select=site_id,key,value,updated_at&site_id=eq.${SITE_ID_QUERY}`,
      { headers: headers() }
    );
    if (!res.ok) {
      let body = '';
      try { body = await res.text(); } catch {}
      console.error('[Supabase loadAll error]', { siteId: CURRENT_SITE_ID, status: res.status, body });
      return null;
    }
    return await res.json() as SupabaseRow[];
  } catch (err) {
    console.error('[Supabase loadAll exception]', { siteId: CURRENT_SITE_ID, err });
    return null;
  }
};

// ── Chargement léger (meta) : key + updated_at ──────────────
export const loadMetaFromSupabase = async (): Promise<Array<Pick<SupabaseRow, 'key' | 'updated_at'>> | null> => {
  if (!isSupabaseConfigured()) return null;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${TABLE}?select=key,updated_at&site_id=eq.${SITE_ID_QUERY}`,
      { headers: headers() }
    );
    if (!res.ok) {
      let body = '';
      try { body = await res.text(); } catch {}
      console.error('[Supabase loadMeta error]', { siteId: CURRENT_SITE_ID, status: res.status, body });
      return null;
    }
    return await res.json() as Array<Pick<SupabaseRow, 'key' | 'updated_at'>>;
  } catch (err) {
    console.error('[Supabase loadMeta exception]', { siteId: CURRENT_SITE_ID, err });
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
      `${SUPABASE_URL}/rest/v1/${TABLE}?select=site_id,key,value,updated_at&site_id=eq.${SITE_ID_QUERY}&key=in.(${encoded})`,
      { headers: headers() }
    );
    if (!res.ok) {
      let body = '';
      try { body = await res.text(); } catch {}
      console.error('[Supabase loadKeys error]', { siteId: CURRENT_SITE_ID, keys, status: res.status, body });
      return null;
    }
    return await res.json() as SupabaseRow[];
  } catch (err) {
    console.error('[Supabase loadKeys exception]', { siteId: CURRENT_SITE_ID, keys, err });
    return null;
  }
};

// ── Sauvegarde d'une clé (upsert) ────────────────────────────
// Retourne le updated_at réel enregistré en base (ISO string) ou null si erreur.
export const saveToSupabase = async (
  key:   string,
  value: unknown,
  ts:    string  // timestamp ISO généré par l'appelant au moment de la frappe
): Promise<string | null> => {
  if (!isSupabaseConfigured()) return null;
  const payload = { site_id: CURRENT_SITE_ID, key, value, updated_at: ts };
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${TABLE}?on_conflict=${SITE_KEY_CONFLICT}`,
      {
        method:  'POST',
        headers: { ...headers(), 'Prefer': 'resolution=merge-duplicates,return=minimal' },
        body:    JSON.stringify([payload]),
      }
    );
    if (res.ok) return ts; // Supabase a accepté notre timestamp

    {
      let body = '';
      try { body = await res.text(); } catch {}
      console.error('[Supabase save error]', {
        siteId: CURRENT_SITE_ID,
        key,
        status: res.status,
        body,
        payload: { site_id: CURRENT_SITE_ID, key, updated_at: ts },
      });
    }

    const updateRes = await fetch(
      `${SUPABASE_URL}/rest/v1/${TABLE}?site_id=eq.${SITE_ID_QUERY}&key=eq.${encodeURIComponent(key)}&select=key`,
      {
        method: 'PATCH',
        headers: { ...headers(), 'Prefer': 'return=representation' },
        body: JSON.stringify({ value, updated_at: ts }),
      }
    );

    if (updateRes.ok) {
      const updatedRows = await updateRes.json().catch(() => []);
      if (Array.isArray(updatedRows) && updatedRows.length > 0) return ts;
    } else {
      let body = '';
      try { body = await updateRes.text(); } catch {}
      console.error('[Supabase fallback update error]', {
        siteId: CURRENT_SITE_ID,
        key,
        status: updateRes.status,
        body,
      });
    }

    const insertRes = await fetch(
      `${SUPABASE_URL}/rest/v1/${TABLE}`,
      {
        method: 'POST',
        headers: { ...headers(), 'Prefer': 'return=minimal' },
        body: JSON.stringify([payload]),
      }
    );

    if (insertRes.ok) return ts;

    {
      let body = '';
      try { body = await insertRes.text(); } catch {}
      console.error('[Supabase fallback insert error]', {
        siteId: CURRENT_SITE_ID,
        key,
        status: insertRes.status,
        body,
        payload: { site_id: CURRENT_SITE_ID, key, updated_at: ts },
      });
    }

    return null;
  } catch (err) {
    console.error('[Supabase save exception]', { siteId: CURRENT_SITE_ID, key, err });
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
      console.error('[Supabase save skipped by LWW]', { siteId: CURRENT_SITE_ID, key, cloudTs, localTs });
      return;
    }
    const confirmedTs = await saveToSupabase(key, value, localTs);
    if (confirmedTs) onSaved(key, confirmedTs);
  }, ms);
};
