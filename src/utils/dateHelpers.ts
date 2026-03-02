// =============================================================
// utils/dateHelpers.ts
// Fonctions liées aux dates, livraisons et prévisions couverts
// Extraites de App.tsx — aucune dépendance React
// =============================================================

import { SupplierConfig } from '../types';
import { DailyCover } from '../data';
import { MONTHS_ORDER } from '../constants';

// Re-export pour que les autres fichiers puissent importer depuis dateHelpers
export type { DailyCover };
export type DailyCoversState = Record<string, DailyCover[]>;

// -----------------------------------------------------------
// Calcule les prochaines dates importantes pour un fournisseur
// (cut-off, livraison J, livraison J+1)
// -----------------------------------------------------------
export const getDeliveryDates = (config: SupplierConfig) => {
  const now = new Date();

  // Prochain cut-off
  let nextCutoff = new Date(now);
  const day  = now.getDay();
  const diff = (config.cutoffDay - day + 7) % 7;
  nextCutoff.setDate(now.getDate() + diff);
  const [h, m] = config.cutoffTime.split(':').map(Number);
  nextCutoff.setHours(h, m, 0, 0);
  if (now > nextCutoff) nextCutoff.setDate(nextCutoff.getDate() + 7);

  // Première livraison après ce cut-off
  let delivery1 = new Date(nextCutoff);
  const delDiff = (config.deliveryDay - config.cutoffDay + 7) % 7;
  delivery1.setDate(nextCutoff.getDate() + (delDiff === 0 ? 7 : delDiff));

  // Livraison suivante
  let delivery2 = new Date(delivery1);
  delivery2.setDate(delivery1.getDate() + 7);

  // Fin de la fenêtre de prévision (veille de la 2e livraison)
  let forecastEnd = new Date(delivery2);
  forecastEnd.setDate(delivery2.getDate() - 1);

  const format = (d: Date) =>
    d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  return {
    cutoff:           nextCutoff,
    delivery:         delivery1,
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
        // Après 15h, le midi est passé → on ne le compte plus
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
