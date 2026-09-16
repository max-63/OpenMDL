import { AddonPackage, IOpenMdlApi, RegisteredTab, RegisteredWidget, OpenMdlEventType, OpenMdlEventListener } from '../types/addon';
import { Product, Sale } from '../types';
import { db } from './db';
import { SAMPLE_ADDON_CALCULATOR, SAMPLE_ADDON_TOMBOLA } from './addonTemplates';
import { Marked } from 'marked';
import { transform } from 'sucrase';
import Prism from 'prismjs';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-markdown';

const ADDONS_STORAGE_KEY = 'openmdl_addons';

const customMarked = new Marked();
customMarked.use({
  renderer: {
    code({ text, lang }: { text: string; lang?: string }) {
      const cleanLang = (lang || 'typescript').toLowerCase().trim();
      const prismLang = Prism.languages[cleanLang] ? cleanLang : (Prism.languages.typescript ? 'typescript' : 'javascript');
      const highlighted = Prism.highlight(text, Prism.languages[prismLang] || Prism.languages.javascript, prismLang);

      return `
        <div class="code-block-wrapper my-4 rounded-2xl overflow-hidden border border-slate-700/80 bg-[#282c34] shadow-md">
          <div class="flex items-center justify-between px-4 py-2 bg-[#21252b] border-b border-slate-800 text-[11px] font-mono">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-[#ff5f56]"></span>
              <span class="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]"></span>
              <span class="w-2.5 h-2.5 rounded-full bg-[#27c93f]"></span>
              <span class="text-slate-400 font-bold uppercase ml-2 tracking-wider">${cleanLang}</span>
            </div>
            <button class="btn-copy-code text-slate-400 hover:text-white px-2 py-0.5 rounded transition-colors cursor-pointer text-[10px] font-sans" data-code="${encodeURIComponent(text)}">
              Copier
            </button>
          </div>
          <pre class="p-4 text-xs font-mono overflow-x-auto text-[#abb2bf] leading-relaxed bg-[#282c34]"><code class="language-${prismLang}">${highlighted}</code></pre>
        </div>
      `;
    },
    heading({ text, depth }: { text: string; depth: number }) {
      if (depth === 1) {
        return `<h1 class="text-xl font-black text-slate-900 dark:text-white mt-6 mb-3 pb-2 border-b border-slate-200 dark:border-slate-800 tracking-tight">${text}</h1>`;
      } else if (depth === 2) {
        return `<h2 class="text-base font-extrabold text-orange-600 dark:text-orange-400 mt-6 mb-2.5 flex items-center gap-2 tracking-tight">${text}</h2>`;
      } else if (depth === 3) {
        return `<h3 class="text-sm font-bold text-sky-600 dark:text-sky-400 mt-4 mb-2 tracking-tight">${text}</h3>`;
      }
      return `<h4 class="text-xs font-bold text-slate-800 dark:text-slate-200 mt-3 mb-1.5">${text}</h4>`;
    },
    blockquote({ text }: { text: string }) {
      return `<blockquote class="border-l-4 border-orange-500 bg-orange-500/10 dark:bg-orange-500/5 px-4 py-2.5 my-3 rounded-r-2xl text-xs text-slate-700 dark:text-slate-300">${text}</blockquote>`;
    }
  }
});

// Synthétiseur audio WebAudio 100% hors-ligne
class WebAudioSynthesizer {
  private ctx: AudioContext | null = null;
  private muted = false;

  private getContext(): AudioContext | null {
    if (this.muted) return null;
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
  }

  public beep(freq = 440, durationMs = 100, type: OscillatorType = 'sine'): void {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationMs / 1000);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + durationMs / 1000);
    } catch (e) {
      console.warn('Audio error:', e);
    }
  }

  public play(sound: 'beep' | 'success' | 'warning' | 'error' | 'cash'): void {
    if (this.muted) return;
    switch (sound) {
      case 'beep':
        this.beep(800, 60, 'sine');
        break;
      case 'success':
        this.beep(523.25, 120, 'triangle');
        setTimeout(() => this.beep(659.25, 120, 'triangle'), 60);
        setTimeout(() => this.beep(783.99, 200, 'triangle'), 120);
        break;
      case 'cash':
        this.beep(987.77, 80, 'triangle');
        setTimeout(() => this.beep(1318.51, 240, 'triangle'), 80);
        break;
      case 'warning':
        this.beep(440, 140, 'sawtooth');
        setTimeout(() => this.beep(370, 140, 'sawtooth'), 110);
        break;
      case 'error':
        this.beep(220, 180, 'sawtooth');
        setTimeout(() => this.beep(174.61, 220, 'sawtooth'), 140);
        break;
    }
  }
}

export class AddonManager {
  private static instance: AddonManager;
  private packages: AddonPackage[] = [];
  private registeredTabs: Map<string, RegisteredTab> = new Map();
  private registeredWidgets: Map<string, RegisteredWidget> = new Map();
  private eventListeners: Map<OpenMdlEventType, Set<OpenMdlEventListener>> = new Map();
  private activeAddonCleanups: Map<string, Array<() => void>> = new Map();
  private listeners: Set<() => void> = new Set();
  private currentExecutingAddonId: string | null = null;
  private onNavigateCallback?: (tabId: string) => void;
  private audioSynth = new WebAudioSynthesizer();
  private activeModalElement: HTMLElement | null = null;

  private constructor() {
    this.loadPackages();
    this.setupGlobalApi();
  }

