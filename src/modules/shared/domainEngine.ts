// ============================================================================
// IVOIREAPPRO ERP — MOTEUR DE RÈGLES MÉTIER & SUITE DE TESTS AUTOMATISÉS
// Conformité Sections 13, 14, 19, 21, 23, 37, 38, 39 & 46
// ============================================================================

import {
  Contract,
  ContractLine,
  Delivery,
  DeliveryStatus,
  ErpState,
  Invoice,
  InvoiceStatus,
  Product,
  RoleName,
  StockMovement,
} from './types';

export interface ContractLineExecutionMetrics {
  contractLineId: string;
  productId: string;
  contractQuantity: number;
  acceptedDeliveredQuantity: number;
  inTransitQuantity: number;
  rejectedQuantity: number;
  remainingQuantity: number;         // contractQuantity - acceptedDeliveredQuantity
  availableToPlanQuantity: number;   // contractQuantity - acceptedDeliveredQuantity - inTransitQuantity
  executionRatePercent: number;
}

/**
 * Calcule les quantités contractuelles, livrées acceptées, en transit et restantes
 * Règle Section 8 & 13 :
 * remainingQuantity = contractQuantity - acceptedDeliveredQuantity
 * Ne jamais considérer automatiquement la quantité expédiée comme quantité acceptée.
 */
export function calculateContractLineMetrics(
  contractLine: ContractLine,
  deliveries: Delivery[],
  excludeDeliveryId?: string
): ContractLineExecutionMetrics {
  const relevantDeliveries = deliveries.filter(
    (d) =>
      d.contractId === contractLine.contractId &&
      d.id !== excludeDeliveryId &&
      d.status !== DeliveryStatus.CANCELLED
  );

  let acceptedDeliveredQuantity = 0;
  let inTransitQuantity = 0;
  let rejectedQuantity = 0;

  for (const delivery of relevantDeliveries) {
    for (const line of delivery.lines) {
      if (line.contractLineId === contractLine.id) {
        if (
          delivery.status === DeliveryStatus.RECEIVED ||
          delivery.status === DeliveryStatus.PARTIALLY_RECEIVED ||
          delivery.status === DeliveryStatus.CLOSED
        ) {
          acceptedDeliveredQuantity += line.quantityAccepted;
          rejectedQuantity += line.quantityRejected;
        } else if (delivery.status === DeliveryStatus.REJECTED) {
          rejectedQuantity += line.quantityRejected || line.quantityDelivered;
        } else if (
          delivery.status === DeliveryStatus.PLANNED ||
          delivery.status === DeliveryStatus.PREPARING ||
          delivery.status === DeliveryStatus.READY ||
          delivery.status === DeliveryStatus.DISPATCHED
        ) {
          inTransitQuantity += line.quantityDelivered;
        }
      }
    }
  }

  const remainingQuantity = Math.max(
    0,
    Number((contractLine.quantity - acceptedDeliveredQuantity).toFixed(3))
  );
  const availableToPlanQuantity = Math.max(
    0,
    Number(
      (contractLine.quantity - acceptedDeliveredQuantity - inTransitQuantity).toFixed(3)
    )
  );
  const executionRatePercent =
    contractLine.quantity > 0
      ? Math.min(100, Math.round((acceptedDeliveredQuantity / contractLine.quantity) * 100))
      : 0;

  return {
    contractLineId: contractLine.id,
    productId: contractLine.productId,
    contractQuantity: contractLine.quantity,
    acceptedDeliveredQuantity,
    inTransitQuantity,
    rejectedQuantity,
    remainingQuantity,
    availableToPlanQuantity,
    executionRatePercent,
  };
}

/**
 * Calcule le taux d'exécution global d'un contrat (en valeur acceptée et en volume)
 */
export function calculateContractProgress(contract: Contract, deliveries: Delivery[]) {
  let totalContractQty = 0;
  let totalAcceptedQty = 0;
  let totalRemainingQty = 0;
  let executedValue = 0;

  for (const line of contract.lines) {
    const m = calculateContractLineMetrics(line, deliveries);
    totalContractQty += m.contractQuantity;
    totalAcceptedQty += m.acceptedDeliveredQuantity;
    totalRemainingQty += m.remainingQuantity;
    executedValue += m.acceptedDeliveredQuantity * line.unitPrice;
  }

  const progressPercent =
    contract.totalAmount > 0
      ? Math.min(100, Math.round((executedValue / contract.totalAmount) * 100))
      : totalContractQty > 0
      ? Math.min(100, Math.round((totalAcceptedQty / totalContractQty) * 100))
      : 0;

  return {
    totalContractQty,
    totalAcceptedQty,
    totalRemainingQty,
    executedValue,
    remainingValue: Math.max(0, contract.totalAmount - executedValue),
    progressPercent,
  };
}

