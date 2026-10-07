import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  CreditCard,
  FileDown,
  Landmark,
  PieChart as PieChartIcon,
  Plus,
  Receipt,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  ComposedChart,
  ReferenceLine,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  DeliveryStatus,
  ErpState,
  ExpenseCategoryType,
  InvoiceStatus,
  TaxCertificationStatus,
} from '../shared/types';
import {
  calculateContributionMarginByContract,
  formatFcfa,
} from '../shared/domainEngine';
import {
  exportToCsvFile,
  generateInvoicePdf,
  generateProfitabilityAndFinancialReportPdf,
} from '../shared/pdfGenerator';

interface FinanceAndReceivablesViewProps {
  state: ErpState;
  initialSubTab?:
    | 'RECEIVABLES'
    | 'INVOICES'
    | 'PAYMENTS'
    | 'EXPENSES'
    | 'PROFITABILITY'
    | 'CASHFLOW';
  onOpenPaymentModal: (invoiceId?: string) => void;
  onCreateInvoiceFromDelivery: (deliveryId: string) => void;
  onUpdateTaxCertification: (
    invoiceId: string,
    nextStatus: TaxCertificationStatus
  ) => void;
  onAddExpense: (payload: {
    category: ExpenseCategoryType;
    label: string;
    amount: number;
    expenseDate: string;
    contractId?: string;
    deliveryId?: string;
  }) => void;
}

export const FinanceAndReceivablesView: React.FC<
  FinanceAndReceivablesViewProps
