
import { MonthlyData, EcartItem, ItemTrend } from './types';

export const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

export const COST_DATA: MonthlyData[] = [
  { month: 'Jan', actual: 26.63, target: 25.00 },
  { month: 'Fév', actual: 26.20, target: 25.00 },
  { month: 'Mar', actual: 26.40, target: 25.00 },
  { month: 'Avr', actual: 28.60, target: 25.00 },
  { month: 'Mai', actual: 26.30, target: 25.00 },
  { month: 'Jun', actual: 27.00, target: 25.00 },
  { month: 'Jul', actual: 26.50, target: 25.00 },
  { month: 'Aoû', actual: 25.80, target: 25.00 },
  { month: 'Sep', actual: 27.60, target: 25.00 },
  { month: 'Oct', actual: 27.20, target: 25.00 },
  { month: 'Nov', actual: 28.10, target: 25.00 },
  { month: 'Déc', actual: 25.90, target: 25.00 },
];

export const LIQUIDE_ECARTS: EcartItem[] = [
  { name: 'Bière 1664 blonde 5°5 fût 20 L KRONENBOURG', quantity: 123, value: 369.81 },
  { name: 'Nectar ananas bouteille 100 cl', quantity: 15.72, value: 34.53 },
  { name: 'Bas Armagnac VSOP Ch Laubade bouteille 70 cl', quantity: 1.3, value: 28.29 },
  { name: 'Boisson jus aux maracuja fruit de la passion 100cl', quantity: 4.24, value: 13.04 },
  { name: 'Sucre buchette 3G HIPPO', quantity: 814, value: 11.23 },
  { name: 'Boisson aux cranberry PET 100CL', quantity: 3.98, value: 10.6 },
  { name: 'La french PAMPLEMOUSSE 100cl', quantity: 4, value: 8.12 },
  { name: 'Prosecco Spumante DOC Martini bouteille 75 cl', quantity: 1.12, value: 7.62 },
  { name: 'Jus pomme Granini VP bouteille 25cl', quantity: 10, value: 7.42 },
  { name: 'Limonade 150 cl pet', quantity: 10.56, value: 7.4 },
];

export const SOLIDE_ECARTS: EcartItem[] = [
  { name: 'Boeuf steak haché rond VBF basse pres', quantity: 18.54, value: 194.62 },
  { name: 'Steak boeuf marine VBF pièce 180 g Hi', quantity: 11.15, value: 156.12 },
  { name: 'Sauce cheddar intense 40% Hippo -p', quantity: 15.76, value: 101.32 },
  { name: 'Entrecote VBF 330 g', quantity: 4.57, value: 85.83 },
  { name: 'Entrecote VBF 250 g', quantity: 4.25, value: 79.86 },
  { name: 'Bavette Aloyau VBF pièce 160 g', quantity: 4.6, value: 78.66 },
  { name: 'Ciboulette fraiche', quantity: 3.16, value: 62.6 },
  { name: 'Camembert snacks +/- 20g pcs Hippo', quantity: 5.04, value: 57.53 },
  { name: 'Pomme de terre au four colis 12.5 Kg', quantity: 41.15, value: 51.42 },
  { name: 'Crème sous pression sucrée chantilly', quantity: 5.62, value: 41.86 },
];

export const NOUGAT_TREND: ItemTrend[] = [
  { month: 'Jan', value: -10 },
  { month: 'Fév', value: -5 },
  { month: 'Mar', value: 25 },
  { month: 'Avr', value: -45 },
  { month: 'Mai', value: 35 },
  { month: 'Jun', value: 85 },
  { month: 'Jul', value: -15 },
  { month: 'Aoû', value: -40 },
  { month: 'Sep', value: -85 },
  { month: 'Oct', value: 5 },
  { month: 'Nov', value: 45 },
  { month: 'Déc', value: 20 },
];
