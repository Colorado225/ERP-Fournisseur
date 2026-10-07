/**
 * IVOIREAPPRO ERP — SEED DE DÉVELOPPEMENT (DONNÉES FICTIVES RÉALISTES)
 *
 * Conformité Section 1, 40 & 41 :
 * - Aucune donnée militaire sensible ni coordonnée réelle d'installation sensible.
 * - Aucune règle fiscale ou administrative inventée comme obligation légale.
 * - Toutes les entités sont explicitement fictives pour démonstration et tests.
 */

import { INITIAL_ERP_STATE } from '../src/modules/shared/seedData';

async function main() {
  console.log('Initialisation du seed IvoireAppro ERP...');
  console.log(`Organisation : ${INITIAL_ERP_STATE.organization.tradeName}`);
  console.log(`Contrats initialisés : ${INITIAL_ERP_STATE.contracts.length}`);
  console.log(`Produits initialisés : ${INITIAL_ERP_STATE.products.length}`);
  console.log(`Livraisons initialisées : ${INITIAL_ERP_STATE.deliveries.length}`);
  console.log(`Factures initialisées : ${INITIAL_ERP_STATE.invoices.length}`);
  console.log('Seed terminé avec succès.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
