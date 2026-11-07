# Vela

**Les histoires passent. Les émotions restent.**

Depuis la version 1.8.1, l’application se nomme **Vela** et retrouve l’identité sobre de Luma : mot-symbole compact avec point bleu et icône V avec point bleu. La mention « A CAX Corporation company », avec le logo fourni, reste uniquement dans les paramètres. Les identifiants Android et de stockage restent stables pour conserver données et autorisations à la mise à jour.

Application personnelle de films et séries, en français : site statique GitHub Pages et APK Android embarquant le même site avec Capacitor. Interface inspirée de Material Design 3 avec composants de navigation et icônes Material. Neuf palettes coordonnées, à choisir dans Réglages → Apparence → Palette de couleurs : Bleu original, Champagne, Iris grisé, Bleu ardoise, Émeraude, Corail, Rubis, Cuivre et Argent. Le bleu d’origine reste le choix par défaut (`#009FE3`, fond sombre `#001620`, fond clair `#F6FCFF`). Chaque palette adapte les fonds, surfaces, textes, boutons, transparences, logo et favicon. Barres supérieure et inférieure translucides avec flou d’arrière-plan, fond légèrement lumineux et flou derrière les fenêtres. Les surfaces de lecture restent contrastées, sans contours brillants ni filtres de réfraction. Les WebViews sans prise en charge du flou conservent un fond opaque. Navigation mobile fixe pleine largeur : Découvrir, Explorer, Pour vous, Collection, Profil ; recherche dans Explorer uniquement.

La palette se mémorise **sur l’appareil**, indépendamment du compte et du mode Sombre/Clair/Système. Aucun sélecteur libre ni stockage d’image n’est utilisé. Un script inline généré depuis `src/colour-themes.json` restaure les couleurs avant le premier affichage. Le script `npm run themes:generate` produit les SVG, vecteurs/adaptive icons Android et rôles natifs depuis la même source ; il est exécuté avant chaque build.

Sur Android, le changement d’icône utilise des alias de lanceur, appliqués à la sortie de l’application pour éviter de fermer l’écran des réglages. Une seule entrée reste activée ; `MainActivity` reste disponible pour les notifications. Le délai de rafraîchissement dépend du lanceur. Si les icônes thématiques Android sont activées, leurs couleurs sont celles du système. La signature et l’identifiant Android sont conservés pour permettre une mise à jour par-dessus l’ancienne version.

Le thème se choisit dans Réglages : Sombre, Clair ou Système. Le bouton soleil/lune en haut permet aussi de basculer directement. Sur Android, Capacitor SystemBars et le plugin local LumaAppearance adaptent les icônes d’état et de navigation au thème effectif, y compris au retour dans l’app. Sur Android 15+, les fonds des barres transparentes sont peints par l’application avec les insets du système. Sur Android 7.0/7.1, la barre de navigation système conserve un fond sombre car Android ne permet pas encore ses icônes noires ; la barre d’état et le contenu suivent le thème normalement.

## Fonctionnalités

- Catalogue principal TMDB (clé gratuite pour usage non commercial) : films et séries, recherche paginée, titres français/originaux, fiches et synopsis en français, affiches et arrière-plans.
- iTunes Search et TVmaze conservés pour les anciennes fiches et le catalogue limité sans configuration.
- Genres, notes attribuées à leur source (TMDB ou TVmaze), extraits iTunes, liens de bandes-annonces YouTube et fiches IMDb lorsque TMDB les fournit.
- Liste à voir, favoris, notes sur 5, critiques privées et date de visionnage.
- Page **Pour vous** dans l’application mobile (message d’indisponibilité et téléchargement Android sur le web) : fil de recommandations virtualisé, défilement continu, double-tap À voir, rejet persistant et ajout à la liste.
- Notifications Android à heure/jours choisis ; ouverture animée des fiches.
- Listes nommées personnalisées : saisir les noms séparés par des virgules dans la fiche.
- Suivi des épisodes par saison, avec progression.
- Sauvegarde locale, export/import JSON ; partage de sauvegarde natif sur Android.
- Authentification e-mail/mot de passe et synchronisation Supabase facultatives.
- Thèmes sombre/clair/système, navigation Material, dialogues clavier, réduction des animations et polices embarquées.

Vela réunit un catalogue de films/séries, une collection personnelle et des recommandations adaptées aux favoris et aux notes. Les résultats dépendent de TMDB lorsqu’il est activé. Le mode sans clé reste limité aux anciens fournisseurs.

## Démarrer

Node 22+ (24 fonctionne), npm. Le checkout existe déjà dans `/workspace/letterbox-series` ; ne créez pas de worktree.

```bash
npm ci
npm run dev
```

Production web : `npm run build:web`. Le dossier `dist/` est autonome et inclut le téléchargement Android. Le build embarqué Android utilise `npm run build`. TMDB et Supabase sont préconfigurés dans les distributions Vela 2.1 ; aucune clé n’est nécessaire côté utilisateur. Sans clé, le catalogue limité iTunes/TVmaze reste utilisable et l’application propose d’activer TMDB. Une connexion Internet est nécessaire pour charger les fiches ; les données de collection déjà enregistrées restent accessibles hors ligne.

## Pour vous : fil continu et réactions

Le fil est rechargé à chaque visite, au redémarrage et au retour depuis l’arrière-plan. Le moteur de contenu local utilise tous les likes, notes et refus : proximité de synopsis TF-IDF, genres et couples de genres, époques, exemples négatifs et diversification entre familles de goûts. Les sources de voisins tournent entre les favoris et les nouvelles préférences interviennent immédiatement dans la suite du fil. Le calcul se déroule dans un worker local séparé de l’interface et ne demande aucun serveur payant. [Algorithme et limites](docs/recommendation-engine.md).

