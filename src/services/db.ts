import { Product, Sale, Session, Volunteer, RestockLog, VolunteerPerk, ProductStockHistoryPoint, ProductStockEvolution, TpeSettings, TpePaymentLog, SnakeScore, PacmanScore } from '../types';

const STORAGE_KEYS = {
  PRODUCTS: 'openmdl_products',
  SALES: 'openmdl_sales',
  SESSIONS: 'openmdl_sessions',
  ACTIVE_SESSION: 'openmdl_active_session',
  VOLUNTEERS: 'openmdl_volunteers',
  RESTOCKS: 'openmdl_restocks',
  LOGS: 'openmdl_activity_logs',
  THEME: 'openmdl_theme',
  PERKS: 'openmdl_volunteer_perks',
  TPE_SETTINGS: 'openmdl_tpe_settings',
  TPE_LOGS: 'openmdl_tpe_logs',
  SNAKE_SCORES: 'openmdl_snake_scores',
  PACMAN_SCORES: 'openmdl_pacman_scores'
};

export interface ActivityLog {
  id: string;
  timestamp: string;
  type: 'INFO' | 'SALE' | 'RESTOCK' | 'SESSION' | 'BACKUP' | 'WARNING' | 'SECURITY';
  message: string;
  author: string;
}

// Catalogue vierge par défaut (prêt pour la production et release)
const INITIAL_PRODUCTS: Product[] = [];

// Données d'exemples utilisées uniquement lors de l'activation du Mode Démo (Screenshots)
const DEMO_PRODUCTS: Product[] = [
  {
    id: 'prod-1',
    name: 'Kinder Bueno',
    category: 'snacks',
    price: 1.20,
    costPrice: 0.70,
    stock: 24,
    minStockAlert: 8,
    imageUrl: 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?auto=format&fit=crop&w=400&q=80',
    isActive: true
  },
  {
    id: 'prod-2',
    name: 'Coca-Cola 33cl',
    category: 'boissons',
    price: 1.00,
    costPrice: 0.50,
    stock: 36,
    minStockAlert: 12,
    imageUrl: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=400&q=80',
    isActive: true
  },
  {
    id: 'prod-3',
    name: 'Oasis Tropical 33cl',
    category: 'boissons',
    price: 1.00,
    costPrice: 0.48,
    stock: 18,
    minStockAlert: 10,
    imageUrl: 'https://images.unsplash.com/photo-1621263764928-df1444c5e859?auto=format&fit=crop&w=400&q=80',
    isActive: true
  },
  {
    id: 'prod-4',
    name: 'Fuze Tea Pêche 33cl',
    category: 'boissons',
    price: 1.00,
    costPrice: 0.49,
    stock: 6,
    minStockAlert: 10,
    imageUrl: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=400&q=80',
    isActive: true
  },
  {
    id: 'prod-5',
    name: 'KitKat 4 barres',
    category: 'snacks',
    price: 1.00,
    costPrice: 0.55,
    stock: 15,
    minStockAlert: 6,
    imageUrl: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=400&q=80',
    isActive: true
  },
  {
    id: 'prod-6',
    name: 'M&M\'s Peanut 45g',
    category: 'bonbons',
    price: 1.20,
    costPrice: 0.65,
    stock: 20,
    minStockAlert: 8,
    imageUrl: 'https://images.unsplash.com/photo-1582293041079-7814c2f12063?auto=format&fit=crop&w=400&q=80',
    isActive: true
  },
  {
    id: 'prod-7',
    name: 'Haribo Dragibus 40g',
    category: 'bonbons',
    price: 0.80,
    costPrice: 0.40,
    stock: 30,
    minStockAlert: 10,
    imageUrl: 'https://images.unsplash.com/photo-1582058091505-f87a2e55a40f?auto=format&fit=crop&w=400&q=80',
    isActive: true
  },
  {
    id: 'prod-8',
    name: 'Capri-Sun Multivitamin',
    category: 'boissons',
    price: 0.80,
    costPrice: 0.35,
    stock: 4,
    minStockAlert: 12,
    imageUrl: 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?auto=format&fit=crop&w=400&q=80',
    isActive: true
  },
  {
    id: 'prod-9',
    name: 'Café Expresso',
    category: 'chaud',
    price: 0.50,
    costPrice: 0.15,
    stock: 100,
    minStockAlert: 20,
    imageUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=400&q=80',
    isActive: true
  },
  {
    id: 'prod-10',
    name: 'Chocolat Chaud',
    category: 'chaud',
    price: 0.80,
    costPrice: 0.25,
    stock: 50,
    minStockAlert: 15,
    imageUrl: 'https://images.unsplash.com/photo-1542990253-0d0f5be5f0ed?auto=format&fit=crop&w=400&q=80',
    isActive: true
  }
];

// Compte Administrateur unique pour application 100% vierge
const INITIAL_VOLUNTEERS: Volunteer[] = [
  {
    id: 'vol-admin',
    username: 'admin',
    password: 'admin',
    name: 'Administrateur',
    role: 'Bureau MDL / CVL',
    avatarColor: '#ea580c',
    isAdmin: true,
    isSuspended: false,
    createdAt: new Date().toISOString()
  }
];

// Utilisateurs d'exemple pour le mode démonstration et captures d'écran
const DEMO_VOLUNTEERS: Volunteer[] = [
  {
    id: 'vol-admin',
    username: 'admin',
    password: 'admin',
    name: 'Adrien (Responsable MDL)',
    role: 'Délégué élu CVL / Bureau MDL',
    avatarColor: '#ea580c',
    isAdmin: true,
    isSuspended: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'vol-2',
    username: 'sarah',
    password: 'password123',
    name: 'Sarah L. (Trésorière)',
    role: 'Bureau MDL',
    avatarColor: '#8b5cf6',
    isAdmin: true,
    isSuspended: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'vol-3',
    username: 'thomas',
    password: 'password123',
    name: 'Thomas M. (Bénévole)',
    role: 'Permanence Foyer',
    avatarColor: '#10b981',
    isAdmin: false,
    isSuspended: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'vol-4',
    username: 'lucas',
    password: 'password123',
    name: 'Lucas D. (Bénévole)',
    role: 'Permanence Foyer',
    avatarColor: '#06b6d4',
    isAdmin: false,
    isSuspended: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'vol-5',
    username: 'emma',
    password: 'password123',
    name: 'Emma R. (Secrétaire)',
    role: 'Bureau MDL',
    avatarColor: '#ec4899',
    isAdmin: true,
    isSuspended: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'vol-6',
    username: 'hugo',
    password: 'password123',
    name: 'Hugo B. (Bénévole)',
    role: 'Permanence Foyer',
    avatarColor: '#f59e0b',
    isAdmin: false,
    isSuspended: false,
    createdAt: new Date().toISOString()
  }
];

const DEFAULT_TPE_SETTINGS: TpeSettings = {
  isConnected: false,
  readerModel: 'SumUp Solo',
  readerName: 'SumUp Solo (Foyer MDL)',
  serialNumber: 'SOLO-MDL-8492',
  batteryLevel: 95,
  merchantName: 'Maison des Lycéens (MDL)',
  merchantEmail: '',
  apiKey: '',
  merchantCode: '',
  readerId: '',
  commissionRate: 1.75,
  soundEnabled: true,
  autoValidate: true
};

class DatabaseService {
  private products: Product[] = [];
  private sales: Sale[] = [];
  private sessions: Session[] = [];
  private volunteers: Volunteer[] = [];
  private restocks: RestockLog[] = [];
  private logs: ActivityLog[] = [];
  private volunteerPerks: VolunteerPerk[] = [];
  private tpeSettings: TpeSettings = DEFAULT_TPE_SETTINGS;
  private tpeLogs: TpePaymentLog[] = [];
  private snakeScores: SnakeScore[] = [];
  private activeSession: Session | null = null;
  private currentVolunteer: Volunteer | null = null;
  private listeners: Set<() => void> = new Set();
  private loginAttempts: Map<string, { count: number; lockedUntil?: number }> = new Map();

  constructor() {
    this.loadAll();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach(fn => fn());
  }

