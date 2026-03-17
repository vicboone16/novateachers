
-- Drop existing policies (all possible names)
DROP POLICY IF EXISTS "Users can read own IEP files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own IEP files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read IEP files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload IEP files" ON storage.objects;

-- Recreate with proper scoping
CREATE POLICY "Users can read own IEP files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'iep-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can upload own IEP files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'iep-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Fix set_updated_at function: set search_path
CREATE OR REPLACE FUNCTION public.set_updated_at()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = public
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;
