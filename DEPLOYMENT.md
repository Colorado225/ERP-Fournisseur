# Déploiement, Sauvegarde & Restauration — DEPLOYMENT.md

## 1. Variables d'Environnement (`.env.example`)

```env
DATABASE_URL="postgresql://user:password@ep-neon-instance.eu-central-1.aws.neon.tech/ivoireappro?sslmode=require"
APP_ENV="production"
STORAGE_BUCKET_PRIVATE="ivoireappro-private-docs"
TAX_PROVIDER_MODE="CONFIGURABLE_SANDBOX"
```

## 2. Commandes d'Installation & Build

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run build
npm start
```

## 3. Stratégie de Backup & Disaster Recovery PostgreSQL (Section 42)

- **Point-in-Time Recovery (PITR)** : Activé sur l'instance PostgreSQL Neon (rétention glissante de 14 jours) + snapshots quotidiens chiffrés (`pg_dump --format=custom`) exportés vers un stockage objet isolé.
- **Rétention** : 30 sauvegardes quotidiennes, 12 sauvegardes mensuelles, 5 sauvegardes annuelles (conformité pièces comptables et marchés).
- **Procédure de Test de Restauration Mensuel** :
  1. Provisionner une branche/base éphémère de vérification (`restore-verify-YYYYMM`).
  2. Exécuter `pg_restore --clean --no-owner -d $VERIFY_DB_URL backup_latest.dump`.
  3. Vérifier l'intégrité référentielle : égalité entre la somme des mouvements `StockMovement` et les stocks affichés, et égalité entre `Invoice.totalAmount - sum(PaymentAllocation.amount)` et `Invoice.remainingAmount`.
