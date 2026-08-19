-- Patient images may contain PHI. Keep the bucket private, constrain uploads,
-- and require every object path to begin with the authenticated owner's id.
INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'patient-images',
  'patient-images',
  false,
  10485760,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public can view patient images" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload patient images" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own patient images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own patient images" ON storage.objects;

CREATE POLICY "Users can upload patient images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'patient-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own patient images"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'patient-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own patient images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'patient-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