  public static getInstance(): AddonManager {
    if (!AddonManager.instance) {
      AddonManager.instance = new AddonManager();
    }
    return AddonManager.instance;
  }

  public setNavigationCallback(callback: (tabId: string) => void): void {
    this.onNavigateCallback = callback;
  }

  public subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify(): void {
    this.listeners.forEach(fn => fn());
  }

  public getPackages(): AddonPackage[] {
    return [...this.packages];
  }

  public getPackage(id: string): AddonPackage | undefined {
    return this.packages.find(p => p.manifest.id === id);
  }

  public getRegisteredTabs(): RegisteredTab[] {
    return Array.from(this.registeredTabs.values());
  }

  public getRegisteredWidgets(): RegisteredWidget[] {
    return Array.from(this.registeredWidgets.values());
  }

  private loadPackages(): void {
    try {
      const raw = localStorage.getItem(ADDONS_STORAGE_KEY);
      if (raw) {
        this.packages = JSON.parse(raw);
        // Migration transparente des anciens chemins plats vers l'arborescence standard
        let hasMigrations = false;
        this.packages.forEach(pkg => {
          pkg.files.forEach(f => {
            if (f.path === '/index.ts') {
              f.path = '/src/index.ts';
              hasMigrations = true;
            } else if (f.path === '/style.css') {
              f.path = '/assets/style.css';
              hasMigrations = true;
            }
          });
        });
        if (hasMigrations) {
          this.savePackages();
        }
      } else {
        // Initialiser avec les addons préinstallés officiels
        this.packages = [
          JSON.parse(JSON.stringify(SAMPLE_ADDON_CALCULATOR)),
          JSON.parse(JSON.stringify(SAMPLE_ADDON_TOMBOLA))
        ];
        this.savePackages();
      }
    } catch (e) {
      console.error('Erreur chargement addons :', e);
      this.packages = [];
    }
  }

  public savePackages(): void {
    localStorage.setItem(ADDONS_STORAGE_KEY, JSON.stringify(this.packages));
    this.notify();
  }

  public savePackage(addonPkg: AddonPackage): void {
    const idx = this.packages.findIndex(p => p.manifest.id === addonPkg.manifest.id);
    addonPkg.manifest.updatedAt = new Date().toISOString();
    if (idx >= 0) {
      this.packages[idx] = addonPkg;
    } else {
      this.packages.push(addonPkg);
    }
    this.savePackages();

    if (addonPkg.manifest.enabled) {
      this.unloadAddon(addonPkg.manifest.id);
      this.executeAddon(addonPkg);
    } else {
      this.unloadAddon(addonPkg.manifest.id);
    }
  }

  public toggleAddon(id: string, enabled?: boolean): boolean {
    const pkg = this.getPackage(id);
    if (!pkg) return false;

    const newState = enabled !== undefined ? enabled : !pkg.manifest.enabled;
    pkg.manifest.enabled = newState;
    pkg.manifest.updatedAt = new Date().toISOString();
    this.savePackages();

    if (newState) {
      this.executeAddon(pkg);
    } else {
      this.unloadAddon(id);
    }
    return newState;
  }

  public deletePackage(id: string): boolean {
    this.unloadAddon(id);
    const initialLen = this.packages.length;
    this.packages = this.packages.filter(p => p.manifest.id !== id);
    if (this.packages.length !== initialLen) {
      this.savePackages();
      return true;
    }
    return false;
  }

  public initActiveAddons(): void {
    this.packages.forEach(pkg => {
      if (pkg.manifest.enabled) {
        this.executeAddon(pkg);
      }
    });
  }

  public unloadAddon(addonId: string): void {
    const cleanups = this.activeAddonCleanups.get(addonId) || [];
    cleanups.forEach(fn => {
      try { fn(); } catch (e) { console.error('Erreur cleanup addon', e); }
    });
    this.activeAddonCleanups.delete(addonId);

    Array.from(this.registeredTabs.entries()).forEach(([tabId, tab]) => {
      if (tab.addonId === addonId) {
        this.registeredTabs.delete(tabId);
      }
    });

    Array.from(this.registeredWidgets.entries()).forEach(([widgetId, widget]) => {
      if (widget.addonId === addonId) {
        this.registeredWidgets.delete(widgetId);
      }
    });

    const styleEl = document.getElementById(`addon-style-${addonId}`);
    if (styleEl) {
      styleEl.remove();
    }

    this.notify();
  }

