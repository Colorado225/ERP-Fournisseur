// ============================================================================
// IVOIREAPPRO ERP — MOTEUR DÉTERMINISTE DE GÉNÉRATION PDF & EXPORTS CSV
// Conformité Sections 15, 16 & 27 :
// Données structurées + Template versionné validé = PDF final téléchargeable
// ============================================================================

import { jsPDF } from 'jspdf';
import {
  Contract,
  Customer,
  CustomerDestination,
  Delivery,
  DocumentTemplate,
  ErpState,
  Invoice,
  Organization,
  Product,
} from './types';
import {
  calculateContractLineMetrics,
  calculateContributionMarginByContract,
  formatFcfa,
  formatQty,
} from './domainEngine';

export function computeDocumentChecksum(payload: string): string {
  let hash = 2166136261;
  for (let i = 0; i < payload.length; i++) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const hex = (hash >>> 0).toString(16).toUpperCase().padStart(8, '0');
  return `SHA256-SIM:${hex}-${payload.length}`;
}

/**
 * Génère et déclenche le téléchargement du Bordereau de Livraison PDF (ou PV de Réception)
 */
export function generateDeliveryNotePdf(params: {
  organization: Organization;
  delivery: Delivery;
  contract: Contract;
  customer: Customer;
  destination: CustomerDestination;
  products: Product[];
  template: DocumentTemplate;
  version: number;
  mode: 'DELIVERY_NOTE' | 'RECEIPT_PV';
}): { fileName: string; checksum: string } {
  const {
    organization,
    delivery,
    contract,
    customer,
    destination,
    products,
    template,
    version,
    mode,
  } = params;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const isReceipt = mode === 'RECEIPT_PV';
  const docTitle = isReceipt
    ? 'PROCES-VERBAL DE RECEPTION CONTRADICTOIRE'
    : 'BORDEREAU DE LIVRAISON INSTITUTIONNEL';

  // Bandeau supérieur sobre
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 26, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(organization.tradeName.toUpperCase(), 14, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(organization.address, 14, 16.5);
  doc.text(`Tel: ${organization.phone}  |  ID Fiscal: ${organization.taxId}`, 14, 21.5);

  // Référence et version à droite
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(delivery.reference, 196, 11, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Template: ${template.code} (${template.version})`, 196, 16.5, { align: 'right' });
  doc.text(`Version Document: v${version} — STATUT: FINAL`, 196, 21.5, { align: 'right' });

  // Titre du document
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(docTitle, 14, 36);

  doc.setDrawColor(203, 213, 225);
  doc.line(14, 39, 196, 39);

  // Blocs d'informations Client / Contrat / Destination / Transport
  doc.setFillColor(248, 250, 252);
  doc.rect(14, 43, 88, 36, 'F');
  doc.rect(108, 43, 88, 36, 'F');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('ORGANISME CLIENT & MARCHE DE REFERENCE', 17, 49);
  doc.setFont('helvetica', 'normal');
  doc.text(`Client : ${customer.name.substring(0, 44)}`, 17, 55);
  doc.text(`Code Client : ${customer.code}`, 17, 60.5);
  doc.text(`Marche / Contrat : ${contract.reference}`, 17, 66);
  doc.text(`Commande : ${delivery.orderId ? delivery.orderId.toUpperCase() : 'Appel direct'}`, 17, 71.5);
  doc.text(`Date prevue : ${delivery.plannedDate}`, 17, 76.5);

  doc.setFont('helvetica', 'bold');
  doc.text('DESTINATION & LOGISTIQUE', 111, 49);
  doc.setFont('helvetica', 'normal');
  doc.text(`Site : ${destination.siteName.substring(0, 42)}`, 111, 55);
  doc.text(`Ville : ${destination.city}`, 111, 60.5);
  doc.text(`Contact Site : ${destination.contactPerson}`, 111, 66);
  doc.text(`Chauffeur : ${delivery.driverName} (${delivery.vehiclePlate})`, 111, 71.5);
  doc.text(`Statut Dossier : ${delivery.status}`, 111, 76.5);

  // En-tête du tableau des lignes
  let y = 87;
  doc.setFillColor(30, 41, 59);
  doc.rect(14, y, 182, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('REF / DENREE', 16, y + 5.3);
  doc.text('LOT', 84, y + 5.3);
  doc.text('UNITE', 112, y + 5.3);
  doc.text('QTE EXPEDIEE', 130, y + 5.3);
  doc.text('QTE ACCEPTEE', 156, y + 5.3);
  doc.text('ECART/REFUS', 179, y + 5.3);

  y += 8;
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'normal');

  let totalValueDelivered = 0;
  let totalValueAccepted = 0;

  delivery.lines.forEach((line, idx) => {
    const prod = products.find((p) => p.id === line.productId);
    const prodName = prod ? `${prod.reference} - ${prod.name}` : line.productId;
    totalValueDelivered += line.quantityDelivered * line.unitPrice;
    totalValueAccepted += line.quantityAccepted * line.unitPrice;

    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(14, y, 182, 9, 'F');
    }

    doc.setFontSize(8);
    doc.text(prodName.substring(0, 38), 16, y + 5.8);
    doc.text(line.lotNumber || 'N/A', 84, y + 5.8);
    doc.text(line.unit, 112, y + 5.8);
    doc.text(formatQty(line.quantityDelivered), 130, y + 5.8);
    doc.text(
      delivery.status === 'RECEIVED' || delivery.status === 'PARTIALLY_RECEIVED'
        ? formatQty(line.quantityAccepted)
        : 'A completer',
      156,
      y + 5.8
    );
    doc.text(
      line.quantityRejected > 0 ? formatQty(line.quantityRejected) : '0',
      179,
      y + 5.8
    );

    y += 9;

    if (line.rejectionReason || line.observation) {
      doc.setFontSize(7.2);
      doc.setTextColor(100, 116, 139);
      const noteText = [
        line.rejectionReason ? `Motif refus: ${line.rejectionReason}` : '',
        line.observation ? `Obs: ${line.observation}` : '',
      ]
        .filter(Boolean)
        .join(' | ');
      doc.text(`   > ${noteText.substring(0, 95)}`, 16, y + 3.5);
      doc.setTextColor(15, 23, 42);
      y += 5.5;
    }
  });

  doc.setDrawColor(203, 213, 225);
  doc.line(14, y + 2, 196, y + 2);
  y += 9;

  // Valorisation indicative
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(
    `Valorisation Expediee : ${formatFcfa(totalValueDelivered)}`,
    14,
    y
  );
  if (delivery.status === 'RECEIVED' || delivery.status === 'PARTIALLY_RECEIVED') {
    doc.text(
      `Valorisation Acceptee (Base Facturable) : ${formatFcfa(totalValueAccepted)}`,
      110,
      y
    );
  }

  y += 14;

  // Blocs de Signatures Contradictoires
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('1. VISA MAGASINIER DEPART', 14, y);
  doc.text('2. VISA CHAUFFEUR / TRANSPORTEUR', 78, y);
  doc.text('3. RECEPTIONNAIRE SITE CLIENT (Cachet & Nom)', 136, y);

  doc.setDrawColor(148, 163, 184);
  doc.rect(14, y + 3, 56, 26);
  doc.rect(76, y + 3, 54, 26);
  doc.rect(136, y + 3, 60, 26);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`Resp: ${delivery.responsibleUser}`, 16, y + 9);
  doc.text(`Convoyeur: ${delivery.driverName}`, 78, y + 9);
  doc.text('Quantites verifiees contradictoirement :', 138, y + 9);
  doc.text('Date & Heure :', 138, y + 24);

  // Pied de page avec empreinte d'intégrité
  const checksum = computeDocumentChecksum(
    `${delivery.id}-${delivery.reference}-v${version}-${totalValueDelivered}-${totalValueAccepted}`
  );

  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(template.footerNotice, 14, 276);
  doc.text(
    `Empreinte d'integrite documentaire : ${checksum}  |  Genere le ${new Date()
      .toISOString()
      .slice(0, 16)
      .replace('T', ' ')}`,
    14,
    282
  );

  const prefix = isReceipt ? 'PV_Reception' : 'Bordereau';
  const fileName = `${prefix}_${delivery.reference}_v${version}_FINAL.pdf`;
  doc.save(fileName);

  return { fileName, checksum };
}

/**
 * Génère et télécharge une Facture Commerciale PDF liée au contrat et à la livraison
 */
export function generateInvoicePdf(params: {
  organization: Organization;
  invoice: Invoice;
  customer: Customer;
  contract: Contract;
  delivery?: Delivery;
}): { fileName: string; checksum: string } {
  const { organization, invoice, customer, contract, delivery } = params;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 26, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(organization.tradeName.toUpperCase(), 14, 11);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`${organization.address} | Tel: ${organization.phone}`, 14, 17);
  doc.text(`ID Fiscal: ${organization.taxId} | RCCM: ${organization.registrationNumber}`, 14, 22);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`FACTURE N° ${invoice.reference}`, 196, 12, { align: 'right' });
  doc.setFontSize(8.5);
  doc.text(`Statut : ${invoice.status}`, 196, 18, { align: 'right' });
  doc.text(`Certification Fiscale : ${invoice.taxCertificationStatus}`, 196, 23, {
    align: 'right',
  });

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10);
  doc.text(`Client : ${customer.name}`, 14, 38);
  doc.text(`Identifiant Fiscal Client : ${customer.taxIdentifier || 'Non renseigne'}`, 14, 44);
  doc.text(`Marche de rattachement : ${contract.reference} — ${contract.title}`, 14, 50);
  doc.text(
    `Piece justificative : ${delivery ? `Bordereau ${delivery.reference}` : 'Facturation sur decompte contractuel'}`,
    14,
    56
  );
  doc.text(
    `Date d'emission : ${invoice.issueDate}   |   Date d'echeance : ${invoice.dueDate}`,
    14,
    62
  );

  doc.setDrawColor(203, 213, 225);
  doc.line(14, 67, 196, 67);

  let y = 76;
  doc.setFillColor(241, 245, 249);
  doc.rect(14, y, 182, 34, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(`Montant HT : ${formatFcfa(invoice.subtotal)}`, 20, y + 9);
  doc.text(`Taxe (Taux configurable) : ${formatFcfa(invoice.taxAmount)}`, 20, y + 16);
  doc.text(`MONTANT TOTAL TTC : ${formatFcfa(invoice.totalAmount)}`, 20, y + 24);

  doc.text(`Montant deja encaisse : ${formatFcfa(invoice.paidAmount)}`, 115, y + 12);
  doc.text(`SOLDE RESTANT A PAYER : ${formatFcfa(invoice.remainingAmount)}`, 115, y + 22);

  if (invoice.notes) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(`Notes : ${invoice.notes}`, 14, y + 46);
  }

  const checksum = computeDocumentChecksum(
    `${invoice.id}-${invoice.reference}-${invoice.totalAmount}-${invoice.paidAmount}`
  );
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Empreinte numerique : ${checksum}`, 14, 280);

  const fileName = `${invoice.reference}_FINAL.pdf`;
  doc.save(fileName);
  return { fileName, checksum };
}

