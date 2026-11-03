type IdleDeferralOptions = {
  isBusy: () => boolean;
  // S'abonne aux événements qui peuvent signaler la fin d'une saisie
  // (focusout) et retourne la fonction de désabonnement.
  subscribe: (onActivity: () => void) => () => void;
  schedule?: (callback: () => void, delayMs: number) => unknown;
  delayMs?: number;
};

// Repousse une action tant que l'utilisateur est occupé (champ en cours
// d'édition), puis l'exécute une seule fois dès qu'il ne l'est plus. Seule la
// dernière action demandée est conservée : deux rechargements cloud différés
// n'en font donc qu'un.
export const createIdleDeferral = ({
  isBusy,
  subscribe,
  schedule = (callback, delayMs) => setTimeout(callback, delayMs),
  delayMs = 150,
}: IdleDeferralOptions) => {
  let pendingRun: (() => void) | null = null;
  let unsubscribe: (() => void) | null = null;

  const release = (): void => {
    unsubscribe?.();
    unsubscribe = null;
  };

  const handleActivity = (): void => {
    // Le champ qui perd le focus est encore actif pendant l'événement : on
    // revérifie après un court délai, comme pour les événements Realtime différés.
    schedule(() => {
      if (!pendingRun || isBusy()) return;
      const run = pendingRun;
      pendingRun = null;
      release();
      run();
    }, delayMs);
  };

  return {
    // Retourne true si l'action a été différée, false si elle a été exécutée.
    runOrDefer(run: () => void): boolean {
      if (!isBusy()) {
        run();
        return false;
      }
      pendingRun = run;
      if (!unsubscribe) unsubscribe = subscribe(handleActivity);
      return true;
    },
    dispose(): void {
      pendingRun = null;
      release();
    },
  };
};
