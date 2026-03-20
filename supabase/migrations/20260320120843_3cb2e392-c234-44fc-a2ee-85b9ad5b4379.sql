
-- BEACON POINTS <-> TEACHER DATA LINKING LAYER

-- 1) EXTEND EXISTING LEDGER
alter table public.beacon_points_ledger
  add column if not exists teacher_data_event_id uuid null,
  add column if not exists teacher_frequency_entry_id uuid null,
  add column if not exists teacher_duration_entry_id uuid null,
  add column if not exists abc_log_id uuid null,
  add column if not exists point_rule_id uuid null,
  add column if not exists entry_kind text null,
  add column if not exists manual_reason_category text null,
  add column if not exists is_reversal boolean not null default false,
  add column if not exists reversal_of_ledger_id uuid null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'beacon_points_entry_kind_chk'
  ) then
    alter table public.beacon_points_ledger
      add constraint beacon_points_entry_kind_chk
      check (
        entry_kind is null or
        entry_kind in (
          'teacher_data_event','teacher_frequency','teacher_duration',
          'abc_log','manual','reward_redeem','response_cost','reversal'
        )
      );
  end if;
end $$;

create index if not exists idx_beacon_points_ledger_entry_kind on public.beacon_points_ledger (entry_kind);
create index if not exists idx_beacon_points_ledger_point_rule on public.beacon_points_ledger (point_rule_id);
create index if not exists idx_beacon_points_ledger_reversal on public.beacon_points_ledger (reversal_of_ledger_id) where reversal_of_ledger_id is not null;

-- 2) RULES TABLE
create table if not exists public.teacher_point_rules (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null,
  active boolean not null default true,
  rule_name text not null,
  source_table text not null,
  event_type text null,
  event_subtype text null,
  behavior_name text null,
  behavior_category text null,
  points integer not null,
  rule_type text not null default 'reward',
  auto_apply boolean not null default true,
  applies_when_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'teacher_point_rules_source_table_chk') then
    alter table public.teacher_point_rules
      add constraint teacher_point_rules_source_table_chk
      check (source_table in ('teacher_data_events','teacher_frequency_entries','teacher_duration_entries','abc_logs','manual'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'teacher_point_rules_rule_type_chk') then
    alter table public.teacher_point_rules
      add constraint teacher_point_rules_rule_type_chk
      check (rule_type in ('reward', 'response_cost', 'manual'));
  end if;
end $$;

alter table public.teacher_point_rules enable row level security;

create policy "Staff can manage own agency rules" on public.teacher_point_rules
  for all to authenticated
  using (true) with check (true);

create index if not exists idx_teacher_point_rules_agency_active on public.teacher_point_rules (agency_id, active);

-- 3) TEACHER ACTION BUTTONS
create table if not exists public.teacher_point_actions (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null,
  active boolean not null default true,
  action_label text not null,
  action_icon text null,
  source_table text not null default 'manual',
  default_event_type text null,
  default_event_subtype text null,
  default_behavior_name text null,
  default_behavior_category text null,
  mapped_rule_id uuid null references public.teacher_point_rules(id) on delete set null,
  manual_points integer null,
  manual_rule_type text null,
  action_group text null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'teacher_point_actions_source_table_chk') then
    alter table public.teacher_point_actions
      add constraint teacher_point_actions_source_table_chk
      check (source_table in ('teacher_data_events','teacher_frequency_entries','teacher_duration_entries','abc_logs','manual'));
  end if;
end $$;

alter table public.teacher_point_actions enable row level security;

create policy "Staff can manage own agency actions" on public.teacher_point_actions
  for all to authenticated
  using (true) with check (true);

create index if not exists idx_teacher_point_actions_agency_active on public.teacher_point_actions (agency_id, active, sort_order);

-- 4) UPDATED_AT TRIGGER
drop trigger if exists trg_teacher_point_rules_updated_at on public.teacher_point_rules;
create trigger trg_teacher_point_rules_updated_at
before update on public.teacher_point_rules
for each row execute function public.set_updated_at();

-- 5) HELPER: MATCH RULE
create or replace function public.get_matching_teacher_point_rule(
  p_agency_id uuid, p_source_table text,
  p_event_type text default null, p_event_subtype text default null,
  p_behavior_name text default null, p_behavior_category text default null
)
returns public.teacher_point_rules
language plpgsql
set search_path = public
as $$
declare v_rule public.teacher_point_rules;
begin
  select r.* into v_rule
  from public.teacher_point_rules r
  where r.agency_id = p_agency_id and r.active = true and r.source_table = p_source_table
    and (r.event_type is null or r.event_type = p_event_type)
    and (r.event_subtype is null or r.event_subtype = p_event_subtype)
    and (r.behavior_name is null or r.behavior_name = p_behavior_name)
    and (r.behavior_category is null or r.behavior_category = p_behavior_category)
  order by
    case when r.event_type is not null then 0 else 1 end,
    case when r.behavior_name is not null then 0 else 1 end,
    r.created_at asc
  limit 1;
  return v_rule;
