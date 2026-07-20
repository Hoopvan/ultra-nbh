# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"Hoop NBH" — a French-language PWA fan companion app for Nantes Basket Hermine (a basketball club). It's a gamified community app: users sign in, create an avatar, complete daily "missions" (mini-games/quizzes), earn XP/coins, level up, and unlock cosmetic avatar items.

There is no JS framework, bundler, or package manager. The entire app is a single static HTML file with embedded `<style>` and `<script>` blocks, talking directly to Supabase from the browser.

## Build & local dev

There is no build step in the traditional sense — `index.html` is the deployed artifact, but it contains `{{SUPABASE_URL}}` / `{{SUPABASE_ANON_KEY}}` placeholders that must be substituted for local testing:

```powershell
./build.ps1
```

This reads `.env` (gitignored, contains `SUPABASE_URL` and `SUPABASE_ANON_KEY`) and writes the substituted result to `index-local.html` (also gitignored). Serve `index-local.html` with any static file server to test locally — e.g. it auto-enables a "demo mode" button when the hostname is `localhost`/`127.0.0.1` (see `startDemoMode()`), which bypasses Supabase auth entirely with an in-memory fake profile so the UI can be exercised without a backend.

There are no automated tests or linters in this repo.

## Deployment

Static hosting (the `_headers` file follows the Cloudflare Pages convention, disabling caching on all routes). `index.html` is committed directly with the Supabase placeholders intact — substitution presumably happens at deploy time via the same env-substitution approach as `build.ps1`, or the placeholders are replaced before each commit.

## Architecture (all in `index.html`)

The app is a single-page app with a manual screen-router — no virtual DOM, no routing library:

- **Screens** are `<div class="screen" id="screen-...">` elements toggled via `showScreen(name)` (full-screen views: onboarding, name entry, avatar creation, tutorial, game overlays) and `showTab(tab)` for the three main tabs once logged in: `tribune`, `missions`, `avatar` (see `const TABS`).
- **State** is held in plain global `let` variables (`currentUser`, `profile`, `gamesData`, avatar-creation/edit state, per-game answer flags like `vAnswered`/`anecAnswered`/`nnbAnswered`/`aaAnswered`/`pronoHome`/`pronoAway`). There is no state management library — UI is re-rendered imperatively (`updateUI()`, `renderAvatar()`, `renderEquip()`, etc.) after state mutations.
- **Backend**: Supabase (`db = createClient(...)`). Auth is Google OAuth (`signInWithGoogle`). Tables used directly from the client: `users` (profile, XP, streak, avatar config, owned/worn items), `games` (daily mission content/config, keyed by `type` + `date` + `active`), `pouls_votes`, `pronostic_votes`, `boite_winners`.
- **Gamification system**:
  - `LEVELS` defines XP thresholds/names; `getLevel()` derives the current level from `profile.xp`.
  - `UNLOCKABLES` defines purchasable cosmetic items (cost in coins); `buyItem()`/`toggleWorn()` manage ownership/equipping.
  - Daily missions are loaded from the `games` table by `loadGames()`, which picks "today's" entry per game `type` (`pouls`, `vestiaire`, `anecdote`, `nantes_nbh`, `avant_apres`, `pronostic`, `boite_mystere`). Each mission type has its own `init*`/`answer*`/`submit*` functions (e.g. `initVestiaire`/`answerVestiaire`, `initAnecdote`/`answerAnecdote`, `initPronostic`/`submitPronostic`/`checkPronoResult`, `initBoite`/`initScratchCanvas`/`claimBoite`).
  - `addXP()`/`addInteraction()` persist progress to Supabase; `setMissionDone()` flips a mission card to its completed state.
- **Avatar rendering**: avatars are generated as inline SVG strings by `buildAvatarSVG()` (full) and `miniAvatarSVG()` (small/list version), parameterized by silhouette (`A`/`B`), skin tone (`SKINS`), hairstyle, and equipped unlockable items (echarpe/casquette/maillot).
- **PWA**: `manifest.json` + `sw.js` (network-first with cache fallback, explicitly bypasses Supabase requests) registered at the bottom of `index.html`. Bumping the cache requires changing `CACHE` in `sw.js` (currently `hoop-nbh-v5`).

## Conventions to be aware of

- All user-facing copy is in French; keep new copy consistent in tone (casual, exclamation-heavy, emoji use in mission titles/labels).
- New daily mission types follow the existing `init*()` / `answer*()` / `openGameReadOnly()` pattern and are driven by rows in the Supabase `games` table rather than hardcoded content — check how existing types (`vestiaire`, `anecdote`, `nantes_nbh`, `avant_apres`, `pronostic`) read their `content` JSON before adding a new one.
- `window._demoMode` short-circuits Supabase calls in several places — when touching profile/XP/mission-completion code paths, verify the demo-mode branch still works.

## Communication
- Always explain in French what you are about to do and why before executing any command
- Keep explanations short and clear

## Journal de développement

`Docs/Journal_Developpement.md` retrace l'historique complet du projet, session par session : ce qui a été fait, pourquoi, les décisions techniques, les migrations SQL créées et leur statut d'exécution, les bugs rencontrés/corrigés, ce qui reste en attente. **Mettre à jour ce fichier à la fin de chaque session de travail** (nouvelle entrée en tête de fichier, la plus récente en premier), avant de conclure — c'est la référence pour comprendre comment l'app a été construite au fil du temps, complémentaire à `git log` (qui ne capture pas le "pourquoi" ni le contexte produit).
