import React, { useCallback, useMemo, useState } from 'react';
import { View } from '../constants';
import { useAuth } from '../auth/AuthProvider';
import { useToast } from '../components/Toast';

type Role = 'super_admin' | 'global_admin' | 'director' | 'chef' | 'manager' | 'viewer';

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

const ROLE_OPTIONS: Role[] = ['global_admin', 'director', 'chef', 'manager', 'viewer'];

const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'SUPER_ADMIN',
  global_admin: 'GLOBAL_ADMIN',
  director: 'DIRECTOR',
  chef: 'CHEF',
  manager: 'MANAGER',
  viewer: 'VIEWER',
};

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
const { session, isAdmin, profile } = useAuth();
  const { showToast } = useToast();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
const [loadError, setLoadError] = useState<string | null>(null);

  const [formEmail, setFormEmail] = useState('');
  const [formFullName, setFormFullName] = useState('');
  const [formTempPassword, setFormTempPassword] = useState('');
  const [formRole, setFormRole] = useState<Role>('viewer');

  const bearer = session?.access_token;

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

  const loadUsers = useCallback(async () => {
    if (!bearer) {
      setLoading(false);
const msg = 'Session absente. Reconnectez-vous.';
setLoadError(msg);
showToast(msg, 'error');
return;
      return;
    }

    setLoading(true);
setLoadError(null);
    try {
      const data = (await request('/api/admin/users/list?page=1&perPage=200')) as ListResponse;
      setUsers(data.users || []);
    } catch (error: any) {
const msg = error?.message || 'Impossible de charger les utilisateurs.';
showToast(msg, 'error');
setLoadError(msg);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [bearer, request, showToast]);

  React.useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const usersCount = useMemo(() => users.length, [users]);
  const currentUserId = profile?.id ?? null;
  const currentUserRole = profile?.role ?? null;
  const isSuperAdmin = currentUserRole === 'super_admin';

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formEmail.trim()) return showToast('Email requis.', 'warning');
    if (!formTempPassword || formTempPassword.length < 8) {
      return showToast('Mot de passe temporaire minimum 8 caractères.', 'warning');
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
        }),
      });

      showToast('Utilisateur créé avec succès.', 'success');
      setCreateOpen(false);
      setFormEmail('');
      setFormFullName('');
      setFormTempPassword('');
      setFormRole('viewer');
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
      await request('/api/admin/users/update', {
        method: 'PATCH',
        body: JSON.stringify({ id, role }),
      });
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role } : u)));
      showToast('Rôle mis à jour.', 'success');
    } catch (error: any) {
      showToast(error?.message || 'Impossible de modifier le rôle.', 'error');
    } finally {
      setActionId(null);
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

if (!isAdmin) {
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
      <div className="max-w-[1400px] mx-auto">
        <div className="bg-white border border-slate-200 rounded-[30px] shadow-xl p-4 lg:p-6 mb-4 lg:mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div>
              <h1 className="text-2xl lg:text-3xl font-black uppercase tracking-tight text-slate-800">
                Gestion des utilisateurs
              </h1>
              <p className="text-slate-500 text-sm font-semibold mt-1">
                {usersCount} compte{usersCount > 1 ? 's' : ''} · Administration des accès
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
                onClick={() => setCreateOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-black uppercase text-[11px] tracking-wider"
                title={isSuperAdmin ? 'Création autorisée en tant que super admin' : "Création autorisée en tant qu'administrateur global"}
              >
                + Créer un utilisateur
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-[28px] shadow-xl overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="min-w-[980px] w-full border-collapse">
              <thead className="bg-slate-900 text-white">
                <tr>
                  <th className="p-3 text-left text-[11px] font-black uppercase tracking-wider">Email</th>
                  <th className="p-3 text-left text-[11px] font-black uppercase tracking-wider">Nom</th>
                  <th className="p-3 text-left text-[11px] font-black uppercase tracking-wider">Rôle</th>
                  <th className="p-3 text-left text-[11px] font-black uppercase tracking-wider">Statut</th>
                  <th className="p-3 text-left text-[11px] font-black uppercase tracking-wider">Créé le</th>
                  <th className="p-3 text-left text-[11px] font-black uppercase tracking-wider">Actions</th>
                </tr>
              </thead>

              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={6} className="p-10 text-center">
                      <div className="inline-flex items-center gap-3 text-slate-500 font-bold">
                        <span className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                        Chargement des utilisateurs...
                      </div>
                    </td>
                  </tr>
                )}

{!loading && loadError && (
  <tr>
    <td colSpan={6} className="p-6 text-center">
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
                    <td colSpan={6} className="p-10 text-center text-slate-400 font-bold">
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
                    const canEditRole = !busy && !isCurrentUser && !isProtected && !isSuperAdminRow;
                    const canToggleStatus = !busy && !isCurrentUser && !isProtected && !isSuperAdminRow;
                    const canDelete = !busy && !isCurrentUser && !isProtected && !isSuperAdminRow;
                    const availableRoleOptions = u.role === 'super_admin' ? ['super_admin', ...ROLE_OPTIONS] : ROLE_OPTIONS;
                    return (
                      <tr key={u.id} className="border-t border-slate-100 hover:bg-slate-50/80 transition-colors">
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
                          <div className="flex items-center gap-2">
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
          <div className="w-full max-w-lg bg-white rounded-3xl border border-slate-200 shadow-2xl p-5">
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
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>

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
