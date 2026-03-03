
import { Product, SupplierConfig } from './types';

export const MONTHLY_COVERS: Record<string, number> = {
  jan: 3956, feb: 4863, mar: 4440, apr: 4239, 
  may: 4506, jun: 4002, jul: 4493, aug: 4604, 
  sep: 3470, oct: 5082, nov: 4694, dec: 5989
};

export interface DailyCover {
  midi: number | "";
  soir: number | "";
}

// Données extraites des captures d'écran pour 2026
export const DAILY_COVERS_INITIAL: Record<string, DailyCover[]> = {
  jan: [
    { midi: 100, soir: 50 }, { midi: 55, soir: 95 }, { midi: 135, soir: 170 }, { midi: 90, soir: 50 },
    { midi: 55, soir: 50 }, { midi: 55, soir: 50 }, { midi: 55, soir: 50 }, { midi: 55, soir: 50 },
    { midi: 55, soir: 95 }, { midi: 135, soir: 170 }, { midi: 90, soir: 50 }, { midi: 55, soir: 50 },
    { midi: 55, soir: 50 }, { midi: 55, soir: 50 }, { midi: 55, soir: 50 }, { midi: 55, soir: 95 },
    { midi: 135, soir: 170 }, { midi: 90, soir: 50 }, { midi: 50, soir: 40 }, { midi: 50, soir: 40 },
    { midi: 50, soir: 40 }, { midi: 50, soir: 40 }, { midi: 50, soir: 95 }, { midi: 135, soir: 170 },
    { midi: 90, soir: 40 }, { midi: 50, soir: 40 }, { midi: 50, soir: 40 }, { midi: 50, soir: 40 },
    { midi: 50, soir: 40 }, { midi: 50, soir: 95 }, { midi: 135, soir: 170 }
  ],
  feb: [
    { midi: 125, soir: 45 }, { midi: 45, soir: 45 }, { midi: 45, soir: 45 }, { midi: 45, soir: 45 },
    { midi: 45, soir: 45 }, { midi: 45, soir: 115 }, { midi: 165, soir: 195 }, { midi: 125, soir: 45 },
    { midi: 45, soir: 45 }, { midi: 45, soir: 45 }, { midi: 45, soir: 45 }, { midi: 45, soir: 45 },
    { midi: 45, soir: 115 }, { midi: 165, soir: 210 }, { midi: 125, soir: 45 }, { midi: 85, soir: 70 },
    { midi: 85, soir: 70 }, { midi: 85, soir: 70 }, { midi: 85, soir: 70 }, { midi: 85, soir: 115 },
    { midi: 165, soir: 195 }, { midi: 125, soir: 70 }, { midi: 85, soir: 70 }, { midi: 85, soir: 70 },
    { midi: 85, soir: 70 }, { midi: 85, soir: 70 }, { midi: 85, soir: 115 }, { midi: 165, soir: 195 },
    { midi: "", soir: "" }, { midi: "", soir: "" }, { midi: "", soir: "" }
  ],
  mar: [
    { midi: 130, soir: 40 }, { midi: 50, soir: 40 }, { midi: 50, soir: 40 }, { midi: 50, soir: 40 },
    { midi: 50, soir: 40 }, { midi: 50, soir: 85 }, { midi: 135, soir: 195 }, { midi: 130, soir: 40 },
    { midi: 50, soir: 40 }, { midi: 50, soir: 40 }, { midi: 50, soir: 40 }, { midi: 50, soir: 40 },
    { midi: 50, soir: 85 }, { midi: 135, soir: 195 }, { midi: 130, soir: 40 }, { midi: 50, soir: 40 },
    { midi: 50, soir: 40 }, { midi: 50, soir: 40 }, { midi: 50, soir: 40 }, { midi: 50, soir: 85 },
    { midi: 135, soir: 195 }, { midi: 130, soir: 40 }, { midi: 50, soir: 40 }, { midi: 50, soir: 40 },
    { midi: 50, soir: 40 }, { midi: 50, soir: 40 }, { midi: 50, soir: 85 }, { midi: 135, soir: 195 },
    { midi: 130, soir: 40 }, { midi: 50, soir: 40 }, { midi: 50, soir: 40 }
  ],
  apr: [
    { midi: 50, soir: 45 }, { midi: 50, soir: 45 }, { midi: 50, soir: 85 }, { midi: 110, soir: 150 },
    { midi: 100, soir: 80 }, { midi: 110, soir: 45 }, { midi: 50, soir: 45 }, { midi: 50, soir: 45 },
    { midi: 50, soir: 45 }, { midi: 50, soir: 85 }, { midi: 110, soir: 150 }, { midi: 100, soir: 60 },
    { midi: 70, soir: 60 }, { midi: 70, soir: 60 }, { midi: 70, soir: 60 }, { midi: 70, soir: 60 },
    { midi: 70, soir: 85 }, { midi: 110, soir: 150 }, { midi: 100, soir: 60 }, { midi: 70, soir: 60 },
    { midi: 70, soir: 60 }, { midi: 70, soir: 60 }, { midi: 70, soir: 60 }, { midi: 70, soir: 85 },
    { midi: 110, soir: 150 }, { midi: 100, soir: 45 }, { midi: 50, soir: 45 }, { midi: 50, soir: 45 },
    { midi: 50, soir: 45 }, { midi: 50, soir: 90 }, { midi: "", soir: "" }
  ],
  may: [
    { midi: 110, soir: 90 }, { midi: 100, soir: 150 }, { midi: 125, soir: 55 }, { midi: 50, soir: 45 },
    { midi: 50, soir: 45 }, { midi: 50, soir: 45 }, { midi: 50, soir: 100 }, { midi: 100, soir: 90 },
    { midi: 100, soir: 150 }, { midi: 125, soir: 45 }, { midi: 50, soir: 45 }, { midi: 50, soir: 45 },
    { midi: 50, soir: 100 }, { midi: 140, soir: 100 }, { midi: 100, soir: 90 }, { midi: 100, soir: 150 },
    { midi: 125, soir: 45 }, { midi: 50, soir: 45 }, { midi: 50, soir: 45 }, { midi: 50, soir: 45 },
    { midi: 50, soir: 45 }, { midi: 50, soir: 50 }, { midi: 100, soir: 150 }, { midi: 125, soir: 100 },
    { midi: 150, soir: 45 }, { midi: 50, soir: 45 }, { midi: 50, soir: 45 }, { midi: 50, soir: 45 },
    { midi: 50, soir: 90 }, { midi: 100, soir: 150 }, { midi: 200, soir: 45 }
  ],
  jun: [
    { midi: 50, soir: 50 }, { midi: 50, soir: 50 }, { midi: 50, soir: 50 }, { midi: 50, soir: 50 },
    { midi: 50, soir: 85 }, { midi: 105, soir: 135 }, { midi: 105, soir: 50 }, { midi: 50, soir: 50 },
    { midi: 50, soir: 50 }, { midi: 50, soir: 50 }, { midi: 50, soir: 50 }, { midi: 50, soir: 85 },
    { midi: 105, soir: 135 }, { midi: 105, soir: 50 }, { midi: 50, soir: 50 }, { midi: 50, soir: 50 },
    { midi: 50, soir: 50 }, { midi: 50, soir: 50 }, { midi: 50, soir: 85 }, { midi: 105, soir: 135 },
    { midi: 105, soir: 50 }, { midi: 50, soir: 50 }, { midi: 50, soir: 50 }, { midi: 50, soir: 50 },
    { midi: 50, soir: 50 }, { midi: 50, soir: 50 }, { midi: 50, soir: 85 }, { midi: 105, soir: 50 },
    { midi: 50, soir: 50 }, { midi: 50, soir: 50 }, { midi: "", soir: "" }
  ],
  jul: [
    { midi: 55, soir: 60 }, { midi: 55, soir: 60 }, { midi: 55, soir: 60 }, { midi: 115, soir: 135 },
    { midi: 105, soir: 60 }, { midi: 55, soir: 60 }, { midi: 55, soir: 60 }, { midi: 55, soir: 60 },
    { midi: 55, soir: 60 }, { midi: 55, soir: 100 }, { midi: 115, soir: 135 }, { midi: 105, soir: 60 },
    { midi: 55, soir: 100 }, { midi: 100, soir: 60 }, { midi: 55, soir: 60 }, { midi: 55, soir: 60 },
    { midi: 55, soir: 100 }, { midi: 115, soir: 135 }, { midi: 105, soir: 60 }, { midi: 55, soir: 60 },
    { midi: 55, soir: 60 }, { midi: 55, soir: 60 }, { midi: 55, soir: 60 }, { midi: 55, soir: 100 },
    { midi: 115, soir: 135 }, { midi: 105, soir: 60 }, { midi: 55, soir: 60 }, { midi: 55, soir: 60 },
    { midi: 55, soir: 60 }, { midi: 55, soir: 60 }, { midi: 55, soir: 100 }
  ],
  aug: [
    { midi: 110, soir: 120 }, { midi: 80, soir: 65 }, { midi: 60, soir: 65 }, { midi: 60, soir: 65 },
    { midi: 60, soir: 65 }, { midi: 60, soir: 65 }, { midi: 60, soir: 85 }, { midi: 110, soir: 120 },
    { midi: 80, soir: 65 }, { midi: 60, soir: 65 }, { midi: 60, soir: 65 }, { midi: 60, soir: 65 },
    { midi: 60, soir: 65 }, { midi: 60, soir: 110 }, { midi: 130, soir: 120 }, { midi: 80, soir: 65 },
    { midi: 60, soir: 65 }, { midi: 60, soir: 65 }, { midi: 60, soir: 65 }, { midi: 60, soir: 65 },
    { midi: 60, soir: 85 }, { midi: 110, soir: 120 }, { midi: 80, soir: 65 }, { midi: 60, soir: 65 },
    { midi: 60, soir: 65 }, { midi: 60, soir: 65 }, { midi: 60, soir: 65 }, { midi: 60, soir: 85 },
    { midi: 110, soir: 120 }, { midi: 80, soir: 65 }, { midi: 60, soir: 65 }
  ],
  sep: [
    { midi: 45, soir: 40 }, { midi: 45, soir: 40 }, { midi: 45, soir: 40 }, { midi: 45, soir: 90 },
    { midi: 105, soir: 135 }, { midi: 100, soir: 40 }, { midi: 45, soir: 40 }, { midi: 45, soir: 40 },
    { midi: 45, soir: 40 }, { midi: 45, soir: 40 }, { midi: 45, soir: 90 }, { midi: 105, soir: 135 },
    { midi: 100, soir: 40 }, { midi: 45, soir: 40 }, { midi: 45, soir: 40 }, { midi: 45, soir: 40 },
    { midi: 45, soir: 40 }, { midi: 45, soir: 90 }, { midi: 105, soir: 135 }, { midi: 100, soir: 40 },
    { midi: 45, soir: 40 }, { midi: 45, soir: 40 }, { midi: 45, soir: 40 }, { midi: 45, soir: 40 },
    { midi: 45, soir: 90 }, { midi: 105, soir: 135 }, { midi: 100, soir: 40 }, { midi: 45, soir: 40 },
    { midi: 45, soir: 40 }, { midi: 45, soir: 40 }, { midi: "", soir: "" }
  ],
  oct: [
    { midi: 45, soir: 40 }, { midi: 45, soir: 85 }, { midi: 120, soir: 175 }, { midi: 155, soir: 40 },
    { midi: 45, soir: 40 }, { midi: 45, soir: 40 }, { midi: 45, soir: 40 }, { midi: 45, soir: 40 },
    { midi: 45, soir: 85 }, { midi: 120, soir: 175 }, { midi: 155, soir: 40 }, { midi: 45, soir: 40 },
    { midi: 45, soir: 40 }, { midi: 45, soir: 40 }, { midi: 45, soir: 40 }, { midi: 45, soir: 85 },
    { midi: 120, soir: 175 }, { midi: 155, soir: 65 }, { midi: 100, soir: 65 }, { midi: 100, soir: 65 },
    { midi: 100, soir: 65 }, { midi: 100, soir: 65 }, { midi: 100, soir: 85 }, { midi: 120, soir: 175 },
    { midi: 155, soir: 65 }, { midi: 100, soir: 65 }, { midi: 100, soir: 65 }, { midi: 100, soir: 65 },
    { midi: 100, soir: 65 }, { midi: 100, soir: 85 }, { midi: 120, soir: 175 }
  ],
  nov: [
    { midi: 180, soir: 45 }, { midi: 50, soir: 45 }, { midi: 50, soir: 45 }, { midi: 50, soir: 45 },
    { midi: 50, soir: 45 }, { midi: 50, soir: 75 }, { midi: 155, soir: 170 }, { midi: 140, soir: 45 },
    { midi: 50, soir: 45 }, { midi: 50, soir: 100 }, { midi: 170, soir: 45 }, { midi: 50, soir: 45 },
    { midi: 50, soir: 75 }, { midi: 155, soir: 170 }, { midi: 140, soir: 45 }, { midi: 50, soir: 45 },
    { midi: 50, soir: 45 }, { midi: 50, soir: 45 }, { midi: 50, soir: 45 }, { midi: 50, soir: 75 },
    { midi: 155, soir: 170 }, { midi: 140, soir: 45 }, { midi: 50, soir: 45 }, { midi: 50, soir: 45 },
    { midi: 50, soir: 45 }, { midi: 50, soir: 45 }, { midi: 50, soir: 75 }, { midi: 155, soir: 170 },
    { midi: 140, soir: 45 }, { midi: 50, soir: 45 }, { midi: "", soir: "" }
  ],
  dec: [
    { midi: 60, soir: 55 }, { midi: 60, soir: 55 }, { midi: 60, soir: 55 }, { midi: 60, soir: 95 },
    { midi: 150, soir: 175 }, { midi: 150, soir: 55 }, { midi: 60, soir: 55 }, { midi: 60, soir: 55 },
    { midi: 60, soir: 55 }, { midi: 60, soir: 95 }, { midi: 60, soir: 95 }, { midi: 150, soir: 175 },
    { midi: 150, soir: 55 }, { midi: 60, soir: 55 }, { midi: 60, soir: 55 }, { midi: 60, soir: 55 },
    { midi: 60, soir: 55 }, { midi: 60, soir: 95 }, { midi: 150, soir: 175 }, { midi: 150, soir: 85 },
    { midi: 90, soir: 85 }, { midi: 90, soir: 85 }, { midi: 90, soir: 85 }, { midi: 90, soir: 120 },
    { midi: 70, soir: 95 }, { midi: 150, soir: 175 }, { midi: 150, soir: 85 }, { midi: 90, soir: 85 },
    { midi: 90, soir: 85 }, { midi: 90, soir: 85 }, { midi: 90, soir: 120 }
  ]
};