  private loadAll(): void {
    try {
      const storedProds = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
      this.products = storedProds ? JSON.parse(storedProds) : INITIAL_PRODUCTS;

      const storedSales = localStorage.getItem(STORAGE_KEYS.SALES);
      this.sales = storedSales ? JSON.parse(storedSales) : [];

      const storedSessions = localStorage.getItem(STORAGE_KEYS.SESSIONS);
      this.sessions = storedSessions ? JSON.parse(storedSessions) : [];
      if (this.sessions.length < 5) {
        this.seedDemoSessions();
      }

      const storedVolunteers = localStorage.getItem(STORAGE_KEYS.VOLUNTEERS);
      let parsedVolunteers: Volunteer[] = storedVolunteers ? JSON.parse(storedVolunteers) : INITIAL_VOLUNTEERS;

      // Migration & normalisation automatique des utilisateurs :
      // Garantir impérativement la présence du compte administrateur initial 'admin' / 'admin'
      const adminExists = parsedVolunteers.some(v => v.username === 'admin');
      if (!adminExists) {
        parsedVolunteers.unshift({
          id: 'vol-admin',
          username: 'admin',
          password: 'admin',
          name: 'Délégué CVL (Admin)',
          role: 'Délégué élu CVL / Bureau MDL',
          avatarColor: '#ea580c',
          isAdmin: true,
          isSuspended: false,
          createdAt: new Date().toISOString()
        });
      }

      parsedVolunteers = parsedVolunteers.map(v => ({
        ...v,
        username: v.username || (v.id === 'vol-1' ? 'admin' : v.name.toLowerCase().replace(/[^a-z0-9]/g, '')),
        password: v.password || (v.username === 'admin' ? 'admin' : 'password123'),
        isAdmin: v.isAdmin ?? (v.username === 'admin' || v.role.includes('Bureau') || v.role.includes('CVL')),
        isSuspended: v.isSuspended ?? false,
        createdAt: v.createdAt || new Date().toISOString()
      }));

      this.volunteers = parsedVolunteers;

      const storedRestocks = localStorage.getItem(STORAGE_KEYS.RESTOCKS);
      this.restocks = storedRestocks ? JSON.parse(storedRestocks) : [];

      const storedLogs = localStorage.getItem(STORAGE_KEYS.LOGS);
      this.logs = storedLogs ? JSON.parse(storedLogs) : [];

      const storedPerks = localStorage.getItem(STORAGE_KEYS.PERKS);
      this.volunteerPerks = storedPerks ? JSON.parse(storedPerks) : [];

      const storedTpe = localStorage.getItem(STORAGE_KEYS.TPE_SETTINGS);
      this.tpeSettings = storedTpe ? JSON.parse(storedTpe) : DEFAULT_TPE_SETTINGS;

      const storedTpeLogs = localStorage.getItem(STORAGE_KEYS.TPE_LOGS);
      this.tpeLogs = storedTpeLogs ? JSON.parse(storedTpeLogs) : [];

      localStorage.removeItem(STORAGE_KEYS.SNAKE_SCORES);
      const storedPacman = localStorage.getItem(STORAGE_KEYS.PACMAN_SCORES);
      if (storedPacman) {
        try {
          const parsed = JSON.parse(storedPacman);
          // Éliminer tous les faux scores de démonstration inventés
          const fakeNames = ['jérémy', 'jeremy', 'thomas m.', 'thomas'];
          this.snakeScores = Array.isArray(parsed)
            ? parsed.filter((s: any) => 
                s && typeof s === 'object' && 
                s.playerName &&
                !fakeNames.includes(String(s.playerName).toLowerCase().trim()) &&
                !['s1', 's2', 's3'].includes(s.id) &&
                !(s.score === 140 && String(s.playerName).includes('Jér')) &&
                !(s.score === 90 && String(s.playerName).includes('Thom')) &&
                !(s.score === 80 && String(s.playerName).includes('Adri'))
              )
            : [];
        } catch {
          this.snakeScores = [];
        }
      } else {
        this.snakeScores = [];
      }
      this.saveSnakeScores();

      const storedActive = localStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION);
      if (storedActive) {
        this.activeSession = JSON.parse(storedActive);
        if (this.activeSession) {
          this.currentVolunteer = this.volunteers.find(v => v.id === this.activeSession?.volunteerId) || null;
        }
      }

      this.saveProducts();
      this.saveVolunteers();
    } catch (e) {
      console.error('Erreur chargement base de données locale:', e);
      this.products = INITIAL_PRODUCTS;
      this.volunteers = INITIAL_VOLUNTEERS;
    }
  }

  private saveProducts(): void {
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(this.products));
  }

  private saveSales(): void {
    localStorage.setItem(STORAGE_KEYS.SALES, JSON.stringify(this.sales));
  }

  private saveSessions(): void {
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(this.sessions));
  }

  private saveVolunteers(): void {
    localStorage.setItem(STORAGE_KEYS.VOLUNTEERS, JSON.stringify(this.volunteers));
  }

  private saveRestocks(): void {
    localStorage.setItem(STORAGE_KEYS.RESTOCKS, JSON.stringify(this.restocks));
  }

  private saveLogs(): void {
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(this.logs));
  }

  public saveTpeSettings(): void {
    localStorage.setItem(STORAGE_KEYS.TPE_SETTINGS, JSON.stringify(this.tpeSettings));
  }

  public saveTpeLogs(): void {
    localStorage.setItem(STORAGE_KEYS.TPE_LOGS, JSON.stringify(this.tpeLogs));
  }

  public logActivity(type: ActivityLog['type'], message: string): void {
    const author = this.currentVolunteer ? this.currentVolunteer.name : 'Système';
    const logItem: ActivityLog = {
      id: 'log-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(),
      type,
      message,
      author
    };
    this.logs.unshift(logItem);
    if (this.logs.length > 500) this.logs.pop();
    this.saveLogs();
    console.log(`[${logItem.type}] ${logItem.timestamp} - ${logItem.author}: ${logItem.message}`);
  }

  // --- Authentification & Session ---
  public getVolunteers(): Volunteer[] {
    return [...this.volunteers];
  }

  public getCurrentVolunteer(): Volunteer | null {
    return this.currentVolunteer;
  }

  public getActiveSession(): Session | null {
    return this.activeSession;
  }

  public login(volunteerId: string): boolean {
    const volunteer = this.volunteers.find(v => v.id === volunteerId);
    if (!volunteer || volunteer.isSuspended) return false;

    this.currentVolunteer = volunteer;

    // Créer ou reprendre la session
    if (!this.activeSession || this.activeSession.status !== 'active') {
      this.activeSession = {
        id: 'sess-' + Date.now(),
        startTime: new Date().toISOString(),
        volunteerId: volunteer.id,
        volunteerName: volunteer.name,
        totalSales: 0,
        totalCash: 0,
        totalTpe: 0,
        salesCount: 0,
        status: 'active'
      };
      localStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(this.activeSession));
      this.logActivity('SESSION', `Ouverture de permanence par ${volunteer.name}`);
    } else {
      this.logActivity('INFO', `Connexion de ${volunteer.name} à la séance active`);
    }

    this.notify();
    return true;
  }

  public authenticate(username: string, password: string): { success: boolean; message: string; volunteer?: Volunteer } {
    const cleanUsername = username.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanUsername || !cleanPassword) {
      return { success: false, message: 'Veuillez renseigner votre identifiant et votre mot de passe' };
    }

    // Protection anti force-brute (blocage 30s après 5 échecs consécutifs)
    const now = Date.now();
    const attempt = this.loginAttempts.get(cleanUsername);
    if (attempt && attempt.lockedUntil && attempt.lockedUntil > now) {
      const waitSeconds = Math.ceil((attempt.lockedUntil - now) / 1000);
      return {
        success: false,
        message: `Compte temporairement verrouillé suite à trop de tentatives infructueuses. Réessayez dans ${waitSeconds} secondes.`
      };
    }

    const volunteer = this.volunteers.find(v => v.username.toLowerCase() === cleanUsername);
    if (!volunteer) {
      return { success: false, message: 'Identifiant introuvable. Demandez la création de votre compte au délégué CVL.' };
    }

    if (volunteer.isSuspended) {
      return { success: false, message: 'Ce compte est actuellement suspendu. Contactez le délégué élu CVL.' };
    }

    if (volunteer.password !== cleanPassword) {
      const currentCount = (attempt?.count || 0) + 1;
      if (currentCount >= 5) {
        this.loginAttempts.set(cleanUsername, {
          count: currentCount,
          lockedUntil: now + 30_000
        });
        this.logActivity('SECURITY', `Compte ${cleanUsername} verrouillé pendant 30s après 5 échecs consécutifs.`);
        return {
          success: false,
          message: 'Trop de tentatives échouées. Votre compte est bloqué pendant 30 secondes par sécurité.'
        };
      } else {
        this.loginAttempts.set(cleanUsername, { count: currentCount });
        return {
          success: false,
          message: `Mot de passe incorrect. (${5 - currentCount} tentative(s) restante(s))`
        };
      }
    }

    // Réinitialisation du compteur après connexion réussie
    this.loginAttempts.delete(cleanUsername);

    const loginOk = this.login(volunteer.id);
    if (!loginOk) {
      return { success: false, message: 'Impossible d\'ouvrir la session pour cet utilisateur.' };
    }

    return { success: true, message: 'Connexion réussie', volunteer };
  }

  public createUser(userData: {
    name: string;
    username: string;
    password: string;
    role?: string;
    isAdmin?: boolean;
  }): { success: boolean; message: string; volunteer?: Volunteer } {
    const cleanUsername = userData.username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const cleanPassword = userData.password.trim();
    const cleanName = userData.name.trim();

    if (!cleanUsername) {
      return { success: false, message: "L'identifiant d'utilisateur ne peut pas être vide" };
    }
    if (cleanPassword.length < 2) {
      return { success: false, message: 'Le mot de passe doit contenir au moins 2 caractères' };
    }
    if (!cleanName) {
      return { success: false, message: 'Le nom de la personne est obligatoire' };
    }

    const exists = this.volunteers.some(v => v.username.toLowerCase() === cleanUsername);
    if (exists) {
      return { success: false, message: `L'identifiant "@${cleanUsername}" est déjà utilisé par un autre compte.` };
    }

    const colors = ['#ea580c', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6', '#6366f1'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const newVolunteer: Volunteer = {
      id: 'vol-' + Date.now(),
      username: cleanUsername,
      password: cleanPassword,
      name: cleanName,
      role: userData.role?.trim() || (userData.isAdmin ? 'Délégué élu CVL' : 'Bénévole Permanence'),
      avatarColor: randomColor,
      isAdmin: !!userData.isAdmin,
      isSuspended: false,
      createdAt: new Date().toISOString()
    };

    this.volunteers.push(newVolunteer);
    this.saveVolunteers();
    this.logActivity('INFO', `Création du compte @${cleanUsername} (${cleanName}) par ${this.currentVolunteer?.name || 'Admin'}`);
    this.notify();

    return { success: true, message: `Compte @${cleanUsername} créé avec succès pour ${cleanName}`, volunteer: newVolunteer };
  }

  public toggleSuspendUser(volunteerId: string): { success: boolean; message: string } {
    const user = this.volunteers.find(v => v.id === volunteerId);
    if (!user) return { success: false, message: 'Utilisateur introuvable' };

    if (user.id === this.currentVolunteer?.id) {
      return { success: false, message: 'Action impossible : vous ne pouvez pas suspendre votre propre compte connecté' };
    }

    if (user.isAdmin && !user.isSuspended) {
      const activeAdmins = this.volunteers.filter(v => v.isAdmin && !v.isSuspended && v.id !== user.id);
      if (activeAdmins.length === 0) {
        return { success: false, message: 'Action impossible : il doit rester au moins un délégué administrateur actif' };
      }
    }

    user.isSuspended = !user.isSuspended;
    this.saveVolunteers();
    const action = user.isSuspended ? 'suspendu' : 'réactivé';
    this.logActivity('WARNING', `Compte @${user.username} (${user.name}) ${action} par ${this.currentVolunteer?.name || 'Admin'}`);
    this.notify();

    return { success: true, message: `Le compte @${user.username} a été ${action}` };
  }

  public deleteUser(volunteerId: string): { success: boolean; message: string } {
    const index = this.volunteers.findIndex(v => v.id === volunteerId);
    if (index === -1) return { success: false, message: 'Utilisateur introuvable' };

    const user = this.volunteers[index];

    if (user.id === this.currentVolunteer?.id) {
      return { success: false, message: 'Action impossible : vous ne pouvez pas supprimer votre propre compte actuellement connecté' };
    }

    if (user.isAdmin) {
      const otherAdmins = this.volunteers.filter(v => v.isAdmin && v.id !== user.id);
      if (otherAdmins.length === 0) {
        return { success: false, message: 'Action impossible : vous ne pouvez pas supprimer le dernier compte administrateur' };
      }
    }

    this.volunteers.splice(index, 1);
    this.saveVolunteers();
    this.logActivity('WARNING', `Suppression du compte @${user.username} (${user.name}) par ${this.currentVolunteer?.name || 'Admin'}`);
    this.notify();

    return { success: true, message: `Compte @${user.username} supprimé définitivement` };
  }

  public resetUserPassword(volunteerId: string, newPass: string): { success: boolean; message: string } {
    const user = this.volunteers.find(v => v.id === volunteerId);
    if (!user) return { success: false, message: 'Utilisateur introuvable' };

    const cleanPass = newPass.trim();
    if (cleanPass.length < 2) {
      return { success: false, message: 'Le nouveau mot de passe doit contenir au moins 2 caractères' };
    }

    user.password = cleanPass;
    this.saveVolunteers();
    this.logActivity('INFO', `Mot de passe réinitialisé pour @${user.username} par ${this.currentVolunteer?.name || 'Admin'}`);
    this.notify();

    return { success: true, message: `Mot de passe mis à jour pour @${user.username}` };
  }

  public updateUserName(volunteerId: string, newName: string): { success: boolean; message: string } {
    const user = this.volunteers.find(v => v.id === volunteerId);
    if (!user) return { success: false, message: 'Utilisateur introuvable' };

    const cleanName = newName.trim();
    if (cleanName.length < 2) {
      return { success: false, message: 'Le nom doit contenir au moins 2 caractères' };
    }

    const oldName = user.name;
    user.name = cleanName;
    this.saveVolunteers();

    // Mettre à jour immédiatement tous les scores Pacman existants associés
    let updatedCount = 0;
    this.snakeScores.forEach(s => {
      if (s.volunteerId === user.id || s.playerName === oldName) {
        s.volunteerId = user.id;
        s.playerName = cleanName;
        updatedCount++;
      }
    });
    if (updatedCount > 0) {
      this.saveSnakeScores();
    }

    if (this.currentVolunteer?.id === user.id) {
      this.currentVolunteer.name = cleanName;
    }

    this.logActivity('INFO', `Nom de @${user.username} modifié en "${cleanName}"`);
    this.notify();

    return { success: true, message: `Nom mis à jour en "${cleanName}"` };
  }

  // --- Gestion du TPE SumUp ---
  public getTpeSettings(): TpeSettings {
    return { ...this.tpeSettings };
  }

  public updateTpeSettings(settings: Partial<TpeSettings>): void {
    if (this.currentVolunteer && !this.currentVolunteer.isAdmin) {
      console.warn('Action refusée: modification TPE réservée aux administrateurs.');
      this.logActivity('SECURITY', `Tentative non autorisée de modification TPE par ${this.currentVolunteer.name}`);
      return;
    }
    this.tpeSettings = { ...this.tpeSettings, ...settings };
    this.saveTpeSettings();
    this.notify();
  }

  public connectTpe(account: {
    merchantName?: string;
    merchantEmail?: string;
    merchantCode?: string;
    apiKey?: string;
    serialNumber?: string;
    readerId?: string;
    readerModel?: 'SumUp Solo' | 'SumUp Air';
  }): void {
    if (this.currentVolunteer && !this.currentVolunteer.isAdmin) {
      console.warn('Action refusée: connexion TPE réservée aux administrateurs.');
      this.logActivity('SECURITY', `Tentative non autorisée de connexion TPE par ${this.currentVolunteer.name}`);
      return;
    }
    this.tpeSettings = {
      ...this.tpeSettings,
      isConnected: true,
      merchantName: account.merchantName || this.tpeSettings.merchantName || 'Maison des Lycéens',
      merchantEmail: account.merchantEmail || this.tpeSettings.merchantEmail || '',
      merchantCode: account.merchantCode || this.tpeSettings.merchantCode || '',
      apiKey: account.apiKey ?? this.tpeSettings.apiKey ?? '',
      readerId: account.readerId ?? this.tpeSettings.readerId ?? '',
      serialNumber: account.serialNumber || this.tpeSettings.serialNumber || `SOLO-MDL-${Math.floor(1000 + Math.random() * 9000)}`,
      readerModel: account.readerModel || 'SumUp Solo',
      readerName: `${account.readerModel || 'SumUp Solo'} (${account.merchantName || 'Foyer MDL'})`,
      batteryLevel: 98
    };
    this.saveTpeSettings();
    this.logActivity('INFO', `Terminal ${this.tpeSettings.readerModel} configuré (${this.tpeSettings.merchantName})`);
    this.notify();
  }

  public disconnectTpe(): void {
    if (this.currentVolunteer && !this.currentVolunteer.isAdmin) {
      console.warn('Action refusée: déconnexion TPE réservée aux administrateurs.');
      this.logActivity('SECURITY', `Tentative non autorisée de déconnexion TPE par ${this.currentVolunteer.name}`);
      return;
    }
    this.tpeSettings.isConnected = false;
    this.tpeSettings.apiKey = '';
    this.tpeSettings.merchantCode = '';
    this.saveTpeSettings();
    this.logActivity('WARNING', `Terminal ${this.tpeSettings.readerName} déconnecté`);
    this.notify();
  }

  public recordTpePayment(payment: {
    amount: number;
    cardBrand?: string;
    last4?: string;
    status?: 'SUCCESS' | 'FAILED';
  }): TpePaymentLog {
    const log: TpePaymentLog = {
      id: 'tpe-tx-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(),
      amount: payment.amount,
      currency: 'EUR',
      status: payment.status || 'SUCCESS',
      readerName: this.tpeSettings.readerName,
      cardBrand: payment.cardBrand || 'Sans-Contact / CB',
      last4: payment.last4 || `${Math.floor(1000 + Math.random() * 9000)}`,
      transactionCode: `TX-${Date.now().toString(36).toUpperCase()}`,
      volunteerName: this.currentVolunteer?.name || 'Inconnu'
    };
    this.tpeLogs.unshift(log);
    if (this.tpeLogs.length > 200) this.tpeLogs.pop();
    this.saveTpeLogs();
    this.notify();
    return log;
  }

  public getTpeLogs(): TpePaymentLog[] {
    return [...this.tpeLogs];
  }

  public getPacmanScores(): PacmanScore[] {
    const fakeNames = ['jérémy', 'jeremy', 'thomas m.', 'thomas'];
    return this.snakeScores
      .filter(s => 
        s && typeof s === 'object' && 
        s.playerName &&
        !fakeNames.includes(String(s.playerName).toLowerCase().trim()) &&
        !['s1', 's2', 's3'].includes(s.id) &&
        !(s.score === 140 && String(s.playerName).includes('Jér')) &&
        !(s.score === 90 && String(s.playerName).includes('Thom')) &&
        !(s.score === 80 && String(s.playerName).includes('Adri'))
      )
      .map(s => {
        if (s.volunteerId) {
          const vol = this.volunteers.find(v => v.id === s.volunteerId);
          if (vol && vol.name) {
            return { ...s, playerName: vol.name };
          }
        }
        return s;
      })
      .sort((a, b) => b.score - a.score);
  }

  public addPacmanScore(playerName: string, score: number, volunteerId?: string): PacmanScore {
    const volId = volunteerId || this.currentVolunteer?.id;
    const vol = volId ? this.volunteers.find(v => v.id === volId) : null;
    const resolvedName = vol ? vol.name : (playerName.trim() || 'Anonyme');

    const entry: PacmanScore = {
      id: 'score-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      volunteerId: volId,
      playerName: resolvedName,
      score,
      timestamp: new Date().toISOString()
    };
    this.snakeScores.push(entry);
    this.snakeScores.sort((a, b) => b.score - a.score);
    if (this.snakeScores.length > 50) this.snakeScores.pop();
    this.saveSnakeScores();
    this.notify();
    return entry;
  }

  public getSnakeScores(): SnakeScore[] {
    return this.getPacmanScores();
  }

  public addSnakeScore(playerName: string, score: number): SnakeScore {
    return this.addPacmanScore(playerName, score);
  }

  public clearPacmanScores(): void {
    this.snakeScores = [];
    this.saveSnakeScores();
    this.notify();
  }

  private saveSnakeScores(): void {
    localStorage.setItem(STORAGE_KEYS.SNAKE_SCORES, JSON.stringify(this.snakeScores));
    localStorage.setItem(STORAGE_KEYS.PACMAN_SCORES, JSON.stringify(this.snakeScores));
  }

  public logout(): void {
    // Déclenche backup auto et déconnexion
    const volName = this.currentVolunteer?.name || 'Inconnu';
    this.createAutomaticBackup(`logout_${volName.replace(/[^a-zA-Z0-9]/g, '_')}`);
    this.logActivity('INFO', `Déconnexion de ${volName}`);
    this.currentVolunteer = null;
    this.notify();
  }

  public closeSession(incidentNotes: string): { session: Session; backupName: string } {
    if (!this.activeSession) {
      throw new Error('Aucune séance active à clôturer');
    }

    this.activeSession.endTime = new Date().toISOString();
    this.activeSession.status = 'closed';
    this.activeSession.incidentNotes = incidentNotes.trim();

    this.sessions.unshift({ ...this.activeSession });
    this.saveSessions();

    const closedSession = { ...this.activeSession };
    const volName = this.activeSession.volunteerName;

    this.logActivity('SESSION', `Clôture séance par ${volName}. Ventes: ${closedSession.totalSales.toFixed(2)}€ (${closedSession.salesCount} ventes). Notes: ${incidentNotes || 'Aucun incident'}`);

    // Création du backup horodaté de clôture
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupName = `openmdl_cloture_${dateStr}.json`;
    this.createAutomaticBackup(`cloture_${dateStr}`);

    // Réinitialiser la session active
    this.activeSession = null;
    this.currentVolunteer = null;
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION);

    this.notify();
    return { session: closedSession, backupName };
  }

  public createAutomaticBackup(tag: string): string {
    const backupPayload = {
      tag,
      exportDate: new Date().toISOString(),
      products: this.products,
      sales: this.sales,
      sessions: this.sessions,
      restocks: this.restocks,
      logs: this.logs
    };

    const fileName = `backup_${tag}_${new Date().toISOString().slice(0, 10)}.json`;
    const jsonStr = JSON.stringify(backupPayload, null, 2);

    // Stockage dans l'historique des backups locaux
    try {
      const backupsListKey = 'openmdl_backups_index';
      const existing = JSON.parse(localStorage.getItem(backupsListKey) || '[]');
      existing.unshift({
        fileName,
        date: new Date().toISOString(),
        salesCount: this.sales.length,
        productsCount: this.products.length,
        size: jsonStr.length
      });
      localStorage.setItem(backupsListKey, JSON.stringify(existing.slice(0, 30)));
      localStorage.setItem('backup_data_' + fileName, jsonStr);
    } catch (e) {
      console.warn('Backup local quota limit reached, maintaining latest backups', e);
    }

    this.logActivity('BACKUP', `Sauvegarde automatique créée: ${fileName}`);
    return fileName;
  }

  public getBackupsList(): Array<{ fileName: string; date: string; salesCount: number; productsCount: number }> {
    try {
      return JSON.parse(localStorage.getItem('openmdl_backups_index') || '[]');
    } catch {
      return [];
    }
  }

  // --- Produits & Caisse ---
  public getProducts(): Product[] {
    return [...this.products];
  }

  public getProductById(id: string): Product | undefined {
    return this.products.find(p => p.id === id);
  }

  public updateProduct(updated: Product): void {
    if (this.currentVolunteer && !this.currentVolunteer.isAdmin) {
      this.logActivity('WARNING', `Accès refusé : tentative de modification du catalogue/tarifs par @${this.currentVolunteer.username}`);
      return;
    }
    const index = this.products.findIndex(p => p.id === updated.id);
    if (index !== -1) {
      const old = this.products[index];
      this.products[index] = { ...updated };
      this.saveProducts();
      this.logActivity('INFO', `Mise à jour produit "${updated.name}" (Prix: ${old.price}€ -> ${updated.price}€, Stock: ${updated.stock})`);
      this.notify();
    }
  }

  public addProduct(product: Omit<Product, 'id'>): Product {
    if (this.currentVolunteer && !this.currentVolunteer.isAdmin) {
      this.logActivity('WARNING', `Accès refusé : tentative de création de produit par @${this.currentVolunteer.username}`);
      return { ...product, id: 'unauthorized' };
    }
    const newProduct: Product = {
      ...product,
      id: 'prod-' + Date.now()
    };
    this.products.push(newProduct);
    this.saveProducts();
    this.logActivity('INFO', `Création nouveau produit "${newProduct.name}" (Prix: ${newProduct.price}€)`);
    this.notify();
    return newProduct;
  }

  public deleteProduct(id: string): void {
    if (this.currentVolunteer && !this.currentVolunteer.isAdmin) {
      this.logActivity('WARNING', `Accès refusé : tentative de suppression de produit par @${this.currentVolunteer.username}`);
      return;
    }
    const prod = this.products.find(p => p.id === id);
    if (prod) {
      this.products = this.products.filter(p => p.id !== id);
      this.saveProducts();
      this.logActivity('WARNING', `Suppression du produit "${prod.name}"`);
      this.notify();
    }
  }

  // --- Restock Rapide ---
  public applyRestock(productId: string, quantityToAdd: number, newPrice?: number, costPrice?: number): void {
    if (this.currentVolunteer && !this.currentVolunteer.isAdmin) {
      this.logActivity('WARNING', `Accès refusé : tentative de restock par @${this.currentVolunteer.username}`);
      return;
    }
    const prod = this.products.find(p => p.id === productId);
    if (!prod) return;

    const previousStock = prod.stock;
    prod.stock += quantityToAdd;
    if (newPrice !== undefined && newPrice > 0) {
      prod.price = newPrice;
    }
    if (costPrice !== undefined && costPrice > 0) {
      prod.costPrice = costPrice;
    }

    const restockLog: RestockLog = {
      id: 'restock-' + Date.now(),
      productId: prod.id,
      productName: prod.name,
      quantityAdded: quantityToAdd,
      previousStock,
      newStock: prod.stock,
      newPrice: prod.price,
      costPrice: prod.costPrice,
      timestamp: new Date().toISOString(),
      volunteerName: this.currentVolunteer?.name || 'Inconnu'
    };

    this.restocks.unshift(restockLog);
    this.saveRestocks();
    this.saveProducts();

    this.logActivity('RESTOCK', `Restock +${quantityToAdd} sur "${prod.name}" (Stock: ${previousStock} -> ${prod.stock})`);
    this.notify();
  }

  public getRestocks(): RestockLog[] {
    return [...this.restocks];
  }

  // --- Ventes & Encaissement ---
  public recordSale(saleData: Omit<Sale, 'id' | 'timestamp' | 'volunteerId' | 'volunteerName' | 'sessionId'>): Sale {
    const volunteer = this.currentVolunteer || { id: 'unknown', name: 'Bénévole' };
    const sessionId = this.activeSession?.id || 'default-session';

    const sale: Sale = {
      id: 'sale-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(),
      volunteerId: volunteer.id,
      volunteerName: volunteer.name,
      sessionId,
      ...saleData
    };

    // Décrémenter les stocks
    for (const item of sale.items) {
      const prod = this.products.find(p => p.id === item.productId);
      if (prod) {
        prod.stock = Math.max(0, prod.stock - item.quantity);
      }
    }
    this.saveProducts();

    // Ajouter la vente
    this.sales.unshift(sale);
    this.saveSales();

    // Mettre à jour la session active
    if (this.activeSession) {
      this.activeSession.totalSales += sale.totalAmount;
      this.activeSession.salesCount += 1;
      if (sale.paymentMethod === 'especes') {
        this.activeSession.totalCash += sale.totalAmount;
      } else {
        this.activeSession.totalTpe += sale.totalAmount;
      }
      localStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(this.activeSession));
    }

    const itemsSummary = sale.items.map(i => `${i.quantity}x ${i.productName}`).join(', ');
    this.logActivity('SALE', `Vente encaissée (${sale.paymentMethod.toUpperCase()}): ${sale.totalAmount.toFixed(2)}€ [${itemsSummary}]`);

    this.notify();
    return sale;
  }

  public getSales(): Sale[] {
    return [...this.sales];
  }

  public getSessions(): Session[] {
    return [...this.sessions];
  }

  public seedDemoSessions(): void {
    const now = new Date();
    const newSessions: Session[] = [];

    // Déterminer le lundi de la semaine courante
    const currDay = now.getDay();
    const diffToMonday = now.getDate() - currDay + (currDay === 0 ? -6 : 1);
    const currMonday = new Date(now.getFullYear(), now.getMonth(), diffToMonday);

    const volunteersPool = [
      { id: 'vol-admin', name: 'Adrien (Responsable MDL)', color: '#ea580c' },
      { id: 'vol-2', name: 'Sarah L. (Trésorière)', color: '#8b5cf6' },
      { id: 'vol-3', name: 'Thomas M. (Bénévole)', color: '#10b981' },
      { id: 'vol-4', name: 'Lucas D. (Bénévole)', color: '#06b6d4' },
      { id: 'vol-5', name: 'Emma R. (Secrétaire)', color: '#ec4899' },
      { id: 'vol-6', name: 'Hugo B. (Bénévole)', color: '#f59e0b' }
    ];

    const notesPool = [
      'Affluence très soutenue à la pause. Caisse parfaitement équilibrée.',
      'Beaucoup de cafés et chocolats chauds distribués. R.A.S.',
      'Séance calme et ordonnée. Stock de canettes fraîches réapprovisionné.',
      'Forte demande sur les confiseries. Monnaie et caisse vérifiées.',
      'Permanence impeccable, tables essuyées et local fermé à clé.',
      'Excellente ambiance, beaucoup d\'adhérents au comptoir.'
    ];

    // Créneaux types du lycée :
    // 1. Pause matin: 09:55 -> 10:20 (25 min)
    // 2. Pause méridienne: 11:45 -> 13:45 (2h00)
    // 3. Pause après-midi: 15:45 -> 16:15 (30 min)
    // 4. Fin de journée: 17:05 -> 18:05 (1h00)

    for (let w = 3; w >= 0; w--) {
      const weekMonday = new Date(currMonday);
      weekMonday.setDate(currMonday.getDate() - (w * 7));

      for (let dayIdx = 0; dayIdx < 5; dayIdx++) {
        const sessionDate = new Date(weekMonday);
        sessionDate.setDate(weekMonday.getDate() + dayIdx);

        if (sessionDate > now && sessionDate.toDateString() !== now.toDateString()) {
          continue;
        }

        const isWednesday = dayIdx === 2;

        // Créneau Matin (9h55 - 10h20)
        {
          const vol = volunteersPool[(w * 5 + dayIdx * 2) % volunteersPool.length];
          const start = new Date(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate(), 9, 55);
          const end = new Date(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate(), 10, 20);
          const sales = 12 + ((dayIdx * 3 + w) % 9);
          const totalSales = Math.round((15 + (dayIdx * 2.5) + (w * 1.5)) * 100) / 100;
          const cash = Math.round(totalSales * 0.65 * 100) / 100;
          const tpe = Math.round((totalSales - cash) * 100) / 100;

          if (start < now) {
            newSessions.push({
              id: `demo-sess-w${w}-d${dayIdx}-morning`,
              startTime: start.toISOString(),
              endTime: end.toISOString(),
              volunteerId: vol.id,
              volunteerName: vol.name,
              totalSales,
              totalCash: cash,
              totalTpe: tpe,
              salesCount: sales,
              incidentNotes: notesPool[(dayIdx + w) % notesPool.length],
              status: 'closed'
            });
          }
        }

        // Créneau Midi (11h45 - 13h45)
        {
          const vol = volunteersPool[(w * 5 + dayIdx * 2 + 1) % volunteersPool.length];
          const start = new Date(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate(), 11, 45);
          const end = new Date(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate(), 13, 45);
          const sales = 38 + ((dayIdx * 7 + w * 4) % 25);
          const totalSales = Math.round((52 + (dayIdx * 6.5) + (w * 3.5)) * 100) / 100;
          const cash = Math.round(totalSales * 0.55 * 100) / 100;
          const tpe = Math.round((totalSales - cash) * 100) / 100;

          if (start < now) {
            newSessions.push({
              id: `demo-sess-w${w}-d${dayIdx}-lunch`,
              startTime: start.toISOString(),
              endTime: end.toISOString(),
              volunteerId: vol.id,
              volunteerName: vol.name,
              totalSales,
              totalCash: cash,
              totalTpe: tpe,
              salesCount: sales,
              incidentNotes: notesPool[(dayIdx + w + 1) % notesPool.length],
              status: 'closed'
            });
          }
        }

        // Créneau Après-midi (15h45 - 16h15) (sauf mercredi)
        if (!isWednesday) {
          const vol = volunteersPool[(w * 5 + dayIdx * 2 + 2) % volunteersPool.length];
          const start = new Date(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate(), 15, 45);
          const end = new Date(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate(), 16, 15);
          const sales = 15 + ((dayIdx * 4 + w * 2) % 12);
          const totalSales = Math.round((21 + (dayIdx * 3.2) + (w * 2)) * 100) / 100;
          const cash = Math.round(totalSales * 0.5 * 100) / 100;
          const tpe = Math.round((totalSales - cash) * 100) / 100;

          if (start < now) {
            newSessions.push({
              id: `demo-sess-w${w}-d${dayIdx}-afternoon`,
              startTime: start.toISOString(),
              endTime: end.toISOString(),
              volunteerId: vol.id,
              volunteerName: vol.name,
              totalSales,
              totalCash: cash,
              totalTpe: tpe,
              salesCount: sales,
              incidentNotes: notesPool[(dayIdx + w + 2) % notesPool.length],
              status: 'closed'
            });
          }
        }

        // Créneau Fin de journée (17h05 - 18h05) (Lundi, Mardi, Jeudi)
        if (dayIdx === 0 || dayIdx === 1 || dayIdx === 3) {
          const vol = volunteersPool[(w * 5 + dayIdx + 3) % volunteersPool.length];
          const start = new Date(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate(), 17, 5);
          const end = new Date(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate(), 18, 5);
          const sales = 10 + ((dayIdx * 2 + w) % 8);
          const totalSales = Math.round((14.50 + (dayIdx * 2.1) + w) * 100) / 100;
          const cash = Math.round(totalSales * 0.6 * 100) / 100;
          const tpe = Math.round((totalSales - cash) * 100) / 100;

          if (start < now) {
            newSessions.push({
              id: `demo-sess-w${w}-d${dayIdx}-evening`,
              startTime: start.toISOString(),
              endTime: end.toISOString(),
              volunteerId: vol.id,
              volunteerName: vol.name,
              totalSales,
              totalCash: cash,
              totalTpe: tpe,
              salesCount: sales,
              incidentNotes: notesPool[(dayIdx + w + 3) % notesPool.length],
              status: 'closed'
            });
          }
        }
      }

      // Samedi matin (Réunion bureau / permanence spéciale)
      {
        const saturdayDate = new Date(weekMonday);
        saturdayDate.setDate(weekMonday.getDate() + 5);
        if (saturdayDate <= now) {
          const start = new Date(saturdayDate.getFullYear(), saturdayDate.getMonth(), saturdayDate.getDate(), 10, 0);
          const end = new Date(saturdayDate.getFullYear(), saturdayDate.getMonth(), saturdayDate.getDate(), 12, 15);
          newSessions.push({
            id: `demo-sess-w${w}-sat`,
            startTime: start.toISOString(),
            endTime: end.toISOString(),
            volunteerId: 'vol-admin',
            volunteerName: 'Adrien (Responsable MDL)',
            totalSales: 28.50,
            totalCash: 16.00,
            totalTpe: 12.50,
            salesCount: 19,
            incidentNotes: 'Permanence d\'accueil et réunion de rentrée du bureau MDL.',
            status: 'closed'
          });
        }
      }
    }

    if (this.activeSession) {
      newSessions.unshift({ ...this.activeSession });
    }

    newSessions.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    this.sessions = newSessions;
    this.saveSessions();
    this.notify();
  }

  public getLogs(): ActivityLog[] {
    return [...this.logs];
  }

  // --- Gestion des Consommations Offertes aux Bénévoles (> 10 ventes / jour) ---
  public getVolunteerPerks(): VolunteerPerk[] {
    return [...this.volunteerPerks];
  }

  public getTodaySalesForVolunteer(volunteerId: string): number {
    const todayStr = new Date().toISOString().split('T')[0];
    return this.sales.filter(s => s.volunteerId === volunteerId && s.timestamp.startsWith(todayStr)).length;
  }

  public hasVolunteerClaimedPerkToday(volunteerId: string): boolean {
    const todayStr = new Date().toISOString().split('T')[0];
    return this.volunteerPerks.some(p => p.volunteerId === volunteerId && p.date === todayStr);
  }

  public canClaimVolunteerPerk(volunteerId: string): { allowed: boolean; reason?: string; salesToday: number; requiredSales: number } {
    const salesToday = this.getTodaySalesForVolunteer(volunteerId);
    const requiredSales = 10;
    const alreadyClaimed = this.hasVolunteerClaimedPerkToday(volunteerId);

    if (alreadyClaimed) {
      return {
        allowed: false,
        reason: 'Conso gratuite déjà accordée aujourd\'hui (maximum 1 fois par jour)',
        salesToday,
        requiredSales
      };
    }

    if (salesToday < requiredSales) {
      return {
        allowed: false,
        reason: `Règle des 10 ventes non atteinte (${salesToday}/${requiredSales} ventes réalisées aujourd'hui)`,
        salesToday,
        requiredSales
      };
    }

    return {
      allowed: true,
      salesToday,
      requiredSales
    };
  }

  public claimVolunteerPerk(volunteerId: string, productId: string): { success: boolean; message: string; perk?: VolunteerPerk } {
    const volunteer = this.volunteers.find(v => v.id === volunteerId) || this.currentVolunteer;
    if (!volunteer) return { success: false, message: 'Bénévole introuvable.' };

    const check = this.canClaimVolunteerPerk(volunteer.id);
    if (!check.allowed) {
      return { success: false, message: check.reason || 'Conditions non remplies.' };
    }

    const product = this.products.find(p => p.id === productId);
    if (!product) return { success: false, message: 'Article sélectionné introuvable.' };
    if (product.stock <= 0) return { success: false, message: 'Article actuellement en rupture.' };

    // Décompter 1 unité du stock
    product.stock -= 1;
    this.saveProducts();

    const todayStr = new Date().toISOString().split('T')[0];
    const perk: VolunteerPerk = {
      id: 'perk-' + Date.now(),
      volunteerId: volunteer.id,
      volunteerName: volunteer.name,
      productId: product.id,
      productName: product.name,
      costPrice: product.costPrice,
      sellingPrice: product.price,
      date: todayStr,
      timestamp: new Date().toISOString()
    };

    this.volunteerPerks.unshift(perk);
    this.saveVolunteerPerks();

    this.logActivity('INFO', `Conso offerte bénévole : "${product.name}" attribuée à ${volunteer.name} (Coût foyer : ${product.costPrice.toFixed(2)}€)`);
    this.notify();

    return {
      success: true,
      message: `Conso offerte (${product.name}) accordée avec succès à ${volunteer.name} !`,
      perk
    };
  }

  private saveVolunteerPerks(): void {
    localStorage.setItem(STORAGE_KEYS.PERKS, JSON.stringify(this.volunteerPerks));
  }

  // --- Données d'exemple riches pour Graphiques et Démo (Activables sur demande) ---
  public seedDemoData(): void {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Injecter les utilisateurs de démonstration
    this.volunteers = JSON.parse(JSON.stringify(DEMO_VOLUNTEERS));
    this.saveVolunteers();
    this.currentVolunteer = this.volunteers[0];

    // Générer des ventes sur les 5 derniers jours
    const sampleSales: Sale[] = [];
    this.products = JSON.parse(JSON.stringify(DEMO_PRODUCTS));
    this.saveProducts();
    const prods = this.products;

    // Ventes d'aujourd'hui pour Adrien (12 ventes pour dépasser les 10 requises)
    for (let i = 0; i < 12; i++) {
      const p = prods[i % prods.length];
      const hour = 9 + Math.floor(i / 2);
      const minute = (i * 13) % 60;
      const saleDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute);
      
      sampleSales.push({
        id: `seed-sale-today-${i}`,
        timestamp: saleDate.toISOString(),
        volunteerId: 'vol-1',
        volunteerName: 'Adrien (Responsable MDL)',
        sessionId: 'sess-today',
        paymentMethod: i % 3 === 0 ? 'especes' : 'tpe',
        totalAmount: p.price,
        items: [{
          productId: p.id,
          productName: p.name,
          unitPrice: p.price,
          quantity: 1,
          totalPrice: p.price
        }]
      });
    }

    // Ventes des jours passés (hier, J-2, J-3, J-4)
    for (let dayOffset = 1; dayOffset <= 4; dayOffset++) {
      const pastDate = new Date(now);
      pastDate.setDate(now.getDate() - dayOffset);
      const salesCount = 8 + (dayOffset * 3);

      for (let j = 0; j < salesCount; j++) {
        const p = prods[(j + dayOffset) % prods.length];
        const vol = INITIAL_VOLUNTEERS[j % INITIAL_VOLUNTEERS.length];
        const saleTimestamp = new Date(pastDate.getFullYear(), pastDate.getMonth(), pastDate.getDate(), 10 + (j % 7), (j * 17) % 60).toISOString();

        sampleSales.push({
          id: `seed-sale-${dayOffset}-${j}`,
          timestamp: saleTimestamp,
          volunteerId: vol.id,
          volunteerName: vol.name,
          sessionId: `sess-${dayOffset}`,
          paymentMethod: j % 2 === 0 ? 'especes' : 'tpe',
          totalAmount: p.price,
          items: [{
            productId: p.id,
            productName: p.name,
            unitPrice: p.price,
            quantity: 1,
            totalPrice: p.price
          }]
        });
      }
    }

    // Ventes des mois passés de l'année en cours pour alimenter la comparaison mensuelle
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    for (let m = 0; m < currentMonth; m++) {
      const monthSalesTarget = 25 + (m * 6);
      for (let s = 0; s < monthSalesTarget; s++) {
        const p = prods[(s + m) % prods.length];
        const vol = INITIAL_VOLUNTEERS[s % INITIAL_VOLUNTEERS.length];
        const day = 1 + ((s * 3) % 27);
        const saleTime = new Date(currentYear, m, day, 11 + (s % 5), (s * 13) % 60).toISOString();

        sampleSales.push({
          id: `seed-pastmonth-${m}-${s}`,
          timestamp: saleTime,
          volunteerId: vol.id,
          volunteerName: vol.name,
          sessionId: `sess-m-${m}`,
          paymentMethod: s % 3 === 0 ? 'especes' : 'tpe',
          totalAmount: p.price,
          items: [{
            productId: p.id,
            productName: p.name,
            unitPrice: p.price,
            quantity: 1,
            totalPrice: p.price
          }]
        });
      }
    }

    this.sales = sampleSales;
    this.saveSales();

    // Ajouter des consos gratuites pour chaque mois passé et les jours récents
    const perksList: VolunteerPerk[] = [];
    for (let m = 0; m <= currentMonth; m++) {
      // Pour Avril (m=3), simuler un mois où les bénévoles ont trop consommé pour démontrer le dépassement visuel !
      const perksCount = m === 3 ? 35 : m === currentMonth ? 3 : 2 + (m % 3);
      for (let k = 0; k < perksCount; k++) {
        const perkProd = prods[(k + 1) % prods.length];
        const vol = INITIAL_VOLUNTEERS[k % INITIAL_VOLUNTEERS.length];
        const day = m === currentMonth ? (now.getDate() - (k + 1)) : (1 + (k % 26));
        const pDate = new Date(currentYear, m, Math.max(1, day), 12, 30);
        perksList.push({
          id: `perk-seed-${m}-${k}`,
          volunteerId: vol.id,
          volunteerName: vol.name,
          productId: perkProd.id,
          productName: perkProd.name,
          costPrice: perkProd.costPrice,
          sellingPrice: perkProd.price,
          date: pDate.toISOString().split('T')[0],
          timestamp: pDate.toISOString()
        });
      }
    }

    this.volunteerPerks = perksList;
    this.saveVolunteerPerks();

    // Seeder les restocks réguliers au fil des mois pour alimenter l'historique visuel
    const sampleRestocks: RestockLog[] = [];
    for (let m = 0; m <= currentMonth; m++) {
      prods.forEach((prod, pIdx) => {
        // Premier restock mensuel (début de mois)
        const qty1 = 20 + ((pIdx * 7) % 25);
        const day1 = 2 + (pIdx % 3);
        const d1 = new Date(currentYear, m, day1, 9, 30);
        sampleRestocks.push({
          id: `seed-restock-${m}-${prod.id}-1`,
          productId: prod.id,
          productName: prod.name,
          quantityAdded: qty1,
          previousStock: Math.max(2, prod.minStockAlert - 2),
          newStock: Math.max(2, prod.minStockAlert - 2) + qty1,
          costPrice: prod.costPrice,
          timestamp: d1.toISOString(),
          volunteerName: 'Délégué CVL (Admin)'
        });

        // Deuxième restock mensuel (milieu de mois)
        if (m < currentMonth || now.getDate() >= 16) {
          const qty2 = 15 + ((pIdx * 4) % 20);
          const day2 = 16 + (pIdx % 4);
          const d2 = new Date(currentYear, m, day2, 14, 0);
          sampleRestocks.push({
            id: `seed-restock-${m}-${prod.id}-2`,
            productId: prod.id,
            productName: prod.name,
            quantityAdded: qty2,
            previousStock: Math.max(3, prod.minStockAlert - 1),
            newStock: Math.max(3, prod.minStockAlert - 1) + qty2,
            costPrice: prod.costPrice,
            timestamp: d2.toISOString(),
            volunteerName: 'Délégué CVL (Admin)'
          });
        }
      });
    }

    this.restocks = sampleRestocks;
    this.saveRestocks();

    // Ajouter des logs TPE de démo
    this.tpeLogs = [
      {
        id: 'tpe-demo-1',
        timestamp: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
        amount: 2.20,
        currency: 'EUR',
        status: 'SUCCESS',
        readerName: 'SumUp Solo (Foyer MDL)',
        cardBrand: 'Visa Contactless',
        last4: '4821',
        transactionCode: 'TX-SUM-9281',
        volunteerName: 'Jérémy (Bénévole)'
      },
      {
        id: 'tpe-demo-2',
        timestamp: new Date(Date.now() - 1000 * 60 * 75).toISOString(),
        amount: 1.50,
        currency: 'EUR',
        status: 'SUCCESS',
        readerName: 'SumUp Solo (Foyer MDL)',
        cardBrand: 'Apple Pay (Mastercard)',
        last4: '1094',
        transactionCode: 'TX-SUM-9280',
        volunteerName: 'Délégué CVL (Admin)'
      },
      {
        id: 'tpe-demo-3',
        timestamp: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
        amount: 3.00,
        currency: 'EUR',
        status: 'SUCCESS',
        readerName: 'SumUp Solo (Foyer MDL)',
        cardBrand: 'CB Sans-Contact',
        last4: '3349',
        transactionCode: 'TX-SUM-9279',
        volunteerName: 'Jérémy (Bénévole)'
      }
    ];
    this.saveTpeLogs();

    localStorage.setItem('OPENMDL_DEMO_ACTIVE', 'true');
    this.notify();
  }

  public clearAllTestData(resetProducts = true, resetVolunteers = true): void {
    this.sales = [];
    this.sessions = [];
    this.restocks = [];
    this.volunteerPerks = [];
    this.tpeLogs = [];
    this.logs = [];
    this.activeSession = null;
    localStorage.removeItem('OPENMDL_DEMO_ACTIVE');
    localStorage.removeItem('OPENMDL_SEED_V');
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION);
    this.saveSales();
    this.saveSessions();
    this.saveRestocks();
    this.saveVolunteerPerks();
    this.saveTpeLogs();
    this.saveLogs();
    if (resetProducts) {
      this.products = [];
      this.saveProducts();
    }
    if (resetVolunteers) {
      this.volunteers = JSON.parse(JSON.stringify(INITIAL_VOLUNTEERS));
      this.saveVolunteers();
      this.currentVolunteer = this.volunteers[0];
    }
    this.notify();
  }

  public isDemoMode(): boolean {
    return localStorage.getItem('OPENMDL_DEMO_ACTIVE') === 'true';
  }

  // --- Évolution des stocks au cours du temps pour un produit sélectionné ---
  public getProductStockTimeline(
    productId: string,
    year: number,
    month: number | 'all' = 'all'
  ): ProductStockEvolution {
    const prod = this.products.find(p => p.id === productId) || this.products[0];
    if (!prod) {
      return {
        product: { id: '', name: 'Aucun produit', category: 'autre', price: 0, costPrice: 0, stock: 0, minStockAlert: 0, imageUrl: '', isActive: false },
        timeframe: month === 'all' ? 'year' : 'month',
        year,
        month,
        dataPoints: [],
        summary: {
          currentStock: 0,
          initialStock: 0,
          totalSold: 0,
          totalRestocked: 0,
          dailyVelocity: 0,
          daysUntilOut: null,
          recommendedRestockQty: 0,
          urgentStatus: 'ok'
        }
      };
    }
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const isCurrentYear = year === currentYear;

    const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'];

    if (month === 'all') {
      // VUE ANNUELLE : Mois par mois (Janvier à Décembre ou jusqu'au mois en cours)
      const maxMonth = isCurrentYear ? currentMonth : 11;
      const dataPoints: ProductStockHistoryPoint[] = [];

      let runningStock = Math.max(prod.stock, 25);

      for (let m = 0; m <= maxMonth; m++) {
        const monthSales = this.sales.filter(s => {
          const d = new Date(s.timestamp);
          return d.getFullYear() === year && d.getMonth() === m;
        });

        let soldInMonth = 0;
        monthSales.forEach(s => {
          const item = s.items.find(it => it.productId === prod.id);
          if (item) soldInMonth += item.quantity;
        });

        const monthRestocks = this.restocks.filter(r => {
          const d = new Date(r.timestamp);
          return d.getFullYear() === year && d.getMonth() === m && r.productId === prod.id;
        });

        const restockedInMonth = monthRestocks.reduce((sum, r) => sum + r.quantityAdded, 0);

        if (m === currentMonth && isCurrentYear) {
          runningStock = prod.stock;
        } else {
          runningStock = Math.max(0, runningStock + restockedInMonth - soldInMonth);
          if (runningStock === 0 && restockedInMonth === 0) {
            runningStock = Math.max(4, prod.minStockAlert + 5);
          }
        }

        dataPoints.push({
          label: monthNames[m],
          dateKey: `${year}-${String(m + 1).padStart(2, '0')}`,
          stockLevel: runningStock,
          minStockAlert: prod.minStockAlert,
          soldCount: soldInMonth,
          restockCount: restockedInMonth,
          isRestockEvent: restockedInMonth > 0,
          isAlertEvent: runningStock <= prod.minStockAlert
        });
      }

      const totalSold = dataPoints.reduce((sum, dp) => sum + dp.soldCount, 0);
      const totalRestocked = dataPoints.reduce((sum, dp) => sum + dp.restockCount, 0);
      const daysCount = (maxMonth + 1) * 30;
      const dailyVelocity = Number((totalSold / Math.max(1, daysCount)).toFixed(2));
      const daysUntilOut = dailyVelocity > 0 ? Math.round(prod.stock / dailyVelocity) : null;
      const recommendedRestockQty = Math.max(prod.minStockAlert * 2, Math.round(dailyVelocity * 14));

      return {
        product: prod,
        timeframe: 'year',
        year,
        month: 'all',
        dataPoints,
        summary: {
          currentStock: prod.stock,
          initialStock: dataPoints[0]?.stockLevel || prod.stock,
          totalSold,
          totalRestocked,
          dailyVelocity,
          daysUntilOut,
          recommendedRestockQty,
          urgentStatus: prod.stock <= prod.minStockAlert ? 'urgent' : prod.stock <= prod.minStockAlert * 1.5 ? 'warning' : 'ok'
        }
      };
    } else {
      // VUE MENSUELLE DÉTAILLÉE : Jour par jour du mois sélectionné
      const numMonth = Number(month);
      const daysInMonth = new Date(year, numMonth + 1, 0).getDate();
      const maxDay = (isCurrentYear && numMonth === currentMonth) ? now.getDate() : daysInMonth;

      const monthSales = this.sales.filter(s => {
        const d = new Date(s.timestamp);
        return d.getFullYear() === year && d.getMonth() === numMonth;
      });

      const monthRestocks = this.restocks.filter(r => {
        const d = new Date(r.timestamp);
        return d.getFullYear() === year && d.getMonth() === numMonth && r.productId === prod.id;
      });

      const dailySalesMap = new Map<number, number>();
      monthSales.forEach(s => {
        const d = new Date(s.timestamp).getDate();
        const item = s.items.find(it => it.productId === prod.id);
        if (item) {
          dailySalesMap.set(d, (dailySalesMap.get(d) || 0) + item.quantity);
        }
      });

      const dailyRestocksMap = new Map<number, number>();
      monthRestocks.forEach(r => {
        const d = new Date(r.timestamp).getDate();
        dailyRestocksMap.set(d, (dailyRestocksMap.get(d) || 0) + r.quantityAdded);
      });

      const dataPoints: ProductStockHistoryPoint[] = [];
      let totalSold = 0;
      let totalRestocked = 0;

      const dailyStockArray: number[] = new Array(maxDay + 1);
      dailyStockArray[maxDay] = prod.stock;

      for (let day = maxDay; day >= 1; day--) {
        const soldToday = dailySalesMap.get(day) || 0;
        const restockToday = dailyRestocksMap.get(day) || 0;
        totalSold += soldToday;
        totalRestocked += restockToday;

        if (day > 1) {
          dailyStockArray[day - 1] = Math.max(0, dailyStockArray[day] - restockToday + soldToday);
        }
      }

      for (let day = 1; day <= maxDay; day++) {
        const sold = dailySalesMap.get(day) || 0;
        const restock = dailyRestocksMap.get(day) || 0;
        const stockLevel = dailyStockArray[day];

        dataPoints.push({
          label: `${day} ${monthNames[numMonth]}`,
          dateKey: `${year}-${String(numMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
          stockLevel,
          minStockAlert: prod.minStockAlert,
          soldCount: sold,
          restockCount: restock,
          isRestockEvent: restock > 0,
          isAlertEvent: stockLevel <= prod.minStockAlert
        });
      }

      const dailyVelocity = Number((totalSold / Math.max(1, maxDay)).toFixed(2));
      const daysUntilOut = dailyVelocity > 0 ? Math.round(prod.stock / dailyVelocity) : null;
      const recommendedRestockQty = Math.max(prod.minStockAlert * 2, Math.round(dailyVelocity * 10));

      return {
        product: prod,
        timeframe: 'month',
        year,
        month: numMonth,
        dataPoints,
        summary: {
          currentStock: prod.stock,
          initialStock: dataPoints[0]?.stockLevel || prod.stock,
          totalSold,
          totalRestocked,
          dailyVelocity,
          daysUntilOut,
          recommendedRestockQty,
          urgentStatus: prod.stock <= prod.minStockAlert ? 'urgent' : prod.stock <= prod.minStockAlert * 1.5 ? 'warning' : 'ok'
        }
      };
    }
  }
}

export const db = new DatabaseService();
