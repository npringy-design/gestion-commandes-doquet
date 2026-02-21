import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { DOQUET_PRODUCTS, VINS_PRODUCTS, VIANDES_PRODUCTS, DOMAFRAIS_PRODUCTS, DOMAFRAIS_BOF_PRODUCTS, MONTHLY_COVERS as INITIAL_COVERS, DOQUET_CONFIG, VINS_CONFIG, VIANDES_CONFIG, DOMAFRAIS_CONFIG, DOMAFRAIS_BOF_CONFIG, ProductWithHistory, DAILY_COVERS_INITIAL } from './data';
import { OrderState, Calculations, SupplierConfig, Product } from './types';
import * as XLSX from 'xlsx';
import DashboardApp from './dashboard_cm/DashboardApp';

// --- Types de Navigation ---
type View = 'home' | 'suppliers' | 'doquet' | 'vins' | 'viandes' | 'domafrais' | 'domafrais_bof' | 'stats' | 'ratios' | 'daily_forecast' | 'admin_dashboard' | 'supplier_settings' | 'cost_analysis';

interface DailyCover {
  midi: number | "";
  soir: number | "";
}

type DailyCoversState = Record<string, DailyCover[]>;

const MONTHS_ORDER = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DAYS_OF_WEEK = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const DAYS_OF_WEEK_LABELS = ["lu", "ma", "me", "je", "ve", "sa", "di"];

const MONTHS_DISPLAY_CONFIG = [
  { label: "JANVIER", key: "jan" }, { label: "FÉVRIER", key: "feb" }, { label: "MARS", key: "mar" },
  { label: "AVRIL", key: "apr" }, { label: "MAI", key: "may" }, { label: "JUIN", key: "jun" },
  { label: "JUILLET", key: "jul" }, { label: "AOÛT", key: "aug" }, { label: "SEPTEMBRE", key: "sep" },
  { label: "OCTOBRE", key: "oct" }, { label: "NOVEMBRE", key: "nov" }, { label: "DÉCEMBRE", key: "dec" }
];

// --- Helpers ---
const getImportedValueForProduct = (csvData: string | undefined, searchName: string, importDivisor?: number | string): number | null => {
  if (!csvData) return null;
  const rows = csvData.split('\n').filter(r => r.trim()).map(r => r.split(','));
  if (rows.length < 2) return null;
  const header = rows[0].map(h => h.trim().toLowerCase());
  const consoIdx = header.indexOf("conso théorique qté");
  if (consoIdx === -1) return null;
  const targetRow = rows.find(row => row.some(cell => cell.trim().toLowerCase() === searchName.toLowerCase()));
  if (targetRow && targetRow[consoIdx]) {
    const rawVal = parseFloat(targetRow[consoIdx].replace(/[^\d.-]/g, ''));
    const v = isNaN(rawVal) ? 0 : rawVal;
    const div = Number(importDivisor);
    if (div && div > 0) {
      // Conversion (ex: kg -> pièces) + ARRONDI AU SUPÉRIEUR
      return Math.ceil(v / div);
    }
    return Math.round(v);
  }
  return null;
};

const extractAllNamesFromCsvs = (detailedInventory: Record<string, string>): Set<string> => {
  const allNames = new Set<string>();
  (Object.values(detailedInventory) as string[]).forEach(csv => {
    if (!csv) return;
    const rows = csv.split('\n').filter(r => r.trim()).map(r => r.split(','));
    rows.slice(1).forEach(row => row.forEach(cell => {
      const val = cell.trim();
      if (val.length > 3 && isNaN(Number(val))) allNames.add(val);
    }));
  });
  return allNames;
};

const calculateOrder = (theoNeed: number, upcoming: number, stock: number, margin: number, pkg: number | string): Calculations => {
  const netGap = Math.max(0, theoNeed - upcoming - stock);
  const withSecu = Math.ceil(netGap * (1 + margin / 100));
  
  const pkgVal = Number(pkg);
  const safePkg = pkgVal > 0 ? pkgVal : 1; 
  
  const packs = pkgVal > 0 ? Math.ceil(withSecu / safePkg) : 0;
  return { net: netGap, needWithMargin: withSecu, realNeed: packs * safePkg, toOrder: packs };
};

const calculateTargetOrder = (
  targetStockUnits: number,
  currentStockVal: number | string | undefined,
  consumption: number,
  pkg: number | string
) => {
  if (currentStockVal === "" || currentStockVal === undefined) {
    return { projectedStock: 0, missing: 0, toOrder: 0 };
  }
  const stock = Number(currentStockVal);
  const pkgVal = Number(pkg);
  const safePkg = pkgVal > 0 ? pkgVal : 1;

  const targetCases = pkgVal > 0 ? Math.ceil(targetStockUnits / safePkg) : 0;
  const remainingAfterConso = stock - consumption;
  const isCritical = remainingAfterConso <= 0;

  let rawCases = 0;
  let cap = targetCases;

  if (isCritical) {
    rawCases = pkgVal > 0 ? Math.ceil((targetStockUnits + consumption) / safePkg) : 0;
    cap = targetCases + 1;
  } else {
    const need = Math.max(0, targetStockUnits - remainingAfterConso);
    rawCases = pkgVal > 0 ? Math.ceil(need / safePkg) : 0;
    cap = targetCases;
  }

  const toOrder = Math.min(cap, Math.max(0, rawCases));
  const projectedStock = Math.max(0, remainingAfterConso);
  const missing = Math.max(0, targetStockUnits - projectedStock);

  return { projectedStock, missing, toOrder };
};

const capitalizeFirstLetter = (string: string) => {
  if (!string) return "";
  return string.charAt(0).toUpperCase() + string.slice(1);
};

const getDeliveryDates = (config: SupplierConfig) => {
  const now = new Date();
  let nextCutoff = new Date(now);
  const day = now.getDay();
  const diff = (config.cutoffDay - day + 7) % 7;
  nextCutoff.setDate(now.getDate() + diff);
  const [h, m] = config.cutoffTime.split(':').map(Number);
  nextCutoff.setHours(h, m, 0, 0);
  if (now > nextCutoff) nextCutoff.setDate(nextCutoff.getDate() + 7);
  let delivery1 = new Date(nextCutoff);
  const delDiff = (config.deliveryDay - config.cutoffDay + 7) % 7;
  delivery1.setDate(nextCutoff.getDate() + (delDiff === 0 ? 7 : delDiff));
  let delivery2 = new Date(delivery1);
  delivery2.setDate(delivery1.getDate() + 7);
  let forecastEnd = new Date(delivery2);
  forecastEnd.setDate(delivery2.getDate() - 1);
  const format = (d: Date) => d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  return { cutoff: nextCutoff, delivery: delivery1, forecastEnd, currentFormatted: format(delivery1), nextFormatted: format(delivery2), deliveryDayIndex: config.deliveryDay };
};

