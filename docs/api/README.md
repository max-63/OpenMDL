# Documentation Officielle de l'API Addon OpenMDL

Bienvenue dans la documentation complète pour le développement d'extensions (**addons**) sur **OpenMDL**, le logiciel de caisse et de gestion du Foyer des Lycéens (Maison des Lycéens - MDL / Conseil de la Vie Lycéenne - CVL).

---

## Sommaire de la Documentation

1. [Guide de Démarrage & Configuration IDE (VS Code)](./getting-started.md) : Installer son environnement, éviter toute erreur TypeScript et comprendre le cycle d'exécution.
2. [Navigation & Tableau de Bord](./navigation-and-dashboard.md) : Enregistrer des onglets personnalisés et des widgets sur l'écran d'accueil.
3. [Produits & Gestion des Stocks](./products-and-inventory.md) : Consulter, rechercher, créer et réapprovisionner les articles.
4. [Ventes, Panier & Statistiques](./sales-and-cart.md) : Manipuler le panier en direct, encaisser des ventes et analyser les recettes.
5. [Séances de Caisse & Bénévoles](./sessions-and-volunteers.md) : Gérer les ouvertures/fermetures de séance, les comptes bénévoles et les collations.
6. [Événements Temps Réel & Stockage](./events-and-storage.md) : Écouter les événements du logiciel et persister des données isolées par addon.
7. [Interface Utilisateur & Synthétiseur Audio](./ui-and-audio.md) : Boîtes modales, dialogues, notifications toasts, Markdown et retours sonores WebAudio.
8. [Système & Utilitaires](./system-and-utils.md) : Informations globales, sauvegardes JSON, formatage des prix et dates.
9. [Fichier de Définition TypeScript (openmdl.d.ts)](./openmdl.d.ts) : Typages complets pour l'autocomplétion et la vérification statique.

---

## Principes Fondamentaux & Charte

### 1. Gratuité Obligatoire & Interdiction de Commercialisation
OpenMDL est un logiciel libre dédié à l'engagement lycéen et associatif. La vente d'addons, l'intégration de systèmes de paiement tiers non autorisés ou l'accès payant à des fonctionnalités sont **strictement interdits**.

### 2. Partage Open Source & Collaboration
Le développement d'addons a vocation à enrichir la communauté. Tout délégué ou développeur est invité à publier ses addons sous licence libre (MIT, GPL ou Apache 2.0) sur GitHub pour en faire profiter d'autres établissements.

### 3. Exécution 100% Hors-Ligne & Respect des Données
Le logiciel fonctionne en autonomie complète, sans connexion Internet requise. Les addons ne doivent effectuer aucune transmission externe de données confidentielles (comptabilité, coordonnées des élèves ou des bénévoles).

### 4. Respect des Mentions Légales
Les crédits du logiciel, la paternité de l'auteur original et les mentions légales d'OpenMDL ne doivent pas être masqués ou modifiés par un addon.

---

## Structure d'un Addon

Un addon OpenMDL est constitué d'un ensemble de fichiers organisés comme suit :

```text
mon-addon/
├── addon.json         # Manifeste descriptif (nom, version, auteur, icône, catégorie)
├── src/
│   └── index.ts       # Point d'entrée principal en TypeScript
├── assets/
│   └── style.css      # Feuilles de styles CSS additionnelles
├── README.md          # Documentation utilisateur de l'addon
├── tsconfig.json      # Configuration du compilateur TypeScript (pour VS Code)
└── openmdl.d.ts       # Définitions des types de l'API OpenMDL
```

### Le Manifeste (`addon.json`)

Le fichier `addon.json` contient les métadonnées déclaratives du module :

```json
{
  "id": "foyer-tombola",
  "name": "Tombola du Lycée",
  "version": "1.0.0",
  "description": "Tirage au sort automatique parmi les tickets de caisse du jour.",
  "author": "Bureau MDL / CVL",
  "category": "jeu",
  "icon": "gift",
  "enabled": true
}
```

- **id** : Identifiant unique composé de lettres minuscules, chiffres, tirets (`-`) ou underscores (`_`).
- **category** : Catégorie du module (`caisse`, `marketing`, `utilitaire`, `jeu`, `autre`).
- **icon** : Nom d'une icône intégrée dans le thème (ex. `gift`, `puzzle`, `calculator`, `sparkles`, `chart`, `tag`).
- **enabled** : Indique si l'addon est activé par défaut au démarrage.

---

## Objet Global d'Accès

Dans le code de vos addons, l'API OpenMDL est accessible par deux alias universels équivalents :

```typescript
// Accès standard
OpenMDL.ui.notify("Bienvenue dans mon addon !", "success");

// Raccourci équivalent
api.ui.notify("Bienvenue dans mon addon !", "success");
```

---

## Packaging & Format Binaire `.mdlx`

Pour distribuer et installer des addons simplement d'un lycée à un autre sans manipulation manuelle de dossiers, OpenMDL utilise son propre format de conteneur binaire : **`.mdlx` (OpenMDL Extension Package)**.

- **Contenu du paquet** : l'archive `.mdlx` regroupe le manifeste `addon.json`, tous vos scripts sources (`src/*.ts`), styles (`*.css`) et documentations (`*.md`).
- **Compression Zlib native** : compression gérée par le moteur Rust d'OpenMDL pour une taille minimale.
- **Contrôle d'intégrité CRC32** : une somme de contrôle vérifie que le fichier n'a pas été altéré ou tronqué lors du transfert.
- **Export en 1 clic** : cliquez sur l'icône de téléchargement sur la carte de votre addon dans OpenMDL pour générer instantanément le fichier `<id>.mdlx`.
- **Importation universelle** : cliquez sur **« Importer un Addon (.mdlx) »** pour charger le module dans la bibliothèque du foyer (les anciens formats `.json` restent également acceptés).
