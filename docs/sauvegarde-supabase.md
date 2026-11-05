# Sauvegarde Supabase — Vela 1.9

## Rythme et données

La collection est écrite immédiatement dans le stockage de l’appareil. Les notes, listes, favoris, rejets, critiques et épisodes sont copiés dans la table library du compte Supabase, sans synchroniser les clés API ni les préférences système. Les envois à chaque modification et au rafraîchissement de session sont supprimés.

Le mode quotidien par défaut autorise une synchronisation automatique réussie par intervalle de 24 heures ; le mode hebdomadaire utilise 7 jours ; le mode manuel ne lance aucune synchronisation automatique. La première connexion d’un appareil sans historique de sauvegarde déclenche sa restauration avec le mode quotidien par défaut. Le réglage, les dates et les révisions sont persistés par URL de projet et identifiant du compte. Le rythme est par appareil, et non un quota global partagé par tous les appareils du compte.

Le contrôle local de l’échéance se fait à l’ouverture, au retour visible, au rétablissement du réseau et chaque minute lorsque la page est vivante. Cette minuterie ne fait aucune requête Supabase tant que la sauvegarde n’est pas due. Si Vela est fermé, masqué ou hors ligne, la sauvegarde attend une utilisation visible avec Internet. Aucun service Android, réveil ou moteur de recommandation n’est utilisé pour la sauvegarde. Le rappel cinéma natif est indépendant.

Le bouton Synchroniser du profil et Sauvegarder maintenant des paramètres forcent le passage, même avant l’échéance ou en mode manuel. Une réussite manuelle repousse la prochaine sauvegarde automatique du délai choisi. Le manuel reste disponible après réparation SQL, sans attendre le délai d’échec.

## Coût des requêtes

Une synchronisation lit les entrées du compte, paginées par 1000 avec un ordre stable, pour retrouver les modifications d’un autre appareil. Elle compare le contenu de manière indépendante de l’ordre des clés JSONB, puis écrit uniquement les différences en lots de 100. Une collection identique n’est jamais réenvoyée. Pour une collection de moins de 1000 éléments sans changement, le passage normal nécessite une lecture et aucune écriture de collection. Une collection plus grande ou des changements importants nécessitent plusieurs requêtes. L’authentification Supabase peut également effectuer ses propres rafraîchissements de session ; il ne s’agit donc pas d’un plafond absolu de toutes les requêtes du SDK ni d’une garantie de facturation.

Les reprises immédiates automatiques PostgREST sont désactivées pour ces requêtes : le planificateur de Vela contrôle le délai. Un échec réseau est retenté après 1 heure, puis 2, 4, 8, 16 et au maximum 24 heures entre tentatives tant que le problème dure. Un problème de schéma, d’autorisation ou autre attend 24 heures, sauf action manuelle. Hors ligne connu, aucune tentative n’est faite et aucune échéance de réussite n’est avancée.

## Conservation et concurrence

La fusion choisit l’entrée la plus récente à partir de sa date updated ; à date égale le contenu local gagne. Les écritures d’une même entrée sur le téléphone ont un horodatage croissant, même si deux gestes arrivent dans la même milliseconde. Les suppressions restent les bascules existantes, pas une suppression physique synchronisée. Le protocole utilise les politiques RLS existantes et ne crée aucun endpoint public.

Les déclencheurs d’un même compte rejoignent la même promesse. Le verrou Web Locks, lorsqu’il est disponible, sérialise aussi les onglets d’une même origine et recontrôle l’échéance après attente. Les modifications intervenues pendant l’envoi sont fusionnées avec la copie locale la plus récente et restent marquées en attente ; elles ne sont pas faussement acquittées. Une réponse arrivée après déconnexion ne remplace pas la collection anonyme ni celle d’un autre compte.

La date de réussite est mise à jour uniquement après les lectures, toutes les écritures et l’enregistrement local. Un échec partiel ne la change pas ; la prochaine tentative relit le serveur et n’envoie que les éléments encore manquants ou différents. Les conflits entre appareils restent départagés au moment de la lecture puis de l’envoi ; il ne s’agit pas d’un journal transactionnel multi-appareils ni d’une sauvegarde avec historique. Le bouton Exporter du profil permet de conserver un JSON indépendant.

## Validation

Les tests utilisent le véritable SDK Supabase avec des réponses contrôlées. Ils comptent les requêtes sur 24 heures et 7 jours, la persistance au redémarrage, le mode manuel, le retour du réseau, les reprises, le verrou entre onglets, la pagination au-delà de 1000 entrées, les différences JSONB, les lots partiellement écrits et la conservation des changements en cours d’envoi. Des essais Chromium couvrent les réglages et une déconnexion pendant une réponse distante. Aucun projet réel de l’utilisateur n’est modifié par ces tests.
