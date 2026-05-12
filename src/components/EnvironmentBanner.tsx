import React from 'react';
import { IS_STAGING } from '../constants';

const EnvironmentBanner: React.FC = () => {
  if (!IS_STAGING) return null;

  return (
    <div
      aria-label="Environnement test"
      className="pointer-events-none fixed right-3 top-3 z-[99999] rounded border border-amber-300 bg-amber-100 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-amber-900 shadow-sm"
    >
      TEST
    </div>
  );
};

export default EnvironmentBanner;