export const MONTHS_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export interface ProductWithHistory extends Product {
  salesHistory: Record<string, number>;
}

export const DOQUET_CONFIG: SupplierConfig = {
  id: 'doquet',
  name: 'Doquet',
  deliveryDay: 3,    // Mercredi
  cutoffDay: 2,      // Mardi avant 10h
  cutoffTime: '10:00',
  deliveryRules: [
    { cutoffDay: 2, deliveryDay: 3 }, // Mardi→Mercredi
  ],
};

export const VINS_CONFIG: SupplierConfig = {
  id: 'vins',
  name: 'Richard Vins',
  deliveryDay: 5,    // Vendredi
  cutoffDay: 2,      // Mardi avant 10h
  cutoffTime: '10:00',
  deliveryRules: [
    { cutoffDay: 2, deliveryDay: 5 }, // Mardi→Vendredi
  ],
};

export const VIANDES_CONFIG: SupplierConfig = {
  id: 'viandes',
  name: 'Plaine Maison',
  deliveryDay: 1,
  cutoffDay: 5,      // Vendredi avant 10h pour livraison lundi
  cutoffTime: '10:00',
  flexibleDelivery: true, // Livraison lun→sam, cut-off = veille avant 10h (sauf lundi = vendredi)
};

export const DOMAFRAIS_CONFIG: SupplierConfig = {
  id: 'domafrais',
  name: 'Domafrais Viandes',
  deliveryDay: 3,
  cutoffDay: 1,
  cutoffTime: '10:00',
  deliveryRules: [
    { cutoffDay: 1, deliveryDay: 3 }, // Lundi→Mercredi
    { cutoffDay: 3, deliveryDay: 5 }, // Mercredi→Vendredi
  ],
};

