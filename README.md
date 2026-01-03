# 📁 SaveApp - Phase 4 : Cloud Google Drive

> Sauvegarde vers Google Drive avec authentification OAuth2 sécurisée.

---

## 🎯 Objectifs de cette phase

| Objectif | Statut |
|----------|--------|
| Authentification OAuth2 (popup) | ✅ |
| Stockage sécurisé des tokens | ✅ |
| Création dossier SaveApp_Backup | ✅ |
| Upload de fichiers avec streams | ✅ |
| Progression en temps réel | ✅ |
| UI Connect/Disconnect | ✅ |

---

## 📦 Installation

```bash
npm install
npm run dev
```

---

## ⚙️ Configuration requise

### 1. Créer un projet Google Cloud

1. Aller sur [Google Cloud Console](https://console.cloud.google.com)
2. Créer un nouveau projet
3. Activer l'API **Google Drive API**
4. Aller dans **Credentials** > **Create Credentials** > **OAuth client ID**
5. Type d'application : **Desktop app**
6. Télécharger le fichier JSON

### 2. Configurer SaveApp

Créer un fichier `google-credentials.json` à la racine du projet :

```json
{
  "client_id": "123456789-xxx.apps.googleusercontent.com",
  "client_secret": "GOCSPX-xxx"
}
```

> ⚠️ Ce fichier est dans le `.gitignore` - ne jamais le commiter !

---

## 🔌 Architecture Cloud

```
electron/services/
└── GoogleDriveService.ts   # Service OAuth2 + Upload
```

### Flow d'authentification

```
[Clic "Se connecter"]
       ↓
[Popup navigateur Google]
       ↓
[Utilisateur se connecte]
       ↓
[Redirection localhost avec code]
       ↓
[Échange code → tokens]
       ↓
[Tokens stockés (chiffrés)]
       ↓
[Bouton devient "Connecté"]
```

---

## 🔒 Sécurité

| Élément | Protection |
|---------|------------|
| Client ID/Secret | Fichier externe non commité |
| Access Token | Stocké via electron-store |
| Refresh Token | Stocké via electron-store |
| Transmission | HTTPS uniquement |

---

## 💾 Nouvelles méthodes IPC

```typescript
// Vérifier si credentials configurées
const hasCredentials = await window.electronAPI.cloud.hasCredentials()

// Connexion OAuth2
const result = await window.electronAPI.cloud.connect()
// => { success: true, user: { name, email } }

// Déconnexion
await window.electronAPI.cloud.disconnect()

// État de connexion
const isConnected = await window.electronAPI.cloud.isConnected()

// Utilisateur connecté
const user = await window.electronAPI.cloud.getUser()

// Upload vers le cloud
const result = await window.electronAPI.cloud.upload(source)

// Progression
window.electronAPI.cloud.onProgress((progress) => {
  console.log(progress.percent, progress.currentFile)
})
```

---

## 📝 Scripts disponibles

| Commande | Description |
|----------|-------------|
| `npm run dev` | Lance le serveur de dev |
| `npm run build` | Build de production |
| `npm run typecheck` | Vérification TypeScript |

---

## ✅ Roadmap complète

| Phase | Description | Statut |
|-------|-------------|--------|
| 1 | Squelette (Electron + UI + IPC) | ✅ |
| 2 | Logique locale (copie streams) | ✅ |
| 3 | Intégration USB | ✅ |
| 4 | **Cloud Google Drive** | ✅ |
