# 📁 SaveApp – Cahier des Charges

**Version :** 1.0
**Type :** Application Desktop (Windows/Mac/Linux)
**Cible :** Particuliers et Indépendants "non-tech" (Famille, Artisans, Professions libérales).

## 1. Vision et Objectifs

**Le Problème :** L'utilisateur a peur de perdre ses données professionnelles (bureautique) mais trouve les solutions actuelles trop complexes, opaques ou manuelles (donc sujettes à l'oubli).
**La Solution :** Une application "compagnon" qui automatise la copie des dossiers de travail vers des supports sécurisés (Disque dur externe, NAS, Cloud) sans jargon technique.
**La Promesse :** "Branchez votre disque, SaveApp s'occupe du reste."

---

## 2. Périmètre Fonctionnel (MVP - Minimum Viable Product)

### A. Gestion des Sources (Quoi ?)

* L'utilisateur peut sélectionner un ou plusieurs dossiers locaux (ex: `C:\Users\Papa\Travail`).
* Visualisation claire de la taille totale à sauvegarder.

### B. Gestion des Destinations (Où ?)

L'application doit gérer 3 types de destinations :

1. **Supports Physiques :** Clés USB, Disques Durs externes.
* *Feature clé :* Détection automatique des périphériques disponibles.


2. **Réseau Local :** NAS ou dossiers partagés (traités comme des chemins fichiers standard).
3. **Cloud (Google Drive) :**
* Connexion via compte Google (OAuth2).
* Création d'un dossier dédié "SaveApp_Backup" sur le Drive.



### C. Déclencheurs de Sauvegarde (Quand ?)

1. **Manuel :** Un gros bouton "Sauvegarder maintenant".
2. **Automatique (Event-based) :** Démarrage automatique de la sauvegarde dès que le périphérique USB spécifique (reconnu par son nom/ID) est branché.
3. **Planifié (Time-based) :** Option simple (ex: "Tous les jours à 18h").

### D. Le Processus de Sauvegarde (Comment ?)

* **Mode de copie :** "Miroir" (One-way Sync). Le dossier de destination doit devenir la copie exacte de la source.
* *Si fichier nouveau :* Copier.
* *Si fichier modifié :* Remplacer.
* *Si fichier supprimé à la source :* Ne pas supprimer (Archive) ou Supprimer (Miroir strict) -> *Décision v1 : Miroir strict pour éviter de saturer le disque, avec option "Garder les vieux fichiers" pour la v2.*


* **Gestion des conflits (Fichiers verrouillés) :**
* Ne pas bloquer le processus.
* Ignorer le fichier utilisé par une autre app (Excel/Word).
* Lister ces fichiers dans un rapport d'erreur final ("Soft Fail").



---

## 3. Spécifications Techniques

### Stack Retenue

* **Core :** Electron (Dernière version stable).
* **Langage :** TypeScript (Strict mode).
* **UI Framework :** React.js + Tailwind CSS (pour une UI rapide et propre).
* **Build Tool :** Vite (plus rapide que Webpack pour Electron).

### Architecture des Données

* **Configuration :** Stockage des préférences (chemins sources, IDs des clés USB, tokens OAuth) dans un fichier JSON local chiffré ou simple (via `electron-store`).
* **Logs :** Fichier `.log` rotatif pour le debug (utile si "Tata Janine" a un bug).

### Points d'Attention Performance

1. **Gestion Mémoire (RAM) :**
* Interdiction d'utiliser `fs.readFileSync` sur les fichiers utilisateurs.
* Utilisation obligatoire de `fs.createReadStream` / `pipe` pour les copies.


2. **Interface Non-Bloquante :**
* La logique de sauvegarde doit tourner dans le "Main Process" (ou un Worker), jamais dans le "Renderer Process" (l'UI), pour que l'interface ne gèle pas pendant une copie de 100 Go.
* Communication UI <-> Logique via `IPC` (Inter-Process Communication).



---

## 4. Expérience Utilisateur (UX/UI)

L'interface doit être **rassurante**.

* **Dashboard (Écran principal) :**
* État actuel : "Tout est sauvegardé" (Vert) ou "Sauvegarde nécessaire" (Orange).
* Dernière sauvegarde : "Hier à 14h30".


* **Pendant la sauvegarde :**
* Barre de progression réelle.
* Estimation du temps restant.
* Possibilité de mettre en Pause / Annuler.


* **Feedback Fin de sauvegarde :**
* Notification système native (Windows Toast).
* Si erreur (fichier verrouillé) : Message clair proposant de réessayer uniquement les fichiers échoués.



---

## 5. Plan de Développement (La roadmap)

Puisque tu as le temps, procédons par itérations fonctionnelles :

* **Phase 1 : Le Squelette**
* Setup du projet (Electron + Vite + React + TS).
* Création de l'UI statique (juste le visuel).
* Communication IPC basique (Bouton UI -> Log dans la console Node).


* **Phase 2 : La Logique Locale (Le plus dur)**
* Sélection des dossiers (Dialog natif).
* Implémentation de l'algorithme de copie (Streams).
* Gestion des erreurs (Try/Catch sur fichiers verrouillés).


* **Phase 3 : L'Intégration USB**
* Utilisation de la librairie `drivelist` ou `usb-detection`.
* Déclenchement automatique.


* **Phase 4 : Le Cloud (Bonus)**
* Implémentation OAuth2 Google Drive.
* Upload API.
