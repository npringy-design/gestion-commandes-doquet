import type { ReliableSaveFailureReason } from '../utils/reliableSaveQueue';

export type SyncStatus = 'idle' | 'saving' | 'saved' | 'pending' | 'error';

export const SAVED_STATUS_VISIBLE_MS = 1800;
export const SAVE_PROBLEM_THROTTLE_MS = 5000;

export const getConfirmedSyncStatus = (
  pendingSaveCount: number,
  activeSaveCount: number,
): SyncStatus => {
  if (pendingSaveCount > 0) return 'pending';
  if (activeSaveCount > 0) return 'saving';
  return 'saved';
};

export const getPendingSaveFeedback = (persistedLocally: boolean): {
  status: SyncStatus;
  message: string;
} => persistedLocally
  ? {
      status: 'pending',
      message: 'Sauvegarde non confirmée. La modification est conservée sur cet appareil et sera renvoyée automatiquement.',
    }
  : {
      status: 'error',
      message: 'Sauvegarde impossible et stockage local indisponible. Ne fermez pas la page avant le retour de la connexion.',
    };

export const getSaveErrorFeedback = (
  reason: ReliableSaveFailureReason,
  pendingSaveCount: number,
): { status: SyncStatus; message: string } => {
  const status: SyncStatus = pendingSaveCount > 0 ? 'pending' : 'error';

  if (reason === 'conflict') {
    return {
      status,
      message: 'Une modification plus récente existe déjà. Les données du serveur ont été conservées.',
    };
  }
  if (reason === 'storage') {
    return {
      status,
      message: 'La modification ne peut pas être sécurisée localement. Gardez cette page ouverte.',
    };
  }
  return {
    status,
    message: 'Erreur de sauvegarde. Une nouvelle tentative sera effectuée automatiquement.',
  };
};
