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
  status: 'draft' | 'review' | 'final';
  created_at: string;
  updated_at: string;
}

export interface IEPSection {
  id: string;
  type: 'present_levels' | 'goals' | 'accommodations' | 'services' | 'transition' | 'custom';
  title: string;
  content: string;
  order: number;
}

export interface UserPermissions {
  can_collect_data: boolean;
  can_view_notes: boolean;
  can_generate_reports: boolean;
}
