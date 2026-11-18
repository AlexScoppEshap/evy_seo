# Mission 4.8C — diagnostic clavier et qualification

## Décision

**GO technique pour soumettre le correctif local à approbation. NO-GO pour déclarer la Preview entièrement qualifiée tant que ce correctif n’y est pas publié et vérifié.** Aucun commit, push ou déploiement effectué.

Branche `feature/website-v2`, HEAD inchangé `56e81f2043b41de489a1dc6160e9b17c19bc822f`. Preview examinée : `dpl_6M7j37MbWJaYtPx8m3QHkzLx1nTD`, https://evy-e2rx8wnxi-evy7.vercel.app. Tous les fichiers locaux préexistants ont été conservés.

## Cause confirmée

Bug applicatif de concurrence temporelle : `finish()` programme un `requestAnimationFrame` qui repositionne la piste sur la carte la plus proche. Home peut être traité avant ce callback. Le callback tardif écrase alors la commande clavier. Le focus et le gestionnaire Home sont corrects ; ni une perte de focus ni un simple timeout du test n’expliquent le résultat.

Six reproductions sur la Preview, trois en reduced-motion et trois en animation normale : Home laisse finalement la piste à 656 px ; un second Home après stabilisation la ramène à zéro. Exemple reduced-motion : Home à 2646,7 ms ; `scrollTo(0, instant)` à 2647 ms ; callback `scrollTo(656, instant)` à 2653 ms. En mode normal, deux appels concurrents `smooth` produisent le même résultat. Le focus reste `event-track`. Aucune exception JavaScript non interceptée dans les essais enregistrés. Le champ `prevented` du journal est observé avant le gestionnaire React délégué ; il ne mesure pas l’état final du traitement React.

Les tests locaux précédents dépendaient de l’ordre des frames et pouvaient donc passer. Le premier lot distant a été interrompu avant les essais normal-motion par une absence de piste au chargement (timeout, cause non déterminée) ; un lot distinct a ensuite permis trois reproductions normal-motion. Aucun contenu privé ni jeton n’est enregistré.

## Correction minimale

- `app/components/marketing/carousel.tsx` : mémoriser l’identifiant de la frame de snap ; l’annuler avant Home/End, les flèches, une nouvelle interaction souris et au démontage. Réinitialiser la référence à l’exécution du callback.
- `scripts/city-carousel-review.mjs` : reproduire déterministement la course en suspendant la frame de fin de glissement, vérifier qu’une frame existe, envoyer Home puis vérifier son annulation. Ajouter ArrowLeft et le clavier en viewport mobile.

Aucun changement CSS, cartes, données, canonicals, médias, scroll-snap natif, toucher, prévention des clics accidentels, documents légaux ou dépendances. Dossier de preuves/report ajouté : `docs/website-v2-mission4-8c/`.

## Résultats locaux après correction

- `npm test` : **138 réussis, 0 échec**.
- `npm run test:http` : **3 012 assertions, 0 échec**, dont 256 partitions, éligibilité et protections médias/retrait.
- `npm run lint`, `npm run typecheck`, `npm run build` : réussis.
- Suite navigateur Chromium : réussie avec reduced-motion et avec animation normale. Home, End, ArrowRight/Left, Tab vers les cartes, souris, clic ordinaire, clic supprimé après drag, tactile natif, villes, réponses concurrentes, états vides/erreur, cinq langues, absence de requêtes au scroll. Desktop 1280×900 et mobile 390×844 ; clavier également testé sur viewport mobile.
- Répétition instrumentée locale : **6/6**, retour à zéro dès le premier Home ; aucune commande de snap tardive ne l’écrase.
- `git diff --check` réussi.

Ces essais sont exécutés dans Chrome/Chromium ; Safari/Firefox et les appareils physiques ne sont pas certifiés. Le mode normal de la suite utilise le même script avec reducedMotion=no-preference et l’attente CSS smooth ; le contexte tactile reste reduced-motion.

## Complément de qualification sur la Preview existante

Le contrôle clavier connu défaillant est explicitement exclu, et non déclaré réussi.

- 25 routes marketing : HTTP 200, titres/descriptions attendus, lang, canonicals de production, six hreflang, noindex.
- MobileApplication : deux entités uniquement sur les pages download ; identifiant officiel, aucun prix/avis inventé.
- Neuf routes légales : texte identique aux sources approuvées, canonical et langue anglaise conservés.
- Quatre villes : 12 noms distincts par sélection, liens canoniques et chemins médias sécurisés ; compteur masqué.
- Drag sans navigation accidentelle ni nouvelle requête ; couvertures carrées et object-fit: cover aux largeurs 390/1280.
- `jeudi-oui-neuchatel-neuchatel-ch-2026-e3ad19` : HTTP 200, Event JSON-LD et canonical cohérents, organisateur non vérifié omis.
- `english-stand-up-comedy-odd-wednesday-open-mic-lausanne-ch-2026-ebd910` : HTTP 200, organisateur Riviera Comedy Collective, attribution Publisher in Evy et claim préservés. Cover HTTP 200, type image, `Cache-Control: private, no-store`. Aucun marqueur de stockage privé/token détecté dans les HTML échantillonnés ; ce n’est pas une certification générale des secrets de configuration.
- robots.txt : Disallow / ; X-Robots-Tag noindex.
- `/sitemap.xml` : HTTP 200, 257 entrées ; `/events-sitemap.xml` : 256 partitions avec URLs myevy.app ; partitions 00 et ff vérifiées en HTTP 200. Les 256 partitions sont testées localement, pas toutes interrogées en production Preview.
- `/page-sitemap.xml` : HTTP 200, vide comme prévu en Preview non indexable. `/sitemap_index.xml` et `/wp-sitemap.xml` : 301 vers `/sitemap.xml`.

Pendant la préparation du contrôle sitemap, un chemin de partition inexistant a renvoyé 404, puis une requête omettant le paramètre partition a relu l’index. Le contrôle a été corrigé pour utiliser les URLs réellement publiées en conservant leur query string ; les vrais endpoints passent. Aucun changement applicatif sitemap.

## Blocages et prochaines étapes

1. Approbation du correctif local, puis checkpoint/push Preview dans une mission autorisée ; requalifier le clavier sur ce nouveau déploiement.
2. Le chargement sans piste observé une fois n’a pas de cause établie ; les essais ultérieurs et les quatre changements de ville ont réussi. Aucun HTTP 500/503 observé dans les vérifications finales enregistrées ; cela ne prouve pas leur absence globale.
3. Les validations humaines légales et la configuration d’indexation Production restent des jalons de lancement distincts.

Aucune modification Supabase, RLS, Flutter, DNS, Production Vercel, variables d’environnement ou contenu légal. Pas de compte utilisateur, OAuth ou récupération de compte exécuté. Aucun secret dans les preuves sauvegardées.
