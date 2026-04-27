// =============================================================
// pages/AdminDashboard.tsx
// Page tableau de bord admin (accessible après PIN)
// Extraite de App.tsx
// =============================================================

import React from 'react';
import { View } from '../constants';
import AppNavTile from '../components/AppNavTile';
import type { AppProfile } from '../auth/AuthProvider';
import { canAccessSupplierSettings, canAccessUserManagement } from '../lib/permissions';

interface AdminDashboardProps {
  setView: (v: View) => void;
  profile?: AppProfile | null;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ setView, profile = null }) => (
  <div className="min-h-screen bg-[#1a0f0a] p-4 sm:p-8 lg:p-12 relative overflow-hidden">
    <div className="max-w-6xl mx-auto relative z-10">
      <div className="flex justify-between items-center mb-16">
        <h1 className="text-[#ffd700] text-6xl font-black uppercase tracking-tighter leading-none">
          ADMIN DASHBOARD
        </h1>
        <AppNavTile
          onClick={() => setView('home')}
          eyebrow="Retour"
          icon="home"
          tone="dark"
          size="md"
        >
          Accueil
        </AppNavTile>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {canAccessSupplierSettings(profile) && (
          <>
            <button
              onClick={() => setView('supplier_settings')}
              className="bg-white/5 border border-white/10 p-10 rounded-[40px] text-left hover:border-[#ffd700] transition-all group"
            >
              <h3 className="text-white text-2xl font-black uppercase mb-2">Paramètres Fournisseurs</h3>
              <p className="text-white/40 font-bold uppercase text-[9px] tracking-widest">
                Gestion fournisseurs, cut-off et livraisons
              </p>
            </button>

            <button
              onClick={() => setView('daily_forecast')}
              className="bg-white/5 border border-white/10 p-10 rounded-[40px] text-left hover:border-[#93c47d] transition-all group"
            >
              <h3 className="text-white text-2xl font-black uppercase mb-2">Prévi couverts</h3>
              <p className="text-white/40 font-bold uppercase text-[9px] tracking-widest">
                Prévisionnel journalier et couverts à venir
              </p>
            </button>
          </>
        )}

{canAccessUserManagement(profile) && (
  <button
    onClick={() => setView('user_management')}
    className="bg-white/5 border border-white/10 p-10 rounded-[40px] text-left hover:border-[#ffd700] transition-all group"
  >
    <h3 className="text-white text-2xl font-black uppercase mb-2">Gestion des Utilisateurs</h3>
    <p className="text-white/40 font-bold uppercase text-[9px] tracking-widest">
      Comptes, rôles et activation
    </p>
  </button>
)}
      </div>
    </div>
  </div>
);

export default AdminDashboard;
