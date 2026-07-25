// =============================================================
// pages/TutorialsPage.tsx
// Page Aide / Tutoriels : liste de fiches TutorialSection.
// Structure pensée pour accueillir d'autres fiches à l'avenir --
// ajouter une entrée dans TUTORIAL_SECTIONS suffit.
// =============================================================

import React from 'react';
import { View } from '../constants';
import AppNavTile from '../components/AppNavTile';
import TutorialSection, { TutorialStep } from '../components/tutorials/TutorialSection';

interface TutorialsPageProps {
  setView: (v: View) => void;
}

interface TutorialConfig {
  key: string;
  title: string;
  description?: string;
  video?: string;
  steps: TutorialStep[];
}

const TUTORIAL_SECTIONS: TutorialConfig[] = [
  {
    key: 'import-inventaire',
    title: 'Import Inventaire',
    description:
      "Exporter le rapport d'inventaire depuis Adoria et l'importer dans la page Paramètres pour alimenter le Calcul vente ratio.",
    steps: [
      {
        text: 'Dans Adoria, cliquer sur "Rapports" dans le menu de navigation en haut.',
        image: '/tutorials/import-inventaire/step1-adoria-rapports.png',
      },
      {
        text: 'Dérouler la section "STOCKS ET RATIOS DE GESTION" et cliquer sur "Analyse du coût matière et ventes par produit".',
        image: '/tutorials/import-inventaire/step2-adoria-stocks-ratios.png',
      },
      {
        text: 'Configurer la période : du 1er au dernier jour du mois souhaité. Régler le regroupement sur "Zone de stock" et sélectionner "Part de Démarque inconnue". Cliquer sur "Valider".',
        image: '/tutorials/import-inventaire/step3-adoria-config.png',
      },
      {
        text: 'Sur le rapport généré, cliquer sur "Exporter le rapport (.xls)" en haut à droite.',
        image: '/tutorials/import-inventaire/step4-adoria-export.png',
      },
      {
        text: 'Dans la page Paramètres, sélectionner le mois concerné dans la liste à gauche, puis cliquer sur "Importer" dans la carte Inventaire.',
        image: '/tutorials/import-inventaire/step5-parametres-importer.png',
      },
      {
        text: 'Dans la modale, glisser-déposer le fichier exporté depuis Adoria ou cliquer pour le parcourir.',
        image: '/tutorials/import-inventaire/step6-modal-import.png',
      },
      {
        text: "L'inventaire passe au statut Importé (point vert). Le mois affiche PARTIEL si la production n'est pas encore importée.",
        image: '/tutorials/import-inventaire/step7-importe.png',
      },
    ],
  },
  {
    key: 'trame-commande',
    title: 'Trame commande',
    description:
      "Importer un bon de préparation Adoria pour générer automatiquement les articles, unités de stockage et de conditionnement.",
    video: '/tutorials/trame-commande/video.mp4',
    steps: [
      {
        text: 'Dans Paramètres, cliquez sur la carte « Import / Trame commande ».',
        image: '/tutorials/trame-commande/step1-parametres.png',
      },
      {
        text: 'Cliquez sur « Importer un PDF ».',
        image: '/tutorials/trame-commande/step2-importer-pdf.png',
      },
      {
        text: 'Choisissez le fichier à importer et validez.',
        image: '/tutorials/trame-commande/step3-select-file.png',
      },
      {
        text: 'Contrôlez les colonnes Articles / Unité de stockage / Unité de conditionnement. Corrigez directement dans le tableau si besoin.',
        image: '/tutorials/trame-commande/step4-import-result.png',
      },
      {
        text: "Une fois que tout est validé, sélectionner le fournisseur souhaité et cliquez sur « Créer les produits » afin de créer la liste des produits dans la page Calcul ventes ratio.",
        image: '/tutorials/trame-commande/step5-creer-produits.png',
      },
    ],
  },
];

const TutorialsPage: React.FC<TutorialsPageProps> = ({ setView }) => (
  <div className="min-h-screen bg-[radial-gradient(circle_at_20%_0%,rgba(245,166,58,0.28),transparent_30%),linear-gradient(180deg,#FFF7EA_0%,#F3DDC0_46%,#C97933_100%)] text-[#2F1D14]">
    <div className="mx-auto max-w-7xl">
      <main className="p-4 md:p-6">
        {/* En-tête */}
        <div className="mb-6 flex flex-col gap-4 rounded-[24px] border border-[#C89245]/55 bg-[linear-gradient(135deg,#3A2116_0%,#69331F_58%,#A85F2A_100%)] p-4 shadow-[0_18px_42px_rgba(54,24,12,0.18)] xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <h1 className="text-3xl font-black tracking-tight text-[#FFF7EA]">Aide / Tutoriels</h1>
            <AppNavTile
              type="button"
              onClick={() => setView('stats')}
              eyebrow="Retour"
              icon="back"
              tone="dark"
              size="md"
            >
              Paramètres
            </AppNavTile>
            <AppNavTile
              type="button"
              onClick={() => setView('home')}
              eyebrow="Retour"
              icon="home"
              tone="dark"
              size="md"
            >
              Accueil
            </AppNavTile>
          </div>
        </div>

        <div className="space-y-6">
          {TUTORIAL_SECTIONS.map((section) => (
            <TutorialSection
              key={section.key}
              title={section.title}
              description={section.description}
              video={section.video}
              steps={section.steps}
            />
          ))}
        </div>
      </main>
    </div>
  </div>
);

export default TutorialsPage;
