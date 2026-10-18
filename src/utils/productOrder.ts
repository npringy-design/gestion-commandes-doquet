type OrderedItem = {
  id: string;
};

// Réordonne uniquement les cartes actuellement visibles. Les produits masqués
// par un filtre et ceux des autres fournisseurs gardent exactement leur place.
export const reorderVisibleItems = <T extends OrderedItem>(
  items: T[],
  visibleIds: string[],
  draggedId: string,
  targetId: string,
): T[] => {
  if (draggedId === targetId) return items;

  const visibleIdSet = new Set(visibleIds);
  if (!visibleIdSet.has(draggedId) || !visibleIdSet.has(targetId)) return items;

  const visibleItems = visibleIds
    .map(id => items.find(item => item.id === id))
    .filter((item): item is T => !!item);
  const draggedIndex = visibleItems.findIndex(item => item.id === draggedId);
  const targetIndex = visibleItems.findIndex(item => item.id === targetId);
  if (draggedIndex < 0 || targetIndex < 0) return items;

  const reorderedVisibleItems = [...visibleItems];
  const [draggedItem] = reorderedVisibleItems.splice(draggedIndex, 1);
  const targetIndexAfterRemoval = reorderedVisibleItems.findIndex(item => item.id === targetId);
  const insertionIndex = draggedIndex < targetIndex
    ? targetIndexAfterRemoval + 1
    : targetIndexAfterRemoval;
  reorderedVisibleItems.splice(insertionIndex, 0, draggedItem);

  let visibleIndex = 0;
  return items.map(item => (
    visibleIdSet.has(item.id)
      ? reorderedVisibleItems[visibleIndex++] ?? item
      : item
  ));
};

const compareNames = (a: string, b: string) =>
  a.localeCompare(b, 'fr', { sensitivity: 'base', numeric: true });

type NamedItem = OrderedItem & { name: string };

// Trie A→Z les cartes visibles, sans bouger les autres. Renvoie `items` tel quel
// (même référence) si les cartes visibles sont déjà triées.
export const sortVisibleItemsAlphabetically = <T extends NamedItem>(
  items: T[],
  visibleIds: string[],
): T[] => {
  const visibleIdSet = new Set(visibleIds);
  const visibleItems = items.filter(item => visibleIdSet.has(item.id));
  const sortedVisibleItems = [...visibleItems].sort((a, b) => compareNames(a.name, b.name));
  if (sortedVisibleItems.every((item, index) => item === visibleItems[index])) return items;

  let visibleIndex = 0;
  return items.map(item => (
    visibleIdSet.has(item.id) ? sortedVisibleItems[visibleIndex++] : item
  ));
};
