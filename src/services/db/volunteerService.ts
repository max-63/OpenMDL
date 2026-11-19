import type {
  Volunteer,
  VolunteerThemeSettings,
  PacmanScore,
  SnakeScore,
  UserPermissions,
  VolunteerPerkPolicy
} from '../../types';
import {
  DEFAULT_VOLUNTEER_PERK_POLICY,
  getDefaultPermissionsForRole,
  resolveVolunteerPermissions
} from '../../types/index.ts';
import { STORAGE_KEYS } from './constants.ts';

export class VolunteerService {
  private loginAttempts: Map<string, { count: number; lockedUntil?: number }> = new Map();

  public getVolunteers(volunteers: Volunteer[]): Volunteer[] {
    return [...volunteers];
  }

  public saveVolunteers(volunteers: Volunteer[], saveFn: (key: string, val: string) => void): void {
    saveFn(STORAGE_KEYS.VOLUNTEERS, JSON.stringify(volunteers));
  }

  public authenticate(
    volunteers: Volunteer[],
    username: string,
    password: string,
    onSuccessLogin: (volunteerId: string) => boolean,
    onSecurityAlert: (msg: string) => void
  ): { success: boolean; message: string; volunteer?: Volunteer } {
    const cleanUsername = username.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanUsername || !cleanPassword) {
      return { success: false, message: 'Veuillez renseigner votre identifiant et votre mot de passe' };
    }

    const now = Date.now();
    const attempt = this.loginAttempts.get(cleanUsername);
    if (attempt && attempt.lockedUntil && attempt.lockedUntil > now) {
      const waitSeconds = Math.ceil((attempt.lockedUntil - now) / 1000);
      return {
        success: false,
        message: `Compte temporairement verrouillé suite à trop de tentatives infructueuses. Réessayez dans ${waitSeconds} secondes.`
      };
    }

    const volunteer = volunteers.find(v => v.username.toLowerCase() === cleanUsername);
    if (!volunteer) {
      return { success: false, message: 'Identifiant introuvable. Demandez la création de votre compte à un administrateur.' };
    }

    if (volunteer.isSuspended) {
      return { success: false, message: 'Ce compte est actuellement suspendu. Contactez un administrateur.' };
    }

