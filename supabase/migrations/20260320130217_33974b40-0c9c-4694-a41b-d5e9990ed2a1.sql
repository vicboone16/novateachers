
-- 1) TARGET CATALOG
create table if not exists public.teacher_targets (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null,
  client_id uuid null,
  active boolean not null default true,
  name text not null,
  target_type text not null,
  source_table text not null default 'manual',
  default_event_type text null,
  default_event_subtype text null,
  default_behavior_name text null,
  default_behavior_category text null,
  description text null,
  action_group text null,
  icon text null,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'teacher_targets_source_table_chk') then
    alter table public.teacher_targets
      add constraint teacher_targets_source_table_chk
      check (source_table in ('teacher_data_events','teacher_frequency_entries','teacher_duration_entries','abc_logs','manual'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'teacher_targets_target_type_chk') then
    alter table public.teacher_targets
      add constraint teacher_targets_target_type_chk
      check (target_type in ('skill','behavior','replacement','classroom','manual'));
  end if;
end $$;

create index if not exists idx_teacher_targets_agency_active on public.teacher_targets (agency_id, active);
create index if not exists idx_teacher_targets_client on public.teacher_targets (client_id) where client_id is not null;

-- Enable RLS
alter table public.teacher_targets enable row level security;

create policy "Staff can read targets" on public.teacher_targets for select to authenticated using (true);
create policy "Staff can insert targets" on public.teacher_targets for insert to authenticated with check (agency_id is not null);
create policy "Staff can update targets" on public.teacher_targets for update to authenticated using (agency_id is not null);
create policy "Staff can delete targets" on public.teacher_targets for delete to authenticated using (agency_id is not null);

-- 2) LINK RULES TO TARGETS
alter table public.teacher_point_rules add column if not exists target_id uuid null references public.teacher_targets(id) on delete set null;
create index if not exists idx_teacher_point_rules_target_id on public.teacher_point_rules (target_id);

-- 3) LINK ACTIONS TO TARGETS
alter table public.teacher_point_actions add column if not exists target_id uuid null references public.teacher_targets(id) on delete set null;
create index if not exists idx_teacher_point_actions_target_id on public.teacher_point_actions (target_id);

-- 4) LEDGER POINT DETAIL
alter table public.beacon_points_ledger
  add column if not exists base_points integer null,
  add column if not exists point_adjustment integer not null default 0,
  add column if not exists override_points integer null,
  add column if not exists target_id uuid null references public.teacher_targets(id) on delete set null;
create index if not exists idx_beacon_points_ledger_target_id on public.beacon_points_ledger (target_id);

-- 5) UPDATED_AT TRIGGER
drop trigger if exists trg_teacher_targets_updated_at on public.teacher_targets;
create trigger trg_teacher_targets_updated_at
before update on public.teacher_targets
for each row execute function public.set_updated_at();

-- 6) LOG TARGET ACTION FUNCTION
create or replace function public.log_target_action(
  p_agency_id uuid,
  p_student_id uuid,
  p_staff_id uuid,
  p_classroom_id uuid,
  p_target_id uuid,
  p_point_adjustment integer default 0,
  p_override_points integer default null,
  p_notes text default null,
  p_recorded_at timestamptz default now()
)
returns jsonb
language plpgsql
set search_path = 'public'
as $$
declare
  v_target public.teacher_targets;
  v_rule public.teacher_point_rules;
  v_base_points integer := 0;
  v_final_points integer := 0;
  v_data_id uuid;
  v_ledger_id uuid;
  v_source text := 'manual_award';
  v_entry_kind text := 'manual';
