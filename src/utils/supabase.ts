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
import { supabase } from '../lib/supabaseClient';

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

const headers = async (): Promise<HeadersInit> => {
  const { data } = supabase
    ? await supabase.auth.getSession()
    : { data: { session: null } };
  const bearer = data.session?.access_token ?? SUPABASE_ANON_KEY ?? '';

  return {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY ?? '',
    'Authorization': `Bearer ${bearer}`,
    'Prefer': 'return=minimal',
  };
};

// ── Chargement de TOUTES les clés au démarrage ───────────────
export const loadAllFromSupabase = async (): Promise<Array<SupabaseRow> | null> => {
  if (!isSupabaseConfigured()) return null;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${TABLE}?select=site_id,key,value,updated_at&site_id=eq.${SITE_ID_QUERY}`,
      { headers: await headers() }
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
      { headers: await headers() }
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
      { headers: await headers() }
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
        headers: { ...(await headers()), 'Prefer': 'resolution=merge-duplicates,return=minimal' },
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
        headers: { ...(await headers()), 'Prefer': 'return=representation' },
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
        headers: { ...(await headers()), 'Prefer': 'return=minimal' },
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

// ── Debounce générique par clé, avec flush immédiat ──────────
//
// Factory réutilisée pour tous les debounces "par clé" de ce module
// (blob app_state par clé, ligne order_line_states par product_id).
// - Chaque `schedule` annule le timer précédent pour cette clé et en
//   reprogramme un nouveau (dernier arrivé gagne sur le délai).
// - `merge` contrôle comment un payload en attente est combiné avec
//   le nouveau (par défaut : remplacement complet, adapté à un blob
//   qui contient toujours l'état complet).
// - `flushAll` vide tous les timers et déclenche immédiatement les
//   commits en attente (utilisé au passage en arrière-plan/fermeture,
//   car mobile peut suspendre les timers avant la fin du debounce).
type Debouncer<TPayload> = {
  schedule: (key: string, payload: TPayload, ms: number) => void;
  flushAll: () => void;
};

const createDebouncer = <TPayload>(
  commit: (key: string, payload: TPayload) => Promise<void>,
  merge: (prev: TPayload, next: TPayload) => TPayload = (_prev, next) => next,
): Debouncer<TPayload> => {
  const timers: Record<string, ReturnType<typeof setTimeout>> = {};
  const pending: Record<string, TPayload> = {};

  const commitKey = async (key: string): Promise<void> => {
    if (!(key in pending)) return;
    const payload = pending[key];
    delete pending[key];
    await commit(key, payload);
  };

  const schedule = (key: string, payload: TPayload, ms: number): void => {
    if (timers[key]) clearTimeout(timers[key]);
    pending[key] = key in pending ? merge(pending[key], payload) : payload;
    timers[key] = setTimeout(() => {
      delete timers[key];
      void commitKey(key);
    }, ms);
  };

  const flushAll = (): void => {
    Object.keys(timers).forEach(key => {
      clearTimeout(timers[key]);
      delete timers[key];
    });
    Object.keys(pending).forEach(key => {
      void commitKey(key);
    });
  };

  return { schedule, flushAll };
};

// ── Debounce app_state avec last-write-wins ──────────────────
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

type PendingSave = {
  value:      unknown;
  localTs:    string;
  getCloudTs: (key: string) => string | undefined;
  onSaved:    (key: string, confirmedTs: string) => void;
};

const appStateDebouncer = createDebouncer<PendingSave>(async (key, pending) => {
  const { value, localTs, getCloudTs, onSaved } = pending;

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
});

export const saveToSupabaseDebounced = (
  key:          string,
  value:        unknown,
  localTs:      string,                                 // ISO timestamp de cette frappe
  getCloudTs:   (key: string) => string | undefined,    // curseur de polling
  onSaved:      (key: string, confirmedTs: string) => void,
  ms           = 1500
): void => {
  if (!isSupabaseConfigured()) return;
  appStateDebouncer.schedule(key, { value, localTs, getCloudTs, onSaved }, ms);
};

// ── order_line_states : une ligne par produit ────────────────
// Table dédiée aux champs opérationnels de commande (stock, livraison
// à venir, stock cible, conditionnement, marge), en granularité par
// produit plutôt qu'en blob complet, pour éviter qu'une session restée
// ouverte n'écrase les modifications faites depuis un autre appareil.

const ORDER_LINE_TABLE      = 'order_line_states';
const ORDER_LINE_CONFLICT   = 'site_id,product_id';

export interface OrderLineStateFields {
  stock?:             number | null;
  upcoming_delivery?: number | null;
  target_stock?:      number | null;
  packaging?:         number | null;
  margin?:            number | null;
}

export interface OrderLineStateRow extends OrderLineStateFields {
  product_id: string;
  updated_at: string;
}

// ── Chargement de toutes les lignes order_line_states du site courant ─
export const loadOrderLineStates = async (): Promise<OrderLineStateRow[] | null> => {
  if (!isSupabaseConfigured()) return null;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${ORDER_LINE_TABLE}?select=product_id,stock,upcoming_delivery,target_stock,packaging,margin,updated_at&site_id=eq.${SITE_ID_QUERY}`,
      { headers: await headers() }
    );
    if (!res.ok) {
      let body = '';
      try { body = await res.text(); } catch {}
      console.error('[Supabase loadOrderLineStates error]', { siteId: CURRENT_SITE_ID, status: res.status, body });
      return null;
    }
    return await res.json() as OrderLineStateRow[];
  } catch (err) {
    console.error('[Supabase loadOrderLineStates exception]', { siteId: CURRENT_SITE_ID, err });
    return null;
  }
};

