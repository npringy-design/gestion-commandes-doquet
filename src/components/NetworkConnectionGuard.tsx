import React, { useEffect, useState } from 'react';

type NetworkConnectionGuardProps = {
  onQuit: () => void;
};

const isBrowserOffline = (): boolean =>
  typeof navigator !== 'undefined' && navigator.onLine === false;

const NetworkConnectionGuard: React.FC<NetworkConnectionGuardProps> = ({ onQuit }) => {
  const [isOffline, setIsOffline] = useState(isBrowserOffline);
  const [showDialog, setShowDialog] = useState(isBrowserOffline);

  useEffect(() => {
    const handleOffline = (): void => {
      setIsOffline(true);
      setShowDialog(true);
    };

    const handleOnline = (): void => {
      setIsOffline(false);
      setShowDialog(false);
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  const handleContinue = (): void => {
    setShowDialog(false);
  };

  const handleQuit = (): void => {
    setShowDialog(false);
    onQuit();
  };

  if (!isOffline) return null;

  return (
    <>
      <div
        role="status"
        aria-live="assertive"
        className="pointer-events-none fixed inset-x-0 top-0 z-[99998] bg-red-700 px-4 py-2 text-center text-xs font-black text-white shadow-lg sm:text-sm"
      >
        Connexion perdue — les données affichées peuvent ne plus être à jour.
      </div>

      {showDialog && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/60 p-4">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="network-loss-title"
            aria-describedby="network-loss-description"
            className="w-full max-w-md rounded-3xl border border-red-200 bg-white p-6 shadow-2xl"
          >
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-2xl" aria-hidden="true">
              ⚠
            </div>
            <h2 id="network-loss-title" className="mt-4 text-center text-xl font-black text-slate-900">
              Connexion perdue
            </h2>
            <p id="network-loss-description" className="mt-3 text-center text-sm font-semibold leading-6 text-slate-600">
              Les données affichées peuvent ne plus être à jour. Vous pouvez continuer la saisie : vos modifications seront conservées puis synchronisées automatiquement dès le retour de la connexion.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={handleQuit}
                className="min-h-11 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                Quitter
              </button>
              <button
                type="button"
                autoFocus
                onClick={handleContinue}
                className="min-h-11 rounded-xl bg-[#A85F2A] px-5 py-2.5 text-sm font-black text-white shadow-md transition hover:bg-[#8F4D21]"
              >
                Continuer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default NetworkConnectionGuard;
