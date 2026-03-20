
-- ============================================================
-- FIX ALL auth.uid() RLS POLICIES
-- Users authenticate via Nova Core, NOT Lovable Cloud auth.
-- auth.uid() is always NULL on Cloud. Replace with permissive
-- policies since access control is enforced at app level.
-- ============================================================

-- 1. abc_logs
DROP POLICY IF EXISTS "Users can delete own abc logs" ON public.abc_logs;
DROP POLICY IF EXISTS "Users can insert own abc logs" ON public.abc_logs;
DROP POLICY IF EXISTS "Users can read own abc logs" ON public.abc_logs;
DROP POLICY IF EXISTS "Users can update own abc logs" ON public.abc_logs;
CREATE POLICY "Open read abc_logs" ON public.abc_logs FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Open insert abc_logs" ON public.abc_logs FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Open update abc_logs" ON public.abc_logs FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "Open delete abc_logs" ON public.abc_logs FOR DELETE TO anon, authenticated USING (true);

-- 2. agency_invite_codes
DROP POLICY IF EXISTS "Users can create agency invite codes" ON public.agency_invite_codes;
DROP POLICY IF EXISTS "Creator can select agency invite codes" ON public.agency_invite_codes;
DROP POLICY IF EXISTS "Creator can update agency invite codes" ON public.agency_invite_codes;
CREATE POLICY "Open read agency_invite_codes" ON public.agency_invite_codes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Open insert agency_invite_codes" ON public.agency_invite_codes FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Open update agency_invite_codes" ON public.agency_invite_codes FOR UPDATE TO anon, authenticated USING (true);

-- 3. beacon_classroom_templates
DROP POLICY IF EXISTS "Authenticated can manage classroom templates" ON public.beacon_classroom_templates;
CREATE POLICY "Open all beacon_classroom_templates" ON public.beacon_classroom_templates FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 4. beacon_points_ledger
DROP POLICY IF EXISTS "Staff can delete own point entries" ON public.beacon_points_ledger;
DROP POLICY IF EXISTS "Staff can insert own point entries" ON public.beacon_points_ledger;
CREATE POLICY "Open insert beacon_points_ledger" ON public.beacon_points_ledger FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Open delete beacon_points_ledger" ON public.beacon_points_ledger FOR DELETE TO anon, authenticated USING (true);

-- 5. beacon_reinforcement_templates
DROP POLICY IF EXISTS "Creator can manage custom templates" ON public.beacon_reinforcement_templates;
CREATE POLICY "Open all custom beacon_reinforcement_templates" ON public.beacon_reinforcement_templates FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 6. behavior_categories
DROP POLICY IF EXISTS "Users can delete own behavior categories" ON public.behavior_categories;
DROP POLICY IF EXISTS "Users can insert own behavior categories" ON public.behavior_categories;
DROP POLICY IF EXISTS "Users can read own behavior categories" ON public.behavior_categories;
DROP POLICY IF EXISTS "Users can update own behavior categories" ON public.behavior_categories;
CREATE POLICY "Open read behavior_categories" ON public.behavior_categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Open insert behavior_categories" ON public.behavior_categories FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Open update behavior_categories" ON public.behavior_categories FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "Open delete behavior_categories" ON public.behavior_categories FOR DELETE TO anon, authenticated USING (true);

-- 7. classroom_feed_posts
DROP POLICY IF EXISTS "Author can manage own posts" ON public.classroom_feed_posts;
DROP POLICY IF EXISTS "Classroom members can read posts" ON public.classroom_feed_posts;
CREATE POLICY "Open read classroom_feed_posts" ON public.classroom_feed_posts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Open insert classroom_feed_posts" ON public.classroom_feed_posts FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Open update classroom_feed_posts" ON public.classroom_feed_posts FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "Open delete classroom_feed_posts" ON public.classroom_feed_posts FOR DELETE TO anon, authenticated USING (true);

-- 8. classroom_group_students
DROP POLICY IF EXISTS "Group members can remove students" ON public.classroom_group_students;
DROP POLICY IF EXISTS "Group members can add students" ON public.classroom_group_students;
CREATE POLICY "Open insert classroom_group_students" ON public.classroom_group_students FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Open delete classroom_group_students" ON public.classroom_group_students FOR DELETE TO anon, authenticated USING (true);

-- 9. classroom_group_teachers (already has open insert/select, fix delete)
DROP POLICY IF EXISTS "Group creator or self can remove teachers" ON public.classroom_group_teachers;
CREATE POLICY "Open delete classroom_group_teachers" ON public.classroom_group_teachers FOR DELETE TO anon, authenticated USING (true);

