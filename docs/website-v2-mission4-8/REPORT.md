# Mission 4.8 — Améliorations SEO et GEO ciblées

18 novembre 2026 — `feature/website-v2`. HEAD inchangé : `165f29a33574b5c02f0b6f34ad5ed0d89879ab07`. Aucun commit, push ou déploiement. La Preview approuvée reste inchangée.

## 1. Travail préexistant préservé séparément

Six fichiers étaient déjà modifiés avant la mission :

- `app/components/marketing/city-events.tsx` : retrait du compteur de ville/événements.
- `app/marketing.css` : couvertures carrées, remplissage et recadrage.
- `lib/marketing-events.ts` : sélection de noms distincts dans un lot borné à 60 candidats.
- `lib/marketing-events.test.ts` : régression de déduplication.
- `lib/marketing-cities.test.ts` : budget adapté des candidats.
- `scripts/seo-http-smoke.mjs` : budget adapté dans la suite HTTP.

**Ces six fichiers n’ont pas été édités pendant Mission 4.8.** Leurs SHA-256 avant/après sont identiques ; inventaire dans `pre-existing-changes.json`. Les autres documents locaux non suivis sont préservés. Les tests portent sur l’ensemble du working tree, donc incluent ces modifications préexistantes ; elles ne doivent pas être intégrées silencieusement au prochain checkpoint. Aucun fichier n’a été stagé ni déployé.

## 2. Métadonnées

Les titres sont désormais indépendants des libellés courts de navigation et du slogan visuel. `metaTitles` fournit cinq titres explicites par langue. Les descriptions ont été adaptées dans les cinq dictionnaires.

- Accueil : événements et activités en Suisse, identité Evy.
- Événements : prochains événements dans les quatre villes configurées, selon disponibilité, consultation sans compte.
- Meetups : création gratuite d’une activité à partager.
- Organisateurs : publication, gestion, partage et outils de promotion sous leurs conditions, sans gratuité inventée.
- Téléchargement : application iOS/Android et alternative navigateur.

Exemples FR : « Ta vibe. Tes rencontres. Ta prochaine sortie. | Evy » devient « Événements et activités en Suisse | Evy » ; « Événements | Evy » devient « Événements à venir en Suisse | Evy ». La description découverte cite Lausanne, Genève, Neuchâtel et Zürich et précise la disponibilité.

[Comparaison complète des 25 titres/descriptions](METADATA.md), également disponible dans `metadata-before-after.json`. Les canoniques, les six alternates réciproques, le x-default français, les locales Open Graph et le verrou noindex restent identiques. Les nouveaux titres/descriptions alimentent aussi les champs OG/Twitter existants.

## 3. Contenus

Les sections existantes expliquent plus clairement ce qu’est Evy, comment consulter les événements, créer un Meetup, publier depuis le mode organisateur et accéder à l’application. Aucun nouvel écran, landing page ou widget client.