export const DOMAFRAIS_BOF_CONFIG: SupplierConfig = {
  id: 'domafrais_bof',
  name: 'Domafrais B.O.F',
  deliveryDay: 3,
  cutoffDay: 1,
  cutoffTime: '10:00',
  deliveryRules: [
    { cutoffDay: 1, deliveryDay: 3 }, // Lundi→Mercredi
    { cutoffDay: 3, deliveryDay: 5 }, // Mercredi→Vendredi
  ],
};

export const DOMAFRAIS_SURGELE_CONFIG: SupplierConfig = {
  id: 'domafrais_surgele',
  name: 'Domafrais Surgelé',
  deliveryDay: 3,   // Mercredi
  cutoffDay: 2,     // Mardi
  cutoffTime: '10:00'
};


export const POMONA_TERRE_AZUR_CONFIG: SupplierConfig = {
  id: 'pomona_terre_azur',
  name: 'Pomona Terre Azur',
  deliveryDay: 1,
  cutoffDay: 5,
  cutoffTime: '10:00',
  flexibleDelivery: true,
};

export const POMONA_EPISAVEURS_CONFIG: SupplierConfig = {
  id: 'pomona_episaveurs',
  name: 'Pomona Episaveurs',
  deliveryDay: 5,    // Vendredi
  cutoffDay: 2,      // Mardi avant 10h
  cutoffTime: '10:00',
  deliveryRules: [
    { cutoffDay: 2, deliveryDay: 5 }, // Mardi→Vendredi
  ],
};

