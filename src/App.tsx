import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { DOQUET_PRODUCTS, VINS_PRODUCTS, VIANDES_PRODUCTS, DOMAFRAIS_PRODUCTS, DOMAFRAIS_BOF_PRODUCTS, DOMAFRAIS_SURGELE_PRODUCTS, MONTHLY_COVERS as INITIAL_COVERS, DOQUET_CONFIG, VINS_CONFIG, VIANDES_CONFIG, DOMAFRAIS_CONFIG, DOMAFRAIS_BOF_CONFIG, DOMAFRAIS_SURGELE_CONFIG, ProductWithHistory, DAILY_COVERS_INITIAL } from './data';
import { OrderState, Calculations, SupplierConfig, Product } from './types';
import * as XLSX from 'xlsx';

// --- Types de Navigation ---
type View = 'home' | 'suppliers' | 'doquet' | 'vins' | 'viandes' | 'domafrais' | 'domafrais_bof' | 'domafrais_surgele' | 'stats' | 'ratios' | 'daily_forecast' | 'admin_dashboard' | 'supplier_settings' | 'cost_analysis';

interface DailyCover {
  midi: number | "";
  soir: number | "";
}

type DailyCoversState = Record<string, DailyCover[]>;

const MONTHS_ORDER = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DAYS_OF_WEEK = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

const MONTHS_DISPLAY_CONFIG = [
  { label: "JANVIER", key: "jan" }, { label: "FÉVRIER", key: "feb" }, { label: "MARS", key: "mar" },
  { label: "AVRIL", key: "apr" }, { label: "MAI", key: "may" }, { label: "JUIN", key: "jun" },
  { label: "JUILLET", key: "jul" }, { label: "AOÛT", key: "aug" }, { label: "SEPTEMBRE", key: "sep" },
  { label: "OCTOBRE", key: "oct" }, { label: "NOVEMBRE", key: "nov" }, { label: "DÉCEMBRE", key: "dec" }
];

