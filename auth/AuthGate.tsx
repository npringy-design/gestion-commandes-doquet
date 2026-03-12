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
    // fallback hash
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
  const { user, loading } = useAuth();

  // Supabase non configuré → pas de blocage (utile en dev)
  if (!isSupabaseConfigured()) return <>{children}</>;

  // Flow reset password: accessible même sans session
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

  return <>{children}</>;
};
