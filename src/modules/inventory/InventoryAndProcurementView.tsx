import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Boxes,
  Check,
  CheckCircle2,
  Package,
  Plus,
  Settings,
  ShoppingCart,
  Sliders,
  X,
} from 'lucide-react';
import {
  ErpState,
  Product,
  StockMovementType,
  UnitCode,
} from '../shared/types';
import {
  calculateProductStockFromMovements,
  formatFcfa,
  formatQty,
} from '../shared/domainEngine';

interface InventoryAndProcurementViewProps {
  state: ErpState;
  initialSubTab?: 'PRODUCTS' | 'LOTS' | 'MOVEMENTS' | 'PROCUREMENT';
  onNavigateToSettings?: () => void;
  onUpdateProductSafetyThreshold?: (productId: string, newThreshold: number) => void;
  onRecordStockMovement: (payload: {
    productId: string;
    lotNumber: string;
    type: StockMovementType;
    quantityDelta: number;
    referenceDoc: string;
    reason: string;
  }) => void;
  onCreatePurchaseOrder: (payload: {
    supplierId: string;
    productId: string;
    quantity: number;
    unitCost: number;
    expectedDate: string;
  }) => void;
}

export const InventoryAndProcurementView: React.FC<
  InventoryAndProcurementViewProps
> = ({
  state,
  initialSubTab = 'PRODUCTS',
  onNavigateToSettings,
  onUpdateProductSafetyThreshold,
  onRecordStockMovement,
  onCreatePurchaseOrder,
}) => {
  const [subTab, setSubTab] = useState<
    'PRODUCTS' | 'LOTS' | 'MOVEMENTS' | 'PROCUREMENT'
  >(initialSubTab);

  const [productFilter, setProductFilter] = useState<'ALL' | 'CRITICAL' | 'SAFE'>('ALL');
  const [editingThresholdProduct, setEditingThresholdProduct] = useState<Product | null>(null);
  const [tempThresholdValue, setTempThresholdValue] = useState<number>(0);

  const [showMovementModal, setShowMovementModal] = useState(false);
  const [showPoModal, setShowPoModal] = useState(false);

  // Formulaire Mouvement de Stock Immuable
  const [movProductId, setMovProductId] = useState(state.products[0]?.id || '');
  const [movLotNumber, setMovLotNumber] = useState('LOT-RZ-2610-N');
  const [movType, setMovType] = useState<StockMovementType>(
    StockMovementType.RECEIPT
  );
  const [movQty, setMovQty] = useState<number>(5000);
  const [movRef, setMovRef] = useState<string>('BON-ENT-2026-104');
  const [movReason, setMovReason] = useState<string>(
    'Réception fournisseur — contrôle humidité et pesée conformes'
  );

  // Formulaire Commande Fournisseur
  const [poSupplierId, setPoSupplierId] = useState(
    state.suppliers[0]?.id || ''
  );
  const [poProductId, setPoProductId] = useState(state.products[0]?.id || '');
  const [poQty, setPoQty] = useState(15000);
  const [poCost, setPoCost] = useState(410);
  const [poDate, setPoDate] = useState('2026-10-15');

  // Analyse des alertes de stock de sécurité pour l'ensemble des denrées
  const productAlerts = state.products.map((prod) => {
    const currentStock = calculateProductStockFromMovements(
      prod.id,
      state.stockMovements
    );
    const isCritical = currentStock <= prod.minStockThreshold;
    const isWarning = !isCritical && currentStock <= prod.minStockThreshold * 1.25;
    const deficit = isCritical ? prod.minStockThreshold - currentStock : 0;
    const coveragePercent =
      prod.minStockThreshold > 0
        ? Number(((currentStock / prod.minStockThreshold) * 100).toFixed(0))
        : 100;

    return {
      prod,
      currentStock,
      isCritical,
      isWarning,
      deficit,
      coveragePercent,
    };
  });

  const criticalAlerts = productAlerts.filter((a) => a.isCritical);
  const safeAlerts = productAlerts.filter((a) => !a.isCritical);

  const displayedProductAlerts = productAlerts.filter((item) => {
    if (productFilter === 'CRITICAL') return item.isCritical;
    if (productFilter === 'SAFE') return !item.isCritical;
    return true;
  });

  const handleOpenEditThreshold = (prod: Product) => {
    setEditingThresholdProduct(prod);
    setTempThresholdValue(prod.minStockThreshold);
  };

  const handleSaveThresholdModal = () => {
    if (editingThresholdProduct && onUpdateProductSafetyThreshold) {
      onUpdateProductSafetyThreshold(
        editingThresholdProduct.id,
        Math.max(0, tempThresholdValue)
      );
      setEditingThresholdProduct(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Stocks, Denrées, Lots, Mouvements Immuables & Achats Fournisseurs
          </h1>
          <p className="text-xs text-slate-500">
            Règle 7 : Le stock courant n’est jamais modifié arbitrairement ; il est intégralement reconstruit à partir des mouvements immuables.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPoModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            Commande Fournisseur
          </button>
          <button
            type="button"
            onClick={() => setShowMovementModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            Enregistrer Mouvement Stock
          </button>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex items-center gap-1 rounded-lg bg-slate-200/80 p-1 w-fit">
        <button
          type="button"
          onClick={() => setSubTab('PRODUCTS')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
            subTab === 'PRODUCTS'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Catalogue Denrées & Stock Reconstruit ({state.products.length})
        </button>
        <button
          type="button"
          onClick={() => setSubTab('LOTS')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
            subTab === 'LOTS'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Lots & Péremptions ({state.stockLots.length})
        </button>
        <button
          type="button"
          onClick={() => setSubTab('MOVEMENTS')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
            subTab === 'MOVEMENTS'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Journal des Mouvements ({state.stockMovements.length})
        </button>
        <button
          type="button"
          onClick={() => setSubTab('PROCUREMENT')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
            subTab === 'PROCUREMENT'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Fournisseurs & Achats ({state.purchaseOrders.length})
        </button>
      </div>

      {/* ONGLET 1 : PRODUITS, CONVERSIONS D'UNITÉS, STOCKS COURANTS & ALERTES SEUILS */}
      {subTab === 'PRODUCTS' && (
        <div className="space-y-4">
          {/* BANDEAU DES ALERTES DE STOCK DE SÉCURITÉ */}
          {criticalAlerts.length > 0 ? (
            <div className="rounded-lg border border-rose-300 bg-rose-50/80 p-5 space-y-3 shadow-xs">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-rose-200 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="rounded-md bg-rose-600 p-1.5 text-white shrink-0">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-rose-950">
                      Alertes de Stock de Sécurité : {criticalAlerts.length} denrée{criticalAlerts.length > 1 ? 's' : ''} sous le seuil critique configuré
                    </h3>
                    <p className="text-xs text-rose-700">
                      Le stock disponible reconstruit est inférieur au seuil de sécurité défini dans les Paramètres. Risque d’incapacité sur les prochains ordres de livraison institutionnels.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPoModal(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-rose-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-800 shadow-xs transition-colors whitespace-nowrap"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Commander Fournisseur
                  </button>
                  {onNavigateToSettings && (
                    <button
                      type="button"
                      onClick={onNavigateToSettings}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-900 hover:bg-rose-100/60 shadow-xs transition-colors whitespace-nowrap"
                    >
                      <Settings className="h-3.5 w-3.5" />
                      Ajuster Seuils (Paramètres)
                    </button>
                  )}
                </div>
              </div>

              {/* LISTE RAPIDE DES DENRÉES EN ALERTE CRITIQUE */}
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {criticalAlerts.map(({ prod, currentStock, deficit, coveragePercent }) => (
                  <div
                    key={prod.id}
                    className="flex items-center justify-between rounded-md border border-rose-200 bg-white p-3 text-xs shadow-2xs"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="font-bold text-slate-900 truncate">
                        {prod.name}
                      </p>
                      <p className="text-slate-500 font-mono text-[11px]">
                        Réf : {prod.reference} · Seuil : {formatQty(prod.minStockThreshold, prod.unit)}
                      </p>
                      <div className="mt-1 flex items-center gap-1.5 text-[11px]">
                        <span className="font-bold text-rose-700">
                          Stock : {formatQty(currentStock, prod.unit)}
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="text-rose-600 font-medium">
                          Couverture : {coveragePercent}%
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="inline-block rounded bg-rose-100 px-2 py-0.5 font-mono text-[11px] font-bold text-rose-800">
                        -{formatQty(deficit, prod.unit)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleOpenEditThreshold(prod)}
                        className="block text-[10px] text-slate-600 hover:text-slate-900 underline mt-1 text-right w-full"
                      >
                        Modifier seuil
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3.5 flex items-center justify-between text-xs text-emerald-900">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span className="font-medium">
                  Tous les stocks de denrées couvrent actuellement leurs seuils de sécurité configurés dans les Paramètres.
                </span>
              </div>
              {onNavigateToSettings && (
                <button
                  type="button"
                  onClick={onNavigateToSettings}
                  className="text-xs font-semibold text-emerald-800 underline hover:text-emerald-950"
                >
                  Modifier les seuils →
                </button>
              )}
            </div>
          )}

          {/* BARRE D'OUTILS ET FILTRE PAR STATUT D'ALERTE */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-slate-200 bg-white p-3 shadow-xs">
            <div className="flex items-center gap-1">
              <span className="text-xs font-semibold text-slate-500 mr-2">Filtrer :</span>
              <button
                type="button"
                onClick={() => setProductFilter('ALL')}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  productFilter === 'ALL'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Toutes les denrées ({productAlerts.length})
              </button>
              <button
                type="button"
                onClick={() => setProductFilter('CRITICAL')}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  productFilter === 'CRITICAL'
                    ? 'bg-rose-700 text-white'
                    : 'text-rose-700 hover:bg-rose-50'
                }`}
              >
                ⚠️ En alerte / Sous seuil ({criticalAlerts.length})
              </button>
              <button
                type="button"
                onClick={() => setProductFilter('SAFE')}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  productFilter === 'SAFE'
                    ? 'bg-emerald-700 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                ✅ Conformes ({safeAlerts.length})
              </button>
            </div>

            <div className="text-xs text-slate-500">
              Affichage de <span className="font-bold text-slate-800">{displayedProductAlerts.length}</span> denrée{displayedProductAlerts.length > 1 ? 's' : ''}
            </div>
          </div>

          {/* TABLEAU DES DENRÉES AVEC REFLET DES ALERTES SEUILS */}
          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
                    <th className="py-3 px-4">Réf / Code</th>
                    <th className="py-3 px-4">Denrée & Catégorie</th>
                    <th className="py-3 px-4">Conditionnement & Règle</th>
                    <th className="py-3 px-4 text-right">Coût Achat Std</th>
                    <th className="py-3 px-4 text-right">Stock Courant (Mouvements)</th>
                    <th className="py-3 px-4 text-right">Seuil de Sécurité (Paramètres)</th>
                    <th className="py-3 px-4">Statut & Couverture du Seuil</th>
                    <th className="py-3 px-4 text-right">Valeur Stock</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {displayedProductAlerts.map(({ prod, currentStock, isCritical, isWarning, deficit, coveragePercent }) => {
                    return (
                      <tr
                        key={prod.id}
                        className={`transition-colors ${
                          isCritical
                            ? 'bg-rose-50/40 hover:bg-rose-50/70 border-l-4 border-l-rose-600'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-3.5 px-4 font-mono text-slate-800">
                          <p className="font-bold text-slate-900">
                            {prod.reference}
                          </p>
                          <p className="text-slate-500">{prod.internalCode}</p>
                        </td>

                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-slate-900">
                            {prod.name}
                          </p>
                          <p className="text-slate-500">{prod.categoryName}</p>
                        </td>

                        <td className="py-3.5 px-4">
                          <p className="text-slate-800">{prod.packaging}</p>
                          <p className="font-mono text-[11px] text-slate-500">
                            Règle : {prod.conversionRuleLabel}
                          </p>
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700">
                          {formatFcfa(prod.standardCost)} / {prod.unit}
                        </td>

                        <td
                          className={`py-3.5 px-4 text-right font-mono tabular-nums font-bold ${
                            isCritical ? 'text-rose-700' : 'text-slate-900'
                          }`}
                        >
                          {formatQty(currentStock, prod.unit)}
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                          <span className="font-semibold text-slate-800">
                            {formatQty(prod.minStockThreshold, prod.unit)}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 min-w-[190px]">
                          {isCritical ? (
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="inline-flex items-center gap-1 font-bold text-rose-700">
                                  <AlertTriangle className="h-3 w-3 text-rose-600" />
                                  Sous seuil critique
                                </span>
                                <span className="font-mono text-rose-700 font-bold">
                                  {coveragePercent}%
                                </span>
                              </div>
                              <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                                <div
                                  className="h-full bg-rose-600 transition-all"
                                  style={{ width: `${Math.min(coveragePercent, 100)}%` }}
                                />
                              </div>
                              <p className="text-[10px] font-mono text-rose-700">
                                Déficit à combler : -{formatQty(deficit, prod.unit)}
                              </p>
                            </div>
                          ) : isWarning ? (
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="font-semibold text-amber-800">
                                  ⚠️ Proche du seuil
                                </span>
                                <span className="font-mono text-amber-800 font-bold">
                                  {coveragePercent}%
                                </span>
                              </div>
                              <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                                <div
                                  className="h-full bg-amber-500 transition-all"
                                  style={{ width: `${Math.min(coveragePercent, 100)}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="font-semibold text-emerald-800 flex items-center gap-1">
                                  <Check className="h-3 w-3 text-emerald-600" />
                                  Conforme
                                </span>
                                <span className="font-mono text-emerald-700 font-bold">
                                  {coveragePercent}%
                                </span>
                              </div>
                              <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                                <div
                                  className="h-full bg-emerald-600 transition-all"
                                  style={{ width: `${Math.min(coveragePercent, 100)}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                          {formatFcfa(currentStock * prod.standardCost)}
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEditThreshold(prod)}
                              className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                              title="Ajuster le seuil de sécurité"
                            >
                              Seuil
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setPoProductId(prod.id);
                                setShowPoModal(true);
                              }}
                              className="rounded bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800 transition-colors"
                              title="Créer une commande d'approvisionnement"
                            >
                              Commander
                            </button>
                          </div>
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

      {/* MODALE D'AJUSTEMENT DIRECT DU SEUIL DE SÉCURITÉ */}
      {editingThresholdProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Ajuster le Seuil de Sécurité
                </h3>
                <p className="text-xs text-slate-500">
                  {editingThresholdProduct.name} ({editingThresholdProduct.reference})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingThresholdProduct(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {(() => {
              const currentStock = calculateProductStockFromMovements(
                editingThresholdProduct.id,
                state.stockMovements
              );
              const isSimulatedCritical = currentStock <= tempThresholdValue;

              return (
                <div className="space-y-4 text-xs">
                  <div className="rounded border border-slate-200 bg-slate-50 p-3 flex items-center justify-between font-mono">
                    <span className="text-slate-600">Stock Courant Actuel :</span>
                    <span className="font-bold text-slate-900">
                      {formatQty(currentStock, editingThresholdProduct.unit)}
                    </span>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Nouveau Seuil de Sécurité Minima ({editingThresholdProduct.unit})
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        step={editingThresholdProduct.unit === 'CARTON' ? 10 : 100}
                        value={tempThresholdValue}
                        onChange={(e) =>
                          setTempThresholdValue(Math.max(0, Number(e.target.value) || 0))
                        }
                        className="w-full rounded border border-slate-300 px-3 py-2 text-sm font-mono font-bold text-slate-900"
                      />
                      <span className="font-semibold text-slate-600">
                        {editingThresholdProduct.unit}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setTempThresholdValue((prev) => Math.round(prev * 0.9))}
                      className="rounded border border-slate-200 bg-slate-100 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-200"
                    >
                      -10%
                    </button>
                    <button
                      type="button"
                      onClick={() => setTempThresholdValue((prev) => Math.round(prev * 1.1))}
                      className="rounded border border-slate-200 bg-slate-100 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-200"
                    >
                      +10%
                    </button>
                    <button
                      type="button"
                      onClick={() => setTempThresholdValue(editingThresholdProduct.minStockThreshold)}
                      className="rounded border border-slate-200 bg-slate-100 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-200 ml-auto"
                    >
                      Réinitialiser ({editingThresholdProduct.minStockThreshold})
                    </button>
                  </div>

                  <div
                    className={`rounded p-3 text-[11px] ${
                      isSimulatedCritical
                        ? 'border border-rose-200 bg-rose-50 text-rose-800'
                        : 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                    }`}
                  >
                    {isSimulatedCritical ? (
                      <p>
                        ⚠️ Avec ce seuil ({tempThresholdValue}), le produit sera en <strong>alerte critique</strong> (déficit : -{formatQty(tempThresholdValue - currentStock, editingThresholdProduct.unit)}).
                      </p>
                    ) : (
                      <p>
                        ✅ Avec ce seuil ({tempThresholdValue}), le stock actuel est <strong>conforme</strong> (marge : +{formatQty(currentStock - tempThresholdValue, editingThresholdProduct.unit)}).
                      </p>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
                    <button
                      type="button"
                      onClick={() => setEditingThresholdProduct(null)}
                      className="rounded border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveThresholdModal}
                      className="rounded bg-slate-900 px-3.5 py-1.5 font-semibold text-white hover:bg-slate-800"
                    >
                      Enregistrer le Seuil
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ONGLET 2 : LOTS & DATES DE PÉREMPTION (FEFO) */}
      {subTab === 'LOTS' && (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
                  <th className="py-3 px-4">N° de Lot</th>
                  <th className="py-3 px-4">Denrée</th>
                  <th className="py-3 px-4">Entrepôt</th>
                  <th className="py-3 px-4">Date Entrée</th>
                  <th className="py-3 px-4">Date Péremption</th>
                  <th className="py-3 px-4 text-right">Qté Initiale</th>
                  <th className="py-3 px-4 text-right">Qté Réservée</th>
                  <th className="py-3 px-4 text-right">Coût Unitaire</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {state.stockLots.map((lot) => {
                  const prod = state.products.find(
                    (p) => p.id === lot.productId
                  );
                  const wh = state.warehouses.find(
                    (w) => w.id === lot.warehouseId
                  );
                  const isExpiringSoon = lot.expiryDate <= '2026-11-15';

                  return (
                    <tr key={lot.id} className="hover:bg-slate-50">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {lot.lotNumber}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-900">
                        {prod?.name}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">{wh?.name}</td>
                      <td className="py-3.5 px-4 font-mono tabular-nums text-slate-600">
                        {lot.receivedDate}
                      </td>
                      <td
                        className={`py-3.5 px-4 font-mono tabular-nums font-semibold ${
                          isExpiringSoon ? 'text-amber-700' : 'text-slate-800'
                        }`}
                      >
                        {lot.expiryDate}
                        {isExpiringSoon && ' · Péremption proche'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                        {formatQty(lot.initialQuantity, prod?.unit)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-600">
                        {formatQty(lot.reservedQuantity, prod?.unit)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                        {formatFcfa(lot.unitCost)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ONGLET 3 : MOUVEMENTS DE STOCK IMMUABLES */}
      {subTab === 'MOVEMENTS' && (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
                  <th className="py-3 px-4">Horodatage</th>
                  <th className="py-3 px-4">Type Mouvement</th>
                  <th className="py-3 px-4">Denrée & Lot</th>
                  <th className="py-3 px-4 text-right">Variation Quantité</th>
                  <th className="py-3 px-4">Pièce de Référence</th>
                  <th className="py-3 px-4">Motif & Opérateur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {state.stockMovements.map((mov) => {
                  const prod = state.products.find(
                    (p) => p.id === mov.productId
                  );
                  const isPositive = mov.quantityDelta > 0;
                  return (
                    <tr key={mov.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                        {mov.createdAt}
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-slate-800">
                        {mov.type}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-900">
                          {prod?.name}
                        </p>
                        <p className="font-mono text-slate-500">
                          Lot : {mov.lotNumber}
                        </p>
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-mono tabular-nums font-bold ${
                          isPositive ? 'text-emerald-700' : 'text-slate-900'
                        }`}
                      >
                        {isPositive ? '+' : ''}
                        {formatQty(mov.quantityDelta, prod?.unit)}
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                        {mov.referenceDoc}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        <p>{mov.reason}</p>
                        <p className="text-slate-400">Par {mov.performedBy}</p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ONGLET 4 : FOURNISSEURS & COMMANDES D'ACHAT */}
      {subTab === 'PROCUREMENT' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-5 rounded-lg border border-slate-200 bg-white p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">
              Fournisseurs Agréés & Coopératives
            </h2>
            <div className="divide-y divide-slate-200 text-xs">
              {state.suppliers.map((sup) => (
                <div key={sup.id} className="py-3 first:pt-0">
                  <p className="font-mono text-slate-500">
                    {sup.code} · {sup.city}
                  </p>
                  <p className="font-semibold text-slate-900 mt-0.5">
                    {sup.name}
                  </p>
                  <p className="text-slate-600">{sup.specialty}</p>
                  <p className="font-mono text-slate-500 mt-0.5">{sup.phone}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-7 rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">
                Commandes d’Approvisionnement Fournisseurs
              </h2>
              <button
                type="button"
                onClick={() => setShowPoModal(true)}
                className="text-xs font-semibold text-slate-900 underline"
              >
                + Créer commande fournisseur
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
                    <th className="py-2.5 px-4">Référence</th>
                    <th className="py-2.5 px-4">Fournisseur & Produit</th>
                    <th className="py-2.5 px-4 text-right">Quantité</th>
                    <th className="py-2.5 px-4 text-right">Montant Achat</th>
                    <th className="py-2.5 px-4">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {state.purchaseOrders.map((po) => {
                    const sup = state.suppliers.find(
                      (s) => s.id === po.supplierId
                    );
                    const prod = state.products.find(
                      (p) => p.id === po.productId
                    );
                    return (
                      <tr key={po.id}>
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                          {po.reference}
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-semibold text-slate-900">
                            {sup?.name}
                          </p>
                          <p className="text-slate-500">{prod?.name}</p>
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                          {formatQty(po.quantity, prod?.unit)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                          {formatFcfa(po.totalAmount)}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-800">
                          {po.status}
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

      {/* MODALE MOUVEMENT DE STOCK IMMUABLE */}
      {showMovementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Enregistrer un Mouvement de Stock Immuable
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Type de Mouvement *
                </label>
                <select
                  value={movType}
                  onChange={(e) =>
                    setMovType(e.target.value as StockMovementType)
                  }
                  className="w-full rounded border border-slate-300 px-3 py-2"
                >
                  <option value={StockMovementType.RECEIPT}>
                    RECEIPT (Entrée réception fournisseur +)
                  </option>
                  <option value={StockMovementType.RETURN}>
                    RETURN (Retour client en stock +)
                  </option>
                  <option value={StockMovementType.ADJUSTMENT}>
                    ADJUSTMENT (Ajustement d’inventaire +/-)
                  </option>
                  <option value={StockMovementType.LOSS}>
                    LOSS (Perte / Avarie constatée -)
                  </option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Denrée *
                </label>
                <select
                  value={movProductId}
                  onChange={(e) => setMovProductId(e.target.value)}
                  className="w-full rounded border border-slate-300 px-3 py-2"
                >
                  {state.products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.unit})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    N° de Lot *
                  </label>
                  <input
                    type="text"
                    value={movLotNumber}
                    onChange={(e) => setMovLotNumber(e.target.value)}
                    className="w-full rounded border border-slate-300 px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Quantité *
                  </label>
                  <input
                    type="number"
                    value={movQty}
                    onChange={(e) => setMovQty(Number(e.target.value))}
                    className="w-full rounded border border-slate-300 px-3 py-2 font-mono text-right"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Pièce justificative & Motif *
                </label>
                <input
                  type="text"
                  value={movReason}
                  onChange={(e) => setMovReason(e.target.value)}
                  className="w-full rounded border border-slate-300 px-3 py-2"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => setShowMovementModal(false)}
                className="rounded border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  const signedDelta =
                    movType === StockMovementType.LOSS ||
                    movType === StockMovementType.DAMAGE ||
                    movType === StockMovementType.DELIVERY
                      ? -Math.abs(movQty)
                      : Math.abs(movQty);
                  onRecordStockMovement({
                    productId: movProductId,
                    lotNumber: movLotNumber,
                    type: movType,
                    quantityDelta: signedDelta,
                    referenceDoc: movRef,
                    reason: movReason,
                  });
                  setShowMovementModal(false);
                  setSubTab('MOVEMENTS');
                }}
                className="rounded bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Inscrire le Mouvement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE NOUVELLE COMMANDE D'ACHAT FOURNISSEUR */}
      {showPoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Créer une Commande d’Achat Fournisseur (+ Entrée Stock Réceptionnée)
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Fournisseur *
                </label>
                <select
                  value={poSupplierId}
                  onChange={(e) => setPoSupplierId(e.target.value)}
                  className="w-full rounded border border-slate-300 px-3 py-2"
                >
                  {state.suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Denrée commandée *
                </label>
                <select
                  value={poProductId}
                  onChange={(e) => {
                    setPoProductId(e.target.value);
                    const p = state.products.find(
                      (x) => x.id === e.target.value
                    );
                    if (p) setPoCost(p.standardCost);
                  }}
                  className="w-full rounded border border-slate-300 px-3 py-2"
                >
                  {state.products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.unit})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Quantité *
                  </label>
                  <input
                    type="number"
                    value={poQty}
                    onChange={(e) => setPoQty(Number(e.target.value))}
                    className="w-full rounded border border-slate-300 px-3 py-2 font-mono text-right"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Coût unitaire d’achat (FCFA) *
                  </label>
                  <input
                    type="number"
                    value={poCost}
                    onChange={(e) => setPoCost(Number(e.target.value))}
                    className="w-full rounded border border-slate-300 px-3 py-2 font-mono text-right"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => setShowPoModal(false)}
                className="rounded border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  onCreatePurchaseOrder({
                    supplierId: poSupplierId,
                    productId: poProductId,
                    quantity: poQty,
                    unitCost: poCost,
                    expectedDate: poDate,
                  });
                  setShowPoModal(false);
                  setSubTab('PROCUREMENT');
                }}
                className="rounded bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Valider la Commande d’Achat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
