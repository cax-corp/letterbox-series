# Profils et liens publics — Vela 2.9.1

Le profil privé reste dans les métadonnées Auth Supabase (`vela_profile`) et dans la copie locale par compte/projet : nom affiché, bio, avatar embarqué, fond prédéfini, quatre incontournables. Une photo personnalisée peut aussi être importée : son JPEG compressé est stocké dans Supabase Storage et seule son URL entre dans les métadonnées Auth. Voir [Photos de profil](photos-de-profil.md). Les statistiques d’activité sont calculées depuis la collection locale.

## Partage par lien

Les boutons de profil et d’avis ouvrent un panneau de préparation : une petite publication volontaire est créée dans `public.vela_shares`. Une fois le lien prêt, les boutons **Partager le lien** et **Copier le lien** sont disponibles. Cette séparation garde une vraie activation utilisateur pour Web Share, même si le réseau est lent. Les fiches de films/séries ont déjà une URL calculable : leur menu de partage s’ouvre directement, sans requête ni préparation d’image.

Le partage transmet exclusivement `title`, `text` et `url` au système. Aucun PNG, fichier, canvas, chargement de police ni écriture Filesystem n’est utilisé. L’annulation ne provoque pas de copie ; si le partage système n’est pas disponible, le lien seul est copié avec un message explicite.

Les URL utilisent des fragments compatibles avec GitHub Pages : `#/title/tmdb-movie-123`, `#/title/tmdb-series-123` et `#/s/UUID`. Elles se rouvrent directement et après rechargement sans configuration de réécriture serveur. Les anciennes sources iTunes/TVmaze ont aussi une résolution par identifiant. La lecture publique fonctionne sans session ; noter, ajouter à sa collection et publier un profil/avis nécessitent un compte dans la distribution préconfigurée.

`VITE_PUBLIC_SITE_URL` peut définir l’URL HTTPS canonique (utile pour l’APK et un futur domaine personnalisé). Par défaut, Android partage `https://vela.thomasbarial.com/` ; le site HTTPS partage son URL d’hébergement. Aucun jeton, clé API ou e-mail n’est inclus dans le lien.

## Activation Supabase et contrôle d’accès

Exécuter une fois [`supabase/public-sharing.sql`](../supabase/public-sharing.sql) dans le SQL Editor. Le script peut être rejoué. Il ne modifie pas les autorisations de `public.library` ni les métadonnées Auth.

La table contient uniquement les publications explicites. Le profil partagé contient le nom public, la bio, le preset d’avatar et de fond, l’URL de la photo si elle est synchronisée, quatre favoris et quatre statistiques agrégées. Un avis partagé contient son titre, sa note, son texte, sa date et ce profil public. L’e-mail Auth, le pays, les abonnements, les refus, la collection et les autres critiques ne sont pas copiés. Les textes volontairement saisis dans la bio ou l’avis deviennent publics lors du partage.

Le serveur valide une liste fermée de champs, les tailles, les identifiants de titres et les presets ; un champ `email` ajouté au payload ou au profil est refusé. Le rôle anonyme peut lire les colonnes `id,kind,payload,updated_at` des publications, jamais leur `owner_id`. Seul le propriétaire authentifié peut créer, modifier ou retirer ses publications (RLS). L’identifiant du lien est un UUID aléatoire ; les pages sont publiques, pas protégées par un secret de connexion.

La contrainte `(owner_id,kind,target)` conserve un lien stable quand le même profil ou avis est repartagé. Le contenu correspond au dernier partage ; un changement privé ultérieur n’est pas automatiquement publié. **Réglages → Liens publics → Gérer mes liens publics** permet de retirer une publication ; ses lecteurs voient ensuite un lien indisponible. La suppression du compte retire ses publications par cascade.

## Vérification

Des tests PostgreSQL PGlite exécutent la migration deux fois, publient un profil et un avis, vérifient la lecture anonyme limitée, le refus des champs privés, l’absence d’accès à la bibliothèque, le refus des modifications par un autre compte et la révocation. Les tests navigateur partagent de vrais liens, ouvrent profil/avis dans une session séparée sans connexion et testent leur retrait. Un pont Android simulé confirme l’absence de fichier et le comportement d’annulation. Les tests utilisent des réponses contrôlées ; aucun compte réel n’est modifié.
