import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
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
  profileSyncing: boolean;
  isAdmin: boolean;
  isActive: boolean;
  activeSiteId: SiteId;
  availableSiteIds: SiteId[];
  setActiveSiteId: (siteId: SiteId) => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const AUTH_TIMEOUT_MS = 12000;
const PROFILE_RETRY_ATTEMPTS = 2;
const PROFILE_RETRY_DELAY_MS = 1500;
const ALL_SITE_IDS = Object.keys(SITES) as SiteId[];
const isGlobalSiteRole = (role?: string | null) => role === 'super_admin' || role === 'global_admin';
const getUserSiteStorageKey = (userId: string) => `${ACTIVE_SITE_STORAGE_KEY}:user:${userId}`;
const ACTIVE_SITE_PICKER_STORAGE_KEY = `${ACTIVE_SITE_STORAGE_KEY}:picker`;

const clearActiveSessionSite = () => {
  try {
    window.sessionStorage.removeItem(ACTIVE_SITE_STORAGE_KEY);
    window.sessionStorage.removeItem(ACTIVE_SITE_PICKER_STORAGE_KEY);
  } catch {
    // ignore
  }
};

const readUserSitePreference = (userId: string, siteIds: SiteId[]): SiteId | null => {
  try {
    const stored = window.localStorage.getItem(getUserSiteStorageKey(userId));
    return isSiteId(stored) && siteIds.includes(stored) ? stored : null;
  } catch {
    return null;
  }
};

const writeUserSitePreference = (userId: string, siteId: SiteId) => {
  try {
    window.localStorage.setItem(getUserSiteStorageKey(userId), siteId);
  } catch {
    // ignore
  }
};

const writeActiveSessionSite = (siteId: SiteId) => {
  try {
    window.sessionStorage.setItem(ACTIVE_SITE_STORAGE_KEY, siteId);
    window.sessionStorage.removeItem(ACTIVE_SITE_PICKER_STORAGE_KEY);
  } catch {
    // ignore
  }
};