  public executeAddon(pkg: AddonPackage): void {
    this.unloadAddon(pkg.manifest.id);

    // 1. Injecter les styles CSS si présents (tous les fichiers .css)
    const cssFiles = pkg.files.filter(f => f.name.endsWith('.css') || f.path.endsWith('.css') || f.language === 'css');
    if (cssFiles.length > 0) {
      const existing = document.getElementById(`addon-style-${pkg.manifest.id}`);
      if (existing) existing.remove();
      const styleEl = document.createElement('style');
      styleEl.id = `addon-style-${pkg.manifest.id}`;
      styleEl.textContent = cssFiles.map(f => f.content).join('\n');
      document.head.appendChild(styleEl);
    }

    // 2. Trouver le fichier d'entrée (soit index.ts, /src/index.ts, index.js, etc.)
    const scriptFile = pkg.files.find(f => 
      f.name === 'index.ts' || 
      f.path === '/src/index.ts' || 
      f.path === '/index.ts' || 
      f.name === 'index.js' || 
      f.path === '/src/index.js' || 
      f.path === '/index.js' ||
      f.name.endsWith('.ts') ||
      f.name.endsWith('.js')
    );
    if (!scriptFile || !scriptFile.content.trim()) return;

    this.currentExecutingAddonId = pkg.manifest.id;
    if (!this.activeAddonCleanups.has(pkg.manifest.id)) {
      this.activeAddonCleanups.set(pkg.manifest.id, []);
    }

    try {
      // Transpiler instantanément le TypeScript en JavaScript natif pour éviter toute erreur de syntaxe
      let runnableJs = scriptFile.content;
      try {
        runnableJs = transform(scriptFile.content, { transforms: ['typescript'] }).code;
      } catch (transpileErr) {
        console.warn('Erreur lors de la transpilation TS de l\'addon, exécution directe :', transpileErr);
      }

      const runnable = new Function('OpenMDL', runnableJs);
      runnable((window as any).OpenMDL);
    } catch (err) {
      console.error(`Erreur d'exécution de l'addon [${pkg.manifest.name}] :`, err);
      this.api.ui.notify(`Erreur addon ${pkg.manifest.name} : ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      this.currentExecutingAddonId = null;
      this.notify();
    }
  }

  public emit(event: OpenMdlEventType, payload?: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(fn => {
        try {
          fn(payload);
        } catch (e) {
          console.error(`Erreur listener pour ${event} :`, e);
        }
      });
    }
  }

  private setupGlobalApi(): void {
    const api = this.createApi();
    (window as any).OpenMDL = api;
  }

  public get api(): IOpenMdlApi {
    return this.createApi();
  }

  private createApi(): IOpenMdlApi {
    const self = this;

    return {
      version: '1.0.5',
      appName: 'OpenMDL',
      author: 'Adrien Courault',
      authorUrl: 'https://max-63.github.io',

      // 1. Navigation & Onglets
      navigation: {
        registerTab(tab) {
          const addonId = self.currentExecutingAddonId || 'system';
          const protectedIds = ['dashboard', 'catalog', 'restock', 'stats', 'agenda', 'tpe', 'settings', 'credits', 'addons'];
          if (protectedIds.includes(tab.id.toLowerCase())) {
            console.warn(`Tentative de surcharge de l'onglet protégé : ${tab.id}. Opération ignorée.`);
            return;
          }

          self.registeredTabs.set(tab.id, {
            id: tab.id,
            label: tab.label,
            icon: tab.icon || 'puzzle',
            addonId,
            render: tab.render
          });

          if (addonId !== 'system') {
            const cleanups = self.activeAddonCleanups.get(addonId);
            if (cleanups) {
              cleanups.push(() => self.registeredTabs.delete(tab.id));
            }
          }
          self.notify();
        },

        unregisterTab(tabId: string) {
          self.registeredTabs.delete(tabId);
          self.notify();
        },

        goTo(tabId: string) {
          if (self.onNavigateCallback) {
            self.onNavigateCallback(tabId);
          }
        },

        getCurrentTab() {
          return (document.querySelector('main')?.getAttribute('data-active-tab') || 'dashboard');
        },

        getRegisteredTabs() {
          return self.getRegisteredTabs();
        },

        refresh() {
          self.notify();
        }
      },

      // 2. Dashboard & Widgets
      dashboard: {
        registerWidget(widget) {
          const addonId = self.currentExecutingAddonId || 'system';
          self.registeredWidgets.set(widget.id, {
            id: widget.id,
            title: widget.title,
            addonId,
            render: widget.render
          });

          if (addonId !== 'system') {
            const cleanups = self.activeAddonCleanups.get(addonId);
            if (cleanups) {
              cleanups.push(() => self.registeredWidgets.delete(widget.id));
            }
          }
          self.notify();
        },

        unregisterWidget(widgetId: string) {
          self.registeredWidgets.delete(widgetId);
          self.notify();
        },

        getRegisteredWidgets() {
          return self.getRegisteredWidgets();
        }
      },

