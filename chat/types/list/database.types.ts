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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      content: {
        Row: {
          created_at: string
          data: string
          group_id: string
          id: string
          metadata: Json | null
          parent_content_id: string | null
          path: unknown | null
          search_vector: unknown | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data: string
          group_id: string
          id?: string
          metadata?: Json | null
          parent_content_id?: string | null
          path?: unknown | null
          search_vector?: unknown | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          data?: string
          group_id?: string
          id?: string
          metadata?: Json | null
          parent_content_id?: string | null
          path?: unknown | null
          search_vector?: unknown | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_parent_content_id_fkey"
            columns: ["parent_content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_parent_content_id_fkey"
            columns: ["parent_content_id"]
            isOneToOne: false
            referencedRelation: "public_content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      content_tags: {
        Row: {
          content_id: string
          created_at: string
          tag_id: string
        }
        Insert: {
          content_id: string
          created_at?: string
          tag_id: string
        }
        Update: {
          content_id?: string
          created_at?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_tags_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_tags_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "public_content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      group_invitations: {
        Row: {
          group_id: string
          id: string
          invite_code_used: string
          invitee_user_id: string
          inviter_user_id: string
          joined_at: string
        }
        Insert: {
          group_id: string
          id?: string
          invite_code_used: string
          invitee_user_id: string
          inviter_user_id: string
          joined_at?: string
        }
        Update: {
          group_id?: string
          id?: string
          invite_code_used?: string
          invitee_user_id?: string
          inviter_user_id?: string
          joined_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_invitations_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_invitations_invitee_user_id_fkey"
            columns: ["invitee_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_invitations_inviter_user_id_fkey"
            columns: ["inviter_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      group_memberships: {
        Row: {
          created_at: string
          group_id: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          role?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_memberships_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          join_code: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          join_code?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          join_code?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      repl_history: {
        Row: {
          command: string
          error_message: string | null
          executed_at: string | null
          execution_time_ms: number | null
          id: string
          metadata: Json | null
          result: Json | null
          status: string | null
          user_id: string
        }
        Insert: {
          command: string
          error_message?: string | null
          executed_at?: string | null
          execution_time_ms?: number | null
          id?: string
          metadata?: Json | null
          result?: Json | null
          status?: string | null
          user_id: string
        }
        Update: {
          command?: string
          error_message?: string | null
          executed_at?: string | null
          execution_time_ms?: number | null
          id?: string
          metadata?: Json | null
          result?: Json | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "repl_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_invite_codes: {
        Row: {
          created_at: string
          current_uses: number
          expires_at: string | null
          group_id: string
          id: string
          invite_code: string
          is_active: boolean
          max_uses: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          current_uses?: number
          expires_at?: string | null
          group_id: string
          id?: string
          invite_code: string
          is_active?: boolean
          max_uses?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          current_uses?: number
          expires_at?: string | null
          group_id?: string
          id?: string
          invite_code?: string
          is_active?: boolean
          max_uses?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_invite_codes_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_invite_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          id: string
          username: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          username?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          username?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      public_content: {
        Row: {
          created_at: string | null
          data: string | null
          id: string | null
          metadata: Json | null
          shared_at: string | null
          shared_by: string | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          data?: string | null
          id?: string | null
          metadata?: Json | null
          shared_at?: never
          shared_by?: never
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          data?: string | null
          id?: string | null
          metadata?: Json | null
          shared_at?: never
          shared_by?: never
          type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _ltree_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      _ltree_gist_options: {
        Args: { "": unknown }
        Returns: undefined
      }
      check_content_has_public_ancestor: {
        Args: { content_path: unknown }
        Returns: boolean
      }
      cleanup_old_repl_history: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      create_user_invite_code: {
        Args: {
          p_expires_at?: string
          p_group_id?: string
          p_max_uses?: number
          p_user_id?: string
        }
        Returns: Json
      }
      extract_urls: {
        Args: { input_text: string }
        Returns: string[]
      }
      find_seo_content_by_url: {
        Args: { parent_id: string; url: string }
        Returns: string
      }
      fuzzy_search_content: {
        Args: {
          group_uuid?: string
          result_limit?: number
          search_query: string
        }
        Returns: {
          created_at: string
          data: string
          group_id: string
          id: string
          match_type: string
          parent_content_id: string
          rank: number
          type: string
          updated_at: string
          user_id: string
        }[]
      }
      generate_content_path: {
        Args: {
          p_content_id: string
          p_group_id: string
          p_parent_content_id: string
        }
        Returns: unknown
      }
      generate_join_code: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_user_invite_code: {
        Args: { p_group_id: string; p_user_id: string }
        Returns: string
      }
      get_invite_graph: {
        Args: { p_group_id: string }
        Returns: {
          invite_code_used: string
          invitee_user_id: string
          invitee_username: string
          inviter_user_id: string
          inviter_username: string
          joined_at: string
        }[]
      }
      get_public_content_url: {
        Args: { content_id: string }
        Returns: string
      }
      get_user_invite_stats: {
        Args: { p_group_id?: string; p_user_id?: string }
        Returns: {
          created_at: string
          current_uses: number
          expires_at: string
          group_id: string
          group_name: string
          invite_code: string
          max_uses: number
          successful_invites: number
        }[]
      }
      gtrgm_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_decompress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_options: {
        Args: { "": unknown }
        Returns: undefined
      }
      gtrgm_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      hash_ltree: {
        Args: { "": unknown }
        Returns: number
      }
      is_admin_user: {
        Args: { user_uuid?: string }
        Returns: boolean
      }
      is_group_creator: {
        Args: { group_uuid: string; user_uuid: string }
        Returns: boolean
      }
      join_group_safe: {
        Args: { p_join_code: string; p_user_id?: string }
        Returns: Json
      }
      join_group_with_user_code: {
        Args: { p_invite_code: string; p_user_id?: string }
        Returns: Json
      }
      lca: {
        Args: { "": unknown[] }
        Returns: unknown
      }
      lquery_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      lquery_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      lquery_recv: {
        Args: { "": unknown }
        Returns: unknown
      }
      lquery_send: {
        Args: { "": unknown }
        Returns: string
      }
      ltree_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      ltree_decompress: {
        Args: { "": unknown }
        Returns: unknown
      }
      ltree_gist_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      ltree_gist_options: {
        Args: { "": unknown }
        Returns: undefined
      }
      ltree_gist_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      ltree_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      ltree_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      ltree_recv: {
        Args: { "": unknown }
        Returns: unknown
      }
      ltree_send: {
        Args: { "": unknown }
        Returns: string
      }
      ltree2text: {
        Args: { "": unknown }
        Returns: string
      }
      ltxtq_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      ltxtq_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      ltxtq_recv: {
        Args: { "": unknown }
        Returns: unknown
      }
      ltxtq_send: {
        Args: { "": unknown }
        Returns: string
      }
      nlevel: {
        Args: { "": unknown }
        Returns: number
      }
      search_content: {
        Args: {
          group_uuid?: string
          result_limit?: number
          search_query: string
        }
        Returns: {
          created_at: string
          data: string
          group_id: string
          id: string
          parent_content_id: string
          rank: number
          type: string
          updated_at: string
          user_id: string
        }[]
      }
      search_content_fuzzy: {
        Args: {
          group_uuid?: string
          result_limit?: number
          search_query: string
        }
        Returns: {
          created_at: string
          data: string
          group_id: string
          id: string
          parent_content_id: string
          rank: number
          type: string
          updated_at: string
          user_id: string
        }[]
      }
      set_limit: {
        Args: { "": number }
        Returns: number
      }
      show_limit: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      show_trgm: {
        Args: { "": string }
        Returns: string[]
      }
      simple_search_content: {
        Args: { group_uuid?: string; search_query: string }
        Returns: {
          created_at: string
          data: string
          group_id: string
          id: string
          metadata: Json | null
          parent_content_id: string | null
          path: unknown | null
          search_vector: unknown | null
          type: string
          updated_at: string
          user_id: string
        }[]
      }
      text2ltree: {
        Args: { "": string }
        Returns: unknown
      }
      toggle_content_sharing: {
        Args: { content_id: string; is_public: boolean; user_id: string }
        Returns: Json
      }
      unaccent: {
        Args: { "": string }
        Returns: string
      }
      unaccent_init: {
        Args: { "": unknown }
        Returns: unknown
      }
      upsert_seo_content: {
        Args: {
          group_id: string
          parent_id: string
          seo_metadata?: Json
          url: string
          user_id: string
        }
        Returns: string
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