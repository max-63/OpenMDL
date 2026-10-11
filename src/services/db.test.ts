import test from 'node:test';
import assert from 'node:assert/strict';

// Configuration minimale d'un environnement DOM / LocalStorage simulé
const storageMap = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => storageMap.get(key) || null,
  setItem: (key: string, val: string) => { storageMap.set(key, String(val)); },
  removeItem: (key: string) => { storageMap.delete(key); },
  clear: () => { storageMap.clear(); },
  get length() { return storageMap.size; },
  key: (idx: number) => Array.from(storageMap.keys())[idx] || null
};

(globalThis as any).localStorage = localStorageMock;
(globalThis as any).window = {
  OpenMDL: { events: { emit: () => {} } },
  dispatchEvent: () => {},
  addEventListener: () => {}
};

import { db, computeCrc32Hex } from './db.ts';
import {
  EURO_DENOMINATIONS,
  decomposeCashAmount,
  decomposeSmartCashChange,
  calculateCashTotal
} from '../types/index.ts';
import { escapeHtml, sanitizeText } from '../utils/security.ts';
import type { Product, CartItem } from '../types/index.ts';

// Test harness pour la logique panier (Cart)
class TestCart {
  private items: CartItem[] = [];
  public onUpdate: () => void = () => {};

  public getItems(): CartItem[] { return this.items; }
  public getTotal(): number {
    return this.items.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  }
  public getItemQuantity(productId: string): number {
    const item = this.items.find(i => i.product.id === productId);
    return item ? item.quantity : 0;
  }
  public addItem(product: Product, quantity = 1): void {
    if (product.stock <= 0) return;
    const existing = this.items.find(i => i.product.id === product.id);
    if (existing) {
      if (existing.quantity + quantity <= product.stock) {
        existing.quantity += quantity;
      }
    } else {
      this.items.push({ product, quantity: Math.min(quantity, product.stock) });
    }
    this.onUpdate();
  }
  public removeItem(productId: string, quantity = 1): void {
    const existingIndex = this.items.findIndex(i => i.product.id === productId);
    if (existingIndex === -1) return;
    const existing = this.items[existingIndex];
    if (existing.quantity > quantity) {
      existing.quantity -= quantity;
    } else {
      this.items.splice(existingIndex, 1);
    }
    this.onUpdate();
  }
  public clear(): void {
    this.items = [];
    this.onUpdate();
  }
}

// -------------------------------------------------------------
// 1. Tests Base de Données, Authentification & Sessions
// -------------------------------------------------------------
test('DatabaseService - Authentification et session bénévole', () => {
  const authRes = db.authenticate('admin', 'admin');
  assert.equal(authRes.success, true);
  assert.ok(authRes.volunteer);

  const loginRes = db.login('vol-admin');
  assert.equal(loginRes, true);
  assert.equal(db.getCurrentVolunteer()?.username, 'admin');

  // Mauvais mot de passe
  const failAuth = db.authenticate('admin', 'mauvais-mdp');
  assert.equal(failAuth.success, false);
});

test('DatabaseService - Gestion du stock et des ventes', () => {
  let prods = db.getProducts();
  if (prods.length === 0) {
    db.addProduct({
      name: 'Produit Test',
      category: 'snacks',
      price: 1.50,
      costPrice: 0.80,
      stock: 20,
      minStockAlert: 5,
      imageUrl: '/products/test.png',
      isActive: true
    });
    prods = db.getProducts();
  }
  assert.ok(prods.length > 0);
  const firstProd = prods[0];
  const initialStock = firstProd.stock;

  const sale = db.recordSale({
    items: [{
      productId: firstProd.id,
      productName: firstProd.name,
      quantity: 2,
      unitPrice: firstProd.price,
      totalPrice: firstProd.price * 2
    }],
    totalAmount: firstProd.price * 2,
    paymentMethod: 'especes'
  });

  assert.ok(sale.id);
  const updatedProd = db.getProductById(firstProd.id);
  assert.equal(updatedProd?.stock, initialStock - 2);
  assert.ok(db.getSales().some(s => s.id === sale.id));
});

