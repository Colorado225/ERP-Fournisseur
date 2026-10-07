# Stratégie de Tests & Vérification — TESTING.md

## 1. Tests Unitaires du Moteur de Domaine (`src/modules/shared/domainEngine.ts`)

Le moteur de domaine intègre une suite d'auto-vérification couvrant :
1. **Calcul du reliquat contractuel** :
   - Vérifie que `remainingQuantity = contractQuantity - acceptedDeliveredQuantity`.
   - Vérifie que les quantités simplement en brouillon ou refusées ne diminuent pas indûment le reliquat contractuel exécuté.
2. **Blocage de dépassement de quantité** :
   - Vérifie le rejet automatique d'une livraison dépassant le reliquat contractuel sans dérogation autorisée, avec génération d'un message d'erreur métier explicite.
3. **Distinction Livré vs Accepté vs Refusé à la réception** :
   - Vérifie le calcul du statut `RECEIVED`, `PARTIALLY_RECEIVED` ou `REJECTED` selon les quantités acceptées ligne par ligne.
4. **Calcul des totaux de facturation et apurement des créances** :
   - Vérifie la mise à jour automatique de `paidAmount`, `remainingAmount` et la transition `ISSUED → PARTIALLY_PAID → PAID`.
5. **Calcul de la Marge sur Coûts Directs (Contribution Margin)** :
   - Vérifie la déduction des coûts d'achat des lots, des frais de transport, de carburant et de manutention.

## 2. Scénario E2E Complet (20 Critères d'Acceptation — Section 52)

Depuis l'interface, l'utilisateur peut exécuter de bout en bout :
1. Sélection du profil utilisateur / rôle RBAC → 2. Configuration Entreprise → 3. Création Client Institutionnel & Sites → 4. Création Contrat & Lignes → 5. Création Commande → 6. Wizard Nouvelle Livraison (5 étapes avec contrôle temps réel des quantités) → 7. Génération & Téléchargement du Bordereau PDF versionné → 8. Enregistrement d'une Réception (complète ou partielle avec réserves) → 9. Émission de la Facture liée → 10. Enregistrement d'un Paiement → 11. Mise à jour instantanée des Créances, du Dashboard et du Journal d'Audit.
