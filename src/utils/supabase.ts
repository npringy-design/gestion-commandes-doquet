// =============================================================
// utils/supabase.ts
// Mode secours mono-site Thillois
// La synchronisation cloud de l'état métier est volontairement désactivée
// pour éviter tout mélange avec les anciens schémas app_state / multi-site.
// =============================================================

interface SupabaseRow {
  key: string;
  value: unknown;
  updated_at: string;
}

export const isSupabaseConfigured = (): boolean => false;

export const loadAllFromSupabase = async (): Promise<Array<SupabaseRow> | null> => null;

export const loadMetaFromSupabase = async (): Promise<Array<Pick<SupabaseRow, 'key' | 'updated_at'>> | null> => null;

export const loadKeysFromSupabase = async (_keys: string[]): Promise<SupabaseRow[] | null> => null;

export const saveToSupabase = async (
  _key: string,
  _value: unknown,
  _ts: string
): Promise<string | null> => null;

export const saveToSupabaseDebounced = (
  _key: string,
  _value: unknown,
  _localTs: string,
  _getCloudTs: (key: string) => string | undefined,
  _onSaved: (key: string, confirmedTs: string) => void,
  _ms = 1500
): void => {
  // no-op : verrouillage total du mono-site Thillois
};
