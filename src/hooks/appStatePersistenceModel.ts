export const CLOUD_ONLY_APP_STATE_KEYS = new Set<string>([
  'inventory',
  'prepImportsByMonth',
]);

export const APP_STATE_SAVE_DEBOUNCE_MS_BY_KEY: Record<string, number> = {
  products: 0,
  deliveryDateBySupplier: 1200,
  nextDeliveryDateBySupplier: 1200,
  covers: 2000,
  dailyCovers: 2500,
  salesHtByMonth: 2500,
  costMatterByMonth: 2500,
  validatedMonths: 2000,
  ratioValidatedMonthsBySupplier: 1000,
  ratioProductUnfrozenMonths: 1000,
  prepValidatedMonths: 2000,
  supplierConfigs: 2500,
  prepItems: 3000,
  prepForecasts: 3000,
  prepSheetStocks: 1200,
  prepBatches: 3500,
  prepImportsByMonth: 5000,
  inventory: 8000,
  orderTemplateRows: 1500,
  orderTemplatesBySupplier: 800,
};

export type AppStatePersistenceDecision = 'skip' | 'protect-empty' | 'remember' | 'save';

type GetAppStatePersistenceDecisionParams = {
  key: string;
  signature: string;
  lastPersistedSignature?: string;
  initialCloudLoadSucceeded: boolean;
  isHydratingFromCloud: boolean;
  supabaseLoaded: boolean;
  supabaseConfigured: boolean;
};

// Cette décision centralise les garde-fous qui empêchent une hydratation ou
// une réponse cloud indisponible de provoquer une sauvegarde destructive.
export const getAppStatePersistenceDecision = ({
  key,
  signature,
  lastPersistedSignature,
  initialCloudLoadSucceeded,
  isHydratingFromCloud,
  supabaseLoaded,
  supabaseConfigured,
}: GetAppStatePersistenceDecisionParams): AppStatePersistenceDecision => {
  if (lastPersistedSignature === signature) return 'skip';
  if (CLOUD_ONLY_APP_STATE_KEYS.has(key) && !initialCloudLoadSucceeded && signature === '{}') {
    return 'protect-empty';
  }
  if (isHydratingFromCloud || !supabaseLoaded || !supabaseConfigured) return 'remember';
  return 'save';
};

export const getAppStateSaveDebounceMs = (key: string, overrideMs?: number): number =>
  overrideMs ?? APP_STATE_SAVE_DEBOUNCE_MS_BY_KEY[key] ?? 1500;
