-- Remove "Successful Transition" action
DELETE FROM public.teacher_point_actions WHERE id = '335b2fc3-b170-4e35-8328-589556c06605';

-- Rename "Participation" to "Model Behavior"
UPDATE public.teacher_point_actions 
SET action_label = 'Model Behavior +2'
WHERE id = 'f7c85167-0aef-494a-9baf-ffd875185246';