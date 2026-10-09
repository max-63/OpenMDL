import { db } from '../services/db';
import { Product, CartItem, PaymentMethod } from '../types';

export class TerminalPosComponent {
  private container: HTMLElement | null = null;
  private isVisible: boolean = false;
  private inputBuffer: string = '';
  private cart: CartItem[] = [];
  private selectedIndex: number = 0;
  private isMemberPrice: boolean = false;
  private statusMessage: string = 'Prêt. Entrez un numéro pour ajouter, -X pour retirer, ou /help';
  private statusType: 'info' | 'success' | 'warn' | 'error' = 'info';
  private history: string[] = [];
  private keyListener: ((e: KeyboardEvent) => void) | null = null;
  private onExitCallback: () => void;

  constructor(onExit: () => void) {
    this.onExitCallback = onExit;
  }

  public show(): void {
    if (this.isVisible) return;
    this.isVisible = true;
    this.cart = [];
    this.inputBuffer = '';
    this.selectedIndex = 0;
    this.isMemberPrice = false;
    this.statusMessage = 'Bienvenue dans OpenMDL CLI. Raccourcis : [F1] Espèces, [F2] TPE, [Esc] Quitter.';
    this.statusType = 'info';
    this.history = [];

    this.container = document.createElement('div');
    this.container.id = 'openmdl-terminal-pos';
    this.container.className = 'fixed inset-0 z-[200] bg-[#191716] text-[#e6e4df] font-mono text-xs sm:text-sm p-3 sm:p-6 flex flex-col select-none overflow-hidden';

    document.body.appendChild(this.container);
    this.render();
    this.bindEvents();
  }

  public hide(): void {
    if (!this.isVisible) return;
    this.isVisible = false;
    if (this.keyListener) {
      window.removeEventListener('keydown', this.keyListener, true);
      this.keyListener = null;
    }
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.onExitCallback();
  }

  public toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  private bindEvents(): void {
    this.keyListener = (e: KeyboardEvent) => {
      if (!this.isVisible) return;

      // Échap pour quitter
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.hide();
        return;
      }

      // Raccourcis directs de caisse
      if (e.key === 'F1') {
        e.preventDefault();
        this.checkout('especes');
        return;
      }
      if (e.key === 'F2') {
        e.preventDefault();
        this.checkout('tpe');
        return;
      }
      if (e.key === 'F3') {
        e.preventDefault();
        this.isMemberPrice = !this.isMemberPrice;
        this.logMessage(`Tarif basculé : ${this.isMemberPrice ? 'Adhérent MDL (-10%)' : 'Standard'}`, 'info');
        this.render();
        return;
      }
      if (e.key === 'F4') {
        e.preventDefault();
        this.cart = [];
        this.logMessage('Panier vidé', 'warn');
        this.render();
        return;
      }

      // Navigation dans la liste des produits
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const products = db.getProducts();
        if (products.length > 0) {
          this.selectedIndex = (this.selectedIndex - 1 + products.length) % products.length;
          this.render();
        }
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const products = db.getProducts();
        if (products.length > 0) {
          this.selectedIndex = (this.selectedIndex + 1) % products.length;
          this.render();
        }
        return;
      }

      // Validation
      if (e.key === 'Enter') {
        e.preventDefault();
        const cmd = this.inputBuffer.trim();
        this.inputBuffer = '';
        this.handleCommand(cmd);
        this.render();
        return;
      }

      // Effacement
      if (e.key === 'Backspace') {
        e.preventDefault();
        this.inputBuffer = this.inputBuffer.slice(0, -1);
        this.render();
        return;
      }

