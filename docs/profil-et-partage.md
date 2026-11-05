# Profils et partage — Vela 2.0

## Identité et images

La page Modifier mon profil permet un nom de 1 à 40 caractères, une bio de 160 caractères au maximum, cinq modes d’avatar (initiale et quatre personnages originaux : astronaute, chat, robot, fantôme), huit fonds et quatre incontournables maximum. Les titres sont choisis dans la collection, ordonnables et indépendants des favoris/likes de recommandation. Leur nom, année, identifiant et URL d’affiche publique sont conservés sous forme de texte pour permettre l’affichage sur un autre appareil avant restauration complète de sa collection.

Les quatre images ont été générées pour cette app, dans une planche 2 × 2 transparente stockée sous public/avatars/portraits.png. Le composant affiche le quadrant voulu sur un fond CSS. Aucun fichier photo n’est importable dans le profil, aucune image ni donnée base64 d’avatar n’est envoyée au serveur. Le PNG embarqué pèse environ 1,8 Mo et augmente la taille de l’APK ; le site web le sert depuis son hébergement statique, pas depuis Supabase Storage.

## Synchronisation privée

La copie locale utilise une clé vela-profile-v1 par URL de projet et identifiant de compte ; le profil anonyme est séparé. Supabase conserve le petit objet validé dans auth.users.raw_user_meta_data sous la clé vela_profile via le SDK auth.updateUser. Avatar et fond sont des identifiants prédéfinis, jamais des URL utilisateur. Les autres métadonnées du compte sont préservées. Aucun changement de schéma ni nouvelle règle RLS n’est nécessaire ; l’API Auth expose ces données à l’utilisateur authentifié concerné, pas à un profil public anonyme.

L’enregistrement manuel du profil écrit d’abord localement, puis fait une synchronisation Auth si la connexion est disponible. Celle-ci vérifie l’identité, récupère le profil distant et applique la version au timestamp le plus récent. Une donnée invalide n’est pas exécutée ni utilisée comme URL d’avatar. Le nom et les textes sont rendus comme texte. Le timestamp d’une modification locale est strictement croissant. Une réponse ancienne ne remplace pas un changement arrivé pendant l’envoi ; l’acquittement correspond uniquement à la version envoyée.

En cas d’échec ou hors ligne, le profil reste en attente. La sauvegarde quotidienne/hebdomadaire/manuelle existante appelle aussi la synchronisation du profil après la collection, avec une lecture Auth supplémentaire. Une sauvegarde globale n’est pas marquée réussie si cette phase échoue. Enregistrer explicitement un profil peut faire une lecture Auth et une mise à jour immédiate, même avant l’échéance quotidienne de la collection ; cela n’entraîne aucun envoi d’image ni une écriture à chaque like. La page affiche l’attente. La connexion restaure également les métadonnées de profil renvoyées dans la session. Des opérations simultanées d’un même compte partagent une promesse.

Les profils et critiques ne deviennent pas des pages publiques indexables. Pour un vrai réseau social de profils publics, il faudrait un mécanisme de publication et des autorisations distinctes ; cette version fournit un partage volontaire par carte et texte.

## Statistiques

Elles sont calculées depuis les entrées locales : titres marqués vus, distinction films/séries, notes personnelles, critiques, dates de visionnage, six derniers mois et principaux genres. Une série n’est pas comptée autant de fois qu’elle a d’épisodes. Les dates futures ou invalides ne fabriquent pas de jours d’activité. Les modifications de likes ou critiques ne sont pas utilisées comme dates de visionnage. La série de jours est calculée sur les jours de visionnage enregistrés et peut se terminer aujourd’hui ou hier. Il ne s’agit pas d’une mesure de temps réel passé devant l’écran.

## Partage

Les boutons Partager mon profil, Partager cet avis / mon avis et Partager cette fiche génèrent une image PNG 1080 × 1350 et un texte. La carte utilise les polices et avatars locaux, sans charger d’affiches distantes dans le canvas, afin de fonctionner hors ligne dans l’APK et d’éviter les restrictions CORS. L’image tronque un texte trop long pour tenir dans la carte ; le texte joint conserve l’avis complet. L’adresse e-mail du compte, les identifiants Auth, les clés API, les refus et les autres critiques ne sont pas ajoutés à un partage de profil. Les champs que l’utilisateur remplit volontairement, dont sa bio, sont inclus dans le partage du profil.

Android écrit une image dans le cache via Filesystem puis ouvre sa feuille de partage via Share avec le fichier local. Les fichiers de partage sont remplacés par type pour borner le cache. Sur le web, Web Share transmet le fichier si le navigateur le permet, sinon le texte ; sans Web Share le texte est copié. Annuler un partage n’entraîne aucune copie de secours. Une erreur technique peut copier le texte avec un message explicite. Un avis encore modifié dans l’éditeur est désactivé au partage jusqu’à son enregistrement. Les liens ajoutés aux films TMDB pointent vers leurs pages publiques, jamais vers une API contenant une clé. Le profil n’ajoute pas de lien vers une page publique inexistante.

## Vérification

Les tests exécutent le SDK Supabase contre des réponses contrôlées, vérifient les payloads de métadonnées et l’absence de Storage, la restauration après effacement du cache, la reprise hors connexion, les préférences d’avatar/fond et favoris, les limites, les statistiques, les cartes PNG générées réellement dans Chromium et un pont Filesystem/Share Android simulé. Ils ne constituent pas une installation réelle ni un envoi de fichier sur téléphone physique. Aucun compte réel de l’utilisateur n’est modifié dans ces vérifications.
