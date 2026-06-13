-- =============================================================================
-- TEMPLATE MISSIONS QUOTIDIENNES — Hoop NBH
-- =============================================================================
-- Copie-colle le bloc du type voulu dans Supabase Dashboard > SQL Editor,
-- remplace les valeurs et exécute.
--
-- RÈGLES :
--   • date     = date UTC du jour voulu (YYYY-MM-DD)
--   • active   = true pour que le jeu apparaisse dans l'app
--   • match_id = identifiant unique (même valeur dans pouls ET pronostic du match)
--   • Apostrophe dans le JSON : doubler avec '' (ex: l''équipe, aujourd''hui)
--   • Ne pas laisser de commentaires -- à l'intérieur des blocs JSON
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. POULS DU CLUB
-- Champs : match, date_label, match_id, match_datetime (ISO 8601 UTC)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.games (type, date, active, content) VALUES (
  'pouls',
  '2026-06-15',
  true,
  '{
    "match":          "NBH vs Paris",
    "date_label":     "Dimanche 15 juin",
    "match_id":       "nbh-vs-paris-20260615",
    "match_datetime": "2026-06-15T20:00:00"
  }'::jsonb
);


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. VESTIAIRE
-- Champs : num, name, pos, question (HTML ok), answers[]{text,correct},
--          explication, instagram_url (optionnel)
-- Un seul correct:true parmi les answers.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.games (type, date, active, content) VALUES (
  'vestiaire',
  '2026-06-15',
  true,
  '{
    "num":           "7",
    "name":          "Jean Dupont",
    "pos":           "Meneur",
    "question":      "Combien de points a marqué <strong>Jean Dupont</strong> lors du dernier match ?",
    "answers": [
      {"text": "12 points", "correct": false},
      {"text": "24 points", "correct": true},
      {"text": "8 points",  "correct": false}
    ],
    "explication":   "Jean Dupont a terminé meilleur marqueur avec 24 points et 6 passes !",
    "instagram_url": "https://www.instagram.com/p/xxxxxxxxxxxxx/"
  }'::jsonb
);
-- Supprimer la ligne instagram_url si inutile.


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ANECDOTE
-- Champs : subject, question (HTML ok), answers[]{text,correct}, explication
-- Les réponses sont mélangées automatiquement côté client.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.games (type, date, active, content) VALUES (
  'anecdote',
  '2026-06-15',
  true,
  '{
    "subject":      "Histoire du club",
    "question":     "En quelle année le Nantes Basket Hermine a-t-il été fondé ?",
    "answers": [
      {"text": "1994", "correct": false},
      {"text": "2001", "correct": false},
      {"text": "1987", "correct": true}
    ],
    "explication":  "Le club a été fondé en 1987."
  }'::jsonb
);


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. NANTES / NBH / LES DEUX
-- Champs : context (optionnel), question, answer, explication
-- answer : "nantes" | "nbh" | "les_deux"
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.games (type, date, active, content) VALUES (
  'nantes_nbh',
  '2026-06-15',
  true,
  '{
    "context":      "",
    "question":     "La salle de la Trocardière accueille-t-elle uniquement des matchs de basket ?",
    "answer":       "nantes",
    "explication":  "La Trocardière est une salle polyvalente nantaise !"
  }'::jsonb
);


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. AVANT / APRÈS
-- Champs : title, label_avant, label_apres, image_avant (URL), image_apres (URL),
--          explication
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.games (type, date, active, content) VALUES (
  'avant_apres',
  '2026-06-15',
  true,
  '{
    "title":        "La Trocardière",
    "label_avant":  "Années 90",
    "label_apres":  "Aujourd''hui",
    "image_avant":  "https://...",
    "image_apres":  "https://...",
    "explication":  "La Trocardière a été entièrement rénovée en 2012."
  }'::jsonb
);


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. PRONOSTIC
-- Champs : match, date_label, match_id (= même que pouls), match_datetime
-- Après le match : ajouter score_domicile_final et score_exterieur_final (voir UPDATE ci-dessous)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.games (type, date, active, content) VALUES (
  'pronostic',
  '2026-06-15',
  true,
  '{
    "match":          "NBH vs Paris",
    "date_label":     "Dimanche 15 juin",
    "match_id":       "nbh-vs-paris-20260615",
    "match_datetime": "2026-06-15T20:00:00"
  }'::jsonb
);

