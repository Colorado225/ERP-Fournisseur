import React, { useState } from 'react';
import {
  Building2,
  FileDown,
  FileSpreadsheet,
  MapPin,
  Plus,
  ShoppingBag,
  Truck,
} from 'lucide-react';
import {
  ContractStatus,
  ErpState,
  UnitCode,
} from '../shared/types';
import {
  calculateContractLineMetrics,
  calculateContractProgress,
  formatFcfa,
  formatQty,
} from '../shared/domainEngine';
import { generateContractExecutionReportPdf } from '../shared/pdfGenerator';

interface ContractsAndOrdersViewProps {
  state: ErpState;
  initialSubTab?: 'CONTRACTS' | 'EXECUTION' | 'ORDERS' | 'CUSTOMERS';
  onStartNewDelivery: () => void;
  onAddCustomer: (payload: {
    code: string;
    name: string;
    category: string;
    taxIdentifier: string;
    paymentTermsDays: number;
    primaryContactName: string;
    primaryContactPhone: string;
    siteName: string;
    city: string;
    addressLine: string;
    receivingHours: string;
  }) => void;
  onAddContract: (payload: {
    reference: string;
    title: string;
    customerId: string;
    startDate: string;
    endDate: string;
    notes: string;
    lines: Array<{
      productId: string;
      unit: UnitCode;
      quantity: number;
      unitPrice: number;
      taxRate: number;
    }>;
  }) => void;
  onAddOrder: (payload: {
    contractId: string;
    destinationId: string;
    requestedDate: string;
    totalAmount: number;
    notes: string;
  }) => void;
}

