import { useCallback, type MutableRefObject } from 'react';
import {
  applyAppStateValues,
  buildAppStateSnapshot,
  type AppStateCloudRow,
  type AppStateSetterRegistry,
} from './appStateSyncModel';
import {
  RATIO_PRODUCT_ORDER_KEY,
  reconstructGranularRatioProducts,
  runRatioOrderRepair,
} from './ratioProductPersistenceModel';

type UseAppStateHydrationParams = {
  setters: AppStateSetterRegistry;
  isHydratingFromCloud: MutableRefObject<boolean>;
  lastCloudUpdatedAtByKey: MutableRefObject<Record<string, string>>;
  localTsByKey: MutableRefObject<Record<string, string>>;
  lastPersistedSignatureByKey: MutableRefObject<Record<string, string>>;
  // Renseignée par la persistance : réécrit la liste d'ordre des produits ratio
  // et retourne false tant que l'écriture n'est pas possible.
  repairRatioProductOrderRef: MutableRefObject<((order: string[]) => boolean) | null>;
};

export const useAppStateHydration = ({
  setters,
  isHydratingFromCloud,
  lastCloudUpdatedAtByKey,
  localTsByKey,
  lastPersistedSignatureByKey,
  repairRatioProductOrderRef,
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
    const { products, orphanIds } = reconstructGranularRatioProducts(snapshot.values);
    const values = products ? { ...snapshot.values, products } : snapshot.values;

    Object.assign(lastCloudUpdatedAtByKey.current, snapshot.updatedAtByKey);
    Object.assign(lastPersistedSignatureByKey.current, snapshot.signaturesByKey);
    applyValues(values, 600);

    if (products && orphanIds.length > 0) {
      // L'ordre reconstitué est réécrit pour que la prochaine lecture ne retombe
      // plus sur le même repositionnement des produits orphelins.
      const order = products.map(product => product.id);
      console.info(
        `[Ratio] ${orphanIds.length} produit(s) orphelin(s) recollé(s), réécriture de ${RATIO_PRODUCT_ORDER_KEY}.`,
        orphanIds,
      );
      runRatioOrderRepair(() => repairRatioProductOrderRef.current?.(order) ?? false);
    }

    return values;
  }, [applyValues, lastCloudUpdatedAtByKey, lastPersistedSignatureByKey, localTsByKey, repairRatioProductOrderRef]);

  return {
    applyCloudAppStateValue,
    hydrateAppStateRows,
  };
};