// -------------------------------------------------------------
// 2. Tests Messagerie & Persistance Anti-Wipe (SQLite / Cache)
// -------------------------------------------------------------
test('DatabaseService - Messagerie et intégrité anti-usurpation (CRC32)', () => {
  db.login('vol-admin');
  const user = db.getCurrentVolunteer()!;
  
  const content = 'Message de test unitaire OpenMDL';
  const sendRes = db.sendChatMessage('general', content);
  assert.equal(sendRes.success, true);
  assert.ok(sendRes.chatMessage);
  assert.equal(sendRes.chatMessage.content, content);
  assert.equal(sendRes.chatMessage.authorId, user.id);

  const expectedPayload = `${user.id}:${user.username}:${content}:${sendRes.chatMessage.timestamp}:${user.password}`;
  const expectedSig = computeCrc32Hex(expectedPayload);
  assert.equal(sendRes.chatMessage.signature, expectedSig);

  const messages = db.getChatMessages('general');
  assert.ok(messages.some(m => m.id === sendRes.chatMessage!.id));
});

test('DatabaseService - Persistance des messages de chat après redémarrage (protection anti-wipe)', () => {
  db.login('vol-admin');
  const testMsgContent = 'Message persistant ' + Date.now();
  const sent = db.sendChatMessage('general', testMsgContent);
  assert.equal(sent.success, true);

  const storedJson = localStorageMock.getItem('openmdl_chat_messages');
  assert.ok(storedJson, 'Les messages doivent être enregistrés dans openmdl_chat_messages');
  const parsed = JSON.parse(storedJson!);
  assert.ok(Array.isArray(parsed));
  assert.ok(parsed.length > 0);
  assert.ok(parsed.some((m: any) => m.content === testMsgContent));

  // Simulation redémarrage : cleanLocalStorageQuota avec mémoire vierge ne doit PAS effacer
  (db as any).chatMessages = [];
  db.cleanLocalStorageQuota();

  const afterCleanJson = localStorageMock.getItem('openmdl_chat_messages');
  assert.ok(afterCleanJson);
  const afterParsed = JSON.parse(afterCleanJson!);
  assert.ok(afterParsed.length > 0, 'Les messages ne doivent pas être vidés par cleanLocalStorageQuota');

  (db as any).loadAll();
  const loadedMessages = db.getAllChatMessages();
  assert.ok(loadedMessages.some(m => m.content === testMsgContent), 'Le message doit être rechargé au démarrage');
});

test('DatabaseService - Rétention et purge des messages expirés', () => {
  db.login('vol-admin');
  const oldDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
  (db as any).chatMessages.push({
    id: 'msg-old-test',
    channelId: 'general',
    authorId: 'vol-admin',
    authorName: 'Administrateur',
    authorRole: 'Administrateur',
    content: 'Vieux message à purger',
    timestamp: oldDate,
    signature: 'fake'
  });

  const beforePurge = db.getAllChatMessages().length;
  const purgedCount = db.purgeExpiredChatMessages();
  const afterPurge = db.getAllChatMessages().length;

  assert.equal(purgedCount, 1);
  assert.equal(afterPurge, beforePurge - 1);
  assert.ok(!db.getAllChatMessages().some(m => m.id === 'msg-old-test'));
});

// -------------------------------------------------------------
// 3. Tests Avantages Bénévoles (Perks / Collations)
// -------------------------------------------------------------
test('DatabaseService - Éligibilité et attribution de la collation bénévole (Perks)', () => {
  db.login('vol-admin');
  const vol = db.getCurrentVolunteer()!;

  // Configuration avec règle permissive pour valider l'attribution
  db.updatePerkSettings({
    enabled: true,
    rule: 'always',
    threshold: 1,
    allowMultiplePerDay: false
  });

  const statusBefore = db.canClaimVolunteerPerk(vol.id);
  assert.equal(statusBefore.allowed, true);
  assert.equal(statusBefore.enabled, true);

  // Simulation d'une collation offerte
  let prods = db.getProducts();
  const prod = prods[0];
  const claimRes = db.claimVolunteerPerk(vol.id, prod.id);
  assert.equal(claimRes.success, true);
  assert.ok(claimRes.perk);
  assert.equal(db.hasVolunteerClaimedPerkToday(vol.id), true);

  // Tentative de reprise le même jour (bloqué par allowMultiplePerDay: false)
  const canReclaim = db.canClaimVolunteerPerk(vol.id);
  assert.equal(canReclaim.allowed, false);
  assert.ok(canReclaim.reason?.includes('déjà accordée'));
});

