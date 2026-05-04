import React, { useEffect, useMemo, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

function getParamFromSearchOrHash(key: string): string | null {
  try {
    const url = new URL(window.location.href);
    const fromSearch = url.searchParams.get(key);
    if (fromSearch) return fromSearch;

    // Certains flows Supabase utilisent le hash (#access_token=...)
    if (url.hash && url.hash.includes('=')) {
      const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
      return hashParams.get(key);
    }
  } catch {
    // ignore
  }
  return null;
}

const ResetPasswordPage: React.FC = () => {
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'init' | 'ready' | 'done' | 'error'>('init');
  const [message, setMessage] = useState<string>('');

  const code = useMemo(() => getParamFromSearchOrHash('code'), []);
  const type = useMemo(() => getParamFromSearchOrHash('type'), []);

  useEffect(() => {
    const run = async () => {
      if (!isSupabaseConfigured() || !supabase) {
        setStatus('error');
        setMessage('Supabase n\'est pas configuré.');
        return;
      }

      // Flow recommandé: si on a un "code", on échange contre une session
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setStatus('error');
          setMessage(error.message || 'Impossible de valider le lien de réinitialisation.');
          return;
        }
      }

      // Si on arrive ici via un lien recovery (type=recovery), on peut setter le mot de passe
      if (type && type !== 'recovery') {
        // Pas un flow reset → on laisse l'utilisateur revenir au login
        setStatus('error');
        setMessage('Lien invalide ou expiré.');
        return;
      }

      setStatus('ready');
      setMessage('');
    };

    run();
  }, [code, type]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');

    if (!isSupabaseConfigured() || !supabase) {
      setStatus('error');
      setMessage('Supabase n\'est pas configuré.');
      return;
    }

    if (!password || password.length < 6) {
      setStatus('error');
      setMessage('Mot de passe trop court (minimum 6 caractères).');
      return;
    }
    if (password !== password2) {
      setStatus('error');
      setMessage('Les mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setLoading(false);
      setStatus('error');
      setMessage(error.message);
      return;
    }

    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) {
      await fetch('/api/auth/complete-password-change', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${data.session.access_token}`,
        },
        body: JSON.stringify({}),
      }).catch(() => null);
    }

    setLoading(false);

    setStatus('done');
    setMessage('Mot de passe mis à jour.');
  };

  const goHome = () => {
    // Nettoie les params de reset
    window.location.href = window.location.origin;
  };

  return (
    <div className="min-h-screen bg-[#1a0f0a] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div
        className="absolute inset-0 z-0 opacity-20 pointer-events-none"
        style={{ backgroundImage: `url('https://www.transparenttextures.com/patterns/brick-wall.png')` }}
      />

      <div className="z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-[#ffd700] text-4xl font-black uppercase tracking-tighter leading-none mb-3">
            NOUVEAU<br /><span className="text-white">MOT DE PASSE</span>
          </h1>
          <div className="h-2 w-40 bg-red-600 mx-auto rounded-full" />
          <p className="mt-4 text-white/70 text-sm font-semibold">Réinitialisation</p>
        </div>

        <div className="bg-white rounded-[40px] shadow-2xl border-4 border-red-600 p-6">
          {status === 'ready' && (
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-slate-600 mb-1">Nouveau mot de passe</label>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  required
                  className="w-full rounded-2xl border-2 border-slate-200 px-4 py-3 font-semibold focus:outline-none focus:border-red-600"
                  placeholder="••••••••"
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
                  placeholder="••••••••"
                />
              </div>

              {message && (
                <div className={`border-2 rounded-2xl px-4 py-3 text-sm font-semibold ${status === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-red-600 text-white font-black uppercase tracking-widest text-sm py-4 rounded-2xl hover:opacity-95 disabled:opacity-60"
              >
                {loading ? 'Mise à jour…' : 'Valider'}
              </button>

              <button
                type="button"
                onClick={goHome}
                className="w-full bg-slate-100 text-slate-700 font-black uppercase tracking-widest text-sm py-4 rounded-2xl hover:opacity-95"
              >
                Retour
              </button>
            </form>
          )}

          {status !== 'ready' && (
            <div className="space-y-4">
              {message && (
                <div className={`border-2 rounded-2xl px-4 py-3 text-sm font-semibold ${status === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
                  {message}
                </div>
              )}

              {status === 'done' && (
                <button
                  type="button"
                  onClick={goHome}
                  className="w-full bg-red-600 text-white font-black uppercase tracking-widest text-sm py-4 rounded-2xl hover:opacity-95"
                >
                  Revenir à l’app
                </button>
              )}

              {status === 'error' && (
                <button
                  type="button"
                  onClick={goHome}
                  className="w-full bg-red-600 text-white font-black uppercase tracking-widest text-sm py-4 rounded-2xl hover:opacity-95"
                >
                  Retour
                </button>
              )}

              {status === 'init' && (
                <div className="text-slate-700 text-sm font-semibold">Chargement…</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
