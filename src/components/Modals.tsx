// =============================================================
// components/Modals.tsx
// Toutes les modales de l'application regroupées ici :
//   - ResetConfirmModal  : confirmation avant RAZ
//   - ImportModal        : drag & drop import fichier
//   - PasswordModal      : accès admin par code PIN
// Extraites de App.tsx
// =============================================================

import React, { useState, useRef, useCallback } from 'react';

// -----------------------------------------------------------
// ResetConfirmModal
// Demande confirmation avant d'effacer les saisies
// -----------------------------------------------------------
interface ResetConfirmModalProps {
  onConfirm: () => void;
  onClose:   () => void;
}

export const ResetConfirmModal: React.FC<ResetConfirmModalProps> = ({ onConfirm, onClose }) => (
  <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
    <div className="bg-white p-8 rounded-[40px] shadow-2xl max-w-sm w-full text-center border-4 border-[#ff0000]">
      <div className="w-20 h-20 bg-red-100 rounded-full mx-auto mb-6 flex items-center justify-center">
        <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
        </svg>
      </div>
      <h3 className="text-3xl font-black text-slate-800 mb-2 uppercase tracking-tight">Attention !</h3>
      <p className="font-bold text-slate-500 mb-8 uppercase text-xs tracking-wide">
        Voulez-vous vraiment effacer<br/>toutes les quantités saisies ?
      </p>
      <div className="flex gap-4 justify-center">
        <button
          onClick={onClose}
          className="flex-1 py-4 rounded-2xl font-black bg-slate-100 text-slate-500 hover:bg-slate-200 uppercase text-sm transition-colors"
        >
          Non
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 py-4 rounded-2xl font-black bg-[#ff0000] text-white hover:bg-red-700 shadow-[0_4px_0_#990000] active:translate-y-1 active:shadow-none uppercase text-sm transition-all"
        >
          Oui, Effacer
        </button>
      </div>
    </div>
  </div>
);

// -----------------------------------------------------------
// ImportModal
// Zone drag & drop pour importer un fichier CSV/XLSX
// -----------------------------------------------------------
interface ImportModalProps {
  monthLabel:     string;
  onClose:        () => void;
  onFileSelected: (file: File) => void;
  type:           'gap' | 'detailed';
}

export const ImportModal: React.FC<ImportModalProps> = ({
  monthLabel, onClose, onFileSelected, type,
}) => {
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDrag    = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); }, []);
  const handleDragIn  = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); if (e.dataTransfer.items?.length > 0) setIsDragging(true); }, []);
  const handleDragOut = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }, []);
  const handleDrop    = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    if (e.dataTransfer.files?.length > 0) onFileSelected(e.dataTransfer.files[0]);
  }, [onFileSelected]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length > 0) onFileSelected(e.target.files[0]);
  };

  const isGap = type === 'gap';

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[32px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] w-full max-w-[500px] overflow-hidden relative"
        onClick={e => e.stopPropagation()}
      >
        {/* En-tête coloré */}
        <div className={`p-8 text-center relative overflow-hidden ${isGap ? 'bg-[#e6b8af]' : 'bg-slate-900'}`}>
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)", backgroundSize: "16px 16px" }} />
          <h3 className={`${isGap ? 'text-[#783f04]' : 'text-white'} font-black text-2xl uppercase tracking-wider relative z-10`}>
            {isGap ? 'Importer Écart' : 'Importer Données'}
          </h3>
          <p className={`${isGap ? 'text-[#783f04]/70 border-[#783f04]/20' : 'text-indigo-400 border-indigo-500/30 bg-slate-800/50'} font-bold uppercase text-[10px] tracking-widest mt-2 relative z-10 inline-block px-3 py-1 rounded-full border`}>
            Mois de {monthLabel}
          </p>
          <button
            onClick={onClose}
            className={`absolute top-4 right-4 transition-colors rounded-full w-8 h-8 flex items-center justify-center ${isGap ? 'text-[#783f04]/50 hover:bg-[#783f04]/10' : 'text-white/30 hover:text-white bg-white/5 hover:bg-white/10'}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Zone de dépôt */}
        <div className="p-8">
          <div
            className={`border-3 border-dashed rounded-3xl h-64 flex flex-col items-center justify-center cursor-pointer transition-all gap-5 duration-300 group ${isDragging ? 'border-indigo-500 bg-indigo-50/50 scale-[1.02]' : 'border-slate-200 hover:border-indigo-400 hover:bg-slate-50'}`}
            onDragEnter={handleDragIn}
            onDragLeave={handleDragOut}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 shadow-xl ${isDragging ? 'bg-indigo-500 text-white shadow-indigo-500/30 scale-110' : 'bg-white text-indigo-500 shadow-slate-200 group-hover:scale-110 group-hover:text-indigo-600'}`}>
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
              </svg>
            </div>
            <div className="space-y-1 text-center">
              <p className="font-black text-slate-700 uppercase text-sm tracking-tight group-hover:text-slate-900 transition-colors">Glissez votre fichier ici</p>
              <p className="font-bold text-slate-400 uppercase text-[9px] tracking-widest">ou cliquez pour parcourir</p>
            </div>
            <div className="flex gap-2 mt-2">
              {['CSV', 'XLS', 'XLSX', 'TXT'].map(ext => (
                <span key={ext} className="px-2 py-1 bg-slate-100 rounded text-[9px] font-bold text-slate-400 uppercase">{ext}</span>
              ))}
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleChange}
              accept=".csv, .xlsx, .xls, .txt"
              className="hidden"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// -----------------------------------------------------------
