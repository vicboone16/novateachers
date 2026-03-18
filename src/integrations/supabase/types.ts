export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      abc_logs: {
        Row: {
          antecedent: string
          behavior: string
          behavior_category: string | null
          client_id: string
          consequence: string
          created_at: string
          duration_seconds: number | null
          id: string
          intensity: number | null
          logged_at: string
          notes: string | null
          user_id: string
        }
        Insert: {
          antecedent: string
          behavior: string
          behavior_category?: string | null
          client_id: string
          consequence: string
          created_at?: string
          duration_seconds?: number | null
          id?: string
          intensity?: number | null
          logged_at?: string
          notes?: string | null
          user_id: string
        }
        Update: {
          antecedent?: string
          behavior?: string
          behavior_category?: string | null
          client_id?: string
          consequence?: string
          created_at?: string
          duration_seconds?: number | null
          id?: string
          intensity?: number | null
          logged_at?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: []
      }
      agency_invite_codes: {
        Row: {
          agency_id: string
          code: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number
          role: string
          updated_at: string
          uses: number
        }
        Insert: {
          agency_id: string
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number
          role?: string
          updated_at?: string
          uses?: number
        }
        Update: {
          agency_id?: string
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number
          role?: string
          updated_at?: string
          uses?: number
        }
        Relationships: []
      }
      beacon_classroom_templates: {
        Row: {
          applied_by: string
          created_at: string
          group_id: string
          id: string
          template_id: string
        }
        Insert: {
          applied_by: string
          created_at?: string
          group_id: string
          id?: string
          template_id: string
        }
        Update: {
          applied_by?: string
          created_at?: string
          group_id?: string
          id?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "beacon_classroom_templates_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: true
            referencedRelation: "classroom_groups"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "beacon_classroom_templates_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "beacon_reinforcement_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      beacon_points_ledger: {
        Row: {
          agency_id: string
          created_at: string
          id: string
          points: number
          reason: string | null
          source: string
          source_event_id: string | null
          staff_id: string
          student_id: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          id?: string
          points: number
          reason?: string | null
          source?: string
          source_event_id?: string | null
          staff_id: string
          student_id: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          id?: string
          points?: number
          reason?: string | null
          source?: string
          source_event_id?: string | null
          staff_id?: string
          student_id?: string
        }
        Relationships: []
      }
      beacon_reinforcement_templates: {
        Row: {
          age_band: string
          agency_id: string | null
          category: string
          config: Json
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_preset: boolean
          name: string
          updated_at: string
        }
        Insert: {
          age_band?: string
          agency_id?: string | null
          category?: string
          config?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_preset?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          age_band?: string
          agency_id?: string | null
          category?: string
          config?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_preset?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      behavior_categories: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          triggers: string[] | null
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          triggers?: string[] | null
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          triggers?: string[] | null
        }
        Relationships: []
      }
      classroom_feed_posts: {
        Row: {
          agency_id: string
          author_id: string
          body: string
          created_at: string
          group_id: string
          id: string
          media_url: string | null
          pinned: boolean
          post_type: string
          title: string | null
          updated_at: string
        }
        Insert: {
          agency_id: string
          author_id: string
          body: string
          created_at?: string
          group_id: string
          id?: string
          media_url?: string | null
          pinned?: boolean
          post_type?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          agency_id?: string
          author_id?: string
          body?: string
          created_at?: string
          group_id?: string
          id?: string
          media_url?: string | null
          pinned?: boolean
          post_type?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classroom_feed_posts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "classroom_groups"
            referencedColumns: ["group_id"]
          },
        ]
      }
      classroom_group_students: {
        Row: {
          agency_id: string | null
          client_id: string
          created_at: string
          group_id: string
          id: string
        }
        Insert: {
          agency_id?: string | null
          client_id: string
          created_at?: string
          group_id: string
          id?: string
        }
        Update: {
          agency_id?: string | null
          client_id?: string
          created_at?: string
          group_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "classroom_group_students_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "classroom_groups"
            referencedColumns: ["group_id"]
          },
        ]
      }
      classroom_group_teachers: {
        Row: {
          created_at: string
          group_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "classroom_group_teachers_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "classroom_groups"
            referencedColumns: ["group_id"]
          },
        ]
      }
      classroom_groups: {
        Row: {
          agency_id: string
          created_at: string
          created_by: string
          grade_band: string | null
          group_id: string
          name: string
          school_name: string | null
          updated_at: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          created_by: string
          grade_band?: string | null
          group_id?: string
          name: string
          school_name?: string | null
          updated_at?: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          created_by?: string
          grade_band?: string | null
          group_id?: string
          name?: string
          school_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      default_reminder_schedules: {
        Row: {
          allow_user_override: boolean
          app_environment: string
          classroom_id: string | null
          created_at: string
          created_by: string | null
          days_of_week: number[] | null
          end_time: string | null
          grace_period_minutes: number | null
          id: string
          interval_minutes: number | null
          is_active: boolean
          local_enabled: boolean
          message_body: string | null
          message_title: string | null
          name: string
          organization_id: string | null
          owner_user_id: string | null
          reminder_key: string
          reminder_type: string
          remote_enabled: boolean
          role_scope: string
          school_id: string | null
          scope_type: string
          start_time: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          allow_user_override?: boolean
          app_environment?: string
          classroom_id?: string | null
          created_at?: string
          created_by?: string | null
          days_of_week?: number[] | null
          end_time?: string | null
          grace_period_minutes?: number | null
          id?: string
          interval_minutes?: number | null
          is_active?: boolean
          local_enabled?: boolean
          message_body?: string | null
          message_title?: string | null
          name: string
          organization_id?: string | null
          owner_user_id?: string | null
          reminder_key: string
          reminder_type: string
          remote_enabled?: boolean
          role_scope?: string
          school_id?: string | null
          scope_type: string
          start_time?: string | null
          timezone: string
          updated_at?: string
        }
        Update: {
          allow_user_override?: boolean
          app_environment?: string
          classroom_id?: string | null
          created_at?: string
          created_by?: string | null
          days_of_week?: number[] | null
          end_time?: string | null
          grace_period_minutes?: number | null
          id?: string
          interval_minutes?: number | null
          is_active?: boolean
          local_enabled?: boolean
          message_body?: string | null
          message_title?: string | null
          name?: string
          organization_id?: string | null
          owner_user_id?: string | null
          reminder_key?: string
          reminder_type?: string
          remote_enabled?: boolean
          role_scope?: string
          school_id?: string | null
          scope_type?: string
          start_time?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      guest_access_codes: {
        Row: {
          agency_id: string
          code: string
          created_at: string
          created_by: string
          expires_at: string
          group_id: string
          guest_name: string | null
          id: string
          is_active: boolean
          permissions: Json
        }
        Insert: {
          agency_id: string
          code: string
          created_at?: string
          created_by: string
          expires_at: string
          group_id: string
          guest_name?: string | null
          id?: string
          is_active?: boolean
          permissions?: Json
        }
        Update: {
          agency_id?: string
          code?: string
          created_at?: string
          created_by?: string
          expires_at?: string
          group_id?: string
          guest_name?: string | null
          id?: string
          is_active?: boolean
          permissions?: Json
        }
        Relationships: []
      }
      guest_data_entries: {
        Row: {
          agency_id: string
          behavior_name: string | null
          client_id: string
          collected_at: string
          created_at: string
          created_by_teacher: string
          entry_type: string
          group_id: string
          guest_code_id: string
          guest_name: string | null
          id: string
          notes: string | null
          value: number | null
        }
        Insert: {
          agency_id: string
          behavior_name?: string | null
          client_id: string
          collected_at?: string
          created_at?: string
          created_by_teacher: string
          entry_type?: string
          group_id: string
          guest_code_id: string
          guest_name?: string | null
          id?: string
          notes?: string | null
          value?: number | null
        }
        Update: {
          agency_id?: string
          behavior_name?: string | null
          client_id?: string
          collected_at?: string
          created_at?: string
          created_by_teacher?: string
          entry_type?: string
          group_id?: string
          guest_code_id?: string
          guest_name?: string | null
          id?: string
          notes?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "guest_data_entries_guest_code_id_fkey"
            columns: ["guest_code_id"]
            isOneToOne: false
            referencedRelation: "guest_access_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      iep_documents: {
        Row: {
          agency_id: string
          created_at: string
          file_name: string
          file_size_bytes: number | null
          file_url: string
          global_issues: Json | null
          id: string
          iep_cycle_end: string | null
          iep_cycle_start: string | null
          ocr_cleaned_text: string | null
          ocr_confidence: number | null
          ocr_raw_text: string | null
          pipeline_error: string | null
          pipeline_status: string
          sections_detected: Json | null
          student_id: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          file_name: string
          file_size_bytes?: number | null
          file_url: string
          global_issues?: Json | null
          id?: string
          iep_cycle_end?: string | null
          iep_cycle_start?: string | null
          ocr_cleaned_text?: string | null
          ocr_confidence?: number | null
          ocr_raw_text?: string | null
          pipeline_error?: string | null
          pipeline_status?: string
          sections_detected?: Json | null
          student_id: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          file_name?: string
          file_size_bytes?: number | null
          file_url?: string
          global_issues?: Json | null
          id?: string
          iep_cycle_end?: string | null
          iep_cycle_start?: string | null
          ocr_cleaned_text?: string | null
          ocr_confidence?: number | null
          ocr_raw_text?: string | null
          pipeline_error?: string | null
          pipeline_status?: string
          sections_detected?: Json | null
          student_id?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: []
      }
      iep_extracted_accommodations: {
        Row: {
          accommodation_data: Json
          approved_at: string | null
          approved_by: string | null
          created_at: string
          document_id: string
          id: string
          is_approved: boolean
        }
        Insert: {
          accommodation_data?: Json
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          document_id: string
          id?: string
          is_approved?: boolean
        }
        Update: {
          accommodation_data?: Json
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          document_id?: string
          id?: string
          is_approved?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "iep_extracted_accommodations_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "iep_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      iep_extracted_goals: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          document_id: string
          goal_data: Json
          goal_key: string
          id: string
          is_approved: boolean
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          document_id: string
          goal_data?: Json
          goal_key: string
          id?: string
          is_approved?: boolean
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          document_id?: string
          goal_data?: Json
          goal_key?: string
          id?: string
          is_approved?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "iep_extracted_goals_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "iep_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      iep_extracted_progress: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          document_id: string
          id: string
          is_approved: boolean
          link_confidence: number | null
          linked_goal_id: string | null
          progress_data: Json
          progress_key: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          document_id: string
          id?: string
          is_approved?: boolean
          link_confidence?: number | null
          linked_goal_id?: string | null
          progress_data?: Json
          progress_key: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          document_id?: string
          id?: string
          is_approved?: boolean
          link_confidence?: number | null
          linked_goal_id?: string | null
          progress_data?: Json
          progress_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "iep_extracted_progress_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "iep_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iep_extracted_progress_linked_goal_id_fkey"
            columns: ["linked_goal_id"]
            isOneToOne: false
            referencedRelation: "iep_extracted_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      iep_extracted_services: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          document_id: string
          id: string
          is_approved: boolean
          service_data: Json
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          document_id: string
          id?: string
          is_approved?: boolean
          service_data?: Json
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          document_id?: string
          id?: string
          is_approved?: boolean
          service_data?: Json
        }
        Relationships: [
          {
            foreignKeyName: "iep_extracted_services_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "iep_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_codes: {
        Row: {
          agency_id: string
          app_context: string
          code: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          invite_scope: string
          max_uses: number
          revoked_at: string | null
          role_slug: string
          target_email: string | null
          uses_count: number
        }
        Insert: {
          agency_id: string
          app_context: string
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          invite_scope: string
          max_uses?: number
          revoked_at?: string | null
          role_slug: string
          target_email?: string | null
          uses_count?: number
        }
        Update: {
          agency_id?: string
          app_context?: string
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          invite_scope?: string
          max_uses?: number
          revoked_at?: string | null
          role_slug?: string
          target_email?: string | null
          uses_count?: number
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          admin_alerts: boolean
          caregiver_messages: boolean
          created_at: string
          data_log_reminders: boolean
          escalation_alerts: boolean
          id: string
          local_reminders_enabled: boolean
          push_enabled: boolean
          quiet_hours_enabled: boolean
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          session_note_reminders: boolean
          supervision_reminders: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_alerts?: boolean
          caregiver_messages?: boolean
          created_at?: string
          data_log_reminders?: boolean
          escalation_alerts?: boolean
          id?: string
          local_reminders_enabled?: boolean
          push_enabled?: boolean
          quiet_hours_enabled?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          session_note_reminders?: boolean
          supervision_reminders?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_alerts?: boolean
          caregiver_messages?: boolean
          created_at?: string
          data_log_reminders?: boolean
          escalation_alerts?: boolean
          id?: string
          local_reminders_enabled?: boolean
          push_enabled?: boolean
          quiet_hours_enabled?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          session_note_reminders?: boolean
          supervision_reminders?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          app_environment: string
          body: string
          created_at: string
          delivery_channel: string
          error_message: string | null
          id: string
          related_event_id: string | null
          related_schedule_id: string | null
          related_student_id: string | null
          sent_at: string | null
          status: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          app_environment?: string
          body: string
          created_at?: string
          delivery_channel?: string
          error_message?: string | null
          id?: string
          related_event_id?: string | null
          related_schedule_id?: string | null
          related_student_id?: string | null
          sent_at?: string | null
          status?: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          app_environment?: string
          body?: string
          created_at?: string
          delivery_channel?: string
          error_message?: string | null
          id?: string
          related_event_id?: string | null
          related_schedule_id?: string | null
          related_student_id?: string | null
          sent_at?: string | null
          status?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_related_schedule_id_fkey"
            columns: ["related_schedule_id"]
            isOneToOne: false
            referencedRelation: "default_reminder_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_schedule_id_fkey"
            columns: ["related_schedule_id"]
            isOneToOne: false
            referencedRelation: "default_reminder_scope_rank"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_schedule_id_fkey"
            columns: ["related_schedule_id"]
            isOneToOne: false
            referencedRelation: "effective_user_reminders"
            referencedColumns: ["default_schedule_id"]
          },
        ]
      }
      pending_student_changes: {
        Row: {
          agency_id: string
          change_type: string
          client_id: string
          created_at: string
          field_changes: Json
          id: string
          requested_by: string
          review_comment: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          agency_id: string
          change_type?: string
          client_id: string
          created_at?: string
          field_changes?: Json
          id?: string
          requested_by: string
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          agency_id?: string
          change_type?: string
          client_id?: string
          created_at?: string
          field_changes?: Json
          id?: string
          requested_by?: string
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          app_environment: string
          created_at: string
          device_name: string | null
          device_token: string
          id: string
          is_active: boolean
          last_seen_at: string | null
          platform: string
          timezone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          app_environment?: string
          created_at?: string
          device_name?: string | null
          device_token: string
          id?: string
          is_active?: boolean
          last_seen_at?: string | null
          platform: string
          timezone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          app_environment?: string
          created_at?: string
          device_name?: string | null
          device_token?: string
          id?: string
          is_active?: boolean
          last_seen_at?: string | null
          platform?: string
          timezone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      teacher_data_events: {
        Row: {
          agency_id: string | null
          classroom_id: string | null
          event_id: string
          event_subtype: string | null
          event_type: string
          event_value: Json | null
          metadata: Json | null
          recorded_at: string | null
          source_module: string | null
          staff_id: string | null
          student_id: string
        }
        Insert: {
          agency_id?: string | null
          classroom_id?: string | null
          event_id?: string
          event_subtype?: string | null
          event_type: string
          event_value?: Json | null
          metadata?: Json | null
          recorded_at?: string | null
          source_module?: string | null
          staff_id?: string | null
          student_id: string
        }
        Update: {
          agency_id?: string | null
          classroom_id?: string | null
          event_id?: string
          event_subtype?: string | null
          event_type?: string
          event_value?: Json | null
          metadata?: Json | null
          recorded_at?: string | null
          source_module?: string | null
          staff_id?: string | null
          student_id?: string
        }
        Relationships: []
      }
      teacher_duration_entries: {
        Row: {
          agency_id: string
          behavior_name: string
          client_id: string
          created_at: string
          duration_seconds: number
          id: string
          logged_date: string
          notes: string | null
          target_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          agency_id: string
          behavior_name: string
          client_id: string
          created_at?: string
          duration_seconds?: number
          id?: string
          logged_date?: string
          notes?: string | null
          target_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          agency_id?: string
          behavior_name?: string
          client_id?: string
          created_at?: string
          duration_seconds?: number
          id?: string
          logged_date?: string
          notes?: string | null
          target_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      teacher_frequency_entries: {
        Row: {
          agency_id: string
          behavior_name: string
          client_id: string
          count: number
          created_at: string
          id: string
          logged_date: string
          notes: string | null
          target_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          agency_id: string
          behavior_name: string
          client_id: string
          count?: number
          created_at?: string
          id?: string
          logged_date?: string
          notes?: string | null
          target_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          agency_id?: string
          behavior_name?: string
          client_id?: string
          count?: number
          created_at?: string
          id?: string
          logged_date?: string
          notes?: string | null
          target_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      teacher_interval_settings: {
        Row: {
          active: boolean | null
          agency_id: string | null
          allow_snooze: boolean | null
          applies_during_blocks: Json | null
          classroom_group_id: string | null
          classroom_id: string | null
          created_at: string | null
          interval_minutes: number | null
          is_paused: boolean | null
          pause_until: string | null
          prompts_enabled: boolean | null
          setting_id: string
          snooze_minutes: number | null
          student_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          active?: boolean | null
          agency_id?: string | null
          allow_snooze?: boolean | null
          applies_during_blocks?: Json | null
          classroom_group_id?: string | null
          classroom_id?: string | null
          created_at?: string | null
          interval_minutes?: number | null
          is_paused?: boolean | null
          pause_until?: string | null
          prompts_enabled?: boolean | null
          setting_id?: string
          snooze_minutes?: number | null
          student_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          active?: boolean | null
          agency_id?: string | null
          allow_snooze?: boolean | null
          applies_during_blocks?: Json | null
          classroom_group_id?: string | null
          classroom_id?: string | null
          created_at?: string | null
          interval_minutes?: number | null
          is_paused?: boolean | null
          pause_until?: string | null
          prompts_enabled?: boolean | null
          setting_id?: string
          snooze_minutes?: number | null
          student_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      teacher_message_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size_bytes: number | null
          file_type: string | null
          file_url: string
          id: string
          message_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size_bytes?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          message_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size_bytes?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_message_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "teacher_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_messages: {
        Row: {
          agency_id: string
          body: string
          client_id: string | null
          created_at: string
          id: string
          is_read: boolean
          message_type: string
          metadata: Json | null
          parent_id: string | null
          read_at: string | null
          recipient_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          sender_id: string
          status: string
          subject: string | null
          thread_id: string | null
          updated_at: string
        }
        Insert: {
          agency_id: string
          body: string
          client_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message_type?: string
          metadata?: Json | null
          parent_id?: string | null
          read_at?: string | null
          recipient_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          sender_id: string
          status?: string
          subject?: string | null
          thread_id?: string | null
          updated_at?: string
        }
        Update: {
          agency_id?: string
          body?: string
          client_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message_type?: string
          metadata?: Json | null
          parent_id?: string | null
          read_at?: string | null
          recipient_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          sender_id?: string
          status?: string
          subject?: string | null
          thread_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_messages_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "teacher_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_quick_notes: {
        Row: {
          agency_id: string
          behavior_name: string | null
          client_id: string
          created_at: string
          id: string
          logged_at: string
          note: string
          target_id: string | null
          user_id: string
        }
        Insert: {
          agency_id: string
          behavior_name?: string | null
          client_id: string
          created_at?: string
          id?: string
          logged_at?: string
          note: string
          target_id?: string | null
          user_id: string
        }
        Update: {
          agency_id?: string
          behavior_name?: string | null
          client_id?: string
          created_at?: string
          id?: string
          logged_at?: string
          note?: string
          target_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      teacher_reminder_schedules: {
        Row: {
          app_environment: string
          classroom_id: string | null
          created_at: string
          days_of_week: number[] | null
          end_time: string | null
          grace_period_minutes: number | null
          id: string
          interval_minutes: number | null
          is_active: boolean
          message_body: string | null
          message_title: string | null
          name: string
          reminder_type: string
          school_id: string | null
          start_time: string | null
          student_id: string | null
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          app_environment?: string
          classroom_id?: string | null
          created_at?: string
          days_of_week?: number[] | null
          end_time?: string | null
          grace_period_minutes?: number | null
          id?: string
          interval_minutes?: number | null
          is_active?: boolean
          message_body?: string | null
          message_title?: string | null
          name: string
          reminder_type: string
          school_id?: string | null
          start_time?: string | null
          student_id?: string | null
          timezone: string
          updated_at?: string
          user_id: string
        }
        Update: {
          app_environment?: string
          classroom_id?: string | null
          created_at?: string
          days_of_week?: number[] | null
          end_time?: string | null
          grace_period_minutes?: number | null
          id?: string
          interval_minutes?: number | null
          is_active?: boolean
          message_body?: string | null
          message_title?: string | null
          name?: string
          reminder_type?: string
          school_id?: string | null
          start_time?: string | null
          student_id?: string | null
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      teacher_weekly_summaries: {
        Row: {
          abc_summary: Json | null
          agency_id: string
          behavior_summary: Json | null
          duration_summary: Json | null
          engagement_summary: Json | null
          generated_at: string | null
          probe_summary: Json | null
          reliability_summary: Json | null
          reviewed_at: string | null
          sent_at: string | null
          sent_to: string[] | null
          staff_id: string
          status: string
          student_id: string
          summary_id: string
          trigger_summary: Json | null
          week_end: string
          week_start: string
        }
        Insert: {
          abc_summary?: Json | null
          agency_id: string
          behavior_summary?: Json | null
          duration_summary?: Json | null
          engagement_summary?: Json | null
          generated_at?: string | null
          probe_summary?: Json | null
          reliability_summary?: Json | null
          reviewed_at?: string | null
          sent_at?: string | null
          sent_to?: string[] | null
          staff_id: string
          status?: string
          student_id: string
          summary_id?: string
          trigger_summary?: Json | null
          week_end: string
          week_start: string
        }
        Update: {
          abc_summary?: Json | null
          agency_id?: string
          behavior_summary?: Json | null
          duration_summary?: Json | null
          engagement_summary?: Json | null
          generated_at?: string | null
          probe_summary?: Json | null
          reliability_summary?: Json | null
          reviewed_at?: string | null
          sent_at?: string | null
          sent_to?: string[] | null
          staff_id?: string
          status?: string
          student_id?: string
          summary_id?: string
          trigger_summary?: Json | null
          week_end?: string
          week_start?: string
        }
        Relationships: []
      }
      user_reminder_overrides: {
        Row: {
          created_at: string
          custom_days_of_week: number[] | null
          custom_end_time: string | null
          custom_interval_minutes: number | null
          custom_name: string | null
          custom_start_time: string | null
          custom_timezone: string | null
          default_schedule_id: string
          id: string
          is_active: boolean
          local_enabled: boolean | null
          notifications_enabled: boolean
          override_enabled: boolean
          remote_enabled: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          custom_days_of_week?: number[] | null
          custom_end_time?: string | null
          custom_interval_minutes?: number | null
          custom_name?: string | null
          custom_start_time?: string | null
          custom_timezone?: string | null
          default_schedule_id: string
          id?: string
          is_active?: boolean
          local_enabled?: boolean | null
          notifications_enabled?: boolean
          override_enabled?: boolean
          remote_enabled?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          custom_days_of_week?: number[] | null
          custom_end_time?: string | null
          custom_interval_minutes?: number | null
          custom_name?: string | null
          custom_start_time?: string | null
          custom_timezone?: string | null
          default_schedule_id?: string
          id?: string
          is_active?: boolean
          local_enabled?: boolean | null
          notifications_enabled?: boolean
          override_enabled?: boolean
          remote_enabled?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_reminder_overrides_default_schedule_id_fkey"
            columns: ["default_schedule_id"]
            isOneToOne: false
            referencedRelation: "default_reminder_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_reminder_overrides_default_schedule_id_fkey"
            columns: ["default_schedule_id"]
            isOneToOne: false
            referencedRelation: "default_reminder_scope_rank"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_reminder_overrides_default_schedule_id_fkey"
            columns: ["default_schedule_id"]
            isOneToOne: false
            referencedRelation: "effective_user_reminders"
            referencedColumns: ["default_schedule_id"]
          },
        ]
      }
    }
    Views: {
      default_reminder_scope_rank: {
        Row: {
          allow_user_override: boolean | null
          app_environment: string | null
          classroom_id: string | null
          created_at: string | null
          created_by: string | null
          days_of_week: number[] | null
          end_time: string | null
          grace_period_minutes: number | null
          id: string | null
          interval_minutes: number | null
          is_active: boolean | null
          local_enabled: boolean | null
          message_body: string | null
          message_title: string | null
          name: string | null
          organization_id: string | null
          owner_user_id: string | null
          reminder_key: string | null
          reminder_type: string | null
          remote_enabled: boolean | null
          role_scope: string | null
          school_id: string | null
          scope_rank: number | null
          scope_type: string | null
          start_time: string | null
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          allow_user_override?: boolean | null
          app_environment?: string | null
          classroom_id?: string | null
          created_at?: string | null
          created_by?: string | null
          days_of_week?: number[] | null
          end_time?: string | null
          grace_period_minutes?: number | null
          id?: string | null
          interval_minutes?: number | null
          is_active?: boolean | null
          local_enabled?: boolean | null
          message_body?: string | null
          message_title?: string | null
          name?: string | null
          organization_id?: string | null
          owner_user_id?: string | null
          reminder_key?: string | null
          reminder_type?: string | null
          remote_enabled?: boolean | null
          role_scope?: string | null
          school_id?: string | null
          scope_rank?: never
          scope_type?: string | null
          start_time?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          allow_user_override?: boolean | null
          app_environment?: string | null
          classroom_id?: string | null
          created_at?: string | null
          created_by?: string | null
          days_of_week?: number[] | null
          end_time?: string | null
          grace_period_minutes?: number | null
          id?: string | null
          interval_minutes?: number | null
          is_active?: boolean | null
          local_enabled?: boolean | null
          message_body?: string | null
          message_title?: string | null
          name?: string | null
          organization_id?: string | null
          owner_user_id?: string | null
          reminder_key?: string | null
          reminder_type?: string | null
          remote_enabled?: boolean | null
          role_scope?: string | null
          school_id?: string | null
          scope_rank?: never
          scope_type?: string | null
          start_time?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      effective_user_reminders: {
        Row: {
          admin_alerts: boolean | null
          allow_user_override: boolean | null
          app_environment: string | null
          caregiver_messages: boolean | null
          data_log_reminders: boolean | null
          default_name: string | null
          default_schedule_id: string | null
          effective_days_of_week: number[] | null
          effective_enabled: boolean | null
          effective_end_time: string | null
          effective_interval_minutes: number | null
          effective_local_enabled: boolean | null
          effective_name: string | null
          effective_remote_enabled: boolean | null
          effective_start_time: string | null
          effective_timezone: string | null
          escalation_alerts: boolean | null
          grace_period_minutes: number | null
          local_reminders_enabled: boolean | null
          message_body: string | null
          message_title: string | null
          notifications_enabled: boolean | null
          override_enabled: boolean | null
          override_id: string | null
          push_enabled: boolean | null
          quiet_hours_enabled: boolean | null
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          reminder_key: string | null
          reminder_type: string | null
          session_note_reminders: boolean | null
          source_scope_type: string | null
          supervision_reminders: boolean | null
          user_id: string | null
        }
        Relationships: []
      }
      v_student_points_balance: {
        Row: {
          agency_id: string | null
          balance: number | null
          last_activity: string | null
          student_id: string | null
          total_earned: number | null
          total_earned_count: number | null
          total_spent: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      apply_invite_code_access: {
        Args: {
          p_code: string
          p_expected_app_context: string
          p_redeemer_id: string
        }
        Returns: Json
      }
      create_invite_code:
        | {
            Args: {
              p_agency_id: string
              p_app_context: string
              p_created_by: string
              p_expires_at: string
              p_invite_scope: string
              p_max_uses: number
              p_role_slug: string
              p_target_email: string
            }
            Returns: {
              expires_at: string
              invite_code: string
              invite_id: string
              max_uses: number
            }[]
          }
        | {
            Args: {
              p_agency_id: string
              p_app_context?: string
              p_auto_assign_groups?: string[]
              p_client_id?: string
              p_created_by?: string
              p_expires_at?: string
              p_group_id?: string
              p_invite_scope?: string
              p_max_uses?: number
              p_permissions?: Json
              p_role_slug?: string
              p_target_email?: string
            }
            Returns: string
          }
      redeem_invite_code: {
        Args: {
          p_code: string
          p_expected_app_context: string
          p_redeemer_id: string
        }
        Returns: {
          agency_id: string
          app_context: string
          client_id: string
          invite_id: string
          invite_scope: string
          message: string
          redeemed: boolean
          role_slug: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