-- Après le match, exécuter ceci pour déclencher checkPronoResult() :
-- UPDATE public.games
-- SET content = content || '{"score_domicile_final": 85, "score_exterieur_final": 78}'::jsonb
-- WHERE type = 'pronostic' AND date = '2026-06-15';


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. BOÎTE MYSTÈRE (permanente, pas quotidienne)
-- Champs : sponsor_name, sponsor_logo (URL, optionnel), win_probability (0.0–1.0),
--          win_reward, lose_reward, win_code, lose_code (optionnel)
-- Désactiver l'ancienne avant d'en créer une nouvelle.
-- ─────────────────────────────────────────────────────────────────────────────

-- UPDATE public.games SET active = false WHERE type = 'boite_mystere' AND active = true;

INSERT INTO public.games (type, date, active, content) VALUES (
  'boite_mystere',
  '2026-06-15',
  true,
  '{
    "sponsor_name":    "Décathlon Nantes",
    "sponsor_logo":    "",
    "win_probability": 0.2,
    "win_reward":      "10% de réduction sur tout le rayon basket",
    "lose_reward":     "Pas de chance cette fois... Reviens demain !",
    "win_code":        "HOOPWIN10",
    "lose_code":       ""
  }'::jsonb
);


-- ─────────────────────────────────────────────────────────────────────────────
-- 8. TIMELINE
-- Champs : question, events[]{id (int), text, year}, explication
-- Le serveur trie par year pour le bon ordre. 30 XP si parfait, 15 sinon.
-- ids : entiers uniques (1, 2, 3, 4...).
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.games (type, date, active, content) VALUES (
  'timeline',
  '2026-06-15',
  true,
  '{
    "question": "Remets ces moments NBH dans l''ordre chronologique",
    "events": [
      {"id": 1, "text": "Fondation du club",            "year": 1987},
      {"id": 2, "text": "Première montée en Pro B",     "year": 1999},
      {"id": 3, "text": "Rénovation de la Trocardière", "year": 2012},
      {"id": 4, "text": "Changement de nom en NBH",     "year": 2018}
    ],
    "explication": "Quatre étapes clés de l''histoire du club !"
  }'::jsonb
);


-- ─────────────────────────────────────────────────────────────────────────────
-- 9. PHOTO MYSTÈRE
-- Champs : question, image_url (URL publique), options[] (3 ou 4 choix),
--          answer (doit correspondre EXACTEMENT à une option), explication
-- XP dégressif : 50 (stage 1) / 30 (stage 2) / 15 (stage 3) / 10 (mauvais partout)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.games (type, date, active, content) VALUES (
  'photo_mystere',
  '2026-06-15',
  true,
  '{
    "question":    "Quel joueur NBH se cache derrière cette photo ?",
    "image_url":   "https://...",
    "options":     ["Jean Dupont", "Pierre Martin", "Marc Leblanc", "Karim Diallo"],
    "answer":      "Jean Dupont",
    "explication": "Jean Dupont, notre meneur titulaire depuis 2022 !"
  }'::jsonb
);


-- =============================================================================
-- UTILITAIRES
-- =============================================================================

-- Voir les jeux actifs du jour
-- SELECT type, date, content->>'match' as match, content->>'question' as question
-- FROM public.games
-- WHERE active = true AND (date = CURRENT_DATE OR type = 'boite_mystere')
-- ORDER BY type;

-- Désactiver les jeux d'une date passée (hors boite_mystere)
-- UPDATE public.games SET active = false
-- WHERE date < CURRENT_DATE AND type != 'boite_mystere';

-- Supprimer un jeu inséré par erreur
-- DELETE FROM public.games WHERE id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
