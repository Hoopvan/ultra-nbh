# Audit de Sécurité — Hoop NBH PWA
Date : 2026-06-19

Contexte : PWA fan app (Nantes Basket Hermine), single-page app sans framework, Supabase backend (auth Google OAuth + PostgreSQL + Storage). Tout le code tourne dans le navigateur.

---

## CRITICITÉ CRITIQUE

### 1. Escalade de privilèges — Accès admin côté client uniquement
**Fichier** : `js/admin.js` lignes 4-6

La vérification `isAdmin()` est purement côté client. Depuis la console :
```javascript
setProfile({...profile, role: 'org_admin'})
window._adminSave('boite_mystere') // Crée de fausses missions
```
**Correction** : Ajouter une vérification RLS côté Supabase sur toutes les tables/RPCs admin (missions, cartes), basée sur la colonne `role` de la table `users`.

---

### 2. XSS via innerHTML non échappé
**Fichiers** : `js/admin.js`, `js/games/loader.js`, `js/games/pronostic.js`, `js/community.js`

Le contenu venant de Supabase est injecté directement :
```javascript
q.innerHTML = c.question; // c.question vient de la DB sans échappement
```
Un admin peut injecter : `<img src=x onerror="setProfile({...profile, xp:99999})">`

**Correction** : Remplacer `innerHTML` par `textContent` partout où du HTML n'est pas nécessaire. Utiliser DOMPurify pour les cas qui nécessitent du HTML.

---

### 3. Triche XP/Coins via bascule en mode démo
**Fichiers** : `js/auth.js`, `js/cards.js`, tous les jeux

`demoMode` est une variable d'état modifiable depuis la console :
```javascript
setDemoMode(true)
submitPouls() // Gagne 20 XP sans RPC
setDemoMode(false)
```
**Correction** : Supprimer le mode démo en production, le restreindre à localhost via une vérification serveur. Tous les gains XP/coins doivent passer par des RPCs Supabase.

---

### 4. Bypass du contrôle de rejeu de missions
**Fichiers** : Tous les jeux

Le check "déjà joué aujourd'hui" repose sur `profile.{game}_date` modifiable côté client :
```javascript
setProfile({...profile, pouls_date: '2000-01-01'})
submitPouls() // Rejoue la mission et gagne les XP
```
**Correction** : Les RPCs Supabase doivent vérifier eux-mêmes la date côté serveur et retourner `ALREADY_PLAYED_TODAY`.

---

### 5. Suppression de compte sans vérification serveur
**Fichier** : `js/auth.js`

La confirmation est uniquement un modal HTML contournable :
```javascript
deleteAccount() // Appel direct, sans passer par le modal
```
**Correction** : Implémenter une confirmation par email ou une validation serveur du RPC.

---

## CRITICITÉ HAUTE

### 6. Manipulation du classement via modification d'XP client
**Fichier** : `js/community.js`

Le classement se base sur la colonne `xp` de la table `users`. Si les missions sont rejouables (voir point 4), le XP peut être gonflé artificiellement.

**Correction** : RLS strict sur la mise à jour du XP + vérification serveur dans chaque RPC de jeu.

---

### 7. Date calculée côté client — bypass timezone
**Partout** (ex: `js/auth.js`)

```javascript
const today = new Date().toISOString().split('T')[0];
```
Changer la timezone système fait changer `today` → peut rejouer des missions du "lendemain".

**Correction** : Récupérer la date courante depuis le serveur via un RPC `get_server_date()`.

---

### 8. Rate limiting absent sur les RPCs
**Fichiers** : Tous les RPCs de jeux

Aucun rate limiting. Un bot peut appeler les RPCs (submit_pouls, submit_vestiaire, etc.) en boucle.

**Correction** : Ajouter une vérification temporelle dans chaque RPC (ex: `last_action_at < now() - interval '1 minute'`).

---

### 9. Exposition d'URLs arbitraires via logo_url
**Fichier** : `js/config.js`

```javascript
el.innerHTML = `<img src="${cfg.logo_url}" ...>`
```
`logo_url` stockée en DB peut contenir du JavaScript encodé ou une URL de phishing.

**Correction** : Valider que l'URL commence par `https://` et appartient à une whitelist de domaines. Utiliser un élément `<img>` créé via DOM plutôt que `innerHTML`.

