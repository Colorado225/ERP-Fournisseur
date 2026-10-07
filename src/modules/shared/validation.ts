// ============================================================================
// IVOIREAPPRO ERP — SCHÉMAS DE VALIDATION ZOD (CLIENT & SERVEUR)
// Messages d'erreur métier compréhensibles (Conformité Section 38)
// ============================================================================

import { z } from 'zod';
import { UnitCode, ExpenseCategoryType } from './types';

export const NewContractSchema = z.object({
  reference: z
    .string()
    .min(4, 'La référence du marché doit comporter au moins 4 caractères (ex: M-2026-CHU-04).'),
  title: z
    .string()
    .min(5, "L'intitulé du marché est requis et doit être explicite."),
  customerId: z.string().min(1, 'Veuillez sélectionner un organisme client valide.'),
  startDate: z.string().min(10, 'La date de début du contrat est obligatoire.'),
  endDate: z.string().min(10, 'La date de fin du contrat est obligatoire.'),
  notes: z.string().optional(),
  lines: z
    .array(
      z.object({
        productId: z.string().min(1, 'Veuillez sélectionner une denrée.'),
        unit: z.nativeEnum(UnitCode),
        quantity: z
          .number()
          .positive('La quantité contractuelle doit être strictement supérieure à 0.'),
        unitPrice: z
          .number()
          .positive('Le prix unitaire contractuel doit être strictement supérieur à 0 FCFA.'),
        taxRate: z
          .number()
          .min(0, 'Le taux de taxe configurable ne peut pas être négatif.')
          .max(100, 'Le taux de taxe ne peut pas dépasser 100 %.'),
      })
    )
    .min(1, 'Un contrat doit contenir au moins une ligne de denrée contractuelle.'),
});

export const NewDeliveryLineInputSchema = z.object({
  contractLineId: z.string().min(1, 'Ligne contractuelle requise.'),
  productId: z.string().min(1, 'Produit requis.'),
  lotNumber: z.string().min(1, 'Veuillez affecter un lot de stock traçable.'),
  quantityDelivered: z
    .number()
    .positive('La quantité à livrer doit être strictement supérieure à 0.'),
});

export const NewDeliveryInputSchema = z.object({
  contractId: z
    .string()
    .min(1, 'Règle 1 : Une livraison ne peut être créée sans un contrat actif valide.'),
  orderId: z
    .string()
    .min(1, 'Règle 1 : Veuillez associer une commande valide à cette livraison.'),
  destinationId: z
    .string()
    .min(1, 'Veuillez sélectionner le site de destination de la livraison.'),
  plannedDate: z.string().min(10, 'La date de livraison prévue est obligatoire.'),
  driverName: z.string().min(2, 'Veuillez indiquer le nom du chauffeur / convoyeur.'),
  vehiclePlate: z.string().min(3, "Veuillez indiquer l'immatriculation du véhicule."),
  responsibleUser: z.string().min(2, 'Le responsable logistique est obligatoire.'),
  overrideReason: z.string().optional(),
  notes: z.string().optional(),
  lines: z
    .array(NewDeliveryLineInputSchema)
    .min(1, 'Veuillez ajouter au moins une denrée à livrer dans ce dossier.'),
});

export const ReceptionLineInputSchema = z.object({
  lineId: z.string().min(1),
  quantityAccepted: z
    .number()
    .min(0, 'La quantité acceptée ne peut pas être négative.'),
  quantityRejected: z
    .number()
    .min(0, 'La quantité refusée ne peut pas être négative.'),
  rejectionReason: z.string().optional(),
  observation: z.string().optional(),
});

export const RecordPaymentSchema = z.object({
  invoiceId: z.string().min(1, 'Veuillez sélectionner la facture à rapprocher.'),
  amount: z
    .number()
    .positive('Le montant encaissé doit être strictement supérieur à 0 FCFA.'),
  paymentDate: z.string().min(10, "La date d'encaissement est requise."),
  method: z.enum([
    'VIREMENT_TRESOR',
    'VIREMENT_BANCAIRE',
    'CHEQUE_CERTIFIE',
    'TRAITE',
  ]),
  bankReference: z
    .string()
    .min(3, 'Veuillez saisir la référence du virement, chèque ou avis de crédit.'),
});

export const NewExpenseSchema = z.object({
  category: z.nativeEnum(ExpenseCategoryType),
  label: z.string().min(3, 'Veuillez décrire la dépense engagée.'),
  amount: z.number().positive('Le montant de la dépense doit être supérieur à 0 FCFA.'),
  expenseDate: z.string().min(10, 'La date de la dépense est requise.'),
  contractId: z.string().optional(),
  deliveryId: z.string().optional(),
  supplierId: z.string().optional(),
  productId: z.string().optional(),
});
