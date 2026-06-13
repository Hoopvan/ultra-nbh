-- 10_fix_items_columns_jsonb.sql
-- active_items et worn_items étaient text[] mais la RPC buy_unlockable
-- les traite comme jsonb → erreur 42804 (datatype mismatch).
-- À exécuter dans Supabase Dashboard > SQL Editor

ALTER TABLE public.users
  ALTER COLUMN active_items DROP DEFAULT,
  ALTER COLUMN worn_items   DROP DEFAULT;

ALTER TABLE public.users
  ALTER COLUMN active_items TYPE jsonb USING to_jsonb(active_items),
  ALTER COLUMN worn_items   TYPE jsonb USING to_jsonb(worn_items);

ALTER TABLE public.users
  ALTER COLUMN active_items SET DEFAULT '[]'::jsonb,
  ALTER COLUMN worn_items   SET DEFAULT '[]'::jsonb;
