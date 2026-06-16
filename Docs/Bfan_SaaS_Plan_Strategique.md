# Bfan — Plan Stratégique : De l'App Club à la Plateforme SaaS Internationale

> **Objectif :** Transformer Bfan, aujourd'hui application fan développée pour NBH, en une plateforme white-label multi-tenant vendue en licence à des organisations sportives mondiales — clubs, fédérations, franchises — pour développer leurs communautés et diversifier leurs revenus.

---

## Table des matières

1. Vision & Positionnement
2. Architecture actuelle — Forces et limites pour le SaaS
3. Décisions critiques à prendre dès maintenant
4. Architecture cible multi-tenant
5. Sécurité & Conformité
6. Roadmap technique détaillée
7. Modèle SaaS & Pricing
8. Propriété Intellectuelle
9. Features & Roadmap produit
10. Compétences externes nécessaires
11. Estimation des coûts
12. Risques & Points de vigilance

---

## 1. Vision & Positionnement

### Le problème de marché

Les organisations sportives — clubs professionnels, semi-pro, fédérations, ligues — partagent un problème structurel commun : elles n'existent aux yeux de leurs fans que les jours de match. En dehors de quelques newsletters et d'une présence réseaux sociaux générique, aucun lien quotidien ne relie le fan à son club. Les outils disponibles (Socios/Fan Tokens, apps de billetterie, newsletters) sont soit coûteux, soit passifs, soit réservés aux clubs Elite avec des budgets marketing importants.

### L'opportunité

Le marché mondial des clubs sportifs professionnels et semi-professionnels représente plusieurs dizaines de milliers d'organisations. Très peu disposent d'une solution d'engagement fan quotidien et gamifié, personnalisée à leur identité. Bfan, développé sur une stack légère et économique, peut adresser ce marché à un coût d'acquisition et d'opération structurellement inférieur aux solutions existantes.

### La proposition de valeur SaaS

**Pour les clubs :** Une plateforme clé en main, déployée en quelques jours, aux couleurs du club, qui engage les fans 365 jours par an et génère des revenus directs (sponsoring activé, boutique, abonnements premium).

**Pour Bfan :** Un modèle de revenus récurrents (MRR), scalable sans coût marginal de développement significatif par nouveau client, avec une barrière à l'entrée élevée une fois la communauté constituée.

---

## 2. Architecture actuelle — Forces et limites pour le SaaS

### Forces à conserver

**Stack économique et scalable jusqu'à un certain point :**
- Supabase (PostgreSQL + Auth + RLS + Edge Functions) : gratuit jusqu'à 50 000 utilisateurs actifs, puis environ 25 EUR/mois pour le tier Pro — excellent rapport coût/valeur
- Vercel (hosting statique) : gratuit pour les projets individuels, Pro à 20 USD/mois pour les features d'équipe et déploiements illimités
- Pas de serveur applicatif à maintenir : l'architecture "serverless" réduit drastiquement les coûts opérationnels

**Row-Level Security (RLS) Supabase :** Supabase offre nativement un système de règles de sécurité au niveau des lignes de base de données. C'est l'outil central pour l'isolation multi-tenant — il faut concevoir les politiques RLS dès maintenant.

**PWA :** Le choix d'une Progressive Web App évite les frais et contraintes des app stores (Apple 30%, Google 15-30%). Pour une plateforme B2B vendant à des clubs avec budget limité, c'est un avantage décisif.

### Limites actuelles à résoudre pour le SaaS

**Fichier unique (index.html) :** L'approche "tout dans un fichier" est excellente pour démarrer vite mais devient ingérable dès qu'on doit maintenir plusieurs versions/thèmes/configurations. Il faudra migrer vers une architecture modulaire.

**Pas de multi-tenancy :** Toutes les tables (users, games, etc.) sont plates, sans colonne `organization_id`. Ajouter un deuxième club aujourd'hui nécessiterait de déployer une instance entière séparée — ce qui est possible à court terme mais ne scale pas.

**Pas d'interface d'administration :** Le contenu des missions (table `games`) est alimenté manuellement. Pour vendre à des clubs, il faut un back-office où le community manager du club crée et planifie ses missions sans toucher au code.

**Theming hardcodé :** Les couleurs, logos, noms sont dans le code. Pour chaque nouveau client, il faut une recompilation/redéploiement.

**Auth Google uniquement :** Acceptable pour démarrer, mais les clubs voudront proposer email/password, Apple Sign-In, voire SSO avec leur propre système de membres.

---

## 3. Décisions critiques à prendre dès maintenant

Ces choix techniques, faits maintenant sur NBH, détermineront si la migration vers le SaaS coûtera 2 semaines ou 6 mois.

