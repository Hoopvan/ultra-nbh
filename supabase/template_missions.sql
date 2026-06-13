-- =============================================================================
-- TEMPLATE MISSIONS QUOTIDIENNES — Hoop NBH
-- =============================================================================
-- Copie-colle le bloc du type voulu dans Supabase Dashboard > SQL Editor,
-- remplace les valeurs marquées ← et exécute.
--
-- RÈGLES :
--   • date       = date UTC du jour voulu (format YYYY-MM-DD)
--   • active     = true pour que le jeu apparaisse dans l'app
--   • match_id   = identifiant unique du match (ex: "nbh-vs-paris-20260615")
--                  Doit être le MÊME dans pouls et pronostic du même match.
--   • Un seul jeu actif par type et par date (le loader prend le premier trouvé).
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. POULS DU CLUB — vote émotion avant match
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.games (type, date, active, content) VALUES (
  'pouls',
  '2026-06-15',                          -- ← date du jour du match
  true,
  '{
    "match":          "NBH vs Paris",    -- ← "Équipe domicile vs Équipe extérieure"
    "date_label":     "Dimanche 15 juin",-- ← affiché sous le nom du match
    "match_id":       "nbh-vs-paris-20260615", -- ← identifiant unique du match
    "match_datetime": "2026-06-15T20:00:00"    -- ← heure de début UTC (pour le compte à rebours)
  }'::jsonb
);


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. VESTIAIRE — quiz sur un joueur (3 réponses, ordre fixe)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.games (type, date, active, content) VALUES (
  'vestiaire',
  '2026-06-15',                          -- ← date du jour
  true,
  '{
    "num":       "7",                    -- ← numéro de maillot
    "name":      "Jean Dupont",          -- ← nom du joueur
    "pos":       "Meneur",              -- ← poste
    "question":  "Combien de points a marqué <strong>Jean Dupont</strong> lors du dernier match ?",
    "answers": [
      {"text": "12 points", "correct": false},
      {"text": "24 points", "correct": true},  -- ← mettre correct:true sur la bonne réponse
      {"text": "8 points",  "correct": false}
    ],
    "explication": "Jean Dupont a terminé meilleur marqueur avec 24 points et 6 passes décisives !"
  }'::jsonb
);


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ANECDOTE — quiz culture club (réponses mélangées côté client)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.games (type, date, active, content) VALUES (
  'anecdote',
  '2026-06-15',                          -- ← date du jour
  true,
  '{
    "subject":    "Histoire du club",   -- ← thème affiché en haut
    "question":   "En quelle année le Nantes Basket Hermine a-t-il été fondé ?",
    "answers": [
      {"text": "1994", "correct": false},
      {"text": "2001", "correct": false},
      {"text": "1987", "correct": true}  -- ← bonne réponse (ordre mélangé automatiquement)
    ],
    "explication": "Le club a été fondé en 1987 et a connu plusieurs changements de nom avant de devenir Nantes Basket Hermine."
  }'::jsonb
);


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. NANTES / NBH — appartient à Nantes ou au club ?
-- ─────────────────────────────────────────────────────────────────────────────
-- answer : "nantes" | "nbh" | "les_deux"
INSERT INTO public.games (type, date, active, content) VALUES (
  'nantes_nbh',
  '2026-06-15',                          -- ← date du jour
  true,
  '{
    "context":    "La Beaujoire",        -- ← contexte optionnel affiché au-dessus (laisser vide "" si inutile)
    "question":   "La salle de la Trocardière accueille-t-elle uniquement des matchs de basket ?",
    "answer":     "nantes",              -- ← "nantes" | "nbh" | "les_deux"
    "explication": "La Trocardière est une salle polyvalente nantaise qui accueille de nombreux événements sportifs et culturels, pas seulement le basket !"
  }'::jsonb
);


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. AVANT / APRÈS — slider comparaison photo
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.games (type, date, active, content) VALUES (
  'avant_apres',
  '2026-06-15',                          -- ← date du jour
  true,
  '{
    "title":       "La Trocardière",     -- ← titre affiché en haut du slider
    "label_avant": "Années 90",          -- ← légende côté gauche
    "label_apres": "Aujourd'\''hui",     -- ← légende côté droit (échapper l'\''apostrophe avec '\'')
    "image_avant": "https://...",        -- ← URL image "avant" (hébergée, accessible publiquement)
    "image_apres": "https://...",        -- ← URL image "après"
    "explication": "La Trocardière a été entièrement rénovée en 2012 pour accueillir les plus grands événements de la région."
  }'::jsonb
);


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. PRONOSTIC — prédiction de score avant match
-- ─────────────────────────────────────────────────────────────────────────────
-- match_id doit être IDENTIQUE à celui du jeu pouls du même match.
-- Après le match, UPDATE ce jeu pour ajouter le score final (voir bas de fichier).
INSERT INTO public.games (type, date, active, content) VALUES (
  'pronostic',
  '2026-06-15',                          -- ← date du jour du match
  true,
  '{
    "match":          "NBH vs Paris",    -- ← même valeur que dans pouls
    "date_label":     "Dimanche 15 juin",
    "match_id":       "nbh-vs-paris-20260615", -- ← MÊME match_id que pouls
    "match_datetime": "2026-06-15T20:00:00"    -- ← heure de début UTC
  }'::jsonb
);

-- Après le match : ajouter le score final pour déclencher checkPronoResult()
-- UPDATE public.games
-- SET content = content || '{"score_domicile_final": 85, "score_exterieur_final": 78}'::jsonb
-- WHERE type = 'pronostic' AND date = '2026-06-15';  -- ← date du match


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. BOÎTE MYSTÈRE — carte à gratter sponsorisée (permanente, pas quotidienne)
-- ─────────────────────────────────────────────────────────────────────────────
-- La boîte reste active jusqu'à ce que tu la désactives ou la remplaces.
-- Elle s'affiche uniquement quand toutes les autres missions du jour sont faites.
INSERT INTO public.games (type, date, active, content) VALUES (
  'boite_mystere',
  '2026-06-15',                          -- ← date de mise en place (pas d'impact sur la logique)
  true,
  '{
    "sponsor_name":    "Décathlon Nantes",  -- ← nom du sponsor affiché
    "sponsor_logo":    "https://...",        -- ← URL logo sponsor (optionnel, laisser "" si absent)
    "win_probability": 0.2,                  -- ← probabilité de gagner (0.0 à 1.0)
    "win_reward":      "10% de réduction sur tout le rayon basket",
    "lose_reward":     "Pas de chance cette fois... Reviens demain !",
    "win_code":        "HOOPWIN10",          -- ← code affiché aux gagnants
    "lose_code":       ""                    -- ← code de consolation (optionnel)
  }'::jsonb
);

-- Désactiver l'ancienne boîte avant d'en créer une nouvelle :
-- UPDATE public.games SET active = false WHERE type = 'boite_mystere' AND active = true;


-- =============================================================================
-- UTILITAIRES
-- =============================================================================

-- Voir les jeux actifs d'aujourd'hui
-- SELECT type, date, active, content->>'match' as match, content->>'question' as question
-- FROM public.games
-- WHERE active = true AND (date = CURRENT_DATE OR type = 'boite_mystere')
-- ORDER BY type;

-- Désactiver tous les jeux d'une date passée
-- UPDATE public.games SET active = false
-- WHERE date < CURRENT_DATE AND type != 'boite_mystere';

-- Supprimer un jeu inséré par erreur (remplacer l'id)
-- DELETE FROM public.games WHERE id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
