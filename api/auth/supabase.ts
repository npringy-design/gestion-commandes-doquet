import { methodNotAllowed, sendJson, serverError } from '../_lib/http.js';

const supabaseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const readTarget = (value: unknown): string | null => {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string' || !raw.startsWith('/')) return null;
  if (raw.includes('://') || raw.includes('..')) return null;
  return raw;
};

const readBody = (req: any): string | undefined => {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined;
  if (typeof req.body === 'string') return req.body;
  if (req.body == null) return undefined;
  return JSON.stringify(req.body);
};

export default async function handler(req: any, res: any) {
  if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'].includes(req.method)) {
    return methodNotAllowed(res, ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    return serverError(res, 'Configuration Supabase publique incomplete.');
  }

  const target = readTarget(req.query?.target);
  if (!target) return sendJson(res, 400, { ok: false, error: 'Cible Supabase invalide.' });

  try {
    const headers = new Headers();
    headers.set('apikey', supabaseAnonKey);
    headers.set('Authorization', req.headers?.authorization || `Bearer ${supabaseAnonKey}`);

    const contentType = req.headers?.['content-type'];
    if (contentType) headers.set('Content-Type', contentType);

    const response = await fetch(`${supabaseUrl}/auth/v1${target}`, {
      method: req.method,
      headers,
      body: readBody(req),
    });

    const responseText = await response.text();
    const responseType = response.headers.get('content-type') || 'application/json';
    res.status(response.status);
    res.setHeader('Content-Type', responseType);
    return res.send(responseText);
  } catch (error: any) {
    return serverError(res, error?.message || 'Connexion Supabase auth impossible.');
  }
}
