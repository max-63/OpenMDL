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
  PolarAreaController,
  RadialLinearScale,
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
  PolarAreaController,
  RadialLinearScale,
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
  private static activeCharts: Map<string, Chart<any, any, any>> = new Map();

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
  ): Chart<any, any, any> {
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
                if (dp.isRestockEvent) return `[Réapprovisionnement] Reçu : +${dp.restockCount} unités`;
                return '';
              },
              label: (context) => {
                const idx = context.dataIndex;
                const dp = evolution.dataPoints[idx];
                if (context.datasetIndex === 0) {
                  const alertTxt = dp.stockLevel <= dp.minStockAlert ? ' [Seuil critique]' : ' [OK]';
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
  // 1b. COMBO CHART : PRÉDICTION DES VENTES MULTI-PRODUITS + RESTOCKS
  // =========================================================================
  public static createMultiProductPredictionChart(
    canvas: HTMLCanvasElement,
    predictionData: ReturnType<typeof db.getMultiProductSalesPrediction>,
    isDark: boolean
  ): Chart<any, any, any> {
    const chartId = canvas.id || 'multi-product-prediction-chart';
    this.destroyExisting(chartId);

    const textColor = isDark ? '#94a3b8' : '#64748b';
    const gridColor = isDark ? '#1e293b' : '#f1f5f9';

    // 1. Dataset Bar : Restocks consolidés reçus (barres verticales bien visibles)
    const restockCounts = predictionData.restockEvents.map(e => e.count);
    const hasAnyRestock = restockCounts.some(c => c > 0);

    const datasets: any[] = [
      {
        type: 'bar',
        label: 'Livraisons / Restocks reçus (unités)',
        data: restockCounts,
        backgroundColor: isDark ? 'rgba(16, 185, 129, 0.40)' : 'rgba(16, 185, 129, 0.35)',
        borderColor: '#10b981',
        borderWidth: 2,
        borderRadius: 6,
        barPercentage: 0.45,
        yAxisID: 'yRestock',
        order: 10
      }
    ];

    // 2. Datasets Line pour chaque produit du foyer :
    // - Ventes réelles observées (ligne continue)
    // - Projection prédictive (ligne pointillée avec halo)
    predictionData.productsData.forEach(p => {
      // Série continue historique
      datasets.push({
        type: 'line',
        label: `${p.product.name} (Réel)`,
        data: p.historicalSales,
        borderColor: p.color,
        backgroundColor: 'transparent',
        borderWidth: 2.2,
        pointRadius: 3,
        pointHoverRadius: 6,
        tension: 0.25,
        yAxisID: 'y',
        order: 1
      });

      // Série prédictive pointillée
      datasets.push({
        type: 'line',
        label: `${p.product.name} (Prédiction)`,
        data: p.predictedSales,
        borderColor: p.color,
        borderDash: [5, 4],
        backgroundColor: 'transparent',
        borderWidth: 2.2,
        pointRadius: 3.5,
        pointHoverRadius: 7,
        pointStyle: 'triangle',
        tension: 0.3,
        yAxisID: 'y',
        order: 2
      });
    });

    const chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: predictionData.labels,
        datasets
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
              boxWidth: 10,
              font: { family: 'Inter', size: 10.5, weight: 600 },
              color: textColor,
              padding: 8,
              usePointStyle: true,
              filter: (item) => {
                // Afficher le restock et regrouper par produit sans doublon légendaire
                if (item.text.includes('(Prédiction)')) return false;
                return true;
              }
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
                const label = predictionData.labels[idx];
                const isFut = predictionData.isFuturePoint[idx];
                return `${label} ${isFut ? '[Projection future]' : '[Historique réel]'}`;
              },
              afterTitle: (items) => {
                const idx = items[0].dataIndex;
                const ev = predictionData.restockEvents[idx];
                if (ev && ev.count > 0) {
                  return `[Livraison / Restock] +${ev.count} unités (${ev.products.slice(0, 3).join(', ')}${ev.products.length > 3 ? '...' : ''})`;
                }
                return '';
              },
              label: (context) => {
                const val = context.raw;
                if (val === null || val === undefined) return '';
                if (context.dataset.yAxisID === 'yRestock') {
                  return ` Restock total : +${val} unités`;
                }
                const label = context.dataset.label || '';
                return ` ${label} : ${val} vendus`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: gridColor },
            ticks: {
              color: textColor,
              font: { family: 'Inter', size: 10.5, weight: 500 },
              maxRotation: 45
            }
          },
          y: {
            position: 'left',
            grid: { color: gridColor },
            beginAtZero: true,
            ticks: {
              color: textColor,
              font: { family: 'JetBrains Mono', size: 10 },
              callback: (val) => `${val} u`
            },
            title: {
              display: true,
              text: 'Ventes / jour ou mois (unités)',
              color: textColor,
              font: { family: 'Inter', size: 10, weight: 600 }
            }
          },
          yRestock: {
            position: 'right',
            grid: { display: false },
            beginAtZero: true,
            ticks: {
              color: '#10b981',
              font: { family: 'JetBrains Mono', size: 9.5 },
              callback: (val) => `+${val} r`
            },
            title: {
              display: hasAnyRestock,
              text: 'Unités restockées',
              color: '#10b981',
              font: { family: 'Inter', size: 10, weight: 600 }
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
  ): { chart: Chart<any, any, any>; stats: { cogs: number; perksCost: number; netMargin: number; totalRevenue: number } } {
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
  // 2b. DOUGHNUT / CAMEMBERT : PRODUITS LES PLUS VENDUS (TOP ARTICLES)
  // =========================================================================
  public static createTopProductsPieChart(
    canvas: HTMLCanvasElement,
    sales: Sale[],
    products: Product[],
    isDark: boolean
  ): Chart<any, any, any> {
    const chartId = canvas.id || 'top-products-chart';
    this.destroyExisting(chartId);

    // Définition des couleurs des familles (anneau intérieur)
    // Boissons = Bleu (#0284c7)
    // Snacks = Orange (#ea580c)
    // Bonbons = Rose/Magenta (#db2777)
    // Chaud = Violet (#7c3aed)
    // Divers = Émeraude (#059669)
    const categoryInfo: Record<string, { label: string; baseColor: string; baseHue: number }> = {
      boissons: { label: 'Boissons', baseColor: '#0284c7', baseHue: 200 },
      snacks: { label: 'Snacks', baseColor: '#ea580c', baseHue: 25 },
      bonbons: { label: 'Bonbons', baseColor: '#db2777', baseHue: 330 },
      chaud: { label: 'Boissons chaudes', baseColor: '#7c3aed', baseHue: 270 },
      autre: { label: 'Divers', baseColor: '#059669', baseHue: 155 }
    };

    // Nuances de la même famille de couleur pour les articles (harmonieux, dégradés comme avant)
    const generateProductColors = (baseHue: number, count: number): string[] => {
      const colors: string[] = [];
      for (let i = 0; i < count; i++) {
        // Variation progressive de la luminosité et de la teinte dans la gamme de la famille
        const hueShift = count > 1 ? ((i / count) * 30 - 15) : 0;
        const finalHue = Math.round((baseHue + hueShift + 360) % 360);
        const sat = 70 + ((i * 5) % 25);
        // Échelonnage de la luminosité pour bien distinguer les articles voisins
        const light = count > 1 ? 40 + Math.round((i / (count - 1)) * 30) : 50;
        colors.push(`hsl(${finalHue}, ${sat}%, ${light}%)`);
      }
      return colors;
    };

    // Agrégation des ventes par produit avec détection de la catégorie
    // Initialisation avec TOUS les produits du catalogue (actifs) pour qu'aucun article ne disparaisse même si ventes = 0
    const productStats = new Map<string, {
      name: string;
      category: string;
      quantity: number;
      revenue: number;
      costPrice: number;
      unitPrice: number;
      unitMargin: number;
      marginRate: number;
    }>();

    // 1. Enregistrer tous les produits du catalogue avec leurs prix et marges réelles
    products.filter(p => p.isActive).forEach(p => {
      const uMargin = Math.max(0.10, Number((p.price - p.costPrice).toFixed(2)));
      const mRate = p.price > 0 ? Math.round((uMargin / p.price) * 100) : 50;
      productStats.set(p.id, {
        name: p.name,
        category: p.category,
        quantity: 0,
        revenue: 0,
        costPrice: p.costPrice,
        unitPrice: p.price,
        unitMargin: uMargin,
        marginRate: mRate
      });
    });

    // 2. Cumuler les ventes enregistrées
    sales.forEach(sale => {
      sale.items.forEach(item => {
        const prod = products.find(p => p.id === item.productId);
        const cat = prod?.category || 'autre';
        const key = item.productId || item.productName;

        const existing = productStats.get(key);
        if (existing) {
          existing.quantity += item.quantity;
          existing.revenue += item.quantity * item.unitPrice;
        } else {
          const cost = prod ? prod.costPrice : (item.unitPrice * 0.5);
          const uMargin = Math.max(0.10, Number((item.unitPrice - cost).toFixed(2)));
          const mRate = item.unitPrice > 0 ? Math.round((uMargin / item.unitPrice) * 100) : 50;
          productStats.set(key, {
            name: prod?.name || item.productName || 'Article',
            category: cat,
            quantity: item.quantity,
            revenue: item.quantity * item.unitPrice,
            costPrice: cost,
            unitPrice: item.unitPrice,
            unitMargin: uMargin,
            marginRate: mRate
          });
        }
      });
    });

    // Ordonner les catégories de manière déterministe
    const categoryOrder = ['boissons', 'snacks', 'bonbons', 'chaud', 'autre'];
    
    // Regrouper les produits par catégorie pour qu'ils soient TOUS côte à côte
    const catLabels: string[] = [];
    const catData: number[] = [];
    const catColors: string[] = [];
    const catRevenues: number[] = [];

    const prodLabels: string[] = [];
    const prodData: number[] = [];
    const prodColors: string[] = [];
    const prodRevenues: number[] = [];
    const prodCategoryNames: string[] = [];
    const prodUnitMargins: number[] = [];
    const prodMarginRates: number[] = [];

    categoryOrder.forEach(catKey => {
      const prodsInCat = Array.from(productStats.values())
        .filter(p => p.category === catKey)
        .sort((a, b) => b.quantity - a.quantity || b.unitMargin - a.unitMargin);

      if (prodsInCat.length > 0) {
        // Quantité de ventes (ou baseline minimale pour affichage si catalogue vierge)
        const catTotalQty = Math.max(prodsInCat.length, prodsInCat.reduce((sum, p) => sum + p.quantity, 0));
        const catTotalRev = prodsInCat.reduce((sum, p) => sum + p.revenue, 0);
        const info = categoryInfo[catKey] || categoryInfo['autre'];

        catLabels.push(info.label);
        catData.push(catTotalQty);
        catColors.push(info.baseColor);
        catRevenues.push(catTotalRev);

        const dynamicColors = generateProductColors(info.baseHue, prodsInCat.length);

        prodsInCat.forEach((p, idx) => {
          prodLabels.push(p.name);
          // Si aucune vente enregistrée, attribuer une valeur équitable proportionnelle pour que le chart s'affiche quand même
          prodData.push(p.quantity > 0 ? p.quantity : 1);
          prodRevenues.push(p.revenue);
          prodCategoryNames.push(info.label);
          prodColors.push(dynamicColors[idx]);
          prodUnitMargins.push(p.unitMargin);
          prodMarginRates.push(p.marginRate);
        });
      }
    });

    // Données complètes des produits
    const allProdLabels = [...prodLabels];
    const allProdData = [...prodData];
    const allProdColors = [...prodColors];
    const allProdRevenues = [...prodRevenues];
    const allProdCategoryNames = [...prodCategoryNames];

    // Association index produit -> clé de catégorie
    const prodCatKeys: string[] = [];
    categoryOrder.forEach(catKey => {
      const prodsInCat = Array.from(productStats.values())
        .filter(p => p.category === catKey)
        .sort((a, b) => b.quantity - a.quantity);
      prodsInCat.forEach(() => {
        prodCatKeys.push(catKey);
      });
    });

    const activeCatKeys: string[] = [];
    categoryOrder.forEach(catKey => {
      const count = Array.from(productStats.values()).filter(p => p.category === catKey).length;
      if (count > 0) activeCatKeys.push(catKey);
    });

    // Total de chaque catégorie pour calculer les proportions exactes
    const catTotalsMap = new Map<string, number>();
    categoryOrder.forEach(catKey => {
      const prodsInCat = Array.from(productStats.values()).filter(p => p.category === catKey);
      const sum = prodsInCat.reduce((acc, p) => acc + p.quantity, 0);
      catTotalsMap.set(catKey, sum);
    });

    // État interactif
    let isAllVisible = false; // Mode affichage complet (déclenché au clic central)
    let hoveredCatIndex: number | null = null; // Catégorie survolée

    // Calcul de l'échelle d'expansion radiale (effet Polar Area) selon la marge unitaire :
    // Un produit avec 0.60€ de marge (ex: Ice Tea/Lipton) s'élargit et ressort 2x plus qu'un produit avec 0.30€ de marge (ex: Coca)
    const maxUnitMargin = Math.max(...prodUnitMargins, 0.50);
    const prodHoverOffsets = prodUnitMargins.map(m => {
      const ratio = Math.max(0.3, m / maxUnitMargin);
      return Math.round(6 + ratio * 14); // 6px à 20px d'élévation radiale selon la rentabilité
    });

    // Construction du dataset extérieur de manière à ce que les produits occupent STRICTEMENT
    // la portion d'arc de leur catégorie, et que les autres catégories soient remplies par un segment invisible.
    const buildProductDataset = () => {
      if (allProdData.length === 0) {
        return {
          data: [0],
          backgroundColor: ['transparent'],
          borderColor: ['transparent'],
          borderWidth: 0,
          weight: 2.6,
          hoverOffset: 0
        };
      }

      if (isAllVisible) {
        return {
          data: allProdData,
          backgroundColor: allProdColors,
          borderColor: isDark ? '#0b111e' : '#ffffff',
          borderWidth: 2,
          weight: 2.6,
          hoverOffset: prodHoverOffsets
        };
      }

      if (hoveredCatIndex !== null && activeCatKeys[hoveredCatIndex]) {
        const targetCat = activeCatKeys[hoveredCatIndex];
        return {
          data: allProdData,
          backgroundColor: allProdColors.map((col, i) => prodCatKeys[i] === targetCat ? col : 'transparent'),
          borderColor: allProdColors.map((_, i) => prodCatKeys[i] === targetCat ? (isDark ? '#0b111e' : '#ffffff') : 'transparent'),
          borderWidth: 2,
          weight: 2.6,
          hoverOffset: prodHoverOffsets.map((off, i) => prodCatKeys[i] === targetCat ? off : 0)
        };
      }

      // Par défaut : anneau des produits masqué (tranches transparentes pour préserver la géométrie)
      return {
        data: allProdData,
        backgroundColor: allProdData.map(() => 'transparent'),
        borderColor: allProdData.map(() => 'transparent'),
        borderWidth: 0,
        weight: 2.6,
        hoverOffset: 0
      };
    };

    const initialProdDataset = buildProductDataset();
    const totalQty = allProdData.reduce((sum, q) => sum + q, 0);

    // Plugin personnalisé pour le texte central cliquable
    const centerClickPlugin = {
      id: 'centerTextPlugin',
      beforeDraw: (ch: any) => {
        const { ctx, width, height } = ch;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const centerX = width / 2;
        const centerY = height / 2;

        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.fillStyle = isDark ? '#e2e8f0' : '#1e293b';
        ctx.fillText(isAllVisible ? 'Masquer' : 'Tout voir', centerX, centerY - 7);

        ctx.font = '500 9px Inter, sans-serif';
        ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
        ctx.fillText('Clic centre', centerX, centerY + 8);
        ctx.restore();
      }
    };

    const chart = new Chart(canvas, {
      type: 'doughnut',
      plugins: [centerClickPlugin],
      data: {
        labels: allProdLabels.length > 0 ? allProdLabels : ['Articles'],
        datasets: [
          // Anneau extérieur : Produits (avec effet Polar Area / hauteur proportionnelle à la marge unitaire)
          {
            label: 'Articles',
            data: initialProdDataset.data,
            backgroundColor: initialProdDataset.backgroundColor,
            borderColor: initialProdDataset.borderColor,
            borderWidth: initialProdDataset.borderWidth,
            weight: 2.6,
            hoverOffset: initialProdDataset.hoverOffset
          },
          // Anneau intérieur : Catégories
          {
            label: 'Familles',
            data: catData.length > 0 ? catData : [0],
            backgroundColor: catColors.length > 0 ? catColors : ['#64748b'],
            borderColor: isDark ? '#0b111e' : '#ffffff',
            borderWidth: 1.5,
            weight: 1.0,
            hoverOffset: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '52%',
        animation: {
          duration: 200
        },
        onHover: (_evt, activeElements) => {
          if (isAllVisible) return;

          let newHoveredCatIndex: number | null = null;
          if (activeElements && activeElements.length > 0) {
            const el = activeElements[0];
            if (el.datasetIndex === 1) {
              newHoveredCatIndex = el.index;
            } else if (el.datasetIndex === 0) {
              const catKey = prodCatKeys[el.index];
              newHoveredCatIndex = activeCatKeys.indexOf(catKey);
            }
          }

          if (newHoveredCatIndex !== hoveredCatIndex) {
            hoveredCatIndex = newHoveredCatIndex;
            const updated = buildProductDataset();
            chart.data.datasets[0].data = updated.data;
            chart.data.datasets[0].backgroundColor = updated.backgroundColor;
            chart.data.datasets[0].borderColor = updated.borderColor;
            chart.data.datasets[0].borderWidth = updated.borderWidth;
            chart.data.datasets[0].hoverOffset = updated.hoverOffset;
            chart.update('none');
          }
        },
        onClick: (evt) => {
          const rect = canvas.getBoundingClientRect();
          const clickX = evt.native ? (evt.native as MouseEvent).clientX - rect.left : 0;
          const clickY = evt.native ? (evt.native as MouseEvent).clientY - rect.top : 0;
          const centerX = rect.width / 2;
          const centerY = rect.height / 2;
          const dist = Math.hypot(clickX - centerX, clickY - centerY);

          const innerRadius = (Math.min(rect.width, rect.height) / 2) * 0.45;

          // Clic dans la zone centrale du doughnut
          if (dist <= innerRadius) {
            isAllVisible = !isAllVisible;
            hoveredCatIndex = null;
            const updated = buildProductDataset();
            chart.data.datasets[0].data = updated.data;
            chart.data.datasets[0].backgroundColor = updated.backgroundColor;
            chart.data.datasets[0].borderColor = updated.borderColor;
            chart.data.datasets[0].borderWidth = updated.borderWidth;
            chart.data.datasets[0].hoverOffset = updated.hoverOffset;
            chart.update();
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: isDark ? '#0b111e' : '#ffffff',
            titleColor: isDark ? '#f8fafc' : '#0f172a',
            bodyColor: isDark ? '#cbd5e1' : '#334155',
            borderColor: isDark ? '#334155' : '#e2e8f0',
            borderWidth: 1,
            padding: 10,
            cornerRadius: 10,
            displayColors: true,
            filter: (item) => {
              if (!item) return false;
              // Masquer les infobulles des segments masqués (transparentes)
              if (item.datasetIndex === 0) {
                if (!isAllVisible && hoveredCatIndex !== null) {
                  const targetCat = activeCatKeys[hoveredCatIndex];
                  return prodCatKeys[item.dataIndex] === targetCat;
                }
                return isAllVisible;
              }
              return true;
            },
            callbacks: {
              title: (items) => {
                if (!items || items.length === 0 || !items[0]) return '';
                const item = items[0];
                if (item.datasetIndex === 0) {
                  return `Article : ${allProdLabels[item.dataIndex] || 'Inconnu'}`;
                } else {
                  return `Famille : ${catLabels[item.dataIndex] || 'Famille'}`;
                }
              },
              label: (context) => {
                if (!context) return '';
                const isOuter = context.datasetIndex === 0;
                const idx = context.dataIndex;
                const qty = allProdData[idx] ?? 0;
                const catQty = catData[idx] ?? 0;

                if (isOuter) {
                  const rev = allProdRevenues[idx] ?? 0;
                  const uMargin = prodUnitMargins[idx] ?? 0;
                  const mRate = prodMarginRates[idx] ?? 0;
                  const catKey = prodCatKeys[idx];
                  const catTotal = catTotalsMap.get(catKey) || 0;
                  const pctOfCat = catTotal > 0 ? Math.round((qty / catTotal) * 100) : 0;
                  const catName = allProdCategoryNames[idx] || '';

                  return [
                    ` Famille : ${catName}`,
                    ` Marge Unitaire : +${uMargin.toFixed(2)} € / unité (${mRate}% marge)`,
                    ` Hauteur Polar : Rayon proportionnel à la marge`,
                    ` Volume vendu : ${qty > 0 ? `${qty} unités (${pctOfCat}%)` : 'Disponible au catalogue'}`,
                    ` Recette générée : ${rev.toFixed(2)} €`
                  ];
                } else {
                  const rev = catRevenues[idx] ?? 0;
                  const pct = totalQty > 0 ? Math.round((catQty / totalQty) * 100) : 0;
                  return [
                    ` Total famille : ${catQty} unités (${pct}%)`,
                    ` Recette globale : ${rev.toFixed(2)} €`,
                    ` [Action] Survolez pour voir les articles et leur hauteur marge`
                  ];
                }
              },
              labelColor: (context) => {
                const isOuter = context.datasetIndex === 0;
                const idx = context.dataIndex;
                const color = isOuter
                  ? (allProdColors[idx] || '#3b82f6')
                  : (catColors[idx] || '#64748b');
                return {
                  borderColor: isDark ? '#0b111e' : '#ffffff',
                  backgroundColor: color,
                  borderWidth: 1,
                  borderRadius: 2
                };
              }
            }
          }
        }
      }
    });

    this.activeCharts.set(chartId, chart);
    return chart;
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
  ): Chart<any, any, any> {
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
            label: "5. Dépassement / Déficit (DÉPASSE DE LA BARRE) (€)",
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
                  text += `[DÉFICIT] : -${Math.abs(netProfit).toFixed(2)} € (Frais + Consos > Marge !)`;
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
