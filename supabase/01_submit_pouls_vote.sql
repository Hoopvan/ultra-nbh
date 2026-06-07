-- À exécuter dans Supabase Dashboard > SQL Editor
--
-- Déplace la validation du "Pouls du Club" côté serveur : le client ne peut
-- plus s'auto-attribuer de l'XP/des pièces ni voter plusieurs fois par jour
-- en appelant directement `update`/`insert` depuis le navigateur.

create or replace function public.submit_pouls_vote(p_match_id text, p_emotion text)
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := (now() at time zone 'Europe/Paris')::date;
  v_profile public.users%rowtype;
  v_xp_gain int := 20;
  v_allowed_emotions text[] := array['En feu','Confiant','On y croit','Nerveux'];
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if p_emotion is null or not (p_emotion = any(v_allowed_emotions)) then
    raise exception 'INVALID_EMOTION';
  end if;

  -- Verrouille la ligne pour éviter une double soumission concurrente
  select * into v_profile from public.users where id = v_user_id for update;
  if not found then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  if v_profile.pouls_date = v_today then
    raise exception 'ALREADY_VOTED_TODAY';
  end if;

  insert into public.pouls_votes (user_id, emotion, match_id)
  values (v_user_id, p_emotion, p_match_id);

  update public.users
  set xp = xp + v_xp_gain,
      coins = coalesce(coins, 0) + v_xp_gain,
      interactions = coalesce(interactions, 0) + 1,
      pouls_date = v_today
  where id = v_user_id
  returning * into v_profile;

  return v_profile;
end;
$$;

-- Les utilisateurs authentifiés peuvent appeler la fonction (mais pas écrire
-- xp/coins/pouls_date directement — c'est la fonction, en SECURITY DEFINER,
-- qui le fait pour eux après avoir validé les règles).
grant execute on function public.submit_pouls_vote(text, text) to authenticated;
