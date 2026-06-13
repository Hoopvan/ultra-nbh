-- 15_fix_timeline_rpc.sql
-- Corrige deux bugs dans submit_timeline_answer :
--   1. e->>'id' sur un entier jsonb retourne NULL  → utiliser (e#>>'{}')::int
--   2. v_correct_order->>(idx) retourne du texte,   → utiliser ->  puis ->>'id'
-- Le client doit envoyer p_order comme tableau JS brut (pas JSON.stringify).

CREATE OR REPLACE FUNCTION public.submit_timeline_answer(p_order jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id       uuid := auth.uid();
  v_today         date := (now() at time zone 'utc')::date;
  v_profile       public.users%rowtype;
  v_game          public.games%rowtype;
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

  -- Ordre correct : événements triés par année croissante
  SELECT jsonb_agg(e ORDER BY (e->>'year')::int ASC)
    INTO v_correct_order
    FROM jsonb_array_elements(v_game.content->'events') e;

  -- p_order = [1,3,2,4] (tableau d'IDs entiers)
  -- v_correct_order = [{"id":1,...},{"id":2,...},...]
  v_is_correct := (
    SELECT array_agg((e#>>'{}')::int ORDER BY ordinality) =
           array_agg((v_correct_order -> ((ordinality-1)::int) ->> 'id')::int ORDER BY ordinality)
    FROM jsonb_array_elements(p_order) WITH ORDINALITY AS t(e, ordinality)
  );

  v_xp_gain := CASE WHEN v_is_correct THEN 30 ELSE 15 END;

  UPDATE public.users
  SET xp            = xp + v_xp_gain,
      coins         = coalesce(coins, 0) + v_xp_gain,
      interactions  = coalesce(interactions, 0) + 1,
      timeline_date = v_today
  WHERE id = v_user_id
  RETURNING * INTO v_profile;

  RETURN jsonb_build_object(
    'profile',       to_jsonb(v_profile),
    'correct',       v_is_correct,
    'xp_gain',       v_xp_gain,
    'correct_order', v_correct_order
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_timeline_answer(jsonb) TO authenticated;