---

### 10. Messages d'erreur Supabase exposés à l'utilisateur
**Fichiers** : `js/admin.js`, `js/cards.js`

```javascript
showNotifCards('Erreur : ' + error.message) // Révèle la structure DB
```
**Correction** : Logger côté serveur, afficher un message générique côté client.

---

## CRITICITÉ MOYENNE

### 11. Validation insuffisante du nom de profil
**Fichier** : `js/profile-create.js`

Aucune validation côté client ou serveur sur la longueur/format du nom.

**Correction** : Limiter à 2-30 caractères, regex alphanumérique + espaces, validation serveur dans le RPC.

---

### 12. XSS via attributs data- non échappés dans les jeux
**Fichiers** : `js/games/timeline.js`, `js/games/nantes-nbh.js`

```javascript
list.innerHTML = items.map(e => `<div data-id="${e.id}">`).join('')
```
Si `e.id` contient des guillemets, cela peut créer des attributs injectés.

**Correction** : Encoder les valeurs d'attributs HTML ou construire les éléments via `createElement`.

---

### 13. localStorage sans validation d'intégrité
**Fichier** : `js/main.js`

```javascript
localStorage.getItem('hoop_rgpd') === '1'
localStorage.getItem('hoop_tuto_done') === '1'
```
Ces valeurs peuvent être manipulées pour sauter le consentement RGPD ou le tutoriel.

**Correction** : Pour le RGPD, persister le consentement côté serveur (colonne dans `users`). Le tutoriel peut rester en localStorage (faible criticité).

---

## CRITICITÉ FAIBLE

### 14. Absence de Content Security Policy (CSP)
**Fichier** : `_headers`

Aucune CSP définie. Un XSS pourrait charger des scripts externes.

**Correction** : Ajouter dans `_headers` :
```
Content-Security-Policy: default-src 'self'; script-src 'self'; connect-src 'self' https://*.supabase.co; img-src 'self' data: https://*.supabase.co; style-src 'self' 'unsafe-inline'; font-src https://fonts.googleapis.com https://fonts.gstatic.com
```

---

### 15. Clé VAPID exposée dans le code source
**Fichier** : `js/push.js`

La clé VAPID publique est en dur dans le code. Elle est publique par nature mais ne devrait pas être commitée.

**Correction** : Passer via variable d'environnement substituée au build (comme `SUPABASE_URL`).

---

### 16. Service Worker cache sans validation de taille/type
**Fichier** : `sw.js`

Le SW met en cache toutes les réponses réseau sans vérifier le content-type ni la taille, ce qui pourrait mener à un cache poisoning.

**Correction** : Vérifier `response.headers.get('content-type')` avant de mettre en cache.

---

### 17. Mode démo visible côté client
**Fichier** : `js/main.js`

Le bouton démo est masqué via CSS uniquement (hostname check côté client). Pas de risque en prod mais démontre une logique de sécurité faible.

---

## RÉSUMÉ PRIORISÉ

| Priorité | Vulnérabilité | Effort |
|----------|---------------|--------|
| P0 | RLS admin côté serveur (missions + cartes) | Moyen |
| P0 | Vérification rejeu missions dans les RPCs | Moyen |
| P0 | XSS innerHTML → textContent/DOMPurify | Faible |
| ~~P0~~ ✅ | ~~XSS innerHTML → textContent/DOMPurify~~ | Faible |
| ~~P0~~ ✅ | ~~CSP + X-Frame-Options + X-Content-Type-Options~~ | Faible |
| P0 🔲 | RLS admin côté serveur (SQL Supabase à appliquer) | Moyen |
| ~~P1~~ ✅ | ~~Date depuis serveur (get_server_date RPC — SQL ci-dessous)~~ | Faible |
| P1 🔲 | Consentement RGPD persisté en DB | Faible |
| P1 🔲 | Rate limiting sur RPCs | Moyen |
| ~~P2~~ ✅ | ~~Validation nom profil (2-30 chars, regex unicode)~~ | Faible |
| P3 | Messages d'erreur génériques | Faible |
| P3 | VAPID key en env var | Faible |

---

*Audit réalisé le 2026-06-19 par Claude Sonnet 4.6*
