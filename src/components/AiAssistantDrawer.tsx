import React, { useState } from 'react';

interface AiAssistantDrawerProps {
  title?: string;
  getContext: () => string;
}

const AiAssistantDrawer: React.FC<AiAssistantDrawerProps> = ({ title = 'Assistant IA', getContext }) => {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const askAssistant = async () => {
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: trimmed,
          context: getContext(),
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Assistant indisponible.');
      }

      setAnswer(String(payload?.answer || ''));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assistant indisponible.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed left-0 top-[46%] z-[99999] flex -translate-y-1/2 items-center gap-2 rounded-r-[20px] border-y border-r border-[#D8AE77] bg-[#3A2116] px-3 py-3 text-[#FFF7EA] shadow-[0_12px_28px_rgba(54,24,12,0.26)] transition hover:bg-[#4A2819] focus:outline-none focus:ring-2 focus:ring-[#F7C05B]"
        title="Ouvrir l'assistant IA"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#F7C05B]/70 bg-[#FFF7EA] text-[13px] font-black text-[#3A2116]">
          IA
        </span>
        <span className="hidden pr-1 text-left text-[10px] font-black uppercase leading-tight tracking-[0.12em] sm:block">
          Assistant
          <br />
          IA
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[100000] flex justify-end bg-black/20" onClick={() => setOpen(false)}>
          <aside
            className="flex h-full w-full max-w-[420px] flex-col border-l border-[#D8AE77] bg-[#FFF8EF] text-[#2F1D14] shadow-[-18px_0_38px_rgba(54,24,12,0.24)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-[#E6C79A] bg-[#4A2217] px-5 py-4 text-[#FFF7EA]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#F7C05B]">Lecture seule</p>
                  <h2 className="mt-1 text-xl font-black">{title}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#FFF7EA]/25 bg-white/10 text-lg font-black"
                  aria-label="Fermer l'assistant IA"
                >
                  x
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div className="rounded-2xl border border-[#E6C79A] bg-white/70 p-3 text-xs font-semibold leading-relaxed text-[#6A432D]">
                Cet assistant analyse uniquement les donnees visibles et les snapshots charges. Il ne modifie ni Supabase, ni les imports, ni les mois figes, ni les mappings.
              </div>

              {answer && (
                <div className="whitespace-pre-wrap rounded-2xl border border-[#D8AE77] bg-[#FFFDF8] p-4 text-sm font-semibold leading-relaxed text-[#2F1D14]">
                  {answer}
                </div>
              )}

              {error && (
                <div className="rounded-2xl border border-[#E7B7A0] bg-[#FFF1EA] p-3 text-sm font-bold text-[#8A2F20]">
                  {error}
                </div>
              )}
            </div>

            <div className="border-t border-[#E6C79A] bg-[#FFF3DF] p-4">
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Ex. Quels produits ont un taux de prise anormal ce mois-ci ?"
                className="h-28 w-full resize-none rounded-2xl border border-[#D8AE77] bg-[#FFFDF8] px-4 py-3 text-sm font-semibold text-[#2F1D14] outline-none focus:border-[#A85F2A]"
              />
              <button
                type="button"
                onClick={askAssistant}
                disabled={loading || !question.trim()}
                className="mt-3 w-full rounded-2xl border border-[#8B431C] bg-[#A85F2A] px-4 py-3 text-xs font-black uppercase tracking-[0.10em] text-white shadow-[0_4px_0_#6F321D] transition hover:bg-[#B86A32] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? 'Analyse en cours...' : 'Demander'}
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
};

export default AiAssistantDrawer;
