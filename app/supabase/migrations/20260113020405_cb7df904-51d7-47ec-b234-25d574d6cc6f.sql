-- Create storage bucket for patient images
INSERT INTO storage.buckets (id, name, public)
VALUES ('patient-images', 'patient-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own images
CREATE POLICY "Users can upload patient images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'patient-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to view their own images
CREATE POLICY "Users can view their own patient images"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'patient-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow public access to patient images (since bucket is public)
CREATE POLICY "Public can view patient images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'patient-images');

-- Allow users to delete their own images
CREATE POLICY "Users can delete their own patient images"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'patient-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);