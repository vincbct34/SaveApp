# 📁 SaveApp - Phase 1 : Le Squelette

> Setup du projet Electron + Vite + React + TypeScript avec UI statique et communication IPC basique.

---

## 🎯 Objectifs de cette phase

| Objectif | Statut |
|----------|--------|
| Initialiser Electron + Vite + React + TypeScript | ✅ |
| Configurer Tailwind CSS | ✅ |
| Créer l'UI statique du dashboard | ✅ |
| Implémenter la communication IPC sécurisée | ✅ |

---

## 📦 Installation

```bash
npm install
npm run dev
```

---

## 🏗️ Structure du projet

```
SaveApp/
├── electron/
│   ├── main.ts              # Process principal Electron
│   └── preload.ts           # Context bridge sécurisé (API IPC)
├── src/
│   ├── components/
│   │   ├── TitleBar/        # Barre de titre custom (min/max/close)
│   │   ├── Dashboard/       # État de sauvegarde (vert/orange)
│   │   ├── SourcesList/     # Liste des dossiers sources
│   │   ├── DestinationsList/# Destinations (USB/NAS/Cloud)
│   │   └── ProgressBar/     # Barre de progression animée
│   ├── App.tsx              # Composant racine
│   ├── index.css            # Styles Tailwind + custom
│   ├── main.tsx             # Entry point React
│   └── electron.d.ts        # Types pour l'API Electron
├── index.html               # Template HTML
├── electron.vite.config.ts  # Config Electron-Vite
├── tailwind.config.js       # Palette de couleurs custom
├── tsconfig.json            # Config TypeScript
└── package.json
```

---

## 🧩 Composants UI

### TitleBar
Barre de titre personnalisée remplaçant la barre système native :
- Logo SaveApp
- Boutons : Minimiser, Maximiser/Restaurer, Fermer
- Zone draggable pour déplacer la fenêtre

### Dashboard
Affichage de l'état de sauvegarde :
- **Vert** : "Tout est sauvegardé" (dernière sauvegarde < 24h)
- **Orange** : "Sauvegarde nécessaire" (jamais ou > 24h)
- Bouton principal "Sauvegarder maintenant"

### SourcesList
Liste des dossiers à sauvegarder :
- Nom et chemin de chaque dossier
- Taille formatée (Ko, Mo, Go)
- Bouton + pour ajouter via dialogue natif
- Bouton supprimer au hover

### DestinationsList
Destinations configurées :
- Types : USB, NAS, Cloud
- Indicateur de disponibilité (Connecté/Déconnecté)
- Icônes distinctes par type

### ProgressBar
Barre de progression pendant la sauvegarde :
- Pourcentage et estimation du temps
- Animation shimmer
- Bouton Annuler

---

## 🔌 Communication IPC

L'API est exposée via `window.electronAPI` depuis le preload script :

```typescript
// Contrôles fenêtre
window.electronAPI.window.minimize()
window.electronAPI.window.maximize()
window.electronAPI.window.close()

// Dialogues
const path = await window.electronAPI.dialog.selectFolder()

// Sauvegarde
const result = await window.electronAPI.backup.start()
```

### Sécurité
- `contextIsolation: true` - Isolation du contexte renderer
- `sandbox: true` - Sandbox activé
- `nodeIntegration: false` - Pas d'accès Node direct

---

## 🎨 Design System

### Couleurs (Tailwind)
| Token | Usage |
|-------|-------|
| `primary-*` | Actions principales (bleu) |
| `success-*` | État OK (vert) |
| `warning-*` | Attention requise (orange) |
| `dark-*` | Thème sombre (fond, texte) |

### Animations
- `progress-shimmer` : Effet brillant sur la barre de progression
- Transitions 200ms sur tous les boutons

---

## 📝 Scripts disponibles

| Commande | Description |
|----------|-------------|
| `npm run dev` | Lance le serveur de dev avec hot-reload |
| `npm run build` | Build de production |
| `npm run preview` | Preview du build |
| `npm run typecheck` | Vérification TypeScript |

---

## 🔄 Prochaine étape : Phase 2

La Phase 2 implémentera la logique locale :
- Sélection réelle des dossiers
- Algorithme de copie avec fs streams
- Gestion des erreurs (fichiers verrouillés)
