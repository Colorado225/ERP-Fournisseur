import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Building,
  Check,
  CheckCircle2,
  FileDown,
  FileText,
  Lock,
  Package,
  Play,
  Save,
  Shield,
  Sliders,
  Users,
} from 'lucide-react';
import {
  DocumentType,
  ErpState,
  Organization,
  RoleName,
} from '../shared/types';
import {
  calculateContractLineMetrics,
  calculateContributionMarginByContract,
  calculateProductStockFromMovements,
  formatFcfa,
  formatQty,
  runDomainTestSuite,
} from '../shared/domainEngine';
import {
  exportToCsvFile,
  generateContractExecutionReportPdf,
  generateDeliveryNotePdf,
  generateFinancialReportPdf,
  generateInvoicePdf,
  generateProfitabilityAndFinancialReportPdf,
  generateProfitabilityReportPdf,
} from '../shared/pdfGenerator';

interface DocumentsReportsSettingsViewProps {
  state: ErpState;
  mode: 'DOCUMENTS' | 'REPORTS' | 'SETTINGS';
  onSwitchUser: (userId: string) => void;
  onUpdateOrganization: (org: Organization) => void;
  onUpdateProductSafetyThreshold?: (productId: string, newThreshold: number) => void;
  onNavigateToInventory?: () => void;
}

export const DocumentsReportsSettingsView: React.FC<
  DocumentsReportsSettingsViewProps
