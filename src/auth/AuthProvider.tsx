import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

type AppProfile = {
  id: string;
  role: 'admin' | 'manager' | 'viewer';
  is_active: boolean;
  full_name?: string | null;
  email?: string | null;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: AppProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isActive: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const AUTH_TIMEOUT_MS = 7000;

async function withTimeout<T>(promise: Promise<T>, label: string, timeoutMs = AUTH_TIMEOUT_MS): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} a dépassé ${timeoutMs} ms.`)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AppProfile | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) {
      setLoadingSession(false);
      setLoadingProfile(false);
      setSession(null);
      setProfile(null);
      return;
    }

    let mounted = true;
    const releaseTimer = setTimeout(() => {
      if (!mounted) return;
      console.warn('[auth] Déblocage forcé du chargement.');
      setLoadingSession(false);
      setLoadingProfile(false);
    }, AUTH_TIMEOUT_MS + 1000);

    const loadProfile = async (userId: string | null) => {
      if (!mounted) return;

      if (!userId) {
        setProfile(null);
        setLoadingProfile(false);
        return;
      }

      setLoadingProfile(true);

      try {
        const { data, error } = await withTimeout(
          supabase
            .from('profiles')
            .select('id, role, is_active, full_name, email')
            .eq('id', userId)
            .maybeSingle(),
          'Chargement du profil'
        );

        if (!mounted) return;

        if (error || !data) {
          if (error) console.warn('[auth] Profil indisponible:', error.message);
          setProfile(null);
        } else {
          setProfile(data as AppProfile);
        }
      } catch (error) {
        console.warn('[auth] Erreur lors du chargement du profil:', error);
        if (mounted) setProfile(null);
      } finally {
        if (mounted) setLoadingProfile(false);
      }
    };

    const bootstrap = async () => {
      try {
        const { data, error } = await withTimeout(supabase.auth.getSession(), 'Chargement de la session');

        if (!mounted) return;

        if (error) {
          console.warn('[auth] getSession:', error.message);
          setSession(null);
          setLoadingSession(false);
          setLoadingProfile(false);
          return;
        }

        const nextSession = data.session ?? null;
        setSession(nextSession);
        setLoadingSession(false);
        await loadProfile(nextSession?.user?.id ?? null);
      } catch (error) {
        console.warn('[auth] Impossible de récupérer la session:', error);
        if (!mounted) return;
        setSession(null);
        setProfile(null);
        setLoadingSession(false);
        setLoadingProfile(false);
      }
    };

    void bootstrap();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      setSession(newSession ?? null);
      setLoadingSession(false);
      void loadProfile(newSession?.user?.id ?? null);
    });

    return () => {
      mounted = false;
      clearTimeout(releaseTimer);
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const isActive = profile?.is_active ?? true;
    const isAdmin = profile?.role === 'admin' && isActive;

    return {
      session,
      user: session?.user ?? null,
      profile,
      loading: loadingSession || loadingProfile,
      isAdmin,
      isActive,
      signOut: async () => {
        if (!supabase) return;
        await supabase.auth.signOut();
      },
    };
  }, [session, profile, loadingSession, loadingProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
