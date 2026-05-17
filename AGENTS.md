# Instructions Codex

Avant toute modification sur ce projet :

* Lire obligatoirement `TEST_ENVIRONMENT_CHANGELOG.md`.
* Lire obligatoirement `docs/ETAT_PROJET.md` si le fichier existe.
* Lire la documentation metier concernee dans `docs/` avant de modifier une page ou une logique metier.
* Respecter les regles metier et techniques decrites dans ces documents.
* Mode economie strict : ne lire que les fichiers necessaires.
* Ne pas faire de diagnostic global du repo sauf demande explicite.
* Ne pas lancer build/test/lint complet sauf demande explicite.
* Corriger uniquement le probleme demande.
* Ne pas rechercher d'autres erreurs apres correction.
* Ne pas refactoriser sans demande explicite.
* Repondre court.
* Toujours verifier que la version utilisee est `5.4` en mode `moyen`.

Regle de branche obligatoire :

* Pour les travaux lies a l'overview, a la version test/staging ou au workflow de staging, travailler et pousser uniquement sur la branche `codex-setup-staging-workflow`, sauf demande explicite contraire.
* Cette branche est la vraie branche test reliee au projet Vercel test / overview Vercel.
* Avant tout commit ou push, verifier la branche courante avec `git status --short --branch`.
* Ne jamais pousser ces travaux directement sur `main`.

Push et securite :

* Le commit/push est autorise sur les environnements de test.
* Ne jamais pousser vers la production sauf demande explicite, phrase exemple : "Je valide la version test".
* Ne pas elargir la tache avant push.
* Ne modifier que les fichiers necessaires.
* Si la correction necessite plus de 3 fichiers, expliquer brievement pourquoi.

Documentation continue :

* Quand une page, une logique ou un workflow est valide, mettre a jour `docs/ETAT_PROJET.md`.
* Documenter simplement le fonctionnement de la page, les donnees qu'elle utilise, les pages liees et ce qui reste en cours.
* Ne pas considerer une page comme validee si l'utilisateur n'a pas confirme son fonctionnement.
