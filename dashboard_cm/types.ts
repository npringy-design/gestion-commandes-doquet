
export interface MonthlyData {
  month: string;
  actual: number;
  target: number;
}

export type ProductType = 'LIQUIDE' | 'SOLIDE';

export interface EcartItem {
  name: string;
  quantity: number;
  value: number;
  // Prix unitaire (€/unité, €/kg, €/L) si présent dans l'export (colonne "PU")
  unitPrice?: number;
  // Optional stable key used for cross-month analysis
  id?: string;
  sector?: string;
  supplier?: string;
  type?: ProductType;
}

export interface ItemTrend {
  month: string;
  value: number;
}

export interface DashboardStats {
  covers: number;
  margin: number;
  foodCostPercentage: number;
}
