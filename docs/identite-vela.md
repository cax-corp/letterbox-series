# Vela — identité 2.2.0

Vela conserve le mot-symbole en minuscules avec un point d’accent, et l’icône avec une initiale V claire et un point. La géométrie du logo ne change pas avec la palette.

Neuf palettes sont proposées dans Réglages → Apparence → Palette de couleurs : Bleu original, Champagne, Iris grisé, Bleu ardoise, Émeraude, Corail, Rubis, Cuivre et Argent. Les quatre premiers essais sont conservés. Le bleu d’origine est le choix par défaut (`#009FE3`, fond sombre `#001620`, fond clair `#F6FCFF`). Chaque palette a ses propres fonds, surfaces, textes, transparences et boutons, dans les deux modes. Les textes secondaires du mode clair sont assombris pour garantir leur contraste.

Le choix est mémorisé localement et reste indépendant du mode Sombre/Clair/Système et du compte. Il n’y a pas de sélecteur libre. Les couleurs sont restaurées avant React, sans requête réseau. Les halos et boutons du feed et des fiches continuent de suivre l’affiche affichée.

Le logo, le favicon et l’icône Android suivent la palette. Les alias du lanceur Android sont changés à la sortie de l’app pour éviter de fermer l’écran des réglages. Le délai d’affichage dépend du lanceur ; les icônes thématiques monochromes suivent les couleurs d’Android. Les SVG et vecteurs sont générés depuis `src/colour-themes.json` par `npm run themes:generate`.

Le logo CAX fourni et la mention exacte « A CAX Corporation company » restent uniquement en bas des paramètres, adaptés au mode clair/sombre. Le PNG fourni reste intact.

Le package `app.luma.cinema`, les clés de données utilisateur, les noms internes des plugins et le canal de notification ne changent pas. La version 2.2.0 (code 22) conserve la signature précédente pour permettre une mise à jour. MainActivity reste activée pour les ouvertures depuis les notifications, quelle que soit l’icône sélectionnée.
