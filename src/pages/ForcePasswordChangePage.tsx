import React, { useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { useAuth } from '../auth/AuthProvider';

const ForcePasswordChangePage: React.FC = () => {
  const { session, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isSupabaseConfigured() || !supabase) {
      setError('Supabase n est pas configure.');
      return;
    }
    if (password.length < 8) {
      setError('Mot de passe trop court (minimum 8 caracteres).');
      return;
    }
    if (password !== password2) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setLoading(false);
      setError(updateError.message);
      return;
    }

    const res = await fetch('/api/auth/complete-password-change', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify({}),
    });

    setLoading(false);

    if (!res.ok) {
      let message = 'Mot de passe mis a jour, mais validation profil impossible.';
      try {
        const json = await res.json();
        message = json?.error || message;
      } catch {
        // ignore
      }
      setError(message);
      return;
    }

    await supabase.auth.updateUser({
      data: {
        ...(session?.user.user_metadata ?? {}),
        must_change_password: false,
      },
    }).catch(() => null);

    await supabase.auth.refreshSession().catch(() => null);

    window.location.replace(window.location.origin);
  };

  return (
    <div className="min-h-screen bg-[#1a0f0a] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-[#ffd700] text-4xl font-black uppercase tracking-tighter leading-none mb-3">
            SECURITE<br /><span className="text-white">MOT DE PASSE</span>
          </h1>
          <div className="h-2 w-40 bg-red-600 mx-auto rounded-full" />
          <p className="mt-4 text-white/70 text-sm font-semibold">Choisis ton propre mot de passe</p>
        </div>

        <div className="bg-white rounded-[40px] shadow-2xl border-4 border-red-600 p-6">
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
              Ton compte a ete cree avec un mot de passe temporaire. Pour continuer, remplace-le par ton mot de passe personnel.
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-slate-600 mb-1">Nouveau mot de passe</label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
                className="w-full rounded-2xl border-2 border-slate-200 px-4 py-3 font-semibold focus:outline-none focus:border-red-600"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-slate-600 mb-1">Confirmer</label>
              <input
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                type="password"
                required
                className="w-full rounded-2xl border-2 border-slate-200 px-4 py-3 font-semibold focus:outline-none focus:border-red-600"
              />
            </div>

            {error && (
              <div className="bg-red-50 border-2 border-red-200 text-red-700 rounded-2xl px-4 py-3 text-sm font-semibold">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 text-white font-black uppercase tracking-widest text-sm py-4 rounded-2xl hover:opacity-95 disabled:opacity-60"
            >
              {loading ? 'Mise a jour...' : 'Valider'}
            </button>

            <button
              type="button"
              onClick={() => void signOut()}
              className="w-full bg-slate-100 text-slate-700 font-black uppercase tracking-widest text-sm py-4 rounded-2xl hover:opacity-95"
            >
              Se deconnecter
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ForcePasswordChangePage;
