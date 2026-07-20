-- Petite bio personnalisable sous le perso (100 caractères max, gratuite).
-- À exécuter dans Supabase Dashboard > SQL Editor.

alter table public.users
  add column if not exists bio text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'users_bio_length') then
    alter table public.users add constraint users_bio_length check (bio is null or length(bio) <= 100);
  end if;
end $$;

-- Colonne cosmétique : même traitement que name/avatar_*/worn_items
-- (grant additif, cf. 04_lock_down_users_table.sql / 06_avatar_dicebear.sql).
grant update (bio) on public.users to authenticated;
