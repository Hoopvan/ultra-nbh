# Journal de développement — Hoop NBH

Historique du projet, session par session, la plus récente en premier. Objectif : retracer **ce qui a été fait, pourquoi, et comment**, en complément de `git log` (qui donne le *quoi* mais pas le contexte produit ni les décisions techniques). À mettre à jour à la fin de chaque session de travail.

---

## Session du 2026-07-20 — Système d'amis complet

### Contexte / demande initiale

Reprise de travail après le redesign white-label (voir historique condensé plus bas). L'utilisateur a validé deux analyses de faisabilité restées en suspens (mur social + système d'ami) et a choisi de lancer le système d'amis dans son intégralité, "même si ça doit prendre du temps", en pensant à la scalabilité (le projet doit pouvoir gérer plusieurs clubs).

Décisions produit tranchées avec l'utilisateur avant codage :
- **Mécanisme d'ajout** : demande mutuelle (request → accept), via un **code unique par utilisateur** à transmettre (pas de recherche par pseudo, pas de follow unilatéral).
- **Utilité d'être ami** : classement XP et pronostic filtrés aux amis, vue de profil (avatar/niveau/collection), **échange de cartes**.
- **Intégration UI** : entrée dans l'onglet **Tribune** (icône 👥 + badge), pas dans Paramètres — Tribune est déjà l'onglet communauté/classement.

Un plan détaillé a été élaboré (mode plan Claude Code) avant tout codage, couvrant schéma DB, RLS, RPCs et découpage des fichiers. Voir `supabase/27_friends_system.sql` à `31_user_bio.sql` pour le détail technique complet (commentaires en tête de chaque migration).

### Ce qui a été livré

