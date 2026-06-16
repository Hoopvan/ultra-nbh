-- Multi-tenant : organisations + config + org_id sur toutes les tables
-- À exécuter dans Supabase Dashboard > SQL Editor

-- ── 1. TABLE ORGANIZATIONS ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.organizations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       TEXT UNIQUE NOT NULL,
  name       TEXT NOT NULL,
  sport      TEXT DEFAULT 'basketball',
  country    TEXT DEFAULT 'FR',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orgs_select_anon" ON public.organizations;
CREATE POLICY "orgs_select_anon" ON public.organizations
  FOR SELECT TO anon, authenticated USING (true);

GRANT SELECT ON public.organizations TO anon, authenticated;

-- ── 2. TABLE ORG_CONFIG ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.org_config (
  org_id           UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  primary_color    TEXT DEFAULT '#e8192c',
  secondary_color  TEXT DEFAULT '#0d1b3e',
  accent_color     TEXT DEFAULT '#f5a623',
  logo_url         TEXT,
  app_name         TEXT DEFAULT 'HoopFan',
  tagline          TEXT,
  home_city        TEXT,
  default_lang     TEXT DEFAULT 'fr',
  features_enabled JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE public.org_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_config_select_anon" ON public.org_config;
CREATE POLICY "org_config_select_anon" ON public.org_config
  FOR SELECT TO anon, authenticated USING (true);

GRANT SELECT ON public.org_config TO anon, authenticated;

-- ── 3. DONNÉES NBH ────────────────────────────────────────────────────────────

INSERT INTO public.organizations (id, slug, name, sport, country)
VALUES ('00000000-0000-0000-0000-000000000001', 'nbh', 'Nantes Basket Hermine', 'basketball', 'FR')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.org_config (
  org_id, primary_color, secondary_color, accent_color,
  app_name, tagline, home_city, default_lang, features_enabled
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  '#e8192c', '#0d1b3e', '#f5a623',
  'Hoop NBH', 'Le compagnon des fans de l''Hermine', 'Nantes', 'fr',
  '{"pouls":true,"vestiaire":true,"anecdote":true,"nantes_nbh":true,"avant_apres":true,"pronostic":true,"boite_mystere":true,"timeline":true,"photo_mystere":true}'::jsonb
)
ON CONFLICT (org_id) DO NOTHING;

-- ── 4. AJOUT org_id SUR TOUTES LES TABLES ────────────────────────────────────

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id)
  DEFAULT '00000000-0000-0000-0000-000000000001';
UPDATE public.users SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id)
  DEFAULT '00000000-0000-0000-0000-000000000001';
UPDATE public.games SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;

ALTER TABLE public.pouls_votes
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id)
  DEFAULT '00000000-0000-0000-0000-000000000001';
UPDATE public.pouls_votes SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;

ALTER TABLE public.pronostic_votes
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id)
  DEFAULT '00000000-0000-0000-0000-000000000001';
UPDATE public.pronostic_votes SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;

ALTER TABLE public.boite_winners
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id)
  DEFAULT '00000000-0000-0000-0000-000000000001';
UPDATE public.boite_winners SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;

ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id)
  DEFAULT '00000000-0000-0000-0000-000000000001';
UPDATE public.push_subscriptions SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;

-- ── 5. MISE À JOUR create_profile : ajoute org_id ────────────────────────────

DROP FUNCTION IF EXISTS public.create_profile(text, text, text, text, text, text, text, text);

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
    v_user_id, p_org_id, trim(p_name), 0, 0, 0, 1, (now() AT TIME ZONE 'utc')::date,
    '["couleurs"]'::jsonb,
    p_skin, p_top, p_hair_color,
    p_eyes, p_mouth, p_facial_hair, p_clothe
  )
  RETURNING * INTO v_profile;

  RETURN v_profile;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_profile(text, text, text, text, text, text, text, text, uuid) TO authenticated;
