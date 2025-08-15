// Database types for the List App
// These will be updated when we run: npx supabase gen types typescript

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          username: string | null
          created_at: string
        }
        Insert: {
          id: string
          username?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          username?: string | null
          created_at?: string
        }
        Relationships: []
      }
      groups: {
        Row: {
          id: string
          created_at: string
          name: string
          join_code: string
          created_by: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          name: string
          join_code: string
          created_by?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          name?: string
          join_code?: string
          created_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "groups_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      group_memberships: {
        Row: {
          id: string
          created_at: string
          user_id: string
          group_id: string
          role: string
        }
        Insert: {
          id?: string
          created_at?: string
          user_id: string
          group_id: string
          role?: string
        }
        Update: {
          id?: string
          created_at?: string
          user_id?: string
          group_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_memberships_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_memberships_group_id_fkey"
            columns: ["group_id"]
            referencedRelation: "groups"
            referencedColumns: ["id"]
          }
        ]
      }
      content: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          type: string
          data: string
          group_id: string
          user_id: string
          parent_content_id: string | null
          reply_count: number
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          type?: string
          data: string
          group_id: string
          user_id: string
          parent_content_id?: string | null
          reply_count?: number
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          type?: string
          data?: string
          group_id?: string
          user_id?: string
          parent_content_id?: string | null
          reply_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "content_group_id_fkey"
            columns: ["group_id"]
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_parent_content_id_fkey"
            columns: ["parent_content_id"]
            referencedRelation: "content"
            referencedColumns: ["id"]
          }
        ]
      }
      tags: {
        Row: {
          id: string
          created_at: string
          name: string
          color: string | null
          user_id: string
        }
        Insert: {
          id?: string
          created_at?: string
          name: string
          color?: string | null
          user_id: string
        }
        Update: {
          id?: string
          created_at?: string
          name?: string
          color?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      content_tags: {
        Row: {
          content_id: string
          tag_id: string
          created_at: string
        }
        Insert: {
          content_id: string
          tag_id: string
          created_at?: string
        }
        Update: {
          content_id?: string
          tag_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_tags_content_id_fkey"
            columns: ["content_id"]
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_tags_tag_id_fkey"
            columns: ["tag_id"]
            referencedRelation: "tags"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_join_code: {
        Args: Record<PropertyKey, never>
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