export const DOQUET_PRODUCTS: ProductWithHistory[] = [
  { id: '1', supplierId: 'doquet', name: 'coca cola vc', searchName: 'Coca cola 33cl vc', packaging: 24, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: '2', supplierId: 'doquet', name: 'coca cherry vc', searchName: 'Coca Cola Cherry 33cl vc', packaging: 24, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: '3', supplierId: 'doquet', name: 'coca zero vc', searchName: 'Coca cola zero 33cl vc', packaging: 24, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: '4', supplierId: 'doquet', name: 'oasis vc', searchName: 'Oasis Tropical 25cl vc', packaging: 24, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: '5', supplierId: 'doquet', name: 'Vittel 100cl vc', searchName: 'Vittel 100cl vc', packaging: 12, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: '6', supplierId: 'doquet', name: 'vittel 50cl vc', searchName: 'Vittel 50cl vc', packaging: 24, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: '7', supplierId: 'doquet', name: 'perrier fine bulle 1l', searchName: 'Perrier fines bulles 100c', packaging: 12, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: '8', supplierId: 'doquet', name: 'perrier fine bulle 50cl', searchName: 'Perrier fines bulles 50cl', packaging: 24, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: '9', supplierId: 'doquet', name: 'san pellegrino 1l', searchName: 'San pellegrino 100cl vc', packaging: 12, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: '10', supplierId: 'doquet', name: 'san pellegrino 50cl', searchName: 'San pellegrino 50cl vc', packaging: 24, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: '11', supplierId: 'doquet', name: 'fût bière 1664 20l', searchName: 'Bière 1664 blonde 5°5 fût', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: '12', supplierId: 'doquet', name: 'Biere grimbergen blonde', searchName: 'Biere grimbergen blonde', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: '13', supplierId: 'doquet', name: 'Bière blanche fût', searchName: 'Bière 1664 blanche fût Kl', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: '14', supplierId: 'doquet', name: 'perrier 33cl', searchName: 'Perrier 33 cl VC', packaging: 24, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: '15', supplierId: 'doquet', name: 'orangina vc', searchName: 'Orangina 25cl vc', packaging: 24, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: '16', supplierId: 'doquet', name: 'fanta vc', searchName: 'Fanta orange VC bouteil', packaging: 24, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: '17', supplierId: 'doquet', name: 'sprite vc', searchName: 'Sprite VC bouteille 25 cl', packaging: 24, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: '18', supplierId: 'doquet', name: 'schweppes vc', searchName: 'Schweppes indian tonic', packaging: 24, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: '19', supplierId: 'doquet', name: 'fuze tea pêche vc', searchName: 'Fuzetea Pêche 25cl', packaging: 24, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: '20', supplierId: 'doquet', name: 'fuze tea citron vc', searchName: 'Fuze tea the vert citron v', packaging: 24, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: '21', supplierId: 'doquet', name: 'vittel 33 cl fruité', searchName: 'Vittel fruité fraise framb', packaging: 24, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: '22', supplierId: 'doquet', name: 'vittel 25 cl', searchName: 'Vittel 25cl vc', packaging: 24, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: '23', supplierId: 'doquet', name: 'purée de passion', searchName: 'Purée de fruits de la pas', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: '24', supplierId: 'doquet', name: 'purée de coco', searchName: 'Purée de coco 1L Teissei', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: '25', supplierId: 'doquet', name: 'purée de framboise', searchName: 'Purée de Framboise Teis', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: '26', supplierId: 'doquet', name: 'Sirop de noisette', searchName: 'Sirop noisette 70cl Teiss', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: '27', supplierId: 'doquet', name: 'Sirop de framboise', searchName: 'Sirop framboise 100cl', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: '28', supplierId: 'doquet', name: 'sirop grenadine', searchName: 'Sirop grenadine 100cl', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: '29', supplierId: 'doquet', name: 'sirop fraise', searchName: 'Sirop fraise 100cl', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: '30', supplierId: 'doquet', name: 'sirop pêche', searchName: 'Sirop peche 100cl', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: '31', supplierId: 'doquet', name: 'sirop orgeat', searchName: 'Sirop orgeat 100cl', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: '32', supplierId: 'doquet', name: 'sirop thé vert', searchName: 'Sirop de thé vert 70cl', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: '33', supplierId: 'doquet', name: 'sirop citron', searchName: 'Sirop citron 100cl', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: '34', supplierId: 'doquet', name: 'sirop menthe', searchName: 'Sirop menthe 100cl', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: '35', supplierId: 'doquet', name: 'sirop de sucre de canne', searchName: 'Sirop sucre canne 100cl', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: '36', supplierId: 'doquet', name: 'jus d\'orange 25cl', searchName: 'Nectar orange Granini V', packaging: 24, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: '37', supplierId: 'doquet', name: 'jus pomme 25cl', searchName: 'Jus pomme Granini VP b', packaging: 24, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: '38', supplierId: 'doquet', name: 'jus d\'ananas 25cl', searchName: 'Nectar ananas VP Granin', packaging: 24, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: '39', supplierId: 'doquet', name: 'jus de tomate 25cl', searchName: 'Jus tomate Granini VP b', packaging: 24, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: '40', supplierId: 'doquet', name: 'jus d\'abricot 25cl', searchName: 'Nectar abricot Granini V', packaging: 24, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: '41', supplierId: 'doquet', name: 'Jus d\'ananas 1l', searchName: 'Nectar ananas bouteille', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: '42', supplierId: 'doquet', name: 'Jus de pomme 1l', searchName: 'Jus pomme 100cl PET', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: '43', supplierId: 'doquet', name: 'Jus de fraise 1l', searchName: 'Boisson fraise 100CL PET', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: '44', supplierId: 'doquet', name: 'Jus orange', searchName: 'Jus orange nectar 100cl', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: '45', supplierId: 'doquet', name: 'jus de cranberry 1l', searchName: 'Boisson aux cranberry PE', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: '46', supplierId: 'doquet', name: 'perrier pet 1l', searchName: 'Perrier 100cl PET', packaging: 12, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: '47', supplierId: 'doquet', name: 'limonade', searchName: 'Limonade bouteille 100', packaging: 12, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: '48', supplierId: 'doquet', name: 'Bière SS alcool 1664', searchName: 'Bière 1664 blonde sans', packaging: 24, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: '49', supplierId: 'doquet', name: 'ipa st austell', searchName: 'Bière saint austell prop', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: '50', supplierId: 'doquet', name: 'grim rouge', searchName: 'Bière Grimbergen rouge', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: '51', supplierId: 'doquet', name: 'grim blanche', searchName: 'Bière Grimbergen Blanch', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: '52', supplierId: 'doquet', name: 'grim ambrée', searchName: 'Bière Grimbergen ambré', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 }
];

