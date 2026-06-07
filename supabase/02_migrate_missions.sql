-- À exécuter dans Supabase Dashboard > SQL Editor
--
-- Suite de la migration commencée dans 01_submit_pouls_vote.sql : chaque
-- mission/action qui distribue de l'XP, des pièces ou des objets passe
-- maintenant par une fonction serveur (SECURITY DEFINER) qui revalide tout
-- indépendamment de ce que le client prétend avoir fait. Le client ne fait
-- plus que "demander" — il ne peut plus écrire xp/coins/active_items/etc.
-- directement.
--
-- NB : toutes les fonctions utilisent la date UTC (now() at time zone 'utc')
-- pour rester cohérentes avec `new Date().toISOString().split('T')[0]` côté
-- client, qui sert à la fois à choisir le jeu du jour (`games.date`) et à
-- marquer les missions faites (`users.<type>_date`).

-- ── VESTIAIRE (quiz à 3 réponses, ordre fixe) ──────────────────────────────
create or replace function public.submit_vestiaire_answer(p_answer_index int)
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
  v_correct boolean;
  v_xp_gain int;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_game from public.games
    where type = 'vestiaire' and date = v_today and active = true limit 1;
  if not found then raise exception 'NO_ACTIVE_GAME'; end if;

  select * into v_profile from public.users where id = v_user_id for update;
  if not found then raise exception 'PROFILE_NOT_FOUND'; end if;
  if v_profile.vestiaire_date = v_today then raise exception 'ALREADY_PLAYED_TODAY'; end if;

  if p_answer_index is null or p_answer_index < 0
     or p_answer_index >= jsonb_array_length(v_game.content->'answers') then
    raise exception 'INVALID_ANSWER_INDEX';
  end if;

  v_correct := coalesce((v_game.content->'answers'->p_answer_index->>'correct')::boolean, false);
  v_xp_gain := case when v_correct then 30 else 15 end;

  update public.users
  set xp = xp + v_xp_gain,
      coins = coalesce(coins, 0) + v_xp_gain,
      interactions = coalesce(interactions, 0) + 1,
      vestiaire_date = v_today
  where id = v_user_id
  returning * into v_profile;

  return jsonb_build_object('profile', to_jsonb(v_profile), 'correct', v_correct);
end;
$$;
grant execute on function public.submit_vestiaire_answer(int) to authenticated;


-- ── ANECDOTE (quiz dont les réponses sont mélangées côté client,
--    donc on identifie la réponse choisie par son texte plutôt que son index) ──
create or replace function public.submit_anecdote_answer(p_answer_text text)
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
  v_match jsonb;
  v_correct boolean;
  v_xp_gain int;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_game from public.games
    where type = 'anecdote' and date = v_today and active = true limit 1;
  if not found then raise exception 'NO_ACTIVE_GAME'; end if;

  select * into v_profile from public.users where id = v_user_id for update;
  if not found then raise exception 'PROFILE_NOT_FOUND'; end if;
  if v_profile.anecdote_date = v_today then raise exception 'ALREADY_PLAYED_TODAY'; end if;

  select elem into v_match
  from jsonb_array_elements(v_game.content->'answers') elem
  where elem->>'text' = p_answer_text
  limit 1;
  if v_match is null then raise exception 'INVALID_ANSWER'; end if;

  v_correct := coalesce((v_match->>'correct')::boolean, false);
  v_xp_gain := case when v_correct then 30 else 15 end;

  update public.users
  set xp = xp + v_xp_gain,
      coins = coalesce(coins, 0) + v_xp_gain,
      interactions = coalesce(interactions, 0) + 1,
      anecdote_date = v_today
  where id = v_user_id
  returning * into v_profile;

  return jsonb_build_object('profile', to_jsonb(v_profile), 'correct', v_correct);
end;
$$;
grant execute on function public.submit_anecdote_answer(text) to authenticated;


-- ── NANTES / NBH / LES DEUX ────────────────────────────────────────────────
create or replace function public.submit_nantes_nbh_answer(p_choice text)
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
  v_correct boolean;
  v_xp_gain int;
  v_allowed text[] := array['nantes','nbh','les_deux'];
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_choice is null or not (p_choice = any(v_allowed)) then raise exception 'INVALID_CHOICE'; end if;

  select * into v_game from public.games
    where type = 'nantes_nbh' and date = v_today and active = true limit 1;
  if not found then raise exception 'NO_ACTIVE_GAME'; end if;

  select * into v_profile from public.users where id = v_user_id for update;
  if not found then raise exception 'PROFILE_NOT_FOUND'; end if;
  if v_profile.nantes_nbh_date = v_today then raise exception 'ALREADY_PLAYED_TODAY'; end if;

  v_correct := (v_game.content->>'answer') = p_choice;
  v_xp_gain := case when v_correct then 30 else 15 end;

  update public.users
  set xp = xp + v_xp_gain,
      coins = coalesce(coins, 0) + v_xp_gain,
      interactions = coalesce(interactions, 0) + 1,
      nantes_nbh_date = v_today
  where id = v_user_id
  returning * into v_profile;

  return jsonb_build_object('profile', to_jsonb(v_profile), 'correct', v_correct);
end;
$$;
grant execute on function public.submit_nantes_nbh_answer(text) to authenticated;


