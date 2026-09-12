# 📖 Manuel d'Utilisation & Documentation Technique — OpenMDL

Bienvenue dans la documentation complète d'**OpenMDL**, le logiciel de caisse et de gestion conçu spécifiquement pour les Foyers et Maisons des Lycéens (MDL / CVL).

---

## 📑 Sommaire

1. [Contexte & Philosophie du Projet](#1-contexte--philosophie-du-projet)
2. [Architecture Technique](#2-architecture-technique)
3. [Guide Utilisateur : Les Modules au Quotidien](#3-guide-utilisateur--les-modules-au-quotidien)
   - [3.1 Authentification & Rôles](#31-authentification--rôles)
   - [3.2 La Caisse Enregistreuse (POS)](#32-la-caisse-enregistreuse-pos)
   - [3.3 Le Terminal TPE (SumUp Solo)](#33-le-terminal-tpe-sumup-solo)
   - [3.4 La Clôture de Caisse Journalière](#34-la-clôture-de-caisse-journalière)
   - [3.5 Le Catalogue & Gestion des Tarifs](#35-le-catalogue--gestion-des-tarifs)
   - [3.6 Le Restock Express](#36-le-restock-express)
   - [3.7 Les Statistiques & Frais Bancaires](#37-les-statistiques--frais-bancaires)
   - [3.8 Paramètres & Personnalisation](#38-paramètres--personnalisation)
4. [Gestion des Données, Sauvegardes & Emplacements](#4-gestion-des-données-sauvegardes--emplacements)
5. [Guide de Déploiement & Installation](#5-guide-de-déploiement--installation)
   - [Installation sur Linux Mint / Ubuntu (.deb)](#installation-sur-linux-mint--ubuntu-deb)
   - [Installation sur Fedora / RedHat (.rpm)](#installation-sur-fedora--redhat-rpm)
   - [Exécution Portable (.AppImage)](#exécution-portable-appimage)
   - [Installation sur Windows 10/11 (.exe)](#installation-sur-windows-1011-exe)
6. [Compilation & Guide Développeur](#6-compilation--guide-développeur)
   - [Script multi-plateformes `build-all.sh`](#script-multi-plateformes-build-allsh)
   - [Dépannage & Bonnes Pratiques](#dépannage--bonnes-pratiques)

---

## 1. Contexte & Philosophie du Projet

Dans les lycées, la Maison des Lycéens (loi 1901) gère le foyer des élèves, proposant des boissons, des snacks et des activités. Ce fonctionnement rencontre des contraintes fortes :
- **Fort afflux sur des périodes très courtes** (15 minutes de récréation, 1h de pause méridienne) : la caisse doit être instantanée, sans chargement ni lenteur.
- **Bénévoles multiples et tournants** : l'interface doit être intuitive dès la première seconde, sans formation requise.
- **Réseau inexistant ou instable** : le Wi-Fi des établissements scolaires est souvent filtré ou indisponible dans les sous-sols du foyer. Le logiciel doit fonctionner **100% hors-ligne**.
- **Comptabilité associative rigoureuse** : traçabilité des espèces, des encaissements par carte et des frais bancaires (ex: 1,75% SumUp) pour le bilan financier présenté en Assemblée Générale.

---

## 2. Architecture Technique

OpenMDL repose sur une architecture moderne alliant la légèreté du Web et les performances natives de Rust :

```
┌────────────────────────────────────────────────────────────┐
│                       INTERFACE WEB                        │
│   TypeScript + Vite + Tailwind CSS v4 + Chart.js + Lucide   │
└─────────────────────────────┬──────────────────────────────┘
                              │ IPC (Tauri v2)
┌─────────────────────────────▼──────────────────────────────┐
│                    MOTEUR NATIF RUST                       │
│    Gestion de fenêtre frameless, backups disques & logs    │
└─────────────────────────────┬──────────────────────────────┘
                              │
┌─────────────────────────────▼──────────────────────────────┐
│                    SYSTÈME HÔTE (OS)                       │
│     Linux (WebKitGTK)   /   Windows 10/11 (WebView2)       │
└────────────────────────────────────────────────────────────┘
```

### Principales technologies :
- **Tauri v2** : Runtime applicatif natif en Rust, consommant très peu de RAM (< 60 Mo contre 300 Mo+ pour Electron).
- **Vite 8 & TypeScript** : Bundler ultra-rapide et typage strict pour la fiabilité du code.
- **Tailwind CSS v4** : Design moderne avec support complet du Mode Sombre et du Mode Clair.
- **Chart.js** : Visualisation graphique des ventes et des bilans financiers.
- **Persistance hybride** : Base de données réactive dans le stockage local (avec déclenchement automatique d'événements) doublée de fonctions de sauvegarde natives Rust dans le dossier applicatif du système.

---

## 3. Guide Utilisateur : Les Modules au Quotidien

### 3.1 Authentification & Rôles

Au lancement, OpenMDL présente un écran de connexion sécurisé :
* **Rôle Bénévole / Vendeur** : Permet de gérer la caisse, d'enregistrer les ventes et d'effectuer la clôture de caisse quotidienne.
* **Rôle Trésorier / Bureau** : Protégé par un code PIN (par défaut : `1234`, modifiable dans les paramètres). Débloque l'accès aux statistiques complètes, au catalogue, au réapprovisionnement et à la configuration.

---

### 3.2 La Caisse Enregistreuse (POS)

L'écran principal de vente est pensé pour aller vite :
1. **Sélection des articles** : Cliquez sur les cartes produits ou utilisez la barre de recherche rapide par nom ou catégorie (Boissons, Snacks, Viennoiseries, etc.).
2. **Gestion du Panier** :
   - Ajustement direct des quantités (`+` et `-`).
   - Switch **« Tarif Adhérent MDL »** : applique immédiatement le prix réduit aux élèves à jour de leur cotisation.
3. **Encaissement** :
   - Cliquez sur **« Encaisser »** (ou raccourci clavier `Entrée`).
   - **Mode Espèces** : Des boutons rapides (5€, 10€, 20€) permettent de calculer automatiquement la monnaie exacte à rendre à l'élève.
   - **Mode Carte Bancaire (TPE)** : Déclenche l'interaction avec le terminal SumUp Solo.

---

### 3.3 Le Terminal TPE (SumUp Solo)

L'onglet **TPE** permet de piloter et superviser les encaissements par carte bancaire :
- **Simulation et appairage** : Visualisation réaliste du boîtier SumUp Solo avec état de batterie, puissance du signal et statut de connexion.
- **Bip de confirmation audio** : Un signal sonore natif confirme la validation du paiement sans contact.
- **Journal des transactions** : Historique en temps réel de tous les paiements CB effectués au centime près.

---

### 3.4 La Clôture de Caisse Journalière

En fin de permanence, le bénévole clique sur le bouton **« Fermer la Caisse »** dans l'en-tête :
1. L'application affiche le récapitulatif des encaissements de la session (total espèces théorique et total CB).
2. Le bénévole saisit le montant réel compté dans le tiroir-caisse.
3. L'application calcule immédiatement l'écart de caisse éventuel (excédent ou déficit).
4. La session est archivée et un rapport de clôture est généré.

---

### 3.5 Le Catalogue & Gestion des Tarifs

Accessible au bureau de l'association :
- Création, modification et suppression d'articles.
- **Importation directe de photos** : Téléversement direct depuis l'ordinateur (PNG, JPG, WebP, SVG) ou par glisser-déposer. Les photos sont redimensionnées et optimisées localement pour fonctionner 100% hors-ligne.
- Définition d'un **Prix Public** et d'un **Prix Adhérent**.
- Gestion du stock actuel et du seuil d'alerte (stock bas signalé en rouge/orange sur la caisse).

---

### 3.6 Le Restock Express

Lors de la réception des courses ou de la livraison du grossiste :
1. Sélectionnez le produit reçu.
2. Indiquez la quantité livrée (par exemple 24 canettes) et le montant total payé par la MDL.
3. OpenMDL calcule automatiquement :
   - Le **coût unitaire d'achat**.
   - La **marge nette unitaire** et le **taux de marge**.
4. Le stock est incrémenté immédiatement et la dépense est enregistrée dans l'historique d'achats.

---

### 3.7 Les Statistiques & Frais Bancaires

L'onglet **Statistiques** offre une visibilité totale sur la santé financière du foyer :
- **Chiffre d'Affaires Brut** et **Bénéfice Net**.
- **Prise en compte des frais bancaires** : Les frais SumUp (1,75% par défaut) sont calculés au centime près et déduits automatiquement du bénéfice pour éviter les mauvaises surprises comptables.
- **Graphiques d'évolution** :
  - Ventes journalières et mensuelles.
  - Répartition des modes de paiement (Espèces vs Carte Bancaire).
  - Couche dédiée aux frais bancaires sur le graphique annuel pour visualiser le coût réel des encaissements par carte.

---

### 3.8 Paramètres & Gestion des Données

- **Gestion des comptes & mots de passe bénévoles**.
- **Bascule Production / Démonstration** :
  - **« Réinitialiser la caisse à zéro »** : Épure instantanément toutes les ventes et transactions de test pour démarrer avec une caisse neuve et propre au foyer du lycée.
  - **« Charger les données de démo »** : Génère en un clic un jeu complet de données réalistes sur plusieurs mois pour faire des démonstrations et des captures d'écran.
- Configuration du pourcentage de frais TPE (par défaut : `1.75%`).
- Bascule du thème visuel (Clair / Sombre).
- Sauvegarde et restauration manuelle de la base de données.

---

## 4. Gestion des Données, Sauvegardes & Emplacements

Toutes les données restent sous votre contrôle exclusif :

### Emplacements système :
* **Sous Linux** : `~/.local/share/openmdl/`
  - `backups/` : archives JSON générées automatiquement.
  - `logs/` : journaux d'exécution (`openmdl_day_X.log`).
* **Sous Windows** : `%APPDATA%\openmdl\`

### Sauvegarder sur clé USB :
1. Rendez-vous dans l'onglet **Paramètres** de l'application.
2. Cliquez sur **« Exporter une sauvegarde JSON »**.
3. Enregistrez le fichier sur votre clé USB.
4. Pour restaurer les données sur un nouvel ordinateur, cliquez simplement sur **« Restaurer une sauvegarde »** et sélectionnez ce fichier.

---

## 5. Guide de Déploiement & Installation

### Installation sur Linux Mint / Ubuntu (.deb)
Le format `.deb` est le format standard pour Linux Mint et Ubuntu :
1. Double-cliquez sur le fichier `OpenMDL_1.0.0_amd64.deb`.
2. L'installateur graphique de paquets (Gdebi ou Logithèque) s'ouvre.
3. Cliquez sur **« Installer le paquet »** (saisissez le mot de passe utilisateur si demandé).
4. Les dépendances manquantes éventuelles sont téléchargées automatiquement.
5. **OpenMDL** est désormais accessible dans le menu des applications (lanceur avec logo officiel).

### Installation sur Fedora / RedHat (.rpm)
1. Double-cliquez sur `OpenMDL-1.0.0-1.x86_64.rpm` ou lancez dans le terminal :
   ```bash
   sudo dnf install ./OpenMDL-1.0.0-1.x86_64.rpm
   ```

### Exécution Portable (.AppImage)
Fonctionne sur n'importe quelle distribution Linux sans rien installer :
1. Clic-droit sur `OpenMDL_1.0.0_amd64.AppImage` > **Propriétés** > Cocher **« Autoriser l'exécution »**.
2. Double-cliquez sur le fichier pour lancer immédiatement l'application.

### Installation sur Windows 10/11 (.exe)
1. Double-cliquez sur `OpenMDL_1.0.0_x64-setup.exe`.
2. Suivez l'assistant d'installation NSIS classique (Suivant > Installer).
3. L'installateur crée le raccourci sur le Bureau et dans le menu Démarrer Windows.

---

## 6. Compilation & Guide Développeur

### Script multi-plateformes `build-all.sh`

Le projet inclut un outil de compilation automatisé à la racine :

```bash
./build-all.sh
# ou
npm run build:all
```

Ce script :
1. Compile le frontend TypeScript avec Vite en mode production.
2. Enchaîne les compilations des cibles :
   - `AppImage` (Linux universel)
   - `DEB` (Linux Mint / Ubuntu)
   - `RPM` (Fedora)
   - `NSIS (.exe)` (Windows 64 bits via MinGW)
3. Affiche en temps réel l'avancement avec un tableau de bord coloré et des chronomètres.
4. Centralise tous les installateurs produits dans le dossier `./dist-installers/`.

### Dépannage & Bonnes Pratiques

* **Problème de `strip` lors de la création d'AppImage sous Linux récent (glibc DT_RELR)** :
  La variable d'environnement `NO_STRIP=true` est automatiquement déclarée dans `build-all.sh` pour éviter que l'outil de packaging ne bloque sur les binaires récents.
* **Compilation Windows depuis Linux** :
  Assurez-vous que les paquets MinGW sont présents :
  - Sur Fedora : `sudo dnf install mingw64-gcc mingw64-binutils mingw32-nsis`
  - Sur Ubuntu/Debian : `sudo apt install mingw-w64 nsis`
  Et que la cible Rust est installée : `rustup target add x86_64-pc-windows-gnu`.

---

*OpenMDL — Développé avec passion pour l'autonomie et l'efficacité des associations lycéennes.*
