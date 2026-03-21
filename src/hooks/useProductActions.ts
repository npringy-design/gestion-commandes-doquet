import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { ProductWithHistory } from '../data';
import { SupplierId } from '../constants';
import { getSupplierIdForResetView, getSupplierIdForView } from './appStateHelpers';

type Setter<T> = Dispatch<SetStateAction<T>>;

interface UseProductActionsParams {
  products: ProductWithHistory[];
  view: string;
  ratioTab: SupplierId;
  selectedProductIds: Set<string>;
  setProducts: Setter<ProductWithHistory[]>;
  setSelectedProductIds: Setter<Set<string>>;
  setShowResetConfirm: Setter<boolean>;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const useProductActions = ({
  products,
  view,
  ratioTab,
  selectedProductIds,
  setProducts,
  setSelectedProductIds,
  setShowResetConfirm,
  showToast,
}: UseProductActionsParams) => {
  const updateProductValue = useCallback((
    id: string,
    field: 'stock' | 'upcomingDelivery' | 'targetStock' | 'packaging',
    value: string,
  ) => {
    const val: number | '' = value === '' ? '' : Number(value);
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: val } : p)));
  }, [setProducts]);

  const performReset = useCallback(() => {
    const supplierId = getSupplierIdForResetView(view);
    if (!supplierId) return;
    setProducts((prev) => prev.map((p) => (
      p.supplierId === supplierId ? { ...p, stock: '', upcomingDelivery: '' } : p
    )));
    setShowResetConfirm(false);
  }, [setProducts, setShowResetConfirm, view]);

  const addNewProduct = useCallback(() => {
    const supplierId = getSupplierIdForView(view, ratioTab);
    const newProd: ProductWithHistory = {
      id: `custom-${Date.now()}`,
      supplierId,
      name: 'NOUVEAU PRODUIT',
      searchName: '',
      packaging: 1,
      defaultMargin: 0,
      salesHistory: {},
      stock: 0,
      upcomingDelivery: 0,
      targetStock: 0,
    };
    setProducts((prev) => [newProd, ...prev]);
    setSelectedProductIds(new Set());
  }, [ratioTab, setProducts, setSelectedProductIds, view]);

  const deleteSelectedProducts = useCallback(() => {
    if (selectedProductIds.size === 0) return;
    const n = selectedProductIds.size;
    if (window.confirm(`Confirmer la suppression de ${n} produit(s) ?`)) {
      setProducts((prev) => prev.filter((p) => !selectedProductIds.has(p.id)));
      setSelectedProductIds(new Set());
      showToast(`${n} produit${n > 1 ? 's supprimés' : ' supprimé'} ✓`, 'success');
    }
  }, [selectedProductIds, setProducts, setSelectedProductIds, showToast]);

  const toggleProductSelection = useCallback((id: string) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, [setSelectedProductIds]);

  const moveProduct = useCallback((id: string, direction: 'up' | 'down') => {
    setProducts((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      if (idx === -1) return prev;
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
      return next;
    });
  }, [setProducts]);

  const jumpProductTo = useCallback((id: string, pos: number) => {
    setProducts((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      if (idx === -1) return prev;
      const targetIdx = Math.max(0, Math.min(prev.length - 1, pos - 1));
      const next = [...prev];
      const [moved] = next.splice(idx, 1);
      next.splice(targetIdx, 0, moved);
      return next;
    });
  }, [setProducts]);

  const handleNameChange = useCallback((id: string, newName: string) => {
    setProducts((prev) => prev.map((p) => {
      if (p.id !== id) return p;
      const wasNew = p.name === 'NOUVEAU PRODUIT';
      if (wasNew && newName !== 'NOUVEAU PRODUIT' && newName.trim() !== '') {
        setTimeout(() => {
          const pos = window.prompt(
            `À quel numéro de ligne placer "${newName}" ? (1 à ${products.length})`,
            '1',
          );
          if (pos) {
            const n = parseInt(pos, 10);
            if (!Number.isNaN(n)) jumpProductTo(id, n);
          }
        }, 100);
      }
      return { ...p, name: newName };
    }));
  }, [jumpProductTo, products.length, setProducts]);

  const updateSearchName = useCallback((id: string, searchName: string) => {
    const normalizedSearchName = searchName.trim().toLowerCase();

    setProducts((prev) => {
      const currentProduct = prev.find((p) => p.id === id);
      if (!currentProduct) return prev;

      const duplicateOnSameSupplier = normalizedSearchName.length > 0 && prev.some((p) => (
        p.id !== id &&
        p.supplierId === currentProduct.supplierId &&
        p.searchName.trim().toLowerCase() === normalizedSearchName
      ));

      if (duplicateOnSameSupplier) {
        showToast('Ce mapping existe déjà pour ce fournisseur.', 'info');
        return prev;
      }

      return prev.map((p) => (p.id === id ? { ...p, searchName } : p));
    });
  }, [setProducts, showToast]);

  const updateImportDivisor = useCallback((id: string, val: string) => {
    const normalized: number | '' = val === '' ? '' : Number(val);
    setProducts((prev) => prev.map((p) => (
      p.id === id ? { ...p, importDivisor: normalized } : p
    )));
  }, [setProducts]);

  return {
    updateProductValue,
    performReset,
    addNewProduct,
    deleteSelectedProducts,
    toggleProductSelection,
    moveProduct,
    handleNameChange,
    updateSearchName,
    updateImportDivisor,
  };
};
