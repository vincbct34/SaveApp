# 📁 SaveApp

> Application de sauvegarde automatisée pour utilisateurs non-techniques.

**🎯 La Promesse :** *"Branchez votre disque, SaveApp s'occupe du reste."*

---

## 🚀 À propos

SaveApp est une application desktop (Windows/Mac/Linux) qui permet aux particuliers et indépendants de sauvegarder automatiquement leurs dossiers de travail vers des supports sécurisés (USB, NAS, Cloud) sans aucune compétence technique requise.

## 📋 Documentation

- [📖 Cahier des charges](./SPECIFICATIONS.md) - Spécifications fonctionnelles et techniques complètes

## 🗺️ Roadmap

| Phase | Branche | Description | Statut |
|-------|---------|-------------|--------|
| 1 | `phase-1` | Squelette (Electron + UI statique + IPC) | ✅ Terminée |
| 2 | `phase-2` | Logique locale (sélection dossiers, copie streams) | 🔜 À venir |
| 3 | `phase-3` | Intégration USB (détection, déclenchement auto) | 🔜 À venir |
| 4 | `phase-4` | Cloud Google Drive (OAuth2, upload) | 🔜 À venir |

## 🛠️ Stack Technique

- **Electron** - Application desktop cross-platform
- **Vite** - Build tool ultra-rapide
- **React** - Interface utilisateur
- **TypeScript** - Typage strict
- **Tailwind CSS** - Styling moderne

## 📥 Installation

```bash
# Cloner le repo
git clone <url-du-repo>
cd SaveApp

# Choisir une phase
git checkout phase-1  # ou phase-2, phase-3, etc.

# Installer les dépendances
npm install

# Lancer en développement
npm run dev
```

## 📄 Licence

MIT
