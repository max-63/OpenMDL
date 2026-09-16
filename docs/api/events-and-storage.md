# Événements Temps Réel & Stockage

Cette section décrit les modules `OpenMDL.events` (bus d'événements interne réactif) et `OpenMDL.storage` (mémoire persistante isolée par addon).

---

## 1. Bus d'Événements (`OpenMDL.events`)

Le bus d'événements permet à votre addon de réagir automatiquement aux actions effectuées dans la caisse par les permanenciers, sans avoir à sonder la base en boucle.

### Événements Système Disponibles

| Événement | Description | Contenu du payload |
| :--- | :--- | :--- |
| `sale:completed` | Une vente a été encaissée avec succès. | `{ sale: Sale }` |
| `sale:cancelled` | Une vente passée a été annulée. | `{ saleId: string }` |
| `session:opened` | Une nouvelle séance de caisse a été démarrée. | `{ session: Session }` |
| `session:closed` | Une séance de caisse a été clôturée. | `{ session: Session }` |
| `cart:updated` | Le contenu ou les quantités du panier ont changé. | `{ items: CartItem[], total: number }` |
| `product:updated` | Un produit a été modifié ou son stock a varié. | `{ product: Product }` |
| `product:deleted` | Un produit a été supprimé du catalogue. | `{ productId: string }` |
| `stock:updated` | Le stock d'un produit a été réajusté. | `{ productId: string, newStock: number }` |
| `theme:changed` | Le mode sombre ou clair a été basculé. | `{ theme: 'dark' \| 'light' }` |
| `volunteer:login` | Un bénévole s'est connecté. | `{ volunteer: Volunteer }` |
| `volunteer:logout`| L'utilisateur en cours s'est déconnecté. | aucun |
| `perk:claimed` | Une collation bénévole a été validée. | `{ volunteerId: string, productId: string }` |

---

### Méthodes Disponibles

| Méthode | Paramètres | Type de retour | Description |
| :--- | :--- | :--- | :--- |
| `on(event, listener)` | `event: string, listener: Function` | `() => void` | Abonne un écouteur. Renvoie une fonction de désabonnement. |
| `once(event, listener)` | `event: string, listener: Function` | `() => void` | Écoute l'événement une seule fois puis se désabonne. |
| `off(event, listener)` | `event: string, listener: Function` | `void` | Retire un écouteur spécifique. |
| `emit(event, payload?)` | `event: string, payload?: any` | `void` | Déclenche un événement personnalisé sur le bus. |

---

### Exemple : Déclencher un Son Spécial à Chaque Vente

```typescript
// S'abonner aux encaissements terminés
const unsubscribe = OpenMDL.events.on('sale:completed', (payload) => {
  const sale = payload.sale;
  console.log(`Vente validée (#${sale.id}) pour un montant de ${OpenMDL.utils.formatPrice(sale.totalAmount)}`);

  // Jouer le tintement de tiroir-caisse
  OpenMDL.audio.play('cash');
});

// Se désabonner plus tard si nécessaire
// unsubscribe();
```

---

## 2. Stockage Isolé & Persistant (`OpenMDL.storage`)

Chaque addon dispose d'un espace de stockage clé-valeur totalement isolé et sauvegardé de manière persistante sur la machine. Les données ne sont pas perdues lors du redémarrage du logiciel.

### Méthodes Disponibles

| Méthode | Paramètres | Type de retour | Description |
| :--- | :--- | :--- | :--- |
| `get<T>(key, default?)` | `key: string, defaultValue?: T` | `T` | Récupère une valeur typée ou la valeur par défaut. |
| `set<T>(key, value)` | `key: string, value: T` | `void` | Sauvegarde une valeur (chaîne, nombre, tableau, objet JSON). |
| `remove(key)` | `key: string` | `void` | Supprime une clé spécifique. |
| `clear()` | aucun | `void` | Efface toutes les données de l'addon courant. |
| `keys()` | aucun | `string[]` | Renvoie la liste des clés enregistrées. |
| `getAll()` | aucun | `Record<string, any>` | Renvoie l'intégralité du magasin sous forme d'objet. |

---

### Exemple : Sauvegarder les Paramètres d'un Jeu ou d'une Tombola

```typescript
interface TombolaConfig {
  ticketPrice: number;
  maxWinners: number;
  authorizedRoles: string[];
}

// Sauvegarder la configuration de l'addon
OpenMDL.storage.set<TombolaConfig>('config', {
  ticketPrice: 2.0,
  maxWinners: 3,
  authorizedRoles: ['admin', 'tresorier']
});

// Récupérer la configuration au lancement (avec valeur de repli)
const config = OpenMDL.storage.get<TombolaConfig>('config', {
  ticketPrice: 1.0,
  maxWinners: 1,
  authorizedRoles: ['admin']
});

console.log('Prix du ticket de tombola :', config.ticketPrice);
```
