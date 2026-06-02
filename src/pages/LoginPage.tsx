import React, { useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

const LoginPage: React.FC = () => {
  const [mode, setMode] = useState<'login' | 'forgot' | 'sent'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!isSupabaseConfigured() || !supabase) {
      setError('Supabase n\'est pas configuré (variables VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError(error.message);
  };

  const onForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!isSupabaseConfigured() || !supabase) {
      setError('Supabase n\'est pas configuré (variables VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).');
      return;
    }

    if (!email) {
      setError('Renseigne ton email.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}?type=recovery`,
    });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setMode('sent');
    setInfo('Email envoyé. Ouvre le lien pour choisir un nouveau mot de passe.');
  };

  return (
    <div className="min-h-screen bg-[#1a0f0a] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Texture de fond */}
      <div
        className="absolute inset-0 z-0 opacity-20 pointer-events-none"
        style={{ backgroundImage: `url('https://www.transparenttextures.com/patterns/brick-wall.png')` }}
      />

      <div className="z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-[#ffd700] text-5xl font-black uppercase tracking-tighter leading-none mb-3">
            HIPPO<br /><span className="text-white">COMMANDES</span>
          </h1>
          <div className="h-2 w-40 bg-red-600 mx-auto rounded-full" />
          <p className="mt-4 text-white/70 text-sm font-semibold">Connexion requise</p>
        </div>

        <div className="bg-white rounded-[40px] shadow-2xl border-4 border-red-600 p-6">
          {mode === 'login' && (
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-slate-600 mb-1">Email</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                className="w-full rounded-2xl border-2 border-slate-200 px-4 py-3 font-semibold focus:outline-none focus:border-red-600"
                placeholder="ex: email@exemple.com"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-slate-600 mb-1">Mot de passe</label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
                className="w-full rounded-2xl border-2 border-slate-200 px-4 py-3 font-semibold focus:outline-none focus:border-red-600"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="bg-red-50 border-2 border-red-200 text-red-700 rounded-2xl px-4 py-3 text-sm font-semibold">
                {error}
              </div>
            )}

            {info && (
              <div className="bg-emerald-50 border-2 border-emerald-200 text-emerald-700 rounded-2xl px-4 py-3 text-sm font-semibold">
                {info}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 text-white font-black uppercase tracking-widest text-sm py-4 rounded-2xl hover:opacity-95 disabled:opacity-60"
            >
              {loading ? 'Connexion…' : 'Se connecter'}
            </button>

            <button
              type="button"
              onClick={() => { setError(null); setInfo(null); setMode('forgot'); }}
              className="w-full bg-slate-100 text-slate-700 font-black uppercase tracking-widest text-[11px] py-4 rounded-2xl hover:opacity-95"
            >
              Mot de passe oublié ?
            </button>


          </form>
          )}

          {mode === 'forgot' && (
            <form onSubmit={onForgot} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-slate-600 mb-1">Email</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  required
                  className="w-full rounded-2xl border-2 border-slate-200 px-4 py-3 font-semibold focus:outline-none focus:border-red-600"
                  placeholder="ex: email@exemple.com"
                />
              </div>

              {error && (
                <div className="bg-red-50 border-2 border-red-200 text-red-700 rounded-2xl px-4 py-3 text-sm font-semibold">
                  {error}
                </div>
              )}

              {info && (
                <div className="bg-emerald-50 border-2 border-emerald-200 text-emerald-700 rounded-2xl px-4 py-3 text-sm font-semibold">
                  {info}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-red-600 text-white font-black uppercase tracking-widest text-sm py-4 rounded-2xl hover:opacity-95 disabled:opacity-60"
              >
                {loading ? 'Envoi…' : 'Envoyer le lien'}
              </button>

              <button
                type="button"
                onClick={() => { setError(null); setInfo(null); setMode('login'); }}
                className="w-full bg-slate-100 text-slate-700 font-black uppercase tracking-widest text-sm py-4 rounded-2xl hover:opacity-95"
              >
                Retour
              </button>
            </form>
          )}

          {mode === 'sent' && (
            <div className="space-y-4">
              <div className="bg-emerald-50 border-2 border-emerald-200 text-emerald-700 rounded-2xl px-4 py-3 text-sm font-semibold">
                {info || 'Email envoyé.'}
              </div>
              <button
                type="button"
                onClick={() => { setError(null); setInfo(null); setMode('login'); }}
                className="w-full bg-red-600 text-white font-black uppercase tracking-widest text-sm py-4 rounded-2xl hover:opacity-95"
              >
                Revenir à la connexion
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
