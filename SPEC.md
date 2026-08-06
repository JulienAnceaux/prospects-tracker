# SPEC — Prospects Tracker

## Objectif métier

Détecter les divisions cadastrales récentes (signal amont d'une vente à venir), sur toute commune française, via données publiques uniquement. Suite logique de Parcelles Tracker, basé sur le case study "Prospection Immobilière Intelligente" (POC Pontoise, 53 prospects, score moyen 40/90).

## Source de données

`cadastre.data.gouv.fr` (IGN/DGFiP, licence ODbL) — un fichier GeoJSON par commune (`.../communes/{code_insee}/geojson/parcelles`), gzippé côté serveur, décompressé automatiquement par `fetch` Node. Vérifié en direct sur Pontoise (95500) : 6078 parcelles, champs `id, commune, section, numero, contenance, arpente, created, updated`.

## Logique de scoring (`api/prospects.mjs`)

Formule du case study d'origine : `Score = Divisions(+40) + PermisAPI(+30) + DVF(+20)`, seuil de qualification ≥ 40.

- **V1 (implémentée)** : `+40` si `updated` < 12 mois (calculé sur la date de dernière modification cadastrale, pas la date de création). Seuil validé empiriquement sur le POC Pontoise.
- **V2 (non implémentée)** : `+30` si la parcelle correspond à un permis de construire actif (PermisAPI, API payante — 500 requêtes gratuites/mois, nécessite une clé de Julien).
- **V2 (non implémentée)** : `+20` si mutation DVF récente sur la parcelle/adresse (public, `data.gouv.fr`, mais fichiers volumineux par département — croisement par adresse à construire).

## Validation empirique

Recalcul effectué le 06/08/2026 sur les données live Pontoise : 63-73 parcelles qualifiées selon la date de référence (contre 53 dans le case study de février), ~18-19,6 ha cumulés (contre ~78 ha annoncés). Les parcelles en tête de liste correspondent exactement (AW377, AW188, AI215). L'écart sur les totaux vient probablement du rafraîchissement du jeu de données depuis la rédaction du case study (le cadastre est republié régulièrement) — comportement normal d'un outil "live" par rapport à un instantané figé, mais à garder en tête si les chiffres du case study sont réutilisés tels quels dans une communication commerciale.

## Garde-fous

- `MAX_FEATURES = 80000` : au-delà, la commune est tronquée et l'interface l'indique (évite un timeout Vercel sur les très grosses communes).
- `maxDuration: 60` dans `vercel.json`, comme parcelles-tracker.

## Limite connue : bruit sur les grandes surfaces

Le champ `updated` capture toute modification cadastrale (division, fusion, correction de bornage, changement de nature de culture...), pas uniquement une division volontaire liée à une vente. Observé sur Versailles : une parcelle de 71,5 ha avec score 40 — peu probable qu'il s'agisse d'une vraie division de prospection. Pas de filtre automatique en V1 ; à qualifier manuellement au cas par cas pour les grandes surfaces.

## Écarts connus avec le case study d'origine

- PermisAPI et DVF non branchés (score plafonné à 40 pour toutes les parcelles qualifiées en V1)
- Pas de restriction aux 97 communes de la zone de chalandise Domus — recherche libre par commune
- Pas de carte / fiche détail parcelle (contrairement à parcelles-tracker) — V1 volontairement plus légère

## Déploiement

Vercel, projet `prospects-tracker`, équipe `jac-digital`. Même schéma d'authentification et de structure que `parcelles-tracker`.
