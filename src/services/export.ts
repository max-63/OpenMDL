import { Sale, Session } from '../types';

export class ExportService {
  /**
   * Exporte toutes les ventes au format CSV pour Excel / LibreOffice
   */
  public static exportSalesToCSV(sales: Sale[]): void {
    if (sales.length === 0) {
      alert('Aucune vente à exporter pour le moment.');
      return;
    }

    const headers = ['ID Vente', 'Date & Heure', 'Bénévole', 'Mode de Paiement', 'Articles Vendus', 'Quantité Totale', 'Montant Total (€)'];
    const rows = sales.map(sale => {
      const itemsDetail = sale.items.map(i => `${i.quantity}x ${i.productName} (${i.unitPrice.toFixed(2)}€)`).join(' | ');
      const totalQty = sale.items.reduce((sum, i) => sum + i.quantity, 0);
      const dateFormatted = new Date(sale.timestamp).toLocaleString('fr-FR');

      return [
        `"${sale.id}"`,
        `"${dateFormatted}"`,
        `"${sale.volunteerName}"`,
        `"${sale.paymentMethod.toUpperCase()}"`,
        `"${itemsDetail.replace(/"/g, '""')}"`,
        totalQty,
        sale.totalAmount.toFixed(2).replace('.', ',') // Format français
      ].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
    this.downloadFile(csvContent, `OpenMDL_Ventes_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8;');
  }

  /**
   * Exporte l'historique des séances et incidents au format CSV
   */
  public static exportSessionsToCSV(sessions: Session[]): void {
    if (sessions.length === 0) {
      alert('Aucune séance clôturée à exporter.');
      return;
    }

    const headers = ['ID Séance', 'Début', 'Fin', 'Bénévole', 'Nb Ventes', 'Recette Espèces (€)', 'Recette TPE (€)', 'Total Recette (€)', 'Cahier Incidents & Notes'];
    const rows = sessions.map(sess => {
      const startFormatted = new Date(sess.startTime).toLocaleString('fr-FR');
      const endFormatted = sess.endTime ? new Date(sess.endTime).toLocaleString('fr-FR') : 'En cours';

      return [
        `"${sess.id}"`,
        `"${startFormatted}"`,
        `"${endFormatted}"`,
        `"${sess.volunteerName}"`,
        sess.salesCount,
        sess.totalCash.toFixed(2).replace('.', ','),
        sess.totalTpe.toFixed(2).replace('.', ','),
        sess.totalSales.toFixed(2).replace('.', ','),
        `"${(sess.incidentNotes || 'R.A.S.').replace(/"/g, '""')}"`
      ].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
    this.downloadFile(csvContent, `OpenMDL_Seances_Incidents_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8;');
  }

  private static downloadFile(content: string, fileName: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
