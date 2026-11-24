# Téléchargements Vela

`Vela-2.11.0.apk` utilise la nouvelle signature release persistante. Le passage depuis 2.10.1 ou une version antérieure nécessite une réinstallation exceptionnelle après vérification des sauvegardes : voir `docs/signature-android.md` et la page `android-migration.html` du site.

`Vela-2.10.1.apk` reste disponible avec l’ancienne signature, pour les installations historiques. Son manifeste `release.json` ne doit pas annoncer les APK du nouveau certificat. Les nouvelles installations et mises à jour signées de manière durable utilisent `release-stable.json`.

Aucune clé privée ni aucun mot de passe ne doit être placé dans ce dossier.
