-- Corrige "users_select_all" (migration 04) : n'importe quel utilisateur
-- authentifié pouvait lire TOUTES les lignes de `users`, tous clubs
-- confondus (xp, coins, streak, name...), via l'API Supabase directe,
-- indépendamment du filtre org_id appliqué côté client dans community.js.
-- À exécuter dans Supabase Dashboard > SQL Editor

-- Fonction SECURITY DEFINER pour éviter la récursion RLS : une policy sur
-- `users` qui interroge `users` pour trouver l'org de l'appelant boucle
-- sur elle-même si elle passe par le chemin normal (soumis à la même RLS).
-- Le SECURITY DEFINER fait tourner cette lecture avec les droits du
-- propriétaire de la fonction, hors RLS.
create or replace function public.my_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from public.users where id = auth.uid();
$$;
grant execute on function public.my_org_id() to authenticated;

drop policy if exists "users_select_all" on public.users;
drop policy if exists "users_select_same_org" on public.users;
create policy "users_select_same_org" on public.users
  for select to authenticated
  using (org_id = public.my_org_id());
