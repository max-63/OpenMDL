import type {
  VolunteerPerk,
  PerkSettings,
  PerkEligibilityRule,
  Sale,
  Product,
  Volunteer
} from '../../types';
import { STORAGE_KEYS } from './constants.ts';

export class PerkService {
  public saveVolunteerPerks(volunteerPerks: VolunteerPerk[]): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.PERKS, JSON.stringify(volunteerPerks));
    }
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

  public canClaimVolunteerPerk(
    perkSettings: PerkSettings,
    sales: Sale[],
    volunteerPerks: VolunteerPerk[],
    volunteerId: string,
    sessionId?: string
  ): {
    allowed: boolean;
    reason?: string;
    salesToday: number;
    requiredSales: number;
    current: number;
    required: number;
    rule: PerkEligibilityRule;
    enabled: boolean;
  } {
    const settings = perkSettings;
    const targetSessionId = sessionId;
    const salesToday = this.getTodaySalesForVolunteer(sales, volunteerId);

    let current = 0;
    let required = settings.threshold;

    if (settings.rule === 'sales_count') {
      current = targetSessionId
        ? this.getSessionSalesCount(sales, targetSessionId)
        : salesToday;
    } else if (settings.rule === 'items_sold') {
      current = targetSessionId
        ? this.getSessionItemsSoldCount(sales, targetSessionId)
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
        enabled: false
      };
    }

    const alreadyClaimed = this.hasVolunteerClaimedPerkToday(volunteerPerks, volunteerId);
    if (!settings.allowMultiplePerDay && alreadyClaimed) {
      return {
        allowed: false,
        reason: 'Collation offerte déjà accordée aujourd\'hui (maximum 1 par jour)',
        salesToday,
        requiredSales: required,
        current,
        required,
        rule: settings.rule,
        enabled: true
      };
    }

    if (settings.rule === 'sales_count' && current < required) {
      return {
        allowed: false,
        reason: `Règle des ${required} ventes non atteinte (${current}/${required} ventes réalisées dans la séance)`,
        salesToday,
        requiredSales: required,
        current,
        required,
        rule: settings.rule,
        enabled: true
      };
    }

    if (settings.rule === 'items_sold' && current < required) {
      return {
        allowed: false,
        reason: `Règle des ${required} articles non atteinte (${current}/${required} articles vendus dans la séance)`,
        salesToday,
        requiredSales: required,
        current,
        required,
        rule: settings.rule,
        enabled: true
      };
    }

    return {
      allowed: true,
      salesToday,
      requiredSales: required,
      current,
      required,
      rule: settings.rule,
      enabled: true
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
    sessionId?: string
  ): { success: boolean; message: string; perk?: VolunteerPerk } {
    const volunteer = volunteers.find(v => v.id === volunteerId) || currentVolunteer;
    if (!volunteer) return { success: false, message: 'Bénévole introuvable.' };

    const check = this.canClaimVolunteerPerk(perkSettings, sales, volunteerPerks, volunteer.id, sessionId);
    if (!check.allowed) {
      return { success: false, message: check.reason || 'Conditions non remplies.' };
    }

    const product = products.find(p => p.id === productId);
    if (!product) return { success: false, message: 'Article sélectionné introuvable.' };
    if (product.stock <= 0) return { success: false, message: 'Article actuellement en rupture.' };

    product.stock -= 1;

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
