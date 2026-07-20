-- Échange de cartes entre amis. À exécuter dans Supabase Dashboard > SQL Editor,
-- après 27_friends_system.sql.
--
-- Périmètre volontairement limité : on ajoute la policy SELECT manquante sur
-- `user_cards` (self-ou-ami) et on sécurise l'échange par RPC transactionnel,
-- mais on NE révoque PAS insert/update côté client sur `user_cards` — js/cards.js
-- (ouverture de boosters) écrit encore directement dessus, et migrer tout le
-- tirage pondéré en SQL est un chantier séparé, plus risqué, hors périmètre
-- "amis". Un client malveillant peut donc toujours contourner l'échange en
-- écrivant directement sur user_cards — trou préexistant, pas aggravé ici.

-- ── 1. Dédoublonnage défensif + contrainte d'unicité ────────────────────────
-- `persistDrawnCards` (js/cards.js) fait un check-then-insert-or-update non
-- atomique côté client → possible que des doublons (user_id, card_id) existent
-- déjà en base suite à une race condition. On les fusionne avant de contraindre.
with dups as (
  select user_id, card_id, sum(count) as total, min(ctid) as keep_ctid
  from public.user_cards
  group by user_id, card_id
  having count(*) > 1
)
update public.user_cards uc set count = d.total
from dups d
where uc.ctid = d.keep_ctid;

delete from public.user_cards uc
using (
  select user_id, card_id, min(ctid) as keep_ctid
  from public.user_cards
  group by user_id, card_id
  having count(*) > 1
) d
where uc.user_id = d.user_id and uc.card_id = d.card_id and uc.ctid <> d.keep_ctid;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'user_cards_user_card_uniq') then
    alter table public.user_cards add constraint user_cards_user_card_uniq unique (user_id, card_id);
  end if;
end $$;


