-- Mission unique "Installe l'appli" : récompense une seule fois quand l'app
-- est ajoutée à l'écran d'accueil (PWA). Même pattern que
-- claim_daily_free_booster (24_daily_free_booster.sql) mais sans reset
-- quotidien : une fois pwa_install_date posé, la mission reste acquise.
-- À exécuter dans Supabase Dashboard > SQL Editor.

alter table public.users add column if not exists pwa_install_date date;

create or replace function public.claim_pwa_install_reward()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := (now() at time zone 'utc')::date;
  v_profile public.users%rowtype;
  v_xp_reward int := 100;
  v_coins_reward int := 200;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_profile from public.users where id = v_user_id for update;
  if not found then raise exception 'PROFILE_NOT_FOUND'; end if;
  if v_profile.pwa_install_date is not null then raise exception 'ALREADY_CLAIMED'; end if;

  update public.users
  set xp = xp + v_xp_reward,
      coins = coins + v_coins_reward,
      interactions = interactions + 1,
      pwa_install_date = v_today
  where id = v_user_id
  returning * into v_profile;

  return jsonb_build_object('profile', to_jsonb(v_profile));
end;
$$;
grant execute on function public.claim_pwa_install_reward() to authenticated;
