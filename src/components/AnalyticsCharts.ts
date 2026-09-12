import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  Title,
  CategoryScale,
  Tooltip,
  Legend,
  DoughnutController,
  ArcElement,
  BarController,
  BarElement,
  Filler
} from 'chart.js';
import { Product, Sale, VolunteerPerk, ProductStockEvolution } from '../types';
import { db } from '../services/db';

// Enregistrement modulaire des composants Chart.js
Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  Title,
  CategoryScale,
  Tooltip,
  Legend,
  DoughnutController,
  ArcElement,
  BarController,
  BarElement,
  Filler
);

/**
 * Génère un motif de hachures canvas pour Chart.js
 */
function createHatchPattern(strokeColor: string, bgColor: string, lineWidth: number = 2.5): CanvasPattern | string {
  if (typeof document === 'undefined') return strokeColor;
  const pCanvas = document.createElement('canvas');
  pCanvas.width = 12;
  pCanvas.height = 12;
  const pCtx = pCanvas.getContext('2d');
  if (!pCtx) return strokeColor;

  pCtx.fillStyle = bgColor;
  pCtx.fillRect(0, 0, 12, 12);

  pCtx.strokeStyle = strokeColor;
  pCtx.lineWidth = lineWidth;
  pCtx.beginPath();
  pCtx.moveTo(0, 12);
  pCtx.lineTo(12, 0);
  pCtx.stroke();

  return pCtx.createPattern(pCanvas, 'repeat') || strokeColor;
}

export class AnalyticsCharts {
  private static activeCharts: Map<string, Chart> = new Map();

  private static destroyExisting(chartId: string): void {
    if (this.activeCharts.has(chartId)) {
      try {
        this.activeCharts.get(chartId)?.destroy();
      } catch (e) {
        console.warn('Erreur lors de la destruction du chart:', e);
      }
      this.activeCharts.delete(chartId);
    }
  }

