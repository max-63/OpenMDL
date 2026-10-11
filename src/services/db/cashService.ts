import type {
  CashFloatSettings,
  DrawerCashState,
  EnrichedCashWithdrawal,
  Session
} from '../../types';
import {
  EURO_DENOMINATIONS,
  DEFAULT_CASH_FLOAT_SETTINGS
} from './constants.ts';

export class CashService {
  public calculateBaseCashFloatTotal(
    baseCounts?: Record<string, number>,
    fallbackCounts?: Record<string, number>
  ): number {
    const counts = baseCounts || fallbackCounts || DEFAULT_CASH_FLOAT_SETTINGS.baseCounts;
    let total = 0;
    for (const [denomId, qty] of Object.entries(counts)) {
      const val = parseFloat(denomId);
      if (!isNaN(val) && qty > 0) {
        total += val * qty;
      }
    }
    return Math.round(total * 100) / 100;
  }

  public getCurrentDrawerState(
    floatSettings: CashFloatSettings,
    activeSessionDraftCounts?: Record<string, number>,
    incomingCash?: Record<string, number>
  ): DrawerCashState {
    const base = { ...DEFAULT_CASH_FLOAT_SETTINGS.baseCounts, ...(floatSettings.baseCounts || {}) };
    const prevDiff = floatSettings.carriedOverDifferences || {};

    const effectiveBase: Record<string, number> = {};
    for (const denom of EURO_DENOMINATIONS) {
      effectiveBase[denom.id] = Math.max(0, (base[denom.id] || 0) + (prevDiff[denom.id] || 0));
    }

    const sessionExtra = activeSessionDraftCounts || {};

    const available: Record<string, number> = {};
    const surplus: Record<string, number> = {};

    for (const denom of EURO_DENOMINATIONS) {
      const currentInDrawer = Math.max(
        0,
        (effectiveBase[denom.id] || 0) + (sessionExtra[denom.id] || 0) + (incomingCash?.[denom.id] || 0)
      );
      available[denom.id] = currentInDrawer;
      surplus[denom.id] = Math.max(0, currentInDrawer - effectiveBase[denom.id]);
    }

    return { available, base: effectiveBase, surplus };
  }

  public getCashWithdrawals(sessions: Session[]): EnrichedCashWithdrawal[] {
    return sessions
      .filter(s => Boolean(s.cashWithdrawal))
      .map(s => ({
        ...s.cashWithdrawal!,
        sessionId: s.id,
        sessionEndTime: s.endTime || s.startTime,
        volunteerName: s.volunteerName
      }))
      .sort((a, b) => new Date(b.sessionEndTime).getTime() - new Date(a.sessionEndTime).getTime());
  }
}

export const cashService = new CashService();