export const VINS_PRODUCTS: ProductWithHistory[] = [
  { id: 'v1', supplierId: 'vins', name: 'apérol 1l', searchName: 'Aperol 1L', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'v2', supplierId: 'vins', name: 'bailey 70cl', searchName: 'Baileys 70cl', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'v3', supplierId: 'vins', name: 'armagnac 70cl', searchName: 'Armagnac 70cl', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'v4', supplierId: 'vins', name: 'calvados 70cl', searchName: 'Calvados 70cl', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'v5', supplierId: 'vins', name: 'campari 1l', searchName: 'Campari 1L', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'v6', supplierId: 'vins', name: 'cognac 70cl', searchName: 'Cognac 70cl', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'v7', supplierId: 'vins', name: 'crème de cassis 1l', searchName: 'Creme Cassis 1L', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'v8', supplierId: 'vins', name: 'crème de framboise 1l', searchName: 'Creme Framboise 1L', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'v9', supplierId: 'vins', name: 'crème de mûre 1l', searchName: 'Creme Mure 1L', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'v10', supplierId: 'vins', name: 'crème de pêche 1l', searchName: 'Creme Peche 1L', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'v11', supplierId: 'vins', name: 'gin bombay 70cl', searchName: 'Gin Bombay 70cl', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'v12', supplierId: 'vins', name: 'liqueur st germain 70cl', searchName: 'St Germain 70cl', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'v13', supplierId: 'vins', name: 'Martini bianco 1l', searchName: 'Martini Blanc 1L', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'v14', supplierId: 'vins', name: 'martini dry 1l', searchName: 'Martini Dry 1L', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'v15', supplierId: 'vins', name: 'martini rose 1l', searchName: 'Martini Rose 1L', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'v16', supplierId: 'vins', name: 'martini rouge 1l', searchName: 'Martini Rouge 1L', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'v17', supplierId: 'vins', name: 'picon bière 1l', searchName: 'Picon Biere 1L', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'v18', supplierId: 'vins', name: 'get 27 1l', searchName: 'Get 27 1L', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'v19', supplierId: 'vins', name: 'get menthe citron', searchName: 'Get Menthe Citron', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'v20', supplierId: 'vins', name: 'eau de vie poire 70cl', searchName: 'Poire Williams 70cl', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'v21', supplierId: 'vins', name: 'martini prosecco 75cl', searchName: 'Prosecco Martini 75cl', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'v22', supplierId: 'vins', name: 'rhum carta oro 70cl', searchName: 'Bacardi Oro 70cl', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'v23', supplierId: 'vins', name: 'ricard 1l', searchName: 'Ricard 1L', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'v24', supplierId: 'vins', name: 'vodka 70cl', searchName: 'Vodka Eristoff 70cl', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'v25', supplierId: 'vins', name: 'whiskey jack daniel\'s 70cl', searchName: 'Jack Daniels 70cl', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'v26', supplierId: 'vins', name: 'whiskey lawson 70cl', searchName: 'William Lawson 70cl', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'v27', supplierId: 'vins', name: 'whiskey bushmills 70cl', searchName: 'Bushmills 70cl', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'v28', supplierId: 'vins', name: 'pulco citron vert 70cl', searchName: 'Pulco Citron Vert 70cl', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'v29', supplierId: 'vins', name: 'martini floréale 75cl', searchName: 'Martini Floreale 75cl', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'v30', supplierId: 'vins', name: 'martini vibrante 75cl', searchName: 'Martini Vibrante 75cl', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'v31', supplierId: 'vins', name: 'Beaujolais hippo 75cl', searchName: 'Beaujolais Hippo 75cl', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'v32', supplierId: 'vins', name: 'Brouilly 37,5cl', searchName: 'Brouilly 37.5cl', packaging: 12, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'v33', supplierId: 'vins', name: 'Brouilly 75cl', searchName: 'Brouilly 75cl', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'v34', supplierId: 'vins', name: 'pinot noir rouge 75cl', searchName: 'Pinot Noir 75cl', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'v35', supplierId: 'vins', name: 'Haut segur 50cl', searchName: 'Haut Segur 50cl', packaging: 12, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'v36', supplierId: 'vins', name: 'haut segur 75cl', searchName: 'Haut Segur 75cl', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'v37', supplierId: 'vins', name: 'cote du rhone rge 75cl', searchName: 'Cotes Rhone Rouge 75cl', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'v38', supplierId: 'vins', name: 'Punta malbec 75cl', searchName: 'Punta Malbec 75cl', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'v39', supplierId: 'vins', name: 'Chinon rouge 37,5cl', searchName: 'Chinon Rouge 37.5cl', packaging: 12, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'v40', supplierId: 'vins', name: 'chinon rouge 75cl', searchName: 'Chinon Rouge 75cl', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'v41', supplierId: 'vins', name: 'pic st loup', searchName: 'Pic Saint Loup 75cl', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'v42', supplierId: 'vins', name: 'crozes hermitage', searchName: 'Crozes Hermitage 75cl', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'v43', supplierId: 'vins', name: 'haut-médoc 75cl', searchName: 'Haut Medoc 75cl', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'v44', supplierId: 'vins', name: 'saumur hippo 75cl', searchName: 'Saumur Hippo 75cl', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'v45', supplierId: 'vins', name: 'bourgogne blanc 75cl', searchName: 'Bourgogne Blanc 75cl', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'v46', supplierId: 'vins', name: 'montbazillac 75cl', searchName: 'Montbazillac 75cl', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'v47', supplierId: 'vins', name: 'fumée blanche 75cl', searchName: 'Fumee Blanche 75cl', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'v48', supplierId: 'vins', name: 'castellum 75cl', searchName: 'Castellum 75cl', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'v49', supplierId: 'vins', name: 'mediterranée hippo 75cl', searchName: 'Mediterranee Hippo 75cl', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'v50', supplierId: 'vins', name: 'côte de provence', searchName: 'Cotes Provence 75cl', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'v51', supplierId: 'vins', name: 'gris blanc 75cl', searchName: 'Gris Blanc 75cl', packaging: 6, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'v52', supplierId: 'vins', name: 'cabernet sauvignon 10l', searchName: 'Cabernet Sauvignon 10L', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'v53', supplierId: 'vins', name: 'pays du gard 10l', searchName: 'Pays du Gard 10L', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'v54', supplierId: 'vins', name: 'chardonnay 10l', searchName: 'Chardonnay 10L', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 }
];

export const VIANDES_PRODUCTS: ProductWithHistory[] = [
  { id: 'm1', supplierId: 'viandes', name: 'Surprise 180G', searchName: 'Surprise 180G', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'm2', supplierId: 'viandes', name: 'Chateaubriand 180G', searchName: 'Chateaubriand 180G', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'm3', supplierId: 'viandes', name: 'Entrecote 250G', searchName: 'Entrecote 250G', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'm4', supplierId: 'viandes', name: 'Entrecote 330G', searchName: 'Entrecote 330G', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'm5', supplierId: 'viandes', name: 'Cote De Bœuf 400G', searchName: 'Cote De Boeuf 400G', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'm6', supplierId: 'viandes', name: 'Steak Mariné 180G', searchName: 'Steak Marine 180G', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'm7', supplierId: 'viandes', name: 'Steak Haché 100G', searchName: 'Steak Hache 100G', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'm8', supplierId: 'viandes', name: 'Steak Haché 140G', searchName: 'Steak Hache 140G', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'm9', supplierId: 'viandes', name: 'Steak Haché 210G', searchName: 'Steak Hache 210G', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'm10', supplierId: 'viandes', name: 'Tartare 180G', searchName: 'Tartare 180G', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 }
];

export const DOMAFRAIS_PRODUCTS: ProductWithHistory[] = [
  { id: 'd1', supplierId: 'domafrais', name: 'Andouillette', searchName: 'Andouillette', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'd2', supplierId: 'domafrais', name: 'Bavette 160G', searchName: 'Bavette 160G', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'd3', supplierId: 'domafrais', name: 'Côte De Porc 350G', searchName: 'Cote De Porc 350G', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'd4', supplierId: 'domafrais', name: 'T-Bone 400G', searchName: 'T-Bone 400G', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'd5', supplierId: 'domafrais', name: 'Faux Filet 200G', searchName: 'Faux Filet 200G', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'd6', supplierId: 'domafrais', name: 'Onglet 200G', searchName: 'Onglet 200G', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 }
];

