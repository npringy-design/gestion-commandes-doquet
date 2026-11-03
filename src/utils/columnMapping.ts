// Association des colonnes d'une page à celles de la page de référence.
// Fonction pure, sans dépendance.

export interface ReferenceColumn {
  index: number;
  xStart: number;
  xEnd: number;
}

// Même nombre de colonnes que la page de référence : association par rang
// (les largeurs varient d'une page à l'autre, pas la structure). Sinon :
// recouvrement d'au moins la moitié de la plus petite des deux colonnes ;
// -1 si aucune colonne ne correspond.
export const mapColumnsToReferenceColumns = (
  edges: number[],
  reference: ReferenceColumn[],
): number[] => {
  const count = edges.length - 1;
  if (count === reference.length) return reference.map((column) => column.index);
  return Array.from({ length: Math.max(0, count) }, (_, i) => {
    const left = edges[i];
    const right = edges[i + 1];
    let best = -1;
    let bestOverlap = 0;
    reference.forEach((column) => {
      const overlap = Math.min(right, column.xEnd) - Math.max(left, column.xStart);
      const smaller = Math.min(right - left, column.xEnd - column.xStart);
      if (smaller > 0 && overlap >= smaller * 0.5 && overlap > bestOverlap) {
        best = column.index;
        bestOverlap = overlap;
      }
    });
    return best;
  });
};
