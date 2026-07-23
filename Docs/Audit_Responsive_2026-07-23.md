# Audit Responsive & Robustesse — 2026-07-23

Audit complet demandé par l'utilisateur ("revue Front-End Senior : responsive, robustesse, accessibilité") sur l'intégralité de la webapp Hoop NBH. Ce document décrit le périmètre réel couvert, la méthode utilisée, les bugs trouvés et corrigés, et ce qui reste explicitement non traité.

## Cadrage du périmètre

La demande initiale visait un audit générique (React/Tailwind, breakpoints 320px→2560px, tous navigateurs). Deux réalités du projet ont recadré le périmètre avant de commencer :

1. **L'app n'est pas un framework JS** — c'est un fichier `index.html` unique avec CSS/JS vanilla parlant directement à Supabase. Il n'y a ni composants React, ni re-renders, ni container queries au sens framework.
2. **`#app` a un `max-width: 430px` volontaire** (`style.css:79`) : sur desktop/tablette, l'app s'affiche comme un cadre téléphone centré sur fond navy (comportement déjà validé lors de la session "design refresh"), pas comme une mise en page desktop qui remplit l'écran.

**Décision validée avec l'utilisateur avant de commencer** : garder le principe du cadre téléphone. L'audit s'est donc concentré sur la **vraie plage d'usage mobile/PWA (320-430px)**, avec une simple vérification que le cadre desktop ne bug pas au-delà.

## Méthodologie et outillage

