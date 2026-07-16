-- Corrige delete_card_admin() : la fonction (créée hors migrations
-- trackées, via Supabase Studio) a son paramètre p_card_id déclaré en
-- uuid, alors que cards.id est un identifiant texte généré côté client
-- (js/admin.js saveCard() : `${slug}_${Date.now()}`). Résultat :
-- "invalid input syntax for type uuid" dès qu'on essaie de supprimer
-- une carte créée depuis le CMS.
--
-- Au passage, ajoute le filtrage par org qui manquait (audit sécurité,
-- point non résolu : un admin pouvait potentiellement supprimer la
-- carte d'un autre club) et restreint l'exécution aux org_admin/super_admin
-- de l'org propriétaire de la carte, comme games_admin_write (migration 17).
-- À exécuter dans Supabase Dashboard > SQL Editor

drop function if exists public.delete_card_admin(uuid);
drop function if exists public.delete_card_admin(text);

create or replace function public.delete_card_admin(p_card_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_card public.cards%rowtype;
begin
  select * into v_card from public.cards where id = p_card_id;
  if not found then
    raise exception 'CARD_NOT_FOUND';
  end if;

  if not exists (
    select 1 from public.users u
    where u.id = auth.uid()
      and u.role in ('org_admin', 'super_admin')
      and u.org_id = v_card.org_id
  ) then
    raise exception 'NOT_AUTHORIZED';
  end if;

  delete from public.user_cards where card_id = p_card_id;
  delete from public.cards where id = p_card_id;
end;
$$;
grant execute on function public.delete_card_admin(text) to authenticated;
