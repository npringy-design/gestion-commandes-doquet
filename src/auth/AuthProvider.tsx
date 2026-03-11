import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

export type AppRole =
  | 'super_admin'
  | 'global_admin'
  | 'director'
  | 'manager_plus'
  | 'manager'
  | 'commande';

export type AppProfile = {
  id: string;
  role: AppRole;
  is_active: boolean;
  full_name?: string | null;
  email?: string | null;
  access_scope?: 'all' | 'current_site' | null;
  protected_user?: boolean;
  default_site_id?: string | null;
};

export type AppSite = {
  id: string;
  code: string;
  name: string;
};

export type AppUserSite = {
  site_id: string;
  site: AppSite | null;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: AppProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isActive: boolean;
  signOut: () => Promise<void>;
  allowedSites: AppSite[];
  activeSiteId: string | null;
  setActiveSiteId: React.Dispatch<React.SetStateAction<string | null>>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const AUTH_TIMEOUT_MS = 7000;
const ACTIVE_SITE_STORAGE_KEY = 'hippo_active_site_id';

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
  const [allowedSites, setAllowedSites] = useState<AppSite[]>([]);
  const [activeSiteId, setActiveSiteId] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) {
      setLoadingSession(false);
      setLoadingProfile(false);
      setSession(null);
      setProfile(null);
      setAllowedSites([]);
      setActiveSiteId(null);
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
        setAllowedSites([]);
        setActiveSiteId(null);
        setLoadingProfile(false);
        return;
      }

      setLoadingProfile(true);

      try {
        const { data, error } = await withTimeout(
          supabase
            .from('profiles')
            .select('id, role, is_active, full_name, email, access_scope, protected_user, default_site_id')
            .eq('id', userId)
            .maybeSingle(),
          'Chargement du profil'
        );

        if (!mounted) return;

        if (error || !data) {
          if (error) console.warn('[auth] Profil indisponible:', error.message);
          setProfile(null);
          setAllowedSites([]);
          setActiveSiteId(null);
          return;
        }

        const nextProfile = data as AppProfile;
        setProfile(nextProfile);

        const { data: userSitesData, error: userSitesError } = await withTimeout(
          supabase
            .from('user_sites')
            .select('site_id, site:sites(id, code, name)')
            .eq('user_id', userId),
          'Chargement des sites autorisés'
        );

        if (!mounted) return;

        if (userSitesError) {
          console.warn('[auth] Sites utilisateurs indisponibles:', userSitesError.message);
          setAllowedSites([]);
          setActiveSiteId(nextProfile.default_site_id ?? null);
          return;
        }

        const nextAllowedSites = ((userSitesData ?? []) as AppUserSite[])
          .map((entry) => entry.site)
          .filter((site): site is AppSite => Boolean(site))
          .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));

        setAllowedSites(nextAllowedSites);

        const storedSiteId =
  typeof window !== 'undefined'
    ? window.localStorage.getItem(ACTIVE_SITE_STORAGE_KEY)
    : null;

const validIds = new Set(nextAllowedSites.map((site) => site.id));

let nextActiveSiteId: string | null = null;

if (storedSiteId && validIds.has(storedSiteId)) {
  nextActiveSiteId = storedSiteId;
} else if (nextProfile.default_site_id && validIds.has(nextProfile.default_site_id)) {
  nextActiveSiteId = nextProfile.default_site_id;
} else if (nextAllowedSites.length > 0) {
  nextActiveSiteId = nextAllowedSites[0].id;
}

setActiveSiteId(nextActiveSiteId);

if (typeof window !== 'undefined') {
  if (nextActiveSiteId) {
    window.localStorage.setItem(ACTIVE_SITE_STORAGE_KEY, nextActiveSiteId);
  } else {
    window.localStorage.removeItem(ACTIVE_SITE_STORAGE_KEY);
  }
}
      } catch (error) {
        console.warn('[auth] Erreur lors du chargement du profil:', error);
        if (mounted) {
          setProfile(null);
          setAllowedSites([]);
          setActiveSiteId(null);
        }
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
          setAllowedSites([]);
          setActiveSiteId(null);
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
        setAllowedSites([]);
        setActiveSiteId(null);
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

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!activeSiteId) {
      window.localStorage.removeItem(ACTIVE_SITE_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(ACTIVE_SITE_STORAGE_KEY, activeSiteId);
  }, [activeSiteId]);

  const value = useMemo<AuthContextValue>(() => {
    const isActive = profile?.is_active ?? true;
    const isAdmin = ['super_admin', 'global_admin', 'director', 'manager_plus'].includes(profile?.role ?? '') && isActive;

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
      allowedSites,
      activeSiteId,
      setActiveSiteId,
    };
  }, [session, profile, loadingSession, loadingProfile, allowedSites, activeSiteId]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
