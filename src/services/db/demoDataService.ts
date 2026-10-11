import type { Session, Sale, VolunteerPerk, RestockLog, TpePaymentLog, Product } from '../../types';
import { DEMO_VOLUNTEERS, DEMO_PRODUCTS, INITIAL_VOLUNTEERS } from './constants.ts';

export class DemoDataService {
  public seedDemoSessions(activeSession: Session | null): Session[] {
    const now = new Date();
    const newSessions: Session[] = [];

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

    if (activeSession) {
      newSessions.unshift({ ...activeSession });
    }

    newSessions.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    return newSessions;
  }

  public generateDemoDataset() {
    const now = new Date();
    const volunteers = JSON.parse(JSON.stringify(DEMO_VOLUNTEERS));
    const currentVolunteer = volunteers[0];
    const products: Product[] = JSON.parse(JSON.stringify(DEMO_PRODUCTS));

    const sampleSales: Sale[] = [];
    const prods = products;

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

    const perksList: VolunteerPerk[] = [];
    for (let m = 0; m <= currentMonth; m++) {
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

    const sampleRestocks: RestockLog[] = [];
    for (let m = 0; m <= currentMonth; m++) {
      prods.forEach((prod, pIdx) => {
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
          volunteerName: 'Administrateur'
        });

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
            volunteerName: 'Administrateur'
          });
        }
      });
    }

    const tpeLogs: TpePaymentLog[] = [
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
        volunteerName: 'Administrateur'
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

    return {
      volunteers,
      currentVolunteer,
      products,
      sales: sampleSales,
      volunteerPerks: perksList,
      restocks: sampleRestocks,
      tpeLogs
    };
  }
}

export const demoDataService = new DemoDataService();
