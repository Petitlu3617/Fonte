# Mémo

Cartes de révision à répétition espacée (méthode Leitner), installable sur téléphone (application web / PWA), sans compte ni serveur. Indépendante de Fonte : ses données, son cache et ses icônes sont séparés.

## Principe

Tu lis une face d'une carte et tu cherches ce qu'il y a derrière, puis tu la retournes :

- **Je savais** : la carte monte d'une boîte et reviendra plus tard ;
- **Je ne savais pas** : elle descend d'une boîte (ou repart en boîte 1, au choix dans les réglages) pour revenir plus vite.

| Boîte | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Révision | tous les jours | tous les 2 jours | tous les 4 jours | chaque semaine | chaque mois | tous les 3 mois | tous les 6 mois | chaque année |

Après chaque révision, la carte **change de côté** : la fois suivante, c'est l'autre face qui est posée, pour retrouver l'information dans les deux sens.

## Fonctionnalités

- **Aujourd'hui** : cartes à réviser (en retard comprises), par paquet ou toutes ensemble, répartition dans les 8 boîtes, prévision des 7 prochains jours, série de jours.
- **Révision** : carte qui se retourne, « Je savais / Je ne savais pas », annulation de la dernière réponse, puis possibilité de revoir tout de suite les cartes ratées (entraînement sans effet sur les boîtes). Au clavier : Espace pour retourner, → je savais, ← je ne savais pas.
- **Paquets** : un paquet par thème avec sa couleur et le nom de ses deux faces (ex. Anglais / Français). Ajout de cartes une par une ou en lot (`face 1 ; face 2` par ligne, ou copier-coller depuis un tableur), recherche, modification, changement de boîte.
- **Données** : sauvegarde/restauration JSON.

Les données restent dans le navigateur de l'appareil (`localStorage`, clé `memo-cartes`). Exporte régulièrement une sauvegarde.

## Lancer en local

```sh
cd memo
python3 -m http.server 8000
```

Puis ouvre <http://localhost:8000>.

## Installer sur le téléphone

Avec GitHub Pages activé sur le dépôt, l'appli est à l'adresse `…/Fonte/memo/`. Ouvre-la sur le téléphone, puis « Ajouter à l'écran d'accueil » (Safari) ou « Installer l'application » (Chrome). Elle fonctionne ensuite hors ligne. Après une modification des fichiers, incrémente `VERSION` dans `sw.js`.