      // 3. Produits & Catalogue
      products: {
        list: () => db.getProducts(),
        get: (id: string) => db.getProductById(id),
        getByCategory: (category: string) => db.getProducts().filter(p => p.category === category),
        search: (query: string) => {
          const q = (query || '').toLowerCase().trim();
          if (!q) return db.getProducts();
          return db.getProducts().filter(p => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
        },
        create: (p) => {
          const prod = db.addProduct(p);
          self.emit('product:updated', prod);
          return { success: true, message: 'Produit créé', product: prod };
        },
        update: (id, updates) => {
          const prod = db.getProductById(id);
          if (!prod) return { success: false, message: 'Produit introuvable' };
          const updated = { ...prod, ...updates };
          db.updateProduct(updated);
          self.emit('product:updated', updated);
          return { success: true, message: 'Produit mis à jour' };
        },
        delete: (id) => {
          db.deleteProduct(id);
          self.emit('product:deleted', { id });
          return { success: true, message: 'Produit supprimé' };
        },
        restock: (id, qty, reason) => {
          db.applyRestock(id, qty);
          self.emit('stock:updated', { id, quantityAdded: qty, reason });
          return { success: true, message: 'Stock réapprovisionné' };
        },
        setStock: (id, newStock) => {
          const prod = db.getProductById(id);
          if (!prod) return { success: false, message: 'Produit introuvable' };
          const updated = { ...prod, stock: Math.max(0, newStock) };
          db.updateProduct(updated);
          self.emit('stock:updated', { id, newStock: updated.stock });
          return { success: true, message: 'Stock mis à jour' };
        },
        getCategories: () => {
          return Array.from(new Set(db.getProducts().map(p => p.category)));
        },
        getFavorites: () => {
          return db.getProducts().filter(p => (p as any).isFavorite);
        },
        toggleFavorite: (id: string) => {
          const prod = db.getProductById(id);
          if (!prod) return false;
          (prod as any).isFavorite = !(prod as any).isFavorite;
          db.updateProduct(prod);
          self.emit('product:updated', prod);
          return (prod as any).isFavorite;
        },
        export: () => {
          return JSON.parse(JSON.stringify(db.getProducts()));
        },
        import: (products: Product[]) => {
          if (!Array.isArray(products)) return { success: false, count: 0 };
          let count = 0;
          products.forEach(p => {
            if (p && p.id && p.name) {
              const existing = db.getProductById(p.id);
              if (existing) {
                db.updateProduct({ ...existing, ...p });
              } else {
                db.addProduct(p);
              }
              count++;
            }
          });
          self.notify();
          return { success: true, count };
        }
      },

      // 4. Caisse & Ventes
      sales: {
        list: () => db.getSales(),
        get: (id: string) => db.getSales().find(s => s.id === id),
        getTodaySales: () => {
          const today = new Date().toISOString().split('T')[0];
          return db.getSales().filter(s => s.timestamp.startsWith(today));
        },
        getSessionSales: (sessionId: string) => db.getSales().filter(s => s.sessionId === sessionId),
        getByDateRange: (startDate: string, endDate: string) => {
          return db.getSales().filter(s => s.timestamp >= startDate && s.timestamp <= endDate);
        },
        record: (saleData) => {
          try {
            const saleItems = saleData.items.map(it => {
              if ('product' in it) {
                return {
                  productId: it.product.id,
                  productName: it.product.name,
                  unitPrice: it.product.price,
                  quantity: it.quantity,
                  totalPrice: it.product.price * it.quantity
                };
              }
              return it;
            });

            const totalAmount = saleItems.reduce((acc, it) => acc + it.totalPrice, 0);
            const method = (saleData.paymentMethod === 'card' || saleData.paymentMethod === 'tpe') ? 'tpe' : 'especes';

            const sale = db.recordSale({
              items: saleItems,
              totalAmount,
              paymentMethod: method,
              cashReceived: saleData.cashReceived,
              cashReturned: saleData.cashReturned
            });

            self.emit('sale:completed', sale);
            self.audioSynth.play('cash');
            return { success: true, sale, message: 'Vente enregistrée avec succès' };
          } catch (err: any) {
            return { success: false, message: err.message || 'Erreur lors de la vente' };
          }
        },
        cancel: (saleId: string, restoreStock = true) => {
          const sale = db.getSales().find(s => s.id === saleId);
          if (!sale) return { success: false, message: 'Vente introuvable' };

          if (restoreStock && sale.items) {
            sale.items.forEach(it => {
              const prod = db.getProductById(it.productId);
              if (prod) {
                db.updateProduct({ ...prod, stock: prod.stock + it.quantity });
              }
            });
          }

          (sale as any).isCancelled = true;
          (sale as any).cancelledAt = new Date().toISOString();
          db.saveSales();

          self.emit('sale:cancelled', { saleId, restoredStock: restoreStock });
          return { success: true, message: 'Vente annulée avec succès' };
        },
        getStats: (timeframe = 'day') => {
          const allSales = db.getSales().filter(s => !(s as any).isCancelled);
          let filteredSales = allSales;
          const now = new Date();

          if (timeframe === 'day') {
            const todayStr = now.toISOString().split('T')[0];
            filteredSales = allSales.filter(s => s.timestamp.startsWith(todayStr));
          } else if (timeframe === 'week') {
            const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
            filteredSales = allSales.filter(s => s.timestamp >= oneWeekAgo);
          } else if (timeframe === 'month') {
            const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
            filteredSales = allSales.filter(s => s.timestamp >= oneMonthAgo);
          }

          const totalRevenue = filteredSales.reduce((sum, s) => sum + s.totalAmount, 0);
          const totalItems = filteredSales.reduce((sum, s) => sum + s.items.reduce((acc, it) => acc + it.quantity, 0), 0);
          const salesCount = filteredSales.length;
          const averageBasket = salesCount > 0 ? totalRevenue / salesCount : 0;

          const productMap = new Map<string, { id: string; name: string; quantity: number; revenue: number }>();
          filteredSales.forEach(s => {
            s.items.forEach(it => {
              const existing = productMap.get(it.productId) || { id: it.productId, name: it.productName, quantity: 0, revenue: 0 };
              existing.quantity += it.quantity;
              existing.revenue += it.totalPrice;
              productMap.set(it.productId, existing);
            });
          });
          const topProducts = Array.from(productMap.values()).sort((a, b) => b.quantity - a.quantity).slice(0, 5);

          const paymentMethods = {
            cash: filteredSales.filter(s => s.paymentMethod === 'especes').reduce((sum, s) => sum + s.totalAmount, 0),
            card: filteredSales.filter(s => s.paymentMethod === 'tpe').reduce((sum, s) => sum + s.totalAmount, 0)
          };

          return { totalRevenue, totalItems, salesCount, averageBasket, topProducts, paymentMethods };
        },
        exportCsv: () => {
          const sales = db.getSales();
          const headers = ['ID', 'Date', 'Heure', 'Montant (€)', 'Mode de Paiement', 'Bénévole', 'Articles'];
          const rows = sales.map(s => {
            const date = new Date(s.timestamp);
            const dateStr = date.toLocaleDateString('fr-FR');
            const timeStr = date.toLocaleTimeString('fr-FR');
            const itemsStr = s.items.map(it => `${it.quantity}x ${it.productName}`).join(' | ');
            return [
              s.id,
              dateStr,
              timeStr,
              s.totalAmount.toFixed(2),
              s.paymentMethod,
              s.volunteerName || 'Inconnu',
              `"${itemsStr.replace(/"/g, '""')}"`
            ].join(';');
          });
          return [headers.join(';'), ...rows].join('\n');
        }
      },

      // 5. Panier en direct
      cart: {
        getItems: () => (window as any).__OPENMDL_CART__?.getItems() || [],
        getItem: (productId: string) => {
          const items = (window as any).__OPENMDL_CART__?.getItems() || [];
          return items.find((it: any) => it.product.id === productId);
        },
        add: (product, qty = 1) => {
          const prodObj = typeof product === 'string' ? db.getProductById(product) : product;
          if (prodObj) {
            (window as any).__OPENMDL_CART__?.addItem(prodObj, qty);
            self.emit('cart:updated', (window as any).__OPENMDL_CART__?.getItems() || []);
          }
        },
        remove: (productId, qty = 1) => {
          (window as any).__OPENMDL_CART__?.removeItem(productId, qty);
          self.emit('cart:updated', (window as any).__OPENMDL_CART__?.getItems() || []);
        },
        setQuantity: (productId, qty) => {
          const cart = (window as any).__OPENMDL_CART__;
          if (!cart) return;
          const currentQty = cart.getItemQuantity(productId);
          if (qty > currentQty) {
            const prod = db.getProductById(productId);
            if (prod) cart.addItem(prod, qty - currentQty);
          } else if (qty < currentQty) {
            cart.removeItem(productId, currentQty - qty);
          }
          self.emit('cart:updated', cart.getItems());
        },
        clear: () => {
          (window as any).__OPENMDL_CART__?.clear();
          self.emit('cart:updated', []);
        },
        getTotal: () => (window as any).__OPENMDL_CART__?.getTotal() || 0,
        getItemCount: () => {
          const items = (window as any).__OPENMDL_CART__?.getItems() || [];
          return items.reduce((sum: number, it: any) => sum + (it.quantity || 1), 0);
        },
        checkout: async (options) => {
          const cartItems = (window as any).__OPENMDL_CART__?.getItems() || [];
          if (cartItems.length === 0) {
            return { success: false, message: 'Le panier est vide' };
          }
          const session = db.getActiveSession();
          if (!session) {
            return { success: false, message: 'Aucune séance active' };
          }

          const saleItems = cartItems.map((ci: any) => ({
            productId: ci.product.id,
            productName: ci.product.name,
            unitPrice: ci.product.price,
            quantity: ci.quantity,
            totalPrice: ci.product.price * ci.quantity
          }));

          const totalAmount = saleItems.reduce((acc: number, it: any) => acc + it.totalPrice, 0);
          const method = (options.paymentMethod === 'card' || options.paymentMethod === 'tpe') ? 'tpe' : 'especes';

          const sale = db.recordSale({
            items: saleItems,
            totalAmount,
            paymentMethod: method
          });

          (window as any).__OPENMDL_CART__?.clear();
          self.audioSynth.play('cash');
          self.emit('sale:completed', sale);
          self.emit('cart:updated', []);

          return { success: true, message: 'Vente finalisée avec succès', sale };
        }
      },

      // 6. Séances de caisse
      sessions: {
        getActive: () => db.getActiveSession(),
        isOpen: () => db.getActiveSession() !== null,
        getHistory: () => db.getSessions(),
        get: (id: string) => db.getSessions().find(s => s.id === id),
        open: (options) => {
          const currentVolunteer = db.getCurrentVolunteer();
          if (!currentVolunteer) {
            return { success: false, message: 'Aucun bénévole authentifié pour ouvrir la séance' };
          }
          const ok = db.login(currentVolunteer.id);
          const sess = db.getActiveSession();
          if (ok && sess) {
            if (options?.notes) sess.incidentNotes = options.notes;
            self.emit('session:opened', sess);
            return { success: true, session: sess, message: 'Séance ouverte avec succès' };
          }
          return { success: false, message: 'Échec de l\'ouverture de séance' };
        },
        close: (options) => {
          try {
            const active = db.getActiveSession();
            if (!active) return { success: false, message: 'Aucune séance active' };
            const res = db.closeSession(options.commentary || '', options.perkProductId || (options.volunteerPerkClaimed ? 'perk' : undefined));
            self.emit('session:closed', res.session);
            return { success: true, session: res.session, message: 'Séance clôturée avec succès' };
          } catch (err: any) {
            return { success: false, message: err.message || 'Erreur lors de la clôture' };
          }
        },
        getDraftClosing: () => {
          const sess = db.getActiveSession();
          if (!sess || (!sess.draftNotes && !sess.draftPerkProductId)) return null;
          return {
            commentary: sess.draftNotes || '',
            volunteerPerkClaimed: !!sess.draftPerkProductId
          };
        },
        saveDraftClosing: (draft) => {
          db.saveSessionDraft(draft.commentary, draft.volunteerPerkClaimed ? 'perk_draft' : undefined);
        },
        clearDraftClosing: () => {
          db.clearSessionDraft();
        },
        canClaimPerk: (volId, sessId) => db.canClaimVolunteerPerk(volId, sessId).allowed
      },

      // 7. Bénévoles & Utilisateurs
      volunteers: {
        getCurrent: () => db.getCurrentVolunteer(),
        list: () => db.getVolunteers(),
        get: (id: string) => db.getVolunteers().find(v => v.id === id),
        create: (v) => {
          const res = db.createUser({
            username: v.username,
            name: v.name,
            password: v.password || '0000',
            role: v.role || 'Bénévole',
            isAdmin: v.isAdmin || false
          });
          return { success: res.success, volunteer: res.volunteer, message: res.message };
        },
        update: (id, updates) => {
          if (updates.name) {
            const res = db.updateUserName(id, updates.name);
            if (!res.success) return res;
          }
          return { success: true, message: 'Bénévole mis à jour' };
        },
        delete: (id) => db.deleteUser(id),
        login: (pinOrPassword) => {
          const vol = db.getVolunteers().find(v => v.password === pinOrPassword || v.pinCode === pinOrPassword || v.username === pinOrPassword || v.id === pinOrPassword);
          if (!vol) return { success: false, message: 'Identifiant ou code PIN incorrect' };
          const ok = db.login(vol.id);
          if (ok) {
            self.emit('volunteer:login', vol);
            return { success: true, volunteer: vol, message: 'Connecté' };
          }
          return { success: false, message: 'Compte suspendu ou inaccessible' };
        },
        logout: () => {
          const vol = db.getCurrentVolunteer();
          db.logout();
          self.emit('volunteer:logout', vol);
        },
        isAdmin: () => db.getCurrentVolunteer()?.isAdmin ?? false
      },

      // 8. Collation Bénévole (Perk)
      perk: {
        getConfig: () => db.getPerkSettings(),
        updateConfig: (updates) => {
          db.updatePerkSettings(updates);
          self.notify();
        },
        isEligible: (volunteerId, sessionId) => {
          const targetVolId = volunteerId || db.getCurrentVolunteer()?.id;
          if (!targetVolId) return false;
          return db.canClaimVolunteerPerk(targetVolId, sessionId).allowed;
        }
      },

      // 9. Addons & Extensions
      addons: {
        list: () => self.getPackages(),
        get: (id: string) => self.getPackage(id),
        isEnabled: (id: string) => self.getPackage(id)?.manifest.enabled ?? false,
        toggle: (id: string, enabled?: boolean) => self.toggleAddon(id, enabled),
        save: (pkg: AddonPackage) => self.savePackage(pkg),
        delete: (id: string) => self.deletePackage(id),
        export: (id: string) => {
          const pkg = self.getPackage(id);
          return pkg ? JSON.stringify(pkg, null, 2) : '';
        },
        import: (pkgJson: string) => {
          try {
            const pkg: AddonPackage = JSON.parse(pkgJson);
            if (!pkg.manifest || !pkg.manifest.id || !pkg.manifest.name) {
              return { success: false, message: 'Structure de manifest invalide' };
            }
            self.savePackage(pkg);
            return { success: true, message: 'Addon importé avec succès', addonId: pkg.manifest.id };
          } catch (e: any) {
            return { success: false, message: e.message || 'JSON invalide' };
          }
        }
      },

      // 10. Événements en temps réel
      events: {
        on(event, listener) {
          if (!self.eventListeners.has(event)) {
            self.eventListeners.set(event, new Set());
          }
          self.eventListeners.get(event)!.add(listener);

          const addonId = self.currentExecutingAddonId;
          if (addonId) {
            const cleanups = self.activeAddonCleanups.get(addonId);
            if (cleanups) {
              cleanups.push(() => self.eventListeners.get(event)?.delete(listener));
            }
          }

          return () => {
            self.eventListeners.get(event)?.delete(listener);
          };
        },

        once(event, listener) {
          const wrapper: OpenMdlEventListener = (payload) => {
            self.eventListeners.get(event)?.delete(wrapper);
            listener(payload);
          };
          return this.on(event, wrapper);
        },

        off(event, listener) {
          self.eventListeners.get(event)?.delete(listener);
        },

        emit(event, payload) {
          self.emit(event, payload);
        }
      },

      // 11. Stockage persistant isolé
      storage: {
        get<T = any>(key: string, defaultValue?: T): T {
          const addonId = self.currentExecutingAddonId || 'global_api';
          const fullKey = `addon_storage_${addonId}_${key}`;
          const val = localStorage.getItem(fullKey);
          if (val === null) return defaultValue as T;
          try {
            return JSON.parse(val);
          } catch {
            return val as unknown as T;
          }
        },

        set<T = any>(key: string, value: T): void {
          const addonId = self.currentExecutingAddonId || 'global_api';
          const fullKey = `addon_storage_${addonId}_${key}`;
          localStorage.setItem(fullKey, JSON.stringify(value));
        },

        remove(key: string): void {
          const addonId = self.currentExecutingAddonId || 'global_api';
          localStorage.removeItem(`addon_storage_${addonId}_${key}`);
        },

        clear(): void {
          const addonId = self.currentExecutingAddonId || 'global_api';
          const prefix = `addon_storage_${addonId}_`;
          Object.keys(localStorage).forEach(k => {
            if (k.startsWith(prefix)) {
              localStorage.removeItem(k);
            }
          });
        },

        keys(): string[] {
          const addonId = self.currentExecutingAddonId || 'global_api';
          const prefix = `addon_storage_${addonId}_`;
          return Object.keys(localStorage)
            .filter(k => k.startsWith(prefix))
            .map(k => k.slice(prefix.length));
        },

        getAll(): Record<string, any> {
          const addonId = self.currentExecutingAddonId || 'global_api';
          const prefix = `addon_storage_${addonId}_`;
          const result: Record<string, any> = {};
          Object.keys(localStorage).forEach(k => {
            if (k.startsWith(prefix)) {
              const subKey = k.slice(prefix.length);
              try {
                result[subKey] = JSON.parse(localStorage.getItem(k) || '');
              } catch {
                result[subKey] = localStorage.getItem(k);
              }
            }
          });
          return result;
        }
      },

      // 12. Interface & Modales & Notifications
      ui: {
        notify(message, type = 'info') {
          const toast = document.createElement('div');
          const bgColors = {
            info: 'bg-slate-900 border-slate-700 text-white',
            success: 'bg-emerald-600 border-emerald-500 text-white',
            warning: 'bg-amber-600 border-amber-500 text-white',
            error: 'bg-rose-600 border-rose-500 text-white'
          };
          toast.className = `fixed bottom-5 right-5 z-50 px-4 py-3 rounded-2xl shadow-xl border text-xs font-bold transition-all transform translate-y-2 opacity-0 flex items-center gap-2.5 ${bgColors[type] || bgColors.info}`;
          toast.textContent = message;
          document.body.appendChild(toast);

          requestAnimationFrame(() => {
            toast.classList.remove('translate-y-2', 'opacity-0');
          });

          setTimeout(() => {
            toast.classList.add('translate-y-2', 'opacity-0');
            setTimeout(() => toast.remove(), 300);
          }, 3500);
        },

        toast(message, type = 'info') {
          this.notify(message, type);
        },

        confirm({ title, message, confirmText = 'Confirmer', cancelText = 'Annuler', onConfirm }) {
          self.api.ui.closeModal();

          const overlay = document.createElement('div');
          overlay.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in';
          overlay.innerHTML = `
            <div class="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4 animate-enter">
              <h3 class="text-sm font-black text-slate-900 dark:text-white">${self.api.utils.escapeHtml(title)}</h3>
              <p class="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">${self.api.utils.escapeHtml(message)}</p>
              <div class="flex items-center justify-end gap-2 pt-2">
                <button id="btn-cancel" class="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                  ${self.api.utils.escapeHtml(cancelText)}
                </button>
                <button id="btn-confirm" class="px-4 py-2 rounded-xl text-xs font-extrabold bg-orange-600 hover:bg-orange-500 text-white transition-colors cursor-pointer">
                  ${self.api.utils.escapeHtml(confirmText)}
                </button>
              </div>
            </div>
          `;
          document.body.appendChild(overlay);
          self.activeModalElement = overlay;

          overlay.querySelector('#btn-cancel')?.addEventListener('click', () => {
            overlay.remove();
            self.activeModalElement = null;
          });
          overlay.querySelector('#btn-confirm')?.addEventListener('click', () => {
            overlay.remove();
            self.activeModalElement = null;
            onConfirm();
          });
        },

        prompt({ title, message = '', placeholder = '', defaultValue = '', confirmText = 'Valider', cancelText = 'Annuler', onConfirm, onCancel }) {
          self.api.ui.closeModal();

          const overlay = document.createElement('div');
          overlay.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in';
          overlay.innerHTML = `
            <div class="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4 animate-enter">
              <h3 class="text-sm font-black text-slate-900 dark:text-white">${self.api.utils.escapeHtml(title)}</h3>
              ${message ? `<p class="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">${self.api.utils.escapeHtml(message)}</p>` : ''}
              <input id="prompt-input" type="text" placeholder="${self.api.utils.escapeHtml(placeholder)}" value="${self.api.utils.escapeHtml(defaultValue)}"
                class="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:border-orange-500 font-medium" />
              <div class="flex items-center justify-end gap-2 pt-2">
                <button id="btn-cancel" class="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                  ${self.api.utils.escapeHtml(cancelText)}
                </button>
                <button id="btn-confirm" class="px-4 py-2 rounded-xl text-xs font-extrabold bg-orange-600 hover:bg-orange-500 text-white transition-colors cursor-pointer">
                  ${self.api.utils.escapeHtml(confirmText)}
                </button>
              </div>
            </div>
          `;
          document.body.appendChild(overlay);
          self.activeModalElement = overlay;

          const input = overlay.querySelector('#prompt-input') as HTMLInputElement;
          input?.focus();
          input?.select();

          const handleConfirm = () => {
            const val = input.value;
            overlay.remove();
            self.activeModalElement = null;
            onConfirm(val);
          };

          const handleCancel = () => {
            overlay.remove();
            self.activeModalElement = null;
            if (onCancel) onCancel();
          };

          input?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleConfirm();
            if (e.key === 'Escape') handleCancel();
          });

          overlay.querySelector('#btn-cancel')?.addEventListener('click', handleCancel);
          overlay.querySelector('#btn-confirm')?.addEventListener('click', handleConfirm);
        },