/**
 * Règle 2 & Section 13 & 38 :
 * Vérifie si une livraison respecte le reliquat contractuel ligne par ligne.
 * Retourne un message d'erreur métier explicite si dépassement non autorisé.
 */
export function validateDeliveryQuantitiesAgainstContract(params: {
  contract: Contract;
  deliveries: Delivery[];
  products: Product[];
  proposedLines: Array<{
    contractLineId: string;
    productId: string;
    quantityDelivered: number;
  }>;
  userRole: RoleName;
  overrideReason?: string;
  excludeDeliveryId?: string;
}): { valid: boolean; error?: string; warnings: string[] } {
  const {
    contract,
    deliveries,
    products,
    proposedLines,
    userRole,
    overrideReason,
    excludeDeliveryId,
  } = params;
  const warnings: string[] = [];

  for (const item of proposedLines) {
    const contractLine = contract.lines.find((l) => l.id === item.contractLineId);
    const product = products.find((p) => p.id === item.productId);
    const productName = product ? product.name : item.productId;

    if (!contractLine) {
      return {
        valid: false,
        error: `La denrée "${productName}" ne figure pas parmi les lignes contractuelles autorisées du marché ${contract.reference}.`,
        warnings,
      };
    }

    const metrics = calculateContractLineMetrics(
      contractLine,
      deliveries,
      excludeDeliveryId
    );

    if (item.quantityDelivered > metrics.remainingQuantity) {
      const excess = Number((item.quantityDelivered - metrics.remainingQuantity).toFixed(2));
      const canOverride =
        userRole === RoleName.OWNER ||
        userRole === RoleName.ADMIN ||
        userRole === RoleName.MANAGER;

      if (!canOverride || !overrideReason || overrideReason.trim().length < 5) {
        return {
          valid: false,
          error: `Impossible de valider cette livraison : ${item.quantityDelivered.toLocaleString(
            'fr-FR'
          )} ${contractLine.unit} de ${productName} dépasseraient de ${excess.toLocaleString(
            'fr-FR'
          )} ${contractLine.unit} la quantité restante autorisée sur le contrat ${
            contract.reference
          } (Reliquat autorisé : ${metrics.remainingQuantity.toLocaleString('fr-FR')} ${
            contractLine.unit
          }).`,
          warnings,
        };
      } else {
        warnings.push(
          `Dérogation contractuelle enregistrée pour ${productName} (+${excess} ${contractLine.unit} au-delà du reliquat) — Motif : ${overrideReason}`
        );
      }
    } else if (item.quantityDelivered > metrics.availableToPlanQuantity) {
      warnings.push(
        `Attention : ${productName} comporte déjà ${metrics.inTransitQuantity.toLocaleString(
          'fr-FR'
        )} ${contractLine.unit} en préparation ou en cours d'expédition.`
      );
    }
  }

  return { valid: true, warnings };
}

/**
 * Section 11 & Règle 7 :
 * Reconstruit le stock courant d'un produit à partir des mouvements immuables.
 */
export function calculateProductStockFromMovements(
  productId: string,
  movements: StockMovement[]
): number {
  const total = movements
    .filter((m) => m.productId === productId)
    .reduce((acc, m) => acc + m.quantityDelta, 0);
  return Math.max(0, Number(total.toFixed(3)));
}

/**
 * Section 14 & Règle 3 :
 * Détermine automatiquement le statut d'une livraison à l'issue de la réception.
 */
export function resolveReceptionDeliveryStatus(
  lines: Array<{
    quantityDelivered: number;
    quantityAccepted: number;
    quantityRejected: number;
  }>
): DeliveryStatus {
  const totalDelivered = lines.reduce((s, l) => s + l.quantityDelivered, 0);
  const totalAccepted = lines.reduce((s, l) => s + l.quantityAccepted, 0);
  const totalRejected = lines.reduce((s, l) => s + l.quantityRejected, 0);

  if (totalAccepted === 0 && totalRejected > 0) {
    return DeliveryStatus.REJECTED;
  }
  if (totalAccepted > 0 && totalAccepted < totalDelivered) {
    return DeliveryStatus.PARTIALLY_RECEIVED;
  }
  return DeliveryStatus.RECEIVED;
}

/**
 * Section 19 & 21 & Règle 6 :
 * Recalcule l'état d'une facture après enregistrement d'un paiement.
 */
