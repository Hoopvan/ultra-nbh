-- Offre 150 Hermines (coins) à la création de compte, pour que le nouvel
-- utilisateur ait de quoi débloquer un premier équipement d'avatar sans
-- attendre d'avoir fini des missions. Reprend intégralement la version de
-- create_profile de 27_friends_system.sql (CREATE OR REPLACE, même
-- signature), seul le coins initial (0 -> 150) change.
-- À exécuter dans Supabase Dashboard > SQL Editor.

CREATE OR REPLACE FUNCTION public.create_profile(
  p_name        text,
  p_skin        text,
  p_top         text DEFAULT 'shortFlat',
  p_hair_color  text DEFAULT 'brown',
  p_eyes        text DEFAULT 'default',
  p_mouth       text DEFAULT 'smile',
  p_facial_hair text DEFAULT '',
  p_clothe      text DEFAULT 'shirtCrewNeck',
  p_org_id      uuid DEFAULT '00000000-0000-0000-0000-000000000001'
)
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile public.users%rowtype;
  v_allowed_skin text[] := ARRAY['light','tanned','brown','darkBrown'];
  v_allowed_top  text[] := ARRAY[
    'shortFlat','sides','theCaesar','dreads01',
    'bigHair','bob','curly','straight02',
    'hijab','shavedSides','shortCurly','straight01','bandana','frizzle'
  ];
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF p_name IS NULL OR length(trim(p_name)) = 0 OR length(p_name) > 30 THEN
    RAISE EXCEPTION 'INVALID_NAME';
  END IF;
  IF NOT (p_skin = ANY(v_allowed_skin)) THEN RAISE EXCEPTION 'INVALID_SKIN'; END IF;
  IF NOT (p_top = ANY(v_allowed_top)) THEN RAISE EXCEPTION 'INVALID_TOP'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = p_org_id) THEN
    RAISE EXCEPTION 'INVALID_ORG';
  END IF;

  IF EXISTS (SELECT 1 FROM public.users WHERE id = v_user_id) THEN
    RAISE EXCEPTION 'PROFILE_ALREADY_EXISTS';
  END IF;

  INSERT INTO public.users (
    id, org_id, name, xp, coins, interactions, streak, last_play,
    active_items,
    avatar_skin, avatar_top, avatar_hair_color,
    avatar_eyes, avatar_mouth, avatar_facial_hair, avatar_clothe
  ) VALUES (
    v_user_id, p_org_id, trim(p_name), 0, 150, 0, 1, (now() AT TIME ZONE 'utc')::date,
    '["couleurs"]'::jsonb,
    p_skin, p_top, p_hair_color,
    p_eyes, p_mouth, p_facial_hair, p_clothe
  )
  RETURNING * INTO v_profile;

  PERFORM public.assign_friend_code(v_user_id, p_org_id);

  RETURN v_profile;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_profile(text, text, text, text, text, text, text, text, uuid) TO authenticated;
