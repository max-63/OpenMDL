import { db } from '../services/db';
import { Icons } from '../components/Icons';

export class TpeView {
  private onStateChange: () => void;
  private testAmount: number = 1.50;
  private testState: 'idle' | 'waiting_card' | 'processing' | 'approved' = 'idle';
  private testCardBrand: string = 'CB / Apple Pay';
  private showConnectModal: boolean = false;

  constructor(onStateChange: () => void) {
    this.onStateChange = onStateChange;
  }

  public render(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'w-full h-full flex flex-col gap-4 overflow-y-auto pr-1 animate-enter select-none';

    this.renderContent(container);
    return container;
  }

  private renderContent(container: HTMLElement): void {
    container.innerHTML = '';

    const tpe = db.getTpeSettings();
    const tpeLogs = db.getTpeLogs();
    const isDark = document.documentElement.classList.contains('dark');

    // Calcul des statistiques TPE
    const today = new Date().toISOString().split('T')[0];
    const todayLogs = tpeLogs.filter(l => l.timestamp.startsWith(today) && l.status === 'SUCCESS');
    const totalToday = todayLogs.reduce((sum, l) => sum + l.amount, 0);
    const estimatedFeesToday = totalToday * (tpe.commissionRate / 100);
    const netReceivedToday = totalToday - estimatedFeesToday;

    container.innerHTML = `
      <!-- EN-TÊTE DE LA PAGE TPE -->
      <div class="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div class="flex items-center gap-3.5">
          <div class="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center font-bold shadow-xs">
            ${Icons.creditCard('w-6 h-6')}
          </div>
          <div>
            <div class="flex items-center gap-2.5">
              <h1 class="text-lg font-black text-slate-900 dark:text-white tracking-tight">Gestion du Terminal TPE (SumUp)</h1>
              <span class="px-2.5 py-0.5 rounded-full ${
                tpe.isConnected 
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' 
                  : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
              } text-[11px] font-extrabold uppercase tracking-wide border flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full ${tpe.isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}"></span>
                <span>${tpe.isConnected ? 'Terminal Prêt' : 'Déconnecté'}</span>
              </span>
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              Intégration universelle du lecteur sans-contact pour les foyers de lycéens • Encaissement automatique par carte
            </p>
          </div>
        </div>

        <!-- Badges d'état du boîtier -->
        <div class="flex items-center gap-2">
          <div class="px-3.5 py-2 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-center">
            <div class="text-[10px] font-bold text-slate-400 uppercase flex items-center justify-center gap-1">
              ${Icons.wifi('w-3 h-3 text-emerald-500')}
              <span>Réseau</span>
            </div>
            <div class="text-xs font-black text-slate-800 dark:text-slate-100 mt-0.5">4G & Wi-Fi</div>
          </div>

          <div class="px-3.5 py-2 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-center">
            <div class="text-[10px] font-bold text-slate-400 uppercase flex items-center justify-center gap-1">
              ${Icons.battery('w-3 h-3 text-emerald-500')}
              <span>Batterie</span>
            </div>
            <div class="text-xs font-black text-slate-800 dark:text-slate-100 mt-0.5">${tpe.batteryLevel}%</div>
          </div>

          <div class="px-3.5 py-2 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-center">
            <div class="text-[10px] font-bold text-slate-400 uppercase">Modèle</div>
            <div class="text-xs font-black text-indigo-600 dark:text-indigo-400 mt-0.5">${tpe.readerModel}</div>
          </div>
        </div>
      </div>

      <!-- GRILLE PRINCIPALE (2 COLONNES) -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0">
        
        <!-- COLONNE GAUCHE : REPRÉSENTATION DU BOÎTIER SOLO & BANC DE TEST (5 col) -->
        <div class="lg:col-span-5 flex flex-col gap-4">
          
          <!-- Carte interactive du boîtier SumUp Solo -->
          <div class="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4 flex flex-col items-center">
            
            <div class="w-full flex items-center justify-between">
              <span class="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                ${Icons.radio('w-4 h-4 text-indigo-500')}
                <span>Aperçu Terminal Solo</span>
              </span>
              <span class="text-[10px] font-mono px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
                S/N: ${tpe.serialNumber}
              </span>
            </div>

            <!-- BOÎTIER SUMUP SOLO PHYSIQUE REPRODUIT EN CSS ULTRA-CLEAN -->
            <div class="w-64 h-80 rounded-[36px] bg-[#111827] border-4 border-slate-700/80 shadow-2xl p-4 flex flex-col justify-between relative overflow-hidden transition-all duration-300 ${
              this.testState === 'waiting_card' ? 'ring-4 ring-indigo-500/40' : this.testState === 'approved' ? 'ring-4 ring-emerald-500/50' : ''
            }">
              
              <!-- Barre d'état du boîtier Solo -->
              <div class="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-1 px-1">
                <div class="flex items-center gap-1.5">
                  <span class="w-1.5 h-1.5 rounded-full ${tpe.isConnected ? 'bg-emerald-400' : 'bg-rose-400'}"></span>
                  <span class="text-[9px] font-bold text-slate-300">SumUp Cloud</span>
                </div>
                <div class="flex items-center gap-2">
                  <span>${tpe.batteryLevel}%</span>
                  <span class="w-2.5 h-1.5 rounded-xs border border-slate-400 relative">
                    <span class="absolute inset-0 bg-emerald-400 rounded-2xs" style="width: ${tpe.batteryLevel}%"></span>
                  </span>
                </div>
              </div>

              <!-- ÉCRAN PRINCIPAL DU SOLO (OLED) -->
              <div class="flex-1 flex flex-col items-center justify-center text-center p-3 space-y-2">
                
                ${this.testState === 'idle' ? `
                  <div class="w-10 h-10 rounded-2xl bg-slate-800/80 border border-slate-700/50 flex items-center justify-center text-slate-400">
                    ${Icons.creditCard('w-5 h-5 text-indigo-400')}
                  </div>
                  <div class="text-[11px] font-bold text-slate-300">${tpe.readerName}</div>
                  <div class="text-[10px] text-slate-500 font-mono">En attente de paiement...</div>
                  <div class="text-xs font-black text-slate-600 font-mono mt-1">0,00 €</div>
                ` : this.testState === 'waiting_card' ? `
                  <div class="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center animate-bounce shadow-md shadow-indigo-600/50">
                    ${Icons.radio('w-6 h-6')}
                  </div>
                  <div class="text-xs font-bold text-slate-200">Approchez la carte</div>
                  <div class="text-2xl font-black text-white font-mono tracking-tight">${this.testAmount.toFixed(2)} €</div>
                  <div class="text-[10px] text-indigo-300 font-medium animate-pulse">Sans-contact / Insertion</div>
                ` : this.testState === 'processing' ? `
                  <div class="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center animate-spin">
                    ${Icons.refresh('w-5 h-5')}
                  </div>
                  <div class="text-xs font-bold text-amber-300">Traitement bancaire...</div>
                  <div class="text-lg font-black text-white font-mono">${this.testAmount.toFixed(2)} €</div>
                  <div class="text-[10px] text-slate-400 font-mono">Vérification des fonds</div>
                ` : `
                  <div class="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/40 animate-enter">
                    ${Icons.check('w-7 h-7')}
                  </div>
                  <div class="text-xs font-black text-emerald-400 uppercase tracking-wide">Paiement Approuvé</div>
                  <div class="text-xl font-black text-white font-mono">${this.testAmount.toFixed(2)} €</div>
                  <div class="text-[10px] text-slate-300 font-mono">Ticket #${Date.now().toString().slice(-4)}</div>
                `}

              </div>

              <!-- Bas du boîtier : fente carte & logo sans-contact -->
              <div class="border-t border-slate-800 pt-2 flex items-center justify-between text-[10px] text-slate-500 px-1">
                <span class="font-bold tracking-wider text-slate-400 text-[10px]">sumup solo</span>
                <span class="w-8 h-1 rounded-full bg-slate-700"></span>
              </div>
            </div>

            <!-- BANC DE TEST INTERACTIF DU TERMINAL -->
            <div class="w-full pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-slate-700 dark:text-slate-300">Banc de test en direct :</span>
                <span class="text-[10px] px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold border border-indigo-500/20">
                  Mode Simulation
                </span>
              </div>

              <div class="flex items-center gap-2">
                <div class="relative flex-1">
                  <input 
                    type="number" 
                    id="input-tpe-test-amount" 
                    step="0.50" 
                    min="0.10"
                    value="${this.testAmount.toFixed(2)}"
                    class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                  />
                  <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">€</span>
                </div>

                ${this.testState === 'idle' ? `
                  <button 
                    id="btn-trigger-tpe-test"
                    class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs shadow-xs transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                  >
                    ${Icons.zap('w-3.5 h-3.5')}
                    <span>Envoyer au TPE</span>
                  </button>
                ` : this.testState === 'waiting_card' ? `
                  <button 
                    id="btn-simulate-tap-card"
                    class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-xs transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer animate-pulse"
                  >
                    ${Icons.creditCard('w-3.5 h-3.5')}
                    <span>Badger la carte</span>
                  </button>
                ` : `
                  <button 
                    id="btn-reset-tpe-test"
                    class="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition-all active:scale-95 cursor-pointer"
                  >
                    Réinitialiser
                  </button>
                `}
              </div>
            </div>

          </div>
        </div>

        <!-- COLONNE DROITE : JUMELAGE FACILE & HISTORIQUE DES TRANSACTIONS TPE (7 col) -->
        <div class="lg:col-span-7 flex flex-col gap-4">
          
          <!-- CARTE D'ASSOCIATION 1-CLIC POUR TOUS LES FOYERS DE FRANCE -->
          <div class="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
            
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  ${Icons.settings('w-4 h-4')}
                </span>
                <div>
                  <h2 class="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    Liaison Compte SumUp de la MDL
                  </h2>
                  <p class="text-[11px] text-slate-400">
                    Association 100% autonome et sécurisée pour n'importe quelle Maison des Lycéens
                  </p>
                </div>
              </div>

              <button 
                id="btn-toggle-connect-modal"
                class="px-3.5 py-1.5 rounded-xl ${
                  tpe.isConnected 
                    ? 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300' 
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                } font-bold text-xs transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
              >
                ${tpe.isConnected ? 'Changer de boîtier' : 'Associer mon SumUp'}
              </button>
            </div>

            <!-- Résumé du compte lié -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200/70 dark:border-slate-800 text-xs">
              <div>
                <span class="text-[10px] font-bold text-slate-400 uppercase block">Titulaire Compte</span>
                <span class="font-extrabold text-slate-800 dark:text-slate-100">${tpe.merchantName}</span>
              </div>
              <div>
                <span class="text-[10px] font-bold text-slate-400 uppercase block">Contact MDL</span>
                <span class="font-medium text-slate-600 dark:text-slate-300 font-mono text-[11px]">${tpe.merchantEmail}</span>
              </div>
              <div>
                <span class="text-[10px] font-bold text-slate-400 uppercase block">Commission SumUp</span>
                <span class="font-black text-indigo-600 dark:text-indigo-400">${tpe.commissionRate}% (standard association)</span>
              </div>
            </div>

            <!-- MODAL / FORMULAIRE D'ASSOCIATION FACILE SI ACTIF -->
            ${this.showConnectModal ? `
              <div class="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/50 space-y-3 animate-enter">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-black text-indigo-900 dark:text-indigo-200 uppercase">
                    Connecter votre terminal SumUp Solo
                  </span>
                  <button id="btn-close-modal" class="text-xs font-bold text-slate-400 hover:text-slate-700">✕</button>
                </div>

                <p class="text-xs text-slate-600 dark:text-slate-400">
                  Aucune clé technique n'est requise : renseignez simplement le nom de votre association et l'e-mail de votre compte SumUp.
                </p>

                <form id="form-connect-tpe" class="space-y-2.5">
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label class="block text-[10px] font-bold text-slate-500 uppercase">Nom de l'Association MDL</label>
                      <input 
                        type="text" 
                        id="input-mdl-name" 
                        required 
                        value="${tpe.merchantName}"
                        placeholder="ex: MDL Lycée Pasteur"
                        class="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium"
                      />
                    </div>
                    <div>
                      <label class="block text-[10px] font-bold text-slate-500 uppercase">E-mail du compte SumUp</label>
                      <input 
                        type="email" 
                        id="input-mdl-email" 
                        required 
                        value="${tpe.merchantEmail}"
                        placeholder="tresorier.mdl@gmail.com"
                        class="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium"
                      />
                    </div>
                  </div>

                  <div class="flex items-center gap-2 pt-1">
                    <button 
                      type="submit" 
                      class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                      ${Icons.check('w-4 h-4')}
                      <span>Valider la connexion du terminal</span>
                    </button>

                    <button 
                      type="button" 
                      id="btn-disconnect-tpe"
                      class="px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 font-bold text-xs border border-rose-500/20 cursor-pointer"
                    >
                      Déconnecter le terminal
                    </button>
                  </div>
                </form>
              </div>
            ` : ''}

          </div>

          <!-- HISTORIQUE ET STATISTIQUES DES PAIEMENTS TPE -->
          <div class="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xs flex-1 flex flex-col min-h-0 space-y-4">
            
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                ${Icons.receipt('w-4 h-4 text-indigo-500')}
                <h3 class="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  Transactions TPE Enregistrées (${tpeLogs.length})
                </h3>
              </div>
              <span class="text-xs font-mono font-black text-indigo-600 dark:text-indigo-400">
                Aujourd'hui : ${totalToday.toFixed(2)} € (${todayLogs.length} ventes CB)
              </span>
            </div>

            <!-- Chiffres clés du jour -->
            <div class="grid grid-cols-3 gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200/70 dark:border-slate-800 font-mono text-xs">
              <div>
                <span class="text-[9px] text-slate-400 uppercase font-sans font-bold block">Brut Encaissé</span>
                <span class="font-black text-slate-900 dark:text-white text-sm">${totalToday.toFixed(2)} €</span>
              </div>
              <div>
                <span class="text-[9px] text-slate-400 uppercase font-sans font-bold block">Frais SumUp (${tpe.commissionRate}%)</span>
                <span class="font-bold text-amber-600 dark:text-amber-400">-${estimatedFeesToday.toFixed(2)} €</span>
              </div>
              <div>
                <span class="text-[9px] text-slate-400 uppercase font-sans font-bold block">Net pour la MDL</span>
                <span class="font-black text-emerald-600 dark:text-emerald-400">+${netReceivedToday.toFixed(2)} €</span>
              </div>
            </div>

            <!-- Liste des transactions TPE -->
            <div class="space-y-2 overflow-y-auto flex-1 pr-1">
              ${tpeLogs.length === 0 ? `
                <div class="p-8 text-center text-xs text-slate-400 font-medium">
                  Aucune transaction carte pour l'instant. Utilisez le banc de test ci-contre ou encaissez en caisse.
                </div>
              ` : tpeLogs.map(log => `
                <div class="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/40 flex items-center justify-between text-xs">
                  <div class="flex items-center gap-2.5">
                    <div class="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold flex-shrink-0">
                      ${Icons.check('w-4 h-4')}
                    </div>
                    <div>
                      <div class="flex items-center gap-2">
                        <span class="font-extrabold text-slate-900 dark:text-white">${log.amount.toFixed(2)} €</span>
                        <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-300">${log.cardBrand}</span>
                        <span class="font-mono text-[10px] text-slate-400 font-medium">•••• ${log.last4}</span>
                      </div>
                      <div class="text-[10px] text-slate-400 font-medium mt-0.5">
                        ${new Date(log.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} • Par ${log.volunteerName} • Réf: ${log.transactionCode}
                      </div>
                    </div>
                  </div>

                  <span class="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-extrabold border border-emerald-500/20">
                    Payé
                  </span>
                </div>
              `).join('')}
            </div>

          </div>
        </div>

      </div>
    `;

    this.attachEventListeners(container);
  }

  private attachEventListeners(container: HTMLElement): void {
    // Bouton pour afficher/masquer la modal de connexion
    container.querySelector('#btn-toggle-connect-modal')?.addEventListener('click', () => {
      this.showConnectModal = !this.showConnectModal;
      this.renderContent(container);
    });

    container.querySelector('#btn-close-modal')?.addEventListener('click', () => {
      this.showConnectModal = false;
      this.renderContent(container);
    });

    // Formulaire de connexion TPE
    container.querySelector('#form-connect-tpe')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const nameInput = container.querySelector('#input-mdl-name') as HTMLInputElement;
      const emailInput = container.querySelector('#input-mdl-email') as HTMLInputElement;

      db.connectTpe({
        merchantName: nameInput.value,
        merchantEmail: emailInput.value,
        readerModel: 'SumUp Solo'
      });

      this.showConnectModal = false;
      this.renderContent(container);
      this.onStateChange();
    });