### 3.1 Introduire `organization_id` dans toutes les tables dès la V1

**Ce qu'il faut faire :** Ajouter une colonne `org_id` (UUID) à toutes les tables dès maintenant — `users`, `games`, `pouls_votes`, `pronostic_votes`, `boite_winners`, etc. Pour NBH, cette valeur sera toujours la même (l'UUID de NBH), mais la colonne existera.

**Pourquoi maintenant :** Ajouter cette colonne sur des tables avec des milliers de lignes en production implique des migrations de données, potentiellement des downtime, et la réécriture de toutes les politiques RLS. Faire ça sur une table vide ou presque vide (beta NBH) est trivial. Attendre coûtera cher.

**Impact sur le code actuel :** Quasi nul — toutes les requêtes Supabase incluront simplement `.eq('org_id', CURRENT_ORG_ID)` en filtre. La constante `CURRENT_ORG_ID` sera injectée depuis la config.

### 3.2 Externaliser la configuration dans un fichier/table séparé

**Ce qu'il faut faire :** Créer une table `organizations` et une table `org_config` dans Supabase qui contient l'ensemble des paramètres personnalisables :

```
organizations
  id (UUID)
  slug (text, unique) — ex: "nbh", "psg", "asvel"
  name (text)
  sport (text)
  country (text)
  created_at

org_config
  org_id (FK)
  primary_color (text)
  secondary_color (text)
  logo_url (text)
  app_name (text)
  tagline (text)
  home_city (text)
  default_lang (text)
  features_enabled (jsonb) — ex: {"boite_mystere": true, "pronostic": true}
  custom_domain (text) — ex: "fan.nantesbasket.fr"
```

**Pourquoi :** Ce pattern permet de charger dynamiquement toute la configuration au démarrage de l'app, sans recompiler quoi que ce soit. L'app devient un "shell" qui se personnalise à partir des données.

### 3.3 Migrer vers une architecture modulaire (sans forcément changer de stack)

**Ce qu'il faut faire :** Passer de `index.html` monolithique à une structure de fichiers séparés, même sans framework. Une approche pragmatique :

```
/src
  /screens      — chaque écran en fichier JS séparé
  /components   — fonctions réutilisables (avatar, missions, etc.)
  /lib
    supabase.js — client Supabase centralisé
    config.js   — chargement de org_config au démarrage
    auth.js     — gestion authentification
    gamification.js
  /styles
    base.css
    theme.css   — variables CSS injectées depuis org_config
  index.html    — shell minimal
```

**Le build step :** Introduire un bundler léger (esbuild ou Vite) pour assembler ces fichiers en un `index.html` déployable. Cela reste très simple à configurer (quelques lignes) mais débloque toute la maintenabilité.

**Effort estimé :** 2-3 semaines de refactoring, sans changer aucune fonctionnalité.

### 3.4 Adopter les variables CSS pour le theming

**Ce qu'il faut faire :** Remplacer toutes les couleurs hardcodées par des variables CSS :

```css
:root {
  --color-primary: #1B3588;
  --color-accent:  #E85420;
  --color-bg:      #F0E6C8;
}
```

Ces variables sont injectées dynamiquement au chargement depuis `org_config`, après un simple fetch Supabase. Résultat : le même build sert tous les clubs, chacun avec ses couleurs.

### 3.5 Préparer le manifest PWA dynamique

Le fichier `manifest.json` contient le nom de l'app, les icônes, les couleurs — tout ce qui doit être personnalisé par club. Pour le multi-tenant :

- Soit : un manifest par déploiement (acceptable si chaque club = un sous-domaine avec son propre déploiement Vercel)
- Soit : un service worker qui retourne un manifest généré dynamiquement (plus complexe, meilleur pour le scale)

