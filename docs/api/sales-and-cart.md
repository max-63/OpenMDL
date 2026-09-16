# Ventes, Panier & Statistiques

Cette section présente les modules `OpenMDL.cart` et `OpenMDL.sales` permettant de gérer les encaissements en direct, de manipuler le ticket de caisse en cours et d'analyser l'historique financier du foyer.

---

## 1. Panier en Direct (`OpenMDL.cart`)

Le module `OpenMDL.cart` permet d'interagir directement avec le ticket de caisse actif dans la vue d'encaissement.

### Méthodes Disponibles

| Méthode | Paramètres | Type de retour | Description |
| :--- | :--- | :--- | :--- |
| `getItems()` | aucun | `CartItem[]` | Renvoie les articles actuellement saisis dans le panier. |
| `getItem(productId)` | `productId: string` | `CartItem \| undefined` | Récupère la ligne d'un produit spécifique dans le panier. |
| `add(product, qty?)` | `product: Product \| string, qty?: number` | `void` | Ajoute un produit ou son identifiant au panier (défaut: 1). |
| `remove(productId, qty?)` | `productId: string, qty?: number` | `void` | Décrémente la quantité (retire la ligne si <= 0). |
| `setQuantity(productId, qty)` | `productId: string, qty: number` | `void` | Fixe la quantité exacte pour un produit donné. |
| `clear()` | aucun | `void` | Réinitialise et vide entièrement le panier. |
| `getTotal()` | aucun | `number` | Calcule le montant total en euros du panier. |
| `getItemCount()` | aucun | `number` | Calcule le nombre total d'articles dans le panier. |
| `checkout(options)` | `options: { paymentMethod: 'especes' \| 'tpe' }` | `Promise<{ success: boolean; message: string; sale?: Sale }>` | Valide le ticket, décrémente les stocks et enregistre la vente. |

---

### Exemples d'Utilisation du Panier

```typescript
// Ajouter 2 Ice Tea et 1 barre chocolatée
OpenMDL.cart.add('boisson-fuze-tea', 2);
OpenMDL.cart.add('snack-kitkat', 1);

// Obtenir le montant total à régler
const total = OpenMDL.cart.getTotal();
console.log(`Montant du ticket : ${OpenMDL.utils.formatPrice(total)}`);

// Valider l'encaissement en espèces
const resultat = await OpenMDL.cart.checkout({ paymentMethod: 'especes' });
if (resultat.success) {
  OpenMDL.ui.notify('Encaissement validé avec succès !', 'success');
}
```

---

## 2. Historique des Ventes & Statistiques (`OpenMDL.sales`)

Le module `OpenMDL.sales` permet d'interroger la base de données des encaissements passés et de calculer des statistiques analytiques.

### Modèle de Données : `Sale`

```typescript
interface Sale {
  id: string;               // Identifiant unique du ticket de caisse
  sessionId: string;        // Identifiant de la séance de caisse
  volunteerId: string;      // Identifiant du bénévole encaisseur
  volunteerName: string;    // Nom d'affichage du bénévole
  items: SaleItem[];        // Détail des articles vendus
  totalAmount: number;      // Montant total en euros
  paymentMethod: 'especes' | 'tpe'; // Mode de règlement
  cashReceived?: number;    // Montant remis en liquide
  cashReturned?: number;    // Monnaie rendue
  timestamp: string;        // Date et heure ISO
  cancelled?: boolean;      // Indique si la vente a été annulée
}
```

---

### Méthodes Disponibles

| Méthode | Paramètres | Type de retour | Description |
| :--- | :--- | :--- | :--- |
| `list()` | aucun | `Sale[]` | Renvoie toutes les ventes de la base de données. |
| `get(id)` | `id: string` | `Sale \| undefined` | Récupère une vente par son identifiant unique. |
| `getTodaySales()` | aucun | `Sale[]` | Renvoie les ventes effectuées aujourd'hui. |
| `getSessionSales(sessionId)` | `sessionId: string` | `Sale[]` | Renvoie les ventes d'une séance spécifique. |
| `getByDateRange(start, end)` | `start: string, end: string` | `Sale[]` | Filtre les ventes entre deux dates ISO. |
| `cancel(saleId, restoreStock?)`| `saleId: string, restoreStock?: boolean` | `{ success: boolean; message: string }` | Annule une vente et remet en stock si demandé. |
| `getStats(timeframe?)` | `timeframe?: 'day' \| 'week' \| 'month' \| 'all'` | `SaleStats` | Calcule les totaux, panier moyen et top ventes. |
| `exportCsv()` | aucun | `string` | Exporte l'historique complet au format CSV tableur. |

---

### Exemple d'Analyse des Recettes Hebdomadaires

```typescript
const stats = OpenMDL.sales.getStats('week');

console.log('Recettes de la semaine :', OpenMDL.utils.formatPrice(stats.totalRevenue));
console.log('Panier moyen :', OpenMDL.utils.formatPrice(stats.averageBasket));
console.log('Nombre de passages en caisse :', stats.salesCount);

// Afficher les 3 produits les plus vendus
stats.topProducts.slice(0, 3).forEach((top, index) => {
  console.log(`${index + 1}. ${top.name} : ${top.quantity} vendus (${OpenMDL.utils.formatPrice(top.revenue)})`);
});
```
