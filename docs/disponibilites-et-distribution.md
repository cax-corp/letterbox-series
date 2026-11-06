# Fiches compactes, pays et services — Vela 2.3.1

Le pays est obligatoire au signup et modifiable dans **Réglages → Pays et services**. Les services sont choisis dans la liste TMDB pour ce pays, avec recherche et formules distinctes. La sélection est conservée localement par compte/projet et dans les métadonnées privées Auth `vela_viewing`. Elle se restaure à la connexion et lors de la sauvegarde. Aucun changement de schéma n’est nécessaire pour cette mise à jour.

## Disponibilités

Une ligne **Disponible sur**, placée avant le synopsis, montre de petites icônes des services sélectionnés par l’utilisateur. Aucun service non coché n’est affiché, dans l’aperçu ou dans les détails. L’aperçu regroupe abonnement/gratuit/publicité ; si seules des offres payantes sont renseignées sur les services sélectionnés, il indique **Location / achat** pour ne pas annoncer un film inclus dans l’abonnement.

La ligne se déplie pour séparer les catégories : abonnement, gratuit, publicité, achat et location. Chaque catégorie occupe une ligne avec ses icônes, sans cartes verticales. Les groupes vides sont omis. Le pays, l’attribution JustWatch/TMDB et l’accès aux réglages sont dans le volet. Sans pays ou services sélectionnés, une invite compacte mène aux paramètres.

Les données utilisent la clé TMDB existante : `/movie/{id}/watch/providers`, `/tv/{id}/watch/providers` et `/watch/providers/movie|tv`. Une absence de données ne prouve pas l’indisponibilité réelle. Les caches de listes et d’offres sont conservés en mémoire. La requête d’offre n’est pas lancée avant la sélection d’au moins un service.

Les liens directs vers les titres sur les plateformes et leurs messages d’absence sont retirés. Le résolveur Wikidata est supprimé : aucune recherche de lien direct n’est faite à l’ouverture d’une fiche. Le partage des **liens publics Vela** fonctionne toujours, indépendamment de cet affichage.

## Distribution et avis

**Voir les acteurs** déplie le trombinoscope. Aucun portrait n’est monté avant l’ouverture. Les crédits restent dans la requête de fiche TMDB existante, avec `append_to_response` pour les films et séries ; les images restent sur le CDN, sans hébergement Supabase ni duplication dans les sauvegardes.

L’en-tête est réduit : affiche compacte, titre, année, genre, durée, note du catalogue et partage. Les actions de collection occupent une ligne dédiée. La note personnelle et l’aperçu de l’avis sont proches du synopsis. **Écrire un avis** / **Modifier mon avis** ouvre un éditeur avec compteur et commandes Enregistrer/Annuler ; annuler garde le texte précédemment enregistré. La date de visionnage et les listes sont dans **Suivi personnel**, replié par défaut. Les données de note, avis et listes ne changent pas de format.

Les mêmes composants servent l’APK, les fenêtres web et les fiches publiques. Les visiteurs déconnectés conservent les appels à découvrir Vela et à se connecter, sans accès à l’éditeur privé.

## Vérification

Les tests couvrent le filtrage par services sélectionnés, les catégories d’achat/location repliées, le pays et les préférences restaurés depuis Supabase, l’absence de recherche Wikidata, l’ouverture du casting, les notes, l’enregistrement et l’annulation des avis, les listes et les couleurs issues de l’affiche. Les appels distants sont contrôlés dans les tests ; le cloud ne permet pas leur vérification en direct.
