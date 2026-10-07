import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Boxes,
  Package,
  Plus,
  ShoppingCart,
} from 'lucide-react';
import {
  ErpState,
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
  onRecordStockMovement,
  onCreatePurchaseOrder,
}) => {
  const [subTab, setSubTab] = useState<
    'PRODUCTS' | 'LOTS' | 'MOVEMENTS' | 'PROCUREMENT'
  >(initialSubTab);

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

      {/* ONGLET 1 : PRODUITS, CONVERSIONS D'UNITÉS & STOCK COURANT */}
      {subTab === 'PRODUCTS' && (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
                  <th className="py-3 px-4">Réf / Code</th>
                  <th className="py-3 px-4">Denrée & Catégorie</th>
                  <th className="py-3 px-4">Conditionnement & Règle de Conversion</th>
                  <th className="py-3 px-4 text-right">Coût Achat Std</th>
                  <th className="py-3 px-4 text-right">Seuil Alerte</th>
                  <th className="py-3 px-4 text-right">Stock Courant (Mouvements)</th>
                  <th className="py-3 px-4 text-right">Valeur Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {state.products.map((prod) => {
                  const currentStock = calculateProductStockFromMovements(
                    prod.id,
                    state.stockMovements
                  );
                  const isCritical = currentStock <= prod.minStockThreshold;

                  return (
                    <tr key={prod.id} className="hover:bg-slate-50">
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
                          Règle explicite : {prod.conversionRuleLabel}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700">
                        {formatFcfa(prod.standardCost)} / {prod.unit}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-600">
                        {formatQty(prod.minStockThreshold, prod.unit)}
                      </td>
                      <td
                        className={`py-3.5 px-4 text-right font-mono tabular-nums font-bold ${
                          isCritical ? 'text-red-700' : 'text-emerald-700'
                        }`}
                      >
                        {formatQty(currentStock, prod.unit)}
                        {isCritical && (
                          <span className="block text-[11px] font-normal text-red-700">
                            Sous seuil critique
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                        {formatFcfa(currentStock * prod.standardCost)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