export const ContractsAndOrdersView: React.FC<ContractsAndOrdersViewProps> = ({
  state,
  initialSubTab = 'CONTRACTS',
  onStartNewDelivery,
  onAddCustomer,
  onAddContract,
  onAddOrder,
}) => {
  const [subTab, setSubTab] = useState<
    'CONTRACTS' | 'EXECUTION' | 'ORDERS' | 'CUSTOMERS'
  >(initialSubTab);

  // Modales de création (Critères d'acceptation 3, 4, 5, 6)
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const [showNewContractModal, setShowNewContractModal] = useState(false);
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);

  // Formulaire Nouveau Client
  const [custCode, setCustCode] = useState('CLI-INST-004');
  const [custName, setCustName] = useState('');
  const [custCategory, setCustCategory] = useState('Santé & Établissements Publics');
  const [custTaxId, setCustTaxId] = useState('ID-FISC-DEMO-04');
  const [custTerms, setCustTerms] = useState(45);
  const [custContact, setCustContact] = useState('');
  const [custPhone, setCustPhone] = useState('+225 07 00 11 22 33');
  const [siteName, setSiteName] = useState('');
  const [siteCity, setSiteCity] = useState('Abidjan');
  const [siteAddress, setSiteAddress] = useState('');
  const [siteHours, setSiteHours] = useState('07h30 - 15h00');

  // Formulaire Nouveau Contrat
  const [ctrRef, setCtrRef] = useState('M-2026-INST-045');
  const [ctrTitle, setCtrTitle] = useState('');
  const [ctrCustomerId, setCtrCustomerId] = useState(state.customers[0]?.id || '');
  const [ctrStart, setCtrStart] = useState('2026-10-01');
  const [ctrEnd, setCtrEnd] = useState('2027-06-30');
  const [ctrNotes, setCtrNotes] = useState(
    'Marché cadre avec livraisons échelonnées sur bon de commande.'
  );
  const [ctrLines, setCtrLines] = useState<
    Array<{
      productId: string;
      unit: UnitCode;
      quantity: number;
      unitPrice: number;
      taxRate: number;
    }>
  >([
    {
      productId: state.products[0]?.id || 'prod-riz-50',
      unit: UnitCode.KG,
      quantity: 25000,
      unitPrice: 560,
      taxRate: 0,
    },
    {
      productId: state.products[1]?.id || 'prod-huile-20l',
      unit: UnitCode.LITER,
      quantity: 5000,
      unitPrice: 1250,
      taxRate: 0,
    },
  ]);

  // Formulaire Nouvelle Commande
  const [ordContractId, setOrdContractId] = useState(state.contracts[0]?.id || '');
  const selectedOrdContract = state.contracts.find((c) => c.id === ordContractId);
  const selectedOrdCustomer = state.customers.find(
    (c) => c.id === selectedOrdContract?.customerId
  );
  const [ordDestinationId, setOrdDestinationId] = useState(
    selectedOrdCustomer?.destinations[0]?.id || ''
  );
  const [ordReqDate, setOrdReqDate] = useState('2026-10-12');
  const [ordAmount, setOrdAmount] = useState(9500000);
  const [ordNotes, setOrdNotes] = useState(
    'Commande mensuelle — livraison souhaitée avant 11h00.'
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Marchés / Contrats, Clients Institutionnels & Commandes
          </h1>
          <p className="text-xs text-slate-500">
            Suivi de l’exécution contractuelle, contrôle strict des reliquats par denrée et gestion des sites de livraison.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => generateContractExecutionReportPdf(state)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap"
          >
            <FileDown className="h-4 w-4" />
            Rapport Exécution PDF
          </button>
          <button
            type="button"
            onClick={() => setShowNewCustomerModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            Nouveau Client
          </button>
          <button
            type="button"
            onClick={() => setShowNewOrderModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            Nouvelle Commande
          </button>
          <button
            type="button"
            onClick={() => setShowNewContractModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            Nouveau Contrat
          </button>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex items-center gap-1 rounded-lg bg-slate-200/80 p-1 w-fit">
        <button
          type="button"
          onClick={() => setSubTab('CONTRACTS')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
            subTab === 'CONTRACTS'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Marchés & Lignes ({state.contracts.length})
        </button>
        <button
          type="button"
          onClick={() => setSubTab('EXECUTION')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
            subTab === 'EXECUTION'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Matrice des Reliquats
        </button>
        <button
          type="button"
          onClick={() => setSubTab('ORDERS')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
            subTab === 'ORDERS'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Commandes ({state.orders.length})
        </button>
        <button
          type="button"
          onClick={() => setSubTab('CUSTOMERS')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
            subTab === 'CUSTOMERS'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Clients & Sites ({state.customers.length})
        </button>
      </div>

      {/* SOUS-ONGLET 1 : CONTRATS & LIGNES CONTRACTUELLES */}
      {subTab === 'CONTRACTS' && (
        <div className="space-y-6">
          {state.contracts.map((contract) => {
            const customer = state.customers.find(
              (c) => c.id === contract.customerId
            );
            const progress = calculateContractProgress(
              contract,
              state.deliveries
            );

            return (
              <div
                key={contract.id}
                className="rounded-lg border border-slate-200 bg-white overflow-hidden"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 bg-slate-50/70 px-5 py-4">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono font-bold text-slate-900">
                        {contract.reference}
                      </span>
                      <span>·</span>
                      <span>Statut : {contract.status}</span>
                      <span>·</span>
                      <span>
                        Période : {contract.startDate} → {contract.endDate}
                      </span>
                    </div>
                    <h2 className="text-base font-bold text-slate-900 mt-1">
                      {contract.title}
                    </h2>
                    <p className="text-xs text-slate-600">
                      Client : <strong>{customer?.name}</strong> ·{' '}
                      {customer?.destinations.length} site(s) de livraison
                    </p>
                  </div>

                  <div className="text-right space-y-1">
                    <p className="font-mono tabular-nums text-base font-bold text-slate-900">
                      {formatFcfa(contract.totalAmount)}
                    </p>
                    <p className="text-xs text-slate-600">
                      Exécuté accepté :{' '}
                      <strong className="font-mono tabular-nums text-emerald-700">
                        {progress.progressPercent}% ({formatFcfa(progress.executedValue)})
                      </strong>
                    </p>
                  </div>
                </div>

                {/* Tableau des lignes contractuelles */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-white font-semibold text-slate-600">
                        <th className="py-2.5 px-4">Denrée Contractuelle</th>
                        <th className="py-2.5 px-4 text-right">
                          Qté Contractuelle
                        </th>
                        <th className="py-2.5 px-4 text-right">
                          Livré Accepté
                        </th>
                        <th className="py-2.5 px-4 text-right">En Transit</th>
                        <th className="py-2.5 px-4 text-right">
                          Reliquat Restant
                        </th>
                        <th className="py-2.5 px-4 text-right">
                          Prix Unitaire HT
                        </th>
                        <th className="py-2.5 px-4 text-right">Total Ligne</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {contract.lines.map((line) => {
                        const prod = state.products.find(
                          (p) => p.id === line.productId
                        );
                        const metrics = calculateContractLineMetrics(
                          line,
                          state.deliveries
                        );

                        return (
                          <tr key={line.id} className="hover:bg-slate-50">
                            <td className="py-3 px-4">
                              <p className="font-semibold text-slate-900">
                                {prod?.name}
                              </p>
                              <p className="text-slate-500">
                                {prod?.reference} · {prod?.packaging}
                              </p>
                            </td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                              {formatQty(metrics.contractQuantity, line.unit)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-emerald-700">
                              {formatQty(
                                metrics.acceptedDeliveredQuantity,
                                line.unit
                              )}
                            </td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600">
                              {formatQty(metrics.inTransitQuantity, line.unit)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                              {formatQty(metrics.remainingQuantity, line.unit)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                              {formatFcfa(line.unitPrice)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                              {formatFcfa(line.totalAmount)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SOUS-ONGLET 2 : MATRICE CONSOLIDÉE D'EXÉCUTION & RELIQUATS */}
      {subTab === 'EXECUTION' && (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-900">
              Contrôle Consolidé des Quantités Contractuelles, Acceptées, Refusées et Restantes
            </h2>
            <p className="text-xs text-slate-500">
              Vue détaillée par ligne de marché (Section 8, 13 & 27).
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
                  <th className="py-3 px-4">Marché</th>
                  <th className="py-3 px-4">Denrée</th>
                  <th className="py-3 px-4 text-right">Contractuel</th>
                  <th className="py-3 px-4 text-right">Livré Accepté</th>
                  <th className="py-3 px-4 text-right">Refusé</th>
                  <th className="py-3 px-4 text-right">Restant à livrer</th>
                  <th className="py-3 px-4 text-right">% Exécution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {state.contracts.flatMap((c) =>
                  c.lines.map((line) => {
                    const prod = state.products.find(
                      (p) => p.id === line.productId
                    );
                    const m = calculateContractLineMetrics(
                      line,
                      state.deliveries
                    );
                    return (
                      <tr key={line.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                          {c.reference}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-900">
                          {prod?.name}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums">
                          {formatQty(m.contractQuantity, line.unit)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-emerald-700">
                          {formatQty(m.acceptedDeliveredQuantity, line.unit)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-red-700">
                          {formatQty(m.rejectedQuantity, line.unit)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                          {formatQty(m.remainingQuantity, line.unit)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                          {m.executionRatePercent} %
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SOUS-ONGLET 3 : COMMANDES CLIENTS */}
      {subTab === 'ORDERS' && (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Bons de Commande & Appels de Livraison
              </h2>
              <p className="text-xs text-slate-500">
                Chaque commande est rattachée à un marché et à un site de destination.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowNewOrderModal(true)}
              className="rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              + Nouvelle Commande
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
                  <th className="py-3 px-4">Référence Commande</th>
                  <th className="py-3 px-4">Marché</th>
                  <th className="py-3 px-4">Site de Destination</th>
                  <th className="py-3 px-4">Date souhaitée</th>
                  <th className="py-3 px-4">Statut</th>
                  <th className="py-3 px-4 text-right">Montant Commande</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {state.orders.map((ord) => {
                  const ctr = state.contracts.find(
                    (c) => c.id === ord.contractId
                  );
                  const cust = state.customers.find(
                    (c) => c.id === ctr?.customerId
                  );
                  const dst = cust?.destinations.find(
                    (d) => d.id === ord.destinationId
                  );
                  return (
                    <tr key={ord.id} className="hover:bg-slate-50">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {ord.reference}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-700">
                        {ctr?.reference}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-900">
                        {dst?.siteName}
                      </td>
                      <td className="py-3.5 px-4 font-mono tabular-nums text-slate-700">
                        {ord.requestedDate}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-800">
                        {ord.status}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                        {formatFcfa(ord.totalAmount)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={onStartNewDelivery}
                          className="font-semibold text-slate-900 hover:underline"
                        >
                          Planifier Livraison →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SOUS-ONGLET 4 : CLIENTS INSTITUTIONNELS & SITES DE LIVRAISON */}
      {subTab === 'CUSTOMERS' && (
        <div className="grid grid-cols-1 gap-6">
          {state.customers.map((cust) => (
            <div
              key={cust.id}
              className="rounded-lg border border-slate-200 bg-white p-5 space-y-4"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-3">
                <div>
                  <p className="text-xs font-mono text-slate-500">
                    {cust.code} · {cust.category} · Délai de règlement :{' '}
                    {cust.paymentTermsDays} jours
                  </p>
                  <h3 className="text-base font-bold text-slate-900 mt-0.5">
                    {cust.name}
                  </h3>
                </div>
                <div className="text-xs text-slate-600">
                  Contact principal : <strong>{cust.primaryContactName}</strong> (
                  {cust.primaryContactPhone})
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {cust.destinations.map((dest) => (
                  <div
                    key={dest.id}
                    className="rounded-md border border-slate-200 bg-slate-50/70 p-3.5 text-xs space-y-1.5"
                  >
                    <p className="font-semibold text-slate-900">
                      {dest.siteName} ({dest.city})
                    </p>
                    <p className="text-slate-600">{dest.addressLine}</p>
                    <p className="text-slate-500">
                      Horaires réception : {dest.receivingHours}
                    </p>
                    <p className="text-slate-500">
                      Responsable site : {dest.contactPerson} ({dest.contactPhone})
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODALE NOUVEAU CLIENT (CRITÈRE D'ACCEPTATION 3) */}
      {showNewCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-xl rounded-lg border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Créer un Nouvel Organisme Client & Site de Livraison
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Code Client *
                </label>
                <input
                  type="text"
                  value={custCode}
                  onChange={(e) => setCustCode(e.target.value)}
                  className="w-full rounded border border-slate-300 px-3 py-2 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Catégorie *
                </label>
                <input
                  type="text"
                  value={custCategory}
                  onChange={(e) => setCustCategory(e.target.value)}
                  className="w-full rounded border border-slate-300 px-3 py-2"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">
                  Raison Sociale / Nom de l’Organisme (Fictif) *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Centre Régional des Œuvres Scolaires Sud (Fictif)"
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  className="w-full rounded border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Contact Principal *
                </label>
                <input
                  type="text"
                  placeholder="Nom de l'intendant / économe"
                  value={custContact}
                  onChange={(e) => setCustContact(e.target.value)}
                  className="w-full rounded border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Téléphone *
                </label>
                <input
                  type="text"
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  className="w-full rounded border border-slate-300 px-3 py-2 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nom du 1er Site de Livraison *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Magasin Central Vivres Treichville"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  className="w-full rounded border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Ville *
                </label>
                <input
                  type="text"
                  value={siteCity}
                  onChange={(e) => setSiteCity(e.target.value)}
                  className="w-full rounded border border-slate-300 px-3 py-2"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => setShowNewCustomerModal(false)}
                className="rounded border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!custName.trim()) return;
                  onAddCustomer({
                    code: custCode,
                    name: custName,
                    category: custCategory,
                    taxIdentifier: custTaxId,
                    paymentTermsDays: custTerms,
                    primaryContactName: custContact || 'Intendant Principal',
                    primaryContactPhone: custPhone,
                    siteName: siteName || `Magasin Principal — ${custName}`,
                    city: siteCity,
                    addressLine: siteAddress || 'Zone Logistique Principale',
                    receivingHours: siteHours,
                  });
                  setShowNewCustomerModal(false);
                  setSubTab('CUSTOMERS');
                }}
                className="rounded bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Enregistrer le Client
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE NOUVEAU CONTRAT AVEC LIGNES DE PRODUITS (CRITÈRES 4 & 5) */}
      {showNewContractModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Créer un Nouveau Contrat / Marché & Lignes Contractuelles
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Référence du Marché *
                </label>
                <input
                  type="text"
                  value={ctrRef}
                  onChange={(e) => setCtrRef(e.target.value)}
                  className="w-full rounded border border-slate-300 px-3 py-2 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Organisme Client *
                </label>
                <select
                  value={ctrCustomerId}
                  onChange={(e) => setCtrCustomerId(e.target.value)}
                  className="w-full rounded border border-slate-300 px-3 py-2"
                >
                  {state.customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">
                  Objet / Intitulé du Marché *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Fourniture annuelle de riz et huile végétale — Exercice 2026/2027"
                  value={ctrTitle}
                  onChange={(e) => setCtrTitle(e.target.value)}
                  className="w-full rounded border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Date de début *
                </label>
                <input
                  type="date"
                  value={ctrStart}
                  onChange={(e) => setCtrStart(e.target.value)}
                  className="w-full rounded border border-slate-300 px-3 py-2 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Date de fin *
                </label>
                <input
                  type="date"
                  value={ctrEnd}
                  onChange={(e) => setCtrEnd(e.target.value)}
                  className="w-full rounded border border-slate-300 px-3 py-2 font-mono"
                />
              </div>
            </div>

            <div className="space-y-2 border-t border-slate-200 pt-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-900">
                  Lignes de Denrées du Contrat
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setCtrLines((prev) => [
                      ...prev,
                      {
                        productId: state.products[2]?.id || state.products[0].id,
                        unit: UnitCode.KG,
                        quantity: 5000,
                        unitPrice: 750,
                        taxRate: 0,
                      },
                    ])
                  }
                  className="text-xs font-semibold text-slate-900 underline"
                >
                  + Ajouter une ligne produit
                </button>
              </div>

              {ctrLines.map((ln, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-12 gap-2 items-center text-xs"
                >
                  <div className="col-span-5">
                    <select
                      value={ln.productId}
                      onChange={(e) => {
                        const prod = state.products.find(
                          (p) => p.id === e.target.value
                        );
                        setCtrLines((prev) =>
                          prev.map((item, i) =>
                            i === idx
                              ? {
                                  ...item,
                                  productId: e.target.value,
                                  unit: prod?.unit || UnitCode.KG,
                                }
                              : item
                          )
                        );
                      }}
                      className="w-full rounded border border-slate-300 px-2 py-1.5"
                    >
                      {state.products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.unit})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-3">
                    <input
                      type="number"
                      placeholder="Quantité"
                      value={ln.quantity}
                      onChange={(e) =>
                        setCtrLines((prev) =>
                          prev.map((item, i) =>
                            i === idx
                              ? { ...item, quantity: Number(e.target.value) }
                              : item
                          )
                        )
                      }
                      className="w-full rounded border border-slate-300 px-2 py-1.5 font-mono text-right"
                    />
                  </div>
                  <div className="col-span-4">
                    <input
                      type="number"
                      placeholder="Prix unitaire FCFA"
                      value={ln.unitPrice}
                      onChange={(e) =>
                        setCtrLines((prev) =>
                          prev.map((item, i) =>
                            i === idx
                              ? { ...item, unitPrice: Number(e.target.value) }
                              : item
                          )
                        )
                      }
                      className="w-full rounded border border-slate-300 px-2 py-1.5 font-mono text-right"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => setShowNewContractModal(false)}
                className="rounded border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  onAddContract({
                    reference: ctrRef,
                    title:
                      ctrTitle.trim() ||
                      `Marché de fourniture de denrées — ${ctrRef}`,
                    customerId: ctrCustomerId,
                    startDate: ctrStart,
                    endDate: ctrEnd,
                    notes: ctrNotes,
                    lines: ctrLines,
                  });
                  setShowNewContractModal(false);
                  setSubTab('CONTRACTS');
                }}
                className="rounded bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Activer le Contrat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE NOUVELLE COMMANDE (CRITÈRE 6) */}
      {showNewOrderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Enregistrer une Nouvelle Commande Client sur Contrat
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Contrat / Marché *
                </label>
                <select
                  value={ordContractId}
                  onChange={(e) => {
                    setOrdContractId(e.target.value);
                    const ctr = state.contracts.find(
                      (c) => c.id === e.target.value
                    );
                    const cust = state.customers.find(
                      (c) => c.id === ctr?.customerId
                    );
                    setOrdDestinationId(cust?.destinations[0]?.id || '');
                  }}
                  className="w-full rounded border border-slate-300 px-3 py-2"
                >
                  {state.contracts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.reference} — {c.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Destination de Livraison *
                </label>
                <select
                  value={ordDestinationId}
                  onChange={(e) => setOrdDestinationId(e.target.value)}
                  className="w-full rounded border border-slate-300 px-3 py-2"
                >
                  {(selectedOrdCustomer?.destinations || []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.siteName} ({d.city})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Date de livraison demandée *
                  </label>
                  <input
                    type="date"
                    value={ordReqDate}
                    onChange={(e) => setOrdReqDate(e.target.value)}
                    className="w-full rounded border border-slate-300 px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Montant engagé (FCFA) *
                  </label>
                  <input
                    type="number"
                    value={ordAmount}
                    onChange={(e) => setOrdAmount(Number(e.target.value))}
                    className="w-full rounded border border-slate-300 px-3 py-2 font-mono text-right"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  value={ordNotes}
                  onChange={(e) => setOrdNotes(e.target.value)}
                  className="w-full rounded border border-slate-300 px-3 py-2"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => setShowNewOrderModal(false)}
                className="rounded border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  onAddOrder({
                    contractId: ordContractId,
                    destinationId: ordDestinationId,
                    requestedDate: ordReqDate,
                    totalAmount: ordAmount,
                    notes: ordNotes,
                  });
                  setShowNewOrderModal(false);
                  setSubTab('ORDERS');
                }}
                className="rounded bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Créer la Commande
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
