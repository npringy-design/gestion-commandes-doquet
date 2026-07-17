import { useCallback, useRef } from 'react';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import { saveToSupabaseDebounced } from '../utils/supabase';
import {
  TAKE_RATE_BASE_ROWS_CLOUD_KEY,
  TAKE_RATE_FROZEN_CLOUD_KEY,
  TAKE_RATE_MARGIN_CATALOG_CLOUD_KEY,
  TAKE_RATE_MARGIN_FILE_NAME_CLOUD_KEY,
} from '../utils/takeRateCloudModel';
import {
  registerTakeRateCloudTimestamps,
  scheduleTakeRateCloudSave,
} from '../utils/takeRateCloudPersistenceModel';

export const useTakeRateCloudPersistence = () => {
  const cloudUpdatedAtByKey = useRef<Record<string, string>>({});

  const registerCloudTimestamps = useCallback((timestamps: Record<string, string>) => {
    registerTakeRateCloudTimestamps(cloudUpdatedAtByKey.current, timestamps);
  }, []);

  const persistValue = useCallback((key: string, value: unknown, localTs: string) => {
    if (!isSupabaseConfigured()) return;
    scheduleTakeRateCloudSave(
      saveToSupabaseDebounced,
      cloudUpdatedAtByKey.current,
      key,
      value,
      localTs,
    );
  }, []);

  const persistBaseRows = useCallback((rows: unknown[]) => {
    persistValue(TAKE_RATE_BASE_ROWS_CLOUD_KEY, rows, new Date().toISOString());
  }, [persistValue]);

  const persistMarginBase = useCallback((catalog: unknown[], fileName: string) => {
    const localTs = new Date().toISOString();
    persistValue(TAKE_RATE_MARGIN_CATALOG_CLOUD_KEY, catalog, localTs);
    persistValue(TAKE_RATE_MARGIN_FILE_NAME_CLOUD_KEY, fileName, localTs);
  }, [persistValue]);

  const persistFrozenMonths = useCallback((frozenMonths: Record<string, unknown>) => {
    persistValue(TAKE_RATE_FROZEN_CLOUD_KEY, frozenMonths, new Date().toISOString());
  }, [persistValue]);

  return {
    persistBaseRows,
    persistMarginBase,
    persistFrozenMonths,
    registerCloudTimestamps,
  };
};
