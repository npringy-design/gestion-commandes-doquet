export const TAKE_RATE_CLOUD_SAVE_DEBOUNCE_MS = 2500;

export type TakeRateCloudSaveScheduler = (
  key: string,
  value: unknown,
  localTs: string,
  getCloudTs: (key: string) => string | undefined,
  onSaved: (key: string, confirmedTs: string) => void,
  debounceMs: number,
) => void;

// Conserve au même endroit le délai historique et le curseur LWW utilisé par
// toutes les sauvegardes du Taux de prise.
export const scheduleTakeRateCloudSave = (
  schedule: TakeRateCloudSaveScheduler,
  cloudUpdatedAtByKey: Record<string, string>,
  key: string,
  value: unknown,
  localTs: string,
): void => {
  schedule(
    key,
    value,
    localTs,
    currentKey => cloudUpdatedAtByKey[currentKey],
    (confirmedKey, confirmedTs) => {
      cloudUpdatedAtByKey[confirmedKey] = confirmedTs;
    },
    TAKE_RATE_CLOUD_SAVE_DEBOUNCE_MS,
  );
};

export const registerTakeRateCloudTimestamps = (
  target: Record<string, string>,
  timestamps: Record<string, string>,
): void => {
  Object.assign(target, timestamps);
};