> = ({
  state,
  mode,
  onSwitchUser,
  onUpdateOrganization,
  onUpdateProductSafetyThreshold,
  onNavigateToInventory,
}) => {
  const [settingsTab, setSettingsTab] = useState<
    'ORG' | 'USERS_RBAC' | 'STOCK_SAFETY' | 'TEMPLATES' | 'RULES' | 'AUDIT_TESTS'
  >('ORG');

  const [orgForm, setOrgForm] = useState<Organization>(state.organization);
  const [orgSavedBanner, setOrgSavedBanner] = useState(false);

  // Brouillons locaux pour la configuration des seuils de stock de sécurité
  const [thresholdDrafts, setThresholdDrafts] = useState<Record<string, number>>(() => {
    const drafts: Record<string, number> = {};
    state.products.forEach((p) => {
      drafts[p.id] = p.minStockThreshold;
    });
    return drafts;
  });
  const [savedSuccessId, setSavedSuccessId] = useState<string | null>(null);

  useEffect(() => {
    setThresholdDrafts((prev) => {
      const next = { ...prev };
      state.products.forEach((p) => {
        if (next[p.id] === undefined) {
          next[p.id] = p.minStockThreshold;
        }
      });
      return next;
    });
  }, [state.products]);

  const handleSaveProductThreshold = (productId: string) => {
    const val = thresholdDrafts[productId];
    if (val !== undefined && onUpdateProductSafetyThreshold) {
      onUpdateProductSafetyThreshold(productId, Math.max(0, Number(val) || 0));
      setSavedSuccessId(productId);
      setTimeout(() => setSavedSuccessId(null), 2500);
    }
  };

  const handleAdjustMultiplier = (productId: string, multiplier: number) => {
    const current = thresholdDrafts[productId] ?? (state.products.find((p) => p.id === productId)?.minStockThreshold || 0);
    const updated = Math.max(0, Math.round(current * multiplier));
    setThresholdDrafts((prev) => ({ ...prev, [productId]: updated }));
  };

  const testResults = runDomainTestSuite(state);

  // ==========================================================================
  // VUE 1 : GESTION ÉLECTRONIQUE DES DOCUMENTS (SECTION 18)
  // ==========================================================================
  if (mode === 'DOCUMENTS') {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Gestion Documentaire Centralisée & Archive Versionnée
            </h1>
            <p className="text-xs text-slate-500">
              Tous les bordereaux de livraison, PV de réception contradictoires, contrats et factures avec empreinte d’intégrité.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
                  <th className="py-3 px-4">Document & Fichier</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Entité Rattachée</th>
                  <th className="py-3 px-4">Version & Statut</th>
                  <th className="py-3 px-4">Empreinte d’Intégrité</th>
                  <th className="py-3 px-4">Auteur & Date</th>
                  <th className="py-3 px-4 text-right">Téléchargement PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {state.documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50">
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-slate-900">{doc.title}</p>
                      <p className="font-mono text-slate-500">{doc.fileName}</p>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-700">
                      {doc.documentType}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      {doc.entityReference}
                    </td>
                    <td className="py-3.5 px-4 font-mono">
                      v{doc.version} ·{' '}
                      <span className="font-semibold text-emerald-700">
                        {doc.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                      {doc.checksum}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {doc.uploadedBy} · {doc.createdAt}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          if (doc.entityType === 'DELIVERY') {
                            const del =
                              state.deliveries.find(
                                (d) => d.id === doc.entityId
                              ) || state.deliveries[0];
                            const ctr =
                              state.contracts.find(
                                (c) => c.id === del.contractId
                              ) || state.contracts[0];
                            const cust =
                              state.customers.find(
                                (c) => c.id === ctr.customerId
                              ) || state.customers[0];
                            const dst =
                              cust.destinations.find(
                                (x) => x.id === del.destinationId
                              ) || cust.destinations[0];
                            generateDeliveryNotePdf({
                              organization: state.organization,
                              delivery: del,
                              contract: ctr,
                              customer: cust,
                              destination: dst,
                              products: state.products,
                              template: state.documentTemplates[0],
                              version: doc.version,
                              mode:
                                doc.documentType === DocumentType.RECEIPT
                                  ? 'RECEIPT_PV'
                                  : 'DELIVERY_NOTE',
                            });
                          } else if (doc.entityType === 'INVOICE') {
                            const inv =
                              state.invoices.find(
                                (i) => i.id === doc.entityId
                              ) || state.invoices[0];
                            const cust =
                              state.customers.find(
                                (c) => c.id === inv.customerId
                              ) || state.customers[0];
                            const ctr =
                              state.contracts.find(
                                (c) => c.id === inv.contractId
                              ) || state.contracts[0];
                            generateInvoicePdf({
                              organization: state.organization,
                              invoice: inv,
                              customer: cust,
                              contract: ctr,
                            });
                          } else {
                            generateContractExecutionReportPdf(state);
                          }
                        }}
                        className="inline-flex items-center gap-1 font-semibold text-slate-900 hover:underline"
                      >
                        <FileDown className="h-3.5 w-3.5" />
                        Télécharger PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // VUE 2 : RAPPORTS & ANALYSES + EXPORTS PDF / CSV / EXCEL (SECTION 27)
  // ==========================================================================
  if (mode === 'REPORTS') {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Rapports & Analyses (Exports PDF, Excel & CSV)
            </h1>
            <p className="text-xs text-slate-500">
              États réglementaires, financiers et de rentabilité : Synthèse imprimable · Marges sur coûts directs · Décomptes facturation · Exécution contractuelle · Stocks.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => generateProfitabilityAndFinancialReportPdf(state)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 shadow-xs transition-colors"
            >
              <FileDown className="h-4 w-4" />
              Exporter Synthèse Rentabilité & Finances (PDF)
            </button>
            <button
              type="button"
              onClick={() => generateContractExecutionReportPdf(state)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 shadow-xs transition-colors"
            >
              <FileDown className="h-4 w-4" />
              Exporter Rapport Exécution (PDF)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* 1. Rapport d'exécution contractuelle */}
          <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">
                1. Rapport d’Exécution Contractuelle
              </h2>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => generateContractExecutionReportPdf(state)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  PDF Imprimable
                </button>
                <button
                  type="button"
                  onClick={() =>
                    exportToCsvFile(
                      'Rapport_Execution_Contractuelle.csv',
                      [
                        'Marche',
                        'Denree',
                        'Unite',
                        'Contractuel',
                        'Livre Accepte',
                        'Refuse',
                        'Restant',
                        'Pourcentage Execution',
                      ],
                      state.contracts.flatMap((c) =>
                        c.lines.map((l) => {
                          const prod = state.products.find(
                            (p) => p.id === l.productId
                          );
                          const m = calculateContractLineMetrics(
                            l,
                            state.deliveries
                          );
                          return [
                            c.reference,
                            prod?.name || '',
                            l.unit,
                            m.contractQuantity,
                            m.acceptedDeliveredQuantity,
                            m.rejectedQuantity,
                            m.remainingQuantity,
                            `${m.executionRatePercent}%`,
                          ];
                        })
                      )
                    )
                  }
                  className="text-xs font-semibold text-slate-900 underline"
                >
                  CSV / Excel
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-600">
              Détaille pour chaque marché : Quantité contractuelle, livrée acceptée, refusée, restante et taux d’exécution.
            </p>
          </div>

          {/* 2. Rapport des livraisons */}
          <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">
                2. Rapport Détaillé des Livraisons Multi-Sites
              </h2>
              <button
                type="button"
                onClick={() =>
                  exportToCsvFile(
                    'Rapport_Livraisons_MultiSites.csv',
                    [
                      'Bordereau',
                      'Contrat',
                      'Destination',
                      'Date Prevue',
                      'Statut',
                      'Chauffeur',
                      'Vehicule',
                    ],
                    state.deliveries.map((d) => [
                      d.reference,
                      d.contractId,
                      d.destinationId,
                      d.plannedDate,
                      d.status,
                      d.driverName,
                      d.vehiclePlate,
                    ])
                  )
                }
                className="text-xs font-semibold text-slate-900 underline"
              >
                Exporter CSV / Excel
              </button>
            </div>
            <p className="text-xs text-slate-600">
              Historique complet des convois par période, contrat, site de destination et statut de réception.
            </p>
          </div>

          {/* 3. Rapport des états financiers & recouvrements */}
          <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">
                3. États Financiers & Suivi des Recouvrements
              </h2>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => generateFinancialReportPdf(state)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  PDF Imprimable
                </button>
                <button
                  type="button"
                  onClick={() =>
                    exportToCsvFile(
                      'Etats_Financiers_Factures_Recouvrements.csv',
                      [
                        'Facture',
                        'Client',
                        'Emission',
                        'Echeance',
                        'Total TTC',
                        'Encaisse',
                        'Reste Du',
                        'Statut',
                      ],
                      state.invoices.map((inv) => {
                        const cust = state.customers.find((c) => c.id === inv.customerId);
                        return [
                          inv.reference,
                          cust?.name || '',
                          inv.issueDate,
                          inv.dueDate,
                          inv.totalAmount,
                          inv.paidAmount,
                          inv.remainingAmount,
                          inv.status,
                        ];
                      })
                    )
                  }
                  className="text-xs font-semibold text-slate-900 underline"
                >
                  CSV / Excel
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-600">
              Synthèse complète de la facturation, encaissements effectifs, créances ouvertes et balance âgée des impayés avec visas officiels.
            </p>
          </div>

          {/* 4. Rapport de rentabilité & marges directes */}
          <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">
                4. Rapport de Rentabilité & Marges sur Coûts Directs
              </h2>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => generateProfitabilityReportPdf(state)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  PDF Imprimable
                </button>
                <button
                  type="button"
                  onClick={() =>
                    exportToCsvFile(
                      'Rapport_Rentabilite_Marges_Directes.csv',
                      [
                        'Contrat',
                        'Valeur Contrat',
                        'CA Execute',
                        'Cout Achat',
                        'Depenses Directes',
                        'Marge sur Couts Directs',
                        'Taux Marge %',
                      ],
                      state.contracts.map((c) => {
                        const m = calculateContributionMarginByContract(c, state);
                        return [
                          c.reference,
                          m.contractValue,
                          m.revenueExecuted,
                          m.purchaseCost,
                          m.directExpenses,
                          m.contributionMargin,
                          `${m.marginRatePercent}%`,
                        ];
                      })
                    )
                  }
                  className="text-xs font-semibold text-slate-900 underline"
                >
                  CSV / Excel
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-600">
              Analyse détaillée de la marge de contribution (CA exécuté − achats − fret/carburant/dockers/stockage), répartition par poste et tendance 6 mois.
            </p>
          </div>

          {/* 5. Rapport Stock */}
          <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4 md:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">
                5. Rapport d’État des Stocks, Lots & Péremptions
              </h2>
              <button
                type="button"
                onClick={() =>
                  exportToCsvFile(
                    'Rapport_Stocks_Mouvements.csv',
                    [
                      'Reference',
                      'Denree',
                      'Unite',
                      'Stock Courant',
                      'Seuil Critique',
                      'Cout Unitaire',
                      'Valorisation Stock',
                    ],
                    state.products.map((p) => {
                      const stk = calculateProductStockFromMovements(
                        p.id,
                        state.stockMovements
                      );
                      return [
                        p.reference,
                        p.name,
                        p.unit,
                        stk,
                        p.minStockThreshold,
                        p.standardCost,
                        stk * p.standardCost,
                      ];
                    })
                  )
                }
                className="text-xs font-semibold text-slate-900 underline"
              >
                Exporter CSV / Excel
              </button>
            </div>
            <p className="text-xs text-slate-600">
              Stock reconstruit par denrée, entrées, sorties, retours et lots proches de leur date de péremption.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // VUE 3 : PARAMÈTRES, ENTREPRISE, RBAC, RÈGLES CONFIGURABLES & TESTS (SECTION 30, 35, 39)
  // ==========================================================================
  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl font-bold text-slate-900">
          Paramètres — Entreprise, Utilisateurs & RBAC, Templates, Règles & Audit
        </h1>
        <p className="text-xs text-slate-500">
          Configuration de l’organisation fournisseur, contrôle d’accès granulaire, séparation des règles métier/administratives/fiscales et journal d’audit immuable.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-200/80 p-1 w-fit">
        {[
          { id: 'ORG', label: 'Entreprise Fournisseur' },
          { id: 'USERS_RBAC', label: 'Utilisateurs & Rôles RBAC' },
          { id: 'STOCK_SAFETY', label: 'Seuils de Sécurité Stock' },
          { id: 'TEMPLATES', label: 'Templates de Bordereaux' },
          { id: 'RULES', label: 'Règles Métier / Fiscales / Admin' },
          { id: 'AUDIT_TESTS', label: 'Journal d’Audit & Tests Unitaires' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSettingsTab(t.id as typeof settingsTab)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              settingsTab === t.id
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* SOUS-ONGLET 1 : ENTREPRISE FOURNISSEUR (CRITÈRE D'ACCEPTATION 2) */}
      {settingsTab === 'ORG' && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 max-w-3xl space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">
            Fiche Entreprise Fournisseur (Multi-Tenant : {state.organization.id})
          </h2>
          {orgSavedBanner && (
            <div className="rounded border border-emerald-300 bg-emerald-50 p-3 text-xs font-medium text-emerald-900">
              Informations de l’entreprise mises à jour et prises en compte sur les prochains bordereaux PDF.
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">
                Raison Sociale Légale
              </label>
              <input
                type="text"
                value={orgForm.legalName}
                onChange={(e) =>
                  setOrgForm({ ...orgForm, legalName: e.target.value })
                }
                className="w-full rounded border border-slate-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Nom Commercial (En-tête Bordereaux)
              </label>
              <input
                type="text"
                value={orgForm.tradeName}
                onChange={(e) =>
                  setOrgForm({ ...orgForm, tradeName: e.target.value })
                }
                className="w-full rounded border border-slate-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Identifiant Fiscal Configurable
              </label>
              <input
                type="text"
                value={orgForm.taxId}
                onChange={(e) =>
                  setOrgForm({ ...orgForm, taxId: e.target.value })
                }
                className="w-full rounded border border-slate-300 px-3 py-2 font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Immatriculation Commerciale (RCCM)
              </label>
              <input
                type="text"
                value={orgForm.registrationNumber}
                onChange={(e) =>
                  setOrgForm({
                    ...orgForm,
                    registrationNumber: e.target.value,
                  })
                }
                className="w-full rounded border border-slate-300 px-3 py-2 font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Téléphone Siège & Exploitation
              </label>
              <input
                type="text"
                value={orgForm.phone}
                onChange={(e) =>
                  setOrgForm({ ...orgForm, phone: e.target.value })
                }
                className="w-full rounded border border-slate-300 px-3 py-2 font-mono"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">
                Adresse Siège & Entrepôt Principal
              </label>
              <input
                type="text"
                value={orgForm.address}
                onChange={(e) =>
                  setOrgForm({ ...orgForm, address: e.target.value })
                }
                className="w-full rounded border border-slate-300 px-3 py-2"
              />
            </div>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                onUpdateOrganization(orgForm);
                setOrgSavedBanner(true);
              }}
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Enregistrer les paramètres de l’entreprise
            </button>
          </div>
        </div>
      )}

      {/* SOUS-ONGLET 2 : UTILISATEURS & RÔLES RBAC */}
      {settingsTab === 'USERS_RBAC' && (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-900">
              Utilisateurs & Contrôle d’Accès Basé sur les Rôles (RBAC)
            </h2>
            <p className="text-xs text-slate-500">
              Vous pouvez basculer instantanément sur n’importe quel profil pour tester les restrictions de permissions (ex: LOGISTICS sans droit de dérogation contractuelle).
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
                  <th className="py-3 px-4">Collaborateur</th>
                  <th className="py-3 px-4">Rôle Métier</th>
                  <th className="py-3 px-4">Permissions Granulaires</th>
                  <th className="py-3 px-4">Dernière Connexion</th>
                  <th className="py-3 px-4 text-right">Session Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {state.users.map((u) => {
                  const isCurrent = u.id === state.currentUserId;
                  return (
                    <tr
                      key={u.id}
                      className={isCurrent ? 'bg-slate-50/90' : ''}
                    >
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-slate-900">{u.name}</p>
                        <p className="text-slate-500">{u.email}</p>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {u.role} · {u.roleLabel}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600">
                        {u.permissions.length > 0
                          ? u.permissions.join(' · ')
                          : 'Consultation seule (Read-only)'}
                      </td>
                      <td className="py-3.5 px-4 font-mono tabular-nums text-slate-500">
                        {u.lastLoginAt}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {isCurrent ? (
                          <span className="font-semibold text-emerald-700">
                            Profil actif
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onSwitchUser(u.id)}
                            className="rounded border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                          >
                            Incarner ce rôle
                          </button>
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

      {/* SOUS-ONGLET : CONFIGURATION DES SEUILS DE STOCK DE SÉCURITÉ PAR PRODUIT */}
      {settingsTab === 'STOCK_SAFETY' && (
        <div className="space-y-6">
          {/* CARTE D'ENTÊTE ET STATISTIQUES */}
          <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="rounded-md bg-slate-900 p-1.5 text-white">
                    <Package className="h-4 w-4" />
                  </div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Configuration des Seuils de Sécurité & Stocks Minima d’Alerte
                  </h2>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Définissez pour chaque denrée le niveau de stock de sécurité critique. Si le stock disponible reconstruit (entrées − sorties) passe sous ce seuil, une alerte immédiate est répercutée dans le module « Produits & Stocks » et le Dashboard de Direction.
                </p>
              </div>

              {onNavigateToInventory && (
                <button
                  type="button"
                  onClick={onNavigateToInventory}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap shadow-xs shrink-0"
                >
                  Ouvrir « Produits & Stocks »
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* SYNTHÈSE DES SEUILS */}
            {(() => {
              const criticalCount = state.products.filter((p) => {
                const currentStock = calculateProductStockFromMovements(
                  p.id,
                  state.stockMovements
                );
                const threshold = thresholdDrafts[p.id] ?? p.minStockThreshold;
                return currentStock <= threshold;
              }).length;

              const totalSafetyValue = state.products.reduce((acc, p) => {
                const threshold = thresholdDrafts[p.id] ?? p.minStockThreshold;
                return acc + threshold * p.standardCost;
              }, 0);

              return (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="rounded-md border border-slate-200 bg-slate-50/60 p-3.5">
                    <p className="text-xs text-slate-500">Denrées gérées sous contrat</p>
                    <p className="mt-1 text-xl font-bold font-mono tabular-nums text-slate-900">
                      {state.products.length} références
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Règles de conversion immuables actives
                    </p>
                  </div>

                  <div className="rounded-md border border-slate-200 bg-slate-50/60 p-3.5">
                    <p className="text-xs text-slate-500">Statut des alertes immédiates</p>
                    <div className="mt-1 flex items-baseline gap-2">
                      <p
                        className={`text-xl font-bold font-mono tabular-nums ${
                          criticalCount > 0 ? 'text-rose-700' : 'text-emerald-700'
                        }`}
                      >
                        {criticalCount} {criticalCount > 1 ? 'denrées' : 'denrée'} sous le seuil
                      </p>
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {criticalCount > 0
                        ? 'Réapprovisionnement fournisseur requis'
                        : 'Tous les stocks couvrent le seuil de sécurité'}
                    </p>
                  </div>

                  <div className="rounded-md border border-slate-200 bg-slate-50/60 p-3.5">
                    <p className="text-xs text-slate-500">Valorisation du stock de sécurité</p>
                    <p className="mt-1 text-xl font-bold font-mono tabular-nums text-slate-900">
                      {formatFcfa(totalSafetyValue)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Engagement financier minimum garanti
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* TABLEAU DE CONFIGURATION DES SEUILS PAR PRODUIT */}
          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-xs">
            <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900">
                Seuils Paramétrables par Denrée & Contrôle de Disponibilité
              </h3>
              <span className="text-[11px] text-slate-500">
                Modification enregistrée en temps réel avec trace d’audit
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
                    <th className="py-3 px-4">Réf / Code</th>
                    <th className="py-3 px-4">Denrée & Conditionnement</th>
                    <th className="py-3 px-4 text-right">Coût Achat</th>
                    <th className="py-3 px-4 text-right">Stock Actuel (Reconstruit)</th>
                    <th className="py-3 px-4">Seuil de Sécurité Configurable</th>
                    <th className="py-3 px-4 text-right">Diagnostic de Sécurité</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {state.products.map((prod) => {
                    const currentStock = calculateProductStockFromMovements(
                      prod.id,
                      state.stockMovements
                    );
                    const thresholdValue =
                      thresholdDrafts[prod.id] ?? prod.minStockThreshold;
                    const isCritical = currentStock <= thresholdValue;
                    const isWarning =
                      !isCritical && currentStock <= thresholdValue * 1.25;
                    const deficit = isCritical ? thresholdValue - currentStock : 0;
                    const coveragePercent =
                      thresholdValue > 0
                        ? Number(((currentStock / thresholdValue) * 100).toFixed(0))
                        : 100;
                    const isDraftDirty =
                      thresholdValue !== prod.minStockThreshold;
                    const isSavedSuccess = savedSuccessId === prod.id;

                    return (
                      <tr
                        key={prod.id}
                        className={`transition-colors ${
                          isCritical
                            ? 'bg-rose-50/30 hover:bg-rose-50/50'
                            : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <td className="py-3.5 px-4 font-mono">
                          <p className="font-bold text-slate-900">
                            {prod.reference}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {prod.internalCode}
                          </p>
                        </td>

                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-slate-900">
                            {prod.name}
                          </p>
                          <p className="text-slate-500">
                            {prod.categoryName} · {prod.packaging}
                          </p>
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                          {formatFcfa(prod.standardCost)} / {prod.unit}
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                          <span
                            className={`font-bold ${
                              isCritical ? 'text-rose-700' : 'text-slate-900'
                            }`}
                          >
                            {formatQty(currentStock, prod.unit)}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex flex-col gap-1.5 max-w-xs">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min={0}
                                step={prod.unit === 'CARTON' ? 10 : 100}
                                value={thresholdValue}
                                onChange={(e) => {
                                  const val = Math.max(0, Number(e.target.value) || 0);
                                  setThresholdDrafts((prev) => ({
                                    ...prev,
                                    [prod.id]: val,
                                  }));
                                }}
                                className={`w-28 rounded border px-2.5 py-1 text-xs font-mono font-bold tabular-nums text-slate-900 ${
                                  isDraftDirty
                                    ? 'border-amber-400 bg-amber-50/60 focus:border-amber-500'
                                    : 'border-slate-300 bg-white focus:border-slate-500'
                                }`}
                              />
                              <span className="font-mono text-xs font-semibold text-slate-600">
                                {prod.unit}
                              </span>
                            </div>

                            {/* Boutons d'ajustement rapide */}
                            <div className="flex items-center gap-1 text-[10px]">
                              <button
                                type="button"
                                onClick={() => handleAdjustMultiplier(prod.id, 0.9)}
                                className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                                title="Réduire le seuil de 10%"
                              >
                                -10%
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAdjustMultiplier(prod.id, 1.1)}
                                className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                                title="Augmenter le seuil de 10%"
                              >
                                +10%
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAdjustMultiplier(prod.id, 1.25)}
                                className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                                title="Augmenter le seuil de 25%"
                              >
                                +25%
                              </button>
                              {isDraftDirty && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setThresholdDrafts((prev) => ({
                                      ...prev,
                                      [prod.id]: prod.minStockThreshold,
                                    }))
                                  }
                                  className="text-slate-400 hover:text-slate-700 underline ml-1"
                                >
                                  Annuler
                                </button>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          {isCritical ? (
                            <div className="inline-flex flex-col items-end">
                              <span className="inline-flex items-center gap-1 rounded bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-800">
                                <AlertTriangle className="h-3 w-3 text-rose-600" />
                                Rupture critique ({coveragePercent}%)
                              </span>
                              <span className="font-mono text-[10px] text-rose-700 mt-0.5">
                                Manque : -{formatQty(deficit, prod.unit)}
                              </span>
                            </div>
                          ) : isWarning ? (
                            <div className="inline-flex flex-col items-end">
                              <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                                Vigilance ({coveragePercent}%)
                              </span>
                              <span className="font-mono text-[10px] text-amber-700 mt-0.5">
                                Proche du seuil
                              </span>
                            </div>
                          ) : (
                            <div className="inline-flex flex-col items-end">
                              <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                                <Check className="h-3 w-3 text-emerald-600" />
                                Conforme ({coveragePercent}%)
                              </span>
                              <span className="font-mono text-[10px] text-emerald-700 mt-0.5">
                                Marge : +{formatQty(currentStock - thresholdValue, prod.unit)}
                              </span>
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          {isSavedSuccess ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                              <Check className="h-4 w-4" />
                              Enregistré
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSaveProductThreshold(prod.id)}
                              disabled={!isDraftDirty}
                              className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold transition-colors ${
                                isDraftDirty
                                  ? 'bg-slate-900 text-white hover:bg-slate-800 shadow-xs'
                                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                              }`}
                            >
                              <Save className="h-3.5 w-3.5" />
                              Sauvegarder
                            </button>
                          )}
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

      {/* SOUS-ONGLET 3 : TEMPLATES DE BORDEREAUX VERSIONNÉS */}
      {settingsTab === 'TEMPLATES' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {state.documentTemplates.map((tpl) => (
            <div
              key={tpl.id}
              className="rounded-lg border border-slate-200 bg-white p-5 space-y-3 text-xs"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-slate-900">
                  {tpl.code}
                </span>
                <span className="font-mono text-emerald-700 font-semibold">
                  {tpl.version} · {tpl.status}
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-900">{tpl.name}</h3>
              <p className="text-slate-500">
                Type : <span className="font-mono">{tpl.type}</span> · Effectif
                depuis le {tpl.effectiveFrom}
              </p>
              <div>
                <p className="font-semibold text-slate-800 mb-1">
                  Blocs de signatures requis :
                </p>
                <ul className="list-disc list-inside text-slate-600 space-y-0.5">
                  {tpl.requiredSignatures.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SOUS-ONGLET 4 : SÉPARATION EXPLICITE DES RÈGLES (SECTION 1) */}
      {settingsTab === 'RULES' && (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-900">
              Distinction Stricte des Règles Métier, Contractuelles, Administratives, Fiscales et Documentaires (Section 1)
            </h2>
            <p className="text-xs text-slate-500">
              Aucune règle configurable n’est présentée comme une obligation légale inventée.
            </p>
          </div>
          <div className="divide-y divide-slate-200 text-xs">
            {state.configurableRules.map((rule) => (
              <div key={rule.id} className="p-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1 max-w-2xl">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900">
                      {rule.code}
                    </span>
                    <span>·</span>
                    <span className="font-semibold text-slate-700">
                      Catégorie : {rule.category}
                    </span>
                  </div>
                  <p className="font-semibold text-slate-900">{rule.title}</p>
                  <p className="text-slate-600">{rule.description}</p>
                </div>
                <div className="text-right font-mono text-xs font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded px-3 py-2">
                  {rule.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SOUS-ONGLET 5 : TESTS AUTOMATISÉS & JOURNAL D'AUDIT IMMUABLE (SECTION 28 & 39) */}
      {settingsTab === 'AUDIT_TESTS' && (
        <div className="space-y-6">
          {/* Suite de tests unitaires et d'intégration */}
          <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Vérification Automatisée des Règles Métier Critiques (Unit & Integration Tests — Section 39)
                </h2>
                <p className="text-xs text-slate-500">
                  Exécution en direct sur le moteur de domaine (calcul des reliquats, blocage dépassement, réception partielle, stock immuable, apurement créance, marge).
                </p>
              </div>
              <span className="font-mono text-xs font-bold text-emerald-700">
                {testResults.filter((t) => t.passed).length} /{' '}
                {testResults.length} TESTS PASSÉS
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {testResults.map((tr) => (
                <div
                  key={tr.id}
                  className="rounded border border-slate-200 bg-slate-50/60 p-3 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-slate-900">
                      {tr.id} · {tr.category}
                    </span>
                    <span
                      className={`font-semibold ${
                        tr.passed ? 'text-emerald-700' : 'text-red-700'
                      }`}
                    >
                      {tr.passed ? 'PASS' : 'FAIL'}
                    </span>
                  </div>
                  <p className="font-semibold text-slate-900">{tr.name}</p>
                  <p className="font-mono text-[11px] text-slate-600">
                    {tr.details}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Journal d'audit immuable */}
          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <h2 className="text-sm font-semibold text-slate-900">
                Journal d’Audit Immuable (Section 28)
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
                    <th className="py-3 px-4">Horodatage</th>
                    <th className="py-3 px-4">Utilisateur & Rôle</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Entité</th>
                    <th className="py-3 px-4">Détail de l’Opération</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {state.auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="py-3 px-4 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                        {log.createdAt}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-900">
                          {log.userName}
                        </p>
                        <p className="font-mono text-slate-500">
                          {log.userRole} · IP {log.ipAddress}
                        </p>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {log.action}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700">
                        {log.entity} ({log.entityId})
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        {log.summary}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
