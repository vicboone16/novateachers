
-- Backfill student names
UPDATE public.classroom_group_students SET first_name = 'Aiden', last_name = 'M' WHERE client_id = '00000000-0000-4000-a000-000000000100' AND first_name IS NULL;
UPDATE public.classroom_group_students SET first_name = 'Bella', last_name = 'R' WHERE client_id = '00000000-0000-4000-a000-000000000101' AND first_name IS NULL;
UPDATE public.classroom_group_students SET first_name = 'Carlos', last_name = 'G' WHERE client_id = '00000000-0000-4000-a000-000000000102' AND first_name IS NULL;
UPDATE public.classroom_group_students SET first_name = 'Daisy', last_name = 'P' WHERE client_id = '00000000-0000-4000-a000-000000000103' AND first_name IS NULL;
UPDATE public.classroom_group_students SET first_name = 'Ethan', last_name = 'W' WHERE client_id = '00000000-0000-4000-a000-000000000104' AND first_name IS NULL;
UPDATE public.classroom_group_students SET first_name = 'Fiona', last_name = 'L' WHERE client_id = '00000000-0000-4000-a000-000000000105' AND first_name IS NULL;
UPDATE public.classroom_group_students SET first_name = 'George', last_name = 'K' WHERE client_id = '00000000-0000-4000-a000-000000000106' AND first_name IS NULL;
UPDATE public.classroom_group_students SET first_name = 'Harper', last_name = 'J' WHERE client_id = '00000000-0000-4000-a000-000000000107' AND first_name IS NULL;
UPDATE public.classroom_group_students SET first_name = 'Aiden', last_name = 'M' WHERE client_id = 'fe695966-9bac-43f3-8bde-50666c029942' AND first_name IS NULL;
UPDATE public.classroom_group_students SET first_name = 'Bella', last_name = 'R' WHERE client_id = 'd984726d-459e-4a1e-bf76-eefee91425d1' AND first_name IS NULL;
UPDATE public.classroom_group_students SET first_name = 'Carlos', last_name = 'G' WHERE client_id = '404cd7fb-6253-46fd-9b36-cc5a6062d1af' AND first_name IS NULL;
UPDATE public.classroom_group_students SET first_name = 'Daisy', last_name = 'P' WHERE client_id = '61e60eae-67cc-483f-a174-f6a29ada926f' AND first_name IS NULL;
UPDATE public.classroom_group_students SET first_name = 'Ethan', last_name = 'W' WHERE client_id = '3f0f81a8-c139-4420-9620-05378077c653' AND first_name IS NULL;
UPDATE public.classroom_group_students SET first_name = 'Fiona', last_name = 'L' WHERE client_id = '3a188434-985c-4bbf-98dd-756f41d397c2' AND first_name IS NULL;
UPDATE public.classroom_group_students SET first_name = 'George', last_name = 'K' WHERE client_id = '66d95536-b442-485d-b3a0-23c70d390c29' AND first_name IS NULL;
UPDATE public.classroom_group_students SET first_name = 'Harper', last_name = 'J' WHERE client_id = '62ebcb2b-3ef5-47f9-ab1a-8cacd6c7359e' AND first_name IS NULL;

-- Create test parent link
INSERT INTO public.parent_access_links (student_id, agency_id, token, is_active)
VALUES (
  '00000000-0000-4000-a000-000000000100',
  (SELECT agency_id FROM public.classroom_group_students WHERE client_id = '00000000-0000-4000-a000-000000000100' LIMIT 1),
  'test-parent-aiden-2026',
  true
);
