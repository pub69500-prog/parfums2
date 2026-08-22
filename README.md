# Zara + Lattafa Database V7 — version simple

Cette version supprime complètement le scraping direct de Zara.

## Fonctionnement

- **Zara** : registre local `data/zara-fragrantica.json`, construit à partir de Fragrantica.
- **Lattafa** : catalogue officiel mis à jour automatiquement chaque semaine.
- **Inspirations / dupes** : `data/correspondences.json`.
- **Collaborations Zara** : `data/collaborations.json`.
- **GitHub Pages** : déployé automatiquement par le workflow.

Fragrantica indique actuellement **1 271 parfums Zara** dans sa base, de 1999 à 2026.
Le registre local fourni dans cette version contient **200 références Zara de départ** et est conçu pour être enrichi progressivement.

## Avantage

Il n'y a plus :
- d'accès direct à Zara depuis GitHub ;
- d'erreur `Access Denied` Zara ;
- de clé API ;
- de secret GitHub supplémentaire.

## Installation

1. Remplace les fichiers de ton dépôt par ceux de cette version.
2. Dans `Settings > Pages`, choisis **GitHub Actions**.
3. Va dans `Actions > Mise à jour Parfums`.
4. Clique sur `Run workflow`.

Le workflow fusionnera automatiquement la base Zara locale et le catalogue Lattafa officiel, puis publiera le site.
