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
      autotexts: {
        Row: {
          category: string
          created_at: string
          expansion: string
          id: string
          shortcut: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          expansion: string
          id?: string
          shortcut: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          expansion?: string
          id?: string
          shortcut?: string
          user_id?: string
        }
        Relationships: []
      }
      clinical_phrases: {
        Row: {
          content: string
          context_triggers: Json | null
          created_at: string
          description: string | null
          folder_id: string | null
          hotkey: string | null
          id: string
          is_active: boolean | null
          is_shared: boolean | null
          last_used_at: string | null
          name: string
          shortcut: string | null
          updated_at: string
          usage_count: number | null
          user_id: string
          version: number | null
        }
        Insert: {
          content: string
          context_triggers?: Json | null
          created_at?: string
          description?: string | null
          folder_id?: string | null
          hotkey?: string | null
          id?: string
          is_active?: boolean | null
          is_shared?: boolean | null
          last_used_at?: string | null
          name: string
          shortcut?: string | null
          updated_at?: string
          usage_count?: number | null
          user_id: string
          version?: number | null
        }
        Update: {
          content?: string
          context_triggers?: Json | null
          created_at?: string
          description?: string | null
          folder_id?: string | null
          hotkey?: string | null
          id?: string
          is_active?: boolean | null
          is_shared?: boolean | null
          last_used_at?: string | null
          name?: string
          shortcut?: string | null
          updated_at?: string
          usage_count?: number | null
          user_id?: string
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "clinical_phrases_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "phrase_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      learned_phrases: {
        Row: {
          created_at: string
          frequency: number | null
          id: string
          suggested_as_phrase: boolean | null
          text_pattern: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          frequency?: number | null
          id?: string
          suggested_as_phrase?: boolean | null
          text_pattern: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          frequency?: number | null
          id?: string
          suggested_as_phrase?: boolean | null
          text_pattern?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      patient_field_history: {
        Row: {
          changed_at: string
          field_name: string
          id: string
          new_value: string | null
          old_value: string | null
          patient_id: string
          user_id: string
        }
        Insert: {
          changed_at?: string
          field_name: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          patient_id: string
          user_id: string
        }
        Update: {
          changed_at?: string
          field_name?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          patient_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_field_history_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_todos: {
        Row: {
          completed: boolean
          content: string
          created_at: string
          id: string
          patient_id: string
          section: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          content: string
          created_at?: string
          id?: string
          patient_id: string
          section?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          content?: string
          created_at?: string
          id?: string
          patient_id?: string
          section?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_todos_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_activity: {
        Row: {
          id: string
          patient_id: string
          user_id: string | null
          action: string
          field_name: string | null
          summary: string | null
          created_at: string
        }
        Insert: {
          id?: string
          patient_id: string
          user_id?: string | null
          action: string
          field_name?: string | null
          summary?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          patient_id?: string
          user_id?: string | null
          action?: string
          field_name?: string | null
          summary?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_activity_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          acuity: string | null
          age: number | null
          admission_date: string | null
          alerts: string[]
          assigned_to: string | null
          attending_physician: string | null
          bed: string
          clinical_summary: string
          collapsed: boolean
          code_status: string | null
          consulting_team: string[]
          created_at: string
          field_timestamps: Json | null
          date_of_birth: string | null
          gender: string | null
          id: string
          imaging: string
          interval_events: string
          labs: string
          last_modified: string
          medications: Json | null
          mrn: string
          name: string
          patient_number: number
          revision: number
          service_line: string | null
          systems: Json
          user_id: string
          vitals: Json
        }
        Insert: {
          acuity?: string | null
          age?: number | null
          admission_date?: string | null
          alerts?: string[]
          assigned_to?: string | null
          attending_physician?: string | null
          bed?: string
          clinical_summary?: string
          collapsed?: boolean
          code_status?: string | null
          consulting_team?: string[]
          created_at?: string
          field_timestamps?: Json | null
          date_of_birth?: string | null
          gender?: string | null
          id?: string
          imaging?: string
          interval_events?: string
          labs?: string
          last_modified?: string
          medications?: Json | null
          mrn?: string
          name?: string
          patient_number: number
          revision?: number
          service_line?: string | null
          systems?: Json
          user_id: string
          vitals?: Json
        }
        Update: {
          acuity?: string | null
          age?: number | null
          admission_date?: string | null
          alerts?: string[]
          assigned_to?: string | null
          attending_physician?: string | null
          bed?: string
          clinical_summary?: string
          collapsed?: boolean
          code_status?: string | null
          consulting_team?: string[]
          created_at?: string
          field_timestamps?: Json | null
          date_of_birth?: string | null
          gender?: string | null
          id?: string
          imaging?: string
          interval_events?: string
          labs?: string
          last_modified?: string
          medications?: Json | null
          mrn?: string
          name?: string
          patient_number?: number
          revision?: number
          service_line?: string | null
          systems?: Json
          user_id?: string
          vitals?: Json
        }
        Relationships: []
      }
      phrase_fields: {
        Row: {
          calculation_formula: string | null
          conditional_logic: Json | null
          created_at: string
          default_value: string | null
          field_key: string
          field_type: Database["public"]["Enums"]["phrase_field_type"]
          id: string
          label: string
          options: Json | null
          phrase_id: string
          placeholder: string | null
          sort_order: number | null
          validation: Json | null
        }
        Insert: {
          calculation_formula?: string | null
          conditional_logic?: Json | null
          created_at?: string
          default_value?: string | null
          field_key: string
          field_type: Database["public"]["Enums"]["phrase_field_type"]
          id?: string
          label: string
          options?: Json | null
          phrase_id: string
          placeholder?: string | null
          sort_order?: number | null
          validation?: Json | null
        }
        Update: {
          calculation_formula?: string | null
          conditional_logic?: Json | null
          created_at?: string
          default_value?: string | null
          field_key?: string
          field_type?: Database["public"]["Enums"]["phrase_field_type"]
          id?: string
          label?: string
          options?: Json | null
          phrase_id?: string
          placeholder?: string | null
          sort_order?: number | null
          validation?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "phrase_fields_phrase_id_fkey"
            columns: ["phrase_id"]
            isOneToOne: false
            referencedRelation: "clinical_phrases"
            referencedColumns: ["id"]
          },
        ]
      }
      phrase_folders: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_shared: boolean | null
          name: string
          parent_id: string | null
          sort_order: number | null
          team_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_shared?: boolean | null
          name: string
          parent_id?: string | null
          sort_order?: number | null
          team_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_shared?: boolean | null
          name?: string
          parent_id?: string | null
          sort_order?: number | null
          team_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "phrase_folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "phrase_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      phrase_team_members: {
        Row: {
          created_at: string
          id: string
          role: string | null
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string | null
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string | null
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "phrase_team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "phrase_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      phrase_teams: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      phrase_usage_log: {
        Row: {
          created_at: string
          id: string
          input_values: Json | null
          inserted_content: string | null
          patient_id: string | null
          phrase_id: string
          target_field: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          input_values?: Json | null
          inserted_content?: string | null
          patient_id?: string | null
          phrase_id: string
          target_field?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          input_values?: Json | null
          inserted_content?: string | null
          patient_id?: string | null
          phrase_id?: string
          target_field?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "phrase_usage_log_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phrase_usage_log_phrase_id_fkey"
            columns: ["phrase_id"]
            isOneToOne: false
            referencedRelation: "clinical_phrases"
            referencedColumns: ["id"]
          },
        ]
      }
      phrase_versions: {
        Row: {
          change_note: string | null
          changed_by: string | null
          content: string
          created_at: string
          fields_snapshot: Json | null
          id: string
          phrase_id: string
          version: number
        }
        Insert: {
          change_note?: string | null
          changed_by?: string | null
          content: string
          created_at?: string
          fields_snapshot?: Json | null
          id?: string
          phrase_id: string
          version: number
        }
        Update: {
          change_note?: string | null
          changed_by?: string | null
          content?: string
          created_at?: string
          fields_snapshot?: Json | null
          id?: string
          phrase_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "phrase_versions_phrase_id_fkey"
            columns: ["phrase_id"]
            isOneToOne: false
            referencedRelation: "clinical_phrases"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          category: string
          content: string
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          category?: string
          content: string
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      user_dictionary: {
        Row: {
          correction: string
          created_at: string
          id: string
          misspelling: string
          user_id: string
        }
        Insert: {
          correction: string
          created_at?: string
          id?: string
          misspelling: string
          user_id: string
        }
        Update: {
          correction?: string
          created_at?: string
          id?: string
          misspelling?: string
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          app_preferences: Json | null
          created_at: string
          custom_prompts: Json | null
          id: string
          print_settings: Json | null
          section_visibility: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          app_preferences?: Json | null
          created_at?: string
          custom_prompts?: Json | null
          id?: string
          print_settings?: Json | null
          section_visibility?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          app_preferences?: Json | null
          created_at?: string
          custom_prompts?: Json | null
          id?: string
          print_settings?: Json | null
          section_visibility?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      round_state: {
        Row: {
          id: string
          user_id: string
          status: string
          state: Json
          position_updated_at: string
          expanded_updated_at: string
          device_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          status?: string
          state?: Json
          position_updated_at?: string
          expanded_updated_at?: string
          device_id?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          status?: string
          state?: Json
          position_updated_at?: string
          expanded_updated_at?: string
          device_id?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_phrase_team_id: { Args: { _phrase_id: string }; Returns: string }
      is_phrase_team_admin: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      is_phrase_team_member: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      record_owned_phrase_usage: {
        Args: {
          p_patient_id?: string | null
          p_phrase_id: string
          p_target_field?: string | null
        }
        Returns: {
          last_used_at: string
          usage_count: number
        }[]
      }
      upsert_owned_round_state: {
        Args: {
          p_device_id: string
          p_expanded_updated_at: string
          p_position_updated_at: string
          p_round_id: string
          p_state: Json
          p_status: string
          p_updated_at: string
        }
        Returns: {
          created_at: string
          device_id: string
          expanded_updated_at: string
          id: string
          position_updated_at: string
          state: Json
          status: string
          updated_at: string
          user_id: string
        }[]
      }
      update_owned_patient_json_field: {
        Args: {
          p_child_field: string
          p_field_timestamp?: string | null
          p_last_modified: string
          p_parent_field: string
          p_patient_id: string
          p_value: Json
        }
        Returns: boolean
      }
    }
    Enums: {
      phrase_field_type:
        | "text"
        | "number"
        | "date"
        | "dropdown"
        | "checkbox"
        | "radio"
        | "patient_data"
        | "calculation"
        | "conditional"
      phrase_trigger_type:
        | "autotext"
        | "hotkey"
        | "context_menu"
        | "smart_suggestion"
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
    Enums: {
      phrase_field_type: [
        "text",
        "number",
        "date",
        "dropdown",
        "checkbox",
        "radio",
        "patient_data",
        "calculation",
        "conditional",
      ],
      phrase_trigger_type: [
        "autotext",
        "hotkey",
        "context_menu",
        "smart_suggestion",
      ],
    },
  },
} as const