  // =========================================================================
  // 1. LINE CHART : ÉVOLUTION DYNAMIQUE DES STOCKS DU PRODUIT SÉLECTIONNÉ
  // =========================================================================
  public static createProductStockEvolutionChart(
    canvas: HTMLCanvasElement,
    evolution: ProductStockEvolution,
    isDark: boolean
  ): Chart {
    const chartId = canvas.id || 'stock-evolution-chart';
    this.destroyExisting(chartId);

    if (!evolution || !evolution.product || !evolution.dataPoints || evolution.dataPoints.length === 0) {
      const emptyChart = new Chart(canvas, {
        type: 'line',
        data: {
          labels: ['Aucun produit'],
          datasets: [{
            label: 'Stock',
            data: [0],
            borderColor: '#94a3b8'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false
        }
      });
      this.activeCharts.set(chartId, emptyChart);
      return emptyChart;
    }

    const labels = evolution.dataPoints.map(dp => dp.label);
    const stockLevels = evolution.dataPoints.map(dp => dp.stockLevel);
    const thresholdData = evolution.dataPoints.map(dp => dp.minStockAlert);

    const textColor = isDark ? '#94a3b8' : '#64748b';
    const gridColor = isDark ? '#1e293b' : '#f1f5f9';

    const pointBackgroundColors = evolution.dataPoints.map(dp => {
      if (dp.isRestockEvent) return '#10b981'; // Vert vif pour les réapprovisionnements (montée)
      if (dp.isAlertEvent) return '#f43f5e'; // Rouge rose vif si alerte / seuil critique franchi
      return '#ea580c'; // Orange solide
    });

    const pointBorderColors = evolution.dataPoints.map(dp => {
      if (dp.isRestockEvent) return isDark ? '#064e3b' : '#ecfdf5';
      if (dp.isAlertEvent) return isDark ? '#4c0519' : '#fff1f2';
      return isDark ? '#0f172a' : '#ffffff';
    });

    const pointRadii = evolution.dataPoints.map(dp => {
      if (dp.isRestockEvent) return 6;
      if (dp.isAlertEvent) return 5;
      return 3;
    });

    const chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: `Stock ${evolution.product.name} (unités)`,
            data: stockLevels,
            borderColor: '#ea580c', // Orange pur moderne
            backgroundColor: isDark ? 'rgba(234, 88, 12, 0.12)' : 'rgba(234, 88, 12, 0.06)',
            borderWidth: 2.5,
            pointBackgroundColor: pointBackgroundColors,
            pointBorderColor: pointBorderColors,
            pointBorderWidth: 2,
            pointRadius: pointRadii,
            pointHoverRadius: 7.5,
            tension: 0.25,
            fill: true
          },
          {
            label: `Seuil d'alerte critique (${evolution.product.minStockAlert} u)`,
            data: thresholdData,
            borderColor: '#f43f5e',
            borderDash: [5, 4],
            backgroundColor: 'transparent',
            borderWidth: 2,
            pointRadius: 0,
            tension: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              boxWidth: 12,
              font: { family: 'Inter', size: 11, weight: 600 },
              color: textColor,
              padding: 12
            }
          },
          tooltip: {
            backgroundColor: isDark ? '#0b111e' : '#ffffff',
            titleColor: isDark ? '#f8fafc' : '#0f172a',
            bodyColor: isDark ? '#cbd5e1' : '#334155',
            borderColor: isDark ? '#334155' : '#e2e8f0',
            borderWidth: 1,
            padding: 12,
            cornerRadius: 12,
            callbacks: {
              title: (items) => {
                const idx = items[0].dataIndex;
                const dp = evolution.dataPoints[idx];
                return `${evolution.product.name} • ${dp.label}`;
              },
              afterTitle: (items) => {
                const idx = items[0].dataIndex;
                const dp = evolution.dataPoints[idx];
                if (dp.isRestockEvent) return `⚡ Réapprovisionnement reçu : +${dp.restockCount} unités`;
                return '';
              },
              label: (context) => {
                const idx = context.dataIndex;
                const dp = evolution.dataPoints[idx];
                if (context.datasetIndex === 0) {
                  const alertTxt = dp.stockLevel <= dp.minStockAlert ? ' (⚠️ Seuil critique)' : ' (OK)';
                  return ` Niveau de stock : ${dp.stockLevel} unités${alertTxt}`;
                }
                return ` Seuil minimal de sécurité : ${dp.minStockAlert} unités`;
              },
              afterBody: (items) => {
                const idx = items[0].dataIndex;
                const dp = evolution.dataPoints[idx];
                const lines: string[] = [];
                if (dp.soldCount > 0) lines.push(`Ventes enregistrées : -${dp.soldCount} u`);
                if (dp.restockCount > 0) lines.push(`Réapprovisionné : +${dp.restockCount} u`);
                return lines;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: textColor,
              font: { family: 'Inter', size: 10, weight: 500 },
              maxRotation: 45,
              minRotation: 0
            }
          },
          y: {
            grid: { color: gridColor },
            beginAtZero: true,
            ticks: {
              color: textColor,
              font: { family: 'JetBrains Mono', size: 10 },
              callback: (val) => `${val} u`
            }
          }
        }
      }
    });

    this.activeCharts.set(chartId, chart);
    return chart;
  }

  // =========================================================================
  // 2. DOUGHNUT CHART : CE MOIS-CI (Coûts d'achat vs Consos Bénévoles vs Marges)
  // =========================================================================
  public static createMonthlyFinancialsDoughnutChart(
    canvas: HTMLCanvasElement,
    sales: Sale[],
    perks: VolunteerPerk[],
    products: Product[],
    isDark: boolean
  ): { chart: Chart; stats: { cogs: number; perksCost: number; netMargin: number; totalRevenue: number } } {
    const chartId = canvas.id || 'monthly-financials-doughnut';
    this.destroyExisting(chartId);

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const monthSales = sales.filter(s => {
      const d = new Date(s.timestamp);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    });

    const monthPerks = perks.filter(p => {
      const d = new Date(p.timestamp || p.date);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    });

    let totalRevenue = 0;
    let cogs = 0;

    monthSales.forEach(s => {
      totalRevenue += s.totalAmount;
      s.items.forEach(it => {
        const prod = products.find(p => p.id === it.productId);
        const cost = prod ? prod.costPrice : (it.unitPrice * 0.5);
        cogs += cost * it.quantity;
      });
    });

    const perksCost = monthPerks.reduce((sum, p) => sum + p.costPrice, 0);
    const netMargin = Math.max(0, totalRevenue - cogs - perksCost);

    const textColor = isDark ? '#94a3b8' : '#64748b';

    const chart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['Coût initial marchandises', 'Marge bénéficiaire nette', 'Coût consos bénévoles'],
        datasets: [
          {
            data: [
              Number(cogs.toFixed(2)),
              Number(netMargin.toFixed(2)),
              Number(perksCost.toFixed(2))
            ],
            backgroundColor: [
              '#0284c7', // Bleu Sky (Achat initial)
              '#10b981', // Émeraude (Marge nette foyer)
              '#ec4899'  // Rose (Consos bénévoles offertes)
            ],
            borderColor: isDark ? '#0b111e' : '#ffffff',
            borderWidth: 2.5,
            hoverOffset: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 10,
              font: { family: 'Inter', size: 10, weight: 600 },
              color: textColor,
              padding: 12
            }
          },
          tooltip: {
            backgroundColor: isDark ? '#0b111e' : '#ffffff',
            titleColor: isDark ? '#f8fafc' : '#0f172a',
            bodyColor: isDark ? '#cbd5e1' : '#334155',
            borderColor: isDark ? '#334155' : '#e2e8f0',
            borderWidth: 1,
            padding: 10,
            cornerRadius: 10,
            callbacks: {
              label: (context) => {
                const val = context.raw as number;
                const total = totalRevenue > 0 ? totalRevenue : (cogs + netMargin + perksCost);
                const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                return ` ${context.label}: ${val.toFixed(2)} € (${pct}%)`;
              }
            }
          }
        }
      }
    });

    this.activeCharts.set(chartId, chart);
    return { chart, stats: { cogs, perksCost, netMargin, totalRevenue } };
  }

  // =========================================================================
  // 3. BAR CHART : COMPARAISON MENSUELLE AVEC CONSOS BÉNÉVOLES HACHURÉES SUR LA BARRE
  // =========================================================================
  public static createYearlyMonthlyStackedBarChart(
    canvas: HTMLCanvasElement,
    sales: Sale[],
    perks: VolunteerPerk[],
    products: Product[],
    isDark: boolean
  ): Chart {
    const chartId = canvas.id || 'yearly-monthly-bar-chart';
    this.destroyExisting(chartId);

    const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
    const currentYear = new Date().getFullYear();

    const monthlyCost = new Array(12).fill(0);
    const monthlyGrossMargin = new Array(12).fill(0);
    const monthlyPerks = new Array(12).fill(0);
    const monthlySumupFees = new Array(12).fill(0);

    const tpeSettings = db.getTpeSettings();
    const commissionRate = (tpeSettings?.commissionRate ?? 1.75) / 100;

    sales.forEach(s => {
      const d = new Date(s.timestamp);
      if (d.getFullYear() === currentYear) {
        const m = d.getMonth();
        let sCost = 0;
        s.items.forEach(it => {
          const prod = products.find(p => p.id === it.productId);
          const cost = prod ? prod.costPrice : (it.unitPrice * 0.5);
          sCost += cost * it.quantity;
        });
        monthlyCost[m] += sCost;
        monthlyGrossMargin[m] += Math.max(0, s.totalAmount - sCost);

        // Frais SumUp (1.75%) prélevés sur chaque encaissement TPE
        if (s.paymentMethod === 'tpe') {
          monthlySumupFees[m] += s.totalAmount * commissionRate;
        }
      }
    });

    perks.forEach(p => {
      const d = new Date(p.timestamp || p.date);
      if (d.getFullYear() === currentYear) {
        const m = d.getMonth();
        monthlyPerks[m] += p.costPrice;
      }
    });

    // Calcul précis des 5 couches de la barre :
    // 1. Coût initial à l'achat fournisseur (base bleue)
    // 2. Frais SumUp TPE (indigo/violet SumUp 1.75%)
    // 3. Marge nette restante conservée par le foyer (vert émeraude)
    // 4. Consos bénévoles prises sur la marge (rose hachuré SUR la barre)
    // 5. DÉPASSEMENT / DÉFICIT : si consos + frais dépassent la marge, ça DÉPASSE au-dessus de la barre en rouge vif hachuré !
    const baseCostData: number[] = [];
    const sumupFeesData: number[] = [];
    const netMarginData: number[] = [];
    const perksOnMarginData: number[] = [];
    const overflowDeficitData: number[] = [];

    for (let m = 0; m < 12; m++) {
      const c = monthlyCost[m];
      const gm = monthlyGrossMargin[m];
      const sf = monthlySumupFees[m];
      const p = monthlyPerks[m];

      baseCostData.push(Number(c.toFixed(2)));
      sumupFeesData.push(Number(sf.toFixed(2)));

      // Marge brute restante après déduction obligatoire des frais bancaires SumUp
      const marginAfterFees = Math.max(0, gm - sf);

      if (p <= marginAfterFees) {
        // Normal : les consos et les frais SumUp sont couverts par la marge
        netMarginData.push(Number((marginAfterFees - p).toFixed(2)));
        perksOnMarginData.push(Number(p.toFixed(2)));
        overflowDeficitData.push(0);
      } else {
        // ALERTE DÉPASSEMENT : les frais et les consos ont englouti toute la marge et dépassent au-dessus de la barre !
        netMarginData.push(0);
        perksOnMarginData.push(Number(marginAfterFees.toFixed(2)));
        overflowDeficitData.push(Number((p - marginAfterFees).toFixed(2)));
      }
    }

    // Motifs de hachures canvas
    const normalPerksPattern = createHatchPattern(
      '#ec4899', 
      isDark ? 'rgba(236, 72, 153, 0.28)' : 'rgba(236, 72, 153, 0.18)'
    );
    const overflowDeficitPattern = createHatchPattern(
      '#e11d48', 
      isDark ? 'rgba(225, 29, 72, 0.55)' : 'rgba(225, 29, 72, 0.35)', 
      3
    );

    const textColor = isDark ? '#94a3b8' : '#64748b';
    const gridColor = isDark ? '#1e293b' : '#f1f5f9';

    const chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: monthNames,
        datasets: [
          // 1. Couche 1 (Base) : Coût initial à l'achat fournisseur
          {
            label: "1. Coût initial à l'achat (€)",
            data: baseCostData,
            backgroundColor: '#0284c7', // Bleu Sky
            borderRadius: { topLeft: 0, topRight: 0, bottomLeft: 6, bottomRight: 6 },
            borderSkipped: false,
            stack: 'sales-bar',
            maxBarThickness: 34
          },
          // 2. Couche 2 : Frais SumUp (1.75% sur encaissements CB)
          {
            label: "2. Frais SumUp TPE (1.75%) (€)",
            data: sumupFeesData,
            backgroundColor: '#6366f1', // Indigo SumUp
            borderColor: '#4f46e5',
            borderWidth: 1,
            borderRadius: 0,
            borderSkipped: false,
            stack: 'sales-bar',
            maxBarThickness: 34
          },
          // 3. Couche 3 : Marge brute restante conservée par le foyer
          {
            label: "3. Marge nette conservée (€)",
            data: netMarginData,
            backgroundColor: '#10b981', // Émeraude vif
            borderRadius: 0,
            borderSkipped: false,
            stack: 'sales-bar',
            maxBarThickness: 34
          },
          // 4. Couche 4 : Consos bénévoles prises sur la marge (HACHURÉ SUR LA BARRE)
          {
            label: "4. Consos bénévoles (Hachuré sur marge) (€)",
            data: perksOnMarginData,
            backgroundColor: normalPerksPattern as any,
            borderColor: '#ec4899',
            borderWidth: 1.5,
            borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 },
            borderSkipped: false,
            stack: 'sales-bar',
            maxBarThickness: 34
          },
          // 5. Couche 5 : DÉPASSEMENT DÉFICIT DANGER (DÉPASSE de la barre des ventes si consos + frais > marge !)
          {
            label: "5. 🚨 Dépassement / Déficit (DÉPASSE DE LA BARRE) (€)",
            data: overflowDeficitData,
            backgroundColor: overflowDeficitPattern as any,
            borderColor: '#e11d48',
            borderWidth: 2,
            borderRadius: { topLeft: 8, topRight: 8, bottomLeft: 0, bottomRight: 0 },
            borderSkipped: false,
            stack: 'sales-bar',
            maxBarThickness: 34
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              boxWidth: 12,
              font: { family: 'Inter', size: 10.5, weight: 600 },
              color: textColor,
              padding: 12
            }
          },
          tooltip: {
            backgroundColor: isDark ? '#0b111e' : '#ffffff',
            titleColor: isDark ? '#f8fafc' : '#0f172a',
            bodyColor: isDark ? '#cbd5e1' : '#334155',
            borderColor: isDark ? '#334155' : '#e2e8f0',
            borderWidth: 1,
            padding: 12,
            cornerRadius: 10,
            callbacks: {
              footer: (items) => {
                const mIdx = items[0].dataIndex;
                const cost = monthlyCost[mIdx];
                const gm = monthlyGrossMargin[mIdx];
                const sumup = monthlySumupFees[mIdx];
                const perksTot = monthlyPerks[mIdx];
                const revenue = cost + gm;
                const netProfit = gm - sumup - perksTot;

                let text = `Prix de vente (CA total) : ${revenue.toFixed(2)} €\n`;
                text += `• Achat marchandises fournisseur : ${cost.toFixed(2)} €\n`;
                text += `• Frais bancaires SumUp (TPE 1.75%) : -${sumup.toFixed(2)} €\n`;
                text += `• Consos bénévoles offertes : -${perksTot.toFixed(2)} €\n`;
                if (netProfit < 0) {
                  text += `🚨 DÉFICIT : -${Math.abs(netProfit).toFixed(2)} € (Frais + Consos > Marge !)`;
                } else {
                  text += `Bénéfice net conservé par la MDL : +${netProfit.toFixed(2)} €`;
                }
                return text;
              }
            }
          }
        },
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            ticks: {
              color: textColor,
              font: { family: 'Inter', size: 11, weight: 600 }
            }
          },
          y: {
            stacked: true,
            grid: { color: gridColor },
            ticks: {
              color: textColor,
              font: { family: 'JetBrains Mono', size: 10 },
              callback: (val) => `${val} €`
            }
          }
        }
      }
    });

    this.activeCharts.set(chartId, chart);
    return chart;
  }
}
