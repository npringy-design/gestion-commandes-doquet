import React from 'react';
import { APP_ENV_LABEL, CURRENT_SITE_ID, IS_TEST_RUNTIME, SITES } from '../constants';

const EnvironmentBanner: React.FC = () => {
  if (!IS_TEST_RUNTIME) return null;

  return (
    <div className="sticky top-0 z-[99999] border-b-2 border-amber-300 bg-[#2B1208] px-4 py-2 text-center shadow-lg">
      <div className="text-[11px] font-black uppercase tracking-[0.22em] text-amber-200">
        {APP_ENV_LABEL} - donnees de test - {SITES[CURRENT_SITE_ID]?.name ?? CURRENT_SITE_ID}
      </div>
    </div>
  );
};

export default EnvironmentBanner;
