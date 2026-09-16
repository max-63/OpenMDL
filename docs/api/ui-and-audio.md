# Interface Utilisateur & Synthétiseur Audio

Cette section détaille les interactions visuelles (`OpenMDL.ui`) et sonores (`OpenMDL.audio`) permettant d'enrichir l'expérience utilisateur de vos addons.

---

## 1. Interface Graphique (`OpenMDL.ui`)

Le module `OpenMDL.ui` expose des fonctions prêtes à l'emploi respectant la charte visuelle d'OpenMDL (thème clair/sombre, animations fluides, boutons stylisés).

### Méthodes Disponibles

| Méthode | Paramètres | Type de retour | Description |
| :--- | :--- | :--- | :--- |
| `notify(msg, type?)` | `msg: string, type?: 'info' \| 'success' \| 'warning' \| 'error'` | `void` | Affiche une notification toast temporaire. |
| `confirm(options)` | `options: ConfirmOptions` | `void` | Ouvre une boîte modale de confirmation avec callback. |
| `prompt(options)` | `options: PromptOptions` | `void` | Ouvre une boîte de dialogue avec champ de saisie texte. |
| `modal(options)` | `options: ModalOptions` | `void` | Affiche une boîte modale personnalisée avec contenu HTML/DOM. |
| `closeModal()` | aucun | `void` | Ferme immédiatement la modale active. |
| `renderMarkdown(md)`| `md: string` | `string` | Convertit une chaîne Markdown en HTML sécurisé. |
| `playSound(sound)` | `sound: 'beep' \| 'success' \| 'warning' \| 'error' \| 'cash'` | `void` | Joue un retour sonore système prédéfini. |
| `toggleFullscreen()`| aucun | `void` | Bascule le mode plein écran sur le poste de caisse. |

---

### Exemples d'Utilisation

#### A. Notifications Toast
```typescript
OpenMDL.ui.notify('Opération réussie avec succès !', 'success');
OpenMDL.ui.notify('Stock insuffisant pour ce produit.', 'warning');
OpenMDL.ui.notify('Une erreur est survenue.', 'error');
```

#### B. Boîte de Confirmation
```typescript
OpenMDL.ui.confirm({
  title: 'Réinitialiser les scores',
  message: 'Voulez-vous vraiment remettre tous les compteurs à zéro ? Cette action est irréversible.',
  confirmText: 'Oui, réinitialiser',
  cancelText: 'Annuler',
  onConfirm: () => {
    OpenMDL.storage.clear();
    OpenMDL.ui.notify('Scores réinitialisés !', 'info');
  }
});
```

#### C. Boîte de Saisie (Prompt)
```typescript
OpenMDL.ui.prompt({
  title: 'Code Promo Spécial',
  message: 'Entrez le code promo distribué par le bureau CVL :',
  placeholder: 'ex: NOEL2026',
  confirmText: 'Appliquer',
  onConfirm: (codeSaisi) => {
    if (codeSaisi.toUpperCase() === 'NOEL2026') {
      OpenMDL.ui.notify('Réduction de 10% appliquée au panier !', 'success');
    } else {
      OpenMDL.ui.notify('Code promotionnel invalide.', 'error');
    }
  }
});
```

#### D. Fenêtre Modale Personnalisée
```typescript
const modalContent = document.createElement('div');
modalContent.className = 'space-y-4 text-xs';
modalContent.innerHTML = `
  <p class="text-slate-600 dark:text-slate-300">
    Ce module permet de générer des étiquettes de code-barres pour les nouveaux produits.
  </p>
  <button id="btn-imprimer" class="w-full py-2.5 rounded-xl bg-orange-600 text-white font-bold">
    Lancer l'impression
  </button>
`;

modalContent.querySelector('#btn-imprimer')?.addEventListener('click', () => {
  OpenMDL.ui.closeModal();
  OpenMDL.ui.notify('Impression demandée au système.', 'info');
});

OpenMDL.ui.modal({
  title: 'Générateur d\'Étiquettes',
  content: modalContent
});
```

---

## 2. Synthétiseur Audio WebAudio (`OpenMDL.audio`)

OpenMDL intègre un synthétiseur audio WebAudio **100% autonome et hors-ligne**, ne dépendant d'aucun fichier son externe ou connexion réseau.

### Méthodes Disponibles

| Méthode | Paramètres | Type de retour | Description |
| :--- | :--- | :--- | :--- |
| `play(sound)` | `'beep' \| 'success' \| 'warning' \| 'error' \| 'cash'` | `void` | Joue un son prédéfini et calibré. |
| `beep(freq?, ms?, type?)` | `freq?: number, ms?: number, type?: OscillatorType` | `void` | Synthétise une fréquence sonore personnalisée en Hertz. |
| `isMuted()` | aucun | `boolean` | Indique si le son de la caisse est actuellement coupé. |
| `setMuted(muted)` | `muted: boolean` | `void` | Active ou désactive le mode muet. |

---

### Exemples Sonores

```typescript
// Son de validation de caisse (accord ascendant)
OpenMDL.audio.play('success');

// Son de tiroir-caisse
OpenMDL.audio.play('cash');

// Alerte d'erreur
OpenMDL.audio.play('error');

// Synthétiser un signal personnalisé : 880 Hz pendant 200 ms en onde carrée
OpenMDL.audio.beep(880, 200, 'square');
```
