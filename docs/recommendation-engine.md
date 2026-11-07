# Recommandations Vela 2.5

Le modèle de contenu est calculé dans un worker local. La carte des goûts est construite uniquement à son ouverture. Aucun entraînement ou serveur payant n’est requis.

## Signaux et séparation des actions

- Les bonnes notes et coups de cœur sont des références fortes ; les notes faibles et refus explicites réduisent les rapprochements correspondants. Les demi-notes 2,5 et 3,5 apportent un signal faible. Une note de 3 reste neutre.
- À voir indique une curiosité, pas un film apprécié : le signal reste faible et ne devient pas une référence de voisinage. Le double-tap et le marque-page ajoutent à À voir. Le cœur reste un favori explicite. Les favoris historiques sont conservés.
- Passer rapidement une carte réellement visible produit un signal négatif faible et temporaire, distinct des refus. Les détails ouverts, gestes annulés, retours arrière et pauses ne sont pas assimilés à des rejets.
- Le poids des goûts anciens baisse partiellement avec le temps, avec un plancher qui les conserve. Modifier un avis ne rajeunit pas artificiellement sa préférence.

## Variété et contenu

Les références comprennent tous les titres appréciés, pas seulement les vingt derniers. Elles sont intercalées par familles de contenu pour qu’une série de favoris super-héros ne monopolise pas les premières requêtes. Les votes répétés dans une même famille sont comprimés avant l’agrégation des genres et couples de genres.

Le classement rapproche les synopsis par TF-IDF, genres et concepts, puis combine époque, notes de qualité pondérées par le nombre de votes, références TMDB réelles, exemples négatifs et passages rapides. Les meilleurs voisins sont équilibrés par famille plutôt que de prendre trois suites comme trois preuves indépendantes. Les références apparentées d’une même famille ne cumulent pas un bonus illimité.

Le réordonnancement évite la répétition d’une saga et réserve de la place à d’autres familles dans la fenêtre récente lorsqu’il existe des alternatives d’un score suffisamment proche. Il ne rejette pas arbitrairement des titres lorsque le catalogue est trop restreint. Les collections TMDB, lorsqu’elles sont connues, et des noms de sagas permettent d’identifier les répétitions. L’animation japonaise, l’espionnage, le cinéma d’horreur et les super-héros peuvent être distingués au-delà du seul genre Action.

Les sources combinent une rotation de deux références, découvertes par genres/époques et une voie d’exploration populaire ou bien notée. Le premier lot inclut aussi le catalogue de départ. Toutes les voies ont une pagination et une fin explicites. TMDB ne reçoit que les recherches et filtres du catalogue, sans notes personnelles ni texte d’avis. Les titres vus, notés, en favoris ou déjà dans À voir ne sont pas proposés comme de nouvelles découvertes. Les affichages de la journée restent exclus après changement d’onglet ou redémarrage ; le préchargement seul ne compte pas comme un affichage.

## Découvrir et cartographie

Découvrir utilise un classement plus léger. Les expositions visibles répétées sans interaction font baisser la priorité de la carte d’accueil lors des visites suivantes. Cela reste de la rotation, sans fabriquer une préférence négative. Le catalogue est rafraîchi à la reprise après une période suffisante ; les goûts nouveaux reclassent aussi la sélection.

La carte relie les titres à leurs genres et à leurs voisins par similarité des mêmes vecteurs de synopsis. Les repères de genres sont fixes en 3D ; des ressorts rapprochent les éléments reliés et une répulsion garde les points lisibles. Le signe et la force du signal sont visibles, avec un panneau d’inspection. La projection n’est pas une probabilité de compatibilité ni un exposé exhaustif de tous les scores du moteur. La sélection des 120 points dessinés est équilibrée par type de signal et famille ; toute la bibliothèque reste recherchable.

## Persistance privée

Les entrées explicites restent dans la bibliothèque privée Supabase. Les passages rapides sont ajoutés à la sauvegarde choisie, en lots différentiels. La nouvelle table privée conserve au plus 120 signaux récents, sans affiches, et ne rend rien public. Les réglages sont synchronisés séparément après modification. La palette et les horaires se restaurent sur un autre appareil ; les autorisations système restent locales et ne sont jamais demandées silencieusement.

Le cache du catalogue, le registre d’affichage de la journée, les expositions d’accueil et la position dans l’interface restent locaux. Le moteur peut recalculer les goûts à partir des entrées et signaux sauvegardés. Il ne connaît ni les goûts de la population ni les contenus inconnus des sources ; il s’agit d’un modèle de contenu local, pas d’un modèle collaboratif entraîné sur tous les spectateurs.
