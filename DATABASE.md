# Base de Données & Modèle Relationnel — DATABASE.md

## 1. Principes du Schéma PostgreSQL / Prisma (`prisma/schema.prisma`)

1. **Multi-Tenancy Natif** : Toutes les tables racines et transactionnelles incluent `organizationId` avec index composites (`@@index([organizationId, status])`).
2. **Précision Monétaire et Quantitative** :
   - Les montants en FCFA (`XOF`) utilisent `@db.Decimal(18, 2)`.
   - Les quantités physiques (`KG`, `TON`, `SACK`, `LITER`, etc.) utilisent `@db.Decimal(18, 3)`.
3. **Immuabilité des Mouvements de Stock** :
   - La table `StockMovement` enregistre chaque variation (`quantityDelta` positif ou négatif) avec son type (`PURCHASE`, `RECEIPT`, `DELIVERY`, `RETURN`, `ADJUSTMENT`, `LOSS`, `DAMAGE`, `TRANSFER`).
   - Le stock physique disponible n'est jamais écrasé arbitrairement : il est calculé à partir de la somme des mouvements validés moins les réservations actives.
4. **Séquences Transactionnelles Sans Collision** :
   - La table `NumberSequence` gère les compteurs annuels par organisation et par préfixe (`BL-2026-000124`, `FAC-2026-000089`, `CMD-2026-000042`, `REG-2026-000031`).

## 2. Indexation & Performance

- `Delivery`: `@@index([organizationId, status, plannedDate])` pour le calendrier logistique et les widgets temps réel.
- `Invoice`: `@@index([organizationId, status, dueDate])` pour le calcul instantané des créances échues.
- `StockLot`: `@@index([productId, expiryDate])` pour l'allocation FEFO (*First Expired, First Out*) et la détection des péremptions proches.
- `AuditLog`: `@@index([organizationId, createdAt])` et `@@index([organizationId, entity, entityId])` pour l'audit d'un dossier de livraison ou d'une facture.
