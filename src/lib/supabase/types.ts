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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      preferences: {
        Row: {
          selectedAccountId: string | null
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          selectedAccountId?: string | null
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          selectedAccountId?: string | null
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "preferences_selectedAccountId_user_id_fkey"
            columns: ["selectedAccountId", "user_id"]
            isOneToOne: false
            referencedRelation: "account_records"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "preferences_selectedAccountId_user_id_fkey"
            columns: ["selectedAccountId", "user_id"]
            isOneToOne: false
            referencedRelation: "trading_accounts"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id: string
          name?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      scenarios: {
        Row: {
          createdAt: string
          id: string
          input: Json
          kind: string
          name: string
          user_id: string
        }
        Insert: {
          createdAt?: string
          id?: string
          input: Json
          kind: string
          name: string
          user_id: string
        }
        Update: {
          createdAt?: string
          id?: string
          input?: Json
          kind?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      strategies: {
        Row: {
          id: string
          name: string
          user_id: string
        }
        Insert: {
          id?: string
          name: string
          user_id: string
        }
        Update: {
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      trades: {
        Row: {
          accountId: string
          created_at: string
          date: string | null
          direction: string
          duration: number | null
          evidenceUrl: string
          feelings: string
          id: string
          notes: string
          pnl: number | null
          rewardRisk: number | null
          riskPercent: number | null
          sequence: number
          session: string
          sourceRow: number | null
          strategy: string
          symbol: string
          tags: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          accountId: string
          created_at?: string
          date?: string | null
          direction?: string
          duration?: number | null
          evidenceUrl?: string
          feelings?: string
          id?: string
          notes?: string
          pnl?: number | null
          rewardRisk?: number | null
          riskPercent?: number | null
          sequence: number
          session?: string
          sourceRow?: number | null
          strategy?: string
          symbol?: string
          tags?: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          accountId?: string
          created_at?: string
          date?: string | null
          direction?: string
          duration?: number | null
          evidenceUrl?: string
          feelings?: string
          id?: string
          notes?: string
          pnl?: number | null
          rewardRisk?: number | null
          riskPercent?: number | null
          sequence?: number
          session?: string
          sourceRow?: number | null
          strategy?: string
          symbol?: string
          tags?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "trades_accountId_user_id_fkey"
            columns: ["accountId", "user_id"]
            isOneToOne: false
            referencedRelation: "account_records"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "trades_accountId_user_id_fkey"
            columns: ["accountId", "user_id"]
            isOneToOne: false
            referencedRelation: "trading_accounts"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      trading_accounts: {
        Row: {
          baselineBreakEven: boolean
          breakEvenBand: number
          createdAt: string
          currency: string
          id: string
          initialBalance: number
          last_sequence: number
          name: string
          riskMetric: string
          sourceHash: string | null
          sourceSheet: string | null
          user_id: string
        }
        Insert: {
          baselineBreakEven?: boolean
          breakEvenBand?: number
          createdAt?: string
          currency?: string
          id?: string
          initialBalance: number
          last_sequence?: number
          name: string
          riskMetric?: string
          sourceHash?: string | null
          sourceSheet?: string | null
          user_id: string
        }
        Update: {
          baselineBreakEven?: boolean
          breakEvenBand?: number
          createdAt?: string
          currency?: string
          id?: string
          initialBalance?: number
          last_sequence?: number
          name?: string
          riskMetric?: string
          sourceHash?: string | null
          sourceSheet?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      account_records: {
        Row: {
          baselineBreakEven: boolean | null
          breakEvenBand: string | null
          createdAt: string | null
          currency: string | null
          id: string | null
          initialBalance: string | null
          last_sequence: number | null
          name: string | null
          riskMetric: string | null
          sourceHash: string | null
          sourceSheet: string | null
          user_id: string | null
        }
        Insert: {
          baselineBreakEven?: boolean | null
          breakEvenBand?: never
          createdAt?: string | null
          currency?: string | null
          id?: string | null
          initialBalance?: never
          last_sequence?: number | null
          name?: string | null
          riskMetric?: string | null
          sourceHash?: string | null
          sourceSheet?: string | null
          user_id?: string | null
        }
        Update: {
          baselineBreakEven?: boolean | null
          breakEvenBand?: never
          createdAt?: string | null
          currency?: string | null
          id?: string | null
          initialBalance?: never
          last_sequence?: number | null
          name?: string | null
          riskMetric?: string | null
          sourceHash?: string | null
          sourceSheet?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      trade_records: {
        Row: {
          accountId: string | null
          date: string | null
          direction: string | null
          duration: number | null
          evidenceUrl: string | null
          feelings: string | null
          id: string | null
          notes: string | null
          pnl: string | null
          rewardRisk: string | null
          riskPercent: string | null
          sequence: number | null
          session: string | null
          sourceRow: number | null
          strategy: string | null
          symbol: string | null
          tags: string | null
          user_id: string | null
          version: number | null
        }
        Insert: {
          accountId?: string | null
          date?: string | null
          direction?: string | null
          duration?: number | null
          evidenceUrl?: string | null
          feelings?: string | null
          id?: string | null
          notes?: string | null
          pnl?: never
          rewardRisk?: never
          riskPercent?: never
          sequence?: number | null
          session?: string | null
          sourceRow?: number | null
          strategy?: string | null
          symbol?: string | null
          tags?: string | null
          user_id?: string | null
          version?: number | null
        }
        Update: {
          accountId?: string | null
          date?: string | null
          direction?: string | null
          duration?: number | null
          evidenceUrl?: string | null
          feelings?: string | null
          id?: string | null
          notes?: string | null
          pnl?: never
          rewardRisk?: never
          riskPercent?: never
          sequence?: number | null
          session?: string | null
          sourceRow?: number | null
          strategy?: string | null
          symbol?: string | null
          tags?: string | null
          user_id?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "trades_accountId_user_id_fkey"
            columns: ["accountId", "user_id"]
            isOneToOne: false
            referencedRelation: "account_records"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "trades_accountId_user_id_fkey"
            columns: ["accountId", "user_id"]
            isOneToOne: false
            referencedRelation: "trading_accounts"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
    }
    Functions: {
      import_workbook: { Args: { p_sheets: Json }; Returns: Json }
      save_trade: { Args: { p_data: Json; p_id?: string }; Returns: Json }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
