# Photos de profil — Vela 2.9.1

Dans **Profil → Modifier mon profil → Importer une photo**, choisir une image JPEG, PNG ou WebP (12 Mo maximum), déplacer l’image, ajuster le zoom puis appuyer sur **Utiliser cette photo** et **Enregistrer mon profil**. L’import est également proposé pendant la configuration initiale du compte.

Les avatars intégrés restent disponibles. En choisir un remplace la photographie ; **Retirer ma photo** rétablit le dernier avatar choisi. Une image qui ne charge pas affiche aussi cet avatar de remplacement.

## Activer le stockage Supabase

Dans le projet Supabase, ouvrir **SQL Editor → New query**, coller le contenu de [`supabase/profile-photos.sql`](../supabase/profile-photos.sql) puis **Run**. Cette opération crée le bucket `vela-avatars`, limite les fichiers aux JPEG de 64 Ko et autorise chaque compte à déposer des fichiers uniquement dans son propre dossier. Elle ajoute aussi le champ photo aux profils/avis partagés. Le script peut être exécuté plusieurs fois.

Puis, dans Vela, cliquer sur **Sauvegarder maintenant**, ou enregistrer à nouveau le profil. Les photos déjà choisies hors connexion restent sur l’appareil jusqu’au transfert réussi. Tant que le script n’est pas exécuté, l’import local et les stories fonctionnent, mais la photo ne peut pas être restaurée sur un autre appareil.

## Taille et synchronisation

L’application produit un JPEG carré de **320 × 320 pixels**, limité à **48 Ko**, sans conserver le fichier original ni ses métadonnées EXIF. Seule une URL est synchronisée dans les métadonnées du compte et les liens publics ; aucune image en base64 n’est placée dans le jeton de connexion. La même image réutilise la même adresse, sans nouvel objet à chaque tentative.

Le JPEG est stocké dans Supabase Storage, avec la copie locale du profil pour fonctionner hors connexion. Les images sont publiques par leur URL, comme les avatars d’un profil partagé. Les versions précédentes sont conservées afin que les avis déjà partagés gardent leur image ; revenir à un avatar intégré retire la photo du profil actuel.

Les tests automatisés couvrent recadrage, annulation, compression, reprise de synchronisation, séparation des comptes, partage public et export Story. Le stockage utilise le projet Supabase existant, sans nouvelle API ni clé supplémentaire.
