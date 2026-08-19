-- Make the patient-images bucket private to protect PHI
UPDATE storage.buckets 
SET public = false 
WHERE id = 'patient-images';

-- Drop the overly permissive public access policy
DROP POLICY IF EXISTS "Public can view patient images" ON storage.objects;