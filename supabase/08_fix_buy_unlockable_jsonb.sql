-- 08_fix_buy_unlockable_jsonb.sql
-- Contourne l'erreur 42804 (datatype mismatch) en retournant jsonb
-- au lieu du type composite public.users, dont la liaison devient
-- obsolète quand des colonnes sont ajoutées à la table.
-- Nécessite un DROP car le type de retour change.
-- À exécuter dans Supabase Dashboard > SQL Editor

DROP FUNCTION IF EXISTS public.buy_unlockable(text);

CREATE FUNCTION public.buy_unlockable(p_item_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile public.users%rowtype;
  v_costs   jsonb := '{"couleurs":50,"echarpe":80,"casquette":120,"lunettes":150,"maillot":200,"bandeau":250}'::jsonb;
  v_cost    int;
  v_owned   jsonb;
  v_worn    jsonb;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;

  v_cost := (v_costs->>p_item_id)::int;
  IF v_cost IS NULL THEN RAISE EXCEPTION 'UNKNOWN_ITEM'; END IF;

  SELECT * INTO v_profile FROM public.users WHERE id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROFILE_NOT_FOUND'; END IF;

  v_owned := COALESCE(v_profile.active_items, '[]'::jsonb);
  IF v_owned ? p_item_id THEN RAISE EXCEPTION 'ALREADY_OWNED'; END IF;
  IF COALESCE(v_profile.coins, 0) < v_cost THEN RAISE EXCEPTION 'NOT_ENOUGH_COINS'; END IF;

  v_owned := v_owned || to_jsonb(p_item_id);
  v_worn  := COALESCE(v_profile.worn_items, '[]'::jsonb) || to_jsonb(p_item_id);

  UPDATE public.users
  SET coins        = coins - v_cost,
      active_items = v_owned,
      worn_items   = v_worn
  WHERE id = v_user_id
  RETURNING * INTO v_profile;

  RETURN to_jsonb(v_profile);
END;
$$;

GRANT EXECUTE ON FUNCTION public.buy_unlockable(text) TO authenticated;