        modal({ title, content, onClose, size = 'md' }) {
          self.api.ui.closeModal();

          const sizeClasses: Record<string, string> = {
            sm: 'max-w-md',
            md: 'max-w-2xl',
            lg: 'max-w-4xl',
            xl: 'w-[85vw] max-w-6xl',
            full: 'w-[95vw] max-w-7xl'
          };
          const chosenSize = sizeClasses[size || 'md'] || 'max-w-2xl';

          const overlay = document.createElement('div');
          overlay.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in';
          overlay.innerHTML = `
            <div class="w-full ${chosenSize} max-h-[88vh] flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-enter">
              <div class="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 class="text-sm font-black text-slate-900 dark:text-white">${self.api.utils.escapeHtml(title)}</h3>
                <button id="btn-close-modal" class="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer" aria-label="Fermer">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
              <div id="modal-body" class="p-6 overflow-y-auto flex-1"></div>
            </div>
          `;
          const bodyEl = overlay.querySelector('#modal-body')!;
          if (typeof content === 'string') {
            bodyEl.innerHTML = content;
          } else {
            bodyEl.appendChild(content);
          }

          // Gestion des boutons de copie de code PrismJS
          bodyEl.querySelectorAll('.btn-copy-code').forEach(btn => {
            btn.addEventListener('click', (e) => {
              e.stopPropagation();
              const code = decodeURIComponent((btn as HTMLElement).getAttribute('data-code') || '');
              if (code) {
                navigator.clipboard.writeText(code);
                self.api.ui.notify('Extrait de code copié !', 'success');
                const prev = btn.textContent;
                btn.textContent = 'Copié !';
                setTimeout(() => { btn.textContent = prev; }, 1800);
              }
            });
          });

          document.body.appendChild(overlay);
          self.activeModalElement = overlay;

          const close = () => {
            overlay.remove();
            self.activeModalElement = null;
            if (onClose) onClose();
          };
          overlay.querySelector('#btn-close-modal')?.addEventListener('click', close);
        },

