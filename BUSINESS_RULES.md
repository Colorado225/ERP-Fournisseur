# Règles Métier & Séparation Réglementaire — BUSINESS_RULES.md

## 1. Séparation Stricte des Catégories de Règles

Conformément à la contrainte absolue d'exactitude :
- **Règles Métier Internes** : Alertes de stock critique, seuils de péremption (ex: 30 jours), validation interne avant expédition.
- **Règles Contractuelles** : Plafonds de quantités par ligne de marché, prix unitaires contractuels, dates d'échéance du marché, avenants.
- **Règles Administratives Configurables** : Horaires d'accès aux sites de livraison, liste de pièces justificatives souhaitées par chaque organisme client (configurables par adresse client, jamais codées en dur comme des lois).
- **Règles Fiscales Configurables** : Taux de taxe paramétrable par ligne de contrat (`0%` pour denrées exonérées ou `18%` selon régime applicable fourni par l'entreprise), couche d'abstraction `InvoiceCertificationService` (`NOT_SUBMITTED`, `SUBMITTED`, `CERTIFIED`, `REJECTED`).
- **Règles Documentaires** : Templates de bordereaux versionnés et figés après validation.

## 2. Formules Métier Critiques

### Contrôle des Quantités Contractuelles (Règle 2)
$$\text{Quantité Restante Autorisée} = \text{Quantité Contractuelle} - \sum \text{Quantités Livrées Acceptées}$$
- En cours de préparation, le système affiche également les quantités engagées sur des livraisons en transit (`DISPATCHED` / `READY`) afin d'éviter le sur-engagement.
- Toute tentative de créer ou valider une livraison dont la quantité dépasse le reliquat contractuel est bloquée avec un message métier explicite, sauf dérogation motivée par un utilisateur disposant de la permission `deliveries:override_quota`.

### Réception des Livraisons (Règle 3)
Pour chaque ligne de livraison :
- `quantityDelivered` : Quantité expédiée sur le bordereau de livraison.
- `quantityAccepted` : Quantité effectivement acceptée par le réceptionnaire du site client.
- `quantityRejected` : Quantité refusée ($\text{quantityDelivered} - \text{quantityAccepted}$), accompagnée obligatoirement d'un `rejectionReason` si $> 0$.

### Rentabilité : Marge sur Coûts Directs (Section 23)
$$\text{Marge sur Coûts Directs (Contribution)} = \text{Chiffre d'Affaires Accepté/Facturé} - (\text{Coût d'Achat des Denrées} + \text{Frais de Transport/Carburant} + \text{Manutention} + \text{Stockage Direct})$$
*Note : Cet indicateur est explicitement nommé « Marge sur coûts directs » (Contribution Margin) et non « Bénéfice net », car il n'inclut pas les charges fixes globales de structure ou d'impôt sur les sociétés.*
