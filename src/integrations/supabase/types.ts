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
    }
    Views: {
      [_ in never]: never
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
