-- Corrige la suppression de compte : deleteAccount() (js/auth.js) appelle
-- db.rpc('delete_user') depuis le début, mais cette fonction n'a jamais été
-- créée côté serveur. L'appel échouait silencieusement (le client ne
-- vérifiait pas l'erreur), donc "Supprimer mon compte" se contentait en
-- pratique de déconnecter : le profil public.users était bien supprimé
-- (delete direct autorisé par RLS), mais le compte Auth (auth.users)
-- restait — orphelin, ré-utilisable pour se reconnecter comme si de rien
-- n'était.
--
-- Cette fonction centralise toute la suppression côté serveur (SECURITY
-- DEFINER, bypass RLS) : nettoie les tables qui référencent auth.users
-- directement et ne sont donc pas couvertes par le ON DELETE CASCADE de
-- public.users (pronostic_votes, boite_winners, user_cards,
-- push_subscriptions), supprime la ligne public.users (cascade vers
-- friend_codes/friend_requests/friendships/card_trades, cf. 27/28), puis
-- supprime le compte auth.users lui-même.
-- À exécuter dans Supabase Dashboard > SQL Editor.

create or replace function public.delete_user()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;

  delete from public.pouls_votes where user_id = v_user_id;
  delete from public.pronostic_votes where user_id = v_user_id;
  delete from public.boite_winners where user_id = v_user_id;
  delete from public.user_cards where user_id = v_user_id;
  delete from public.push_subscriptions where user_id = v_user_id;
  delete from public.users where id = v_user_id;
  delete from auth.users where id = v_user_id;
end;
$$;

grant execute on function public.delete_user() to authenticated;
