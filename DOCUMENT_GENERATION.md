# Génération Documentaire & Bordereaux Versionnés — DOCUMENT_GENERATION.md

## 1. Principe Déterministe

Aucun document officiel ou bordereau n'est généré par un modèle génératif. Le moteur PDF (`src/modules/shared/pdfGenerator.ts`) suit exclusivement la chaîne déterministe :

$$\text{Données Structurées Validées} + \text{Template Versionné Actif} = \text{Document PDF Final}$$

## 2. Workflow de Génération d'un Bordereau (`DELIVERY_NOTE`)

1. **Sélection de la Livraison (`Delivery`)** et vérification de la cohérence des lignes et numéros de lots.
2. **Sélection du Template Actif (`DocumentTemplate`)** (ex: `BL-INST-STD v2.1`).
3. **Mapping des Champs** : En-tête fournisseur, client institutionnel, marché de référence, destination de livraison, tableau des denrées (désignation, conditionnement, lot, quantité prévue, quantité livrée, colonne de contrôle réception), blocs de signatures (Magasinier, Transporteur, Réceptionnaire Site).
4. **Rendu PDF & Prévisualisation (`PREVIEW`)**.
5. **Validation & Gel (`FINAL`)** :
   - Attribution d'une empreinte de contrôle (`checksum`).
   - Verrouillage de la version (`v1`, `v2`, etc.).
   - Toute régénération ultérieure (ex: après correction autorisée ou réception avec réserves) crée une nouvelle version (`version + 1`), passe l'ancienne en `SUPERSEDED` et écrit une entrée `DOCUMENT_FINALIZED` dans le journal d'audit.