const getForecastForWindow = (endDate: Date, dailyCovers: DailyCoversState) => {
  const now = new Date();
  let totalMidi = 0, totalSoir = 0;
  const current = new Date(now);
  current.setHours(0,0,0,0);
  const limit = new Date(endDate);
  limit.setHours(23,59,59,999);
  while (current <= limit) {
    const monthKey = MONTHS_ORDER[current.getMonth()];
    const dayData = dailyCovers[monthKey]?.[current.getDate() - 1];
    if (dayData && dayData.midi !== "") {
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

const getConsumptionUntilDelivery = (deliveryDayIndex: number, dailyCovers: DailyCoversState) => {
  const now = new Date();
  let totalMidi = 0, totalSoir = 0;
  const deliveryDate = new Date(now);
  const day = now.getDay();
  let diff = (deliveryDayIndex - day + 7) % 7;
  if (diff === 0) diff = 7;
  deliveryDate.setDate(now.getDate() + diff);
  const limitDate = new Date(deliveryDate);
  limitDate.setDate(deliveryDate.getDate() - 1);
  limitDate.setHours(23, 59, 59, 999);
  const current = new Date(now);
  current.setHours(0,0,0,0);
  while (current <= limitDate) {
    const monthKey = MONTHS_ORDER[current.getMonth()];
    const dayData = dailyCovers[monthKey]?.[current.getDate() - 1];
    if (dayData && dayData.midi !== "") {
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


// --- Sélecteur calendrier (style Windows) ---
const WindowsCalendar: React.FC<{ 
  selectedDate: Date; 
  onSelect: (date: Date) => void;
  onClose: () => void;
  // Rectangle du bouton/élément qui a ouvert le calendrier (pour le positionnement en overlay)
  anchorRect?: DOMRect | null;
}> = ({ selectedDate, onSelect, onClose, anchorRect }) => {
  const [currentMonth, setCurrentMonth] = useState(selectedDate.getMonth());
  const [currentYear, setCurrentYear] = useState(selectedDate.getFullYear());
  const calendarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const monthName = new Date(currentYear, currentMonth).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const lastDate = new Date(currentYear, currentMonth + 1, 0).getDate();
  const days: { day: number; current: boolean; date: Date }[] = [];
  const lastDayPrevMonth = new Date(currentYear, currentMonth, 0).getDate();
  for (let i = firstDay - 1; i >= 0; i--) {
    days.push({ day: lastDayPrevMonth - i, current: false, date: new Date(currentYear, currentMonth - 1, lastDayPrevMonth - i) });
  }
  for (let i = 1; i <= lastDate; i++) {
    days.push({ day: i, current: true, date: new Date(currentYear, currentMonth, i) });
  }
  const nextDays = 42 - days.length;
  for (let i = 1; i <= nextDays; i++) {
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

  // Positionnement en "overlay" (fixed + portal) pour éviter les soucis de z-index / stacking context
  const viewportPadding = 10;
  const preferredTop = (anchorRect?.bottom ?? 0) + 8;
  const preferredLeft = (anchorRect?.left ?? 0);
  const top = Math.max(viewportPadding, preferredTop);
  const left = Math.max(viewportPadding, Math.min(preferredLeft, (window.innerWidth || 0) - 320 - viewportPadding));

  const calendarNode = (
    <div
      ref={calendarRef}
      className="fixed z-[9999] bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-100 p-5 w-[320px] animate-in fade-in zoom-in-95 duration-200"
      style={{ top, left }}
    >
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7"/></svg>
        </button>
        <div className="text-center">
          <p className="font-black text-slate-800 uppercase text-sm">{monthName}</p>
        </div>
        <button onClick={nextMonth} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7"/></svg>
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {DAYS_OF_WEEK_LABELS.map(d => (
          <div key={d} className="text-center text-[10px] font-black uppercase text-slate-400 py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((d, i) => {
          const isSelected = d.date.toDateString() === selectedDate.toDateString();
          const isToday = d.date.toDateString() === new Date().toDateString();
          return (
            <button
              key={i}
              onClick={() => { onSelect(d.date); onClose(); }}
              className={`h-10 w-10 flex items-center justify-center rounded-full text-xs transition-all font-bold ${!d.current ? 'text-slate-300' : 'text-slate-700'} ${isSelected ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-slate-50'} ${isToday && !isSelected ? 'text-indigo-600 border-2 border-indigo-100' : ''}`}
            >
              {d.day}
            </button>
          );
        })}
      </div>
    </div>
  );

  // Portal vers <body> pour garantir l'affichage au premier plan
  return typeof document !== 'undefined' ? createPortal(calendarNode, document.body) : calendarNode;
};

// --- Composants UI ---

const ResetConfirmModal: React.FC<{ onConfirm: () => void; onClose: () => void }> = ({ onConfirm, onClose }) => {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white p-8 rounded-[40px] shadow-2xl max-w-sm w-full text-center border-4 border-[#ff0000]">
        <div className="w-20 h-20 bg-red-100 rounded-full mx-auto mb-6 flex items-center justify-center">
          <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </div>
        <h3 className="text-3xl font-black text-slate-800 mb-2 uppercase tracking-tight">Attention !</h3>
        <p className="font-bold text-slate-500 mb-8 uppercase text-xs tracking-wide">Voulez-vous vraiment effacer<br/>toutes les quantités saisies ?</p>
        <div className="flex gap-4 justify-center">
          <button onClick={onClose} className="flex-1 py-4 rounded-2xl font-black bg-slate-100 text-slate-500 hover:bg-slate-200 uppercase text-sm transition-colors">Non</button>
          <button onClick={onConfirm} className="flex-1 py-4 rounded-2xl font-black bg-[#ff0000] text-white hover:bg-red-700 shadow-[0_4px_0_#990000] active:translate-y-1 active:shadow-none uppercase text-sm transition-all">Oui, Effacer</button>
        </div>
      </div>
    </div>
  );
};

const ImportModal: React.FC<{ 
  monthLabel: string; 
  onClose: () => void; 
  onFileSelected: (file: File) => void; 
  type: 'gap' | 'detailed';
}> = ({ monthLabel, onClose, onFileSelected, type }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const handleDrag = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); }, []);
  const handleDragIn = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); if (e.dataTransfer.items && e.dataTransfer.items.length > 0) setIsDragging(true); }, []);
  const handleDragOut = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }, []);
  const handleDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); if (e.dataTransfer.files && e.dataTransfer.files.length > 0) onFileSelected(e.dataTransfer.files[0]); }, [onFileSelected]);
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files && e.target.files.length > 0) onFileSelected(e.target.files[0]); };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose}>
      <div className={`bg-white rounded-[32px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] w-full max-w-[500px] overflow-hidden relative transform transition-all scale-100`} onClick={e => e.stopPropagation()}>
        <div className={`p-8 text-center relative overflow-hidden ${type === 'gap' ? 'bg-[#e6b8af]' : 'bg-slate-900'}`}>
           <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)", backgroundSize: "16px 16px" }}></div>
           <h3 className={`${type === 'gap' ? 'text-[#783f04]' : 'text-white'} font-black text-2xl uppercase tracking-wider relative z-10`}>
             {type === 'gap' ? "Importer Écart" : "Importer Données"}
           </h3>
           <p className={`${type === 'gap' ? 'text-[#783f04]/70 border-[#783f04]/20' : 'text-indigo-400 border-indigo-500/30 bg-slate-800/50'} font-bold uppercase text-[10px] tracking-widest mt-2 relative z-10 inline-block px-3 py-1 rounded-full border`}>Mois de {monthLabel}</p>
           <button onClick={onClose} className={`absolute top-4 right-4 transition-colors rounded-full w-8 h-8 flex items-center justify-center ${type === 'gap' ? 'text-[#783f04]/50 hover:bg-[#783f04]/10' : 'text-white/30 hover:text-white bg-white/5 hover:bg-white/10'}`}><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
        <div className="p-8">
          <div className={`border-3 border-dashed rounded-3xl h-64 flex flex-col items-center justify-center cursor-pointer transition-all gap-5 duration-300 group ${isDragging ? 'border-indigo-500 bg-indigo-50/50 scale-[1.02]' : 'border-slate-200 hover:border-indigo-400 hover:bg-slate-50'}`} onDragEnter={handleDragIn} onDragLeave={handleDragOut} onDragOver={handleDrag} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()}>
            <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 shadow-xl ${isDragging ? 'bg-indigo-500 text-white shadow-indigo-500/30 scale-110' : 'bg-white text-indigo-500 shadow-slate-200 group-hover:scale-110 group-hover:text-indigo-600'}`}><svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg></div>
            <div className="space-y-1 text-center"><p className="font-black text-slate-700 uppercase text-sm tracking-tight group-hover:text-slate-900 transition-colors">Glissez votre fichier ici</p><p className="font-bold text-slate-400 uppercase text-[9px] tracking-widest">ou cliquez pour parcourir</p></div>
             <div className="flex gap-2 mt-2">{['CSV', 'XLS', 'XLSX', 'TXT'].map(ext => (<span key={ext} className="px-2 py-1 bg-slate-100 rounded text-[9px] font-bold text-slate-400 uppercase">{ext}</span>))}</div>
            <input type="file" ref={fileInputRef} onChange={handleChange} accept=".csv, .xlsx, .xls, .txt" className="hidden" />
          </div>
        </div>
      </div>
    </div>
  );
};

const MappingPopover: React.FC<{ orphanNames: string[], onSelect: (n: string) => void, onClose: () => void }> = ({ orphanNames, onSelect, onClose }) => {
  const [search, setSearch] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const click = (e: MouseEvent) => { if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', click);
    return () => document.removeEventListener('mousedown', click);
  }, [onClose]);
  const filtered = useMemo(() => orphanNames.filter(n => n.toLowerCase().includes(search.toLowerCase())).sort(), [orphanNames, search]);
  // NOTE: la table est dans un conteneur scrollable/sticky; on force un z-index très haut
  // pour éviter que le popover soit masqué par les colonnes "sticky" / les cadres.
  return (
    <div ref={popoverRef} className="absolute right-0 top-full mt-3 z-[99999] bg-white border border-slate-200 p-3 rounded-xl shadow-2xl w-72 animate-in slide-in-from-top-2">
      <input autoFocus type="text" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="w-full p-2 bg-slate-50 border rounded-lg text-[10px] font-bold mb-2 outline-none focus:ring-1 focus:ring-amber-500" />
      <div className="max-h-48 overflow-y-auto space-y-0.5 custom-scrollbar">
        {filtered.map(name => (
          <button key={name} onClick={() => { onSelect(name); onClose(); }} className="w-full text-left p-1.5 rounded hover:bg-amber-50 text-[9px] font-black uppercase text-slate-700 truncate">{name}</button>
        ))}
      </div>
    </div>
  );
};

const PasswordModal: React.FC<{ onConfirm: () => void; onClose: () => void }> = ({ onConfirm, onClose }) => {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const handleSubmit = (p: string = password) => {
    if (p === "1968") onConfirm();
    else { setError(true); setPassword(""); setTimeout(() => setError(false), 1000); }
  };
  const addDigit = (d: string) => { if (password.length < 4) { const newP = password + d; setPassword(newP); if (newP.length === 4) handleSubmit(newP); } };
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xl animate-in fade-in duration-300">
      <div className={`bg-[#1a0f0a] p-10 rounded-[50px] border-4 ${error ? 'border-red-600 animate-shake' : 'border-[#ffd700]'} shadow-[0_0_80px_rgba(255,215,0,0.15)] w-[340px]`}>
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-[#ffd700] rounded-full mx-auto mb-6 flex items-center justify-center shadow-[0_0_30px_rgba(255,215,0,0.4)]">
            <svg className="w-10 h-10 text-[#1a0f0a]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
          </div>
          <h2 className="text-[#ffd700] font-black uppercase tracking-widest text-2xl">ACCÈS ADMIN</h2>
          <p className="text-white/30 text-[10px] uppercase font-bold mt-2 tracking-widest">Identité Hippopotamus requise</p>
        </div>
        <div className="flex justify-center gap-5 mb-12">
          {[0, 1, 2, 3].map(i => <div key={i} className={`w-5 h-5 rounded-full border-2 border-[#ffd700] transition-all duration-300 ${password.length > i ? 'bg-[#ffd700] scale-125 shadow-[0_0_15px_rgba(255,215,0,0.6)]' : 'bg-transparent'}`}></div>)}
        </div>
        <div className="grid grid-cols-3 gap-5">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "←"].map(key => (
            <button key={key} onClick={() => { if (key === "C") setPassword(""); else if (key === "←") setPassword(p => p.slice(0, -1)); else addDigit(key); }} className="h-16 rounded-2xl font-black text-2xl bg-white/5 text-white hover:bg-white/10 active:scale-90 transition-all border border-white/5">{key}</button>
          ))}
        </div>
        <button onClick={onClose} className="w-full mt-10 text-white/30 font-black uppercase text-[10px] tracking-widest hover:text-white transition-colors">Retour à l'accueil</button>
      </div>
    </div>
  );
};