Un registre quotidien local exclut strictement les cartes majoritairement affichées jusqu’à minuit, y compris après fermeture. Il ne recycle pas les plus anciennes après 300 vues. Une carte seulement préchargée n’est pas considérée comme affichée ; les cartes masquées derrière une fiche ne le sont pas non plus. Le cache de candidats et ses curseurs servent à reconstruire un classement, pas à reprendre une playlist à la troisième carte. Si les sources n’ont plus de nouveauté, la fin est annoncée sans doublon. Le registre est lié au compte sur cet appareil et au maintien des données locales.

La navigation ouvre directement un fil de cartes, sans grand titre visible, avec la même barre supérieure que les autres pages. La carte tient dans la hauteur disponible entre les barres de l’application, avec des marges et des coins arrondis. Sur les écrans courts, le synopsis est masqué pour garder les boutons accessibles. Le fil précharge la suite lorsqu’il reste quatre cartes, à partir de la position courante et sans dépendre d’une sentinelle virtualisée, sans bouton « Varier ». Le défilement s’arrête sur chaque carte : ancrage CSS obligatoire avec `scroll-snap-stop: always` pour le tactile, une carte par geste de molette/trackpad, et navigation au clavier par flèches, Page précédente/suivante ou Espace. Les marges et la navigation restent visibles ; la virtualisation et le chargement de la suite sont conservés. Les pages TMDB sont réellement parcourues ; les films ne sont pas recyclés pour simuler une infinité. Lorsque toutes les pages sont épuisées, ou que le catalogue limité sans clé n’a plus de résultat, la fin est annoncée. En cas de panne, les cartes restent disponibles et une action permet de réessayer la même page. Après plusieurs pages sans film inédit, une action de continuation évite de lancer des centaines de demandes inutiles.

Le halo et les boutons reprennent la couleur majoritaire du recadrage de l’image affichée ; le fond conserve la palette choisie. Les nuances proches sont regroupées selon leur surface, sans favoriser une petite zone bleue saturée. Dans l’APK, les octets sont lus par CapacitorHttp puis décodés localement ; sur le web, une requête CORS avec rechargement évite le cache opaque des balises image. Une image illisible ne produit aucun halo inventé, et les boutons restent neutres. Le halo est une ombre de décalage nul sur tout le contour de la carte, avec une diffusion identique sur les quatre côtés ; le reste du fond garde sa couleur normale. Le halo et l’ombre gardent leur couleur pendant le geste. À l’arrêt, leur couleur passe directement à celle de la nouvelle carte en 170 ms, sans disparition intermédiaire ; la teinte précédente reste affichée pendant le décodage de la suivante. Dans Pour vous, les barres supérieure et inférieure gardent leur taille mais sont transparentes, sans remplissage, flou ni copie de l’affiche. Seul le halo de la carte se diffuse sur le fond normal du thème, derrière les commandes. Les autres pages conservent leurs surfaces translucides. La préférence de mouvement réduit supprime les transitions.

Le rendu est virtualisé avec TanStack Virtual : seules les cartes proches de l’écran sont montées, les images sont chargées à la demande. Les curseurs des sources TMDB avancent indépendamment ; une source en panne garde son numéro de page. La mise à jour des goûts ne remet pas le fil en haut : elle sert aux prochaines pages.

- **Double-tap / double-clic sur la carte** : ajout à À voir, avec un marque-page animé. Le bouton marque-page fournit la même action au clavier ou en un clic. Le cœur est un coup de cœur explicite, distinct d’une envie de visionnage. La carte reste à sa place.
- **Je n’aime pas** (pouce baissé) : la réaction est conservée et le film disparaît du fil ; ses genres ont une influence négative. Les réactions sont enregistrées dans la collection et synchronisées par le même JSON Supabase, sans nouveau schéma.
- Une réaction explicite récente prend le dessus sur une ancienne note contradictoire pour le classement, en conservant la note historique. Modifier la note dans la fiche retire cette réaction prioritaire ; les favoris suivent toujours leur bouton habituel.
- Un glissement de scroll n’est pas un double-tap, et les boutons de la carte ne déclenchent pas le geste.
- **Détails** ouvre la fiche avec un fondu et une transition de position/échelle. Le réglage système de réduction des animations est respecté.

Les favoris et notes de 4–5 étoiles apportent des signaux forts, les notes de 1–2 étoiles des signaux négatifs. Un film vu sans note pèse peu ; une simple liste à voir ne vaut pas une appréciation. Les séries aimées contribuent aux préférences de genres des films. Les films déjà vus/notés/favoris et ceux explicitement rejetés sont exclus des futures suggestions ; les anciens fournisseurs sont rapprochés par titre normalisé et année concordante. Les remakes distincts restent séparés.

Avec TMDB, les candidats viennent de références appréciées en rotation (deux par lot), de découvertes par genres/époques, de listes populaires ou bien notées et des tendances. Le rapprochement d’un ancien favori iTunes exige un seul résultat exact sur nom/année. Le classement reste sur l’appareil ; TMDB reçoit les identifiants/titres de départ et les genres demandés, mais aucune note personnelle ni texte de critique. La clé TMDB déjà configurée continue de servir. Sans historique, la sélection est fondée sur la découverte. Les critiques et dates restent dans **Ma collection → Vus → fiche**.

## Passages rapides dans Pour vous

