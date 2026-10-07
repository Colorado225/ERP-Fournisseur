import React, { useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileDown,
  FilePlus2,
  FileText,
  Lock,
  Plus,
  Receipt,
  Truck,
  Upload,
} from 'lucide-react';
import {
  Delivery,
  DeliveryStatus,
  DocumentStatus,
  DocumentType,
  ErpState,
  InvoiceStatus,
} from '../shared/types';
import {
  calculateContractLineMetrics,
  formatFcfa,
  formatQty,
} from '../shared/domainEngine';
import { generateDeliveryNotePdf } from '../shared/pdfGenerator';

interface DeliveryDetailViewProps {
  delivery: Delivery;
  state: ErpState;
  onBack: () => void;
  onUpdateStatus: (deliveryId: string, nextStatus: DeliveryStatus, comment: string) => void;
  onRecordReception: (
    deliveryId: string,
    lines: Array<{
      lineId: string;
      quantityAccepted: number;
      quantityRejected: number;
      rejectionReason?: string;
      observation?: string;
    }>,
    generalComment: string
  ) => void;
  onCreateInvoiceFromDelivery: (deliveryId: string) => void;
  onGenerateAndArchiveDocument: (params: {
    deliveryId: string;
    docType: DocumentType;
    title: string;
    fileName: string;
    checksum: string;
  }) => void;
  onOpenPaymentModal: (invoiceId: string) => void;
}

