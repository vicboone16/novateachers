-- Rename "Test Classroom E2E" to "Minecraft Mode"
UPDATE classroom_groups SET name = 'Minecraft Mode', updated_at = now() WHERE group_id = '051aa018-2190-4e29-b143-805fce616d74';

-- Create "Peanut Gallery" classroom group
INSERT INTO classroom_groups (agency_id, name, created_by)
VALUES ('00000000-0000-4000-a000-000000000001', 'Peanut Gallery', '00000000-0000-4000-a000-000000000001')
ON CONFLICT DO NOTHING;