// =============================================================
// utils/dateHelpers.ts
// Fonctions liées aux dates, livraisons et prévisions couverts
// Extraites de App.tsx — aucune dépendance React
// =============================================================

import type { SupplierConfig, DeliveryRule } from '../types';
import type { DailyCover } from '../data';
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

const parseTimeToMinutes = (time: string): number => {
  const [hoursRaw, minutesRaw = '0'] = time.split(':');
  const hours = Number(hoursRaw) || 0;
  const minutes = Number(minutesRaw) || 0;
  return hours * 60 + minutes;
};

const startOfDay = (date: Date): Date => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const nextFlexDelivery = (now: Date, cutoffTime: string): Date => {
  // Livraison tous les jours sauf dimanche (0)
  // Cut-off = veille avant cutoffTime, sauf lundi dont le cut-off est vendredi avant cutoffTime
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const cutoffMinutes = parseTimeToMinutes(cutoffTime);

  // Trouver la prochaine date de livraison possible
  for (let offset = 1; offset <= 7; offset++) {
    const candidate = new Date(now);
    candidate.setDate(now.getDate() + offset);
    candidate.setHours(0, 0, 0, 0);
    const candidateDay = candidate.getDay();

    // Pas de livraison le dimanche
    if (candidateDay === 0) continue;

    // Pour lundi (1) : cut-off = vendredi (5) avant cutoffTime.
    // Pour les autres : cut-off = veille avant cutoffTime.
    const cutoffOffset = offset - 1;
    if (cutoffOffset === 0) {
      // Cut-off = aujourd'hui → valide si avant cutoffTime
      if (nowMinutes < cutoffMinutes) return candidate;
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
  const cutoffMinutes = parseTimeToMinutes(cutoffTime);
  const nowDay = now.getDay();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  let best: Date | null = null;

  for (const rule of rules) {
    // Jours jusqu'au cut-off (0 = aujourd'hui)
    let daysToCutoff = (rule.cutoffDay - nowDay + 7) % 7;
    if (daysToCutoff === 0 && nowMinutes >= cutoffMinutes) {
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

// Trouve la livraison physique suivante après une date de livraison donnée.
// Important : cette fonction ne resimule pas un nouveau cut-off après livraison.
// Elle sert à déterminer la fin de couverture entre deux livraisons planifiées.
const nextDeliveryAfterDate = (delivery: Date, config: SupplierConfig): Date => {
  const deliveryStart = startOfDay(delivery);

  if (config.flexibleDelivery) {
    for (let offset = 1; offset <= 7; offset++) {
      const candidate = new Date(deliveryStart);
      candidate.setDate(deliveryStart.getDate() + offset);
      if (candidate.getDay() !== 0) return candidate;
    }
  }

  const rules = config.deliveryRules ?? [{ cutoffDay: config.cutoffDay, deliveryDay: config.deliveryDay }];
  const deliveryDays = Array.from(new Set(rules.map(rule => rule.deliveryDay)));

  for (let offset = 1; offset <= 14; offset++) {
    const candidate = new Date(deliveryStart);
    candidate.setDate(deliveryStart.getDate() + offset);
    if (deliveryDays.includes(candidate.getDay())) return candidate;
  }

  const fallback = new Date(deliveryStart);
  fallback.setDate(deliveryStart.getDate() + 7);
  return fallback;
};

const getNextDelivery = (now: Date, config: SupplierConfig): Date => {
  if (config.flexibleDelivery) return nextFlexDelivery(now, config.cutoffTime);
  const rules = config.deliveryRules ?? [{ cutoffDay: config.cutoffDay, deliveryDay: config.deliveryDay }];
  return nextRuleDelivery(now, rules, config.cutoffTime);
};

export const getDeliveryDates = (config: SupplierConfig, now: Date = new Date()) => {
  // Cal 1 : prochaine livraison en respectant les cut-offs
  const delivery1 = getNextDelivery(now, config);

  // Cal 2 : livraison physique suivante après delivery1
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
  dailyCovers: DailyCoversState,
  now:         Date = new Date()
): { total: number; midi: number; soir: number } => {
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
  dailyCovers:      DailyCoversState,
  now:              Date = new Date()
): { total: number } => {
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