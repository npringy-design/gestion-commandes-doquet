import React from 'react';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import { useAuth } from './AuthProvider';
import LoginPage from '../pages/LoginPage';
import ResetPasswordPage from '../pages/ResetPasswordPage';
import ForcePasswordChangePage from '../pages/ForcePasswordChangePage';
import { ACTIVE_SITE_STORAGE_KEY, SITES, getDisplaySiteName, type SiteId } from '../constants';

const PASSWORD_SETUP_FLOW_STORAGE_KEY = 'hippo_password_setup_flow';
const PASSWORD_SETUP_FLOW_MAX_AGE_MS = 15 * 60 * 1000;

type PasswordSetupFlow = 'recovery' | 'invite';

function rememberPasswordSetupFlow(flow: PasswordSetupFlow): void {
  try {
    window.sessionStorage.setItem(
      PASSWORD_SETUP_FLOW_STORAGE_KEY,
      JSON.stringify({ flow, createdAt: Date.now() })
    );
  } catch {
    // ignore
  }
}

function hasStoredPasswordSetupFlow(): boolean {
  try {
    const raw = window.sessionStorage.getItem(PASSWORD_SETUP_FLOW_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { flow?: string; createdAt?: number };
    if (parsed.flow !== 'recovery' && parsed.flow !== 'invite') return false;
    if (!parsed.createdAt || Date.now() - parsed.createdAt > PASSWORD_SETUP_FLOW_MAX_AGE_MS) {
      window.sessionStorage.removeItem(PASSWORD_SETUP_FLOW_STORAGE_KEY);
      return false;
    }
    return true;
  } catch {
    try {
      window.sessionStorage.removeItem(PASSWORD_SETUP_FLOW_STORAGE_KEY);
    } catch {
      // ignore
    }
    return false;
  }
}

function hasPasswordSetupParams(): boolean {
  try {
    const url = new URL(window.location.href);
    const searchType = url.searchParams.get('type');
    if (searchType === 'recovery' || searchType === 'invite') {
      rememberPasswordSetupFlow(searchType);
      return true;
    }
    if (url.searchParams.get('code')) {
      rememberPasswordSetupFlow('recovery');
      return true;
    }
    if (url.hash) {
      const hp = new URLSearchParams(url.hash.replace(/^#/, ''));
      const hashType = hp.get('type');
      if (hashType === 'recovery' || hashType === 'invite') {
        rememberPasswordSetupFlow(hashType);
        return true;
      }
      if (hp.get('code')) {
        rememberPasswordSetupFlow('recovery');
        return true;
      }
    }
  } catch {
    // ignore
  }
  return hasStoredPasswordSetupFlow();
}

const LoadingScreen: React.FC<{
  label?: string;
  message?: string;
  onRetry?: () => void;
  onResetSite?: () => void;
  onSignOut?: () => void;
}> = ({ label = 'Chargement…', message, onRetry, onResetSite, onSignOut }) => (
  <div className="min-h-screen bg-[#1a0f0a] flex items-center justify-center p-6">
    <div className="w-full max-w-md bg-white rounded-3xl px-6 py-5 shadow-2xl border-4 border-red-600 text-center">
      <div className="text-slate-800 font-black uppercase tracking-widest text-sm">{label}</div>
      {message ? <p className="mt-3 text-sm font-semibold text-slate-600">{message}</p> : null}
      {(onRetry || onResetSite || onSignOut) ? (
        <div className="mt-5 grid gap-3">
          {onRetry ? (
            <button type="button" onClick={onRetry} className="w-full rounded-2xl bg-red-600 py-3 text-sm font-black uppercase tracking-widest text-white">
              Réessayer
            </button>
          ) : null}
          {onResetSite ? (
            <button type="button" onClick={onResetSite} className="w-full rounded-2xl bg-white py-3 text-sm font-black uppercase tracking-widest text-slate-900 border border-slate-300">
              Réinitialiser le site local
            </button>
          ) : null}
          {onSignOut ? (
            <button type="button" onClick={onSignOut} className="w-full rounded-2xl bg-slate-900 py-3 text-sm font-black uppercase tracking-widest text-white">
              Déconnexion forcée
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  </div>
);

export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    user,
    profile,
    loading,
    isActive,
    signOut,
    activeSiteId,
    availableSiteIds,
    setActiveSiteId,
  } = useAuth();

  const siteMismatch = Boolean(user && isActive && availableSiteIds.length > 0 && !availableSiteIds.includes(activeSiteId));
  const siteAccessBlocked = Boolean(user && isActive && profile && availableSiteIds.length === 0);

  const retryAuth = React.useCallback(() => {
    window.location.reload();
  }, []);

  const resetStoredSite = React.useCallback(() => {
    const fallbackSite = availableSiteIds[0];
    try {
      if (fallbackSite) {
        window.sessionStorage.setItem(ACTIVE_SITE_STORAGE_KEY, fallbackSite);
      } else {
        window.sessionStorage.removeItem(ACTIVE_SITE_STORAGE_KEY);
      }
      window.sessionStorage.removeItem(`${ACTIVE_SITE_STORAGE_KEY}:picker`);
    } catch {
      // ignore
    }
    window.location.reload();
  }, [availableSiteIds]);

  React.useEffect(() => {
    if (!siteMismatch) return;
    resetStoredSite();
  }, [resetStoredSite, siteMismatch]);

  if (!isSupabaseConfigured()) return <>{children}</>;
  if (hasPasswordSetupParams()) return <ResetPasswordPage />;
  if (loading) return <LoadingScreen />;
  if (!user) return <LoginPage />;

  if (!isActive) {
    return (
      <div className="min-h-screen bg-[#1a0f0a] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl p-6 shadow-2xl border-4 border-red-600 text-center">
          <h2 className="text-2xl font-black uppercase tracking-tight text-slate-800 mb-2">Compte désactivé</h2>
          <p className="text-slate-600 text-sm font-semibold">Votre compte est actuellement inactif. Contactez un administrateur pour réactiver votre accès.</p>
          <button onClick={() => void signOut()} className="mt-5 w-full bg-red-600 text-white font-black uppercase tracking-widest text-sm py-3 rounded-2xl hover:opacity-95">
            Se déconnecter
          </button>
        </div>
      </div>
    );
  }

  if (profile?.must_change_password || user.user_metadata?.must_change_password) return <ForcePasswordChangePage />;

  if (!profile) {
    return (
      <LoadingScreen
        label="Connexion non confirmée"
        message="Le compte est connecté, mais le profil ou les sites n'ont pas été confirmés. Cela peut venir d'un chargement Supabase trop long. Réessaie avant de forcer la déconnexion."
        onRetry={retryAuth}
        onResetSite={resetStoredSite}
        onSignOut={() => void signOut()}
      />
    );
  }

  if (siteAccessBlocked) {
    return (
      <LoadingScreen
        label="Accès site non confirmé"
        message="Le profil est chargé, mais aucun site actif n'a été confirmé pour ce compte. Réessaie d'abord, puis contacte un administrateur si le message revient."
        onRetry={retryAuth}
        onResetSite={resetStoredSite}
        onSignOut={() => void signOut()}
      />
    );
  }

  if (siteMismatch) {
    return (
      <LoadingScreen label="Correction du site…" message="Si l'application reste bloquée, utilise un des boutons ci-dessous." onRetry={retryAuth} onResetSite={resetStoredSite} onSignOut={() => void signOut()} />
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
                <button key={siteId} type="button" onClick={() => setActiveSiteId(siteId as SiteId)} className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-6 text-left shadow-sm transition hover:border-red-500 hover:bg-red-50">
                  <span className="block text-lg font-black uppercase text-slate-900">{getDisplaySiteName(site.name)}</span>
                  <span className="mt-2 block text-xs font-bold text-slate-500">{site.id}</span>
                </button>
              );
            })}
          </div>
          <button onClick={() => void signOut()} className="mt-5 w-full rounded-2xl bg-slate-900 py-3 text-sm font-black uppercase tracking-widest text-white">
            Se deconnecter
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};