export const DOMAFRAIS_BOF_PRODUCTS: ProductWithHistory[] = [
  { id: 'db1', supplierId: 'domafrais_bof', name: 'Base Sauce Hippo', searchName: 'Base Sauce Hippo', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'db2', supplierId: 'domafrais_bof', name: 'Beurre Doux Plaquette', searchName: 'Beurre Doux Plaquette', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'db3', supplierId: 'domafrais_bof', name: "Blanc D'Œuf Liquide", searchName: "Blanc D'Œuf Liquide", packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'db4', supplierId: 'domafrais_bof', name: 'Camembert', searchName: 'Camembert', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'db5', supplierId: 'domafrais_bof', name: 'Chèvre Long', searchName: 'Chèvre Long', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'db6', supplierId: 'domafrais_bof', name: 'Comté Rapé', searchName: 'Comté Rapé', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'db7', supplierId: 'domafrais_bof', name: 'Crème Anglaise', searchName: 'Crème Anglaise', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'db8', supplierId: 'domafrais_bof', name: 'Crème Fraiche', searchName: 'Crème Fraiche', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'db9', supplierId: 'domafrais_bof', name: 'Crème Liquide', searchName: 'Crème Liquide', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'db10', supplierId: 'domafrais_bof', name: 'Crème Fouetté', searchName: 'Crème Fouetté', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'db11', supplierId: 'domafrais_bof', name: 'Emmental Rapée', searchName: 'Emmental Rapée', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'db12', supplierId: 'domafrais_bof', name: 'Gratin Dauphinois', searchName: 'Gratin Dauphinois', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'db13', supplierId: 'domafrais_bof', name: "Jaune D'Œuf Liquide", searchName: "Jaune D'Œuf Liquide", packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'db14', supplierId: 'domafrais_bof', name: 'Lait', searchName: 'Lait', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'db15', supplierId: 'domafrais_bof', name: 'Mayonnaise', searchName: 'Mayonnaise', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'db16', supplierId: 'domafrais_bof', name: 'Mélange 3 Fromages Rapés', searchName: 'Mélange 3 Fromages Rapés', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'db17', supplierId: 'domafrais_bof', name: 'Œuf Frais', searchName: 'Œuf Frais', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'db18', supplierId: 'domafrais_bof', name: 'Œuf Poché', searchName: 'Œuf Poché', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'db19', supplierId: 'domafrais_bof', name: 'Parmesan Bloc', searchName: 'Parmesan Bloc', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'db20', supplierId: 'domafrais_bof', name: 'Préparation Tiramisu', searchName: 'Préparation Tiramisu', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'db21', supplierId: 'domafrais_bof', name: 'Raclette Fumée', searchName: 'Raclette Fumée', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'db22', supplierId: 'domafrais_bof', name: 'Roquefort', searchName: 'Roquefort', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'db23', supplierId: 'domafrais_bof', name: 'Rosette', searchName: 'Rosette', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'db24', supplierId: 'domafrais_bof', name: 'Sauce Cesar', searchName: 'Sauce Cesar', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'db25', supplierId: 'domafrais_bof', name: 'Sauce Cheddar', searchName: 'Sauce Cheddar', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'db26', supplierId: 'domafrais_bof', name: 'Sauce St Nectaire', searchName: 'Sauce St Nectaire', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'db27', supplierId: 'domafrais_bof', name: 'Bresaola', searchName: 'Bresaola', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'db28', supplierId: 'domafrais_bof', name: 'Chiffonnade De Jambon', searchName: 'Chiffonnade De Jambon', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'db29', supplierId: 'domafrais_bof', name: 'Cube De Chorizo', searchName: 'Cube De Chorizo', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'db30', supplierId: 'domafrais_bof', name: 'Salade Jeune Pousse', searchName: 'Salade Jeune Pousse', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'db31', supplierId: 'domafrais_bof', name: 'Sauce Bolognaise', searchName: 'Sauce Bolognaise', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'db32', supplierId: 'domafrais_bof', name: 'Terrine Campagne', searchName: 'Terrine Campagne', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 }
];

