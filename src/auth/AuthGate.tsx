import React from 'react';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import { useAuth } from './AuthProvider';
import LoginPage from '../pages/LoginPage';
import ResetPasswordPage from '../pages/ResetPasswordPage';
import { ACTIVE_SITE_STORAGE_KEY, SITES, type SiteId } from '../constants';

function hasRecoveryParams(): boolean {
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get('type') === 'recovery') return true;
    if (url.searchParams.get('code')) return true;
    if (url.hash) {
      const hp = new URLSearchParams(url.hash.replace(/^#/, ''));
      if (hp.get('type') === 'recovery') return true;
      if (hp.get('code')) return true;
    }
  } catch {
    // ignore
  }
  return false;
}

export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, isActive, signOut, availableSiteIds, setActiveSiteId } = useAuth();

  if (!isSupabaseConfigured()) return <>{children}</>;

  if (hasRecoveryParams()) return <ResetPasswordPage />;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a0f0a] flex items-center justify-center">
        <div className="bg-white rounded-3xl px-6 py-5 shadow-2xl border-4 border-red-600 text-center">
          <div className="text-slate-800 font-black uppercase tracking-widest text-sm">Chargement…</div>
        </div>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  if (!isActive) {
    return (
      <div className="min-h-screen bg-[#1a0f0a] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl p-6 shadow-2xl border-4 border-red-600 text-center">
          <h2 className="text-2xl font-black uppercase tracking-tight text-slate-800 mb-2">Compte désactivé</h2>
          <p className="text-slate-600 text-sm font-semibold">
            Votre compte est actuellement inactif. Contactez un administrateur pour réactiver votre accès.
          </p>
          <button
            onClick={() => void signOut()}
            className="mt-5 w-full bg-red-600 text-white font-black uppercase tracking-widest text-sm py-3 rounded-2xl hover:opacity-95"
          >
            Se déconnecter
          </button>
        </div>
      </div>
    );
  }

  let hasChosenSite = true;
  try {
    hasChosenSite = Boolean(window.sessionStorage.getItem(ACTIVE_SITE_STORAGE_KEY));
  } catch {
    hasChosenSite = true;
  }

  if (availableSiteIds.length > 1 && !hasChosenSite) {
    return (
      <div className="min-h-screen bg-[#1a0f0a] flex items-center justify-center p-6">
        <div className="w-full max-w-2xl rounded-3xl border-4 border-red-600 bg-white p-6 shadow-2xl">
          <div className="text-center">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-red-700">Multisite</p>
            <h1 className="mt-2 text-2xl font-black uppercase text-slate-900">Choisir le site</h1>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {availableSiteIds.map((siteId) => {
              const site = SITES[siteId as SiteId];
              return (
                <button
                  key={siteId}
                  type="button"
                  onClick={() => setActiveSiteId(siteId as SiteId)}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-6 text-left shadow-sm transition hover:border-red-500 hover:bg-red-50"
                >
                  <span className="block text-lg font-black uppercase text-slate-900">{site.name}</span>
                  <span className="mt-2 block text-xs font-bold text-slate-500">{site.id}</span>
                </button>
              );
            })}
          </div>
          <button
            onClick={() => void signOut()}
            className="mt-5 w-full rounded-2xl bg-slate-900 py-3 text-sm font-black uppercase tracking-widest text-white"
          >
            Se deconnecter
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
