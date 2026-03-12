import { assertServerEnv, supabaseAdmin } from '../../_lib/supabaseAdmin.js';
import { forbidden, methodNotAllowed, sendJson, serverError, unauthorized } from '../../_lib/http.js';
import { requireAdmin } from '../../_lib/auth.js';
import { ensureProfilesExist } from '../../_lib/profileProvisioning.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);

  try {
    assertServerEnv();

    const auth = await requireAdmin(req);
    if (!auth.ok) {
      if (auth.status === 401) return unauthorized(res, auth.error);
      return forbidden(res, auth.error);
    }

    const page = Math.max(Number(req.query?.page ?? 1) || 1, 1);
    const perPage = Math.min(Math.max(Number(req.query?.perPage ?? 50) || 50, 1), 200);

    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) return serverError(res, `Impossible de lister les utilisateurs: ${error.message}`);

    const ids = (data?.users ?? []).map((u) => u.id);
    const profilesMap = await ensureProfilesExist(ids);

    const users = (data?.users ?? []).map((u) => {
      const p = profilesMap.get(u.id);
      return {
        id: u.id,
        email: p?.email ?? u.email ?? null,
        full_name: p?.full_name ?? u.user_metadata?.full_name ?? u.user_metadata?.name ?? null,
        role: p?.role ?? 'commande',
        is_active: p?.is_active ?? true,
        access_scope: p?.access_scope ?? 'current_site',
        protected_user: p?.protected_user ?? false,
        created_at: p?.created_at ?? u.created_at,
        updated_at: p?.updated_at ?? u.updated_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
      };
    });

    return sendJson(res, 200, {
      ok: true,
      page,
      perPage,
      total: users.length,
      users,
    });
  } catch (error: any) {
    return serverError(res, error?.message || 'Erreur inattendue lors de la liste utilisateurs.');
  }
}
