# Pays, plateformes et distribution — Vela 2.3

Le pays est obligatoire au signup et modifiable dans **Réglages → Pays et services**. Les services sont choisis dans la liste fournie par TMDB pour ce pays, avec recherche et formules distinctes. La sélection est enregistrée localement par compte et projet, puis dans les métadonnées privées Auth sous `vela_viewing`. Elle est restaurée à la connexion ; les changements hors connexion sont repris lors de la sauvegarde. Les mises à jour utilisent le jeton du compte capturé, pour ne pas modifier les métadonnées d’un autre compte en cas de changement de session.

Les fiches affichent les offres directement dans Vela : abonnement, gratuit, gratuit avec publicité, location et achat. Les services choisis sont mis en avant, sans annoncer qu’une location est incluse dans l’abonnement. Le pays reste visible et modifiable. Une absence de donnée n’est pas présentée comme une preuve d’indisponibilité.

## Sources et liens de lecture

La clé TMDB existante suffit : `/movie/{id}/watch/providers`, `/tv/{id}/watch/providers` et les listes `/watch/providers/movie|tv` fournissent les disponibilités et les logos. Ces données sont attribuées à JustWatch dans la fiche. TMDB est gratuit pour les usages non commerciaux prévus par ses conditions ; aucune nouvelle API freemium, offre RapidAPI ni abonnement de données n’est ajouté.

TMDB ne fournit pas les liens directs de chaque plateforme. Vela combine les liens officiels de la fiche et les identifiants de streaming de Wikidata (données CC0, API publique sans clé). La recherche Wikidata utilise uniquement l’identifiant public TMDB/IMDb du titre, jamais le compte, le pays ou les services de l’utilisateur. Les URLs sont construites à partir des identifiants et formateurs retournés, puis limitées aux domaines officiels des services. Une fiche produit Amazon physique n’est pas assimilée à une offre Prime Video. Les pages d’accueil, recherche ou connexion ne sont pas présentées comme des liens exacts.

La liste reste dans Vela : aucun passage par la page « Où regarder » de TMDB n’est imposé. **Ouvrir le titre** apparaît uniquement lorsqu’un lien exact est disponible pour le service. La lecture reste assurée par le fournisseur. La couverture gratuite est incomplète : l’absence de lien direct est indiquée ; aucune URL de film n’est inventée. Un échec de recherche de lien n’empêche pas d’afficher les disponibilités. La recherche est limitée à huit secondes, avec temporisation après limitation de débit ; les liens exacts sont cachés une semaine et les résultats vides une journée sur l’appareil. Les listes de services et offres sont également mises en cache en mémoire.

## Distribution

Les crédits de film et crédits agrégés de série sont chargés dans la requête de fiche TMDB existante via `append_to_response`. Le trombinoscope affiche le portrait, le nom et le rôle, avec un repli si la photo manque, et une expansion vers le reste du casting. Les portraits restent sur le CDN TMDB ; les crédits ne sont pas recopiés dans chaque entrée de collection ou sauvegarde.

## Vérification

Les tests contrôlent les changements de pays, les offres territoriales, les formules choisies, leur restauration depuis les métadonnées après effacement local, le pays requis au signup, les crédits de films/séries, l’accès anonyme aux fiches et les domaines des liens. Les appels distants réels à TMDB, Wikidata et Supabase ne sont pas accessibles avec la politique réseau du cloud actuel ; les tests utilisent leurs réponses représentatives.
