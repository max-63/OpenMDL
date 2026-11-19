import type {
  VolunteerPerk,
  PerkSettings,
  PerkEligibilityRule,
  Sale,
  Product,
  Volunteer,
  Session,
  VolunteerPerkPolicy,
  VolunteerPerkMode
} from '../../types';
import { STORAGE_KEYS } from './constants.ts';
import { storageService } from './storageService.ts';

export class PerkService {
  public saveVolunteerPerks(volunteerPerks: VolunteerPerk[]): void {
    storageService.safeSetItem(STORAGE_KEYS.PERKS, JSON.stringify(volunteerPerks));
  }

  public getSessionSalesCount(sales: Sale[], targetSessionId?: string): number {
    if (!targetSessionId) return 0;
    return sales.filter(s => s.sessionId === targetSessionId).length;
  }

  public getSessionItemsSoldCount(sales: Sale[], targetSessionId?: string): number {
    if (!targetSessionId) return 0;
    return sales
      .filter(s => s.sessionId === targetSessionId)
      .reduce((total, s) => total + s.items.reduce((sum, item) => sum + (item.quantity || 1), 0), 0);
  }

  public getTodaySalesForVolunteer(sales: Sale[], volunteerId: string): number {
    const todayStr = new Date().toISOString().split('T')[0];
    return sales.filter(s => s.volunteerId === volunteerId && s.timestamp.startsWith(todayStr)).length;
  }

  public getTodayItemsSoldForVolunteer(sales: Sale[], volunteerId: string): number {
    const todayStr = new Date().toISOString().split('T')[0];
    return sales
      .filter(s => s.volunteerId === volunteerId && s.timestamp.startsWith(todayStr))
      .reduce((total, s) => total + s.items.reduce((sum, item) => sum + (item.quantity || 1), 0), 0);
  }

  public hasVolunteerClaimedPerkToday(volunteerPerks: VolunteerPerk[], volunteerId: string): boolean {
    const todayStr = new Date().toISOString().split('T')[0];
    return volunteerPerks.some(p => p.volunteerId === volunteerId && p.date === todayStr);
  }

  private normalizePolicy(policy?: VolunteerPerkPolicy): {
    mode: VolunteerPerkMode;
    quantity: number;
    everyNSessions: number;
    ignoreThreshold: boolean;
  } {
    const mode: VolunteerPerkMode =
      policy?.mode === 'none' || policy?.mode === 'custom' || policy?.mode === 'inherit'
        ? policy.mode
        : 'inherit';
    return {
      mode,
      quantity: mode === 'none' ? 0 : mode === 'custom' ? Math.max(1, Math.min(20, Math.round(policy?.quantity || 1))) : 1,
      everyNSessions: mode === 'custom' ? Math.max(1, Math.min(20, Math.round(policy?.everyNSessions || 1))) : 1,
      ignoreThreshold: mode === 'custom' && !!policy?.ignoreThreshold
    };
  }

  private getClaimedPerksCountForSession(
    volunteerPerks: VolunteerPerk[],
    volunteerId: string,
    session: Pick<Session, 'id' | 'startTime' | 'endTime'>
  ): number {
    const sessionDay = (session.startTime || '').split('T')[0];
    return volunteerPerks.filter(p => {
      if (p.volunteerId !== volunteerId) return false;
      if (p.sessionId) return p.sessionId === session.id;
      if (session.startTime) {
        return p.timestamp >= session.startTime && (!session.endTime || p.timestamp <= session.endTime);
      }
      return !!sessionDay && p.date === sessionDay;
    }).length;
  }

  private computeSessionsUntilEligible(
    volunteerPerks: VolunteerPerk[],
    volunteerId: string,
    everyNSessions: number,
    sessionId?: string,
    sessions: Session[] = []
  ): number {
    if (everyNSessions <= 1) return 0;

    // Construit la chronologie des séances du bénévole (du plus ancien au plus récent)
    const dedupMap = new Map<string, Session>();
    for (const s of sessions) {
      if (s && s.volunteerId === volunteerId && !dedupMap.has(s.id)) {
        dedupMap.set(s.id, s);
      }
    }
    if (sessionId && !dedupMap.has(sessionId)) {
      dedupMap.set(sessionId, {
        id: sessionId,
        startTime: new Date().toISOString(),
        volunteerId,
        volunteerName: '',
        totalSales: 0,
        totalCash: 0,
        totalTpe: 0,
        salesCount: 0,
        status: 'active'
      });
    }

    const ordered = Array.from(dedupMap.values()).sort((a, b) => {
      const ta = new Date(a.startTime).getTime() || 0;
      const tb = new Date(b.startTime).getTime() || 0;
      if (ta !== tb) return ta - tb;
      if (sessionId && a.id === sessionId) return 1;
      if (sessionId && b.id === sessionId) return -1;
      return a.id.localeCompare(b.id);
    });

    const currentIndex = sessionId
      ? ordered.findIndex(s => s.id === sessionId)
      : ordered.length;
    const priorSessions = currentIndex >= 0 ? ordered.slice(0, currentIndex) : ordered;

    // Cherche la dernière séance antérieure au cours de laquelle au moins 1 conso a été prise
    for (let offset = 1; offset < everyNSessions && priorSessions.length - offset >= 0; offset++) {
      const prevSession = priorSessions[priorSessions.length - offset];
      if (this.getClaimedPerksCountForSession(volunteerPerks, volunteerId, prevSession) > 0) {
        return everyNSessions - offset;
      }
    }
    return 0;
  }

