import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { ACTIVE_SITE_STORAGE_KEY, CURRENT_SITE_ID, SITES, isSiteId, type SiteId } from '../constants';
import { clearUiSessionState } from '../hooks/appStateHelpers';

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
  site_ids?: SiteId[];
  protected_user?: boolean;
  must_change_password?: boolean;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: AppProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isActive: boolean;
  activeSiteId: SiteId;
  availableSiteIds: SiteId[];
  setActiveSiteId: (siteId: SiteId) => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const AUTH_TIMEOUT_MS = 7000;
const ALL_SITE_IDS = Object.keys(SITES) as SiteId[];
const isGlobalSiteRole = (role?: string | null) => role === 'super_admin' || role === 'global_admin';

const clearStoredAuthState = () => {
  clearUiSessionState();
  try {
    window.sessionStorage.removeItem(ACTIVE_SITE_STORAGE_KEY);
  } catch {
    // ignore
  }
  try {
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith('sb-') && key.endsWith('-auth-token'))
      .forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // ignore
  }
};

async function withTimeout<T>(promise: PromiseLike<T>, label: string, timeoutMs = AUTH_TIMEOUT_MS): Promise<T> {
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
            .select('id, role, is_active, full_name, email, access_scope, protected_user')
            .eq('id', userId)
            .maybeSingle(),
          'Chargement du profil'
        );

        if (!mounted) return;

        if (error || !data) {
          if (error) console.warn('[auth] Profil indisponible:', error.message);
          setProfile(null);
        } else {
          const baseProfile = data as AppProfile;
          let siteIds: SiteId[] = [];

          if (isGlobalSiteRole(baseProfile.role) || baseProfile.access_scope === 'all') {
            siteIds = ALL_SITE_IDS;
          } else {
            const { data: accessRows, error: accessError } = await supabase
              .from('user_site_access')
              .select('site_id, is_active')
              .eq('user_id', userId);

            if (accessError) {
              console.warn('[auth] Acces sites indisponibles:', accessError.message);
              setProfile({ ...baseProfile, site_ids: [] });
              return;
            }

            siteIds = (accessRows ?? [])
              .filter((row: any) => row?.is_active && isSiteId(row.site_id))
              .map((row: any) => row.site_id as SiteId);
          }

          const nextProfile = { ...baseProfile, site_ids: siteIds };
          setProfile(nextProfile);

          if (siteIds.length > 0 && !siteIds.includes(CURRENT_SITE_ID as SiteId)) {
            try {
              window.sessionStorage.setItem(ACTIVE_SITE_STORAGE_KEY, siteIds[0]);
              window.location.reload();
            } catch {
              // ignore
            }
          }
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
      if (!newSession) clearStoredAuthState();
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
    const isAdmin = ['super_admin', 'global_admin', 'director', 'manager_plus'].includes(profile?.role ?? '') && isActive;
    const availableSiteIds = profile?.site_ids ?? [];

    return {
      session,
      user: session?.user ?? null,
      profile,
      loading: loadingSession || loadingProfile,
      isAdmin,
      isActive,
      activeSiteId: CURRENT_SITE_ID as SiteId,
      availableSiteIds,
      setActiveSiteId: (siteId: SiteId) => {
        if (!availableSiteIds.includes(siteId)) return;
        try {
          window.sessionStorage.setItem(ACTIVE_SITE_STORAGE_KEY, siteId);
        } catch {
          // ignore
        }
        window.location.reload();
      },
      signOut: async () => {
        if (!supabase) return;
        clearStoredAuthState();
        setSession(null);
        setProfile(null);
        await withTimeout(supabase.auth.signOut(), 'Deconnexion', 3000).catch((error) => {
          console.warn('[auth] Deconnexion distante indisponible:', error);
        });
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