end;
$$;

-- 6) LINKED TEACHER_DATA_EVENTS + POINTS (uses event_id not id)
create or replace function public.log_teacher_data_event_with_points(
  p_agency_id uuid, p_student_id uuid, p_staff_id uuid, p_classroom_id uuid,
  p_event_type text, p_event_subtype text default null,
  p_event_value jsonb default '{}'::jsonb, p_source_module text default 'quick_action',
  p_recorded_at timestamptz default now(), p_allow_no_rule boolean default true
)
returns jsonb language plpgsql set search_path = public as $$
declare
  v_event_id uuid; v_rule public.teacher_point_rules;
  v_points_id uuid; v_points integer := 0;
begin
  insert into public.teacher_data_events (student_id, staff_id, agency_id, classroom_id, event_type, event_subtype, event_value, source_module, recorded_at)
  values (p_student_id, p_staff_id, p_agency_id, p_classroom_id, p_event_type, p_event_subtype, coalesce(p_event_value, '{}'::jsonb), p_source_module, p_recorded_at)
  returning event_id into v_event_id;

  v_rule := public.get_matching_teacher_point_rule(p_agency_id, 'teacher_data_events', p_event_type, p_event_subtype, null, null);

  if v_rule.id is not null then
    v_points := v_rule.points;
    insert into public.beacon_points_ledger (agency_id, student_id, staff_id, points, source, reason, teacher_data_event_id, point_rule_id, entry_kind)
    values (p_agency_id, p_student_id, p_staff_id, v_points,
      case when v_rule.rule_type = 'response_cost' then 'response_cost' else 'teacher_data_auto' end,
      coalesce(v_rule.rule_name, p_event_type), v_event_id, v_rule.id, 'teacher_data_event')
    returning id into v_points_id;
  end if;

  return jsonb_build_object('ok', true, 'teacher_data_event_id', v_event_id, 'point_rule_applied', (v_rule.id is not null), 'points', v_points, 'points_ledger_id', v_points_id);
end;
$$;

-- 7) LINKED FREQUENCY ENTRY + POINTS
create or replace function public.log_teacher_frequency_with_points(
  p_agency_id uuid, p_student_id uuid, p_staff_id uuid,
  p_behavior_name text, p_count integer default 1,
  p_logged_date date default current_date, p_notes text default null,
  p_allow_no_rule boolean default true
)
returns jsonb language plpgsql set search_path = public as $$
declare
  v_frequency_id uuid; v_rule public.teacher_point_rules;
  v_points_id uuid; v_points integer := 0;
begin
  insert into public.teacher_frequency_entries (agency_id, client_id, user_id, behavior_name, count, logged_date, notes)
  values (p_agency_id, p_student_id, p_staff_id, p_behavior_name, greatest(coalesce(p_count,1),1), p_logged_date, p_notes)
  returning id into v_frequency_id;

  v_rule := public.get_matching_teacher_point_rule(p_agency_id, 'teacher_frequency_entries', null, null, p_behavior_name, null);

  if v_rule.id is not null then
    v_points := v_rule.points * greatest(coalesce(p_count,1),1);
    insert into public.beacon_points_ledger (agency_id, student_id, staff_id, points, source, reason, teacher_frequency_entry_id, point_rule_id, entry_kind)
    values (p_agency_id, p_student_id, p_staff_id, v_points,
      case when v_rule.rule_type = 'response_cost' then 'response_cost' else 'teacher_frequency_auto' end,
      coalesce(v_rule.rule_name, p_behavior_name), v_frequency_id, v_rule.id, 'teacher_frequency')
    returning id into v_points_id;
  end if;

  return jsonb_build_object('ok', true, 'teacher_frequency_entry_id', v_frequency_id, 'point_rule_applied', (v_rule.id is not null), 'points', v_points, 'points_ledger_id', v_points_id);
end;
$$;

-- 8) LINKED DURATION ENTRY + POINTS
create or replace function public.log_teacher_duration_with_points(
  p_agency_id uuid, p_student_id uuid, p_staff_id uuid,
  p_behavior_name text, p_duration_seconds integer,
  p_logged_date date default current_date, p_notes text default null,
  p_allow_no_rule boolean default true
)
returns jsonb language plpgsql set search_path = public as $$
declare
  v_duration_id uuid; v_rule public.teacher_point_rules;
  v_points_id uuid; v_points integer := 0;
