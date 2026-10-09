# OpenMDL — Logiciel de Caisse & Gestion de Foyer pour MDL, CVL & BDE

> **La solution de caisse enregistreuse open source (POS), moderne, tactile et 100% autonome pour les Foyers de lycées, Maisons des Lycéens (MDL / CVL) et associations étudiantes.**

OpenMDL simplifie la gestion quotidienne des permanences au foyer : encaissement rapide (espèces & TPE SumUp), gestion rigoureuse des stocks et des approvisionnements, réductions adhérents MDL, clôture de caisse guidée et comptabilité exportable en un clic.


<div align="center">
  <img src="public/assets/logo_banniere.png" alt="OpenMDL Logo" width="360" />
  <br />
  <p><strong>Solution open source moderne, ultra-rapide et autonome pour les Foyers et Maisons des Lycéens (MDL / CVL).</strong></p>

  [![Tauri v2](https://img.shields.io/badge/Tauri-v2-blue?logo=tauri)](https://tauri.app/)
  [![Vite](https://img.shields.io/badge/Vite-v8-646CFF?logo=vite)](https://vitejs.dev/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)](https://www.typescriptlang.org/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)
  [![Platform](https://img.shields.io/badge/Platforms-Linux%20%7C%20Windows-green)](#téléchargements--installateurs)
  [![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
  
</div>

---

## Présentation

**OpenMDL** est conçu sur mesure pour répondre aux besoins concrets des lycéens et des bénévoles qui animent le foyer associatif (MDL / CVL) :
- Vente express au comptoir pendant les récréations et la pause méridienne.
- Encaissement rapide en espèces (avec calculateur de monnaie à rendre) ou par carte bancaire (intégration SumUp Solo).
- Tarifs différenciés adhérents / non-adhérents.
- Suivi rigoureux des stocks et alertes de réapprovisionnement.
- Clôture de caisse quotidienne et calcul automatique des marges et frais bancaires pour le trésorier.
- **100% autonome et hors-ligne** : fonctionne sans connexion Internet requise, les données restent localement au lycée sur la machine du foyer.

---

## Fonctionnalités Clés

| Module | Description |
| :--- | :--- |
| **Caisse Express (POS)** | Interface plein écran tactile adaptée aux gros flux d'élèves. Ajout en un clic, gestion du panier, calcul de remise adhérent et rendu de monnaie instantané. |
| **TPE & Paiement Sans Contact** | Prise en charge des terminaux de paiement (SumUp Solo), simulation de paiement avec bip sonore et journal des transactions CB. |
| **Catalogue & Tarifs** | Gestion simple des articles (boissons, snacks, viennoiseries), prix standards et réductions adhérents de la MDL. |
| **Restock Express** | Saisie rapide des arrivages de marchandises avec calcul du prix d'achat unitaire et des marges prévisionnelles. |
| **Statistiques & Comptabilité** | Tableaux de bord financiers (CA, marge brute, bénéfice net) avec déduction exacte des frais bancaires (ex: 1,75% SumUp) et graphiques mensuels/annuels. |
| **Clôture de Caisse & Export** | Procédure de fermeture de caisse guidée avec comptage du tiroir-caisse et export comptable CSV/Excel pour l'intendance ou le trésorier. |
| **Sauvegardes Binaires (.mdlb)** | Format binaire propriétaire ultra-léger et compressé en Rust (Zlib) avec contrôle d'intégrité CRC32 anti-corruption, généré automatiquement à chaque clôture. |
| **Addons & Modding (.mdlx)** | Bibliothèque d'extensions en TypeScript développables dans VS Code / Lapce avec packaging binaire `.mdlx` et synchronisation en direct sans redémarrage. |
| **Sécurité & Rôles** | Mode Vendeur / Trésorier sécurisé par mot de passe et droits délégués CVL pour protéger les statistiques financières et les paramètres. |
| **Design & Confort** | Thème Sombre et Clair automatique, fenêtre sans bordure personnalisée (`-`, `□`, `✕`) et logo officiel transparent. |

---

## Aperçu de l'Interface & Captures d'Écran

OpenMDL dispose d'une interface responsive et adaptative, optimisée pour les écrans tactiles et déclinée en **Thème Sombre** (idéal pour le comptoir Foyer) et en **Thème Clair** (recommandé pour les bureaux administratifs et les postes Vie Scolaire).

### Thème Sombre — Poste Foyer & Gestion Complète (Écrans 1 à 12)

<details open>
<summary><strong>Découvrir les écrans du Thème Sombre (Cliquez pour replier / déplier)</strong></summary>
<br />

| N° | Écran | Description | Aperçu |
| :---: | :--- | :--- | :--- |
| **01** | **Écran de Connexion (Login)** | Authentification rapide et sécurisée des bénévoles et administrateurs du Foyer. | <img src="screenshots/1.png" alt="Login Thème Sombre" width="100%" /> |
| **02** | **Poste de Vente (Caisse POS)** | Interface tactile de caisse, sélection des snacks/boissons, panier et raccourcis clavier F1/F2. | <img src="screenshots/2.png" alt="Poste de Vente Thème Sombre" width="100%" /> |
| **03** | **Encaissement & Rendu de Monnaie** | Calculateur de monnaie en temps réel avec sélection des pièces et billets. | <img src="screenshots/3.png" alt="Encaissement et Rendu de Monnaie Thème Sombre" width="100%" /> |
| **04** | **Catalogue & Tarifs** | Grille tarifaire complète, gestion des articles et remises adhérents MDL. | <img src="screenshots/4.png" alt="Catalogue et Tarifs Thème Sombre" width="100%" /> |
| **05** | **Restock Express** | Saisie des arrivages de marchandises, calcul du prix d'achat unitaire et des marges. | <img src="screenshots/5.png" alt="Restock Thème Sombre" width="100%" /> |
| **06** | **Statistiques (Vue 1 - Chiffre d'Affaires & Synthèse)** | Rapports des ventes en direct, totaux et ventilation financière. | <img src="screenshots/6.png" alt="Statistiques 1 Thème Sombre" width="100%" /> |
| **07** | **Statistiques (Vue 2 - Marges & Frais TPE)** | Analyse détaillée de la rentabilité, marges brutes et déduction des frais bancaires. | <img src="screenshots/7.png" alt="Statistiques 2 Thème Sombre" width="100%" /> |
| **08** | **Configuration TPE** | Appairage du terminal sans contact (SumUp Solo), statuts et réglages de transaction. | <img src="screenshots/8.png" alt="TPE Config Thème Sombre" width="100%" /> |
| **09** | **Paramètres (Vue 1 - Mode Autonome)** | Fonctionnement 100% local hors-ligne, données isolées sur la machine du Foyer. | <img src="screenshots/9.png" alt="Paramètres 1 Mode Autonome Thème Sombre" width="100%" /> |
| **10** | **Paramètres (Vue 2 - Mode Réseau Local / LAN)** | Configuration du cluster local multi-postes, autorité Foyer et synchronisation réseau. | <img src="screenshots/10.png" alt="Paramètres 2 Mode LAN Thème Sombre" width="100%" /> |
| **11** | **Paramètres (Vue 3 - Mode Clé USB / Fichier)** | Import/export direct des bases de données et sauvegardes `.mdlb` via support amovible. | <img src="screenshots/11.png" alt="Paramètres 3 Clé USB Fichier Thème Sombre" width="100%" /> |
| **12** | **Paramètres (Vue 4 - Mode Vie Scolaire Client)** | Configuration du poste client distant pour la Vie Scolaire et l'intendance (lecture seule & remises). | <img src="screenshots/12.png" alt="Paramètres 4 Mode Vie Scolaire Client Thème Sombre" width="100%" /> |

</details>

---

### Thème Clair & Postes Spécialisés (Écrans 13 à 20)

> *Passage en mode clair* : particulièrement adapté aux environnements très éclairés, aux postes d'administration et aux **postes Vie Scolaire**.

<details open>
<summary><strong>Découvrir les écrans du Thème Clair (Cliquez pour replier / déplier)</strong></summary>
<br />

| N° | Écran | Description | Aperçu |
| :---: | :--- | :--- | :--- |
| **19** | **Écran de Connexion (Login Clair)** | Mire d'authentification ergonomique en mode clair lumineux. | <img src="screenshots/19.png" alt="Login Thème Clair" width="100%" /> |
| **13** | **Poste de Vente (Caisse POS)** | Interface d'encaissement du Foyer en thème clair haute visibilité. | <img src="screenshots/13.png" alt="Poste de Vente Thème Clair" width="100%" /> |
| **14** | **Statistiques (Rapports & Ventes)** | Tableaux de bord financiers et suivi des ventes en thème clair. | <img src="screenshots/14.png" alt="Statistiques Thème Clair" width="100%" /> |
| **15** | **Messagerie Instantanée** | Salons de discussion locaux (#Général, #Admins) pour les équipes du Foyer. | <img src="screenshots/15.png" alt="Messagerie Thème Clair" width="100%" /> |
| **16** | **Rendu de Monnaie & Encaissement** | Dialogue de calcul de monnaie et validation des espèces en thème clair. | <img src="screenshots/16.png" alt="Rendu de Monnaie Thème Clair" width="100%" /> |
| **17** | **Paramètres Personnels** | Préférences du profil utilisateur, raccourcis et options d'affichage. | <img src="screenshots/17.png" alt="Paramètres Personnels Thème Clair" width="100%" /> |
| **18** | **Décaisse Fin d'Heure** | Procédure de clôture de permanence, comptage du tiroir et bilan intermédiaire. | <img src="screenshots/18.png" alt="Décaisse Fin d'Heure Thème Clair" width="100%" /> |
| **20** | **Remise Vie Scolaire (Coffre-fort)** | Registre de décaissement et bordereau de remise d'espèces à la Vie Scolaire / intendance. | <img src="screenshots/20.png" alt="Remise Vie Scolaire Thème Clair" width="100%" /> |

</details>

---

## Téléchargements & Installateurs

Les paquets pré-compilés se trouvent dans le dossier `dist-installers/` :

| Système d'exploitation | Format de paquet | Utilisation |
| :--- | :--- | :--- |
| **Linux Mint / Ubuntu / Debian** | `OpenMDL_1.0.9_amd64.deb` | Double-clic pour installer via la logithèque (gère automatiquement les dépendances) |
| **Fedora / RedHat / openSUSE** | `OpenMDL-1.0.9-1.x86_64.rpm` | Installateur RPM natif |
| **Toutes distributions Linux** | `OpenMDL_1.0.9_amd64.AppImage` | Fichier portable autonome : clic droit > Exécuter, aucune installation nécessaire |
| **Windows 10 / 11** | `OpenMDL_1.0.9_x64-setup.exe` | Installateur Windows NSIS complet (avec raccourci Bureau et Menu Démarrer) |

---

## Démarrage Rapide (Développement)

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

## Compilation des Paquets

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

## Documentation Complète

Une documentation exhaustive décrivant chaque module, la comptabilité, le stockage des données et les procédures d'administration est disponible dans :
👉 [DOCUMENTATION.md](DOCUMENTATION.md)

---

## Données, Stockage & Confidentialité

- **Base de données SQLite & Stockage 100% local** : L'ensemble des données (ventes, catalogue, stocks, utilisateurs, messages) est conservé dans une base relationnelle SQLite native gérée en Rust dans le répertoire applicatif de l'OS (`~/.local/share/openmdl/openmdl.db` sous Linux, `%APPDATA%/openmdl/openmdl.db` sous Windows).
- **Synchronisation & Architecture Réseau LAN** :
  - **Autorité Serveur Foyer** : Le poste Foyer fait autorité sur la base de données.
  - **Poste Vie Scolaire Client** : Réplication automatique des données manquantes en lecture seule et enregistrement des bordereaux de remise au coffre.
  - **Consensus sur les Messages** : Vote à la majorité locale et synchronisation bilatérale des messages échangés hors présence du serveur.
- **Sauvegardes Binaires Haute Performance (.mdlb)** : Sauvegardes ultra-compactes compressées en Zlib avec intégrité garantie par checksum CRC32. Clôture automatique, export sur clé USB et restauration instantanée.

---

## Licence

Ce projet est distribué sous licence libre **MIT**. Conçu pour les lycéens et les associations de lycées.
