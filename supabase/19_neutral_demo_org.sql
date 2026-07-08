-- Org neutre "demo" (référence Design/Font and colors.txt) pour tester le
-- mécanisme white-label multi-org, sans toucher à la config NBH existante.
-- À exécuter dans Supabase Dashboard > SQL Editor

-- ── 1. Colonne manquante : bg_color était déjà lue par js/config.js
--       (loadOrgConfig) mais jamais ajoutée au schéma par la migration 16.

ALTER TABLE public.org_config ADD COLUMN IF NOT EXISTS bg_color TEXT;

-- ── 2. Org neutre "demo" ──────────────────────────────────────────────────

INSERT INTO public.organizations (id, slug, name, sport, country)
VALUES ('00000000-0000-0000-0000-000000000002', 'demo', 'HoopFan Démo', 'basketball', 'FR')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.org_config (
  org_id, primary_color, secondary_color, accent_color, bg_color,
  app_name, tagline, home_city, default_lang, features_enabled
) VALUES (
  '00000000-0000-0000-0000-000000000002',
  '#e8593d', '#1e3a8a', '#8b2f3f', '#f4e3c1',
  'HoopFan', 'Ton compagnon fan au quotidien', NULL, 'fr',
  '{"pouls":true,"vestiaire":true,"anecdote":true,"nantes_nbh":false,"avant_apres":true,"pronostic":true,"boite_mystere":true,"timeline":true,"photo_mystere":true}'::jsonb
)
ON CONFLICT (org_id) DO NOTHING;
