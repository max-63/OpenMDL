# Guide de Démarrage & Configuration IDE (VS Code)

Ce guide explique comment configurer votre environnement de développement pour coder des addons OpenMDL sans aucune erreur dans votre éditeur (Visual Studio Code, VSCodium, Lapce, Zed, Cursor, WebStorm).

---

## Pourquoi les IDE affichent-ils parfois des erreurs ?

Dans un projet TypeScript standard, si vous écrivez `OpenMDL.products.list()`, l'éditeur affichera par défaut une erreur soulignée en rouge :
```text
Cannot find name 'OpenMDL'. Did you mean '...'? (ts2304)
```

De même, si vous manipulez le DOM avec `document.createElement()`, TypeScript peut se plaindre si les bibliothèques DOM ne sont pas déclarées dans le projet.

---

## La Solution Clé en Main d'OpenMDL : Zéro Erreur

Pour garantir une expérience de développement fluide, chaque addon généré ou exporté par OpenMDL contient deux fichiers de configuration essentiels :

### 1. Le fichier de typage : `openmdl.d.ts`
Ce fichier déclare formellement l'objet global `OpenMDL` et son raccourci `api`.
Il décrit chaque fonction, ses arguments, ses types de retour et inclut les commentaires de documentation (JSDoc).

Grâce à ce fichier :
- **Aucun avertissement rouge** sur `OpenMDL` ou `api`.
- **IntelliSense complet** : dès que vous tapez `OpenMDL.` ou `api.`, votre IDE propose la liste des modules (`cart`, `sales`, `ui`, etc.).
- **Info-bulles au survol** : survoler une fonction affiche sa description et les paramètres attendus.

### 2. La configuration du compilateur : `tsconfig.json`
Ce fichier indique au moteur TypeScript de votre IDE comment interpréter votre code :

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "moduleResolution": "bundler"
  },
  "include": [
    "src/**/*",
    "openmdl.d.ts"
  ]
}
```

- `"lib": ["ES2022", "DOM", "DOM.Iterable"]` : autorise les fonctions modernes de JavaScript ainsi que tous les éléments graphiques du navigateur (`HTMLElement`, `document`, `window`, `Event`).
- `"skipLibCheck": true` : évite les conflits entre bibliothèques externes.
- `"include": ["src/**/*", "openmdl.d.ts"]` : lie automatiquement le fichier de définitions à tous vos fichiers sources.

---

## Cycle de Développement Recommandé

### Étape 1 : Création de l'addon dans OpenMDL
1. Rendez-vous dans l'onglet **Addons** d'OpenMDL.
2. Cliquez sur **Créer un addon**.
3. Saisissez le nom de votre module (ex. `Tombola Foyer`) et l'auteur.
4. OpenMDL crée le modèle initial, exporte les fichiers sur votre disque dans le dossier de développement :
   - Linux : `~/.local/share/openmdl/addons_dev/<id>/`
   - Windows : `%APPDATA%/openmdl/addons_dev/<id>/`
   - macOS : `~/Library/Application Support/openmdl/addons_dev/<id>/`
5. L'application ouvre automatiquement ce dossier dans **Visual Studio Code** (ou votre éditeur installé).

### Étape 2 : Écriture du code dans VS Code
Ouvrez le fichier `src/index.ts`. Vous pouvez immédiatement exploiter l'API complète :

```typescript
// src/index.ts
OpenMDL.navigation.registerTab({
  id: 'mon-addon',
  label: 'Mon Onglet',
  icon: 'puzzle',
  render: (container: HTMLElement) => {
    container.innerHTML = `
      <div class="p-6 space-y-4">
        <h1 class="text-xl font-black text-slate-900 dark:text-white">Mon Module</h1>
        <button id="btn-action" class="px-4 py-2 rounded-xl bg-orange-600 text-white font-bold text-xs">
          Tester l'action
        </button>
      </div>
    `;

    container.querySelector('#btn-action')?.addEventListener('click', () => {
      OpenMDL.ui.notify('Action déclenchée avec succès !', 'success');
    });
  }
});
```

### Étape 3 : Synchronisation et test dans OpenMDL
1. Sauvegardez votre fichier dans votre éditeur (`Ctrl + S` ou `Cmd + S`).
2. Revenez sur la fenêtre d'OpenMDL.
3. Sur la carte de votre addon, cliquez sur l'icône **Synchroniser** (flèches circulaires).
4. Vos modifications sont immédiatement rechargées en direct dans la caisse, sans avoir besoin de redémarrer le logiciel.

---

## Extensions VS Code Recommandées

Pour un confort optimal :
- **Tailwind CSS IntelliSense** (`bradlc.vscode-tailwindcss`) : autocomplétion pour les classes utilitaires CSS (ex. `rounded-3xl`, `bg-slate-900`).
- **Pretty TypeScript Errors** (`yoavbls.pretty-ts-errors`) : affichage lisible et clair des types TypeScript.
