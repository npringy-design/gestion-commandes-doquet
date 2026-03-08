import { requireAdmin } from '../../_lib/auth.js';
import { assertServerEnv, supabaseAdmin } from '../../_lib/supabaseAdmin.js';
import { badRequest, forbidden, methodNotAllowed, sendJson, serverError, unauthorized } from '../../_lib/http.js';
const ALLOWED_ROLES = new Set(['admin', 'manager', 'viewer']);

export default async function handler(req: any, res: any) {
  if (req.method !== 'PATCH') return methodNotAllowed(res, ['PATCH']);

  try {
    assertServerEnv();

    const auth = await requireAdmin(req);
    if (!auth.ok) {
      if (auth.status === 401) return unauthorized(res, auth.error);
      return forbidden(res, auth.error);
    }

    const id = String(req.body?.id ?? '').trim();
    const role = req.body?.role;
    const isActive = req.body?.is_active;
    const fullName = req.body?.full_name;

    if (!id) return badRequest(res, 'Identifiant utilisateur (id) requis.');

    if (
      id === auth.user.id &&
      (req.body?.is_active === false || (req.body?.role && String(req.body?.role) !== 'admin'))
    ) {
      return badRequest(
        res,
        'Vous ne pouvez pas vous retirer vos propres droits admin ni vous désactiver.'
      );
    }

    const patch: Record<string, unknown> = {};

    if (role !== undefined) {
      const nextRole = String(role);
      if (!ALLOWED_ROLES.has(nextRole)) {
        return badRequest(res, 'Rôle invalide. Valeurs autorisées: admin, manager, viewer.');
      }
      patch.role = nextRole;
    }

    if (isActive !== undefined) {
      if (typeof isActive !== 'boolean') {
        return badRequest(res, 'is_active doit être un booléen.');
      }
      patch.is_active = isActive;
    }

    if (fullName !== undefined) {
      if (fullName !== null && typeof fullName !== 'string') {
        return badRequest(res, 'full_name doit être une string ou null.');
      }
      patch.full_name = fullName === null ? null : fullName.trim();
    }

    if (Object.keys(patch).length === 0) {
      return badRequest(res, 'Aucune propriété à mettre à jour (role, is_active, full_name).');
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(patch)
      .eq('id', id)
      .select('id, email, full_name, role, is_active, created_at, updated_at')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return sendJson(res, 404, { ok: false, error: 'Profil utilisateur introuvable.' });
      }
      return serverError(res, `Mise à jour impossible: ${error.message}`);
    }

    return sendJson(res, 200, {
      ok: true,
      message: 'Profil mis à jour avec succès.',
      user: data,
    });
  } catch (error: any) {
    return serverError(res, error?.message || 'Erreur inattendue lors de la mise à jour.');
  }
}
