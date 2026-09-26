import { AddonPackage } from '../types/addon';

export const ADDON_GUIDE_MARKDOWN = `# Guide de Développement d'Addons OpenMDL

Bienvenue dans l'environnement de développement d'extensions pour **OpenMDL**, le logiciel de caisse et de gestion du Foyer des Lycéens (MDL / CVL).

---

## 1. Charte Éthique & Politique Open Source

- **Gratuité intégrale et obligatoire** : Les addons développés pour OpenMDL sont destinés à la communauté scolaire, aux Maisons des Lycéens et aux foyers. Toute vente, commercialisation ou monétisation directe ou indirecte d'un addon est **strictement interdite**.
- **Partage GitHub encouragé** : Nous encourageons chaque développeur à publier son addon sous licence libre (ex. MIT) sur son propre compte GitHub afin que l'ensemble des lycées puissent en profiter librement.
- **Respect de la vie privée** : Aucun addon ne doit collecter ou transmettre de données personnelles en dehors de la machine du foyer.
- **Sanctuarisation des Mentions Légales** : Les crédits du logiciel, la paternité des auteurs et les mentions légales d'OpenMDL sont inaltérables.

---

## 2. Technologies & Environnement

OpenMDL repose sur un socle technique léger, rapide et standard :
- **Langage** : TypeScript ou JavaScript standard (Vanilla ES6+).
- **Interface graphique** : HTML5 standard et classes utilitaires **Tailwind CSS**.
- **Aucun framework lourd requis** : Inutile d'installer React ou Vue. Vos vues sont créées directement avec les fonctions DOM standard du navigateur.
- **Composants d'icônes** : Les icônes vectorielles standard SVG du logiciel sont utilisables partout.

---

## 3. Référence Exhaustive de l'API OpenMDL

L'objet global \`OpenMDL\` (accessible aussi via \`window.OpenMDL\`) est disponible partout dans l'application et expose l'intégralité des fonctionnalités du logiciel :

### A. Navigation & Onglets (\`OpenMDL.navigation\`)
\`\`\`typescript
// Ajouter un nouvel onglet complet dans la barre latérale / en-tête
OpenMDL.navigation.registerTab({
  id: 'mon-addon',
  label: 'Mon Onglet',
  icon: 'puzzle', // Nom d'icône valide (puzzle, gift, sparkles, etc.)
  render: (container: HTMLElement) => {
    container.innerHTML = \\\`<div class="p-6">Mon Contenu</div>\\\`;
  }
});

// Naviguer vers un onglet existant
OpenMDL.navigation.goTo('catalog');

// Obtenir l'onglet actuellement actif
const currentTab = OpenMDL.navigation.getCurrentTab();
\`\`\`

### B. Tableau de bord & Widgets (\`OpenMDL.dashboard\`)
\`\`\`typescript
// Enregistrer un widget d'information sur l'écran d'accueil
OpenMDL.dashboard.registerWidget({
  id: 'stats-rapides',
  title: 'Statistiques Hebdo',
  render: (container: HTMLElement) => {
    const stats = OpenMDL.sales.getStats('week');
    container.innerHTML = \\\`
      <div class="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-600">
        <div class="text-xs font-bold uppercase">Recettes de la semaine</div>
        <div class="text-xl font-black font-mono">\\\${OpenMDL.utils.formatPrice(stats.totalRevenue)}</div>
      </div>
    \\\`;
  }
});
\`\`\`

### C. Produits & Stock (\`OpenMDL.products\`)
\`\`\`typescript
// Lister tous les produits
const produits = OpenMDL.products.list();

// Rechercher un produit par nom ou catégorie
const resultats = OpenMDL.products.search('coca');

// Consulter par catégorie ou obtenir un produit par identifiant
const snacks = OpenMDL.products.getByCategory('snacks');
const item = OpenMDL.products.get('prod-1');

// Créer un nouveau produit
OpenMDL.products.create({
  name: 'Ice Tea Pêche',
  category: 'boissons',
  price: 1.00,
  costPrice: 0.50,
  stock: 24,
  minStockAlert: 6,
  imageUrl: '/products/fuze-tea-peche.jpg',
  isActive: true
});

// Réapprovisionner ou ajuster un stock
OpenMDL.products.restock('prod-1', 12, 'Livraison grossiste');
OpenMDL.products.setStock('prod-1', 48);
\`\`\`

### D. Caisse & Ventes (\`OpenMDL.sales\`)
\`\`\`typescript
// Obtenir l'historique ou les ventes du jour
const todaySales = OpenMDL.sales.getTodaySales();

// Obtenir les métriques globales et les meilleures ventes
const stats = OpenMDL.sales.getStats('day'); // 'day' | 'week' | 'month' | 'all'
console.log(stats.totalRevenue, stats.averageBasket, stats.topProducts);

// Enregistrer une vente par programme
OpenMDL.sales.record({
  items: [{ product: item, quantity: 2 }],
  paymentMethod: 'especes', // 'especes' | 'tpe'
  cashReceived: 5.00,
  cashReturned: 3.00
});

// Exporter les ventes au format CSV standard
const csvString = OpenMDL.sales.exportCsv();
\`\`\`

### E. Panier en Direct (\`OpenMDL.cart\`)
\`\`\`typescript
// Consulter les articles actuellement dans le ticket
const cartItems = OpenMDL.cart.getItems();
const montantTotal = OpenMDL.cart.getTotal();

// Manipuler le panier en direct
OpenMDL.cart.add('prod-1', 2);
OpenMDL.cart.remove('prod-1', 1);
OpenMDL.cart.clear();

// Valider et encaisser le panier en cours
await OpenMDL.cart.checkout({ paymentMethod: 'especes' });
\`\`\`

### F. Séances de Caisse (\`OpenMDL.sessions\`)
\`\`\`typescript
// Vérifier l'état de la séance
const activeSession = OpenMDL.sessions.getActive();
const isOpen = OpenMDL.sessions.isOpen();

// Consulter le brouillon de clôture temporaire (si saisi)
const draft = OpenMDL.sessions.getDraftClosing();

// Enregistrer un brouillon de clôture sans fermer la caisse
OpenMDL.sessions.saveDraftClosing({
  commentary: 'Reste à recompter les pièces de 0.50€',
  volunteerPerkClaimed: true
});

// Clôturer officiellement la séance
OpenMDL.sessions.close({
  commentary: 'Aucun incident, caisse juste.',
  volunteerPerkClaimed: true
});
\`\`\`

### G. Bénévoles & Utilisateurs (\`OpenMDL.volunteers\`)
\`\`\`typescript
// Récupérer le bénévole connecté et vérifier ses privilèges
const volunteer = OpenMDL.volunteers.getCurrent();
const isAdmin = OpenMDL.volunteers.isAdmin();

// Lister les bénévoles
const liste = OpenMDL.volunteers.list();
\`\`\`

### H. Collation Bénévole (\`OpenMDL.perk\`)
\`\`\`typescript
// Lire et modifier la configuration du slider et de l'éligibilité
const config = OpenMDL.perk.getConfig(); // { enabled: boolean, rule: string, threshold: number }
const estEligible = OpenMDL.perk.isEligible();
\`\`\`

### I. Événements en Temps Réel (\`OpenMDL.events\`)
\`\`\`typescript
// S'abonner aux événements du système
const unsub = OpenMDL.events.on('sale:completed', (sale) => {
  OpenMDL.ui.notify(\\\`Vente validée : \\\${OpenMDL.utils.formatPrice(sale.totalAmount)}\\\`, 'success');
});

// Autres événements disponibles :
// 'session:opened', 'session:closed', 'cart:updated', 'product:updated', 'stock:updated', 'theme:changed'
\`\`\`

### J. Stockage Persistant Isolé (\`OpenMDL.storage\`)
Chaque addon dispose d'un espace local privé et sécurisé :
\`\`\`typescript
OpenMDL.storage.set('score_top', 150);
const score = OpenMDL.storage.get('score_top', 0);
const toutesLesCles = OpenMDL.storage.keys();
\`\`\`

### K. Interface & Dialogues (\`OpenMDL.ui\`)
\`\`\`typescript
// Notifications toast non intrusives
OpenMDL.ui.notify('Stock mis à jour', 'info'); // 'info' | 'success' | 'warning' | 'error'

// Boîte de dialogue de confirmation
OpenMDL.ui.confirm({
  title: 'Confirmation requise',
  message: 'Voulez-vous réinitialiser le jeu ?',
  confirmText: 'Réinitialiser',
  onConfirm: () => { /* action */ }
});

// Boîte de dialogue avec champ texte (Prompt)
OpenMDL.ui.prompt({
  title: 'Nouveau joueur',
  placeholder: 'Entrez le prénom...',
  onConfirm: (valeur) => {
    OpenMDL.ui.notify(\\\`Bienvenue \\\${valeur}\\\`, 'success');
  }
});

// Fenêtre modale personnalisée
OpenMDL.ui.modal({
  title: 'Règlement du Tournoi',
  content: '<p class="text-xs">Règles complètes...</p>'
});
\`\`\`

### L. Synthèse Audio (\`OpenMDL.audio\`)
Synthétiseur WebAudio 100% hors-ligne (sans fichier externe) :
\`\`\`typescript
OpenMDL.audio.play('cash'); // 'cash' | 'success' | 'warning' | 'error' | 'beep'
OpenMDL.audio.beep(880, 100); // 880Hz pendant 100ms
\`\`\`

### M. Thème & Styles (\`OpenMDL.theme\`)
\`\`\`typescript
const theme = OpenMDL.theme.getTheme(); // 'dark' | 'light'
OpenMDL.theme.toggleTheme();
OpenMDL.theme.injectCss('.mon-style-special { filter: drop-shadow(0 0 8px orange); }', 'mon-addon-css');
\`\`\`

### N. Utilitaires (\`OpenMDL.utils\`)
\`\`\`typescript
OpenMDL.utils.formatPrice(1.5); // "1.50 €"
OpenMDL.utils.formatDate(new Date()); // "16/09/2026"
OpenMDL.utils.generateId('tournoi'); // "tournoi-1726498123-abc"
OpenMDL.utils.downloadFile('rapport.json', JSON.stringify(donnees));
\`\`\`

---

## 4. Comment Exporter et Partager un Addon (.mdlx)

1. Une fois votre addon testé et fonctionnel, cliquez sur l'icône **Exporter** sur la carte de votre addon.
2. OpenMDL génère instantanément un conteneur binaire **\`.mdlx\`** (*OpenMDL Extension Package*) :
   - Fichier ultra-léger et compressé en Zlib natif (Rust).
   - Intégrité vérifiée par somme de contrôle CRC32.
   - Regroupe l'ensemble du projet : \`addon.json\`, \`index.ts\`, styles, templates et documentation.
3. Partagez directement ce fichier \`.mdlx\` avec les autres foyers et membres du CVL (ou dans les releases GitHub).
4. Pour l'installer sur une autre machine, cliquez sur **« Importer un Addon (.mdlx) »** dans la bibliothèque d'addons !
`;

