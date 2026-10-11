import type {
  Product,
  ProductStockEvolution,
  ProductStockHistoryPoint,
  RestockLog,
  Sale
} from '../../types';

export class CatalogService {
  public getProductStockTimeline(
    products: Product[],
    sales: Sale[],
    restocks: RestockLog[],
    productId: string,
    year: number,
    month: number | 'all' = 'all'
  ): ProductStockEvolution {
    const prod = products.find(p => p.id === productId) || products[0];
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
      const maxMonth = isCurrentYear ? currentMonth : 11;
      const dataPoints: ProductStockHistoryPoint[] = [];

      let runningStock = Math.max(prod.stock, 25);

      for (let m = 0; m <= maxMonth; m++) {
        const monthSales = sales.filter(s => {
          const d = new Date(s.timestamp);
          return d.getFullYear() === year && d.getMonth() === m;
        });

        let soldInMonth = 0;
        monthSales.forEach(s => {
          const item = s.items.find(it => it.productId === prod.id);
          if (item) soldInMonth += item.quantity;
        });

        const monthRestocks = restocks.filter(r => {
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
      const numMonth = Number(month);
      const daysInMonth = new Date(year, numMonth + 1, 0).getDate();
      const maxDay = (isCurrentYear && numMonth === currentMonth) ? now.getDate() : daysInMonth;

      const monthSales = sales.filter(s => {
        const d = new Date(s.timestamp);
        return d.getFullYear() === year && d.getMonth() === numMonth;
      });

      const monthRestocks = restocks.filter(r => {
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

  public getMultiProductSalesPrediction(
    products: Product[],
    sales: Sale[],
    restocks: RestockLog[],
    year: number,
    month: number | 'all' = 'all'
  ): {
    timeframe: 'month' | 'year';
    labels: string[];
    isFuturePoint: boolean[];
    restockEvents: { label: string; count: number; products: string[] }[];
    productsData: {
      product: Product;
      historicalSales: (number | null)[];
      predictedSales: (number | null)[];
      currentMonthForecastTotal: number;
      restockCountPerPoint: number[];
      color: string;
    }[];
    totalForecastThisMonth: number;
    weatherFactorSummary: string;
    turnoverFactorSummary: string;
  } {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const isCurrentYear = year === currentYear;
    const isPastYear = year < currentYear;

    const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'];

    const getWeatherMultiplier = (m: number, category: string): number => {
      if (category === 'chaud') {
        if (m === 11 || m === 0 || m === 1) return 1.45;
        if (m === 10 || m === 2) return 1.25;
        if (m >= 4 && m <= 8) return 0.55;
        return 0.90;
      }
      if (category === 'boissons') {
        if (m >= 4 && m <= 8) return 1.35;
        if (m === 11 || m === 0 || m === 1) return 0.80;
        return 1.0;
      }
      if (category === 'snacks' || category === 'bonbons') {
        if (m === 8 || m === 9 || m === 11) return 1.20;
        return 1.0;
      }
      return 1.0;
    };

    const getCohortTurnoverMultiplier = (m: number): number => {
      if (m === 8 || m === 9) return 1.15;
      if (m >= 5 && m <= 6) return 0.85;
      return 1.02;
    };

    const palette = [
      '#0284c7', '#ea580c', '#db2777', '#7c3aed', '#10b981',
      '#f59e0b', '#06b6d4', '#6366f1', '#ec4899', '#84cc16'
    ];

    if (month === 'all') {
      const labels = monthNames;
      const isFuturePoint: boolean[] = [];
      for (let m = 0; m < 12; m++) {
        isFuturePoint.push(isCurrentYear ? m > currentMonth : !isPastYear);
      }

      const restockEvents: { label: string; count: number; products: string[] }[] = [];
      for (let m = 0; m < 12; m++) {
        const mRestocks = restocks.filter(r => {
          const d = new Date(r.timestamp);
          return d.getFullYear() === year && d.getMonth() === m;
        });
        const count = mRestocks.reduce((sum, r) => sum + r.quantityAdded, 0);
        const prodNames = Array.from(new Set(mRestocks.map(r => r.productName)));
        restockEvents.push({ label: monthNames[m], count, products: prodNames });
      }

      const productsData = products.map((prod, pIdx) => {
        const color = palette[pIdx % palette.length];
        const historicalSales: (number | null)[] = [];
        const predictedSales: (number | null)[] = [];
        const restockCountPerPoint: number[] = [];

        const priorYearSales = sales.filter(s => {
          const d = new Date(s.timestamp);
          return d.getFullYear() === year - 1;
        });
        const priorMonthAverage = new Array(12).fill(0);
        priorYearSales.forEach(s => {
          const m = new Date(s.timestamp).getMonth();
          const it = s.items.find(i => i.productId === prod.id);
          if (it) priorMonthAverage[m] += it.quantity;
        });

        for (let m = 0; m < 12; m++) {
          const mSales = sales.filter(s => {
            const d = new Date(s.timestamp);
            return d.getFullYear() === year && d.getMonth() === m;
          });
          let soldInM = 0;
          mSales.forEach(s => {
            const it = s.items.find(i => i.productId === prod.id);
            if (it) soldInM += it.quantity;
          });

          const mRestocks = restocks.filter(r => {
            const d = new Date(r.timestamp);
            return d.getFullYear() === year && d.getMonth() === m && r.productId === prod.id;
          });
          const restockQty = mRestocks.reduce((sum, r) => sum + r.quantityAdded, 0);
          restockCountPerPoint.push(restockQty);

          const isFuture = isCurrentYear ? m > currentMonth : !isPastYear;

          if (!isFuture) {
            historicalSales.push(soldInM);
            predictedSales.push(m === currentMonth && isCurrentYear ? soldInM : null);
          } else {
            historicalSales.push(null);
            const baseQty = priorMonthAverage[m] > 0 ? priorMonthAverage[m] : Math.max(12, Math.round(prod.stock * 0.8));
            const weather = getWeatherMultiplier(m, prod.category);
            const cohort = getCohortTurnoverMultiplier(m);
            const predicted = Math.max(3, Math.round(baseQty * weather * cohort));
            predictedSales.push(predicted);
          }
        }

        return {
          product: prod,
          historicalSales,
          predictedSales,
          currentMonthForecastTotal: (predictedSales[currentMonth] || historicalSales[currentMonth] || 0) as number,
          restockCountPerPoint,
          color
        };
      });

      return {
        timeframe: 'year',
        labels,
        isFuturePoint,
        restockEvents,
        productsData,
        totalForecastThisMonth: productsData.reduce((sum, p) => sum + p.currentMonthForecastTotal, 0),
        weatherFactorSummary: 'Ajustement météo : Chaud en hausse l\'hiver (+45%), Frais en hausse au printemps (+35%)',
        turnoverFactorSummary: 'Renouvellement générationnel : 3 classes entrantes en septembre (+15%), 3 terminales sortantes en juin'
      };
    } else {
      const numMonth = Number(month);
      const daysInMonth = new Date(year, numMonth + 1, 0).getDate();
      const currentDay = (isCurrentYear && numMonth === currentMonth) ? now.getDate() : (isPastYear ? daysInMonth : 1);

      const labels: string[] = [];
      const isFuturePoint: boolean[] = [];

      for (let day = 1; day <= daysInMonth; day++) {
        labels.push(`${day} ${monthNames[numMonth]}`);
        isFuturePoint.push((isCurrentYear && numMonth === currentMonth) ? day > currentDay : !isPastYear);
      }

      const restockEvents: { label: string; count: number; products: string[] }[] = [];
      for (let day = 1; day <= daysInMonth; day++) {
        const dRestocks = restocks.filter(r => {
          const d = new Date(r.timestamp);
          return d.getFullYear() === year && d.getMonth() === numMonth && d.getDate() === day;
        });
        const count = dRestocks.reduce((sum, r) => sum + r.quantityAdded, 0);
        const prodNames = Array.from(new Set(dRestocks.map(r => r.productName)));
        restockEvents.push({ label: `${day} ${monthNames[numMonth]}`, count, products: prodNames });
      }

      let totalForecastThisMonth = 0;

      const productsData = products.map((prod, pIdx) => {
        const color = palette[pIdx % palette.length];
        const historicalSales: (number | null)[] = [];
        const predictedSales: (number | null)[] = [];
        const restockCountPerPoint: number[] = [];

        let pastTotalSold = 0;
        let pastDaysCount = 0;

        for (let day = 1; day <= daysInMonth; day++) {
          const dSales = sales.filter(s => {
            const d = new Date(s.timestamp);
            return d.getFullYear() === year && d.getMonth() === numMonth && d.getDate() === day;
          });
          let soldToday = 0;
          dSales.forEach(s => {
            const it = s.items.find(i => i.productId === prod.id);
            if (it) soldToday += it.quantity;
          });

          const dRestocks = restocks.filter(r => {
            const d = new Date(r.timestamp);
            return d.getFullYear() === year && d.getMonth() === numMonth && d.getDate() === day && r.productId === prod.id;
          });
          const restockQty = dRestocks.reduce((sum, r) => sum + r.quantityAdded, 0);
          restockCountPerPoint.push(restockQty);

          const isFuture = (isCurrentYear && numMonth === currentMonth) ? day > currentDay : !isPastYear;

          if (!isFuture) {
            historicalSales.push(soldToday);
            pastTotalSold += soldToday;
            pastDaysCount++;
          }
        }

        const rawDailyRate = pastDaysCount > 0 ? (pastTotalSold / pastDaysCount) : 1.2;
        const weather = getWeatherMultiplier(numMonth, prod.category);
        const cohort = getCohortTurnoverMultiplier(numMonth);
        const projectedDailyRate = Number((Math.max(0.2, rawDailyRate * weather * cohort)).toFixed(2));

        let forecastRemaining = 0;

        for (let day = 1; day <= daysInMonth; day++) {
          const isFuture = (isCurrentYear && numMonth === currentMonth) ? day > currentDay : !isPastYear;
          if (!isFuture) {
            if (day === currentDay && isCurrentYear && numMonth === currentMonth) {
              predictedSales.push(historicalSales[day - 1]);
            } else {
              predictedSales.push(null);
            }
          } else {
            historicalSales.push(null);
            const dateObj = new Date(year, numMonth, day);
            const dayOfWeek = dateObj.getDay();
            let dayWeight = 1.0;
            if (dayOfWeek === 0) dayWeight = 0;
            else if (dayOfWeek === 6) dayWeight = 0.3;
            else if (dayOfWeek === 3) dayWeight = 0.7;
            else if (dayOfWeek === 4 || dayOfWeek === 5) dayWeight = 1.25;

            const dayPred = Math.round(projectedDailyRate * dayWeight);
            predictedSales.push(dayPred);
            forecastRemaining += dayPred;
          }
        }

        const totalMonthProjected = pastTotalSold + forecastRemaining;
        totalForecastThisMonth += totalMonthProjected;

        return {
          product: prod,
          historicalSales,
          predictedSales,
          currentMonthForecastTotal: totalMonthProjected,
          restockCountPerPoint,
          color
        };
      });

      return {
        timeframe: 'month',
        labels,
        isFuturePoint,
        restockEvents,
        productsData,
        totalForecastThisMonth,
        weatherFactorSummary: 'Modulation météo : Chaud en hausse l\'hiver (+45%), Frais en hausse au printemps (+35%)',
        turnoverFactorSummary: 'Démographie : rotation de 3 classes (rentrée active en sept-oct, départs fin mai)'
      };
    }
  }
}

export const catalogService = new CatalogService();
