
-- Clean up test data: delete child records first, then the group
DELETE FROM classroom_group_students WHERE group_id = '636a0bae-40f5-4ac7-8468-ec2bd2ef4a93';
DELETE FROM classroom_group_teachers WHERE group_id = '636a0bae-40f5-4ac7-8468-ec2bd2ef4a93';
DELETE FROM classroom_groups WHERE group_id = '636a0bae-40f5-4ac7-8468-ec2bd2ef4a93';
