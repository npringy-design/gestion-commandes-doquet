import { useCallback, type MutableRefObject } from 'react';
import {
  applyAppStateValues,
  buildAppStateSnapshot,
  type AppStateCloudRow,
  type AppStateSetterRegistry,
} from './appStateSyncModel';
import { materializeGranularRatioProducts } from './ratioProductPersistenceModel';

type UseAppStateHydrationParams = {
  setters: AppStateSetterRegistry;
  isHydratingFromCloud: MutableRefObject<boolean>;
  lastCloudUpdatedAtByKey: MutableRefObject<Record<string, string>>;
  localTsByKey: MutableRefObject<Record<string, string>>;
  lastPersistedSignatureByKey: MutableRefObject<Record<string, string>>;
};

export const useAppStateHydration = ({
  setters,
  isHydratingFromCloud,
  lastCloudUpdatedAtByKey,
  localTsByKey,
  lastPersistedSignatureByKey,
}: UseAppStateHydrationParams) => {
  const applyValues = useCallback((values: Record<string, unknown>, releaseDelayMs: number) => {
    if (Object.keys(values).length === 0) return [];

    isHydratingFromCloud.current = true;
    const appliedKeys = applyAppStateValues(values, setters);

    if (appliedKeys.length === 0) {
      isHydratingFromCloud.current = false;
      return appliedKeys;
    }

    setTimeout(() => {
      isHydratingFromCloud.current = false;
    }, releaseDelayMs);

    return appliedKeys;
  }, [isHydratingFromCloud, setters]);

  const applyCloudAppStateValue = useCallback((
    key: string,
    cloudTs: string,
    value: unknown,
  ): boolean => {
    const localTs = localTsByKey.current[key];
    if (localTs && localTs > cloudTs) return false;

    lastCloudUpdatedAtByKey.current[key] = cloudTs;
    return applyValues({ [key]: value }, 200).length > 0;
  }, [applyValues, lastCloudUpdatedAtByKey, localTsByKey]);

  const hydrateAppStateRows = useCallback((rows: AppStateCloudRow[] | null | undefined) => {
    const snapshot = buildAppStateSnapshot(rows, localTsByKey.current);
    const values = materializeGranularRatioProducts(snapshot.values);

    Object.assign(lastCloudUpdatedAtByKey.current, snapshot.updatedAtByKey);
    Object.assign(lastPersistedSignatureByKey.current, snapshot.signaturesByKey);
    applyValues(values, 600);

    return values;
  }, [applyValues, lastCloudUpdatedAtByKey, lastPersistedSignatureByKey, localTsByKey]);

  return {
    applyCloudAppStateValue,
    hydrateAppStateRows,
  };
};
