import { assertServerEnv, supabaseAdmin } from '../../_lib/supabaseAdmin';
import { forbidden, methodNotAllowed, sendJson, serverError, unauthorized } from '../../_lib/http';
import { requireAdmin } from '../../_lib/auth';

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
    const profilesMap = new Map<string, any>();

    if (ids.length > 0) {
      const { data: profiles, error: profileErr } = await supabaseAdmin
        .from('profiles')
        .select('id, email, full_name, role, is_active, created_at, updated_at')
        .in('id', ids);

      if (profileErr) {
        return serverError(res, `Impossible de lire les profils: ${profileErr.message}`);
      }

      (profiles ?? []).forEach((p) => profilesMap.set(p.id, p));
    }

    const users = (data?.users ?? []).map((u) => {
      const p = profilesMap.get(u.id);
      return {
        id: u.id,
        email: p?.email ?? u.email ?? null,
        full_name: p?.full_name ?? u.user_metadata?.full_name ?? u.user_metadata?.name ?? null,
        role: p?.role ?? 'viewer',
        is_active: p?.is_active ?? true,
        created_at: p?.created_at ?? u.created_at,
        updated_at: p?.updated_at ?? u.updated_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
      };
    });

    return sendJson(res, 200, {
      ok: true,
      page,
      perPage,
      total: data?.total ?? users.length,
      users,
    });
  } catch (error: any) {
    return serverError(res, error?.message || 'Erreur inattendue lors de la liste utilisateurs.');
  }
}