export const DOMAFRAIS_SURGELE_PRODUCTS: ProductWithHistory[] = [
  { id: 'ds1', supplierId: 'domafrais_surgele', name: 'Aiguillette De Poulet', searchName: 'Aiguillette De Poulet', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'ds2', supplierId: 'domafrais_surgele', name: 'Ail Cube', searchName: 'Ail Cube', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'ds3', supplierId: 'domafrais_surgele', name: 'Ananas Morceaux', searchName: 'Ananas Morceaux', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'ds4', supplierId: 'domafrais_surgele', name: 'Batonnêt De Chèvre', searchName: 'Batonnêt De Chèvre', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'ds5', supplierId: 'domafrais_surgele', name: 'Cabillaud Cube Morue', searchName: 'Cabillaud Cube Morue', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'ds6', supplierId: 'domafrais_surgele', name: 'Foie Gras', searchName: 'Foie Gras', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'ds7', supplierId: 'domafrais_surgele', name: 'Brioche Perdue', searchName: 'Brioche Perdue', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'ds8', supplierId: 'domafrais_surgele', name: "Bun'S Brioché", searchName: "Bun'S Brioché", packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'ds9', supplierId: 'domafrais_surgele', name: "Bun'S Encre Seiche", searchName: "Bun'S Encre Seiche", packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'ds10', supplierId: 'domafrais_surgele', name: 'Calamars', searchName: 'Calamars', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'ds11', supplierId: 'domafrais_surgele', name: 'Camembert Snacks', searchName: 'Camembert Snacks', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'ds12', supplierId: 'domafrais_surgele', name: 'Carpaccio', searchName: 'Carpaccio', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'ds13', supplierId: 'domafrais_surgele', name: 'Cerfeuil', searchName: 'Cerfeuil', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'ds14', supplierId: 'domafrais_surgele', name: 'Cheddar Stick', searchName: 'Cheddar Stick', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'ds15', supplierId: 'domafrais_surgele', name: 'Chips', searchName: 'Chips', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'ds16', supplierId: 'domafrais_surgele', name: 'Chou Profiterole', searchName: 'Chou Profiterole', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'ds17', supplierId: 'domafrais_surgele', name: 'Bacon Tranche', searchName: 'Bacon Tranche', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'ds18', supplierId: 'domafrais_surgele', name: 'Croquette Jambon', searchName: 'Croquette Jambon', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'ds19', supplierId: 'domafrais_surgele', name: 'Echalotte Coupée', searchName: 'Echalotte Coupée', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'ds20', supplierId: 'domafrais_surgele', name: 'Épinard', searchName: 'Épinard', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'ds21', supplierId: 'domafrais_surgele', name: 'Fish Adulte', searchName: 'Fish Adulte', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'ds22', supplierId: 'domafrais_surgele', name: 'Fish Enfant', searchName: 'Fish Enfant', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'ds23', supplierId: 'domafrais_surgele', name: 'Focaccia', searchName: 'Focaccia', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'ds24', supplierId: 'domafrais_surgele', name: 'Frites', searchName: 'Frites', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'ds25', supplierId: 'domafrais_surgele', name: 'Haché Végétal', searchName: 'Haché Végétal', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'ds26', supplierId: 'domafrais_surgele', name: 'Haricots Verts', searchName: 'Haricots Verts', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'ds27', supplierId: 'domafrais_surgele', name: 'Magret De Canard', searchName: 'Magret De Canard', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'ds28', supplierId: 'domafrais_surgele', name: 'Chimichurri', searchName: 'Chimichurri', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'ds29', supplierId: 'domafrais_surgele', name: 'Mangue Cube', searchName: 'Mangue Cube', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'ds30', supplierId: 'domafrais_surgele', name: 'Mi Cuit', searchName: 'Mi Cuit', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'ds31', supplierId: 'domafrais_surgele', name: 'Nuggets', searchName: 'Nuggets', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'ds32', supplierId: 'domafrais_surgele', name: 'Manchons Poulet', searchName: 'Manchons Poulet', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'ds33', supplierId: 'domafrais_surgele', name: 'Poivron Rouge Entier', searchName: 'Poivron Rouge Entier', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'ds34', supplierId: 'domafrais_surgele', name: 'Pomme De Terre Rosti', searchName: 'Pomme De Terre Rosti', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'ds35', supplierId: 'domafrais_surgele', name: 'Purée', searchName: 'Purée', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'ds36', supplierId: 'domafrais_surgele', name: 'Onions Rings', searchName: 'Onions Rings', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'ds37', supplierId: 'domafrais_surgele', name: 'Pain', searchName: 'Pain', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'ds38', supplierId: 'domafrais_surgele', name: 'Emmental Stick', searchName: 'Emmental Stick', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'ds39', supplierId: 'domafrais_surgele', name: 'Pain Tranché', searchName: 'Pain Tranché', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'ds40', supplierId: 'domafrais_surgele', name: 'Pancake', searchName: 'Pancake', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'ds41', supplierId: 'domafrais_surgele', name: 'Persil', searchName: 'Persil', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'ds42', supplierId: 'domafrais_surgele', name: 'Pomme De Terre Rôtie', searchName: 'Pomme De Terre Rôtie', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'ds43', supplierId: 'domafrais_surgele', name: 'Pomme Segment', searchName: 'Pomme Segment', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'ds44', supplierId: 'domafrais_surgele', name: 'Tenders De Poulet', searchName: 'Tenders De Poulet', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'ds45', supplierId: 'domafrais_surgele', name: 'Poulet Entier', searchName: 'Poulet Entier', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'ds46', supplierId: 'domafrais_surgele', name: 'Ravioles Dauphines', searchName: 'Ravioles Dauphines', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'ds47', supplierId: 'domafrais_surgele', name: 'Ravioles Épinards', searchName: 'Ravioles Épinards', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'ds48', supplierId: 'domafrais_surgele', name: 'Réduction Béarnaise', searchName: 'Réduction Béarnaise', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'ds49', supplierId: 'domafrais_surgele', name: 'Ribbs', searchName: 'Ribbs', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'ds50', supplierId: 'domafrais_surgele', name: 'Pavé De Saumon', searchName: 'Pavé De Saumon', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'ds51', supplierId: 'domafrais_surgele', name: 'Wings Poulet', searchName: 'Wings Poulet', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'ds52', supplierId: 'domafrais_surgele', name: 'Glace Vanille', searchName: 'Glace Vanille', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'ds53', supplierId: 'domafrais_surgele', name: 'Glace Café', searchName: 'Glace Café', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'ds54', supplierId: 'domafrais_surgele', name: 'Glace Caramel', searchName: 'Glace Caramel', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'ds55', supplierId: 'domafrais_surgele', name: 'Glace Chocolat', searchName: 'Glace Chocolat', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'ds56', supplierId: 'domafrais_surgele', name: 'Glace Chocolat/Noisette', searchName: 'Glace Chocolat/Noisette', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'ds57', supplierId: 'domafrais_surgele', name: 'Glace Noix De Coco', searchName: 'Glace Noix De Coco', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'ds58', supplierId: 'domafrais_surgele', name: 'Glace Rocket', searchName: 'Glace Rocket', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'ds59', supplierId: 'domafrais_surgele', name: 'Glace Citron Vert', searchName: 'Glace Citron Vert', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'ds60', supplierId: 'domafrais_surgele', name: 'Glace Fraise', searchName: 'Glace Fraise', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'ds61', supplierId: 'domafrais_surgele', name: 'Glace Framboise', searchName: 'Glace Framboise', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'ds62', supplierId: 'domafrais_surgele', name: 'Glace Passion', searchName: 'Glace Passion', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 }
];


