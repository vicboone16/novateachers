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
      admin_audit_log: {
        Row: {
          action_category: string
          action_type: string
          agency_id: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action_category?: string
          action_type: string
          agency_id: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action_category?: string
          action_type?: string
          agency_id?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          user_id?: string | null
          user_name?: string | null
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
          abc_log_id: string | null
          agency_id: string
          base_points: number | null
          created_at: string
          entry_kind: string | null
          id: string
          is_reversal: boolean
          manual_reason_category: string | null
          override_points: number | null
          point_adjustment: number
          point_rule_id: string | null
          points: number
          reason: string | null
          reversal_of_ledger_id: string | null
          source: string
          source_event_id: string | null
          staff_id: string
          student_id: string
          target_id: string | null
          teacher_data_event_id: string | null
          teacher_duration_entry_id: string | null
          teacher_frequency_entry_id: string | null
        }
        Insert: {
          abc_log_id?: string | null
          agency_id: string
          base_points?: number | null
          created_at?: string
          entry_kind?: string | null
          id?: string
          is_reversal?: boolean
          manual_reason_category?: string | null
          override_points?: number | null
          point_adjustment?: number
          point_rule_id?: string | null
          points: number
          reason?: string | null
          reversal_of_ledger_id?: string | null
          source?: string
          source_event_id?: string | null
          staff_id: string
          student_id: string
          target_id?: string | null
          teacher_data_event_id?: string | null
          teacher_duration_entry_id?: string | null
          teacher_frequency_entry_id?: string | null
        }
        Update: {
          abc_log_id?: string | null
          agency_id?: string
          base_points?: number | null
          created_at?: string
          entry_kind?: string | null
          id?: string
          is_reversal?: boolean
          manual_reason_category?: string | null
          override_points?: number | null
          point_adjustment?: number
          point_rule_id?: string | null
          points?: number
          reason?: string | null
          reversal_of_ledger_id?: string | null
          source?: string
          source_event_id?: string | null
          staff_id?: string
          student_id?: string
          target_id?: string | null
          teacher_data_event_id?: string | null
          teacher_duration_entry_id?: string | null
          teacher_frequency_entry_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "beacon_points_ledger_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "teacher_targets"
            referencedColumns: ["id"]
          },
        ]
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
      beacon_reward_redemptions: {
        Row: {
          agency_id: string
          created_at: string
          id: string
          points_spent: number
          redeemed_at: string
          reward_id: string
          staff_id: string
          status: string
          student_id: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          id?: string
          points_spent: number
          redeemed_at?: string
          reward_id: string
          staff_id: string
          status?: string
          student_id: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          id?: string
          points_spent?: number
          redeemed_at?: string
          reward_id?: string
          staff_id?: string
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "beacon_reward_redemptions_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "beacon_rewards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beacon_reward_redemptions_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "v_reward_store"
            referencedColumns: ["id"]
          },
        ]
      }
      beacon_rewards: {
        Row: {
          active: boolean
          agency_id: string | null
          base_cost: number | null
          category: string
          cost: number
          created_at: string
          created_by: string | null
          current_dynamic_price: number | null
          description: string | null
          dynamic_pricing_enabled: boolean
          emoji: string
          id: string
          image_url: string | null
          inventory_enabled: boolean
          last_price_update: string | null
          max_cost: number | null
          metadata_json: Json | null
          min_cost: number | null
          name: string
          redemption_count_24h: number
          reward_type: string
          scope_id: string
          scope_type: string
          sort_order: number
          stock_count: number | null
          tier: string
          time_sensitive_until: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          agency_id?: string | null
          base_cost?: number | null
          category?: string
          cost?: number
          created_at?: string
          created_by?: string | null
          current_dynamic_price?: number | null
          description?: string | null
          dynamic_pricing_enabled?: boolean
          emoji?: string
          id?: string
          image_url?: string | null
          inventory_enabled?: boolean
          last_price_update?: string | null
          max_cost?: number | null
          metadata_json?: Json | null
          min_cost?: number | null
          name: string
          redemption_count_24h?: number
          reward_type?: string
          scope_id: string
          scope_type?: string
          sort_order?: number
          stock_count?: number | null
          tier?: string
          time_sensitive_until?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          agency_id?: string | null
          base_cost?: number | null
          category?: string
          cost?: number
          created_at?: string
          created_by?: string | null
          current_dynamic_price?: number | null
          description?: string | null
          dynamic_pricing_enabled?: boolean
          emoji?: string
          id?: string
          image_url?: string | null
          inventory_enabled?: boolean
          last_price_update?: string | null
          max_cost?: number | null
          metadata_json?: Json | null
          min_cost?: number | null
          name?: string
          redemption_count_24h?: number
          reward_type?: string
          scope_id?: string
          scope_type?: string
          sort_order?: number
          stock_count?: number | null
          tier?: string
          time_sensitive_until?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      beacon_student_day_state: {
        Row: {
          classroom_id: string | null
          created_at: string
          day_state: string
          id: string
          notes: string | null
          selected_by: string | null
          selected_by_user_id: string | null
          state_date: string
          student_id: string
          updated_at: string
        }
        Insert: {
          classroom_id?: string | null
          created_at?: string
          day_state: string
          id?: string
          notes?: string | null
          selected_by?: string | null
          selected_by_user_id?: string | null
          state_date?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          classroom_id?: string | null
          created_at?: string
          day_state?: string
          id?: string
          notes?: string | null
          selected_by?: string | null
          selected_by_user_id?: string | null
          state_date?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      beacon_teacher_feedback: {
        Row: {
          classroom_id: string | null
          created_at: string
          feedback_date: string
          id: string
          selected_day_state: string | null
          sent_to_nova: boolean
          student_id: string
          summary: string | null
          teacher_name: string | null
        }
        Insert: {
          classroom_id?: string | null
          created_at?: string
          feedback_date?: string
          id?: string
          selected_day_state?: string | null
          sent_to_nova?: boolean
          student_id: string
          summary?: string | null
          teacher_name?: string | null
        }
        Update: {
          classroom_id?: string | null
          created_at?: string
          feedback_date?: string
          id?: string
          selected_day_state?: string | null
          sent_to_nova?: boolean
          student_id?: string
          summary?: string | null
          teacher_name?: string | null
        }
        Relationships: []
      }
      beacon_teacher_plans: {
        Row: {
          antecedents: Json
          classroom_id: string | null
          created_at: string
          created_by: string | null
          day_state: string
          id: string
          plan_date: string
          reactives: Json
          reinforcement: string | null
          selected_program_ids: Json
          student_id: string
          targets: Json
          teacher_summary: string | null
          updated_at: string
        }
        Insert: {
          antecedents?: Json
          classroom_id?: string | null
          created_at?: string
          created_by?: string | null
          day_state: string
          id?: string
          plan_date?: string
          reactives?: Json
          reinforcement?: string | null
          selected_program_ids?: Json
          student_id: string
          targets?: Json
          teacher_summary?: string | null
          updated_at?: string
        }
        Update: {
          antecedents?: Json
          classroom_id?: string | null
          created_at?: string
          created_by?: string | null
          day_state?: string
          id?: string
          plan_date?: string
          reactives?: Json
          reinforcement?: string | null
          selected_program_ids?: Json
          student_id?: string
          targets?: Json
          teacher_summary?: string | null
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
      classroom_board_settings: {
        Row: {
          agency_id: string | null
          class_goal_current: number | null
          class_goal_label: string | null
          class_goal_target: number | null
          classroom_id: string
          created_at: string
          created_by: string | null
          id: string
          mission_text: string | null
          show_leaderboard: boolean | null
          show_token_boards: boolean | null
          theme_slug: string | null
          updated_at: string
          word_of_week: string | null
        }
        Insert: {
          agency_id?: string | null
          class_goal_current?: number | null
          class_goal_label?: string | null
          class_goal_target?: number | null
          classroom_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          mission_text?: string | null
          show_leaderboard?: boolean | null
          show_token_boards?: boolean | null
          theme_slug?: string | null
          updated_at?: string
          word_of_week?: string | null
        }
        Update: {
          agency_id?: string | null
          class_goal_current?: number | null
          class_goal_label?: string | null
          class_goal_target?: number | null
          classroom_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          mission_text?: string | null
          show_leaderboard?: boolean | null
          show_token_boards?: boolean | null
          theme_slug?: string | null
          updated_at?: string
          word_of_week?: string | null
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
      classroom_game_settings: {
        Row: {
          agency_id: string
          allow_team_mode: boolean
          created_at: string
          game_mode: string
          group_id: string
          id: string
          mode_id: string | null
          show_avatars: boolean
          show_leaderboard: boolean
          theme_id: string | null
          total_steps: number
          track_id: string | null
          updated_at: string
        }
        Insert: {
          agency_id: string
          allow_team_mode?: boolean
          created_at?: string
          game_mode?: string
          group_id: string
          id?: string
          mode_id?: string | null
          show_avatars?: boolean
          show_leaderboard?: boolean
          theme_id?: string | null
          total_steps?: number
          track_id?: string | null
          updated_at?: string
        }
        Update: {
          agency_id?: string
          allow_team_mode?: boolean
          created_at?: string
          game_mode?: string
          group_id?: string
          id?: string
          mode_id?: string | null
          show_avatars?: boolean
          show_leaderboard?: boolean
          theme_id?: string | null
          total_steps?: number
          track_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classroom_game_settings_mode_id_fkey"
            columns: ["mode_id"]
            isOneToOne: false
            referencedRelation: "game_modes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classroom_game_settings_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "game_themes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classroom_game_settings_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "game_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      classroom_group_students: {
        Row: {
          agency_id: string | null
          client_id: string
          created_at: string
          first_name: string | null
          group_id: string
          id: string
          last_name: string | null
        }
        Insert: {
          agency_id?: string | null
          client_id: string
          created_at?: string
          first_name?: string | null
          group_id: string
          id?: string
          last_name?: string | null
        }
        Update: {
          agency_id?: string | null
          client_id?: string
          created_at?: string
          first_name?: string | null
          group_id?: string
          id?: string
          last_name?: string | null
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
          staff_role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          staff_role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          staff_role?: string
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
          board_slug: string | null
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
          board_slug?: string | null
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
          board_slug?: string | null
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
      classroom_public_links: {
        Row: {
          agency_id: string
          created_at: string
          group_id: string
          id: string
          is_active: boolean
          slug: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          group_id: string
          id?: string
          is_active?: boolean
          slug: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          group_id?: string
          id?: string
          is_active?: boolean
          slug?: string
        }
        Relationships: []
      }
      classroom_quest_templates: {
        Row: {
          agency_id: string
          created_at: string | null
          created_by: string | null
          description: string | null
          group_id: string | null
          id: string
          is_active: boolean | null
          quest_category: string | null
          quest_type: string
          reward_points: number | null
          reward_unlock_id: string | null
          target_value: number | null
          title: string
          updated_at: string | null
        }
        Insert: {
          agency_id: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          group_id?: string | null
          id?: string
          is_active?: boolean | null
          quest_category?: string | null
          quest_type?: string
          reward_points?: number | null
          reward_unlock_id?: string | null
          target_value?: number | null
          title: string
          updated_at?: string | null
        }
        Update: {
          agency_id?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          group_id?: string | null
          id?: string
          is_active?: boolean | null
          quest_category?: string | null
          quest_type?: string
          reward_points?: number | null
          reward_unlock_id?: string | null
          target_value?: number | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      classroom_settings: {
        Row: {
          agency_id: string
          created_at: string
          group_id: string
          id: string
          mission_text: string | null
          point_goal: number
          point_goal_label: string
          updated_at: string
          word_of_week: string | null
        }
        Insert: {
          agency_id: string
          created_at?: string
          group_id: string
          id?: string
          mission_text?: string | null
          point_goal?: number
          point_goal_label?: string
          updated_at?: string
          word_of_week?: string | null
        }
        Update: {
          agency_id?: string
          created_at?: string
          group_id?: string
          id?: string
          mission_text?: string | null
          point_goal?: number
          point_goal_label?: string
          updated_at?: string
          word_of_week?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classroom_settings_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: true
            referencedRelation: "classroom_groups"
            referencedColumns: ["group_id"]
          },
        ]
      }
      classroom_team_members: {
        Row: {
          created_at: string
          group_id: string
          id: string
          student_id: string
          team_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          student_id: string
          team_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          student_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "classroom_team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "classroom_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classroom_team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "v_classroom_team_scores"
            referencedColumns: ["team_id"]
          },
        ]
      }
      classroom_teams: {
        Row: {
          agency_id: string
          created_at: string
          group_id: string
          id: string
          sort_order: number
          team_color: string
          team_icon: string
          team_name: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          group_id: string
          id?: string
          sort_order?: number
          team_color?: string
          team_icon?: string
          team_name: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          group_id?: string
          id?: string
          sort_order?: number
          team_color?: string
          team_icon?: string
          team_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "classroom_teams_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "classroom_groups"
            referencedColumns: ["group_id"]
          },
        ]
      }
      cosmetic_catalog: {
        Row: {
          agency_id: string | null
          category: string
          created_at: string | null
          description: string | null
          icon_emoji: string | null
          id: string
          is_active: boolean | null
          item_key: string
          name: string
          preview_url: string | null
          rarity: string | null
          unlock_method: string | null
          unlock_threshold: number | null
        }
        Insert: {
          agency_id?: string | null
          category?: string
          created_at?: string | null
          description?: string | null
          icon_emoji?: string | null
          id?: string
          is_active?: boolean | null
          item_key: string
          name: string
          preview_url?: string | null
          rarity?: string | null
          unlock_method?: string | null
          unlock_threshold?: number | null
        }
        Update: {
          agency_id?: string | null
          category?: string
          created_at?: string | null
          description?: string | null
          icon_emoji?: string | null
          id?: string
          is_active?: boolean | null
          item_key?: string
          name?: string
          preview_url?: string | null
          rarity?: string | null
          unlock_method?: string | null
          unlock_threshold?: number | null
        }
        Relationships: []
      }
      daily_quest_progress: {
        Row: {
          bonus_awarded: boolean
          completed: boolean
          completed_at: string | null
          created_at: string
          current_value: number
          id: string
          quest_id: string
          student_id: string
          updated_at: string
        }
        Insert: {
          bonus_awarded?: boolean
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          current_value?: number
          id?: string
          quest_id: string
          student_id: string
          updated_at?: string
        }
        Update: {
          bonus_awarded?: boolean
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          current_value?: number
          id?: string
          quest_id?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_quest_progress_quest_id_fkey"
            columns: ["quest_id"]
            isOneToOne: false
            referencedRelation: "daily_quests"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_quests: {
        Row: {
          active_date: string
          agency_id: string
          created_at: string
          created_by: string | null
          description: string | null
          group_id: string
          id: string
          is_active: boolean
          quest_type: string
          reward_bonus: number
          target_value: number
          title: string
          updated_at: string
        }
        Insert: {
          active_date?: string
          agency_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          group_id: string
          id?: string
          is_active?: boolean
          quest_type?: string
          reward_bonus?: number
          target_value?: number
          title: string
          updated_at?: string
        }
        Update: {
          active_date?: string
          agency_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          group_id?: string
          id?: string
          is_active?: boolean
          quest_type?: string
          reward_bonus?: number
          target_value?: number
          title?: string
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
      game_events: {
        Row: {
          agency_id: string
          classroom_id: string | null
          created_at: string
          event_type: string
          id: string
          is_checkpoint: boolean | null
          multiplier_applied: number | null
          payload: Json
          processed: boolean | null
          streak_count: number | null
          student_id: string | null
          zone_type: string | null
        }
        Insert: {
          agency_id: string
          classroom_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          is_checkpoint?: boolean | null
          multiplier_applied?: number | null
          payload?: Json
          processed?: boolean | null
          streak_count?: number | null
          student_id?: string | null
          zone_type?: string | null
        }
        Update: {
          agency_id?: string
          classroom_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          is_checkpoint?: boolean | null
          multiplier_applied?: number | null
          payload?: Json
          processed?: boolean | null
          streak_count?: number | null
          student_id?: string | null
          zone_type?: string | null
        }
        Relationships: []
      }
      game_modes: {
        Row: {
          agency_id: string | null
          checkpoint_rewards_enabled: boolean
          comeback_config_json: Json
          created_at: string
          description: string | null
          difficulty_scaling: string | null
          game_speed: number | null
          id: string
          is_preset: boolean
          max_daily_points: number | null
          momentum_config_json: Json
          name: string
          slug: string
        }
        Insert: {
          agency_id?: string | null
          checkpoint_rewards_enabled?: boolean
          comeback_config_json?: Json
          created_at?: string
          description?: string | null
          difficulty_scaling?: string | null
          game_speed?: number | null
          id?: string
          is_preset?: boolean
          max_daily_points?: number | null
          momentum_config_json?: Json
          name: string
          slug: string
        }
        Update: {
          agency_id?: string | null
          checkpoint_rewards_enabled?: boolean
          comeback_config_json?: Json
          created_at?: string
          description?: string | null
          difficulty_scaling?: string | null
          game_speed?: number | null
          id?: string
          is_preset?: boolean
          max_daily_points?: number | null
          momentum_config_json?: Json
          name?: string
          slug?: string
        }
        Relationships: []
      }
      game_themes: {
        Row: {
          agency_id: string | null
          assets_json: Json
          avatar_style: string | null
          colors_json: Json
          created_at: string
          id: string
          is_preset: boolean
          name: string
          slug: string
        }
        Insert: {
          agency_id?: string | null
          assets_json?: Json
          avatar_style?: string | null
          colors_json?: Json
          created_at?: string
          id?: string
          is_preset?: boolean
          name: string
          slug: string
        }
        Update: {
          agency_id?: string | null
          assets_json?: Json
          avatar_style?: string | null
          colors_json?: Json
          created_at?: string
          id?: string
          is_preset?: boolean
          name?: string
          slug?: string
        }
        Relationships: []
      }
      game_tracks: {
        Row: {
          agency_id: string | null
          checkpoints_json: Json
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          is_preset: boolean
          name: string
          nodes_json: Json
          theme_id: string | null
          theme_slug: string | null
          total_steps: number
          updated_at: string
          zones_json: Json
        }
        Insert: {
          agency_id?: string | null
          checkpoints_json?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_preset?: boolean
          name: string
          nodes_json?: Json
          theme_id?: string | null
          theme_slug?: string | null
          total_steps?: number
          updated_at?: string
          zones_json?: Json
        }
        Update: {
          agency_id?: string | null
          checkpoints_json?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_preset?: boolean
          name?: string
          nodes_json?: Json
          theme_id?: string | null
          theme_slug?: string | null
          total_steps?: number
          updated_at?: string
          zones_json?: Json
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
      help_interactions: {
        Row: {
          agency_id: string | null
          completed_at: string | null
          context_json: Json
          created_at: string
          dismissed_at: string | null
          help_item_id: string
          help_item_type: string
          id: string
          route: string | null
          started_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          agency_id?: string | null
          completed_at?: string | null
          context_json?: Json
          created_at?: string
          dismissed_at?: string | null
          help_item_id: string
          help_item_type: string
          id?: string
          route?: string | null
          started_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          agency_id?: string | null
          completed_at?: string | null
          context_json?: Json
          created_at?: string
          dismissed_at?: string | null
          help_item_id?: string
          help_item_type?: string
          id?: string
          route?: string | null
          started_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      home_reinforcement_log: {
        Row: {
          activity: string
          agency_id: string
          bonus_points_awarded: number | null
          created_at: string | null
          id: string
          notes: string | null
          parent_name: string | null
          parent_user_id: string | null
          staff_acknowledged: boolean | null
          student_id: string
        }
        Insert: {
          activity: string
          agency_id: string
          bonus_points_awarded?: number | null
          created_at?: string | null
          id?: string
          notes?: string | null
          parent_name?: string | null
          parent_user_id?: string | null
          staff_acknowledged?: boolean | null
          student_id: string
        }
        Update: {
          activity?: string
          agency_id?: string
          bonus_points_awarded?: number | null
          created_at?: string | null
          id?: string
          notes?: string | null
          parent_name?: string | null
          parent_user_id?: string | null
          staff_acknowledged?: boolean | null
          student_id?: string
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
      launch_readiness_checks: {
        Row: {
          agency_id: string
          category: string
          check_key: string
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          description: string | null
          id: string
          is_complete: boolean | null
          label: string
          updated_at: string | null
          weight: number | null
        }
        Insert: {
          agency_id: string
          category: string
          check_key: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_complete?: boolean | null
          label: string
          updated_at?: string | null
          weight?: number | null
        }
        Update: {
          agency_id?: string
          category?: string
          check_key?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_complete?: boolean | null
          label?: string
          updated_at?: string | null
          weight?: number | null
        }
        Relationships: []
      }
      mayday_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          agency_id: string
          alert_type: string
          classroom_id: string | null
          created_at: string
          id: string
          message: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          student_id: string | null
          triggered_by: string
          urgency: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          agency_id: string
          alert_type?: string
          classroom_id?: string | null
          created_at?: string
          id?: string
          message?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          student_id?: string | null
          triggered_by: string
          urgency?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          agency_id?: string
          alert_type?: string
          classroom_id?: string | null
          created_at?: string
          id?: string
          message?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          student_id?: string | null
          triggered_by?: string
          urgency?: string
        }
        Relationships: []
      }
      mayday_contacts: {
        Row: {
          admin_override: boolean
          agency_id: string
          contact_name: string
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          is_active: boolean
          notify_email: boolean
          notify_in_app: boolean
          notify_sms: boolean
          opt_out_days: number[] | null
          phone: string | null
          role_label: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admin_override?: boolean
          agency_id: string
          contact_name: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          notify_email?: boolean
          notify_in_app?: boolean
          notify_sms?: boolean
          opt_out_days?: number[] | null
          phone?: string | null
          role_label?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admin_override?: boolean
          agency_id?: string
          contact_name?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          notify_email?: boolean
          notify_in_app?: boolean
          notify_sms?: boolean
          opt_out_days?: number[] | null
          phone?: string | null
          role_label?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      mayday_recipients: {
        Row: {
          contact_id: string | null
          created_at: string
          delivered_at: string | null
          delivery_channel: string
          delivery_channels_json: Json | null
          error_message: string | null
          id: string
          mayday_id: string
          recipient_user_id: string | null
          status: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_channel?: string
          delivery_channels_json?: Json | null
          error_message?: string | null
          id?: string
          mayday_id: string
          recipient_user_id?: string | null
          status?: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_channel?: string
          delivery_channels_json?: Json | null
          error_message?: string | null
          id?: string
          mayday_id?: string
          recipient_user_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "mayday_recipients_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "mayday_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mayday_recipients_mayday_id_fkey"
            columns: ["mayday_id"]
            isOneToOne: false
            referencedRelation: "mayday_alerts"
            referencedColumns: ["id"]
          },
        ]
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
      parent_access_links: {
        Row: {
          agency_id: string
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          last_used_at: string | null
          student_id: string
          token: string
        }
        Insert: {
          agency_id: string
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          student_id: string
          token: string
        }
        Update: {
          agency_id?: string
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          student_id?: string
          token?: string
        }
        Relationships: []
      }
      parent_actions: {
        Row: {
          action_type: string
          agency_id: string
          created_at: string | null
          id: string
          message: string | null
          parent_name: string | null
          parent_user_id: string | null
          staff_reply: string | null
          staff_reply_at: string | null
          staff_viewed: boolean | null
          staff_viewed_at: string | null
          student_id: string
        }
        Insert: {
          action_type: string
          agency_id: string
          created_at?: string | null
          id?: string
          message?: string | null
          parent_name?: string | null
          parent_user_id?: string | null
          staff_reply?: string | null
          staff_reply_at?: string | null
          staff_viewed?: boolean | null
          staff_viewed_at?: string | null
          student_id: string
        }
        Update: {
          action_type?: string
          agency_id?: string
          created_at?: string | null
          id?: string
          message?: string | null
          parent_name?: string | null
          parent_user_id?: string | null
          staff_reply?: string | null
          staff_reply_at?: string | null
          staff_viewed?: boolean | null
          staff_viewed_at?: string | null
          student_id?: string
        }
        Relationships: []
      }
      parent_insights: {
        Row: {
          agency_id: string
          body: string
          created_at: string | null
          created_by: string | null
          id: string
          insight_type: string
          is_read: boolean | null
          source: string | null
          student_id: string
          title: string
          tone: string | null
        }
        Insert: {
          agency_id: string
          body: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          insight_type?: string
          is_read?: boolean | null
          source?: string | null
          student_id: string
          title: string
          tone?: string | null
        }
        Update: {
          agency_id?: string
          body?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          insight_type?: string
          is_read?: boolean | null
          source?: string | null
          student_id?: string
          title?: string
          tone?: string | null
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
      reinforcement_ai_recommendations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          action_notes: string | null
          agency_id: string | null
          created_at: string
          dismissed_at: string | null
          dismissed_by: string | null
          evidence_json: Json
          explanation: string
          id: string
          priority: string
          recommendation_type: string
          resolved_at: string | null
          status: string
          student_id: string
          suggested_action: string | null
          suggested_payload: Json
          title: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          action_notes?: string | null
          agency_id?: string | null
          created_at?: string
          dismissed_at?: string | null
          dismissed_by?: string | null
          evidence_json?: Json
          explanation: string
          id?: string
          priority?: string
          recommendation_type: string
          resolved_at?: string | null
          status?: string
          student_id: string
          suggested_action?: string | null
          suggested_payload?: Json
          title: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          action_notes?: string | null
          agency_id?: string | null
          created_at?: string
          dismissed_at?: string | null
          dismissed_by?: string | null
          evidence_json?: Json
          explanation?: string
          id?: string
          priority?: string
          recommendation_type?: string
          resolved_at?: string | null
          status?: string
          student_id?: string
          suggested_action?: string | null
          suggested_payload?: Json
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      reward_dynamic_prices: {
        Row: {
          agency_id: string
          classroom_id: string | null
          computed_price: number
          created_at: string
          created_by: string | null
          id: string
          reason: string | null
          reward_id: string
        }
        Insert: {
          agency_id: string
          classroom_id?: string | null
          computed_price: number
          created_at?: string
          created_by?: string | null
          id?: string
          reason?: string | null
          reward_id: string
        }
        Update: {
          agency_id?: string
          classroom_id?: string | null
          computed_price?: number
          created_at?: string
          created_by?: string | null
          id?: string
          reason?: string | null
          reward_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_dynamic_prices_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "beacon_rewards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_dynamic_prices_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "v_reward_store"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_economy_settings: {
        Row: {
          agency_id: string
          classroom_id: string | null
          created_at: string
          demand_weight: number
          dynamic_pricing_enabled: boolean
          id: string
          max_price_decrease_pct: number
          max_price_increase_pct: number
          price_update_interval_hours: number
          scarcity_weight: number
          updated_at: string
        }
        Insert: {
          agency_id: string
          classroom_id?: string | null
          created_at?: string
          demand_weight?: number
          dynamic_pricing_enabled?: boolean
          id?: string
          max_price_decrease_pct?: number
          max_price_increase_pct?: number
          price_update_interval_hours?: number
          scarcity_weight?: number
          updated_at?: string
        }
        Update: {
          agency_id?: string
          classroom_id?: string | null
          created_at?: string
          demand_weight?: number
          dynamic_pricing_enabled?: boolean
          id?: string
          max_price_decrease_pct?: number
          max_price_increase_pct?: number
          price_update_interval_hours?: number
          scarcity_weight?: number
          updated_at?: string
        }
        Relationships: []
      }
      reward_inventory: {
        Row: {
          agency_id: string
          classroom_id: string | null
          created_at: string
          id: string
          is_limited: boolean
          quantity_available: number
          reward_id: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          classroom_id?: string | null
          created_at?: string
          id?: string
          is_limited?: boolean
          quantity_available?: number
          reward_id: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          classroom_id?: string | null
          created_at?: string
          id?: string
          is_limited?: boolean
          quantity_available?: number
          reward_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_inventory_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "beacon_rewards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_inventory_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "v_reward_store"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_transactions: {
        Row: {
          agency_id: string
          base_price: number
          created_at: string
          final_price: number
          id: string
          ledger_entry_id: string | null
          metadata_json: Json | null
          points_after: number
          points_before: number
          price_modifier: string | null
          reward_id: string
          staff_id: string
          student_id: string
          transaction_type: string
        }
        Insert: {
          agency_id: string
          base_price: number
          created_at?: string
          final_price: number
          id?: string
          ledger_entry_id?: string | null
          metadata_json?: Json | null
          points_after?: number
          points_before?: number
          price_modifier?: string | null
          reward_id: string
          staff_id: string
          student_id: string
          transaction_type?: string
        }
        Update: {
          agency_id?: string
          base_price?: number
          created_at?: string
          final_price?: number
          id?: string
          ledger_entry_id?: string | null
          metadata_json?: Json | null
          points_after?: number
          points_before?: number
          price_modifier?: string | null
          reward_id?: string
          staff_id?: string
          student_id?: string
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_transactions_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "beacon_rewards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_transactions_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "v_reward_store"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_activity_log: {
        Row: {
          activity_source: string | null
          activity_type: string | null
          created_at: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          activity_source?: string | null
          activity_type?: string | null
          created_at?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          activity_source?: string | null
          activity_type?: string | null
          created_at?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      staff_onboarding: {
        Row: {
          agency_id: string | null
          created_at: string | null
          first_action_at: string | null
          first_action_completed: boolean | null
          first_login_at: string | null
          id: string
          last_active_at: string | null
          last_milestone_shown: string | null
          onboarding_day: number | null
          total_actions: number | null
          updated_at: string
          user_id: string
          walkthrough_completed: boolean | null
          welcome_dismissed: boolean
        }
        Insert: {
          agency_id?: string | null
          created_at?: string | null
          first_action_at?: string | null
          first_action_completed?: boolean | null
          first_login_at?: string | null
          id?: string
          last_active_at?: string | null
          last_milestone_shown?: string | null
          onboarding_day?: number | null
          total_actions?: number | null
          updated_at?: string
          user_id: string
          walkthrough_completed?: boolean | null
          welcome_dismissed?: boolean
        }
        Update: {
          agency_id?: string | null
          created_at?: string | null
          first_action_at?: string | null
          first_action_completed?: boolean | null
          first_login_at?: string | null
          id?: string
          last_active_at?: string | null
          last_milestone_shown?: string | null
          onboarding_day?: number | null
          total_actions?: number | null
          updated_at?: string
          user_id?: string
          walkthrough_completed?: boolean | null
          welcome_dismissed?: boolean
        }
        Relationships: []
      }
      staff_presence: {
        Row: {
          agency_id: string
          assigned_student_id: string | null
          availability_status: string
          available_for_support: boolean
          classroom_group_id: string | null
          created_at: string
          id: string
          location_label: string | null
          location_type: string
          note: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          agency_id: string
          assigned_student_id?: string | null
          availability_status?: string
          available_for_support?: boolean
          classroom_group_id?: string | null
          created_at?: string
          id?: string
          location_label?: string | null
          location_type?: string
          note?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          agency_id?: string
          assigned_student_id?: string | null
          availability_status?: string
          available_for_support?: boolean
          classroom_group_id?: string | null
          created_at?: string
          id?: string
          location_label?: string | null
          location_type?: string
          note?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      staff_presence_history: {
        Row: {
          agency_id: string
          assigned_student_id: string | null
          availability_status: string
          available_for_support: boolean
          changed_at: string
          changed_by: string | null
          classroom_group_id: string | null
          id: string
          location_label: string | null
          location_type: string
          note: string | null
          status: string
          user_id: string
        }
        Insert: {
          agency_id: string
          assigned_student_id?: string | null
          availability_status: string
          available_for_support?: boolean
          changed_at?: string
          changed_by?: string | null
          classroom_group_id?: string | null
          id?: string
          location_label?: string | null
          location_type: string
          note?: string | null
          status: string
          user_id: string
        }
        Update: {
          agency_id?: string
          assigned_student_id?: string | null
          availability_status?: string
          available_for_support?: boolean
          changed_at?: string
          changed_by?: string | null
          classroom_group_id?: string | null
          id?: string
          location_label?: string | null
          location_type?: string
          note?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      student_attendance_status: {
        Row: {
          agency_id: string
          changed_at: string
          classroom_id: string
          created_at: string
          id: string
          recorded_by: string
          recorded_date: string
          status: string
          student_id: string
        }
        Insert: {
          agency_id: string
          changed_at?: string
          classroom_id: string
          created_at?: string
          id?: string
          recorded_by: string
          recorded_date?: string
          status?: string
          student_id: string
        }
        Update: {
          agency_id?: string
          changed_at?: string
          classroom_id?: string
          created_at?: string
          id?: string
          recorded_by?: string
          recorded_date?: string
          status?: string
          student_id?: string
        }
        Relationships: []
      }
      student_cosmetic_loadout: {
        Row: {
          cosmetic_id: string
          equipped_at: string | null
          id: string
          slot: string
          student_id: string
        }
        Insert: {
          cosmetic_id: string
          equipped_at?: string | null
          id?: string
          slot?: string
          student_id: string
        }
        Update: {
          cosmetic_id?: string
          equipped_at?: string | null
          id?: string
          slot?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_cosmetic_loadout_cosmetic_id_fkey"
            columns: ["cosmetic_id"]
            isOneToOne: false
            referencedRelation: "cosmetic_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      student_cosmetic_unlocks: {
        Row: {
          cosmetic_id: string
          id: string
          student_id: string
          unlock_source: string | null
          unlocked_at: string | null
        }
        Insert: {
          cosmetic_id: string
          id?: string
          student_id: string
          unlock_source?: string | null
          unlocked_at?: string | null
        }
        Update: {
          cosmetic_id?: string
          id?: string
          student_id?: string
          unlock_source?: string | null
          unlocked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_cosmetic_unlocks_cosmetic_id_fkey"
            columns: ["cosmetic_id"]
            isOneToOne: false
            referencedRelation: "cosmetic_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      student_game_profiles: {
        Row: {
          agency_id: string
          avatar_emoji: string
          avatar_items: Json
          created_at: string
          current_level: number
          current_xp: number
          id: string
          login_mode: string
          portal_enabled: boolean
          student_id: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          avatar_emoji?: string
          avatar_items?: Json
          created_at?: string
          current_level?: number
          current_xp?: number
          id?: string
          login_mode?: string
          portal_enabled?: boolean
          student_id: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          avatar_emoji?: string
          avatar_items?: Json
          created_at?: string
          current_level?: number
          current_xp?: number
          id?: string
          login_mode?: string
          portal_enabled?: boolean
          student_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      student_parent_links: {
        Row: {
          agency_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          parent_email: string | null
          parent_name: string | null
          parent_phone: string | null
          parent_user_id: string | null
          student_id: string
          updated_at: string | null
        }
        Insert: {
          agency_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          parent_email?: string | null
          parent_name?: string | null
          parent_phone?: string | null
          parent_user_id?: string | null
          student_id: string
          updated_at?: string | null
        }
        Update: {
          agency_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          parent_email?: string | null
          parent_name?: string | null
          parent_phone?: string | null
          parent_user_id?: string | null
          student_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      student_presence: {
        Row: {
          agency_id: string
          assigned_staff_id: string | null
          classroom_group_id: string
          created_at: string
          id: string
          location_label: string | null
          location_type: string
          status: string
          student_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          agency_id: string
          assigned_staff_id?: string | null
          classroom_group_id: string
          created_at?: string
          id?: string
          location_label?: string | null
          location_type?: string
          status?: string
          student_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          agency_id?: string
          assigned_staff_id?: string | null
          classroom_group_id?: string
          created_at?: string
          id?: string
          location_label?: string | null
          location_type?: string
          status?: string
          student_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      student_quests: {
        Row: {
          agency_id: string
          completed_at: string | null
          created_at: string | null
          current_value: number | null
          description: string | null
          expires_at: string | null
          group_id: string | null
          id: string
          quest_category: string | null
          quest_type: string
          reward_points: number | null
          reward_unlock_id: string | null
          status: string | null
          student_id: string
          target_value: number | null
          template_id: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          agency_id: string
          completed_at?: string | null
          created_at?: string | null
          current_value?: number | null
          description?: string | null
          expires_at?: string | null
          group_id?: string | null
          id?: string
          quest_category?: string | null
          quest_type?: string
          reward_points?: number | null
          reward_unlock_id?: string | null
          status?: string | null
          student_id: string
          target_value?: number | null
          template_id?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          agency_id?: string
          completed_at?: string | null
          created_at?: string | null
          current_value?: number | null
          description?: string | null
          expires_at?: string | null
          group_id?: string | null
          id?: string
          quest_category?: string | null
          quest_type?: string
          reward_points?: number | null
          reward_unlock_id?: string | null
          status?: string | null
          student_id?: string
          target_value?: number | null
          template_id?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_quests_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "classroom_quest_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      student_reinforcement_profiles: {
        Row: {
          agency_id: string
          bonus_points_enabled: boolean
          classroom_id: string | null
          created_at: string
          created_by: string | null
          custom_settings: Json
          id: string
          is_active: boolean
          profile_name: string | null
          reinforcement_mode: string
          reinforcement_template_id: string | null
          response_cost_enabled: boolean
          student_id: string
          updated_at: string
          use_template_defaults: boolean
        }
        Insert: {
          agency_id: string
          bonus_points_enabled?: boolean
          classroom_id?: string | null
          created_at?: string
          created_by?: string | null
          custom_settings?: Json
          id?: string
          is_active?: boolean
          profile_name?: string | null
          reinforcement_mode?: string
          reinforcement_template_id?: string | null
          response_cost_enabled?: boolean
          student_id: string
          updated_at?: string
          use_template_defaults?: boolean
        }
        Update: {
          agency_id?: string
          bonus_points_enabled?: boolean
          classroom_id?: string | null
          created_at?: string
          created_by?: string | null
          custom_settings?: Json
          id?: string
          is_active?: boolean
          profile_name?: string | null
          reinforcement_mode?: string
          reinforcement_template_id?: string | null
          response_cost_enabled?: boolean
          student_id?: string
          updated_at?: string
          use_template_defaults?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "student_reinforcement_profiles_reinforcement_template_id_fkey"
            columns: ["reinforcement_template_id"]
            isOneToOne: false
            referencedRelation: "beacon_reinforcement_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      student_reinforcement_rules: {
        Row: {
          behavior_category: string | null
          behavior_name: string | null
          created_at: string
          event_type: string | null
          id: string
          is_active: boolean
          linked_target_id: string | null
          notes: string | null
          points: number
          rule_scope: string
          rule_type: string
          student_id: string
          student_reinforcement_profile_id: string
        }
        Insert: {
          behavior_category?: string | null
          behavior_name?: string | null
          created_at?: string
          event_type?: string | null
          id?: string
          is_active?: boolean
          linked_target_id?: string | null
          notes?: string | null
          points: number
          rule_scope: string
          rule_type?: string
          student_id: string
          student_reinforcement_profile_id: string
        }
        Update: {
          behavior_category?: string | null
          behavior_name?: string | null
          created_at?: string
          event_type?: string | null
          id?: string
          is_active?: boolean
          linked_target_id?: string | null
          notes?: string | null
          points?: number
          rule_scope?: string
          rule_type?: string
          student_id?: string
          student_reinforcement_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_reinforcement_rules_student_reinforcement_profile__fkey"
            columns: ["student_reinforcement_profile_id"]
            isOneToOne: false
            referencedRelation: "student_reinforcement_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_response_cost_settings: {
        Row: {
          agency_id: string
          id: string
          response_cost_enabled: boolean
          student_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          agency_id: string
          id?: string
          response_cost_enabled?: boolean
          student_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          agency_id?: string
          id?: string
          response_cost_enabled?: boolean
          student_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      student_streaks: {
        Row: {
          best_count: number
          created_at: string
          current_count: number
          id: string
          last_activity_date: string
          streak_type: string
          student_id: string
        }
        Insert: {
          best_count?: number
          created_at?: string
          current_count?: number
          id?: string
          last_activity_date?: string
          streak_type?: string
          student_id: string
        }
        Update: {
          best_count?: number
          created_at?: string
          current_count?: number
          id?: string
          last_activity_date?: string
          streak_type?: string
          student_id?: string
        }
        Relationships: []
      }
      student_unlocks: {
        Row: {
          id: string
          is_active: boolean
          student_id: string
          unlock_id: string
          unlocked_at: string
        }
        Insert: {
          id?: string
          is_active?: boolean
          student_id: string
          unlock_id: string
          unlocked_at?: string
        }
        Update: {
          id?: string
          is_active?: boolean
          student_id?: string
          unlock_id?: string
          unlocked_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_unlocks_unlock_id_fkey"
            columns: ["unlock_id"]
            isOneToOne: false
            referencedRelation: "unlock_catalog"
            referencedColumns: ["id"]
          },
        ]
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
      teacher_point_actions: {
        Row: {
          action_group: string | null
          action_icon: string | null
          action_label: string
          active: boolean
          agency_id: string
          created_at: string
          default_behavior_category: string | null
          default_behavior_name: string | null
          default_event_subtype: string | null
          default_event_type: string | null
          id: string
          manual_points: number | null
          manual_rule_type: string | null
          mapped_rule_id: string | null
          sort_order: number
          source_table: string
          target_id: string | null
        }
        Insert: {
          action_group?: string | null
          action_icon?: string | null
          action_label: string
          active?: boolean
          agency_id: string
          created_at?: string
          default_behavior_category?: string | null
          default_behavior_name?: string | null
          default_event_subtype?: string | null
          default_event_type?: string | null
          id?: string
          manual_points?: number | null
          manual_rule_type?: string | null
          mapped_rule_id?: string | null
          sort_order?: number
          source_table?: string
          target_id?: string | null
        }
        Update: {
          action_group?: string | null
          action_icon?: string | null
          action_label?: string
          active?: boolean
          agency_id?: string
          created_at?: string
          default_behavior_category?: string | null
          default_behavior_name?: string | null
          default_event_subtype?: string | null
          default_event_type?: string | null
          id?: string
          manual_points?: number | null
          manual_rule_type?: string | null
          mapped_rule_id?: string | null
          sort_order?: number
          source_table?: string
          target_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teacher_point_actions_mapped_rule_id_fkey"
            columns: ["mapped_rule_id"]
            isOneToOne: false
            referencedRelation: "teacher_point_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_point_actions_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "teacher_targets"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_point_rules: {
        Row: {
          active: boolean
          agency_id: string
          applies_when_json: Json
          auto_apply: boolean
          behavior_category: string | null
          behavior_name: string | null
          created_at: string
          event_subtype: string | null
          event_type: string | null
          id: string
          points: number
          rule_name: string
          rule_type: string
          source_table: string
          target_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          agency_id: string
          applies_when_json?: Json
          auto_apply?: boolean
          behavior_category?: string | null
          behavior_name?: string | null
          created_at?: string
          event_subtype?: string | null
          event_type?: string | null
          id?: string
          points: number
          rule_name: string
          rule_type?: string
          source_table: string
          target_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          agency_id?: string
          applies_when_json?: Json
          auto_apply?: boolean
          behavior_category?: string | null
          behavior_name?: string | null
          created_at?: string
          event_subtype?: string | null
          event_type?: string | null
          id?: string
          points?: number
          rule_name?: string
          rule_type?: string
          source_table?: string
          target_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_point_rules_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "teacher_targets"
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
      teacher_targets: {
        Row: {
          action_group: string | null
          active: boolean
          agency_id: string
          client_id: string | null
          created_at: string
          created_by: string | null
          default_behavior_category: string | null
          default_behavior_name: string | null
          default_event_subtype: string | null
          default_event_type: string | null
          description: string | null
          icon: string | null
          id: string
          name: string
          source_table: string
          target_type: string
          updated_at: string
        }
        Insert: {
          action_group?: string | null
          active?: boolean
          agency_id: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          default_behavior_category?: string | null
          default_behavior_name?: string | null
          default_event_subtype?: string | null
          default_event_type?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          source_table?: string
          target_type: string
          updated_at?: string
        }
        Update: {
          action_group?: string | null
          active?: boolean
          agency_id?: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          default_behavior_category?: string | null
          default_behavior_name?: string | null
          default_event_subtype?: string | null
          default_event_type?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          source_table?: string
          target_type?: string
          updated_at?: string
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
      thread_members: {
        Row: {
          created_at: string
          id: string
          is_muted: boolean
          last_read_at: string | null
          role: string
          thread_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_muted?: boolean
          last_read_at?: string | null
          role?: string
          thread_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_muted?: boolean
          last_read_at?: string | null
          role?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "thread_members_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      thread_message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "thread_message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "thread_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      thread_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          is_deleted: boolean
          message_type: string
          metadata: Json | null
          parent_id: string | null
          sender_id: string
          thread_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          message_type?: string
          metadata?: Json | null
          parent_id?: string | null
          sender_id: string
          thread_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          message_type?: string
          metadata?: Json | null
          parent_id?: string | null
          sender_id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "thread_messages_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "thread_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thread_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      thread_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji?: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "thread_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "thread_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      thread_read_receipts: {
        Row: {
          id: string
          last_read_at: string
          last_read_message_id: string | null
          thread_id: string
          user_id: string
        }
        Insert: {
          id?: string
          last_read_at?: string
          last_read_message_id?: string | null
          thread_id: string
          user_id: string
        }
        Update: {
          id?: string
          last_read_at?: string
          last_read_message_id?: string | null
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "thread_read_receipts_last_read_message_id_fkey"
            columns: ["last_read_message_id"]
            isOneToOne: false
            referencedRelation: "thread_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thread_read_receipts_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      threads: {
        Row: {
          agency_id: string
          classroom_id: string | null
          created_at: string
          created_by: string
          id: string
          is_archived: boolean
          is_private: boolean
          last_message_at: string | null
          last_message_preview: string | null
          thread_type: string
          title: string | null
          updated_at: string
        }
        Insert: {
          agency_id: string
          classroom_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          is_archived?: boolean
          is_private?: boolean
          last_message_at?: string | null
          last_message_preview?: string | null
          thread_type?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          agency_id?: string
          classroom_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          is_archived?: boolean
          is_private?: boolean
          last_message_at?: string | null
          last_message_preview?: string | null
          thread_type?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "threads_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classroom_groups"
            referencedColumns: ["group_id"]
          },
        ]
      }
      token_boards: {
        Row: {
          agency_id: string
          auto_reset: boolean
          classroom_id: string
          created_at: string
          current_tokens: number
          id: string
          is_active: boolean
          reward_emoji: string
          reward_name: string
          skin: string
          student_id: string
          token_goal: number | null
          token_target: number
          updated_at: string
        }
        Insert: {
          agency_id: string
          auto_reset?: boolean
          classroom_id: string
          created_at?: string
          current_tokens?: number
          id?: string
          is_active?: boolean
          reward_emoji?: string
          reward_name?: string
          skin?: string
          student_id: string
          token_goal?: number | null
          token_target?: number
          updated_at?: string
        }
        Update: {
          agency_id?: string
          auto_reset?: boolean
          classroom_id?: string
          created_at?: string
          current_tokens?: number
          id?: string
          is_active?: boolean
          reward_emoji?: string
          reward_name?: string
          skin?: string
          student_id?: string
          token_goal?: number | null
          token_target?: number
          updated_at?: string
        }
        Relationships: []
      }
      unlock_catalog: {
        Row: {
          agency_id: string | null
          created_at: string
          description: string | null
          icon_emoji: string
          id: string
          is_active: boolean
          level_required: number
          name: string
          points_required: number
          unlock_key: string
          unlock_type: string
        }
        Insert: {
          agency_id?: string | null
          created_at?: string
          description?: string | null
          icon_emoji?: string
          id?: string
          is_active?: boolean
          level_required?: number
          name: string
          points_required?: number
          unlock_key: string
          unlock_type?: string
        }
        Update: {
          agency_id?: string | null
          created_at?: string
          description?: string | null
          icon_emoji?: string
          id?: string
          is_active?: boolean
          level_required?: number
          name?: string
          points_required?: number
          unlock_key?: string
          unlock_type?: string
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
      v_available_support_staff: {
        Row: {
          agency_id: string | null
          assigned_student_id: string | null
          availability_status: string | null
          available_for_support: boolean | null
          classroom_group_id: string | null
          id: string | null
          location_label: string | null
          location_type: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          agency_id?: string | null
          assigned_student_id?: string | null
          availability_status?: string | null
          available_for_support?: boolean | null
          classroom_group_id?: string | null
          id?: string | null
          location_label?: string | null
          location_type?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          agency_id?: string | null
          assigned_student_id?: string | null
          availability_status?: string | null
          available_for_support?: boolean | null
          classroom_group_id?: string | null
          id?: string | null
          location_label?: string | null
          location_type?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      v_beacon_current_day_state: {
        Row: {
          classroom_id: string | null
          day_state: string | null
          notes: string | null
          selected_by: string | null
          state_date: string | null
          student_id: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      v_beacon_current_teacher_plan: {
        Row: {
          antecedents: Json | null
          classroom_id: string | null
          created_by: string | null
          day_state: string | null
          plan_date: string | null
          reactives: Json | null
          reinforcement: string | null
          selected_program_ids: Json | null
          student_id: string | null
          targets: Json | null
          teacher_summary: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      v_beacon_points_audit: {
        Row: {
          abc_log_id: string | null
          agency_id: string | null
          created_at: string | null
          entry_kind: string | null
          id: string | null
          is_reversal: boolean | null
          manual_reason_category: string | null
          point_rule_id: string | null
          points: number | null
          reason: string | null
          reversal_of_ledger_id: string | null
          rule_name: string | null
          rule_type: string | null
          source: string | null
          staff_id: string | null
          student_id: string | null
          teacher_data_event_id: string | null
          teacher_duration_entry_id: string | null
          teacher_frequency_entry_id: string | null
        }
        Relationships: []
      }
      v_classroom_staff_presence: {
        Row: {
          agency_id: string | null
          assigned_student_id: string | null
          availability_status: string | null
          available_for_support: boolean | null
          classroom_group_id: string | null
          id: string | null
          location_label: string | null
          location_type: string | null
          note: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          agency_id?: string | null
          assigned_student_id?: string | null
          availability_status?: string | null
          available_for_support?: boolean | null
          classroom_group_id?: string | null
          id?: string | null
          location_label?: string | null
          location_type?: string | null
          note?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          agency_id?: string | null
          assigned_student_id?: string | null
          availability_status?: string | null
          available_for_support?: boolean | null
          classroom_group_id?: string | null
          id?: string | null
          location_label?: string | null
          location_type?: string | null
          note?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      v_classroom_student_presence: {
        Row: {
          assigned_staff_id: string | null
          classroom_group_id: string | null
          location_label: string | null
          location_type: string | null
          status: string | null
          student_id: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_staff_id?: string | null
          classroom_group_id?: string | null
          location_label?: string | null
          location_type?: string | null
          status?: string | null
          student_id?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_staff_id?: string | null
          classroom_group_id?: string | null
          location_label?: string | null
          location_type?: string | null
          status?: string | null
          student_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      v_classroom_team_scores: {
        Row: {
          group_id: string | null
          member_count: number | null
          team_color: string | null
          team_icon: string | null
          team_id: string | null
          team_name: string | null
          total_points: number | null
        }
        Relationships: [
          {
            foreignKeyName: "classroom_teams_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "classroom_groups"
            referencedColumns: ["group_id"]
          },
        ]
      }
      v_help_progress: {
        Row: {
          agency_id: string | null
          completed_count: number | null
          dismissed_count: number | null
          help_item_type: string | null
          last_activity: string | null
          total_items_touched: number | null
          user_id: string | null
        }
        Relationships: []
      }
      v_launch_readiness_score: {
        Row: {
          agency_id: string | null
          completed_checks: number | null
          completed_weight: number | null
          score: number | null
          total_checks: number | null
          total_weight: number | null
        }
        Relationships: []
      }
      v_open_reinforcement_ai_recommendations: {
        Row: {
          agency_id: string | null
          created_at: string | null
          evidence_json: Json | null
          explanation: string | null
          id: string | null
          priority: string | null
          recommendation_type: string | null
          status: string | null
          student_id: string | null
          suggested_action: string | null
          suggested_payload: Json | null
          title: string | null
        }
        Insert: {
          agency_id?: string | null
          created_at?: string | null
          evidence_json?: Json | null
          explanation?: string | null
          id?: string | null
          priority?: string | null
          recommendation_type?: string | null
          status?: string | null
          student_id?: string | null
          suggested_action?: string | null
          suggested_payload?: Json | null
          title?: string | null
        }
        Update: {
          agency_id?: string | null
          created_at?: string | null
          evidence_json?: Json | null
          explanation?: string | null
          id?: string | null
          priority?: string | null
          recommendation_type?: string | null
          status?: string | null
          student_id?: string | null
          suggested_action?: string | null
          suggested_payload?: Json | null
          title?: string | null
        }
        Relationships: []
      }
      v_reward_store: {
        Row: {
          active: boolean | null
          agency_id: string | null
          base_cost: number | null
          cost: number | null
          current_dynamic_price: number | null
          description: string | null
          dynamic_pricing_enabled: boolean | null
          emoji: string | null
          id: string | null
          inventory_enabled: boolean | null
          is_limited: boolean | null
          max_cost: number | null
          min_cost: number | null
          name: string | null
          quantity_available: number | null
          redemption_count_24h: number | null
          reward_type: string | null
          scope_id: string | null
          scope_type: string | null
          sort_order: number | null
          stock_count: number | null
          tier: string | null
        }
        Relationships: []
      }
      v_staff_engagement: {
        Row: {
          actions_last_7_days: number | null
          first_action_at: string | null
          first_action_completed: boolean | null
          first_login_at: string | null
          last_active_at: string | null
          status: string | null
          total_actions: number | null
          user_id: string | null
          walkthrough_completed: boolean | null
          welcome_dismissed: boolean | null
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
      v_student_reward_history: {
        Row: {
          agency_id: string | null
          balance_after: number | null
          balance_before: number | null
          created_at: string | null
          id: string | null
          metadata_json: Json | null
          point_cost: number | null
          reward_emoji: string | null
          reward_id: string | null
          reward_name: string | null
          student_id: string | null
          transaction_type: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reward_transactions_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "beacon_rewards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_transactions_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "v_reward_store"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_reinforcement_ai_recommendation: {
        Args: {
          p_action_notes?: string
          p_recommendation_id: string
          p_user_id: string
        }
        Returns: Json
      }
      apply_invite_code_access: {
        Args: {
          p_code: string
          p_expected_app_context: string
          p_redeemer_id: string
        }
        Returns: Json
      }
      compute_dynamic_reward_price: {
        Args: { p_reward_id: string }
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
      dismiss_reinforcement_ai_recommendation: {
        Args: {
          p_action_notes?: string
          p_recommendation_id: string
          p_user_id: string
        }
        Returns: Json
      }
      generate_beacon_teacher_plan: {
        Args: {
          p_classroom_id?: string
          p_date: string
          p_notes?: string
          p_selected_by?: string
          p_state: string
          p_student: string
        }
        Returns: undefined
      }
      generate_rec_reinforcement_too_thin: {
        Args: {
          p_agency_id?: string
          p_lookback_days?: number
          p_max_positive_point_events?: number
          p_min_events?: number
        }
        Returns: number
      }
      generate_rec_response_cost_backfiring: {
        Args: {
          p_agency_id?: string
          p_lookback_days?: number
          p_min_response_cost_events?: number
          p_negative_to_positive_ratio?: number
        }
        Returns: number
      }
      generate_rec_token_goal_too_high: {
        Args: {
          p_agency_id?: string
          p_low_progress_ratio?: number
          p_min_goal?: number
        }
        Returns: number
      }
      generate_reinforcement_ai_recommendations: {
        Args: { p_agency_id?: string }
        Returns: Json
      }
      get_matching_teacher_point_rule: {
        Args: {
          p_agency_id: string
          p_behavior_category?: string
          p_behavior_name?: string
          p_event_subtype?: string
          p_event_type?: string
          p_source_table: string
        }
        Returns: {
          active: boolean
          agency_id: string
          applies_when_json: Json
          auto_apply: boolean
          behavior_category: string | null
          behavior_name: string | null
          created_at: string
          event_subtype: string | null
          event_type: string | null
          id: string
          points: number
          rule_name: string
          rule_type: string
          source_table: string
          target_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "teacher_point_rules"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      log_abc_with_points: {
        Args: {
          p_agency_id?: string
          p_allow_no_rule?: boolean
          p_antecedent: string
          p_behavior: string
          p_behavior_category?: string
          p_consequence: string
          p_intensity?: number
          p_logged_at?: string
          p_notes?: string
          p_staff_id: string
          p_student_id: string
        }
        Returns: Json
      }
      log_manual_points: {
        Args: {
          p_agency_id: string
          p_manual_reason_category?: string
          p_points: number
          p_reason: string
          p_source?: string
          p_staff_id: string
          p_student_id: string
        }
        Returns: Json
      }
      log_target_action: {
        Args: {
          p_agency_id: string
          p_classroom_id: string
          p_notes?: string
          p_override_points?: number
          p_point_adjustment?: number
          p_recorded_at?: string
          p_staff_id: string
          p_student_id: string
          p_target_id: string
        }
        Returns: Json
      }
      log_teacher_data_event_with_points: {
        Args: {
          p_agency_id: string
          p_allow_no_rule?: boolean
          p_classroom_id: string
          p_event_subtype?: string
          p_event_type: string
          p_event_value?: Json
          p_recorded_at?: string
          p_source_module?: string
          p_staff_id: string
          p_student_id: string
        }
        Returns: Json
      }
      log_teacher_duration_with_points: {
        Args: {
          p_agency_id: string
          p_allow_no_rule?: boolean
          p_behavior_name: string
          p_duration_seconds: number
          p_logged_date?: string
          p_notes?: string
          p_staff_id: string
          p_student_id: string
        }
        Returns: Json
      }
      log_teacher_frequency_with_points: {
        Args: {
          p_agency_id: string
          p_allow_no_rule?: boolean
          p_behavior_name: string
          p_count?: number
          p_logged_date?: string
          p_notes?: string
          p_staff_id: string
          p_student_id: string
        }
        Returns: Json
      }
      override_reward_price: {
        Args: {
          p_agency_id: string
          p_created_by?: string
          p_new_price: number
          p_reason?: string
          p_reward_id: string
        }
        Returns: Json
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
      redeem_reward: {
        Args: {
          p_agency_id: string
          p_reward_id: string
          p_staff_id: string
          p_student_id: string
        }
        Returns: Json
      }
      redeem_reward_dynamic: {
        Args: {
          p_agency_id: string
          p_reward_id: string
          p_staff_id: string
          p_student_id: string
        }
        Returns: Json
      }
      resolve_reinforcement_ai_recommendation: {
        Args: {
          p_action_notes?: string
          p_recommendation_id: string
          p_user_id: string
        }
        Returns: Json
      }
      restock_reward_inventory: {
        Args: {
          p_agency_id: string
          p_classroom_id?: string
          p_created_by?: string
          p_quantity: number
          p_reward_id: string
        }
        Returns: Json
      }
      set_staff_presence: {
        Args: {
          p_agency_id: string
          p_assigned_student_id?: string
          p_availability_status?: string
          p_available_for_support?: boolean
          p_changed_by?: string
          p_classroom_group_id?: string
          p_location_label?: string
          p_location_type?: string
          p_note?: string
          p_status?: string
          p_user_id: string
        }
        Returns: Json
      }
      track_help_interaction: {
        Args: {
          p_agency_id?: string
          p_context_json?: Json
          p_help_item_id?: string
          p_help_item_type?: string
          p_route?: string
          p_status?: string
          p_user_id: string
        }
        Returns: Json
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