const HomePage: React.FC<{ setView: (v: View) => void }> = ({ setView }) => {
  const [showPassword, setShowPassword] = useState(false);
  return (
    <div className="min-h-screen bg-[#1a0f0a] flex flex-col items-center justify-center p-8 relative overflow-hidden">
      {showPassword && <PasswordModal onConfirm={() => setView('admin_dashboard')} onClose={() => setShowPassword(false)} />}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none" style={{ backgroundImage: `url('https://www.transparenttextures.com/patterns/brick-wall.png')` }}></div>
      <div className="z-10 text-center max-w-5xl">
        <div className="mb-12">
          <h1 className="text-[#ffd700] text-8xl font-black uppercase tracking-tighter leading-none mb-4">HIPPO<br/><span className="text-white">COMMANDES</span></h1>
          <div className="h-2 w-48 bg-red-600 mx-auto rounded-full"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <button onClick={() => setView('suppliers')} className="group bg-white p-8 rounded-[40px] shadow-2xl hover:scale-105 transition-all border-4 border-transparent hover:border-red-600">
            <div className="w-16 h-16 bg-red-100 rounded-3xl flex items-center justify-center mb-4 mx-auto group-hover:bg-red-600 group-hover:text-white transition-colors">
              <svg className="w-8 h-8 text-red-600 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
            </div>
            <span className="text-2xl font-black uppercase text-slate-800 tracking-tighter">Commandes</span>
          </button>
          <button onClick={() => setView('stats')} className="group bg-white p-8 rounded-[40px] shadow-2xl hover:scale-105 transition-all border-4 border-transparent hover:border-amber-500">
            <div className="w-16 h-16 bg-amber-100 rounded-3xl flex items-center justify-center mb-4 mx-auto group-hover:bg-amber-500 group-hover:text-white transition-colors">
              <svg className="w-8 h-8 text-amber-600 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
            </div>
            <span className="text-2xl font-black uppercase text-slate-800 tracking-tighter">Paramètres</span>
          </button>
           <button onClick={() => setView('cost_analysis')} className="group bg-white p-8 rounded-[40px] shadow-2xl hover:scale-105 transition-all border-4 border-transparent hover:border-orange-600">
            <div className="w-16 h-16 bg-orange-100 rounded-3xl flex items-center justify-center mb-4 mx-auto group-hover:bg-orange-600 group-hover:text-white transition-colors">
              <svg className="w-8 h-8 text-orange-600 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"/></svg>
            </div>
            <span className="text-2xl font-black uppercase text-slate-800 tracking-tighter">Analyse<br/>Coût Matière</span>
          </button>
        </div>
        <button onClick={() => setShowPassword(true)} className="flex items-center gap-4 mx-auto text-white/20 hover:text-[#ffd700] transition-colors"><span className="font-black uppercase text-[11px] tracking-widest">Accès Dashboard Admin</span></button>
      </div>
    </div>
  );
};