export const DeliveryDetailView: React.FC<DeliveryDetailViewProps> = ({
  delivery,
  state,
  onBack,
  onUpdateStatus,
  onRecordReception,
  onCreateInvoiceFromDelivery,
  onGenerateAndArchiveDocument,
  onOpenPaymentModal,
}) => {
  const [activeTab, setActiveTab] = useState<
    'RESUME' | 'PRODUITS' | 'DOCUMENTS' | 'RECEPTION' | 'FINANCE' | 'HISTORIQUE'
  >('RESUME');

  const contract = state.contracts.find((c) => c.id === delivery.contractId);
  const customer = state.customers.find((c) => c.id === contract?.customerId);
  const destination = customer?.destinations.find(
    (d) => d.id === delivery.destinationId
  );
  const linkedInvoice = state.invoices.find(
    (inv) => inv.deliveryId === delivery.id
  );
  const deliveryDocuments = state.documents.filter(
    (doc) => doc.entityType === 'DELIVERY' && doc.entityId === delivery.id
  );
  const deliveryExpenses = state.expenses.filter(
    (exp) => exp.deliveryId === delivery.id
  );

  // État local du formulaire de réception (Onglet Réception - Section 14)
  const [receptionLines, setReceptionLines] = useState<
    Record<
      string,
      {
        quantityAccepted: number;
        quantityRejected: number;
        rejectionReason: string;
        observation: string;
      }
    >
  >(() => {
    const map: Record<
      string,
      {
        quantityAccepted: number;
        quantityRejected: number;
        rejectionReason: string;
        observation: string;
      }
    > = {};
    delivery.lines.forEach((l) => {
      const isAlreadyReceived =
        delivery.status === DeliveryStatus.RECEIVED ||
        delivery.status === DeliveryStatus.PARTIALLY_RECEIVED ||
        delivery.status === DeliveryStatus.REJECTED;
      map[l.id] = {
        quantityAccepted: isAlreadyReceived
          ? l.quantityAccepted
          : l.quantityDelivered,
        quantityRejected: isAlreadyReceived ? l.quantityRejected : 0,
        rejectionReason: l.rejectionReason || '',
        observation: l.observation || 'Conforme à la pesée contradictoire',
      };
    });
    return map;
  });

  const [receptionComment, setReceptionComment] = useState<string>(
    'Procès-verbal contradictoire signé par l’économe du site.'
  );
  const [uploadDocTitle, setUploadDocTitle] = useState<string>('');
  const [uploadFileName, setUploadFileName] = useState<string>('');
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);

  // Calculs financiers de la livraison
  const totalValueShipped = delivery.lines.reduce(
    (acc, l) => acc + l.quantityDelivered * l.unitPrice,
    0
  );
  const totalValueAccepted = delivery.lines.reduce(
    (acc, l) => acc + l.quantityAccepted * l.unitPrice,
    0
  );
  const effectiveRevenue =
    delivery.status === DeliveryStatus.RECEIVED ||
    delivery.status === DeliveryStatus.PARTIALLY_RECEIVED ||
    delivery.status === DeliveryStatus.CLOSED
      ? totalValueAccepted
      : totalValueShipped;

  const directPurchaseCost = delivery.lines.reduce((acc, l) => {
    const prod = state.products.find((p) => p.id === l.productId);
    const qty =
      delivery.status === DeliveryStatus.RECEIVED ||
      delivery.status === DeliveryStatus.PARTIALLY_RECEIVED ||
      delivery.status === DeliveryStatus.CLOSED
        ? l.quantityAccepted
        : l.quantityDelivered;
    return acc + qty * (prod?.standardCost || l.unitPrice * 0.72);
  }, 0);

  const directLogisticsCost = deliveryExpenses.reduce(
    (acc, e) => acc + e.amount,
    0
  );
  const estimatedMargin =
    effectiveRevenue - (directPurchaseCost + directLogisticsCost);

  // Timeline en 6 jalons (Section 32 : Créée → Préparée → Expédiée → Réceptionnée → Facturée → Payée)
  const isPrepared = [
    DeliveryStatus.PREPARING,
    DeliveryStatus.READY,
    DeliveryStatus.DISPATCHED,
    DeliveryStatus.PARTIALLY_RECEIVED,
    DeliveryStatus.RECEIVED,
    DeliveryStatus.CLOSED,
  ].includes(delivery.status);

  const isDispatched = [
    DeliveryStatus.DISPATCHED,
    DeliveryStatus.PARTIALLY_RECEIVED,
    DeliveryStatus.RECEIVED,
    DeliveryStatus.CLOSED,
  ].includes(delivery.status);

  const isReceived = [
    DeliveryStatus.PARTIALLY_RECEIVED,
    DeliveryStatus.RECEIVED,
    DeliveryStatus.CLOSED,
  ].includes(delivery.status);

  const isInvoiced = Boolean(linkedInvoice);
  const isPaid = linkedInvoice?.status === InvoiceStatus.PAID;

  const timelineSteps = [
    { label: '1. Créée', done: true },
    { label: '2. Préparée', done: isPrepared },
    { label: '3. Expédiée', done: isDispatched },
    { label: '4. Réceptionnée', done: isReceived },
    { label: '5. Facturée', done: isInvoiced },
    { label: '6. Payée', done: isPaid },
  ];

  const handleGeneratePdf = (mode: 'DELIVERY_NOTE' | 'RECEIPT_PV') => {
    if (!contract || !customer || !destination) return;
    const tplType =
      mode === 'RECEIPT_PV' ? DocumentType.RECEIPT : DocumentType.DELIVERY_NOTE;
    const tpl =
      state.documentTemplates.find((t) => t.type === tplType) ||
      state.documentTemplates[0];
    const nextVersion =
      deliveryDocuments.filter((d) => d.documentType === tplType).length + 1;

    const { fileName, checksum } = generateDeliveryNotePdf({
      organization: state.organization,
      delivery,
      contract,
      customer,
      destination,
      products: state.products,
      template: tpl,
      version: nextVersion,
      mode,
    });

    onGenerateAndArchiveDocument({
      deliveryId: delivery.id,
      docType: tplType,
      title:
        mode === 'RECEIPT_PV'
          ? `PV de Réception Contradictoire ${delivery.reference} (v${nextVersion})`
          : `Bordereau de Livraison ${delivery.reference} (v${nextVersion} FINAL)`,
      fileName,
      checksum,
    });

    setFeedbackBanner(
      `Document ${fileName} généré, téléchargé et figé au statut FINAL (Version v${nextVersion}).`
    );
  };

  const handleSaveReceptionForm = (preset?: 'FULL' | 'REJECT_ALL') => {
    const formattedLines = delivery.lines.map((l) => {
      if (preset === 'FULL') {
        return {
          lineId: l.id,
          quantityAccepted: l.quantityDelivered,
          quantityRejected: 0,
          rejectionReason: '',
          observation: 'Réception complète sans réserve',
        };
      }
      if (preset === 'REJECT_ALL') {
        return {
          lineId: l.id,
          quantityAccepted: 0,
          quantityRejected: l.quantityDelivered,
          rejectionReason: 'Refus de livraison sur site',
          observation: 'Marchandise retournée au dépôt',
        };
      }
      const entry = receptionLines[l.id] || {
        quantityAccepted: l.quantityDelivered,
        quantityRejected: 0,
        rejectionReason: '',
        observation: '',
      };
      return {
        lineId: l.id,
        quantityAccepted: entry.quantityAccepted,
        quantityRejected: entry.quantityRejected,
        rejectionReason: entry.rejectionReason,
        observation: entry.observation,
      };
    });

    onRecordReception(delivery.id, formattedLines, receptionComment);
    setFeedbackBanner(
      'Réception enregistrée avec succès. Les quantités acceptées et le reliquat contractuel ont été mis à jour.'
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Page Détail Livraison (Section 32) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 mb-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Retour à la liste des livraisons
          </button>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold font-mono tabular-nums text-slate-900">
              Livraison #{delivery.reference}
            </h1>
            <span className="text-xs font-semibold text-slate-700">
              · Statut : {delivery.status}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Marché {contract?.reference} · {customer?.name} · Destination :{' '}
            {destination?.siteName}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleGeneratePdf('DELIVERY_NOTE')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap"
          >
            <FileDown className="h-4 w-4" />
            Bordereau PDF
          </button>

          {!isReceived && (
            <button
              type="button"
              onClick={() => setActiveTab('RECEPTION')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
            >
              <ClipboardCheck className="h-4 w-4" />
              Enregistrer Réception
            </button>
          )}

          {isReceived && !linkedInvoice && (
            <button
              type="button"
              onClick={() => {
                onCreateInvoiceFromDelivery(delivery.id);
                setActiveTab('FINANCE');
                setFeedbackBanner(
                  'Facture générée automatiquement sur la base des quantités réceptionnées et acceptées.'
                );
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 whitespace-nowrap"
            >
              <Receipt className="h-4 w-4" />
              Créer Facture correspondante
            </button>
          )}
        </div>
      </div>

      {feedbackBanner && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-900 flex items-center justify-between">
          <span>{feedbackBanner}</span>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="text-emerald-800 underline ml-4"
          >
            Fermer
          </button>
        </div>
      )}

      {/* Timeline 6 étapes (Section 32) */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
          {timelineSteps.map((st, idx) => (
            <div
              key={idx}
              className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold ${
                st.done
                  ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900'
                  : 'border-slate-200 bg-slate-50 text-slate-400'
              }`}
            >
              <CheckCircle2
                className={`h-4 w-4 shrink-0 ${
                  st.done ? 'text-emerald-600' : 'text-slate-300'
                }`}
              />
              <span className="truncate">{st.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Barre des 6 Onglets pertinents (Section 32) */}
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200">
        {[
          { id: 'RESUME', label: 'Résumé' },
          { id: 'PRODUITS', label: `Produits (${delivery.lines.length})` },
          { id: 'DOCUMENTS', label: `Documents (${deliveryDocuments.length})` },
          { id: 'RECEPTION', label: 'Réception & Réserves' },
          { id: 'FINANCE', label: 'Finance & Marge' },
          { id: 'HISTORIQUE', label: 'Historique & Audit' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ONGLET 1 : RÉSUMÉ */}
      {activeTab === 'RESUME' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-lg border border-slate-200 bg-white p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">
              Informations Générales du Dossier de Livraison
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
              <div>
                <p className="text-slate-500">Organisme Client</p>
                <p className="font-semibold text-slate-900 mt-0.5">
                  {customer?.name}
                </p>
                <p className="text-slate-500">
                  Contact : {customer?.primaryContactName} (
                  {customer?.primaryContactPhone})
                </p>
              </div>
              <div>
                <p className="text-slate-500">Marché / Contrat de rattachement</p>
                <p className="font-mono font-semibold text-slate-900 mt-0.5">
                  {contract?.reference}
                </p>
                <p className="text-slate-600">{contract?.title}</p>
              </div>
              <div>
                <p className="text-slate-500">Destination de livraison</p>
                <p className="font-semibold text-slate-900 mt-0.5">
                  {destination?.siteName}
                </p>
                <p className="text-slate-600">
                  {destination?.addressLine} — {destination?.city}
                </p>
                <p className="text-slate-500">
                  Horaires configurés : {destination?.receivingHours}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Logistique & Flotte</p>
                <p className="font-semibold text-slate-900 mt-0.5">
                  Chauffeur : {delivery.driverName}
                </p>
                <p className="font-mono text-slate-700">
                  Véhicule : {delivery.vehiclePlate}
                </p>
                <p className="text-slate-500">
                  Coordinateur : {delivery.responsibleUser}
                </p>
              </div>
            </div>

            {delivery.notes && (
              <div className="rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                <span className="font-semibold text-slate-900">
                  Note d’exploitation :{' '}
                </span>
                {delivery.notes}
              </div>
            )}

            {/* Actions rapides de changement de statut logistique */}
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4">
              <span className="text-xs font-medium text-slate-600 mr-2">
                Avancement opérationnel :
              </span>
              {delivery.status === DeliveryStatus.PLANNED && (
                <button
                  type="button"
                  onClick={() =>
                    onUpdateStatus(
                      delivery.id,
                      DeliveryStatus.PREPARING,
                      'Mise en préparation à l’entrepôt'
                    )
                  }
                  className="rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  Passer en Préparation
                </button>
              )}
              {(delivery.status === DeliveryStatus.PREPARING ||
                delivery.status === DeliveryStatus.PLANNED) && (
                <button
                  type="button"
                  onClick={() =>
                    onUpdateStatus(
                      delivery.id,
                      DeliveryStatus.READY,
                      'Marchandise pesée et prête sur quai'
                    )
                  }
                  className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Marquer Prête à expédier
                </button>
              )}
              {delivery.status === DeliveryStatus.READY && (
                <button
                  type="button"
                  onClick={() =>
                    onUpdateStatus(
                      delivery.id,
                      DeliveryStatus.DISPATCHED,
                      'Départ camion confirmé avec bordereau'
                    )
                  }
                  className="rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  Confirmer Départ Camion (Expédiée)
                </button>
              )}
              <button
                type="button"
                onClick={() => setActiveTab('RECEPTION')}
                className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
              >
                Saisir / Modifier le PV de Réception →
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4 text-xs">
            <h2 className="text-sm font-semibold text-slate-900">
              Synthèse Valorisée du Dossier
            </h2>
            <div className="space-y-2.5 border-b border-slate-200 pb-4">
              <div className="flex justify-between">
                <span className="text-slate-500">Valeur expédiée (BL) :</span>
                <span className="font-mono tabular-nums font-semibold text-slate-900">
                  {formatFcfa(totalValueShipped)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">
                  Valeur acceptée (Réception) :
                </span>
                <span className="font-mono tabular-nums font-bold text-emerald-700">
                  {isReceived
                    ? formatFcfa(totalValueAccepted)
                    : 'En attente de réception'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Facture rattachée :</span>
                <span className="font-mono tabular-nums font-semibold text-slate-900">
                  {linkedInvoice ? linkedInvoice.reference : 'Non émise'}
                </span>
              </div>
            </div>
            <div>
              <p className="font-semibold text-slate-800 mb-1.5">
                Exigences documentaires du site :
              </p>
              <ul className="list-disc list-inside text-slate-600 space-y-1">
                {(destination?.requiredDocTypes || []).map((d, idx) => (
                  <li key={idx}>{d}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ONGLET 2 : PRODUITS & CONTRÔLE DES QUANTITÉS */}
      {activeTab === 'PRODUITS' && (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-900">
              Détail des Lignes Livrées, Acceptées, Refusées & Reliquat Contrat
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
                  <th className="py-3 px-4">Denrée</th>
                  <th className="py-3 px-4">Lot</th>
                  <th className="py-3 px-4 text-right">Qté Expédiée</th>
                  <th className="py-3 px-4 text-right">Qté Acceptée</th>
                  <th className="py-3 px-4 text-right">Qté Refusée</th>
                  <th className="py-3 px-4 text-right">Prix Unitaire</th>
                  <th className="py-3 px-4 text-right">Montant Accepté</th>
                  <th className="py-3 px-4 text-right">Reliquat Contrat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {delivery.lines.map((line) => {
                  const prod = state.products.find(
                    (p) => p.id === line.productId
                  );
                  const cline = contract?.lines.find(
                    (cl) => cl.id === line.contractLineId
                  );
                  const metrics = cline
                    ? calculateContractLineMetrics(cline, state.deliveries)
                    : null;

                  return (
                    <tr key={line.id}>
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-slate-900">
                          {prod?.name}
                        </p>
                        <p className="text-slate-500">{prod?.reference}</p>
                        {(line.rejectionReason || line.observation) && (
                          <p className="mt-1 text-[11px] text-amber-800">
                            {line.rejectionReason
                              ? `Réserve : ${line.rejectionReason} · `
                              : ''}
                            {line.observation}
                          </p>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-700">
                        {line.lotNumber}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                        {formatQty(line.quantityDelivered, line.unit)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold text-emerald-700">
                        {formatQty(line.quantityAccepted, line.unit)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-red-700">
                        {formatQty(line.quantityRejected, line.unit)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700">
                        {formatFcfa(line.unitPrice)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                        {formatFcfa(
                          (isReceived
                            ? line.quantityAccepted
                            : line.quantityDelivered) * line.unitPrice
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700">
                        {metrics
                          ? formatQty(metrics.remainingQuantity, line.unit)
                          : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ONGLET 3 : DOCUMENTS & BORDEREAUX VERSIONNÉS (SECTION 15, 16, 18) */}
      {activeTab === 'DOCUMENTS' && (
        <div className="space-y-6">
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Bordereaux Générés & Preuves Documentaires Associées
                </h2>
                <p className="text-xs text-slate-500">
                  Tout document au statut FINAL est verrouillé. Une nouvelle génération incrémente automatiquement la version.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleGeneratePdf('DELIVERY_NOTE')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  <FileDown className="h-4 w-4" />
                  Générer Nouvelle Version BL (PDF)
                </button>
                <button
                  type="button"
                  onClick={() => handleGeneratePdf('RECEIPT_PV')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                >
                  <FileDown className="h-4 w-4" />
                  Générer PV Réception (PDF)
                </button>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
                    <th className="py-2.5 px-4">Intitulé & Fichier</th>
                    <th className="py-2.5 px-4">Type</th>
                    <th className="py-2.5 px-4">Version & Statut</th>
                    <th className="py-2.5 px-4">Empreinte d’intégrité</th>
                    <th className="py-2.5 px-4">Auteur & Date</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {deliveryDocuments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-500">
                        Aucun document archivé pour cette livraison. Cliquez sur « Générer Nouvelle Version BL (PDF) ».
                      </td>
                    </tr>
                  ) : (
                    deliveryDocuments.map((doc) => (
                      <tr key={doc.id}>
                        <td className="py-3 px-4">
                          <p className="font-semibold text-slate-900">
                            {doc.title}
                          </p>
                          <p className="font-mono text-slate-500">
                            {doc.fileName}
                          </p>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-700">
                          {doc.documentType}
                        </td>
                        <td className="py-3 px-4 font-mono">
                          v{doc.version} ·{' '}
                          <span className="font-semibold text-emerald-700">
                            {doc.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                          {doc.checksum}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {doc.uploadedBy} · {doc.createdAt}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              handleGeneratePdf(
                                doc.documentType === DocumentType.RECEIPT
                                  ? 'RECEIPT_PV'
                                  : 'DELIVERY_NOTE'
                              )
                            }
                            className="font-semibold text-slate-900 hover:underline"
                          >
                            Télécharger PDF
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Upload / Archivage d'une preuve signée scannée */}
          <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900">
              Archiver un Justificatif Signé (Bordereau scanné, Bon de pesée, Certificat qualité)
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <input
                type="text"
                placeholder="Intitulé du justificatif (ex: Scan BL signé avec cachet Économe)"
                value={uploadDocTitle}
                onChange={(e) => setUploadDocTitle(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
              />
              <input
                type="text"
                placeholder="Nom du fichier (ex: Scan_BL_Signe_Site.pdf)"
                value={uploadFileName}
                onChange={(e) => setUploadFileName(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900"
              />
              <button
                type="button"
                onClick={() => {
                  const title =
                    uploadDocTitle.trim() ||
                    `Preuve de réception signée — ${delivery.reference}`;
                  const file =
                    uploadFileName.trim() ||
                    `Preuve_${delivery.reference}_Signee.pdf`;
                  onGenerateAndArchiveDocument({
                    deliveryId: delivery.id,
                    docType: DocumentType.RECEIPT,
                    title,
                    fileName: file,
                    checksum: `SHA256-UPLOAD:${Date.now().toString(16).toUpperCase()}`,
                  });
                  setUploadDocTitle('');
                  setUploadFileName('');
                  setFeedbackBanner(
                    `Justificatif "${title}" archivé dans le dossier de livraison.`
                  );
                }}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                <Upload className="h-4 w-4" />
                Archiver la pièce au dossier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ONGLET 4 : RÉCEPTION COMPLÈTE / PARTIELLE / REFUSÉE (SECTION 14) */}
      {activeTab === 'RECEPTION' && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Enregistrement Contradictoire de la Réception sur Site
              </h2>
              <p className="text-xs text-slate-500">
                Règle 3 : Ne jamais considérer automatiquement la quantité expédiée comme acceptée. Saisissez les quantités réellement acceptées et refusées par ligne.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleSaveReceptionForm('FULL')}
                className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-100"
              >
                Tout accepter sans réserve (100%)
              </button>
              <button
                type="button"
                onClick={() => handleSaveReceptionForm('REJECT_ALL')}
                className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-900 hover:bg-red-100"
              >
                Refus total de livraison
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
                  <th className="py-3 px-4">Denrée & Lot</th>
                  <th className="py-3 px-4 text-right">Qté Expédiée</th>
                  <th className="py-3 px-4 text-right w-36">Qté Acceptée</th>
                  <th className="py-3 px-4 text-right w-36">Qté Refusée</th>
                  <th className="py-3 px-4">Motif de refus / Réserve</th>
                  <th className="py-3 px-4">Observation PV</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {delivery.lines.map((line) => {
                  const prod = state.products.find(
                    (p) => p.id === line.productId
                  );
                  const rowState = receptionLines[line.id] || {
                    quantityAccepted: line.quantityDelivered,
                    quantityRejected: 0,
                    rejectionReason: '',
                    observation: '',
                  };

                  return (
                    <tr key={line.id}>
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-900">
                          {prod?.name}
                        </p>
                        <p className="font-mono text-slate-500">
                          Lot : {line.lotNumber} ({line.unit})
                        </p>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                        {formatQty(line.quantityDelivered, line.unit)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <input
                          type="number"
                          min={0}
                          max={line.quantityDelivered}
                          value={rowState.quantityAccepted}
                          onChange={(e) => {
                            const acc = Math.min(
                              line.quantityDelivered,
                              Math.max(0, Number(e.target.value))
                            );
                            const rej = Math.max(
                              0,
                              Number((line.quantityDelivered - acc).toFixed(3))
                            );
                            setReceptionLines((prev) => ({
                              ...prev,
                              [line.id]: {
                                ...rowState,
                                quantityAccepted: acc,
                                quantityRejected: rej,
                              },
                            }));
                          }}
                          className="w-28 rounded border border-slate-300 px-2 py-1.5 text-right font-mono tabular-nums font-semibold text-emerald-800"
                        />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <input
                          type="number"
                          readOnly
                          value={rowState.quantityRejected}
                          className={`w-28 rounded border px-2 py-1.5 text-right font-mono tabular-nums font-semibold ${
                            rowState.quantityRejected > 0
                              ? 'border-red-300 bg-red-50 text-red-800'
                              : 'border-slate-200 bg-slate-50 text-slate-500'
                          }`}
                        />
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          placeholder={
                            rowState.quantityRejected > 0
                              ? 'Motif obligatoire (ex: Sacs percés)'
                              : 'Aucune réserve'
                          }
                          value={rowState.rejectionReason}
                          onChange={(e) =>
                            setReceptionLines((prev) => ({
                              ...prev,
                              [line.id]: {
                                ...rowState,
                                rejectionReason: e.target.value,
                              },
                            }))
                          }
                          className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs text-slate-900"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          value={rowState.observation}
                          onChange={(e) =>
                            setReceptionLines((prev) => ({
                              ...prev,
                              [line.id]: {
                                ...rowState,
                                observation: e.target.value,
                              },
                            }))
                          }
                          className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs text-slate-900"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-slate-200 pt-4">
            <input
              type="text"
              value={receptionComment}
              onChange={(e) => setReceptionComment(e.target.value)}
              placeholder="Observation générale de réception..."
              className="w-full sm:max-w-md rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
            />
            <button
              type="button"
              onClick={() => handleSaveReceptionForm()}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
            >
              <CheckCircle2 className="h-4 w-4" />
              Valider le Procès-Verbal de Réception
            </button>
          </div>
        </div>
      )}

      {/* ONGLET 5 : FINANCE, FACTURATION LIÉE & MARGE SUR COÛTS DIRECTS */}
      {activeTab === 'FINANCE' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">
              Facturation & Créance Associée à la Livraison
            </h2>
            {linkedInvoice ? (
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500">N° Facture :</span>
                  <span className="font-mono font-bold text-slate-900">
                    {linkedInvoice.reference}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500">Statut & Échéance :</span>
                  <span className="font-semibold text-slate-800">
                    {linkedInvoice.status} · Échéance {linkedInvoice.dueDate}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500">Montant Facturé TTC :</span>
                  <span className="font-mono tabular-nums font-bold text-slate-900">
                    {formatFcfa(linkedInvoice.totalAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500">Montant Encaissé :</span>
                  <span className="font-mono tabular-nums font-semibold text-emerald-700">
                    {formatFcfa(linkedInvoice.paidAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Solde restant dû :</span>
                  <span className="font-mono tabular-nums font-bold text-slate-900">
                    {formatFcfa(linkedInvoice.remainingAmount)}
                  </span>
                </div>

                {linkedInvoice.remainingAmount > 0 && (
                  <div className="pt-3">
                    <button
                      type="button"
                      onClick={() => onOpenPaymentModal(linkedInvoice.id)}
                      className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                    >
                      Enregistrer un règlement sur cette facture
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3 text-xs text-slate-600">
                <p>
                  Aucune facture n’a encore été générée pour le bordereau{' '}
                  <strong className="font-mono text-slate-900">
                    {delivery.reference}
                  </strong>
                  .
                </p>
                <p>
                  Montant facturable sur quantités acceptées :{' '}
                  <strong className="font-mono tabular-nums text-slate-900">
                    {formatFcfa(
                      isReceived ? totalValueAccepted : totalValueShipped
                    )}
                  </strong>
                </p>
                <button
                  type="button"
                  onClick={() => onCreateInvoiceFromDelivery(delivery.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  <Receipt className="h-4 w-4" />
                  Générer la Facture Définitive
                </button>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">
              Rentabilité de la Livraison (Marge sur Coûts Directs — Section 23)
            </h2>
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">
                  Valeur de la livraison (CA) :
                </span>
                <span className="font-mono tabular-nums font-semibold text-slate-900">
                  {formatFcfa(effectiveRevenue)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">
                  Coût d’achat des denrées livrées :
                </span>
                <span className="font-mono tabular-nums text-slate-700">
                  - {formatFcfa(directPurchaseCost)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">
                  Frais logistiques directs affectés ({deliveryExpenses.length}) :
                </span>
                <span className="font-mono tabular-nums text-slate-700">
                  - {formatFcfa(directLogisticsCost)}
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2.5 font-bold text-slate-900">
                <span>Marge sur coûts directs estimée :</span>
                <span className="font-mono tabular-nums text-emerald-700">
                  {formatFcfa(estimatedMargin)} (
                  {effectiveRevenue > 0
                    ? Math.round((estimatedMargin / effectiveRevenue) * 100)
                    : 0}
                  %)
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ONGLET 6 : HISTORIQUE & TRACE D'AUDIT */}
      {activeTab === 'HISTORIQUE' && (
        <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">
            Historique Chronologique & Journal d’Audit de la Livraison
          </h2>
          <div className="divide-y divide-slate-200 text-xs">
            {delivery.statusHistory.map((item) => (
              <div key={item.id} className="py-3 flex items-start justify-between">
                <div>
                  <p className="font-semibold text-slate-900">
                    Statut : {item.status} · Par {item.changedBy}
                  </p>
                  <p className="text-slate-600 mt-0.5">{item.comment}</p>
                </div>
                <span className="font-mono tabular-nums text-slate-500">
                  {item.changedAt}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