-- ── AVANT / APRÈS (pas de bonne/mauvaise réponse — XP fixe pour l'exploration) ─
create or replace function public.claim_avant_apres()
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := (now() at time zone 'utc')::date;
  v_profile public.users%rowtype;
  v_xp_gain int := 30;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;

  if not exists (select 1 from public.games where type = 'avant_apres' and date = v_today and active = true) then
    raise exception 'NO_ACTIVE_GAME';
  end if;

  select * into v_profile from public.users where id = v_user_id for update;
  if not found then raise exception 'PROFILE_NOT_FOUND'; end if;
  if v_profile.avant_apres_date = v_today then raise exception 'ALREADY_PLAYED_TODAY'; end if;

  update public.users
  set xp = xp + v_xp_gain,
      coins = coalesce(coins, 0) + v_xp_gain,
      interactions = coalesce(interactions, 0) + 1,
      avant_apres_date = v_today
  where id = v_user_id
  returning * into v_profile;

  return v_profile;
end;
$$;
grant execute on function public.claim_avant_apres() to authenticated;


-- ── PRONOSTIC ──────────────────────────────────────────────────────────────
create or replace function public.submit_pronostic(p_score_home int, p_score_away int)
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
  v_score text;
  v_xp_gain int := 25;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_score_home is null or p_score_away is null or p_score_home < 0 or p_score_away < 0 then
    raise exception 'INVALID_SCORE';
  end if;

  select * into v_game from public.games
    where type = 'pronostic' and date = v_today and active = true limit 1;
  if not found then raise exception 'NO_ACTIVE_GAME'; end if;

  select * into v_profile from public.users where id = v_user_id for update;
  if not found then raise exception 'PROFILE_NOT_FOUND'; end if;
  if v_profile.pronostic_date = v_today then raise exception 'ALREADY_PLAYED_TODAY'; end if;

  v_score := p_score_home || '-' || p_score_away;

  insert into public.pronostic_votes (user_id, user_name, match_id, score)
  values (v_user_id, v_profile.name, coalesce(v_game.content->>'match_id', 'unknown'), v_score);

  update public.users
  set xp = xp + v_xp_gain,
      coins = coalesce(coins, 0) + v_xp_gain,
      interactions = coalesce(interactions, 0) + 1,
      pronostic_date = v_today,
      pronostic_score = v_score
  where id = v_user_id
  returning * into v_profile;

  return jsonb_build_object('profile', to_jsonb(v_profile), 'score', v_score);
end;
$$;
grant execute on function public.submit_pronostic(int, int) to authenticated;


-- ── BOÎTE MYSTÈRE ──────────────────────────────────────────────────────────
-- Avant : le navigateur tirait au sort (Math.random() < win_probability),
-- affichait "Félicitations !" ou pas, puis claimBoite() relisait CE TEXTE
-- AFFICHÉ À L'ÉCRAN pour décider d'enregistrer un vrai code de récompense
-- sponsor dans boite_winners. Trivialement falsifiable (changer le texte
-- affiché via la console suffisait à obtenir un faux gain + un vrai code).
--
-- Maintenant : le serveur tire au sort, décide, verrouille la mission du jour
-- et enregistre le gagnant — tout en une transaction. Le client se contente
-- de jouer l'animation de grattage sur le résultat que le serveur lui donne.
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

  update public.users
  set xp = xp + v_xp_gain,
      coins = coalesce(coins, 0) + v_xp_gain,
      interactions = coalesce(interactions, 0) + 1,
      boite_date = v_today
  where id = v_user_id
  returning * into v_profile;

  if v_won then
    insert into public.boite_winners (user_id, user_name, sponsor_name, reward, code)
    values (v_user_id, v_profile.name, v_sponsor, v_reward, v_code);
  end if;

  return jsonb_build_object(
    'profile', to_jsonb(v_profile),
    'won', v_won,
    'reward', v_reward,
    'code', v_code,
    'sponsor_name', v_sponsor
  );
end;
$$;
grant execute on function public.open_boite_mystere() to authenticated;


-- ── BOUTIQUE (objets cosmétiques contre des pièces) ────────────────────────
-- Le catalogue (coût par objet) est répliqué ici en dur — il doit rester
-- synchronisé avec la constante UNLOCKABLES dans index.html si tu modifies
-- les prix ou ajoutes des objets.
--
-- ⚠️ Si cette fonction échoue avec une erreur de type sur active_items /
-- worn_items, c'est probablement que ces colonnes sont des text[] plutôt
-- que jsonb/json — préviens-moi, l'ajustement est mineur (array_append au
-- lieu de l'opérateur ||).
create or replace function public.buy_unlockable(p_item_id text)
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.users%rowtype;
  v_costs jsonb := '{"couleurs":50,"echarpe":80,"casquette":120,"maillot":200,"badge":300,"couronne":500}'::jsonb;
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
  v_worn := coalesce(v_profile.worn_items, '[]'::jsonb) || to_jsonb(p_item_id);

  update public.users
  set coins = coins - v_cost,
      active_items = v_owned,
      worn_items = v_worn
  where id = v_user_id
  returning * into v_profile;

  return v_profile;
end;
$$;
grant execute on function public.buy_unlockable(text) to authenticated;