export function createNewAddonTemplate(id: string, name: string, author: string): AddonPackage {
  const cleanId = id.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  const now = new Date().toISOString();

  return {
    manifest: {
      id: cleanId,
      name,
      version: '1.0.0',
      description: 'Extension personnalisée pour OpenMDL.',
      author: author || 'Administrateur',
      category: 'utilitaire',
      icon: 'puzzle',
      enabled: true,
      createdAt: now,
      updatedAt: now
    },
    files: [
      {
        name: 'GUIDE.md',
        path: '/GUIDE.md',
        content: ADDON_GUIDE_MARKDOWN,
        language: 'markdown'
      },
      {
        name: 'addon.json',
        path: '/addon.json',
        content: JSON.stringify(
          {
            id: cleanId,
            name,
            version: '1.0.0',
            description: 'Extension personnalisée pour OpenMDL.',
            author: author || 'Administrateur',
            category: 'utilitaire',
            icon: 'puzzle',
            enabled: true
          },
          null,
          2
        ),
        language: 'json'
      },
      {
        name: 'index.ts',
        path: '/src/index.ts',
        content: `// Point d'entrée principal de l'addon OpenMDL
// Consultez GUIDE.md pour découvrir toutes les fonctions de l'API OpenMDL.

OpenMDL.navigation.registerTab({
  id: '${cleanId}',
  label: '${name}',
  icon: 'puzzle',
  render: (container: HTMLElement) => {
    container.innerHTML = \`
      <div class="h-full flex flex-col gap-4 overflow-y-auto pr-1">
        <div class="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <div class="flex items-center justify-between">
            <h1 class="text-lg font-black text-slate-900 dark:text-white">${name}</h1>
            <span class="px-2.5 py-0.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 text-[10px] font-extrabold uppercase">
              Addon Actif
            </span>
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            Ce module a été conçu avec l'API standard d'OpenMDL et Tailwind CSS.
          </p>
          <div class="pt-2">
            <button id="btn-action" class="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs shadow-xs transition-colors">
              Tester l'API OpenMDL
            </button>
          </div>
        </div>
      </div>
    \`;

    container.querySelector('#btn-action')?.addEventListener('click', () => {
      OpenMDL.ui.notify('Bravo ! Votre addon fonctionne parfaitement.', 'success');
    });
  }
});
`,
        language: 'typescript'
      },
      {
        name: 'style.css',
        path: '/assets/style.css',
        content: `/* Styles optionnels pour l'addon ${name} */
/* Vous pouvez utiliser toutes les classes natives Tailwind CSS directement dans vos gabarits. */
`,
        language: 'css'
      },
      {
        name: 'README.md',
        path: '/README.md',
        content: `# ${name} — Addon pour OpenMDL

${name} est une extension libre et gratuite développée pour le logiciel de caisse OpenMDL (Foyer des Lycéens).

## Auteur
Développé par **${author || 'Administrateur'}**.

## Licence
Cet addon est distribué gratuitement sous licence MIT. Toute revente ou monétisation est strictement interdite.
`,
        language: 'markdown'
      },
      {
        name: 'LICENSE',
        path: '/LICENSE',
        content: `MIT License (OpenMDL Community Non-Commercial Clause)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files, to deal in the Software
without restriction, provided that the software is NOT sold or commercialized.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
`,
        language: 'markdown'
      }
    ]
  };
}

