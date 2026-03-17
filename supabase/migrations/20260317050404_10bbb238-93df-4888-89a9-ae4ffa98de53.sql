
-- =========================================================
-- 0) EXTENSIONS
-- =========================================================
create extension if not exists pgcrypto;

-- =========================================================
-- 1) UPDATED-AT HELPER
-- =========================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================================================
-- 2) DROP old conflicting tables/policies
-- =========================================================
-- Drop old notification_defaults (replaced by default_reminder_schedules)
drop table if exists public.notification_defaults cascade;

-- Drop old notification_preferences (different schema)
drop policy if exists "Users can delete own notification preferences" on public.notification_preferences;
drop policy if exists "Users can insert own notification preferences" on public.notification_preferences;
drop policy if exists "Users can read own notification preferences" on public.notification_preferences;
drop policy if exists "Users can update own notification preferences" on public.notification_preferences;
drop table if exists public.notification_preferences cascade;

-- Drop old push_tokens (different schema)
drop policy if exists "Users can manage own push tokens" on public.push_tokens;
drop table if exists public.push_tokens cascade;

-- =========================================================
-- 3) PUSH TOKENS
-- =========================================================
create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  device_token text not null,
  platform text not null check (platform in ('ios', 'android', 'web')),
  app_environment text not null default 'beta' check (app_environment in ('beta', 'production', 'development')),
  device_name text,
  timezone text,
  is_active boolean not null default true,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index push_tokens_unique_token_env
on public.push_tokens (device_token, app_environment);

create index push_tokens_user_id_idx on public.push_tokens (user_id);
create index push_tokens_active_env_idx on public.push_tokens (app_environment, is_active);

create trigger trg_push_tokens_updated_at
before update on public.push_tokens
for each row execute function public.set_updated_at();

-- =========================================================
-- 4) NOTIFICATION PREFERENCES
-- =========================================================
create table public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  push_enabled boolean not null default true,
  local_reminders_enabled boolean not null default true,
  teacher_log_reminders boolean not null default true,
  escalation_alerts boolean not null default true,
  note_completion_reminders boolean not null default true,
  parent_messages boolean not null default true,
  supervision_reminders boolean not null default true,
  admin_alerts boolean not null default true,
  quiet_hours_enabled boolean not null default false,
  quiet_hours_start time,
  quiet_hours_end time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notification_preferences_user_id_idx
on public.notification_preferences (user_id);

create trigger trg_notification_preferences_updated_at
before update on public.notification_preferences
for each row execute function public.set_updated_at();

-- =========================================================
-- 5) DEFAULT REMINDER SCHEDULES
-- =========================================================
create table public.default_reminder_schedules (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null check (
    scope_type in ('platform', 'organization', 'school', 'classroom', 'user')
  ),
  organization_id uuid,
  school_id uuid,
  classroom_id uuid,
  owner_user_id uuid,
  role_scope text not null default 'teacher' check (
    role_scope in ('teacher', 'rbt', 'bcba', 'supervisor', 'parent', 'admin')
  ),
  name text not null,
  reminder_key text not null,
  reminder_type text not null check (
    reminder_type in ('fixed_time', 'interval', 'block_based', 'missing_data_followup', 'session_close')
  ),
  timezone text not null,
  is_active boolean not null default true,
  allow_user_override boolean not null default true,
  local_enabled boolean not null default true,
  remote_enabled boolean not null default false,
  start_time time,
  end_time time,
  days_of_week int[],
  interval_minutes integer,
  grace_period_minutes integer default 10,
  message_title text,
  message_body text,
  app_environment text not null default 'beta' check (
    app_environment in ('beta', 'production', 'development')
  ),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint default_reminder_scope_consistency_chk check (
    (scope_type = 'platform' and organization_id is null and school_id is null and classroom_id is null and owner_user_id is null)
    or (scope_type = 'organization' and organization_id is not null and school_id is null and classroom_id is null)
    or (scope_type = 'school' and school_id is not null and classroom_id is null)
    or (scope_type = 'classroom' and classroom_id is not null)
    or (scope_type = 'user' and owner_user_id is not null)
  ),
  constraint default_reminder_time_logic_chk check (
    (reminder_type in ('fixed_time', 'block_based', 'session_close') and (start_time is not null or end_time is not null))
    or (reminder_type in ('interval', 'missing_data_followup') and (interval_minutes is not null or grace_period_minutes is not null))
    or (reminder_type not in ('fixed_time', 'block_based', 'session_close', 'interval', 'missing_data_followup'))
  )
);

create unique index default_reminder_unique_scope_key_env
on public.default_reminder_schedules (
  coalesce(scope_type, ''),
  coalesce(organization_id::text, ''),
  coalesce(school_id::text, ''),
  coalesce(classroom_id::text, ''),
  coalesce(owner_user_id::text, ''),
  coalesce(role_scope, ''),
  coalesce(reminder_key, ''),
  coalesce(app_environment, '')
);

