import { assertServerEnv, supabaseAdmin } from '../_lib/supabaseAdmin.js';
import { methodNotAllowed, sendJson, serverError, unauthorized } from '../_lib/http.js';

const readBearerToken = (req: any): string | null => {
  const header = req.headers?.authorization || req.headers?.Authorization;
  if (!header || typeof header !== 'string') return null;
  if (!header.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim() || null;
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

  try {
    assertServerEnv();

    const token = readBearerToken(req);
    if (!token) return unauthorized(res, 'Token Bearer manquant.');

    const { data: userData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !userData?.user) {
      return unauthorized(res, 'Session invalide ou expiree.');
    }

    const userId = userData.user.id;

    await supabaseAdmin
      .from('profiles')
      .update({ must_change_password: false, updated_at: new Date().toISOString() })
      .eq('id', userId);

    const { error: metadataError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...(userData.user.user_metadata ?? {}),
        must_change_password: false,
      },
    });

    if (metadataError) {
      return serverError(res, `Metadata non mise a jour: ${metadataError.message}`);
    }

    return sendJson(res, 200, { ok: true });
  } catch (error: any) {
    return serverError(res, error?.message || 'Erreur inattendue.');
  }
}
