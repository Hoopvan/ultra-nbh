-- Migration de la boutique avatar (UNLOCKABLES) du hardcode JS vers une
-- table par organisation. Les 6 slots (couleurs/echarpe/casquette/lunettes/
-- maillot/bandeau) restent fixes car leur rendu SVG est câblé en dur dans
-- js/avatar.js (buildAvatarSVG) — seuls le nom, le prix, l'icône et la
-- description deviennent personnalisables par club.
--
-- ATTENTION : cette migration réécrit buy_unlockable(), la fonction qui gère
-- les achats réels des fans NBH en production. Les coûts NBH ci-dessous sont
-- copiés à l'identique de js/config.js pour ne rien changer au comportement
-- actuel. Vérifier après exécution qu'un achat fonctionne toujours (mode non-démo).
--
-- À exécuter dans Supabase Dashboard > SQL Editor

-- ── 1. TABLE UNLOCKABLES ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.unlockables (
  id          TEXT NOT NULL,
  org_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  icon        TEXT NOT NULL,
  name        TEXT NOT NULL,
  cost        INT NOT NULL,
  description TEXT,
  sort_order  INT NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (id, org_id)
);

ALTER TABLE public.unlockables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "unlockables_select_all" ON public.unlockables;
CREATE POLICY "unlockables_select_all" ON public.unlockables
  FOR SELECT TO anon, authenticated USING (true);

GRANT SELECT ON public.unlockables TO anon, authenticated;

-- ── 2. CATALOGUE NBH (valeurs identiques à l'ancien js/config.js) ───────────
INSERT INTO public.unlockables (id, org_id, icon, name, cost, description, sort_order) VALUES
  ('couleurs',  '00000000-0000-0000-0000-000000000001', '🎨', 'Couleurs NBH', 50,  'Tenue aux couleurs du club',            0),
  ('echarpe',   '00000000-0000-0000-0000-000000000001', '🧣', 'Écharpe',      80,  'L''écharpe officielle de l''Hermine',   1),
  ('casquette', '00000000-0000-0000-0000-000000000001', '🧢', 'Casquette',    120, 'La casquette bleue marine NBH',         2),
  ('lunettes',  '00000000-0000-0000-0000-000000000001', '🕶️', 'Lunettes',     150, 'Style assuré en tribune',               3),
  ('maillot',   '00000000-0000-0000-0000-000000000001', '👕', 'Maillot',      200, 'Le maillot domicile du club',           4),
  ('bandeau',   '00000000-0000-0000-0000-000000000001', '🎽', 'Bandeau',      250, 'Bandeau NBH sur le front',              5)
ON CONFLICT (id, org_id) DO NOTHING;

-- ── 3. CATALOGUE DEMO (texte générique, mêmes coûts) ─────────────────────────
INSERT INTO public.unlockables (id, org_id, icon, name, cost, description, sort_order) VALUES
  ('couleurs',  '00000000-0000-0000-0000-000000000002', '🎨', 'Couleurs du club', 50,  'Tenue aux couleurs de ton club',   0),
  ('echarpe',   '00000000-0000-0000-0000-000000000002', '🧣', 'Écharpe',          80,  'L''écharpe officielle du club',    1),
  ('casquette', '00000000-0000-0000-0000-000000000002', '🧢', 'Casquette',        120, 'La casquette du club',             2),
  ('lunettes',  '00000000-0000-0000-0000-000000000002', '🕶️', 'Lunettes',         150, 'Style assuré en tribune',          3),
  ('maillot',   '00000000-0000-0000-0000-000000000002', '👕', 'Maillot',          200, 'Le maillot domicile du club',      4),
  ('bandeau',   '00000000-0000-0000-0000-000000000002', '🎽', 'Bandeau',          250, 'Bandeau du club sur le front',     5)
ON CONFLICT (id, org_id) DO NOTHING;

-- ── 4. buy_unlockable() : coût lu depuis la table, scopé à l'org du joueur ───
CREATE OR REPLACE FUNCTION public.buy_unlockable(p_item_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_org_id  uuid;
  v_cost    int;
  v_coins   int;
  v_owned   jsonb;
  v_worn    jsonb;
  v_result  jsonb;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;

  SELECT org_id, coins, active_items, worn_items
    INTO v_org_id, v_coins, v_owned, v_worn
    FROM public.users
   WHERE id = v_user_id
   FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'PROFILE_NOT_FOUND'; END IF;

  SELECT cost INTO v_cost
    FROM public.unlockables
   WHERE id = p_item_id AND org_id = v_org_id AND active = true;

  IF v_cost IS NULL THEN RAISE EXCEPTION 'UNKNOWN_ITEM'; END IF;

  v_owned := COALESCE(v_owned, '[]'::jsonb);
  IF v_owned ? p_item_id THEN RAISE EXCEPTION 'ALREADY_OWNED'; END IF;
  IF COALESCE(v_coins, 0) < v_cost THEN RAISE EXCEPTION 'NOT_ENOUGH_COINS'; END IF;

  v_owned := v_owned || to_jsonb(p_item_id);
  v_worn  := COALESCE(v_worn, '[]'::jsonb) || to_jsonb(p_item_id);

  UPDATE public.users
     SET coins        = coins - v_cost,
         active_items = v_owned,
         worn_items   = v_worn
   WHERE id = v_user_id;

  SELECT to_jsonb(u) INTO v_result FROM public.users u WHERE u.id = v_user_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.buy_unlockable(text) TO authenticated;

NOTIFY pgrst, 'reload schema';