create index default_reminder_scope_env_idx on public.default_reminder_schedules (scope_type, app_environment, is_active);
create index default_reminder_owner_idx on public.default_reminder_schedules (owner_user_id);
create index default_reminder_org_idx on public.default_reminder_schedules (organization_id);
create index default_reminder_school_idx on public.default_reminder_schedules (school_id);
create index default_reminder_classroom_idx on public.default_reminder_schedules (classroom_id);

create trigger trg_default_reminder_schedules_updated_at
before update on public.default_reminder_schedules
for each row execute function public.set_updated_at();

-- =========================================================
-- 6) USER REMINDER OVERRIDES
-- =========================================================
create table public.user_reminder_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  default_schedule_id uuid not null references public.default_reminder_schedules(id) on delete cascade,
  override_enabled boolean not null default false,
  notifications_enabled boolean not null default true,
  custom_name text,
  custom_start_time time,
  custom_end_time time,
  custom_days_of_week int[],
  custom_interval_minutes integer,
  custom_timezone text,
  local_enabled boolean,
  remote_enabled boolean,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, default_schedule_id)
);

create index user_reminder_overrides_user_idx on public.user_reminder_overrides (user_id);
create index user_reminder_overrides_default_idx on public.user_reminder_overrides (default_schedule_id);

create trigger trg_user_reminder_overrides_updated_at
before update on public.user_reminder_overrides
for each row execute function public.set_updated_at();

-- =========================================================
-- 7) NOTIFICATIONS LOG
-- =========================================================
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  body text not null,
  type text not null,
  related_student_id uuid,
  related_event_id uuid,
  related_schedule_id uuid references public.default_reminder_schedules(id) on delete set null,
  delivery_channel text not null default 'remote' check (
    delivery_channel in ('remote', 'local', 'in_app')
  ),
  app_environment text not null default 'beta' check (
    app_environment in ('beta', 'production', 'development')
  ),
  status text not null default 'pending' check (
    status in ('pending', 'scheduled', 'sent', 'failed', 'dismissed')
  ),
  error_message text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_status_idx on public.notifications (status, app_environment);
create index notifications_schedule_idx on public.notifications (related_schedule_id);

-- =========================================================
-- 8) AUTO-CREATE NOTIFICATION PREFERENCES ON NEW USER
-- =========================================================
create or replace function public.handle_new_user_notification_preferences()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notification_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_notification_preferences on auth.users;
create trigger on_auth_user_created_notification_preferences
after insert on auth.users
for each row execute function public.handle_new_user_notification_preferences();

-- =========================================================
-- 9) RLS
-- =========================================================
alter table public.push_tokens enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.default_reminder_schedules enable row level security;
alter table public.user_reminder_overrides enable row level security;
alter table public.notifications enable row level security;

-- PUSH TOKENS
create policy "Users can view own push tokens" on public.push_tokens for select to authenticated using (auth.uid() = user_id);
create policy "Users can insert own push tokens" on public.push_tokens for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can update own push tokens" on public.push_tokens for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own push tokens" on public.push_tokens for delete to authenticated using (auth.uid() = user_id);

-- NOTIFICATION PREFERENCES
create policy "Users can view own notification preferences" on public.notification_preferences for select to authenticated using (auth.uid() = user_id);
create policy "Users can insert own notification preferences" on public.notification_preferences for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can update own notification preferences" on public.notification_preferences for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- DEFAULT REMINDER SCHEDULES
create policy "Authenticated users can view default reminder schedules" on public.default_reminder_schedules for select to authenticated using (is_active = true);
create policy "Users can insert user-scoped reminder schedules they own" on public.default_reminder_schedules for insert to authenticated with check (scope_type = 'user' and owner_user_id = auth.uid());
create policy "Users can update user-scoped reminder schedules they own" on public.default_reminder_schedules for update to authenticated using (scope_type = 'user' and owner_user_id = auth.uid()) with check (scope_type = 'user' and owner_user_id = auth.uid());
create policy "Users can delete user-scoped reminder schedules they own" on public.default_reminder_schedules for delete to authenticated using (scope_type = 'user' and owner_user_id = auth.uid());

-- USER REMINDER OVERRIDES
create policy "Users can view own reminder overrides" on public.user_reminder_overrides for select to authenticated using (auth.uid() = user_id);
create policy "Users can insert own reminder overrides" on public.user_reminder_overrides for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can update own reminder overrides" on public.user_reminder_overrides for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own reminder overrides" on public.user_reminder_overrides for delete to authenticated using (auth.uid() = user_id);

-- NOTIFICATIONS
create policy "Users can view own notifications" on public.notifications for select to authenticated using (auth.uid() = user_id);
create policy "Users can insert own local notification log rows" on public.notifications for insert to authenticated with check (auth.uid() = user_id);

-- =========================================================
-- 10) VIEWS
-- =========================================================
create or replace view public.default_reminder_scope_rank as
select
  drs.*,
  case drs.scope_type
    when 'user' then 1
    when 'classroom' then 2
    when 'school' then 3
    when 'organization' then 4
    when 'platform' then 5
    else 99
  end as scope_rank
