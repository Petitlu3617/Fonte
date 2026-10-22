# Fonte

Suivi sportif : carnet de musculation installable sur téléphone (application web / PWA), sans compte ni serveur.

## Fonctionnalités

- **Vue d'ensemble** : séances totales, objectif hebdomadaire et série de semaines, volume, dernier record, régularité sur 16 semaines, répartition par groupe musculaire.
- **Séance** : lancement depuis le programme, saisie charge × répétitions, comparaison en direct avec la dernière fois, records signalés (★), durée de séance, notes.
- **Historique** : détail des séances, courbes de progression par exercice (charge, reps, volume, 1RM estimé), records personnels.
- **Programme** : séances types modifiables (séries, reps visées, ordre).
- **Corps** : poids, masse musculaire/grasse et mensurations avec courbes.
- **Chrono** : repos en décompte (lancé automatiquement à chaque série cochée) ou chrono libre, sonneries au choix, écran maintenu allumé.
- **Données** : sauvegarde/restauration JSON, export CSV des séances et des mesures.

Les données restent dans le navigateur de l'appareil (`localStorage`). Utilise la sauvegarde JSON pour les transférer d'un appareil à l'autre, ou depuis l'artefact Claude « Fonte ».

## Lancer en local

```sh
python3 -m http.server 8000
```

Puis ouvre <http://localhost:8000>. (Ouvrir `index.html` directement fonctionne aussi, mais sans le mode hors ligne.)

## Installer sur le téléphone

1. Héberge le dossier en HTTPS, par exemple avec GitHub Pages : *Settings → Pages → Deploy from a branch*, branche `main`, dossier `/ (root)`.
2. Ouvre l'adresse sur le téléphone, puis « Ajouter à l'écran d'accueil » (Safari) ou « Installer l'application » (Chrome).

L'appli fonctionne ensuite hors ligne. Après une modification des fichiers, incrémente `VERSION` dans `sw.js`.

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `index.html` | Structure de la page |
| `style.css` | Thème sombre et mise en page |
| `app.js` | Logique de l'appli (données, calculs, graphiques, chrono, sons) |
| `sw.js` | Service worker (cache hors ligne) |
| `manifest.webmanifest`, `icons/` | Installation en PWA |
