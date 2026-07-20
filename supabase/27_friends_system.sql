-- Système d'amis : code perso unique, demandes mutuelles, amitiés.
-- À exécuter dans Supabase Dashboard > SQL Editor.

-- ── 1. friend_codes ──────────────────────────────────────────────────────────
-- Table séparée de `users` (pas une colonne dessus) : la policy actuelle sur
-- `users` (users_select_same_org, migration 25) donne accès en lecture à toute
-- la ligne pour tout le club, sans granularité par colonne possible en RLS
-- Postgres. Un `friend_code` sur `users` serait donc scrapable par n'importe
-- quel membre de l'org, permettant de spammer des demandes sans consentement.
create table if not exists public.friend_codes (
  user_id    uuid primary key references public.users(id) on delete cascade,
  org_id     uuid not null references public.organizations(id),
  code       text not null unique,
  created_at timestamptz not null default now()
);

alter table public.friend_codes enable row level security;

drop policy if exists "friend_codes_select_own" on public.friend_codes;
create policy "friend_codes_select_own" on public.friend_codes
  for select to authenticated using (auth.uid() = user_id);

grant select on public.friend_codes to authenticated;
revoke insert, update, delete on public.friend_codes from authenticated;


-- ── 2. Génération du code ────────────────────────────────────────────────────
-- Alphabet 32 symboles sans caractères ambigus (0/O/1/I/L exclus), 8 caractères
-- → 32^8 ≈ 1.1×10^12 combinaisons, collision quasi jamais mais gérée par la boucle.
create or replace function public.generate_friend_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text;
  v_i int;
begin
  loop
    v_code := '';
    for v_i in 1..8 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.friend_codes where code = v_code);
  end loop;
  return v_code;
end;
$$;

create or replace function public.assign_friend_code(p_user_id uuid, p_org_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  v_code := public.generate_friend_code();
  insert into public.friend_codes (user_id, org_id, code) values (p_user_id, p_org_id, v_code)
    on conflict (user_id) do nothing;
  select code into v_code from public.friend_codes where user_id = p_user_id;
  return v_code;
end;
$$;

create or replace function public.get_my_friend_code()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select code from public.friend_codes where user_id = auth.uid();
$$;
grant execute on function public.get_my_friend_code() to authenticated;

-- Backfill : assigne un code à tous les users existants qui n'en ont pas encore
-- (comptes créés avant ce chantier).
do $$
declare r record;
begin
  for r in
    select u.id, u.org_id from public.users u
    where not exists (select 1 from public.friend_codes fc where fc.user_id = u.id)
  loop
    perform public.assign_friend_code(r.id, r.org_id);
  end loop;
end;
$$;


-- ── 3. create_profile : génère le code à la création du compte ──────────────
-- Même signature que la version de 16_multi_tenant_org.sql, CREATE OR REPLACE
-- pour ajouter l'appel à assign_friend_code sans changer l'interface.
CREATE OR REPLACE FUNCTION public.create_profile(
  p_name        text,
  p_skin        text,
  p_top         text DEFAULT 'shortFlat',
  p_hair_color  text DEFAULT 'brown',
  p_eyes        text DEFAULT 'default',
  p_mouth       text DEFAULT 'smile',
  p_facial_hair text DEFAULT '',
  p_clothe      text DEFAULT 'shirtCrewNeck',
  p_org_id      uuid DEFAULT '00000000-0000-0000-0000-000000000001'
)
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile public.users%rowtype;
  v_allowed_skin text[] := ARRAY['light','tanned','brown','darkBrown'];
  v_allowed_top  text[] := ARRAY[
    'shortFlat','sides','theCaesar','dreads01',
    'bigHair','bob','curly','straight02',
    'hijab','shavedSides','shortCurly','straight01','bandana','frizzle'
  ];
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF p_name IS NULL OR length(trim(p_name)) = 0 OR length(p_name) > 30 THEN
    RAISE EXCEPTION 'INVALID_NAME';
  END IF;
  IF NOT (p_skin = ANY(v_allowed_skin)) THEN RAISE EXCEPTION 'INVALID_SKIN'; END IF;
  IF NOT (p_top = ANY(v_allowed_top)) THEN RAISE EXCEPTION 'INVALID_TOP'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = p_org_id) THEN
    RAISE EXCEPTION 'INVALID_ORG';
  END IF;

  IF EXISTS (SELECT 1 FROM public.users WHERE id = v_user_id) THEN
    RAISE EXCEPTION 'PROFILE_ALREADY_EXISTS';
  END IF;

  INSERT INTO public.users (
    id, org_id, name, xp, coins, interactions, streak, last_play,
    active_items,
    avatar_skin, avatar_top, avatar_hair_color,
    avatar_eyes, avatar_mouth, avatar_facial_hair, avatar_clothe
  ) VALUES (
    v_user_id, p_org_id, trim(p_name), 0, 0, 0, 1, (now() AT TIME ZONE 'utc')::date,
    '["couleurs"]'::jsonb,
    p_skin, p_top, p_hair_color,
    p_eyes, p_mouth, p_facial_hair, p_clothe
  )
  RETURNING * INTO v_profile;

  PERFORM public.assign_friend_code(v_user_id, p_org_id);

  RETURN v_profile;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_profile(text, text, text, text, text, text, text, text, uuid) TO authenticated;


