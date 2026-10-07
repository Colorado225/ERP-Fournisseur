import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  FileDown,
  Lock,
  PackageCheck,
  ShieldAlert,
  Truck,
} from 'lucide-react';
import {
  ContractStatus,
  Delivery,
  DeliveryLine,
  DeliveryStatus,
  DocumentType,
  ErpState,
  RoleName,
} from '../shared/types';
import {
  calculateContractLineMetrics,
  calculateProductStockFromMovements,
  formatFcfa,
  formatQty,
  validateDeliveryQuantitiesAgainstContract,
} from '../shared/domainEngine';
import { generateDeliveryNotePdf } from '../shared/pdfGenerator';

interface NewDeliveryWizardProps {
  state: ErpState;
  onCancel: () => void;
  onCreateDelivery: (payload: {
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
  }) => Delivery;
}

export const NewDeliveryWizard: React.FC<NewDeliveryWizardProps> = ({
  state,
  onCancel,
  onCreateDelivery,
}) => {
  const currentUser =
    state.users.find((u) => u.id === state.currentUserId) || state.users[0];

  const activeContracts = state.contracts.filter(
    (c) => c.status === ContractStatus.ACTIVE
  );

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [selectedContractId, setSelectedContractId] = useState<string>(
    activeContracts[0]?.id || ''
  );

  const selectedContract = state.contracts.find(
    (c) => c.id === selectedContractId
  );
  const selectedCustomer = state.customers.find(
    (c) => c.id === selectedContract?.customerId
  );
  const contractOrders = state.orders.filter(
    (o) => o.contractId === selectedContractId
  );

  const [selectedOrderId, setSelectedOrderId] = useState<string>(
    contractOrders[0]?.id || ''
  );
  const [selectedDestinationId, setSelectedDestinationId] = useState<string>(
    selectedCustomer?.destinations[0]?.id || ''
  );
  const [plannedDate, setPlannedDate] = useState<string>('2026-10-08');
  const [driverName, setDriverName] = useState<string>('Kouassi Yao Bernard');
  const [vehiclePlate, setVehiclePlate] = useState<string>('4821-KJ-01');
  const [responsibleUser, setResponsibleUser] = useState<string>(
    currentUser.name
  );
  const [notes, setNotes] = useState<string>(
    'Livraison planifiée selon appel de commande institutionnel.'
  );
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    state.documentTemplates.find((t) => t.type === DocumentType.DELIVERY_NOTE)
      ?.id || state.documentTemplates[0].id
  );
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Quantités saisies par ligne contractuelle et lots sélectionnés
  const [lineQuantities, setLineQuantities] = useState<Record<string, number>>(
    () => {
      const initial: Record<string, number> = {};
      if (activeContracts[0]) {
        activeContracts[0].lines.forEach((l, idx) => {
          initial[l.id] = idx === 0 ? 1500 : 500;
        });
      }
      return initial;
    }
  );

  const [lineLots, setLineLots] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    if (activeContracts[0]) {
      activeContracts[0].lines.forEach((l) => {
        const matchingLot = state.stockLots.find(
          (lot) => lot.productId === l.productId
        );
        initial[l.id] = matchingLot?.lotNumber || 'LOT-STD-2026';
      });
    }
    return initial;
  });

  // Changement de contrat : réinitialiser commande, destination, quantités et lots
  const handleContractChange = (newContractId: string) => {
    setSelectedContractId(newContractId);
    const ctr = state.contracts.find((c) => c.id === newContractId);
    const cust = state.customers.find((c) => c.id === ctr?.customerId);
    const ords = state.orders.filter((o) => o.contractId === newContractId);
    setSelectedOrderId(ords[0]?.id || '');
    setSelectedDestinationId(cust?.destinations[0]?.id || '');
    setValidationError(null);

    if (ctr) {
      const nextQ: Record<string, number> = {};
      const nextL: Record<string, string> = {};
      ctr.lines.forEach((l, idx) => {
        nextQ[l.id] = idx === 0 ? 1000 : 0;
        const lot = state.stockLots.find((lt) => lt.productId === l.productId);
        nextL[l.id] = lot?.lotNumber || 'LOT-STD-2026';
      });
      setLineQuantities(nextQ);
      setLineLots(nextL);
    }
  };

  const activeLinesForDelivery = (selectedContract?.lines || [])
    .map((cline) => ({
      contractLine: cline,
      product: state.products.find((p) => p.id === cline.productId),
      quantityDelivered: Number(lineQuantities[cline.id] || 0),
      lotNumber: lineLots[cline.id] || 'LOT-STD-2026',
    }))
    .filter((item) => item.quantityDelivered > 0);

  const quotaValidation = selectedContract
    ? validateDeliveryQuantitiesAgainstContract({
        contract: selectedContract,
        deliveries: state.deliveries,
        products: state.products,
        proposedLines: activeLinesForDelivery.map((a) => ({
          contractLineId: a.contractLine.id,
          productId: a.contractLine.productId,
          quantityDelivered: a.quantityDelivered,
        })),
        userRole: currentUser.role,
        overrideReason,
      })
    : { valid: false, error: 'Contrat requis', warnings: [] };

  const totalDeliveryAmount = activeLinesForDelivery.reduce(
    (acc, item) => acc + item.quantityDelivered * item.contractLine.unitPrice,
    0
  );

  const selectedDestination = selectedCustomer?.destinations.find(
    (d) => d.id === selectedDestinationId
  );

  const selectedTemplate =
    state.documentTemplates.find((t) => t.id === selectedTemplateId) ||
    state.documentTemplates[0];

  const handleNextStep = () => {
    setValidationError(null);
    if (step === 1) {
      if (!selectedContractId || !selectedDestinationId || !plannedDate) {
        setValidationError(
          'Veuillez sélectionner un contrat actif, une destination de livraison et une date prévue.'
        );
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (activeLinesForDelivery.length === 0) {
        setValidationError(
          'Veuillez saisir une quantité strictement supérieure à 0 sur au moins une denrée du contrat.'
        );
        return;
      }
      if (!quotaValidation.valid) {
        setValidationError(
          quotaValidation.error || 'Dépassement de reliquat contractuel détecté.'
        );
        return;
      }
      setStep(3);
    } else if (step === 3) {
      setStep(4);
    } else if (step === 4) {
      setStep(5);
    }
  };

  const handlePreviewPdfOnly = () => {
    setShowPreviewModal(true);
  };

  const handleDownloadDraftPdf = () => {
    if (!selectedContract || !selectedCustomer || !selectedDestination) return;
    const tempDelivery: Delivery = {
      id: 'temp-preview',
      organizationId: state.organization.id,
      reference: `BL-2026-${String((state.sequences.BL || 128) + 1).padStart(
        6,
        '0'
      )}`,
      contractId: selectedContract.id,
      orderId: selectedOrderId,
      destinationId: selectedDestination.id,
      plannedDate,
      status: DeliveryStatus.READY,
      driverName,
      vehiclePlate,
      responsibleUser,
      notes,
      lines: activeLinesForDelivery.map((a, idx) => ({
        id: `tmp-${idx}`,
        deliveryId: 'temp-preview',
        contractLineId: a.contractLine.id,
        productId: a.contractLine.productId,
        lotNumber: a.lotNumber,
        unit: a.contractLine.unit,
        quantityPlanned: a.quantityDelivered,
        quantityDelivered: a.quantityDelivered,
        quantityAccepted: 0,
        quantityRejected: 0,
        unitPrice: a.contractLine.unitPrice,
      })),
      statusHistory: [],
    };

    generateDeliveryNotePdf({
      organization: state.organization,
      delivery: tempDelivery,
      contract: selectedContract,
      customer: selectedCustomer,
      destination: selectedDestination,
      products: state.products,
      template: selectedTemplate,
      version: 1,
      mode: 'DELIVERY_NOTE',
    });
  };

  const handleValidateAndFinalize = (generatePdf: boolean) => {
    if (!quotaValidation.valid) {
      setValidationError(
        quotaValidation.error || 'Dépassement de reliquat non autorisé.'
      );
      return;
    }

    const created = onCreateDelivery({
      contractId: selectedContractId,
      orderId: selectedOrderId,
      destinationId: selectedDestinationId,
      plannedDate,
      driverName,
      vehiclePlate,
      responsibleUser,
      overrideReason: overrideReason.trim() || undefined,
      notes,
      lines: activeLinesForDelivery.map((a) => ({
        contractLineId: a.contractLine.id,
        productId: a.contractLine.productId,
        lotNumber: a.lotNumber,
        quantityDelivered: a.quantityDelivered,
      })),
      generateInitialPdf: generatePdf,
    });

    if (
      generatePdf &&
      selectedContract &&
      selectedCustomer &&
      selectedDestination
    ) {
      generateDeliveryNotePdf({
        organization: state.organization,
        delivery: created,
        contract: selectedContract,
        customer: selectedCustomer,
        destination: selectedDestination,
        products: state.products,
        template: selectedTemplate,
        version: 1,
        mode: 'DELIVERY_NOTE',
      });
    }
  };

  const canUserOverride =
    currentUser.role === RoleName.OWNER ||
    currentUser.role === RoleName.ADMIN ||
    currentUser.role === RoleName.MANAGER;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
        <div>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 mb-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Retour aux livraisons
          </button>
          <h1 className="text-xl font-bold text-slate-900">
            Nouvelle Livraison Institutionnelle (Contrôle Quantités & Bordereau)
          </h1>
          <p className="text-xs text-slate-500">
            Processus en 5 étapes avec vérification temps réel des reliquats contractuels, allocation des lots et génération du bordereau PDF.
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">Prochain N° séquentiel réservé</p>
          <p className="font-mono tabular-nums text-sm font-bold text-slate-900">
            BL-2026-{String((state.sequences.BL || 128) + 1).padStart(6, '0')}
          </p>
        </div>
      </div>

      {/* Stepper 5 étapes */}
      <div className="grid grid-cols-5 gap-2 rounded-lg border border-slate-200 bg-white p-3">
        {[
          { num: 1, label: '01. Contrat & Site' },
          { num: 2, label: '02. Produits & Reliquats' },
          { num: 3, label: '03. Préparation & Lots' },
          { num: 4, label: '04. Vérification' },
          { num: 5, label: '05. Bordereau PDF' },
        ].map((item) => {
          const isActive = step === item.num;
          const isDone = step > item.num;
          return (
            <button
              key={item.num}
              type="button"
              onClick={() => {
                if (item.num < step) setStep(item.num as 1 | 2 | 3 | 4 | 5);
              }}
              className={`flex items-center justify-center rounded-md py-2 px-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-slate-900 text-white'
                  : isDone
                  ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                  : 'bg-slate-50 text-slate-500'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Message d'erreur métier compréhensible (Section 38) */}
      {validationError && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-700 shrink-0 mt-0.5" />
          <div className="text-xs text-red-900">
            <p className="font-bold">Contrôle métier bloquant</p>
            <p className="mt-1">{validationError}</p>
          </div>
        </div>
      )}

      {/* ÉTAPE 1 : SÉLECTION CONTRAT, COMMANDE, DESTINATION, DATE */}
      {step === 1 && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-6">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Étape 1 — Sélectionner le Contrat, la Commande et la Destination
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Règle 1 : Toute livraison doit être rattachée à un marché actif et à un site de réception identifié.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Marché / Contrat Actif *
              </label>
              <select
                value={selectedContractId}
                onChange={(e) => handleContractChange(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
              >
                {activeContracts.map((c) => {
                  const cust = state.customers.find(
                    (cu) => cu.id === c.customerId
                  );
                  return (
                    <option key={c.id} value={c.id}>
                      {c.reference} — {c.title} ({cust?.code})
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Bon de Commande Client Associé *
              </label>
              <select
                value={selectedOrderId}
                onChange={(e) => setSelectedOrderId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
              >
                {contractOrders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.reference} — Demandé pour le {o.requestedDate} (
                    {formatFcfa(o.totalAmount)})
                  </option>
                ))}
                <option value="ORD-DIRECT-CALL">
                  Appel de livraison direct sur marché cadre
                </option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Site / Destination de Livraison *
              </label>
              <select
                value={selectedDestinationId}
                onChange={(e) => setSelectedDestinationId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
              >
                {(selectedCustomer?.destinations || []).map((dest) => (
                  <option key={dest.id} value={dest.id}>
                    {dest.siteName} — {dest.city}
                  </option>
                ))}
              </select>
              {selectedDestination && (
                <p className="mt-1.5 text-xs text-slate-500">
                  Horaires configurés : {selectedDestination.receivingHours} · Contact :{' '}
                  {selectedDestination.contactPerson}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Date Prévue de Livraison *
              </label>
              <input
                type="date"
                value={plannedDate}
                onChange={(e) => setPlannedDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono tabular-nums text-slate-900 focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Chauffeur / Convoyeur *
              </label>
              <input
                type="text"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Immatriculation Véhicule *
              </label>
              <input
                type="text"
                value={vehiclePlate}
                onChange={(e) => setVehiclePlate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono tabular-nums text-slate-900 focus:border-slate-900 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={handleNextStep}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Continuer vers les quantités contractuelles
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ÉTAPE 2 : AJOUT DES PRODUITS & CONTRÔLE DES QUANTITÉS RESTANTES (SECTION 13 & 31) */}
      {step === 2 && selectedContract && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Étape 2 — Contrôle des Quantités Contractuelles, Livrées et Restantes
              </h2>
              <p className="text-xs text-slate-500">
                Formule stricte : Restant autorisé = Quantité contractuelle − Quantité livrée acceptée.
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500">Valorisation de cette livraison : </span>
              <span className="font-mono tabular-nums text-sm font-bold text-slate-900">
                {formatFcfa(totalDeliveryAmount)}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700">
                  <th className="py-3 px-4">Denrée / Produit</th>
                  <th className="py-3 px-4 text-right">Contractuel</th>
                  <th className="py-3 px-4 text-right">Déjà livré (Accepté)</th>
                  <th className="py-3 px-4 text-right">En transit</th>
                  <th className="py-3 px-4 text-right">Reliquat autorisé</th>
                  <th className="py-3 px-4 text-right w-44">Cette livraison</th>
                  <th className="py-3 px-4 text-right">Restant après livraison</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {selectedContract.lines.map((cline) => {
                  const product = state.products.find(
                    (p) => p.id === cline.productId
                  );
                  const metrics = calculateContractLineMetrics(
                    cline,
                    state.deliveries
                  );
                  const currentInput = Number(lineQuantities[cline.id] || 0);
                  const remainingAfterThis =
                    metrics.remainingQuantity - currentInput;
                  const isExceeding = remainingAfterThis < 0;

                  return (
                    <tr
                      key={cline.id}
                      className={isExceeding ? 'bg-red-50/60' : 'hover:bg-slate-50'}
                    >
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-slate-900">
                          {product?.name}
                        </p>
                        <p className="text-slate-500">
                          {product?.reference} · Prix contrat :{' '}
                          <span className="font-mono tabular-nums">
                            {formatFcfa(cline.unitPrice)} / {cline.unit}
                          </span>
                        </p>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-800">
                        {formatQty(metrics.contractQuantity, cline.unit)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-emerald-700 font-medium">
                        {formatQty(metrics.acceptedDeliveredQuantity, cline.unit)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-500">
                        {formatQty(metrics.inTransitQuantity, cline.unit)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                        {formatQty(metrics.remainingQuantity, cline.unit)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <input
                            type="number"
                            min={0}
                            step={50}
                            value={currentInput}
                            onChange={(e) => {
                              const val = Math.max(0, Number(e.target.value));
                              setLineQuantities((prev) => ({
                                ...prev,
                                [cline.id]: val,
                              }));
                              setValidationError(null);
                            }}
                            className={`w-28 rounded border px-2.5 py-1.5 text-right font-mono tabular-nums font-semibold focus:outline-none ${
                              isExceeding
                                ? 'border-red-500 bg-white text-red-700'
                                : 'border-slate-300 bg-white text-slate-900 focus:border-slate-900'
                            }`}
                          />
                          <span className="text-slate-500 font-mono">
                            {cline.unit}
                          </span>
                        </div>
                      </td>
                      <td
                        className={`py-3.5 px-4 text-right font-mono tabular-nums font-bold ${
                          isExceeding ? 'text-red-700' : 'text-slate-900'
                        }`}
                      >
                        {formatQty(remainingAfterThis, cline.unit)}
                        {isExceeding && (
                          <span className="block text-[11px] font-normal text-red-700">
                            Dépassement de {formatQty(Math.abs(remainingAfterThis), cline.unit)}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Zone de dérogation contractuelle si un dépassement est détecté */}
          {!quotaValidation.valid && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 space-y-3">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="h-5 w-5 text-amber-800 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-950">
                  <p className="font-semibold">
                    Règle 2 : Dépassement du reliquat contractuel détecté
                  </p>
                  <p className="mt-0.5">{quotaValidation.error}</p>
                </div>
              </div>

              {canUserOverride ? (
                <div className="pt-2 border-t border-amber-200">
                  <label className="block text-xs font-semibold text-amber-950 mb-1">
                    Dérogation exceptionnelle sur Avenant / Autorisation Direction ({currentUser.role}) :
                  </label>
                  <input
                    type="text"
                    placeholder="Saisir la référence de l'avenant ou le motif formel (min. 5 caractères) pour débloquer..."
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    className="w-full rounded border border-amber-400 bg-white px-3 py-1.5 text-xs text-slate-900"
                  />
                </div>
              ) : (
                <p className="text-xs font-medium text-red-800">
                  Votre rôle ({currentUser.roleLabel}) ne dispose pas de la permission{' '}
                  <code className="font-mono">deliveries:override_quota</code>. Veuillez ajuster la quantité au reliquat disponible.
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              ← Étape précédente
            </button>
            <button
              type="button"
              onClick={handleNextStep}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Continuer vers la préparation & lots
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ÉTAPE 3 : PRÉPARATION, LOTS & STOCK DISPONIBLE */}
      {step === 3 && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-6">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Étape 3 — Préparation Entrepôt, Allocation des Lots (FEFO) & Contrôle Stock
            </h2>
            <p className="text-xs text-slate-500">
              Chaque ligne de livraison est associée à un lot traçable avec vérification du stock reconstruit depuis les mouvements.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700">
                  <th className="py-3 px-4">Denrée</th>
                  <th className="py-3 px-4">Conditionnement & Conversion</th>
                  <th className="py-3 px-4 text-right">Stock Courant</th>
                  <th className="py-3 px-4 text-right">Quantité Préparée</th>
                  <th className="py-3 px-4">Lot Affecté (Traçabilité)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {activeLinesForDelivery.map((item) => {
                  const availableStock = calculateProductStockFromMovements(
                    item.contractLine.productId,
                    state.stockMovements
                  );
                  const productLots = state.stockLots.filter(
                    (l) => l.productId === item.contractLine.productId
                  );

                  return (
                    <tr key={item.contractLine.id}>
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        {item.product?.name}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        <p>{item.product?.packaging}</p>
                        <p className="text-slate-400">
                          {item.product?.conversionRuleLabel}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-800">
                        {formatQty(availableStock, item.contractLine.unit)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                        {formatQty(item.quantityDelivered, item.contractLine.unit)}
                      </td>
                      <td className="py-3.5 px-4">
                        <select
                          value={item.lotNumber}
                          onChange={(e) =>
                            setLineLots((prev) => ({
                              ...prev,
                              [item.contractLine.id]: e.target.value,
                            }))
                          }
                          className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono text-slate-900"
                        >
                          {productLots.map((lt) => (
                            <option key={lt.id} value={lt.lotNumber}>
                              {lt.lotNumber} (Exp: {lt.expiryDate})
                            </option>
                          ))}
                          <option value="LOT-REASSORT-2026">
                            LOT-REASSORT-2026 (Nouvel arrivage)
                          </option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              ← Modifier les quantités
            </button>
            <button
              type="button"
              onClick={handleNextStep}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Continuer vers la vérification
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ÉTAPE 4 : VÉRIFICATION COMPLÈTE */}
      {step === 4 && selectedContract && selectedCustomer && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-6">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Étape 4 — Vérification Avant Validation & Émission du Bordereau
            </h2>
            <p className="text-xs text-slate-500">
              Contrôlez le récapitulatif des produits, quantités, valorisation, destination et pièces requises.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 text-xs space-y-1.5">
              <p className="font-semibold text-slate-900">Contrat & Client</p>
              <p className="text-slate-700">{selectedCustomer.name}</p>
              <p className="font-mono text-slate-600">
                Marché : {selectedContract.reference}
              </p>
              <p className="text-slate-500">Date prévue : {plannedDate}</p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 text-xs space-y-1.5">
              <p className="font-semibold text-slate-900">
                Destination & Logistique
              </p>
              <p className="text-slate-700">{selectedDestination?.siteName}</p>
              <p className="text-slate-600">
                Chauffeur : {driverName} · Véhicule :{' '}
                <span className="font-mono">{vehiclePlate}</span>
              </p>
              <p className="text-slate-500">
                Responsable : {responsibleUser}
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 text-xs space-y-1.5">
              <p className="font-semibold text-slate-900">
                Pièces Documentaires Configurées (Site)
              </p>
              <ul className="list-disc list-inside text-slate-600 space-y-0.5">
                {(selectedDestination?.requiredDocTypes || []).map((doc, i) => (
                  <li key={i}>{doc}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700">
                  <th className="py-2.5 px-4">Denrée</th>
                  <th className="py-2.5 px-4">Lot</th>
                  <th className="py-2.5 px-4 text-right">Quantité à livrer</th>
                  <th className="py-2.5 px-4 text-right">Prix Unitaire HT</th>
                  <th className="py-2.5 px-4 text-right">Montant Ligne</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {activeLinesForDelivery.map((item) => (
                  <tr key={item.contractLine.id}>
                    <td className="py-3 px-4 font-medium text-slate-900">
                      {item.product?.name}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {item.lotNumber}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                      {formatQty(item.quantityDelivered, item.contractLine.unit)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                      {formatFcfa(item.contractLine.unitPrice)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {formatFcfa(
                        item.quantityDelivered * item.contractLine.unitPrice
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold text-xs">
                  <td colSpan={4} className="py-3 px-4 text-right text-slate-900">
                    TOTAL VALORISÉ DE LA LIVRAISON :
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-sm text-slate-900">
                    {formatFcfa(totalDeliveryAmount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={() => setStep(3)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              ← Retour préparation
            </button>
            <button
              type="button"
              onClick={handleNextStep}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Passer à la génération du bordereau
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ÉTAPE 5 : GÉNÉRATION DU BORDEREAU PDF & VALIDATION (SECTION 15, 16 & 31) */}
      {step === 5 && selectedContract && selectedCustomer && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Étape 5 — Génération du Bordereau de Livraison & Validation Finale
              </h2>
              <p className="text-xs text-slate-500">
                Principe strict : Données structurées validées + Template versionné actif = Bordereau PDF figé (Statut FINAL).
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-1.5">
              <Lock className="h-3.5 w-3.5" />
              <span>Protection d’intégrité SHA-256 active</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Modèle (Template) de Bordereau Versionné Actif
              </label>
              <select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
              >
                {state.documentTemplates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.code} — {tpl.name} ({tpl.version})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Instructions / Observations figurant sur le Bordereau
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
              />
            </div>
          </div>

          {/* Aperçu intégré du bordereau */}
          <div className="rounded-lg border border-slate-300 bg-slate-50 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <p className="text-xs font-bold text-slate-900">
                  {state.organization.tradeName}
                </p>
                <p className="text-[11px] text-slate-500">
                  {state.organization.address} · ID Fiscal :{' '}
                  {state.organization.taxId}
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono tabular-nums text-xs font-bold text-slate-900">
                  BORDEREAU N° BL-2026-
                  {String((state.sequences.BL || 128) + 1).padStart(6, '0')}
                </p>
                <p className="text-[11px] text-slate-500">
                  Template {selectedTemplate.version} · Version v1 (FINAL)
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
              <div>
                <p className="text-slate-500">Client & Marché :</p>
                <p className="font-semibold text-slate-900">
                  {selectedCustomer.name}
                </p>
                <p className="font-mono text-slate-700">
                  Contrat : {selectedContract.reference}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Site de Réception & Transport :</p>
                <p className="font-semibold text-slate-900">
                  {selectedDestination?.siteName}
                </p>
                <p className="text-slate-700">
                  Convoyeur : {driverName} ({vehiclePlate}) · Date : {plannedDate}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto bg-white rounded border border-slate-200">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100 text-slate-700">
                    <th className="py-2 px-3">Réf & Désignation</th>
                    <th className="py-2 px-3">Lot</th>
                    <th className="py-2 px-3 text-right">Qté Expédiée</th>
                    <th className="py-2 px-3 text-right">Qté Acceptée (Site)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {activeLinesForDelivery.map((item) => (
                    <tr key={item.contractLine.id}>
                      <td className="py-2 px-3 font-medium text-slate-900">
                        {item.product?.reference} — {item.product?.name}
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-600">
                        {item.lotNumber}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                        {formatQty(item.quantityDelivered, item.contractLine.unit)}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-400 italic">
                        [À compléter à la réception]
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 3 Boutons exigés à l'Étape 5 (Section 31) : Prévisualiser, Générer PDF, Valider livraison */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={() => setStep(4)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              ← Étape 4
            </button>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handlePreviewPdfOnly}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap"
              >
                <Eye className="h-4 w-4" />
                Prévisualiser
              </button>

              <button
                type="button"
                onClick={handleDownloadDraftPdf}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-900 bg-white px-4 py-2.5 text-xs font-semibold text-slate-900 hover:bg-slate-100 whitespace-nowrap"
              >
                <FileDown className="h-4 w-4" />
                Générer PDF
              </button>

              <button
                type="button"
                onClick={() => handleValidateAndFinalize(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
              >
                <CheckCircle2 className="h-4 w-4" />
                Valider livraison & Figer Bordereau
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale d'aperçu plein écran du bordereau */}
      {showPreviewModal && selectedContract && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-slate-200 bg-white p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Aperçu Avant Impression — Bordereau de Livraison Institutionnel
                </h3>
                <p className="text-xs text-slate-500">
                  Template : {selectedTemplate.name} ({selectedTemplate.version})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="rounded border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Fermer l’aperçu
              </button>
            </div>

            <div className="border border-slate-300 p-5 space-y-4 text-xs">
              <div className="flex justify-between border-b border-slate-200 pb-3">
                <div>
                  <p className="font-bold text-sm text-slate-900">
                    {state.organization.tradeName}
                  </p>
                  <p className="text-slate-600">{state.organization.address}</p>
                </div>
                <div className="text-right font-mono">
                  <p className="font-bold text-sm text-slate-900">
                    BL-2026-
                    {String((state.sequences.BL || 128) + 1).padStart(6, '0')}
                  </p>
                  <p className="text-slate-500">Date : {plannedDate}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded">
                <div>
                  <p className="font-semibold text-slate-800">Organisme Client :</p>
                  <p>{selectedCustomer.name}</p>
                  <p>Marché : {selectedContract.reference}</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-800">Site de Destination :</p>
                  <p>{selectedDestination?.siteName}</p>
                  <p>
                    Véhicule : {vehiclePlate} · Chauffeur : {driverName}
                  </p>
                </div>
              </div>

              <table className="w-full border-collapse border border-slate-200">
                <thead>
                  <tr className="bg-slate-900 text-white">
                    <th className="p-2 text-left">Désignation</th>
                    <th className="p-2 text-left">Lot</th>
                    <th className="p-2 text-right">Qté Expédiée</th>
                    <th className="p-2 text-right">Valeur HT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {activeLinesForDelivery.map((l) => (
                    <tr key={l.contractLine.id}>
                      <td className="p-2">{l.product?.name}</td>
                      <td className="p-2 font-mono">{l.lotNumber}</td>
                      <td className="p-2 text-right font-mono tabular-nums font-bold">
                        {formatQty(l.quantityDelivered, l.contractLine.unit)}
                      </td>
                      <td className="p-2 text-right font-mono tabular-nums">
                        {formatFcfa(
                          l.quantityDelivered * l.contractLine.unitPrice
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="grid grid-cols-3 gap-3 pt-4">
                {selectedTemplate.requiredSignatures.map((sig, i) => (
                  <div
                    key={i}
                    className="h-20 rounded border border-dashed border-slate-300 p-2 text-[11px] text-slate-500"
                  >
                    {sig}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleDownloadDraftPdf}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                <FileDown className="h-4 w-4" />
                Télécharger le fichier PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