Depuis 1.9.1, quitter rapidement une carte par un scroll vers l’avant fournit un signal négatif léger au moteur local. Il est séparé des notes et des « Je n’aime pas » : plusieurs passages sur des films similaires réduisent doucement leur priorité, avec un effet plafonné qui s’estompe. Lire longtemps, ouvrir une fiche, mettre en liste, aimer, revenir en arrière, quitter l’onglet ou mettre l’app en arrière-plan ne fabrique pas un refus. Les cartes préchargées ne comptent pas. Les signaux sont conservés sur cet appareil et par compte, sans écriture Supabase ni requête catalogue supplémentaire pour le reclassement. [Règles et pondération](docs/recommendation-engine.md#passages-rapides-depuis-191).

## Profil et partage

Depuis Vela 2.0, **Profil → Modifier mon profil** est une page complète avec retour Android/navigateur : nom affiché, bio courte, initiale ou 28 visages et personnages dessinés en SVG et embarqués dans l’app, dix fonds dont deux liés au thème et jusqu’à quatre incontournables ordonnés parmi les titres de la collection. Les incontournables sont distincts des likes. Aucun import de photo personnelle ni bucket d’images Supabase n’est proposé.

Les choix sont conservés sur l’appareil, par projet et compte. Connecté avec Internet, Enregistrer mon profil synchronise les petites métadonnées via `auth.updateUser` dans `user_metadata.vela_profile`. Hors ligne ou en cas d’échec, la copie locale reste disponible et le prochain passage de sauvegarde reprend le profil. La connexion hydrate aussi le profil renvoyé par Supabase. Aucun SQL supplémentaire n’est requis. Les statistiques sont recalculées depuis la collection, sans duplication sur le serveur.

Le profil affiche films/séries vus, moyenne des notes, avis et activité. Les boutons de partage transmettent maintenant des **liens Vela**, jamais d’image : fiches complètes accessibles sans connexion, profils et avis publiés volontairement dans une table distincte, puis retirables dans les paramètres. Exécuter une fois [`supabase/public-sharing.sql`](supabase/public-sharing.sql) pour activer les profils/avis publics. La bibliothèque et les métadonnées Auth restent privées. [Détails](docs/profil-et-partage.md).

## Pays, services et distribution

Le pays est requis à la création de compte et modifiable dans les réglages. Les abonnements choisis et le pays sont synchronisés dans les métadonnées privées Supabase. Les fiches montrent les offres **dans Vela**, classées par abonnement, gratuit, publicité, location et achat, en affichant uniquement les services sélectionnés. La ligne « Disponible sur » montre uniquement les services cochés ; achat et location sont dans un volet dépliant. Les liens directs des plateformes et la recherche Wikidata sont retirés. Le bouton « Voir les acteurs » ouvre les portraits et rôles TMDB, sans héberger leurs images ni augmenter chaque sauvegarde. Les notes et avis ont un bloc compact ; l’éditeur d’avis, la date et les listes s’ouvrent sur demande. Aucune nouvelle clé n’est nécessaire. [Sources, limites et fonctionnement](docs/disponibilites-et-distribution.md).

## Sauvegarde Supabase

Vela 1.9 regroupe les modifications au lieu d’envoyer chaque like ou note. Une sauvegarde quotidienne réussie est effectuée au plus une fois toutes les 24 heures pendant l’utilisation, avec une lecture paginée de la collection et seulement les différences en écriture. Le mode hebdomadaire espace les sauvegardes de 7 jours ; le mode manuel désactive les envois automatiques. La connexion initiale restaure le compte au premier passage si la sauvegarde automatique est activée. Le bouton manuel force une synchronisation à tout moment et redémarre le délai depuis cette réussite.

Les paramètres et le profil affichent la dernière réussite et les modifications en attente. Une application fermée ne lance aucune tâche réseau de sauvegarde ; elle rattrape l’échéance à la prochaine utilisation. La copie Supabase conserve le dernier état et ne constitue pas un historique de versions : exporter un JSON pour une archive indépendante. La sauvegarde privée ne nécessite pas de changement de schéma ; le partage public possède sa migration distincte. [Fonctionnement détaillé](docs/sauvegarde-supabase.md).

## Notifications de recommandation — APK Android

Les paramètres sont une page complète (`#settings`), avec retour à la page précédente par le bouton Retour, le navigateur et le bouton Android. Dans **Réglages → Votre rendez-vous cinéma**, choisir une heure et les jours désirés, puis activer le rendez-vous. Les autorisations de notification et d’alarmes précises sont distinctes.

Le rappel utilise une **alarme Android**, exacte lorsque « Alarmes et rappels » est autorisé, avec repli en veille et tâche WorkManager de secours. Il publie directement une idée issue d’une réserve préparée au premier plan : **aucun réseau, aucune WebView et aucun moteur du feed ne tournent à l’heure de la notification**. Les changements de goûts ne déplacent plus l’alarme déjà programmée. La réserve épuisée donne un rappel ouvrant Pour vous.

Le mode **Fiabilité renforcée** utilise le mécanisme de réveil Android (`setAlarmClock`), avec une éventuelle icône de réveil dans le système, mais sans sonnerie. Sur Xiaomi/HyperOS, la page propose les écrans de **démarrage automatique** et de **batterie de Vela**. Si l’économiseur par application bloque encore le rappel, choisir **Pas de restriction** pour Vela ; l’économiseur général peut rester activé. Vela ne peut pas imposer ces autorisations constructeur.

**Tester maintenant** vérifie séparément la publication. Le volet de diagnostic indique le déclenchement natif, un éventuel retard et le résultat de la publication ; le rapport copiable ne contient ni catalogue, ni compte, ni clé API. Une publication acceptée par Android ne prouve pas son affichage par Xiaomi.

Le bouton **Tester dans 1 minute** permet de fermer l’app et de vérifier la réception. La page affiche le prochain rappel, le nombre d’idées en réserve, le dernier envoi et l’accès aux réglages Android des horaires précis et de batterie. Les alarmes sont restaurées au démarrage, après mise à jour et changement d’heure/fuseau. Les générations et cibles empêchent les anciens travaux et les doubles envois.

Un **arrêt forcé** dans Android suspend les rappels jusqu’à réouverture ; les restrictions propres aux constructeurs peuvent aussi intervenir. Le comportement réel du téléphone reste à vérifier avec le test intégré. Le site web seul ne programme pas de notification navigateur fermé. [Fonctionnement et vérification](docs/notifications-android.md).

## Activer le catalogue TMDB depuis l’APK

TMDB est le fournisseur principal lorsqu’une clé est configurée. La clé et le projet Supabase sont indépendants : Supabase sert à synchroniser la collection, TMDB fournit les métadonnées.

1. Créer un compte sur [TMDB](https://www.themoviedb.org/signup).
2. Dans le navigateur, ouvrir [Paramètres → API](https://www.themoviedb.org/settings/api), accepter les conditions et demander une clé développeur pour usage non commercial. Sur téléphone, activer « site pour ordinateur » si nécessaire.
3. Copier le **jeton de lecture API** (v4, recommandé) ou la **clé API v3** de 32 caractères.
4. Dans **Vela → Réglages → Catalogue TMDB**, coller cette valeur dans le champ masqué puis appuyer sur **Activer TMDB**. Ne pas envoyer la valeur dans ChatGPT.
5. Vela vérifie la clé contre `/3/configuration` avant de l’enregistrer sur l’appareil et de recharger le catalogue. Si la clé est refusée ou le réseau inaccessible, l’ancienne configuration est conservée et une erreur s’affiche.

La recherche interroge `/search/movie` et `/search/tv` en `fr-FR`, sans limitation à une boutique ou à un pays. Elle conserve les titres sans affiche et offre **Charger plus de résultats**. Les pages sont limitées au maximum permis par TMDB (500 par recherche et par type). Les tendances de la semaine alimentent la découverte. Les fiches enrichissent durée, genres, liens IMDb et vidéos ; une bande-annonce YouTube s’ouvre dans son lecteur externe, pas comme un fichier vidéo direct. Les épisodes TMDB sont chargés à l’ouverture d’une saison, avec une action de réessai indépendante si une saison échoue.

Les anciennes listes et critiques restent intactes. Les identifiants sont séparés : `movie-…` (iTunes), `series-…` (TVmaze), `tmdb-movie-…` et `tmdb-series-…`. Les anciens épisodes continuent d’utiliser TVmaze. Aucun rapprochement automatique approximatif ne risque d’attribuer une ancienne note à un autre titre ; un même film ajouté depuis deux fournisseurs peut donc apparaître deux fois. Mettre à jour le site et l’APK pour partager les nouvelles entrées TMDB entre appareils.

La clé reste dans la configuration de cet appareil et n’est pas incluse dans l’export de collection ni synchronisée dans Supabase. Il faut la configurer sur chaque appareil. Pour un build préconfiguré, `.env.local` accepte `VITE_TMDB_READ_TOKEN` ou `VITE_TMDB_API_KEY` ; les workflows lisent les mêmes noms dans les secrets GitHub. **Toute valeur `VITE_` est intégrée au client compilé et peut être récupérée**, même si elle provient d’un secret GitHub. Utiliser uniquement les identifiants de lecture du catalogue, jamais un identifiant de compte. Pour un service public nécessitant un secret serveur, placer TMDB derrière un proxy serveur plutôt que l’intégrer au build. Aucun identifiant réel TMDB n’est fourni dans ce dépôt.

L’application ne se rabat pas silencieusement sur iTunes si une clé TMDB configurée est refusée : le problème reste visible. Le bouton **Revenir au catalogue limité** désactive explicitement TMDB sur l’appareil.

## Publier sur GitHub Pages

La version web adapte la navigation au PC, à la tablette et au téléphone. « Pour vous » reste réservé à l’APK et propose son téléchargement sur le web. Les profils et paramètres gardent une largeur de lecture adaptée. Les fiches, profils et avis se partagent par liens publics consultables sans compte, sans image jointe.

1. Importer les sources à la racine de `cax-corp/letterbox-series`, branche `main`, si elles ne sont pas déjà présentes.
2. Dans **Settings → Pages → Build and deployment → Source**, choisir **GitHub Actions**.
3. Lancer **Actions → Deploy Vela to GitHub Pages → Run workflow** sur `main` ; le workflow teste, compile puis publie à chaque push sur cette branche.
4. Attendre la réussite du déploiement. Le site public est `https://vela.thomasbarial.com/` ; il n’est actif qu’après publication réussie.
5. Ouvrir les réglages du site pour utiliser le même projet Supabase et la même clé TMDB que dans l’APK, puis se connecter au même compte. Synchroniser d’abord l’APK pour retrouver ses changements récents.

`base: './'` permet le sous-répertoire GitHub Pages et un futur domaine personnalisé à la racine. La navigation interne utilise les fragments d’URL et n’exige pas de règle de réécriture serveur. `.nojekyll` est inclus dans la distribution. Le domaine personnalisé est `vela.thomasbarial.com`. Depuis 2.3.2, les liens partagés par défaut depuis Android utilisent `https://vela.thomasbarial.com/` pour les fiches, profils et avis. Les fragments et identifiants publics restent identiques ; aucune migration Supabase n’est nécessaire. Les Android App Links ne sont pas configurés par cette version.

[Guide d’import, publication, Supabase et futur domaine](docs/publication-web.md).

## Activer Supabase gratuitement

Aucun projet Supabase n’a été créé depuis cette session : le connecteur n’y est pas disponible.

1. Créer un projet sur Supabase.
2. Ouvrir **SQL Editor** et exécuter [supabase/schema.sql](supabase/schema.sql), qui est réexécutable. La table `library` est protégée par RLS : chaque utilisateur ne peut lire ou modifier que ses propres lignes.
3. Dans **Authentication → URL Configuration**, définir l’URL du site GitHub Pages comme **Site URL** et autoriser cette URL dans les redirections. Garder la confirmation e-mail activée. Après confirmation dans le navigateur, se connecter aussi dans l’APK avec le mot de passe.
4. Copier l’URL du projet et sa clé **publishable** (ou legacy **anon**). Jamais `service_role` ou une clé secret.
5. Dans Vela → Réglages, les saisir puis enregistrer. Ou créer `.env.local` à partir de `.env.example` avant compilation. Pour les builds GitHub, utiliser les variables de dépôt `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`. Ce sont des identifiants publics, la sécurité dépend des politiques RLS.
6. Profil → Se connecter → Créer un compte. Confirmer l’e-mail puis se connecter. Le même projet doit être configuré sur le web et Android.

La configuration saisie dans l’interface reste sur cet appareil. Les collections locales et celles de chaque compte sont séparées. Pour transférer une collection locale : l’exporter, se connecter puis l’importer. Les modifications sont enregistrées immédiatement sur l’appareil et regroupées pour une sauvegarde quotidienne dans Supabase par défaut. La fréquence se règle dans Réglages → Sauvegarde Supabase : quotidienne, hebdomadaire ou manuelle. L’intervalle est conservé entre les ouvertures, par compte/projet/appareil. Si Vela est fermé ou hors ligne à l’échéance, la sauvegarde attend la prochaine utilisation avec Internet. Seuls les éléments différents sont envoyés ; les données distantes plus récentes sont récupérées. Les échecs ne valident pas la sauvegarde et les tentatives automatiques sont espacées. Le bouton **Synchroniser** fusionne les modifications provenant d’un autre appareil ; en cas de conflit, la date de modification la plus récente gagne. Il n’y a pas de suppression physique synchronisée : les bascules retirent l’élément des listes concernées.

## Réparer « Could not find the table public.library in the schema cache »

La connexion à un compte ne crée pas automatiquement la table. Vela attend la table `public.library` dans le projet configuré dans ses réglages.

Depuis un téléphone Android :

1. Dans Vela → Réglages → **Corriger l’erreur public.library**, appuyer sur **Copier le script SQL**.
2. Dans le navigateur du téléphone, ouvrir le tableau de bord Supabase, sélectionner **le projet correspondant à l’URL affichée dans Vela**, puis **SQL Editor → New query**. Le mode « site pour ordinateur » du navigateur peut aider si l’éditeur est peu lisible.
3. Coller le script et appuyer sur **Run**. Il installe la table, ses autorisations, les politiques RLS et recharge le cache de schéma. Il est réexécutable et ne supprime pas les collections existantes.
4. Revenir dans Vela → Profil → **Synchroniser**. Attendre la confirmation ; en cas d’échec les données restent enregistrées sur l’appareil.

Aucune publication du site GitHub Pages n’est requise pour cette opération. Aucun secret ou mot de passe Supabase n’a à être envoyé dans ChatGPT. Le SQL ne peut pas être exécuté par l’APK avec la clé publique : cela nécessite le SQL Editor du propriétaire du projet. Une erreur de permissions distincte invite à réinstaller les politiques puis à se reconnecter. Le profil distingue désormais synchronisation en cours, réussie et échouée, et affiche un bouton de réparation en cas d’erreur.

## APK Android

Android 7+ (API 24), WebView récent recommandé. Le site est embarqué : aucune URL de site déployé n’est requise pour ouvrir l’application. Les catalogues et Supabase nécessitent Internet.

### Télécharger depuis GitHub

Exécuter **Actions → Build Android APK → Run workflow**. Télécharger l’artefact **Vela-Android-APK**, le décompresser puis ouvrir `app-debug.apk` sur le téléphone. Autoriser l’installation depuis cette source lorsqu’Android le demande. Cette version de test est signée par une clé de debug ; elle est installable sans compte Play Store.

Les runners GitHub peuvent utiliser une nouvelle clé de debug à chaque build. Pour des mises à jour durables sans désinstallation, configurer une signature release avec une clé conservée en lieu sûr avant distribution publique. Le workflow fourni n’est pas une publication Play Store.

### Compiler localement

Avec Android Studio, JDK 21 et SDK Android 36 :

```bash
npm ci
npm run android:sync
cd android
./gradlew assembleDebug --no-daemon --max-workers=2
```

Résultat : `android/app/build/outputs/apk/debug/app-debug.apk`.

Dans cet environnement cloud, les outils vérifiés sont conservés sous `/workspace/.luma-tools` et `bash scripts/build-apk.sh` reconstruit l’APK dans `/workspace/artifacts/Vela.apk` avec le proxy et la confiance TLS du système. `android/local.properties` est local et ignoré. L’APK peut s’installer avec `adb install -r Vela.apk` sur un appareil autorisé.

## Validation

```bash
npm run build
npm test
```

Les 105 tests Playwright utilisent Chromium et des réponses d’API contrôlées pour vérifier les listes, la persistance, les notes et critiques, les épisodes, l’affichage mobile, les thèmes et les erreurs réseau. Un test supplémentaire exerce le SDK Supabase avec authentification contrôlée : table manquante, enregistrement local pendant l’échec, guide SQL puis synchronisation après réparation simulée. Le fichier `playwright.config.ts` utilise `/usr/bin/chromium` dans ce cloud ; ailleurs définir `CHROMIUM_PATH` ou installer Chromium avec `npx playwright install --with-deps chromium` (sélection automatique en l’absence de Chromium système).

Les tests TMDB couvrent la pagination, les résultats sans affiche, l’authentification v3/v4, la validation/refus de clé, les fiches IMDb/vidéos, les saisons chargées à la demande, les erreurs et la conservation de la progression et des anciennes notes. Ces réponses sont simulées. Un vrai jeton et l’accès réseau sont requis pour une validation réelle de TMDB.

Les tests des recommandations vérifient les préférences, exclusions et réactions, la conservation des notes, la pagination automatique et sa reprise après erreur, la virtualisation, l’adaptation aux petits écrans, les vrais doubles-taps tactiles et les gestes de scroll, ainsi que l’animation des fiches et le mouvement réduit. Des tests supplémentaires vérifient une succession de 27 swipes à travers des pages de neuf résultats, la taille constante des barres transparentes, l’absence d’image floutée derrière elles et les couleurs prélevées dans les affiches, leur maintien pendant le geste puis un fondu direct de 170 ms à l’arrêt, sans perte d’opacité. La palette est aussi vérifiée avec un mélange de jaunes et une minorité bleue, des tons neutres, des refus CORS et un pont HTTP Android simulé ; les barres retrouvent leurs surfaces en quittant le feed et restent sans remplissage en clair comme en sombre. Deux tests vérifient qu’une grande impulsion de molette et un swipe tactile réel s’arrêtent à la première carte suivante, avec retour clavier. Les tests du contrôleur de notifications vérifient le refus d’autorisation, les horaires/jours, la désactivation et la mise à jour du contexte sans nouvelle permission ni texte de critique. Les réponses réseau sont contrôlées.

Les 29 tests natifs ciblés (JUnit et Robolectric API 34) vérifient le calendrier, la livraison native, la programmation en veille, le repli sans alarme exacte, le rappel sans activité, sa tâche de secours, les doublons, les permissions, la réserve vide, le test minute, le mode renforcé via réveil Android, sa désactivation, le test immédiat, les retards et les raccourcis Xiaomi avec repli. `bash scripts/test-android.sh` les exécute dans cet environnement ; ailleurs, utiliser le Gradle Android du projet. Un test d’exemple du squelette s’exécute également, sans valider les notifications. Les simulations ne prouvent pas la réception sur un téléphone physique.

L’intégration Supabase doit être testée avec un vrai projet avant d’affirmer que la synchronisation et les politiques RLS ont été validées en production. Une compilation APK et une vérification de signature ne constituent pas un test sur téléphone.

## Réseau et attribution

Le cloud doit autoriser `api.themoviedb.org` et `image.tmdb.org` pour TMDB, ainsi que `itunes.apple.com`, `api.tvmaze.com`, `static.tvmaze.com`, `*.mzstatic.com` et le domaine de votre projet Supabase (`*.supabase.co` dans le brouillon). Ces restrictions concernent la machine cloud, pas le réseau du téléphone ou du visiteur du site.

TMDB : [API et conditions](https://developer.themoviedb.org/docs/getting-started). This product uses the TMDB API but is not endorsed or certified by TMDB. Les notes TMDB ne sont pas des notes IMDb ; les liens IMDb sont uniquement des fiches externes.

TVmaze : [API et attribution CC BY-SA](https://www.tvmaze.com/api). iTunes : [Search API](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/). Les affiches et extraits restent la propriété de leurs ayants droit ; les liens vers leurs sources sont conservés. Les polices DM Sans et Manrope sont distribuées via Fontsource sous licence OFL. Aucun suivi publicitaire ni outil d’analytics ajouté.

## Fiches et hiérarchie visuelle

Les fiches films et séries prélèvent leur couleur dans l’affiche affichée avec le même décodeur que le fil. Le fond du dialogue, le voile, les boutons, les accents et l’ombre uniforme sur les quatre côtés en dérivent. Les rôles de couleur sont adaptés séparément aux modes sombre et clair ; les informations, avis et épisodes restent accessibles. Le titre principal d’accueil est plus grand et plus gras que le titre du film mis en avant (rapport supérieur à 1,4 sur mobile).

Les vérifications incluent le renouvellement après changement d’onglet, rechargement et reprise simulée de l’app, avec conservation des réactions, ainsi que les fiches films/séries sous les deux thèmes et la hiérarchie mobile. Les données API et le retour de visibilité sont contrôlés dans Chromium.

## Architecture et taille de l’APK

Vela est une application hybride Capacitor : interface React/HTML/CSS embarquée dans l’APK, affichée par la WebView Android du téléphone, et fonctions natives Java pour l’apparence, les notifications et la planification, plus les plugins fichiers/partage. Elle n’exige pas la publication du site pour s’ouvrir. Ce n’est pas une interface Kotlin native. Le moteur de classement local est du code et de petites structures calculées à partir des métadonnées, sans gros modèle préentraîné embarqué. La WebView est fournie par Android ; les affiches sont téléchargées au fil de l’usage. L’APK peut donc peser environ 5–6 Mo tandis que les données et caches occupent ensuite de l’espace séparément.

## Accueil personnalisé

Le titre mis en avant et les rayons de films/séries utilisent un classement léger : affinités de genres, époques, qualité publique avec valeur neutre si absente, liste à voir et préférence pour les découvertes plutôt que les titres déjà connus. Les métadonnées du catalogue et de la réserve locale sont réutilisées. L’accueil réagit aux likes sans lancer le worker du feed ; les séries aimées peuvent influencer les films et inversement.


### Disponibilité de « Pour vous » sur le web

Le bouton « Pour vous » reste visible mais le site indique que les recommandations personnalisées sont en cours de développement sur le web. Cette page propose le téléchargement direct de la version Android 2.1.0, sans faux lien vers un store. Le feed et son moteur local restent disponibles dans l’APK.

Pour préparer le site avec ce téléchargement : `npm run build:web`. Le workflow Pages utilise cette commande. Le fichier de l’APK est conservé dans `downloads/`, hors de `public/`, et copié seulement après le build web pour ne pas être embarqué dans les builds Android suivants.


## Services préconfigurés depuis 2.1

Le site et l’APK embarquent les identifiants client publics TMDB et Supabase de Vela dans `src/service-config.ts`. Le catalogue fonctionne immédiatement. Le profil, les sauvegardes du compte et la personnalisation de l’accueil/feed nécessitent une connexion ; les recommandations web restent en développement.

Les configurations locales valides sont prioritaires pour conserver les projets existants, et les variables de build restent disponibles pour un autre déploiement. Les anciennes préférences TMDB vides reviennent à la configuration Vela. Les formulaires techniques sont regroupés dans les réglages avancés. Aucune clé serveur Supabase n’est utilisée. Les collections restent sous RLS, les sessions appartiennent à chaque utilisateur, et aucune donnée anonyme n’est transférée silencieusement à un compte.

Le mode test de Vite isole les cas historiques sans identifiants. Les tests du démarrage préconfiguré utilisent un serveur normal séparé et le vrai SDK avec réponses contrôlées.

## Ajustement 2.2.1

Le feed garde uniquement le halo autour de la carte sur le fond normal de la palette. Les deux barres sont transparentes, sans backdrop-filter et sans copie floutée de l’affiche ; leurs dimensions et les commandes sont conservées.

Le comportement de récence déjà présent est conservé : les préférences positives récentes pèsent davantage (décroissance douce sur 90 jours, mémoire longue conservée), les graines sont ordonnées par date de préférence et chaque nouveau like recalcule le fil. Le cache des candidats expire au changement de journée ; les propositions consultées sont exclues de la journée. Les skips perdent la moitié de leur influence en sept jours et expirent au bout de trente jours. Aucun titre n’est supprimé de la collection pour son ancienneté. Un test compare deux goûts de même force et vérifie que le plus récent passe devant, sans modifier l’historique.

## Avatars Vela 2.3.3

La collection comprend 24 visages expressifs et quatre personnages redessinés en vecteurs (chat, robot, fantôme, astronaute), plus l’initiale. Aucun portrait raster, chargement externe ou import personnel. Dix fonds sont proposés, dont la couleur et une nuance du thème actif. Les identifiants historiques sont conservés pour retrouver les profils existants ; seuls les identifiants des avatars et des fonds sont synchronisés.

Pour un projet Supabase déjà configuré, exécuter une fois [supabase/avatar-presets.sql](supabase/avatar-presets.sql) dans le SQL Editor pour autoriser les nouveaux choix dans les profils et avis publics. Ce script est réexécutable : il étend la validation sans supprimer de table, de lien ni de politique RLS. Les nouveaux projets utilisent directement `supabase/public-sharing.sql`, qui contient les mêmes identifiants.

## Premier démarrage Android — Vela 2.4.0

L’APK présente un accueil en trois volets à la première ouverture sans session : catalogue et plateformes, recommandations personnalisées, collection et sauvegardes. Le carrousel se parcourt par boutons, clavier ou geste horizontal. Les boutons Créer un compte et Se connecter ouvrent des formulaires intégrés à cette page. Le pays reste obligatoire à l’inscription ; la confirmation par e-mail est expliquée avant la connexion. Explorer sans compte donne accès au catalogue et mémorise la fin du parcours sur cet appareil (`vela-welcome-v1`). Le parcours n’est pas répété après une mise à jour ou une déconnexion une fois terminé.

La session Supabase est restaurée avant d’afficher cet accueil, pour qu’un compte déjà connecté entre directement dans l’application. Les liens publics ouvrent directement leur contenu, et le site conserve son accès direct au catalogue. L’accueil suit les neuf palettes, les modes clair/sombre, les zones système Android et la préférence de mouvement réduit. Il ne demande aucune autorisation de notification. Aucun nouveau script SQL n’est requis pour ce parcours.

## Vela 2.5 — Réglages et goûts synchronisés

Dans le SQL Editor du projet existant, exécuter une fois [supabase/account-state.sql](supabase/account-state.sql). Ce script réexécutable ajoute la table privée `vela_private_state` et une fonction de fusion authentifiée, sans toucher à la bibliothèque, aux profils ou aux liens publics existants. Les politiques RLS séparent chaque compte ; aucun accès anonyme n’est accordé. Les réglages sont horodatés séparément pour éviter qu’une ancienne sauvegarde de palette écrase un nouvel horaire.

La palette, le mode sombre/clair/système, la fréquence des sauvegardes et les notifications (activation, heure, jours) sont sauvegardés sur le compte. Les modifications des réglages sont regroupées après une courte pause ; la connexion, le retour en ligne et la reprise après arrière-plan récupèrent les valeurs distantes. Le pays, les services et le profil restent synchronisés par leurs mécanismes existants. Les autorisations Android restent propres au téléphone : la restauration d’un horaire ne déclenche aucune demande d’autorisation automatique.

Les notes, coups de cœur, refus et listes restent sauvegardés via `public.library`. Les passages rapides sont désormais inclus dans la sauvegarde des goûts, à la fréquence quotidienne, hebdomadaire ou manuelle choisie. Ils restent faibles, décroissent et expirent après trente jours ; seules les différences sont envoyées, au plus 120 signaux, sans images. Aucun envoi réseau n’est déclenché à chaque scroll. La copie locale reste nécessaire au fonctionnement hors connexion ; les pools du catalogue et historiques d’affichage restent des caches locaux, sans être confondus avec des notes ou des refus.

Les réglages n’exposent plus les tests de notifications, diagnostics ou conseils Xiaomi/HyperOS, ni l’option de fiabilité renforcée. La synchronisation conserve seulement une fréquence, un état et un bouton manuel. La page **Réglages → Carte de mes goûts** construit à la demande une représentation 3D interactive des titres et genres : rotation, zoom, filtres, recherche et inspection des signaux. Les liens entre titres utilisent les mêmes genres et vecteurs de synopsis que le modèle. Les distances sont illustratives, pas des probabilités. Au plus 300 titres représentatifs sont dessinés pour conserver une interface fluide ; les autres restent consultables par recherche.

Le classement équilibre les familles de goûts, les références et les sagas tout en conservant chaque favori existant. Un double-tap ajoute à À voir, signal faible qui n’est pas une nouvelle référence de film apprécié. Découvrir réduit progressivement la priorité d’une carte réellement affichée puis ignorée lors des visites suivantes, sans lui attribuer de mauvaise note. Le modèle, le classement et la carte fonctionnent sur l’appareil ; aucun serveur de calcul ni API supplémentaire n’est nécessaire.

### Carte SF et accès web — 2.5.1

La carte est accessible sur **PC et Android** dans **Réglages → Carte de mes goûts → Démarrer la carte**. Une session connectée utilise sa bibliothèque restaurée depuis Supabase ; le mode de test local reste indépendant. Les points ne sont pas inventés : titres, genres, notes, favoris, envies et passages rapides alimentent le graphe. Les liens de similarité utilisent les caractéristiques de genres et synopsis partagées avec le classement local. La disposition 3D et la séquence de démarrage sont une mise en scène, pas une lecture mentale ni une probabilité de compatibilité.

Le démarrage ouvre un terminal SF plein écran, indépendant de la palette de l’application. L’introduction dure environ deux secondes, peut être passée et est supprimée quand le système demande des animations réduites. Les contrôles de rotation, zoom, recherche, filtres et inspection restent disponibles. Quitter le terminal restaure l’apparence et la navigation habituelles, y compris les icônes système Android.

Le sound design utilise de courtes notes synthétisées par Web Audio, sans fichier téléchargé, microphone ni boucle sonore. Aucun son avant une action explicite. Le bouton **Son** mémorise son état sur l’appareil ; l’audio est fermé en quittant la carte ou en masquant l’onglet. Si Web Audio est indisponible, la carte reste fonctionnelle. Aucun retour haptique n’est ajouté dans cette version.

Les captures des tests sont enregistrées dans les dossiers de résultats Playwright et non dans un chemin absolu de l’environnement de développement. Le workflow Pages conserve les rapports des tests en échec pour permettre le diagnostic. La migration privée de 2.5.0 (`supabase/account-state.sql`) reste la seule étape SQL nécessaire ; aucun nouveau script pour 2.5.1.

### Carte bleue et réseau organique — 2.5.2

La carte adopte une ambiance spatiale bleu électrique. Le réseau ne repose plus sur des repères fixes à la surface d’une sphère : les liens réels entre genres et titres forment des amas et ramifications en volume, par ressorts de longueur finie, répulsion et centrage doux. La mise à l’échelle conserve les distances relatives. Les étoiles du fond sont décoratives et distinctes des points personnels sélectionnables.

La rotation utilise une orientation 3D composée autour des axes de l’écran. Le premier plan suit le doigt vers la droite/gauche et le haut/bas, même après avoir retourné le réseau ; il n’y a plus de mélange d’axes ni de butée de latitude. Le zoom à deux doigts reste disponible. La perspective, la taille et l’atténuation rendent l’arrière-plan moins présent. Une sélection souligne ses liens et les noms proches, avec limitation des étiquettes qui se chevauchent.

Le cadre de focus natif du SVG est retiré. Le clavier reste utilisable : flèches et +/−, contour bleu discret et rappel des commandes uniquement lors de la navigation au clavier. Les boutons conservent leurs indicateurs de focus.

Le moteur de recommandations continue d’utiliser toute la bibliothèque, sans plafond de 170 ou 300 favoris. Le dessin passe de 120 à **300 points personnels** ; les compteurs distinguent points affichés et titres disponibles. La recherche et le sélecteur ne tronquent plus à 250 titres. Sélectionner un titre hors de l’échantillon l’intègre au dessin, tout en conservant la limite de rendu. Aucun changement de données Supabase ni de favoris.

### Langues du compte et mention de développement — 2.6.0

**Français (`fr-FR`)** et **English (US) (`en-US`)** sont disponibles à l’inscription et dans Réglages → Langue de l’application. La sélection est conservée dans les métadonnées privées du compte Supabase, sous `vela_language` (code, version et date), avec une copie hors connexion par compte/projet. Aucune nouvelle migration SQL n’est nécessaire. Les pays et abonnements restent des choix indépendants : une interface anglaise peut conserver des offres françaises.

L’interface utilise un dictionnaire local de traductions explicites, sans service de traduction ni transformation du DOM. Les textes d’accessibilité, les dates, les pays, le parcours d’accueil, les réglages, le profil, les liens publics et la carte suivent ce choix. Les avis, noms affichés et biographies des utilisateurs restent inchangés. Les raisons du moteur local sont traduites à l’affichage, sans modifier ses caractéristiques ni ses scores.

Les requêtes TMDB demandent la langue choisie pour les titres, synopsis, genres et épisodes. Un changement recharge catalogue/recherche/fiches et empêche une réponse tardive de la langue précédente de les remplacer. Les pools de recommandations sont séparés par langue ; l’historique des titres déjà affichés reste commun au compte pour conserver l’exclusion quotidienne. Les anciennes entrées de collection et pages partagées restent leurs instantanés d’origine ; ouvrir une fiche TMDB récupère les informations dans la langue courante. Les sources externes ne fournissant pas toutes les traductions peuvent conserver leur texte original.

La langue se restaure à la connexion, puis à la reprise/au retour du réseau, et les modifications sont envoyées immédiatement. Un échec conserve le choix local et propose une nouvelle tentative. Les écritures ne concernent que la clé `vela_language`, sans remplacer profil, pays ou services. Les programmations Android gardent leurs heures/jours ; le contexte des notifications transporte la langue et leurs textes restent localisés lorsque l’application est fermée.

Le pied de page des paramètres comporte une mention discrète : « ChatGPT a été utilisé pour accompagner le développement de Vela. » Elle n’est affichée sur aucune autre page.


### Atlas stellaire des goûts — 2.7.0

La carte des goûts occupe tout l’écran sur Android et sur le web. Une nébuleuse originale calculée localement, une poussière stellaire en parallaxe et des étoiles avec profondeur remplacent le cadre de la précédente vue. Les étoiles sélectionnables et les routes viennent toujours de la bibliothèque et des relations de genres/synopsis ; le décor ne crée ni données de goûts ni recommandations.

Le mode **Déplacement** explore la carte au doigt, à la souris ou au clavier ; **Rotation** change l’angle de vue. Le pincement, la molette et les boutons contrôlent le zoom. La recherche permet de rejoindre chaque titre, même hors des 300 points représentatifs. Une mini-carte permet de revenir à la vue d’ensemble. La sélection centre le titre et ses connexions ; sur téléphone, sa fiche se déplie à la demande pour préserver l’espace de navigation.

Le décor Canvas est redessiné uniquement à l’entrée, à la reprise, au redimensionnement et pendant les mouvements. Il n’y a pas d’animation permanente en arrière-plan. Si Canvas est indisponible, le graphe SVG reste utilisable. Les mouvements réduits, le son désactivable, les traductions français/anglais US et le retour au thème de l’utilisateur sont conservés. Aucune migration Supabase supplémentaire n’est nécessaire.