        closeModal() {
          if (self.activeModalElement) {
            self.activeModalElement.remove();
            self.activeModalElement = null;
          }
        },

        renderMarkdown(md: string): string {
          return customMarked.parse(md, { async: false }) as string;
        },

        playSound(sound) {
          self.audioSynth.play(sound);
        },

        toggleFullscreen() {
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
          } else {
            document.exitFullscreen().catch(() => {});
          }
        }
      },

      // 13. Synthétiseur Audio WebAudio (100% hors-ligne)
      audio: {
        play: (sound) => self.audioSynth.play(sound),
        beep: (freq, duration, type) => self.audioSynth.beep(freq, duration, type),
        isMuted: () => self.audioSynth.isMuted(),
        setMuted: (muted) => self.audioSynth.setMuted(muted)
      },

      // 14. Thème & Styles
      theme: {
        getTheme: () => document.documentElement.classList.contains('dark') ? 'dark' : 'light',
        setTheme(theme) {
          if (theme === 'dark') {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
          localStorage.setItem('openmdl_theme', theme);
          self.emit('theme:changed', theme);
        },
        toggleTheme() {
          const current = this.getTheme();
          const next = current === 'dark' ? 'light' : 'dark';
          this.setTheme(next);
          return next;
        },
        injectCss(css: string, id?: string) {
          const targetId = id ? `custom-css-${id}` : `custom-css-anon-${Date.now()}`;
          let el = document.getElementById(targetId) as HTMLStyleElement;
          if (!el) {
            el = document.createElement('style');
            el.id = targetId;
            document.head.appendChild(el);
          }
          el.textContent = css;
        },
        removeInjectedCss(id: string) {
          const el = document.getElementById(`custom-css-${id}`);
          if (el) el.remove();
        }
      },

      // 15. Système & Sauvegardes
      system: {
        version: '1.0.5',
        appName: 'OpenMDL',
        author: 'Adrien Courault',
        portfolioUrl: 'https://max-63.github.io',
        getInfo() {
          return {
            version: '1.0.5',
            totalSales: db.getSales().length,
            totalProducts: db.getProducts().length,
            hasActiveSession: db.getActiveSession() !== null,
            theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
            installedAddonsCount: self.packages.length
          };
        },
        exportBackup: () => {
          return JSON.stringify(db.exportData(), null, 2);
        },
        importBackup: (jsonData: string) => {
          try {
            const data = JSON.parse(jsonData);
            db.importData(data);
            return { success: true, message: 'Sauvegarde restaurée avec succès' };
          } catch (e: any) {
            return { success: false, message: e.message || 'Fichier de sauvegarde corrompu' };
          }
        },
        resetData: () => {
          db.resetAll();
          self.notify();
        },
        getActivityLogs: () => db.getLogs(),
        logActivity: (type, message) => db.logActivity(type, message)
      },

      // 16. Utilitaires universels
      utils: {
        formatPrice: (amount: number) => (Number(amount) || 0).toFixed(2) + ' €',
        formatDate: (date) => new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        formatTime: (date) => new Date(date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        escapeHtml: (str: string) => {
          const div = document.createElement('div');
          div.textContent = str;
          return div.innerHTML;
        },
        generateId: (prefix = 'item') => `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        downloadFile: (filename: string, content: string, mimeType = 'application/json') => {
          const blob = new Blob([content], { type: mimeType });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }, 200);
        },
        copyToClipboard: async (text: string) => {
          try {
            await navigator.clipboard.writeText(text);
            return true;
          } catch {
            return false;
          }
        }
      }
    };
  }
}

export const addonManager = AddonManager.getInstance();
export const OpenMDL = addonManager.api;
