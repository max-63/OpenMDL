import { db } from '../services/db';
import { Icons } from '../components/Icons';
import { Session, Volunteer } from '../types';
import { AppDialog } from '../components/AppDialog';

export class PlanningView {
  private selectedMonday: Date;
  private activeViewMode: 'calendar' | 'list' = 'calendar';
  private selectedSessionDetail: Session | null = null;
  private onDataChange?: () => void;

  constructor(onDataChange?: () => void) {
    this.onDataChange = onDataChange;
    this.selectedMonday = this.getMondayOfWeek(new Date());
  }

  private getMondayOfWeek(d: Date): Date {
    const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  }

  private isSameDay(d1: Date, d2: Date): boolean {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  }

  private getWeekNumber(d: Date): number {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  private formatDuration(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h}h`;
    return `${h}h${m < 10 ? '0' : ''}${m}`;
  }

  public render(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'w-full h-full flex flex-col gap-3.5 overflow-hidden animate-enter select-none';

    const now = new Date();
    const currentWeekMonday = this.getMondayOfWeek(now);
    const isCurrentWeek = this.isSameDay(this.selectedMonday, currentWeekMonday);

    // Calcul des dates des 6 jours du lycée (Lundi à Samedi)
    const weekDays: { date: Date; name: string; shortName: string; isToday: boolean }[] = [];
    const dayNames = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const shortDayNames = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM'];

    for (let i = 0; i < 6; i++) {
      const d = new Date(this.selectedMonday);
      d.setDate(this.selectedMonday.getDate() + i);
      weekDays.push({
        date: d,
        name: dayNames[i],
        shortName: shortDayNames[i],
        isToday: this.isSameDay(d, now)
      });
    }

    const sundayDate = new Date(this.selectedMonday);
    sundayDate.setDate(this.selectedMonday.getDate() + 6);

    const weekNumber = this.getWeekNumber(this.selectedMonday);
    const allSessions = db.getSessions();
    const volunteers = db.getVolunteers();

    // Récupérer les sessions de la semaine sélectionnée
    const weekStartTime = this.selectedMonday.getTime();
    const weekEndTime = sundayDate.getTime() + (24 * 60 * 60 * 1000) - 1;

    const weekSessions = allSessions.filter(s => {
      const t = new Date(s.startTime).getTime();
      return t >= weekStartTime && t <= weekEndTime;
    });

    // Sessions groupées par index de jour (0 = Lundi, 5 = Samedi)
    const sessionsByDay: { [dayIdx: number]: Session[] } = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [] };

    let totalDurationMinutes = 0;
    let totalWeekSalesCount = 0;
    let totalWeekRevenue = 0;
    const volunteerStatsMap: { [volIdOrName: string]: { name: string; color: string; count: number; minutes: number; revenue: number } } = {};

    weekSessions.forEach(s => {
      const sDate = new Date(s.startTime);
      const dayOfWeek = sDate.getDay();
      const adjustedDayIdx = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // 0 = Lundi, 5 = Samedi, 6 = Dimanche

      if (adjustedDayIdx >= 0 && adjustedDayIdx < 6) {
        sessionsByDay[adjustedDayIdx].push(s);
      }

      // Durée
      const endT = s.endTime ? new Date(s.endTime).getTime() : Date.now();
      const durMin = Math.max(15, (endT - new Date(s.startTime).getTime()) / (1000 * 60));
      totalDurationMinutes += durMin;
      totalWeekSalesCount += s.salesCount || 0;
      totalWeekRevenue += s.totalSales || 0;

      // Stats bénévole
      const vol = volunteers.find(v => v.id === s.volunteerId || v.name === s.volunteerName);
      const key = s.volunteerId || s.volunteerName;
      if (!volunteerStatsMap[key]) {
        volunteerStatsMap[key] = {
          name: s.volunteerName,
          color: vol?.avatarColor || '#ea580c',
          count: 0,
          minutes: 0,
          revenue: 0
        };
      }
      volunteerStatsMap[key].count += 1;
      volunteerStatsMap[key].minutes += durMin;
      volunteerStatsMap[key].revenue += s.totalSales || 0;
    });

    // Trier les sessions de chaque jour chronologiquement
    for (let i = 0; i < 6; i++) {
      sessionsByDay[i].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    }

    const uniqueVolunteersCount = Object.keys(volunteerStatsMap).length;
    const sortedTopVolunteers = Object.values(volunteerStatsMap).sort((a, b) => b.minutes - a.minutes);

    const monthName = this.selectedMonday.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

    container.innerHTML = `
      <!-- En-tête & Barre de Contrôle de la Semaine -->
      <div class="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 flex-shrink-0">
        
        <!-- Titre & Badge Semaine -->
        <div class="flex items-center gap-3.5 min-w-0">
          <div class="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 flex items-center justify-center font-bold flex-shrink-0">
            ${Icons.calendar('w-6 h-6')}
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <h1 class="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight truncate">
                Planning des Permanences du Foyer
              </h1>
              <span class="px-2.5 py-0.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 text-[10px] font-extrabold uppercase tracking-wide border border-orange-500/20 flex-shrink-0">
                Semaine ${weekNumber}
              </span>
              ${isCurrentWeek ? `
                <span class="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-500/20 flex items-center gap-1">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Semaine Actuelle
                </span>
              ` : ''}
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">
              Du ${this.selectedMonday.getDate()} au ${sundayDate.getDate()} ${monthName} • Suivi des heures d'ouverture et présences
            </p>
          </div>
        </div>

        <!-- Commandes de navigation de la semaine & Bascule d'affichage -->
        <div class="flex items-center gap-2 flex-wrap">
          
          <!-- Navigation Précédent / Aujourd'hui / Suivant -->
          <div class="flex items-center p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 shadow-xs">
            <button 
              id="btn-prev-week" 
              class="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-white dark:hover:bg-slate-700 transition-all cursor-pointer" 
              title="Semaine précédente"
            >
              ${Icons.chevronLeft('w-4 h-4')}
            </button>
            <button 
              id="btn-today-week" 
              class="px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                isCurrentWeek 
                  ? 'bg-orange-600 text-white shadow-xs' 
                  : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700'
              }"
            >
              Aujourd'hui
            </button>
            <button 
              id="btn-next-week" 
              class="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-white dark:hover:bg-slate-700 transition-all cursor-pointer" 
              title="Semaine suivante"
            >
              ${Icons.chevronRight('w-4 h-4')}
            </button>
          </div>

