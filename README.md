# 📁 SaveApp - Phase 2 : La Logique Locale

> Implémentation de la sélection de dossiers, l'algorithme de copie miroir avec streams, et la gestion des erreurs.

---

## 🎯 Objectifs de cette phase

| Objectif | Statut |
|----------|--------|
| Sélection de dossiers avec calcul de taille | 🔜 |
| Algorithme de copie avec fs streams | 🔜 |
| Gestion des fichiers verrouillés (Soft Fail) | 🔜 |
| Persistance des sources avec electron-store | 🔜 |

---

## 📦 Installation

```bash
npm install
npm run dev
```

---

## 🏗️ Nouvelle architecture

```
electron/
├── main.ts                 # + nouveaux handlers IPC
├── preload.ts              # + nouvelles méthodes exposées
└── services/
    ├── SyncService.ts      # [NEW] Logique de synchronisation
    ├── FileUtils.ts        # [NEW] Utilitaires fichiers
    └── StoreService.ts     # [NEW] Persistance electron-store
```

---

## 🔄 SyncService : Le cœur de la Phase 2

### Algorithme de copie miroir

```
Source                    Destination
├── file1.txt    ──►     ├── file1.txt     (copié si nouveau/modifié)
├── file2.txt    ──►     ├── file2.txt     (ignoré si identique)
└── file3.txt    ──►     └── file3.txt     (créé)
                         └── old.txt        (SUPPRIMÉ - plus dans source)
```

### Copie avec Streams (performance)

```typescript
// ❌ Mauvais - charge tout en RAM
const data = fs.readFileSync(source)
fs.writeFileSync(dest, data)

// ✅ Bon - streaming sans saturer la RAM
fs.createReadStream(source)
  .pipe(fs.createWriteStream(dest))
```

---

## ⚠️ Gestion des erreurs : Soft Fail

Les fichiers verrouillés (ouverts dans Excel, Word, etc.) ne bloquent **pas** la sauvegarde :

| Erreur | Comportement |
|--------|--------------|
| `EBUSY` | Fichier verrouillé → ignoré |
| `EACCES` | Accès refusé → ignoré |
| `ENOENT` | Fichier supprimé pendant la copie → ignoré |

Un **rapport d'erreurs** est affiché à la fin listant tous les fichiers ignorés.

---

## 💾 Persistance (electron-store)

```typescript
// Données sauvegardées
{
  sources: [
    { path: "C:\\Users\\Papa\\Travail", name: "Travail" }
  ],
  lastBackupDate: "2026-01-02T14:00:00.000Z",
  preferences: {
    autoBackupOnUSB: true
  }
}
```

---

## 📊 Progression en temps réel

```
[██████████░░░░░░░░░░] 47%  
Copie : Documents/Factures/facture_2024.pdf
1.2 Go / 2.5 Go • 3 minutes restantes
```

---

## 🔌 Nouvelles méthodes IPC

```typescript
// Lancer une sauvegarde
await window.electronAPI.backup.start(sources, destination)

// Écouter la progression
window.electronAPI.backup.onProgress((data) => {
  console.log(data.percent, data.currentFile)
})

// Pause / Annulation
window.electronAPI.backup.pause()
window.electronAPI.backup.cancel()

// Persistance
await window.electronAPI.store.get('sources')
await window.electronAPI.store.set('sources', [...])
```

---

## 📝 Scripts disponibles

| Commande | Description |
|----------|-------------|
| `npm run dev` | Lance le serveur de dev |
| `npm run build` | Build de production |
| `npm run typecheck` | Vérification TypeScript |

---

## 🔄 Prochaine étape : Phase 3

La Phase 3 implémentera l'intégration USB :
- Détection automatique des périphériques
- Déclenchement de la sauvegarde au branchement
