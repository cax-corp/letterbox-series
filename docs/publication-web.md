# Mettre Vela en ligne sur GitHub Pages

La version web contient les fonctions du Vela 2.0 actuel : films/séries, recherche TMDB, collection, notes et avis, recommandations locales avec passages rapides, profils et avatars prédéfinis, statistiques et sauvegardes Supabase. Elle adapte la navigation au PC et au mobile. Les notifications programmées quand l’app est fermée restent une fonction de l’APK Android ; le site ne prétend pas les envoyer navigateur fermé.

La création de liens de partage ouvrant le site ou l’APK est volontairement reportée. Le partage existant de cartes PNG et de texte reste en place. Cette publication ne configure ni Android App Links, ni domaine Cloudflare.

## Quel fichier utiliser ?

- **Vela-GitHub-source.zip** : projet complet, avec le code, les avatars et le workflow de publication. À importer à la racine de `cax-corp/letterbox-series` si les sources n’y sont pas déjà importées. C’est l’archive à utiliser pour la méthode recommandée ci-dessous.
- **Vela-site-web.zip** : site déjà compilé (`index.html`, `assets`, `avatars`, `brand`, licences et `.nojekyll`). À garder comme copie prête à héberger sur un serveur statique. Ce ZIP n’est pas un fichier à déposer tel quel dans GitHub : GitHub ne le décompresse pas. Il ne remplace pas les sources du projet configuré pour compiler avec Actions.

## 1. Importer les sources dans le dépôt

Si les fichiers sont déjà visibles sur la branche `main`, passer directement à l’étape 2.

Sinon, décompresser **Vela-GitHub-source.zip** sur le PC. Ouvrir `https://github.com/cax-corp/letterbox-series`, choisir **Add file → Upload files**, et importer le contenu du dossier décompressé, pas le dossier parent ni le ZIP. Les fichiers `package.json`, `index.html` et les dossiers `src`, `public`, `.github` doivent être à la racine du dépôt. Il faut notamment le fichier `.github/workflows/pages.yml`. Valider avec **Commit changes** sur `main`.

Avec Git installé, on peut aussi pousser le projet complet vers la branche `main`. Ne pas remplacer l’index source par l’index du ZIP compilé : le workflow reconstruit le site depuis les sources.

## 2. Activer GitHub Pages

1. Dans ce dépôt, ouvrir **Settings → Pages**.
2. Dans **Build and deployment → Source**, choisir **GitHub Actions**.
3. Ouvrir **Actions → Deploy Vela to GitHub Pages**.
4. Choisir **Run workflow**, branche `main`, puis lancer. Un nouveau commit sur `main` le déclenche aussi.
5. Attendre la réussite de `build` et de `deploy`. L’adresse effective est affichée dans le déploiement `github-pages` et dans **Settings → Pages**.

L’adresse prévue sans domaine personnalisé est :

`https://cax-corp.github.io/letterbox-series/`

Elle n’est pas considérée comme publiée tant que le déploiement n’est pas confirmé. Si un premier lancement échoue sur la configuration Pages avant l’étape 2, activer la source puis relancer le workflow. Le workflow standard ne crée pas le site Pages à la place du propriétaire : l’action officielle demande un autre jeton administrateur pour cette activation automatique, donc aucun jeton administrateur n’est ajouté au projet.

Le job de compilation fournit aussi un artefact **Vela-site-web**, même si une configuration Pages empêche le déploiement. Sur l’offre GitHub gratuite, Pages nécessite habituellement un dépôt public ; un dépôt privé peut nécessiter une offre compatible. La visibilité du dépôt n’est pas changée automatiquement.

## 3. Retrouver la collection de l’APK

1. Dans l’APK, ouvrir **Profil → Synchroniser** pour envoyer les derniers changements sans attendre la prochaine sauvegarde quotidienne.
2. Sur le site publié, ouvrir **Réglages → Connecter Supabase**. Utiliser **le même projet existant** : son URL HTTPS et sa clé publique `publishable` ou `anon`. Jamais `service_role` ni une clé `sb_secret_…`.
3. Enregistrer, laisser la page se recharger, puis se connecter dans **Profil** avec le même compte que dans l’APK.
4. La première synchronisation de ce navigateur récupère la collection et les métadonnées de profil. Le bouton **Synchroniser** permet aussi de la lancer manuellement.
5. Dans **Réglages → Catalogue TMDB**, renseigner la même clé/jeton de lecture TMDB que sur le téléphone pour accéder au catalogue complet.

Les réglages et sessions du navigateur sont distincts de ceux du téléphone. Ils ne sont pas copiés depuis l’APK. Les profils et collections des comptes restent séparés des données anonymes. Aucun nouveau script SQL n’est nécessaire pour un projet déjà configuré avec Vela.

Dans **Supabase → Authentication → URL Configuration**, définir l’adresse publiée comme **Site URL** et ajouter l’URL de retour exacte `https://cax-corp.github.io/letterbox-series/` dans les **Redirect URLs**. Les inscriptions web demandent un lien de confirmation vers la base du site courant. Se connecter avec un compte déjà confirmé ne nécessite pas de recréer le compte.

## Configuration facultative lors du build

La saisie dans Réglages suffit. Pour préconfigurer le site publié, le workflow accepte :

| Réglage GitHub du dépôt | Nom | Valeur |
| --- | --- | --- |
| Variable Actions | `VITE_SUPABASE_URL` | URL du projet existant |
| Variable Actions | `VITE_SUPABASE_ANON_KEY` | Clé publique Supabase |
| Secret Actions | `VITE_TMDB_READ_TOKEN` | Jeton de lecture TMDB |
| Secret Actions, alternative au jeton | `VITE_TMDB_API_KEY` | Clé API v3 TMDB |

Les valeurs `VITE_` sont intégrées au JavaScript public du site, y compris celles issues des secrets GitHub. Cela ne doit contenir que les identifiants client prévus pour cet usage. Les politiques RLS existantes protègent les collections ; les secrets serveur n’ont aucune place dans ce build. Relancer le workflow après avoir changé ces valeurs.

## 4. Plus tard : vela.thomasbarial.com

Le code utilise des chemins relatifs : le même build fonctionne dans `/letterbox-series/` et à la racine d’un domaine personnalisé. Aucun fichier CNAME n’est imposé maintenant pour conserver l’URL GitHub Pages utilisable.

Quand le DNS est prêt : renseigner `vela.thomasbarial.com` dans **GitHub → Settings → Pages → Custom domain**, puis, côté Cloudflare, créer le CNAME `vela` vers `cax-corp.github.io` — sans `https://` ni `/letterbox-series/`. Commencer en **DNS only** le temps de la vérification et du certificat GitHub, puis activer **Enforce HTTPS** lorsqu’il est disponible. La vérification éventuelle de propriété du domaine se fait avec les valeurs fournies par GitHub, pas avec une valeur inventée dans le projet.

Ajouter ensuite `https://vela.thomasbarial.com/` aux URL autorisées de Supabase et l’utiliser comme Site URL. Le nouveau domaine constitue une nouvelle origine : se reconnecter et, si nécessaire, remettre la configuration dans ses réglages. Les données sauvegardées dans le même compte Supabase se restaurent. La synchronisation des liens de partage et l’ouverture automatique de l’APK restent une tâche ultérieure.