    if (volunteer.password !== cleanPassword) {
      const currentCount = (attempt?.count || 0) + 1;
      if (currentCount >= 5) {
        this.loginAttempts.set(cleanUsername, {
          count: currentCount,
          lockedUntil: now + 30_000
        });
        onSecurityAlert(`Compte ${cleanUsername} verrouillé pendant 30s après 5 échecs consécutifs.`);
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

    this.loginAttempts.delete(cleanUsername);

    const loginOk = onSuccessLogin(volunteer.id);
    if (!loginOk) {
      return { success: false, message: 'Impossible d\'ouvrir la session pour cet utilisateur.' };
    }

    return { success: true, message: 'Connexion réussie', volunteer };
  }

  public createUser(
    volunteers: Volunteer[],
    userData: {
      name: string;
      username: string;
      password: string;
      role?: string;
      isAdmin?: boolean;
      permissions?: Partial<UserPermissions>;
      perkPolicy?: VolunteerPerkPolicy;
    }
  ): { success: boolean; message: string; volunteer?: Volunteer } {
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

    const exists = volunteers.some(v => v.username.toLowerCase() === cleanUsername);
    if (exists) {
      return { success: false, message: `L'identifiant "@${cleanUsername}" est déjà utilisé par un autre compte.` };
    }

    const colors = ['#ea580c', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6', '#6366f1'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const resolvedRole = userData.role?.trim() || (userData.isAdmin ? 'Administrateur' : 'Bénévole Permanence');
    const basePerms = getDefaultPermissionsForRole(resolvedRole, !!userData.isAdmin);
    const resolvedPermissions = resolveVolunteerPermissions({
      role: resolvedRole,
      isAdmin: !!userData.isAdmin,
      permissions: userData.permissions ? { ...basePerms, ...userData.permissions } : basePerms
    });
    const normalizedPerkPolicy: VolunteerPerkPolicy = userData.perkPolicy
      ? {
          mode: userData.perkPolicy.mode || 'inherit',
          quantity: Math.max(1, Math.min(20, Math.round(userData.perkPolicy.quantity || 1))),
          everyNSessions: Math.max(1, Math.min(20, Math.round(userData.perkPolicy.everyNSessions || 1))),
          ignoreThreshold: !!userData.perkPolicy.ignoreThreshold
        }
      : { ...DEFAULT_VOLUNTEER_PERK_POLICY };

    const newVolunteer: Volunteer = {
      id: 'vol-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      username: cleanUsername,
      password: cleanPassword,
      name: cleanName,
      role: resolvedRole,
      avatarColor: randomColor,
      isAdmin: !!userData.isAdmin,
      isSuspended: false,
      createdAt: new Date().toISOString(),
      permissions: resolvedPermissions,
      perkPolicy: normalizedPerkPolicy
    };

    volunteers.push(newVolunteer);

    return { success: true, message: `Compte @${cleanUsername} créé avec succès pour ${cleanName}`, volunteer: newVolunteer };
  }

  public toggleSuspendUser(
    volunteers: Volunteer[],
    currentVolunteerId: string | undefined,
    volunteerId: string
  ): { success: boolean; message: string; user?: Volunteer } {
    const user = volunteers.find(v => v.id === volunteerId);
    if (!user) return { success: false, message: 'Utilisateur introuvable' };

    if (user.id === currentVolunteerId) {
      return { success: false, message: 'Action impossible : vous ne pouvez pas suspendre votre propre compte connecté' };
    }

    if (user.isAdmin && !user.isSuspended) {
      const activeAdmins = volunteers.filter(v => v.isAdmin && !v.isSuspended && v.id !== user.id);
      if (activeAdmins.length === 0) {
        return { success: false, message: 'Action impossible : il doit rester au moins un délégué administrateur actif' };
      }
    }

    user.isSuspended = !user.isSuspended;
    const action = user.isSuspended ? 'suspendu' : 'réactivé';
    return { success: true, message: `Le compte @${user.username} a été ${action}`, user };
  }

  public deleteUser(
    volunteers: Volunteer[],
    currentVolunteerId: string | undefined,
    volunteerId: string
  ): { success: boolean; message: string; deletedUser?: Volunteer } {
    const index = volunteers.findIndex(v => v.id === volunteerId);
    if (index === -1) return { success: false, message: 'Utilisateur introuvable' };

    const user = volunteers[index];

    if (user.id === currentVolunteerId) {
      return { success: false, message: 'Action impossible : vous ne pouvez pas supprimer votre propre compte actuellement connecté' };
    }

    if (user.isAdmin) {
      const otherAdmins = volunteers.filter(v => v.isAdmin && v.id !== user.id);
      if (otherAdmins.length === 0) {
        return { success: false, message: 'Action impossible : vous ne pouvez pas supprimer le dernier compte administrateur' };
      }
    }

    volunteers.splice(index, 1);
    return { success: true, message: `Compte @${user.username} supprimé définitivement`, deletedUser: user };
  }

  public resetUserPassword(
    volunteers: Volunteer[],
    volunteerId: string,
    newPass: string
  ): { success: boolean; message: string; user?: Volunteer } {
    const user = volunteers.find(v => v.id === volunteerId);
    if (!user) return { success: false, message: 'Utilisateur introuvable' };

    const cleanPass = newPass.trim();
    if (cleanPass.length < 2) {
      return { success: false, message: 'Le nouveau mot de passe doit contenir au moins 2 caractères' };
    }

    user.password = cleanPass;
    return { success: true, message: `Mot de passe mis à jour pour @${user.username}`, user };
  }

  public updateUserName(
    volunteers: Volunteer[],
    snakeScores: SnakeScore[],
    volunteerId: string,
    newName: string
  ): { success: boolean; message: string; user?: Volunteer; oldName?: string } {
    const user = volunteers.find(v => v.id === volunteerId);
    if (!user) return { success: false, message: 'Utilisateur introuvable' };

    const cleanName = newName.trim();
    if (cleanName.length < 2) {
      return { success: false, message: 'Le nom doit contenir au moins 2 caractères' };
    }

    const oldName = user.name;
    user.name = cleanName;

    snakeScores.forEach(s => {
      if (s.volunteerId === user.id || s.playerName === oldName) {
        s.volunteerId = user.id;
        s.playerName = cleanName;
      }
    });

    return { success: true, message: `Nom mis à jour en "${cleanName}"`, user, oldName };
  }

  public updateUserPermissionsAndPerk(
    volunteers: Volunteer[],
    currentVolunteerId: string | undefined,
    volunteerId: string,
    updates: {
      role?: string;
      isAdmin?: boolean;
      permissions?: Partial<UserPermissions>;
      perkPolicy?: VolunteerPerkPolicy;
    }
  ): { success: boolean; message: string; user?: Volunteer } {
    const user = volunteers.find(v => v.id === volunteerId);
    if (!user) return { success: false, message: 'Utilisateur introuvable' };

    const nextRole = updates.role !== undefined && updates.role.trim() ? updates.role.trim() : user.role;
    const nextIsAdmin = updates.isAdmin !== undefined ? !!updates.isAdmin : user.isAdmin;
    const isRootAdmin = user.id === 'vol-admin' || user.username === 'admin';

    if (isRootAdmin && !nextIsAdmin) {
      return {
        success: false,
        message: 'Action impossible : le compte administrateur principal (@admin) doit rester administrateur.'
      };
    }

    if (user.isAdmin && !nextIsAdmin) {
      const otherActiveAdmins = volunteers.filter(v => v.isAdmin && !v.isSuspended && v.id !== user.id);
      if (otherActiveAdmins.length === 0) {
        return {
          success: false,
          message: 'Action impossible : il doit rester au moins un administrateur actif.'
        };
      }
    }

    const baseForTarget = updates.permissions
      ? updates.permissions
      : updates.isAdmin !== undefined || updates.role !== undefined
        ? getDefaultPermissionsForRole(nextRole, nextIsAdmin)
        : user.permissions;

    const nextPermissions = resolveVolunteerPermissions({
      id: user.id,
      username: user.username,
      role: nextRole,
      isAdmin: nextIsAdmin,
      permissions: baseForTarget
    });

    if (user.id === currentVolunteerId && !nextPermissions.canManageUsers) {
      return {
        success: false,
        message: 'Action impossible : vous ne pouvez pas retirer l’accès aux Paramètres sur votre propre compte connecté.'
      };
    }

    user.role = nextRole;
    user.isAdmin = nextIsAdmin;
    user.permissions = nextPermissions;

    if (updates.perkPolicy) {
      user.perkPolicy = {
        mode: updates.perkPolicy.mode || 'inherit',
        quantity: Math.max(1, Math.min(20, Math.round(updates.perkPolicy.quantity || 1))),
        everyNSessions: Math.max(1, Math.min(20, Math.round(updates.perkPolicy.everyNSessions || 1))),
        ignoreThreshold: !!updates.perkPolicy.ignoreThreshold
      };
    }

    return {
      success: true,
      message: `Permissions et politique conso mises à jour pour ${user.name}`,
      user
    };
  }
}

export const volunteerService = new VolunteerService();
