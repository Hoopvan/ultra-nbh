-- Booster gratuit quotidien (1 carte, sans cout en Hermines) accessible
-- depuis les missions du jour. Le tirage de la carte reste cote client
-- (meme logique que openBoosterPack / user_cards deja proteges par RLS) ;
-- seule la limite "1 fois par jour" doit etre garantie cote serveur.
-- A executer dans Supabase Dashboard > SQL Editor

alter table public.users add column if not exists free_booster_date date;

create or replace function public.claim_daily_free_booster()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := (now() at time zone 'utc')::date;
  v_profile public.users%rowtype;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_profile from public.users where id = v_user_id for update;
  if not found then raise exception 'PROFILE_NOT_FOUND'; end if;
  if v_profile.free_booster_date = v_today then raise exception 'ALREADY_CLAIMED_TODAY'; end if;

  update public.users
  set free_booster_date = v_today
  where id = v_user_id
  returning * into v_profile;

  return jsonb_build_object('profile', to_jsonb(v_profile));
end;
$$;
grant execute on function public.claim_daily_free_booster() to authenticated;