          <!-- Bascule Vue Grille / Vue Fiches -->
          <div class="flex items-center p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-xs font-bold">
            <button 
              id="btn-view-calendar" 
              class="px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                this.activeViewMode === 'calendar' 
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-black' 
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }"
            >
              Grille Agenda
            </button>
            <button 
              id="btn-view-list" 
              class="px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                this.activeViewMode === 'list' 
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-black' 
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }"
            >
              Fiches par Jour
            </button>
          </div>

          <!-- Recharger Démo Permanences -->
          <button 
            id="btn-reseed-planning" 
            class="px-3 py-2 rounded-2xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/20 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            title="Régénérer des permanences d'exemple sur 4 semaines"
          >
            ${Icons.rotateCcw('w-3.5 h-3.5')}
            <span class="hidden sm:inline">Recharger Démo</span>
          </button>

        </div>
      </div>

      <!-- Résumé Métriques Clés de la Semaine -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 flex-shrink-0">
        
        <!-- Heures d'ouverture -->
        <div class="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center flex-shrink-0">
            ${Icons.clock('w-5 h-5')}
          </div>
          <div class="min-w-0">
            <div class="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ouverture Foyer</div>
            <div class="text-base font-black text-slate-900 dark:text-white truncate">
              ${this.formatDuration(totalDurationMinutes)}
            </div>
          </div>
        </div>

        <!-- Permanences assurées -->
        <div class="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
            ${Icons.calendar('w-5 h-5')}
          </div>
          <div class="min-w-0">
            <div class="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Permanences</div>
            <div class="text-base font-black text-slate-900 dark:text-white truncate">
              ${weekSessions.length} créneaux
            </div>
          </div>
        </div>

        <!-- Bénévoles mobilisés -->
        <div class="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
            ${Icons.users('w-5 h-5')}
          </div>
          <div class="min-w-0">
            <div class="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Bénévoles Actifs</div>
            <div class="text-base font-black text-slate-900 dark:text-white truncate">
              ${uniqueVolunteersCount} personnes
            </div>
          </div>
        </div>

        <!-- Total Recettes -->
        <div class="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
            ${Icons.banknote('w-5 h-5')}
          </div>
          <div class="min-w-0">
            <div class="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">CA Encaissé</div>
            <div class="text-base font-black text-slate-900 dark:text-white truncate">
              ${totalWeekRevenue.toFixed(2)} €
            </div>
          </div>
        </div>

        <!-- Total Ventes -->
        <div class="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3 col-span-2 sm:col-span-1">
          <div class="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center flex-shrink-0">
            ${Icons.cart('w-5 h-5')}
          </div>
          <div class="min-w-0">
            <div class="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ventes Totales</div>
            <div class="text-base font-black text-slate-900 dark:text-white truncate">
              ${totalWeekSalesCount} achats
            </div>
          </div>
        </div>

      </div>

      <!-- Corps Principal : Vue Grille ou Vue Fiches -->
      <div class="flex-1 min-h-0 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
        
        ${this.activeViewMode === 'calendar' ? this.renderCalendarGrid(weekDays, sessionsByDay, volunteers) : this.renderListView(weekDays, sessionsByDay, volunteers)}

      </div>

      <!-- Modal de Détail d'une Permanence si sélectionnée -->
      ${this.selectedSessionDetail ? this.renderDetailModal(this.selectedSessionDetail, volunteers) : ''}
    `;

    this.attachEventListeners(container);
    return container;
  }

  // --- Rendu de la Grille Agenda (8h à 19h) ---
  private renderCalendarGrid(
    weekDays: { date: Date; name: string; shortName: string; isToday: boolean }[],
    sessionsByDay: { [dayIdx: number]: Session[] },
    volunteers: Volunteer[]
  ): string {
    const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
    const hourHeight = 58; // pixels par heure

    return `
      <!-- En-tête des colonnes Jours -->
      <div class="grid grid-cols-[56px_repeat(6,1fr)] border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 flex-shrink-0">
        
        <!-- Coin Heure vide -->
        <div class="py-3 px-2 border-r border-slate-200 dark:border-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400 uppercase">
          Heures
        </div>

        <!-- 6 Colonnes de Jours -->
        ${weekDays.map((d, dayIdx) => {
          const daySessions = sessionsByDay[dayIdx] || [];
          const dayDuration = daySessions.reduce((acc, s) => {
            const end = s.endTime ? new Date(s.endTime).getTime() : Date.now();
            return acc + Math.max(15, (end - new Date(s.startTime).getTime()) / (1000 * 60));
          }, 0);
          const dayRevenue = daySessions.reduce((acc, s) => acc + (s.totalSales || 0), 0);

          return `
            <div class="py-2.5 px-3 border-r last:border-r-0 border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center ${
              d.isToday ? 'bg-orange-500/5 dark:bg-orange-500/10' : ''
            }">
              <div class="flex items-center gap-1.5">
                <span class="text-xs font-black ${d.isToday ? 'text-orange-600 dark:text-orange-400' : 'text-slate-800 dark:text-slate-200'}">
                  ${d.name}
                </span>
                <span class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                  d.isToday ? 'bg-orange-600 text-white shadow-xs' : 'text-slate-500 dark:text-slate-400'
                }">
                  ${d.date.getDate()}
                </span>
              </div>
              <div class="text-[10px] text-slate-400 font-mono mt-0.5">
                ${daySessions.length > 0 ? `${this.formatDuration(dayDuration)} • ${dayRevenue.toFixed(0)}€` : 'Fermé'}
              </div>
            </div>
          `;
        }).join('')}

      </div>

      <!-- Corps de la Grille Défilable -->
      <div class="flex-1 overflow-y-auto overflow-x-hidden relative">
        <div class="grid grid-cols-[56px_repeat(6,1fr)] relative min-h-[638px]" style="height: ${hours.length * hourHeight}px;">
          
          <!-- Colonne des Heures (Gauche) -->
          <div class="border-r border-slate-200 dark:border-slate-800 select-none bg-slate-50/40 dark:bg-slate-950/20">
            ${hours.map(h => `
              <div class="h-[58px] border-b border-slate-100 dark:border-slate-800/60 pr-2 pt-1 text-right text-[11px] font-mono font-bold text-slate-400">
                ${h < 10 ? '0' : ''}${h}:00
              </div>
            `).join('')}
          </div>

          <!-- 6 Colonnes de Créneaux par Jour -->
          ${weekDays.map((d, dayIdx) => {
            const daySessions = sessionsByDay[dayIdx] || [];

            return `
              <div class="relative border-r last:border-r-0 border-slate-200 dark:border-slate-800 ${
                d.isToday ? 'bg-orange-500/[0.02]' : ''
              }">
                
                <!-- Lignes horizontales des heures en arrière-plan -->
                ${hours.map(() => `
                  <div class="h-[58px] border-b border-slate-100 dark:border-slate-800/40 pointer-events-none"></div>
                `).join('')}

                <!-- Blocs de Permanences positionnés en absolu -->
                ${daySessions.map(session => {
                  const start = new Date(session.startTime);
                  const end = session.endTime ? new Date(session.endTime) : new Date();

                  const startMinutes = (start.getHours() - 8) * 60 + start.getMinutes();
                  const durationMinutes = Math.max(20, (end.getTime() - start.getTime()) / (1000 * 60));

                  const topPx = (startMinutes / 60) * hourHeight;
                  const heightPx = Math.max(46, (durationMinutes / 60) * hourHeight);

                  const isActive = session.status === 'active';
                  const vol = volunteers.find(v => v.id === session.volunteerId || v.name === session.volunteerName);
                  const avatarColor = vol?.avatarColor || '#ea580c';

                  const timeStr = `${start.getHours()}h${start.getMinutes() < 10 ? '0' : ''}${start.getMinutes()} - ${end.getHours()}h${end.getMinutes() < 10 ? '0' : ''}${end.getMinutes()}`;

                  return `
                    <div 
                      data-session-id="${session.id}"
                      style="top: ${topPx}px; height: ${heightPx}px;"
                      class="absolute left-1.5 right-1.5 rounded-2xl p-2.5 transition-all shadow-md cursor-pointer hover:scale-[1.02] hover:z-20 border overflow-hidden flex flex-col justify-between ${
                        isActive 
                          ? 'bg-gradient-to-r from-emerald-600/90 to-emerald-700 text-white border-emerald-400 ring-2 ring-emerald-400 animate-pulse' 
                          : 'bg-slate-800/95 dark:bg-slate-850/95 hover:bg-slate-750 text-white border-slate-700/80 shadow-slate-950/20'
                      }"
                      title="Cliquez pour afficher les détails de la séance de ${session.volunteerName}"
                    >
                      <div>
                        <!-- En-tête de la séance : Nom & Avatar -->
                        <div class="flex items-center gap-1.5 min-w-0">
                          <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background-color: ${avatarColor};"></span>
                          <span class="font-extrabold text-xs truncate leading-tight">
                            ${session.volunteerName.replace(/\s*\(.*?\)/, '')}
                          </span>
                          ${isActive ? `
                            <span class="px-1.5 py-0.2 rounded-md bg-white text-emerald-800 text-[9px] font-black uppercase tracking-wider ml-auto">
                              En cours
                            </span>
                          ` : ''}
                        </div>

                        <!-- Horaires & Durée -->
                        <div class="text-[10px] font-mono text-slate-300 dark:text-slate-300 mt-0.5 truncate">
                          ${timeStr} (${this.formatDuration(durationMinutes)})
                        </div>
                      </div>

                      <!-- Pied de carte : Ventes & Recettes -->
                      <div class="flex items-center justify-between gap-1 text-[10px] font-mono pt-1 border-t border-white/10 mt-1">
                        <span class="text-amber-300 font-bold">${session.salesCount || 0} ventes</span>
                        <span class="font-black text-white">${(session.totalSales || 0).toFixed(2)} €</span>
                      </div>
                    </div>
                  `;
                }).join('')}

              </div>
            `;
          }).join('')}

        </div>
      </div>
    `;
  }

  // --- Rendu alternatif : Vue Liste / Fiches par Jour ---
  private renderListView(
    weekDays: { date: Date; name: string; shortName: string; isToday: boolean }[],
    sessionsByDay: { [dayIdx: number]: Session[] },
    volunteers: Volunteer[]
  ): string {
    return `
      <div class="flex-1 overflow-y-auto p-5 space-y-5">
        ${weekDays.map((d, dayIdx) => {
          const daySessions = sessionsByDay[dayIdx] || [];

          return `
            <div class="rounded-2xl border ${
              d.isToday ? 'border-orange-500/30 bg-orange-500/[0.02]' : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50'
            } p-4 space-y-3">
              
              <!-- Titre du Jour -->
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs ${
                    d.isToday ? 'bg-orange-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }">
                    ${d.date.getDate()}
                  </span>
                  <div>
                    <h3 class="font-black text-sm text-slate-900 dark:text-white">${d.name}</h3>
                    <span class="text-xs text-slate-400">
                      ${d.date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                  </div>
                  ${d.isToday ? `
                    <span class="ml-2 px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 text-[10px] font-bold border border-orange-500/20">
                      Aujourd'hui
                    </span>
                  ` : ''}
                </div>

                <span class="text-xs font-mono font-bold text-slate-500">
                  ${daySessions.length} permanence${daySessions.length > 1 ? 's' : ''}
                </span>
              </div>

              <!-- Liste des séances du jour -->
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                ${daySessions.length === 0 ? `
                  <div class="col-span-full py-4 text-center text-xs text-slate-400 italic">
                    Aucune permanence enregistrée pour cette journée.
                  </div>
                ` : daySessions.map(session => {
                  const start = new Date(session.startTime);
                  const end = session.endTime ? new Date(session.endTime) : new Date();
                  const durMin = Math.max(15, (end.getTime() - start.getTime()) / (1000 * 60));
                  const vol = volunteers.find(v => v.id === session.volunteerId || v.name === session.volunteerName);

                  return `
                    <div 
                      data-session-id="${session.id}"
                      class="p-3.5 rounded-xl border border-slate-200 dark:border-slate-750 bg-white dark:bg-slate-800 hover:border-orange-500 transition-all cursor-pointer shadow-xs space-y-2"
                    >
                      <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                          <div class="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-xs" style="background-color: ${vol?.avatarColor || '#ea580c'}">
                            ${session.volunteerName.charAt(0)}
                          </div>
                          <div>
                            <div class="font-bold text-xs text-slate-900 dark:text-white">${session.volunteerName}</div>
                            <div class="text-[10px] text-slate-400 font-mono">
                              ${start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>

                        <span class="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono text-[10px] font-bold">
                          ${this.formatDuration(durMin)}
                        </span>
                      </div>

                      <div class="flex items-center justify-between text-xs font-mono pt-2 border-t border-slate-100 dark:border-slate-700">
                        <span class="text-slate-500">${session.salesCount || 0} ventes</span>
                        <span class="font-black text-orange-600 dark:text-orange-400">${(session.totalSales || 0).toFixed(2)} €</span>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>

            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // --- Modal de Détail d'une Séance ---
  private renderDetailModal(session: Session, volunteers: Volunteer[]): string {
    const start = new Date(session.startTime);
    const end = session.endTime ? new Date(session.endTime) : new Date();
    const durMin = Math.max(15, (end.getTime() - start.getTime()) / (1000 * 60));
    const isActive = session.status === 'active';
    const vol = volunteers.find(v => v.id === session.volunteerId || v.name === session.volunteerName);

    const avgSale = session.salesCount > 0 ? (session.totalSales / session.salesCount) : 0;

    return `
      <div id="modal-session-detail" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-enter">
        <div class="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden text-slate-900 dark:text-white">
          
          <!-- En-tête Modal -->
          <div class="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/40">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-base shadow-xs" style="background-color: ${vol?.avatarColor || '#ea580c'}">
                ${session.volunteerName.charAt(0)}
              </div>
              <div>
                <h3 class="text-base font-black">${session.volunteerName}</h3>
                <p class="text-xs text-slate-400">
                  ${start.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>

            <button id="btn-close-session-detail" class="p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <!-- Contenu Modal -->
          <div class="p-6 space-y-5">
            
            <!-- Horaires & Statut -->
            <div class="grid grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-center font-mono">
              <div>
                <span class="text-[10px] text-slate-400 uppercase font-bold block">Début</span>
                <span class="text-sm font-black text-slate-900 dark:text-white">
                  ${start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div>
                <span class="text-[10px] text-slate-400 uppercase font-bold block">Fin</span>
                <span class="text-sm font-black text-slate-900 dark:text-white">
                  ${isActive ? 'En cours' : end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div>
                <span class="text-[10px] text-slate-400 uppercase font-bold block">Durée</span>
                <span class="text-sm font-black text-orange-600 dark:text-orange-400">
                  ${this.formatDuration(durMin)}
                </span>
              </div>
            </div>

            <!-- Bilan Financier -->
            <div class="space-y-2.5">
              <span class="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Bilan d'Encaissement</span>
              <div class="grid grid-cols-2 gap-3">
                
                <div class="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400">
                  <span class="text-[11px] font-bold block">Chiffre d'Affaires</span>
                  <span class="text-2xl font-black font-mono">${(session.totalSales || 0).toFixed(2)} €</span>
                  <span class="text-[10px] text-slate-500 font-medium block mt-1">${session.salesCount || 0} ventes réalisées</span>
                </div>

                <div class="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80">
                  <span class="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">Panier Moyen</span>
                  <span class="text-2xl font-black font-mono text-slate-900 dark:text-white">${avgSale.toFixed(2)} €</span>
                  <span class="text-[10px] text-slate-500 font-medium block mt-1">par encaissement</span>
                </div>

              </div>

              <!-- Détail Espèces / CB -->
              <div class="grid grid-cols-2 gap-2 pt-1 font-mono text-xs">
                <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/40 flex justify-between">
                  <span class="text-slate-500 font-sans">Espèces :</span>
                  <span class="font-bold text-emerald-600 dark:text-emerald-400">${(session.totalCash || 0).toFixed(2)} €</span>
                </div>
                <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/40 flex justify-between">
                  <span class="text-slate-500 font-sans">Carte (TPE) :</span>
                  <span class="font-bold text-indigo-600 dark:text-indigo-400">${(session.totalTpe || 0).toFixed(2)} €</span>
                </div>
              </div>
            </div>

            <!-- Décaisse & Fond de Caisse de la Séance -->
            ${session.cashWithdrawal ? `
              <div class="space-y-2">
                <span class="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Fond de Caisse & Décaisse</span>
                <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-2.5">
                  <div class="grid grid-cols-3 gap-2 text-center font-mono">
                    <div class="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-750">
                      <span class="text-[9px] font-sans font-bold text-slate-400 uppercase block">Total Compté</span>
                      <span class="text-xs font-black text-slate-800 dark:text-slate-100">${session.cashWithdrawal.totalCounted.toFixed(2)} €</span>
                    </div>
                    <div class="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                      <span class="text-[9px] font-sans font-bold uppercase block">Décaissé</span>
                      <span class="text-xs font-black">${session.cashWithdrawal.totalWithdrawn.toFixed(2)} €</span>
                    </div>
                    <div class="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-750">
                      <span class="text-[9px] font-sans font-bold text-slate-400 uppercase block">Fond Restant</span>
                      <span class="text-xs font-black text-slate-800 dark:text-slate-100">${session.cashWithdrawal.totalRemainingFloat.toFixed(2)} €</span>
                    </div>
                  </div>

                  <div class="flex items-center justify-between text-xs px-1">
                    <span class="text-slate-500 font-sans">Écart de caisse :</span>
                    <span class="font-mono font-bold ${Math.abs(session.cashWithdrawal.cashDiscrepancy) < 0.005 ? 'text-emerald-600 dark:text-emerald-400' : session.cashWithdrawal.cashDiscrepancy > 0 ? 'text-sky-600 dark:text-sky-400' : 'text-rose-600 dark:text-rose-400'}">
                      ${session.cashWithdrawal.cashDiscrepancy >= 0 ? '+' : ''}${session.cashWithdrawal.cashDiscrepancy.toFixed(2)} €
                    </span>
                  </div>
                </div>
              </div>
            ` : ''}

            <!-- Notes de clôture / incidents -->
            <div class="space-y-1.5">
              <span class="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Rapport de permanence</span>
              <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 italic">
                "${session.incidentNotes || 'Aucun incident particulier. Local rangé et fermé.'}"
              </div>
            </div>

          </div>

          <!-- Pied Modal -->
          <div class="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex justify-end">
            <button id="btn-close-modal-bottom" class="px-5 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition-colors cursor-pointer">
              Fermer
            </button>
          </div>

        </div>
      </div>
    `;
  }

  private attachEventListeners(container: HTMLElement): void {
    // Navigation Semaines
    container.querySelector('#btn-prev-week')?.addEventListener('click', () => {
      this.selectedMonday.setDate(this.selectedMonday.getDate() - 7);
      this.refresh(container);
    });

    container.querySelector('#btn-next-week')?.addEventListener('click', () => {
      this.selectedMonday.setDate(this.selectedMonday.getDate() + 7);
      this.refresh(container);
    });

    container.querySelector('#btn-today-week')?.addEventListener('click', () => {
      this.selectedMonday = this.getMondayOfWeek(new Date());
      this.refresh(container);
    });

    // Bascule de vue
    container.querySelector('#btn-view-calendar')?.addEventListener('click', () => {
      this.activeViewMode = 'calendar';
      this.refresh(container);
    });

    container.querySelector('#btn-view-list')?.addEventListener('click', () => {
      this.activeViewMode = 'list';
      this.refresh(container);
    });

    // Recharger Démo
    container.querySelector('#btn-reseed-planning')?.addEventListener('click', () => {
      AppDialog.confirm({
        title: 'Régénérer les permanences',
        message: 'Voulez-vous régénérer les permanences de démonstration complètes sur les 4 dernières semaines ?',
        type: 'warning',
        confirmText: 'Régénérer',
        cancelText: 'Annuler',
        onConfirm: () => {
          db.seedDemoSessions();
          if (this.onDataChange) this.onDataChange();
          this.refresh(container);
        }
      });
    });

    // Clic sur une séance pour ouvrir la modal de détail
    container.querySelectorAll('[data-session-id]').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-session-id');
        const session = db.getSessions().find(s => s.id === id);
        if (session) {
          this.selectedSessionDetail = session;
          this.refresh(container);
        }
      });
    });

    // Fermeture Modal Détail
    container.querySelector('#btn-close-session-detail')?.addEventListener('click', () => {
      this.selectedSessionDetail = null;
      this.refresh(container);
    });

    container.querySelector('#btn-close-modal-bottom')?.addEventListener('click', () => {
      this.selectedSessionDetail = null;
      this.refresh(container);
    });

    // Clic sur backdrop pour fermer modal
    const modalBackdrop = container.querySelector('#modal-session-detail');
    modalBackdrop?.addEventListener('click', (e) => {
      if (e.target === modalBackdrop) {
        this.selectedSessionDetail = null;
        this.refresh(container);
      }
    });
  }

  private refresh(container: HTMLElement): void {
    const parent = container.parentElement;
    if (parent) {
      const newEl = this.render();
      parent.replaceChild(newEl, container);
    }
  }
}
