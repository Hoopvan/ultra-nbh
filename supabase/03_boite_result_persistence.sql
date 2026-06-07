-- À exécuter dans Supabase Dashboard > SQL Editor
--
-- Le résultat de la Boîte Mystère (gagné/perdu, récompense, code) ne
-- vivait qu'en mémoire le temps du grattage : en revenant sur l'écran
-- "déjà joué aujourd'hui", l'utilisateur ne pouvait plus le revoir.
-- On le persiste maintenant dans `users.boite_last_result` pour pouvoir
-- le réafficher en mode consultation (voir openBoiteReadOnly côté client).

alter table public.users add column if not exists boite_last_result jsonb;

create or replace function public.open_boite_mystere()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := (now() at time zone 'utc')::date;
  v_profile public.users%rowtype;
  v_game public.games%rowtype;
  v_won boolean;
  v_xp_gain int;
  v_reward text;
  v_code text;
  v_sponsor text;
  v_result jsonb;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_game from public.games
    where type = 'boite_mystere' and active = true limit 1;
  if not found then raise exception 'NO_ACTIVE_GAME'; end if;

  select * into v_profile from public.users where id = v_user_id for update;
  if not found then raise exception 'PROFILE_NOT_FOUND'; end if;
  if v_profile.boite_date = v_today then raise exception 'ALREADY_PLAYED_TODAY'; end if;

  v_won := random() < coalesce((v_game.content->>'win_probability')::numeric, 0.3);
  v_xp_gain := case when v_won then 100 else 30 end;
  v_reward := case when v_won then v_game.content->>'win_reward' else v_game.content->>'lose_reward' end;
  v_code := case when v_won then v_game.content->>'win_code' else v_game.content->>'lose_code' end;
  v_sponsor := v_game.content->>'sponsor_name';

  v_result := jsonb_build_object(
    'won', v_won,
    'reward', v_reward,
    'code', v_code,
    'sponsor_name', v_sponsor
  );

  update public.users
  set xp = xp + v_xp_gain,
      coins = coalesce(coins, 0) + v_xp_gain,
      interactions = coalesce(interactions, 0) + 1,
      boite_date = v_today,
      boite_last_result = v_result
  where id = v_user_id
  returning * into v_profile;

  if v_won then
    insert into public.boite_winners (user_id, user_name, sponsor_name, reward, code)
    values (v_user_id, v_profile.name, v_sponsor, v_reward, v_code);
  end if;

  return jsonb_build_object('profile', to_jsonb(v_profile)) || v_result;
end;
$$;
grant execute on function public.open_boite_mystere() to authenticated;
