export interface Product {
  id: string;
  name: string;
  searchName: string; // Nom à rechercher dans l'import
  theoNeed?: number;
  upcomingDelivery?: number | string;
  stock?: number | string;
  targetStock?: number | string; // Nouveau: Stock Cible en unités
  packaging: number | string; // Modifié pour autoriser l'édition
  defaultMargin?: number;
  supplierId?: string; // Nouveau: Identifiant du fournisseur (ex: 'doquet', 'vins')
}

export interface OrderState {
  stock: number | string;
  margin: number;
  targetStock?: number | string; // Nouveau
  upcomingDelivery: number | string;
}

export interface Calculations {
  net: number;
  needWithMargin: number;
  realNeed: number;
  toOrder: number;
}

export interface SupplierConfig {
  id: string;
  name: string;
  deliveryDay: number; // 0 (Dimanche) à 6 (Samedi)
  cutoffDay: number;   // Jour limite
  cutoffTime: string;  // Heure limite "HH:mm"
}