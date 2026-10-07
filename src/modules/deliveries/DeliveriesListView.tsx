import React, { useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  FileDown,
  Filter,
  Plus,
  Search,
  Truck,
} from 'lucide-react';
import { Delivery, DeliveryStatus, ErpState } from '../shared/types';
import { formatFcfa, formatQty } from '../shared/domainEngine';
import { exportToCsvFile } from '../shared/pdfGenerator';

interface DeliveriesListViewProps {
  state: ErpState;
  initialSubTab?: 'ALL' | 'RECEPTIONS' | 'CALENDAR';
  onSelectDelivery: (deliveryId: string) => void;
  onStartNewDelivery: () => void;
}

export const DeliveriesListView: React.FC<DeliveriesListViewProps> = ({
  state,
  initialSubTab = 'ALL',
  onSelectDelivery,
  onStartNewDelivery,
}) => {
  const [subTab, setSubTab] = useState<'ALL' | 'RECEPTIONS' | 'CALENDAR'>(
    initialSubTab
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [calendarScale, setCalendarScale] = useState<'DAY' | 'WEEK' | 'MONTH'>(
    'WEEK'
  );

  const todayStr = '2026-10-07';

  const filteredDeliveries = state.deliveries.filter((del) => {
    const contract = state.contracts.find((c) => c.id === del.contractId);
    const customer = state.customers.find(
      (c) => c.id === contract?.customerId
    );
    const dest = customer?.destinations.find(
      (d) => d.id === del.destinationId
    );

    const matchesSearch =
      del.reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (contract?.reference || '')
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      (dest?.siteName || '')
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      del.driverName.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (statusFilter !== 'ALL' && del.status !== statusFilter) return false;
    if (subTab === 'RECEPTIONS') {
      return (
        del.status === DeliveryStatus.DISPATCHED ||
        del.status === DeliveryStatus.PARTIALLY_RECEIVED ||
        del.status === DeliveryStatus.RECEIVED ||
        del.status === DeliveryStatus.REJECTED
      );
    }
    return true;
  });

  const handleExportDeliveriesCsv = () => {
    exportToCsvFile(
      'Livraisons_IvoireAppro_2026.csv',
      [
        'Bordereau',
        'Marché',
        'Client',
        'Site de destination',
        'Date prévue',
        'Statut',
        'Chauffeur',
        'Véhicule',
        'Valorisation Expédiée (FCFA)',
        'Valorisation Acceptée (FCFA)',
      ],
      filteredDeliveries.map((d) => {
        const ctr = state.contracts.find((c) => c.id === d.contractId);
        const cust = state.customers.find((c) => c.id === ctr?.customerId);
        const dst = cust?.destinations.find((x) => x.id === d.destinationId);
        const shippedVal = d.lines.reduce(
          (s, l) => s + l.quantityDelivered * l.unitPrice,
          0
        );
        const acceptedVal = d.lines.reduce(
          (s, l) => s + l.quantityAccepted * l.unitPrice,
          0
        );
        return [
          d.reference,
          ctr?.reference || '',
          cust?.name || '',
          dst?.siteName || '',
          d.plannedDate,
          d.status,
          d.driverName,
          d.vehiclePlate,
          shippedVal,
          acceptedVal,
        ];
      })
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Opérations Logistiques — Livraisons, Réceptions & Calendrier
          </h1>
          <p className="text-xs text-slate-500">
            Suivi des dossiers de livraison multi-sites, génération des bordereaux versionnés et contrôle contradictoire des réceptions.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportDeliveriesCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap"
          >
            <FileDown className="h-4 w-4" />
            Exporter CSV / Excel
          </button>
          <button
            type="button"
            onClick={onStartNewDelivery}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            Nouvelle Livraison
          </button>
        </div>
      </div>

      {/* Navigation secondaire Opérations */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-lg bg-slate-200/80 p-1">
          <button
            type="button"
            onClick={() => setSubTab('ALL')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              subTab === 'ALL'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tous les Dossiers ({state.deliveries.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('RECEPTIONS')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              subTab === 'RECEPTIONS'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Réceptions & Réserves
          </button>
          <button
            type="button"
            onClick={() => setSubTab('CALENDAR')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              subTab === 'CALENDAR'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Calendrier Logistique
          </button>
        </div>

        {subTab !== 'CALENDAR' && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Rechercher N° BL, site, marché..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900"
            >
              <option value="ALL">Tous les statuts</option>
              <option value={DeliveryStatus.PLANNED}>PLANNED (Planifiée)</option>
              <option value={DeliveryStatus.PREPARING}>
                PREPARING (En préparation)
              </option>
              <option value={DeliveryStatus.READY}>READY (Prête sur quai)</option>
              <option value={DeliveryStatus.DISPATCHED}>
                DISPATCHED (Expédiée)
              </option>
              <option value={DeliveryStatus.PARTIALLY_RECEIVED}>
                PARTIALLY_RECEIVED (Réception partielle)
              </option>
              <option value={DeliveryStatus.RECEIVED}>
                RECEIVED (Réceptionnée)
              </option>
            </select>
          </div>
        )}
      </div>

      {/* VUE CALENDRIER LOGISTIQUE (SECTION 25 : Jour / Semaine / Mois) */}
      {subTab === 'CALENDAR' ? (
        <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Calendrier Logistique & Échéances Contractuelles (Octobre 2026)
              </h2>
              <p className="text-xs text-slate-500">
                Visualisation des livraisons prévues, en retard, terminées et des dates clés des marchés.
              </p>
            </div>
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              {(['DAY', 'WEEK', 'MONTH'] as const).map((sc) => (
                <button
                  key={sc}
                  type="button"
                  onClick={() => setCalendarScale(sc)}
                  className={`px-3 py-1 text-xs font-medium rounded-md ${
                    calendarScale === sc
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600'
                  }`}
                >
                  {sc === 'DAY' ? 'Jour (07/10)' : sc === 'WEEK' ? 'Semaine' : 'Mois Complet'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {state.deliveries
              .filter((d) =>
                calendarScale === 'DAY' ? d.plannedDate === todayStr : true
              )
              .map((del) => {
                const ctr = state.contracts.find(
                  (c) => c.id === del.contractId
                );
                const cust = state.customers.find(
                  (c) => c.id === ctr?.customerId
                );
                const dst = cust?.destinations.find(
                  (x) => x.id === del.destinationId
                );
                const isLate =
                  del.plannedDate < todayStr &&
                  del.status !== DeliveryStatus.RECEIVED &&
                  del.status !== DeliveryStatus.PARTIALLY_RECEIVED;

                return (
                  <div
                    key={del.id}
                    onClick={() => onSelectDelivery(del.id)}
                    className={`cursor-pointer rounded-lg border p-4 transition-colors ${
                      isLate
                        ? 'border-red-300 bg-red-50/40'
                        : del.plannedDate === todayStr
                        ? 'border-slate-900 bg-slate-50'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono tabular-nums font-bold text-slate-900">
                        {del.plannedDate}
                      </span>
                      <span
                        className={`font-semibold ${
                          isLate
                            ? 'text-red-700'
                            : del.status === DeliveryStatus.RECEIVED
                            ? 'text-emerald-700'
                            : 'text-slate-700'
                        }`}
                      >
                        {isLate ? 'EN RETARD · ' : ''}
                        {del.status}
                      </span>
                    </div>
                    <p className="mt-2 font-mono text-xs font-bold text-slate-900">
                      {del.reference} · {ctr?.reference}
                    </p>
                    <p className="text-xs font-medium text-slate-800 mt-0.5">
                      {dst?.siteName}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Véhicule {del.vehiclePlate} · {del.driverName}
                    </p>
                  </div>
                );
              })}
          </div>
        </div>
      ) : (
        /* TABLEAU PROFESSIONNEL DES LIVRAISONS */
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
                  <th className="py-3 px-4">N° Bordereau</th>
                  <th className="py-3 px-4">Marché & Client</th>
                  <th className="py-3 px-4">Destination de livraison</th>
                  <th className="py-3 px-4">Date Prévue</th>
                  <th className="py-3 px-4">Chauffeur & Camion</th>
                  <th className="py-3 px-4">Statut & Réception</th>
                  <th className="py-3 px-4 text-right">Valeur Expédiée</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredDeliveries.map((del) => {
                  const contract = state.contracts.find(
                    (c) => c.id === del.contractId
                  );
                  const customer = state.customers.find(
                    (c) => c.id === contract?.customerId
                  );
                  const dest = customer?.destinations.find(
                    (d) => d.id === del.destinationId
                  );
                  const totalShipped = del.lines.reduce(
                    (s, l) => s + l.quantityDelivered * l.unitPrice,
                    0
                  );
                  const hasRejection = del.lines.some(
                    (l) => l.quantityRejected > 0
                  );

                  return (
                    <tr
                      key={del.id}
                      onClick={() => onSelectDelivery(del.id)}
                      className="cursor-pointer hover:bg-slate-50 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                        {del.reference}
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-mono font-semibold text-slate-900">
                          {contract?.reference}
                        </p>
                        <p className="text-slate-500 truncate max-w-xs">
                          {customer?.name}
                        </p>
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-medium text-slate-900">
                          {dest?.siteName}
                        </p>
                        <p className="text-slate-500">{dest?.city}</p>
                      </td>
                      <td className="py-3.5 px-4 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                        {del.plannedDate}
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="text-slate-800">{del.driverName}</p>
                        <p className="font-mono text-slate-500">
                          {del.vehiclePlate}
                        </p>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`font-semibold ${
                            del.status === DeliveryStatus.RECEIVED
                              ? 'text-emerald-700'
                              : del.status === DeliveryStatus.PARTIALLY_RECEIVED
                              ? 'text-amber-700'
                              : del.plannedDate < todayStr
                              ? 'text-red-700'
                              : 'text-slate-800'
                          }`}
                        >
                          {del.status}
                        </span>
                        {hasRejection && (
                          <p className="text-[11px] text-amber-800 mt-0.5">
                            Comporte une réserve / refus partiel
                          </p>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                        {formatFcfa(totalShipped)}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectDelivery(del.id);
                          }}
                          className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-900 hover:bg-slate-100"
                        >
                          Ouvrir Dossier
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
    </div>
  );
};