-- 10. default_reminder_schedules
DROP POLICY IF EXISTS "Users can delete user-scoped reminder schedules they own" ON public.default_reminder_schedules;
DROP POLICY IF EXISTS "Users can insert user-scoped reminder schedules they own" ON public.default_reminder_schedules;
DROP POLICY IF EXISTS "Users can update user-scoped reminder schedules they own" ON public.default_reminder_schedules;
CREATE POLICY "Open insert default_reminder_schedules" ON public.default_reminder_schedules FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Open update default_reminder_schedules" ON public.default_reminder_schedules FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "Open delete default_reminder_schedules" ON public.default_reminder_schedules FOR DELETE TO anon, authenticated USING (true);

-- 11. guest_access_codes
DROP POLICY IF EXISTS "Creator can insert guest codes" ON public.guest_access_codes;
DROP POLICY IF EXISTS "Creator can select guest codes" ON public.guest_access_codes;
DROP POLICY IF EXISTS "Creator can update guest codes" ON public.guest_access_codes;
CREATE POLICY "Open read guest_access_codes" ON public.guest_access_codes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Open insert guest_access_codes" ON public.guest_access_codes FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Open update guest_access_codes" ON public.guest_access_codes FOR UPDATE TO anon, authenticated USING (true);

-- 12. guest_data_entries
DROP POLICY IF EXISTS "Authenticated teacher can insert guest data" ON public.guest_data_entries;
CREATE POLICY "Open insert guest_data_entries" ON public.guest_data_entries FOR INSERT TO anon, authenticated WITH CHECK (true);

-- 13. iep_documents
DROP POLICY IF EXISTS "Uploader can insert iep_documents" ON public.iep_documents;
DROP POLICY IF EXISTS "Uploader can select iep_documents" ON public.iep_documents;
DROP POLICY IF EXISTS "Uploader can update iep_documents" ON public.iep_documents;
CREATE POLICY "Open read iep_documents" ON public.iep_documents FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Open insert iep_documents" ON public.iep_documents FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Open update iep_documents" ON public.iep_documents FOR UPDATE TO anon, authenticated USING (true);

-- 14. iep_extracted_accommodations
DROP POLICY IF EXISTS "Doc uploader can insert accommodations" ON public.iep_extracted_accommodations;
DROP POLICY IF EXISTS "Doc uploader can select accommodations" ON public.iep_extracted_accommodations;
DROP POLICY IF EXISTS "Doc uploader can update accommodations" ON public.iep_extracted_accommodations;
CREATE POLICY "Open read iep_extracted_accommodations" ON public.iep_extracted_accommodations FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Open insert iep_extracted_accommodations" ON public.iep_extracted_accommodations FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Open update iep_extracted_accommodations" ON public.iep_extracted_accommodations FOR UPDATE TO anon, authenticated USING (true);

-- 15. iep_extracted_goals
DROP POLICY IF EXISTS "Doc uploader can insert goals" ON public.iep_extracted_goals;
DROP POLICY IF EXISTS "Doc uploader can select goals" ON public.iep_extracted_goals;
DROP POLICY IF EXISTS "Doc uploader can update goals" ON public.iep_extracted_goals;
CREATE POLICY "Open read iep_extracted_goals" ON public.iep_extracted_goals FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Open insert iep_extracted_goals" ON public.iep_extracted_goals FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Open update iep_extracted_goals" ON public.iep_extracted_goals FOR UPDATE TO anon, authenticated USING (true);

-- 16. iep_extracted_progress
DROP POLICY IF EXISTS "Doc uploader can insert progress" ON public.iep_extracted_progress;
DROP POLICY IF EXISTS "Doc uploader can select progress" ON public.iep_extracted_progress;
DROP POLICY IF EXISTS "Doc uploader can update progress" ON public.iep_extracted_progress;
CREATE POLICY "Open read iep_extracted_progress" ON public.iep_extracted_progress FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Open insert iep_extracted_progress" ON public.iep_extracted_progress FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Open update iep_extracted_progress" ON public.iep_extracted_progress FOR UPDATE TO anon, authenticated USING (true);

-- 17. iep_extracted_services
DROP POLICY IF EXISTS "Doc uploader can insert services" ON public.iep_extracted_services;
DROP POLICY IF EXISTS "Doc uploader can select services" ON public.iep_extracted_services;
DROP POLICY IF EXISTS "Doc uploader can update services" ON public.iep_extracted_services;
CREATE POLICY "Open read iep_extracted_services" ON public.iep_extracted_services FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Open insert iep_extracted_services" ON public.iep_extracted_services FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Open update iep_extracted_services" ON public.iep_extracted_services FOR UPDATE TO anon, authenticated USING (true);

