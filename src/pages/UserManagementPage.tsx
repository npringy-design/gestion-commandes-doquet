import React, { useCallback, useMemo, useState } from 'react';
import { View } from '../constants';
import { useAuth } from '../auth/AuthProvider';
import { useToast } from '../components/Toast';
import { ROLE_LABELS, canAccessUserManagement, canManageTarget as canManageTargetUi, getAssignableRoleOptions, getCreatableRoles } from '../lib/permissions';

type Role = 'super_admin' | 'global_admin' | 'director' | 'manager_plus' | 'manager' | 'commande';

type UserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: Role;
  is_active: boolean;
  access_scope?: 'all' | 'current_site';
  protected_user?: boolean;
  created_at: string;
  updated_at?: string;
  last_sign_in_at?: string | null;
  default_site_id?: string | null;
  site_ids: string[];
  site_names: string[];
};

type ListResponse = {
  ok: boolean;
  users?: UserRow[];
  total?: number;
  error?: string;
};

interface UserManagementPageProps {
  setView: (v: View) => void;
}

const SITE_ASSIGNABLE_ROLES: Role[] = ['director', 'manager_plus', 'manager', 'commande'];

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

const UserManagementPage: React.FC<UserManagementPageProps> = ({ setView }) => {
  const { session, profile, allowedSites, activeSiteId } = useAuth();
  const { showToast } = useToast();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sitesModalUser, setSitesModalUser] = useState<UserRow | null>(null);
  const [sitesModalSelection, setSitesModalSelection] = useState<string[]>([]);
  const [sitesSaving, setSitesSaving] = useState(false);

  const [formEmail, setFormEmail] = useState('');
  const [formFullName, setFormFullName] = useState('');
  const [formTempPassword, setFormTempPassword] = useState('');
  const [formRole, setFormRole] = useState<Role>('commande');
  const [formSiteIds, setFormSiteIds] = useState<string[]>([]);

  const bearer = session?.access_token;
  const currentUserId = profile?.id ?? null;
  const currentUserRole = profile?.role ?? null;
  const creatableRoles = getCreatableRoles(profile) as Role[];
  const isCreateOnlyUserManagement = currentUserRole === 'manager_plus';
  const isGlobalSiteAdmin = currentUserRole === 'super_admin' || currentUserRole === 'global_admin';
  const activeSiteName = allowedSites.find((site) => site.id === activeSiteId)?.name ?? 'Site actif';

  const request = useCallback(
    async (url: string, init?: RequestInit) => {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      };

      if (bearer) {
        (headers as Record<string, string>).Authorization = `Bearer ${bearer}`;
      }

      const res = await fetch(url, {
        ...init,
        headers,
      });

      let json: any = null;
      try {
        json = await res.json();
      } catch {
        // ignore
      }

      if (!res.ok || (json && json.ok === false)) {
        const message = json?.error || `Erreur HTTP ${res.status}`;
        throw new Error(message);
      }

      return json;
    },
    [bearer]
  );

  const syncSiteSelectionForRole = useCallback(
    (role: Role, incomingIds: string[]) => {
      const ids = Array.from(new Set(incomingIds.filter(Boolean)));
      if (!isGlobalSiteAdmin) {
        return activeSiteId ? [activeSiteId] : [];
      }
      if (role === 'global_admin' || role === 'super_admin') {
        return allowedSites.map((site) => site.id);
      }
      if (SITE_ASSIGNABLE_ROLES.includes(role)) {
        return ids;
      }
      return ids;
    },
    [activeSiteId, allowedSites, isGlobalSiteAdmin]
  );

  const toggleFormSite = useCallback(
    (siteId: string) => {
      setFormSiteIds((prev) => {
        const exists = prev.includes(siteId);
        let next = exists ? prev.filter((id) => id !== siteId) : [...prev, siteId];
        next = syncSiteSelectionForRole(formRole, next);
        return next;
      });
    },
    [formRole, syncSiteSelectionForRole]
  );

  const toggleModalSite = useCallback(
    (siteId: string, role: Role) => {
      setSitesModalSelection((prev) => {
        const exists = prev.includes(siteId);
        let next = exists ? prev.filter((id) => id !== siteId) : [...prev, siteId];
        next = syncSiteSelectionForRole(role, next);
        return next;
      });
    },
    [syncSiteSelectionForRole]
  );

  const loadUsers = useCallback(async () => {
    if (!bearer) {
      setLoading(false);
      const msg = 'Session absente. Reconnectez-vous.';
      setLoadError(msg);
      showToast(msg, 'error');
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      const query = new URLSearchParams({ page: '1', perPage: '200' });
      if (activeSiteId) query.set('activeSiteId', activeSiteId);
      const data = (await request(`/api/admin/users/list?${query.toString()}`)) as ListResponse;
      setUsers(data.users || []);
    } catch (error: any) {
      const msg = error?.message || 'Impossible de charger les utilisateurs.';
      showToast(msg, 'error');
      setLoadError(msg);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [bearer, request, showToast, activeSiteId]);

  React.useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  React.useEffect(() => {
    setFormSiteIds(syncSiteSelectionForRole(formRole, formSiteIds));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formRole, isGlobalSiteAdmin, activeSiteId, allowedSites.length]);

  const usersCount = useMemo(() => users.length, [users]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formEmail.trim()) return showToast('Email requis.', 'warning');
    if (!formTempPassword || formTempPassword.length < 8) {
      return showToast('Mot de passe temporaire minimum 8 caractères.', 'warning');
    }

    const normalizedSiteIds = syncSiteSelectionForRole(formRole, formSiteIds);
    if (SITE_ASSIGNABLE_ROLES.includes(formRole) && normalizedSiteIds.length === 0) {
      return showToast('Sélectionne au moins un site.', 'warning');
    }

    setCreateLoading(true);
    try {
      await request('/api/admin/users/create', {
        method: 'POST',
        body: JSON.stringify({
          email: formEmail.trim(),
          fullName: formFullName.trim() || null,
          tempPassword: formTempPassword,
          role: formRole,
          siteIds: normalizedSiteIds,
          activeSiteId,
        }),
      });

      showToast('Utilisateur créé avec succès.', 'success');
      setCreateOpen(false);
      setFormEmail('');
      setFormFullName('');
      setFormTempPassword('');
      setFormRole('commande');
      setFormSiteIds(activeSiteId ? [activeSiteId] : []);
      await loadUsers();
    } catch (error: any) {
      showToast(error?.message || 'Erreur lors de la création.', 'error');
    } finally {
      setCreateLoading(false);
    }
  };

  const updateRole = async (id: string, role: Role) => {
    setActionId(id);
    try {
      const row = users.find((u) => u.id === id);
      const nextSiteIds = syncSiteSelectionForRole(role, row?.site_ids ?? []);
      const data = await request('/api/admin/users/update', {
        method: 'PATCH',
        body: JSON.stringify({ id, role, siteIds: nextSiteIds, activeSiteId }),
      });
      const updatedUser = data?.user as Partial<UserRow> | undefined;
      if (updatedUser) {
        setUsers((prev) =>
          prev.map((u) =>
            u.id === id
              ? {
                  ...u,
                  ...updatedUser,
                  role: (updatedUser.role as Role | undefined) ?? role,
                  site_ids: nextSiteIds,
                  site_names: allowedSites.filter((site) => nextSiteIds.includes(site.id)).map((site) => site.name),
                }
              : u
          )
        );
      } else {
        await loadUsers();
      }
      showToast('Rôle mis à jour.', 'success');
    } catch (error: any) {
      await loadUsers();
      showToast(error?.message || 'Impossible de modifier le rôle.', 'error');
    } finally {
      setActionId(null);
    }
  };

  const updateSites = async () => {
    if (!sitesModalUser) return;
    const normalizedSiteIds = syncSiteSelectionForRole(sitesModalUser.role, sitesModalSelection);
    if (SITE_ASSIGNABLE_ROLES.includes(sitesModalUser.role) && normalizedSiteIds.length === 0) {
      return showToast('Sélectionne au moins un site.', 'warning');
    }

    setSitesSaving(true);
    try {
      await request('/api/admin/users/update', {
        method: 'PATCH',
        body: JSON.stringify({
          id: sitesModalUser.id,
          siteIds: normalizedSiteIds,
          activeSiteId,
        }),
      });
      showToast('Accès sites mis à jour.', 'success');
      setSitesModalUser(null);
      setSitesModalSelection([]);
      await loadUsers();
    } catch (error: any) {
      showToast(error?.message || 'Impossible de mettre à jour les accès sites.', 'error');
    } finally {
      setSitesSaving(false);
    }
  };

  const toggleActive = async (id: string) => {
    setActionId(id);
    try {
      const data = await request('/api/admin/users/toggle-active', {
        method: 'PATCH',
        body: JSON.stringify({ id }),
      });

      const nextActive = Boolean(data?.user?.is_active);
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, is_active: nextActive } : u)));
      showToast(nextActive ? 'Utilisateur réactivé.' : 'Utilisateur désactivé.', 'success');
    } catch (error: any) {
      showToast(error?.message || 'Impossible de changer le statut.', 'error');
    } finally {
      setActionId(null);
    }
  };

  const deleteUser = async (id: string) => {
    setActionId(id);
    try {
      await request('/api/admin/users/delete', {
        method: 'DELETE',
        body: JSON.stringify({ id }),
      });
      setUsers((prev) => prev.filter((u) => u.id !== id));
      showToast('Utilisateur supprimé définitivement.', 'success');
      setConfirmDeleteId(null);
    } catch (error: any) {
      showToast(error?.message || 'Suppression impossible.', 'error');
    } finally {
      setActionId(null);
    }
  };

  if (!canAccessUserManagement(profile)) {
    return (
      <div className="min-h-screen bg-[#f1f5f9] p-3 lg:p-6 pb-20">
        <div className="max-w-3xl mx-auto bg-white border border-slate-200 rounded-[30px] shadow-xl p-6 text-center">
          <h1 className="text-2xl font-black uppercase text-slate-800">Accès refusé</h1>
          <p className="text-slate-500 font-semibold mt-2">
            Cette section est réservée aux administrateurs actifs.
          </p>
          <button
            onClick={() => setView('admin_dashboard')}
            className="mt-5 h-10 px-4 rounded-xl bg-slate-900 text-white font-black uppercase text-[11px]"
          >
            Retour Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f1f5f9] p-3 lg:p-6 pb-20">
      <div className="max-w-[1500px] mx-auto">
        <div className="bg-white border border-slate-200 rounded-[30px] shadow-xl p-4 lg:p-6 mb-4 lg:mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div>
              <h1 className="text-2xl lg:text-3xl font-black uppercase tracking-tight text-slate-800">
                Gestion des utilisateurs
              </h1>
              <p className="text-slate-500 text-sm font-semibold mt-1">
                {usersCount} compte{usersCount > 1 ? 's' : ''} · Site affiché : <span className="text-slate-700">{activeSiteName}</span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setView('admin_dashboard')}
                className="px-4 py-2.5 rounded-xl bg-slate-900 text-white font-black uppercase text-[11px] tracking-wider"
              >
                Retour Dashboard
              </button>
              <button
                onClick={() => {
                  setCreateOpen(true);
                  setFormSiteIds(syncSiteSelectionForRole(formRole, activeSiteId ? [activeSiteId] : []));
                }}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-black uppercase text-[11px] tracking-wider"
                title="Créer un utilisateur autorisé par votre rôle"
              >
                + Créer un utilisateur
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-[28px] shadow-xl overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="min-w-[1180px] w-full border-collapse">
              <thead className="bg-slate-900 text-white">
                <tr>
                  <th className="p-3 text-left text-[11px] font-black uppercase tracking-wider">Email</th>
                  <th className="p-3 text-left text-[11px] font-black uppercase tracking-wider">Nom</th>
                  <th className="p-3 text-left text-[11px] font-black uppercase tracking-wider">Rôle</th>
                  <th className="p-3 text-left text-[11px] font-black uppercase tracking-wider">Sites</th>
                  <th className="p-3 text-left text-[11px] font-black uppercase tracking-wider">Statut</th>
                  <th className="p-3 text-left text-[11px] font-black uppercase tracking-wider">Créé le</th>
                  <th className="p-3 text-left text-[11px] font-black uppercase tracking-wider">Actions</th>
                </tr>
              </thead>

              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={7} className="p-10 text-center">
                      <div className="inline-flex items-center gap-3 text-slate-500 font-bold">
                        <span className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                        Chargement des utilisateurs...
                      </div>
                    </td>
                  </tr>
                )}

                {!loading && loadError && (
                  <tr>
                    <td colSpan={7} className="p-6 text-center">
                      <div className="inline-flex flex-col items-center gap-3">
                        <p className="text-red-600 font-bold">{loadError}</p>
                        <button
                          onClick={() => void loadUsers()}
                          className="h-9 px-3 rounded-lg bg-slate-900 text-white text-[11px] font-black uppercase"
                        >
                          Réessayer
                        </button>
                      </div>
                    </td>
                  </tr>
                )}

                {!loading && !loadError && users.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-10 text-center text-slate-400 font-bold">
                      Aucun utilisateur à afficher.
                    </td>
                  </tr>
                )}

                {!loading && !loadError &&
                  users.map((u) => {
                    const busy = actionId === u.id;
                    const isCurrentUser = currentUserId === u.id;
                    const isProtected = Boolean(u.protected_user);
                    const isSuperAdminRow = u.role === 'super_admin';
                    const canManageRow = canManageTargetUi(profile, u);
                    const canEditRole = !busy && canManageRow && !isCreateOnlyUserManagement;
                    const canToggleStatus = !busy && canManageRow && !isCreateOnlyUserManagement;
                    const canDelete = !busy && canManageRow && !isCreateOnlyUserManagement;
                    const canEditSites = isGlobalSiteAdmin && !busy && canManageRow && u.role !== 'super_admin' && u.role !== 'global_admin';
                    const availableRoleOptions = ((u.role === 'super_admin' ? ['super_admin'] : getAssignableRoleOptions(profile, u)) as Role[]).length
                      ? ((u.role === 'super_admin' ? ['super_admin'] : getAssignableRoleOptions(profile, u)) as Role[])
                      : [u.role];
                    return (
                      <tr key={u.id} className="border-t border-slate-100 hover:bg-slate-50/80 transition-colors align-top">
                        <td className="p-3 text-sm font-bold text-slate-700">{u.email || '—'}</td>
                        <td className="p-3 text-sm font-semibold text-slate-600">{u.full_name || '—'}</td>
                        <td className="p-3">
                          <select
                            value={u.role}
                            onChange={(e) => void updateRole(u.id, e.target.value as Role)}
                            disabled={!canEditRole}
                            className="h-9 px-3 rounded-lg border border-slate-300 bg-white text-sm font-bold text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {availableRoleOptions.map((r) => (
                              <option key={r} value={r}>
                                {ROLE_LABELS[r]}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-3 min-w-[280px]">
                          <div className="flex flex-wrap gap-1.5">
                            {(u.site_names?.length ? u.site_names : ['Aucun site']).map((siteName) => (
                              <span key={`${u.id}-${siteName}`} className="inline-flex px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-black uppercase tracking-wide">
                                {siteName}
                              </span>
                            ))}
                          </div>
                          {canEditSites && (
                            <button
                              onClick={() => {
                                setSitesModalUser(u);
                                setSitesModalSelection(u.site_ids || []);
                              }}
                              className="mt-2 h-8 px-3 rounded-lg bg-indigo-50 text-indigo-700 text-[11px] font-black uppercase"
                            >
                              Modifier les sites
                            </button>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider ${
                                u.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {u.is_active ? 'Actif' : 'Inactif'}
                            </span>
                            {u.protected_user && (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-100 text-amber-700">
                                Protégé
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-sm font-semibold text-slate-500">{formatDate(u.created_at)}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            {canToggleStatus ? (
                              <button
                                onClick={() => void toggleActive(u.id)}
                                disabled={!canToggleStatus}
                                className="h-9 px-3 rounded-lg bg-slate-900 text-white text-[11px] font-black uppercase disabled:opacity-50"
                              >
                                {busy ? '...' : u.is_active ? 'Désactiver' : 'Réactiver'}
                              </button>
                            ) : (
                              <span className="inline-flex items-center h-9 px-3 rounded-lg bg-slate-100 text-slate-500 text-[11px] font-black uppercase">
                                {isCurrentUser ? 'Compte courant' : isProtected || isSuperAdminRow ? 'Compte protégé' : 'Action bloquée'}
                              </span>
                            )}
                            {canDelete ? (
                              <button
                                onClick={() => setConfirmDeleteId(u.id)}
                                disabled={!canDelete}
                                className="h-9 px-3 rounded-lg bg-red-600 text-white text-[11px] font-black uppercase disabled:opacity-50"
                              >
                                Supprimer
                              </button>
                            ) : !canToggleStatus && !canDelete && isCreateOnlyUserManagement ? (
                              <span className="inline-flex items-center h-9 px-3 rounded-lg bg-slate-100 text-slate-500 text-[11px] font-black uppercase">
                                Création uniquement
                              </span>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-[1000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white rounded-3xl border border-slate-200 shadow-2xl p-5">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-xl font-black uppercase text-slate-800">Créer un utilisateur</h2>
                <p className="text-slate-500 text-sm font-semibold mt-1">Compte Auth + profil applicatif</p>
              </div>
              <button onClick={() => setCreateOpen(false)} className="text-slate-400 hover:text-slate-700 font-black">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3">
              <input
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                type="email"
                placeholder="Email"
                className="w-full h-11 px-3 rounded-xl border border-slate-300 font-semibold"
                required
              />
              <input
                value={formFullName}
                onChange={(e) => setFormFullName(e.target.value)}
                type="text"
                placeholder="Nom (optionnel)"
                className="w-full h-11 px-3 rounded-xl border border-slate-300 font-semibold"
              />
              <input
                value={formTempPassword}
                onChange={(e) => setFormTempPassword(e.target.value)}
                type="text"
                placeholder="Mot de passe temporaire"
                className="w-full h-11 px-3 rounded-xl border border-slate-300 font-semibold"
                required
              />
              <select
                value={formRole}
                onChange={(e) => setFormRole(e.target.value as Role)}
                className="w-full h-11 px-3 rounded-xl border border-slate-300 font-bold"
              >
                {creatableRoles.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>

              <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-3">Accès sites</p>
                {!isGlobalSiteAdmin ? (
                  <p className="text-sm font-semibold text-slate-700">
                    Création limitée au site actif : <span className="font-black">{activeSiteName}</span>
                  </p>
                ) : formRole === 'global_admin' || formRole === 'super_admin' ? (
                  <p className="text-sm font-semibold text-slate-700">Ce rôle aura automatiquement accès à tous les sites actuels et futurs.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {allowedSites.map((site) => {
                      const checked = formSiteIds.includes(site.id);
                      return (
                        <label key={site.id} className={`flex items-center gap-3 rounded-xl border px-3 py-2 cursor-pointer ${checked ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white'}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleFormSite(site.id)}
                            className="h-4 w-4"
                          />
                          <span className="text-sm font-bold text-slate-700">{site.name}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="h-10 px-4 rounded-xl bg-slate-100 text-slate-700 font-black uppercase text-[11px]"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="h-10 px-4 rounded-xl bg-indigo-600 text-white font-black uppercase text-[11px] disabled:opacity-50"
                >
                  {createLoading ? 'Création...' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {sitesModalUser && (
        <div className="fixed inset-0 z-[1000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white rounded-3xl border border-slate-200 shadow-2xl p-5">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-xl font-black uppercase text-slate-800">Accès sites</h2>
                <p className="text-slate-500 text-sm font-semibold mt-1">{sitesModalUser.email}</p>
              </div>
              <button onClick={() => setSitesModalUser(null)} className="text-slate-400 hover:text-slate-700 font-black">✕</button>
            </div>

            {sitesModalUser.role === 'global_admin' || sitesModalUser.role === 'super_admin' ? (
              <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50 text-sm font-semibold text-slate-700">
                Ce rôle a automatiquement accès à tous les sites actuels et futurs.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {allowedSites.map((site) => {
                  const checked = sitesModalSelection.includes(site.id);
                  return (
                    <label key={site.id} className={`flex items-center gap-3 rounded-xl border px-3 py-2 cursor-pointer ${checked ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white'}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleModalSite(site.id, sitesModalUser.role)}
                        className="h-4 w-4"
                      />
                      <span className="text-sm font-bold text-slate-700">{site.name}</span>
                    </label>
                  );
                })}
              </div>
            )}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSitesModalUser(null)}
                className="h-10 px-4 rounded-xl bg-slate-100 text-slate-700 font-black uppercase text-[11px]"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => void updateSites()}
                disabled={sitesSaving}
                className="h-10 px-4 rounded-xl bg-indigo-600 text-white font-black uppercase text-[11px] disabled:opacity-50"
              >
                {sitesSaving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteId && (
        <div className="fixed inset-0 z-[1000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-2xl p-5">
            <h3 className="text-lg font-black uppercase text-slate-800">Confirmer la suppression</h3>
            <p className="text-slate-500 text-sm font-semibold mt-2">
              Cette action est définitive. Le compte sera supprimé de Supabase Auth.
            </p>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="h-10 px-4 rounded-xl bg-slate-100 text-slate-700 font-black uppercase text-[11px]"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => void deleteUser(confirmDeleteId)}
                disabled={actionId === confirmDeleteId}
                className="h-10 px-4 rounded-xl bg-red-600 text-white font-black uppercase text-[11px] disabled:opacity-50"
              >
                {actionId === confirmDeleteId ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagementPage;