const AdminDashboard: React.FC<{ setView: (v: View) => void }> = ({ setView }) => {
  return (
    <div className="min-h-screen bg-[#1a0f0a] p-12 relative overflow-hidden">
      <div className="max-w-6xl mx-auto relative z-10">
        <div className="flex justify-between items-center mb-16">
          <h1 className="text-[#ffd700] text-6xl font-black uppercase tracking-tighter leading-none mb-2">ADMIN DASHBOARD</h1>
          <button onClick={() => setView('home')} className="px-8 py-4 bg-white/5 text-white border border-white/10 rounded-2xl hover:bg-white/10 font-black uppercase text-xs tracking-widest transition-all">Retour Accueil</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <button onClick={() => setView('supplier_settings')} className="bg-white/5 border border-white/10 p-10 rounded-[40px] text-left hover:border-[#ffd700] transition-all group">
            <h3 className="text-white text-2xl font-black uppercase mb-2">Rotations Fournisseurs</h3>
            <p className="text-white/40 font-bold uppercase text-[9px] tracking-widest">Jours de cut-off et livraisons</p>
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Page Analyse Coût Matière ---
// NOTE: Nicolas a demandé de supprimer l'ancienne page "Replication exacte" et de la remplacer
//       intégralement par le dashboard (Export consolidé + filtres secteurs + exclusions produits).
const CostAnalysisPage: React.FC<{ 
  setView: (v: View) => void;
  detailedInventory: Record<string, string>;
}> = ({ setView, detailedInventory }) => {
  // On transforme les clés internes (jan/feb/...) en noms de mois attendus par le dashboard (Janvier/Février/...)
  const csvByMonth = useMemo(() => {
    const map: Record<string, string> = {};
    const keyToName: Record<string, string> = {
      jan: 'Janvier', feb: 'Février', mar: 'Mars', apr: 'Avril', may: 'Mai', jun: 'Juin',
      jul: 'Juillet', aug: 'Août', sep: 'Septembre', oct: 'Octobre', nov: 'Novembre', dec: 'Décembre'
    };
    Object.entries(detailedInventory || {}).forEach(([k, v]) => {
      const name = keyToName[k];
      if (name && v) map[name] = v;
    });
    return map;
  }, [detailedInventory]);

  return (
    <div className="min-h-screen bg-[#FFF8E7]">
      <div className="p-4 flex gap-3 flex-wrap">
        <button
          onClick={() => setView('home')}
          className="bg-[#FFE699] border-2 border-[#bf9000] text-black font-bold py-3 px-6 shadow-md hover:bg-[#ffd966] transition-colors uppercase text-sm tracking-wide"
        >
          RETOUR ACCUEIL
        </button>
        <button
          onClick={() => setView('stats')}
          className="bg-white border-2 border-slate-200 text-slate-700 font-bold py-3 px-6 shadow-md hover:bg-slate-50 transition-colors uppercase text-sm tracking-wide"
        >
          IMPORTS / PARAMÈTRES
        </button>
      </div>
      <DashboardApp key={Object.keys(detailedInventory || {}).sort().map(k => `${k}:${(detailedInventory as any)[k]?.length || 0}`).join('|')} csvByMonth={csvByMonth} />
    </div>
  );
};

// --- Page Stats (Monthly) --- (Monthly) ---
const StatsPage: React.FC<{ 
  setView: (v: View) => void; 
  totalForecast: number;
  covers: Record<string, number>;
  setCovers: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  detailedInventory: Record<string, string>;
  setDetailedInventory: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  products: ProductWithHistory[];
  validatedMonths: Record<string, boolean>;
  setValidatedMonths: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}> = ({ setView, covers, setCovers, detailedInventory, setDetailedInventory, products, validatedMonths, setValidatedMonths }) => {
  const [modalState, setModalState] = useState<{ month: string } | null>(null);

  const handleFile = async (file: File) => {
    if (!modalState) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result;
      if (data) {
        let content = '';
        if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
          const wb = XLSX.read(data, { type: 'array' });
          const csv = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]], { FS: ';' });
          content = csv;
        } else {
          content = data as string;
        }

        setDetailedInventory(p => ({ ...p, [modalState.month]: content }));
      }
      setModalState(null);
    };
    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) reader.readAsArrayBuffer(file);
    else reader.readAsText(file);
  };

  return (
    <div className="h-screen bg-[#2c1810] p-6 flex gap-8 font-sans overflow-hidden">
      {modalState && (
        <ImportModal 
            monthLabel={MONTHS_DISPLAY_CONFIG.find(m => m.key === modalState.month)?.label || ""} 
            onClose={() => setModalState(null)} 
            onFileSelected={handleFile} 
            type={'detailed'}
        />
      )}
      <div className="w-72 flex flex-col gap-4 shrink-0 h-full py-2">
        <button onClick={() => setView('home')} className="bg-[#ffd700] hover:bg-[#ffed4a] text-[#2c1810] py-6 rounded-2xl font-black uppercase text-sm tracking-widest shadow-[0_4px_0_#b39700] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-3">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
          Retour Accueil
        </button>
        <div className="flex-1"></div>
        <div className="space-y-4">
             <button
               onClick={() => {
                 if (!window.confirm('Vider tous les imports Inventaire détaillé et réinitialiser les validations ?')) return;
                 setDetailedInventory({});
                 setValidatedMonths({});
                 try {
                   localStorage.removeItem('hippo_v7_inventory');
                   localStorage.removeItem('hippo_v7_validatedMonths');
                 } catch (e) {}
               }}
               className="w-full bg-[#cc0000] hover:bg-[#a40000] text-white py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-[0_4px_0_#660000] active:translate-y-1 active:shadow-none transition-all"
             >
               Vider imports<br/>Inventaire détaillé
             </button>
             
             <button onClick={() => setView('daily_forecast')} className="w-full bg-[#93c47d] hover:bg-[#76a560] text-white py-6 rounded-2xl font-black uppercase text-xs tracking-widest shadow-[0_4px_0_#38761d] active:translate-y-1 active:shadow-none transition-all">
               Prévisionnel<br/>Couverts
             </button>
             <button onClick={() => setView('ratios')} className="w-full bg-[#3d85c6] hover:bg-[#2b6ca8] text-white py-6 rounded-2xl font-black uppercase text-xs tracking-widest shadow-[0_4px_0_#073763] active:translate-y-1 active:shadow-none transition-all">
               Calcul<br/>Vente Ratio
             </button>
        </div>
      </div>
      <div className="flex-1 h-full flex justify-center">
        <div className="grid grid-cols-2 gap-8 h-full w-full max-w-5xl"><div className="flex flex-col h-full rounded-[30px] overflow-hidden shadow-2xl border-4 border-[#f6b26b] bg-[#f9cb9c]">
            <div className="bg-[#f6b26b] py-5 flex items-center justify-center shadow-md z-10"><h2 className="font-black text-[#783f04] uppercase text-lg tracking-widest">Inventaire Détaillé</h2></div>
            <div className="flex-1 flex flex-col overflow-hidden">{MONTHS_DISPLAY_CONFIG.map((m, idx) => (
                <button 
                    key={m.key} 
                    onClick={() => setModalState({ month: m.key })} 
                    className={`flex-1 flex items-center justify-center w-full border-b border-[#f6b26b]/50 last:border-0 relative group hover:bg-[#ff9900] transition-all`}
                >
                    <span className="font-black text-[#783f04] uppercase text-sm group-hover:scale-110 transition-transform">{m.label}</span>
                    {detailedInventory[m.key] ? (
                        <div className="absolute right-6 w-8 h-8 bg-[#38761d] rounded-full flex items-center justify-center shadow-sm">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg>
                        </div>
                    ) : (
                        <div className="absolute right-6 w-8 h-8 rounded-full border-2 border-[#783f04]/30 flex items-center justify-center group-hover:border-[#783f04]">
                            <svg className="w-4 h-4 text-[#783f04]/50 group-hover:text-[#783f04]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
                        </div>
                    )}
                </button>
            ))}</div>
          </div>
          <div className="flex flex-col h-full rounded-[30px] overflow-hidden shadow-2xl border-4 border-[#ffd966] bg-[#fff2cc]">
            <div className="bg-[#ffd966] py-5 flex items-center justify-center shadow-md z-10"><h2 className="font-black text-[#7f6000] uppercase text-lg tracking-widest">Couverts Réalisés</h2></div>
            <div className="flex-1 flex flex-col overflow-hidden">{MONTHS_DISPLAY_CONFIG.map((m, idx) => (<div key={m.key} className={`flex-1 flex items-center justify-between px-8 border-b border-[#ffd966]/50 last:border-0 hover:bg-[#ffe599] transition-colors`}><span className="font-black text-[#7f6000] uppercase text-sm">{m.label}</span><div className="relative"><input type="number" value={covers[m.key] || ''} onChange={e => setCovers(p => ({...p, [m.key]: Number(e.target.value)}))} className="w-24 bg-white border-2 border-[#bf9000] rounded-xl text-center font-black text-[#7f6000] outline-none focus:scale-110 focus:shadow-lg transition-all h-10 text-lg" placeholder="-" /></div></div>))}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Page Previsions Journalieres ---
const DailyForecastPage: React.FC<{ setView: (v: View) => void, dailyCovers: DailyCoversState, setDailyCovers: React.Dispatch<React.SetStateAction<DailyCoversState>> }> = ({ setView, dailyCovers, setDailyCovers }) => {
  const [selectedMonth, setSelectedMonth] = useState('jan');
  const monthData = dailyCovers[selectedMonth] || [];
  
  const updateDay = (idx: number, field: 'midi' | 'soir', val: string) => {
    const newData = [...monthData];
    if (!newData[idx]) newData[idx] = { midi: "", soir: "" };
    newData[idx] = { ...newData[idx], [field]: val === "" ? "" : Number(val) };
    setDailyCovers(prev => ({ ...prev, [selectedMonth]: newData }));
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] p-8">
      <div className="max-w-[1600px] mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-black text-slate-800 uppercase tracking-tighter">Prévisions <span className="text-emerald-600">Journalières</span></h1>
          <button onClick={() => setView('stats')} className="px-8 py-4 bg-white border-2 border-slate-200 text-slate-400 font-black uppercase text-xs rounded-2xl hover:bg-slate-50 transition-all">Retour</button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-4 mb-8 custom-scrollbar">
          {MONTHS_DISPLAY_CONFIG.map(m => (
            <button key={m.key} onClick={() => setSelectedMonth(m.key)} className={`px-6 py-3 rounded-xl font-black text-xs uppercase transition-all whitespace-nowrap ${selectedMonth === m.key ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200' : 'bg-white text-slate-400 hover:bg-slate-50'}`}>{m.label}</button>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-3">
          {['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'].map(d => <div key={d} className="text-center font-black text-slate-300 text-xs uppercase py-2">{d}</div>)}
          {Array.from({ length: 31 }).map((_, i) => {
            const d = monthData[i] || { midi: "", soir: "" };
            return (
              <div key={i} className="bg-white p-4 rounded-2xl border-2 border-slate-100 hover:border-emerald-200 transition-colors">
                <div className="text-[10px] font-black text-slate-300 mb-3 uppercase">Jour {i + 1}</div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2"><span className="text-[9px] font-bold text-slate-400 uppercase w-8">Midi</span><input type="number" value={d.midi} onChange={e => updateDay(i, 'midi', e.target.value)} className="w-full bg-slate-50 rounded-lg p-1.5 font-black text-center text-slate-700 text-sm outline-none focus:bg-emerald-50 focus:text-emerald-700 transition-colors" /></div>
                  <div className="flex items-center gap-2"><span className="text-[9px] font-bold text-slate-400 uppercase w-8">Soir</span><input type="number" value={d.soir} onChange={e => updateDay(i, 'soir', e.target.value)} className="w-full bg-slate-50 rounded-lg p-1.5 font-black text-center text-slate-700 text-sm outline-none focus:bg-emerald-50 focus:text-emerald-700 transition-colors" /></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// --- Page Parametres Fournisseurs (Modification incluse) ---
const SupplierSettingsPage: React.FC<{ setView: (v: View) => void, configs: Record<string, SupplierConfig>, setConfigs: React.Dispatch<React.SetStateAction<Record<string, SupplierConfig>>> }> = ({ setView, configs, setConfigs }) => {
  return (
    <div className="min-h-screen bg-[#1a0f0a] p-12 relative overflow-hidden">
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none" style={{ backgroundImage: `url('https://www.transparenttextures.com/patterns/brick-wall.png')` }}></div>
      <div className="max-w-4xl mx-auto relative z-10">
        <div className="flex justify-between items-center mb-12">
            <h1 className="text-[#ffd700] text-4xl font-black uppercase">Rotation Fournisseurs</h1>
            <div className="flex gap-4">
                <button onClick={() => setView('admin_dashboard')} className="px-6 py-3 bg-white/5 text-white border border-white/10 rounded-2xl hover:bg-white/10 font-black uppercase text-xs tracking-widest transition-all flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
                    Retour
                </button>
                <button onClick={() => setView('home')} className="px-6 py-3 bg-[#ffd700] text-[#1a0f0a] border border-[#ffd700] rounded-2xl hover:bg-[#ffed4a] font-black uppercase text-xs tracking-widest transition-all flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
                    Accueil
                </button>
            </div>
        </div>
        <div className="space-y-6">
          {Object.values(configs).map((config: SupplierConfig) => (
            <div key={config.id} className="bg-white/5 border border-white/10 p-8 rounded-[40px] flex items-center justify-between">
              <span className="text-[#ffd700] font-black uppercase text-2xl">{config.name}</span>
              <div className="flex gap-4">
                 <select value={config.deliveryDay} onChange={e => setConfigs({...configs, [config.id]: {...config, deliveryDay: Number(e.target.value)}})} className="bg-white/10 text-white p-3 rounded-xl border border-white/10 outline-none focus:border-[#ffd700] font-bold uppercase text-sm cursor-pointer hover:bg-white/20 transition-colors">
                    {DAYS_OF_WEEK.map((d, i) => <option key={i} value={i} className="text-black">{d}</option>)}
                 </select>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// --- Composant Principal ---
const App: React.FC = () => {
  const [view, setView] = useState<View>('home');
  const [showResetConfirm, setShowResetConfirm] = useState(false); // État pour la modale RAZ
  const [calculationMode, setCalculationMode] = useState<'margin' | 'target'>('margin'); // Nouveau state pour le mode de calcul
  
  // Nouveau state pour l'onglet dans la page Ratios
  const [ratioTab, setRatioTab] = useState<'doquet' | 'vins' | 'viandes' | 'domafrais' | 'domafrais_bof'>('doquet');

  // Scroll horizontal toujours visible (page Ratios)
  const ratiosScrollRef = useRef<HTMLDivElement>(null);
  const ratiosBottomScrollRef = useRef<HTMLDivElement>(null);
  const ratiosIsSyncingRef = useRef(false);
  const [ratiosScrollWidth, setRatiosScrollWidth] = useState(0);

  const syncRatiosScroll = useCallback((source: 'main' | 'bottom') => {
    if (ratiosIsSyncingRef.current) return;
    const mainEl = ratiosScrollRef.current;
    const bottomEl = ratiosBottomScrollRef.current;
    if (!mainEl || !bottomEl) return;

    ratiosIsSyncingRef.current = true;
    if (source === 'main') bottomEl.scrollLeft = mainEl.scrollLeft;
    else mainEl.scrollLeft = bottomEl.scrollLeft;

    window.requestAnimationFrame(() => {
      ratiosIsSyncingRef.current = false;
    });
  }, []);

  useEffect(() => {
    if (view !== 'ratios') return;
    const el = ratiosScrollRef.current;
    if (!el) return;

    const update = () => setRatiosScrollWidth(el.scrollWidth || 0);
    update();

    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [view, ratioTab]);




  const loadState = (key: string, defaultVal: any) => {
    // Migration friendly: we version only imports/validation to avoid keeping old broken data
    const prefix = (key === 'inventory' || key === 'validatedMonths') ? 'hippo_v7_' : 'hippo_v6_';
    const saved = localStorage.getItem(`${prefix}${key}`);
    return saved ? JSON.parse(saved) : defaultVal;
  };

  const [deliveryDateBySupplier, setDeliveryDateBySupplier] = useState<Record<string, string>>(() => loadState('deliveryDateBySupplier', {}));
  const [covers, setCovers] = useState<Record<string, number>>(() => loadState('covers', INITIAL_COVERS));
  const [dailyCovers, setDailyCovers] = useState<DailyCoversState>(() => loadState('dailyCovers', DAILY_COVERS_INITIAL));
  const [orderStates, setOrderStates] = useState<Record<string, OrderState>>(() => loadState('orderStates', {}));
  const [detailedInventory, setDetailedInventory] = useState<Record<string, string>>(() => loadState('inventory', {}));
  
  const [products, setProducts] = useState<ProductWithHistory[]>(() => {
    const loaded = loadState('products', [...DOQUET_PRODUCTS, ...VINS_PRODUCTS, ...VIANDES_PRODUCTS, ...DOMAFRAIS_PRODUCTS, ...DOMAFRAIS_BOF_PRODUCTS]);
    // Fusionner les nouveaux produits s'ils n'existent pas déjà (par ID)
    const existingIds = new Set(loaded.map((p: any) => p.id));
    const allProducts = [...loaded];
    
    // Check pour les produits Vins et Viandes et Domafrais et Domafrais BOF
    [...VINS_PRODUCTS, ...VIANDES_PRODUCTS, ...DOMAFRAIS_PRODUCTS, ...DOMAFRAIS_BOF_PRODUCTS].forEach(p => {
        if (!existingIds.has(p.id)) allProducts.push(p);
    });

    return allProducts.map((p: any) => ({
      ...p,
      stock: (p.stock === undefined || p.stock === null) ? '' : (p.stock === 0 ? '' : p.stock),
      upcomingDelivery: (p.upcomingDelivery === undefined || p.upcomingDelivery === null) ? '' : (p.upcomingDelivery === 0 ? '' : p.upcomingDelivery),
      targetStock: (p.targetStock === undefined || p.targetStock === null) ? '' : (p.targetStock === 0 ? '' : p.targetStock),
      // On s'assure que le packaging est présent
      packaging: (p.packaging === undefined || p.packaging === null || p.packaging === 0) ? 1 : p.packaging,
      // Optionnel : diviseur pour convertir une conso (ex: kg) en unités (pièces)
      importDivisor: (p.importDivisor === undefined || p.importDivisor === null || p.importDivisor === 0) ? '' : p.importDivisor,
      // Migration: Assurer que supplierId est défini
      supplierId: p.supplierId || (DOQUET_PRODUCTS.find(dp => dp.id === p.id) ? 'doquet' : 'vins')
    }));
  });

  const [validatedMonths, setValidatedMonths] = useState<Record<string, boolean>>(() => loadState('validatedMonths', {}));
  const [supplierConfigs, setSupplierConfigs] = useState<Record<string, SupplierConfig>>(() => loadState('supplierConfigs', { doquet: DOQUET_CONFIG, vins: VINS_CONFIG, viandes: VIANDES_CONFIG, domafrais: DOMAFRAIS_CONFIG, domafrais_bof: DOMAFRAIS_BOF_CONFIG }));

  const [activeMappingId, setActiveMappingId] = useState<string | null>(null);
  const [activeCalendarSupplier, setActiveCalendarSupplier] = useState<string | null>(null);
  // Permet de positionner le calendrier en overlay, exactement sous le bouton cliqué
  const [calendarAnchorRectBySupplier, setCalendarAnchorRectBySupplier] = useState<Record<string, DOMRect | null>>({});
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());

  useEffect(() => localStorage.setItem('hippo_v6_covers', JSON.stringify(covers)), [covers]);
  useEffect(() => localStorage.setItem('hippo_v6_dailyCovers', JSON.stringify(dailyCovers)), [dailyCovers]);
  useEffect(() => localStorage.setItem('hippo_v6_orderStates', JSON.stringify(orderStates)), [orderStates]);
  useEffect(() => localStorage.setItem('hippo_v7_inventory', JSON.stringify(detailedInventory)), [detailedInventory]);
  useEffect(() => localStorage.setItem('hippo_v7_validatedMonths', JSON.stringify(validatedMonths)), [validatedMonths]);
  useEffect(() => localStorage.setItem('hippo_v6_supplierConfigs', JSON.stringify(supplierConfigs)), [supplierConfigs]);
  useEffect(() => localStorage.setItem('hippo_v6_deliveryDateBySupplier', JSON.stringify(deliveryDateBySupplier)), [deliveryDateBySupplier]);

  const totalForecast = useMemo(() => {
    let sum = 0; 
    Object.values(dailyCovers).forEach((m: any) => m.forEach((d: any) => { sum += (Number(d.midi) || 0) + (Number(d.soir) || 0); })); 
    return sum;
  }, [dailyCovers]);

  const allAvailableImportNames = useMemo(() => extractAllNamesFromCsvs(detailedInventory), [detailedInventory]);

  const getProductStats = useCallback((p: ProductWithHistory) => {
    let totalR = 0, countR = 0; const mR: Record<string, number> = {}, mS: Record<string, { value: number, isImported: boolean, isValidated: boolean }> = {};
    MONTHS_ORDER.forEach(m => {
      const isValid = validatedMonths[m] || false;
      const importedVal = getImportedValueForProduct(detailedInventory[m], p.searchName, p.importDivisor);
      let val = isValid ? Math.round(p.salesHistory[m] || 0) : (importedVal ?? Math.round(p.salesHistory[m] || 0));
      const c = covers[m] || 1, r = val / c;
      mS[m] = { value: val, isImported: !isValid && importedVal !== null, isValidated: isValid };
      mR[m] = r; if (val > 0) { totalR += r; countR++; }
    });
    return { avgRatio: countR > 0 ? totalR / countR : 0, mR, mS };
  }, [detailedInventory, validatedMonths, covers]);

  const toggleVal = (m: string) => {
    const next = !validatedMonths[m];
    if (next) setProducts(prev => prev.map(p => ({ ...p, salesHistory: { ...p.salesHistory, [m]: Math.round(getProductStats(p).mS[m].value) } })));
    setValidatedMonths(prev => ({ ...prev, [m]: next }));
  };

  // Mise à jour pour inclure 'packaging'
  const updateProductValue = (id: string, field: 'stock' | 'upcomingDelivery' | 'targetStock' | 'packaging', value: string) => {
    const val = value === '' ? '' : Number(value);
    setProducts(prev => prev.map(p => p.id === id ? { ...p, [field]: val } : p));
  };

  const performReset = () => {
    // Reset seulement les produits du fournisseur en cours de visualisation
    let currentSupplierId = null;
    if (view === 'doquet') currentSupplierId = 'doquet';
    else if (view === 'vins') currentSupplierId = 'vins';
    else if (view === 'viandes') currentSupplierId = 'viandes';
    else if (view === 'domafrais') currentSupplierId = 'domafrais';
    else if (view === 'domafrais_bof') currentSupplierId = 'domafrais_bof';

    if (!currentSupplierId) return;

    setProducts(prev => prev.map(p => {
        if (p.supplierId === currentSupplierId) {
            return { ...p, stock: '', upcomingDelivery: '' };
        }
        return p;
    }));
    setShowResetConfirm(false);
  };

  const addNewProduct = () => {
    // Determine supplier based on current view OR active tab in Ratios view
    let currentSupplierId = 'doquet';
    if (view === 'doquet') currentSupplierId = 'doquet';
    else if (view === 'vins') currentSupplierId = 'vins';
    else if (view === 'viandes') currentSupplierId = 'viandes';
    else if (view === 'domafrais') currentSupplierId = 'domafrais';
    else if (view === 'domafrais_bof') currentSupplierId = 'domafrais_bof';
    else if (view === 'ratios') currentSupplierId = ratioTab;

    const newId = `custom-${Date.now()}`;
    const newProd: ProductWithHistory = { 
        id: newId, 
        supplierId: currentSupplierId,
        name: 'NOUVEAU PRODUIT', 
        searchName: '', 
        packaging: 1, 
        defaultMargin: 0, 
        salesHistory: {}, 
        stock: 0, 
        upcomingDelivery: 0, 
        targetStock: 0 
    };
    setProducts(prev => [newProd, ...prev]);
    setSelectedProductIds(new Set());
  };

  const deleteSelectedProducts = useCallback(() => {
    if (selectedProductIds.size === 0) return;
    if (window.confirm(`Confirmer la suppression de ${selectedProductIds.size} produit(s) ?`)) {
      setProducts(prev => prev.filter(p => !selectedProductIds.has(p.id)));
      setSelectedProductIds(new Set());
    }
  }, [selectedProductIds]);

  const toggleProductSelection = (id: string) => {
    setSelectedProductIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const moveProduct = (id: string, direction: 'up' | 'down') => {
    setProducts(prev => {
      const idx = prev.findIndex(p => p.id === id);
      if (idx === -1) return prev;
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
      return next;
    });
  };

  const jumpProductTo = (id: string, pos: number) => {
    setProducts(prev => {
      const idx = prev.findIndex(p => p.id === id);
      if (idx === -1) return prev;
      const targetIdx = Math.max(0, Math.min(prev.length - 1, pos - 1));
      const next = [...prev];
      const [moved] = next.splice(idx, 1);
      next.splice(targetIdx, 0, moved);
      return next;
    });
  };

  const handleNameChange = (id: string, newName: string) => {
    setProducts(prev => {
      return prev.map(p => {
        if (p.id === id) {
          const wasNew = p.name === 'NOUVEAU PRODUIT';
          if (wasNew && newName !== 'NOUVEAU PRODUIT' && newName.trim() !== '') {
            setTimeout(() => {
              const pos = window.prompt(`À quel numéro de ligne placer "${newName}" ? (1 à ${products.length})`, "1");
              if (pos) {
                const n = parseInt(pos);
                if (!isNaN(n)) jumpProductTo(id, n);
              }
            }, 100);
          }
          return { ...p, name: newName };
        }
        return p;
      });
    });
  };

  if (view === 'home') return <HomePage setView={setView} />;
  if (view === 'admin_dashboard') return <AdminDashboard setView={setView} />;
  if (view === 'cost_analysis') return <CostAnalysisPage setView={setView} detailedInventory={detailedInventory} />;
  
  if (view === 'stats') return (
    <StatsPage 
      setView={setView} 
      totalForecast={totalForecast} 
      covers={covers} 
      setCovers={setCovers} 
      detailedInventory={detailedInventory} 
      setDetailedInventory={setDetailedInventory}      products={products} 
      validatedMonths={validatedMonths}
      setValidatedMonths={setValidatedMonths}
    />
  );

  if (view === 'daily_forecast') return (
    <DailyForecastPage setView={setView} dailyCovers={dailyCovers} setDailyCovers={setDailyCovers} />
  );

  if (view === 'supplier_settings') return (
    <SupplierSettingsPage setView={setView} configs={supplierConfigs} setConfigs={setSupplierConfigs} />
  );

  if (view === 'suppliers') return (
    <div className="min-h-screen bg-[#1a0f0a] flex flex-col items-center p-8 overflow-x-hidden relative">
      <div className="absolute inset-0 z-0 opacity-30 pointer-events-none" style={{ backgroundImage: `url('https://www.transparenttextures.com/patterns/brick-wall.png')` }}></div>
      <div className="w-full max-w-[1400px] z-10 flex flex-col h-full">
        <div className="flex justify-between items-center mb-12"><div className="flex flex-col"><h2 className="text-[#ffd700] text-5xl font-black uppercase tracking-tighter leading-none mb-2">Fournisseurs</h2><div className="h-1.5 w-32 bg-red-600 rounded-full"></div></div><button onClick={() => setView('home')} className="px-8 py-4 bg-gradient-to-b from-[#e5e5e5] to-[#a3a3a3] rounded-2xl shadow-[0_8px_0_#525252] active:translate-y-1 transition-all"><span className="font-black text-slate-800 uppercase text-lg tracking-tight">Accueil</span></button></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 flex-1 pb-12">
          
          <div onClick={() => setView('doquet')} className="group cursor-pointer transform transition-all hover:-translate-y-3"><div className="relative h-[420px] w-full bg-[#1a0f0a] rounded-[40px] overflow-hidden border-4 border-[#ffd700]/20 group-hover:border-[#ffd700] shadow-2xl"><div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/40 to-black/95 z-10"></div><img src="https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=800&q=90" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-[1s]" /><div className="absolute bottom-0 left-0 right-0 p-8 z-20"><h3 className="font-black text-4xl uppercase tracking-tighter text-white mb-2">DOQUET</h3><p className="text-[#ffd700] font-black uppercase tracking-widest text-[9px] opacity-80">Softs • Jus • Cocktails</p></div></div></div>
          
          <div onClick={() => setView('vins')} className="group cursor-pointer transform transition-all hover:-translate-y-3"><div className="relative h-[420px] w-full bg-[#1a0f0a] rounded-[40px] overflow-hidden border-4 border-[#ffd700]/20 group-hover:border-[#ffd700] shadow-2xl"><div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/40 to-black/95 z-10"></div><img src="https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800&q=90" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-[1s]" /><div className="absolute bottom-0 left-0 right-0 p-8 z-20"><h3 className="font-black text-4xl uppercase tracking-tighter text-white mb-2">Richard Vins</h3><p className="text-[#ffd700] font-black uppercase tracking-widest text-[9px] opacity-80">Cave • Alcools</p></div></div></div>
          
          <div onClick={() => setView('viandes')} className="group cursor-pointer transform transition-all hover:-translate-y-3"><div className="relative h-[420px] w-full bg-[#1a0f0a] rounded-[40px] overflow-hidden border-4 border-[#ffd700]/20 group-hover:border-[#ffd700] shadow-2xl"><div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/40 to-black/95 z-10"></div><img src="https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=800&q=90" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-[1s]" /><div className="absolute bottom-0 left-0 right-0 p-8 z-20"><h3 className="font-black text-4xl uppercase tracking-tighter text-white mb-2">Plaine Maison</h3><p className="text-[#ffd700] font-black uppercase tracking-widest text-[9px] opacity-80">Boucherie • Grill</p></div></div></div>

          <div onClick={() => setView('domafrais')} className="group cursor-pointer transform transition-all hover:-translate-y-3"><div className="relative h-[420px] w-full bg-[#1a0f0a] rounded-[40px] overflow-hidden border-4 border-[#ffd700]/20 group-hover:border-[#ffd700] shadow-2xl"><div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/40 to-black/95 z-10"></div><img src="https://images.unsplash.com/photo-1615937657715-bc7b4b7960c7?w=800&q=90" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-[1s]" /><div className="absolute bottom-0 left-0 right-0 p-8 z-20"><h3 className="font-black text-4xl uppercase tracking-tighter text-white mb-2">Domafrais Viandes</h3><p className="text-[#ffd700] font-black uppercase tracking-widest text-[9px] opacity-80">Viandes • Volailles</p></div></div></div>

          <div onClick={() => setView('domafrais_bof')} className="group cursor-pointer transform transition-all hover:-translate-y-3"><div className="relative h-[420px] w-full bg-[#1a0f0a] rounded-[40px] overflow-hidden border-4 border-[#ffd700]/20 group-hover:border-[#ffd700] shadow-2xl"><div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/40 to-black/95 z-10"></div><img src="https://images.unsplash.com/photo-1628193479337-4a1435a530e0?w=800&q=90" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-[1s]" /><div className="absolute bottom-0 left-0 right-0 p-8 z-20"><h3 className="font-black text-4xl uppercase tracking-tighter text-white mb-2">Domafrais B.O.F</h3><p className="text-[#ffd700] font-black uppercase tracking-widest text-[9px] opacity-80">Crémerie • Fromages</p></div></div></div>
          
        </div>
      </div>
    </div>
  );

  if (view === 'doquet' || view === 'vins' || view === 'viandes' || view === 'domafrais' || view === 'domafrais_bof') {
    let currentConfig: SupplierConfig;
    if (view === 'doquet') currentConfig = supplierConfigs.doquet;
    else if (view === 'vins') currentConfig = supplierConfigs.vins;
    else if (view === 'viandes') currentConfig = supplierConfigs.viandes;
    else if (view === 'domafrais') currentConfig = supplierConfigs.domafrais;
    else currentConfig = supplierConfigs.domafrais_bof;

    // Filtrage des produits selon le fournisseur sélectionné
    let currentSupplierId = 'doquet';
    if (view === 'doquet') currentSupplierId = 'doquet';
    else if (view === 'vins') currentSupplierId = 'vins';
    else if (view === 'viandes') currentSupplierId = 'viandes';
    else if (view === 'domafrais') currentSupplierId = 'domafrais';
    else if (view === 'domafrais_bof') currentSupplierId = 'domafrais_bof';

    const displayedProducts = products.filter(p => p.supplierId === currentSupplierId);
    
    const dates = getDeliveryDates(currentConfig);
    const deliveryOverride = deliveryDateBySupplier[currentSupplierId];
    const selectedDeliveryDate = deliveryOverride ? new Date(deliveryOverride) : dates.delivery;
    const selectedDeliveryFormatted = selectedDeliveryDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    const forecastEnd = new Date(selectedDeliveryDate);
    forecastEnd.setDate(selectedDeliveryDate.getDate() - 1);
    const windowForecast = getForecastForWindow(forecastEnd, dailyCovers);
    
    return (
      <div className="min-h-screen bg-[#FCEEB5] p-4 md:p-8 font-sans text-xs relative">
        {showResetConfirm && <ResetConfirmModal onConfirm={performReset} onClose={() => setShowResetConfirm(false)} />}
        
        {/* HEADER */}
        <div className="max-w-[1600px] mx-auto mb-6">
            <div className="bg-white/90 backdrop-blur-xl rounded-[32px] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-white flex flex-col lg:flex-row items-center justify-between gap-6">
                <div className="flex flex-col gap-1">
                    <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-3">
                        <span className="w-12 h-12 bg-slate-900 rounded-full flex items-center justify-center text-[#ffd700] shadow-lg shadow-slate-900/20">
                           {view === 'doquet' && <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>}
                           {view === 'vins' && <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/></svg>}
                           {(view === 'viandes' || view === 'domafrais') && <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/></svg>}
                           {view === 'domafrais_bof' && <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>}
                        </span>
                        {currentConfig.name}
                    </h1>
                    <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest pl-16">
                        {view === 'doquet' ? "Softs • Jus • Cocktails" : (view === 'vins' ? "Cave • Alcools" : (view === 'viandes' ? "Boucherie • Grill" : (view === 'domafrais' ? "Viandes • Volailles" : "Crémerie • Fromages")))}
                    </p>
                </div>

                <div className="flex gap-2 bg-[#FCEEB5] p-1.5 rounded-2xl border border-white/50">
                    <button onClick={() => setCalculationMode('margin')} className={`px-6 py-3 rounded-xl font-black uppercase text-[10px] transition-all flex items-center gap-2 ${calculationMode === 'margin' ? 'bg-white text-orange-600 shadow-md ring-1 ring-orange-50' : 'text-slate-400 hover:text-slate-600'}`}>
                        <div className={`w-2 h-2 rounded-full ${calculationMode === 'margin' ? 'bg-orange-500' : 'bg-slate-300'}`}></div>
                        Mode Marge
                    </button>
                    <button onClick={() => setCalculationMode('target')} className={`px-6 py-3 rounded-xl font-black uppercase text-[10px] transition-all flex items-center gap-2 ${calculationMode === 'target' ? 'bg-white text-blue-600 shadow-md ring-1 ring-blue-50' : 'text-slate-400 hover:text-slate-600'}`}>
                        <div className={`w-2 h-2 rounded-full ${calculationMode === 'target' ? 'bg-blue-500' : 'bg-slate-300'}`}></div>
                        Mode Cible
                    </button>
                </div>

                <div className="flex gap-4">
                    <div className="bg-emerald-50/50 px-6 py-3 rounded-2xl border border-emerald-100/50 flex flex-col items-center min-w-[120px] relative">
                        <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-1">Livraison</span>
                        <button
                          onClick={(e) => {
                            // Stocke la position du bouton pour afficher le calendrier au premier plan, au bon endroit
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            setCalendarAnchorRectBySupplier(prev => ({ ...prev, [currentSupplierId]: rect }));
                            setActiveCalendarSupplier(prev => (prev === currentSupplierId ? null : currentSupplierId));
                          }}
                          className="mt-1 flex items-center gap-2 px-3 py-1.5 bg-white/70 hover:bg-white rounded-xl border border-emerald-100 transition-colors"
                        >
                          <span className="font-black text-emerald-900 text-sm">{capitalizeFirstLetter(selectedDeliveryFormatted)}</span>
                          <svg className={`w-4 h-4 text-emerald-400 transition-transform ${activeCalendarSupplier === currentSupplierId ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"/></svg>
                        </button>
                        {activeCalendarSupplier === currentSupplierId && (
                          <WindowsCalendar
                            selectedDate={selectedDeliveryDate}
                            anchorRect={calendarAnchorRectBySupplier[currentSupplierId]}
                            onSelect={(d) => {
                              setDeliveryDateBySupplier(prev => ({ ...prev, [currentSupplierId]: d.toISOString() }));
                              setActiveCalendarSupplier(null);
                            }}
                            onClose={() => setActiveCalendarSupplier(null)}
                          />
                        )}
                    </div>
                    <div className="bg-indigo-50/50 px-6 py-3 rounded-2xl border border-indigo-100/50 flex flex-col items-center min-w-[120px]">
                        <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">Couverts Prévus</span>
                        <span className="font-black text-indigo-900 text-xl leading-none">{windowForecast.total}</span>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button onClick={() => setView('home')} className="w-12 h-12 rounded-2xl bg-[#FCEEB5] text-slate-400 hover:bg-slate-200 hover:text-slate-600 flex items-center justify-center transition-all shadow-sm" title="Retour Accueil">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
                    </button>
                    <button onClick={() => setView('suppliers')} className="w-12 h-12 rounded-2xl bg-[#FCEEB5] text-slate-400 hover:bg-slate-200 hover:text-slate-600 flex items-center justify-center transition-all shadow-sm" title="Retour Commandes">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
                    </button>
                    <button onClick={() => setShowResetConfirm(true)} className="px-6 py-3 bg-red-50 text-red-600 font-black uppercase text-[10px] tracking-widest rounded-2xl hover:bg-red-600 hover:text-white transition-all border border-red-100 shadow-sm hover:shadow-red-200">
                        RAZ
                    </button>
                </div>
            </div>
        </div>

        {/* TABLEAU */}
        <div className="max-w-[1600px] mx-auto pb-24">
            <div className="bg-white rounded-[32px] shadow-2xl shadow-slate-300/20 border border-slate-100 overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="text-left h-16">
                            <th className="px-6 bg-[#2c1810] text-[#ffd700] font-black uppercase text-xs tracking-widest w-1/4">Produit</th>
                            {calculationMode === 'margin' ? (
                                <>
                                    <th className="p-2 bg-[#FDBA74] text-white font-black uppercase text-[11px] tracking-widest text-center w-28">Besoin<br/>Théorique</th>
                                    <th className="p-2 bg-emerald-600 text-white font-black uppercase text-[11px] tracking-widest text-center w-32 shadow-lg z-10">Livraison<br/>à venir</th>
                                    <th className="p-2 bg-amber-600 text-white font-black uppercase text-[11px] tracking-widest text-center w-32 shadow-lg z-10">Stock<br/>Actuel</th>
                                    <th className="p-2 bg-[#FDBA74] text-white font-black uppercase text-[11px] tracking-widest text-center w-24">Colisage</th>
                                    <th className="p-2 bg-[#FDBA74] text-white font-black uppercase text-[11px] tracking-widest text-center w-28">Marge de<br/>Sécurité (%)</th>
                                    <th className="px-4 bg-slate-900 text-white font-black uppercase text-xs tracking-widest text-center w-40">A Commander</th>
                                </>
                            ) : (
                                <>
                                    <th className="p-2 bg-blue-600 text-white font-black uppercase text-[11px] tracking-widest text-center w-32 shadow-lg z-10">Stock Cible<br/>(Unités)</th>
                                    <th className="p-2 bg-amber-600 text-white font-black uppercase text-[11px] tracking-widest text-center w-32 shadow-lg z-10">Stock<br/>Actuel</th>
                                    <th className="p-2 bg-[#FDBA74] text-white font-black uppercase text-[11px] tracking-widest text-center w-24">Consommation<br/>Estimée</th>
                                    <th className="p-2 bg-[#FDBA74] text-white font-black uppercase text-[11px] tracking-widest text-center w-24">Manque</th>
                                    <th className="p-2 bg-[#FDBA74] text-white font-black uppercase text-[11px] tracking-widest text-center w-24">Colisage</th>
                                    <th className="px-4 bg-slate-900 text-white font-black uppercase text-xs tracking-widest text-center w-40">A Commander</th>
                                </>
                            )}
                        </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-slate-200">
                        {displayedProducts.map((p, idx) => {
                             const { avgRatio } = getProductStats(p);
                             const stockSafe = Number(p.stock) || 0;
                             const upcomingSafe = Number(p.upcomingDelivery) || 0;
                             const targetSafe = Number(p.targetStock) || 0;

                             let toOrder = 0;
                             let displayInfo1 = null; // Theo need / Conso est
                             let displayInfo2 = null; // Manque

                             if (calculationMode === 'margin') {
                                 const dynamicTheo = Math.ceil(avgRatio * windowForecast.total);
                                 const currentMargin = orderStates[p.id]?.margin ?? 30;
                                 const res = calculateOrder(dynamicTheo, upcomingSafe, stockSafe, currentMargin, p.packaging);
                                 toOrder = res.toOrder;
                                 displayInfo1 = dynamicTheo;
                             } else {
                                 const estimatedConsumption = Math.ceil(avgRatio * windowForecast.total);
                                 const res = calculateTargetOrder(targetSafe, p.stock, estimatedConsumption, p.packaging);
                                 toOrder = res.toOrder;
                                 displayInfo1 = estimatedConsumption;
                                 displayInfo2 = res.missing;
                             }

                             return (
                                <tr key={p.id} className="hover:bg-amber-50/40 transition-colors group">
                                    <td className="px-6 py-4 font-['Roboto_Slab'] font-bold text-slate-800 text-sm border-r-2 border-slate-100">
                                        {capitalizeFirstLetter(p.name)}
                                    </td>

                                    {calculationMode === 'margin' ? (
                                        <>
                                            <td className="p-2 text-center font-bold text-slate-700 text-sm bg-[#FFE8CC]">{displayInfo1}</td>
                                            
                                            {/* INPUT LIVRAISON */}
                                            <td className="p-2 bg-emerald-50/20">
                                                <div className="relative group/input">
                                                    <input 
                                                        type="number" 
                                                        value={p.upcomingDelivery} 
                                                        onChange={(e) => updateProductValue(p.id, 'upcomingDelivery', e.target.value)} 
                                                        className="w-full h-10 rounded-lg border border-emerald-200/50 bg-white text-center font-black text-emerald-700 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all placeholder-emerald-100/50 shadow-sm"
                                                        placeholder="-" 
                                                    />
                                                </div>
                                            </td>

                                            {/* INPUT STOCK */}
                                            <td className="p-2 bg-amber-50/20">
                                                <div className="relative group/input">
                                                    <input 
                                                        type="number" 
                                                        value={p.stock} 
                                                        onChange={(e) => updateProductValue(p.id, 'stock', e.target.value)} 
                                                        className="w-full h-10 rounded-lg border border-amber-200/50 bg-white text-center font-black text-amber-700 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all placeholder-amber-100/50 shadow-sm"
                                                        placeholder="-" 
                                                    />
                                                </div>
                                            </td>

                                            {/* INPUT CONDITIONNEMENT (Editable) */}
                                            <td className="p-2 text-center bg-[#FFE8CC]">
                                               <input 
                                                    type="number" 
                                                    value={p.packaging} 
                                                    onChange={(e) => updateProductValue(p.id, 'packaging', e.target.value)} 
                                                    className="w-16 text-center bg-white/50 border border-slate-200 rounded-lg focus:bg-white focus:border-indigo-500 font-bold text-slate-600 text-sm outline-none transition-all py-1 hover:border-slate-300"
                                                />
                                            </td>
                                            
                                            <td className="p-2 text-center bg-[#FFE8CC]">
                                                <select 
                                                    value={orderStates[p.id]?.margin ?? 30} 
                                                    onChange={e => setOrderStates(pv => ({...pv, [p.id]: { ...pv[p.id], margin: Number(e.target.value) }}))} 
                                                    className="bg-white/80 border border-slate-300 text-slate-700 font-bold text-sm py-1 px-2 rounded-lg outline-none cursor-pointer hover:border-slate-400 shadow-sm"
                                                >
                                                    {[0,5,10,15,20,25,30,35,40,45,50].map(o => <option key={o} value={o}>{o}%</option>)}
                                                </select>
                                            </td>

                                            <td className="p-2 text-center border-l-2 border-slate-200">
                                                <div className={`inline-flex items-center justify-center w-14 h-10 rounded-xl font-black text-lg shadow-sm transition-all ${toOrder > 0 ? 'bg-orange-500 text-white shadow-orange-200 scale-110' : 'bg-slate-100 text-slate-300 scale-90 opacity-50'}`}>
                                                    {toOrder}
                                                </div>
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                             {/* INPUT CIBLE */}
                                            <td className="p-2 relative bg-blue-50/20">
                                                <input 
                                                    type="number" 
                                                    value={p.targetStock} 
                                                    onChange={(e) => updateProductValue(p.id, 'targetStock', e.target.value)} 
                                                    className="w-full h-10 rounded-lg border border-blue-200/50 bg-white text-center font-black text-blue-700 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all placeholder-blue-100/50 shadow-sm"
                                                    placeholder="-" 
                                                />
                                                 {Number(p.packaging) > 1 && targetSafe > 0 && (
                                                    <div className="absolute top-3 right-4 text-[8px] font-bold text-blue-400 bg-blue-50 px-1.5 py-0.5 rounded-md pointer-events-none">
                                                        {(targetSafe / (Number(p.packaging) || 1)).toFixed(1)} cs
                                                    </div>
                                                )}
                                            </td>

                                            {/* INPUT STOCK */}
                                            <td className="p-2 bg-amber-50/20">
                                                <input 
                                                    type="number" 
                                                    value={p.stock} 
                                                    onChange={(e) => updateProductValue(p.id, 'stock', e.target.value)} 
                                                    className="w-full h-10 rounded-lg border border-amber-200/50 bg-white text-center font-black text-amber-700 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all placeholder-amber-100/50 shadow-sm"
                                                    placeholder="-" 
                                                />
                                            </td>

                                            <td className="p-2 text-center bg-[#FFE8CC]">
                                                <span className="text-slate-600 font-bold text-sm">{displayInfo1}</span>
                                            </td>
                                            <td className="p-2 text-center bg-[#FFE8CC]">
                                                {displayInfo2 !== null && displayInfo2 > 0 ? (
                                                     <span className="text-red-600 font-black bg-white/50 border border-red-200 px-2 py-0.5 rounded text-sm">-{displayInfo2}</span>
                                                ) : (
                                                    <span className="text-slate-400 text-sm">-</span>
                                                )}
                                            </td>

                                            {/* INPUT CONDITIONNEMENT (Editable) */}
                                            <td className="p-2 text-center bg-[#FFE8CC]">
                                                <input 
                                                    type="number" 
                                                    value={p.packaging} 
                                                    onChange={(e) => updateProductValue(p.id, 'packaging', e.target.value)} 
                                                    className="w-16 text-center bg-white/50 border border-slate-200 rounded-lg focus:bg-white focus:border-indigo-500 font-bold text-slate-600 text-sm outline-none transition-all py-1 hover:border-slate-300"
                                                />
                                            </td>

                                            <td className="p-2 text-center border-l-2 border-slate-200">
                                                 <div className={`inline-flex items-center justify-center w-14 h-10 rounded-xl font-black text-lg shadow-sm transition-all ${toOrder > 0 ? 'bg-blue-600 text-white shadow-blue-200 scale-110' : 'bg-slate-100 text-slate-300 scale-90 opacity-50'}`}>
                                                    {toOrder}
                                                </div>
                                            </td>
                                        </>
                                    )}
                                </tr>
                             );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
      </div>
    );
  }

  // --- PAGES PARAMETRES ET RATIOS ---
  if (view === 'ratios') {
    const displayedRatioProducts = products.filter(p => p.supplierId === ratioTab);
    
    return (
    <div className="min-h-screen bg-[#f1f5f9] p-4 pb-12 font-sans text-[10px]">
      <div className="max-w-full"><div className="flex items-center justify-between mb-8 bg-white p-6 rounded-[30px] shadow-2xl border border-slate-200 min-w-[1200px]">
        <div className="flex gap-4">
          <button onClick={() => setView('stats')} className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black uppercase text-[11px] hover:bg-black shadow-xl">Retour Paramètres</button>
          <button onClick={addNewProduct} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black uppercase text-[11px] hover:bg-indigo-700 shadow-xl flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4"/></svg>Ajouter Produit
          </button>
          {selectedProductIds.size > 0 && (
            <button onClick={deleteSelectedProducts} className="bg-red-600 text-white px-8 py-3 rounded-2xl font-black uppercase text-[11px] hover:bg-red-700 shadow-xl flex items-center gap-2">
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
               Supprimer ({selectedProductIds.size})
            </button>
          )}
        </div>
        
        {/* TABS DE SELECTION */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
            <button onClick={() => setRatioTab('doquet')} className={`px-6 py-2 rounded-xl font-black uppercase text-[11px] transition-all ${ratioTab === 'doquet' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>Doquet</button>
            <button onClick={() => setRatioTab('vins')} className={`px-6 py-2 rounded-xl font-black uppercase text-[11px] transition-all ${ratioTab === 'vins' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>Richard Vins</button>
            <button onClick={() => setRatioTab('viandes')} className={`px-6 py-2 rounded-xl font-black uppercase text-[11px] transition-all ${ratioTab === 'viandes' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>Plaine Maison</button>
            <button onClick={() => setRatioTab('domafrais')} className={`px-6 py-2 rounded-xl font-black uppercase text-[11px] transition-all ${ratioTab === 'domafrais' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>Domafrais Viandes</button>
            <button onClick={() => setRatioTab('domafrais_bof')} className={`px-6 py-2 rounded-xl font-black uppercase text-[11px] transition-all ${ratioTab === 'domafrais_bof' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>Domafrais B.O.F</button>
        </div>

        <div className="text-center"><h1 className="text-2xl font-black uppercase tracking-tighter text-slate-800">Intelligence de Vente <span className="text-indigo-600">2026</span></h1></div>
      </div>
      {/* IMPORTANT: overflow-y-visible pour que le popover de mapping ne soit jamais coupé */}
      <div ref={ratiosScrollRef} onScroll={() => syncRatiosScroll('main')} className="bg-white border border-slate-200 rounded-[40px] shadow-2xl overflow-x-auto overflow-y-visible custom-scrollbar">
        <table className="border-collapse min-w-[3400px]">
          <thead><tr className="bg-slate-900 text-white">
            <th className="border-r border-slate-700 p-5 text-center w-16 sticky left-0 z-40 bg-slate-900 font-black text-xs" rowSpan={3}>
              <input type="checkbox" className="w-5 h-5 accent-indigo-500 cursor-pointer" checked={displayedRatioProducts.length > 0 && selectedProductIds.size === displayedRatioProducts.length} onChange={() => setSelectedProductIds(selectedProductIds.size === displayedRatioProducts.length ? new Set() : new Set(displayedRatioProducts.map(p => p.id)))} />
            </th>
            <th className="border-r border-slate-700 p-5 text-left w-[420px] sticky left-16 z-30 bg-slate-900 font-black text-sm" rowSpan={3}>Produit Hippopotamus</th>
            <th className="border-r border-slate-700 p-5 text-left w-64 sticky left-[31.5rem] z-30 bg-slate-900 font-black text-sm shadow-2xl" rowSpan={3}>Mapping Import</th>
            <th className="border-r border-slate-700 p-5 text-center w-40 bg-slate-900 font-black text-sm" rowSpan={3}>÷ KG→U</th>
            <th className="border-b border-slate-700 p-3 bg-blue-600 text-white font-black uppercase tracking-widest text-[12px]" colSpan={12}>Volumes de Ventes</th>
            <th className="border-b border-slate-700 p-3 bg-emerald-600 text-white font-black uppercase tracking-widest text-[12px]" colSpan={12}>Analyse Ratios</th>
            <th className="p-3 bg-amber-500 font-black text-xs text-white" rowSpan={3}>Moyenne Ratios</th>
          </tr><tr className="bg-slate-800 text-white">
            {MONTHS_ORDER.map(m => <th key={m} className={`border-r border-slate-700 p-2 min-w-[100px] text-[9px] font-black ${validatedMonths[m] ? 'bg-indigo-900' : ''}`}>{m.toUpperCase()}</th>)}
            {MONTHS_ORDER.map(m => <th key={m+'r'} className="border-r border-slate-700 p-2 min-w-[100px] text-[9px] font-black">{m.toUpperCase()}</th>)}
          </tr><tr className="bg-slate-700 text-white">
            {MONTHS_ORDER.map(m => <th key={m+'b'} className={`border-r border-slate-600 p-2 ${validatedMonths[m] ? 'bg-indigo-800' : ''}`}><button onClick={() => toggleVal(m)} className={`w-full py-2 px-3 rounded-lg font-black text-[9px] uppercase ${validatedMonths[m] ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>{validatedMonths[m] ? 'Figé' : 'Valider'}</button></th>)}
            {MONTHS_ORDER.map(m => <th key={m+'ri'} className="border-r border-slate-600 p-2 bg-emerald-900/20 text-[8px] italic">Auto-Calcul</th>)}
          </tr></thead>
          <tbody>{displayedRatioProducts.map((p, idx) => {
            const { avgRatio, mR, mS } = getProductStats(p), isMapped = Array.from(allAvailableImportNames).includes(p.searchName);
            const alert = !isMapped && p.searchName.trim().length > 0;
            return (<tr key={p.id} className={`hover:bg-slate-50 border-b border-slate-100 h-16 group transition-colors ${selectedProductIds.has(p.id) ? 'bg-indigo-50/30' : ''}`}>
              <td className="border-r border-slate-200 text-center sticky left-0 z-20 bg-inherit"><input type="checkbox" className="w-5 h-5 accent-indigo-600 cursor-pointer" checked={selectedProductIds.has(p.id)} onChange={() => toggleProductSelection(p.id)} /></td>
              <td className="border-r border-slate-200 p-0 bg-inherit sticky left-16 z-20 font-black uppercase text-[11px]">
                <div className="flex items-center w-full h-full pr-4 gap-2">
                  <input className="flex-1 h-full bg-transparent px-4 outline-none focus:bg-white font-black text-slate-900" value={p.name} placeholder="NOM PRODUIT..." onChange={e => handleNameChange(p.id, e.target.value)} />
                  <div className="flex flex-col items-center justify-center gap-1 opacity-20 group-hover:opacity-100 transition-opacity pr-2">
                    <button onClick={() => moveProduct(p.id, 'up')} disabled={idx === 0} className="text-[#ffd700] hover:text-white disabled:opacity-0 active:scale-110 p-1 bg-slate-900 rounded shadow-md border border-[#ffd700]/20"><svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"/></svg></button>
                    <button onClick={() => moveProduct(p.id, 'down')} disabled={idx === displayedRatioProducts.length - 1} className="text-[#ffd700] hover:text-white disabled:opacity-0 active:scale-110 p-1 bg-slate-900 rounded shadow-md border border-[#ffd700]/20"><svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg></button>
                  </div>
                </div>
              </td>
              <td className={`border-r border-slate-200 p-0 bg-inherit sticky left-[31.5rem] shadow-2xl ${activeMappingId === p.id ? 'z-[9999]' : 'z-20'}`}><div className="w-full h-full flex items-center px-4 relative"><input className={`flex-1 h-full bg-transparent outline-none font-bold italic text-[11px] ${alert ? 'text-amber-600' : 'text-slate-500'}`} value={p.searchName} onChange={e => setProducts(pv => pv.map(pro => pro.id === p.id ? { ...pro, searchName: e.target.value } : pro))} />{alert && <button onClick={() => setActiveMappingId(activeMappingId === p.id ? null : p.id)} className="w-7 h-7 bg-amber-100 hover:bg-amber-200 rounded-full flex items-center justify-center text-amber-600 ml-2"><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z"/></svg></button>}{activeMappingId === p.id && <MappingPopover orphanNames={Array.from(allAvailableImportNames).filter(n => !products.some(pr => pr.searchName === n))} onSelect={n => setProducts(pv => pv.map(pro => pro.id === p.id ? { ...pro, searchName: n } : pro))} onClose={() => setActiveMappingId(null)} />}</div></td>
              <td className="border-r border-slate-100 p-0 bg-inherit">
                <div className="w-full h-full flex items-center justify-center px-2 relative">
                  <input
                    type="number"
                    value={(p.importDivisor ?? '') as any}
                    onChange={e => setProducts(pv => pv.map(pro => pro.id === p.id ? { ...pro, importDivisor: (e.target.value === '' ? '' : Number(e.target.value)) } : pro))}
                    className="w-24 h-10 bg-white/70 border border-slate-200 rounded-xl text-center font-black text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all text-[11px]"
                    placeholder=""
                  />
                </div>
              </td>
              {MONTHS_ORDER.map(m => <td key={m} className={`border-r border-slate-100 p-2 text-center text-[12px] font-black ${mS[m].isValidated ? 'text-indigo-800 bg-indigo-50/50' : mS[m].isImported ? 'text-indigo-600' : 'text-slate-400'}`}>{mS[m].value}</td>)}
              {MONTHS_ORDER.map(m => <td key={m+'rv'} className="border-r border-slate-100 p-2 text-center font-mono text-[11px] text-emerald-700 font-bold bg-emerald-50/10">{mR[m].toFixed(4)}</td>)}
              <td className="p-2 text-center font-black bg-amber-50 text-amber-700 text-sm shadow-inner">{avgRatio.toFixed(4)}</td>
            </tr>);
          })}</tbody>
        </table>
      </div></div>
    
      {/* Barre de défilement horizontale toujours visible */}
      <div ref={ratiosBottomScrollRef} onScroll={() => syncRatiosScroll('bottom')} className="fixed bottom-2 left-4 right-4 h-5 overflow-x-auto overflow-y-hidden bg-white/85 backdrop-blur border border-slate-200 rounded-full shadow-lg z-[9999]">
        <div style={{ width: ratiosScrollWidth }} />
      </div>
</div>
    );
  }

  return <HomePage setView={setView} />;
};

export default App;