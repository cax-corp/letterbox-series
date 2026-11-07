# APK proposé sur le site web

`Vela-2.4.0.apk` est la version Android 2.4.0 déjà distribuée et testée, avec sa signature conservée. Le lien de téléchargement de la page web « Pour vous » pointe vers ce fichier.

`npm run build:web` ajoute le fichier dans `dist/downloads` après la compilation Vite. Le workflow Pages utilise cette commande. Le build Android continue d’utiliser `npm run build` via `android:sync` : le téléchargement n’est pas ajouté aux ressources embarquées de l’APK.

Pour changer de version, mettre à jour ce fichier, le lien dans `src/WebRecommendationsNotice.tsx` et la copie dans `scripts/prepare-web-download.mjs`.
