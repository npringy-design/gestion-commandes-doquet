import React from 'react';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import { useAuth } from './AuthProvider';
import LoginPage from '../pages/LoginPage';
import ResetPasswordPage from '../pages/ResetPasswordPage';

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
  const { user, loading, isActive, signOut } = useAuth();

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

  return <>{children}</>;
};