    // Déconnexion TPE
    container.querySelector('#btn-disconnect-tpe')?.addEventListener('click', () => {
      if (confirm('Voulez-vous déconnecter le terminal TPE ?')) {
        db.disconnectTpe();
        this.showConnectModal = false;
        this.renderContent(container);
        this.onStateChange();
      }
    });

    // Saisie montant de test
    const testAmountInput = container.querySelector('#input-tpe-test-amount') as HTMLInputElement;
    testAmountInput?.addEventListener('input', () => {
      const val = parseFloat(testAmountInput.value);
      if (!isNaN(val) && val > 0) {
        this.testAmount = val;
      }
    });

    // Déclencher le test TPE
    container.querySelector('#btn-trigger-tpe-test')?.addEventListener('click', () => {
      this.testState = 'waiting_card';
      this.renderContent(container);
    });

    // Simuler le passage de carte
    container.querySelector('#btn-simulate-tap-card')?.addEventListener('click', () => {
      this.testState = 'processing';
      this.renderContent(container);

      setTimeout(() => {
        this.testState = 'approved';
        db.recordTpePayment({
          amount: this.testAmount,
          cardBrand: 'Apple Pay (Mastercard)',
          last4: '7712',
          status: 'SUCCESS'
        });
        this.renderContent(container);

        setTimeout(() => {
          this.testState = 'idle';
          this.renderContent(container);
        }, 2500);
      }, 1000);
    });

    // Réinitialiser le test
    container.querySelector('#btn-reset-tpe-test')?.addEventListener('click', () => {
      this.testState = 'idle';
      this.renderContent(container);
    });
  }
}