-- ── 4. friend_requests ───────────────────────────────────────────────────────
create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  from_user uuid not null references public.users(id) on delete cascade,
  to_user   uuid not null references public.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint friend_requests_no_self check (from_user <> to_user)
);

-- Défense en profondeur (en plus du check applicatif dans le RPC) : pas 2
-- demandes pending simultanées entre la même paire, peu importe le sens.
create unique index if not exists friend_requests_pending_pair_uniq
  on public.friend_requests (least(from_user, to_user), greatest(from_user, to_user))
  where status = 'pending';

alter table public.friend_requests enable row level security;

-- Contrairement à `users`, la visibilité d'une demande est restreinte aux deux
-- personnes concernées (pas à tout le club) : qui demande qui est sensible.
drop policy if exists "friend_requests_select_own" on public.friend_requests;
create policy "friend_requests_select_own" on public.friend_requests
  for select to authenticated
  using (org_id = public.my_org_id() and (from_user = auth.uid() or to_user = auth.uid()));

grant select on public.friend_requests to authenticated;
revoke insert, update, delete on public.friend_requests from authenticated;


-- ── 5. friendships ────────────────────────────────────────────────────────
-- Une ligne par paire, ordre canonique user_a < user_b pour dédupliquer.
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  user_a uuid not null references public.users(id) on delete cascade,
  user_b uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint friendships_order check (user_a < user_b),
  unique (user_a, user_b)
);

alter table public.friendships enable row level security;

drop policy if exists "friendships_select_own" on public.friendships;
create policy "friendships_select_own" on public.friendships
  for select to authenticated using (auth.uid() = user_a or auth.uid() = user_b);

grant select on public.friendships to authenticated;
revoke insert, update, delete on public.friendships from authenticated;

create or replace function public.are_friends(p1 uuid, p2 uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.friendships
    where user_a = least(p1, p2) and user_b = greatest(p1, p2)
  );
$$;
grant execute on function public.are_friends(uuid, uuid) to authenticated;


-- ── 6. RPCs demandes/amitiés ─────────────────────────────────────────────────

create or replace function public.send_friend_request(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_my_org uuid;
  v_target public.friend_codes%rowtype;
  v_reverse public.friend_requests%rowtype;
  v_req public.friend_requests%rowtype;
begin
  if v_me is null then raise exception 'AUTH_REQUIRED'; end if;
  select org_id into v_my_org from public.users where id = v_me;

  select * into v_target from public.friend_codes where code = upper(trim(p_code));
  if not found then raise exception 'CODE_NOT_FOUND'; end if;
  if v_target.user_id = v_me then raise exception 'CANNOT_ADD_SELF'; end if;
  if v_target.org_id <> v_my_org then raise exception 'DIFFERENT_ORG'; end if;

  if public.are_friends(v_me, v_target.user_id) then raise exception 'ALREADY_FRIENDS'; end if;

  if exists (
    select 1 from public.friend_requests
    where from_user = v_me and to_user = v_target.user_id and status = 'pending'
  ) then
    raise exception 'REQUEST_ALREADY_SENT';
  end if;

  -- L'autre m'a déjà envoyé une demande en attente → auto-accept plutôt qu'un doublon
  select * into v_reverse from public.friend_requests
    where from_user = v_target.user_id and to_user = v_me and status = 'pending'
    for update;
  if found then
    insert into public.friendships (org_id, user_a, user_b)
      values (v_my_org, least(v_me, v_target.user_id), greatest(v_me, v_target.user_id))
      on conflict do nothing;
    update public.friend_requests set status = 'accepted', responded_at = now() where id = v_reverse.id;
    return jsonb_build_object('auto_accepted', true);
  end if;

  insert into public.friend_requests (org_id, from_user, to_user)
    values (v_my_org, v_me, v_target.user_id)
    returning * into v_req;
  return jsonb_build_object('auto_accepted', false, 'request_id', v_req.id);
end;
$$;
grant execute on function public.send_friend_request(text) to authenticated;


create or replace function public.respond_friend_request(p_request_id uuid, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_req public.friend_requests%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_req from public.friend_requests
    where id = p_request_id and to_user = auth.uid() and status = 'pending'
    for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;

  if p_accept then
    insert into public.friendships (org_id, user_a, user_b)
      values (v_req.org_id, least(v_req.from_user, v_req.to_user), greatest(v_req.from_user, v_req.to_user))
      on conflict do nothing;
    update public.friend_requests set status = 'accepted', responded_at = now() where id = p_request_id;
  else
    update public.friend_requests set status = 'declined', responded_at = now() where id = p_request_id;
  end if;
  return jsonb_build_object('accepted', p_accept);
end;
$$;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;


create or replace function public.cancel_friend_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.friend_requests set status = 'cancelled', responded_at = now()
  where id = p_request_id and from_user = auth.uid() and status = 'pending';
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
end;
$$;
grant execute on function public.cancel_friend_request(uuid) to authenticated;


create or replace function public.remove_friend(p_friend_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.friendships
  where user_a = least(auth.uid(), p_friend_id) and user_b = greatest(auth.uid(), p_friend_id);
end;
$$;
grant execute on function public.remove_friend(uuid) to authenticated;

-- Vérification suggérée après exécution :
-- select code from public.friend_codes where user_id = auth.uid();
-- select * from public.friend_requests where from_user = auth.uid() or to_user = auth.uid();
-- select * from public.friendships where user_a = auth.uid() or user_b = auth.uid();
