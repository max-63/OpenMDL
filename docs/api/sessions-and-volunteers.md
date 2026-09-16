# Séances de Caisse & Bénévoles

Cette section détaille les modules `OpenMDL.sessions`, `OpenMDL.volunteers` et `OpenMDL.perk`, indispensables pour contrôler l'ouverture/fermeture de la caisse, identifier les permanenciers et gérer les droits d'accès.

---

## 1. Séances de Caisse (`OpenMDL.sessions`)

Une séance correspond à une plage horaire d'ouverture du foyer (ex. permanence du midi ou de 16h à 18h).

### Méthodes Disponibles

| Méthode | Paramètres | Type de retour | Description |
| :--- | :--- | :--- | :--- |
| `getActive()` | aucun | `Session \| null` | Renvoie la séance actuellement ouverte ou `null`. |
| `isOpen()` | aucun | `boolean` | Indique si la caisse est actuellement en service. |
| `getHistory()` | aucun | `Session[]` | Renvoie la liste de toutes les séances clôturées. |
| `get(id)` | `id: string` | `Session \| undefined` | Récupère une séance par son identifiant. |
| `open(options?)` | `options?: { notes?: string }` | `{ success: boolean; session?: Session; message: string }` | Ouvre une nouvelle séance avec fond de caisse. |
| `close(options)` | `options: SessionCloseOptions` | `{ success: boolean; session?: Session; message: string }` | Clôture officiellement la séance active. |
| `getDraftClosing()` | aucun | `{ commentary: string; volunteerPerkClaimed: boolean } \| null` | Récupère le brouillon de clôture temporaire. |
| `saveDraftClosing(draft)` | `draft: Object` | `void` | Sauvegarde un brouillon de clôture en cours de saisie. |
| `clearDraftClosing()` | aucun | `void` | Efface le brouillon de clôture. |
| `canClaimPerk(volId, sessId)` | `volId: string, sessId: string` | `boolean` | Indique si le bénévole peut consommer sa boisson offerte. |

---

### Exemple : Vérifier l'État de la Caisse

```typescript
if (!OpenMDL.sessions.isOpen()) {
  OpenMDL.ui.notify('La caisse est actuellement fermée. Veuillez ouvrir une séance pour encaisser.', 'warning');
} else {
  const activeSession = OpenMDL.sessions.getActive();
  console.log(`Séance ouverte par ${activeSession?.volunteerName} depuis ${activeSession?.openedAt}`);
}
```

---

## 2. Bénévoles & Authentification (`OpenMDL.volunteers`)

Le module `OpenMDL.volunteers` permet de gérer les comptes des élèves permanenciers et des administrateurs du bureau MDL / CVL.

### Modèle de Données : `Volunteer`

```typescript
interface Volunteer {
  id: string;         // Identifiant unique
  username: string;   // Pseudo ou identifiant de connexion
  name: string;       // Prénom et Nom d'affichage
  role?: string;      // Rôle associatif (ex: "Trésorier MDL", "Permanencier")
  isAdmin?: boolean;  // Accès complet aux fonctions d'administration
}
```

---

### Méthodes Disponibles

| Méthode | Paramètres | Type de retour | Description |
| :--- | :--- | :--- | :--- |
| `getCurrent()` | aucun | `Volunteer \| null` | Renvoie le bénévole connecté sur le poste. |
| `list()` | aucun | `Volunteer[]` | Liste tous les comptes bénévoles enregistrés. |
| `get(id)` | `id: string` | `Volunteer \| undefined` | Récupère la fiche d'un bénévole par son identifiant. |
| `create(data)` | `data: Object` | `{ success: boolean; volunteer?: Volunteer; message: string }` | Crée un nouveau compte permanent. |
| `login(pinOrPassword)` | `pinOrPassword: string` | `{ success: boolean; volunteer?: Volunteer; message: string }` | Authentifie un bénévole. |
| `logout()` | aucun | `void` | Déconnecte l'utilisateur actuel. |
| `isAdmin()` | aucun | `boolean` | Indique si l'utilisateur possède les privilèges administrateur. |

---

## 3. Collation Bénévole (`OpenMDL.perk`)

OpenMDL intègre un système d'avantage permettant d'offrir une collation ou une boisson aux permanenciers de service sans fausser les stocks :

```typescript
// Vérifier la configuration des collations
const perkConfig = OpenMDL.perk.getConfig();
console.log('Catégories autorisées pour la collation :', perkConfig.eligibleCategories);

// Vérifier si le bénévole actif est éligible pour la séance
const currentVolunteer = OpenMDL.volunteers.getCurrent();
if (currentVolunteer && OpenMDL.perk.isEligible(currentVolunteer.id)) {
  OpenMDL.ui.notify('Vous avez droit à votre collation bénévole pour cette permanence !', 'info');
}
```
