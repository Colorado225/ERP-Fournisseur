import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Boxes,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Menu,
  Package,
  Plus,
  Receipt,
  RotateCcw,
  Search,
  Settings,
  ShoppingCart,
  TrendingUp,
  Truck,
  UserCheck,
  Wallet,
  X,
} from 'lucide-react';
import {
  AuditActionType,
  Contract,
  ContractStatus,
  Customer,
  CustomerOrder,
  Delivery,
  DeliveryStatus,
  DocumentStatus,
  DocumentType,
  ErpState,
  Expense,
  ExpenseCategoryType,
  Invoice,
  InvoiceStatus,
  Organization,
  Payment,
  StockMovement,
  StockMovementType,
  StoredDocument,
  TaxCertificationStatus,
  UnitCode,
} from './modules/shared/types';
import { INITIAL_ERP_STATE } from './modules/shared/seedData';
import {
  applyPaymentToInvoice,
  formatFcfa,
  generateNextSequenceNumber,
  resolveReceptionDeliveryStatus,
} from './modules/shared/domainEngine';
import { computeDocumentChecksum } from './modules/shared/pdfGenerator';
import { DashboardView } from './modules/dashboard/DashboardView';
import { NewDeliveryWizard } from './modules/deliveries/NewDeliveryWizard';
import { DeliveryDetailView } from './modules/deliveries/DeliveryDetailView';
import { DeliveriesListView } from './modules/deliveries/DeliveriesListView';
import { ContractsAndOrdersView } from './modules/contracts/ContractsAndOrdersView';
import { InventoryAndProcurementView } from './modules/inventory/InventoryAndProcurementView';
import { FinanceAndReceivablesView } from './modules/finance/FinanceAndReceivablesView';
import { DocumentsReportsSettingsView } from './modules/settings/DocumentsReportsSettingsView';

const STORAGE_KEY = 'ivoireappro_erp_state_v1';

type MainSection =
  | 'dashboard'
  | 'orders'
  | 'deliveries'
  | 'receptions'
  | 'calendar'
  | 'new-delivery'
  | 'delivery-detail'
  | 'contracts'
  | 'contracts-execution'
  | 'customers'
  | 'inventory'
  | 'lots'
  | 'movements'
  | 'procurement'
  | 'finance'
  | 'invoices'
  | 'payments'
  | 'expenses'
  | 'profitability'
  | 'cashflow'
  | 'documents'
  | 'reports'
  | 'settings';