const shouldOpenSitePicker = () => {
  try {
    return window.sessionStorage.getItem(ACTIVE_SITE_PICKER_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
};

// Cache "dernier profil valide" : garantit qu'une session valide peut
// toujours afficher l'app immédiatement, même si le rafraîchissement
// réseau du profil échoue ou traîne. Clé scoppée par site + utilisateur.
const PROFILE_CACHE_STORAGE_KEY = 'hippo_profile_cache';
const SITE_RELOAD_GUARD_KEY = 'hippo_site_reload_guard';

const getProfileCacheKey = (userId: string) => `${PROFILE_CACHE_STORAGE_KEY}:${CURRENT_SITE_ID}:${userId}`;

const readProfileCache = (userId: string): AppProfile | null => {
  try {
    const raw = window.sessionStorage.getItem(getProfileCacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppProfile;
    return parsed && parsed.id === userId ? parsed : null;
  } catch {
    return null;
  }
};

const writeProfileCache = (userId: string, profile: AppProfile) => {
  try {
    window.sessionStorage.setItem(getProfileCacheKey(userId), JSON.stringify(profile));
  } catch {
    // ignore
  }
};

const clearProfileCache = (userId?: string | null) => {
  try {
    if (userId) {
      window.sessionStorage.removeItem(getProfileCacheKey(userId));
      return;
    }
    Object.keys(window.sessionStorage)
      .filter((key) => key.startsWith(PROFILE_CACHE_STORAGE_KEY))
      .forEach((key) => window.sessionStorage.removeItem(key));
  } catch {
    // ignore
  }
};

const clearSupabaseStorage = (storage: Storage) => {
  Object.keys(storage)
    .filter((key) => key.startsWith('sb-'))
    .forEach((key) => storage.removeItem(key));
};

const clearStoredAuthState = () => {
  clearUiSessionState();
  clearActiveSessionSite();
  clearProfileCache();
  try {
    window.sessionStorage.removeItem(SITE_RELOAD_GUARD_KEY);
  } catch {
    // ignore
  }
  try {
    clearSupabaseStorage(window.localStorage);
  } catch {
    // ignore
  }
  try {
    clearSupabaseStorage(window.sessionStorage);
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

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const isTimeoutError = (error: unknown) => error instanceof Error && error.message.includes('a dépassé');

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AppProfile | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileSyncing, setProfileSyncing] = useState(false);
  const lastUserIdRef = useRef<string | null>(null);
  const profileRef = useRef<AppProfile | null>(null);
  const profileRequestIdRef = useRef(0);

  const applyProfile = (next: AppProfile | null) => {
    profileRef.current = next;
    setProfile(next);
  };

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
      let keepLoadingForReload = false;

      if (!userId) {
        clearActiveSessionSite();
        clearProfileCache();
        applyProfile(null);
        setLoadingProfile(false);
        setProfileSyncing(false);
        return;
      }

      const requestId = ++profileRequestIdRef.current;
      const isStale = () => !mounted || profileRequestIdRef.current !== requestId;

      const cached = readProfileCache(userId);
      if (cached && !profileRef.current) {
        applyProfile(cached);
      }
      const hasVisibleProfile = Boolean(profileRef.current);

      if (hasVisibleProfile) {
        setProfileSyncing(true);
      } else {
        setLoadingProfile(true);
      }

      try {
        let data: any = null;
        let error: any = null;

        for (let profileAttempt = 0; profileAttempt <= PROFILE_RETRY_ATTEMPTS; profileAttempt += 1) {
          try {
            const result = await withTimeout(
              supabase
                .from('profiles')
                .select('id, role, is_active, full_name, email, access_scope, protected_user')
                .eq('id', userId)
                .maybeSingle(),
              'Chargement du profil'
            );
            data = result.data;
            error = result.error;
            break;
          } catch (profileError) {
            if (isTimeoutError(profileError) && profileAttempt < PROFILE_RETRY_ATTEMPTS) {
              console.warn(`[auth] Chargement profil timeout, nouvelle tentative ${profileAttempt + 2}/${PROFILE_RETRY_ATTEMPTS + 1}.`);
              await delay(PROFILE_RETRY_DELAY_MS);
              if (!mounted) return;
              continue;
            }
            throw profileError;
          }
        }

        if (isStale()) return;

        if (error) {
          // Échec réseau/timeout : on garde le dernier profil valide connu
          // et on retentera au prochain cycle (bootstrap, focus, realtime).
          console.warn('[auth] Profil indisponible (réseau), profil précédent conservé:', error.message);
          if (!hasVisibleProfile) applyProfile(null);
          return;
        }

        if (!data) {
          // Réponse explicite du serveur : le compte n'existe plus.
          console.warn('[auth] Profil introuvable pour cet utilisateur.');
          clearActiveSessionSite();
          clearProfileCache(userId);
          applyProfile(null);
          return;
        }

        const baseProfile = data as AppProfile;

        if (!baseProfile.is_active) {
          // Réponse explicite du serveur : compte désactivé.
          clearProfileCache(userId);
          applyProfile({ ...baseProfile, site_ids: [] });
          return;
        }

        let siteIds: SiteId[] = [];

        if (isGlobalSiteRole(baseProfile.role) || baseProfile.access_scope === 'all') {
          siteIds = ALL_SITE_IDS;
        } else {
          let accessRows: any[] | null = null;
          let accessError: any = null;

          try {
            const accessResult = await withTimeout(
              supabase.from('user_site_access').select('site_id, is_active').eq('user_id', userId),
              'Chargement des accès sites'
            );
            accessRows = accessResult.data;
            accessError = accessResult.error;
          } catch (accessException) {
            accessError = accessException;
          }

          if (isStale()) return;

          if (accessError) {
            const message = accessError instanceof Error ? accessError.message : String(accessError);
            console.warn('[auth] Acces sites indisponibles (réseau), profil précédent conservé:', message);
            if (!hasVisibleProfile) applyProfile({ ...baseProfile, site_ids: [] });
            return;
          }

          siteIds = (accessRows ?? [])
            .filter((row: any) => row?.is_active && isSiteId(row.site_id))
            .map((row: any) => row.site_id as SiteId);
        }

        if (siteIds.length === 0) {
          clearActiveSessionSite();
          clearProfileCache(userId);
          applyProfile({ ...baseProfile, site_ids: [] });
          return;
        }

        const nextProfile = { ...baseProfile, site_ids: siteIds };
        if (siteIds.length > 1 && shouldOpenSitePicker()) {
          writeProfileCache(userId, nextProfile);
          applyProfile(nextProfile);
          return;
        }

        const selectedSiteId = readUserSitePreference(userId, siteIds) ?? siteIds[0];
        writeActiveSessionSite(selectedSiteId);

        if (CURRENT_SITE_ID !== selectedSiteId) {
          let alreadyReloaded = false;
          try {
            alreadyReloaded = window.sessionStorage.getItem(SITE_RELOAD_GUARD_KEY) === '1';
          } catch {
            alreadyReloaded = false;
          }

          if (!alreadyReloaded) {
            try {
              window.sessionStorage.setItem(SITE_RELOAD_GUARD_KEY, '1');
            } catch {
              // ignore
            }
            keepLoadingForReload = true;
            window.location.reload();
            return;
          }

          console.warn('[auth] Site attendu différent du site courant ; reload déjà effectué pour cette page, poursuite sans reload.');
        }

        writeProfileCache(userId, nextProfile);
        applyProfile(nextProfile);
      } catch (error) {
        if (isStale()) return;
        console.warn('[auth] Erreur lors du chargement du profil, profil précédent conservé si disponible:', error);
        if (!hasVisibleProfile) applyProfile(null);
      } finally {
        if (mounted && !keepLoadingForReload && !isStale()) {
          setLoadingProfile(false);
          setProfileSyncing(false);
        }
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
        const nextUserId = nextSession?.user?.id ?? null;
        if (lastUserIdRef.current && lastUserIdRef.current !== nextUserId) {
          clearActiveSessionSite();
          clearProfileCache(lastUserIdRef.current);
          applyProfile(null);
        }
        lastUserIdRef.current = nextUserId;
        setSession(nextSession);
        setLoadingSession(false);
        await loadProfile(nextUserId);
      } catch (error) {
        console.warn('[auth] Impossible de récupérer la session:', error);
        if (!mounted) return;
        setSession(null);
        applyProfile(null);
        setLoadingSession(false);
        setLoadingProfile(false);
      }
    };

    void bootstrap();

    // SIGNED_IN est réémis par supabase-js pour le MEME utilisateur au retour
    // d'onglet ; loadProfile() applique alors automatiquement un rafraîchissement
    // silencieux (hasVisibleProfile) sans jamais repasser par l'écran de chargement.
    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;
      if (event === 'TOKEN_REFRESHED') return;
      const nextUserId = newSession?.user?.id ?? null;
      if (lastUserIdRef.current && lastUserIdRef.current !== nextUserId) {
        clearActiveSessionSite();
        clearProfileCache(lastUserIdRef.current);
        applyProfile(null);
      }
      lastUserIdRef.current = nextUserId;
      if (event === 'SIGNED_OUT') clearStoredAuthState();
      setSession(newSession ?? null);
      setLoadingSession(false);
      void loadProfile(nextUserId);
    });

    // Retour d'onglet silencieux : on revérifie la session et on rafraîchit
    // le profil en tâche de fond, sans jamais afficher d'écran de chargement
    // si un profil (frais ou en cache) est déjà visible.
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible' || !mounted || !supabase) return;

      void (async () => {
        try {
          const { data, error } = await withTimeout(supabase.auth.getSession(), 'Vérification de session (retour onglet)');
          if (!mounted) return;

          if (error) {
            console.warn('[auth] Vérification de session au retour onglet:', error.message);
            return;
          }

          const nextSession = data.session ?? null;
          const nextUserId = nextSession?.user?.id ?? null;
          if (lastUserIdRef.current && lastUserIdRef.current !== nextUserId) {
            clearActiveSessionSite();
            clearProfileCache(lastUserIdRef.current);
            applyProfile(null);
          }
          lastUserIdRef.current = nextUserId;
          setSession(nextSession);

          if (!nextSession) {
            // Refresh token définitivement invalide pendant l'absence : fin de session réelle.
            setLoadingSession(false);
            void loadProfile(null);
            return;
          }

          void loadProfile(nextUserId);
        } catch (visibilityError) {
          console.warn('[auth] Vérification de session au retour onglet a échoué:', visibilityError);
        }
      })();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      mounted = false;
      clearTimeout(releaseTimer);
      sub.subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const isActive = profile?.is_active ?? true;
    const isAdmin = ['super_admin', 'global_admin', 'director', 'manager_plus'].includes(profile?.role ?? '') && isActive;
    const availableSiteIds = profile?.site_ids ?? [];
    const currentUserId = session?.user?.id ?? null;

    return {
      session,
      user: session?.user ?? null,
      profile,
      loading: loadingSession || loadingProfile,
      profileSyncing,
      isAdmin,
      isActive,
      activeSiteId: CURRENT_SITE_ID as SiteId,
      availableSiteIds,
      setActiveSiteId: (siteId: SiteId) => {
        if (!availableSiteIds.includes(siteId)) return;
        if (currentUserId) writeUserSitePreference(currentUserId, siteId);
        writeActiveSessionSite(siteId);
        window.location.reload();
      },
      signOut: async () => {
        clearStoredAuthState();
        setSession(null);
        applyProfile(null);
        if (supabase) {
          await withTimeout(supabase.auth.signOut({ scope: 'local' }), 'Deconnexion', 3000).catch((error) => {
            console.warn('[auth] Deconnexion locale indisponible:', error);
          });
        }
        window.location.href = '/';
      },
    };
  }, [session, profile, loadingSession, loadingProfile, profileSyncing]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};