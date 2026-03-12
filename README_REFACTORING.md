# 📁 Refactoring — App.tsx découpé en composants

## Ce qui a changé

L'ancien `App.tsx` faisait **1 453 lignes**. Tout était mélangé :
constantes, calculs, composants UI, état global, navigation.

Après refactoring, `App.tsx` fait **~130 lignes** et ne contient
plus que la navigation. Tout le reste est dans des fichiers dédiés.

---

## 🗂️ Nouvelle structure

```
src/
├── App.tsx                    ← Navigation uniquement (~130 lignes)
├── constants.ts               ← Toutes les constantes (mois, vues, fournisseurs...)
├── types.ts                   ← Inchangé
├── data.ts                    ← Inchangé
│
├── utils/
│   ├── calculations.ts        ← calculateOrder, calculateTargetOrder, toNumber...
│   ├── dateHelpers.ts         ← getDeliveryDates, getForecastForWindow...
│   └── csvHelpers.ts          ← getImportedValueForProduct, extractAllNamesFromCsvs
│
├── hooks/
│   └── useAppState.ts         ← TOUT l'état (useState, useEffect, actions)
│
├── components/
│   ├── WindowsCalendar.tsx    ← Sélecteur de date
│   ├── Modals.tsx             ← ResetConfirmModal, ImportModal, PasswordModal
│   └── MappingPopover.tsx     ← Popover de mapping CSV
│
└── pages/
    ├── HomePage.tsx
    ├── AdminDashboard.tsx
    ├── CostAnalysisPage.tsx
    ├── StatsPage.tsx
    ├── DailyForecastPage.tsx
    ├── SupplierSettingsPage.tsx
    ├── SuppliersPage.tsx
    ├── SupplierOrderPage.tsx  ← Tableau commande (ex: doquet, vins...)
    └── RatiosPage.tsx         ← Intelligence de vente + ratios
```

---

## 📋 Comment intégrer ces fichiers dans ton projet

1. **Copier** tous les fichiers du dossier `src/` dans ton dossier `src/` existant
2. **Remplacer** l'ancien `App.tsx` par le nouveau
3. Les fichiers `types.ts`, `data.ts`, `main.tsx`, `index.css` **restent inchangés**
4. Le dossier `dashboard_cm/` **reste inchangé**

> ⚠️ Faire une sauvegarde de l'ancien App.tsx avant de remplacer !

---

## 🧠 Concepts utilisés (pour débutants)

### Pourquoi un hook `useAppState` ?
En React, on ne peut utiliser `useState` que dans un composant ou un hook.
Un **hook personnalisé** (fichier qui commence par `use`) permet de regrouper
toute la logique d'état dans un seul endroit, puis de l'utiliser dans App.tsx
avec une seule ligne : `const state = useAppState();`

### Pourquoi des dossiers `utils/` ?
Les fonctions "pures" (qui ne dépendent pas de React, juste des maths/dates/texte)
n'ont pas besoin d'être dans un composant. Les mettre dans `utils/` les rend
faciles à retrouver, tester et réutiliser.

### Pourquoi des dossiers `pages/` et `components/` ?
- `pages/` : chaque fichier = une page entière de l'appli
- `components/` : chaque fichier = un petit morceau réutilisable (modal, popover...)

---

## ✅ Améliorations suivantes prévues

1. **Remplacement du parseur CSV** par PapaParse (plus robuste)
2. **Correction des types** `number | string` → toujours `number`
3. **Gestion d'erreurs visible** avec des toasts (messages d'erreur à l'écran)


---

## ✅ Passe 1 bis (structure safe)

- `App.tsx` allégé encore davantage (orchestration uniquement)
- Nouveau `components/AppRouter.tsx` pour centraliser la navigation des vues
- Nouveau `hooks/useSyncedHorizontalScroll.ts` pour isoler la logique de scroll synchronisé de la page Ratios
- Aucune logique métier changée (objectif : maintenabilité sans casser le comportement)