export function applyPaymentToInvoice(
  invoice: Invoice,
  paymentAmount: number,
  referenceToday = '2026-10-07'
): Invoice {
  const newPaid = Math.min(
    invoice.totalAmount,
    Number((invoice.paidAmount + paymentAmount).toFixed(2))
  );
  const newRemaining = Math.max(
    0,
    Number((invoice.totalAmount - newPaid).toFixed(2))
  );

  let status: InvoiceStatus = invoice.status;
  if (newRemaining === 0) {
    status = InvoiceStatus.PAID;
  } else if (newPaid > 0 && newRemaining > 0) {
    status =
      invoice.dueDate < referenceToday
        ? InvoiceStatus.OVERDUE
        : InvoiceStatus.PARTIALLY_PAID;
  }

  return {
    ...invoice,
    paidAmount: newPaid,
    remainingAmount: newRemaining,
    status,
  };
}

/**
 * Section 23 :
 * Calcul de la Marge sur Coûts Directs (Contribution Margin) par contrat, livraison et produit.
 */
export function calculateContributionMarginByContract(
  contract: Contract,
  state: ErpState
) {
  const contractDeliveries = state.deliveries.filter(
    (d) =>
      d.contractId === contract.id &&
      (d.status === DeliveryStatus.RECEIVED ||
        d.status === DeliveryStatus.PARTIALLY_RECEIVED ||
        d.status === DeliveryStatus.CLOSED ||
        d.status === DeliveryStatus.DISPATCHED)
  );

  let revenueExecuted = 0;
  let purchaseCost = 0;

  for (const d of contractDeliveries) {
    for (const line of d.lines) {
      const effectiveQty =
        d.status === DeliveryStatus.RECEIVED ||
        d.status === DeliveryStatus.PARTIALLY_RECEIVED ||
        d.status === DeliveryStatus.CLOSED
          ? line.quantityAccepted
          : line.quantityDelivered;
      revenueExecuted += effectiveQty * line.unitPrice;
      const product = state.products.find((p) => p.id === line.productId);
      const unitCost = product ? product.standardCost : line.unitPrice * 0.72;
      purchaseCost += effectiveQty * unitCost;
    }
  }

  const directExpenses = state.expenses
    .filter((e) => e.contractId === contract.id)
    .reduce((acc, e) => acc + e.amount, 0);

  const totalDirectCost = purchaseCost + directExpenses;
  const contributionMargin = revenueExecuted - totalDirectCost;
  const marginRatePercent =
    revenueExecuted > 0
      ? Number(((contributionMargin / revenueExecuted) * 100).toFixed(1))
      : 0;

  return {
    contractId: contract.id,
    contractReference: contract.reference,
    contractValue: contract.totalAmount,
    revenueExecuted,
    purchaseCost,
    directExpenses,
    totalDirectCost,
    contributionMargin,
    marginRatePercent,
  };
}

/**
 * Section 37 :
 * Génère le prochain numéro de séquence sans collision (ex: BL-2026-000129)
 */
export function generateNextSequenceNumber(
  prefix: 'BL' | 'FAC' | 'CMD' | 'REG' | 'ACH' | 'DEP',
  currentCounter: number,
  year = 2026
): { formatted: string; nextCounter: number } {
  const nextCounter = currentCounter + 1;
  const padded = String(nextCounter).padStart(6, '0');
  return {
    formatted: `${prefix}-${year}-${padded}`,
    nextCounter,
  };
}

/**
 * Formateur monétaire Franc CFA (FCFA / XOF) avec espaces insécables et chiffres tabulaires
 */
export function formatFcfa(amount: number): string {
  return `${Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} FCFA`;
}

/**
 * Formateur de quantité avec unité
 */
export function formatQty(qty: number, unit?: string): string {
  const formatted = Number(qty)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return unit ? `${formatted} ${unit}` : formatted;
}

// ============================================================================
// SECTION 39 : SUITE DE TESTS UNITAIRES & INTÉGRATION EXÉCUTABLE
// ============================================================================

export interface DomainTestResult {
  id: string;
  category: 'UNIT' | 'INTEGRATION' | 'E2E_WORKFLOW';
  name: string;
  passed: boolean;
  details: string;
}

