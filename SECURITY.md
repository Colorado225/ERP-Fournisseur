# Sécurité Applicative & Contrôle d'Accès — SECURITY.md

## 1. Matrice RBAC (Role-Based Access Control)

| Rôle | Contrats & Marchés | Livraisons & BL | Dérogation Reliquat | Réceptions | Stocks & Lots | Factures & Paiements | Paramètres & Audit |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **OWNER** (Direction) | Lecture / Écriture | Lecture / Validation | Oui (Audité) | Lecture / Écriture | Lecture / Écriture | Lecture / Écriture | Complet |
| **ADMIN** (Admin) | Lecture / Écriture | Lecture / Validation | Oui (Audité) | Lecture / Écriture | Lecture / Écriture | Lecture / Écriture | Complet |
| **MANAGER** (Exploitation) | Lecture / Écriture | Lecture / Validation | Oui (Audité) | Lecture / Écriture | Lecture / Écriture | Lecture | Lecture Audit |
| **LOGISTICS** (Logistique) | Lecture | Création / Édition / BL | Non | Enregistrement | Lecture | Non | Non |
| **WAREHOUSE** (Magasinier) | Lecture | Préparation Lots | Non | Lecture | Entrées / Sorties / Inventaire | Non | Non |
| **ACCOUNTING** (Comptabilité)| Lecture | Lecture | Non | Lecture | Valorisation | Factures / Créances / Paiements / Dépenses | Lecture Audit |
| **VIEWER** (Consultation) | Lecture seule | Lecture seule | Non | Lecture seule | Lecture seule | Lecture seule | Non |

## 2. Protection des Données Sensibles (Section 41)

- Aucune donnée militaire sensible, coordonnée confidentielle ou procédure d'accès à des installations sensibles n'est stockée dans le code source, les seeds ou les URLs.
- Isolation stricte par `organizationId` sur toutes les opérations.
- Journal d'audit immuable enregistrant l'auteur, le rôle, l'action, l'entité, l'horodatage et le résumé avant/après.