// Addon préinstallé 1 : Calculatrice de Rendu de Monnaie
export const SAMPLE_ADDON_CALCULATOR: AddonPackage = {
  manifest: {
    id: 'monnaie-calculator',
    name: 'Calculatrice & Rendu Monnaie',
    version: '1.0.0',
    description: 'Outil pratique d\'aide au calcul du rendu de monnaie en pièces et billets au comptoir.',
    author: 'Adrien Courault',
    category: 'utilitaire',
    icon: 'calculator',
    enabled: true,
    createdAt: '2026-09-16T10:00:00.000Z',
    updatedAt: '2026-09-16T10:00:00.000Z'
  },
  files: [
    {
      name: 'GUIDE.md',
      path: '/GUIDE.md',
      content: ADDON_GUIDE_MARKDOWN,
      language: 'markdown'
    },
    {
      name: 'addon.json',
      path: '/addon.json',
      content: JSON.stringify({
        id: 'monnaie-calculator',
        name: 'Calculatrice & Rendu Monnaie',
        version: '1.0.0',
        description: 'Outil pratique d\'aide au calcul du rendu de monnaie en pièces et billets au comptoir.',
        author: 'Adrien Courault',
        category: 'utilitaire',
        icon: 'calculator',
        enabled: true
      }, null, 2),
      language: 'json'
    },
    {
      name: 'index.ts',
      path: '/src/index.ts',
      content: `// Addon : Calculatrice & Décomposition du rendu de monnaie
OpenMDL.navigation.registerTab({
  id: 'monnaie-calculator',
  label: 'Rendu Monnaie',
  icon: 'calculator',
  render: (container: HTMLElement) => {
    container.innerHTML = \`
      <div class="h-full flex flex-col gap-4 overflow-y-auto pr-1">
        <div class="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold">
                €
              </div>
              <div>
                <h1 class="text-base font-black text-slate-900 dark:text-white">Aide au Rendu de Monnaie</h1>
                <p class="text-xs text-slate-500">Calculez instantanément les pièces et billets à rendre à l'élève</p>
              </div>
            </div>
            <span class="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase">
              Prêt
            </span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="space-y-1.5">
              <label class="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase">Montant total dû</label>
              <input id="calc-due" type="number" step="0.10" min="0" placeholder="ex: 1.80" class="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-mono font-bold text-slate-900 dark:text-white outline-none focus:border-orange-500" />
            </div>

            <div class="space-y-1.5">
              <label class="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase">Montant donné par l'élève</label>
              <input id="calc-given" type="number" step="0.10" min="0" placeholder="ex: 5.00" class="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-mono font-bold text-slate-900 dark:text-white outline-none focus:border-orange-500" />
            </div>
          </div>

          <div class="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between">
            <span class="text-xs font-bold text-slate-600 dark:text-slate-400">Total à rendre :</span>
            <span id="calc-change-result" class="text-2xl font-black font-mono text-orange-600 dark:text-orange-400">0.00 €</span>
          </div>

          <div id="calc-breakdown" class="hidden space-y-2">
            <span class="text-[11px] font-bold text-slate-500 uppercase">Décomposition conseillée :</span>
            <div id="calc-coins-grid" class="flex flex-wrap gap-2 pt-1"></div>
          </div>
        </div>
      </div>
    \`;

    const inputDue = container.querySelector('#calc-due') as HTMLInputElement;
    const inputGiven = container.querySelector('#calc-given') as HTMLInputElement;
    const resultChange = container.querySelector('#calc-change-result') as HTMLElement;
    const breakdown = container.querySelector('#calc-breakdown') as HTMLElement;
    const coinsGrid = container.querySelector('#calc-coins-grid') as HTMLElement;

    const COINS = [20, 10, 5, 2, 1, 0.50, 0.20, 0.10];

    const calculate = () => {
      const due = parseFloat(inputDue.value || '0');
      const given = parseFloat(inputGiven.value || '0');
      const change = Math.max(0, Math.round((given - due) * 100) / 100);

      resultChange.textContent = OpenMDL.utils.formatPrice(change);

      if (change > 0 && given >= due) {
        breakdown.classList.remove('hidden');
        coinsGrid.innerHTML = '';
        let rem = Math.round(change * 100);

        COINS.forEach(val => {
          const valCents = Math.round(val * 100);
          const count = Math.floor(rem / valCents);
          if (count > 0) {
            rem -= count * valCents;
            const badge = document.createElement('div');
            badge.className = 'px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-xs font-bold text-slate-800 dark:text-slate-200 shadow-xs';
            badge.textContent = count + ' × ' + (val >= 5 ? val + ' € (billet)' : val + ' € (pièce)');
            coinsGrid.appendChild(badge);
          }
        });
      } else {
        breakdown.classList.add('hidden');
      }
    };

    inputDue.addEventListener('input', calculate);
    inputGiven.addEventListener('input', calculate);
  }
});
`,
      language: 'typescript'
    },
    {
      name: 'style.css',
      path: '/assets/style.css',
      content: '/* Styles de la calculatrice */',
      language: 'css'
    },
    {
      name: 'README.md',
      path: '/README.md',
      content: '# Calculatrice & Rendu Monnaie\n\nAddon utilitaire officiel pour OpenMDL.',
      language: 'markdown'
    }
  ]
};

