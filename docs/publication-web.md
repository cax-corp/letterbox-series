# Mettre Vela en ligne sur GitHub Pages

La version web contient les fonctions du Vela 2.1 actuel : films/séries, recherche TMDB, collection, notes et avis, profils et avatars prédéfinis, statistiques et sauvegardes Supabase. Les recommandations personnalisées « Pour vous » sont réservées à l’application mobile pour le moment ; le site affiche un message et propose le téléchargement de l’APK Android. Elle adapte la navigation au PC et au mobile. Les notifications programmées quand l’app est fermée restent une fonction de l’APK Android ; le site ne prétend pas les envoyer navigateur fermé.

Les fiches, profils et avis se partagent par liens publics sans image. Depuis 2.3.2, l’APK utilise par défaut `https://vela.thomasbarial.com/`. Les liens conservent les mêmes fragments et identifiants Supabase ; aucun nouveau script SQL n’est nécessaire pour ce changement de domaine. Les Android App Links ne sont pas configurés.

## Quel fichier utiliser ?

- **Vela-GitHub-source.zip** : projet complet, avec le code, les avatars et le workflow de publication. À importer à la racine de `cax-corp/letterbox-series` si les sources n’y sont pas déjà importées. C’est l’archive à utiliser pour la méthode recommandée ci-dessous.
- **Vela-site-web.zip** : site déjà compilé (`index.html`, `assets`, `brand`, `downloads` (APK Android), licences et `.nojekyll`). À garder comme copie prête à héberger sur un serveur statique. Ce ZIP n’est pas un fichier à déposer tel quel dans GitHub : GitHub ne le décompresse pas. Il ne remplace pas les sources du projet configuré pour compiler avec Actions.

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

TMDB et le projet Supabase de Vela sont préconfigurés dans le site et l’APK depuis 2.1. Aucune clé ni URL n’est à saisir pour utiliser Vela.

1. Dans l’APK, se connecter au compte habituel puis ouvrir **Profil → Synchroniser** pour envoyer les derniers changements.
2. Sur le site publié, cliquer sur **Se connecter** et utiliser le même compte.
3. La synchronisation récupère la collection et le profil du compte. Le bouton **Synchroniser** reste disponible.

Le catalogue fonctionne sans compte. Le profil personnel et les recommandations personnalisées de l’APK demandent une connexion. La collection locale reste disponible, et les données anonymes ne sont pas importées silencieusement dans un compte. Sur le web, « Pour vous » reste en développement et propose le téléchargement Android.

Les anciennes configurations personnalisées sont conservées. Pour gérer un autre projet, ouvrir **Réglages → Configuration avancée des services**. Réinitialiser la configuration locale restaure celle de Vela.

Les réglages et sessions du navigateur sont distincts de ceux du téléphone. Ils ne sont pas copiés depuis l’APK. Les profils et collections des comptes restent séparés des données anonymes. Aucun nouveau script SQL n’est nécessaire pour un projet déjà configuré avec Vela.

Dans **Supabase → Authentication → URL Configuration**, définir l’adresse publiée comme **Site URL** et ajouter l’URL de retour exacte `https://cax-corp.github.io/letterbox-series/` dans les **Redirect URLs**. Les inscriptions web demandent un lien de confirmation vers la base du site courant. Se connecter avec un compte déjà confirmé ne nécessite pas de recréer le compte.

## Configuration facultative lors du build

La configuration publique Vela est intégrée dans `src/service-config.ts`. Pour un déploiement différent, le workflow accepte les substitutions suivantes :

| Réglage GitHub du dépôt | Nom | Valeur |
| --- | --- | --- |
| Variable Actions | `VITE_SUPABASE_URL` | URL du projet existant |
| Variable Actions | `VITE_SUPABASE_ANON_KEY` | Clé publique Supabase |
| Secret Actions | `VITE_TMDB_READ_TOKEN` | Jeton de lecture TMDB |
| Secret Actions, alternative au jeton | `VITE_TMDB_API_KEY` | Clé API v3 TMDB |

Les valeurs `VITE_` sont intégrées au JavaScript public du site, y compris celles issues des secrets GitHub. Cela ne doit contenir que les identifiants client prévus pour cet usage. Les politiques RLS existantes protègent les collections ; les secrets serveur n’ont aucune place dans ce build. Relancer le workflow après avoir changé ces valeurs.

## 4. Domaine personnalisé : vela.thomasbarial.com

Le code utilise des chemins relatifs : le même build fonctionne dans `/letterbox-series/` et à la racine d’un domaine personnalisé. Aucun fichier CNAME n’est imposé maintenant pour conserver l’URL GitHub Pages utilisable.

Quand le DNS est prêt : renseigner `vela.thomasbarial.com` dans **GitHub → Settings → Pages → Custom domain**, puis, côté Cloudflare, créer le CNAME `vela` vers `cax-corp.github.io` — sans `https://` ni `/letterbox-series/`. Commencer en **DNS only** le temps de la vérification et du certificat GitHub, puis activer **Enforce HTTPS** lorsqu’il est disponible. La vérification éventuelle de propriété du domaine se fait avec les valeurs fournies par GitHub, pas avec une valeur inventée dans le projet.

Ajouter ensuite `https://vela.thomasbarial.com/` aux URL autorisées de Supabase et l’utiliser comme Site URL. Le nouveau domaine constitue une nouvelle origine : se reconnecter et, si nécessaire, remettre la configuration dans ses réglages. Les données sauvegardées dans le même compte Supabase se restaurent. Les nouveaux liens partagés par l’APK 2.3.2 utilisent ce domaine par défaut. L’ouverture automatique de l’APK reste une tâche ultérieure. Une substitution `VITE_PUBLIC_SITE_URL` reste possible pour un autre déploiement ; elle doit utiliser la nouvelle adresse pour ce site.


## Reconstruire le site localement

Avec Node 22 : `npm ci`, puis `npm run build:web`. Le dossier `dist` contient le site et le téléchargement Android. `npm run build` produit les seules ressources de l’application, sans ajouter la copie de l’APK à l’intérieur de celle-ci. Les fichiers de téléchargement sont décrits dans `downloads/README.md`.


## Tests isolés

Playwright démarre un serveur Vite en mode `test` sur 5173 pour les cas historiques sans services configurés, et un serveur normal sur 5174 pour tester le démarrage préconfiguré, la connexion et les accès au profil/feed. Les appels sont interceptés avec des réponses contrôlées : les tests ne créent pas de vrais comptes et ne lisent pas les données de production. Le mode test ne doit pas être utilisé pour compiler le site distribué.
