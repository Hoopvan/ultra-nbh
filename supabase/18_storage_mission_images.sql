-- Bucket Supabase Storage pour les images des missions
-- À exécuter dans Supabase Dashboard > SQL Editor

-- ── 1. BUCKET PUBLIC ──────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'mission-images',
  'mission-images',
  true,
  5242880,  -- 5 Mo max
  '{image/jpeg,image/png,image/webp,image/gif}'
)
ON CONFLICT (id) DO NOTHING;

-- ── 2. POLITIQUES RLS ─────────────────────────────────────────────────────

-- Lecture publique (les images s'affichent dans l'app sans auth)
DROP POLICY IF EXISTS "mission_images_public_read" ON storage.objects;
CREATE POLICY "mission_images_public_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'mission-images');

-- Upload réservé aux org_admin
DROP POLICY IF EXISTS "mission_images_admin_upload" ON storage.objects;
CREATE POLICY "mission_images_admin_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'mission-images'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role IN ('org_admin', 'super_admin')
    )
  );

-- Suppression réservée aux org_admin
DROP POLICY IF EXISTS "mission_images_admin_delete" ON storage.objects;
CREATE POLICY "mission_images_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'mission-images'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role IN ('org_admin', 'super_admin')
    )
  );
