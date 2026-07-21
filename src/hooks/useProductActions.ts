import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { ProductWithHistory } from '../data';
import { SupplierId } from '../constants';
import { OrderLineField } from '../types';
import { getSupplierIdForResetView, getSupplierIdForView } from './appStateHelpers';
import { reorderVisibleItems } from '../utils/productOrder';

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
  updateOrderLineField: (productId: string, field: OrderLineField, value: number | '') => void;
  deleteOrderLineForProduct: (productId: string) => void;
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
  updateOrderLineField,
  deleteOrderLineForProduct,
}: UseProductActionsParams) => {
  // stock/upcomingDelivery/targetStock/packaging vivent désormais dans
  // order_line_states (une ligne par produit) : plus d'écriture dans le
  // blob `products`, pour éviter qu'une session périmée n'écrase en bloc
  // les modifications faites depuis un autre appareil.
  const updateProductValue = useCallback((
    id: string,
    field: 'stock' | 'upcomingDelivery' | 'targetStock' | 'packaging',
    value: string,
  ) => {
    const val: number | '' = value === '' ? '' : Number(value);
    updateOrderLineField(id, field, val);
  }, [updateOrderLineField]);

  const performReset = useCallback(() => {
    const supplierId = getSupplierIdForResetView(view);
    if (!supplierId) return;
    products
      .filter((p) => p.supplierId === supplierId)
      .forEach((p) => {
        updateOrderLineField(p.id, 'stock', '');
        updateOrderLineField(p.id, 'upcomingDelivery', '');
      });
    setShowResetConfirm(false);
  }, [products, setShowResetConfirm, updateOrderLineField, view]);

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
    };
    setProducts((prev) => [newProd, ...prev]);
    setSelectedProductIds(new Set());
  }, [ratioTab, setProducts, setSelectedProductIds, view]);

  const deleteSelectedProducts = useCallback(() => {
    if (selectedProductIds.size === 0) return;
    const n = selectedProductIds.size;
    if (window.confirm(`Confirmer la suppression de ${n} produit(s) ?`)) {
      selectedProductIds.forEach((id) => deleteOrderLineForProduct(id));
      setProducts((prev) => prev.filter((p) => !selectedProductIds.has(p.id)));
      setSelectedProductIds(new Set());
      showToast(`${n} produit${n > 1 ? 's supprimés' : ' supprimé'} ✓`, 'success');
    }
  }, [deleteOrderLineForProduct, selectedProductIds, setProducts, setSelectedProductIds, showToast]);

  const toggleProductSelection = useCallback((id: string) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, [setSelectedProductIds]);

  const reorderProducts = useCallback((draggedId: string, targetId: string, visibleIds: string[]) => {
    setProducts(prev => reorderVisibleItems(prev, visibleIds, draggedId, targetId));
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
    reorderProducts,
    handleNameChange,
    updateSearchName,
    updateImportDivisor,
  };
};
