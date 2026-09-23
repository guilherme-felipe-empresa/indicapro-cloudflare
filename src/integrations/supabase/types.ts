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
      app_settings: {
        Row: {
          allow_self_referral: boolean
          app_name: string
          attribution_days: number
          direct_sales_admin_id: string | null
          id: boolean
          min_withdrawal_cents: number
          support_email: string | null
          support_phone: string | null
          updated_at: string
          whatsapp_number: string
        }
        Insert: {
          allow_self_referral?: boolean
          app_name?: string
          attribution_days?: number
          direct_sales_admin_id?: string | null
          id?: boolean
          min_withdrawal_cents?: number
          support_email?: string | null
          support_phone?: string | null
          updated_at?: string
          whatsapp_number?: string
        }
        Update: {
          allow_self_referral?: boolean
          app_name?: string
          attribution_days?: number
          direct_sales_admin_id?: string | null
          id?: boolean
          min_withdrawal_cents?: number
          support_email?: string | null
          support_phone?: string | null
          updated_at?: string
          whatsapp_number?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          admin_id: string | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          new_value: Json | null
          old_value: Json | null
        }
        Insert: {
          action: string
          admin_id?: string | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
        }
        Update: {
          action?: string
          admin_id?: string | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
        }
        Relationships: []
      }
      products: {
        Row: {
          active: boolean
          category: string
          commission_type: Database["public"]["Enums"]["commission_type"]
          commission_value: number
          created_at: string
          description: string
          id: string
          image_url: string | null
          name: string
          price_cents: number
          slug: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string
          commission_type?: Database["public"]["Enums"]["commission_type"]
          commission_value: number
          created_at?: string
          description?: string
          id?: string
          image_url?: string | null
          name: string
          price_cents: number
          slug: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          commission_type?: Database["public"]["Enums"]["commission_type"]
          commission_value?: number
          created_at?: string
          description?: string
          id?: string
          image_url?: string | null
          name?: string
          price_cents?: number
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          phone: string | null
          pix_key: string | null
          pix_key_type: Database["public"]["Enums"]["pix_key_type"] | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string
          id: string
          name?: string
          phone?: string | null
          pix_key?: string | null
          pix_key_type?: Database["public"]["Enums"]["pix_key_type"] | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string | null
          pix_key?: string | null
          pix_key_type?: Database["public"]["Enums"]["pix_key_type"] | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      purchase_intents: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          code: string
          commission_cents: number
          created_at: string
          id: string
          note: string | null
          price_cents: number
          product_id: string
          product_name: string
          proof_name: string | null
          proof_path: string | null
          proof_ref: string | null
          referral_token: string | null
          referrer_id: string | null
          status: Database["public"]["Enums"]["intent_status"]
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          code: string
          commission_cents?: number
          created_at?: string
          id?: string
          note?: string | null
          price_cents: number
          product_id: string
          product_name: string
          proof_name?: string | null
          proof_path?: string | null
          proof_ref?: string | null
          referral_token?: string | null
          referrer_id?: string | null
          status?: Database["public"]["Enums"]["intent_status"]
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          code?: string
          commission_cents?: number
          created_at?: string
          id?: string
          note?: string | null
          price_cents?: number
          product_id?: string
          product_name?: string
          proof_name?: string | null
          proof_path?: string | null
          proof_ref?: string | null
          referral_token?: string | null
          referrer_id?: string | null
          status?: Database["public"]["Enums"]["intent_status"]
        }
        Relationships: [
          {
            foreignKeyName: "purchase_intents_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_links: {
        Row: {
          created_at: string
          id: string
          product_id: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_links_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          attachment_name: string | null
          attachment_path: string | null
          created_at: string
          id: string
          is_internal: boolean
          message: string
          read_at: string | null
          sender_id: string | null
          sender_type: Database["public"]["Enums"]["support_sender"]
          ticket_id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_path?: string | null
          created_at?: string
          id?: string
          is_internal?: boolean
          message: string
          read_at?: string | null
          sender_id?: string | null
          sender_type: Database["public"]["Enums"]["support_sender"]
          ticket_id: string
        }
        Update: {
          attachment_name?: string | null
          attachment_path?: string | null
          created_at?: string
          id?: string
          is_internal?: boolean
          message?: string
          read_at?: string | null
          sender_id?: string | null
          sender_type?: Database["public"]["Enums"]["support_sender"]
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          category: Database["public"]["Enums"]["support_category"]
          closed_at: string | null
          created_at: string
          id: string
          protocol: string
          resolved_at: string | null
          status: Database["public"]["Enums"]["support_status"]
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["support_category"]
          closed_at?: string | null
          created_at?: string
          id?: string
          protocol: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["support_status"]
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["support_category"]
          closed_at?: string | null
          created_at?: string
          id?: string
          protocol?: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["support_status"]
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount_cents: number
          created_at: string
          description: string | null
          id: string
          purchase_intent_id: string | null
          type: Database["public"]["Enums"]["wallet_tx_type"]
          user_id: string
          withdrawal_id: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string
          description?: string | null
          id?: string
          purchase_intent_id?: string | null
          type: Database["public"]["Enums"]["wallet_tx_type"]
          user_id: string
          withdrawal_id?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string
          description?: string | null
          id?: string
          purchase_intent_id?: string | null
          type?: Database["public"]["Enums"]["wallet_tx_type"]
          user_id?: string
          withdrawal_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_purchase_intent_id_fkey"
            columns: ["purchase_intent_id"]
            isOneToOne: true
            referencedRelation: "purchase_intents"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawals: {
        Row: {
          admin_id: string | null
          amount_cents: number
          created_at: string
          id: string
          note: string | null
          paid_at: string | null
          payment_reference: string | null
          pix_key: string
          pix_key_type: Database["public"]["Enums"]["pix_key_type"]
          status: Database["public"]["Enums"]["withdrawal_status"]
          user_id: string
        }
        Insert: {
          admin_id?: string | null
          amount_cents: number
          created_at?: string
          id?: string
          note?: string | null
          paid_at?: string | null
          payment_reference?: string | null
          pix_key: string
          pix_key_type: Database["public"]["Enums"]["pix_key_type"]
          status?: Database["public"]["Enums"]["withdrawal_status"]
          user_id: string
        }
        Update: {
          admin_id?: string | null
          amount_cents?: number
          created_at?: string
          id?: string
          note?: string | null
          paid_at?: string | null
          payment_reference?: string | null
          pix_key?: string
          pix_key_type?: Database["public"]["Enums"]["pix_key_type"]
          status?: Database["public"]["Enums"]["withdrawal_status"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_delete_product: { Args: { _id: string }; Returns: string }
      admin_delete_ticket: { Args: { _ticket_id: string }; Returns: string[] }
      admin_list_support_tickets: {
        Args: never
        Returns: {
          category: Database["public"]["Enums"]["support_category"]
          created_at: string
          id: string
          protocol: string
          status: Database["public"]["Enums"]["support_status"]
          subject: string
          unread_count: number
          updated_at: string
          user_email: string
          user_id: string
          user_name: string
          user_phone: string
        }[]
      }
      admin_list_users: {
        Args: never
        Returns: {
          balance_cents: number
          created_at: string
          email: string
          id: string
          name: string
          phone: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
        }[]
      }
      admin_set_ticket_status: {
        Args: {
          _status: Database["public"]["Enums"]["support_status"]
          _ticket_id: string
        }
        Returns: undefined
      }
      admin_set_user_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
      admin_set_user_status: {
        Args: { _status: string; _user_id: string }
        Returns: undefined
      }
      admin_stats: { Args: never; Returns: Json }
      admin_support_unread_count: { Args: never; Returns: number }
      commission_cents: {
        Args: {
          _price: number
          _type: Database["public"]["Enums"]["commission_type"]
          _value: number
        }
        Returns: number
      }
      create_purchase_intent: {
        Args: { _ref?: string; _slug: string }
        Returns: {
          code: string
          product_name: string
          whatsapp_number: string
        }[]
      }
      create_support_ticket: {
        Args: {
          _attachment_name?: string
          _attachment_path?: string
          _category: Database["public"]["Enums"]["support_category"]
          _message: string
          _subject: string
        }
        Returns: {
          id: string
          protocol: string
        }[]
      }
      get_or_create_referral_link: {
        Args: { _product_id: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      list_my_support_tickets: {
        Args: never
        Returns: {
          category: Database["public"]["Enums"]["support_category"]
          created_at: string
          id: string
          last_message: string
          protocol: string
          status: Database["public"]["Enums"]["support_status"]
          subject: string
          unread_count: number
          updated_at: string
        }[]
      }
      log_audit: {
        Args: {
          _action: string
          _entity: string
          _entity_id: string
          _new: Json
          _old: Json
        }
        Returns: undefined
      }
      mark_support_read: { Args: { _ticket_id: string }; Returns: undefined }
      post_support_message: {
        Args: {
          _attachment_name?: string
          _attachment_path?: string
          _is_internal?: boolean
          _message: string
          _ticket_id: string
        }
        Returns: string
      }
      request_withdrawal: { Args: { _amount_cents: number }; Returns: string }
      set_intent_status: {
        Args: {
          _id: string
          _note?: string
          _proof_name?: string
          _proof_path?: string
          _proof_ref?: string
          _status: Database["public"]["Enums"]["intent_status"]
        }
        Returns: undefined
      }
      set_withdrawal_status: {
        Args: {
          _id: string
          _note?: string
          _reference?: string
          _status: Database["public"]["Enums"]["withdrawal_status"]
        }
        Returns: undefined
      }
      support_new_protocol: { Args: never; Returns: string }
      support_unread_count: { Args: never; Returns: number }
      wallet_summary: {
        Args: never
        Returns: {
          available_cents: number
          pending_cents: number
          total_received_cents: number
          withdrawing_cents: number
        }[]
      }
    }
    Enums: {
      app_role: "user" | "admin"
      commission_type: "fixed" | "percentage"
      intent_status: "pending" | "approved" | "failed"
      pix_key_type: "cpf" | "cnpj" | "email" | "phone" | "random"
      support_category:
        | "commission"
        | "referral"
        | "withdrawal"
        | "product"
        | "account"
        | "technical"
        | "other"
      support_sender: "user" | "admin"
      support_status:
        | "open"
        | "in_progress"
        | "waiting_user"
        | "resolved"
        | "closed"
      wallet_tx_type: "commission_credit" | "withdrawal_debit" | "adjustment"
      withdrawal_status: "pending" | "paid" | "failed" | "rejected"
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
    Enums: {
      app_role: ["user", "admin"],
      commission_type: ["fixed", "percentage"],
      intent_status: ["pending", "approved", "failed"],
      pix_key_type: ["cpf", "cnpj", "email", "phone", "random"],
      support_category: [
        "commission",
        "referral",
        "withdrawal",
        "product",
        "account",
        "technical",
        "other",
      ],
      support_sender: ["user", "admin"],
      support_status: [
        "open",
        "in_progress",
        "waiting_user",
        "resolved",
        "closed",
      ],
      wallet_tx_type: ["commission_credit", "withdrawal_debit", "adjustment"],
      withdrawal_status: ["pending", "paid", "failed", "rejected"],
    },
  },
} as const
