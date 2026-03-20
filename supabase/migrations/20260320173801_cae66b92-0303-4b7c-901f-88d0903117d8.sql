
-- Add staff_role column to classroom_group_teachers
ALTER TABLE public.classroom_group_teachers
ADD COLUMN IF NOT EXISTS staff_role text NOT NULL DEFAULT 'teacher';

-- Drop the unique constraint on (group_id, user_id) to allow same user with different roles
-- First find and drop the existing unique constraint
DO $$
BEGIN
  -- Try dropping the common constraint names
  BEGIN
    ALTER TABLE public.classroom_group_teachers DROP CONSTRAINT IF EXISTS classroom_group_teachers_group_id_user_id_key;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.classroom_group_teachers DROP CONSTRAINT IF EXISTS unique_group_user;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- Add a new unique constraint on (group_id, user_id, staff_role) to prevent exact duplicates
ALTER TABLE public.classroom_group_teachers
ADD CONSTRAINT classroom_group_teachers_group_user_role_key UNIQUE (group_id, user_id, staff_role);