begin
  select * into v_target from public.teacher_targets where id = p_target_id and active = true;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Target not found or inactive');
  end if;

  -- Find matching rule for this target
  select * into v_rule from public.teacher_point_rules
  where target_id = p_target_id and active = true
  order by created_at asc limit 1;

  if v_rule.id is null then
    v_rule := public.get_matching_teacher_point_rule(
      p_agency_id, v_target.source_table,
      v_target.default_event_type, v_target.default_event_subtype,
      v_target.default_behavior_name, v_target.default_behavior_category
    );
  end if;

  if v_rule.id is not null then
    v_base_points := v_rule.points;
    v_source := case when v_rule.rule_type = 'response_cost' then 'response_cost' else 'teacher_data_auto' end;
  end if;

  -- Compute final points
  if p_override_points is not null then
    v_final_points := p_override_points;
  else
    v_final_points := v_base_points + coalesce(p_point_adjustment, 0);
  end if;

  -- Route by source_table
  if v_target.source_table = 'teacher_data_events' then
    v_entry_kind := 'teacher_data_event';
    insert into public.teacher_data_events (student_id, staff_id, agency_id, classroom_id, event_type, event_subtype, source_module, recorded_at)
    values (p_student_id, p_staff_id, p_agency_id, p_classroom_id,
      coalesce(v_target.default_event_type, 'positive_action'),
      v_target.default_event_subtype, 'target_action', p_recorded_at)
    returning event_id into v_data_id;

    insert into public.beacon_points_ledger (agency_id, student_id, staff_id, points, source, reason, teacher_data_event_id, point_rule_id, entry_kind, target_id, base_points, point_adjustment, override_points)
    values (p_agency_id, p_student_id, p_staff_id, v_final_points, v_source, v_target.name, v_data_id, v_rule.id, v_entry_kind, p_target_id, v_base_points, coalesce(p_point_adjustment,0), p_override_points)
    returning id into v_ledger_id;

  elsif v_target.source_table = 'teacher_frequency_entries' then
    v_entry_kind := 'teacher_frequency';
    insert into public.teacher_frequency_entries (agency_id, client_id, user_id, behavior_name, count, logged_date, notes)
    values (p_agency_id, p_student_id, p_staff_id, coalesce(v_target.default_behavior_name, v_target.name), 1, current_date, p_notes)
    returning id into v_data_id;

    insert into public.beacon_points_ledger (agency_id, student_id, staff_id, points, source, reason, teacher_frequency_entry_id, point_rule_id, entry_kind, target_id, base_points, point_adjustment, override_points)
    values (p_agency_id, p_student_id, p_staff_id, v_final_points, v_source, v_target.name, v_data_id, v_rule.id, v_entry_kind, p_target_id, v_base_points, coalesce(p_point_adjustment,0), p_override_points)
    returning id into v_ledger_id;

  elsif v_target.source_table = 'teacher_duration_entries' then
    v_entry_kind := 'teacher_duration';
    insert into public.teacher_duration_entries (agency_id, client_id, user_id, behavior_name, duration_seconds, logged_date, notes)
    values (p_agency_id, p_student_id, p_staff_id, coalesce(v_target.default_behavior_name, v_target.name), 0, current_date, p_notes)
    returning id into v_data_id;

    insert into public.beacon_points_ledger (agency_id, student_id, staff_id, points, source, reason, teacher_duration_entry_id, point_rule_id, entry_kind, target_id, base_points, point_adjustment, override_points)
    values (p_agency_id, p_student_id, p_staff_id, v_final_points, v_source, v_target.name, v_data_id, v_rule.id, v_entry_kind, p_target_id, v_base_points, coalesce(p_point_adjustment,0), p_override_points)
    returning id into v_ledger_id;

  elsif v_target.source_table = 'abc_logs' then
    v_entry_kind := 'abc_log';
    insert into public.abc_logs (client_id, user_id, antecedent, behavior, consequence, behavior_category, logged_at)
    values (p_student_id, p_staff_id, 'Target action', coalesce(v_target.default_behavior_name, v_target.name), 'Teacher response', v_target.default_behavior_category, p_recorded_at)
    returning id into v_data_id;

    insert into public.beacon_points_ledger (agency_id, student_id, staff_id, points, source, reason, abc_log_id, point_rule_id, entry_kind, target_id, base_points, point_adjustment, override_points)
    values (p_agency_id, p_student_id, p_staff_id, v_final_points, v_source, v_target.name, v_data_id, v_rule.id, v_entry_kind, p_target_id, v_base_points, coalesce(p_point_adjustment,0), p_override_points)
    returning id into v_ledger_id;

  else
    v_entry_kind := 'manual';
    insert into public.beacon_points_ledger (agency_id, student_id, staff_id, points, source, reason, entry_kind, manual_reason_category, target_id, base_points, point_adjustment, override_points)
    values (p_agency_id, p_student_id, p_staff_id, v_final_points,
      case when v_final_points < 0 then 'response_cost' else 'manual_award' end,
      v_target.name, v_entry_kind,
      case when v_final_points < 0 then 'response_cost' else 'because' end,
      p_target_id, v_base_points, coalesce(p_point_adjustment,0), p_override_points)
    returning id into v_ledger_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'target_id', p_target_id,
    'target_name', v_target.name,
    'data_id', v_data_id,
    'ledger_id', v_ledger_id,
    'base_points', v_base_points,
    'point_adjustment', coalesce(p_point_adjustment, 0),
    'override_points', p_override_points,
    'final_points', v_final_points,
    'entry_kind', v_entry_kind,
    'rule_applied', (v_rule.id is not null)
  );
end;
$$;
