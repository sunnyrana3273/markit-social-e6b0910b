-- Update storage policies to allow discussions folder structure
-- The path structure is: discussions/{userId}/{filename}

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can upload their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;

-- Create updated storage policies that support both direct user folders and discussions subfolder
CREATE POLICY "Users can upload their own files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'user-uploads' AND (
    -- Allow direct user folder: {userId}/{filename}
    (storage.foldername(name))[1] = auth.uid()::text OR
    -- Allow discussions folder: discussions/{userId}/{filename}
    ((storage.foldername(name))[1] = 'discussions' AND (storage.foldername(name))[2] = auth.uid()::text)
  )
);

CREATE POLICY "Users can view their own files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'user-uploads' AND (
    -- Allow direct user folder: {userId}/{filename}
    (storage.foldername(name))[1] = auth.uid()::text OR
    -- Allow discussions folder: discussions/{userId}/{filename}
    ((storage.foldername(name))[1] = 'discussions' AND (storage.foldername(name))[2] = auth.uid()::text) OR
    -- Allow viewing files in discussions folder (for community members to see attachments)
    (storage.foldername(name))[1] = 'discussions'
  )
);

CREATE POLICY "Users can update their own files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'user-uploads' AND (
    -- Allow direct user folder: {userId}/{filename}
    (storage.foldername(name))[1] = auth.uid()::text OR
    -- Allow discussions folder: discussions/{userId}/{filename}
    ((storage.foldername(name))[1] = 'discussions' AND (storage.foldername(name))[2] = auth.uid()::text)
  )
);

CREATE POLICY "Users can delete their own files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'user-uploads' AND (
    -- Allow direct user folder: {userId}/{filename}
    (storage.foldername(name))[1] = auth.uid()::text OR
    -- Allow discussions folder: discussions/{userId}/{filename}
    ((storage.foldername(name))[1] = 'discussions' AND (storage.foldername(name))[2] = auth.uid()::text)
  )
);

