# Journal de développement — Hoop NBH

Historique du projet, session par session, la plus récente en premier. Objectif : retracer **ce qui a été fait, pourquoi, et comment**, en complément de `git log` (qui donne le *quoi* mais pas le contexte produit ni les décisions techniques). À mettre à jour à la fin de chaque session de travail.

---

## Session du 2026-07-23 (suite) — Audit responsive complet + fix scroll-end-spacer confirmé

### Contexte

Suite de la session bugs mobile/PWA du même jour (voir entrée précédente) : l'extension Chrome (`claude-in-chrome`) a fini par se connecter, et l'utilisateur a demandé un audit responsive "expert" complet de toute la webapp (tous breakpoints 320-2560px, tous navigateurs, accessibilité, perf, PWA...).

**Cadrage posé avant de commencer (question explicite à l'utilisateur) :** `#app` a un `max-width:430px` fixe et volontaire (cadre téléphone centré sur desktop, décision déjà prise en session design refresh) — l'utilisateur a confirmé vouloir **garder ce principe** plutôt que refondre en vraie mise en page desktop. L'audit s'est donc concentré sur la vraie plage d'usage (320-430px), avec juste une vérification que le cadre desktop ne bug pas.

### Contrainte d'outillage découverte et contournée

`resize_window` (extension Chrome) ne redimensionne pas réellement la fenêtre native en dessous d'environ 500-520px de large (limite interne de Chrome) — confirmé par `window.innerWidth` qui restait bloqué ~500-524px quel que soit la valeur demandée, y compris via un appel Win32 `MoveWindow` direct (PowerShell) en dessous de cette largeur. **Contournement retenu** : forcer la largeur de `#app` lui-même via une feuille de style injectée (`__vpSim(w, h)`, définit `#app{width:...!important}` + `--app-height`) plutôt que la fenêtre réelle — fiable pour tout ce qui est positionné `.screen`/`position:absolute` (contenu normal de l'app), qui suit `#app`.

