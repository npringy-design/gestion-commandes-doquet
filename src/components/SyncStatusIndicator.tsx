import React from 'react';

type SyncStatus = 'idle' | 'saving' | 'saved' | 'pending' | 'error';

interface SyncStatusIndicatorProps {
  status: SyncStatus;
}

const STATUS_CONFIG: Record<Exclude<SyncStatus, 'idle'>, {
  label: string;
  className: string;
  pulse?: boolean;
}> = {
  saving: {
    label: 'Sauvegarde en cours…',
    className: 'border-blue-200 bg-blue-50 text-blue-800',
    pulse: true,
  },
  saved: {
    label: 'Sauvegardé',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  },
  pending: {
    label: 'Sauvegarde en attente — nouvel essai automatique',
    className: 'border-amber-300 bg-amber-50 text-amber-900',
    pulse: true,
  },
  error: {
    label: 'Erreur de sauvegarde — gardez cette page ouverte',
    className: 'border-red-300 bg-red-50 text-red-800',
  },
};

const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({ status }) => {
  if (status === 'idle') return null;

  const config = STATUS_CONFIG[status];

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-3 right-3 z-[120] max-w-[calc(100vw-1.5rem)] rounded-xl border px-3 py-2 shadow-lg ${config.className}`}
    >
      <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wide sm:text-xs">
        <span
          aria-hidden="true"
          className={`h-2.5 w-2.5 shrink-0 rounded-full bg-current ${config.pulse ? 'animate-pulse' : ''}`}
        />
        <span>{config.label}</span>
      </div>
    </div>
  );
};

export default SyncStatusIndicator;
