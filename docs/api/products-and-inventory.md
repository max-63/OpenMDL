# Produits & Gestion des Stocks

Le module `OpenMDL.products` permet de manipuler le catalogue des articles vendus au foyer (boissons, friandises, fournitures, goodies MDL), de gérer les niveaux de stock et de déclencher des réapprovisionnements.

---

## Modèle de Données : `Product`

```typescript
interface Product {
  id: string;             // Identifiant unique (ex: "boisson-coca-33cl")
  name: string;           // Intitulé du produit
  category: string;       // Catégorie : "boissons", "snacks", "fournitures", "goodies", etc.
  price: number;          // Prix de vente public en euros (ex: 1.00)
  costPrice: number;      // Prix d'achat unitaire pour la MDL (ex: 0.52)
  stock: number;          // Quantité physique disponible
  minStockAlert: number;  // Seuil de stock déclenchant une alerte
  imageUrl?: string;      // Chemin relatif vers l'image produit
  color?: string;         // Code couleur Tailwind ou hexadécimal
  barcode?: string;       // Code-barres EAN (optionnel)
  isActive: boolean;      // Indique si le produit est disponible à la vente
  isFavorite?: boolean;   // Indique si le produit apparaît dans les raccourcis
}
```

---

## Méthodes Disponibles

| Méthode | Paramètres | Type de retour | Description |
| :--- | :--- | :--- | :--- |
| `list()` | aucun | `Product[]` | Renvoie tous les produits enregistrés en base. |
| `get(id)` | `id: string` | `Product \| undefined` | Récupère un produit par son identifiant unique. |
| `getByCategory(category)` | `category: string` | `Product[]` | Filtre les produits appartenant à une catégorie donnée. |
| `search(query)` | `query: string` | `Product[]` | Recherche dans les noms, catégories et codes-barres. |
| `create(product)` | `product: Omit<Product, 'id'>` | `{ success: boolean; message: string; product?: Product }` | Ajoute un nouvel article au catalogue. |
| `update(id, updates)` | `id: string, updates: Partial<Product>` | `{ success: boolean; message: string }` | Modifie les attributs d'un produit existant. |
| `delete(id)` | `id: string` | `{ success: boolean; message: string }` | Supprime définitivement un produit du catalogue. |
| `restock(id, quantity, reason?)` | `id: string, quantity: number, reason?: string` | `{ success: boolean; message: string }` | Ajoute du stock avec enregistrement dans l'historique. |
| `setStock(id, newStock)` | `id: string, newStock: number` | `{ success: boolean; message: string }` | Règle directement la quantité physique en stock. |
| `getCategories()` | aucun | `string[]` | Renvoie la liste distincte de toutes les catégories. |
| `getFavorites()` | aucun | `Product[]` | Renvoie les produits marqués en accès rapide. |
| `toggleFavorite(id)` | `id: string` | `boolean` | Alterne l'état favori d'un article. |

---

## Exemples d'Utilisation

### Consulter les Produits en Rupture de Stock

```typescript
// Récupérer les articles dont le stock est inférieur ou égal au seuil critique
const alertes = OpenMDL.products
  .list()
  .filter(p => p.isActive && p.stock <= p.minStockAlert);

alertes.forEach(produit => {
  console.log(`Alerte stock pour ${produit.name} : ${produit.stock} unité(s) restante(s)`);
});
```

---

### Réapprovisionner un Article

```typescript
// Ajouter 24 canettes lors d'une livraison fournisseur
const resultat = OpenMDL.products.restock('prod-fuze-tea', 24, 'Livraison grossiste Metro');

if (resultat.success) {
  OpenMDL.ui.notify('Stock mis à jour avec succès.', 'success');
} else {
  OpenMDL.ui.notify(resultat.message, 'error');
}
```

---

### Créer un Article Spécial (Événement MDL)

```typescript
const creation = OpenMDL.products.create({
  name: 'Place Soirée des Talents',
  category: 'evenements',
  price: 3.00,
  costPrice: 0.00,
  stock: 150,
  minStockAlert: 10,
  isActive: true
});

if (creation.success && creation.product) {
  OpenMDL.ui.notify(`Billeterie créée : ${creation.product.name}`, 'success');
}
```
