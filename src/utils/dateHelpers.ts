// =============================================================
// utils/dateHelpers.ts
// Fonctions liées aux dates, livraisons et prévisions couverts
// Extraites de App.tsx — aucune dépendance React
// =============================================================

import { SupplierConfig, DeliveryRule } from '../types';
import { DailyCover } from '../data';
import { MONTHS_ORDER } from '../constants';

// Re-export pour que les autres fichiers importent depuis ici
export type { DailyCover };

export type DailyCoversState = Record<string, DailyCover[]>;

// -----------------------------------------------------------
// Calcule les prochaines dates importantes pour un fournisseur
// (cut-off, livraison J, livraison J+1)
// -----------------------------------------------------------
// ─── Calcule la prochaine date de livraison en respectant les cut-offs ──────
// Logique : pour chaque règle cutoff→delivery, on vérifie si le cut-off
// est encore atteignable (aujourd'hui avant cutoffHour, ou jours futurs).
// On prend la livraison la plus proche parmi toutes les règles valides.
//
// Plaine Maison (flexibleDelivery) : livraison = lendemain si avant 10h,
// sinon surlendemain. Exception : lundi = cut-off vendredi avant 10h.

const nextFlexDelivery = (now: Date): Date => {
  // Plaine Maison : livraison tous les jours sauf dimanche (0)
  // Cut-off = veille avant 10h, sauf lundi dont le cut-off est vendredi avant 10h
  const nowHour = now.getHours();

  // Trouver la prochaine date de livraison possible
  for (let offset = 1; offset <= 7; offset++) {
    const candidate = new Date(now);
    candidate.setDate(now.getDate() + offset);
    candidate.setHours(0, 0, 0, 0);
    const candidateDay = candidate.getDay();

    // Pas de livraison le dimanche
    if (candidateDay === 0) continue;

    // Vérifier que le cut-off est respecté
    // Pour lundi (1) : cut-off = vendredi (5) avant 10h
    // Pour les autres : cut-off = veille avant 10h
    let cutoffDay: number;
    if (candidateDay === 1) {
      cutoffDay = 5; // vendredi
    } else {
      cutoffDay = candidateDay - 1; // veille
    }

    // Est-on encore dans la fenêtre du cut-off ?
    const daysToCandidate = offset;
    const cutoffOffset    = daysToCandidate - 1; // veille de la livraison
    if (cutoffOffset === 0) {
      // Cut-off = aujourd'hui → valide si avant 10h
      if (nowHour < 10) return candidate;
    } else if (cutoffOffset > 0) {
      // Cut-off dans le futur → toujours valide
      return candidate;
    }
  }
  // Fallback : demain
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow;
};

const nextRuleDelivery = (now: Date, rules: DeliveryRule[], cutoffTime: string): Date => {
  const [cutoffHour] = cutoffTime.split(':').map(Number);
  const nowDay  = now.getDay();
  const nowHour = now.getHours();
  let best: Date | null = null;

  for (const rule of rules) {
    // Jours jusqu'au cut-off (0 = aujourd'hui)
    let daysToCutoff = (rule.cutoffDay - nowDay + 7) % 7;
    if (daysToCutoff === 0 && nowHour >= cutoffHour) {
      // Cut-off dépassé aujourd'hui → semaine prochaine
      daysToCutoff = 7;
    }

    const cutoffDate = new Date(now);
    cutoffDate.setDate(now.getDate() + daysToCutoff);
    cutoffDate.setHours(0, 0, 0, 0);

    // Livraison = cutoff + (deliveryDay - cutoffDay) jours
    let daysToDelivery = (rule.deliveryDay - rule.cutoffDay + 7) % 7;
    if (daysToDelivery === 0) daysToDelivery = 7;

    const deliveryDate = new Date(cutoffDate);
    deliveryDate.setDate(cutoffDate.getDate() + daysToDelivery);

    if (best === null || deliveryDate < best) best = deliveryDate;
  }
  return best!;
};

// Trouve la livraison suivante après une date de livraison donnée
const nextDeliveryAfterDate = (delivery: Date, config: SupplierConfig): Date => {
  // On simule "le lendemain de la livraison à 11h" (cut-offs passés)
  const after = new Date(delivery);
  after.setDate(delivery.getDate() + 1);
  after.setHours(11, 0, 0, 0);
  return getNextDelivery(after, config);
};