-- ── 2. Policy SELECT manquante sur user_cards (comble la dette d'audit) ─────
alter table public.user_cards enable row level security;

drop policy if exists "user_cards_select_self_or_friend" on public.user_cards;
create policy "user_cards_select_self_or_friend" on public.user_cards
  for select to authenticated
  using (org_id = public.my_org_id() and (user_id = auth.uid() or public.are_friends(auth.uid(), user_id)));


-- ── 3. card_trades ────────────────────────────────────────────────────────
create table if not exists public.card_trades (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  from_user uuid not null references public.users(id) on delete cascade,
  to_user   uuid not null references public.users(id) on delete cascade,
  from_card_id text not null references public.cards(id) on delete cascade,
  to_card_id   text not null references public.cards(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint card_trades_no_self check (from_user <> to_user)
);

alter table public.card_trades enable row level security;

drop policy if exists "card_trades_select_own" on public.card_trades;
create policy "card_trades_select_own" on public.card_trades
  for select to authenticated
  using (org_id = public.my_org_id() and (from_user = auth.uid() or to_user = auth.uid()));

grant select on public.card_trades to authenticated;
revoke insert, update, delete on public.card_trades from authenticated;


-- ── 4. RPCs échange ──────────────────────────────────────────────────────────

create or replace function public.propose_card_trade(p_to_user uuid, p_from_card_id text, p_to_card_id text)
returns public.card_trades
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_org uuid;
  v_from_count int;
  v_to_count int;
  v_trade public.card_trades%rowtype;
begin
  if v_me is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_to_user = v_me then raise exception 'CANNOT_TRADE_SELF'; end if;
  if p_from_card_id = p_to_card_id then raise exception 'SAME_CARD'; end if;
  if not public.are_friends(v_me, p_to_user) then raise exception 'NOT_FRIENDS'; end if;

  select org_id into v_org from public.users where id = v_me;

  select count into v_from_count from public.user_cards where user_id = v_me and card_id = p_from_card_id;
  if coalesce(v_from_count, 0) < 1 then raise exception 'CARD_NOT_OWNED'; end if;

  select count into v_to_count from public.user_cards where user_id = p_to_user and card_id = p_to_card_id;
  if coalesce(v_to_count, 0) < 1 then raise exception 'TARGET_CARD_NOT_OWNED'; end if;

  if not exists (select 1 from public.cards where id = p_from_card_id and org_id = v_org)
     or not exists (select 1 from public.cards where id = p_to_card_id and org_id = v_org) then
    raise exception 'CARD_NOT_IN_ORG';
  end if;

  insert into public.card_trades (org_id, from_user, to_user, from_card_id, to_card_id)
  values (v_org, v_me, p_to_user, p_from_card_id, p_to_card_id)
  returning * into v_trade;
  return v_trade;
end;
$$;
grant execute on function public.propose_card_trade(uuid, text, text) to authenticated;


create or replace function public.respond_card_trade(p_trade_id uuid, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trade public.card_trades%rowtype;
  v_from_row public.user_cards%rowtype;
  v_to_row public.user_cards%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_trade from public.card_trades
    where id = p_trade_id and to_user = auth.uid() and status = 'pending'
    for update;
  if not found then raise exception 'TRADE_NOT_FOUND'; end if;

  if not p_accept then
    update public.card_trades set status = 'declined', responded_at = now() where id = p_trade_id;
    return jsonb_build_object('accepted', false);
  end if;

  if not public.are_friends(v_trade.from_user, v_trade.to_user) then
    update public.card_trades set status = 'cancelled', responded_at = now() where id = p_trade_id;
    raise exception 'NOT_FRIENDS_ANYMORE';
  end if;

  -- Verrous + revérification : gère le cas où l'un des deux n'a plus la carte
  -- au moment d'accepter (revendue, échangée ailleurs entre-temps, etc.)
  select * into v_from_row from public.user_cards
    where user_id = v_trade.from_user and card_id = v_trade.from_card_id for update;
  if not found or v_from_row.count < 1 then
    update public.card_trades set status = 'cancelled', responded_at = now() where id = p_trade_id;
    raise exception 'FROM_CARD_NO_LONGER_OWNED';
  end if;

  select * into v_to_row from public.user_cards
    where user_id = v_trade.to_user and card_id = v_trade.to_card_id for update;
  if not found or v_to_row.count < 1 then
    update public.card_trades set status = 'cancelled', responded_at = now() where id = p_trade_id;
    raise exception 'TO_CARD_NO_LONGER_OWNED';
  end if;

  update public.user_cards set count = count - 1
    where user_id = v_trade.from_user and card_id = v_trade.from_card_id;
  delete from public.user_cards where user_id = v_trade.from_user and card_id = v_trade.from_card_id and count <= 0;
  insert into public.user_cards (user_id, card_id, count, org_id)
    values (v_trade.from_user, v_trade.to_card_id, 1, v_trade.org_id)
    on conflict (user_id, card_id) do update set count = public.user_cards.count + 1;

  update public.user_cards set count = count - 1
    where user_id = v_trade.to_user and card_id = v_trade.to_card_id;
  delete from public.user_cards where user_id = v_trade.to_user and card_id = v_trade.to_card_id and count <= 0;
  insert into public.user_cards (user_id, card_id, count, org_id)
    values (v_trade.to_user, v_trade.from_card_id, 1, v_trade.org_id)
    on conflict (user_id, card_id) do update set count = public.user_cards.count + 1;

  update public.card_trades set status = 'accepted', responded_at = now() where id = p_trade_id;
  return jsonb_build_object('accepted', true);
end;
$$;
grant execute on function public.respond_card_trade(uuid, boolean) to authenticated;


create or replace function public.cancel_card_trade(p_trade_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.card_trades set status = 'cancelled', responded_at = now()
  where id = p_trade_id and from_user = auth.uid() and status = 'pending';
  if not found then raise exception 'TRADE_NOT_FOUND'; end if;
end;
$$;
grant execute on function public.cancel_card_trade(uuid) to authenticated;

-- Vérification suggérée après exécution (avec 2 comptes de test amis, ayant
-- chacun au moins une carte) :
-- select public.propose_card_trade('<uuid-ami>', '<ma-carte-id>', '<sa-carte-id>');
-- select public.respond_card_trade('<uuid-trade>', true);
-- select * from public.user_cards where user_id in ('<moi>','<ami>');
