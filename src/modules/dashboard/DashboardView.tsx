import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  BadgePercent,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  FileSpreadsheet,
  FileText,
  Layers,
  Package,
  Plus,
  Receipt,
  ShieldAlert,
  TrendingUp,
  Truck,
  Wallet,
} from 'lucide-react';
import {
  ContractStatus,
  Delivery,
  DeliveryStatus,
  ErpState,
  InvoiceStatus,
} from '../shared/types';
import {
  calculateContractProgress,
  calculateContributionMarginByContract,
  calculateProductStockFromMovements,
  formatFcfa,
  formatQty,
} from '../shared/domainEngine';

interface DashboardViewProps {
  state: ErpState;
  onNavigate: (section: string) => void;
  onSelectDelivery: (deliveryId: string) => void;
  onStartNewDelivery: () => void;
  onOpenPaymentModal: (invoiceId?: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  state,
  onNavigate,
  onSelectDelivery,
  onStartNewDelivery,
  onOpenPaymentModal,
}) => {
  const [dashboardMode, setDashboardMode] = useState<'OPERATIONAL' | 'EXECUTIVE'>('OPERATIONAL');
  const [deliveryFilter, setDeliveryFilter] = useState<'TODAY' | 'TOMORROW' | 'WEEK' | 'LATE'>('TODAY');
  const [receivableFilter, setReceivableFilter] = useState<'OPEN' | 'OVERDUE' | 'PAID'>('OPEN');

  const currentUser =
    state.users.find((u) => u.id === state.currentUserId) || state.users[0];
  const todayStr = '2026-10-07';
  const tomorrowStr = '2026-10-08';

  // Calculs dynamiques des KPIs à partir de l'état de la base de données
  const activeContracts = state.contracts.filter(
    (c) => c.status === ContractStatus.ACTIVE
  );

  const deliveriesToday = state.deliveries.filter((d) => d.plannedDate === todayStr);
  const deliveriesTomorrow = state.deliveries.filter(
    (d) => d.plannedDate === tomorrowStr
  );
  const deliveriesLate = state.deliveries.filter(
    (d) =>
      d.plannedDate < todayStr &&
      d.status !== DeliveryStatus.RECEIVED &&
      d.status !== DeliveryStatus.PARTIALLY_RECEIVED &&
      d.status !== DeliveryStatus.CLOSED &&
      d.status !== DeliveryStatus.CANCELLED
  );
  const deliveriesPending = state.deliveries.filter(
    (d) =>
      d.status === DeliveryStatus.PLANNED ||
      d.status === DeliveryStatus.PREPARING ||
      d.status === DeliveryStatus.READY ||
      d.status === DeliveryStatus.DISPATCHED
  );

  // Montant livré accepté vs en transit
  let totalDeliveredAcceptedAmount = 0;
  let totalToInvoiceAmount = 0;
  for (const d of state.deliveries) {
    if (
      d.status === DeliveryStatus.RECEIVED ||
      d.status === DeliveryStatus.PARTIALLY_RECEIVED ||
      d.status === DeliveryStatus.CLOSED
    ) {
      const val = d.lines.reduce(
        (acc, l) => acc + l.quantityAccepted * l.unitPrice,
        0
      );
      totalDeliveredAcceptedAmount += val;
      const hasInvoice = state.invoices.some((inv) => inv.deliveryId === d.id);
      if (!hasInvoice) {
        totalToInvoiceAmount += val;
      }
    }
  }

  const totalInvoiced = state.invoices.reduce((acc, i) => acc + i.totalAmount, 0);
  const totalCollected = state.invoices.reduce((acc, i) => acc + i.paidAmount, 0);
  const totalReceivablesOpen = state.invoices.reduce(
    (acc, i) => acc + i.remainingAmount,
    0
  );
  const totalReceivablesOverdue = state.invoices
    .filter((i) => i.status === InvoiceStatus.OVERDUE || (i.remainingAmount > 0 && i.dueDate < todayStr))
    .reduce((acc, i) => acc + i.remainingAmount, 0);

  // Métriques financières consolidées (Cartes KPI du Dashboard)
  const totalRevenue = totalInvoiced;
  const recoveryRate =
    totalRevenue > 0
      ? Number(((totalCollected / totalRevenue) * 100).toFixed(1))
      : 0;
  const totalRecordedExpenses = (state.expenses || []).reduce(
    (acc, e) => acc + e.amount,
    0
  );
  const netOperatingMargin = totalRevenue - totalRecordedExpenses;

  // Stock critique & Péremptions proches
  const criticalStockProducts = state.products.filter((p) => {
    const currentStock = calculateProductStockFromMovements(
      p.id,
      state.stockMovements
    );
    return currentStock <= p.minStockThreshold;
  });

  const expiringLots = state.stockLots.filter(
    (lot) => lot.expiryDate <= '2026-11-15'
  );

  // Marge sur coûts directs globale
  const contractMargins = state.contracts.map((c) =>
    calculateContributionMarginByContract(c, state)
  );
  const totalContributionMargin = contractMargins.reduce(
    (acc, m) => acc + m.contributionMargin,
    0
  );
  const totalDirectCosts = contractMargins.reduce(
    (acc, m) => acc + m.totalDirectCost,
    0
  );

  // Filtrage du widget Livraisons
  const filteredWidgetDeliveries: Delivery[] = (() => {
    if (deliveryFilter === 'TODAY') return deliveriesToday;
    if (deliveryFilter === 'TOMORROW') return deliveriesTomorrow;
    if (deliveryFilter === 'LATE') return deliveriesLate;
    return state.deliveries.filter(
      (d) => d.plannedDate >= '2026-10-04' && d.plannedDate <= '2026-10-11'
    );
  })();

  // Filtrage du widget Créances
  const filteredWidgetInvoices = state.invoices.filter((inv) => {
    if (receivableFilter === 'OPEN') return inv.remainingAmount > 0;
    if (receivableFilter === 'OVERDUE')
      return inv.status === InvoiceStatus.OVERDUE || (inv.remainingAmount > 0 && inv.dueDate < todayStr);
    return inv.status === InvoiceStatus.PAID || inv.paidAmount > 0;
  });

  // Alertes prioritaires (Section 26)
  const alerts = [
    ...deliveriesLate.map((d) => ({
      id: `al-del-${d.id}`,
      domain: 'Livraison en retard',
      title: `${d.reference} prévue le ${d.plannedDate} non clôturée (${d.status})`,
      actionLabel: 'Ouvrir livraison',
      onClick: () => onSelectDelivery(d.id),
      severity: 'HIGH' as const,
    })),
    ...state.deliveries
      .filter((d) => d.status === DeliveryStatus.PARTIALLY_RECEIVED)
      .map((d) => ({
        id: `al-res-${d.id}`,
        domain: 'Réception avec réserve',
        title: `${d.reference} comporte un refus partiel de marchandise à traiter`,
        actionLabel: 'Voir réserve',
        onClick: () => onSelectDelivery(d.id),
        severity: 'MEDIUM' as const,
      })),
    ...state.invoices
      .filter((i) => i.status === InvoiceStatus.OVERDUE)
      .map((i) => ({
        id: `al-inv-${i.id}`,
        domain: 'Finance · Créance échue',
        title: `Facture ${i.reference} échue (${formatFcfa(i.remainingAmount)} restant)`,
        actionLabel: 'Encaisser',
        onClick: () => onOpenPaymentModal(i.id),
        severity: 'HIGH' as const,
      })),
    ...criticalStockProducts.map((p) => ({
      id: `al-stk-${p.id}`,
      domain: 'Stock critique',
      title: `${p.name} sous le seuil d'alerte (${formatQty(
        calculateProductStockFromMovements(p.id, state.stockMovements),
        p.unit
      )})`,
      actionLabel: 'Voir stock',
      onClick: () => onNavigate('inventory'),
      severity: 'MEDIUM' as const,
    })),
    ...expiringLots.map((l) => ({
      id: `al-lot-${l.id}`,
      domain: 'Péremption proche',
      title: `Lot ${l.lotNumber} expire le ${l.expiryDate}`,
      actionLabel: 'Inspecter lot',
      onClick: () => onNavigate('inventory'),
      severity: 'MEDIUM' as const,
    })),
  ];

  return (
    <div className="space-y-6">
      {/* En-tête Salutation + Sélecteur Vue Opérationnelle / Vue Direction (Section 33 & 47) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs text-slate-500">
            Mercredi 7 Octobre 2026 · {state.organization.tradeName} · Rôle actif :{' '}
            <span className="font-medium text-slate-800">{currentUser.roleLabel}</span>
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Bonjour {currentUser.name}
          </h1>
          <p className="mt-0.5 text-sm text-slate-600">
            Pilotage de l’exécution contractuelle, des livraisons multi-sites et de la trésorerie fournisseur.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1 rounded-lg bg-slate-200/80 p-1">
            <button
              type="button"
              onClick={() => setDashboardMode('OPERATIONAL')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                dashboardMode === 'OPERATIONAL'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Activité Opérationnelle
            </button>
            <button
              type="button"
              onClick={() => setDashboardMode('EXECUTIVE')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                dashboardMode === 'EXECUTIVE'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Vue Direction (30s)
            </button>
          </div>

          <button
            type="button"
            onClick={onStartNewDelivery}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            Nouvelle Livraison
          </button>
        </div>
      </div>

      {/* MODE VUE DIRECTION (SECTION 47 : "Où en est mon entreprise en moins de 30 secondes ?") */}
      {dashboardMode === 'EXECUTIVE' ? (
        <div className="space-y-6">
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Synthèse Direction Générale — Où en est mon entreprise ?
                </h2>
                <p className="text-xs text-slate-500">
                  Lecture consolidée en 4 piliers : Activité · Argent · Rentabilité sur coûts directs · Risques immédiats
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('reports')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 whitespace-nowrap"
              >
                Ouvrir les rapports complets
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
              {/* 1. Activité */}
              <div className="space-y-3 border-l-2 border-slate-900 pl-4">
                <p className="text-xs font-semibold text-slate-500">01. Activité Contractuelle</p>
                <div>
                  <p className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                    {activeContracts.length} marchés actifs
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Portefeuille :{' '}
                    <span className="font-mono tabular-nums font-medium text-slate-800">
                      {formatFcfa(
                        activeContracts.reduce((s, c) => s + c.totalAmount, 0)
                      )}
                    </span>
                  </p>
                </div>
                <div className="text-xs text-slate-600 space-y-1 pt-1">
                  <p>
                    Commandes actives :{' '}
                    <span className="font-mono tabular-nums font-semibold text-slate-900">
                      {state.orders.length}
                    </span>
                  </p>
                  <p>
                    Livraisons en cours / planifiées :{' '}
                    <span className="font-mono tabular-nums font-semibold text-slate-900">
                      {deliveriesPending.length}
                    </span>
                  </p>
                </div>
              </div>

              {/* 2. Argent */}
              <div className="space-y-3 border-l-2 border-emerald-600 pl-4">
                <p className="text-xs font-semibold text-slate-500">02. Trésorerie & Créances</p>
                <div>
                  <p className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                    {formatFcfa(totalReceivablesOpen)}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Total à encaisser sur factures émises
                  </p>
                </div>
                <div className="text-xs text-slate-600 space-y-1 pt-1">
                  <p>
                    Livré accepté restant à facturer :{' '}
                    <span className="font-mono tabular-nums font-semibold text-slate-900">
                      {formatFcfa(totalToInvoiceAmount)}
                    </span>
                  </p>
                  <p className="text-red-700 font-medium">
                    En retard d’échéance :{' '}
                    <span className="font-mono tabular-nums font-semibold">
                      {formatFcfa(totalReceivablesOverdue)}
                    </span>
                  </p>
                </div>
              </div>

              {/* 3. Rentabilité */}
              <div className="space-y-3 border-l-2 border-blue-600 pl-4">
                <p className="text-xs font-semibold text-slate-500">
                  03. Marge sur Coûts Directs
                </p>
                <div>
                  <p className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                    {formatFcfa(totalContributionMargin)}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Marge de contribution estimée (hors frais fixes)
                  </p>
                </div>
                <div className="text-xs text-slate-600 space-y-1 pt-1">
                  <p>
                    CA exécuté :{' '}
                    <span className="font-mono tabular-nums font-semibold text-slate-900">
                      {formatFcfa(totalDeliveredAcceptedAmount)}
                    </span>
                  </p>
                  <p>
                    Coûts directs (achats + logistique) :{' '}
                    <span className="font-mono tabular-nums font-semibold text-slate-900">
                      {formatFcfa(totalDirectCosts)}
                    </span>
                  </p>
                </div>
              </div>

              {/* 4. Risques */}
              <div className="space-y-3 border-l-2 border-amber-600 pl-4">
                <p className="text-xs font-semibold text-slate-500">04. Points de Vigilance</p>
                <div>
                  <p className="text-2xl font-bold font-mono tabular-nums text-amber-700">
                    {alerts.length} alertes actives
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Action immédiate requise
                  </p>
                </div>
                <div className="text-xs text-slate-600 space-y-1 pt-1">
                  <p>
                    Livraisons en retard :{' '}
                    <span className="font-mono tabular-nums font-semibold text-red-700">
                      {deliveriesLate.length}
                    </span>
                  </p>
                  <p>
                    Produits en stock critique :{' '}
                    <span className="font-mono tabular-nums font-semibold text-amber-700">
                      {criticalStockProducts.length}
                    </span>{' '}
                    · Lots proches péremption :{' '}
                    <span className="font-mono tabular-nums font-semibold text-amber-700">
                      {expiringLots.length}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* LIGNE DE CARTES KPI FINANCIERS : CHIFFRE D'AFFAIRES TOTAL, TAUX DE RECOUVREMENT, DÉPENSES TOTALES */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* KPI 1 : Chiffre d'affaires total */}
        <div
          onClick={() => onNavigate('finance')}
          className="group cursor-pointer rounded-lg border border-slate-200 bg-white p-5 hover:border-slate-300 hover:shadow-xs transition-all space-y-3"
        >
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold text-slate-700">Chiffre d’affaires total</span>
            <span className="rounded-md bg-slate-100 p-1.5 text-slate-700 group-hover:bg-slate-200 transition-colors">
              <Receipt className="h-4 w-4" />
            </span>
          </div>
          <div>
            <p className="text-2xl font-bold font-mono tabular-nums text-slate-900">
              {formatFcfa(totalRevenue)}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Sur <span className="font-medium text-slate-700">{state.invoices.length} factures</span> clients émises
            </p>
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>CA livré accepté :</span>
            <span className="font-mono tabular-nums font-semibold text-slate-800">
              {formatFcfa(totalDeliveredAcceptedAmount)}
            </span>
          </div>
        </div>

        {/* KPI 2 : Taux de recouvrement des créances */}
        <div
          onClick={() => onNavigate('finance')}
          className="group cursor-pointer rounded-lg border border-slate-200 bg-white p-5 hover:border-slate-300 hover:shadow-xs transition-all space-y-3"
        >
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold text-slate-700">Taux de recouvrement des créances</span>
            <span className="rounded-md bg-emerald-50 p-1.5 text-emerald-700 group-hover:bg-emerald-100 transition-colors">
              <BadgePercent className="h-4 w-4" />
            </span>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold font-mono tabular-nums text-emerald-700">
                {recoveryRate} %
              </p>
              <span className="text-xs text-slate-500">encaissé</span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full bg-emerald-600 transition-all duration-300"
                style={{ width: `${Math.min(recoveryRate, 100)}%` }}
              />
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Encaissé / Reste dû :</span>
            <span className="font-mono tabular-nums font-semibold text-slate-800">
              {formatFcfa(totalCollected)} / {formatFcfa(totalReceivablesOpen)}
            </span>
          </div>
        </div>

        {/* KPI 3 : Montant total des dépenses enregistrées */}
        <div
          onClick={() => onNavigate('finance')}
          className="group cursor-pointer rounded-lg border border-slate-200 bg-white p-5 hover:border-slate-300 hover:shadow-xs transition-all space-y-3"
        >
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold text-slate-700">Dépenses totales enregistrées</span>
            <span className="rounded-md bg-slate-100 p-1.5 text-slate-700 group-hover:bg-slate-200 transition-colors">
              <CreditCard className="h-4 w-4" />
            </span>
          </div>
          <div>
            <p className="text-2xl font-bold font-mono tabular-nums text-slate-900">
              {formatFcfa(totalRecordedExpenses)}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Sur <span className="font-medium text-slate-700">{(state.expenses || []).length} dépenses</span> directes & fret
            </p>
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Solde brut d’exploitation :</span>
            <span
              className={`font-mono tabular-nums font-semibold ${
                netOperatingMargin >= 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {formatFcfa(netOperatingMargin)}
            </span>
          </div>
        </div>
      </div>

      {/* GRILLE DES 10 KPIS PRINCIPAUX (SECTION 24) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <div
          onClick={() => onNavigate('contracts')}
          className="cursor-pointer rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-300 transition-colors"
        >
          <p className="text-xs text-slate-500">Contrats actifs</p>
          <p className="mt-1.5 text-xl font-bold font-mono tabular-nums text-slate-900">
            {activeContracts.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Valeur :{' '}
            <span className="font-mono tabular-nums text-slate-700">
              {formatFcfa(activeContracts.reduce((s, c) => s + c.totalAmount, 0))}
            </span>
          </p>
        </div>

        <div
          onClick={() => onNavigate('deliveries')}
          className="cursor-pointer rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-300 transition-colors"
        >
          <p className="text-xs text-slate-500">Livraisons aujourd’hui</p>
          <p className="mt-1.5 text-xl font-bold font-mono tabular-nums text-slate-900">
            {deliveriesToday.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            En attente / transit :{' '}
            <span className="font-mono tabular-nums font-medium text-slate-800">
              {deliveriesPending.length}
            </span>
          </p>
        </div>

        <div
          onClick={() => onNavigate('deliveries')}
          className="cursor-pointer rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-300 transition-colors"
        >
          <p className="text-xs text-slate-500">Montant livré (Accepté)</p>
          <p className="mt-1.5 text-xl font-bold font-mono tabular-nums text-slate-900">
            {formatFcfa(totalDeliveredAcceptedAmount)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Facturé :{' '}
            <span className="font-mono tabular-nums text-slate-700">
              {formatFcfa(totalInvoiced)}
            </span>
          </p>
        </div>

        <div
          onClick={() => onNavigate('finance')}
          className="cursor-pointer rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-300 transition-colors"
        >
          <p className="text-xs text-slate-500">Créances ouvertes</p>
          <p className="mt-1.5 text-xl font-bold font-mono tabular-nums text-slate-900">
            {formatFcfa(totalReceivablesOpen)}
          </p>
          <p className="mt-1 text-xs text-red-700">
            Échues :{' '}
            <span className="font-mono tabular-nums font-semibold">
              {formatFcfa(totalReceivablesOverdue)}
            </span>
          </p>
        </div>

        <div
          onClick={() => onNavigate('finance')}
          className="cursor-pointer rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-300 transition-colors col-span-2 sm:col-span-1"
        >
          <p className="text-xs text-slate-500">Encaissements & Marge</p>
          <p className="mt-1.5 text-xl font-bold font-mono tabular-nums text-emerald-700">
            {formatFcfa(totalCollected)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Marge directe :{' '}
            <span className="font-mono tabular-nums font-medium text-slate-800">
              {formatFcfa(totalContributionMargin)}
            </span>
          </p>
        </div>
      </div>

      {/* CENTRE D'ALERTES OPÉRATIONNELLES (SECTION 26) */}
      {alerts.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-700" />
              <h2 className="text-xs font-semibold text-slate-900">
                Alertes Prioritaires Contrats, Livraisons, Stocks & Créances ({alerts.length})
              </h2>
            </div>
            <span className="text-xs text-slate-500">
              Contrôle temps réel des engagements
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
            {alerts.slice(0, 6).map((al) => (
              <div
                key={al.id}
                className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p
                    className={`text-xs font-medium ${
                      al.severity === 'HIGH' ? 'text-red-700' : 'text-amber-700'
                    }`}
                  >
                    {al.domain}
                  </p>
                  <p className="truncate text-xs text-slate-700 mt-0.5" title={al.title}>
                    {al.title}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={al.onClick}
                  className="shrink-0 rounded border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-800 hover:bg-slate-100 whitespace-nowrap"
                >
                  {al.actionLabel}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* WIDGET LIVRAISONS & WIDGET EXÉCUTION DES CONTRATS (SECTION 24 & 33) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Widget Livraisons (7 colonnes) */}
        <div className="lg:col-span-7 rounded-lg border border-slate-200 bg-white">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Suivi des Livraisons Multi-Sites
              </h2>
              <p className="text-xs text-slate-500">
                Cliquez sur un bordereau pour ouvrir le dossier, générer le PDF ou enregistrer la réception
              </p>
            </div>
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setDeliveryFilter('TODAY')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  deliveryFilter === 'TODAY'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Aujourd’hui ({deliveriesToday.length})
              </button>
              <button
                type="button"
                onClick={() => setDeliveryFilter('TOMORROW')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  deliveryFilter === 'TOMORROW'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Demain ({deliveriesTomorrow.length})
              </button>
              <button
                type="button"
                onClick={() => setDeliveryFilter('WEEK')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  deliveryFilter === 'WEEK'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semaine
              </button>
              <button
                type="button"
                onClick={() => setDeliveryFilter('LATE')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  deliveryFilter === 'LATE'
                    ? 'bg-white text-red-700 shadow-xs'
                    : 'text-red-700 hover:text-red-800'
                }`}
              >
                En retard ({deliveriesLate.length})
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                  <th className="py-2.5 px-4">Bordereau</th>
                  <th className="py-2.5 px-4">Marché & Destination</th>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Statut</th>
                  <th className="py-2.5 px-4 text-right">Valorisation</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {filteredWidgetDeliveries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      Aucune livraison dans cette vue.{' '}
                      <button
                        type="button"
                        onClick={onStartNewDelivery}
                        className="font-semibold text-slate-900 underline ml-1"
                      >
                        Planifier une livraison
                      </button>
                    </td>
                  </tr>
                ) : (
                  filteredWidgetDeliveries.map((del) => {
                    const contract = state.contracts.find(
                      (c) => c.id === del.contractId
                    );
                    const customer = state.customers.find(
                      (c) => c.id === contract?.customerId
                    );
                    const dest = customer?.destinations.find(
                      (dst) => dst.id === del.destinationId
                    );
                    const totalVal = del.lines.reduce(
                      (s, l) => s + l.quantityDelivered * l.unitPrice,
                      0
                    );
                    return (
                      <tr
                        key={del.id}
                        onClick={() => onSelectDelivery(del.id)}
                        className="cursor-pointer hover:bg-slate-50 transition-colors"
                      >
                        <td className="py-3 px-4 font-mono tabular-nums font-semibold text-slate-900">
                          {del.reference}
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-medium text-slate-900 truncate max-w-xs">
                            {dest?.siteName || 'Site client'}
                          </p>
                          <p className="text-slate-500">
                            {contract?.reference} · {del.lines.length} lignes
                          </p>
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                          {del.plannedDate}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`font-medium ${
                              del.status === DeliveryStatus.RECEIVED
                                ? 'text-emerald-700'
                                : del.status === DeliveryStatus.PARTIALLY_RECEIVED
                                ? 'text-amber-700'
                                : del.plannedDate < todayStr
                                ? 'text-red-700'
                                : 'text-slate-700'
                            }`}
                          >
                            {del.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-slate-900 whitespace-nowrap">
                          {formatFcfa(totalVal)}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectDelivery(del.id);
                            }}
                            className="font-semibold text-slate-900 hover:underline"
                          >
                            Dossier →
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Widget Contrats & Progression d'Exécution (5 colonnes - Section 24) */}
        <div className="lg:col-span-5 rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Exécution des Contrats & Reliquats
              </h2>
              <p className="text-xs text-slate-500">
                Calculé sur les quantités réceptionnées et acceptées
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('contracts')}
              className="text-xs font-semibold text-slate-700 hover:text-slate-900 whitespace-nowrap"
            >
              Tous les marchés →
            </button>
          </div>

          <div className="divide-y divide-slate-200 p-5 space-y-4">
            {state.contracts.map((contract) => {
              const customer = state.customers.find(
                (c) => c.id === contract.customerId
              );
              const progress = calculateContractProgress(
                contract,
                state.deliveries
              );

              return (
                <div key={contract.id} className="pt-4 first:pt-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-mono tabular-nums font-semibold text-slate-900">
                        {contract.reference} · {customer?.code}
                      </p>
                      <p className="text-xs font-medium text-slate-800 mt-0.5">
                        {contract.title}
                      </p>
                    </div>
                    <span className="font-mono tabular-nums text-xs font-bold text-slate-900">
                      {progress.progressPercent} %
                    </span>
                  </div>

                  {/* Barre de progression sobre */}
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full bg-slate-900 transition-all duration-200"
                      style={{ width: `${progress.progressPercent}%` }}
                    />
                  </div>

                  <div className="mt-2 flex flex-wrap items-center justify-between text-xs text-slate-500">
                    <span>
                      Exécuté accepté :{' '}
                      <strong className="font-mono tabular-nums text-slate-800">
                        {formatFcfa(progress.executedValue)}
                      </strong>
                    </span>
                    <span>
                      Restant à livrer :{' '}
                      <strong className="font-mono tabular-nums text-slate-800">
                        {formatFcfa(progress.remainingValue)}
                      </strong>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* WIDGET CRÉANCES À SURVEILLER & ACTIVITÉ RÉCENTE (SECTION 24 & 33) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Créances à surveiller (7 colonnes) */}
        <div className="lg:col-span-7 rounded-lg border border-slate-200 bg-white">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Créances Clients Institutionnels
              </h2>
              <p className="text-xs text-slate-500">
                Suivi des échéances, règlements partiels et soldes à recouvrer
              </p>
            </div>
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setReceivableFilter('OPEN')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  receivableFilter === 'OPEN'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                À encaisser
              </button>
              <button
                type="button"
                onClick={() => setReceivableFilter('OVERDUE')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  receivableFilter === 'OVERDUE'
                    ? 'bg-white text-red-700 shadow-xs'
                    : 'text-red-700 hover:text-red-800'
                }`}
              >
                Échues
              </button>
              <button
                type="button"
                onClick={() => setReceivableFilter('PAID')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  receivableFilter === 'PAID'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Payées / Partiel
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                  <th className="py-2.5 px-4">Facture</th>
                  <th className="py-2.5 px-4">Client & Marché</th>
                  <th className="py-2.5 px-4">Échéance</th>
                  <th className="py-2.5 px-4 text-right">Total TTC</th>
                  <th className="py-2.5 px-4 text-right">Solde dû</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {filteredWidgetInvoices.map((inv) => {
                  const customer = state.customers.find(
                    (c) => c.id === inv.customerId
                  );
                  const contract = state.contracts.find(
                    (c) => c.id === inv.contractId
                  );
                  const isOverdue =
                    inv.status === InvoiceStatus.OVERDUE ||
                    (inv.remainingAmount > 0 && inv.dueDate < todayStr);
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono tabular-nums font-semibold text-slate-900">
                        {inv.reference}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-900 truncate max-w-xs">
                          {customer?.name}
                        </p>
                        <p className="text-slate-500">
                          {contract?.reference} · {inv.status}
                        </p>
                      </td>
                      <td
                        className={`py-3 px-4 font-mono tabular-nums whitespace-nowrap ${
                          isOverdue ? 'font-semibold text-red-700' : 'text-slate-700'
                        }`}
                      >
                        {inv.dueDate}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                        {formatFcfa(inv.totalAmount)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                        {formatFcfa(inv.remainingAmount)}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {inv.remainingAmount > 0 ? (
                          <button
                            type="button"
                            onClick={() => onOpenPaymentModal(inv.id)}
                            className="rounded bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800"
                          >
                            Encaisser
                          </button>
                        ) : (
                          <span className="text-emerald-700 font-medium">Soldée</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Journal d'activité récente & Audit (5 colonnes) */}
        <div className="lg:col-span-5 rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Activité Récente & Trace d’Audit
              </h2>
              <p className="text-xs text-slate-500">
                Opérations critiques horodatées et signées par rôle
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('settings')}
              className="text-xs font-semibold text-slate-700 hover:text-slate-900 whitespace-nowrap"
            >
              Journal complet →
            </button>
          </div>
          <div className="divide-y divide-slate-200 p-5 space-y-3">
            {state.auditLogs.slice(0, 5).map((log) => (
              <div key={log.id} className="pt-3 first:pt-0 text-xs">
                <div className="flex items-center justify-between text-slate-500">
                  <span>
                    <strong className="text-slate-800">{log.userName}</strong> ·{' '}
                    {log.userRole} · {log.action}
                  </span>
                  <span className="font-mono tabular-nums">{log.createdAt}</span>
                </div>
                <p className="mt-1 text-slate-700">{log.summary}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
