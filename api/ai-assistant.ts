const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';

const trimText = (value: unknown, maxLength: number) => String(value ?? '').slice(0, maxLength);

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENAI_API_KEY manquante cote serveur.' });
  }

  const question = trimText(req.body?.question, 1200).trim();
  const context = trimText(req.body?.context, 12000).trim();

  if (!question) {
    return res.status(400).json({ error: 'Question manquante.' });
  }

  try {
    const openaiResponse = await fetch(OPENAI_RESPONSES_URL, {
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
    });

    const payload = await openaiResponse.json();
    if (!openaiResponse.ok) {
      return res.status(openaiResponse.status).json({ error: payload?.error?.message || 'Erreur OpenAI.' });
    }

    const answer =
      payload?.output_text ??
      payload?.output
        ?.flatMap((item: any) => item?.content ?? [])
        ?.map((part: any) => part?.text ?? '')
        ?.join('')
        ?.trim() ??
      '';

    return res.status(200).json({ answer });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur assistant.' });
  }
}
