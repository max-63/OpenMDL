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
  dispatchEvent: () => {},
  addEventListener: () => {}
};

import { db, computeCrc32Hex } from './db.ts';
import { parseDatabaseUrl, buildDatabaseUrl, externalDbService } from './db/externalDbService.ts';
import {
  EURO_DENOMINATIONS,
  decomposeCashAmount,
  decomposeSmartCashChange,
  calculateCashTotal,
  getDefaultPermissionsForRole
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

test('DatabaseService - Préservation des visas locaux lors de importData et purge complète via resetAll', () => {
  const sessionWithVisa = {
    id: 'sess-visa-preserve',
    startTime: '2026-10-01T08:00:00.000Z',
    endTime: '2026-10-01T10:00:00.000Z',
    volunteerId: 'vol-admin',
    volunteerName: 'Administrateur',
    totalSales: 20,
    totalCash: 20,
    totalTpe: 0,
    salesCount: 4,
    status: 'closed' as const,
    cashWithdrawal: {
      items: [],
      totalCounted: 70,
      totalWithdrawn: 20,
      totalRemainingFloat: 50,
      expectedCashSales: 20,
      cashDiscrepancy: 0,
      carriedOverDeficits: {},
      timestamp: '2026-10-01T10:00:00.000Z',
      visaBy: 'CPE Martin',
      visaDate: '2026-10-01T10:30:00.000Z',
      visaNotes: 'Coffre vérifié'
    }
  };

  db.importData({ sessions: [sessionWithVisa] });

  // Import d'un snapshot distant qui ne contient pas encore le visa local
  const remoteWithoutVisa = {
    ...sessionWithVisa,
    cashWithdrawal: {
      ...sessionWithVisa.cashWithdrawal,
      visaBy: undefined,
      visaDate: undefined,
      visaNotes: undefined
    }
  };
  db.importData({ sessions: [remoteWithoutVisa] });

  const merged = db.getSessions().find(s => s.id === 'sess-visa-preserve');
  assert.equal(merged?.cashWithdrawal?.visaBy, 'CPE Martin');
  assert.equal(merged?.cashWithdrawal?.visaNotes, 'Coffre vérifié');

  // resetAll doit aussi vider perks, tpeLogs et scores
  db.recordTpePayment({ amount: 5.5 });
  db.addPacmanScore('Test', 120);
  db.resetAll();
  assert.equal(db.getTpeLogs().length, 0);
  assert.equal(db.getPacmanScores().length, 0);
  assert.equal(db.getSessions().length, 0);
});

// -------------------------------------------------------------
// 7. Tests Base Externe MySQL / MariaDB & Cache SQLite
// -------------------------------------------------------------
test('ExternalDbService - Parsing et construction d\'URL MySQL / MariaDB', () => {
  const mysqlParsed = parseDatabaseUrl('mysql://foyer_user:p%40ss%2F123@db.lycee.local:3307/openmdl_db?ssl=true');
  assert.ok(mysqlParsed);
  assert.equal(mysqlParsed.dialect, 'mysql');
  assert.equal(mysqlParsed.username, 'foyer_user');
  assert.equal(mysqlParsed.password, 'p@ss/123');
  assert.equal(mysqlParsed.host, 'db.lycee.local');
  assert.equal(mysqlParsed.port, 3307);
  assert.equal(mysqlParsed.database, 'openmdl_db');
  assert.equal(mysqlParsed.ssl, true);

  const mariaParsed = parseDatabaseUrl('mariadb://admin@192.168.1.50/foyer?ssl=true&danger_accept_invalid_certs=true');
  assert.ok(mariaParsed);
  assert.equal(mariaParsed.dialect, 'mariadb');
  assert.equal(mariaParsed.port, 3306);
  assert.equal(mariaParsed.database, 'foyer');
  assert.equal(mariaParsed.ssl, true);
  assert.equal(mariaParsed.acceptInvalidCerts, true);

  assert.equal(parseDatabaseUrl('http://invalid'), null);

  const rebuilt = buildDatabaseUrl({
    host: 'db.lycee.local',
    port: 3307,
    database: 'openmdl_db',
    username: 'foyer_user',
    password: 'p@ss/123',
    dialect: 'mariadb',
    ssl: true,
    acceptInvalidCerts: true
  });
  assert.equal(
    rebuilt,
    'mariadb://foyer_user:p%40ss%2F123@db.lycee.local:3307/openmdl_db?ssl=true&danger_accept_invalid_certs=true'
  );
});

test('DatabaseService - Bascule SQLite <-> MySQL, filtre sessions fermées, anti-wipe et zéro re-render inutile', () => {
  const resMysql = db.updateDatabaseConfig({
    engine: 'mysql',
    external: {
      url: 'mysql://u:p@127.0.0.1:3306/openmdl',
      host: '127.0.0.1',
      port: 3306,
      database: 'openmdl',
      username: 'u',
      password: 'p',
      dialect: 'mysql',
      ssl: false,
      acceptInvalidCerts: false,
      syncIntervalSec: 15
    }
  });
  assert.equal(resMysql.success, true);
  assert.equal(db.getDatabaseConfig().engine, 'mysql');
  assert.equal(db.getDatabaseConfig().external?.database, 'openmdl');

  // Garde anti-wipe : un snapshot distant vide ne doit pas effacer le cache local
  const emptyRes = db.applyExternalSnapshot({
    products: [],
    sales: [],
    sessions: [],
    volunteers: []
  });
  assert.equal(emptyRes.applied, false);
  assert.equal(emptyRes.emptyRemote, true);

  const snapshotPayload = {
    products: [
      {
        id: 'prod-mysql-1',
        name: 'Oasis Tropical',
        category: 'boissons',
        price: 1.0,
        costPrice: 0.45,
        stock: 24,
        minStockAlert: 5,
        imageUrl: '',
        isActive: true
      }
    ],
    sales: [],
    sessions: [
      {
        id: 'sess-other-active',
        startTime: '2026-11-19T10:00:00.000Z',
        volunteerId: 'vol-2',
        volunteerName: 'Autre Caisse',
        totalSales: 10,
        totalCash: 10,
        totalTpe: 0,
        salesCount: 2,
        status: 'active'
      },
      {
        id: 'sess-closed-1',
        startTime: '2026-11-18T10:00:00.000Z',
        endTime: '2026-11-18T12:00:00.000Z',
        volunteerId: 'vol-admin',
        volunteerName: 'Administrateur',
        totalSales: 50,
        totalCash: 30,
        totalTpe: 20,
        salesCount: 15,
        status: 'closed'
      }
    ],
    volunteers: [
      {
        id: 'vol-admin',
        username: 'admin',
        password: 'admin',
        name: 'Administrateur',
        role: 'Administrateur',
        avatarColor: '#ea580c',
        isAdmin: true
      }
    ]
  };

  // Snapshot peuplé : applique les données atomiquement dans le cache local et exclut les séances actives des autres postes
  const populatedRes = db.applyExternalSnapshot(snapshotPayload);
  assert.equal(populatedRes.emptyRemote, false);
  assert.equal(populatedRes.applied, true);
  assert.equal(db.getProductById('prod-mysql-1')?.stock, 24);
  assert.equal(db.getSessions().some(s => s.id === 'sess-other-active'), false);
  assert.equal(db.getSessions().some(s => s.id === 'sess-closed-1'), true);

  // Appel répété avec les mêmes données : ne doit déclencher aucun notify()
  let notifyCount = 0;
  const unsubscribe = db.subscribe(() => {
    notifyCount++;
  });
  const repeatRes = db.applyExternalSnapshot(snapshotPayload);
  unsubscribe();
  assert.equal(repeatRes.applied, false);
  assert.equal(notifyCount, 0);

  // Retour propre sur SQLite pour ne laisser aucun timer actif
  db.updateDatabaseConfig({ engine: 'sqlite' });
  externalDbService.stopAutoSync();
  assert.equal(db.getDatabaseConfig().engine, 'sqlite');
});

// -------------------------------------------------------------
// 7. Tests Permissions Granulaires & Politiques Conso par Utilisateur
// -------------------------------------------------------------
test('Permissions - Presets par rôle, blocage côté service et modification dynamique', () => {
  // Presets de base par rôle
  const benevolePerms = getDefaultPermissionsForRole('Bénévole Permanence', false);
  assert.equal(benevolePerms.canSell, true);
  assert.equal(benevolePerms.canViewCatalog, true);
  assert.equal(benevolePerms.canViewStats, false);
  assert.equal(benevolePerms.canViewTpe, false);
  assert.equal(benevolePerms.canViewDecaisse, false);
  assert.equal(benevolePerms.canVisaDecaisse, false);
  assert.equal(benevolePerms.canEditCatalog, false);
  assert.equal(benevolePerms.canRestock, false);
  assert.equal(benevolePerms.canManageUsers, false);
  assert.equal(benevolePerms.canAccessSystem, false);

  const surveillantPerms = getDefaultPermissionsForRole('Surveillant / Vie Scolaire', false);
  assert.equal(surveillantPerms.canViewDecaisse, true);
  assert.equal(surveillantPerms.canVisaDecaisse, true);
  assert.equal(surveillantPerms.canViewStats, true);
  assert.equal(surveillantPerms.canViewTpe, false);
  assert.equal(surveillantPerms.canManageUsers, false);
  assert.equal(surveillantPerms.canAccessSystem, false);

  const adminPerms = getDefaultPermissionsForRole('Administrateur', true);
  assert.ok(Object.values(adminPerms).every(Boolean));

  // Préparation compte admin connecté + création d'un bénévole & d'une séance avec retrait à viser
  db.login('vol-admin');
  const createBenev = db.createUser({
    name: 'Camille Bénévole',
    username: 'camille_' + Date.now(),
    password: '123',
    role: 'Bénévole Permanence',
    isAdmin: false
  });
  assert.equal(createBenev.success, true);
  const benev = createBenev.volunteer!;
  assert.equal(db.hasPermission('canViewStats', benev), false);
  assert.equal(db.hasPermission('canVisaDecaisse', benev), false);

  const prodBefore = { ...db.getProducts()[0] };
  const sessVisaId = 'sess-visa-perm-' + Date.now();
  db.importData({
    sessions: [
      {
        id: sessVisaId,
        startTime: '2026-11-15T09:00:00.000Z',
        endTime: '2026-11-15T11:00:00.000Z',
        volunteerId: 'vol-admin',
        volunteerName: 'Administrateur',
        totalSales: 12,
        totalCash: 12,
        totalTpe: 0,
        salesCount: 3,
        status: 'closed',
        cashWithdrawal: {
          items: [],
          totalCounted: 62,
          totalWithdrawn: 12,
          totalRemainingFloat: 50,
          expectedCashSales: 12,
          cashDiscrepancy: 0,
          carriedOverDeficits: {},
          timestamp: '2026-11-15T11:00:00.000Z'
        }
      }
    ]
  });

  // Connexion en tant que bénévole : opérations sensibles bloquées
  assert.equal(db.login(benev.id), true);
  assert.equal(db.visaCashWithdrawal(sessVisaId, benev.name, 'Test interdit'), false);
  db.updateProduct({ ...prodBefore, price: prodBefore.price + 5 });
  assert.equal(db.getProductById(prodBefore.id)?.price, prodBefore.price);
  db.applyRestock(prodBefore.id, 50);
  assert.equal(db.getProductById(prodBefore.id)?.stock, prodBefore.stock);
  db.connectTpe({ merchantName: 'Hack TPE' });
  assert.notEqual(db.getTpeSettings().merchantName, 'Hack TPE');

  // Reconnexion Admin : attribution explicite des flags Visa + Restock à Camille
  assert.equal(db.login('vol-admin'), true);
  const updRes = db.updateUserPermissionsAndPerk(benev.id, {
    role: 'Surveillant / Vie Scolaire',
    isAdmin: false,
    permissions: {
      ...benevolePerms,
      canViewDecaisse: true,
      canVisaDecaisse: true,
      canRestock: true
    }
  });
  assert.equal(updRes.success, true);

  // Reconnexion Camille : Visa & Restock désormais autorisés, TPE toujours bloqué
  assert.equal(db.login(benev.id), true);
  assert.equal(db.hasPermission('canViewDecaisse'), true);
  assert.equal(db.hasPermission('canVisaDecaisse'), true);
  assert.equal(db.hasPermission('canViewTpe'), false);
  assert.equal(db.visaCashWithdrawal(sessVisaId, benev.name, 'Validé'), true);
  db.applyRestock(prodBefore.id, 10);
  assert.equal(db.getProductById(prodBefore.id)?.stock, prodBefore.stock + 10);

  // Restauration propre en admin
  db.login('vol-admin');
});

test('Conso Gratuite - Politiques par utilisateur (aucune, 1/séance, 2 une fois sur 2, 4/séance)', () => {
  db.login('vol-admin');
  db.updatePerkSettings({
    enabled: true,
    rule: 'always',
    threshold: 1,
    allowMultiplePerDay: false
  });

  const targetProd = db.addProduct({
    name: 'Boisson Conso Test',
    category: 'boissons',
    price: 1.0,
    costPrice: 0.4,
    stock: 30,
    minStockAlert: 5,
    imageUrl: '',
    isActive: true
  });

  // 1. Politique "aucune" (0 conso même quand la règle globale est "always")
  const noConsoUser = db.createUser({
    name: 'Sans Conso',
    username: 'sansconso_' + Date.now(),
    password: '123',
    role: 'Bénévole Permanence',
    perkPolicy: { mode: 'none', quantity: 1, everyNSessions: 1 }
  }).volunteer!;

  const noConsoCheck = db.canClaimVolunteerPerk(noConsoUser.id, 'sess-none-1');
  assert.equal(noConsoCheck.allowed, false);
  assert.equal(noConsoCheck.policyMode, 'none');
  assert.equal(noConsoCheck.maxPerSession, 0);

  // 2. Politique "1 conso par séance"
  const onePerSessUser = db.createUser({
    name: 'Un Par Seance',
    username: 'unconso_' + Date.now(),
    password: '123',
    role: 'Bénévole Permanence',
    perkPolicy: { mode: 'custom', quantity: 1, everyNSessions: 1, ignoreThreshold: true }
  }).volunteer!;

  assert.equal(db.canClaimVolunteerPerk(onePerSessUser.id, 'sess-1-a').allowed, true);
  assert.equal(db.claimVolunteerPerk(onePerSessUser.id, targetProd.id, 'sess-1-a').success, true);
  const afterFirst = db.canClaimVolunteerPerk(onePerSessUser.id, 'sess-1-a');
  assert.equal(afterFirst.allowed, false);
  assert.equal(afterFirst.remainingInSession, 0);

  // 3. Politique "2 consos une fois sur 2" (séance 1 ok x2, séance 2 bloquée, séance 3 ok x2)
  const twoEveryTwoUser = db.createUser({
    name: 'Deux Sur Deux',
    username: 'deuxsurdeux_' + Date.now(),
    password: '123',
    role: 'Bénévole Permanence',
    perkPolicy: { mode: 'custom', quantity: 2, everyNSessions: 2, ignoreThreshold: true }
  }).volunteer!;

  // Séance 1 (pas d'historique avant) -> 2 consos autorisées
  const sess22_1 = {
    id: 'sess-22-1',
    startTime: '2026-11-16T09:00:00.000Z',
    endTime: '2026-11-16T10:00:00.000Z',
    volunteerId: twoEveryTwoUser.id,
    volunteerName: twoEveryTwoUser.name,
    totalSales: 0,
    totalCash: 0,
    totalTpe: 0,
    salesCount: 0,
    status: 'closed' as const
  };
  db.importData({
    sessions: [...db.getSessions(), sess22_1]
  });
  let check22 = db.canClaimVolunteerPerk(twoEveryTwoUser.id, 'sess-22-1');
  assert.equal(check22.allowed, true);
  assert.equal(check22.maxPerSession, 2);
  assert.equal(check22.remainingInSession, 2);

  assert.equal(db.claimVolunteerPerk(twoEveryTwoUser.id, targetProd.id, 'sess-22-1').success, true);
  check22 = db.canClaimVolunteerPerk(twoEveryTwoUser.id, 'sess-22-1');
  assert.equal(check22.allowed, true);
  assert.equal(check22.remainingInSession, 1);

  assert.equal(db.claimVolunteerPerk(twoEveryTwoUser.id, targetProd.id, 'sess-22-1').success, true);
  check22 = db.canClaimVolunteerPerk(twoEveryTwoUser.id, 'sess-22-1');
  assert.equal(check22.allowed, false);
  assert.equal(check22.remainingInSession, 0);

  // Séance 2 -> bloquée (conso prise à la séance 1, 1 séance à attendre)
  const sess22_2 = {
    id: 'sess-22-2',
    startTime: '2026-11-17T09:00:00.000Z',
    endTime: '2026-11-17T10:00:00.000Z',
    volunteerId: twoEveryTwoUser.id,
    volunteerName: twoEveryTwoUser.name,
    totalSales: 0,
    totalCash: 0,
    totalTpe: 0,
    salesCount: 0,
    status: 'closed' as const
  };
  db.importData({
    sessions: [...db.getSessions(), sess22_2]
  });
  const check22Sess2 = db.canClaimVolunteerPerk(twoEveryTwoUser.id, 'sess-22-2');
  assert.equal(check22Sess2.allowed, false);
  assert.equal(check22Sess2.sessionsUntilEligible, 1);

  // Séance 3 -> ré-autorisée (aucune conso prise en séance 2)
  const sess22_3 = {
    id: 'sess-22-3',
    startTime: '2026-11-18T09:00:00.000Z',
    volunteerId: twoEveryTwoUser.id,
    volunteerName: twoEveryTwoUser.name,
    totalSales: 0,
    totalCash: 0,
    totalTpe: 0,
    salesCount: 0,
    status: 'active' as const
  };
  db.importData({
    sessions: [...db.getSessions(), sess22_3]
  });
  const check22Sess3 = db.canClaimVolunteerPerk(twoEveryTwoUser.id, 'sess-22-3');
  assert.equal(check22Sess3.allowed, true);
  assert.equal(check22Sess3.remainingInSession, 2);

  // 4. Politique "4 consos par séance" -> 4 autorisées, 5e bloquée
  const fourUser = db.createUser({
    name: 'Quatre Consos',
    username: 'quatre_' + Date.now(),
    password: '123',
    role: 'Bureau MDL',
    perkPolicy: { mode: 'custom', quantity: 4, everyNSessions: 1, ignoreThreshold: true }
  }).volunteer!;

  for (let i = 0; i < 4; i++) {
    const c = db.canClaimVolunteerPerk(fourUser.id, 'sess-4-1');
    assert.equal(c.allowed, true);
    assert.equal(c.remainingInSession, 4 - i);
    assert.equal(db.claimVolunteerPerk(fourUser.id, targetProd.id, 'sess-4-1').success, true);
  }
  const afterFour = db.canClaimVolunteerPerk(fourUser.id, 'sess-4-1');
  assert.equal(afterFour.allowed, false);
  assert.equal(afterFour.claimedInSession, 4);
  assert.equal(afterFour.remainingInSession, 0);
});