**Schéma DB (5 migrations, à exécuter dans l'ordre via Supabase Dashboard > SQL Editor) :**

| Migration | Contenu | Statut exécution |
|---|---|---|
| `27_friends_system.sql` | Table `friend_codes` (code unique, **séparée de `users`** pour que la policy RLS existante `users_select_same_org` — qui n'a pas de granularité par colonne — ne rende pas le code scrapable par tout le club). Backfill des users existants. `create_profile` génère désormais un code à l'inscription. Tables `friend_requests` (pending/accepted/declined/cancelled, unique partiel anti-doublon) et `friendships` (ordre canonique `user_a < user_b`). RPCs `send_friend_request`, `respond_friend_request`, `cancel_friend_request`, `remove_friend`, fonction `are_friends()`. | ✅ Exécutée et vérifiée |
| `28_card_trades.sql` | Dédoublonnage défensif de `user_cards` (l'écriture cliente non atomique existante pouvait créer des doublons) + contrainte unique `(user_id, card_id)`. **Policy SELECT manquante enfin ajoutée sur `user_cards`** (self-ou-ami) — comblait une dette d'audit RLS en attente depuis la session du redesign. Table `card_trades` + RPCs `propose_card_trade`/`respond_card_trade` (swap atomique avec verrous `for update` et revérification si une carte n'est plus possédée au moment d'accepter)/`cancel_card_trade`. | ✅ Exécutée et vérifiée |
| `29_pronostic_cumulative.sql` | `users.pronostic_points` + `games.closed_at`. RPC admin `close_pronostic_match()` : calcule les points (`greatest(0, 10 - ecart)`) pour tous les votes d'un match une fois le score final connu, une seule fois (idempotent via `closed_at`). Décision motivée : cumul en colonne persistante plutôt que recalcul à la volée sur tout l'historique à chaque affichage (coût qui grandirait indéfiniment avec le nombre de matchs joués). | ✅ Exécutée et vérifiée |
| `30_friend_request_by_id.sql` | RPC `send_friend_request_by_id()` — permet d'envoyer une demande depuis le classement Communauté (où on a l'id du fan mais pas son code, privé). Même logique de garde que `send_friend_request` (org, doublons, auto-accept si demande croisée). | ✅ Exécutée |
| `31_user_bio.sql` | Colonne `users.bio` (100 caractères max, check constraint), grant update additif (colonne cosmétique, même traitement que `name`/`avatar_*`). | ⏳ **Pas encore confirmée exécutée** — à faire avant que la bio fonctionne en prod |

**Code front (nouveau module `js/friends.js` + modifications) :**
- Écran `#screen-friends` : code perso à copier, ajout par code, demandes reçues/envoyées, échanges proposés/reçus, liste d'amis, **classement XP et classement pronostic entre amis en accordéon** (chevrons ▾/▴, repliés par défaut pour ne pas avoir à scroller pour atteindre le second).
- Écran `#screen-friend-profile` : avatar, niveau/XP/streak, bio (lecture seule), collection de cartes (si ami — sinon message "devenez amis pour voir sa collection", cohérent avec la RLS). Bouton "Retirer cet ami" + "Proposer un échange" si déjà ami, sinon bouton "➕ Ajouter en ami".
- Compositeur d'échange (`#overlay-trade-composer`) : sélection tap-to-select d'une carte à moi contre une carte de l'ami, **badge du nombre d'exemplaires affiché sur chaque carte** (orange si un seul exemplaire, pour éviter d'échanger par erreur sa dernière copie d'une carte).
- `js/community.js` : toggle "Club / Amis" sur le classement de Tribune (`renderFansGrid(mode)`), **tuiles de profil désormais cliquables** dans les deux modes (ouvre `openProfile()` — la tuile de soi-même n'est pas cliquable).
- Icône Amis (avec badge du nombre de demandes/échanges en attente) déplacée de Tribune seule vers **les 3 onglets**, comme l'icône Paramètres. A nécessité de resserrer la barre du haut (padding, gap, taille du logo) qui débordait sinon avec les deux icônes sur 375-390px de large.
- **Petite bio personnalisable** (100 caractères, gratuite) sous le pseudo dans "Mon Perso", éditable en un tap, visible aussi sur le profil d'un ami. Récupérée par une requête isolée (pas dans le `SELECT` partagé des listes de classement) pour que le classement continue de fonctionner même si la migration 31 n'a pas encore tourné.
- Fond de l'overlay du booster gratuit changé : dégradé texturé navy/corail (repris du dos de carte déjà validé en session précédente) au lieu d'un noir plat jugé trop générique.

### Bugs rencontrés et corrigés en cours de session

1. **Avatar du profil ami débordait de son cadre 96px.** `buildAvatarSVG(f)` appelé sans le paramètre `size` retournait un SVG à sa taille par défaut (280px, qui a ses propres attributs `width`/`height` fixés par l'API DiceBear) — le conteneur CSS de 96px n'y changeait rien puisque le SVG n'a pas `width:100%;height:100%`. Fix : `buildAvatarSVG(f, 96)`.
2. **Texte du bouton "Proposer un échange" rogné en haut sur iOS Safari.** Hypothèse retenue : mélange emoji + texte majuscule (`text-transform`) sur police display à petite taille (15px) faisait déborder la ligne au-dessus du bouton, coupée par l'`overflow:hidden` nécessaire à l'effet de reflet (`.btn-red::after`). Fix : nouvelle classe `.btn-red-compact` avec centrage flexbox + `line-height` explicite, plus robuste face aux métriques de police variables que l'alignement de ligne par défaut.
3. **Deux badges (rareté + nombre d'exemplaires) se chevauchaient** sur les cartes du compositeur d'échange (78px de large, trop étroit pour deux badges côte à côte). Fix : empilés verticalement dans le même coin plutôt que dans des coins opposés.

### Problème non résolu en fin de session : push git bloqué

`git push origin main` échoue de façon intermittente avec `Could not resolve host: github.com` — confirmé par `nslookup github.com` qui time out alors que `nslookup google.com` résout normalement. L'utilisateur confirme le même échec (`DNS_PROBE_FINISHED_NXDOMAIN`) depuis son propre navigateur, donc ce n'est **pas spécifique à l'environnement Claude Code** — panne DNS ponctuelle côté GitHub ou du réseau, à priori temporaire.

**État exact au moment de la fin de session** (vérifié via `git rev-parse origin/main` et `git log origin/main..HEAD`) :
- `origin/main` (dernier push confirmé réussi) : `4720b7e` (fix bug avatar 96px + fix bouton échange).
- **3 commits locaux en attente de push**, dans l'ordre :
  1. `6b6fa50` — badge nombre d'exemplaires dans le compositeur d'échange
  2. `93d5fcd` — classement XP amis + profils cliquables + icône amis sur 3 onglets + fond booster
  3. `42ca7e3` — bio personnalisable
  4. *(+ ce commit du journal lui-même, à suivre)*

Des tentatives de push automatiques ont été programmées en tâche de fond (`ScheduleWakeup`) toutes les ~20-25 minutes ; si la session reprend avant que ça ait abouti, **relancer `git push origin main`** en premier réflexe.

### Reste à faire

- **Confirmer le push** des 3-4 commits en attente une fois le DNS résolu.
- **Exécuter la migration `31_user_bio.sql`** (bio pas encore active en prod tant que ce n'est pas fait).
- **Tester en conditions réelles avec 2 comptes** : classement XP/prono amis (le prono nécessite un match clôturé via le bouton admin "🏆 Clôturer"), échange de cartes bout-en-bout, ajout d'ami depuis le classement Communauté (nouveau depuis `30_friend_request_by_id.sql`), affichage de la bio sur un profil ami.
- Le classement pronostic amis affichera 0 pour tout le monde tant qu'aucun match n'a été clôturé via le nouveau bouton admin (les matchs déjà joués avant l'activation de la fonctionnalité ne sont pas recomptés rétroactivement — compromis assumé, voir `29_pronostic_cumulative.sql`).
- **Dette non traitée, signalée mais volontairement hors périmètre** : l'écriture directe cliente sur `user_cards` (ouverture de boosters) n'est toujours pas verrouillée côté serveur — un client malveillant pourrait en théorie dupliquer des cartes en contournant le système d'échange. Migrer tout le tirage pondéré de cartes en RPC SQL serait un chantier séparé, plus risqué, non demandé pour l'instant.
- **Observation non actionnée** : `CLAUDE.md` décrit encore l'ancienne architecture pré-refonte (un seul `index.html`, avatars silhouette A/B, pas de multi-tenant) alors que le code a depuis basculé sur l'architecture modulaire `js/*.js` + DiceBear + `org_id`. À rafraîchir un jour (pas fait cette session, hors périmètre de la demande).

---

## Historique condensé des sessions précédentes (avant ce journal)

*Reconstruit a posteriori à partir de la mémoire de session et de `git log` — moins détaillé que les entrées ci-dessus, qui seront le niveau de détail de référence pour la suite.*

- **Refonte design white-label** (`feat/design-refresh` mergé dans `main`) : palette neutre `--brand-*` remplaçant les couleurs NBH en dur (permet de changer de club en modifiant ~10 variables CSS + une police), nouveau design clair/cream avec navbar SVG à creux, blob de séparation header/contenu. NBH garde sa propre palette (rouge/navy/or) chargée dynamiquement via `org_config` — la ressemblance de teintes entre le gabarit neutre et NBH est une coïncidence, pas un lien voulu.
- **Multi-tenant** : org neutre `demo` créée en parallèle de `nbh` pour valider la scalabilité. Migrations 19-23 : `org_id` ajouté sur `cards`/`user_cards` (créées hors tracking initial), table `unlockables` remplaçant le tableau hardcodé de la boutique avatar, RPC `buy_unlockable` réécrite pour scoper par org.
- **Pièges découverts et retenus** : les items d'avatar (écharpe/casquette/etc.) restent câblés en dur dans `avatar.js` malgré la table `unlockables` (seuls nom/prix/icône sont personnalisables par club, pas les slots eux-mêmes) ; la base est partagée entre branches alors que le code ne l'est pas (toujours vérifier `git log main..origin/main` avant de merger) ; `isAdmin()` doit vérifier l'org en plus du rôle ; mojibake sur les emojis/accents collés dans le SQL Editor Supabase (contourné en encodant les octets UTF-8 en hexadécimal).
- **Système de cartes à collectionner** : boosters payants (50 🐾, 3 cartes) et gratuit quotidien (1 carte/jour), tirage pondéré par palier de rareté (pas par carte individuelle, pour éviter que le nombre de cartes définies par palier ne fausse les probabilités réelles), onglets par équipe dans la collection.
- **Sécurité** : RLS `users` corrigée (tout utilisateur authentifié pouvait lire tous les clubs avant `my_org_id()` en SECURITY DEFINER), `delete_card_admin` scopée par org.
- **Écran Paramètres** séparé de "Mon Perso", accessible par une icône ⚙️ sur les 3 onglets (le pattern repris pour l'icône Amis cette session).
- **Redesign du booster** (dos de carte texturé + animation en cascade) avec un bug de rendu 3D (`backface-visibility`) qui ne se reproduisait qu'en Safari réel, pas en Chromium headless — retenu comme piège général : ne jamais valider un fix de rendu 3D CSS sans test sur device réel.
- **Analyses faites mais différées avant cette session** : mur social/fan wall (recommandation : contenu posté nativement par les fans plutôt qu'embeds officiels ou SaaS tiers, pour éviter la CSP stricte et les soucis RGPD des trackers tiers) — toujours non implémenté.
