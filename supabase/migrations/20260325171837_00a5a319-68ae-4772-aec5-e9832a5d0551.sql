-- Add name columns to classroom_group_students for public board name resolution
ALTER TABLE public.classroom_group_students 
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text;