-- 18. invite_codes
DROP POLICY IF EXISTS "Users can create invite codes" ON public.invite_codes;
DROP POLICY IF EXISTS "Creator can select invite codes" ON public.invite_codes;
DROP POLICY IF EXISTS "Creator can update invite codes" ON public.invite_codes;
CREATE POLICY "Open read invite_codes" ON public.invite_codes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Open insert invite_codes" ON public.invite_codes FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Open update invite_codes" ON public.invite_codes FOR UPDATE TO anon, authenticated USING (true);

-- 19. notification_preferences
DROP POLICY IF EXISTS "Users can insert own notification preferences" ON public.notification_preferences;
DROP POLICY IF EXISTS "Users can view own notification preferences" ON public.notification_preferences;
DROP POLICY IF EXISTS "Users can update own notification preferences" ON public.notification_preferences;
CREATE POLICY "Open read notification_preferences" ON public.notification_preferences FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Open insert notification_preferences" ON public.notification_preferences FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Open update notification_preferences" ON public.notification_preferences FOR UPDATE TO anon, authenticated USING (true);

-- 20. notifications
DROP POLICY IF EXISTS "Users can insert own local notification log rows" ON public.notifications;
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Open read notifications" ON public.notifications FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Open insert notifications" ON public.notifications FOR INSERT TO anon, authenticated WITH CHECK (true);

-- 21. pending_student_changes
DROP POLICY IF EXISTS "Users can create pending changes" ON public.pending_student_changes;
DROP POLICY IF EXISTS "Users can read own pending changes" ON public.pending_student_changes;
DROP POLICY IF EXISTS "Requestor or admin can update pending changes" ON public.pending_student_changes;
DROP POLICY IF EXISTS "Agency members can review pending changes" ON public.pending_student_changes;
CREATE POLICY "Open read pending_student_changes" ON public.pending_student_changes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Open insert pending_student_changes" ON public.pending_student_changes FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Open update pending_student_changes" ON public.pending_student_changes FOR UPDATE TO anon, authenticated USING (true);

-- 22. push_tokens
DROP POLICY IF EXISTS "Users can delete own push tokens" ON public.push_tokens;
DROP POLICY IF EXISTS "Users can insert own push tokens" ON public.push_tokens;
DROP POLICY IF EXISTS "Users can view own push tokens" ON public.push_tokens;
DROP POLICY IF EXISTS "Users can update own push tokens" ON public.push_tokens;
CREATE POLICY "Open read push_tokens" ON public.push_tokens FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Open insert push_tokens" ON public.push_tokens FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Open update push_tokens" ON public.push_tokens FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "Open delete push_tokens" ON public.push_tokens FOR DELETE TO anon, authenticated USING (true);

-- 23. teacher_data_events
DROP POLICY IF EXISTS "Users can delete own data events" ON public.teacher_data_events;
DROP POLICY IF EXISTS "Users can insert own data events" ON public.teacher_data_events;
DROP POLICY IF EXISTS "Users can read own data events" ON public.teacher_data_events;
CREATE POLICY "Open read teacher_data_events" ON public.teacher_data_events FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Open insert teacher_data_events" ON public.teacher_data_events FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Open delete teacher_data_events" ON public.teacher_data_events FOR DELETE TO anon, authenticated USING (true);

-- 24. teacher_duration_entries
DROP POLICY IF EXISTS "Users can delete own duration entries" ON public.teacher_duration_entries;
DROP POLICY IF EXISTS "Users can insert own duration entries" ON public.teacher_duration_entries;
DROP POLICY IF EXISTS "Users can read own duration entries" ON public.teacher_duration_entries;
DROP POLICY IF EXISTS "Users can update own duration entries" ON public.teacher_duration_entries;
CREATE POLICY "Open read teacher_duration_entries" ON public.teacher_duration_entries FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Open insert teacher_duration_entries" ON public.teacher_duration_entries FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Open update teacher_duration_entries" ON public.teacher_duration_entries FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "Open delete teacher_duration_entries" ON public.teacher_duration_entries FOR DELETE TO anon, authenticated USING (true);

