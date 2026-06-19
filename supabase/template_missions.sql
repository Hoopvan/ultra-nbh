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

-- ───── Propositions "Sel ou Poivre" — Nantes ou NBH ? ──────────────────────────
-- Principe (Burger Quiz, vrai esprit) : un duo fixe ("Nantes ou NBH ?"), puis une
-- rafale de questions COURTES, à la fois sérieuses et absurdes, où la réponse
-- doit pouvoir surprendre — y compris en étant évidente une fois sur deux, comme
-- dans l'émission (cf. "Qui remue la queue ? Un pitbull"). Pas de cours d'histoire
-- dans la question : une amorce punchy, et l'explication fait le sel (et le poivre).
-- Faits réels marqués [VÉRIFIÉ]. Le reste est de l''humour assumé, pas une donnée
-- à vérifier — comme "Macron ou macaron, qui est sucré ?" dans l''original.

INSERT INTO public.games (type, date, active, content) VALUES (
  'nantes_nbh', '2026-06-20', false,
  '{
    "context":     "Nantes ou NBH ?",
    "question":    "Qui a l''hermine comme symbole ?",
    "answer":      "nbh",
    "explication": "Le club porte le nom \"Hermine\" depuis 1907. La ville n''a pas de surnom animalier officiel ! [VÉRIFIÉ]"
  }'::jsonb
);

INSERT INTO public.games (type, date, active, content) VALUES (
  'nantes_nbh', '2026-06-21', false,
  '{
    "context":     "Nantes ou NBH ?",
    "question":    "Qui a la personnalité la plus connue dans ses rangs ?",
    "answer":      "nantes",
    "explication": "Jules Verne, natif de la ville en 1828, dépasse large en notoriété ! [VÉRIFIÉ]"
  }'::jsonb
);

INSERT INTO public.games (type, date, active, content) VALUES (
  'nantes_nbh', '2026-06-22', false,
  '{
    "context":     "Nantes ou NBH ?",
    "question":    "Qui peut faire trembler les gradins un soir de match ?",
    "answer":      "nbh",
    "explication": "4 300 supporters qui hurlent à la Trocardière, ça secoue ! 🔥"
  }'::jsonb
);

INSERT INTO public.games (type, date, active, content) VALUES (
  'nantes_nbh', '2026-06-23', false,
  '{
    "context":     "Nantes ou NBH ?",
    "question":    "Qui a un château fort ?",
    "answer":      "nantes",
    "explication": "Le Château des ducs de Bretagne, oui. La Trocardière, malgré le bruit qu''on y fait, reste une salle de sport ! [VÉRIFIÉ]"
  }'::jsonb
);

INSERT INTO public.games (type, date, active, content) VALUES (
  'nantes_nbh', '2026-06-24', false,
  '{
    "context":     "Nantes ou NBH ?",
    "question":    "Qui peut techniquement dribbler ?",
    "answer":      "nbh",
    "explication": "Les joueurs, oui. La ville, on ne lui a jamais vu un crossover. 🏀"
  }'::jsonb
);

INSERT INTO public.games (type, date, active, content) VALUES (
  'nantes_nbh', '2026-06-25', false,
  '{
    "context":     "Nantes ou NBH ?",
    "question":    "Qui sort plutôt le vendredi soir ?",
    "answer":      "les_deux",
    "explication": "Une victoire à fêter, une terrasse en centre-ville... les deux savent faire la fête ! 🎉"
  }'::jsonb
);

INSERT INTO public.games (type, date, active, content) VALUES (
  'nantes_nbh', '2026-06-26', false,
  '{
    "context":     "Nantes ou NBH ?",
    "question":    "Qui a déjà fait pleurer ses fans (de joie ou de rage) ?",
    "answer":      "les_deux",
    "explication": "Un dernier panier raté, une finale perdue... les émotions fortes, ça connaît des deux côtés ! 😭"
  }'::jsonb
);

INSERT INTO public.games (type, date, active, content) VALUES (
  'nantes_nbh', '2026-06-27', false,
  '{
    "context":     "Nantes ou NBH ?",
    "question":    "Qui existe depuis plus longtemps que la tour Eiffel ?",
    "answer":      "nantes",
    "explication": "La tour Eiffel date de 1889, NBH de 1891 (deux ans plus jeune !), Nantes remonte à l''Antiquité. [VÉRIFIÉ]"
  }'::jsonb
);

INSERT INTO public.games (type, date, active, content) VALUES (
  'nantes_nbh', '2026-06-28', false,
  '{
    "context":     "Nantes ou NBH ?",
    "question":    "Qui a un éléphant géant qui se balade tranquillement ?",
    "answer":      "nantes",
    "explication": "Le Grand Éléphant des Machines de l''île, en service depuis 2007. NBH n''a toujours pas de mascotte pachyderme ! [VÉRIFIÉ]"
  }'::jsonb
);

INSERT INTO public.games (type, date, active, content) VALUES (
  'nantes_nbh', '2026-06-29', false,
  '{
    "context":     "Nantes ou NBH ?",
    "question":    "Qui peut prétendre jouer à domicile... hors de Nantes ?",
    "answer":      "nbh",
    "explication": "La Trocardière est à Rezé, pas dans Nantes intra-muros. Paradoxal mais vrai ! [VÉRIFIÉ]"
  }'::jsonb
);

INSERT INTO public.games (type, date, active, content) VALUES (
  'nantes_nbh', '2026-06-30', false,
  '{
    "context":     "Nantes ou NBH ?",
    "question":    "Qui a déjà grimpé trois divisions en quatorze ans ?",
    "answer":      "nbh",
    "explication": "Nationale 3 (1981) → Nationale 2 (1992) → Pro B (1995). Une ville ne grimpe pas de division ! [VÉRIFIÉ]"
  }'::jsonb
);

INSERT INTO public.games (type, date, active, content) VALUES (
  'nantes_nbh', '2026-07-01', false,
  '{
    "context":     "Nantes ou NBH ?",
    "question":    "Qui te donne envie de crier \"Allez !\" sans même y réfléchir ?",
    "answer":      "les_deux",
    "explication": "Devant un match ou en parlant de sa ville, le réflexe est le même chez un vrai supporter ! 📣"
  }'::jsonb
);

INSERT INTO public.games (type, date, active, content) VALUES (
  'nantes_nbh', '2026-07-02', false,
  '{
    "context":     "Nantes ou NBH ?",
    "question":    "Qui a changé de nom dans son histoire ?",
    "answer":      "les_deux",
    "explication": "NBH s''appelait \"Les Enfants nantais de Sainte-Anne\" avant 1907. Nantes portait le nom antique de Condevicnum ! [VÉRIFIÉ]"
  }'::jsonb
);

INSERT INTO public.games (type, date, active, content) VALUES (
  'nantes_nbh', '2026-07-03', false,
  '{
    "context":     "Nantes ou NBH ?",
    "question":    "Qui peut se vanter d''avoir un nouveau joueur star cette saison ?",
    "answer":      "nbh",
    "explication": "[À CONFIRMER PAR LE CLUB — nom de la recrue phare de la saison, pour une vraie punchline maison]"
  }'::jsonb
);

INSERT INTO public.games (type, date, active, content) VALUES (
  'nantes_nbh', '2026-07-04', false,
  '{
    "context":     "Nantes ou NBH ?",
    "question":    "Qui a un surnom donné par ses fans ?",
    "answer":      "nbh",
    "explication": "[À CONFIRMER PAR LE CLUB — surnom du club ou du kop, s''il existe, sinon retirer cette question]"
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