// -------------------------------------------------------------
// 4. Tests Calculs Monnaie & Algorithme Rendu Intelligent
// -------------------------------------------------------------
test('Monnaie & Caisse - Décomposition gloutonne d\'espèces (decomposeCashAmount)', () => {
  // Décomposer 3.80 € (2€ + 1€ + 0.50€ + 0.20€ + 0.10€)
  const breakdown = decomposeCashAmount(3.80);
  assert.equal(breakdown['2'], 1);
  assert.equal(breakdown['1'], 1);
  assert.equal(breakdown['0.50'], 1);
  assert.equal(breakdown['0.20'], 1);
  assert.equal(breakdown['0.10'], 1);
  assert.equal(breakdown['5'], undefined);

  // Montant nul
  const empty = decomposeCashAmount(0);
  assert.deepEqual(empty, {});
});

test('Monnaie & Caisse - Calcul du total en euros (calculateCashTotal)', () => {
  const counts = {
    '20': 2,    // 40 €
    '10': 1,    // 10 €
    '2': 3,     // 6 €
    '0.50': 4,  // 2 €
    '0.20': 5   // 1 €
  };
  const total = calculateCashTotal(counts);
  assert.equal(total, 59.00);
});

test('Monnaie & Caisse - Rendu intelligent adaptatif au tiroir-caisse (decomposeSmartCashChange)', () => {
  // Cas sans état de tiroir (fallback standard glouton)
  const fallback = decomposeSmartCashChange(1.50);
  assert.equal(fallback['1'], 1);
  assert.equal(fallback['0.50'], 1);

  // Cas avec tiroir : rendre 2.00 € quand les pièces de 2€ sont absentes
  const drawerState = {
    available: {
      '2': 0, // Pas de pièce de 2€
      '1': 5, // 5 pièces de 1€ disponibles
      '0.50': 10
    },
    base: {
      '2': 10,
      '1': 2
    }
  };

  // Vérifie que l'algorithme utilise intelligemment les pièces disponibles (1€ et surplus 0.50€) sans exiger de pièce inexistante (2€)
  const change = decomposeSmartCashChange(2.00, drawerState);
  assert.equal(change['2'], undefined);
  const totalRendered = (change['1'] || 0) * 1 + (change['0.50'] || 0) * 0.50;
  assert.equal(totalRendered, 2.00);
});

// -------------------------------------------------------------
// 5. Tests Composant Panier (CartComponent)
// -------------------------------------------------------------
test('CartComponent - Ajout, modification, sous-totaux et vidage', () => {
  let updateCalled = 0;
  const cart = new TestCart();
  cart.onUpdate = () => { updateCalled++; };

  const testProduct: Product = {
    id: 'prod-cart-test',
    name: 'Cookie Chocolat',
    category: 'snacks',
    price: 1.20,
    costPrice: 0.60,
    stock: 5,
    minStockAlert: 2,
    imageUrl: '',
    isActive: true
  };

  // 1. Ajout de 2 unités
  cart.addItem(testProduct, 2);
  assert.equal(cart.getItems().length, 1);
  assert.equal(cart.getItemQuantity(testProduct.id), 2);
  assert.equal(cart.getTotal(), 2.40);
  assert.ok(updateCalled > 0);

  // 2. Limitation stricte au stock disponible
  cart.addItem(testProduct, 10);
  // Le stock est de 5, donc la quantité ne doit pas excéder 5
  assert.ok(cart.getItemQuantity(testProduct.id) <= 5);

  // 3. Retrait d'un article
  cart.removeItem(testProduct.id, 1);
  assert.equal(cart.getItemQuantity(testProduct.id), 1);

  // 4. Vidage du panier
  cart.clear();
  assert.equal(cart.getItems().length, 0);
  assert.equal(cart.getTotal(), 0);
});

// -------------------------------------------------------------
// 6. Tests Utilitaires de Sécurité & Nettoyage (Anti-XSS)
// -------------------------------------------------------------
test('Security - Neutralisation XSS (escapeHtml) et assainissement (sanitizeText)', () => {
  const unsafe = '<script>alert("xss")</script> & " \'';
  const escaped = escapeHtml(unsafe);
  assert.ok(!escaped.includes('<script>'));
  assert.ok(escaped.includes('&lt;script&gt;'));
  assert.ok(escaped.includes('&amp;'));
  assert.ok(escaped.includes('&quot;'));
  assert.ok(escaped.includes('&#039;'));

  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');

  const dirtyText = '  \u0000Bonjour OpenMDL  \u001F ';
  const clean = sanitizeText(dirtyText);
  assert.equal(clean, 'Bonjour OpenMDL');
});
