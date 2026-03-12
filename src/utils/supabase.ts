import { supabase } from '../lib/supabaseClient';

interface SupabaseRow {
  site_id: string;
  key: string;
  value: unknown;
  updated_at: string;
}

export interface SiteBackupRow {
  id: string;
  site_id: string;
  snapshot: Record<string, unknown>;
  backup_type: 'auto' | 'manual';
  note: string | null;
  created_at: string;
  created_by: string | null;
}

const TABLE = 'app_state';
const BACKUPS_TABLE = 'site_backups';

export const isSupabaseConfigured = (): boolean => Boolean(supabase);

export const loadAllFromSupabase = async (siteId: string): Promise<Array<SupabaseRow> | null> => {
  if (!supabase || !siteId) return null;
  const { data, error } = await supabase
    .from(TABLE)
    .select('site_id,key,value,updated_at')
    .eq('site_id', siteId);

  if (error) {
    console.error('[Supabase loadAll error]', error.message);
    return null;
  }

  return (data ?? []) as SupabaseRow[];
};

export const loadMetaFromSupabase = async (
  siteId: string
): Promise<Array<Pick<SupabaseRow, 'key' | 'updated_at'>> | null> => {
  if (!supabase || !siteId) return null;
  const { data, error } = await supabase
    .from(TABLE)
    .select('key,updated_at')
    .eq('site_id', siteId);

  if (error) {
    console.error('[Supabase loadMeta error]', error.message);
    return null;
  }

  return (data ?? []) as Array<Pick<SupabaseRow, 'key' | 'updated_at'>>;
};

export const loadKeysFromSupabase = async (siteId: string, keys: string[]): Promise<SupabaseRow[] | null> => {
  if (!supabase || !siteId) return null;
  if (!keys || keys.length === 0) return [];

  const { data, error } = await supabase
    .from(TABLE)
    .select('site_id,key,value,updated_at')
    .eq('site_id', siteId)
    .in('key', keys);

  if (error) {
    console.error('[Supabase loadKeys error]', error.message);
    return null;
  }

  return (data ?? []) as SupabaseRow[];
};

export const saveToSupabase = async (
  siteId: string,
  key: string,
  value: unknown,
  ts: string
): Promise<string | null> => {
  if (!supabase || !siteId) return null;

  const { error } = await supabase
    .from(TABLE)
    .upsert(
      [{ site_id: siteId, key, value, updated_at: ts }],
      { onConflict: 'site_id,key' }
    );

  if (error) {
    console.error('[Supabase save error]', siteId, key, error.message);
    return null;
  }

  return ts;
};

const debounceTimers: Record<string, ReturnType<typeof setTimeout>> = {};

export const saveToSupabaseDebounced = (
  siteId: string,
  key: string,
  value: unknown,
  localTs: string,
  getCloudTs: (key: string) => string | undefined,
  onSaved: (key: string, confirmedTs: string) => void,
  ms = 1500
): void => {
  if (!supabase || !siteId) return;

  const debounceKey = `${siteId}::${key}`;
  if (debounceTimers[debounceKey]) clearTimeout(debounceTimers[debounceKey]);

  debounceTimers[debounceKey] = setTimeout(async () => {
    const cloudTs = getCloudTs(key);
    if (cloudTs && cloudTs > localTs) {
      console.log(`[LWW] Skipping save for "${siteId}/${key}" — cloud (${cloudTs}) > local (${localTs})`);
      return;
    }
    const confirmedTs = await saveToSupabase(siteId, key, value, localTs);
    if (confirmedTs) onSaved(key, confirmedTs);
  }, ms);
};

export const createSiteBackup = async (
  siteId: string,
  snapshot: Record<string, unknown>,
  backupType: 'auto' | 'manual' = 'manual',
  note?: string
): Promise<boolean> => {
  if (!supabase || !siteId) return false;

  const { error } = await supabase.from(BACKUPS_TABLE).insert({
    site_id: siteId,
    snapshot,
    backup_type: backupType,
    note: note ?? null,
  });

  if (error) {
    console.error('[Supabase create backup error]', siteId, error.message);
    return false;
  }

  return true;
};

export const listSiteBackups = async (siteId: string): Promise<SiteBackupRow[] | null> => {
  if (!supabase || !siteId) return null;

  const { data, error } = await supabase
    .from(BACKUPS_TABLE)
.select('id,site_id,snapshot,backup_type,note,created_at,created_by')
    .eq('site_id', siteId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('[Supabase list backups error]', siteId, error.message);
    return null;
  }

  return (data ?? []) as SiteBackupRow[];
};

export const restoreSiteBackup = async (
  siteId: string,
  snapshot: Record<string, unknown>,
  ts = new Date().toISOString()
): Promise<boolean> => {
  if (!supabase || !siteId) return false;

  const rows = Object.entries(snapshot).map(([key, value]) => ({
    site_id: siteId,
    key,
    value,
    updated_at: ts,
  }));

  if (rows.length === 0) return true;

  const { error } = await supabase
    .from(TABLE)
    .upsert(rows, { onConflict: 'site_id,key' });

  if (error) {
    console.error('[Supabase restore backup error]', siteId, error.message);
    return false;
  }

  return true;
};