// Addon préinstallé 2 : Tombola & Tirage au sort de tickets
export const SAMPLE_ADDON_TOMBOLA: AddonPackage = {
  manifest: {
    id: 'foyer-tombola',
    name: 'Tombola du Lycée',
    version: '1.0.0',
    description: 'Tirez au sort un ticket de caisse gagnant parmi les ventes de la séance ou de la journée.',
    author: 'Adrien Courault',
    category: 'jeu',
    icon: 'gift',
    enabled: true,
    createdAt: '2026-09-16T10:00:00.000Z',
    updatedAt: '2026-09-16T10:00:00.000Z'
  },
  files: [
    {
      name: 'GUIDE.md',
      path: '/GUIDE.md',
      content: ADDON_GUIDE_MARKDOWN,
      language: 'markdown'
    },
    {
      name: 'addon.json',
      path: '/addon.json',
      content: JSON.stringify({
        id: 'foyer-tombola',
        name: 'Tombola du Lycée',
        version: '1.0.0',
        description: 'Tirez au sort un ticket de caisse gagnant parmi les ventes de la séance ou de la journée.',
        author: 'Adrien Courault',
        category: 'jeu',
        icon: 'gift',
        enabled: true
      }, null, 2),
      language: 'json'
    },
    {
      name: 'index.ts',
      path: '/src/index.ts',
      content: `// Addon : Tombola des Lycéens
OpenMDL.navigation.registerTab({
  id: 'foyer-tombola',
  label: 'Tombola Foyer',
  icon: 'gift',
  render: (container: HTMLElement) => {
    const todaySales = OpenMDL.sales.getTodaySales();

    container.innerHTML = \`
      <div class="h-full flex flex-col gap-4 overflow-y-auto pr-1">
        <div class="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
          <div class="flex items-center justify-between">
            <h1 class="text-base font-black text-slate-900 dark:text-white">Tirage au Sort de la Tombola</h1>
            <span class="px-2.5 py-0.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 text-[10px] font-black uppercase">
              \\\${todaySales.length} tickets éligibles aujourd'hui
            </span>
          </div>

          <p class="text-xs text-slate-500 dark:text-slate-400">
            Faites gagner une canette ou un snack à l'un des élèves ayant consommé au foyer aujourd'hui !
          </p>

          <div id="tombola-result-box" class="p-8 rounded-3xl bg-gradient-to-br from-slate-50 to-orange-50/30 dark:from-slate-800 dark:to-orange-950/20 border border-slate-200 dark:border-slate-700/80 text-center space-y-2">
            <div class="text-xs font-bold uppercase text-slate-400 tracking-wider">Ticket Gagnant</div>
            <div id="winner-ticket" class="text-3xl font-black font-mono text-slate-800 dark:text-white">---</div>
            <div id="winner-details" class="text-xs text-slate-500 dark:text-slate-400 font-medium">Cliquez sur le bouton ci-dessous pour lancer le tirage</div>
          </div>

          <div class="flex justify-center">
            <button id="btn-draw" class="px-6 py-3 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-extrabold text-xs shadow-md shadow-orange-600/20 transition-all cursor-pointer">
              Lancer le Tirage au Sort
            </button>
          </div>
        </div>
      </div>
    \`;

    const btnDraw = container.querySelector('#btn-draw') as HTMLButtonElement;
    const winnerTicket = container.querySelector('#winner-ticket') as HTMLElement;
    const winnerDetails = container.querySelector('#winner-details') as HTMLElement;

    btnDraw?.addEventListener('click', () => {
      const sales = OpenMDL.sales.getTodaySales();
      if (sales.length === 0) {
        OpenMDL.ui.notify('Aucune vente enregistrée aujourd\\'hui pour la tombola.', 'warning');
        return;
      }

      btnDraw.disabled = true;
      let counter = 0;
      const interval = setInterval(() => {
        const rand = sales[Math.floor(Math.random() * sales.length)];
        winnerTicket.textContent = '#' + rand.id.slice(-6).toUpperCase();
        counter++;
        if (counter > 15) {
          clearInterval(interval);
          btnDraw.disabled = false;
          const finalWinner = sales[Math.floor(Math.random() * sales.length)];
          winnerTicket.textContent = '#' + finalWinner.id.slice(-6).toUpperCase();
          winnerDetails.textContent = 'Encaissé à ' + new Date(finalWinner.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) + ' (' + OpenMDL.utils.formatPrice(finalWinner.totalAmount) + ')';
          OpenMDL.ui.notify('Gagnant désigné avec succès !', 'success');
        }
      }, 80);
    });
  }
});
`,
      language: 'typescript'
    },
    {
      name: 'style.css',
      path: '/assets/style.css',
      content: '/* Styles de la tombola */',
      language: 'css'
    },
    {
      name: 'README.md',
      path: '/README.md',
      content: '# Tombola du Foyer\n\nAddon de jeu et d\'animation pour OpenMDL.',
      language: 'markdown'
    }
  ]
};
