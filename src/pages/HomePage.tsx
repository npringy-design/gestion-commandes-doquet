// =============================================================
// pages/HomePage.tsx
// Page d'accueil principale de l'application
// Extraite de App.tsx
// =============================================================

import React, { useState } from 'react';
import { View } from '../constants';
import { PasswordModal } from '../components/Modals';

interface HomePageProps {
  setView: (v: View) => void;
}

const HomePage: React.FC<HomePageProps> = ({ setView }) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="min-h-screen bg-[#1a0f0a] flex flex-col items-center justify-center p-8 relative overflow-hidden">
      {showPassword && (
        <PasswordModal
          onConfirm={() => { setShowPassword(false); setView('admin_dashboard'); }}
          onClose={() => setShowPassword(false)}
        />
      )}

      {/* Texture de fond */}
      <div
        className="absolute inset-0 z-0 opacity-20 pointer-events-none"
        style={{ backgroundImage: `url('https://www.transparenttextures.com/patterns/brick-wall.png')` }}
      />

      <div className="z-10 text-center max-w-5xl">
        {/* Titre */}
        <div className="mb-12">
          <h1 className="text-[#ffd700] text-8xl font-black uppercase tracking-tighter leading-none mb-4">
            HIPPO<br/><span className="text-white">COMMANDES</span>
          </h1>
          <div className="h-2 w-48 bg-red-600 mx-auto rounded-full" />
        </div>

        {/* Boutons principaux */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <button
            onClick={() => setView('suppliers')}
            className="group bg-white p-8 rounded-[40px] shadow-2xl hover:scale-105 transition-all border-4 border-transparent hover:border-red-600"
          >
            <div className="w-16 h-16 bg-red-100 rounded-3xl flex items-center justify-center mb-4 mx-auto group-hover:bg-red-600 transition-colors">
              <svg className="w-8 h-8 text-red-600 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/>
              </svg>
            </div>
            <span className="text-2xl font-black uppercase text-slate-800 tracking-tighter">Commandes</span>
          </button>

          <button
            onClick={() => setView('stats')}
            className="group bg-white p-8 rounded-[40px] shadow-2xl hover:scale-105 transition-all border-4 border-transparent hover:border-amber-500"
          >
            <div className="w-16 h-16 bg-amber-100 rounded-3xl flex items-center justify-center mb-4 mx-auto group-hover:bg-amber-500 transition-colors">
              <svg className="w-8 h-8 text-amber-600 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
              </svg>
            </div>
            <span className="text-2xl font-black uppercase text-slate-800 tracking-tighter">Paramètres</span>
          </button>

          <button
            onClick={() => setView('cost_analysis')}
            className="group bg-white p-8 rounded-[40px] shadow-2xl hover:scale-105 transition-all border-4 border-transparent hover:border-orange-600"
          >
            <div className="w-16 h-16 bg-orange-100 rounded-3xl flex items-center justify-center mb-4 mx-auto group-hover:bg-orange-600 transition-colors">
              <svg className="w-8 h-8 text-orange-600 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"/>
              </svg>
            </div>
            <span className="text-2xl font-black uppercase text-slate-800 tracking-tighter">Analyse<br/>Coût Matière</span>
          </button>
        </div>

        {/* Accès admin discret */}
        <button
          onClick={() => setShowPassword(true)}
          className="flex items-center gap-4 mx-auto text-white/20 hover:text-[#ffd700] transition-colors"
        >
          <span className="font-black uppercase text-[11px] tracking-widest">Accès Dashboard Admin</span>
        </button>
      </div>
    </div>
  );
};

export default HomePage;
