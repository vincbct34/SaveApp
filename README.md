# 📁 SaveApp - Phase 3 : L'Intégration USB

> Détection automatique des périphériques USB et déclenchement de la sauvegarde au branchement.

---

## 🎯 Objectifs de cette phase

| Objectif | Statut |
|----------|--------|
| Détection des lecteurs USB montés | 🔜 |
| Événements branchement/débranchement | 🔜 |
| Déclenchement automatique du backup | 🔜 |

---

## 📦 Installation

```bash
npm install
npm run dev
```

---

## 🔌 UsbService : Le cœur de la Phase 3

### Détection avec drivelist

```typescript
import drivelist from 'drivelist'

const drives = await drivelist.list()
// => [{ device: 'D:', mountpoints: [{path: 'D:\\'}], isUSB: true, ... }]
```

### Polling pour les événements

```typescript
// Toutes les 2 secondes, comparer la liste des lecteurs
setInterval(async () => {
  const current = await drivelist.list()
  const newDrives = current.filter(d => !previous.includes(d))
  const removedDrives = previous.filter(d => !current.includes(d))
  
  if (newDrives.length) emit('usb:connected', newDrives)
  if (removedDrives.length) emit('usb:disconnected', removedDrives)
}, 2000)
```

---

## 🔄 Auto-Backup

```
[USB branché] 
    ↓
[SaveApp détecte le lecteur]
    ↓
[Notification: "Clé USB détectée. Lancer la sauvegarde ?"]
    ↓
[User confirme OU auto-backup activé]
    ↓
[Backup démarre automatiquement]
```

---

## 💾 Nouvelles méthodes IPC

```typescript
// Lister les lecteurs
const drives = await window.electronAPI.usb.getDrives()

// Écouter les changements
window.electronAPI.usb.onDriveChange((event, drives) => {
  console.log('Lecteurs:', drives)
})
```

---

## 📝 Scripts disponibles

| Commande | Description |
|----------|-------------|
| `npm run dev` | Lance le serveur de dev |
| `npm run build` | Build de production |

---

## 🔄 Prochaine étape : Phase 4

La Phase 4 implémentera le Cloud Google Drive :
- OAuth2 authentication
- Upload API
