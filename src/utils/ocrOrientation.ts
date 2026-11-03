// Orientation d'une page lue par OCR : choix de la rotation et position d'un
// point après rotation. Fonctions pures, sans dépendance.
//
// La confiance de Tesseract ne suffit pas : une page lue à l'envers ou de côté
// peut obtenir une confiance aussi bonne que la page à l'endroit. Un mot lu de
// côté a une boîte plus haute que large, ce qui départage les orientations.

export type RotationDegrees = 0 | 90 | 180 | 270;

export const ROTATION_CANDIDATES: RotationDegrees[] = [0, 90, 180, 270];

export interface OcrWordShape {
  text: string;
  width: number;
  height: number;
}

export interface RotationCandidate {
  degrees: RotationDegrees;
  confidence: number;
  sideways: boolean;
}

const MIN_WORD_LENGTH = 3;
const SIDEWAYS_RATIO = 0.5;
const MIN_WORDS_FOR_VERDICT = 5;

// Plus de la moitié des mots d'au moins 3 caractères sont plus hauts que larges :
// la page est lue de côté.
export const isSidewaysWords = (words: OcrWordShape[]): boolean => {
  const significant = words.filter((word) => word.text.trim().length >= MIN_WORD_LENGTH);
  if (significant.length < MIN_WORDS_FOR_VERDICT) return false;
  const tall = significant.filter((word) => word.width < word.height).length;
  return tall / significant.length > SIDEWAYS_RATIO;
};

// Parmi les orientations qui ne lisent pas la page de côté, la plus confiante ;
// à égalité, la première. Sans aucune orientation à l'endroit, la plus confiante.
export const pickBestRotation = (candidates: RotationCandidate[]): RotationDegrees => {
  const upright = candidates.filter((candidate) => !candidate.sideways);
  const pool = upright.length > 0 ? upright : candidates;
  let best: RotationCandidate | null = null;
  pool.forEach((candidate) => {
    if (!best || candidate.confidence > best.confidence) best = candidate;
  });
  return (best as RotationCandidate | null)?.degrees ?? 0;
};

// Position, dans l'image tournée, d'un point de l'image d'origine (largeur
// `width`, hauteur `height`), pour la rotation horaire `degrees`.
export const rotatePoint = (
  x: number,
  y: number,
  degrees: RotationDegrees,
  width: number,
  height: number,
): { x: number; y: number } => {
  if (degrees === 90) return { x: height - y, y: x };
  if (degrees === 180) return { x: width - x, y: height - y };
  if (degrees === 270) return { x: y, y: width - x };
  return { x, y };
};