from public.default_reminder_schedules drs
where drs.is_active = true;

create or replace view public.effective_user_reminders as
with current_user_prefs as (
  select
    np.user_id,
    np.push_enabled,
    np.local_reminders_enabled,
    np.teacher_log_reminders,
    np.escalation_alerts,
    np.note_completion_reminders,
    np.parent_messages,
    np.supervision_reminders,
    np.admin_alerts,
    np.quiet_hours_enabled,
    np.quiet_hours_start,
    np.quiet_hours_end
  from public.notification_preferences np
),
candidate_defaults as (
  select
    auth.uid() as user_id,
    drs.id as default_schedule_id,
    drs.scope_type,
    drs.scope_rank,
    drs.owner_user_id,
    drs.organization_id,
    drs.school_id,
    drs.classroom_id,
    drs.role_scope,
    drs.name,
    drs.reminder_key,
    drs.reminder_type,
    drs.timezone,
    drs.allow_user_override,
    drs.local_enabled,
    drs.remote_enabled,
    drs.start_time,
    drs.end_time,
    drs.days_of_week,
    drs.interval_minutes,
    drs.grace_period_minutes,
    drs.message_title,
    drs.message_body,
    drs.app_environment,
    row_number() over (
      partition by drs.reminder_key, drs.app_environment
      order by drs.scope_rank asc, drs.created_at desc
    ) as rn
  from public.default_reminder_scope_rank drs
  where
    drs.app_environment in ('beta', 'production', 'development')
    and (
      drs.scope_type = 'platform'
      or (drs.scope_type = 'user' and drs.owner_user_id = auth.uid())
    )
),
selected_defaults as (
  select * from candidate_defaults where rn = 1
),
merged as (
  select
    sd.user_id,
    sd.default_schedule_id,
    sd.scope_type as source_scope_type,
    sd.name as default_name,
    sd.reminder_key,
    sd.reminder_type,
    sd.app_environment,
    coalesce(uro.override_enabled, false) as override_enabled,
    coalesce(uro.notifications_enabled, true) as notifications_enabled,
    uro.id as override_id,
    case when coalesce(uro.override_enabled, false) = true and uro.custom_name is not null then uro.custom_name else sd.name end as effective_name,
    case when coalesce(uro.override_enabled, false) = true and uro.custom_timezone is not null then uro.custom_timezone else sd.timezone end as effective_timezone,
    case when coalesce(uro.override_enabled, false) = true and uro.custom_start_time is not null then uro.custom_start_time else sd.start_time end as effective_start_time,
    case when coalesce(uro.override_enabled, false) = true and uro.custom_end_time is not null then uro.custom_end_time else sd.end_time end as effective_end_time,
    case when coalesce(uro.override_enabled, false) = true and uro.custom_days_of_week is not null then uro.custom_days_of_week else sd.days_of_week end as effective_days_of_week,
    case when coalesce(uro.override_enabled, false) = true and uro.custom_interval_minutes is not null then uro.custom_interval_minutes else sd.interval_minutes end as effective_interval_minutes,
    case when coalesce(uro.override_enabled, false) = true and uro.local_enabled is not null then uro.local_enabled else sd.local_enabled end as effective_local_enabled,
    case when coalesce(uro.override_enabled, false) = true and uro.remote_enabled is not null then uro.remote_enabled else sd.remote_enabled end as effective_remote_enabled,
    sd.allow_user_override,
    sd.grace_period_minutes,
    sd.message_title,
    sd.message_body,
    cup.push_enabled,
    cup.local_reminders_enabled,
    cup.teacher_log_reminders,
    cup.escalation_alerts,
    cup.note_completion_reminders,
    cup.parent_messages,
    cup.supervision_reminders,
    cup.admin_alerts,
    cup.quiet_hours_enabled,
    cup.quiet_hours_start,
    cup.quiet_hours_end,
    case
      when coalesce(uro.notifications_enabled, true) = false then false
      when cup.push_enabled = false and cup.local_reminders_enabled = false then false
      when sd.reminder_key = 'teacher_log_reminder' and cup.teacher_log_reminders = false then false
      when sd.reminder_key = 'escalation_alert' and cup.escalation_alerts = false then false
      when sd.reminder_key = 'note_completion_reminder' and cup.note_completion_reminders = false then false
      when sd.reminder_key = 'parent_message' and cup.parent_messages = false then false
      when sd.reminder_key = 'supervision_reminder' and cup.supervision_reminders = false then false
      when sd.reminder_key = 'admin_alert' and cup.admin_alerts = false then false
      else true
    end as effective_enabled
  from selected_defaults sd
  left join public.user_reminder_overrides uro
    on uro.default_schedule_id = sd.default_schedule_id
   and uro.user_id = sd.user_id
   and uro.is_active = true
  left join current_user_prefs cup
    on cup.user_id = sd.user_id
)
select * from merged;
