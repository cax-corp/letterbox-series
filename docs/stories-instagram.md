# Stories Instagram

Depuis une fiche : **Votre avis → Partager en story**. Depuis le profil : bouton **Partager en story** sous un avis.

Deux formats PNG 1080 × 1920 sont proposés : affiche et note, ou affiche et extrait de l’avis. Le visuel reprend l’avatar, le nom public et la palette choisie. Les longs avis sont tronqués dans l’image ; le texte original reste intact.

Sur Android, **Partager sur Instagram** utilise le partage d’image standard d’Android. Si Instagram expose une destination Stories, Vela la sélectionne ; sinon, Instagram propose ses destinations. Ce fonctionnement dépend de la version d’Instagram. Aucun identifiant d’application Meta n’est nécessaire. Vela ne prétend pas publier la story : la validation et les modifications restent dans Instagram.

**Enregistrer le visuel** permet également de l’importer depuis la galerie Instagram. Sur Android 10 et ultérieur, le PNG est enregistré dans Pictures/Vela sans autorisation de stockage. Les anciennes versions utilisent le sélecteur de fichiers Android. Sur le web : partage de fichier si le navigateur le permet, téléchargement PNG dans tous les cas.

La génération est locale. Aucun visuel n’est envoyé à Supabase. Le partage ordinaire d’un film, d’un profil ou d’un avis continue à envoyer un lien. Dans l’aperçu Story, le bouton séparé **Copier le lien de l’avis** crée explicitement le lien public ; il peut être ajouté avec l’autocollant Lien d’Instagram. Une image ne contient pas de lien cliquable automatique.

Si l’affiche ne charge pas, un visuel de remplacement est proposé avec la possibilité de réessayer. L’envoi reste désactivé jusqu’à la fin de la préparation. Les fichiers temporaires Android sont bornés à 20 et nettoyés après 24 heures lors des exports suivants.

Validation : tests navigateur de rendu PNG, téléchargement, partage de fichier seul, annulation et absence d’envoi Supabase à l’ouverture ; tests Android des URI, autorisations temporaires, destinations et repli système. Le passage dans l’éditeur Instagram doit être vérifié sur un téléphone avec Instagram installé.
