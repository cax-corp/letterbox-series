# Signature Android durable de Vela

Vela 2.11.0 (versionCode 42) utilise une clé PKCS#12 dédiée, alias `vela`. Son certificat public est enregistré dans `android/signing-certificate.sha256`. Les builds release exigent la clé et les variables de signature ; ils ne fabriquent pas de nouvelle clé. Le script `scripts/verify-apk-signature.mjs` refuse une APK dont le certificat ne correspond pas à cette empreinte.

La clé privée et son mot de passe sont des sauvegardes privées à conserver séparément hors du dépôt public et de la seule machine Cloud. Les fichiers `.p12`, `.pfx`, `.jks` et `.keystore` sont ignorés par Git. L’empreinte publique n’est pas la clé et ne permet pas de la reconstruire.

## Transition depuis 2.10.1

L’ancienne clé debug n’a pas été récupérée. La nouvelle signature nécessite une réinstallation exceptionnelle : sauvegarder, vérifier les données sur le site et conserver un export de secours, télécharger la nouvelle APK, puis désinstaller l’ancienne application, installer la nouvelle et se reconnecter. Une désinstallation efface les données locales. Aucun changement SQL supplémentaire.

`public/release.json` reste figé sur la dernière version de l’ancienne signature. Les installations historiques ne reçoivent donc pas automatiquement une APK incompatible. À partir de 2.11.0, les vérifications quotidiennes lisent `release-stable.json`. Ce canal exige de conserver la nouvelle clé pour toutes ses futures versions. Ne pas faire pointer le manifeste historique vers une APK avec un autre certificat.

## GitHub Actions

Dans le dépôt : **Settings → Secrets and variables → Actions → New repository secret**. Créer :

- `VELA_ANDROID_KEYSTORE_BASE64` : contenu Base64 du fichier PKCS#12, sans le publier dans une conversation ou un commit.
- `VELA_ANDROID_STORE_PASSWORD` : mot de passe du keystore, saisi uniquement dans le champ secret.
- `VELA_ANDROID_KEY_ALIAS` : `vela`.

Le mot de passe de la clé est identique à celui du keystore. Ne jamais ajouter les secrets à `VITE_*` : ces valeurs seraient embarquées dans le site et l’APK.

Pour préparer le Base64 sous Windows, depuis le dossier du fichier, cette commande le copie dans le presse-papiers sans l’afficher :

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes((Resolve-Path '.\vela-release.p12').Path)) | Set-Clipboard
```

Coller directement dans le secret GitHub, puis effacer le presse-papiers (`Set-Clipboard -Value ''`). Ne pas coller cette valeur dans le chat. Garder la copie de sauvegarde du fichier original.

Le workflow **Build Android APK** exécute les tests puis construit une release seulement lorsque les trois secrets sont présents. Il restaure la clé dans un fichier temporaire privé, signe, vérifie le certificat attendu, publie l’artefact APK et efface le fichier temporaire. Sans secrets, la compilation release est explicitement sautée ; aucune APK signée avec une clé éphémère n’est distribuée.

## Build local

Définir localement, sans afficher ni enregistrer les valeurs dans Git :

- `VELA_ANDROID_KEYSTORE_FILE` : chemin absolu du fichier PKCS#12 privé ;
- `VELA_ANDROID_STORE_PASSWORD` : mot de passe ;
- `VELA_ANDROID_KEY_ALIAS` : `vela` ;
- `VELA_ANDROID_KEY_PASSWORD` : facultatif, identique au mot de passe du keystore par défaut.

Puis `GRADLE_USER_HOME=/workspace/.luma-tools/gradle-home bash scripts/build-apk.sh`. Les outils préparés dans `/workspace/.luma-tools` sont utilisés. Résultat vérifié : `/workspace/artifacts/Vela.apk`.

Pour publier une future version : conserver la clé, augmenter versionCode/versionName et les numéros web, construire/vérifier l’APK, ajouter son fichier dans downloads et actualiser le manifeste stable et les liens de téléchargement. Ne jamais modifier l’empreinte attendue pour faire accepter un certificat inconnu.
