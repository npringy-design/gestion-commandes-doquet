// =============================================================
// components/WindowsCalendar.tsx
// Sélecteur de date — position absolute (pas de portal)
// Le conteneur parent doit avoir position:relative
// =============================================================

import React, { useState, useRef, useEffect } from 'react';
import { DAYS_OF_WEEK_LABELS } from '../constants';

interface WindowsCalendarProps {
  selectedDate: Date;
  onSelect:     (date: Date) => void;
  onClose:      () => void;
  minDate?:     Date;           // date minimum sélectionnable (jours antérieurs grisés)
  anchorRect?:  DOMRect | null; // gardé pour compatibilité, non utilisé
}

const WindowsCalendar: React.FC<WindowsCalendarProps> = ({
  selectedDate, onSelect, onClose, minDate,
}) => {
  const [currentMonth, setCurrentMonth] = useState(selectedDate.getMonth());
  const [currentYear,  setCurrentYear]  = useState(selectedDate.getFullYear());
  const calendarRef = useRef<HTMLDivElement>(null);

  // Fermer en cliquant en dehors — utilise mousedown sur document
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // léger délai pour ne pas attraper le mousedown qui a ouvert le calendrier
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handler);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handler);
    };
  }, [onClose]);

  const monthName        = new Date(currentYear, currentMonth).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const firstDay         = (new Date(currentYear, currentMonth, 1).getDay() + 6) % 7;
  const lastDate         = new Date(currentYear, currentMonth + 1, 0).getDate();
  const lastDayPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

  const days: { day: number; current: boolean; date: Date }[] = [];
  for (let i = firstDay - 1; i >= 0; i--)
    days.push({ day: lastDayPrevMonth - i, current: false, date: new Date(currentYear, currentMonth - 1, lastDayPrevMonth - i) });
  for (let i = 1; i <= lastDate; i++)
    days.push({ day: i, current: true, date: new Date(currentYear, currentMonth, i) });
  for (let i = 1; i <= 42 - days.length; i++)
    days.push({ day: i, current: false, date: new Date(currentYear, currentMonth + 1, i) });

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
    else setCurrentMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
    else setCurrentMonth(m => m + 1);
  };

  return (
    <div
      ref={calendarRef}
      className="absolute left-0 top-full mt-2 z-[9999] bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.15)] border border-slate-100 p-5 w-[300px]"
      // Stopper la propagation pour que le mousedown sur le calendrier
      // ne remonte pas au document et ne déclenche pas onClose
      onMouseDown={e => e.stopPropagation()}
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
          const isSelected  = d.date.toDateString() === selectedDate.toDateString();
          const isToday     = d.date.toDateString() === new Date().toDateString();
          // Griser tout ce qui est <= aujourd'hui (passé + aujourd'hui)
          const _todayMidnight = new Date(); _todayMidnight.setHours(0,0,0,0);
          const isPast      = d.date <= _todayMidnight;
          const isDisabled  = isPast || (minDate ? d.date < minDate : false);
          return (
            <button
              key={i}
              onClick={() => { if (!isDisabled) onSelect(d.date); }}
              disabled={isDisabled}
              className={`
                h-9 w-9 flex items-center justify-center rounded-full text-xs transition-all font-bold
                ${isDisabled
                  ? 'text-slate-200 cursor-not-allowed'
                  : (!d.current ? 'text-slate-300' : 'text-slate-700')}
                ${isSelected && !isDisabled
                  ? 'bg-indigo-600 text-white shadow-md'
                  : (!isDisabled ? 'hover:bg-slate-50' : '')}
                ${isToday
                  ? 'bg-slate-100 text-slate-400 line-through'
                  : ''}
              `}
            >
              {d.day}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default WindowsCalendar;
