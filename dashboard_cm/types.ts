
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


export type MonthKey = string;
export type PeriodKey = MonthKey | 'Annuel';
export type FollowUpStatus = 'À faire' | 'En cours' | 'Fait';

export interface FollowUpItem {
  id: string;
  name: string;
  type: ProductType;
  sector?: string | null;
  supplier?: string | null;
  status: FollowUpStatus;
  notes?: string;
  createdAt: string;
  period: PeriodKey;
}

export interface DailyRow {
  id: string;
  name: string;
  type: ProductType;
  sector?: string | null;
  supplier?: string | null;
  unitPrice?: number | null;
  stockPrev?: number | null;
  salesPrev?: number | null;
  stockToday?: number | null;
  perso?: number | null;
  loss?: number | null;
}

export interface DailySheet {
  dateKey: string;
  period: PeriodKey;
  rows: DailyRow[];
  createdAt: string;
  updatedAt: string;
}

export interface CostChartPoint {
  month: string;
  actual: number;
  target: number;
}

export interface ProductSeriesPoint {
  month: string;
  euro: number;
  qty: number;
}
