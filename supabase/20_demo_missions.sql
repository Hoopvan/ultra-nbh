-- Missions du jour pour l'org neutre "demo" (voir 19_neutral_demo_org.sql).
-- Contenu générique, sans référence à un club précis — à remplacer par du
-- vrai contenu lors de l'onboarding d'un client. nantes_nbh est désactivée
-- pour cette org (features_enabled), donc pas de mission de ce type ici.
-- À exécuter dans Supabase Dashboard > SQL Editor

-- ── POULS DU CLUB ────────────────────────────────────────────────────────────
INSERT INTO public.games (org_id, type, date, active, content) VALUES (
  '00000000-0000-0000-0000-000000000002',
  'pouls', CURRENT_DATE, true,
  '{
    "match":          "Domicile vs Extérieur",
    "date_label":     "Dimanche prochain",
    "match_id":       "demo-match-001",
    "match_datetime": "2026-07-12T20:00:00"
  }'::jsonb
);

-- ── VESTIAIRE ─────────────────────────────────────────────────────────────────
INSERT INTO public.games (org_id, type, date, active, content) VALUES (
  '00000000-0000-0000-0000-000000000002',
  'vestiaire', CURRENT_DATE, true,
  '{
    "num":          "10",
    "name":         "Alex Martin",
    "pos":          "Ailier",
    "question":     "Combien de points a marqué <strong>Alex Martin</strong> lors du dernier match ?",
    "answers": [
      {"text": "12 points", "correct": false},
      {"text": "24 points", "correct": true},
      {"text": "8 points",  "correct": false}
    ],
    "explication":  "Alex Martin a terminé meilleur marqueur avec 24 points et 6 passes !"
  }'::jsonb
);

-- ── ANECDOTE ──────────────────────────────────────────────────────────────────
INSERT INTO public.games (org_id, type, date, active, content) VALUES (
  '00000000-0000-0000-0000-000000000002',
  'anecdote', CURRENT_DATE, true,
  '{
    "subject":      "Le sais-tu ?",
    "question":     "Combien de joueurs une équipe de basket-ball aligne-t-elle sur le terrain ?",
    "answers": [
      {"text": "4 joueurs", "correct": false},
      {"text": "5 joueurs", "correct": true},
      {"text": "6 joueurs", "correct": false}
    ],
    "explication":  "Une équipe aligne 5 joueurs sur le terrain, avec des remplaçants sur le banc."
  }'::jsonb
);

-- ── AVANT / APRÈS ─────────────────────────────────────────────────────────────
INSERT INTO public.games (org_id, type, date, active, content) VALUES (
  '00000000-0000-0000-0000-000000000002',
  'avant_apres', CURRENT_DATE, true,
  '{
    "title":        "La salle du club",
    "label_avant":  "Avant travaux",
    "label_apres":  "Aujourd''hui",
    "image_avant":  "https://...",
    "image_apres":  "https://...",
    "explication":  "Exemple de comparaison avant/après — à remplacer par de vraies photos du club."
  }'::jsonb
);

-- ── PRONOSTIC (même match_id que le pouls) ────────────────────────────────────
INSERT INTO public.games (org_id, type, date, active, content) VALUES (
  '00000000-0000-0000-0000-000000000002',
  'pronostic', CURRENT_DATE, true,
  '{
    "match":          "Domicile vs Extérieur",
    "date_label":     "Dimanche prochain",
    "match_id":       "demo-match-001",
    "match_datetime": "2026-07-12T20:00:00"
  }'::jsonb
);

-- ── BOÎTE MYSTÈRE (permanente) ─────────────────────────────────────────────────
INSERT INTO public.games (org_id, type, date, active, content) VALUES (
  '00000000-0000-0000-0000-000000000002',
  'boite_mystere', CURRENT_DATE, true,
  '{
    "sponsor_name":    "Sponsor Démo",
    "sponsor_logo":    "",
    "win_probability": 0.2,
    "win_reward":      "10% de réduction chez notre partenaire",
    "lose_reward":     "Pas de chance cette fois... Reviens demain !",
    "win_code":        "DEMOWIN10",
    "lose_code":       ""
  }'::jsonb
);

-- ── TIMELINE ──────────────────────────────────────────────────────────────────
INSERT INTO public.games (org_id, type, date, active, content) VALUES (
  '00000000-0000-0000-0000-000000000002',
  'timeline', CURRENT_DATE, true,
  '{
    "question": "Remets ces moments clés dans l''ordre chronologique",
    "events": [
      {"id": 1, "text": "Fondation du club",                 "year": 1990},
      {"id": 2, "text": "Première montée en division sup.",  "year": 2005},
      {"id": 3, "text": "Rénovation de la salle",             "year": 2015},
      {"id": 4, "text": "Lancement de l''appli fan",          "year": 2026}
    ],
    "explication": "Quatre étapes clés, à personnaliser avec l''histoire réelle du club."
  }'::jsonb
);

-- ── PHOTO MYSTÈRE ─────────────────────────────────────────────────────────────
INSERT INTO public.games (org_id, type, date, active, content) VALUES (
  '00000000-0000-0000-0000-000000000002',
  'photo_mystere', CURRENT_DATE, true,
  '{
    "question":    "Quel joueur se cache derrière cette photo ?",
    "image_url":   "https://...",
    "options":     ["Alex Martin", "Sacha Dubois", "Camille Rey", "Karim Diallo"],
    "answer":      "Alex Martin",
    "explication": "Alex Martin, le joueur mystère de cette semaine."
  }'::jsonb
);
