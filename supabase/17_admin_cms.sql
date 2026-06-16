-- CMS Admin : rôle utilisateur + accès écriture games pour org_admin
-- À exécuter dans Supabase Dashboard > SQL Editor

-- ── 1. RÔLE SUR LA TABLE USERS ────────────────────────────────────────────

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'fan'
  CHECK (role IN ('fan', 'org_admin', 'super_admin'));

-- Note : 'role' n'est pas dans le GRANT UPDATE de la table users (cf. migration 04/06),
-- donc les utilisateurs ne peuvent pas modifier leur propre rôle via l'API.

-- ── 2. ACCÈS ÉCRITURE SUR games POUR authenticated ────────────────────────

-- Migration 05 avait révoqué INSERT/UPDATE/DELETE — on les rétablit.
-- La politique RLS ci-dessous restreint ces opérations aux org_admins uniquement.
GRANT INSERT, UPDATE, DELETE ON public.games TO authenticated;

-- ── 3. POLITIQUE RLS ADMIN WRITE ──────────────────────────────────────────

DROP POLICY IF EXISTS "games_admin_write" ON public.games;
CREATE POLICY "games_admin_write" ON public.games
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('org_admin', 'super_admin')
        AND u.org_id = games.org_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('org_admin', 'super_admin')
        AND u.org_id = games.org_id
    )
  );

-- ── Pour tester : attribuer le rôle admin à un utilisateur ────────────────
-- UPDATE public.users SET role = 'org_admin' WHERE id = 'votre-user-uuid';