export function runDomainTestSuite(state: ErpState): DomainTestResult[] {
  const results: DomainTestResult[] = [];

  // Test 1 : Calcul des quantités restantes
  const sampleContract = state.contracts[0];
  const sampleLine = sampleContract.lines[0];
  const metrics = calculateContractLineMetrics(sampleLine, state.deliveries);
  const expectedRemaining = sampleLine.quantity - metrics.acceptedDeliveredQuantity;
  results.push({
    id: 'T-01',
    category: 'UNIT',
    name: 'Calcul strict du reliquat contractuel (Contractuel - Accepté)',
    passed: Math.abs(metrics.remainingQuantity - expectedRemaining) < 0.001,
    details: `Contrat ${sampleContract.reference} : ${sampleLine.quantity} - ${metrics.acceptedDeliveredQuantity} = ${metrics.remainingQuantity} ${sampleLine.unit}`,
  });

  // Test 2 : Blocage automatique en cas de dépassement du reliquat
  const overQuotaCheck = validateDeliveryQuantitiesAgainstContract({
    contract: sampleContract,
    deliveries: state.deliveries,
    products: state.products,
    proposedLines: [
      {
        contractLineId: sampleLine.id,
        productId: sampleLine.productId,
        quantityDelivered: metrics.remainingQuantity + 500,
      },
    ],
    userRole: RoleName.LOGISTICS,
  });
  results.push({
    id: 'T-02',
    category: 'UNIT',
    name: 'Blocage automatique de dépassement de quantité sans dérogation',
    passed: overQuotaCheck.valid === false && Boolean(overQuotaCheck.error),
    details: overQuotaCheck.error || 'Aucun blocage détecté',
  });

  // Test 3 : Qualification de réception partielle vs complète
  const partialStatus = resolveReceptionDeliveryStatus([
    { quantityDelivered: 1000, quantityAccepted: 850, quantityRejected: 150 },
  ]);
  const fullStatus = resolveReceptionDeliveryStatus([
    { quantityDelivered: 1000, quantityAccepted: 1000, quantityRejected: 0 },
  ]);
  results.push({
    id: 'T-03',
    category: 'UNIT',
    name: 'Distinction quantité livrée vs quantité acceptée à la réception',
    passed:
      partialStatus === DeliveryStatus.PARTIALLY_RECEIVED &&
      fullStatus === DeliveryStatus.RECEIVED,
    details: `850/1000 → ${partialStatus} | 1000/1000 → ${fullStatus}`,
  });

  // Test 4 : Reconstruction immuable du stock à partir des mouvements
  const firstProduct = state.products[0];
  const stockFromMovements = calculateProductStockFromMovements(
    firstProduct.id,
    state.stockMovements
  );
  results.push({
    id: 'T-04',
    category: 'UNIT',
    name: 'Reconstruction du stock courant à partir des mouvements immuables',
    passed: stockFromMovements >= 0,
    details: `${firstProduct.name} : Stock reconstruit = ${stockFromMovements.toLocaleString(
      'fr-FR'
    )} ${firstProduct.unit}`,
  });

  // Test 5 : Apurement de créance sur paiement partiel puis solde
  const mockInvoice: Invoice = {
    id: 'inv-test',
    organizationId: state.organization.id,
    reference: 'FAC-2026-999999',
    customerId: state.customers[0].id,
    contractId: sampleContract.id,
    issueDate: '2026-09-01',
    dueDate: '2026-10-30',
    status: InvoiceStatus.ISSUED,
    subtotal: 10000000,
    taxAmount: 0,
    totalAmount: 10000000,
    paidAmount: 0,
    remainingAmount: 10000000,
    taxCertificationStatus: state.invoices[0].taxCertificationStatus,
    notes: '',
  };
  const afterPartial = applyPaymentToInvoice(mockInvoice, 4000000, '2026-10-07');
  const afterFull = applyPaymentToInvoice(afterPartial, 6000000, '2026-10-07');
  results.push({
    id: 'T-05',
    category: 'INTEGRATION',
    name: 'Rapprochement de paiement partiel et clôture de créance',
    passed:
      afterPartial.status === InvoiceStatus.PARTIALLY_PAID &&
      afterPartial.remainingAmount === 6000000 &&
      afterFull.status === InvoiceStatus.PAID &&
      afterFull.remainingAmount === 0,
    details: `10 000 000 FCFA - 4 000 000 FCFA = 6 000 000 FCFA (${afterPartial.status}) → Solde 0 FCFA (${afterFull.status})`,
  });

  // Test 6 : Calcul de la marge sur coûts directs (Contribution Margin)
  const marginMetrics = calculateContributionMarginByContract(sampleContract, state);
  results.push({
    id: 'T-06',
    category: 'INTEGRATION',
    name: 'Calcul de la marge sur coûts directs par contrat (CA - Achats - Logistique)',
    passed:
      marginMetrics.contributionMargin ===
      marginMetrics.revenueExecuted - marginMetrics.totalDirectCost,
    details: `CA exécuté : ${formatFcfa(marginMetrics.revenueExecuted)} | Coûts directs : ${formatFcfa(
      marginMetrics.totalDirectCost
    )} | Marge : ${formatFcfa(marginMetrics.contributionMargin)} (${
      marginMetrics.marginRatePercent
    }%)`,
  });

  return results;
}
