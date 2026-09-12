# 🥤 OpenMDL — Logiciel de Caisse & Gestion du Foyer des Lycéens

<div align="center">
  <img src="public/assets/logo_banniere.png" alt="OpenMDL Logo" width="360" />
  <br />
  <p><strong>Solution open source moderne, ultra-rapide et autonome pour les Foyers et Maisons des Lycéens (MDL / CVL).</strong></p>

  [![Tauri v2](https://img.shields.io/badge/Tauri-v2-blue?logo=tauri)](https://tauri.app/)
  [![Vite](https://img.shields.io/badge/Vite-v8-646CFF?logo=vite)](https://vitejs.dev/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)](https://www.typescriptlang.org/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)
  [![Platform](https://img.shields.io/badge/Platforms-Linux%20%7C%20Windows-green)](#-téléchargements--installateurs)
  [![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
  
</div>

---

## 📋 Présentation

**OpenMDL** est conçu sur mesure pour répondre aux besoins concrets des lycéens et des bénévoles qui animent le foyer associatif (MDL / CVL) :
- Vente express au comptoir pendant les récréations et la pause méridienne.
- Encaissement rapide en espèces (avec calculateur de monnaie à rendre) ou par carte bancaire (intégration SumUp Solo).
- Tarifs différenciés adhérents / non-adhérents.
- Suivi rigoureux des stocks et alertes de réapprovisionnement.
- Clôture de caisse quotidienne et calcul automatique des marges et frais bancaires pour le trésorier.
- **100% autonome et hors-ligne** : fonctionne sans connexion Internet requise, les données restent localement au lycée sur la machine du foyer.

---

## ✨ Fonctionnalités Clés

| Module | Description |
| :--- | :--- |
| 🛒 **Caisse Express (POS)** | Interface plein écran tactile adaptée aux gros flux d'élèves. Ajout en un clic, gestion du panier, calcul de remise adhérent et rendu de monnaie instantané. |
| 💳 **TPE & Paiement Sans Contact** | Prise en charge des terminaux de paiement (SumUp Solo), simulation de paiement avec bip sonore et journal des transactions CB. |
| 📦 **Catalogue & Tarifs** | Gestion simple des articles (boissons, snacks, viennoiseries), prix standards et réductions adhérents de la MDL. |
| 🚚 **Restock Express** | Saisie rapide des arrivages de marchandises avec calcul du prix d'achat unitaire et des marges prévisionnelles. |
| 📊 **Statistiques & Comptabilité** | Tableaux de bord financiers (CA, marge brute, bénéfice net) avec déduction exacte des frais bancaires (ex: 1,75% SumUp) et graphiques mensuels/annuels. |
| 📑 **Clôture de Caisse & Export** | Procédure de fermeture de caisse guidée avec comptage du tiroir-caisse et export comptable CSV/Excel pour l'intendance ou le trésorier. |
| 🔒 **Sécurité & Rôles** | Mode Vendeur / Trésorier sécurisé par code PIN pour protéger les statistiques financières et les paramètres. |
| 🎨 **Design & Confort** | Thème Sombre et Clair automatique, fenêtre sans bordure personnalisée (`-`, `□`, `✕`) et logo officiel transparent. |

---

## 📥 Téléchargements & Installateurs

Les paquets pré-compilés se trouvent dans le dossier `dist-installers/` :

| Système d'exploitation | Format de paquet | Utilisation |
| :--- | :--- | :--- |
| **Linux Mint / Ubuntu / Debian** | `OpenMDL_1.0.0_amd64.deb` | Double-clic pour installer via la logithèque (gère automatiquement les dépendances) |
| **Fedora / RedHat / openSUSE** | `OpenMDL-1.0.0-1.x86_64.rpm` | Installateur RPM natif |
| **Toutes distributions Linux** | `OpenMDL_1.0.0_amd64.AppImage` | Fichier portable autonome : clic droit > Exécuter, aucune installation nécessaire |
| **Windows 10 / 11** | `OpenMDL_1.0.0_x64-setup.exe` | Installateur Windows NSIS complet (avec raccourci Bureau et Menu Démarrer) |

---

## 🚀 Démarrage Rapide (Développement)

### Prérequis
- [Node.js](https://nodejs.org/) (version 18 ou supérieure)
- [Rust & Cargo](https://www.rust-lang.org/) (`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`)
- Dépendances système Linux (sur Fedora : `sudo dnf install webkit2gtk4.1-devel openssl-devel`)

### Installation
```bash
# 1. Cloner le projet
git clone https://github.com/votre-compte/foyer_logiciel.git
cd foyer_logiciel

# 2. Installer les dépendances JavaScript
npm install
```

### Lancer en mode développement
```bash
# Lance l'application avec rechargement à chaud (Vite + Tauri)
npm run tauri dev
```

---

## 🛠️ Compilation des Paquets

Vous pouvez générer tous les installateurs en une seule commande grâce au script interactif :

```bash
./build-all.sh
```
*ou via npm :*
```bash
npm run build:all
```

Ce script affiche un tableau de bord en temps réel dans votre terminal et rassemble automatiquement tous les paquets prêts à l'emploi dans le dossier `./dist-installers/`.

### Commandes individuelles par plateforme :
- **AppImage (Linux universel)** : `npm run build:appimage`
- **DEB (Linux Mint, Ubuntu)** : `npm run build:deb`
- **RPM (Fedora, openSUSE)** : `npm run build:rpm`
- **Windows (.exe)** : `npm run build:win`

---

## 📚 Documentation Complète

Une documentation exhaustive décrivant chaque module, la comptabilité, le stockage des données et les procédures d'administration est disponible dans :
👉 **[DOCUMENTATION.md](file:///home/adrien/Bureau/foyer_logiciel/DOCUMENTATION.md)**

---

## 🛡️ Données & Confidentialité

- **Stockage 100% local** : Les données de ventes et le catalogue sont enregistrés dans le navigateur local et sécurisés dans le répertoire utilisateur de l'OS (`~/.local/share/openmdl/` sous Linux, `%APPDATA%/openmdl/` sous Windows).
- **Sauvegarde en 1 clic** : Fonction de sauvegarde et restauration JSON pour transférer la base de données sur une clé USB en fin d'année scolaire.

---

## 📜 Licence

Ce projet est distribué sous licence libre **MIT**. Conçu avec ❤️ pour les lycéens et les associations de lycées.