**Recommandation court terme :** Un déploiement Vercel par club (fork du repo, variables d'environnement distinctes). Simple, isolé, et gratuit jusqu'à des dizaines de clients sur le tier Vercel Hobby/Pro.

---

## 4. Architecture cible multi-tenant

### Option A — Multi-tenant par sous-domaine (recommandée à court/moyen terme)

Chaque club a son propre déploiement Vercel avec ses variables d'environnement :
- `club.bfan.app` ou domaine personnalisé `fan.monclub.fr`
- Même codebase, configs différentes
- Isolation parfaite des données via RLS Supabase
- Déploiement en 30 minutes par nouveau client

**Avantages :** Simplicité maximale, isolation totale, rollback par client possible, SLA indépendant.
**Limites :** Pas de super-admin panel unifié, mise à jour de chaque instance à gérer.

### Option B — Single-tenant monolithique avec routing par slug

Une seule instance, `bfan.app/nbh/`, `bfan.app/asvel/`, etc. La config est chargée depuis l'URL.

**Avantages :** Un seul déploiement à maintenir.
**Limites :** Un bug impacte tous les clubs simultanément, isolation de données plus complexe à garantir, RLS plus difficile à auditer.

### Option C — Architecture microservices (moyen/long terme)

À partir de 50+ clubs actifs, envisager :
- API Gateway centralisée
- Service d'authentification unifié (Auth0 ou Supabase Auth multi-tenant)
- Bases de données séparées par tier client (Enterprise = DB dédiée)
- CDN pour les assets (images clubs, avatars)

**Schema de base de données cible :**

```
organizations (id, slug, name, sport, country, tier, created_at)
org_config    (org_id, primary_color, ..., features_enabled jsonb)
org_sponsors  (id, org_id, name, logo_url, active)

users         (id, org_id, display_name, xp, coins, streak, avatar_config jsonb, ...)
games         (id, org_id, type, date, content jsonb, active)
missions_log  (id, org_id, user_id, game_id, completed_at, xp_earned)
pouls_votes   (id, org_id, game_id, user_id, vote)
pronostic_votes (id, org_id, game_id, user_id, home, away, correct)

unlockables   (id, org_id, type, name, cost, asset_url)
user_items    (id, org_id, user_id, item_id, owned, worn)

transactions  (id, org_id, user_id, type, amount_eur, stripe_payment_id, created_at)
subscriptions (id, org_id, user_id, plan, status, stripe_sub_id, expires_at)
```

---

## 5. Sécurité & Conformité

### 5.1 Isolation des données (critique)

La règle fondamentale du SaaS multi-tenant : un utilisateur de NBH ne doit **jamais** pouvoir lire, même accidentellement, des données d'un autre club.

**Politique RLS Supabase (à déployer sur chaque table) :**
```sql
-- Exemple sur la table users
CREATE POLICY "tenant_isolation"
ON users
USING (org_id = current_setting('app.current_org_id')::uuid);
```

La variable `app.current_org_id` est définie pour chaque session via une Edge Function d'auth qui vérifie le JWT de l'utilisateur et injecte le bon `org_id`. C'est le mécanisme standard Supabase pour la multi-tenancy.

**Audit RLS :** Chaque nouvelle table doit être soumise à un test d'isolation avant mise en production. Créer un script de test automatisé qui tente des accès cross-tenant et vérifie que Supabase les rejette.

### 5.2 Modèle de rôles (RBAC)

Trois niveaux de rôles à mettre en place :

| Rôle | Accès | Cas d'usage |
|------|-------|-------------|
| `super_admin` | Toutes les orgs | Équipe Bfan — accès à tout, monitoring |
| `org_admin` | Son org uniquement | Community manager du club — crée les missions, voit les stats |
| `org_moderator` | Son org — lecture + modération | Bénévoles du club |
| `fan` | Son profil + contenu public de son org | Utilisateur final |

Ces rôles doivent être stockés dans la table `users` avec une colonne `role` et appliqués via RLS.

### 5.3 Authentification & tokens

**Court terme (NBH) :** Google OAuth uniquement — acceptable.

**Moyen terme (SaaS) :** Ajouter :
- Email/password avec vérification d'email
- Apple Sign-In (obligatoire pour distribuer via App Store si on crée une app native)
- Magic link (lien par email, sans mot de passe) — très bon taux de conversion
- Optionnel : SSO SAML pour les grandes organisations (fédérations, ligues)

**Gestion des JWTs :** Les tokens Supabase ont une durée de vie courte (1h). Implémenter le refresh token automatique. Ne jamais stocker de token sensible dans localStorage — utiliser `httpOnly` cookies si possible.

### 5.4 RGPD & Conformité internationale

**Pour l'Europe (dès maintenant) :**
- Bannière de consentement cookies (obligatoire)
- Politique de confidentialité explicite sur les données collectées (email, Google ID, historique de missions, achats)
- Droit à l'oubli : implémenter une route `DELETE /api/account` qui supprime toutes les données de l'utilisateur et révoque ses tokens
- Droit d'accès : export des données de l'utilisateur au format JSON/CSV
- DPA (Data Processing Agreement) à signer avec chaque club client — le club est responsable de traitement, Bfan est sous-traitant
- Localisation des données : Supabase EU region (Frankfurt) pour les clients européens

**Pour le marché US (CCPA) :**
- "Do not sell my personal information" option
- Politique de confidentialité conforme CCPA

**Pour d'autres marchés :**
- Brésil (LGPD), UK (UK GDPR post-Brexit), Canada (PIPEDA) ont des exigences similaires au RGPD
- Australie (Privacy Act) : moins contraignant mais à considérer
- Moyen-Orient : aucune législation unifiée, vérifier pays par pays

**Consultation juridique spécialisée obligatoire** avant de signer le premier contrat hors France.

### 5.5 Sécurité des paiements

**PCI DSS :** Ne jamais stocker de numéros de carte en base. Utiliser exclusivement Stripe (ou équivalent) qui est certifié PCI DSS de niveau 1. Bfan n'est alors en scope que pour le SAQ A (niveau minimal), qui ne nécessite aucune certification formelle.

**Stripe Connect :** Pour le modèle où Bfan collecte les paiements et reverse une part aux clubs, Stripe Connect est la solution standard. Elle gère la répartition automatique des revenus entre la plateforme (Bfan) et les marchands (clubs).

**Webhooks sécurisés :** Tous les webhooks Stripe doivent être validés avec la signature HMAC fournie par Stripe avant traitement. Ne jamais traiter un webhook non signé.

### 5.6 Sécurité applicative (OWASP Top 10)

Points critiques pour une app SaaS :
- **Injection SQL :** Supabase utilise des requêtes paramétrées nativement — risque quasi nul si on n'utilise pas de SQL brut
- **XSS :** Tout contenu utilisateur (noms, pseudo) doit être échappé avant affichage — auditer les `innerHTML` dans le code actuel
- **CSRF :** Les tokens Supabase gèrent cela nativement pour les appels API
- **Rate limiting :** Ajouter des limites sur les endpoints sensibles (login, vote, claim reward) via Supabase Edge Functions ou un middleware Vercel
- **Secrets management :** Les clés Supabase (anon key = publique, service role key = privée) ne doivent jamais se retrouver dans le code client. La service role key ne doit exister que dans les Edge Functions côté serveur

---

## 6. Roadmap Technique Détaillée

### Phase 0 — NBH Beta (Juil–Aout 2026) — EN COURS

**Objectif :** Valider le produit avec 50 fans réels. Ne pas sur-ingéniérer.

**Ce qu'il faut quand même faire dès cette phase pour préparer le SaaS :**
- Ajouter `org_id` à toutes les tables (valeur unique = NBH, effort minimal)
- Créer la table `organizations` et `org_config` avec la config NBH
- Externaliser les couleurs/logo en variables CSS (une journée de travail)
- Documenter chaque fonctionnalité dans un fichier FEATURES.md (capital pour les futurs clients)

**Ne pas faire encore :** Refactoring architectural complet, admin dashboard, multi-auth.

### Phase 1 — Fondations SaaS (Sept–Déc 2026)

**Objectif :** Lancement NBH officiel + poser les bases techniques du SaaS.

**Travaux techniques :**
- Refactoring de `index.html` vers architecture modulaire (esbuild/Vite)
- Mise en place du theming dynamique via CSS variables + `org_config`
- Premier back-office admin minimal : création/planification des missions via une interface (peut être un simple form Supabase Studio au début, puis une interface dédiée)
- Ajout email/password auth en plus de Google
- Implémentation RLS complète avec tests d'isolation
- Mise en place Stripe pour les premiers paiements (abonnement fan premium)
- RGPD basique : bannière cookies, politique vie privée, suppression de compte

**Infrastructure :**
- Domaine custom `bfan.app` + sous-domaines clients
- Monitoring : Sentry (erreurs JS), Vercel Analytics (traffic), Supabase Dashboard (DB)
- CI/CD basique : GitHub Actions pour déployer automatiquement sur Vercel à chaque push sur `main`

### Phase 2 — Premier Club Externe (Jan–Juin 2027)

**Objectif :** Signer et déployer 2 à 5 clubs pilotes hors NBH (idéalement Pro B ou Nationale 1 basket, ou d'autres sports).

**Travaux techniques :**
- Dashboard admin club complet (React ou Vue pour cette interface admin uniquement)
- Système de déploiement automatisé : un script qui crée un nouveau déploiement Vercel + config Supabase pour un nouveau client en moins d'une heure
- Gestion multi-langue (i18n) : au minimum FR/EN
- Push notifications (WebPush API) : les clubs voudront notifier leurs fans
- Système de contenu riche : les missions doivent pouvoir intégrer images, vidéos, liens
- Analytics par club : tableau de bord avec MAU, engagement, revenus générés
- Contrats SaaS et onboarding documenté

**Compétences à recruter ou externaliser :** Designer UI/UX pour le dashboard admin, potentiellement un deuxième développeur.

### Phase 3 — Scale International (2028+)

**Objectif :** 50+ clients actifs, expansion Europe puis international.

**Travaux techniques :**
- Architecture microservices si le monolithe Supabase atteint ses limites
- Bases de données régionales (EU, US, APAC) pour la latence et la conformité légale
- API publique documentée (REST + webhooks) pour les intégrations tierces (billetterie, CRM club)
- App native (React Native ou Capacitor.js wrapping la PWA) pour App Store/Play Store
- Marketplace de missions : les clubs peuvent partager/acheter des templates de missions
- Intelligence artificielle : génération assistée de missions via LLM (ex: "Crée une mission anecdote sur notre match de 1998")
- Support multi-sport natif (template basket, football, rugby, handball...)

---

## 7. Modèle SaaS & Pricing

### Structure de revenus

**1. Licence plateforme (MRR — Monthly Recurring Revenue)**

| Tier | Prix | Pour qui | Inclus |
|------|------|----------|--------|
| Starter | 99 EUR/mois | Clubs amateurs, associations | 500 fans max, 3 types de missions, analytics basique |
| Pro | 299 EUR/mois | Clubs semi-pro (Nat. 1, Pro B) | 5 000 fans max, tous types de missions, analytics avancé, support prioritaire |
| Elite | 699 EUR/mois | Clubs pro (Pro A, Ligue 1...) | Fans illimités, API, white-label total, SLA garanti, account manager |
| Enterprise | Sur devis | Fédérations, ligues | Multi-équipes, SSO, DB dédiée, contrat personnalisé |

**2. Commission sur revenus générés (optionnel)**
En complément ou à la place de la licence : 10-15% sur les revenus de sponsoring activé, boutique, et abonnements premium générés via la plateforme. Modèle attractif pour les clubs car il réduit le risque — ils ne payent que si ça rapporte.

**3. Services additionnels (one-shot)**
- Onboarding & setup : 500-1 500 EUR selon complexité
- Formation équipe club : 500 EUR/session
- Création de contenu missions (service agence) : sur devis

### Modèle de Go-To-Market

**Court terme :** Bouche-à-oreille dans le réseau basket Pro B. NBH est la référence. Approche directe des clubs de la conférence.

**Moyen terme :** Partenariats avec les ligues et fédérations (LNB pour le basket, FFF pour le foot, FFR pour le rugby) qui recommandent Bfan à leurs membres. Un contrat avec une fédération peut représenter 50-200 clubs d'un coup.

**Long terme :** Présence sur les salons sport business (Sport Pro Media, SPORTEL, etc.), content marketing (cas clients, études de ROI), et programme revendeurs dans chaque pays cible.

---

## 8. Propriété Intellectuelle

### 8.1 Code source

**Priorité absolue :** Le code de Bfan doit appartenir à l'entité juridique qui porte le produit, pas à une personne physique. Sans structure juridique formelle (SAS, SASU ou équivalent), le code est potentiellement la propriété de son auteur personne physique, ce qui crée des risques en cas d'association future ou de levée de fonds.

**Actions à prendre :**
- Créer une structure juridique (SASU recommandée pour un fondateur solo — création en ligne via Legalstart ou Indy pour 300-500 EUR)
- Céder le code à la société via un acte de cession d'actifs incorporels (un avocat spécialisé IP peut le faire pour 500-1 000 EUR)
- Définir dans les CGU que tout contenu généré par les utilisateurs via la plateforme donne à Bfan une licence d'utilisation

### 8.2 Marque "Bfan"

- Déposer la marque "Bfan" à l'INPI (France) : environ 250 EUR pour une classe, 190 EUR par classe supplémentaire
- Classes pertinentes : Classe 38 (télécommunications/services en ligne), Classe 41 (divertissement, éducation), Classe 42 (services SaaS)
- Pour l'international : dépôt via l'OMPI (Organisation Mondiale de la Propriété Intellectuelle) — marque internationale (~3 000 EUR pour 5 pays) ou dépôt UE via l'EUIPO (~1 000 EUR pour toute l'UE)
- Vérifier préalablement qu'aucune marque "Bfan" n'existe déjà dans ces classes (recherche d'antériorité sur bases INPI + EUIPO)

### 8.3 Contrats clients

Le contrat de licence SaaS doit stipuler clairement :
- **Ce que le club possède :** ses données fans, son contenu (missions créées), son identité visuelle déposée sur la plateforme
- **Ce que Bfan possède :** la plateforme technique, les algorithmes, les features, les améliorations
- **Ce que personne ne possède seul :** les données agrégées anonymisées (Bfan peut les utiliser pour améliorer le produit mais ne peut pas les revendre identifiées)
- **Clause de réversibilité :** le club peut exporter ses données dans un format standard (JSON/CSV) à tout moment — obligatoire en Europe (portabilité des données RGPD)
- **Limitation de responsabilité :** Bfan n'est pas responsable des revenus promis mais non réalisés, des erreurs de contenu créées par le club, etc.

### 8.4 Open Source vs Propriétaire

La question se posera : faut-il open-sourcer tout ou partie du code ? Arguments :
- **Pour l'open source :** Crédibilité technique, contributions externes, confiance des grandes organisations (fédérations, ligues)
- **Contre :** Un concurrent peut copier la plateforme exactement. La valeur d'un SaaS réside dans le produit packagé et le support, pas le code — mais exposer le code facilite les forks.

**Recommandation :** Garder le core propriétaire. Éventuellement open-sourcer des librairies génériques (ex: le moteur de missions), comme le font Supabase, Linear, etc.

---

## 9. Features & Roadmap Produit

### Features existantes (V1 NBH)

- Authentification Google
- Profil utilisateur & avatar personnalisable (silhouette, teinte de peau, coiffure)
- 7 types de missions quotidiennes : Pouls, Vestiaire (quiz joueur), Anecdote, Nantes/NBH (quiz local), Avant-Après, Pronostic, Boite Mystère (scratch)
- Système XP, niveaux, coins
- Boutique d'items cosmétiques (écharpe, casquette, maillot)
- Mode démo (bypass auth pour tests)
- PWA installable (manifest + service worker)

### Features SaaS essentielles (à développer pour Phase 2)

**Back-office club (admin dashboard) :**
- Création et planification des missions avec éditeur visuel
- Bibliothèque de templates de missions (quiz générique, anecdote vide à remplir...)
- Gestion des sponsors et de leurs activations (logos, missions de marque)
- Analytics temps réel : DAU/MAU, missions complétées, XP distribué, revenus
- Gestion des fans (liste, niveaux, possibilité de bannir/suspendre)
- Notifications push : rédiger et envoyer des notifications manuelles ou automatisées

**Customisation club :**
- Upload logo, icônes, images d'ambiance
- Couleurs primaire/secondaire
- Nom de l'app, tagline
- Domaine personnalisé (fan.monclub.fr)
- Choix des types de missions activés (pas tous les clubs ont besoin de tous les formats)

**Features fans améliorées :**
- Feed social léger : voir les performances des autres fans (classement, streaks)
- Partage de ses missions accomplies sur réseaux sociaux
- Missions collaboratives : tout le Kop atteint un objectif collectif ensemble
- Intégration billetterie : mission "Achète ton billet pour le prochain match" avec code promo
- Rewards physiques : "Gagne un maillot dédicacé" (tirage au sort parmi les fans niveau 10+)

**Monétisation avancée :**
- Abonnement fan premium (Stripe Subscriptions)
- Boutique de produits physiques du club (intégration Shopify ou WooCommerce)
- Vente de NFTs collectibles (optionnel, marché volatile)
- Enchères de lots (ex: rencontrer un joueur)

### Features différenciantes à moyen terme

**Mission builder no-code :** Un éditeur drag-and-drop pour créer n'importe quel type de mission sans développement. Les clubs peuvent créer des missions inédites (sondage, concours photo, défi créatif) sans que Bfan ait à développer quoi que ce soit.

**Analytics prédictifs :** Algorithme de recommandation qui suggère aux clubs les types de missions avec le meilleur taux d'engagement selon leur audience. Identification automatique des fans à risque de churner.

**API publique :** Les clubs pourront connecter Bfan à leur CRM, leur app de billetterie, ou leur outil d'emailing via une API REST documentée et des webhooks. Exemple : quand un fan atteint le niveau 5, déclencher automatiquement l'envoi d'un email depuis Mailchimp avec une offre spéciale.

**Marketplace de missions :** Les créateurs de contenu (journalistes, ex-joueurs, community managers) peuvent créer et vendre des packs de missions aux clubs. Bfan prend une commission.

**Module broadcast :** Le club peut émettre des notifications push ultra-ciblées (ex: "Fans niveau 3+ de Nantes : promo exclusive sur les places de demain").

---

## 10. Compétences Externes Nécessaires

### Dès maintenant (Phase 0/1)

**Avocat IP/SaaS (prioritaire)**
- Pour : dépôt de marque, cession de code à la structure juridique, CGU/CGV, contrat de licence SaaS type
- Coût : 1 500–3 000 EUR pour le package complet initial
- Profil : cabinet spécialisé en droit du numérique et propriété intellectuelle (pas un généraliste)

**Expert-comptable / création de société**
- Pour : création de la structure juridique (SASU), comptabilité initiale
- Coût : 500–1 000 EUR création + 100-200 EUR/mois comptabilité
- Option économique : Legalstart pour la création + Indy pour la comptabilité (150 EUR/mois total)

### Phase 1 (lancement NBH)

**Designer UI/UX (freelance)**
- Pour : concevoir le dashboard admin club (interface complexe qui doit être ergonomique)
- Profil : expérience SaaS B2B, maîtrise Figma
- Coût : 3 000–8 000 EUR pour la conception complète du back-office
- Option : Malt, Comet, ou réseau personnel

**Expert Stripe / paiements (mission courte)**
- Pour : intégration Stripe Connect, webhooks, gestion des abonnements
- Profil : développeur avec références de projets marketplace
- Coût : 2 000–5 000 EUR selon périmètre
- Alternative : formations Stripe sont excellentes et gratuites, intégration DIY possible

### Phase 2 (premier club externe)

**Développeur Backend / DevOps (temps partiel ou freelance)**
- Pour : architecture multi-tenant, CI/CD, monitoring, Edge Functions complexes
- Profil : Node.js, PostgreSQL, Supabase ou AWS, expérience SaaS
- Coût : 400–600 EUR/jour en freelance, ou recrutement CTO/Lead Dev (40–60k EUR/an selon niveau)

**Commercial / Business Developer (dès les premiers contacts clubs)**
- Pour : démarcher les clubs, négocier les contrats, gérer le pipeline
- Profil : réseau dans le sport professionnel français, à l'aise avec le cycle de vente B2B
- Coût : commission 10-15% sur les contrats signés (pas de salaire fixe au début) ou profil associé

### Phase 3 (scale international)

**Directeur Produit (Product Manager)**
- Pour : piloter la roadmap, interviewer les clients, prioriser les features
- Coût : 50–70k EUR/an
- Profil : expérience SaaS B2B, idéalement dans le sport ou les médias

**Équipe Customer Success**
- Pour : onboarding des clubs, support, retention
- Ratio : 1 CSM pour 20-30 clubs Pro/Elite
- Coût : 35–45k EUR/an par CSM

**Juriste international (local ou cabinet)**
- Pour : adapter les contrats et politiques de confidentialité par marché (US, UK, Espagne, Allemagne...)
- Coût : 2 000–5 000 EUR par nouveau marché

**Traducteurs natifs**
- Pour : l'app, les templates de missions, la documentation
- Langues prioritaires : anglais (déjà maîtrisé ?), espagnol, allemand, portugais (Brésil)
- Coût : 0,10–0,15 EUR/mot pour traduction pro, soit 2 000–5 000 EUR par langue pour une app complète

---

## 11. Estimation des Coûts

### Phase 0 — Beta NBH (Juil–Aout 2026)

| Poste | Coût mensuel | Coût phase |
|-------|-------------|-----------|
| Infrastructure (Supabase free + Vercel free) | 0 EUR | 0 EUR |
| Domaine + certificats SSL | 15 EUR/an | 3 EUR |
| Temps développement (seul) | — | — |
| **Total cash** | **0 EUR** | **~3 EUR** |

### Phase 1 — Lancement + Fondations SaaS (Sept–Déc 2026)

| Poste | Coût total |
|-------|-----------|
| Création SASU + comptabilité (4 mois) | 1 500 EUR |
| Avocat IP (marque + CGU + contrat type) | 2 500 EUR |
| Designer UI/UX (dashboard admin) | 5 000 EUR |
| Infrastructure (Supabase Pro + Vercel Pro) | 200 EUR |
| Expert Stripe (mission) | 2 000 EUR |
| Dépôt marque INPI (3 classes) | 630 EUR |
| **Total estimé** | **~11 800 EUR** |

### Phase 2 — Premiers clients externes (Jan–Juin 2027)

| Poste | Coût total |
|-------|-----------|
| Dev freelance backend/DevOps (3 mois mi-temps) | 15 000 EUR |
| Marketing & contenu (cas clients, site web) | 3 000 EUR |
| Déplacements (salons, visites clubs) | 2 000 EUR |
| Infrastructure multi-clients | 500 EUR |
| Marque UE (EUIPO) | 1 000 EUR |
| **Total estimé** | **~21 500 EUR** |

**Revenus attendus phase 2 (objectif 5 clients Pro) :** 5 × 299 EUR × 6 mois = **8 970 EUR**. Le produit n'est pas encore rentable mais le MRR construit la base.

### Phase 3 — Scale (2028+) — Estimations annuelles

| Poste | Coût annuel |
|-------|-----------|
| Équipe (1 dev + 1 CSM) | 90 000 EUR |
| Infrastructure (50 clubs, Supabase Team) | 5 000 EUR |
| Marketing & commercial | 20 000 EUR |
| Juridique international | 10 000 EUR |
| Divers (outils SaaS, comptabilité...) | 8 000 EUR |
| **Total charges annuelles** | **~133 000 EUR** |

**Seuil de rentabilité Phase 3 :** 133 000 / (299 × 12) = ~37 clubs Pro actifs. Avec un mix Starter/Pro/Elite, le seuil est atteint vers 50-60 clubs actifs.

---

## 12. Risques & Points de Vigilance

### Risque technique — Dette architecturale

**Risque :** Si le refactoring vers l'architecture modulaire est repoussé, le code devient impossible à maintenir pour plusieurs clients simultanément. Chaque bug doit être corrigé manuellement dans chaque déploiement.

**Mitigation :** Planifier 3 semaines de refactoring juste après la beta NBH, avant d'accueillir le premier client externe. Ne pas court-circuiter cette étape.

### Risque business — Dépendance à un seul sport/marché

**Risque :** Le basket Pro B est un marché de niche (16 clubs). Si Bfan reste cantonné à ce sport, le potentiel est limité.

**Mitigation :** Dès la Phase 2, approcher des clubs de football amateur/semi-pro (milliers de clubs en France) et d'autres sports (handball, volleyball, rugby). Le modèle de missions est sport-agnostique.

### Risque juridique — RGPD mal implémenté

**Risque :** Une plainte RGPD peut entraîner des amendes allant jusqu'à 4% du chiffre d'affaires annuel mondial ou 20 M EUR. Avec des données de mineurs (fans <18 ans), les exigences sont encore plus strictes.

**Mitigation :** Consulter un juriste RGPD avant le lancement officiel. Implémenter le consentement explicite, le droit à l'oubli, et la portabilité des données dès la V1.

### Risque concurrentiel — Réaction des acteurs établis

**Risque :** Socios, Fan Tokens, ou un éditeur de logiciels sportifs (Twic, Stats Perform, etc.) pourrait lancer une solution similaire avec des moyens bien supérieurs.

**Mitigation :** Le time-to-market et la simplicité de Bfan sont des avantages. Une app gamifiée déployée en 30 minutes pour un club de Pro B est un positionnement que les acteurs premium ne prendront pas. Se concentrer sur le segment mid-market (clubs sans budget IT) où les grands acteurs ne veulent pas aller.

### Risque opérationnel — Scalabilité du support

**Risque :** Avec 30 clubs actifs, les demandes de support (bugs, questions, demandes de features) peuvent dépasser la capacité d'une ou deux personnes.

**Mitigation :** Investir tôt dans la documentation (base de connaissance, tutoriels vidéo). Implémenter un système de ticketing (Crisp, Intercom). Former les clubs à l'autonomie via des webinaires mensuels.

### Risque produit — Features demandées par les clubs vs cohérence du produit

**Risque :** Chaque client demandera des features spécifiques à son sport/contexte. Le risque est de construire une app sur-mesure pour chaque client au lieu d'une plateforme générique.

**Mitigation :** Mettre en place un processus de collecte et priorisation des demandes (Product Board, Canny). Une feature n'entre en roadmap que si au moins 3 clubs la demandent. Les features ultra-spécifiques sont proposées en développement custom facturé.

---

## Synthèse — Les 10 priorités immédiates

1. **Ajouter `org_id` à toutes les tables Supabase** — 1 jour de travail, impact SaaS massif
2. **Créer la table `org_config` avec la config NBH** — 1 jour, permet le theming dynamique
3. **Implémenter les variables CSS pour les couleurs** — 1 jour, débloque le white-label
4. **Créer la structure juridique (SASU)** — 1 semaine administrative
5. **Mandater un avocat pour les CGU et le contrat SaaS type** — avant tout premier client externe
6. **Déposer la marque "Bfan" à l'INPI** — avant toute communication publique
7. **Planifier le refactoring architectural pour après la beta** — bloquer 3 semaines dans le planning
8. **Documenter chaque feature existante** — capital pour les futurs contrats et la formation des clubs
9. **Définir le modèle de pricing** — avant les premières conversations commerciales
10. **Identifier 3 clubs cibles pour la Phase 2** — commencer les conversations maintenant, même informellement

---

*Document rédigé en juin 2026. À réviser tous les 6 mois au fur et à mesure de l'évolution du produit et du marché.*
