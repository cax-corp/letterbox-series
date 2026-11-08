# Confirmation d’e-mail et configuration du profil — Vela 2.8.0

La nouvelle version du site doit être publiée pour afficher la page dédiée. Ces réglages concernent le projet Supabase utilisé par Vela ; aucune nouvelle clé ni table n’est nécessaire.

## Réglages Supabase

1. Ouvrir **Authentication → URL Configuration**.
2. Mettre **Site URL** à `https://vela.thomasbarial.com`.
3. Dans **Redirect URLs**, ajouter exactement `https://vela.thomasbarial.com/?auth=confirm`. Conserver les autres URL déjà utiles.
4. Dans **Authentication → Providers / Sign In → Email**, activer **Confirm email** si la validation est souhaitée.
5. Dans **Authentication → Emails → Templates → Confirm signup**, le bouton de confirmation doit utiliser :

```html
<a href="{{ .ConfirmationURL }}">Confirmer mon adresse e-mail</a>
```

Ne pas remplacer ce lien par la seule adresse du site : `ConfirmationURL` passe par Supabase pour vérifier le jeton, puis redirige vers la page Vela. L’application fournit `emailRedirectTo` avec l’URL autorisée ci-dessus, y compris lors d’une inscription depuis l’APK. Le renvoi manuel d’un lien utilise aussi cette URL.

Le paramètre `?auth=confirm` est compatible avec GitHub Pages : il ne demande pas de servir un dossier `/auth/confirm` inexistant. Le domaine Vela reste affiché. Si un domaine ou sous-dossier différent est utilisé pour le site, adapter l’URL autorisée pour correspondre à la base réellement utilisée par le formulaire.

## Vérification après publication

Créer un compte de test avec une adresse accessible, ouvrir le nouvel e-mail et son bouton. Vela attend la session issue du lien et vérifie l’utilisateur auprès de Supabase avant d’afficher « Votre adresse e-mail est validée ». Le bouton « Continuer dans Vela » ouvre ensuite la configuration du nouveau compte.

Un lien expiré, refusé, une session invalide ou une adresse non confirmée affiche un écran d’échec avec connexion et demande manuelle d’un nouveau lien. Un simple paramètre d’URL n’est pas une preuve de confirmation. Les anciens liens renvoyant des paramètres `type=signup` sont aussi reconnus. Les jetons de retour ne sont pas copiés dans les profils ni journalisés par cette page.

Sur Android, le lien d’e-mail peut s’ouvrir dans le navigateur. La confirmation et la configuration effectuées sur le site sont liées au même compte ; se connecter ensuite à ce compte dans l’APK pour retrouver ses données. Cette mise à jour n’ajoute pas de nouveau mécanisme de lien universel Android.

## Configuration du profil

Les inscriptions Vela créent un indicateur `user_metadata.vela_setup` à l’état `pending`. À la première connexion, le parcours propose :

1. Prénom, nom facultatif, nom affiché, avatar prédéfini et fond.
2. Palette et mode sombre, clair ou système.
3. Langue, pays et services de streaming.
4. Cinq films sélectionnés aléatoirement en recherchant la diversité des genres parmi des titres connus et déjà sortis : « J’aime », « Je n’aime pas », « Je ne connais pas ».

Les profils existants ne sont pas forcés à recommencer. **Réglages → Configurer mon profil** permet de lancer le parcours. « Reprendre plus tard » conserve le brouillon de l’appareil ; les étapes déjà confirmées sont aussi sur le compte. Les réponses intermédiaires aux cinq films restent locales jusqu’à leur validation groupée, sans requête réseau à chaque clic.

Les signaux finaux sont enregistrés dans la bibliothèque privée Supabase via le mécanisme de sauvegarde existant. Ils ne créent pas d’étoiles, de films vus ou de coups de cœur. « Je ne connais pas » ne crée aucun signal négatif. Les notes/favoris explicites existants sont préservés. La sélection évite les titres déjà présents dans la bibliothèque et ne présente pas plusieurs fois le même titre. Si TMDB est indisponible, réessayer ou terminer sans les cinq titres reste possible.

Avatar, profil, pays/services et langue utilisent leurs métadonnées habituelles ; les palettes et modes utilisent la synchronisation privée existante. `vela_setup` garde l’état du parcours, sans y inclure les titres et réponses de goûts. Le mot de passe ne fait jamais partie du brouillon. Un échec de sauvegarde conserve les choix et permet de réessayer ; le parcours est marqué terminé après confirmation des enregistrements.