const getNextDelivery = (now: Date, config: SupplierConfig): Date => {
  if (config.flexibleDelivery) return nextFlexDelivery(now);
  const rules = config.deliveryRules ?? [{ cutoffDay: config.cutoffDay, deliveryDay: config.deliveryDay }];
  return nextRuleDelivery(now, rules, config.cutoffTime);
};

export const getDeliveryDates = (config: SupplierConfig) => {
  const now = new Date();

  // Cal 1 : prochaine livraison en respectant les cut-offs
  const delivery1 = getNextDelivery(now, config);

  // Cal 2 : livraison suivante après delivery1
  const delivery2 = nextDeliveryAfterDate(delivery1, config);

  // Fin fenêtre couverts = veille de delivery2
  const forecastEnd = new Date(delivery2);
  forecastEnd.setDate(delivery2.getDate() - 1);

  const format = (d: Date) =>
    d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  return {
    cutoff:           delivery1, // gardé pour compatibilité
    delivery:         delivery1,
    delivery2,
    forecastEnd,
    currentFormatted: format(delivery1),
    nextFormatted:    format(delivery2),
    deliveryDayIndex: config.deliveryDay,
  };
};

// -----------------------------------------------------------
// Totalise les couverts (midi + soir) depuis aujourd'hui
// jusqu'à une date de fin donnée.
// Après 15h, le service du midi du jour en cours n'est plus compté.
// -----------------------------------------------------------
export const getForecastForWindow = (
  endDate:     Date,
  dailyCovers: DailyCoversState
): { total: number; midi: number; soir: number } => {
  const now    = new Date();
  let totalMidi = 0;
  let totalSoir = 0;

  const current = new Date(now);
  current.setHours(0, 0, 0, 0);

  const limit = new Date(endDate);
  limit.setHours(23, 59, 59, 999);

  while (current <= limit) {
    const monthKey = MONTHS_ORDER[current.getMonth()];
    const dayData  = dailyCovers[monthKey]?.[current.getDate() - 1];

    if (dayData && dayData.midi !== '') {
      const isToday = current.toDateString() === now.toDateString();
      if (isToday) {
        if (now.getHours() < 15) totalMidi += Number(dayData.midi) || 0;
        totalSoir += Number(dayData.soir) || 0;
      } else {
        totalMidi += Number(dayData.midi) || 0;
        totalSoir += Number(dayData.soir) || 0;
      }
    }

    current.setDate(current.getDate() + 1);
  }

  return { total: totalMidi + totalSoir, midi: totalMidi, soir: totalSoir };
};

// -----------------------------------------------------------
// Totalise les couverts depuis aujourd'hui jusqu'à la veille
// du prochain jour de livraison (utilisé pour la consommation estimée)
// -----------------------------------------------------------
export const getConsumptionUntilDelivery = (
  deliveryDayIndex: number,
  dailyCovers:      DailyCoversState
): { total: number } => {
  const now = new Date();

  const deliveryDate = new Date(now);
  const day  = now.getDay();
  let diff   = (deliveryDayIndex - day + 7) % 7;
  if (diff === 0) diff = 7;
  deliveryDate.setDate(now.getDate() + diff);

  const limitDate = new Date(deliveryDate);
  limitDate.setDate(deliveryDate.getDate() - 1);
  limitDate.setHours(23, 59, 59, 999);

  const current = new Date(now);
  current.setHours(0, 0, 0, 0);

  let totalMidi = 0;
  let totalSoir = 0;

  while (current <= limitDate) {
    const monthKey = MONTHS_ORDER[current.getMonth()];
    const dayData  = dailyCovers[monthKey]?.[current.getDate() - 1];

    if (dayData && dayData.midi !== '') {
      const isToday = current.toDateString() === now.toDateString();

      if (isToday) {
        if (now.getHours() < 15) totalMidi += Number(dayData.midi) || 0;
        totalSoir += Number(dayData.soir) || 0;
      } else {
        totalMidi += Number(dayData.midi) || 0;
        totalSoir += Number(dayData.soir) || 0;
      }
    }

    current.setDate(current.getDate() + 1);
  }

  return { total: totalMidi + totalSoir };
};
