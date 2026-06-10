-- 06b_avatar_dicebear_patch.sql
-- Patch : corrige les valeurs DiceBear HTTP API (top names + défauts)
-- À exécuter dans Supabase Dashboard > SQL Editor

-- 1. Corriger la valeur par défaut de la colonne avatar_top
ALTER TABLE public.users
  ALTER COLUMN avatar_top SET DEFAULT 'shortFlat';

-- 2. Migrer les lignes existantes avec les anciens noms de coiffure
UPDATE public.users SET avatar_top = CASE avatar_top
  WHEN 'shortHairShortFlat'  THEN 'shortFlat'
  WHEN 'shortHairSides'      THEN 'sides'
  WHEN 'shortHairTheCaesar'  THEN 'theCaesar'
  WHEN 'shortHairDreads01'   THEN 'dreads01'
  WHEN 'longHairBigHair'     THEN 'bigHair'
  WHEN 'longHairBob'         THEN 'bob'
  WHEN 'longHairCurlyLong'   THEN 'curly'
  WHEN 'longHairStraight2'   THEN 'straight02'
  WHEN 'noHair'              THEN 'shavedSides'
  ELSE avatar_top
END
WHERE avatar_top IN (
  'shortHairShortFlat','shortHairSides','shortHairTheCaesar','shortHairDreads01',
  'longHairBigHair','longHairBob','longHairCurlyLong','longHairStraight2','noHair'
);

-- 3. Recréer la fonction create_profile avec les bonnes valeurs autorisées
CREATE OR REPLACE FUNCTION public.create_profile(
  p_name        text,
  p_skin        text,
  p_top         text DEFAULT 'shortFlat',
  p_hair_color  text DEFAULT 'brown',
  p_eyes        text DEFAULT 'default',
  p_mouth       text DEFAULT 'smile',
  p_facial_hair text DEFAULT '',
  p_clothe      text DEFAULT 'shirtCrewNeck'
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
    'hijab','shavedSides'
  ];
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF p_name IS NULL OR length(trim(p_name)) = 0 OR length(p_name) > 30 THEN
    RAISE EXCEPTION 'INVALID_NAME';
  END IF;
  IF NOT (p_skin = ANY(v_allowed_skin)) THEN RAISE EXCEPTION 'INVALID_SKIN'; END IF;
  IF NOT (p_top = ANY(v_allowed_top)) THEN RAISE EXCEPTION 'INVALID_TOP'; END IF;

  IF EXISTS (SELECT 1 FROM public.users WHERE id = v_user_id) THEN
    RAISE EXCEPTION 'PROFILE_ALREADY_EXISTS';
  END IF;

  INSERT INTO public.users (
    id, name, xp, coins, interactions, streak, last_play,
    active_items,
    avatar_skin, avatar_top, avatar_hair_color,
    avatar_eyes, avatar_mouth, avatar_facial_hair, avatar_clothe
  ) VALUES (
    v_user_id, trim(p_name), 0, 0, 0, 1, (now() AT TIME ZONE 'utc')::date,
    '["couleurs"]'::jsonb,
    p_skin, p_top, p_hair_color,
    p_eyes, p_mouth, p_facial_hair, p_clothe
  )
  RETURNING * INTO v_profile;

  RETURN v_profile;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_profile(text, text, text, text, text, text, text, text) TO authenticated;