- Test via l'extension **Chrome desktop** (`claude-in-chrome`) uniquement — pas d'accès à Safari, Firefox, Edge, ni à un appareil iOS/Android physique dans cet environnement.
- **Contrainte découverte** : l'outil `resize_window` de l'extension ne redimensionne jamais réellement la fenêtre Chrome en dessous d'environ 500-520px de large (limite interne de Chrome, confirmée même via un appel direct à l'API Win32 `MoveWindow`).
- **Contournement retenu** : injection d'une feuille de style forçant la largeur de `#app` (`#app{width:Wpx!important}`) plutôt que redimensionner la fenêtre réelle — fiable pour tout le contenu normal de l'app (`.screen`, éléments positionnés relativement à `#app`).
- **Piège de cette technique** : les éléments `position:fixed` (modales, overlays plein écran, toast) ignorent `#app` et se calent sur le vrai viewport de la fenêtre — invisibles/faussés par la seule injection de style. Pour ceux-là, un vrai redimensionnement de fenêtre OS (Win32 `MoveWindow`) a été utilisé : la largeur reste bridée par Chrome (~500px), mais la **hauteur** accepte de descendre bien plus bas (testé jusqu'à 270px réels) — suffisant pour révéler un bug réel de débordement vertical (voir plus bas).
- Mode démo local (`window._demoMode`) utilisé pour naviguer l'app sans backend réel (credentials Supabase de `.env` étant des placeholders).

Cette méthode reste plus proche d'un test manuel outillé que d'un test cross-browser automatisé complet — voir la section "Non couvert" pour les limites explicites.

## Bugs trouvés et corrigés

Chaque bug a été reproduit, corrigé, puis re-vérifié visuellement (avant/après) avant d'être considéré résolu.

### 1. Compteur du prochain match déborde à ≤360px

**Symptôme** : sur l'onglet Trocardière, les 4 blocs du compte à rebours (JOURS / HEURES / MIN / SEC) débordaient de leur carte à 320-360px de large ; le dernier bloc ("SEC") était coupé, invisible.

**Cause** : `.countdown-box` est `flex: 1` sans `min-width: 0`. Par défaut, un enfant flex ne peut pas rétrécir en dessous de la largeur de son propre contenu (padding + texte) — ce plancher, une fois dépassé par la somme des 4 blocs, provoque un débordement au lieu d'un rétrécissement.

**Fix** (`style.css`) : ajout de `min-width: 0` sur `.countdown-box` ; le `@media (max-width: 360px)` existant a été complété (padding, gap et taille de police réduits) pour un rendu plus confortable sur les très petits écrans.

### 2. Overlay d'ouverture de pack de cartes déborde sur iPhone SE/mini (320-375px)

**Symptôme** : à l'ouverture d'un pack (fonctionnalité la plus visible/excitante de l'app), les 3 cartes révélées débordaient hors de l'écran sur les téléphones étroits — une partie des cartes était totalement invisible et inaccessible, sans aucun scroll possible.

**Cause** : `js/cards.js` (`showPackOverlay`) codait en dur `CARD_W = 100` (pixels), sans lien avec la largeur réelle disponible. Avec 3 cartes de 100px + espacements + padding de l'overlay, il fallait au moins ~376px de large disponibles — en dessous, débordement garanti (touche directement les iPhone SE, mini, 12/13 mini, et de nombreux Android à 360px).

**Fix** (`js/cards.js`) : la largeur des cartes est maintenant calculée dynamiquement à partir de `window.innerWidth` (bornée entre 64 et 100px), la hauteur étant dérivée du ratio d'origine (100:145) — même logique que `setAppHeight()` déjà utilisée ailleurs dans le code pour les calculs de dimension responsive.

### 3. Mode démo local : geler indéfiniment en ouvrant un pack

**Découvert en vérifiant le fix n°2.** En mode démo (test local sans backend), cliquer sur "Ouvrir un pack" gelait l'application indéfiniment.

**Cause** : `loadCards()` (`js/cards.js`) était la seule fonction du module à ne pas avoir de garde `demoMode` (contrairement à `loadUserCards()`, `persistDrawnCards()`, etc.) — elle tentait un vrai appel réseau vers les credentials Supabase placeholder de `.env`, qui ne timeout jamais vraiment (contrairement à d'autres appels de la page qui échouent en ~7-8s).

**Fix** (`js/cards.js`) : ajout d'un jeu de 4 cartes factices (`DEMO_CARDS`) retourné directement quand `demoMode` est actif, sans appel réseau — cohérent avec le principe documenté du mode démo ("bypasse Supabase partout").

### 4. Bouton "Ajouter" (ajout d'ami) poussé hors écran à 320px

**Symptôme** : sur l'écran "Mes Amis", le bouton "Ajouter" à côté du champ de saisie du code ami était poussé hors du cadre visible à 320px de large — invisible et impossible à cliquer.

**Cause** : même famille de bug que le n°1 : `.friend-code-input` est `flex: 1` sans `min-width: 0`. Un champ `<input>` a une largeur minimale intrinsèque définie par le navigateur (indépendante du placeholder), qui pousse le bouton voisin hors du conteneur une fois l'espace disponible trop réduit.

**Fix** (`style.css`) : ajout de `min-width: 0` sur `.friend-code-input`.

### 5. Overlay de pack, modales et composeur d'échange bloquants sur écran court

**Symptôme découvert en testant une hauteur de fenêtre réelle réduite** (simulation d'un usage en paysage / fenêtre courte) : l'overlay d'ouverture de pack, les 3 modales (suppression de compte, niveaux, déblocage) et le composeur d'échange coupaient leur contenu en haut ET en bas sans aucune possibilité de scroll — le bouton "Retour"/"Annuler" devenait totalement inatteignable. Un utilisateur dans cette situation resterait bloqué sur l'écran.

**Cause** : ces éléments sont en `position: fixed; inset: 0`, avec leur contenu centré (`justify-content`/`align-items: center`) ou ancré en bas (bottom-sheet), sans jamais prévoir de `overflow-y: auto` — un cas invisible tant qu'on ne teste pas un viewport réellement court.

**Fix** (`style.css`) :
- `overflow-y: auto` ajouté à `#overlay-booster` et `#overlay-trade-composer`.
- `.modal` passe à `max-height: 85vh; overflow-y: auto` (pattern bottom-sheet standard, scrollable si le contenu dépasse).

## Revue statique (vérifiée, aucun bug trouvé)

- Les 9 écrans de jeu (`pouls`, `vestiaire`, `anecdote`, `nantes_nbh`, `avant_apres`, `timeline`, `photo_mystere`, `pronostic`, `boite_mystere`) utilisent des grilles/flex en `%`/`fr` — aucune largeur fixe risquée trouvée.
- `.trade-cards-row` a déjà `overflow-x: auto` pour ses cartes à largeur fixe (78px) — bon pattern, contrairement à l'overlay de pack qui en était dépourvu avant ce fix.
- Grep ciblé de tous les `flex: 1` du CSS : parmi les cas à risque réel, seuls le compteur et le champ code ami manquaient de `min-width: 0` (les autres, comme `.mission-info`, contiennent du texte qui peut *wrap* au lieu de forcer un minimum de largeur — pas de bug).
- Aucun `outline: none` global sur boutons/nav trouvé (seulement sur des champs de formulaire, où l'outline est remplacé par un changement de bordure visible) — pas d'anti-pattern d'accessibilité clavier flagrant.
- Écrans Collection, Paramètres, Mon Perso, Tribune, Missions, panneau d'édition avatar, Mes Amis : vérifiés visuellement à 320/375/430px ; les fixes `scroll-end-spacer` et `safe-area` de la session précédente restent fonctionnels (pas de régression).
- Non-régression confirmée à 430px (largeur "normale" du cadre desktop) pour tous les éléments corrigés ci-dessus.

## Non couvert par cet audit

À reprendre si souhaité, dans une session dédiée :

- **Audit de contraste WCAG AA formel** (calcul de ratio par paire texte/fond) — seule une vérification légère a été faite (les tokens `--on-dark`/`--on-dark-muted` mis en place lors de sessions précédentes couvrent déjà le piège le plus connu du projet).
- **Zones tactiles sous 44×44px** : plusieurs boutons icône (`.game-back-btn`, `.settings-icon-btn`) mesurent ~34-36px. Signalé mais pas modifié unilatéralement : ce sont des éléments de navigation très visibles, un agrandissement changerait sensiblement le rendu visuel et mérite validation avant modification.
- **Nettoyage CSS mort / règles dupliquées ou contradictoires** — non entrepris, tâche distincte et potentiellement conséquente.
- **Tests réels** sur Safari, Firefox, Edge desktop, et sur appareils Android/iOS physiques — hors de portée de l'environnement de test disponible (Chrome desktop uniquement).
- **Performance** (CLS, LCP, poids des animations) — non auditée spécifiquement dans cette passe.

## Fichiers modifiés

| Fichier | Changement |
|---|---|
| `style.css` | 5 fixes ci-dessus (`.countdown-box`, `@media 360px`, `.friend-code-input`, `#overlay-booster`, `#overlay-trade-composer`, `.modal`) |
| `js/cards.js` | Largeur de carte responsive (`CARD_W` calculé dynamiquement) + garde `demoMode` sur `loadCards()` |
| `js-local/`, `index-local.html` | Régénérés localement via `build.ps1` (non trackés git) |
