import { requireActiveUser } from './_lib/auth.js';
import {
  AI_ASSISTANT_MAX_BODY_BYTES,
  AI_ASSISTANT_RATE_LIMIT_MAX,
  AI_ASSISTANT_TIMEOUT_MS,
  consumeAiAssistantRateLimit,
  readRequestContentLength,
} from './_lib/aiAssistantSecurity.js';
import { assertServerEnv } from './_lib/supabaseAdmin.js';
import { forbidden, methodNotAllowed, sendJson, unauthorized } from './_lib/http.js';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';

const trimText = (value: unknown, maxLength: number) => String(value ?? '').slice(0, maxLength);

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST']);
  }

  const contentLength = readRequestContentLength(req);
  if (contentLength !== null && contentLength > AI_ASSISTANT_MAX_BODY_BYTES) {
    return sendJson(res, 413, { ok: false, error: 'Requête trop volumineuse.' });
  }

  try {
    assertServerEnv();

    const auth = await requireActiveUser(req);
    if (!auth.ok) {
      if (auth.status === 401) return unauthorized(res, auth.error);
      return forbidden(res, auth.error);
    }

    const rateLimit = consumeAiAssistantRateLimit(auth.user.id);
    res.setHeader('X-RateLimit-Limit', String(AI_ASSISTANT_RATE_LIMIT_MAX));
    res.setHeader('X-RateLimit-Remaining', String(rateLimit.remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(rateLimit.resetAt / 1000)));
    if (!rateLimit.allowed) {
      res.setHeader('Retry-After', String(rateLimit.retryAfterSeconds));
      return sendJson(res, 429, {
        ok: false,
        error: 'Trop de demandes. Réessaie dans quelques minutes.',
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return sendJson(res, 500, { ok: false, error: 'Assistant temporairement indisponible.' });
    }

    const question = trimText(req.body?.question, 1200).trim();
    const context = trimText(req.body?.context, 12000).trim();

    if (!question) {
      return sendJson(res, 400, { ok: false, error: 'Question manquante.' });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_ASSISTANT_TIMEOUT_MS);
    let openaiResponse: Response;
    try {
      openaiResponse = await fetch(OPENAI_RESPONSES_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4.1-mini',
          input: [
            {
              role: 'system',
              content:
                'Tu es un assistant metier restauration pour une application de gestion. Tu aides a analyser cout matiere, imports, ecarts, produits, taux de prise et mois figes. Tu es strictement en lecture seule: ne propose jamais de modifier directement Supabase, supprimer, figer, defiger ou changer un mapping. Si une action est utile, indique quoi verifier ou faire manuellement dans l application.',
            },
            {
              role: 'user',
              content: `Contexte page:\n${context || 'Aucun contexte fourni.'}\n\nQuestion utilisateur:\n${question}`,
            },
          ],
          max_output_tokens: 700,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const payload = await openaiResponse.json();
    if (!openaiResponse.ok) {
      return sendJson(res, 502, { ok: false, error: 'Assistant temporairement indisponible.' });
    }

    const answer =
      payload?.output_text ??
      payload?.output
        ?.flatMap((item: any) => item?.content ?? [])
        ?.map((part: any) => part?.text ?? '')
        ?.join('')
        ?.trim() ??
      '';

    return sendJson(res, 200, { ok: true, answer });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return sendJson(res, 504, { ok: false, error: 'L’assistant a mis trop de temps à répondre.' });
    }
    return sendJson(res, 500, { ok: false, error: 'Assistant temporairement indisponible.' });
  }
}