// ── Upsert immédiat d'une ligne (site_id, product_id) ────────
export const upsertOrderLineState = async (
  productId: string,
  fields:    OrderLineStateFields,
  ts:        string,
): Promise<string | null> => {
  if (!isSupabaseConfigured()) return null;
  const payload = { site_id: CURRENT_SITE_ID, product_id: productId, ...fields, updated_at: ts };
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${ORDER_LINE_TABLE}?on_conflict=${ORDER_LINE_CONFLICT}`,
      {
        method:  'POST',
        headers: { ...(await headers()), 'Prefer': 'resolution=merge-duplicates,return=minimal' },
        body:    JSON.stringify([payload]),
      }
    );
    if (res.ok) return ts;

    let body = '';
    try { body = await res.text(); } catch {}
    console.error('[Supabase order_line_states upsert error]', {
      siteId: CURRENT_SITE_ID, productId, status: res.status, body,
    });
    return null;
  } catch (err) {
    console.error('[Supabase order_line_states upsert exception]', { siteId: CURRENT_SITE_ID, productId, err });
    return null;
  }
};

// ── Suppression d'une ligne (produit supprimé) ───────────────
export const deleteOrderLineState = async (productId: string): Promise<boolean> => {
  if (!isSupabaseConfigured()) return false;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${ORDER_LINE_TABLE}?site_id=eq.${SITE_ID_QUERY}&product_id=eq.${encodeURIComponent(productId)}`,
      { method: 'DELETE', headers: { ...(await headers()), 'Prefer': 'return=minimal' } }
    );
    if (res.ok) return true;

    let body = '';
    try { body = await res.text(); } catch {}
    console.error('[Supabase order_line_states delete error]', {
      siteId: CURRENT_SITE_ID, productId, status: res.status, body,
    });
    return false;
  } catch (err) {
    console.error('[Supabase order_line_states delete exception]', { siteId: CURRENT_SITE_ID, productId, err });
    return false;
  }
};

// ── Debounce par produit (Map keyed par product_id), 400ms ───
// Contrairement à l'ancien blob `products`/`orderStates` sauvegardé en
// entier, chaque produit a son propre timer : deux produits édités
// simultanément se sauvegardent indépendamment, sans collision.
type PendingOrderLineSave = {
  fields:   OrderLineStateFields;
  ts:       string;
  onSaved?: (productId: string, confirmedTs: string) => void;
};

const orderLineDebouncer = createDebouncer<PendingOrderLineSave>(
  async (productId, pending) => {
    const confirmedTs = await upsertOrderLineState(productId, pending.fields, pending.ts);
    if (confirmedTs) pending.onSaved?.(productId, confirmedTs);
  },
  (prev, next) => ({
    fields:  { ...prev.fields, ...next.fields },
    ts:      next.ts,
    onSaved: next.onSaved ?? prev.onSaved,
  }),
);

export const upsertOrderLineStateDebounced = (
  productId: string,
  fields:    OrderLineStateFields,
  ts:        string,
  onSaved?:  (productId: string, confirmedTs: string) => void,
  ms        = 400,
): void => {
  if (!isSupabaseConfigured()) return;
  orderLineDebouncer.schedule(productId, { fields, ts, onSaved }, ms);
};

// ── Flush immédiat de toutes les sauvegardes en attente ──────
// Appelé quand l'onglet passe en arrière-plan ou se ferme
// (visibilitychange / pagehide) : sur mobile, le navigateur peut
// suspendre les timers ou décharger la page avant la fin du debounce,
// ce qui perdait silencieusement la dernière saisie.
export const flushAllPendingSaves = (): void => {
  appStateDebouncer.flushAll();
  orderLineDebouncer.flushAll();
};
