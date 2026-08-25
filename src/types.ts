
// =============================================================
// types.ts
//
// ✅ Correction des types number | string → number | ''
//
// Pourquoi number | '' et pas juste number ?
// Les champs de saisie (stock, packaging...) peuvent être
// visuellement vides dans l'interface. En React, un <input>
// vide renvoie "" (string vide) et pas 0. On utilise donc
// number | '' pour représenter exactement cet état :
//   - number  → une valeur saisie
//   - ''      → champ vide (l'utilisateur n'a rien saisi)
//
// Avant le calcul, on normalise toujours avec toNumber()
// depuis utils/calculations.ts, qui convertit '' en 0.
// =============================================================

import type { SupplierVisualKey } from './lib/supplierVisuals';

export interface Product {
  id:              string;
  name:            string;
  searchName:      string;       // Nom à rechercher dans l'import CSV
  theoNeed?:       number;
  upcomingDelivery?: number | ''; // Livraison prévue (peut être vide)
  stock?:          number | '';   // Stock actuel (peut être vide)
  targetStock?:    number | '';   // Stock cible en unités (peut être vide)
  packaging:       number | '';   // Conditionnement (peut être vide pendant la saisie)
  defaultMargin?:  number;
  supplierId?:     string;        // 'doquet' | 'vins' | 'viandes' | 'domafrais' | 'domafrais_bof'
  // Diviseur pour convertir une unité importée en pièces (ex: kg → pièces)
  importDivisor?:  number | '';
  storageUnit?:    string;        // Unité de stockage (ex: "au Kg", "carton") issue de la trame commande
  packagingUnit?:  string;        // Libellé complet du conditionnement (ex: "carton x 16")
}

export interface OrderState {
  stock:           number | '';
  margin:          number;
  targetStock?:    number | '';
  upcomingDelivery: number | '';
}

// État opérationnel par produit, une ligne par produit dans Supabase
// (table order_line_states), synchronisé en temps réel indépendamment
// pour chaque produit — évite qu'une session périmée n'écrase en bloc
// les modifications faites depuis un autre appareil.
export type OrderLineField = 'stock' | 'upcomingDelivery' | 'targetStock' | 'packaging' | 'margin' | 'realOrder';

export interface OrderLineState {
  stock?:            number | '';
  upcomingDelivery?: number | '';
  targetStock?:      number | '';
  packaging?:        number | '';
  margin?:           number;
  realOrder?:        number | '';
  updatedAt?:        string;
}

export interface Calculations {
  net:            number;
  needWithMargin: number;
  realNeed:       number;
  toOrder:        number;
}

export interface DeliveryRule {
  cutoffDay:   number; // Jour du cut-off (0=Dim … 6=Sam)
  deliveryDay: number; // Jour de livraison correspondant
}

export interface SupplierConfig {
  id:               string;
  name:             string;
  subtitle?:        string;
  visualKey?:       SupplierVisualKey;
  deliveryDay:      number;         // Jour de livraison principal (fallback)
  cutoffDay:        number;         // Cut-off principal (fallback)
  cutoffTime:       string;         // Heure limite "HH:mm"
  deliveryRules?:   DeliveryRule[]; // Règles cutoff→livraison (prioritaire sur cutoffDay/deliveryDay)
  flexibleDelivery?: boolean;       // Livraison possible lun→sam (Plaine Maison)
  isArchived?:      boolean;
  createdAt?:       string;
  includeLimonadeForecast?: boolean;
}


export type PrepCategory = 'poste_chaud' | 'poste_entree' | 'poste_dessert' | 'decongelation';

export interface PrepItem {
  id: string;
  name: string;
  searchName: string; // Peut contenir plusieurs références séparées par " || "
  importDivisor?: number | '';
  category: PrepCategory;
  isActive: boolean;
  ratioHistory: Record<string, number>;
  secondaryDlcHours: number | '';
  targetBuffer: number | '';
  notes?: string;
  baseProduction?: string;
  unitWeightGrams?: number | '';
}

export type PrepImportsByMonth = Record<string, string>;
export type PrepForecastsByDate = Record<string, number>;
export type PrepSheetStocks = Record<string, number>;

export interface PrepBatch {
  id: string;
  productId: string;
  quantity: number;
  remainingQty: number;
  producedAt: string;
  expiresAt: string;
  note?: string;
}

export interface OrderTemplateRow {
  id: string;
  productId?: string;
  sourceCode?: string;
  article: string;
  storageUnit: string;
  packagingUnit: string;
}

export type OrderTemplatesBySupplier = Record<string, OrderTemplateRow[]>;
