# Architecture Logicielle — IvoireAppro ERP

## 1. Style Architectural : Domain-Driven Modular Monolith

L'application est structurée selon une architecture **Monolithe Modulaire orienté Domaine (DDD)**, évitant la complexité prématurée des microservices tout en garantissant un découplage strict entre la logique métier, la validation et l'interface utilisateur.

```text
src/
  modules/
    shared/
      types.ts            # Modèles de domaine typés strictement
      validation.ts       # Schémas Zod client & serveur
      domainEngine.ts     # Moteur de règles métier pures (quantités, marges, stock, séquences)
      pdfGenerator.ts     # Moteur déterministe de génération PDF (Données + Template Versionné)
      seedData.ts         # Données fictives réalistes multi-modules
    dashboard/            # Vue générale & Vue Direction (30 secondes)
    contracts/            # Marchés, Lignes contractuelles, Avenants & Commandes
    deliveries/           # Wizard Nouvelle Livraison (5 étapes), Détail Livraison (6 onglets), Réceptions, Calendrier
    inventory/            # Produits, Unités & Conversions explicites, Lots, Péremptions, Mouvements immuables, Achats
    finance/              # Factures, Abstraction FNE, Créances, Paiements, Dépenses & Rentabilité sur coûts directs
    documents/            # GED versionnée, Templates de bordereaux & Aperçu / Téléchargement PDF
    reports/              # Rapports d'exécution, livraisons, finance, stock & exports CSV/PDF
    settings/             # Organisation, Utilisateurs, RBAC, Règles configurables & Journal d'Audit immuable
```

## 2. Flux de Données & Persistance

- **Validation Double Niveau** : Chaque opération critique passe par un schéma `Zod` et par les garde-fous du moteur de domaine (`domainEngine.ts`) avant toute mutation d'état.
- **Isolation Multi-Tenant** : Chaque entité porte un `organizationId`. Toutes les sélections et mutations filtrent systématiquement sur l'organisation active.
- **Traçabilité systématique** : Chaque mutation métier (`CREATE`, `VALIDATE`, `DOCUMENT_FINALIZED`, `PAYMENT_RECORDED`, etc.) inscrit automatiquement une entrée horodatée dans le journal d'audit immuable (`AuditLog`).
