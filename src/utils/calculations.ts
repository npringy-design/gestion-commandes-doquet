// =============================================================
// utils/calculations.ts
// Fonctions de calcul métier (commandes, stocks, ratios)
// Extraites de App.tsx — aucune dépendance React
// =============================================================

import { Calculations } from '../types';

// -----------------------------------------------------------
// Normalise un nombre : retourne 0 si la valeur est vide/NaN
// -----------------------------------------------------------
export const toNumber = (val: number | string | undefined): number => {
  if (val === '' || val === undefined || val === null) return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
};

// -----------------------------------------------------------
// Calcul mode MARGE DE SÉCURITÉ
// Calcule combien de colis commander en tenant compte d'une
// marge de sécurité (%) et du conditionnement.
// -----------------------------------------------------------
export const calculateOrder = (
  theoNeed: number,
  upcoming: number,
  stock: number,
  margin: number,
  pkg: number | string
): Calculations => {
  const netGap    = Math.max(0, theoNeed - upcoming - stock);
  const withSecu  = Math.ceil(netGap * (1 + margin / 100));
  const pkgVal    = Number(pkg);
  const safePkg   = pkgVal > 0 ? pkgVal : 1;
  const packs     = pkgVal > 0 ? Math.ceil(withSecu / safePkg) : 0;

  return {
    net:           netGap,
    needWithMargin: withSecu,
    realNeed:      packs * safePkg,
    toOrder:       packs,
  };
};

// -----------------------------------------------------------
// Calcul mode STOCK CIBLE
// Calcule combien commander pour atteindre un stock cible,
// en tenant compte de la consommation estimée avant livraison.
// -----------------------------------------------------------
export const calculateTargetOrder = (
  targetStockUnits: number,
  currentStockVal:  number | string | undefined,
  consumption:      number,
  pkg:              number | string
): { projectedStock: number; missing: number; toOrder: number } => {
  if (currentStockVal === '' || currentStockVal === undefined) {
    return { projectedStock: 0, missing: 0, toOrder: 0 };
  }

  const stock    = Number(currentStockVal);
  const pkgVal   = Number(pkg);
  const safePkg  = pkgVal > 0 ? pkgVal : 1;

  const targetCases          = pkgVal > 0 ? Math.ceil(targetStockUnits / safePkg) : 0;
  const remainingAfterConso  = stock - consumption;
  const isCritical           = remainingAfterConso <= 0;

  let rawCases = 0;
  let cap      = targetCases;

  if (isCritical) {
    rawCases = pkgVal > 0 ? Math.ceil((targetStockUnits + consumption) / safePkg) : 0;
    cap      = targetCases + 1;
  } else {
    const need = Math.max(0, targetStockUnits - remainingAfterConso);
    rawCases   = pkgVal > 0 ? Math.ceil(need / safePkg) : 0;
    cap        = targetCases;
  }

  const toOrder        = Math.min(cap, Math.max(0, rawCases));
  const projectedStock = Math.max(0, remainingAfterConso);
  const missing        = Math.max(0, targetStockUnits - projectedStock);

  return { projectedStock, missing, toOrder };
};

// -----------------------------------------------------------
// Met en majuscule la première lettre d'une chaîne
// -----------------------------------------------------------
export const capitalizeFirstLetter = (str: string): string => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
};