> = ({
  state,
  initialSubTab = 'RECEIVABLES',
  onOpenPaymentModal,
  onCreateInvoiceFromDelivery,
  onUpdateTaxCertification,
  onAddExpense,
}) => {
  const [subTab, setSubTab] = useState<
    | 'RECEIVABLES'
    | 'INVOICES'
    | 'PAYMENTS'
    | 'EXPENSES'
    | 'PROFITABILITY'
    | 'CASHFLOW'
  >(initialSubTab);

  const [showNewInvoiceModal, setShowNewInvoiceModal] = useState(false);
  const [showNewExpenseModal, setShowNewExpenseModal] = useState(false);

  const unbilledDeliveries = state.deliveries.filter(
    (d) =>
      (d.status === DeliveryStatus.RECEIVED ||
        d.status === DeliveryStatus.PARTIALLY_RECEIVED ||
        d.status === DeliveryStatus.DISPATCHED) &&
      !state.invoices.some((inv) => inv.deliveryId === d.id)
  );
  const [selectedDeliveryForInvoice, setSelectedDeliveryForInvoice] = useState(
    unbilledDeliveries[0]?.id || state.deliveries[0]?.id || ''
  );

  // Formulaire Nouvelle Dépense (Section 22)
  const [expCategory, setExpCategory] = useState<ExpenseCategoryType>(
    ExpenseCategoryType.TRANSPORT
  );
  const [expLabel, setExpLabel] = useState('');
  const [expAmount, setExpAmount] = useState(180000);
  const [expDate, setExpDate] = useState('2026-10-07');
  const [expContractId, setExpContractId] = useState(
    state.contracts[0]?.id || ''
  );
  const [expDeliveryId, setExpDeliveryId] = useState(
    state.deliveries[0]?.id || ''
  );

  const todayStr = '2026-10-07';

  // Indicateurs Créances (Section 21)
  const totalInvoiced = state.invoices.reduce(
    (acc, i) => acc + i.totalAmount,
    0
  );
  const totalCollected = state.invoices.reduce(
    (acc, i) => acc + i.paidAmount,
    0
  );
  const openReceivables = state.invoices.reduce(
    (acc, i) => acc + i.remainingAmount,
    0
  );
  const overdueReceivables = state.invoices
    .filter(
      (i) =>
        i.status === InvoiceStatus.OVERDUE ||
        (i.remainingAmount > 0 && i.dueDate < todayStr)
    )
    .reduce((acc, i) => acc + i.remainingAmount, 0);

  const computeDaysOverdue = (dueDate: string, remaining: number): number => {
    if (remaining <= 0 || dueDate >= todayStr) return 0;
    const d1 = new Date(dueDate).getTime();
    const d2 = new Date(todayStr).getTime();
    return Math.max(0, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Finance — Facturation, Créances, Encaissements, Dépenses & Rentabilité
          </h1>
          <p className="text-xs text-slate-500">
            Séparation stricte entre Montant Livré, Montant Facturé et Montant Encaissé. Calcul de la marge sur coûts directs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowNewExpenseModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            Enregistrer Dépense
          </button>
          <button
            type="button"
            onClick={() => setShowNewInvoiceModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap"
          >
            <Receipt className="h-4 w-4" />
            Créer Facture sur Livraison
          </button>
          <button
            type="button"
            onClick={() => onOpenPaymentModal()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
          >
            <Wallet className="h-4 w-4" />
            Enregistrer Paiement
          </button>
        </div>
      </div>

      {/* 4 Indicateurs Financiers Clés (Section 21) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Total facturé</p>
          <p className="mt-1 text-xl font-bold font-mono tabular-nums text-slate-900">
            {formatFcfa(totalInvoiced)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {state.invoices.length} factures émises
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Total encaissé</p>
          <p className="mt-1 text-xl font-bold font-mono tabular-nums text-emerald-700">
            {formatFcfa(totalCollected)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {state.payments.length} règlements rapprochés
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Créances ouvertes</p>
          <p className="mt-1 text-xl font-bold font-mono tabular-nums text-slate-900">
            {formatFcfa(openReceivables)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Solde total restant à recouvrer
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Créances échues</p>
          <p className="mt-1 text-xl font-bold font-mono tabular-nums text-red-700">
            {formatFcfa(overdueReceivables)}
          </p>
          <p className="mt-1 text-xs text-red-700 font-medium">
            En dépassement d’échéance contractuelle
          </p>
        </div>
      </div>

      {/* Onglets Finance */}
      <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-200/80 p-1 w-fit">
        <button
          type="button"
          onClick={() => setSubTab('RECEIVABLES')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
            subTab === 'RECEIVABLES'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Écran Créances
        </button>
        <button
          type="button"
          onClick={() => setSubTab('INVOICES')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
            subTab === 'INVOICES'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Factures & Abstraction FNE ({state.invoices.length})
        </button>
        <button
          type="button"
          onClick={() => setSubTab('PAYMENTS')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
            subTab === 'PAYMENTS'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Encaissements ({state.payments.length})
        </button>
        <button
          type="button"
          onClick={() => setSubTab('EXPENSES')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
            subTab === 'EXPENSES'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Dépenses Directes ({state.expenses.length})
        </button>
        <button
          type="button"
          onClick={() => setSubTab('PROFITABILITY')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
            subTab === 'PROFITABILITY'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Rentabilité & Marges
        </button>
        <button
          type="button"
          onClick={() => setSubTab('CASHFLOW')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            subTab === 'CASHFLOW'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <TrendingUp className="h-3.5 w-3.5 text-slate-500" />
          Trésorerie Prévisionnelle
        </button>
      </div>

      {/* SOUS-ONGLET 1 : ÉCRAN CRÉANCES (SECTION 21 EXACTE) */}
      {subTab === 'RECEIVABLES' && (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden space-y-0">
          {/* Bannière de liaison vers Trésorerie Prévisionnelle */}
          <div className="mx-5 mt-4 mb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-lg border border-emerald-200/80 bg-emerald-50/60 px-4 py-2.5 text-xs gap-2">
            <div className="flex items-center gap-2 text-emerald-950 font-medium">
              <Landmark className="h-4 w-4 text-emerald-700 shrink-0" />
              <span>
                <strong>Trésorerie Prévisionnelle :</strong> Les dates d’échéance de ces créances (dont 25,95M FCFA sur novembre) sont modélisées dans l’échéancier dynamique.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSubTab('CASHFLOW')}
              className="font-bold text-emerald-800 hover:underline shrink-0 text-left sm:text-right"
            >
              Consulter le graphique d’évolution de la trésorerie →
            </button>
          </div>

          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Tableau de Suivi des Créances et Retards de Règlement
              </h2>
              <p className="text-xs text-slate-500">
                Colonnes réglementaires : Facture · Client · Date · Échéance · Montant · Payé · Solde · Retard · Statut
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                exportToCsvFile(
                  'Creances_IvoireAppro_2026.csv',
                  [
                    'Facture',
                    'Client',
                    'Date Emission',
                    'Echeance',
                    'Montant Total',
                    'Paye',
                    'Solde',
                    'Retard (Jours)',
                    'Statut',
                  ],
                  state.invoices.map((inv) => {
                    const cust = state.customers.find(
                      (c) => c.id === inv.customerId
                    );
                    return [
                      inv.reference,
                      cust?.name || '',
                      inv.issueDate,
                      inv.dueDate,
                      inv.totalAmount,
                      inv.paidAmount,
                      inv.remainingAmount,
                      computeDaysOverdue(inv.dueDate, inv.remainingAmount),
                      inv.status,
                    ];
                  })
                )
              }
              className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
            >
              <FileDown className="h-3.5 w-3.5" />
              Exporter Créances CSV
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
                  <th className="py-3 px-4">Facture</th>
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Échéance</th>
                  <th className="py-3 px-4 text-right">Montant</th>
                  <th className="py-3 px-4 text-right">Payé</th>
                  <th className="py-3 px-4 text-right">Solde</th>
                  <th className="py-3 px-4 text-right">Retard</th>
                  <th className="py-3 px-4">Statut</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {state.invoices.map((inv) => {
                  const cust = state.customers.find(
                    (c) => c.id === inv.customerId
                  );
                  const daysLate = computeDaysOverdue(
                    inv.dueDate,
                    inv.remainingAmount
                  );
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <td className="py-3.5 px-4 font-mono tabular-nums font-bold text-slate-900">
                        {inv.reference}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-900 max-w-xs truncate">
                        {cust?.name}
                      </td>
                      <td className="py-3.5 px-4 font-mono tabular-nums text-slate-600">
                        {inv.issueDate}
                      </td>
                      <td className="py-3.5 px-4 font-mono tabular-nums text-slate-700">
                        {inv.dueDate}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-800">
                        {formatFcfa(inv.totalAmount)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-emerald-700 font-semibold">
                        {formatFcfa(inv.paidAmount)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                        {formatFcfa(inv.remainingAmount)}
                      </td>
                      <td
                        className={`py-3.5 px-4 text-right font-mono tabular-nums font-semibold ${
                          daysLate > 0 ? 'text-red-700' : 'text-slate-500'
                        }`}
                      >
                        {daysLate > 0 ? `${daysLate} j` : '0 j'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`font-semibold ${
                            inv.status === InvoiceStatus.PAID
                              ? 'text-emerald-700'
                              : inv.status === InvoiceStatus.OVERDUE
                              ? 'text-red-700'
                              : 'text-slate-800'
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {inv.remainingAmount > 0 ? (
                          <button
                            type="button"
                            onClick={() => onOpenPaymentModal(inv.id)}
                            className="rounded bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800"
                          >
                            Encaisser
                          </button>
                        ) : (
                          <span className="text-emerald-700 font-semibold">
                            Soldée
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SOUS-ONGLET 2 : FACTURES & ABSTRACTION FNE (SECTION 19 & 20) */}
      {subTab === 'INVOICES' && (
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-slate-900">
                Couche d’Abstraction Fiscale Indépendante : InvoiceCertificationService (Section 20)
              </p>
              <p className="text-slate-600">
                Conformément à la règle d’exactitude réglementaire, aucune API fiscale non documentée n’est codée en dur. Le statut de certification électronique (NOT_SUBMITTED → SUBMITTED → CERTIFIED / REJECTED) est géré via connecteur configurable.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
                    <th className="py-3 px-4">Facture</th>
                    <th className="py-3 px-4">Contrat & Livraison</th>
                    <th className="py-3 px-4 text-right">Montant TTC</th>
                    <th className="py-3 px-4">Statut Facture</th>
                    <th className="py-3 px-4">
                      Certification Fiscale (InvoiceCertificationService)
                    </th>
                    <th className="py-3 px-4 text-right">PDF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {state.invoices.map((inv) => {
                    const cust = state.customers.find(
                      (c) => c.id === inv.customerId
                    );
                    const ctr = state.contracts.find(
                      (c) => c.id === inv.contractId
                    );
                    const del = state.deliveries.find(
                      (d) => d.id === inv.deliveryId
                    );
                    return (
                      <tr key={inv.id}>
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                          {inv.reference}
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-slate-900">
                            {cust?.name}
                          </p>
                          <p className="text-slate-500 font-mono">
                            {ctr?.reference}{' '}
                            {del ? `· BL: ${del.reference}` : ''}
                          </p>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                          {formatFcfa(inv.totalAmount)}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-800">
                          {inv.status}
                        </td>
                        <td className="py-3.5 px-4">
                          <select
                            value={inv.taxCertificationStatus}
                            onChange={(e) =>
                              onUpdateTaxCertification(
                                inv.id,
                                e.target.value as TaxCertificationStatus
                              )
                            }
                            className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-mono text-slate-900"
                          >
                            <option value={TaxCertificationStatus.NOT_SUBMITTED}>
                              NOT_SUBMITTED
                            </option>
                            <option value={TaxCertificationStatus.SUBMITTED}>
                              SUBMITTED
                            </option>
                            <option value={TaxCertificationStatus.CERTIFIED}>
                              CERTIFIED
                            </option>
                            <option value={TaxCertificationStatus.REJECTED}>
                              REJECTED
                            </option>
                          </select>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              if (!cust || !ctr) return;
                              generateInvoicePdf({
                                organization: state.organization,
                                invoice: inv,
                                customer: cust,
                                contract: ctr,
                                delivery: del,
                              });
                            }}
                            className="inline-flex items-center gap-1 font-semibold text-slate-900 hover:underline"
                          >
                            <FileDown className="h-3.5 w-3.5" />
                            PDF
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SOUS-ONGLET 3 : HISTORIQUE DES PAIEMENTS */}
      {subTab === 'PAYMENTS' && (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
                  <th className="py-3 px-4">N° Règlement</th>
                  <th className="py-3 px-4">Facture Rapprochée</th>
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Mode & Référence Bancaire</th>
                  <th className="py-3 px-4 text-right">Montant Encaissé</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {state.payments.map((pay) => {
                  const inv = state.invoices.find(
                    (i) => i.id === pay.invoiceId
                  );
                  const cust = state.customers.find(
                    (c) => c.id === pay.customerId
                  );
                  return (
                    <tr key={pay.id}>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {pay.reference}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-800">
                        {inv?.reference}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-900">
                        {cust?.name}
                      </td>
                      <td className="py-3.5 px-4 font-mono tabular-nums text-slate-600">
                        {pay.paymentDate}
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-slate-800">
                          {pay.method}
                        </p>
                        <p className="font-mono text-slate-500">
                          {pay.bankReference}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold text-emerald-700">
                        {formatFcfa(pay.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SOUS-ONGLET 4 : DÉPENSES LOGISTIQUES & OPÉRATIONNELLES (SECTION 22) */}
      {subTab === 'EXPENSES' && (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
                  <th className="py-3 px-4">Référence</th>
                  <th className="py-3 px-4">Catégorie</th>
                  <th className="py-3 px-4">Libellé</th>
                  <th className="py-3 px-4">Affectation Contrat / BL</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {state.expenses.map((exp) => {
                  const ctr = state.contracts.find(
                    (c) => c.id === exp.contractId
                  );
                  const del = state.deliveries.find(
                    (d) => d.id === exp.deliveryId
                  );
                  return (
                    <tr key={exp.id}>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {exp.reference}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-800">
                        {exp.category}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-900">
                        {exp.label}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">
                        {ctr?.reference || '-'}{' '}
                        {del ? `· ${del.reference}` : ''}
                      </td>
                      <td className="py-3.5 px-4 font-mono tabular-nums text-slate-600">
                        {exp.expenseDate}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                        {formatFcfa(exp.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SOUS-ONGLET 5 : CALCUL DE RENTABILITÉ — MARGE SUR COÛTS DIRECTS (SECTION 23) */}
      {subTab === 'PROFITABILITY' && (() => {
        // --- 1. DONNÉES DU GRAPHIQUE LINÉAIRE : ÉVOLUTION MENSUELLE DU CHIFFRE D'AFFAIRES ---
        const baseMonthlySchedule = [
          { month: 'Jan', label: 'Janvier 2026', baseCa: 8500000, baseEncaisse: 8500000, prefix: '2026-01' },
          { month: 'Fév', label: 'Février 2026', baseCa: 12400000, baseEncaisse: 12000000, prefix: '2026-02' },
          { month: 'Mar', label: 'Mars 2026', baseCa: 15200000, baseEncaisse: 14500000, prefix: '2026-03' },
          { month: 'Avr', label: 'Avril 2026', baseCa: 14800000, baseEncaisse: 14800000, prefix: '2026-04' },
          { month: 'Mai', label: 'Mai 2026', baseCa: 19600000, baseEncaisse: 18000000, prefix: '2026-05' },
          { month: 'Juin', label: 'Juin 2026', baseCa: 22100000, baseEncaisse: 21500000, prefix: '2026-06' },
          { month: 'Juil', label: 'Juillet 2026', baseCa: 18900000, baseEncaisse: 17500000, prefix: '2026-07' },
          { month: 'Août', label: 'Août 2026', baseCa: 14900000, baseEncaisse: 16060000, prefix: '2026-08' },
          { month: 'Sept', label: 'Septembre 2026', baseCa: 0, baseEncaisse: 12060000, prefix: '2026-09' },
          { month: 'Oct', label: 'Octobre 2026', baseCa: 0, baseEncaisse: 0, prefix: '2026-10' },
        ];

        const monthlyRevenueTrend = baseMonthlySchedule.map((item) => {
          // Factures émises sur ce mois
          const monthInvoices = state.invoices.filter((inv) =>
            inv.issueDate.startsWith(item.prefix)
          );
          const dynamicInvoiceTotal = monthInvoices.reduce(
            (sum, inv) => sum + inv.totalAmount,
            0
          );

          // Règlements enregistrés sur ce mois
          const monthPayments = state.payments.filter((p) =>
            p.paymentDate.startsWith(item.prefix)
          );
          const dynamicPaymentTotal = monthPayments.reduce(
            (sum, p) => sum + p.amount,
            0
          );

          return {
            month: item.month,
            label: item.label,
            ca: item.baseCa + dynamicInvoiceTotal,
            encaissements: item.baseEncaisse + dynamicPaymentTotal,
          };
        });

        const totalYearRevenue = monthlyRevenueTrend.reduce((acc, m) => acc + m.ca, 0);
        const totalYearCollected = monthlyRevenueTrend.reduce((acc, m) => acc + m.encaissements, 0);

        // --- 2. DONNÉES DU GRAPHIQUE EN ANNEAU : RÉPARTITION DES DÉPENSES PAR CATÉGORIE ---
        const categoryLabels: Record<ExpenseCategoryType, string> = {
          [ExpenseCategoryType.TRANSPORT]: 'Transport & Fret',
          [ExpenseCategoryType.FUEL]: 'Carburant Flotte',
          [ExpenseCategoryType.HANDLING]: 'Manutention & Dockers',
          [ExpenseCategoryType.STORAGE]: 'Stockage & Entrepôt',
          [ExpenseCategoryType.PURCHASE]: 'Achats Directs',
          [ExpenseCategoryType.MAINTENANCE]: 'Entretien Véhicules',
          [ExpenseCategoryType.ADMIN]: 'Frais Administratifs',
          [ExpenseCategoryType.BANK_FEES]: 'Frais Bancaires',
          [ExpenseCategoryType.OTHER]: 'Autres Dépenses',
        };

        const categoryPalette: Record<ExpenseCategoryType, string> = {
          [ExpenseCategoryType.TRANSPORT]: '#0f172a', // Slate 900
          [ExpenseCategoryType.FUEL]: '#2563eb',      // Blue 600
          [ExpenseCategoryType.HANDLING]: '#d97706',  // Amber 600
          [ExpenseCategoryType.STORAGE]: '#059669',   // Emerald 600
          [ExpenseCategoryType.MAINTENANCE]: '#dc2626', // Red 600
          [ExpenseCategoryType.PURCHASE]: '#7c3aed',  // Violet 600
          [ExpenseCategoryType.ADMIN]: '#475569',     // Slate 600
          [ExpenseCategoryType.BANK_FEES]: '#0891b2', // Cyan 600
          [ExpenseCategoryType.OTHER]: '#64748b',     // Slate 500
        };

        const totalDirectExpenses = state.expenses.reduce((sum, e) => sum + e.amount, 0);

        const expensesByCategory = Object.values(ExpenseCategoryType)
          .map((cat) => {
            const sum = state.expenses
              .filter((e) => e.category === cat)
              .reduce((acc, e) => acc + e.amount, 0);
            return {
              category: cat,
              name: categoryLabels[cat] || cat,
              value: sum,
              color: categoryPalette[cat] || '#64748b',
              percentage:
                totalDirectExpenses > 0
                  ? Number(((sum / totalDirectExpenses) * 100).toFixed(1))
                  : 0,
            };
          })
          .filter((item) => item.value > 0);

        // Tooltip personnalisé pour le graphique linéaire
        const CustomLineTooltip = ({ active, payload, label }: any) => {
          if (active && payload && payload.length) {
            const fullLabel = payload[0]?.payload?.label || label;
            return (
              <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg text-xs space-y-1.5">
                <p className="font-bold text-slate-900 border-b border-slate-100 pb-1">
                  {fullLabel}
                </p>
                {payload.map((entry: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-1.5 text-slate-600">
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: entry.stroke || entry.color }}
                      />
                      {entry.name} :
                    </span>
                    <span className="font-mono tabular-nums font-bold text-slate-900">
                      {formatFcfa(entry.value)}
                    </span>
                  </div>
                ))}
              </div>
            );
          }
          return null;
        };

        // Tooltip personnalisé pour le graphique en anneau
        const CustomDonutTooltip = ({ active, payload }: any) => {
          if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
              <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-slate-900 border-b border-slate-100 pb-1">
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: data.color }}
                  />
                  <span>{data.name}</span>
                </div>
                <div className="flex items-center justify-between gap-3 text-slate-600 pt-0.5">
                  <span>Montant décaissé :</span>
                  <span className="font-mono tabular-nums font-bold text-slate-900">
                    {formatFcfa(data.value)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 text-slate-600">
                  <span>Part des dépenses :</span>
                  <span className="font-mono tabular-nums font-semibold text-slate-800">
                    {data.percentage} %
                  </span>
                </div>
              </div>
            );
          }
          return null;
        };

        // --- 3. DONNÉES DU GRAPHIQUE À BARRES : REVENUS VS DÉPENSES (6 DERNIERS MOIS) ---
        const last6MonthsSchedule = [
          { month: 'Mai', fullLabel: 'Mai 2026', prefix: '2026-05', baseRev: 19600000, baseExp: 11800000 },
          { month: 'Juin', fullLabel: 'Juin 2026', prefix: '2026-06', baseRev: 22100000, baseExp: 13400000 },
          { month: 'Juil', fullLabel: 'Juillet 2026', prefix: '2026-07', baseRev: 18900000, baseExp: 11200000 },
          { month: 'Août', fullLabel: 'Août 2026', prefix: '2026-08', baseRev: 14900000, baseExp: 9100000 },
          { month: 'Sept', fullLabel: 'Septembre 2026', prefix: '2026-09', baseRev: 0, baseExp: 18675000 },
          { month: 'Oct', fullLabel: 'Octobre 2026', prefix: '2026-10', baseRev: 10570000, baseExp: 7360000 },
        ];

        const last6MonthsData = last6MonthsSchedule.map((item) => {
          const monthInvoices = state.invoices.filter((inv) =>
            inv.issueDate.startsWith(item.prefix)
          );
          const dynInvoiced = monthInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);

          const monthExpenses = state.expenses.filter((exp) =>
            exp.expenseDate.startsWith(item.prefix)
          );
          const dynExpenses = monthExpenses.reduce((sum, exp) => sum + exp.amount, 0);

          const rev = item.baseRev + dynInvoiced;
          const exp = item.baseExp + dynExpenses;
          const marge = rev - exp;
          const marginRate = rev > 0 ? Number(((marge / rev) * 100).toFixed(1)) : 0;

          return {
            month: item.month,
            fullLabel: item.fullLabel,
            revenus: rev,
            depenses: exp,
            marge,
            marginRate,
          };
        });

        const total6MRevenue = last6MonthsData.reduce((acc, d) => acc + d.revenus, 0);
        const total6MExpenses = last6MonthsData.reduce((acc, d) => acc + d.depenses, 0);
        const total6MMargin = total6MRevenue - total6MExpenses;
        const total6MMarginRate =
          total6MRevenue > 0
            ? Number(((total6MMargin / total6MRevenue) * 100).toFixed(1))
            : 0;

        // Tooltip personnalisé pour le graphique à barres
        const CustomBarTooltip = ({ active, payload, label }: any) => {
          if (active && payload && payload.length) {
            const data = payload[0]?.payload;
            const rev = data?.revenus || 0;
            const exp = data?.depenses || 0;
            const margin = data?.marge || 0;
            const marginRate = data?.marginRate || 0;

            return (
              <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg text-xs space-y-2 min-w-[220px]">
                <div className="border-b border-slate-100 pb-1.5 flex items-center justify-between">
                  <span className="font-bold text-slate-900">{data?.fullLabel || label}</span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      margin >= 0
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-rose-50 text-rose-700'
                    }`}
                  >
                    Marge : {marginRate}%
                  </span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-slate-900 shrink-0" />
                      Revenus :
                    </span>
                    <span className="font-mono tabular-nums font-bold text-slate-900">
                      {formatFcfa(rev)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-rose-600 shrink-0" />
                      Dépenses directes :
                    </span>
                    <span className="font-mono tabular-nums font-bold text-rose-600">
                      {formatFcfa(exp)}
                    </span>
                  </div>
                  <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between font-semibold">
                    <span className="text-slate-700">Marge brute dégagée :</span>
                    <span
                      className={`font-mono tabular-nums ${
                        margin >= 0 ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {formatFcfa(margin)}
                    </span>
                  </div>
                </div>
              </div>
            );
          }
          return null;
        };

        // --- 4. INDICATEURS CLÉS DE SYNTHÈSE (KPIs) ---
        const contractMargins = state.contracts.map((c) =>
          calculateContributionMarginByContract(c, state)
        );
        const totalContributionMargin = contractMargins.reduce(
          (acc, m) => acc + m.contributionMargin,
          0
        );
        const totalRevenueExecuted = contractMargins.reduce(
          (acc, m) => acc + m.revenueExecuted,
          0
        );
        const netMarginRatePercent =
          totalRevenueExecuted > 0
            ? Number(((totalContributionMargin / totalRevenueExecuted) * 100).toFixed(1))
            : 0;

        const totalInvoicedState = state.invoices.reduce((acc, i) => acc + i.totalAmount, 0);
        const totalCollectedState = state.invoices.reduce((acc, i) => acc + i.paidAmount, 0);
        const collectionRatePercent =
          totalInvoicedState > 0
            ? Number(((totalCollectedState / totalInvoicedState) * 100).toFixed(1))
            : 0;

        return (
          <div className="space-y-6">
            {/* BANDEAU D'EXPORT DU RAPPORT OFFICIEL DE RENTABILITÉ */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Synthèse de Rentabilité & Marge sur Coûts Directs
                </h2>
                <p className="text-xs text-slate-500">
                  Calculs consolidés temps réel selon les décomptes des marchés ivoiriens (Section 23 & 27)
                </p>
              </div>
              <button
                type="button"
                onClick={() => generateProfitabilityAndFinancialReportPdf(state)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 shadow-xs transition-colors shrink-0"
              >
                <FileDown className="h-4 w-4" />
                Télécharger Synthèse PDF Imprimable
              </button>
            </div>

            {/* CARTES DE RÉSUMÉ KPI : CHIFFRE D'AFFAIRES TOTAL, TAUX DE RECOUVREMENT, MARGE NETTE */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {/* KPI 1 : Chiffre d'affaires total */}
              <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-medium">Chiffre d’affaires total</span>
                  <Receipt className="h-4 w-4 text-slate-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                    {formatFcfa(totalInvoicedState)}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Sur {state.invoices.length} factures · Exécuté :{' '}
                    <span className="font-mono tabular-nums font-medium text-slate-700">
                      {formatFcfa(totalRevenueExecuted)}
                    </span>
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span>CA Prévisionnel YTD :</span>
                  <span className="font-mono tabular-nums font-semibold text-slate-800">
                    {formatFcfa(totalYearRevenue)}
                  </span>
                </div>
              </div>

              {/* KPI 2 : Taux de recouvrement */}
              <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-medium">Taux de recouvrement</span>
                  <Wallet className="h-4 w-4 text-emerald-600" />
                </div>
                <div>
                  <div className="flex items-baseline gap-2">
                    <p className="text-2xl font-bold font-mono tabular-nums text-emerald-700">
                      {collectionRatePercent} %
                    </p>
                    <span className="text-xs text-slate-500 font-medium">encaissé</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Encaissé :{' '}
                    <span className="font-mono tabular-nums font-semibold text-emerald-700">
                      {formatFcfa(totalCollectedState)}
                    </span>
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Créances à recouvrer :</span>
                  <span className="font-mono tabular-nums font-semibold text-slate-800">
                    {formatFcfa(totalInvoicedState - totalCollectedState)}
                  </span>
                </div>
              </div>

              {/* KPI 3 : Marge nette */}
              <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-medium">Marge nette directe</span>
                  <TrendingUp className="h-4 w-4 text-slate-900" />
                </div>
                <div>
                  <div className="flex items-baseline gap-2">
                    <p className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                      {formatFcfa(totalContributionMargin)}
                    </p>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Taux de marge :{' '}
                    <span className="font-mono tabular-nums font-bold text-emerald-700">
                      {netMarginRatePercent} %
                    </span>
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Coûts directs déduits :</span>
                  <span className="font-mono tabular-nums font-semibold text-slate-800">
                    {formatFcfa(totalRevenueExecuted - totalContributionMargin)}
                  </span>
                </div>
              </div>
            </div>

            {/* Note Méthodologique */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
              <p className="font-semibold text-slate-900">
                Note Méthodologique (Section 23) — Marge sur Coûts Directs (Contribution Margin)
              </p>
              <p className="mt-0.5">
                Formule appliquée : Chiffre d’affaires exécuté − (Coût d’achat des denrées + Frais de transport + Carburant + Manutention + Stockage direct). Cet indicateur mesure la marge de contribution opérationnelle et n’est pas assimilé au bénéfice net comptable après charges fixes de structure.
              </p>
            </div>

            {/* --- VISUALISATIONS GRAPHIQUES AVEC RECHARTS --- */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* 1. GRAPHIQUE LINÉAIRE : ÉVOLUTION MENSUELLE DU CHIFFRE D'AFFAIRES (7 colonnes) */}
              <div className="lg:col-span-7 rounded-lg border border-slate-200 bg-white p-5 space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-slate-900" />
                      Évolution Mensuelle du Chiffre d’Affaires (2026)
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Trajectoire du CA facturé et des encaissements cumulés par mois (en FCFA)
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Total Facturé YTD</span>
                      <span className="font-mono tabular-nums font-bold text-slate-900">
                        {formatFcfa(totalYearRevenue)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="w-full h-[270px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={monthlyRevenueTrend}
                      margin={{ top: 15, right: 15, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        axisLine={{ stroke: '#cbd5e1' }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(val: number) =>
                          val >= 1000000 ? `${(val / 1000000).toFixed(0)}M` : `${val}`
                        }
                      />
                      <RechartsTooltip content={<CustomLineTooltip />} />
                      <Legend
                        wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                        iconType="circle"
                      />
                      <Line
                        type="monotone"
                        dataKey="ca"
                        name="Chiffre d’Affaires Facturé (FCFA)"
                        stroke="#0f172a"
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: '#0f172a' }}
                        activeDot={{ r: 6, fill: '#0f172a' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="encaissements"
                        name="Encaissements Réalisés (FCFA)"
                        stroke="#059669"
                        strokeWidth={2}
                        strokeDasharray="4 4"
                        dot={{ r: 2.5, fill: '#059669' }}
                        activeDot={{ r: 5, fill: '#059669' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 2. GRAPHIQUE EN ANNEAU : RÉPARTITION DES DÉPENSES PAR CATÉGORIE (5 colonnes) */}
              <div className="lg:col-span-5 rounded-lg border border-slate-200 bg-white p-5 space-y-4">
                <div className="flex flex-col gap-1 border-b border-slate-100 pb-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <PieChartIcon className="h-4 w-4 text-slate-900" />
                      Répartition des Dépenses par Catégorie
                    </h3>
                    <span className="font-mono tabular-nums text-xs font-bold text-slate-900">
                      {formatFcfa(totalDirectExpenses)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Ventilation des coûts directs d’exploitation et de transport
                  </p>
                </div>

                <div className="w-full h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={expensesByCategory}
                        cx="50%"
                        cy="50%"
                        innerRadius={52}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {expensesByCategory.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.color}
                            stroke="#ffffff"
                            strokeWidth={2}
                          />
                        ))}
                      </Pie>
                      <RechartsTooltip content={<CustomDonutTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Légende détaillée et proportionnelle */}
                <div className="divide-y divide-slate-100 max-h-40 overflow-y-auto pr-1">
                  {expensesByCategory.map((item) => (
                    <div
                      key={item.category}
                      className="flex items-center justify-between py-1.5 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="truncate text-slate-700 font-medium">
                          {item.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0 pl-2">
                        <span className="font-mono tabular-nums font-bold text-slate-900">
                          {formatFcfa(item.value)}
                        </span>
                        <span className="font-mono tabular-nums text-[11px] text-slate-400 w-10 text-right">
                          {item.percentage}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 3. GRAPHIQUE À BARRES : COMPARATIF REVENUS VS DÉPENSES PAR MOIS (6 DERNIERS MOIS) */}
            <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-slate-900" />
                    Comparatif Revenus vs Dépenses par Mois (6 Derniers Mois)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Évolution comparée de mai à octobre 2026 · Revenus facturés vs Coûts directs engagés
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <div className="rounded-md bg-slate-50 border border-slate-200/60 px-3 py-1.5">
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Total Revenus 6M</span>
                    <span className="font-mono tabular-nums font-bold text-slate-900">
                      {formatFcfa(total6MRevenue)}
                    </span>
                  </div>
                  <div className="rounded-md bg-slate-50 border border-slate-200/60 px-3 py-1.5">
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Total Dépenses 6M</span>
                    <span className="font-mono tabular-nums font-bold text-rose-600">
                      {formatFcfa(total6MExpenses)}
                    </span>
                  </div>
                  <div className="rounded-md bg-emerald-50/70 border border-emerald-200/70 px-3 py-1.5">
                    <span className="text-emerald-700 block text-[10px] uppercase font-semibold">Marge Brute 6M</span>
                    <span className="font-mono tabular-nums font-bold text-emerald-800">
                      {formatFcfa(total6MMargin)} ({total6MMarginRate}%)
                    </span>
                  </div>
                </div>
              </div>

              <div className="w-full h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={last6MonthsData}
                    margin={{ top: 15, right: 15, left: 10, bottom: 5 }}
                    barGap={8}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(val: number) =>
                        val >= 1000000 ? `${(val / 1000000).toFixed(0)}M` : `${val}`
                      }
                    />
                    <RechartsTooltip content={<CustomBarTooltip />} />
                    <Legend
                      wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                      iconType="circle"
                    />
                    <Bar
                      dataKey="revenus"
                      name="Revenus Facturés (FCFA)"
                      fill="#0f172a"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="depenses"
                      name="Dépenses Directes (FCFA)"
                      fill="#dc2626"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 1. Par Contrat */}
            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200">
                <h3 className="text-sm font-semibold text-slate-900">
                  1. Rentabilité par Contrat (Valeur contrat · Valeur exécutée · Coût estimé · Marge sur coûts directs)
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
                      <th className="py-3 px-4">Marché / Contrat</th>
                      <th className="py-3 px-4 text-right">Valeur Contrat</th>
                      <th className="py-3 px-4 text-right">Valeur Exécutée</th>
                      <th className="py-3 px-4 text-right">
                        Coûts Directs (Achat + Logistique)
                      </th>
                      <th className="py-3 px-4 text-right">
                        Marge sur Coûts Directs
                      </th>
                      <th className="py-3 px-4 text-right">Taux de Marge</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {state.contracts.map((c) => {
                      const m = calculateContributionMarginByContract(c, state);
                      return (
                        <tr key={c.id}>
                          <td className="py-3.5 px-4">
                            <p className="font-mono font-bold text-slate-900">
                              {c.reference}
                            </p>
                            <p className="text-slate-600">{c.title}</p>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                            {formatFcfa(m.contractValue)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                            {formatFcfa(m.revenueExecuted)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700">
                            {formatFcfa(m.totalDirectCost)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold text-emerald-700">
                            {formatFcfa(m.contributionMargin)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                            {m.marginRatePercent} %
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 2. Par Produit */}
            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200">
                <h3 className="text-sm font-semibold text-slate-900">
                  2. Rentabilité par Produit / Denrée (Chiffre d’affaires · Coût d’achat · Marge brute · Taux)
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
                      <th className="py-3 px-4">Denrée</th>
                      <th className="py-3 px-4 text-right">Volume Livré</th>
                      <th className="py-3 px-4 text-right">Chiffre d’Affaires</th>
                      <th className="py-3 px-4 text-right">Coût d’Achat</th>
                      <th className="py-3 px-4 text-right">Marge Brute</th>
                      <th className="py-3 px-4 text-right">Taux de Marge</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {state.products.map((prod) => {
                      let qtyTotal = 0;
                      let caTotal = 0;
                      for (const d of state.deliveries) {
                        for (const l of d.lines) {
                          if (l.productId === prod.id) {
                            const q =
                              d.status === DeliveryStatus.RECEIVED ||
                              d.status === DeliveryStatus.PARTIALLY_RECEIVED
                                ? l.quantityAccepted
                                : l.quantityDelivered;
                            qtyTotal += q;
                            caTotal += q * l.unitPrice;
                          }
                        }
                      }
                      const costTotal = qtyTotal * prod.standardCost;
                      const margin = caTotal - costTotal;
                      const rate =
                        caTotal > 0 ? Math.round((margin / caTotal) * 100) : 0;

                      return (
                        <tr key={prod.id}>
                          <td className="py-3.5 px-4 font-semibold text-slate-900">
                            {prod.name}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                            {qtyTotal.toLocaleString('fr-FR')} {prod.unit}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold">
                            {formatFcfa(caTotal)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-600">
                            {formatFcfa(costTotal)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold text-emerald-700">
                            {formatFcfa(margin)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                            {rate} %
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* SOUS-ONGLET 6 : TRÉSORERIE PRÉVISIONNELLE & ÉVOLUTION DES FLUX (ÉCHÉANCIER FACTURES VS DÉPENSES) */}
      {subTab === 'CASHFLOW' && (() => {
        const initialCash = 18500000; // 18 500 000 FCFA disponibles au 07/10/2026

        // Définition des fenêtres d'échéancier continu (Octobre à Décembre 2026)
        const timelineSlots = [
          {
            id: 't-oct-1',
            period: '01-07 Oct',
            label: '01 au 07 Octobre 2026',
            startDate: '2026-10-01',
            endDate: '2026-10-07',
            baseInflow: 10000000,
            baseOutflow: 605000,
            descInflow: 'Règlement VIR-SGBCI CHU Cocody (10 000 000 FCFA reçu)',
            descOutflow: 'Entretien tracteur Bouaké & traitement entrepôt',
          },
          {
            id: 't-oct-2',
            period: '08-14 Oct',
            label: '08 au 14 Octobre 2026',
            startDate: '2026-10-08',
            endDate: '2026-10-14',
            baseInflow: 4000000,
            baseOutflow: 7360000,
            descInflow: 'Relance créance échue FAC-2026-000087 (4 000 000 FCFA)',
            descOutflow: 'Achat huile raffinée ACH-2026-000019 (7 360 000 FCFA)',
          },
          {
            id: 't-oct-3',
            period: '15-21 Oct',
            label: '15 au 21 Octobre 2026',
            startDate: '2026-10-15',
            endDate: '2026-10-21',
            baseInflow: 0,
            baseOutflow: 950000,
            descInflow: 'Flux prévisionnels intermédiaires',
            descOutflow: 'Fret convoi Anyama & dotation carburant autoroute',
          },
          {
            id: 't-oct-4',
            period: '22-28 Oct',
            label: '22 au 28 Octobre 2026',
            startDate: '2026-10-22',
            endDate: '2026-10-28',
            baseInflow: 2500000,
            baseOutflow: 780000,
            descInflow: 'Acompte attendu CROUS Campus Sud (mandat Trésor)',
            descOutflow: 'Équipes dockers manutention & logistique quai',
          },
          {
            id: 't-nov-1',
            period: '29 Oct - 04 Nov',
            label: '29 Oct au 04 Novembre 2026',
            startDate: '2026-10-29',
            endDate: '2026-11-04',
            baseInflow: 0, // Intègre dynamiquement l'échéance FAC-2026-000088 (03/11 : 4 900 000 FCFA)
            baseOutflow: 1150000,
            descInflow: 'Échéance contractuelle FAC-2026-000088 (4 900 000 FCFA)',
            descOutflow: 'Frais de magasinage & rotation stock Yopougon',
          },
          {
            id: 't-nov-2',
            period: '05-11 Nov',
            label: '05 au 11 Novembre 2026',
            startDate: '2026-11-05',
            endDate: '2026-11-11',
            baseInflow: 0,
            baseOutflow: 4200000,
            descInflow: 'Période d’exécution logistique',
            descOutflow: 'Approvisionnement céréales Coopérative Rizicole',
          },
          {
            id: 't-nov-3',
            period: '12-18 Nov',
            label: '12 au 18 Novembre 2026',
            startDate: '2026-11-12',
            endDate: '2026-11-18',
            baseInflow: 3500000,
            baseOutflow: 890000,
            descInflow: 'Acompte Trésor mandat collectivités décentralisées',
            descOutflow: 'Maintenance préventive tracteurs routiers',
          },
          {
            id: 't-nov-4',
            period: '19-25 Nov',
            label: '19 au 25 Novembre 2026',
            startDate: '2026-11-19',
            endDate: '2026-11-25',
            baseInflow: 0,
            baseOutflow: 720000,
            descInflow: 'Attente décomptes institutionnels',
            descOutflow: 'Carburant navettes livraison multi-sites Abidjan',
          },
          {
            id: 't-nov-5',
            period: '26-30 Nov',
            label: '26 au 30 Novembre 2026',
            startDate: '2026-11-26',
            endDate: '2026-11-30',
            baseInflow: 0, // Intègre dynamiquement l'échéance majeure FAC-2026-000089 (28/11 : 21 052 000 FCFA)
            baseOutflow: 2100000,
            descInflow: 'Échéance majeure FAC-2026-000089 (21 052 000 FCFA)',
            descOutflow: 'Règlements prestataires fin de mois & dockers',
          },
          {
            id: 't-dec-1',
            period: '01-15 Déc',
            label: '01 au 15 Décembre 2026',
            startDate: '2026-12-01',
            endDate: '2026-12-15',
            baseInflow: 8500000,
            baseOutflow: 3800000,
            descInflow: 'Facturation complémentaire livraisons clôture trimestrielle',
            descOutflow: 'Achats denrées vivrières fêtes de fin d’année',
          },
          {
            id: 't-dec-2',
            period: '16-31 Déc',
            label: '16 au 31 Décembre 2026',
            startDate: '2026-12-16',
            endDate: '2026-12-31',
            baseInflow: 12500000,
            baseOutflow: 4100000,
            descInflow: 'Mandats finaux Trésor Public & régularisations',
            descOutflow: 'Charges directes d’exploitation clôture annuelle',
          },
        ];

        let rollingCash = initialCash;

        const cashflowData = timelineSlots.map((slot) => {
          // Factures dont l'échéance tombe dans cette période
          const matchedInvoices = state.invoices.filter((inv) => {
            if (inv.remainingAmount <= 0) return false;
            if (slot.id === 't-oct-2' && inv.dueDate < '2026-10-08') return true;
            return inv.dueDate >= slot.startDate && inv.dueDate <= slot.endDate;
          });
          const dynInflows = matchedInvoices.reduce((s, i) => s + i.remainingAmount, 0);

          // Dépenses enregistrées dans cette période
          const matchedExpenses = state.expenses.filter(
            (e) => e.expenseDate >= slot.startDate && e.expenseDate <= slot.endDate
          );
          const dynExpenses = matchedExpenses.reduce((s, e) => s + e.amount, 0);

          const totalInflows = slot.baseInflow + dynInflows;
          const totalOutflows = slot.baseOutflow + dynExpenses;
          const netFlow = totalInflows - totalOutflows;
          rollingCash += netFlow;

          return {
            id: slot.id,
            period: slot.period,
            label: slot.label,
            inflows: totalInflows,
            outflows: totalOutflows,
            netFlow,
            cumulativeCash: rollingCash,
            invoicesCount: matchedInvoices.length,
            invoicesList: matchedInvoices.map((i) => `${i.reference} (${formatFcfa(i.remainingAmount)})`),
            expensesCount: matchedExpenses.length,
            expensesList: matchedExpenses.map((e) => `${e.label} (${formatFcfa(e.amount)})`),
            descInflow: slot.descInflow,
            descOutflow: slot.descOutflow,
          };
        });

        const totalHorizonInflows = cashflowData.reduce((s, d) => s + d.inflows, 0);
        const totalHorizonOutflows = cashflowData.reduce((s, d) => s + d.outflows, 0);
        const finalProjectedCash = cashflowData[cashflowData.length - 1]?.cumulativeCash || initialCash;
        const minCashPoint = Math.min(...cashflowData.map((d) => d.cumulativeCash));
        const maxCashPoint = Math.max(...cashflowData.map((d) => d.cumulativeCash));
        const minPeriod = cashflowData.find((d) => d.cumulativeCash === minCashPoint);

        // Tooltip personnalisé pour la trésorerie
        const CustomCashflowTooltip = ({ active, payload, label }: any) => {
          if (active && payload && payload.length) {
            const data = payload[0]?.payload;
            return (
              <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-xl text-xs space-y-2.5 min-w-[270px]">
                <div className="border-b border-slate-100 pb-1.5 flex items-center justify-between">
                  <span className="font-bold text-slate-900">{data?.label || label}</span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      data?.netFlow >= 0
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-rose-50 text-rose-700'
                    }`}
                  >
                    Flux net : {data?.netFlow >= 0 ? '+' : ''}{formatFcfa(data?.netFlow)}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-600 shrink-0" />
                      Encaissements prévus :
                    </span>
                    <span className="font-mono tabular-nums font-bold text-emerald-700">
                      +{formatFcfa(data?.inflows)}
                    </span>
                  </div>
                  {data?.invoicesList?.length > 0 && (
                    <div className="pl-3.5 text-[10px] text-slate-500 italic">
                      Échéances clients : {data.invoicesList.join(' · ')}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-rose-600 shrink-0" />
                      Décaissements dépenses :
                    </span>
                    <span className="font-mono tabular-nums font-bold text-rose-600">
                      -{formatFcfa(data?.outflows)}
                    </span>
                  </div>
                  {data?.expensesList?.length > 0 && (
                    <div className="pl-3.5 text-[10px] text-slate-500 italic">
                      Charges : {data.expensesList.slice(0, 2).join(' · ')}
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between font-semibold">
                    <span className="text-slate-800">Trésorerie nette cumulée :</span>
                    <span className="font-mono tabular-nums text-sm font-bold text-slate-900">
                      {formatFcfa(data?.cumulativeCash)}
                    </span>
                  </div>
                </div>
              </div>
            );
          }
          return null;
        };

        return (
          <div className="space-y-6">
            {/* EN-TÊTE DE LA TRÉSORERIE PRÉVISIONNELLE */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-slate-900" />
                  Trésorerie Prévisionnelle & Échéancier Continu de Liquidité
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Modélisation dynamique basée sur les dates d'échéance des factures clients et les décaissements de dépenses
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => generateProfitabilityAndFinancialReportPdf(state)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 shadow-xs transition-colors shrink-0"
                >
                  <FileDown className="h-4 w-4" />
                  Exporter Synthèse PDF
                </button>
              </div>
            </div>

            {/* 4 CARTES KPI CLÉS DE TRÉSORERIE */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* KPI 1 : Trésorerie disponible actuelle */}
              <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-medium">Trésorerie actuelle (Solde départ)</span>
                  <Landmark className="h-4 w-4 text-slate-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                    {formatFcfa(initialCash)}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Au 07/10/2026 · Disponibilités bancaires
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Point bas projeté :</span>
                  <span className="font-mono tabular-nums font-semibold text-slate-800">
                    {formatFcfa(minCashPoint)}
                  </span>
                </div>
              </div>

              {/* KPI 2 : Total Entrées Prévisionnelles */}
              <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-medium">Encaissements attendus (Échéances)</span>
                  <ArrowDownRight className="h-4 w-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold font-mono tabular-nums text-emerald-700">
                    {formatFcfa(totalHorizonInflows)}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Sur factures clients en cours & acomptes
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Créances à recouvrer :</span>
                  <span className="font-mono tabular-nums font-semibold text-emerald-700">
                    {formatFcfa(openReceivables)}
                  </span>
                </div>
              </div>

              {/* KPI 3 : Total Décaissements Prévus */}
              <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-medium">Décaissements prévus (Charges & Achats)</span>
                  <ArrowUpRight className="h-4 w-4 text-rose-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold font-mono tabular-nums text-rose-600">
                    {formatFcfa(totalHorizonOutflows)}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Achats fournisseurs, carburant & transport
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Dépenses saisies :</span>
                  <span className="font-mono tabular-nums font-semibold text-rose-600">
                    {formatFcfa(state.expenses.reduce((s, e) => s + e.amount, 0))}
                  </span>
                </div>
              </div>

              {/* KPI 4 : Trésorerie Finale Projetée */}
              <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-medium">Trésorerie projetée (Fin horizon)</span>
                  <Wallet className="h-4 w-4 text-slate-900" />
                </div>
                <div>
                  <p className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                    {formatFcfa(finalProjectedCash)}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Variation nette :{' '}
                    <span
                      className={`font-mono font-semibold ${
                        finalProjectedCash >= initialCash ? 'text-emerald-700' : 'text-rose-600'
                      }`}
                    >
                      {finalProjectedCash >= initialCash ? '+' : ''}
                      {formatFcfa(finalProjectedCash - initialCash)}
                    </span>
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Statut liquidité :</span>
                  <span className="font-semibold text-emerald-700">
                    Excédentaire (Pas de découvert)
                  </span>
                </div>
              </div>
            </div>

            {/* GRAPHIQUE COMPOSEDCHART : ÉVOLUTION DE LA TRÉSORERIE PRÉVISIONNELLE */}
            <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-slate-900" />
                    Courbe d’Évolution de la Trésorerie Nette Prévisionnelle (Octobre — Décembre 2026)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Encaissements prévus (barres vertes), Décaissements prévus (barres rouges) et Solde cumulé continu (ligne bleue)
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <div className="rounded-md bg-slate-50 border border-slate-200 px-3 py-1.5">
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Point Bas</span>
                    <span className="font-mono tabular-nums font-bold text-slate-900">
                      {formatFcfa(minCashPoint)}
                    </span>
                  </div>
                  <div className="rounded-md bg-slate-50 border border-slate-200 px-3 py-1.5">
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Point Haut</span>
                    <span className="font-mono tabular-nums font-bold text-slate-900">
                      {formatFcfa(maxCashPoint)}
                    </span>
                  </div>
                  <div className="rounded-md bg-emerald-50 border border-emerald-200 px-3 py-1.5">
                    <span className="text-emerald-700 block text-[10px] uppercase font-semibold">Atterrissage Déc.</span>
                    <span className="font-mono tabular-nums font-bold text-emerald-800">
                      {formatFcfa(finalProjectedCash)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="w-full h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={cashflowData}
                    margin={{ top: 20, right: 20, left: 10, bottom: 5 }}
                    barGap={6}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="period"
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(val: number) =>
                        val >= 1000000 ? `${(val / 1000000).toFixed(0)}M` : `${val}`
                      }
                    />
                    <ReferenceLine
                      y={0}
                      stroke="#94a3b8"
                      strokeDasharray="3 3"
                      label={{ value: 'Seuil 0 FCFA', fill: '#94a3b8', fontSize: 10, position: 'right' }}
                    />
                    <ReferenceLine
                      y={10000000}
                      stroke="#cbd5e1"
                      strokeDasharray="2 2"
                      label={{ value: 'Sécurité BFR (10M)', fill: '#64748b', fontSize: 9, position: 'insideTopLeft' }}
                    />
                    <RechartsTooltip content={<CustomCashflowTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} iconType="circle" />
                    <Bar
                      dataKey="inflows"
                      name="Encaissements Prévus (FCFA)"
                      fill="#059669"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={26}
                    />
                    <Bar
                      dataKey="outflows"
                      name="Décaissements Prévus (FCFA)"
                      fill="#dc2626"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={26}
                    />
                    <Line
                      type="monotone"
                      dataKey="cumulativeCash"
                      name="Solde de Trésorerie Cumulée (FCFA)"
                      stroke="#0f172a"
                      strokeWidth={3}
                      dot={{ r: 4, fill: '#0f172a' }}
                      activeDot={{ r: 7, fill: '#2563eb' }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Note explicative */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-700 flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
                <p>
                  <strong>Principe de projection :</strong> Les flux entrants sont déclenchés aux dates d’échéance des factures clients (par exemple la facture <strong>FAC-2026-000088</strong> de 4 900 000 FCFA échéant le 03/11 et la facture <strong>FAC-2026-000089</strong> de 21 052 000 FCFA échéant le 28/11). Les flux sortants intègrent les commandes fournisseurs et les dépenses d’exploitation enregistrées.
                </p>
              </div>
            </div>

            {/* TABLEAU DE L'ÉCHÉANCIER CHRONOLOGIQUE DÉTAILLÉ */}
            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-xs">
              <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Échéancier Chronologique des Flux (Factures Clients vs Décaissements Dépenses)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Ventilation détaillée période par période des entrées attendues et sorties programmées
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    exportToCsvFile(
                      'Echeancier_Tresorerie_Previsionnelle.csv',
                      [
                        'Periode',
                        'Dates',
                        'Encaissements Prevus',
                        'Decaissements Prevus',
                        'Flux Net',
                        'Tresorerie Cumulee',
                        'Detail Entrees',
                        'Detail Sorties',
                      ],
                      cashflowData.map((d) => [
                        d.period,
                        d.label,
                        d.inflows,
                        d.outflows,
                        d.netFlow,
                        d.cumulativeCash,
                        d.invoicesList.join(' | ') || d.descInflow,
                        d.expensesList.join(' | ') || d.descOutflow,
                      ])
                    )
                  }
                  className="text-xs font-semibold text-slate-900 underline"
                >
                  Exporter CSV / Excel
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
                      <th className="py-3 px-4">Période</th>
                      <th className="py-3 px-4">Échéances Factures Clients (Entrées)</th>
                      <th className="py-3 px-4">Dépenses & Achats (Sorties)</th>
                      <th className="py-3 px-4 text-right">Encaissements</th>
                      <th className="py-3 px-4 text-right">Décaissements</th>
                      <th className="py-3 px-4 text-right">Flux Net</th>
                      <th className="py-3 px-4 text-right">Trésorerie Estimée</th>
                      <th className="py-3 px-4 text-center">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {cashflowData.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-50/80">
                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-slate-900">{d.period}</p>
                          <p className="text-[11px] text-slate-500">{d.label}</p>
                        </td>
                        <td className="py-3.5 px-4 max-w-xs">
                          {d.invoicesList.length > 0 ? (
                            <div className="space-y-0.5">
                              {d.invoicesList.map((item, idx) => (
                                <span
                                  key={idx}
                                  className="inline-block rounded bg-emerald-50 text-emerald-800 px-2 py-0.5 text-[11px] font-mono font-medium mr-1.5"
                                >
                                  {item}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-500 text-[11px]">{d.descInflow}</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 max-w-xs">
                          {d.expensesList.length > 0 ? (
                            <div className="space-y-0.5">
                              {d.expensesList.map((item, idx) => (
                                <span
                                  key={idx}
                                  className="inline-block rounded bg-rose-50 text-rose-800 px-2 py-0.5 text-[11px] font-mono font-medium mr-1.5"
                                >
                                  {item}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-500 text-[11px]">{d.descOutflow}</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-emerald-700">
                          {formatFcfa(d.inflows)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-rose-600">
                          {formatFcfa(d.outflows)}
                        </td>
                        <td
                          className={`py-3.5 px-4 text-right font-mono tabular-nums font-bold ${
                            d.netFlow >= 0 ? 'text-emerald-700' : 'text-rose-600'
                          }`}
                        >
                          {d.netFlow >= 0 ? '+' : ''}
                          {formatFcfa(d.netFlow)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900 text-sm">
                          {formatFcfa(d.cumulativeCash)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {d.cumulativeCash >= 25000000 ? (
                            <span className="rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-[10px] font-bold">
                              Très Favorable
                            </span>
                          ) : d.cumulativeCash >= 15000000 ? (
                            <span className="rounded-full bg-blue-100 text-blue-800 px-2.5 py-0.5 text-[10px] font-bold">
                              Équilibré
                            </span>
                          ) : (
                            <span className="rounded-full bg-amber-100 text-amber-800 px-2.5 py-0.5 text-[10px] font-bold">
                              Vigilance BFR
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}


      {/* MODALE CRÉER FACTURE SUR LIVRAISON */}
      {showNewInvoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Émettre une Facture Liée à une Livraison / Réception
            </h3>
            <p className="text-xs text-slate-600">
              Règle 5 : Toute facture est rattachée à son contrat et à son dossier de livraison justificatif.
            </p>
            <div className="text-xs space-y-2">
              <label className="block font-semibold text-slate-700">
                Sélectionner le Dossier de Livraison *
              </label>
              <select
                value={selectedDeliveryForInvoice}
                onChange={(e) => setSelectedDeliveryForInvoice(e.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 font-mono"
              >
                {state.deliveries.map((d) => {
                  const val = d.lines.reduce(
                    (s, l) =>
                      s +
                      (d.status === DeliveryStatus.RECEIVED ||
                      d.status === DeliveryStatus.PARTIALLY_RECEIVED
                        ? l.quantityAccepted
                        : l.quantityDelivered) *
                        l.unitPrice,
                    0
                  );
                  return (
                    <option key={d.id} value={d.id}>
                      {d.reference} ({d.status}) — Base : {formatFcfa(val)}
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => setShowNewInvoiceModal(false)}
                className="rounded border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  if (selectedDeliveryForInvoice) {
                    onCreateInvoiceFromDelivery(selectedDeliveryForInvoice);
                    setShowNewInvoiceModal(false);
                    setSubTab('INVOICES');
                  }
                }}
                className="rounded bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Émettre la Facture
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE NOUVELLE DÉPENSE DIRECTE */}
      {showNewExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Enregistrer une Dépense Directe (Transport, Carburant, Manutention)
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Catégorie de dépense *
                </label>
                <select
                  value={expCategory}
                  onChange={(e) =>
                    setExpCategory(e.target.value as ExpenseCategoryType)
                  }
                  className="w-full rounded border border-slate-300 px-3 py-2"
                >
                  {Object.values(ExpenseCategoryType).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Libellé / Justificatif *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Carburant et péage convoi Yamoussoukro"
                  value={expLabel}
                  onChange={(e) => setExpLabel(e.target.value)}
                  className="w-full rounded border border-slate-300 px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Montant (FCFA) *
                  </label>
                  <input
                    type="number"
                    value={expAmount}
                    onChange={(e) => setExpAmount(Number(e.target.value))}
                    className="w-full rounded border border-slate-300 px-3 py-2 font-mono text-right"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    value={expDate}
                    onChange={(e) => setExpDate(e.target.value)}
                    className="w-full rounded border border-slate-300 px-3 py-2 font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Marché / Contrat rattaché
                </label>
                <select
                  value={expContractId}
                  onChange={(e) => setExpContractId(e.target.value)}
                  className="w-full rounded border border-slate-300 px-3 py-2"
                >
                  {state.contracts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.reference} — {c.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => setShowNewExpenseModal(false)}
                className="rounded border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  onAddExpense({
                    category: expCategory,
                    label:
                      expLabel.trim() ||
                      `Frais ${expCategory} — Exploitation logistique`,
                    amount: expAmount,
                    expenseDate: expDate,
                    contractId: expContractId,
                    deliveryId: expDeliveryId,
                  });
                  setShowNewExpenseModal(false);
                  setSubTab('EXPENSES');
                }}
                className="rounded bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Enregistrer la Dépense
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
