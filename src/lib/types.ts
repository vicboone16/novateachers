export interface Agency {
  id: string;
  name: string;
  agency_type: string;
}

export interface AgencyMembership {
  id: string;
  agency_id: string;
  user_id: string;
  role: string;
  agency: Agency;
}

export interface Workspace {
  id: string;
  name: string;
  agency_id: string;
  mode: 'solo' | 'connected';
}

export interface Client {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth?: string;
  grade?: string;
  agency_id: string;
  school_name?: string;
  district_name?: string;
  primary_setting?: string;
  iep_date?: string;
  next_iep_review_date?: string;
  diagnoses?: string[];
  funding_mode?: string;
  student_origin?: string;
  created_in_app?: string;
  created_at: string;
  updated_at: string;
}

export interface ClientAccess {
  id: string;
  user_id: string;
  client_id: string;
  can_collect_data: boolean;
  can_view_notes: boolean;
  can_generate_reports: boolean;
  client: Client;
}

export interface ABCLog {
  id: string;
  client_id: string;
  user_id: string;
  antecedent: string;
  behavior: string;
  consequence: string;
  behavior_category?: string;
  intensity?: number;
  duration_seconds?: number;
  notes?: string;
  logged_at: string;
  created_at: string;
}

export interface BehaviorCategory {
  id: string;
  client_id: string;
  name: string;
  description?: string;
  triggers?: string[];
  created_at: string;
}

export interface IEPDraft {
  id: string;
  client_id: string;
  user_id: string;
  title: string;
  sections: IEPSection[];
  status: 'draft' | 'review' | 'final' | 'shared';
  shared_at?: string;
  shared_by?: string;
  agency_id?: string;
  draft_type?: string;
  content?: string;
  content_json?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface IEPSection {
  id: string;
  type: 'present_levels' | 'goals' | 'accommodations' | 'services' | 'transition' | 'behavior_impact' | 'custom';
  title: string;
  content: string;
  order: number;
}

export interface UserPermissions {
  can_collect_data: boolean;
  can_view_notes: boolean;
  can_generate_reports: boolean;
}

// ── Teacher Data Collection ──

export interface TeacherTarget {
  id: string;
  agency_id: string;
  client_id: string;
  name: string;
  description?: string;
  target_type: 'behavior' | 'skill';
  created_by: string;
  created_at: string;
}

export type DataCollectionMode =
  | 'tally'
  | 'mts'
  | 'partial_interval'
  | 'whole_interval'
  | 'duration'
  | 'latency'
  | 'rating'
  | 'abc_narrative';

export interface TeacherDataSession {
  id: string;
  agency_id: string;
  client_id: string;
  user_id: string;
  target_id?: string;
  mode: DataCollectionMode;
  started_at: string;
  ended_at?: string;
  interval_seconds?: number;
  summary_json?: Record<string, any>;
  notes?: string;
  created_at: string;
}

export interface TeacherDataPoint {
  id: string;
  session_id: string;
  value: number;
  interval_index?: number;
  occurred_at: string;
  label?: string;
}

export const DATA_MODE_LABELS: Record<DataCollectionMode, string> = {
  tally: 'Tally (Frequency)',
  mts: 'Momentary Time Sampling',
  partial_interval: 'Partial Interval',
  whole_interval: 'Whole Interval',
  duration: 'Duration',
  latency: 'Latency',
  rating: 'Rating Scale (1–5)',
  abc_narrative: 'ABC Narrative',
};
