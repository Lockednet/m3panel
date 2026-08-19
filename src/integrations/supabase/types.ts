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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string
          hidden: boolean
          id: string
          items_count: number
          kind: Database["public"]["Enums"]["stream_kind"]
          name: string
          playlist_id: string
        }
        Insert: {
          created_at?: string
          hidden?: boolean
          id?: string
          items_count?: number
          kind: Database["public"]["Enums"]["stream_kind"]
          name: string
          playlist_id: string
        }
        Update: {
          created_at?: string
          hidden?: boolean
          id?: string
          items_count?: number
          kind?: Database["public"]["Enums"]["stream_kind"]
          name?: string
          playlist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          created_at: string
          id: string
          message: string | null
          playlist_id: string
          processed: number
          status: string
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          playlist_id: string
          processed?: number
          status?: string
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          playlist_id?: string
          processed?: number
          status?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      line_sessions: {
        Row: {
          ended_at: string | null
          id: string
          ip: string | null
          kind: string | null
          last_seen_at: string
          line_id: string
          started_at: string
          stream_ref: string | null
          user_agent: string | null
        }
        Insert: {
          ended_at?: string | null
          id?: string
          ip?: string | null
          kind?: string | null
          last_seen_at?: string
          line_id: string
          started_at?: string
          stream_ref?: string | null
          user_agent?: string | null
        }
        Update: {
          ended_at?: string | null
          id?: string
          ip?: string | null
          kind?: string | null
          last_seen_at?: string
          line_id?: string
          started_at?: string
          stream_ref?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "line_sessions_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "lines"
            referencedColumns: ["id"]
          },
        ]
      }
      lines: {
        Row: {
          banned: boolean
          created_at: string
          expires_at: string | null
          id: string
          is_trial: boolean
          last_seen_at: string | null
          max_connections: number
          notes: string | null
          owner_id: string
          package_id: string | null
          password: string
          playlist_id: string
          updated_at: string
          username: string
        }
        Insert: {
          banned?: boolean
          created_at?: string
          expires_at?: string | null
          id?: string
          is_trial?: boolean
          last_seen_at?: string | null
          max_connections?: number
          notes?: string | null
          owner_id: string
          package_id?: string | null
          password: string
          playlist_id: string
          updated_at?: string
          username: string
        }
        Update: {
          banned?: boolean
          created_at?: string
          expires_at?: string | null
          id?: string
          is_trial?: boolean
          last_seen_at?: string | null
          max_connections?: number
          notes?: string | null
          owner_id?: string
          package_id?: string | null
          password?: string
          playlist_id?: string
          updated_at?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "lines_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lines_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      package_categories: {
        Row: {
          category_id: string
          package_id: string
        }
        Insert: {
          category_id: string
          package_id: string
        }
        Update: {
          category_id?: string
          package_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "package_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_categories_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      packages: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          playlist_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          playlist_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          playlist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "packages_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      playlists: {
        Row: {
          created_at: string
          id: string
          last_import_at: string | null
          name: string
          owner_id: string
          source_type: string
          source_url: string | null
          status: string
          total_items: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_import_at?: string | null
          name: string
          owner_id: string
          source_type?: string
          source_url?: string | null
          status?: string
          total_items?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_import_at?: string | null
          name?: string
          owner_id?: string
          source_type?: string
          source_url?: string | null
          status?: string
          total_items?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          credits: number
          display_name: string | null
          email: string | null
          id: string
          parent_id: string | null
        }
        Insert: {
          created_at?: string
          credits?: number
          display_name?: string | null
          email?: string | null
          id: string
          parent_id?: string | null
        }
        Update: {
          created_at?: string
          credits?: number
          display_name?: string | null
          email?: string | null
          id?: string
          parent_id?: string | null
        }
        Relationships: []
      }
      series: {
        Row: {
          category_id: string | null
          created_at: string
          hidden: boolean
          id: number
          logo: string | null
          name: string
          playlist_id: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          hidden?: boolean
          id?: number
          logo?: string | null
          name: string
          playlist_id: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          hidden?: boolean
          id?: number
          logo?: string | null
          name?: string
          playlist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "series_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "series_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      series_episodes: {
        Row: {
          container_ext: string | null
          created_at: string
          episode: number
          id: number
          logo: string | null
          name: string
          playlist_id: string
          season: number
          series_id: number
          url: string
        }
        Insert: {
          container_ext?: string | null
          created_at?: string
          episode?: number
          id?: number
          logo?: string | null
          name: string
          playlist_id: string
          season?: number
          series_id: number
          url: string
        }
        Update: {
          container_ext?: string | null
          created_at?: string
          episode?: number
          id?: number
          logo?: string | null
          name?: string
          playlist_id?: string
          season?: number
          series_id?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "series_episodes_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "series_episodes_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      streams: {
        Row: {
          category_id: string | null
          container_ext: string | null
          created_at: string
          hidden: boolean
          id: number
          kind: Database["public"]["Enums"]["stream_kind"]
          logo: string | null
          name: string
          playlist_id: string
          tvg_id: string | null
          url: string
        }
        Insert: {
          category_id?: string | null
          container_ext?: string | null
          created_at?: string
          hidden?: boolean
          id?: number
          kind: Database["public"]["Enums"]["stream_kind"]
          logo?: string | null
          name: string
          playlist_id: string
          tvg_id?: string | null
          url: string
        }
        Update: {
          category_id?: string | null
          container_ext?: string | null
          created_at?: string
          hidden?: boolean
          id?: number
          kind?: Database["public"]["Enums"]["stream_kind"]
          logo?: string | null
          name?: string
          playlist_id?: string
          tvg_id?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "streams_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "streams_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      owns_playlist: { Args: { _playlist_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "reseller"
      stream_kind: "live" | "movie" | "series"
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
      app_role: ["admin", "reseller"],
      stream_kind: ["live", "movie", "series"],
    },
  },
} as const
