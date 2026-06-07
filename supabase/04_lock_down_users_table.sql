-- À exécuter dans Supabase Dashboard > SQL Editor
--
-- Dernière étape de la sécurisation : verrouiller les écritures directes
-- sur `users`. Jusqu'ici, même si toutes les missions passent par des
-- fonctions serveur, un client malveillant pouvait toujours :
--   - s'auto-créer un profil avec xp/coins/streak arbitraires (insert direct)
--   - se forger un streak énorme via update({streak: 9999})
--   - réécrire xp/coins/active_items/*_date directement via update(...)
--
-- On migre les deux derniers flux client → serveur (création de profil et
-- mise à jour du streak), puis on restreint les colonnes modifiables
-- directement aux seules colonnes cosmétiques.

-- ── CRÉATION DE PROFIL ─────────────────────────────────────────────────────
-- Remplace l'insert direct : les valeurs de départ (xp, coins, streak...)
-- sont désormais fixées côté serveur, pas choisies par le client.
create or replace function public.create_profile(
  p_name text,
  p_silhouette text,
  p_skin text,
  p_hair text
)
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.users%rowtype;
  v_allowed_sil text[] := array['A','B'];
  v_allowed_skin text[] := array['skin1','skin2','skin3','skin4'];
  v_allowed_hair text[] := array['hair1','hair2','hair3','hair4'];
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_name is null or length(trim(p_name)) = 0 or length(p_name) > 30 then
    raise exception 'INVALID_NAME';
  end if;
  if not (p_silhouette = any(v_allowed_sil)) then raise exception 'INVALID_SILHOUETTE'; end if;
  if not (p_skin = any(v_allowed_skin)) then raise exception 'INVALID_SKIN'; end if;
  if not (p_hair = any(v_allowed_hair)) then raise exception 'INVALID_HAIR'; end if;

  if exists (select 1 from public.users where id = v_user_id) then
    raise exception 'PROFILE_ALREADY_EXISTS';
  end if;

  insert into public.users (
    id, name, xp, coins, interactions, streak, last_play,
    active_items, avatar_silhouette, avatar_skin, avatar_hair
  ) values (
    v_user_id, trim(p_name), 0, 0, 0, 1, (now() at time zone 'utc')::date,
    '["couleurs"]'::jsonb, p_silhouette, p_skin, p_hair
  )
  returning * into v_profile;

  return v_profile;
end;
$$;
grant execute on function public.create_profile(text, text, text, text) to authenticated;


-- ── MISE À JOUR DU STREAK ──────────────────────────────────────────────────
-- Revalide la logique de `checkStreak()` côté serveur : le streak ne peut
-- progresser que d'un jour à la fois, sur la base de la date serveur.
create or replace function public.update_streak()
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := (now() at time zone 'utc')::date;
  v_profile public.users%rowtype;
  v_diff int;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_profile from public.users where id = v_user_id for update;
  if not found then raise exception 'PROFILE_NOT_FOUND'; end if;

  v_diff := v_today - v_profile.last_play;

  if v_diff = 1 then
    update public.users set streak = streak + 1, last_play = v_today
    where id = v_user_id returning * into v_profile;
  elsif v_diff > 1 then
    update public.users set streak = 1, last_play = v_today
    where id = v_user_id returning * into v_profile;
  end if;

  return v_profile;
end;
$$;
grant execute on function public.update_streak() to authenticated;


-- ── VERROUILLAGE DES COLONNES ──────────────────────────────────────────────
-- Le client garde le droit de lire/insérer/modifier sa ligne (RLS), mais on
-- restreint les colonnes qu'un `update`/`insert` direct peut toucher aux
-- seules colonnes cosmétiques. Tout le reste (xp, coins, streak, *_date,
-- active_items, interactions, pronostic_score, boite_last_result...) ne
-- peut plus être écrit que par les fonctions SECURITY DEFINER ci-dessus
-- et dans 01_*/02_*/03_*.sql, qui s'exécutent avec les droits du propriétaire
-- de la table et ne sont donc pas concernées par ce REVOKE.

revoke insert, update on public.users from authenticated;

grant update (
  name, avatar_silhouette, avatar_skin, avatar_hair, worn_items
) on public.users to authenticated;

-- Active RLS si ce n'est pas déjà fait, et pose des politiques minimales :
-- chacun peut lire toutes les lignes (classement, tribune) mais ne peut
-- modifier QUE la sienne (et seulement les colonnes autorisées ci-dessus).
alter table public.users enable row level security;

drop policy if exists "users_select_all" on public.users;
create policy "users_select_all" on public.users
  for select to authenticated using (true);

drop policy if exists "users_update_own" on public.users;
create policy "users_update_own" on public.users
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- deleteAccount() supprime directement sa propre ligne avant de fermer le
-- compte auth — il faut une politique explicite sinon l'activation de RLS
-- la bloquerait silencieusement.
drop policy if exists "users_delete_own" on public.users;
create policy "users_delete_own" on public.users
  for delete to authenticated
  using (auth.uid() = id);
