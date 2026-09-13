import { db } from '../services/db';
import { Icons } from '../components/Icons';
import { SumUpService, SumUpMerchantProfile } from '../services/sumup';

export class TpeView {
  private onStateChange: () => void;
  private testAmount: number = 1.50;
  private testState: 'idle' | 'waiting_card' | 'processing' | 'approved' = 'idle';
  private showConnectModal: boolean = false;

  // État du Wizard Pas-à-Pas
  private wizardStep: 1 | 2 | 3 = 1;
  private wizardApiKey: string = '';
  private wizardReaderSn: string = '';
  private isTestingApi: boolean = false;
  private testApiResult: { success: boolean; message: string; profile?: SumUpMerchantProfile; reader?: any } | null = null;
  private showPasswordKey: boolean = false;

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

    const currentVolunteer = db.getCurrentVolunteer();
    const isAdmin = currentVolunteer?.isAdmin ?? false;

    // Si l'utilisateur n'est pas délégué / admin, fermer l'assistant de configuration
    if (!isAdmin) {
      this.showConnectModal = false;
    }

    const tpe = db.getTpeSettings();
    const tpeLogs = db.getTpeLogs();

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
              <h1 class="text-lg font-black text-slate-900 dark:text-white tracking-tight">Terminal de Paiement SumUp</h1>
              <span class="px-2.5 py-0.5 rounded-full ${tpe.isConnected && tpe.apiKey
        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
        : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
      } text-[11px] font-extrabold uppercase tracking-wide border flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full ${tpe.isConnected && tpe.apiKey ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}"></span>
                <span>${tpe.isConnected && tpe.apiKey ? 'En Ligne (API SumUp Active)' : 'Configuration Requise'}</span>
              </span>
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              Liaison directe avec votre terminal SumUp Solo pour l'encaissement CB sans contact au foyer
            </p>
          </div>
        </div>

        <!-- Badges d'état du boîtier -->
        <div class="flex items-center gap-2">
          ${!isAdmin ? `
            <div class="px-3 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold text-xs flex items-center gap-1.5 border border-slate-200 dark:border-slate-700" title="Configuration réservée aux délégués CVL et administrateurs">
              ${Icons.shield('w-3.5 h-3.5 text-slate-400')}
              <span>Mode consultation</span>
            </div>
          ` : ''}

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
            <div class="text-[10px] font-bold text-slate-400 uppercase">Protocole</div>
            <div class="text-xs font-black text-indigo-600 dark:text-indigo-400 mt-0.5">HTTPS Cloud</div>
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
                S/N: ${tpe.serialNumber || 'Non renseigné'}
              </span>
            </div>

            <!-- BOÎTIER SUMUP SOLO PHYSIQUE REPRODUIT EN CSS ULTRA-CLEAN -->
            <div class="w-64 h-80 rounded-[36px] bg-[#111827] border-4 border-slate-700/80 shadow-2xl p-4 flex flex-col justify-between relative overflow-hidden transition-all duration-300 ${this.testState === 'waiting_card' ? 'ring-4 ring-indigo-500/40' : this.testState === 'approved' ? 'ring-4 ring-emerald-500/50' : ''
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

              <!-- ÉCRAN DU TERMINAL (CHANGEMENT DYNAMIQUE SELON ÉTAT DU TEST) -->
              <div class="flex-1 flex flex-col items-center justify-center text-center p-2 text-white">
                ${this.testState === 'idle' ? `
                  <div class="w-10 h-10 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center mb-2 shadow-inner">
                    ${Icons.creditCard('w-5 h-5 text-indigo-400')}
                  </div>
                  <div class="text-[11px] font-mono tracking-widest text-slate-400 uppercase">
                    ${tpe.merchantName || 'Foyer des Lycéens'}
                  </div>
                  <div class="text-[9px] text-slate-300 mt-2 px-2.5 py-0.5 rounded-full bg-slate-800/80 border border-slate-700 font-mono flex items-center justify-center gap-1.5 mx-auto w-fit">
                    <span class="w-1.5 h-1.5 rounded-full ${tpe.isConnected && tpe.apiKey ? 'bg-emerald-400' : 'bg-slate-500'}"></span>
                    <span>${tpe.isConnected && tpe.apiKey ? 'Connecté SumUp HTTPS' : 'Hors Ligne'}</span>
                  </div>
                ` : ''}

                ${this.testState === 'waiting_card' ? `
                  <div class="w-12 h-12 rounded-2xl bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 flex items-center justify-center mb-2 animate-bounce">
                    ${Icons.zap('w-6 h-6')}
                  </div>
                  <div class="text-[10px] uppercase font-bold text-indigo-300 tracking-wider">Approchez la carte</div>
                  <div class="text-2xl font-black text-white mt-1 font-mono">${this.testAmount.toFixed(2)} €</div>
                  <div class="text-[9px] text-slate-400 mt-1">Sans-contact ou insertion</div>
                ` : ''}

                ${this.testState === 'processing' ? `
                  <div class="w-10 h-10 border-3 border-indigo-400 border-t-transparent rounded-full animate-spin mb-3"></div>
                  <div class="text-xs font-bold text-indigo-300">Traitement en cours...</div>
                  <div class="text-[10px] text-slate-400 font-mono mt-1">Autorisation bancaire</div>
                ` : ''}

                ${this.testState === 'approved' ? `
                  <div class="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center mb-2 shadow-lg shadow-emerald-500/50 animate-enter">
                    ${Icons.check('w-7 h-7')}
                  </div>
                  <div class="text-sm font-black text-emerald-400">Paiement Accepté !</div>
                  <div class="text-xs font-mono font-bold text-white mt-0.5">${this.testAmount.toFixed(2)} €</div>
                  <div class="text-[9px] text-slate-400 mt-1">Retirez la carte</div>
                ` : ''}
              </div>

              <!-- Zone Capteur NFC et Logo SumUp au bas du boîtier -->
              <div class="pb-1 text-center border-t border-slate-800/60 pt-2 flex items-center justify-center gap-1 text-[11px] font-black tracking-widest text-slate-500 uppercase">
                <span>SumUp Solo</span>
              </div>
            </div>

            <!-- Banc d'essai interactif -->
            <div class="w-full pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
              <div class="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <span>Banc de test en direct</span>
                <span class="text-[11px] text-slate-400 font-normal">Validation du son et flux</span>
              </div>

              <div class="flex items-center gap-2">
                <div class="relative flex-1">
                  <input 
                    type="number" 
                    id="input-tpe-test-amount" 
                    step="0.50" 
                    min="0.50" 
                    value="${this.testAmount.toFixed(2)}"
                    class="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-white"
                  />
                  <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">€</span>
                </div>

                <button 
                  id="btn-trigger-tpe-test"
                  class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
                >
                  Envoyer au TPE
                </button>
              </div>

              ${this.testState === 'waiting_card' ? `
                <div class="pt-1 flex gap-2">
                  <button 
                    id="btn-simulate-tap-card"
                    class="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-600/20 active:scale-98 transition-all animate-pulse cursor-pointer"
                  >
                    ${Icons.zap('w-4 h-4')}
                    <span>Badger la carte (Validation)</span>
                  </button>
                  <button 
                    id="btn-reset-tpe-test"
                    class="px-3 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-700 dark:text-slate-200 font-bold text-xs"
                  >
                    Annuler
                  </button>
                </div>
              ` : ''}
            </div>

          </div>
        </div>

        <!-- COLONNE DROITE : ASSISTANT TPE / LIAISON API & TRANSACTIONS (7 col) -->
        <div class="lg:col-span-7 flex flex-col gap-4">
          
          <!-- CARTE CONFIGURATION & ASSISTANT DE LIAISON -->
          <div class="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
            
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2.5">
                <div class="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  ${Icons.key('w-4 h-4')}
                </div>
                <div>
                  <h2 class="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    Liaison API SumUp Marchand
                  </h2>
                  <p class="text-[11px] text-slate-400">
                    Configuration pas-à-pas pour associer votre compte et réveiller le boîtier Solo via HTTPS
                  </p>
                </div>
              </div>

              ${isAdmin ? `
                <div class="flex items-center gap-2">
                  <button 
                    id="btn-open-wizard"
                    class="px-3.5 py-1.5 rounded-xl ${tpe.isConnected
            ? 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300'
            : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-600/25'
          } font-bold text-xs transition-all cursor-pointer border border-slate-200 dark:border-slate-700 flex items-center gap-1.5"
                  >
                    ${Icons.settings('w-3.5 h-3.5')}
                    <span>${tpe.isConnected ? 'Reconfigurer le TPE' : 'Configurer le TPE (Assistant)'}</span>
                  </button>

                  ${tpe.isConnected ? `
                    <button 
                      id="btn-disconnect-tpe"
                      class="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5"
                      title="Déconnecter le terminal SumUp"
                    >
                      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      <span>Déconnecter</span>
                    </button>
                  ` : ''}
                </div>
              ` : `
                <div class="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 text-slate-400 text-xs font-semibold flex items-center gap-1.5 border border-slate-200 dark:border-slate-700" title="Seuls les délégués CVL et administrateurs peuvent modifier ou déconnecter le TPE">
                  ${Icons.lock('w-3.5 h-3.5 text-slate-400')}
                  <span>Config réservée Délégué CVL</span>
                </div>
              `}
            </div>

            <!-- Résumé du compte lié -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 text-xs">
              <div>
                <span class="text-[10px] font-bold text-slate-400 uppercase block">Compte MDL</span>
                <span class="font-extrabold text-slate-800 dark:text-slate-100 truncate block">
                  ${tpe.merchantName || 'Non configuré'}
                </span>
                ${tpe.merchantCode ? `<span class="text-[10px] font-mono text-indigo-500 font-bold block">ID: ${tpe.merchantCode}</span>` : ''}
              </div>
              <div>
                <span class="text-[10px] font-bold text-slate-400 uppercase block">Passerelle Bancaire</span>
                <div class="flex items-center gap-1.5 mt-0.5">
                  <span class="w-2 h-2 rounded-full ${tpe.isConnected && tpe.apiKey ? 'bg-emerald-500' : 'bg-slate-400'}"></span>
                  <span class="font-bold text-slate-700 dark:text-slate-200">
                    ${tpe.isConnected && tpe.apiKey ? 'API SumUp Connectée' : 'Non configuré'}
                  </span>
                </div>
              </div>
              <div>
                <span class="text-[10px] font-bold text-slate-400 uppercase block">Frais Bancaires</span>
                <span class="font-black text-indigo-600 dark:text-indigo-400">${tpe.commissionRate}% (standard SumUp)</span>
              </div>
            </div>

            <!-- ASSISTANT PAS-À-PAS (WIZARD 3 ÉTAPES) -->
            ${this.showConnectModal ? `
              <div class="p-5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border-2 border-indigo-500/30 space-y-4 animate-enter">
                
                <!-- Stepper d'avancement -->
                <div class="flex items-center justify-between pb-3 border-b border-indigo-200/60 dark:border-indigo-900/60">
                  <div class="flex items-center gap-2">
                    <span class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${this.wizardStep === 1 ? 'bg-indigo-600 text-white' : 'bg-emerald-500 text-white'
        }">
                      ${this.wizardStep > 1 ? '✓' : '1'}
                    </span>
                    <span class="text-xs font-bold ${this.wizardStep === 1 ? 'text-indigo-900 dark:text-indigo-200' : 'text-slate-400'}">
                      1. Boîtier Solo
                    </span>

                    <span class="text-slate-300 dark:text-slate-700">→</span>

                    <span class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${this.wizardStep === 2 ? 'bg-indigo-600 text-white' : this.wizardStep > 2 ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
        }">
                      ${this.wizardStep > 2 ? '✓' : '2'}
                    </span>
                    <span class="text-xs font-bold ${this.wizardStep === 2 ? 'text-indigo-900 dark:text-indigo-200' : 'text-slate-400'}">
                      2. Obtenir la Clé API
                    </span>

                    <span class="text-slate-300 dark:text-slate-700">→</span>

                    <span class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${this.wizardStep === 3 ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
        }">
                      3
                    </span>
                    <span class="text-xs font-bold ${this.wizardStep === 3 ? 'text-indigo-900 dark:text-indigo-200' : 'text-slate-400'}">
                      3. Test & Validation
                    </span>
                  </div>

                  <button id="btn-close-wizard" class="w-6 h-6 rounded-lg text-slate-400 hover:text-slate-700 flex items-center justify-center font-bold">
                    ✕
                  </button>
                </div>

                <!-- CONTENU ÉTAPE 1 : ALLUMER ET PRÉPARER LE SOLO -->
                ${this.wizardStep === 1 ? `
                  <div class="space-y-3">
                    <h3 class="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      Étape 1 : Préparation du lecteur SumUp Solo
                    </h3>
                    <div class="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs space-y-2 text-slate-600 dark:text-slate-300">
                      <div class="flex items-start gap-2">
                        <span class="font-bold text-indigo-600">1.</span>
                        <span>Allumez votre lecteur SumUp Solo en maintenant le bouton d'alimentation sur la tranche droite.</span>
                      </div>
                      <div class="flex items-start gap-2">
                        <span class="font-bold text-indigo-600">2.</span>
                        <span>Vérifiez que le symbole <strong>Wi-Fi</strong> ou <strong>4G</strong> apparaît bien sur l'écran du boîtier (nécessaire pour recevoir les ordres de paiement).</span>
                      </div>
                      <div class="flex items-start gap-2">
                        <span class="font-bold text-indigo-600">3.</span>
                        <span>(Optionnel) Repérez le numéro de série au dos de l'appareil (ex: SOLO-8492).</span>
                      </div>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Numéro de série du boîtier</label>
                        <input 
                          type="text" 
                          id="wizard-sn-input" 
                          value="${this.wizardReaderSn || tpe.serialNumber}" 
                          placeholder="ex: SOLO-8492" 
                          class="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nom du foyer / Association</label>
                        <input 
                          type="text" 
                          id="wizard-name-input" 
                          value="${tpe.merchantName || 'Maison des Lycéens'}" 
                          placeholder="ex: MDL Lycée Pasteur" 
                          class="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium"
                        />
                      </div>
                    </div>

                    <div class="flex justify-end pt-2">
                      <button id="btn-wizard-step1-next" class="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs flex items-center gap-2 shadow-xs cursor-pointer">
                        <span>Suivant : Obtenir la clé API</span>
                        <span>→</span>
                      </button>
                    </div>
                  </div>
                ` : ''}

                <!-- CONTENU ÉTAPE 2 : TUTORIEL POUR TROUVER LA CLÉ API SUR ME.SUMUP.COM -->
                ${this.wizardStep === 2 ? `
                  <div class="space-y-3">
                    <h3 class="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      Étape 2 : Récupérer votre Clé API SumUp Marchand
                    </h3>

                    <p class="text-xs text-slate-600 dark:text-slate-400">
                      Pour connecter la caisse en toute sécurité sans jamais donner votre mot de passe, SumUp met à disposition une clé d'accès sécurisée.
                    </p>

                    <div class="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs space-y-2.5 text-slate-700 dark:text-slate-300">
                      <div class="flex items-start gap-2">
                        <span class="w-5 h-5 rounded-full bg-indigo-500/15 text-indigo-600 font-bold flex items-center justify-center text-[11px] flex-shrink-0">1</span>
                        <span>Connectez-vous sur votre espace SumUp : <strong class="text-indigo-600 dark:text-indigo-400">me.sumup.com/developers</strong></span>
                      </div>
                      <div class="flex items-start gap-2">
                        <span class="w-5 h-5 rounded-full bg-indigo-500/15 text-indigo-600 font-bold flex items-center justify-center text-[11px] flex-shrink-0">2</span>
                        <span>Allez dans la section <strong>« Clés API »</strong> (API Keys).</span>
                      </div>
                      <div class="flex items-start gap-2">
                        <span class="w-5 h-5 rounded-full bg-indigo-500/15 text-indigo-600 font-bold flex items-center justify-center text-[11px] flex-shrink-0">3</span>
                        <span>Cliquez sur <strong>« Créer une clé d'accès »</strong>, nommez-la <em>OpenMDL Caisse</em> et cochez les droits de Paiement.</span>
                      </div>
                      <div class="flex items-start gap-2">
                        <span class="w-5 h-5 rounded-full bg-indigo-500/15 text-indigo-600 font-bold flex items-center justify-center text-[11px] flex-shrink-0">4</span>
                        <span>Copiez la clé secrète affichée (elle commence par <code class="bg-slate-100 dark:bg-slate-800 px-1 rounded font-bold text-indigo-600">sup_sk_...</code>).</span>
                      </div>
                    </div>

                    <div class="flex items-center justify-between pt-2">
                      <button id="btn-wizard-step2-prev" class="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-700 dark:text-slate-300 font-bold text-xs">
                        ← Précédent
                      </button>

                      <button id="btn-wizard-step2-next" class="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs flex items-center gap-2 shadow-xs cursor-pointer">
                        <span>J'ai ma clé : Passer au test</span>
                        <span>→</span>
                      </button>
                    </div>
                  </div>
                ` : ''}

                <!-- CONTENU ÉTAPE 3 : COLLER LA CLÉ, TESTER EN DIRECT & CHOIX DU MODE -->
                ${this.wizardStep === 3 ? `
                  <div class="space-y-3">
                    <h3 class="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      Étape 3 : Saisie de la Clé API & Test HTTPS en direct
                    </h3>

                    <div class="space-y-1.5">
                      <label class="block text-[10px] font-bold text-slate-500 uppercase">Clé API Marchand SumUp</label>
                      <div class="relative">
                        <input 
                          type="${this.showPasswordKey ? 'text' : 'password'}" 
                          id="wizard-api-key-input" 
                          value="${this.wizardApiKey || tpe.apiKey || ''}" 
                          placeholder="Collez ici votre clé : sup_sk_..." 
                          class="w-full pl-3 pr-20 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold focus:ring-2 focus:ring-indigo-500/30"
                        />
                        <div class="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                          <button 
                            type="button" 
                            id="btn-toggle-wizard-key" 
                            class="px-2 py-1 text-[10px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                          >
                            ${this.showPasswordKey ? 'Masquer' : 'Afficher'}
                          </button>
                        </div>
                      </div>
                    </div>

                    <!-- Bouton tester la connexion -->
                    <div class="flex items-center gap-2">
                      <button 
                        type="button" 
                        id="btn-test-sumup-api" 
                        class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs flex items-center gap-2 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                        ${this.isTestingApi ? 'disabled' : ''}
                      >
                        ${this.isTestingApi ? `
                          <span class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                          <span>Test en cours auprès de api.sumup.com...</span>
                        ` : `
                          ${Icons.zap('w-3.5 h-3.5')}
                          <span>Tester la connexion HTTPS</span>
                        `}
                      </button>
                    </div>

                    <!-- Résultat du test -->
                    ${this.testApiResult ? `
                      <div class="p-3.5 rounded-xl border text-xs space-y-1 ${this.testApiResult.success
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200'
            }">
                        <div class="font-extrabold flex items-center gap-2">
                          ${this.testApiResult.success ? Icons.checkCircle('w-4 h-4 text-emerald-600 dark:text-emerald-400') : Icons.xCircle('w-4 h-4 text-rose-600 dark:text-rose-400')}
                          <span>${this.testApiResult.message}</span>
                        </div>
                        ${this.testApiResult.profile ? `
                          <div class="text-[11px] font-mono opacity-90 pl-6 space-y-0.5">
                            <div>• Titulaire Marchand : <strong>${this.testApiResult.profile.name}</strong></div>
                            <div>• Code Marchand : <strong>${this.testApiResult.profile.merchantCode}</strong> (${this.testApiResult.profile.currency})</div>
                          </div>
                        ` : ''}
                      </div>
                    ` : ''}

                    <!-- Information Mode Réel Direct -->
                    <div class="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-xs space-y-1">
                      <div class="font-extrabold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                        ${Icons.lock('w-4 h-4 text-indigo-600 dark:text-indigo-400')}
                        <span>Passerelle Directe SumUp HTTPS Active</span>
                      </div>
                      <p class="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                        Les montants saisis en caisse seront directement transmis au lecteur SumUp Solo via Internet. L'état en temps réel (accepté ou refusé) s'affichera instantanément sur votre écran.
                      </p>
                    </div>

                    <!-- Boutons de validation finale -->
                    <div class="flex items-center justify-between pt-3 border-t border-indigo-200/60 dark:border-indigo-900/60">
                      <button id="btn-wizard-step3-prev" class="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-700 dark:text-slate-300 font-bold text-xs">
                        ← Précédent
                      </button>

                      <button id="btn-wizard-finish" class="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-2 shadow-xs cursor-pointer">
                        ${Icons.check('w-4 h-4')}
                        <span>Enregistrer et Activer le TPE</span>
                      </button>
                    </div>

                  </div>
                ` : ''}

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
    const currentVolunteer = db.getCurrentVolunteer();
    const isAdmin = currentVolunteer?.isAdmin ?? false;

    // Déconnexion TPE (Réservé Délégué CVL / Admin)
    container.querySelector('#btn-disconnect-tpe')?.addEventListener('click', () => {
      if (!isAdmin) return;
      if (confirm('Êtes-vous sûr de vouloir déconnecter le terminal SumUp ? Les paiements par carte au foyer seront suspendus.')) {
        db.disconnectTpe();
        this.showConnectModal = false;
        this.renderContent(container);
        this.onStateChange();
      }
    });

    // Bouton pour afficher/masquer le Wizard de configuration (Réservé Délégué CVL / Admin)
    container.querySelector('#btn-open-wizard')?.addEventListener('click', () => {
      if (!isAdmin) return;
      this.showConnectModal = !this.showConnectModal;
      this.wizardStep = 1;
      this.testApiResult = null;
      this.renderContent(container);
    });

    container.querySelector('#btn-close-wizard')?.addEventListener('click', () => {
      this.showConnectModal = false;
      this.renderContent(container);
    });

    // Navigation Wizard Étape 1
    container.querySelector('#btn-wizard-step1-next')?.addEventListener('click', () => {
      const snInput = container.querySelector('#wizard-sn-input') as HTMLInputElement;
      if (snInput) this.wizardReaderSn = snInput.value.trim();
      this.wizardStep = 2;
      this.renderContent(container);
    });

    // Navigation Wizard Étape 2
    container.querySelector('#btn-wizard-step2-prev')?.addEventListener('click', () => {
      this.wizardStep = 1;
      this.renderContent(container);
    });

    container.querySelector('#btn-wizard-step2-next')?.addEventListener('click', () => {
      this.wizardStep = 3;
      this.renderContent(container);
    });

    // Navigation Wizard Étape 3
    container.querySelector('#btn-wizard-step3-prev')?.addEventListener('click', () => {
      this.wizardStep = 2;
      this.renderContent(container);
    });

    // Toggle affichage clé secrète
    container.querySelector('#btn-toggle-wizard-key')?.addEventListener('click', () => {
      this.showPasswordKey = !this.showPasswordKey;
      const keyInput = container.querySelector('#wizard-api-key-input') as HTMLInputElement;
      if (keyInput) keyInput.type = this.showPasswordKey ? 'text' : 'password';
      const btn = container.querySelector('#btn-toggle-wizard-key');
      if (btn) btn.textContent = this.showPasswordKey ? 'Masquer' : 'Afficher';
    });

    // Tester la clé API SumUp en direct (HTTPS)
    container.querySelector('#btn-test-sumup-api')?.addEventListener('click', async () => {
      const keyInput = container.querySelector('#wizard-api-key-input') as HTMLInputElement;
      const key = keyInput ? keyInput.value.trim() : this.wizardApiKey;
      this.wizardApiKey = key;

      if (!key) {
        this.testApiResult = { success: false, message: 'Veuillez saisir votre clé API avant de tester.' };
        this.renderContent(container);
        return;
      }

      this.isTestingApi = true;
      this.renderContent(container);

      const res = await SumUpService.testApiKey(key);
      this.isTestingApi = false;
      this.testApiResult = res;

      this.renderContent(container);
    });

    // Enregistrer et terminer le wizard (Réservé Délégué CVL / Admin)
    container.querySelector('#btn-wizard-finish')?.addEventListener('click', () => {
      if (!isAdmin) return;
      const keyInput = container.querySelector('#wizard-api-key-input') as HTMLInputElement;
      const key = keyInput ? keyInput.value.trim() : this.wizardApiKey;

      const profile = this.testApiResult?.profile;
      const reader = this.testApiResult?.reader;

      db.connectTpe({
        merchantName: profile?.name || 'Maison des Lycéens',
        merchantEmail: profile?.email || '',
        merchantCode: profile?.merchantCode || '',
        apiKey: key,
        readerId: reader?.id,
        serialNumber: this.wizardReaderSn || reader?.serialNumber || 'SOLO-MDL-8492',
        readerModel: 'SumUp Solo'
      });

      this.showConnectModal = false;
      this.renderContent(container);
      this.onStateChange();
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
