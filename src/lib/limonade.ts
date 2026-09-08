import { SupplierConfig } from '../types';

export const hasLimonadeSupplier = (supplierConfigs: Record<string, SupplierConfig>): boolean =>
  Object.values(supplierConfigs).some(c => c.includeLimonadeForecast);