export const POMONA_TERRE_AZUR_PRODUCTS: ProductWithHistory[] = [
  { id: 'pta1', supplierId: 'pomona_terre_azur', name: 'Banane', searchName: 'Banane cat 1', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pta2', supplierId: 'pomona_terre_azur', name: 'Champignons', searchName: 'Champignon paris gros', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pta3', supplierId: 'pomona_terre_azur', name: 'Ciboulette', searchName: 'Ciboulette fraiche', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pta4', supplierId: 'pomona_terre_azur', name: 'Citron Jaune', searchName: 'Citron jaune moyen', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pta5', supplierId: 'pomona_terre_azur', name: 'Citron Vert', searchName: 'Citron vert', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pta6', supplierId: 'pomona_terre_azur', name: 'Cœur Romaine', searchName: 'Coeur de romaine Salade', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pta7', supplierId: 'pomona_terre_azur', name: 'Coriandre', searchName: 'Coriandre botte', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pta8', supplierId: 'pomona_terre_azur', name: 'Echalote', searchName: 'Echalote cuisse poulet', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pta9', supplierId: 'pomona_terre_azur', name: 'Menthe', searchName: 'Menthe fraiche', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pta10', supplierId: 'pomona_terre_azur', name: 'Oignon Jaune', searchName: 'Oignon jaune', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pta11', supplierId: 'pomona_terre_azur', name: 'Oignon Rouge', searchName: 'Oignon rouge', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pta12', supplierId: 'pomona_terre_azur', name: 'Persil Plat', searchName: 'Persil plat', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pta13', supplierId: 'pomona_terre_azur', name: 'Pomme De Terre Four', searchName: 'Pomme de terre au four colis 12.5 Kg', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
];

export const POMONA_EPISAVEURS_PRODUCTS: ProductWithHistory[] = [
  { id: 'pe1', supplierId: 'pomona_episaveurs', name: 'ail fumée', searchName: 'Ail saveur fumée boîte 300 G DUCROS', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pe2', supplierId: 'pomona_episaveurs', name: 'ananas déshydrater', searchName: 'Tranches fruits déshydratés Ananas boîte 120 pieces -p', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pe3', supplierId: 'pomona_episaveurs', name: 'citron déshydrater', searchName: 'Tranches fruits déshydratés Citron Jaune paquet 192 pieces -p', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pe4', supplierId: 'pomona_episaveurs', name: 'orange déshydrater', searchName: 'Tranches fruits déshydratés Orange paquet 130 pcs -p', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pe5', supplierId: 'pomona_episaveurs', name: 'pomme déshydrater', searchName: 'Tranches fruits déshydratés Pomme paquet 130 pcs -p', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pe6', supplierId: 'pomona_episaveurs', name: 'amande', searchName: 'Amandes effilées scht 1kg', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pe7', supplierId: 'pomona_episaveurs', name: 'aide à rôtir', searchName: 'Assaisonnement aide a rotir pâte 1 kg Hippo', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pe8', supplierId: 'pomona_episaveurs', name: 'biscuits cuillères', searchName: 'Biscuits cuillers aux oeufs spécial restaurants colis de 1,6kg / 192 pieces', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pe9', supplierId: 'pomona_episaveurs', name: 'brochettes bonbons', searchName: 'Brochette guimauve 30g Hippo', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pe10', supplierId: 'pomona_episaveurs', name: 'câpres', searchName: 'Capres fines 4/4 480G PNE', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pe11', supplierId: 'pomona_episaveurs', name: 'caramel beurre salé', searchName: 'Sauce caramel au beurre salé', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pe12', supplierId: 'pomona_episaveurs', name: 'yellow mustard', searchName: 'Classic Yellow Mustard 2.98 kg Hippo', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pe13', supplierId: 'pomona_episaveurs', name: 'compote gourde', searchName: 'Compote gourde pommes ss 90 G Materne Hippo', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pe14', supplierId: 'pomona_episaveurs', name: 'cornichons', searchName: 'Cornichons fins 80/119 net', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pe15', supplierId: 'pomona_episaveurs', name: 'chocolat couverture', searchName: 'Couverture chocolat L60/40 seau 10 Kg mi amère Hippo Leon -p', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pe16', supplierId: 'pomona_episaveurs', name: 'crème brulée', searchName: 'Préparation boisson lactée chocolat poudre 1KG', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pe17', supplierId: 'pomona_episaveurs', name: 'brisure galette', searchName: 'Eclats brisures galettes St Michel', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pe18', supplierId: 'pomona_episaveurs', name: 'oignon crispy', searchName: 'Crispy bacon tranche entière kg Hippo (surg) -p', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pe19', supplierId: 'pomona_episaveurs', name: 'fleur de sel', searchName: 'Fleur de sel de Camargue Kg', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pe20', supplierId: 'pomona_episaveurs', name: 'huile amphora', searchName: 'Huile friture -p', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pe21', supplierId: 'pomona_episaveurs', name: 'huile olive', searchName: 'Huile Line colza et olive vierge extra L AMPHORA', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pe22', supplierId: 'pomona_episaveurs', name: 'jus de poulet', searchName: 'Jus de poulet Pate Chef 640 G', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pe23', supplierId: 'pomona_episaveurs', name: 'ketchup bidon', searchName: 'Ketchup bidon (5.7 kg) heinz', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pe24', supplierId: 'pomona_episaveurs', name: 'ketchup flacon', searchName: 'Ketchup flacon souple 342g Heinz Hippo', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pe25', supplierId: 'pomona_episaveurs', name: 'maizena', searchName: 'Maizena 700g', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pe26', supplierId: 'pomona_episaveurs', name: 'meringue drop', searchName: 'Meringue ronde 14 gr diamètre 7.5cm Hippo', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pe27', supplierId: 'pomona_episaveurs', name: 'miel', searchName: 'Miel mille fleur 1kg', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pe28', supplierId: 'pomona_episaveurs', name: 'crème patissière', searchName: 'Mix poudre crème pâtissière sachet 3 Kg -p', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pe29', supplierId: 'pomona_episaveurs', name: "moutarde à l'ancienne", searchName: 'Moutarde ancienne', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pe30', supplierId: 'pomona_episaveurs', name: 'moutarde dijon', searchName: 'Moutarde dijon', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pe31', supplierId: 'pomona_episaveurs', name: 'roux blanc', searchName: 'Roux blanc 1kg/12.5l', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pe32', supplierId: 'pomona_episaveurs', name: 'noisette entière', searchName: 'Noisette entiere emondee sacht 1kg', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pe33', supplierId: 'pomona_episaveurs', name: 'noix de coco râpée', searchName: 'Noix coco rape scht 1kg', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pe34', supplierId: 'pomona_episaveurs', name: 'paprika', searchName: 'Paprika fumé 230 grs', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pe35', supplierId: 'pomona_episaveurs', name: 'ail noir', searchName: "Assaisonnement à l'ail noir en pâte pot CHEF Hippo", packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pe36', supplierId: 'pomona_episaveurs', name: 'pâte à tartiner', searchName: 'Nocciolata 830 G Hippo', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pe37', supplierId: 'pomona_episaveurs', name: 'piment fort moulu', searchName: 'Piment espelette 250g AOP Hippo', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pe38', supplierId: 'pomona_episaveurs', name: 'pistache', searchName: 'Eclat de pistache', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pe39', supplierId: 'pomona_episaveurs', name: 'poivre gris noir', searchName: 'Poivre noir grain 1kg', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pe40', supplierId: 'pomona_episaveurs', name: 'poivre mignonette', searchName: 'Poivre noir mignonnette Hippo', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pe41', supplierId: 'pomona_episaveurs', name: 'poivre vert', searchName: 'Poivre vert en saumure', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pe42', supplierId: 'pomona_episaveurs', name: 'riz blanc', searchName: 'Riz long basmati sac 5 Kg', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pe43', supplierId: 'pomona_episaveurs', name: 'sauce anglaise', searchName: 'Sauce anglaise Worcesteer 150ml', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pe44', supplierId: 'pomona_episaveurs', name: 'sauce barbecue', searchName: 'Sauce barbecue squeeze 1lou 1kg Hippo -p', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pe45', supplierId: 'pomona_episaveurs', name: 'sauce béchamel', searchName: 'Sauce béchamel brique 1 L KNORR', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pe46', supplierId: 'pomona_episaveurs', name: 'sauce cocktail', searchName: 'Sauce cocktail seau 2.65 Kg Hippo -p', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pe47', supplierId: 'pomona_episaveurs', name: 'gros sel', searchName: 'Sel gros pqt 1kg', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pe48', supplierId: 'pomona_episaveurs', name: 'sel fin', searchName: 'Sel fin', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pe49', supplierId: 'pomona_episaveurs', name: 'cornichon pickle', searchName: 'Sliced pickles bidon 3,76kg PSE', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pe50', supplierId: 'pomona_episaveurs', name: 'sucre cassonade', searchName: 'Sucre cassonade', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pe51', supplierId: 'pomona_episaveurs', name: 'sucre en poudre', searchName: 'Sucre semoule poudre', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pe52', supplierId: 'pomona_episaveurs', name: 'sucre glace', searchName: 'Sucre glace', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pe53', supplierId: 'pomona_episaveurs', name: 'tabasco', searchName: 'Tabasco rouge 60ml', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pe54', supplierId: 'pomona_episaveurs', name: 'vinaigre blanc', searchName: 'Vinaigre alcool blanc 1.5l', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
  { id: 'pe55', supplierId: 'pomona_episaveurs', name: 'vinaigrette balsamique', searchName: 'Vinaigrette Balsamique 850g Hippo -p', packaging: 1, defaultMargin: 0, salesHistory: {}, targetStock: 0 },
];