-- 25. teacher_frequency_entries
DROP POLICY IF EXISTS "Users can delete own frequency entries" ON public.teacher_frequency_entries;
DROP POLICY IF EXISTS "Users can insert own frequency entries" ON public.teacher_frequency_entries;
DROP POLICY IF EXISTS "Users can read own frequency entries" ON public.teacher_frequency_entries;
DROP POLICY IF EXISTS "Users can update own frequency entries" ON public.teacher_frequency_entries;
CREATE POLICY "Open read teacher_frequency_entries" ON public.teacher_frequency_entries FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Open insert teacher_frequency_entries" ON public.teacher_frequency_entries FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Open update teacher_frequency_entries" ON public.teacher_frequency_entries FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "Open delete teacher_frequency_entries" ON public.teacher_frequency_entries FOR DELETE TO anon, authenticated USING (true);

-- 26. teacher_interval_settings
DROP POLICY IF EXISTS "Users can manage own interval settings" ON public.teacher_interval_settings;
CREATE POLICY "Open all teacher_interval_settings" ON public.teacher_interval_settings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 27. teacher_message_attachments
DROP POLICY IF EXISTS "Users can add attachments to their messages" ON public.teacher_message_attachments;
DROP POLICY IF EXISTS "Users can read attachments of their messages" ON public.teacher_message_attachments;
CREATE POLICY "Open read teacher_message_attachments" ON public.teacher_message_attachments FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Open insert teacher_message_attachments" ON public.teacher_message_attachments FOR INSERT TO anon, authenticated WITH CHECK (true);

-- 28. teacher_messages
DROP POLICY IF EXISTS "Users can send messages" ON public.teacher_messages;
DROP POLICY IF EXISTS "Users can read own messages" ON public.teacher_messages;
DROP POLICY IF EXISTS "Recipients can update messages" ON public.teacher_messages;
CREATE POLICY "Open read teacher_messages" ON public.teacher_messages FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Open insert teacher_messages" ON public.teacher_messages FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Open update teacher_messages" ON public.teacher_messages FOR UPDATE TO anon, authenticated USING (true);

-- 29. teacher_quick_notes
DROP POLICY IF EXISTS "Users can delete own quick notes" ON public.teacher_quick_notes;
DROP POLICY IF EXISTS "Users can insert own quick notes" ON public.teacher_quick_notes;
DROP POLICY IF EXISTS "Users can read own quick notes" ON public.teacher_quick_notes;
CREATE POLICY "Open read teacher_quick_notes" ON public.teacher_quick_notes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Open insert teacher_quick_notes" ON public.teacher_quick_notes FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Open delete teacher_quick_notes" ON public.teacher_quick_notes FOR DELETE TO anon, authenticated USING (true);

-- 30. teacher_reminder_schedules
DROP POLICY IF EXISTS "Users can delete own reminder schedules" ON public.teacher_reminder_schedules;
DROP POLICY IF EXISTS "Users can insert own reminder schedules" ON public.teacher_reminder_schedules;
DROP POLICY IF EXISTS "Users can view own reminder schedules" ON public.teacher_reminder_schedules;
DROP POLICY IF EXISTS "Users can update own reminder schedules" ON public.teacher_reminder_schedules;
CREATE POLICY "Open read teacher_reminder_schedules" ON public.teacher_reminder_schedules FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Open insert teacher_reminder_schedules" ON public.teacher_reminder_schedules FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Open update teacher_reminder_schedules" ON public.teacher_reminder_schedules FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "Open delete teacher_reminder_schedules" ON public.teacher_reminder_schedules FOR DELETE TO anon, authenticated USING (true);

-- 31. teacher_weekly_summaries
DROP POLICY IF EXISTS "Users can manage own weekly summaries" ON public.teacher_weekly_summaries;
CREATE POLICY "Open all teacher_weekly_summaries" ON public.teacher_weekly_summaries FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 32. user_reminder_overrides
DROP POLICY IF EXISTS "Users can delete own reminder overrides" ON public.user_reminder_overrides;
DROP POLICY IF EXISTS "Users can insert own reminder overrides" ON public.user_reminder_overrides;
DROP POLICY IF EXISTS "Users can view own reminder overrides" ON public.user_reminder_overrides;
DROP POLICY IF EXISTS "Users can update own reminder overrides" ON public.user_reminder_overrides;
CREATE POLICY "Open read user_reminder_overrides" ON public.user_reminder_overrides FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Open insert user_reminder_overrides" ON public.user_reminder_overrides FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Open update user_reminder_overrides" ON public.user_reminder_overrides FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "Open delete user_reminder_overrides" ON public.user_reminder_overrides FOR DELETE TO anon, authenticated USING (true);
