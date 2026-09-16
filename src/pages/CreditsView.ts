import { Icons } from '../components/Icons';

export class CreditsView {
  public render(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'w-full h-full flex flex-col gap-6 overflow-y-auto pr-1 select-none animate-enter';

    container.innerHTML = `
      <!-- En-tête des Crédits -->
      <div class="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 flex items-center justify-center font-bold">
            ${Icons.sparkles('w-6 h-6')}
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h1 class="text-lg font-black text-slate-900 dark:text-white tracking-tight">Crédits & Mentions Légales</h1>
              <span class="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-extrabold uppercase border border-emerald-500/20">
                Officiel
              </span>
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Conception, développement et contributions officielles au projet OpenMDL.
            </p>
          </div>
        </div>

        <div class="px-3.5 py-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-600 dark:text-slate-300 self-start sm:self-auto">
          v1.0.5 • 2026
        </div>
      </div>

      <!-- Grille des Contributeurs Principaux -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        <!-- Carte Développeur Principal -->
        <div class="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xs flex flex-col justify-between gap-5 relative overflow-hidden group">
          <div class="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-orange-500/5 blur-xl pointer-events-none"></div>

          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                Créateur & Développeur Principal
              </span>
            </div>

            <div>
              <h2 class="text-xl font-black text-slate-900 dark:text-white tracking-tight">Adrien Courault</h2>
              <p class="text-xs text-slate-500 dark:text-slate-400 font-medium pt-1 leading-relaxed">
                Architecte logiciel, conception de l'ensemble du cœur applicatif OpenMDL, de l'interface POS, du moteur d'addons et de l'infrastructure de distribution multiplateforme.
              </p>
            </div>
          </div>

          <div class="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
            <span class="text-xs font-bold text-slate-400">Portfolio officiel :</span>
            <a 
              href="https://max-63.github.io" 
              target="_blank" 
              rel="noopener noreferrer"
              class="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-orange-500/10 text-slate-800 hover:text-orange-600 dark:bg-slate-800 dark:hover:bg-orange-500/20 dark:text-slate-200 dark:hover:text-orange-400 text-xs font-bold transition-all border border-slate-200 dark:border-slate-700"
            >
              <span>max-63.github.io</span>
              ${Icons.externalLink('w-3.5 h-3.5')}
            </a>
          </div>
        </div>

        <!-- Carte Bêta-Testeur Officiel -->
        <div class="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xs flex flex-col justify-between gap-5 relative overflow-hidden group">
          <div class="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-sky-500/5 blur-xl pointer-events-none"></div>

          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                Bêta-Testeur Officiel
              </span>
            </div>

            <div>
              <h2 class="text-xl font-black text-slate-900 dark:text-white tracking-tight">Baly Jérémy</h2>
              <p class="text-xs text-slate-500 dark:text-slate-400 font-medium pt-1 leading-relaxed">
                Validation continue en conditions réelles de foyer, retour d'expérience utilisateur sur les flux de caisse, tests de robustesse et vérification des scénarios de permanences bénévoles.
              </p>
            </div>
          </div>

          <div class="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
            <span class="text-xs font-bold text-slate-400">Rôle & Mission :</span>
            <span class="px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300">
              Assurance Qualité & Terrain
            </span>
          </div>
        </div>

      </div>

      <!-- Section Mentions Légales & Sanctuarisation -->
      <div class="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
        <div class="flex items-center gap-2.5 text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
          ${Icons.shieldCheck('w-4 h-4 text-orange-500')}
          <span>Protection Légale & Licence Open Source</span>
        </div>

        <div class="space-y-3 text-xs text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
          <p>
            <strong>OpenMDL</strong> est un logiciel libre et open source spécialement créé pour les Maisons des Lycéens (MDL) et les Conseils de la Vie Lycéenne (CVL). Il vise à faciliter la gestion bénévole des foyers scolaires et à garantir une traçabilité financière irréprochable.
          </p>

          <p>
            <strong>Clause de Sanctuarisation Inaltérable :</strong> La présente page de crédits, l'identité visuelle de marque et les mentions de paternité d'Adrien Courault et Baly Jérémy sont protégées au niveau du cœur applicatif. Aucun addon ou extension externe ne dispose de l'autorisation logicielle ou légale d'occulter, de masquer ou de falsifier ces mentions.
          </p>

          <p>
            <strong>Interdiction de Monétisation des Addons :</strong> Tous les addons développés pour OpenMDL doivent demeurer 100% gratuits, libres et ouverts. Toute commercialisation, revente ou système payant d'extension est formellement prohibé.
          </p>
        </div>

        <div class="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px] text-slate-400">
          <span>Tous droits réservés • OpenMDL Community • Projet Associatif Lycéen</span>
          <span class="font-mono">Licence MIT • Usage Libre Non-Commercial</span>
        </div>
      </div>
    `;

    return container;
  }
}
