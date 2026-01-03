# ☁️ SaveApp

> Solution de sauvegarde automatisée, moderne et sécurisée pour Windows.
> Supporte **Google Drive** et **Clés USB** avec gestion intelligente des conflits.

![SaveApp Badge](https://img.shields.io/badge/version-1.1.0-blue.svg) ![Electron](https://img.shields.io/badge/Electron-30+-green.svg) ![React](https://img.shields.io/badge/React-18-blue.svg) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)

---

## ✨ Fonctionnalités

### 🚀 Sauvegarde Intelligente
- **Google Drive** : Authentification OAuth2 sécurisée, upload résumable, gestion des quotas.
- **USB** : Détection automatique des clés USB, copie rapide.
- **Planification** : Sauvegardes automatiques (Quotidien, Hebdomadaire).

### 🛠️ Contrôle Total
- **Pause / Reprise** : Mettez en pause vos uploads à tout moment, ils reprendront là où ils se sont arrêtés.
- **Mode Sombre** : Interface moderne et agréable.
- **Rapports Détaillés** : Historique complet des opérations, logs structurés.

### 🛡️ Qualité & Sécurité
- **Secrets gérés** : Stockage sécurisé des tokens (Electron Store + Encryption).
- **CI/CD** : Pipeline automatisé (Linting, Formatting, Typechecking, Release).

---

## 📦 Installation

Téléchargez la dernière version depuis la page [Releases](https://github.com/votre-user/saveapp/releases).

Ou pour le développement :

```bash
git clone https://github.com/votre-user/saveapp.git
cd saveapp
npm install
npm run dev
```

---

## ⚙️ Configuration (Développement)

Pour activer la sauvegarde Google Drive en mode dev :

1.  Créer un projet sur **Google Cloud Console**.
2.  Activer **Google Drive API**.
3.  Créer des identifiants OAuth2 (Desktop App).
4.  Placer le fichier `google-credentials.json` à la racine :

```json
{
  "client_id": "VOTRE_CLIENT_ID",
  "client_secret": "VOTRE_CLIENT_SECRET"
}
```

---

## 🏗️ Architecture Technique

### Core (Electron Main)
- **`GoogleDriveService`** : Gestionnaire OAuth2 et Uploads (Streams sécurisés).
- **`UsbService`** : Watcher de périphériques physiques.
- **`SchedulerService`** : Orchestrateur de tâches planifiées (Node.js Timer).
- **`LoggerService`** : Système de logs centralisé (`info`, `warn`, `error`).

### UI (React + Vite)
- Interface moderne avec **Tailwind CSS**.
- Communication asynchrone via **Electron IPC**.
- Gestion d'état locale et feedbacks utilisateurs (Toasts, Modales).

---

## ✅ Commandes Utiles

| Commande | Description |
|----------|-------------|
| `npm run dev` | Lance l'application en mode développement |
| `npm run build` | Compile l'application pour la production |
| `npm run package` | Génère l'installateur Windows (.exe) |
| `npm run lint` | Analyse le code (ESLint) |
| `npm run format` | Formate le code (Prettier) |
| `npm run ci` | Vérification complète (Lint + Typecheck + Format) |

---

## 🚀 CI/CD

Le projet utilise **GitHub Actions** pour :
1.  **CI** : Vérifie chaque Pull Request (Lint, Types, Builds).
2.  **Release** : Génère automatiquement une release GitHub et l'installateur `.exe` lorsqu'un tag `v*` est poussé.

---

## 📝 Licence

MIT © Vincent
