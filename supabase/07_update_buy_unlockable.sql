-- 07_update_buy_unlockable.sql
-- Met à jour la liste des items achetables (remplace badge/couronne par lunettes/bandeau)
-- À exécuter dans Supabase Dashboard > SQL Editor

create or replace function public.buy_unlockable(p_item_id text)
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.users%rowtype;
  v_costs jsonb := '{"couleurs":50,"echarpe":80,"casquette":120,"lunettes":150,"maillot":200,"bandeau":250}'::jsonb;
  v_cost int;
  v_owned jsonb;
  v_worn jsonb;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;

  v_cost := (v_costs->>p_item_id)::int;
  if v_cost is null then raise exception 'UNKNOWN_ITEM'; end if;

  select * into v_profile from public.users where id = v_user_id for update;
  if not found then raise exception 'PROFILE_NOT_FOUND'; end if;

  v_owned := coalesce(v_profile.active_items, '[]'::jsonb);
  if v_owned ? p_item_id then raise exception 'ALREADY_OWNED'; end if;
  if coalesce(v_profile.coins, 0) < v_cost then raise exception 'NOT_ENOUGH_COINS'; end if;

  v_owned := v_owned || to_jsonb(p_item_id);
  v_worn  := coalesce(v_profile.worn_items, '[]'::jsonb) || to_jsonb(p_item_id);

  update public.users
  set coins        = coins - v_cost,
      active_items = v_owned,
      worn_items   = v_worn
  where id = v_user_id
  returning * into v_profile;

  return v_profile;
end;
$$;

grant execute on function public.buy_unlockable(text) to authenticated;
