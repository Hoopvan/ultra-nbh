-- Isolation multi-tenant des cartes à collectionner (boosters).
-- cards/user_cards existent déjà en base (créées hors migrations trackées,
-- via Supabase Studio) mais n'ont jamais eu de org_id : tous les clubs
-- partageaient le même pool de cartes NBH.
-- À exécuter dans Supabase Dashboard > SQL Editor

-- ── 1. org_id sur cards ────────────────────────────────────────────────────
ALTER TABLE public.cards
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id)
  DEFAULT '00000000-0000-0000-0000-000000000001';
UPDATE public.cards SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;

-- ── 2. org_id sur user_cards (cohérent avec pouls_votes/pronostic_votes) ────
ALTER TABLE public.user_cards
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id)
  DEFAULT '00000000-0000-0000-0000-000000000001';
UPDATE public.user_cards SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;

-- ── 3. Cartes démo génériques (org "demo") ───────────────────────────────────
-- Mêmes noms que la mission photo_mystere du 08/07 pour rester cohérent.
INSERT INTO public.cards (id, org_id, player_name, position, rarity, team, sort_order, photo_url, active) VALUES
  ('demo_alex_martin',  '00000000-0000-0000-0000-000000000002', 'Alex Martin',  'Ailier',  'gold',   'pro', 0, '', true),
  ('demo_sacha_dubois', '00000000-0000-0000-0000-000000000002', 'Sacha Dubois', 'Meneur',  'silver', 'pro', 1, '', true),
  ('demo_camille_rey',  '00000000-0000-0000-0000-000000000002', 'Camille Rey',  'Pivot',   'bronze', 'pro', 2, '', true)
ON CONFLICT (id) DO NOTHING;

-- ── 4. À vérifier manuellement (hors périmètre de cette migration) ─────────
-- delete_card_admin() est une fonction RPC qui n'existe dans aucune migration
-- trackée (créée directement via Supabase Studio). Son code actuel n'est pas
-- visible depuis le repo — vérifier qu'elle ne permet pas à un admin d'un
-- org de supprimer la carte d'un autre org (filtrer par org_id côté SQL).
-- Idem pour les policies RLS de cards/user_cards : leur état actuel n'est
-- pas connu depuis le repo, à auditer dans Database > Policies.
