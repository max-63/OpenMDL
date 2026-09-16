# Navigation & Tableau de Bord

Cette section détaille l'intégration de votre addon dans l'interface principale d'OpenMDL, soit sous la forme d'un onglet complet, soit sous la forme d'un widget sur l'écran d'accueil.

---

## 1. Module de Navigation (`OpenMDL.navigation`)

Le module de navigation permet d'ajouter un écran complet accessible depuis le menu latéral ou l'en-tête de l'application.

### Méthodes Disponibles

| Méthode | Paramètres | Type de retour | Description |
| :--- | :--- | :--- | :--- |
| `registerTab(tab)` | `tab: Object` | `void` | Déclare un nouvel écran dans la barre de navigation. |
| `unregisterTab(tabId)` | `tabId: string` | `void` | Supprime un onglet précédemment enregistré. |
| `goTo(tabId)` | `tabId: string` | `void` | Bascule immédiatement l'affichage sur l'onglet ciblé. |
| `getCurrentTab()` | aucun | `string` | Renvoie l'identifiant de l'onglet actuellement affiché. |
| `getRegisteredTabs()` | aucun | `RegisteredTab[]` | Renvoie la liste de tous les onglets d'addons actifs. |
| `refresh()` | aucun | `void` | Force le réaffichage de la vue courante. |

---

### Enregistrer un Onglet (`registerTab`)

```typescript
OpenMDL.navigation.registerTab({
  id: 'stats-avancees',
  label: 'Statistiques Avancées',
  icon: 'chart', // puzzle, gift, sparkles, calculator, tag, chart, book
  render: (container: HTMLElement) => {
    // Vider et peupler le conteneur DOM fourni par OpenMDL
    container.innerHTML = `
      <div class="h-full flex flex-col gap-4 overflow-y-auto pr-1">
        <div class="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <h1 class="text-lg font-black text-slate-900 dark:text-white">Analyse des Recettes</h1>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            Données compilées en direct depuis les ventes de la séance active.
          </p>
          <div id="stats-content" class="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            <!-- Contenu dynamique -->
          </div>
        </div>
      </div>
    `;

    // Attacher la logique événementielle
    const stats = OpenMDL.sales.getStats('day');
    const contentBox = container.querySelector('#stats-content');
    if (contentBox) {
      contentBox.innerHTML = `
        <div class="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20">
          <div class="text-[10px] font-extrabold uppercase text-orange-600">Total Recettes</div>
          <div class="text-xl font-black font-mono text-slate-800 dark:text-white mt-1">
            ${OpenMDL.utils.formatPrice(stats.totalRevenue)}
          </div>
        </div>
      `;
    }
  }
});
```

---

### Changer d'Écran par Programme (`goTo`)

Vous pouvez rediriger l'utilisateur vers un autre onglet du logiciel (ex. `cash`, `history`, `inventory`, `volunteers`, `settings`, `addons` ou l'identifiant d'un de vos addons) :

```typescript
// Rediriger vers l'écran d'encaissement de la caisse
OpenMDL.navigation.goTo('cash');
```

---

## 2. Tableau de Bord & Widgets (`OpenMDL.dashboard`)

Le tableau de bord d'accueil permet d'afficher des cartes d'informations synthétiques (widgets) visibles dès l'ouverture de la session.

### Méthodes Disponibles

| Méthode | Paramètres | Type de retour | Description |
| :--- | :--- | :--- | :--- |
| `registerWidget(widget)` | `widget: Object` | `void` | Ajoute une tuile d'information sur l'écran d'accueil. |
| `unregisterWidget(widgetId)` | `widgetId: string` | `void` | Retire un widget spécifique. |
| `getRegisteredWidgets()` | aucun | `RegisteredWidget[]` | Renvoie la liste des widgets enregistrés. |

---

### Exemple de Widget d'Accueil

```typescript
OpenMDL.dashboard.registerWidget({
  id: 'alertes-stock-critique',
  title: 'Articles à Réapprovisionner',
  render: (container: HTMLElement) => {
    const ruptures = OpenMDL.products
      .list()
      .filter(p => p.stock <= p.minStockAlert && p.isActive);

    if (ruptures.length === 0) {
      container.innerHTML = `
        <div class="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
          Tous les stocks sont à un niveau optimal.
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 space-y-2">
        <div class="text-xs font-extrabold uppercase text-rose-600 dark:text-rose-400">
          ${ruptures.length} référence(s) sous le seuil d'alerte
        </div>
        <ul class="text-xs text-slate-700 dark:text-slate-300 space-y-1">
          ${ruptures.slice(0, 3).map(p => `
            <li class="flex items-center justify-between">
              <span>${p.name}</span>
              <span class="font-mono font-bold text-rose-500">${p.stock} restant(s)</span>
            </li>
          `).join('')}
        </ul>
      </div>
    `;
  }
});
```