  public canClaimVolunteerPerk(
    perkSettings: PerkSettings,
    sales: Sale[],
    volunteerPerks: VolunteerPerk[],
    volunteerId: string,
    sessionId?: string,
    volunteer?: Volunteer | null,
    sessions: Session[] = []
  ): {
    allowed: boolean;
    reason?: string;
    salesToday: number;
    requiredSales: number;
    current: number;
    required: number;
    rule: PerkEligibilityRule;
    enabled: boolean;
    policyMode: VolunteerPerkMode;
    maxPerSession: number;
    claimedInSession: number;
    remainingInSession: number;
    everyNSessions: number;
    sessionsUntilEligible: number;
  } {
    const settings = perkSettings;
    const policy = this.normalizePolicy(volunteer?.perkPolicy);
    const salesToday = this.getTodaySalesForVolunteer(sales, volunteerId);
    const todayStr = new Date().toISOString().split('T')[0];

    const matchedSession = sessionId ? sessions.find(s => s.id === sessionId) : undefined;
    const claimedInSession = sessionId
      ? this.getClaimedPerksCountForSession(
          volunteerPerks,
          volunteerId,
          matchedSession || { id: sessionId, startTime: `${todayStr}T00:00:00.000Z` }
        )
      : volunteerPerks.filter(p => p.volunteerId === volunteerId && p.date === todayStr).length;

    const maxPerSession = policy.quantity;
    const remainingInSession = Math.max(0, maxPerSession - claimedInSession);
    const sessionsUntilEligible =
      policy.mode === 'custom' && policy.everyNSessions > 1
        ? this.computeSessionsUntilEligible(volunteerPerks, volunteerId, policy.everyNSessions, sessionId, sessions)
        : 0;

    let current = 0;
    let required = settings.threshold;

    if (policy.ignoreThreshold || settings.rule === 'always') {
      current = 1;
      required = 1;
    } else if (settings.rule === 'sales_count') {
      current = sessionId
        ? this.getSessionSalesCount(sales, sessionId)
        : salesToday;
    } else if (settings.rule === 'items_sold') {
      current = sessionId
        ? this.getSessionItemsSoldCount(sales, sessionId)
        : this.getTodayItemsSoldForVolunteer(sales, volunteerId);
    } else {
      current = 1;
      required = 1;
    }

    if (!settings.enabled) {
      return {
        allowed: false,
        reason: 'La collation bénévole offerte est actuellement désactivée dans les réglages',
        salesToday,
        requiredSales: required,
        current,
        required,
        rule: settings.rule,
        enabled: false,
        policyMode: policy.mode,
        maxPerSession,
        claimedInSession,
        remainingInSession: 0,
        everyNSessions: policy.everyNSessions,
        sessionsUntilEligible: 0
      };
    }

    if (policy.mode === 'none') {
      return {
        allowed: false,
        reason: 'Aucune conso offerte attribuée pour ce compte',
        salesToday,
        requiredSales: required,
        current,
        required,
        rule: settings.rule,
        enabled: true,
        policyMode: 'none',
        maxPerSession: 0,
        claimedInSession,
        remainingInSession: 0,
        everyNSessions: 1,
        sessionsUntilEligible: 0
      };
    }

    if (sessionsUntilEligible > 0) {
      return {
        allowed: false,
        reason: `Règle de fréquence (${maxPerSession} conso(s) toutes les ${policy.everyNSessions} séances) : disponible dans ${sessionsUntilEligible} séance${sessionsUntilEligible > 1 ? 's' : ''}`,
        salesToday,
        requiredSales: required,
        current,
        required,
        rule: settings.rule,
        enabled: true,
        policyMode: policy.mode,
        maxPerSession,
        claimedInSession,
        remainingInSession: 0,
        everyNSessions: policy.everyNSessions,
        sessionsUntilEligible
      };
    }

    if (policy.mode === 'inherit') {
      const alreadyClaimedToday = this.hasVolunteerClaimedPerkToday(volunteerPerks, volunteerId);
      if (!settings.allowMultiplePerDay && alreadyClaimedToday) {
        return {
          allowed: false,
          reason: 'Collation offerte déjà accordée aujourd\'hui (maximum 1 par jour)',
          salesToday,
          requiredSales: required,
          current,
          required,
          rule: settings.rule,
          enabled: true,
          policyMode: 'inherit',
          maxPerSession: 1,
          claimedInSession: Math.max(claimedInSession, 1),
          remainingInSession: 0,
          everyNSessions: 1,
          sessionsUntilEligible: 0
        };
      }
      if (claimedInSession >= 1) {
        return {
          allowed: false,
          reason: 'Collation déjà prise sur cette séance',
          salesToday,
          requiredSales: required,
          current,
          required,
          rule: settings.rule,
          enabled: true,
          policyMode: 'inherit',
          maxPerSession: 1,
          claimedInSession,
          remainingInSession: 0,
          everyNSessions: 1,
          sessionsUntilEligible: 0
        };
      }
    } else if (remainingInSession <= 0) {
      return {
        allowed: false,
        reason: `Quota atteint pour cette séance (${claimedInSession}/${maxPerSession} conso${maxPerSession > 1 ? 's' : ''})`,
        salesToday,
        requiredSales: required,
        current,
        required,
        rule: settings.rule,
        enabled: true,
        policyMode: 'custom',
        maxPerSession,
        claimedInSession,
        remainingInSession: 0,
        everyNSessions: policy.everyNSessions,
        sessionsUntilEligible: 0
      };
    }

    if (!policy.ignoreThreshold && settings.rule === 'sales_count' && current < required) {
      return {
        allowed: false,
        reason: `Règle des ${required} ventes non atteinte (${current}/${required} ventes réalisées dans la séance)`,
        salesToday,
        requiredSales: required,
        current,
        required,
        rule: settings.rule,
        enabled: true,
        policyMode: policy.mode,
        maxPerSession,
        claimedInSession,
        remainingInSession,
        everyNSessions: policy.everyNSessions,
        sessionsUntilEligible: 0
      };
    }

    if (!policy.ignoreThreshold && settings.rule === 'items_sold' && current < required) {
      return {
        allowed: false,
        reason: `Règle des ${required} articles non atteinte (${current}/${required} articles vendus dans la séance)`,
        salesToday,
        requiredSales: required,
        current,
        required,
        rule: settings.rule,
        enabled: true,
        policyMode: policy.mode,
        maxPerSession,
        claimedInSession,
        remainingInSession,
        everyNSessions: policy.everyNSessions,
        sessionsUntilEligible: 0
      };
    }

    return {
      allowed: true,
      salesToday,
      requiredSales: required,
      current,
      required,
      rule: settings.rule,
      enabled: true,
      policyMode: policy.mode,
      maxPerSession,
      claimedInSession,
      remainingInSession,
      everyNSessions: policy.everyNSessions,
      sessionsUntilEligible: 0
    };
  }

