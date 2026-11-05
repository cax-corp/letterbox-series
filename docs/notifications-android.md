# Notifications Android — Luma 1.7.1

Le rappel quotidien est désormais déclenché par AlarmManager. Un BroadcastReceiver natif publie la notification à partir d’une réserve de 30 films au maximum, préparée et enregistrée pendant l’utilisation de Luma. Le receiver ne démarre pas MainActivity, ne charge aucune WebView, n’appelle aucune API et n’exécute pas le moteur de recommandation du feed.

## Programmation et reprise

- En mode standard, avec l’autorisation Android « Alarmes et rappels », Luma utilise `setExactAndAllowWhileIdle`.
- Le choix **Fiabilité renforcée**, désactivé par défaut et enregistré avec l’horaire, utilise `setAlarmClock` si cette autorisation est accordée. Ce mécanisme est prioritaire pendant Doze et expose volontairement le prochain rappel à Android : une icône de réveil peut apparaître et son raccourci ouvre les réglages Luma. Le receiver publie une notification ordinaire ; il ne lance ni sonnerie de réveil, ni activité, ni service permanent. La catégorie reste `REMINDER`, sans contournement de Ne pas déranger.
- Le mécanisme réellement utilisé est exposé dans le diagnostic. Un accès aux alarmes exactes accordé ultérieurement restaure le mode renforcé sans déplacer l’heure cible. Aucune permission n’est attribuée silencieusement.
- Sans cette autorisation, `setAndAllowWhileIdle` conserve un rappel compatible avec la veille ; son horaire est moins précis.
- Une tâche WorkManager sert de secours deux minutes après la cible et utilise la même garde de livraison. Elle ne contacte aucun serveur.
- L’heure cible est mémorisée. Actualiser la réserve n’incrémente plus la génération de programmation et ne reporte plus un rappel imminent.
- La génération et l’heure cible empêchent les envois périmés et les doubles envois entre alarme et tâche de secours. Une notification retardée de plus de six heures est abandonnée plutôt qu’envoyée à une heure sans rapport avec le choix de l’utilisateur.
- Après un envoi, le prochain jour choisi est programmé dans le fuseau du téléphone. Le redémarrage, la mise à jour de l’APK et les changements d’heure/fuseau restaurent la programmation.

La réserve exclut les films vus, notés, appréciés ou refusés, les cartes consultées aujourd’hui et les derniers films notifiés. Sa préparation utilise le classement léger de l’accueil, et non le modèle complet du feed. Elle est actualisée lorsque les goûts changent, après de nouvelles impressions et au retour au premier plan. Aucun jeton TMDB, poids de modèle ou texte de critique n’est nécessaire à la tâche de fond. Une réserve épuisée produit un rappel ouvrant Pour vous, plutôt qu’une absence silencieuse de notification.

## Vérification sur le téléphone

1. Installer l’APK par-dessus la version précédente et ouvrir Luma pour migrer la programmation.
2. Ouvrir la page Réglages → Votre rendez-vous cinéma ; autoriser les notifications Android.
3. Si proposé, choisir « Autoriser les horaires précis » et activer « Alarmes et rappels » pour Luma dans Android.
4. Sur Xiaomi, activer **Fiabilité renforcée**, choisir l’heure et les jours, puis activer/enregistrer le rendez-vous.
5. Utiliser « Tester dans 1 minute », fermer Luma normalement ou le retirer des applications récentes, puis consulter le panneau de notifications.

Le test est indépendant de l’horaire quotidien, teste le mode renforcé actuellement coché et ne consomme pas la réserve quotidienne. **Tester maintenant** vérifie séparément la publication au premier plan ; réussir ce test ne prouve pas le réveil en arrière-plan. Le test minute peut être restauré au démarrage même si le rendez-vous quotidien est désactivé.

### Xiaomi / MIUI / HyperOS

Le mode **Économiseur de batterie (recommandé)** de la capture utilisateur est un réglage par application Xiaomi, distinct du seul mode Doze Android. Il peut empêcher le démarrage du receiver même lorsque les notifications sont autorisées. `setAlarmClock` améliore la priorité côté Android, mais ne donne pas de garantie contre les politiques du constructeur.

La page fournit deux raccourcis lorsqu’elle détecte Xiaomi, Redmi ou POCO :

- **Autoriser le démarrage automatique Xiaomi** : activer Luma dans la liste de démarrage automatique en arrière-plan.
- **Régler la batterie de Luma** : si le test fermé reste bloqué, sélectionner **Pas de restriction** pour Luma. L’économiseur général du téléphone peut rester actif.

Ces écrans sont propres à MIUI/HyperOS : si leur activité n’existe plus ou est privée, le bouton ouvre les informations Android de Luma. Ouvrir un écran ne donne aucune permission. Android ne fournit pas d’API publique fiable pour lire ces deux états Xiaomi ; `isBackgroundRestricted` et `isIgnoringBatteryOptimizations` ne doivent pas servir à les annoncer comme autorisés.

### Diagnostic local

Le volet **Diagnostic du dernier rappel** distingue l’heure attendue, le dernier déclenchement natif et sa source (alarme, secours ou test immédiat), la publication acceptée/refusée par Android et une notification encore active. Une réouverture après une échéance dépassée de plus de deux minutes, sans livraison, conserve la date du retard avant de réarmer le rappel. Les données critiques sont enregistrées synchroniquement avant programmation et après publication pour résister à une fin de processus.

**Notification transmise à Android** signifie que `notify()` a abouti, pas que Xiaomi l’a affichée ou que l’utilisateur l’a lue. Le rapport copiable contient l’appareil/API Android et les états de programmation, sans catalogue, historique, compte ni clé API. Le diagnostic s’actualise au retour et toutes les quinze secondes uniquement tant que cette page est visible.

Un **arrêt forcé** depuis les paramètres Android suspend les alarmes et travaux jusqu’à la réouverture : Luma ne peut pas contourner cette décision du système. Certains constructeurs appliquent aussi leurs propres restrictions d’arrière-plan. Le résultat sur le téléphone réel doit être vérifié avec le test intégré ; les essais automatisés ne reproduisent pas toutes les politiques de batterie des appareils.

## Validation automatisée

`bash scripts/test-android.sh` exécute les tests JUnit et les tests Robolectric sous API 34. Ils vérifient : enregistrement de l’alarme et fonctionnement en veille, repli sans accès aux alarmes exactes, émission d’une notification sans activité ouverte, reprogrammation, déduplication, refus de permission, réserve vide, actualisation du contexte sans déplacer la cible, test dans une minute, reprise au démarrage et désactivation. La tâche WorkManager de secours est également exécutée sans réseau ni activité. Le mode réveil Android, le test immédiat, la conservation du mode standard, les raccourcis Xiaomi (avec refus de l’écran privé), la détection de retard et la restauration après accès exact sont également couverts. Les calculs de calendrier, jours, fuseaux et changements été/hiver disposent de tests séparés.

Ces tests exécutent le code natif dans un environnement Android simulé. Ils ne constituent pas une mesure de réception sur téléphone physique. La version web seule ne fournit pas de rappel lorsque le navigateur est fermé.