La FAQ WordPress actuelle a été relue sur [myevy.app](https://myevy.app/). Les réponses confirmées sur l’accès navigateur, iOS/Android, la découverte sans paiement et la création/gestion des événements ont été intégrées aux textes appropriés, sans copier une promesse commerciale globale. L’accès au support reste dans la navigation existante. Pas de nouvelle FAQ ni de schema FAQPage artificiel.

Les étapes de Meetup restent : activité, lieu/date/détails, invitation. Le texte précise que les exemples sont des idées à créer, pas des Meetups annoncés ou une preuve d’activité réelle. Les textes organisateurs renvoient aux options et conditions de l’app ; aucun tarif ou outil gratuit supplémentaire n’est promis. Certaines formulations littérales DE/IT ont été améliorées.

Le slogan premium de l’accueil reste inchangé. Pas de refonte du carrousel, de sa navigation ou de ses cartes dans cette mission.

## 4. Données structurées MobileApplication

Ajout sur les **cinq pages de téléchargement uniquement**, pas sur les modules de téléchargement inclus dans l’accueil ou d’autres pages.

Deux entités distinctes, identifiants stables `https://myevy.app/#ios-app` et `/#android-app` : nom Evy, système iOS/Android, identifiant officiel `com.eshap.evy`, liens d’installation officiels et URL de téléchargement localisée. Le même identifiant de bundle est utilisé pour les deux applications, avec des entités séparées par plateforme.

Vérifications : [App Store, ID 6803257184](https://apps.apple.com/us/app/evy-find-your-vibe/id6803257184), [Google Play, com.eshap.evy](https://play.google.com/store/apps/details?id=com.eshap.evy), lecture seule des identifiants iOS/Android existants dans le projet Flutter. **Aucun fichier Flutter modifié.**

Aucun prix, Offer, avis, note, nombre de téléchargements, version ou minimum d’OS ajouté. Ce balisage décrit les applications : il ne prétend pas garantir un résultat enrichi Google ni une citation IA.

## 5. Attribution des organisateurs

Les deux comptes de publication de plateforme déjà identifiés par le contrat Hunter existant ne sont plus utilisés comme organisateurs par défaut. Le helper partagé suit ces règles :

1. Compte de plateforme : utiliser uniquement `external_organizer_name` non vide et distinct d’un libellé de plateforme Evy.
2. Sans nom externe : omettre `organizer` du JSON-LD ; ne pas remplacer par « Evy Switzerland ».
3. Créateur natif/revendiqué : conserver le nom du créateur actuel selon le contrat existant, sans reprendre un ancien nom importé.
4. Les noms « Evy », « Evy Switzerland » et « Evy Suisse » seuls ne constituent pas une preuve qu’Evy organise l’événement et ne sont pas émis comme organisateur.

L’interface utilise le même helper. Pour les publications de plateforme, elle ne présente plus le profil/avatar ou le badge Pro du compte de publication comme ceux de l’organisateur externe. Le lien vers le compte plateforme est explicitement nommé « Publisher in Evy ». Lorsque le nom d’organisateur manque sur un événement revendicable, le bloc affiche « Published on Evy » et conserve **Claim this event**. Les événements récurrents qui ne sont pas revendicables restent non revendicables.

Aucun changement de nom ou de propriétaire en base. Aucun appel supplémentaire, aucune modification du contrat amont, Hunter, RLS, modération ou Supabase. Les dates, lieux, offres, statuts, images sécurisées et URL canoniques du JSON-LD Event restent inchangés.

Limite : un nom externe renseigné est utilisé selon le contrat existant ; la mission ne certifie pas juridiquement tous les organisateurs. Pour un import sans nom fiable, retrouver l’organisateur réel nécessite une revue de données ultérieure. L’omission est préférable à une attribution inventée.

## 6. Langue des descriptions : partie bloquée, non simulée

`EVENT_FIELDS`, `PublicEvent`, le modèle événement et le schéma local consulté ne fournissent pas de champ public fiable liant une langue à la description importée. `external_raw_data` est un objet brut, pas un contrat validé de langue ; il n’a pas été ajouté aux lectures publiques ni au HTML.

**Aucun attribut lang déduit ou inventé n’a donc été ajouté.** Ni la ville, ni le pays, ni la langue de l’interface, ni l’URL du fournisseur ne servent de détection. Les descriptions ne sont pas traduites ou réécrites ; le test HTTP vérifie la conservation d’un extrait français importé.

Il reste à définir/valider une provenance de langue fiable, exposable sans métadonnées sensibles, avant d’appliquer `lang` aux seuls blocs de description. Cela nécessitera une décision distincte si le contrat de données doit évoluer. Le problème des descriptions FR/DE héritant de l’interface anglaise demeure documenté ; aucune réussite de ce sous-objectif n’est revendiquée.

## 7. Hiérarchie et performances

Sur les pages Meetup autonomes, les trois étapes sont maintenant des H2 sous le H1. Sur l’accueil elles restent H3 sous le H2 de section. Un petit CSS Module conserve les styles existants, sans toucher au fichier CSS préalablement modifié par l’utilisateur : 19 px sur desktop/mobile, 16 px au palier intermédiaire, graisse 700.

Aucune dépendance ajoutée. Aucun nouveau composant client, aucune requête backend ajoutée. Contenu et JSON-LD restent rendus côté serveur. Coût potentiel : quelques textes plus longs, deux petits objets JSON-LD sur le téléchargement et un petit module CSS ; les textes peuvent modifier les retours à la ligne. Les cinq langues ont été vérifiées à 390/800/1280 px sans débordement horizontal.

Aucune optimisation de police ou nouveau cache introduit. Les images protégées conservent leurs routes et `private, no-store`. Pas de nouvelle mesure Lighthouse/CrUX : ne pas extrapoler les métriques de Mission 4.7 au nouveau contenu. Les garde-fous de performance et les bornes de requêtes existantes sont conservés.

## 8. Légal

Tous les fichiers `content/legal/*` sont **inchangés octet pour octet**, contrôlés par SHA-256. Les neuf pages ont passé la régression de fidélité textuelle et de navigation.

[Liste précise pour approbation humaine](LEGAL-APPROVAL.md) : mentions Infomaniak, région Supabase, lieux de traitement/transferts, services additionnels et sous-traitants, analytics et consentement. Aucun remplacement automatique Infomaniak→Vercel, aucune traduction légale et aucun changement de date de document.

## 9. Fichiers propres à Mission 4.8

Modifiés (12) :

- `content/i18n/fr.json`, `en.json`, `de.json`, `it.json`, `es.json`
- `lib/marketing-metadata.ts`
- `lib/root-page.test.ts`
- `app/components/marketing/marketing-page.tsx`
- `app/components/marketing/sections.tsx`
- `lib/event-json-ld.ts`
- `lib/event-json-ld.test.ts`
- `app/events/[slug]/page.tsx`

Créés (4, hors documentation) :

- `lib/mobile-application.ts`
- `lib/mobile-application.test.ts`
- `app/components/marketing/sections.module.css`
- `scripts/seo-geo-review.mjs`

Documentation : ce rapport, `LEGAL-APPROVAL.md`, `METADATA.md`, comparaison JSON, empreintes préexistantes et `verification.json` dans ce dossier. Les six modifications préexistantes listées en section 1 sont exclues de cette liste Mission 4.8.

## 10. Validation

Sur le working tree complet, sans commit :

| Contrôle | Résultat |
|---|---|
| Suite complète `npm test` | **138 réussis, zéro échec** : 136 préexistants et deux nouveaux tests de schéma/attribution ; assertions de métadonnées renforcées |
| `npm run test:http` | **3 012 assertions, zéro échec** ; éligibilité, sécurité média/retrait, noindex et sitemaps dont partitions de fixture |
| TypeScript, ESLint | Réussis |
| Production build | Réussi |
| `scripts/seo-geo-review.mjs` | 25 routes, titres/descriptions exacts, canonique, noindex, MobileApplication seulement sur download, hiérarchie, omission d’organisateur non vérifié, CTA revendication et restriction des récurrences : PASS |
| `scripts/website-route-review.mjs` | 25 routes, cinq langues, hreflang/x-default, 35 liens internes, 20 assets, sept routes négatives : PASS ; 12/12 couvertures disponibles sur le dernier passage |
| `scripts/legal-pages-review.mjs` | Neuf pages, fidélité textuelle, liens, trailing slash, vue mobile/desktop, absence de faux formulaire : PASS |
| Navigateur local Chrome | Cinq langues × trois largeurs (390/800/1280), hiérarchie et styles des étapes conservés, pas de débordement : PASS |
| Préservation des six fichiers / légal | SHA-256 identiques avant/après |
| `git diff --check` | Réussi |

Un premier passage média réel a observé **502** sur la couverture English Stand Up Comedy. Le passage suivant complet a obtenu **12/12 réponses 200**. Aucune protection n’a été désactivée et aucune tolérance du test n’a été élargie pour le faire passer ; l’incident ponctuel doit rester visible dans le suivi de disponibilité. Les 500/503 intentionnels des fixtures de panne ne sont pas des erreurs de Production.

Le premier test de revendication supposait à tort que Jeudi Oui était revendicable ; cette occurrence récurrente ne l’est pas selon le contrat existant. Le test corrigé vérifie son absence de revendication et, séparément, la présence du CTA sur English Stand Up Comedy. Ce n’était pas un changement d’éligibilité.

La lecture des 256 partitions **réelles** de Mission 4.7 n’a pas été répétée : les routes sitemap sont inchangées et la suite locale de régression les couvre. Les valeurs de la Preview restent celles du commit approuvé, pas de ce working tree.

## 11. Points restants avant lancement

- Valider les clauses légales listées et les informations réelles de traitement Vercel.
- Décider de l’inclusion explicite des six modifications préexistantes dans un futur checkpoint ; ne pas les embarquer silencieusement.
- Valider un contrat fiable de langue des descriptions avant d’ajouter les attributs lang ; sous-objectif non implémenté ici.
- Les médias absents ou momentanément indisponibles restent gérés par le fallback et les protections existantes ; cette mission ne répare pas les sources d’images.
- Définir puis qualifier l’indexation Production sur le domaine final dans une mission autorisée. Preview noindex n’a pas été levé.
- Aucune garantie de résultat enrichi Google, d’indexation ou de citation IA. La qualité des données externes et les performances terrain doivent être suivies.

Aucun changement DNS, Supabase, RLS, Hunter, Flutter, environnement Vercel, document légal ou Production. Aucun commit, push ou déploiement. En attente d’approbation.