// PasswordModal
// Accès admin par code PIN à 4 chiffres (clavier numérique)
// -----------------------------------------------------------
interface PasswordModalProps {
  onConfirm: () => void;
  onClose:   () => void;
}

export const PasswordModal: React.FC<PasswordModalProps> = ({ onConfirm, onClose }) => {
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState(false);

  const handleSubmit = (p: string = password) => {
    if (p === '1968') {
      onConfirm();
    } else {
      setError(true);
      setPassword('');
      setTimeout(() => setError(false), 1000);
    }
  };

  const addDigit = (d: string) => {
    if (password.length < 4) {
      const newP = password + d;
      setPassword(newP);
      if (newP.length === 4) handleSubmit(newP);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xl animate-in fade-in duration-300">
      <div className={`bg-[#1a0f0a] p-10 rounded-[50px] border-4 ${error ? 'border-red-600 animate-shake' : 'border-[#ffd700]'} shadow-[0_0_80px_rgba(255,215,0,0.15)] w-[340px]`}>
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-[#ffd700] rounded-full mx-auto mb-6 flex items-center justify-center shadow-[0_0_30px_rgba(255,215,0,0.4)]">
            <svg className="w-10 h-10 text-[#1a0f0a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
            </svg>
          </div>
          <h2 className="text-[#ffd700] font-black uppercase tracking-widest text-2xl">ACCÈS ADMIN</h2>
          <p className="text-white/30 text-[10px] uppercase font-bold mt-2 tracking-widest">Identité Hippopotamus requise</p>
        </div>

        {/* Indicateur de saisie */}
        <div className="flex justify-center gap-5 mb-12">
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className={`w-5 h-5 rounded-full border-2 border-[#ffd700] transition-all duration-300 ${password.length > i ? 'bg-[#ffd700] scale-125 shadow-[0_0_15px_rgba(255,215,0,0.6)]' : 'bg-transparent'}`}
            />
          ))}
        </div>

        {/* Clavier numérique */}
        <div className="grid grid-cols-3 gap-5">
          {['1','2','3','4','5','6','7','8','9','C','0','←'].map(key => (
            <button
              key={key}
              onClick={() => {
                if      (key === 'C') setPassword('');
                else if (key === '←') setPassword(p => p.slice(0, -1));
                else addDigit(key);
              }}
              className="h-16 rounded-2xl font-black text-2xl bg-white/5 text-white hover:bg-white/10 active:scale-90 transition-all border border-white/5"
            >
              {key}
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          className="w-full mt-10 text-white/30 font-black uppercase text-[10px] tracking-widest hover:text-white transition-colors"
        >
          Retour à l'accueil
        </button>
      </div>
    </div>
  );
};
