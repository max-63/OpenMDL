export class MascotWidgetComponent {
  private static quotes: Record<string, string[]> = {
    dashboard: [
      "Prêt pour le coup de feu de la récré ! Utilise les boutons + et - pour encaisser en 2 secondes.",
      "Pense à bien vérifier si le lycéen paie par TPE ou en espèces !",
      "La caisse tourne à 60 FPS, zéro ralentissement même s'il y a 30 élèves au comptoir !"
    ],
    catalog: [
      "Un œil sur les marges ! Plus la marge est propre, plus la MDL peut financer des projets lycéens.",
      "Besoin d'ajouter une nouvelle friandise ? Clique sur 'Nouveau Produit' en haut à droite."
    ],
    restock: [
      "Un carton de 24 ou 48 ? Clique directement sur les boutons de pack pour aller vite !",
      "Zéro rupture à la récré : c'est la règle d'or du foyer."
    ],
    stats: [
      "Regarde la vitesse d'écoulement pour commander pile la bonne quantité la prochaine fois !",
      "Tu peux exporter toutes les ventes en CSV pour le trésorier de la MDL d'un simple clic."
    ]
  };

  public static render(currentTab: string): HTMLElement {
    const container = document.createElement('div');
    container.id = 'mascot-widget';
    container.className = 'fixed bottom-4 right-4 z-40 flex items-end gap-3 select-none pointer-events-auto transition-transform duration-300';

    const tabQuotes = this.quotes[currentTab] || this.quotes.dashboard;
    const initialQuote = tabQuotes[Math.floor(Math.random() * tabQuotes.length)];

    container.innerHTML = `
      <!-- Bulle de dialogue interactive -->
      <div id="mascot-speech" class="max-w-[220px] p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl text-xs text-slate-700 dark:text-slate-300 leading-snug relative animate-fade-in">
        <p id="mascot-text" class="font-medium">${initialQuote}</p>
        <div class="absolute -bottom-1.5 right-6 w-3 h-3 bg-white dark:bg-slate-900 border-r border-b border-slate-200 dark:border-slate-800 rotate-45"></div>
      </div>

      <!-- Avatar Mascotte Clignotant/Animé -->
      <div id="mascot-avatar" class="group relative cursor-pointer active:scale-95 transition-transform" title="Clique sur Canetto pour un conseil !">
        <div class="w-14 h-14 rounded-2xl overflow-hidden shadow-xl shadow-blue-500/25 border-2 border-blue-500 bg-slate-900 flex items-center justify-center group-hover:rotate-6 transition-all duration-200">
          <img 
            src="/assets/mascotte.jpg" 
            alt="Canetto Mascotte" 
            class="w-full h-full object-cover" 
            onerror="this.src='/assets/logo_canette.jpg'"
          />
        </div>
        <span class="absolute -top-1 -right-1 flex h-3 w-3">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
        </span>
      </div>
    `;

    // Événement clic pour changer de phrase et faire un petit saut
    container.querySelector('#mascot-avatar')?.addEventListener('click', () => {
      const speech = container.querySelector('#mascot-text');
      const avatar = container.querySelector('#mascot-avatar');

      if (avatar) {
        avatar.classList.add('-translate-y-2');
        setTimeout(() => avatar.classList.remove('-translate-y-2'), 200);
      }

      if (speech) {
        const nextQuote = tabQuotes[Math.floor(Math.random() * tabQuotes.length)];
        speech.textContent = nextQuote;
      }
    });

    return container;
  }
}
