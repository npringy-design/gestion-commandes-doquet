// =============================================================
// components/WindowsCalendar.tsx
// Sélecteur de date "style Windows", affiché en overlay (portal)
// Extrait de App.tsx
// =============================================================

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { DAYS_OF_WEEK_LABELS } from '../constants';

interface WindowsCalendarProps {
  selectedDate: Date;
  onSelect:     (date: Date) => void;
  onClose:      () => void;
  // Rectangle du bouton déclencheur (pour positionner le calendrier juste dessous)
  anchorRect?:  DOMRect | null;
}

const WindowsCalendar: React.FC<WindowsCalendarProps> = ({
  selectedDate, onSelect, onClose, anchorRect,
}) => {
  const [currentMonth, setCurrentMonth] = useState(selectedDate.getMonth());
  const [currentYear,  setCurrentYear]  = useState(selectedDate.getFullYear());
  const calendarRef = useRef<HTMLDivElement>(null);

  // Fermer en cliquant en dehors
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Génération des jours du mois (avec jours grisés du mois précédent/suivant)
  const monthName       = new Date(currentYear, currentMonth).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const firstDay        = new Date(currentYear, currentMonth, 1).getDay();
  const lastDate        = new Date(currentYear, currentMonth + 1, 0).getDate();
  const lastDayPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

  const days: { day: number; current: boolean; date: Date }[] = [];

  for (let i = firstDay - 1; i >= 0; i--) {
    days.push({ day: lastDayPrevMonth - i, current: false, date: new Date(currentYear, currentMonth - 1, lastDayPrevMonth - i) });
  }
  for (let i = 1; i <= lastDate; i++) {
    days.push({ day: i, current: true, date: new Date(currentYear, currentMonth, i) });
  }
  for (let i = 1; i <= 42 - days.length; i++) {
    days.push({ day: i, current: false, date: new Date(currentYear, currentMonth + 1, i) });
  }

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
    else setCurrentMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
    else setCurrentMonth(m => m + 1);
  };

  // Positionnement en overlay (fixed) pour éviter les soucis de z-index
  const padding       = 10;
  const preferredTop  = (anchorRect?.bottom ?? 0) + 8;
  const preferredLeft = anchorRect?.left ?? 0;
  const top  = Math.max(padding, preferredTop);
  const left = Math.max(padding, Math.min(preferredLeft, (window.innerWidth || 0) - 320 - padding));

  const calendarNode = (
    <div
      ref={calendarRef}
      className="fixed z-[9999] bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-100 p-5 w-[320px] animate-in fade-in zoom-in-95 duration-200"
      style={{ top, left }}
    >
      {/* Navigation mois */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
        <p className="font-black text-slate-800 uppercase text-sm">{monthName}</p>
        <button onClick={nextMonth} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7"/>
          </svg>
        </button>
      </div>

      {/* Jours de la semaine */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {DAYS_OF_WEEK_LABELS.map(d => (
          <div key={d} className="text-center text-[10px] font-black uppercase text-slate-400 py-1">{d}</div>
        ))}
      </div>

      {/* Grille des jours */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((d, i) => {
          const isSelected = d.date.toDateString() === selectedDate.toDateString();
          const isToday    = d.date.toDateString() === new Date().toDateString();
          return (
            <button
              key={i}
              onClick={() => { onSelect(d.date); onClose(); }}
              className={`
                h-10 w-10 flex items-center justify-center rounded-full text-xs transition-all font-bold
                ${!d.current ? 'text-slate-300' : 'text-slate-700'}
                ${isSelected ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-slate-50'}
                ${isToday && !isSelected ? 'text-indigo-600 border-2 border-indigo-100' : ''}
              `}
            >
              {d.day}
            </button>
          );
        })}
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(calendarNode, document.body)
    : calendarNode;
};

export default WindowsCalendar;