      // Saisie
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        this.inputBuffer += e.key;
        this.render();
      }
    };

    window.addEventListener('keydown', this.keyListener, true);
  }

  private logMessage(msg: string, type: 'info' | 'success' | 'warn' | 'error' = 'info'): void {
    this.statusMessage = msg;
    this.statusType = type;
    this.history.push(msg);
    if (this.history.length > 4) {
      this.history.shift();
    }
  }

  private handleCommand(cmd: string): void {
    if (!cmd) {
      // Si entrée seule : ajouter le produit en surbrillance
      const products = db.getProducts();
      if (products[this.selectedIndex]) {
        this.addToCart(products[this.selectedIndex], 1);
      }
      return;
    }

    const lower = cmd.toLowerCase();

    // Commandes slash ou mots-clés
    if (lower === '/exit' || lower === 'exit' || lower === '/quit' || lower === 'quit' || lower === ':q' || lower === 'q') {
      this.hide();
      return;
    }

    if (lower === '/clear' || lower === 'clear' || lower === 'cls') {
      this.cart = [];
      this.logMessage('Panier réinitialisé', 'info');
      return;
    }

    if (lower === '/adh' || lower === 'adh' || lower === 'adherent' || lower === 'mdl') {
      this.isMemberPrice = !this.isMemberPrice;
      this.logMessage(`Tarif : ${this.isMemberPrice ? 'Adhérent MDL (-10%)' : 'Standard'}`, 'info');
      return;
    }

    if (lower === '/cash' || lower === 'cash' || lower === 'esp' || lower === 'especes') {
      this.checkout('especes');
      return;
    }

    if (lower === '/tpe' || lower === 'tpe' || lower === 'cb' || lower === 'card') {
      this.checkout('tpe');
      return;
    }

    if (lower === '/help' || lower === 'help' || lower === '?') {
      this.logMessage('Commandes : <num>, <num>x<qté>, -<num>, /cash, /tpe, /adh, /clear, /exit', 'info');
      return;
    }

    // RETIRER UN PRODUIT : -1, -1x2, rm 1, del 1
    const removeMatch = cmd.match(/^-(?:(\d+)(?:[xX*](\d+))?)$/) ||
      cmd.match(/^(?:del|rm|remove|suppr)\s+(\d+)(?:\s+[xX*]?(\d+))?$/i);

    if (removeMatch) {
      const idx = parseInt(removeMatch[1], 10) - 1;
      const qty = removeMatch[2] ? parseInt(removeMatch[2], 10) : 1;
      const products = db.getProducts();
      const product = products[idx];

      if (product) {
        this.removeFromCart(product.id, qty);
        return;
      } else {
        this.logMessage(`Erreur : Article #${idx + 1} introuvable`, 'error');
        return;
      }
    }

    // AJOUT MULTIPLE : 2x3
    const matchMultiply = cmd.match(/^(\d+)[xX*](\d+)$/);
    if (matchMultiply) {
      const idx = parseInt(matchMultiply[1], 10) - 1;
      const qty = parseInt(matchMultiply[2], 10);
      const products = db.getProducts();
      if (products[idx]) {
        this.addToCart(products[idx], qty);
        return;
      } else {
        this.logMessage(`Erreur : Article #${idx + 1} introuvable`, 'error');
        return;
      }
    }

    // AJOUT PAR NUMERO DIRECT : 1, 2, 12
    const num = parseInt(cmd, 10);
    if (!isNaN(num) && num > 0) {
      const products = db.getProducts();
      const product = products[num - 1];
      if (product) {
        this.addToCart(product, 1);
        return;
      } else {
        this.logMessage(`Erreur : Article #${num} introuvable`, 'error');
        return;
      }
    }

    // RECHERCHE MOT-CLE
    const products = db.getProducts();
    const found = products.find(p => p.name.toLowerCase().includes(lower));
    if (found) {
      this.addToCart(found, 1);
    } else {
      this.logMessage(`Commande inconnue : "${cmd}". Tapez /help ou un numéro.`, 'error');
    }
  }

  private removeFromCart(productId: string, quantity: number): void {
    const existingIndex = this.cart.findIndex(i => i.product.id === productId);
    if (existingIndex === -1) {
      this.logMessage(`L'article n'est pas dans le panier`, 'warn');
      return;
    }

    const item = this.cart[existingIndex];
    if (item.quantity > quantity) {
      item.quantity -= quantity;
      this.logMessage(`Retiré -${quantity} ${item.product.name} (reste: ${item.quantity})`, 'info');
    } else {
      const removedName = item.product.name;
      this.cart.splice(existingIndex, 1);
      this.logMessage(`Supprimé du panier : ${removedName}`, 'warn');
    }
  }

  private addToCart(product: Product, quantity: number): void {
    if (product.stock <= 0) {
      this.logMessage(`Rupture de stock : ${product.name}`, 'warn');
      return;
    }

    const price = this.isMemberPrice ? Math.max(0.10, Math.round((product.price * 0.9) * 20) / 20) : product.price;
    const existing = this.cart.find(i => i.product.id === product.id);

    if (existing) {
      if (existing.quantity + quantity <= product.stock) {
        existing.quantity += quantity;
        this.logMessage(`Ajout +${quantity} ${product.name} (${existing.quantity}x au total)`, 'success');
      } else {
        this.logMessage(`Stock maximum atteint (${product.stock} dispo)`, 'warn');
      }
    } else {
      const qtyToAdd = Math.min(quantity, product.stock);
      this.cart.push({
        product: { ...product, price },
        quantity: qtyToAdd
      });
      this.logMessage(`Ajouté : ${product.name} x${qtyToAdd} (${(price * qtyToAdd).toFixed(2)} €)`, 'success');
    }
  }

  private checkout(method: PaymentMethod): void {
    if (this.cart.length === 0) {
      this.logMessage('Impossible d\'encaisser : panier vide', 'warn');
      this.render();
      return;
    }

    const total = this.cart.reduce((sum, i) => sum + (i.product.price * i.quantity), 0);

    try {
      if (method === 'tpe') {
        db.recordTpePayment({
          amount: total,
          cardBrand: 'OpenMDL CLI',
          status: 'SUCCESS'
        });
      }

      db.recordSale({
        items: this.cart.map(item => ({
          productId: item.product.id,
          productName: item.product.name,
          quantity: item.quantity,
          unitPrice: item.product.price,
          totalPrice: item.product.price * item.quantity
        })),
        totalAmount: total,
        paymentMethod: method,
        cashReceived: method === 'especes' ? total : undefined,
        cashReturned: method === 'especes' ? 0 : undefined
      });

      this.logMessage(`Vente encaissée avec succès [${method.toUpperCase()}] : ${total.toFixed(2)} €`, 'success');
      this.cart = [];
    } catch (err: any) {
      this.logMessage(`Erreur SQLite : ${err?.message || 'Échec de vente'}`, 'error');
    }

    this.render();
  }

  private render(): void {
    if (!this.container) return;

    const products = db.getProducts();
    const volunteer = db.getCurrentVolunteer();
    const totalCart = this.cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
    const totalItems = this.cart.reduce((sum, item) => sum + item.quantity, 0);

    const appVer = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.10';
    // ASCII Art discret et raffiné style Claude Code / Anthropic
    const claudeAsciiLogo = `
  ╭───────────────────────────────────────────────────╮
  │   ___                     __  __ ____  _          │
  │  / _ \\ _ __   ___ _ __   |  \\/  |  _ \\| |   CLI   │
  │ | | | | '_ \\ / _ \\ '_ \\  | |\\/| | | | | |  v${appVer.padEnd(6, ' ')}│
  │ | |_| | |_) |  __/ | | | | |  | | |_| | |___      │
  │  \\___/| .__/ \\___|_| |_| |_|  |_|____/|_____|     │
  │       |_|                                         │
  ╰───────────────────────────────────────────────────╯
    `.trim();

    this.container.innerHTML = `
      <!-- En-tête supérieur style Claude Code CLI -->
      <div class="flex items-center justify-between border-b border-[#2c2826] pb-3 mb-4">
        <div class="flex items-center gap-3">
          <span class="text-[#d97757] font-black text-base sm:text-lg tracking-tight flex items-center gap-2">
            <span class="inline-block w-2.5 h-2.5 rounded-full bg-[#d97757]"></span>
            OpenMDL Code
          </span>
          <span class="text-[#5c5550]">/</span>
          <span class="text-[#a8a199] text-xs font-medium">mode caisse express</span>
          <span class="px-2 py-0.5 rounded text-[10px] bg-[#2a2624] text-[#d97757] border border-[#3e3835] font-semibold">
            v${appVer}
          </span>
        </div>

        <div class="flex items-center gap-2 text-xs">
          <span class="text-[#7a726b] hidden sm:inline">
            Connecté : <strong class="text-[#e6e4df]">${volunteer ? volunteer.name : 'bénévole'}</strong>
          </span>
          <span class="text-[#5c5550] hidden sm:inline">│</span>
          <button id="term-btn-quit" class="px-2.5 py-1 rounded bg-[#2a2624] hover:bg-[#342f2c] border border-[#3e3835] text-[#a8a199] hover:text-white transition-colors cursor-pointer text-xs">
            Esc pour fermer
          </button>
        </div>
      </div>

      <!-- Corps principal Tiling Split style terminal moderne -->
      <div class="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0 overflow-hidden">
        
        <!-- PANE GAUCHE : Inventaire produits (7 colonnes) -->
        <div class="lg:col-span-7 flex flex-col bg-[#1f1d1b] border border-[#2c2826] rounded-xl overflow-hidden">
          
          <div class="bg-[#24211f] px-3.5 py-2 border-b border-[#2c2826] flex items-center justify-between text-xs text-[#a8a199]">
            <span class="font-bold flex items-center gap-2">
              <span class="text-[#d97757]">●</span>
              <span>Catalogue des articles</span>
            </span>
            <span class="font-mono text-[11px] text-[#7a726b]">ID │ STOCK │ PRIX</span>
          </div>

          <div class="flex-1 overflow-y-auto p-2 space-y-0.5 font-mono text-xs" id="term-product-list">
            ${products.map((p, idx) => {
      const isSelected = idx === this.selectedIndex;
      const price = this.isMemberPrice ? Math.max(0.10, Math.round((p.price * 0.9) * 20) / 20) : p.price;
      const isOutOfStock = p.stock <= 0;
      const padNum = (idx + 1).toString().padStart(2, '0');
      const padName = p.name.padEnd(28, ' ').slice(0, 28);
      const padStock = isOutOfStock ? '0 en stock' : `${p.stock} en stock`;

      return `
                <div class="flex items-center justify-between px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${isSelected
          ? 'bg-[#d97757] text-white font-bold shadow-xs'
          : isOutOfStock
            ? 'text-[#5c5550] line-through'
            : 'text-[#c2bcaf] hover:bg-[#282522]'
        }" data-prod-index="${idx}">
                  <span class="truncate">
                    <span class="${isSelected ? 'text-white' : 'text-[#d97757]'} font-bold">${padNum}</span>
                    <span class="${isSelected ? 'text-white/60' : 'text-[#4e4742]'} mx-2">│</span>
                    <span>${padName}</span>
                  </span>
                  <span class="font-mono text-right flex-shrink-0">
                    <span class="${isOutOfStock ? 'text-[#854536]' : isSelected ? 'text-white/90' : 'text-[#7a726b]'} text-[11px]">${padStock}</span>
                    <span class="${isSelected ? 'text-white/60' : 'text-[#4e4742]'} mx-2">│</span>
                    <span class="font-bold ${isSelected ? 'text-white' : 'text-[#e6e4df]'}">${price.toFixed(2)} €</span>
                  </span>
                </div>
              `;
    }).join('')}
          </div>

          <div class="bg-[#191716] border-t border-[#2c2826] px-3.5 py-1.5 text-[11px] text-[#7a726b] flex justify-between">
            <span>Ajouter : tapez le numéro (ex: <code class="text-[#d97757]">3</code> ou <code class="text-[#d97757]">3x2</code>)</span>
            <span>Retirer : tapez <code class="text-[#d97757]">-3</code> ou <code class="text-[#d97757]">rm 3</code></span>
          </div>

        </div>

        <!-- PANE DROITE : Ticket de caisse & Actions (5 colonnes) -->
        <div class="lg:col-span-5 flex flex-col gap-3 min-h-0 overflow-hidden">
          
          <!-- ASCII Card -->
          <div class="bg-[#1f1d1b] border border-[#2c2826] rounded-xl p-3 hidden sm:block">
            <pre class="text-[9px] leading-[11px] text-[#d97757] select-none text-center font-mono">${claudeAsciiLogo}</pre>
          </div>

          <!-- Ticket Box -->
          <div class="flex-1 flex flex-col bg-[#1f1d1b] border border-[#2c2826] rounded-xl overflow-hidden justify-between min-h-0">
            
            <div class="bg-[#24211f] px-3.5 py-2 border-b border-[#2c2826] flex items-center justify-between text-xs text-[#a8a199]">
              <span class="font-bold flex items-center gap-2">
                <span class="text-[#78b38a]">●</span>
                <span>Panier en cours (${totalItems} article${totalItems > 1 ? 's' : ''})</span>
              </span>
              <span class="font-mono font-bold text-[#e6e4df]">${totalCart.toFixed(2)} €</span>
            </div>

            <div class="flex-1 overflow-y-auto p-3 space-y-1 font-mono text-xs">
              ${this.cart.length === 0 ? `
                <div class="h-28 flex flex-col items-center justify-center text-[#5c5550] text-center gap-1.5">
                  <span class="text-sm">Panier vide</span>
                  <span class="text-[11px] text-[#7a726b]">Tapez un numéro pour ajouter un article</span>
                </div>
              ` : this.cart.map(item => `
                <div class="flex items-center justify-between py-1 border-b border-[#282522] text-[#c2bcaf]">
                  <span class="truncate pr-2">
                    <span class="text-[#d97757] font-bold">${item.quantity}×</span>
                    <span class="ml-1.5">${item.product.name}</span>
                  </span>
                  <span class="font-bold text-[#e6e4df] font-mono flex-shrink-0">
                    ${(item.product.price * item.quantity).toFixed(2)} €
                  </span>
                </div>
              `).join('')}
            </div>

            <!-- Total et raccourcis Claude Code -->
            <div class="bg-[#191716] border-t border-[#2c2826] p-3 space-y-2.5">
              <div class="flex items-baseline justify-between bg-[#24211f] px-3.5 py-2 rounded-lg border border-[#2c2826]">
                <span class="text-xs text-[#7a726b] font-bold uppercase tracking-wider">Total à payer</span>
                <span class="text-xl font-black text-[#e6e4df] font-mono">${totalCart.toFixed(2)} €</span>
              </div>
              
              <div class="grid grid-cols-2 gap-2 text-xs">
                <button class="py-1.5 px-2 rounded-lg bg-[#24211f] hover:bg-[#2c2826] border border-[#2c2826] text-[#78b38a] font-bold text-center transition-colors">
                  [F1] Espèces
                </button>
                <button class="py-1.5 px-2 rounded-lg bg-[#24211f] hover:bg-[#2c2826] border border-[#2c2826] text-[#7999cc] font-bold text-center transition-colors">
                  [F2] TPE / Carte
                </button>
              </div>

              <div class="flex items-center justify-between text-[11px] text-[#7a726b] pt-0.5">
                <span>[F3] Tarif : <strong class="${this.isMemberPrice ? 'text-[#d97757]' : 'text-[#a8a199]'}">${this.isMemberPrice ? 'Adhérent (-10%)' : 'Standard'}</strong></span>
                <span>[F4] Vider</span>
              </div>
            </div>

          </div>

        </div>

      </div>

      <!-- Ligne d'historique / statut style Claude CLI -->
      <div class="mt-3 flex items-center justify-between px-3.5 py-2 rounded-xl bg-[#1f1d1b] border border-[#2c2826] text-xs font-mono">
        <div class="flex items-center gap-2.5 truncate">
          <span class="${this.statusType === 'success' ? 'text-[#78b38a]' :
        this.statusType === 'warn' ? 'text-[#d97757]' :
          this.statusType === 'error' ? 'text-[#e06c75]' :
            'text-[#7999cc]'
      }">●</span>
          <span class="truncate ${this.statusType === 'success' ? 'text-[#78b38a]' :
        this.statusType === 'warn' ? 'text-[#d97757]' :
          this.statusType === 'error' ? 'text-[#e06c75]' :
            'text-[#a8a199]'
      }">
            ${this.statusMessage}
          </span>
        </div>
        <span class="text-[10px] text-[#5c5550] flex-shrink-0 ml-2 hidden sm:inline">openmdl-cli</span>
      </div>

      <!-- Invite de saisie Prompt Claude Code CLI -->
      <div class="mt-2.5 flex items-center bg-[#1f1d1b] border border-[#d97757]/80 rounded-xl px-4 py-2.5 shadow-lg shadow-black/40">
        <span class="text-[#d97757] font-bold mr-2 text-sm select-none">❯</span>
        <span class="flex-1 font-mono text-[#e6e4df] font-medium text-sm tracking-wide">${this.inputBuffer}</span>
        <span class="w-2 h-4 bg-[#d97757] animate-pulse inline-block"></span>
      </div>
    `;

    // Clics directs
    this.container.querySelectorAll('[data-prod-index]').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.getAttribute('data-prod-index') || '0', 10);
        this.selectedIndex = idx;
        const products = db.getProducts();
        if (products[idx]) {
          this.addToCart(products[idx], 1);
        }
        this.render();
      });
    });

    this.container.querySelector('#term-btn-quit')?.addEventListener('click', () => {
      this.hide();
    });
  }
}