**Piège découvert avec cette technique** : les éléments `position:fixed` (3 `.modal-overlay`, `#overlay-booster`, `#overlay-trade-composer`, `.notif`) ignorent `#app` et se calent sur le **vrai** viewport — donc invisibles/faussés par `__vpSim` seul. Pour les tester à une largeur/hauteur réelle courte (ex. simuler un paysage), il a fallu un vrai redimensionnement de fenêtre OS via `MoveWindow` (Win32, PowerShell) — largeur toujours bridée à ~500px par Chrome, mais la **hauteur**, elle, accepte de descendre bien plus bas (testé jusqu'à 270px réels), ce qui a suffi à révéler un vrai bug (voir plus bas).

### Bugs responsive trouvés et corrigés (tous vérifiés visuellement avant/après)

| Bug | Cause | Fix |
|---|---|---|
| Compteur du prochain match (JOURS/HEURES/MIN/SEC) déborde de sa carte à ≤360px, un bloc coupé | `.countdown-box` est `flex:1` sans `min-width:0` — le minimum de contenu (padding + "00") empêche le rétrécissement en dessous d'un certain seuil, dépassé à 320-360px | `min-width:0` ajouté à `.countdown-box` (style.css) ; padding/gap/font-size encore réduits dans le `@media (max-width:360px)` existant |
| **Overlay d'ouverture de pack (le moment le plus visible de l'app) : 3 cartes à largeur fixe 100px débordent de l'écran sans wrap sur iPhone SE/mini/13 mini (320-375px)** | `js/cards.js` `showPackOverlay()` codait en dur `CARD_W = 100` (px), sans lien avec la largeur réelle disponible | `CARD_W` calculé dynamiquement depuis `window.innerWidth` (borné 64-100px, hauteur dérivée du ratio 100:145), même logique que `setAppHeight()` déjà utilisée ailleurs dans le code |
| **Bug bloquant découvert en testant le fix ci-dessus : en mode démo local, ouvrir un pack gèle l'app indéfiniment** | `loadCards()` (js/cards.js) n'avait pas de garde `demoMode` (contrairement à `loadUserCards()`/`persistDrawnCards()`) — appel réseau réel vers les credentials placeholder de `.env`, qui ne timeout jamais vraiment (pas juste ~7-8s comme observé ailleurs) | Ajout d'un jeu de 4 cartes factices (`DEMO_CARDS`) retourné directement si `demoMode`, sans appel réseau — cohérent avec le principe du mode démo ("bypasse Supabase partout") documenté dans CLAUDE.md |
| Bouton "Ajouter" (ajout d'ami par code) poussé hors écran à 320px, invisible/inaccessible | `.friend-code-input` est `flex:1` sans `min-width:0` — même piège que le compteur, le champ texte a un minimum de largeur intrinsèque (~170-190px navigateur) qui pousse le bouton "Ajouter" hors du cadre | `min-width:0` ajouté à `.friend-code-input` |
| **Overlay de pack, modales (suppression compte, niveaux, déblocage) et composeur d'échange inutilisables/bloquants sur un écran très court (paysage, fenêtre réduite)** — contenu coupé en haut ET en bas, sans aucun scroll, bouton retour inatteignable | Ces éléments `position:fixed;inset:0` centraient leur contenu (`justify-content/align-items:center` ou modale ancrée en bas) sans jamais prévoir de `overflow-y:auto` — invisible tant qu'on ne teste pas un vrai viewport court | `overflow-y:auto` ajouté à `#overlay-booster` et `#overlay-trade-composer` ; `.modal` passe à `max-height:85vh; overflow-y:auto` (pattern bottom-sheet standard) |

### Revue statique (pas de bug trouvé, juste vérifié)

- Tous les écrans de jeu (`pouls`, `vestiaire`, `anecdote`, `nantes_nbh`, `avant_apres`, `timeline`, `photo_mystere`, `pronostic`, `boite_mystere`) utilisent grid/flex en `%`/`fr`, aucune largeur fixe risquée trouvée.
- `.trade-cards-row` a déjà `overflow-x:auto` pour ses cartes à largeur fixe (78px) — pattern correct, contrairement à l'overlay de pack qui ne l'avait pas.
- Grep ciblé de tous les `flex: 1` du CSS : seuls le compteur et le champ code ami manquaient de `min-width:0` parmi les cas à risque réel (les autres, comme `.mission-info`, contiennent du texte qui *wrap* au lieu de forcer un minimum — pas de bug).
- Aucun `outline:none` global sur les boutons/nav (seulement sur des champs de formulaire, remplacé par un changement de bordure visible) — pas d'anti-pattern d'accessibilité clavier flagrant trouvé.
- Écrans Collection, Paramètres, Mon Perso, Tribune, Missions, panneau d'édition avatar, Mes Amis : vérifiés visuellement à 320/375/430px, scroll-end-spacer et safe-area (fixes de la session précédente) confirmés fonctionnels.

### Limites explicites de cet audit (à ne pas prendre pour un audit exhaustif)

- Testé uniquement sous **Chrome desktop** (via l'extension) — pas de test réel Safari/Firefox/Edge, ni Android/iOS physique.
- Pas d'audit de contraste WCAG systématique (calcul de ratio par paire texte/fond) — vérification légère seulement (tokens `--on-dark` déjà en place depuis les sessions précédentes).
- Pas de nettoyage CSS mort / doublons entrepris (tâche importante mais distincte, reportée si l'utilisateur la souhaite).
- Tailles tactiles (`.game-back-btn`, `.settings-icon-btn` ≈ 34-36px) sous la recommandation 44×44px — signalé mais pas modifié unilatéralement (impact visuel notable sur des éléments de nav très visibles, à valider avec l'utilisateur avant de toucher).

### Fichiers modifiés

`style.css` (5 fixes ci-dessus), `js/cards.js` (largeur de carte responsive + garde démo sur `loadCards`), `js-local/` régénéré via `build.ps1`.

### Reste à faire

- Décider si un audit de contraste WCAG AA formel et/ou un agrandissement des zones tactiles sous 44px est souhaité.
- Nettoyage CSS mort/doublons (non fait, reporté).
- Confirmer sur device réel (comme toujours pour les sujets iOS/Safari — Playwright/Chrome ne suffisent pas pour les bugs WebKit spécifiques).

---

## Session du 2026-07-21/22 — Bugs remontés par les tests, cadeau de bienvenue, CMS cartes, exploration équipements

### Contexte / demande initiale

Suite directe de la session du 2026-07-20 (système d'amis) : l'utilisateur a testé en conditions réelles et remonté une série de bugs + demandes ponctuelles au fil de la session, plutôt qu'un seul chantier planifié.

### Bugs corrigés

| Bug | Cause | Fix |
|---|---|---|
| Bio "Mon Perso" pas centrée, collée à "Modifier mon look" | `.profile-bio` (div bloc) n'avait pas `margin:auto` — le `text-align:center` du parent ne centre pas un enfant bloc, seulement le texte à l'intérieur de sa propre boîte. Bouton sans marge du haut. | `margin:0 auto 14px` sur `.profile-bio`. |
| Pictogramme ✏️ affiché deux fois (bio + "Modifier mon look") | Redondance de contenu, pas un bug technique. | Retiré le ✏️ du texte de la bio (`js/profile.js`, `index.html`). |
| Boîte Mystère reste incrustée sous l'écran Missions après clic sur "J'AI COMPRIS" | **Root cause trouvée après un premier correctif insuffisant** (scrollIntoView du bouton) : `claimBoite()` appelle une fonction `closeGame()` *locale à `js/games/boite.js`*, différente de celle exportée par `screens.js` et utilisée par la flèche retour — cette version locale se contentait de `dispatchEvent('game:closed')` sans jamais cacher les éléments `.game-screen`. | `closeGame()` locale de `boite.js` cache maintenant aussi `.game-screen` avant de dispatcher l'event, comme la version de `screens.js`. |
| Badges de rareté (bronze/argent/or) sans couleur dans le compositeur d'échange | `js/friends.js` construisait les cartes du compositeur sans poser la classe `card-rarity-${rarity}` (présente dans la vue "Ma collection"/"Sa collection" mais oubliée ici) — le CSS qui colore bordure + badge dépend de cette classe sur le conteneur. | Classe ajoutée sur `.trade-card-pick`, + règle CSS dédiée pour le cadre (la carte n'a pas de `.card-front-face` comme la collection, structure DOM différente). |

### Cadeau de bienvenue (150 🐾) + animation tuto

Demande : à la création de compte, offrir 150 Hermines (au lieu de 0) pour que le joueur puisse débloquer un équipement dès le début, avec une petite animation dans l'onboarding — et garder "Couleurs NBH" gratuite mais **non portée par défaut** (pour que l'utilisateur découvre lui-même le mécanisme d'équipement). Vérifié que ce dernier point était déjà le comportement réel du code (`worn_items` démarre à `[]`, seul `active_items` contient `["couleurs"]` = juste "possédée", pas "portée") — rien à changer de ce côté.

- **`supabase/32_starter_coins.sql`** (à exécuter sur Supabase) : recrée `create_profile()` à l'identique (même signature que la version de `27_friends_system.sql`), seul le coins initial passe de `0` à `150`.
- **Nouveau slide 2 du tuto** ("Un cadeau pour commencer") inséré juste après l'écran de bienvenue — tous les slides suivants renumérotés `tuto-3` à `tuto-6` (`index.html`, `js/tuto.js` `TUTO_STEPS` passé à 6, `js/config.js` sélecteur `#tuto-6 p` mis à jour en conséquence). Animation : emoji 🐾 qui "pop" (`coinPop` keyframe) + compteur qui défile de 0 au solde réel (`requestAnimationFrame`, easing cubique), rejouable sans re-déclencher si le tuto est relancé depuis Paramètres (affiche alors le solde réel, pas re-99999 → 150 fictif).

### CMS Admin > Cartes : réorganisation + nouvelles catégories

Demande : formulaire d'ajout de carte avant la liste des cartes existantes (plutôt qu'après), liste triée/groupée par catégorie, + 3 nouvelles catégories : **Kop, Fans, Partenaires**.

- `index.html` : blocs "Ajouter une carte" et "Cartes existantes" inversés dans le DOM.
- `js/config.js` : `TEAM_LABEL`/`TEAM_ORDER` étendus (`pro, espoir, asso, kop, fans, partenaires, admin, autre`) — ces constantes sont déjà consommées dynamiquement partout ailleurs (onglets de la collection fan dans `cards.js`), donc les nouvelles catégories apparaissent automatiquement comme onglets dès qu'une carte les utilise, sans autre changement.
- `js/admin.js` `loadCardList()` : la liste est maintenant triée par catégorie (ordre `TEAM_ORDER`) puis par `sort_order` manuel à l'intérieur, avec un en-tête de section par catégorie. Les flèches ▲▼ de réordonnancement sont désormais désactivées aux **limites du groupe** (pas juste début/fin de liste globale) pour qu'on ne puisse jamais faire sauter une carte dans une autre catégorie par erreur via ces boutons.
- Aucune contrainte SQL (`CHECK`) ne restreint les valeurs de `cards.team` — pas de migration nécessaire pour les nouvelles catégories, colonne texte libre.

### Équipements avatar — casquette et lunettes livrés, écharpe/maillot/bandeau abandonnés cette session

Demande initiale large ("des designs de meilleure qualité, plus liés à des clubs de sport") pour les 6 équipements payants. Approche choisie : construire un **artifact HTML interactif** (avatar DiceBear + overlays réels, toggle avant/après par item) pour valider visuellement avant de toucher au vrai code — évite d'itérer à l'aveugle sur des captures d'écran.

**Livré et poussé dans `js/avatar.js` :**
- **Casquette** : redessinée (dégradé, coutures de panneaux façon vraie casquette gaufrée), rétrécie et remontée pour ne plus couper les yeux (l'ancienne version, une fois agrandie dans l'aperçu, débordait jusqu'à hauteur des yeux), texte "NBH" conservé (l'utilisateur n'a pas voulu de l'écusson rond proposé initialement). Le gradient SVG (`<linearGradient id="capGrad">`) est maintenant suffixé par un identifiant unique par avatar (`++_uidCounter`) — sinon collision d'id si plusieurs avatars avec casquette sont inlinés sur la même page (liste d'amis, classement).
- **Lunettes** : **pas de nouveau dessin** — on garde la monture générique DiceBear (demande explicite de l'utilisateur), juste recolorée en rouge club via le paramètre natif `accessoriesColor` de l'API DiceBear (découvert en session en interrogeant `schema.json` de l'API), au lieu d'un overlay dessiné à la main comme prévu initialement.

**Abandonnés cette session (écharpe, maillot, bandeau) :**
- Mes deux premières tentatives de redesign (dessinées à la main en SVG) ont été jugées mauvaises par l'utilisateur ("horrible", "affreux") — décision : il préfère designer ces 3 items en externe et me renvoyer les fichiers plutôt que je continue à réinterpréter ses demandes.
- Écharpe : nouvelle direction demandée mais pas encore livrée — tenue à bout de bras au-dessus de la tête (photo de référence fournie), pas nouée autour du cou comme avant.
- Bandeau : doit devenir un **badge/pin épinglé sur le torse** (décision prise via question à choix), pas juste un habillage de headband — mais pas encore designé/intégré.
- Maillot : l'utilisateur a fourni `Design/maillot.svg` (col en V doré/marine, bande blanche, "NBH") — **rendu visuellement bon**, mais j'ai commis l'erreur de le redessiner moi-même au lieu de l'utiliser tel quel (mal reçu, "horrible"). En repartant sur l'idée d'utiliser directement son fichier, découverte d'un problème technique réel : le SVG n'a **aucune transparence** (tous les pixels opaques, y compris les coins) — ce qui ressemblait à un damier de transparence à l'écran est en fait un motif blanc/gris opaque cuit dans l'image (résidu probable du fond studio de la photo source, mal géré par l'outil de vectorisation). Confirmé via un script Node + `sharp` (lecture des pixels bruts). **Décision utilisateur : abandonné pour cette session**, à reprendre quand il aura des fichiers avec une vraie transparence (ou détourés).
- Livrés à l'utilisateur pour qu'il fasse le design en externe : un **gabarit SVG de calage** (`Design/gabarit-equipements.svg` — avatar en transparence + repères visage/yeux/col/zone circulaire de sécurité) et 3 **prompts de génération d'image** (écharpe/maillot/badge) prêts à coller dans un outil type Midjourney/DALL·E, avec rappel qu'il faudra vectoriser + recaler sur le gabarit ensuite.
- **Format à respecter documenté pour toute future contribution externe** : SVG (pas raster), `viewBox="0 0 280 280"` exact, fond réellement transparent (pas juste visuellement), couleurs en dur sauf zone à paramétrer par club, texte vectorisé sauf si doit rester éditable.

### Incident récurrent : DNS GitHub

`git push` a de nouveau échoué avec `Could not resolve host: github.com` (même symptôme que la session du 2026-07-20 : `nslookup github.com` timeout, `nslookup google.com` résout normalement). Un simple **retry** (sans aucune autre action) a suffi à faire passer le push. Confirme que ce n'est décidément pas un problème d'environnement ou de config — juste une résolution DNS ponctuelle côté GitHub/réseau, qui se résout seule.

### Reste à faire

- **Exécuter `supabase/32_starter_coins.sql`** sur le Dashboard Supabase (pas encore confirmé fait par l'utilisateur à la fin de cette session).
- **Tester en conditions réelles** : création d'un nouveau compte (150 🐾 + slide d'animation du tuto), CMS cartes réorganisé (catégories Kop/Fans/Partenaires), casquette repositionnée, lunettes recolorées.
- **Écharpe / maillot / bandeau** : en attente de fichiers de l'utilisateur, designés en externe, avec une vraie transparence — à intégrer dans `avatar.js` une fois reçus (overlay SVG classique comme les autres items, pas de nouveau mécanisme de rendu nécessaire).
- **`Design/`** toujours non tracké dans git (dossier de travail/scratch avec captures de bugs, polices, gabarit) — décision de le tracker ou pas toujours reportée.

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
| `31_user_bio.sql` | Colonne `users.bio` (100 caractères max, check constraint), grant update additif (colonne cosmétique, même traitement que `name`/`avatar_*`). | ✅ Exécutée |

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

### Incident résolu : push git bloqué par une panne DNS GitHub

`git push origin main` a échoué de façon intermittente pendant une bonne partie de la session avec `Could not resolve host: github.com` — confirmé par `nslookup github.com` qui timait out alors que `nslookup google.com` résolvait normalement. L'utilisateur a confirmé le même échec (`DNS_PROBE_FINISHED_NXDOMAIN`) depuis son propre navigateur, donc ce n'était **pas spécifique à l'environnement Claude Code** — panne DNS ponctuelle côté GitHub ou du réseau. Résolu tout seul le lendemain (2026-07-21) : `nslookup github.com` a de nouveau résolu une IP (`140.82.121.4`), et les 4 commits accumulés (`6b6fa50`, `93d5fcd`, `42ca7e3`, `6fb40e7`) ont été poussés d'un coup. `origin/main` est à jour à `6fb40e7`.

**Piège à retenir** : si `git push` échoue avec `Could not resolve host`, vérifier `nslookup github.com` vs `nslookup google.com` pour distinguer une vraie panne DNS externe (résolution automatique en quelques heures, rien à corriger côté projet) d'un souci d'environnement. Ne pas chercher de fix côté config git/réseau local dans ce cas.

### Reste à faire

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
