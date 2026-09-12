import { db } from './db';

export interface SumUpMerchantProfile {
  merchantCode: string;
  name: string;
  email: string;
  currency: string;
  country: string;
}

export interface SumUpReaderInfo {
  id: string;
  name: string;
  status: string;
  serialNumber?: string;
}

export interface SumUpCheckoutStatus {
  status: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED';
  isComplete: boolean;
  isSuccess: boolean;
  message: string;
  transactionCode?: string;
  cardBrand?: string;
  last4?: string;
  amount?: number;
}

export class SumUpService {
  private static readonly API_BASE = 'https://api.sumup.com/v0.1';

  /**
   * Vérifie la validité d'une clé API SumUp en appelant /me
   * et tente de détecter les lecteurs associés via /merchants/{merchant_code}/readers
   */
  public static async testApiKey(apiKey: string): Promise<{
    success: boolean;
    message: string;
    profile?: SumUpMerchantProfile;
    reader?: SumUpReaderInfo;
  }> {
    const cleanKey = apiKey.trim();
    if (!cleanKey) {
      return { success: false, message: 'Veuillez saisir une clé API SumUp secrète (ex: sup_sk_...).' };
    }

    try {
      const response = await fetch(`${this.API_BASE}/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${cleanKey}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 401) {
        return {
          success: false,
          message: 'Clé API invalide ou révoquée (Erreur 401 : Non autorisé). Vérifiez la clé sur me.sumup.com.'
        };
      }

      if (response.status === 403) {
        return {
          success: false,
          message: 'Accès refusé (Erreur 403). Assurez-vous que la clé dispose des autorisations "Paiements" et "Transactions".'
        };
      }

      if (!response.ok) {
        return {
          success: false,
          message: `Erreur SumUp (${response.status} : ${response.statusText}).`
        };
      }

      const data = await response.json();
      const merchantCode = data.merchant_code || data.id || 'INCONNU';
      const companyName = data.company_name || data.business_name || (data.personal_profile ? `${data.personal_profile.first_name} ${data.personal_profile.last_name}` : 'Maison des Lycéens');
      const profile: SumUpMerchantProfile = {
        merchantCode,
        name: companyName,
        email: data.account?.username || data.default_email || '',
        currency: data.currency || 'EUR',
        country: data.country || 'FR'
      };

      // Tenter de découvrir un lecteur SumUp Solo rattaché au compte
      let reader: SumUpReaderInfo | undefined;
      try {
        const readersRes = await fetch(`${this.API_BASE}/merchants/${merchantCode}/readers`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${cleanKey}`,
            'Accept': 'application/json'
          }
        });