// --- Helpers ---
const getImportedValueForProduct = (csvData: string | undefined, searchName: string): number | null => {
  if (!csvData) return null;
  const rows = csvData.split('\n').filter(r => r.trim()).map(r => r.split(','));
  if (rows.length < 2) return null;
  const header = rows[0].map(h => h.trim().toLowerCase());
  const consoIdx = header.indexOf("conso théorique qté");
  if (consoIdx === -1) return null;
  const targetRow = rows.find(row => row.some(cell => cell.trim().toLowerCase() === searchName.toLowerCase()));
  if (targetRow && targetRow[consoIdx]) {
    const rawVal = parseFloat(targetRow[consoIdx].replace(/[^\d.-]/g, ''));
    return isNaN(rawVal) ? 0 : Math.round(rawVal);
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

// Mode "stock cible" — reproduction de la formule Excel.
// `targetStockCases` = F (stock cible en caisses), `packaging` = H (unités/caisse), G = F*H.
// Mode "stock cible" — basé sur ta logique Excel, mais `targetStockUnits` est un stock cible en **unités** (comme dans l'app).
// On dérive le cap en caisses via le colisage (cap = ARRONDI.SUP(targetUnits/colisage)).
const calculateTargetOrder = (
  targetStockUnits: number,
  currentStockVal: number | string | undefined,
  consumption: number,
  packaging: number | string
) => {
  if (currentStockVal === "" || currentStockVal === undefined) {
    return { projectedStock: 0, missing: 0, toOrder: 0 };
  }
  const stock = Number(currentStockVal) || 0;
  const pkgVal = Number(packaging);
  const safePkg = pkgVal > 0 ? pkgVal : 1;

  const targetUnits = Number(targetStockUnits) || 0; // stock cible (unités)
  const capCases = safePkg > 0 ? Math.ceil(targetUnits / safePkg) : 0; // stock cible (caisses) dérivé

  // E - MIN(I;E)  (on "cape" la conso au stock réel)
  const remainingAfterCappedConso = stock - Math.min(consumption, stock);
  const isRupture = (stock - consumption) <= 0; // E-I<=0

  // (G+H) si rupture, sinon G  — ici G = targetUnits, H = colisage
  const desiredUnits = isRupture ? (targetUnits + safePkg) : targetUnits;

  const needUnits = desiredUnits - remainingAfterCappedConso;
  const rawCases = safePkg > 0 ? Math.ceil(needUnits / safePkg) : 0;

  // cap: F (+1 si rupture)
  const cap = isRupture ? (capCases + 1) : capCases;
  const toOrder = Math.min(cap, Math.max(0, rawCases));

  const projectedStock = Math.max(0, remainingAfterCappedConso);
  const missing = Math.max(0, targetUnits - projectedStock);
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
  return (
    <div ref={popoverRef} className="absolute right-0 bottom-full mb-3 z-[100] bg-white border border-slate-200 p-3 rounded-xl shadow-2xl w-72 animate-in slide-in-from-bottom-2">
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

const StatsPage: React.FC<{
  setView: (v: View) => void;
  totalForecast: number;
  covers: Record<string, number>;
  setCovers: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  detailedInventory: Record<string, string>;
  setDetailedInventory: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  products: ProductWithHistory[];
  validatedMonths: Record<string, boolean>;
}> = ({ setView, totalForecast, covers, setCovers, detailedInventory, setDetailedInventory, gapInventory, setGapInventory, products, validatedMonths }) => {
  const [importModal, setImportModal] = useState<{ isOpen: boolean; month: string; type: 'gap' | 'detailed' }>({ isOpen: false, month: 'jan', type: 'detailed' });

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (importModal.type === 'detailed') {
        setDetailedInventory(prev => ({ ...prev, [importModal.month]: content }));
      } else {
        setGapInventory(prev => ({ ...prev, [importModal.month]: content }));
      }
      setImportModal({ ...importModal, isOpen: false });
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-[#2c1810] p-8 flex font-sans">
      {importModal.isOpen && <ImportModal monthLabel={MONTHS_DISPLAY_CONFIG.find(m => m.key === importModal.month)?.label || ''} onClose={() => setImportModal({ ...importModal, isOpen: false })} onFileSelected={handleFile} type={importModal.type} />}
      
      {/* Sidebar */}
      <div className="w-64 flex flex-col justify-between shrink-0 mr-8">
        <button 
          onClick={() => setView('home')} 
          className="bg-[#FFD700] text-black font-black py-4 px-6 rounded-2xl uppercase tracking-widest shadow-lg hover:bg-[#ffed4a] transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
          Retour Accueil
        </button>

        <div className="flex flex-col gap-4">
          <button 
            onClick={() => setView('daily_forecast')}
            className="bg-[#93C47D] text-white font-black py-6 px-6 rounded-2xl uppercase tracking-wide shadow-lg hover:bg-[#7db066] transition-colors text-center leading-tight"
          >
            Prévisionnel<br/>Couverts
          </button>
          <button 
            onClick={() => setView('ratios')}
            className="bg-[#4A86E8] text-white font-black py-6 px-6 rounded-2xl uppercase tracking-wide shadow-lg hover:bg-[#3a75d5] transition-colors text-center leading-tight"
          >
            Calcul<br/>Vente Ratio
          </button>
        </div>
      </div>

      {/* Main Content - 3 Columns */}
      <div className="flex-1 grid grid-cols-3 gap-6 h-full">
        
        {/* Column 1: Écart d'inventaire (Pink) */}
        <div className="flex flex-col rounded-[30px] overflow-hidden">
          <div className="bg-[#E6B8AF] py-4 text-center">
            <h2 className="text-[#2c1810] font-black uppercase tracking-widest text-lg">Écart d'Inventaire</h2>
          </div>
          <div className="bg-[#FBE5D6] flex-1 p-4 overflow-y-auto custom-scrollbar flex flex-col gap-3">
            {MONTHS_DISPLAY_CONFIG.map(m => (
              <div key={m.key} className="flex items-center justify-between border-b border-[#E6B8AF] pb-2 last:border-0">
                <span className="text-[#2c1810] font-black uppercase text-sm">{m.label}</span>
                <button 
                  onClick={() => setImportModal({ isOpen: true, month: m.key, type: 'gap' })}
                  className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${gapInventory[m.key] ? 'bg-[#2c1810] border-[#2c1810] text-[#FBE5D6]' : 'border-[#2c1810]/30 text-[#2c1810]/50 hover:border-[#2c1810] hover:text-[#2c1810]'}`}
                >
                   {gapInventory[m.key] ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg> : "+"}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Column 2: Inventaire Détaillé (Orange) */}
        <div className="flex flex-col rounded-[30px] overflow-hidden">
          <div className="bg-[#F4B084] py-4 text-center">
            <h2 className="text-[#2c1810] font-black uppercase tracking-widest text-lg">Inventaire Détaillé</h2>
          </div>
          <div className="bg-[#FDE9D9] flex-1 p-4 overflow-y-auto custom-scrollbar flex flex-col gap-3">
            {MONTHS_DISPLAY_CONFIG.map(m => (
              <div key={m.key} className="flex items-center justify-between border-b border-[#F4B084] pb-2 last:border-0">
                <span className="text-[#2c1810] font-black uppercase text-sm">{m.label}</span>
                <button 
                  onClick={() => setImportModal({ isOpen: true, month: m.key, type: 'detailed' })}
                  className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${detailedInventory[m.key] ? 'bg-[#2c1810] border-[#2c1810] text-[#FDE9D9]' : 'border-[#2c1810]/30 text-[#2c1810]/50 hover:border-[#2c1810] hover:text-[#2c1810]'}`}
                >
                   {detailedInventory[m.key] ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg> : "+"}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Column 3: Couverts Réalisés (Yellow) */}
        <div className="flex flex-col rounded-[30px] overflow-hidden">
          <div className="bg-[#FFD966] py-4 text-center">
            <h2 className="text-[#2c1810] font-black uppercase tracking-widest text-lg">Couverts Réalisés</h2>
          </div>
          <div className="bg-[#FFF2CC] flex-1 p-4 overflow-y-auto custom-scrollbar flex flex-col gap-3">
            {MONTHS_DISPLAY_CONFIG.map(m => (
              <div key={m.key} className="flex items-center justify-between border-b border-[#FFD966] pb-2 last:border-0">
                <span className="text-[#2c1810] font-black uppercase text-sm">{m.label}</span>
                <input 
                  type="number" 
                  value={covers[m.key] || ''} 
                  onChange={e => setCovers(prev => ({...prev, [m.key]: parseInt(e.target.value) || 0}))} 
                  className="w-24 bg-white border-2 border-[#2c1810]/20 rounded-full py-1 px-3 text-center font-black text-[#2c1810] outline-none focus:border-[#2c1810] transition-all"
                  placeholder="0"
                />
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [view, setView] = useState<View>('home');

  if (view === 'home') return <HomePage setView={setView} />;
  if (view === 'admin_dashboard') return <AdminDashboard setView={setView} />;

  return (
    <div className="min-h-screen bg-[#1a0f0a] flex flex-col items-center justify-center p-8">
      <h2 className="text-[#ffd700] text-4xl font-black mb-8 uppercase">Navigation: {view.toUpperCase()}</h2>
      <button onClick={() => setView('home')} className="bg-white px-12 py-6 rounded-2xl font-black uppercase hover:scale-105 transition-all">Retour Cockpit</button>
    </div>
  );
};

// Add default export to fix module resolution error
export default App;