  public claimVolunteerPerk(
    perkSettings: PerkSettings,
    sales: Sale[],
    volunteerPerks: VolunteerPerk[],
    products: Product[],
    volunteers: Volunteer[],
    currentVolunteer: Volunteer | null,
    volunteerId: string,
    productId: string,
    sessionId?: string,
    sessions: Session[] = []
  ): { success: boolean; message: string; perk?: VolunteerPerk } {
    const volunteer = volunteers.find(v => v.id === volunteerId) || currentVolunteer;
    if (!volunteer) return { success: false, message: 'Bénévole introuvable.' };

    const check = this.canClaimVolunteerPerk(perkSettings, sales, volunteerPerks, volunteer.id, sessionId, volunteer, sessions);
    if (!check.allowed) {
      return { success: false, message: check.reason || 'Conditions non remplies.' };
    }

    const product = products.find(p => p.id === productId);
    if (!product) return { success: false, message: 'Article sélectionné introuvable.' };
    if (product.stock <= 0) return { success: false, message: 'Article actuellement en rupture.' };

    product.stock -= 1;

    const todayStr = new Date().toISOString().split('T')[0];
    const perk: VolunteerPerk = {
      id: 'perk-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      volunteerId: volunteer.id,
      volunteerName: volunteer.name,
      productId: product.id,
      productName: product.name,
      costPrice: product.costPrice,
      sellingPrice: product.price,
      date: todayStr,
      timestamp: new Date().toISOString(),
      sessionId
    };

    volunteerPerks.unshift(perk);
    this.saveVolunteerPerks(volunteerPerks);

    return {
      success: true,
      message: `Conso offerte (${product.name}) accordée avec succès à ${volunteer.name} !`,
      perk
    };
  }
}

export const perkService = new PerkService();