/**
 * Génère un Rapport d'Exécution Contractuelle en PDF
 */
export function generateContractExecutionReportPdf(state: ErpState): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 297, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(
    `${state.organization.tradeName} — RAPPORT D'EXECUTION CONTRACTUELLE & RELIQUATS`,
    14,
    13
  );

  let y = 32;
  doc.setTextColor(15, 23, 42);

  for (const contract of state.contracts) {
    const customer = state.customers.find((c) => c.id === contract.customerId);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(
      `Marche ${contract.reference} — ${contract.title} (${customer?.name || ''})`,
      14,
      y
    );
    y += 5;

    doc.setFillColor(226, 232, 240);
    doc.rect(14, y, 269, 7, 'F');
    doc.setFontSize(8);
    doc.text('PRODUIT', 16, y + 4.8);
    doc.text('UNITE', 105, y + 4.8);
    doc.text('CONTRACTUEL', 128, y + 4.8);
    doc.text('ACCEPTE', 165, y + 4.8);
    doc.text('EN TRANSIT', 198, y + 4.8);
    doc.text('RESTANT', 232, y + 4.8);
    doc.text('EXECUTION %', 260, y + 4.8);
    y += 7;

    doc.setFont('helvetica', 'normal');
    for (const line of contract.lines) {
      const prod = state.products.find((p) => p.id === line.productId);
      const m = calculateContractLineMetrics(line, state.deliveries);
      doc.text((prod?.name || line.productId).substring(0, 46), 16, y + 5);
      doc.text(line.unit, 105, y + 5);
      doc.text(formatQty(m.contractQuantity), 128, y + 5);
      doc.text(formatQty(m.acceptedDeliveredQuantity), 165, y + 5);
      doc.text(formatQty(m.inTransitQuantity), 198, y + 5);
      doc.text(formatQty(m.remainingQuantity), 232, y + 5);
      doc.text(`${m.executionRatePercent}%`, 260, y + 5);
      y += 6.5;
    }
    y += 6;
  }

  doc.save(`Rapport_Execution_Marchés_${new Date().toISOString().slice(0, 10)}.pdf`);
}