        if (readersRes.ok) {
          const readersData = await readersRes.json();
          const items = Array.isArray(readersData) ? readersData : (readersData.items || []);
          if (items.length > 0) {
            const first = items[0];
            reader = {
              id: first.id,
              name: first.name || first.device?.model || 'SumUp Solo',
              status: first.status || 'ONLINE',
              serialNumber: first.device?.identifier || first.serial_number
            };
          }
        }
      } catch {
        // La découverte des lecteurs est optionnelle
      }

      const extra = reader ? ` | Lecteur détecté : ${reader.name}` : '';
      return {
        success: true,
        message: `Compte SumUp vérifié : "${profile.name}" (${profile.merchantCode})${extra}`,
        profile,
        reader
      };
    } catch (err: any) {
      console.error('Erreur appel API SumUp:', err);
      return {
        success: false,
        message: `Échec réseau vers api.sumup.com : ${err?.message || 'Vérifiez votre connexion Internet.'}`
      };
    }
  }

  /**
   * Crée un ordre de paiement direct vers SumUp
   * Envoie la requête sur l'API Checkouts et transmet l'ordre au lecteur
   */
  public static async initiatePayment(
    amount: number,
    description: string = 'Vente Caisse Foyer MDL',
    customRef?: string
  ): Promise<{
    success: boolean;
    checkoutId?: string;
    readerCheckoutId?: string;
    status?: string;
    message: string;
  }> {
    const tpe = db.getTpeSettings();

    if (!tpe.isConnected || !tpe.apiKey) {
      return {
        success: false,
        message: 'Le TPE SumUp n\'est pas configuré avec une clé API active.'
      };
    }

    const ref = customRef || `MDL-${Date.now().toString(36).toUpperCase()}`;

    // 1. Si un lecteur physique est appairé (ex: SumUp Solo Cloud)
    if (tpe.merchantCode && tpe.readerId) {
      try {
        const readerUrl = `${this.API_BASE}/merchants/${tpe.merchantCode}/readers/${tpe.readerId}/checkout`;
        const readerRes = await fetch(readerUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${tpe.apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            total_amount: {
              value: Math.round(amount * 100), // en centimes
              currency: 'EUR'
            },
            description: description
          })
        });

        if (readerRes.ok) {
          const readerData = await readerRes.json();
          return {
            success: true,
            checkoutId: readerData.checkout_id || readerData.id || ref,
            readerCheckoutId: readerData.id,
            status: 'PENDING',
            message: 'Ordre transmis directement à l\'écran du lecteur SumUp'
          };
        }
      } catch (err) {
        console.warn('Erreur sur l\'endpoint direct Reader, repli sur l\'endpoint Checkouts standard:', err);
      }
    }

    // 2. Création de checkout standard SumUp
    try {
      const response = await fetch(`${this.API_BASE}/checkouts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tpe.apiKey}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          checkout_reference: ref,
          amount: Number(amount.toFixed(2)),
          currency: 'EUR',
          merchant_code: tpe.merchantCode || undefined,
          description: description
        })
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          message: data.message || data.error_message || `Erreur SumUp (${response.status})`
        };
      }

      return {
        success: true,
        checkoutId: data.id,
        status: data.status || 'PENDING',
        message: 'Ordre de paiement créé sur SumUp'
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Erreur de communication avec SumUp : ${err?.message || 'Connexion impossible'}`
      };
    }
  }

  /**
   * Vérifie le statut d'une transaction SumUp (polling régulier)
   */
  public static async checkPaymentStatus(
    checkoutId: string,
    readerCheckoutId?: string
  ): Promise<SumUpCheckoutStatus> {
    const tpe = db.getTpeSettings();

    if (!tpe.apiKey) {
      return {
        status: 'FAILED',
        isComplete: true,
        isSuccess: false,
        message: 'Clé API manquante'
      };
    }

    // 1. Si on a un lecteur direct
    if (tpe.merchantCode && tpe.readerId && readerCheckoutId) {
      try {
        const readerUrl = `${this.API_BASE}/merchants/${tpe.merchantCode}/readers/${tpe.readerId}/checkout`;
        const res = await fetch(readerUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${tpe.apiKey}`,
            'Accept': 'application/json'
          }
        });

        if (res.ok) {
          const rData = await res.json();
          const rStatus = (rData.status || '').toUpperCase();

          if (rStatus === 'SUCCESSFUL' || rStatus === 'PAID') {
            return {
              status: 'PAID',
              isComplete: true,
              isSuccess: true,
              message: 'Paiement accepté par le terminal !',
              transactionCode: rData.transaction_code || rData.transaction_id,
              cardBrand: rData.card?.type || 'CB',
              last4: rData.card?.last_4_digits,
              amount: rData.total_amount?.value ? rData.total_amount.value / 100 : undefined
            };
          }

          if (rStatus === 'FAILED' || rStatus === 'CANCELLED' || rStatus === 'DECLINED') {
            return {
              status: 'FAILED',
              isComplete: true,
              isSuccess: false,
              message: rData.status_message || 'Transaction refusée ou annulée sur le terminal.'
            };
          }
        }
      } catch (err) {
        console.warn('Erreur vérification statut lecteur:', err);
      }
    }

    // 2. Vérification sur l'endpoint Checkout standard
    try {
      const response = await fetch(`${this.API_BASE}/checkouts/${checkoutId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tpe.apiKey}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        return {
          status: 'FAILED',
          isComplete: true,
          isSuccess: false,
          message: `Erreur de consultation SumUp (${response.status})`
        };
      }

      const data = await response.json();
      const statusStr = (data.status || '').toUpperCase();

      if (statusStr === 'PAID' || statusStr === 'SUCCESSFUL') {
        const tx = data.transactions && data.transactions.length > 0 ? data.transactions[0] : null;
        return {
          status: 'PAID',
          isComplete: true,
          isSuccess: true,
          message: 'Paiement validé par la banque !',
          transactionCode: tx?.transaction_code || data.id,
          cardBrand: tx?.card?.type || 'CB',
          last4: tx?.card?.last_4_digits,
          amount: data.amount
        };
      }

      if (statusStr === 'FAILED' || statusStr === 'CANCELLED' || statusStr === 'DECLINED') {
        return {
          status: 'FAILED',
          isComplete: true,
          isSuccess: false,
          message: data.message || 'Paiement refusé par la banque ou le terminal.'
        };
      }

      // Toujours en cours (PENDING)
      return {
        status: 'PENDING',
        isComplete: false,
        isSuccess: false,
        message: 'En attente de la carte sur le lecteur...'
      };
    } catch (err: any) {
      return {
        status: 'PENDING',
        isComplete: false,
        isSuccess: false,
        message: `Attente du terminal (${err?.message || 'réseau'})`
      };
    }
  }

  /**
   * Annule un checkout en cours si l'utilisateur abandonne
   */
  public static async cancelCheckout(
    checkoutId: string,
    readerCheckoutId?: string
  ): Promise<void> {
    const tpe = db.getTpeSettings();
    if (!tpe.apiKey) return;

    if (tpe.merchantCode && tpe.readerId && readerCheckoutId) {
      try {
        await fetch(`${this.API_BASE}/merchants/${tpe.merchantCode}/readers/${tpe.readerId}/checkout`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${tpe.apiKey}`
          }
        });
      } catch {}
    }

    try {
      await fetch(`${this.API_BASE}/checkouts/${checkoutId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${tpe.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'CANCELLED' })
      });
    } catch {}
  }
}