export function App() {
  const [state, setState] = useState<ErpState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved) as ErpState;
      }
    } catch {
      // Fallback to initial seed
    }
    return INITIAL_ERP_STATE;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota errors
    }
  }, [state]);

  const [activeSection, setActiveSection] = useState<MainSection>('dashboard');
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string>(
    state.deliveries[0]?.id || ''
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [commandMenuOpen, setCommandMenuOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');

  // Modale Globale d'Enregistrement de Paiement (Critère d'Acceptation 15 & 16)
  const [paymentModalInvoiceId, setPaymentModalInvoiceId] = useState<
    string | null
  >(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payDate, setPayDate] = useState<string>('2026-10-07');
  const [payMethod, setPayMethod] = useState<
    'VIREMENT_TRESOR' | 'VIREMENT_BANCAIRE' | 'CHEQUE_CERTIFIE' | 'TRAITE'
  >('VIREMENT_BANCAIRE');
  const [payBankRef, setPayBankRef] = useState<string>(
    'VIR-BANK-CI-20261007-402'
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const currentUser =
    state.users.find((u) => u.id === state.currentUserId) || state.users[0];

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4500);
  };

  const handleOpenPaymentModal = (invoiceId?: string) => {
    const unpaidInvoices = state.invoices.filter((i) => i.remainingAmount > 0);
    const targetId =
      invoiceId || unpaidInvoices[0]?.id || state.invoices[0]?.id || '';
    const inv = state.invoices.find((i) => i.id === targetId);
    setPaymentModalInvoiceId(targetId);
    setPayAmount(inv ? inv.remainingAmount : 1000000);
  };

  // ==========================================================================
  // ACTIONS MÉTIER AVEC JOURNAL D'AUDIT IMMUABLE
  // ==========================================================================

  const appendAudit = (
    prevState: ErpState,
    action: AuditActionType,
    entity: string,
    entityId: string,
    summary: string
  ) => {
    const user =
      prevState.users.find((u) => u.id === prevState.currentUserId) ||
      prevState.users[0];
    const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');
    return [
      {
        id: `aud-${Date.now()}`,
        organizationId: prevState.organization.id,
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        action,
        entity,
        entityId,
        summary,
        ipAddress: '10.0.14.22',
        createdAt: nowStr,
      },
      ...prevState.auditLogs,
    ];
  };

  const handleCreateDelivery = (payload: {
    contractId: string;
    orderId: string;
    destinationId: string;
    plannedDate: string;
    driverName: string;
    vehiclePlate: string;
    responsibleUser: string;
    overrideReason?: string;
    notes: string;
    lines: Array<{
      contractLineId: string;
      productId: string;
      lotNumber: string;
      quantityDelivered: number;
    }>;
    generateInitialPdf: boolean;
  }): Delivery => {
    const seq = generateNextSequenceNumber(
      'BL',
      state.sequences.BL || 128,
      2026
    );
    const contract = state.contracts.find((c) => c.id === payload.contractId)!;
    const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const newDeliveryId = `del-${Date.now()}`;

    const builtLines = payload.lines.map((l, idx) => {
      const cline = contract.lines.find((cl) => cl.id === l.contractLineId)!;
      return {
        id: `dline-${Date.now()}-${idx}`,
        deliveryId: newDeliveryId,
        contractLineId: l.contractLineId,
        productId: l.productId,
        lotNumber: l.lotNumber,
        unit: cline.unit,
        quantityPlanned: l.quantityDelivered,
        quantityDelivered: l.quantityDelivered,
        quantityAccepted: 0,
        quantityRejected: 0,
        unitPrice: cline.unitPrice,
      };
    });

    const newDelivery: Delivery = {
      id: newDeliveryId,
      organizationId: state.organization.id,
      reference: seq.formatted,
      contractId: payload.contractId,
      orderId: payload.orderId,
      destinationId: payload.destinationId,
      plannedDate: payload.plannedDate,
      status: DeliveryStatus.DISPATCHED,
      driverName: payload.driverName,
      vehiclePlate: payload.vehiclePlate,
      responsibleUser: payload.responsibleUser,
      overrideReason: payload.overrideReason,
      notes: payload.notes,
      lines: builtLines,
      statusHistory: [
        {
          id: `sh-${Date.now()}-1`,
          status: DeliveryStatus.PLANNED,
          changedBy: currentUser.name,
          comment: 'Dossier de livraison créé et quantités vérifiées',
          changedAt: nowStr,
        },
        {
          id: `sh-${Date.now()}-2`,
          status: DeliveryStatus.DISPATCHED,
          changedBy: currentUser.name,
          comment:
            'Bordereau validé et marchandise expédiée vers le site client',
          changedAt: nowStr,
        },
      ],
    };

    // Mouvements de stock de sortie immuables
    const newMovements: StockMovement[] = builtLines.map((bl, idx) => ({
      id: `mov-${Date.now()}-${idx}`,
      organizationId: state.organization.id,
      warehouseId: state.warehouses[0].id,
      productId: bl.productId,
      lotId:
        state.stockLots.find((lt) => lt.lotNumber === bl.lotNumber)?.id ||
        state.stockLots[0].id,
      lotNumber: bl.lotNumber,
      type: StockMovementType.DELIVERY,
      quantityDelta: -bl.quantityDelivered,
      referenceDoc: seq.formatted,
      reason: `Sortie sur bordereau ${seq.formatted} (${contract.reference})`,
      performedBy: currentUser.name,
      createdAt: nowStr,
    }));

    const newDoc: StoredDocument = {
      id: `doc-${Date.now()}`,
      organizationId: state.organization.id,
      entityType: 'DELIVERY',
      entityId: newDelivery.id,
      entityReference: newDelivery.reference,
      documentType: DocumentType.DELIVERY_NOTE,
      title: `Bordereau de Livraison ${newDelivery.reference} (v1 FINAL)`,
      fileName: `Bordereau_${newDelivery.reference}_v1_FINAL.pdf`,
      mimeType: 'application/pdf',
      version: 1,
      status: DocumentStatus.FINAL,
      templateVersion: 'v2.1-2026',
      checksum: computeDocumentChecksum(
        `${newDelivery.id}-${newDelivery.reference}-v1`
      ),
      uploadedBy: currentUser.name,
      createdAt: nowStr,
    };

    setState((prev) => ({
      ...prev,
      deliveries: [newDelivery, ...prev.deliveries],
      stockMovements: [...newMovements, ...prev.stockMovements],
      documents: [newDoc, ...prev.documents],
      sequences: { ...prev.sequences, BL: seq.nextCounter },
      auditLogs: appendAudit(
        prev,
        AuditActionType.VALIDATE,
        'Delivery',
        newDelivery.reference,
        `Validation de la livraison ${newDelivery.reference} sur contrat ${contract.reference} et génération du bordereau FINAL`
      ),
    }));

    setSelectedDeliveryId(newDelivery.id);
    setActiveSection('delivery-detail');
    triggerToast(
      `Livraison ${newDelivery.reference} validée et bordereau PDF figé avec succès.`
    );
    return newDelivery;
  };

  const handleUpdateDeliveryStatus = (
    deliveryId: string,
    nextStatus: DeliveryStatus,
    comment: string
  ) => {
    const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');
    setState((prev) => {
      const target = prev.deliveries.find((d) => d.id === deliveryId);
      if (!target) return prev;
      return {
        ...prev,
        deliveries: prev.deliveries.map((d) =>
          d.id === deliveryId
            ? {
                ...d,
                status: nextStatus,
                statusHistory: [
                  ...d.statusHistory,
                  {
                    id: `sh-${Date.now()}`,
                    status: nextStatus,
                    changedBy: currentUser.name,
                    comment,
                    changedAt: nowStr,
                  },
                ],
              }
            : d
        ),
        auditLogs: appendAudit(
          prev,
          AuditActionType.UPDATE,
          'Delivery',
          target.reference,
          `Passage au statut ${nextStatus} — ${comment}`
        ),
      };
    });
    triggerToast(`Statut de la livraison mis à jour : ${nextStatus}`);
  };

  const handleRecordReception = (
    deliveryId: string,
    updatedLines: Array<{
      lineId: string;
      quantityAccepted: number;
      quantityRejected: number;
      rejectionReason?: string;
      observation?: string;
    }>,
    generalComment: string
  ) => {
    const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');
    setState((prev) => {
      const target = prev.deliveries.find((d) => d.id === deliveryId);
      if (!target) return prev;

      const mergedLines = target.lines.map((l) => {
        const upd = updatedLines.find((u) => u.lineId === l.id);
        if (!upd) return l;
        return {
          ...l,
          quantityAccepted: upd.quantityAccepted,
          quantityRejected: upd.quantityRejected,
          rejectionReason: upd.rejectionReason,
          observation: upd.observation,
        };
      });

      const resolvedStatus = resolveReceptionDeliveryStatus(mergedLines);

      return {
        ...prev,
        deliveries: prev.deliveries.map((d) =>
          d.id === deliveryId
            ? {
                ...d,
                actualDate: nowStr.slice(0, 10),
                status: resolvedStatus,
                lines: mergedLines,
                statusHistory: [
                  ...d.statusHistory,
                  {
                    id: `sh-${Date.now()}`,
                    status: resolvedStatus,
                    changedBy: currentUser.name,
                    comment: `${generalComment} (Statut : ${resolvedStatus})`,
                    changedAt: nowStr,
                  },
                ],
              }
            : d
        ),
        auditLogs: appendAudit(
          prev,
          AuditActionType.VALIDATE,
          'Reception',
          target.reference,
          `Enregistrement réception contradictoire (${resolvedStatus}) sur ${target.reference}`
        ),
      };
    });
  };

  const handleCreateInvoiceFromDelivery = (deliveryId: string) => {
    const targetDelivery = state.deliveries.find((d) => d.id === deliveryId);
    if (!targetDelivery) return;
    const contract = state.contracts.find(
      (c) => c.id === targetDelivery.contractId
    );
    if (!contract) return;

    const seq = generateNextSequenceNumber(
      'FAC',
      state.sequences.FAC || 89,
      2026
    );
    const isReceived =
      targetDelivery.status === DeliveryStatus.RECEIVED ||
      targetDelivery.status === DeliveryStatus.PARTIALLY_RECEIVED;

    const subtotal = targetDelivery.lines.reduce(
      (acc, l) =>
        acc +
        (isReceived ? l.quantityAccepted : l.quantityDelivered) * l.unitPrice,
      0
    );

    const newInvoice: Invoice = {
      id: `inv-${Date.now()}`,
      organizationId: state.organization.id,
      reference: seq.formatted,
      customerId: contract.customerId,
      contractId: contract.id,
      deliveryId: targetDelivery.id,
      issueDate: '2026-10-07',
      dueDate: '2026-11-21',
      status: InvoiceStatus.ISSUED,
      subtotal,
      taxAmount: 0,
      totalAmount: subtotal,
      paidAmount: 0,
      remainingAmount: subtotal,
      taxCertificationStatus: TaxCertificationStatus.NOT_SUBMITTED,
      notes: `Facture établie sur justificatif de livraison ${targetDelivery.reference}.`,
    };

    const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const newDoc: StoredDocument = {
      id: `doc-inv-${Date.now()}`,
      organizationId: state.organization.id,
      entityType: 'INVOICE',
      entityId: newInvoice.id,
      entityReference: newInvoice.reference,
      documentType: DocumentType.INVOICE,
      title: `Facture Commerciale ${newInvoice.reference} — ${targetDelivery.reference}`,
      fileName: `${newInvoice.reference}_FINAL.pdf`,
      mimeType: 'application/pdf',
      version: 1,
      status: DocumentStatus.FINAL,
      templateVersion: 'v2.0-2026',
      checksum: computeDocumentChecksum(
        `${newInvoice.id}-${newInvoice.reference}-${subtotal}`
      ),
      uploadedBy: currentUser.name,
      createdAt: nowStr,
    };

    setState((prev) => ({
      ...prev,
      invoices: [newInvoice, ...prev.invoices],
      documents: [newDoc, ...prev.documents],
      sequences: { ...prev.sequences, FAC: seq.nextCounter },
      auditLogs: appendAudit(
        prev,
        AuditActionType.CREATE,
        'Invoice',
        newInvoice.reference,
        `Émission de la facture ${newInvoice.reference} (${formatFcfa(
          subtotal
        )}) rattachée à ${targetDelivery.reference}`
      ),
    }));

    triggerToast(
      `Facture ${newInvoice.reference} générée (${formatFcfa(subtotal)}).`
    );
  };

  const handleConfirmPayment = () => {
    if (!paymentModalInvoiceId || payAmount <= 0) return;
    const targetInv = state.invoices.find(
      (i) => i.id === paymentModalInvoiceId
    );
    if (!targetInv) return;

    const seq = generateNextSequenceNumber(
      'REG',
      state.sequences.REG || 31,
      2026
    );
    const updatedInvoice = applyPaymentToInvoice(
      targetInv,
      payAmount,
      '2026-10-07'
    );

    const newPayment: Payment = {
      id: `pay-${Date.now()}`,
      organizationId: state.organization.id,
      reference: seq.formatted,
      invoiceId: targetInv.id,
      customerId: targetInv.customerId,
      paymentDate: payDate,
      amount: payAmount,
      method: payMethod,
      bankReference: payBankRef,
      recordedBy: currentUser.name,
    };

    setState((prev) => ({
      ...prev,
      invoices: prev.invoices.map((i) =>
        i.id === targetInv.id ? updatedInvoice : i
      ),
      payments: [newPayment, ...prev.payments],
      sequences: { ...prev.sequences, REG: seq.nextCounter },
      auditLogs: appendAudit(
        prev,
        AuditActionType.PAYMENT_RECORDED,
        'Invoice',
        targetInv.reference,
        `Encaissement ${seq.formatted} de ${formatFcfa(payAmount)} sur ${
          targetInv.reference
        } (Nouveau solde : ${formatFcfa(updatedInvoice.remainingAmount)})`
      ),
    }));

    setPaymentModalInvoiceId(null);
    triggerToast(
      `Paiement ${seq.formatted} enregistré (${formatFcfa(
        payAmount
      )}). Solde mis à jour.`
    );
  };

  // ==========================================================================
  // NAVIGATION SIDEBAR CONFORME SECTION 30
  // ==========================================================================
  const navGroups = [
    {
      group: 'Pilotage',
      items: [
        {
          id: 'dashboard' as MainSection,
          label: 'Dashboard & Direction',
          icon: LayoutDashboard,
        },
      ],
    },
    {
      group: 'Opérations',
      items: [
        {
          id: 'orders' as MainSection,
          label: 'Commandes',
          icon: ShoppingCart,
        },
        {
          id: 'deliveries' as MainSection,
          label: 'Livraisons',
          icon: Truck,
        },
        {
          id: 'receptions' as MainSection,
          label: 'Réceptions & Réserves',
          icon: ClipboardCheck,
        },
        {
          id: 'calendar' as MainSection,
          label: 'Calendrier Logistique',
          icon: Calendar,
        },
      ],
    },
    {
      group: 'Contrats',
      items: [
        {
          id: 'contracts' as MainSection,
          label: 'Marchés & Contrats',
          icon: FolderKanban,
        },
        {
          id: 'contracts-execution' as MainSection,
          label: 'Exécution & Reliquats',
          icon: CheckCircle2,
        },
        {
          id: 'customers' as MainSection,
          label: 'Clients & Destinations',
          icon: Building2,
        },
      ],
    },
    {
      group: 'Stocks & Achats',
      items: [
        {
          id: 'inventory' as MainSection,
          label: 'Produits & Stocks',
          icon: Package,
        },
        {
          id: 'lots' as MainSection,
          label: 'Lots & Péremptions',
          icon: Boxes,
        },
        {
          id: 'movements' as MainSection,
          label: 'Mouvements Immuables',
          icon: FileSpreadsheet,
        },
        {
          id: 'procurement' as MainSection,
          label: 'Fournisseurs & Achats',
          icon: ShoppingCart,
        },
      ],
    },
    {
      group: 'Finance',
      items: [
        {
          id: 'finance' as MainSection,
          label: 'Créances',
          icon: Wallet,
        },
        {
          id: 'invoices' as MainSection,
          label: 'Factures',
          icon: Receipt,
        },
        {
          id: 'payments' as MainSection,
          label: 'Paiements',
          icon: CheckCircle2,
        },
        {
          id: 'expenses' as MainSection,
          label: 'Dépenses',
          icon: FileText,
        },
        {
          id: 'profitability' as MainSection,
          label: 'Rentabilité & Marges',
          icon: BarChart3,
        },
        {
          id: 'cashflow' as MainSection,
          label: 'Trésorerie Prévisionnelle',
          icon: TrendingUp,
        },
      ],
    },
    {
      group: 'Gouvernance',
      items: [
        {
          id: 'documents' as MainSection,
          label: 'Documents & Bordereaux',
          icon: FileText,
        },
        {
          id: 'reports' as MainSection,
          label: 'Rapports & Exports',
          icon: BarChart3,
        },
        {
          id: 'settings' as MainSection,
          label: 'Paramètres, RBAC & Audit',
          icon: Settings,
        },
      ],
    },
  ];

  const activeDelivery =
    state.deliveries.find((d) => d.id === selectedDeliveryId) ||
    state.deliveries[0];

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* SIDEBAR DESKTOP (260px - SaaS & Dashboard Reference) */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-slate-200 bg-slate-950 text-slate-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <button
            type="button"
            onClick={() => setActiveSection('dashboard')}
            className="text-left"
          >
            <span className="text-base font-bold tracking-tight text-white block">
              IvoireAppro ERP
            </span>
            <span className="text-[11px] text-slate-400 block truncate max-w-[200px]">
              {state.organization.tradeName}
            </span>
          </button>
        </div>

        {/* Bouton Prioritaire Nouvelle Livraison */}
        <div className="p-3 border-b border-slate-800">
          <button
            type="button"
            onClick={() => setActiveSection('new-delivery')}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nouvelle Livraison (BL)
          </button>
        </div>

        {/* Menu de navigation structuré */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
          {navGroups.map((grp) => (
            <div key={grp.group}>
              <p className="px-2.5 text-[11px] font-semibold text-slate-400 mb-1.5">
                {grp.group}
              </p>
              <div className="space-y-0.5">
                {grp.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveSection(item.id)}
                      className={`w-full flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-slate-800 text-white font-semibold'
                          : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Pied de Sidebar : Profil RBAC actif */}
        <div className="border-t border-slate-800 p-3.5 text-xs">
          <p className="text-[11px] text-slate-400">Session RBAC active :</p>
          <p className="font-semibold text-white truncate mt-0.5">
            {currentUser.name}
          </p>
          <p className="font-mono text-[11px] text-emerald-400">
            Rôle : {currentUser.role}
          </p>
        </div>
      </aside>

      {/* CONTENU PRINCIPAL */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* TOP HEADER BAR (3-Zone Contract : Breadcrumb — Command/Role — Primary Action) */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
          {/* Zone 1 : Mobile Menu + Breadcrumb */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden rounded border border-slate-200 p-1.5 text-slate-700"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <button
                type="button"
                onClick={() => setActiveSection('dashboard')}
                className="font-semibold text-slate-900 hover:underline"
              >
                IvoireAppro
              </button>
              <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              <span className="font-medium text-slate-700">
                {activeSection.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Zone 2 : Recherche Rapide (Command Menu) & Sélecteur Rôle RBAC */}
          <div className="hidden md:flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCommandMenuOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-500 hover:border-slate-300"
            >
              <Search className="h-3.5 w-3.5" />
              <span>Rechercher marché, BL, facture...</span>
            </button>

            <div className="flex items-center gap-1.5 text-xs">
              <UserCheck className="h-3.5 w-3.5 text-slate-500" />
              <select
                value={state.currentUserId}
                onChange={(e) => {
                  const nextUserId = e.target.value;
                  const usr = state.users.find((u) => u.id === nextUserId);
                  setState((prev) => ({
                    ...prev,
                    currentUserId: nextUserId,
                  }));
                  if (usr) {
                    triggerToast(
                      `Profil basculé sur ${usr.name} (${usr.roleLabel})`
                    );
                  }
                }}
                aria-label="Sélecteur de rôle RBAC"
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800"
              >
                {state.users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.role} — {u.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Zone 3 : Actions Primaires */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem(STORAGE_KEY);
                setState(INITIAL_ERP_STATE);
                triggerToast('Données de démonstration réinitialisées.');
              }}
              title="Réinitialiser les données de démo"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 whitespace-nowrap"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Réinitialiser Démo</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('new-delivery')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" />
              Nouvelle Livraison
            </button>
          </div>
        </header>

        {/* DRAWER MOBILE */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div
              className="fixed inset-0 bg-slate-900/60"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="relative w-64 max-w-xs bg-slate-950 text-slate-200 p-4 overflow-y-auto space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="font-bold text-white">IvoireAppro ERP</span>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-slate-400"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {navGroups.map((grp) => (
                <div key={grp.group}>
                  <p className="text-[11px] font-semibold text-slate-400 mb-1">
                    {grp.group}
                  </p>
                  {grp.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveSection(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className="w-full text-left py-1.5 px-2 rounded text-xs text-slate-300 hover:bg-slate-800"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TOAST NOTIFICATION */}
        {toastMessage && (
          <div className="fixed bottom-5 right-5 z-50 rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-xs font-medium text-white shadow-lg flex items-center gap-3">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* VIEWPORT PRINCIPAL */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          {activeSection === 'dashboard' && (
            <DashboardView
              state={state}
              onNavigate={(sec) => setActiveSection(sec as MainSection)}
              onSelectDelivery={(delId) => {
                setSelectedDeliveryId(delId);
                setActiveSection('delivery-detail');
              }}
              onStartNewDelivery={() => setActiveSection('new-delivery')}
              onOpenPaymentModal={handleOpenPaymentModal}
            />
          )}

          {activeSection === 'new-delivery' && (
            <NewDeliveryWizard
              state={state}
              onCancel={() => setActiveSection('deliveries')}
              onCreateDelivery={handleCreateDelivery}
            />
          )}

          {activeSection === 'delivery-detail' && activeDelivery && (
            <DeliveryDetailView
              delivery={activeDelivery}
              state={state}
              onBack={() => setActiveSection('deliveries')}
              onUpdateStatus={handleUpdateDeliveryStatus}
              onRecordReception={handleRecordReception}
              onCreateInvoiceFromDelivery={handleCreateInvoiceFromDelivery}
              onGenerateAndArchiveDocument={({
                deliveryId,
                docType,
                title,
                fileName,
                checksum,
              }) => {
                const nowStr = new Date()
                  .toISOString()
                  .slice(0, 16)
                  .replace('T', ' ');
                const del = state.deliveries.find((d) => d.id === deliveryId);
                if (!del) return;
                const existingCount = state.documents.filter(
                  (d) =>
                    d.entityType === 'DELIVERY' &&
                    d.entityId === deliveryId &&
                    d.documentType === docType
                ).length;

                const newDoc: StoredDocument = {
                  id: `doc-${Date.now()}`,
                  organizationId: state.organization.id,
                  entityType: 'DELIVERY',
                  entityId: deliveryId,
                  entityReference: del.reference,
                  documentType: docType,
                  title,
                  fileName,
                  mimeType: 'application/pdf',
                  version: existingCount + 1,
                  status: DocumentStatus.FINAL,
                  templateVersion: 'v2.1-2026',
                  checksum,
                  uploadedBy: currentUser.name,
                  createdAt: nowStr,
                };

                setState((prev) => ({
                  ...prev,
                  documents: [newDoc, ...prev.documents],
                  auditLogs: appendAudit(
                    prev,
                    AuditActionType.DOCUMENT_FINALIZED,
                    'Document',
                    del.reference,
                    `Archivage et verrouillage FINAL de "${title}" (${fileName})`
                  ),
                }));
              }}
              onOpenPaymentModal={(invId) => handleOpenPaymentModal(invId)}
            />
          )}

          {(activeSection === 'deliveries' ||
            activeSection === 'receptions' ||
            activeSection === 'calendar') && (
            <DeliveriesListView
              key={activeSection}
              state={state}
              initialSubTab={
                activeSection === 'receptions'
                  ? 'RECEPTIONS'
                  : activeSection === 'calendar'
                  ? 'CALENDAR'
                  : 'ALL'
              }
              onSelectDelivery={(delId) => {
                setSelectedDeliveryId(delId);
                setActiveSection('delivery-detail');
              }}
              onStartNewDelivery={() => setActiveSection('new-delivery')}
            />
          )}

          {(activeSection === 'contracts' ||
            activeSection === 'contracts-execution' ||
            activeSection === 'orders' ||
            activeSection === 'customers') && (
            <ContractsAndOrdersView
              key={activeSection}
              state={state}
              initialSubTab={
                activeSection === 'contracts-execution'
                  ? 'EXECUTION'
                  : activeSection === 'orders'
                  ? 'ORDERS'
                  : activeSection === 'customers'
                  ? 'CUSTOMERS'
                  : 'CONTRACTS'
              }
              onStartNewDelivery={() => setActiveSection('new-delivery')}
              onAddCustomer={(payload) => {
                const newCustId = `cust-${Date.now()}`;
                const newCustomer: Customer = {
                  id: newCustId,
                  organizationId: state.organization.id,
                  code: payload.code,
                  name: payload.name,
                  category: payload.category,
                  taxIdentifier: payload.taxIdentifier,
                  paymentTermsDays: payload.paymentTermsDays,
                  primaryContactName: payload.primaryContactName,
                  primaryContactRole: 'Responsable Approvisionnements',
                  primaryContactPhone: payload.primaryContactPhone,
                  primaryContactEmail: 'contact@institution-demo.example',
                  destinations: [
                    {
                      id: `dest-${Date.now()}`,
                      customerId: newCustId,
                      siteName: payload.siteName,
                      city: payload.city,
                      addressLine: payload.addressLine,
                      receivingHours: payload.receivingHours,
                      requiredDocTypes: ['Bordereau de livraison signé'],
                      contactPerson: payload.primaryContactName,
                      contactPhone: payload.primaryContactPhone,
                    },
                  ],
                };
                setState((prev) => ({
                  ...prev,
                  customers: [...prev.customers, newCustomer],
                  auditLogs: appendAudit(
                    prev,
                    AuditActionType.CREATE,
                    'Customer',
                    newCustomer.code,
                    `Création de l'organisme client ${newCustomer.name}`
                  ),
                }));
                triggerToast(`Client ${newCustomer.name} ajouté avec succès.`);
              }}
              onAddContract={(payload) => {
                const newContractId = `ctr-${Date.now()}`;
                const builtLines = payload.lines.map((l, idx) => ({
                  id: `cline-${Date.now()}-${idx}`,
                  contractId: newContractId,
                  productId: l.productId,
                  unit: l.unit,
                  quantity: l.quantity,
                  unitPrice: l.unitPrice,
                  taxRate: l.taxRate,
                  totalAmount: l.quantity * l.unitPrice,
                }));
                const totalAmount = builtLines.reduce(
                  (s, l) => s + l.totalAmount,
                  0
                );
                const newContract: Contract = {
                  id: newContractId,
                  organizationId: state.organization.id,
                  reference: payload.reference,
                  title: payload.title,
                  customerId: payload.customerId,
                  startDate: payload.startDate,
                  endDate: payload.endDate,
                  status: ContractStatus.ACTIVE,
                  currency: 'XOF',
                  totalAmount,
                  notes: payload.notes,
                  lines: builtLines,
                };
                setState((prev) => ({
                  ...prev,
                  contracts: [newContract, ...prev.contracts],
                  auditLogs: appendAudit(
                    prev,
                    AuditActionType.CREATE,
                    'Contract',
                    newContract.reference,
                    `Activation du marché ${newContract.reference} (${formatFcfa(
                      totalAmount
                    )})`
                  ),
                }));
                triggerToast(
                  `Contrat ${newContract.reference} créé (${formatFcfa(
                    totalAmount
                  )}).`
                );
              }}
              onAddOrder={(payload) => {
                const seq = generateNextSequenceNumber(
                  'CMD',
                  state.sequences.CMD || 42,
                  2026
                );
                const newOrder: CustomerOrder = {
                  id: `ord-${Date.now()}`,
                  organizationId: state.organization.id,
                  reference: seq.formatted,
                  contractId: payload.contractId,
                  destinationId: payload.destinationId,
                  orderDate: '2026-10-07',
                  requestedDate: payload.requestedDate,
                  status: 'CONFIRMED',
                  totalAmount: payload.totalAmount,
                  notes: payload.notes,
                };
                setState((prev) => ({
                  ...prev,
                  orders: [newOrder, ...prev.orders],
                  sequences: { ...prev.sequences, CMD: seq.nextCounter },
                  auditLogs: appendAudit(
                    prev,
                    AuditActionType.CREATE,
                    'Order',
                    newOrder.reference,
                    `Enregistrement de la commande client ${newOrder.reference}`
                  ),
                }));
                triggerToast(`Commande ${newOrder.reference} enregistrée.`);
              }}
            />
          )}

          {(activeSection === 'inventory' ||
            activeSection === 'lots' ||
            activeSection === 'movements' ||
            activeSection === 'procurement') && (
            <InventoryAndProcurementView
              key={activeSection}
              state={state}
              initialSubTab={
                activeSection === 'lots'
                  ? 'LOTS'
                  : activeSection === 'movements'
                  ? 'MOVEMENTS'
                  : activeSection === 'procurement'
                  ? 'PROCUREMENT'
                  : 'PRODUCTS'
              }
              onRecordStockMovement={(payload) => {
                const nowStr = new Date()
                  .toISOString()
                  .slice(0, 16)
                  .replace('T', ' ');
                const newMov: StockMovement = {
                  id: `mov-${Date.now()}`,
                  organizationId: state.organization.id,
                  warehouseId: state.warehouses[0].id,
                  productId: payload.productId,
                  lotId: state.stockLots[0].id,
                  lotNumber: payload.lotNumber,
                  type: payload.type,
                  quantityDelta: payload.quantityDelta,
                  referenceDoc: payload.referenceDoc,
                  reason: payload.reason,
                  performedBy: currentUser.name,
                  createdAt: nowStr,
                };
                setState((prev) => ({
                  ...prev,
                  stockMovements: [newMov, ...prev.stockMovements],
                  auditLogs: appendAudit(
                    prev,
                    AuditActionType.CREATE,
                    'StockMovement',
                    payload.referenceDoc,
                    `Mouvement de stock immuable ${payload.type} (${payload.quantityDelta}) — Lot ${payload.lotNumber}`
                  ),
                }));
                triggerToast(
                  'Mouvement de stock enregistré et stock courant recalculé.'
                );
              }}
              onCreatePurchaseOrder={(payload) => {
                const seq = generateNextSequenceNumber(
                  'ACH',
                  state.sequences.ACH || 19,
                  2026
                );
                const nowStr = new Date()
                  .toISOString()
                  .slice(0, 16)
                  .replace('T', ' ');
                const totalAmount = payload.quantity * payload.unitCost;
                const newMov: StockMovement = {
                  id: `mov-po-${Date.now()}`,
                  organizationId: state.organization.id,
                  warehouseId: state.warehouses[0].id,
                  productId: payload.productId,
                  lotId: state.stockLots[0].id,
                  lotNumber: `LOT-${seq.formatted}`,
                  type: StockMovementType.RECEIPT,
                  quantityDelta: payload.quantity,
                  referenceDoc: seq.formatted,
                  reason: `Réception commande fournisseur ${seq.formatted}`,
                  performedBy: currentUser.name,
                  createdAt: nowStr,
                };
                setState((prev) => ({
                  ...prev,
                  purchaseOrders: [
                    {
                      id: `po-${Date.now()}`,
                      organizationId: prev.organization.id,
                      reference: seq.formatted,
                      supplierId: payload.supplierId,
                      productId: payload.productId,
                      quantity: payload.quantity,
                      unitCost: payload.unitCost,
                      totalAmount,
                      orderDate: '2026-10-07',
                      expectedDate: payload.expectedDate,
                      status: 'RECEIVED',
                    },
                    ...prev.purchaseOrders,
                  ],
                  stockMovements: [newMov, ...prev.stockMovements],
                  sequences: { ...prev.sequences, ACH: seq.nextCounter },
                  auditLogs: appendAudit(
                    prev,
                    AuditActionType.CREATE,
                    'PurchaseOrder',
                    seq.formatted,
                    `Commande d'achat ${seq.formatted} réceptionnée (+${payload.quantity} en stock)`
                  ),
                }));
                triggerToast(
                  `Commande d'achat ${seq.formatted} créée et entrée en stock enregistrée.`
                );
              }}
            />
          )}

          {(activeSection === 'finance' ||
            activeSection === 'invoices' ||
            activeSection === 'payments' ||
            activeSection === 'expenses' ||
            activeSection === 'profitability' ||
            activeSection === 'cashflow') && (
            <FinanceAndReceivablesView
              key={activeSection}
              state={state}
              initialSubTab={
                activeSection === 'invoices'
                  ? 'INVOICES'
                  : activeSection === 'payments'
                  ? 'PAYMENTS'
                  : activeSection === 'expenses'
                  ? 'EXPENSES'
                  : activeSection === 'profitability'
                  ? 'PROFITABILITY'
                  : activeSection === 'cashflow'
                  ? 'CASHFLOW'
                  : 'RECEIVABLES'
              }
              onOpenPaymentModal={handleOpenPaymentModal}
              onCreateInvoiceFromDelivery={handleCreateInvoiceFromDelivery}
              onUpdateTaxCertification={(invId, nextStatus) => {
                setState((prev) => ({
                  ...prev,
                  invoices: prev.invoices.map((i) =>
                    i.id === invId
                      ? { ...i, taxCertificationStatus: nextStatus }
                      : i
                  ),
                }));
                triggerToast(
                  `Statut InvoiceCertificationService mis à jour : ${nextStatus}`
                );
              }}
              onAddExpense={(payload) => {
                const seq = generateNextSequenceNumber(
                  'DEP',
                  state.sequences.DEP || 55,
                  2026
                );
                const newExp: Expense = {
                  id: `exp-${Date.now()}`,
                  organizationId: state.organization.id,
                  reference: seq.formatted,
                  category: payload.category,
                  label: payload.label,
                  amount: payload.amount,
                  expenseDate: payload.expenseDate,
                  contractId: payload.contractId,
                  deliveryId: payload.deliveryId,
                  status: 'PAID',
                  recordedBy: currentUser.name,
                };
                setState((prev) => ({
                  ...prev,
                  expenses: [newExp, ...prev.expenses],
                  sequences: { ...prev.sequences, DEP: seq.nextCounter },
                  auditLogs: appendAudit(
                    prev,
                    AuditActionType.CREATE,
                    'Expense',
                    seq.formatted,
                    `Enregistrement dépense ${seq.formatted} (${formatFcfa(
                      payload.amount
                    )}) — ${payload.label}`
                  ),
                }));
                triggerToast(
                  `Dépense ${seq.formatted} enregistrée et imputée à la marge.`
                );
              }}
            />
          )}

          {(activeSection === 'documents' ||
            activeSection === 'reports' ||
            activeSection === 'settings') && (
            <DocumentsReportsSettingsView
              key={activeSection}
              state={state}
              mode={
                activeSection === 'documents'
                  ? 'DOCUMENTS'
                  : activeSection === 'reports'
                  ? 'REPORTS'
                  : 'SETTINGS'
              }
              onSwitchUser={(userId) => {
                setState((prev) => ({ ...prev, currentUserId: userId }));
                const u = state.users.find((x) => x.id === userId);
                if (u) triggerToast(`Session active : ${u.name} (${u.role})`);
              }}
              onUpdateOrganization={(org) => {
                setState((prev) => ({
                  ...prev,
                  organization: org,
                  auditLogs: appendAudit(
                    prev,
                    AuditActionType.UPDATE,
                    'Organization',
                    org.id,
                    `Mise à jour des paramètres de l'entreprise ${org.tradeName}`
                  ),
                }));
                triggerToast('Paramètres de l’entreprise mis à jour.');
              }}
            />
          )}
        </main>
      </div>

      {/* MODALE GLOBALE D'ENREGISTREMENT DE PAIEMENT (CRITÈRE D'ACCEPTATION 15 & 16) */}
      {paymentModalInvoiceId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                Enregistrer un Encaissement Client & Diminuer la Créance
              </h3>
              <button
                type="button"
                onClick={() => setPaymentModalInvoiceId(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Facture à rapprocher *
                </label>
                <select
                  value={paymentModalInvoiceId}
                  onChange={(e) => {
                    setPaymentModalInvoiceId(e.target.value);
                    const inv = state.invoices.find(
                      (i) => i.id === e.target.value
                    );
                    if (inv) setPayAmount(inv.remainingAmount);
                  }}
                  className="w-full rounded border border-slate-300 px-3 py-2 font-mono"
                >
                  {state.invoices.map((inv) => {
                    const cust = state.customers.find(
                      (c) => c.id === inv.customerId
                    );
                    return (
                      <option key={inv.id} value={inv.id}>
                        {inv.reference} — {cust?.code} — Solde dû :{' '}
                        {formatFcfa(inv.remainingAmount)}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Montant Encaissé (FCFA) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={payAmount}
                    onChange={(e) => setPayAmount(Number(e.target.value))}
                    className="w-full rounded border border-slate-300 px-3 py-2 font-mono tabular-nums font-bold text-right text-emerald-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Date de règlement *
                  </label>
                  <input
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full rounded border border-slate-300 px-3 py-2 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Mode de règlement *
                  </label>
                  <select
                    value={payMethod}
                    onChange={(e) =>
                      setPayMethod(e.target.value as typeof payMethod)
                    }
                    className="w-full rounded border border-slate-300 px-3 py-2"
                  >
                    <option value="VIREMENT_BANCAIRE">Virement Bancaire</option>
                    <option value="VIREMENT_TRESOR">
                      Virement Trésor / Mandat
                    </option>
                    <option value="CHEQUE_CERTIFIE">Chèque Certifié</option>
                    <option value="TRAITE">Traite Avalisée</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Référence Bancaire / Avis *
                  </label>
                  <input
                    type="text"
                    value={payBankRef}
                    onChange={(e) => setPayBankRef(e.target.value)}
                    className="w-full rounded border border-slate-300 px-3 py-2 font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => setPaymentModalInvoiceId(null)}
                className="rounded border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmPayment}
                className="rounded bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Valider l’Encaissement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COMMAND MENU DE RECHERCHE GLOBALE */}
      {commandMenuOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/60 pt-20 p-4">
          <div className="w-full max-w-xl rounded-lg border border-slate-200 bg-white p-4 shadow-xl space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2.5">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                type="text"
                autoFocus
                placeholder="Rechercher un numéro de BL, un marché, une facture ou un produit..."
                value={commandQuery}
                onChange={(e) => setCommandQuery(e.target.value)}
                className="w-full text-xs text-slate-900 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setCommandMenuOpen(false)}
                className="text-xs text-slate-500 hover:text-slate-800"
              >
                Fermer
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 text-xs">
              {state.deliveries
                .filter((d) =>
                  d.reference.toLowerCase().includes(commandQuery.toLowerCase())
                )
                .map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => {
                      setSelectedDeliveryId(d.id);
                      setActiveSection('delivery-detail');
                      setCommandMenuOpen(false);
                    }}
                    className="w-full text-left py-2 px-2 hover:bg-slate-50 flex items-center justify-between"
                  >
                    <span>
                      <strong className="font-mono">{d.reference}</strong> —
                      Livraison ({d.status})
                    </span>
                    <span className="text-slate-400">Ouvrir →</span>
                  </button>
                ))}
              {state.contracts
                .filter(
                  (c) =>
                    c.reference
                      .toLowerCase()
                      .includes(commandQuery.toLowerCase()) ||
                    c.title.toLowerCase().includes(commandQuery.toLowerCase())
                )
                .map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setActiveSection('contracts');
                      setCommandMenuOpen(false);
                    }}
                    className="w-full text-left py-2 px-2 hover:bg-slate-50 flex items-center justify-between"
                  >
                    <span>
                      <strong className="font-mono">{c.reference}</strong> —{' '}
                      {c.title}
                    </span>
                    <span className="text-slate-400">Marché →</span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