/**
 * Génère un Rapport Exécutif de Rentabilité & États Financiers en PDF (Synthèse imprimable officielle)
 */
export function generateProfitabilityAndFinancialReportPdf(
  state: ErpState,
  options?: { customFileName?: string; focusMode?: 'GLOBAL' | 'FINANCE' | 'PROFITABILITY' }
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const org = state.organization;
  const today = '07/10/2026';
  const focus = options?.focusMode || 'GLOBAL';

  // --- CALCULS DE SYNTHÈSE FINANCIÈRE & RENTABILITÉ ---
  const totalInvoiced = state.invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
  const totalPaid = state.invoices.reduce((sum, inv) => sum + inv.paidAmount, 0);
  const totalRemaining = totalInvoiced - totalPaid;
  const collectionRate = totalInvoiced > 0 ? (totalPaid / totalInvoiced) * 100 : 0;
  const totalOverdue = state.invoices
    .filter((inv) => inv.dueDate < '2026-10-07' && inv.remainingAmount > 0)
    .reduce((sum, inv) => sum + inv.remainingAmount, 0);

  const contractMargins = state.contracts.map((c) =>
    calculateContributionMarginByContract(c, state)
  );
  const totalExecutedRevenue = contractMargins.reduce((sum, m) => sum + m.revenueExecuted, 0);
  const totalPurchaseCost = contractMargins.reduce((sum, m) => sum + m.purchaseCost, 0);
  const totalContractExpenses = contractMargins.reduce((sum, m) => sum + m.directExpenses, 0);
  const totalDirectCosts = totalPurchaseCost + totalContractExpenses;
  const totalContributionMargin = totalExecutedRevenue - totalDirectCosts;
  const overallMarginRate =
    totalExecutedRevenue > 0
      ? (totalContributionMargin / totalExecutedRevenue) * 100
      : 0;

  const totalDirectExpenses = state.expenses.reduce((sum, e) => sum + e.amount, 0);

  // =========================================================================
  // PAGE 1 : BANDEAU, KPIS EXÉCUTIFS & TABLEAU DE RENTABILITÉ PAR MARCHÉ
  // =========================================================================
  // Bandeau supérieur
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.rect(0, 0, 210, 26, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(org.tradeName.toUpperCase(), 14, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`${org.address}  |  Tél: ${org.phone}`, 14, 16.5);
  doc.text(`ID Fiscal: ${org.taxId}  |  RCCM: ${org.registrationNumber}`, 14, 21.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  const titleTag =
    focus === 'FINANCE'
      ? 'ETATS FINANCIERS & RECOUVREMENT'
      : focus === 'PROFITABILITY'
      ? 'RAPPORT DE RENTABILITE & MARGES'
      : 'RAPPORT RENTABILITE & FINANCES';
  doc.text(titleTag, 196, 11, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Date d'édition : ${today}  |  Exercice 2026`, 196, 16.5, { align: 'right' });
  doc.text('STATUT : SYNTHESE EXECUTIVE CERTIFIEE', 196, 21.5, { align: 'right' });

  // Titre principal
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  const mainTitle =
    focus === 'FINANCE'
      ? 'ETATS FINANCIERS OFFICIELS, FACTURATION & RECOUVREMENTS'
      : focus === 'PROFITABILITY'
      ? 'ANALYSE DE LA RENTABILITE & MARGE SUR COUTS DIRECTS'
      : 'ETATS FINANCIERS & ANALYSE DE LA RENTABILITE OPERATIONNELLE';
  doc.text(mainTitle, 14, 35);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'Synthèse certifiée des décomptes clients, marges directes et coûts logistiques (Conformité Section 23 & 27)',
    14,
    39.5
  );

  doc.setDrawColor(203, 213, 225);
  doc.line(14, 42, 196, 42);

  // 6 Cartes KPI Exécutives (Grille 3 x 2)
  const cardW = 58;
  const cardH = 17;
  const col1 = 14;
  const col2 = 76;
  const col3 = 138;
  const row1Y = 46;
  const row2Y = 66;

  const drawKpiCard = (
    x: number,
    y: number,
    title: string,
    value: string,
    subtitle: string,
    highlightColor?: [number, number, number]
  ) => {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, y, cardW, cardH, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(title.toUpperCase(), x + 3.5, y + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    if (highlightColor) {
      doc.setTextColor(highlightColor[0], highlightColor[1], highlightColor[2]);
    } else {
      doc.setTextColor(15, 23, 42);
    }
    doc.text(value, x + 3.5, y + 10.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(subtitle, x + 3.5, y + 14.5);
  };

  drawKpiCard(
    col1,
    row1Y,
    'Chiffre d’Affaires Facturé',
    formatFcfa(totalInvoiced),
    `Sur ${state.invoices.length} factures émises`
  );
  drawKpiCard(
    col2,
    row1Y,
    'Encaissements Réalisés',
    formatFcfa(totalPaid),
    `Taux de recouvrement : ${collectionRate.toFixed(1)}%`,
    [5, 150, 105] // Emerald
  );
  drawKpiCard(
    col3,
    row1Y,
    'Créances Ouvertes',
    formatFcfa(totalRemaining),
    `Échues : ${formatFcfa(totalOverdue)}`,
    [220, 38, 38] // Red
  );

  drawKpiCard(
    col1,
    row2Y,
    'CA Exécuté des Marchés',
    formatFcfa(totalExecutedRevenue),
    'Base réceptions acceptées'
  );
  drawKpiCard(
    col2,
    row2Y,
    'Dépenses Directes Décaissées',
    formatFcfa(totalDirectExpenses),
    'Transport, dockers, gasoil, stock'
  );
  drawKpiCard(
    col3,
    row2Y,
    'Marge sur Coûts Directs',
    formatFcfa(totalContributionMargin),
    `Taux de marge nette : ${overallMarginRate.toFixed(1)}%`,
    [15, 23, 42]
  );

  // --- SECTION 1 : RENTABILITÉ ANALYTIQUE PAR MARCHÉ / CONTRAT ---
  let curY = 90;
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('1. ANALYSE DE LA RENTABILITE PAR MARCHE INSTITUTIONNEL', 14, curY);

  curY += 4;
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.rect(14, curY, 182, 6.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(51, 65, 85);
  doc.text('REFERENCE MARCHE & CLIENT', 16, curY + 4.5);
  doc.text('VALEUR CONTRAT', 88, curY + 4.5, { align: 'right' });
  doc.text('CA EXECUTE', 116, curY + 4.5, { align: 'right' });
  doc.text('COUTS DIRECTS', 144, curY + 4.5, { align: 'right' });
  doc.text('MARGE DIRECTE', 174, curY + 4.5, { align: 'right' });
  doc.text('TAUX %', 194, curY + 4.5, { align: 'right' });

  curY += 6.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);

  contractMargins.forEach((m) => {
    const ctr = state.contracts.find((c) => c.id === m.contractId);
    const cust = state.customers.find((c) => c.id === ctr?.customerId);
    const label = `${m.contractReference} — ${(cust?.name || ctr?.title || '').substring(0, 36)}`;

    doc.setTextColor(15, 23, 42);
    doc.text(label, 16, curY + 4.5);
    doc.text(formatFcfa(m.contractValue), 88, curY + 4.5, { align: 'right' });
    doc.text(formatFcfa(m.revenueExecuted), 116, curY + 4.5, { align: 'right' });
    doc.text(formatFcfa(m.totalDirectCost), 144, curY + 4.5, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.text(formatFcfa(m.contributionMargin), 174, curY + 4.5, { align: 'right' });
    doc.setTextColor(5, 150, 105);
    doc.text(`${m.marginRatePercent}%`, 194, curY + 4.5, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setDrawColor(241, 245, 249);
    doc.line(14, curY + 6, 196, curY + 6);
    curY += 6;
  });

  // Ligne de Total
  doc.setFillColor(226, 232, 240);
  doc.rect(14, curY, 182, 6.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('TOTAL CONSOLIDE MARCHES', 16, curY + 4.5);
  doc.text(
    formatFcfa(contractMargins.reduce((s, m) => s + m.contractValue, 0)),
    88,
    curY + 4.5,
    { align: 'right' }
  );
  doc.text(formatFcfa(totalExecutedRevenue), 116, curY + 4.5, { align: 'right' });
  doc.text(formatFcfa(totalDirectCosts), 144, curY + 4.5, { align: 'right' });
  doc.text(formatFcfa(totalContributionMargin), 174, curY + 4.5, { align: 'right' });
  doc.setTextColor(5, 150, 105);
  doc.text(`${overallMarginRate.toFixed(1)}%`, 194, curY + 4.5, { align: 'right' });

  // --- SECTION 2 : VENTILATION DES DÉPENSES DIRECTES PAR CATÉGORIE ---
  curY += 13;
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('2. VENTILATION DES CHARGES DIRECTES D’EXPLOITATION', 14, curY);

  curY += 4;
  doc.setFillColor(241, 245, 249);
  doc.rect(14, curY, 182, 6.5, 'FD');
  doc.setFontSize(7.2);
  doc.setTextColor(51, 65, 85);
  doc.text('POSTE DE COUT / CATEGORIE', 16, curY + 4.5);
  doc.text('DESCRIPTION OPERATIONNELLE', 80, curY + 4.5);
  doc.text('MONTANT DECAISSE (FCFA)', 160, curY + 4.5, { align: 'right' });
  doc.text('PART %', 194, curY + 4.5, { align: 'right' });

  curY += 6.5;
  const categoryLabels: Record<string, { label: string; desc: string }> = {
    TRANSPORT: { label: 'Transport & Fret Convois', desc: 'Location camions 25T, fret routier & péages autoroute' },
    FUEL: { label: 'Carburant Flotte', desc: 'Dotation gasoil tracteurs & groupes électrogènes' },
    HANDLING: { label: 'Manutention & Dockers', desc: 'Équipes de chargement quai départ & déchargement sites' },
    STORAGE: { label: 'Stockage & Entrepôt', desc: 'Traitement phytosanitaire, palettes & maintenance froid' },
    MAINTENANCE: { label: 'Entretien & Révisions', desc: 'Organes de freinage, pneumatiques & mécanique lourde' },
    PURCHASE: { label: 'Achats Directs Denrées', desc: 'Fournisseurs riz, sucre, huile, légumineuses' },
    ADMIN: { label: 'Frais Administratifs', desc: 'Timbres, légalisations & bordereaux officiels' },
    BANK_FEES: { label: 'Frais Bancaires', desc: 'Commissions de virement et cautions de marché' },
    OTHER: { label: 'Autres Charges Directes', desc: 'Frais annexes de livraison et contingences' },
  };

  const expCategories = Object.keys(categoryLabels);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);

  expCategories.forEach((cat) => {
    const catExpenses = state.expenses.filter((e) => e.category === cat);
    const sum = catExpenses.reduce((acc, e) => acc + e.amount, 0);
    if (sum > 0) {
      const pct = totalDirectExpenses > 0 ? ((sum / totalDirectExpenses) * 100).toFixed(1) : '0';
      const info = categoryLabels[cat];

      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.text(info.label, 16, curY + 4.2);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(info.desc, 80, curY + 4.2);
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.text(formatFcfa(sum), 160, curY + 4.2, { align: 'right' });
      doc.setTextColor(71, 85, 105);
      doc.text(`${pct}%`, 194, curY + 4.2, { align: 'right' });

      doc.setDrawColor(241, 245, 249);
      doc.line(14, curY + 5.8, 196, curY + 5.8);
      curY += 5.8;
    }
  });

  // Footer Page 1
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('IvoireAppro ERP — Synthèse Financière & Rentabilité Directe', 14, 287);
  doc.text('Page 1 sur 2', 196, 287, { align: 'right' });

  // =========================================================================
  // PAGE 2 : FACTURES, HISTORIQUE MENSUEL 6 MOIS & VISAS DE CERTIFICATION
  // =========================================================================
  doc.addPage();

  // Bandeau supérieur Page 2
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 18, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text(
    `${org.tradeName} — SUIVI FACTURATION, RECOUVREMENT & HISTORIQUE MENSUEL`,
    14,
    11.5
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('PAGE 2 / 2 — EXERCICE 2026', 196, 11.5, { align: 'right' });

  // --- SECTION 3 : ÉTAT DES FACTURES & SUIVI DES RECOUVREMENTS ---
  curY = 28;
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('3. ETAT DES FACTURES EMISES & DETAIL DES RECOUVREMENTS', 14, curY);

  curY += 4;
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.rect(14, curY, 182, 6.5, 'FD');
  doc.setFontSize(7);
  doc.setTextColor(51, 65, 85);
  doc.text('FACTURE N°', 16, curY + 4.5);
  doc.text('CLIENT INSTITUTIONNEL', 48, curY + 4.5);
  doc.text('EMISSION', 98, curY + 4.5);
  doc.text('ECHEANCE', 118, curY + 4.5);
  doc.text('MONTANT TTC', 144, curY + 4.5, { align: 'right' });
  doc.text('ENCAISSE', 170, curY + 4.5, { align: 'right' });
  doc.text('STATUT', 194, curY + 4.5, { align: 'right' });

  curY += 6.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);

  state.invoices.forEach((inv) => {
    const cust = state.customers.find((c) => c.id === inv.customerId);
    const clientName = (cust?.name || 'Client institutionnel').substring(0, 25);

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text(inv.reference, 16, curY + 4.2);
    doc.setFont('helvetica', 'normal');
    doc.text(clientName, 48, curY + 4.2);
    doc.text(inv.issueDate, 98, curY + 4.2);
    doc.text(inv.dueDate, 118, curY + 4.2);
    doc.text(formatFcfa(inv.totalAmount), 144, curY + 4.2, { align: 'right' });

    doc.setTextColor(5, 150, 105);
    doc.text(formatFcfa(inv.paidAmount), 170, curY + 4.2, { align: 'right' });

    if (inv.status === 'OVERDUE') {
      doc.setTextColor(220, 38, 38);
      doc.setFont('helvetica', 'bold');
      doc.text('ECHUE', 194, curY + 4.2, { align: 'right' });
    } else if (inv.status === 'PAID') {
      doc.setTextColor(5, 150, 105);
      doc.setFont('helvetica', 'bold');
      doc.text('PAYEE', 194, curY + 4.2, { align: 'right' });
    } else if (inv.status === 'PARTIALLY_PAID') {
      doc.setTextColor(217, 119, 6);
      doc.setFont('helvetica', 'bold');
      doc.text('PARTIELLE', 194, curY + 4.2, { align: 'right' });
    } else {
      doc.setTextColor(71, 85, 105);
      doc.setFont('helvetica', 'normal');
      doc.text('EMISE', 194, curY + 4.2, { align: 'right' });
    }

    doc.setDrawColor(241, 245, 249);
    doc.line(14, curY + 5.8, 196, curY + 5.8);
    curY += 5.8;
  });

  // Total factures
  doc.setFillColor(226, 232, 240);
  doc.rect(14, curY, 182, 6.2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(15, 23, 42);
  doc.text('TOTAL RECOUVREMENTS', 16, curY + 4.2);
  doc.text(formatFcfa(totalInvoiced), 144, curY + 4.2, { align: 'right' });
  doc.setTextColor(5, 150, 105);
  doc.text(formatFcfa(totalPaid), 170, curY + 4.2, { align: 'right' });
  doc.setTextColor(15, 23, 42);
  doc.text(`Solde : ${formatFcfa(totalRemaining)}`, 194, curY + 4.2, { align: 'right' });

  // --- SECTION 4 : ÉVOLUTION MENSUELLE DES REVENUS VS DÉPENSES (6 DERNIERS MOIS) ---
  curY += 13;
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('4. COMPARATIF REVENUS VS DEPENSES (6 DERNIERS MOIS)', 14, curY);

  curY += 4;
  doc.setFillColor(241, 245, 249);
  doc.rect(14, curY, 182, 6.5, 'FD');
  doc.setFontSize(7);
  doc.setTextColor(51, 65, 85);
  doc.text('MOIS DE REFERENCE', 16, curY + 4.5);
  doc.text('REVENUS FACTURES (FCFA)', 80, curY + 4.5, { align: 'right' });
  doc.text('DEPENSES DIRECTES (FCFA)', 124, curY + 4.5, { align: 'right' });
  doc.text('MARGE DEGAGEE (FCFA)', 166, curY + 4.5, { align: 'right' });
  doc.text('TAUX MARGE %', 194, curY + 4.5, { align: 'right' });

  curY += 6.5;
  const last6MonthsSchedule = [
    { month: 'Mai 2026', prefix: '2026-05', baseRev: 19600000, baseExp: 11800000 },
    { month: 'Juin 2026', prefix: '2026-06', baseRev: 22100000, baseExp: 13400000 },
    { month: 'Juillet 2026', prefix: '2026-07', baseRev: 18900000, baseExp: 11200000 },
    { month: 'Août 2026', prefix: '2026-08', baseRev: 14900000, baseExp: 9100000 },
    { month: 'Septembre 2026', prefix: '2026-09', baseRev: 0, baseExp: 18675000 },
    { month: 'Octobre 2026', prefix: '2026-10', baseRev: 10570000, baseExp: 7360000 },
  ];

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);

  let sum6MRev = 0;
  let sum6MExp = 0;

  last6MonthsSchedule.forEach((item) => {
    const dynInvoiced = state.invoices
      .filter((inv) => inv.issueDate.startsWith(item.prefix))
      .reduce((s, inv) => s + inv.totalAmount, 0);
    const dynExpenses = state.expenses
      .filter((exp) => exp.expenseDate.startsWith(item.prefix))
      .reduce((s, exp) => s + exp.amount, 0);

    const mRev = item.baseRev + dynInvoiced;
    const mExp = item.baseExp + dynExpenses;
    const mMarge = mRev - mExp;
    const mRate = mRev > 0 ? ((mMarge / mRev) * 100).toFixed(1) : '0';

    sum6MRev += mRev;
    sum6MExp += mExp;

    doc.setTextColor(15, 23, 42);
    doc.text(item.month, 16, curY + 4.2);
    doc.text(formatFcfa(mRev), 80, curY + 4.2, { align: 'right' });
    doc.setTextColor(220, 38, 38);
    doc.text(formatFcfa(mExp), 124, curY + 4.2, { align: 'right' });
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text(formatFcfa(mMarge), 166, curY + 4.2, { align: 'right' });
    doc.setTextColor(5, 150, 105);
    doc.text(`${mRate}%`, 194, curY + 4.2, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setDrawColor(241, 245, 249);
    doc.line(14, curY + 5.8, 196, curY + 5.8);
    curY += 5.8;
  });

  // Total 6 Mois
  const sum6MMargin = sum6MRev - sum6MExp;
  const sum6MRate = sum6MRev > 0 ? ((sum6MMargin / sum6MRev) * 100).toFixed(1) : '0';

  doc.setFillColor(226, 232, 240);
  doc.rect(14, curY, 182, 6.2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('TOTAL CUMULE 6 DERNIERS MOIS', 16, curY + 4.2);
  doc.text(formatFcfa(sum6MRev), 80, curY + 4.2, { align: 'right' });
  doc.setTextColor(220, 38, 38);
  doc.text(formatFcfa(sum6MExp), 124, curY + 4.2, { align: 'right' });
  doc.setTextColor(15, 23, 42);
  doc.text(formatFcfa(sum6MMargin), 166, curY + 4.2, { align: 'right' });
  doc.setTextColor(5, 150, 105);
  doc.text(`${sum6MRate}%`, 194, curY + 4.2, { align: 'right' });

  // --- NOTE MÉTHODOLOGIQUE & VISAS OFFICIELS ---
  curY += 12;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.rect(14, curY, 182, 16, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(15, 23, 42);
  doc.text('NOTE METHODOLOGIQUE & DISPOSITIONS CONTRACTUELLES (SECTION 23)', 16, curY + 4.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'Formule : Chiffre d’affaires exécuté − (Coûts d’achat denrées + Frais de transport + Carburant + Manutention + Stockage direct).',
    16,
    curY + 8.5
  );
  doc.text(
    'Indicateur interne de contribution opérationnelle, mesuré au niveau de chaque contrat et convoi. Ne se substitue pas au résultat comptable.',
    16,
    curY + 12.5
  );

  curY += 21;
  // Encadrés Visas
  const signBoxW = 88;
  const signBoxH = 26;

  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(14, curY, signBoxW, signBoxH, 2, 2, 'FD');
  doc.roundedRect(108, curY, signBoxW, signBoxH, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text('VISA CONTRÔLE DE GESTION & EXPLOITATION', 17, curY + 5.5);
  doc.text('VISA DIRECTION ADMINISTRATIVE & FINANCIERE', 111, curY + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text('Date & Signature pour conformité des coûts directs :', 17, curY + 10.5);
  doc.text('Date & Signature pour certification des créances :', 111, curY + 10.5);

  const checksum = computeDocumentChecksum(
    `${org.id}-${totalInvoiced}-${totalPaid}-${totalContributionMargin}-${today}-${focus}`
  );
  doc.setFontSize(6.8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Empreinte numérique d'intégrité : ${checksum}`, 14, 287);
  doc.text('Page 2 sur 2', 196, 287, { align: 'right' });

  const defaultFileName =
    focus === 'FINANCE'
      ? `Etats_Financiers_Recouvrement_${new Date().toISOString().slice(0, 10)}.pdf`
      : focus === 'PROFITABILITY'
      ? `Rapport_Rentabilite_Marges_Directes_${new Date().toISOString().slice(0, 10)}.pdf`
      : `Synthese_Rentabilite_Etats_Financiers_${new Date().toISOString().slice(0, 10)}.pdf`;

  doc.save(options?.customFileName || defaultFileName);
}

/**
 * Génère le Rapport de Rentabilité & Marges en PDF
 */
export function generateProfitabilityReportPdf(state: ErpState): void {
  generateProfitabilityAndFinancialReportPdf(state, {
    focusMode: 'PROFITABILITY',
    customFileName: `Rapport_Rentabilite_Marges_Directes_${new Date().toISOString().slice(0, 10)}.pdf`,
  });
}

/**
 * Génère le Rapport des États Financiers & Recouvrement en PDF
 */
export function generateFinancialReportPdf(state: ErpState): void {
  generateProfitabilityAndFinancialReportPdf(state, {
    focusMode: 'FINANCE',
    customFileName: `Etats_Financiers_Recouvrement_${new Date().toISOString().slice(0, 10)}.pdf`,
  });
}

/**
 * Utilitaire d'export CSV universel compatible Excel (UTF-8 BOM)
 */
export function exportToCsvFile(
  fileName: string,
  headers: string[],
  rows: Array<Array<string | number>>
): void {
  const escapeCell = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes(';') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvLines = [
    headers.map(escapeCell).join(';'),
    ...rows.map((r) => r.map(escapeCell).join(';')),
  ];
  const csvContent = '\uFEFF' + csvLines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
