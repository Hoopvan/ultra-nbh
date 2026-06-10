-- 06_avatar_dicebear.sql
-- Refonte du système d'avatar : migration vers DiceBear avataaars
-- À exécuter dans Supabase Dashboard > SQL Editor

-- 1. Nouvelles colonnes avatar
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS avatar_top TEXT DEFAULT 'shortFlat',
  ADD COLUMN IF NOT EXISTS avatar_eyes TEXT DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS avatar_mouth TEXT DEFAULT 'smile',
  ADD COLUMN IF NOT EXISTS avatar_facial_hair TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS avatar_clothe TEXT DEFAULT 'shirtCrewNeck',
  ADD COLUMN IF NOT EXISTS avatar_hair_color TEXT DEFAULT 'brown';

-- 2. Migrer les valeurs de teinte de peau (skin1→light, etc.)
UPDATE public.users
SET avatar_skin = CASE avatar_skin
  WHEN 'skin1' THEN 'light'
  WHEN 'skin2' THEN 'tanned'
  WHEN 'skin3' THEN 'brown'
  WHEN 'skin4' THEN 'darkBrown'
  ELSE 'light'
END
WHERE avatar_skin IN ('skin1','skin2','skin3','skin4');

-- 3. Ajouter les grants de mise à jour pour les nouvelles colonnes
GRANT UPDATE (
  avatar_top, avatar_eyes, avatar_mouth,
  avatar_facial_hair, avatar_clothe, avatar_hair_color
) ON public.users TO authenticated;

-- 4. Supprimer l'ancienne fonction create_profile (signature différente)
DROP FUNCTION IF EXISTS public.create_profile(text, text, text, text);

-- 5. Nouvelle fonction create_profile avec paramètres DiceBear
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

-- 6. Supprimer les anciennes colonnes (révoque automatiquement leurs grants)
ALTER TABLE public.users
  DROP COLUMN IF EXISTS avatar_silhouette,
  DROP COLUMN IF EXISTS avatar_hair;
