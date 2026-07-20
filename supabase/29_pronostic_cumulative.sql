-- Classement pronostic cumulé entre amis. À exécuter dans Supabase Dashboard > SQL Editor.
--
-- Décision : colonne cumulée alimentée par un RPC de clôture admin, PAS un
-- recalcul à la volée. Un recalcul à la volée agrégerait tout l'historique
-- pronostic_votes à chaque affichage du classement amis — un coût qui grandit
-- indéfiniment avec le nombre de matchs joués. La clôture ponctuelle (déclenchée
-- par l'admin en même temps qu'il renseigne le score final) fait ce travail une
-- seule fois par match ; la lecture devient un simple ORDER BY. Compromis assumé :
-- les matchs déjà joués avant le déploiement de cette fonctionnalité ne sont pas
-- recomptés rétroactivement.

alter table public.users
  add column if not exists pronostic_points int not null default 0;

alter table public.games
  add column if not exists closed_at timestamptz;

create or replace function public.close_pronostic_match(p_game_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.games%rowtype;
  v_match_id text;
  v_fh int;
  v_fa int;
  v_vote record;
  v_vh int;
  v_va int;
  v_ecart int;
  v_points int;
  v_updated int := 0;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_game from public.games where id = p_game_id for update;
  if not found then raise exception 'GAME_NOT_FOUND'; end if;

  if not exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role in ('org_admin', 'super_admin') and u.org_id = v_game.org_id
  ) then
    raise exception 'NOT_AUTHORIZED';
  end if;

  if v_game.type <> 'pronostic' then raise exception 'NOT_A_PRONOSTIC_GAME'; end if;
  if v_game.closed_at is not null then raise exception 'ALREADY_CLOSED'; end if;
  if v_game.content->>'score_domicile_final' is null or v_game.content->>'score_exterieur_final' is null then
    raise exception 'FINAL_SCORE_MISSING';
  end if;

  v_fh := (v_game.content->>'score_domicile_final')::int;
  v_fa := (v_game.content->>'score_exterieur_final')::int;
  v_match_id := coalesce(v_game.content->>'match_id', 'unknown');

  for v_vote in
    select * from public.pronostic_votes where match_id = v_match_id and org_id = v_game.org_id
  loop
    v_vh := split_part(v_vote.score, '-', 1)::int;
    v_va := split_part(v_vote.score, '-', 2)::int;
    v_ecart := abs(v_vh - v_fh) + abs(v_va - v_fa);
    v_points := greatest(0, 10 - v_ecart); -- barème : score exact = 10, -1 pt/point d'écart, plancher 0
    update public.users set pronostic_points = pronostic_points + v_points where id = v_vote.user_id;
    v_updated := v_updated + 1;
  end loop;

  update public.games set closed_at = now() where id = p_game_id;

  return jsonb_build_object('users_updated', v_updated);
end;
$$;
grant execute on function public.close_pronostic_match(uuid) to authenticated;

-- Vérification suggérée après exécution (avec un match de test ayant un score
-- final renseigné et au moins un pronostic_votes) :
-- select public.close_pronostic_match('<uuid-du-match>');
-- select id, name, pronostic_points from public.users order by pronostic_points desc;
-- select public.close_pronostic_match('<uuid-du-match>'); -- doit lever ALREADY_CLOSED