begin
  insert into public.teacher_duration_entries (agency_id, client_id, user_id, behavior_name, duration_seconds, logged_date, notes)
  values (p_agency_id, p_student_id, p_staff_id, p_behavior_name, greatest(coalesce(p_duration_seconds,0),0), p_logged_date, p_notes)
  returning id into v_duration_id;

  v_rule := public.get_matching_teacher_point_rule(p_agency_id, 'teacher_duration_entries', null, null, p_behavior_name, null);

  if v_rule.id is not null then
    v_points := v_rule.points;
    insert into public.beacon_points_ledger (agency_id, student_id, staff_id, points, source, reason, teacher_duration_entry_id, point_rule_id, entry_kind)
    values (p_agency_id, p_student_id, p_staff_id, v_points,
      case when v_rule.rule_type = 'response_cost' then 'response_cost' else 'teacher_duration_auto' end,
      coalesce(v_rule.rule_name, p_behavior_name), v_duration_id, v_rule.id, 'teacher_duration')
    returning id into v_points_id;
  end if;

  return jsonb_build_object('ok', true, 'teacher_duration_entry_id', v_duration_id, 'point_rule_applied', (v_rule.id is not null), 'points', v_points, 'points_ledger_id', v_points_id);
end;
$$;

-- 9) LINKED ABC LOG + OPTIONAL RESPONSE COST
create or replace function public.log_abc_with_points(
  p_student_id uuid, p_staff_id uuid, p_antecedent text, p_behavior text, p_consequence text,
  p_intensity integer default null, p_notes text default null,
  p_behavior_category text default null, p_logged_at timestamptz default now(),
  p_agency_id uuid default null, p_allow_no_rule boolean default true
)
returns jsonb language plpgsql set search_path = public as $$
declare
  v_abc_id uuid; v_rule public.teacher_point_rules;
  v_points_id uuid; v_points integer := 0;
begin
  insert into public.abc_logs (client_id, user_id, antecedent, behavior, consequence, intensity, notes, behavior_category, logged_at)
  values (p_student_id, p_staff_id, p_antecedent, p_behavior, p_consequence, p_intensity, p_notes, p_behavior_category, p_logged_at)
  returning id into v_abc_id;

  if p_agency_id is not null then
    v_rule := public.get_matching_teacher_point_rule(p_agency_id, 'abc_logs', null, null, null, p_behavior_category);
    if v_rule.id is not null then
      v_points := v_rule.points;
      insert into public.beacon_points_ledger (agency_id, student_id, staff_id, points, source, reason, abc_log_id, point_rule_id, entry_kind)
      values (p_agency_id, p_student_id, p_staff_id, v_points,
        case when v_rule.rule_type = 'response_cost' then 'response_cost' else 'abc_auto' end,
        coalesce(v_rule.rule_name, p_behavior_category, 'ABC linked rule'), v_abc_id, v_rule.id, 'abc_log')
      returning id into v_points_id;
    end if;
  end if;

  return jsonb_build_object('ok', true, 'abc_log_id', v_abc_id, 'point_rule_applied', (v_rule.id is not null), 'points', v_points, 'points_ledger_id', v_points_id);
end;
$$;

-- 10) MANUAL "BECAUSE" POINTS
create or replace function public.log_manual_points(
  p_agency_id uuid, p_student_id uuid, p_staff_id uuid,
  p_points integer, p_reason text,
  p_manual_reason_category text default 'because',
  p_source text default 'manual_award'
)
returns jsonb language plpgsql set search_path = public as $$
declare v_points_id uuid;
begin
  insert into public.beacon_points_ledger (agency_id, student_id, staff_id, points, source, reason, entry_kind, manual_reason_category)
  values (p_agency_id, p_student_id, p_staff_id, p_points, p_source, p_reason, 'manual', p_manual_reason_category)
  returning id into v_points_id;
  return jsonb_build_object('ok', true, 'points', p_points, 'points_ledger_id', v_points_id);
end;
$$;

-- 11) AUDIT VIEW
create or replace view public.v_beacon_points_audit as
select
  l.id, l.created_at, l.agency_id, l.student_id, l.staff_id,
  l.points, l.source, l.reason, l.entry_kind, l.manual_reason_category,
  l.teacher_data_event_id, l.teacher_frequency_entry_id,
  l.teacher_duration_entry_id, l.abc_log_id, l.point_rule_id,
  l.is_reversal, l.reversal_of_ledger_id,
  r.rule_name, r.rule_type
from public.beacon_points_ledger l
left join public.teacher_point_rules r on r.id = l.point_rule_id;

-- 12) Recreate v_student_points_balance to exclude reversals from double-counting
create or replace view public.v_student_points_balance as
select
  student_id,
  agency_id,
  coalesce(sum(points), 0) as balance,
  count(*) filter (where points > 0 and is_reversal = false) as total_earned_count,
  coalesce(sum(points) filter (where points > 0 and is_reversal = false), 0) as total_earned,
  coalesce(abs(sum(points) filter (where points < 0 and is_reversal = false)), 0) as total_spent,
  max(created_at) as last_activity
from public.beacon_points_ledger
group by student_id, agency_id;
