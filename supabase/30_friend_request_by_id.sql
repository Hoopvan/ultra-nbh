-- Permet d'envoyer une demande d'ami directement depuis le classement
-- (Communauté), où on a l'id du fan mais pas son code perso (privé).
-- À exécuter dans Supabase Dashboard > SQL Editor, après 27_friends_system.sql.

create or replace function public.send_friend_request_by_id(p_target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_my_org uuid;
  v_target_org uuid;
  v_reverse public.friend_requests%rowtype;
  v_req public.friend_requests%rowtype;
begin
  if v_me is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_target_user_id = v_me then raise exception 'CANNOT_ADD_SELF'; end if;

  select org_id into v_my_org from public.users where id = v_me;
  select org_id into v_target_org from public.users where id = p_target_user_id;
  if v_target_org is null then raise exception 'USER_NOT_FOUND'; end if;
  if v_target_org <> v_my_org then raise exception 'DIFFERENT_ORG'; end if;

  if public.are_friends(v_me, p_target_user_id) then raise exception 'ALREADY_FRIENDS'; end if;

  if exists (
    select 1 from public.friend_requests
    where from_user = v_me and to_user = p_target_user_id and status = 'pending'
  ) then
    raise exception 'REQUEST_ALREADY_SENT';
  end if;

  -- L'autre m'a deja envoye une demande en attente -> auto-accept plutot qu'un doublon
  select * into v_reverse from public.friend_requests
    where from_user = p_target_user_id and to_user = v_me and status = 'pending'
    for update;
  if found then
    insert into public.friendships (org_id, user_a, user_b)
      values (v_my_org, least(v_me, p_target_user_id), greatest(v_me, p_target_user_id))
      on conflict do nothing;
    update public.friend_requests set status = 'accepted', responded_at = now() where id = v_reverse.id;
    return jsonb_build_object('auto_accepted', true);
  end if;

  insert into public.friend_requests (org_id, from_user, to_user)
    values (v_my_org, v_me, p_target_user_id)
    returning * into v_req;
  return jsonb_build_object('auto_accepted', false, 'request_id', v_req.id);
end;
$$;
grant execute on function public.send_friend_request_by_id(uuid) to authenticated;
