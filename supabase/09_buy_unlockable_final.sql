-- 09_buy_unlockable_final.sql
-- Réécriture sans public.users%rowtype ni RETURNING * INTO rowtype
-- (évite toute liaison stale avec le type composite de la table)
-- À exécuter dans Supabase Dashboard > SQL Editor

CREATE OR REPLACE FUNCTION public.buy_unlockable(p_item_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid   := auth.uid();
  v_costs   jsonb  := '{"couleurs":50,"echarpe":80,"casquette":120,"lunettes":150,"maillot":200,"bandeau":250}'::jsonb;
  v_cost    int;
  v_coins   int;
  v_owned   jsonb;
  v_worn    jsonb;
  v_result  jsonb;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;

  v_cost := (v_costs->>p_item_id)::int;
  IF v_cost IS NULL THEN RAISE EXCEPTION 'UNKNOWN_ITEM'; END IF;

  SELECT coins, active_items, worn_items
    INTO v_coins, v_owned, v_worn
    FROM public.users
   WHERE id = v_user_id
     FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'PROFILE_NOT_FOUND'; END IF;

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

-- Force PostgREST à recharger son schéma cache
NOTIFY pgrst, 'reload schema';
