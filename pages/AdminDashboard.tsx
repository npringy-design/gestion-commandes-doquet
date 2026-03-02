// =============================================================
// pages/AdminDashboard.tsx
// Page tableau de bord admin (accessible après PIN)
// Extraite de App.tsx
// =============================================================

import React from 'react';
import { View } from '../constants';

interface AdminDashboardProps {
  setView: (v: View) => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ setView }) => (
  <div className="min-h-screen bg-[#1a0f0a] p-4 sm:p-8 lg:p-12 relative overflow-hidden">
    <div className="max-w-6xl mx-auto relative z-10">
      <div className="flex justify-between items-center mb-16">
        <h1 className="text-[#ffd700] text-6xl font-black uppercase tracking-tighter leading-none">
          ADMIN DASHBOARD
        </h1>
        <button
          onClick={() => setView('home')}
          className="px-8 py-4 bg-white/5 text-white border border-white/10 rounded-2xl hover:bg-white/10 font-black uppercase text-xs tracking-widest transition-all"
        >
          Retour Accueil
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <button
          onClick={() => setView('supplier_settings')}
          className="bg-white/5 border border-white/10 p-10 rounded-[40px] text-left hover:border-[#ffd700] transition-all group"
        >
          <h3 className="text-white text-2xl font-black uppercase mb-2">Rotations Fournisseurs</h3>
          <p className="text-white/40 font-bold uppercase text-[9px] tracking-widest">
            Jours de cut-off et livraisons
          </p>
        </button>
      </div>
    </div>
  </div>
);

export default AdminDashboard;
