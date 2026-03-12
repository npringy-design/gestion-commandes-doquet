export const sendJson = (res: any, status: number, payload: Record<string, unknown>) => {
  res.status(status).json(payload);
};

export const methodNotAllowed = (res: any, allowed: string[]) => {
  res.setHeader('Allow', allowed.join(', '));
  sendJson(res, 405, {
    ok: false,
    error: `Méthode non autorisée. Utiliser: ${allowed.join(', ')}`,
  });
};

export const badRequest = (res: any, message: string) =>
  sendJson(res, 400, { ok: false, error: message });

export const unauthorized = (res: any, message = 'Authentification requise.') =>
  sendJson(res, 401, { ok: false, error: message });

export const forbidden = (res: any, message = 'Accès refusé : droits administrateur requis.') =>
  sendJson(res, 403, { ok: false, error: message });

export const serverError = (res: any, message = 'Erreur serveur inattendue.') =>
  sendJson(res, 500, { ok: false, error: message });
