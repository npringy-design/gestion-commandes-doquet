// Fiabilisation de la lecture OCR d'une cellule : plusieurs lectures, réparation
// typographique limitée aux mesures, vote, signalement des doutes.
// Fonctions pures, sans dépendance.

// Confusions de forme certaines, uniquement APRÈS un nombre :
//   « 700 mi » -> « 700 ml », « 100 ci » -> « 100 cl », « 27-37q » -> « 27-37g ».
// Rien n'est deviné ailleurs : un mot de libellé n'est jamais modifié.
const MEASURE_LETTER_L = /(\d[.,]?\d*)\s*([mcd])[iI|](?![A-Za-zÀ-ÿ])/g;
const MEASURE_LETTER_G = /(\d)\s*q(?![A-Za-zÀ-ÿ])/g;
// « auL » / « auKg » : espace perdu entre « au » et l'unité (cellule entière).
const AU_UNIT = /^au\s*(L|Kg)$/i;

export const normalizeReading = (raw: string): string => {
  let text = raw.replace(/\s+/g, ' ').trim();
  text = text.replace(MEASURE_LETTER_L, (_m, n: string, u: string) => `${n} ${u}l`);
  text = text.replace(MEASURE_LETTER_G, '$1 g');
  const au = text.match(AU_UNIT);
  if (au) text = `au ${au[1].toLowerCase() === 'l' ? 'L' : 'Kg'}`;
  return text;
};

// Casse ignorée pour comparer deux lectures d'une même cellule (« sac » / « Sac »).
const comparable = (text: string): string => normalizeReading(text).normalize('NFC').toLowerCase();

// Deux lectures sont identiques à la casse près, après normalisation.
export const sameReading = (first: string, second: string): boolean => comparable(first) === comparable(second);

export interface VoteResult {
  text: string;
  // vrai si une variante domine nettement (voir voteReadings)
  agreed: boolean;
}

// Vote entre lectures (après normalisation). Désaccord : variante la plus
// fréquente (la première en cas d'égalité) et `agreed = false`.
export const voteReadings = (readings: string[]): VoteResult => {
  const cleaned = readings.map(normalizeReading).filter((r) => r.length > 0);
  if (cleaned.length === 0) return { text: '', agreed: false };
  const counts = new Map<string, { count: number; first: string }>();
  cleaned.forEach((reading) => {
    const key = comparable(reading);
    const entry = counts.get(key);
    if (entry) entry.count += 1;
    else counts.set(key, { count: 1, first: reading });
  });
  if (cleaned.length === 1) return { text: cleaned[0], agreed: true };
  const ranked = [...counts.values()].sort((a, b) => b.count - a.count);
  const best = ranked[0];
  const second = ranked[1]?.count ?? 0;
  // Accord : au moins 2 lectures identiques ET strictement plus que toute autre
  // variante (2 contre 2 = désaccord, 2 contre 1 et 1 = accord).
  return { text: best.first, agreed: best.count >= 2 && best.count > second };
};

// Un caractère hors de l'alphabet d'un libellé de produit est un symbole que
// l'OCR n'a pas su lire (« Ø » lu « @ », « l » lu « | »).
const SAFE_CHARACTERS = /^[A-Za-zÀ-ÿŒœ0-9 .,;:'’"()/%+&*°²-]*$/;
export const hasUnreadableSymbol = (text: string): boolean => !SAFE_CHARACTERS.test(text);

export type ReviewReason =
  | 'lectures divergentes'
  | 'symbole illisible'
  | 'article vide'
  | 'unité vide'
  | 'conditionnement vide';

export const reviewCell = (vote: VoteResult): ReviewReason[] => {
  const reasons: ReviewReason[] = [];
  if (!vote.agreed) reasons.push('lectures divergentes');
  if (hasUnreadableSymbol(vote.text)) reasons.push('symbole illisible');
  return reasons;
};
