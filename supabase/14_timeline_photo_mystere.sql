-- 14_timeline_photo_mystere.sql
-- Ajoute deux nouveaux types de missions : Timeline et Photo Mystère.

-- ── Nouvelles colonnes sur users ─────────────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS timeline_date      date,
  ADD COLUMN IF NOT EXISTS photo_mystere_date date;

-- ── TIMELINE ─────────────────────────────────────────────────────────────────
-- Le client envoie l'ordre choisi par le fan (tableau d'IDs numériques).
-- Le serveur trie les événements par année et compare.
CREATE OR REPLACE FUNCTION public.submit_timeline_answer(p_order jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   uuid := auth.uid();
  v_today     date := (now() at time zone 'utc')::date;
  v_profile   public.users%rowtype;
  v_game      public.games%rowtype;
  v_correct_order jsonb;
  v_is_correct    boolean;
  v_xp_gain       int;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;

  SELECT * INTO v_game FROM public.games
    WHERE type = 'timeline' AND date = v_today AND active = true LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'NO_ACTIVE_GAME'; END IF;

  SELECT * INTO v_profile FROM public.users WHERE id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROFILE_NOT_FOUND'; END IF;
  IF v_profile.timeline_date = v_today THEN RAISE EXCEPTION 'ALREADY_PLAYED_TODAY'; END IF;

  -- Ordre correct = événements triés par année croissante
  SELECT jsonb_agg(e ORDER BY (e->>'year')::int ASC)
    INTO v_correct_order
    FROM jsonb_array_elements(v_game.content->'events') e;

  -- Comparaison des tableaux d'IDs
  v_is_correct := (
    SELECT array_agg((e->>'id')::int ORDER BY ordinality) =
           array_agg(((v_correct_order->>(ordinality-1)::int)->>'id')::int ORDER BY ordinality)
    FROM jsonb_array_elements(p_order) WITH ORDINALITY AS t(e, ordinality)
  );

  v_xp_gain := CASE WHEN v_is_correct THEN 30 ELSE 15 END;

  UPDATE public.users
  SET xp           = xp + v_xp_gain,
      coins        = coalesce(coins, 0) + v_xp_gain,
      interactions = coalesce(interactions, 0) + 1,
      timeline_date = v_today
  WHERE id = v_user_id
  RETURNING * INTO v_profile;

  RETURN jsonb_build_object(
    'profile',        to_jsonb(v_profile),
    'correct',        v_is_correct,
    'xp_gain',        v_xp_gain,
    'correct_order',  v_correct_order
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_timeline_answer(jsonb) TO authenticated;


-- ── PHOTO MYSTÈRE ─────────────────────────────────────────────────────────────
-- Le client envoie la réponse choisie et le stage (1, 2 ou 3).
-- XP dégressif : 50 / 30 / 15. Participation = 10 si mauvais à tous les stages.
CREATE OR REPLACE FUNCTION public.submit_photo_mystere(p_answer text, p_stage int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    uuid := auth.uid();
  v_today      date := (now() at time zone 'utc')::date;
  v_profile    public.users%rowtype;
  v_game       public.games%rowtype;
  v_is_correct boolean;
  v_xp_gain    int;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF p_stage IS NULL OR p_stage < 1 OR p_stage > 3 THEN RAISE EXCEPTION 'INVALID_STAGE'; END IF;

  SELECT * INTO v_game FROM public.games
    WHERE type = 'photo_mystere' AND date = v_today AND active = true LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'NO_ACTIVE_GAME'; END IF;

  SELECT * INTO v_profile FROM public.users WHERE id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROFILE_NOT_FOUND'; END IF;
  IF v_profile.photo_mystere_date = v_today THEN RAISE EXCEPTION 'ALREADY_PLAYED_TODAY'; END IF;

  v_is_correct := (v_game.content->>'answer') = p_answer;
  v_xp_gain := CASE
    WHEN v_is_correct AND p_stage = 1 THEN 50
    WHEN v_is_correct AND p_stage = 2 THEN 30
    WHEN v_is_correct AND p_stage = 3 THEN 15
    ELSE 10  -- participation si mauvais à tous les stages
  END;

  UPDATE public.users
  SET xp                 = xp + v_xp_gain,
      coins              = coalesce(coins, 0) + v_xp_gain,
      interactions       = coalesce(interactions, 0) + 1,
      photo_mystere_date = v_today
  WHERE id = v_user_id
  RETURNING * INTO v_profile;

  RETURN jsonb_build_object(
    'profile',   to_jsonb(v_profile),
    'correct',   v_is_correct,
    'xp_gain',   v_xp_gain,
    'answer',    v_game.content->>'answer'
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_photo_mystere(text, int) TO authenticated;
