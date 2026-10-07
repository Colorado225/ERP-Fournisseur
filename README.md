# IvoireAppro ERP — Système de Gestion pour Fournisseur Institutionnel de Denrées

Application web professionnelle (ERP verticalisé B2B) dédiée aux entreprises ivoiriennes spécialisées dans l'approvisionnement et la livraison multi-sites de denrées alimentaires auprès d'organismes et clients institutionnels.

## Cycle Métier Couvert

`Marché / Contrat → Commande → Planification → Approvisionnement → Stock (Lots & Mouvements immuables) → Préparation → Livraison → Réception (Complète / Partielle / Refusée) → Bordereau PDF versionné → Facturation → Créances → Encaissements → Analyse de Marge sur Coûts Directs`

## Principes Fondamentaux & Conformité

1. **Aucune règle administrative ou fiscale inventée** : Le système distingue explicitement :
   - **Règles métier internes** (ex: seuils d'alerte stock, validation hiérarchique) ;
   - **Règles contractuelles** (ex: quantités maximales par marché, prix unitaires convenus, avenants) ;
   - **Règles administratives configurables** (ex: horaires de réception par site, pièces requises configurées par client) ;
   - **Règles fiscales configurables** (ex: taux de taxe paramétrable par ligne, abstraction `InvoiceCertificationService` pour interfaçage FNE futur sans codage en dur non documenté) ;
   - **Règles documentaires** (ex: templates versionnés de bordereaux de livraison `BL` et PV de réception).
2. **Intégrité des Quantités Contractuelles** :
   - $\text{Quantité restante} = \text{Quantité contractuelle} - \text{Quantité livrée acceptée}$
   - La quantité expédiée n'est jamais automatiquement assimilée à la quantité acceptée tant que la réception n'est pas enregistrée.
3. **Immuabilité des Mouvements de Stock et des Documents Finalisés** :
   - Le stock disponible est la somme algébrique des mouvements (`PURCHASE`, `RECEIPT`, `DELIVERY`, `RETURN`, `ADJUSTMENT`, `LOSS`, `DAMAGE`, `TRANSFER`).
   - Un bordereau ou document au statut `FINAL` est verrouillé par empreinte de contrôle ; toute modification ultérieure génère une nouvelle version auditée.

## Documentation Technique

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — Architecture Domain-Driven Modular Monolith
- [`DATABASE.md`](./DATABASE.md) — Modèle de données PostgreSQL / Prisma & Multi-tenancy (`organizationId`)
- [`BUSINESS_RULES.md`](./BUSINESS_RULES.md) — Règles métier critiques, formules de calcul et séparation réglementaire
- [`DOCUMENT_GENERATION.md`](./DOCUMENT_GENERATION.md) — Moteur de génération PDF et cycle de vie des templates versionnés
- [`SECURITY.md`](./SECURITY.md) — Contrôle d'accès RBAC, isolation multi-tenant et journal d'audit immuable
- [`DEPLOYMENT.md`](./DEPLOYMENT.md) — Variables d'environnement, déploiement, sauvegarde PostgreSQL et restauration
- [`TESTING.md`](./TESTING.md) — Tests unitaires, d'intégration et scénario E2E complet
