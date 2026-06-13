-- 11_update_allowed_tops.sql
-- Met à jour la liste blanche des coiffures dans create_profile
-- pour correspondre au nouveau AVATAR_TOPS de config.js.
-- Passe aussi le type de retour de public.users → jsonb
-- (évite le même 42804 que buy_unlockable si les colonnes évoluent).
-- À exécuter dans Supabase Dashboard > SQL Editor

DROP FUNCTION IF EXISTS public.create_profile(text,text,text,text,text,text,text,text);

CREATE FUNCTION public.create_profile(
  p_name        text,
  p_skin        text,
  p_top         text DEFAULT 'shortFlat',
  p_hair_color  text DEFAULT 'brown',
  p_eyes        text DEFAULT 'default',
  p_mouth       text DEFAULT 'smile',
  p_facial_hair text DEFAULT '',
  p_clothe      text DEFAULT 'shirtCrewNeck'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_allowed_skin  text[] := ARRAY['light','tanned','brown','darkBrown'];
  v_allowed_top   text[] := ARRAY['hijab','shortFlat','shortCurly','sides','theCaesar','bob','straight01','bigHair'];
  v_allowed_hair  text[] := ARRAY['brown','black','blonde','red','silverGray'];
  v_allowed_eyes  text[] := ARRAY['default','happy','surprised','eyeRoll'];
  v_allowed_mouth text[] := ARRAY['smile','default','serious','twinkle','grimace'];
  v_allowed_facial text[] := ARRAY['','beardLight','beardMajestic','moustacheMagnum'];
  v_allowed_clothe text[] := ARRAY['shirtCrewNeck','shirtVNeck','hoodie','overall'];
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF p_name IS NULL OR length(trim(p_name)) = 0 OR length(p_name) > 30 THEN
    RAISE EXCEPTION 'INVALID_NAME';
  END IF;
  IF NOT (p_skin        = ANY(v_allowed_skin))   THEN RAISE EXCEPTION 'INVALID_SKIN'; END IF;
  IF NOT (p_top         = ANY(v_allowed_top))    THEN RAISE EXCEPTION 'INVALID_TOP'; END IF;
  IF NOT (p_hair_color  = ANY(v_allowed_hair))   THEN RAISE EXCEPTION 'INVALID_HAIR_COLOR'; END IF;
  IF NOT (p_eyes        = ANY(v_allowed_eyes))   THEN RAISE EXCEPTION 'INVALID_EYES'; END IF;
  IF NOT (p_mouth       = ANY(v_allowed_mouth))  THEN RAISE EXCEPTION 'INVALID_MOUTH'; END IF;
  IF NOT (p_facial_hair = ANY(v_allowed_facial)) THEN RAISE EXCEPTION 'INVALID_FACIAL_HAIR'; END IF;
  IF NOT (p_clothe      = ANY(v_allowed_clothe)) THEN RAISE EXCEPTION 'INVALID_CLOTHE'; END IF;

  IF EXISTS (SELECT 1 FROM public.users WHERE id = v_user_id) THEN
    RAISE EXCEPTION 'PROFILE_ALREADY_EXISTS';
  END IF;

  INSERT INTO public.users (
    id, name, xp, coins, interactions, streak, last_play,
    active_items, worn_items,
    avatar_skin, avatar_top, avatar_hair_color,
    avatar_eyes, avatar_mouth, avatar_facial_hair, avatar_clothe
  ) VALUES (
    v_user_id, trim(p_name), 0, 0, 0, 1, (now() AT TIME ZONE 'utc')::date,
    '["couleurs"]'::jsonb, '["couleurs"]'::jsonb,
    p_skin, p_top, p_hair_color,
    p_eyes, p_mouth, p_facial_hair, p_clothe
  );

  SELECT to_jsonb(u) INTO v_result FROM public.users u WHERE u.id = v_user_id;
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_profile(text,text,text,text,text,text,text,text) TO authenticated;
NOTIFY pgrst, 'reload schema';
