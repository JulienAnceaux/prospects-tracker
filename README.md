# Prospects Tracker

Détecte les parcelles dont la fiche cadastrale a été modifiée récemment (moins de 12 mois) — signal d'une division volontaire, souvent lié à une préparation de vente.

## Fonctionnement

- Recherche de commune via le référentiel officiel `geo.api.gouv.fr`
- Appel à `cadastre.data.gouv.fr` (IGN/DGFiP, licence ODbL) depuis le backend Vercel
- Score : +40 si la parcelle a été modifiée il y a moins de 12 mois (seuil validé sur le case study Pontoise, 53 prospects)
- Export CSV
- Authentification temporaire par mot de passe serveur

## Limite importante (V1)

Le score ne prend en compte que le signal "division cadastrale récente". Les deux autres signaux du case study d'origine (PermisAPI +30, DVF +20) ne sont pas encore intégrés — voir SPEC.md.

Autre point de vigilance : le champ `updated` capture toute modification de la fiche cadastrale (division, mais aussi fusion, correction de bornage...), pas uniquement les divisions volontaires. Sur les très grandes surfaces (dizaines d'hectares), vérifier au cas par cas avant contact.

## Variables

Copier `.env.example` vers `.env.local`, puis définir :

- `PASSWORD` (ou `APP_PASSWORD`)
- `APP_SESSION_SECRET` (24 caractères minimum)

## Prochaine étape

Intégrer PermisAPI (nécessite une clé) et DVF (public, croisement par adresse/parcelle) pour atteindre le scoring composite complet du case study.

## Déploiement

Vercel, projet `prospects-tracker`, équipe `jac-digital`. https://prospects-tracker-jac-digital.vercel.app
