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
      entity_embeddings: {
        Row: {
          content_hash: string
          content_preview: string | null
          embedding: string
          entity_id: string
          entity_type: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content_hash: string
          content_preview?: string | null
          embedding: string
          entity_id: string
          entity_type: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content_hash?: string
          content_preview?: string | null
          embedding?: string
          entity_id?: string
          entity_type?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      entity_links: {
        Row: {
          created_at: string
          id: string
          label: string | null
          source_id: string
          source_type: string
          target_id: string
          target_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          source_id: string
          source_type: string
          target_id: string
          target_type: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          source_id?: string
          source_type?: string
          target_id?: string
          target_type?: string
          user_id?: string
        }
        Relationships: []
      }
      link_suggestions: {
        Row: {
          created_at: string
          id: string
          reason: string | null
          score: number
          source_id: string
          source_type: string
          status: string
          target_id: string
          target_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason?: string | null
          score: number
          source_id: string
          source_type: string
          status?: string
          target_id: string
          target_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string | null
          score?: number
          source_id?: string
          source_type?: string
          status?: string
          target_id?: string
          target_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notes: {
        Row: {
          archived: boolean
          color: string | null
          content: string | null
          created_at: string
          emoji: string | null
          id: string
          pinned: boolean
          tags: string[] | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          color?: string | null
          content?: string | null
          created_at?: string
          emoji?: string | null
          id?: string
          pinned?: boolean
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          archived?: boolean
          color?: string | null
          content?: string | null
          created_at?: string
          emoji?: string | null
          id?: string
          pinned?: boolean
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          archived: boolean
          cover_color: string | null
          created_at: string
          description: string | null
          emoji: string | null
          id: string
          parent_id: string | null
          start_date: string | null
          status: string
          target_date: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          cover_color?: string | null
          created_at?: string
          description?: string | null
          emoji?: string | null
          id?: string
          parent_id?: string | null
          start_date?: string | null
          status?: string
          target_date?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          archived?: boolean
          cover_color?: string | null
          created_at?: string
          description?: string | null
          emoji?: string | null
          id?: string
          parent_id?: string | null
          start_date?: string | null
          status?: string
          target_date?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      radar_empresas: {
        Row: {
          cnpj: string | null
          created_at: string
          email: string | null
          endereco: string | null
          id: string
          is_default: boolean
          nome: string
          responsavel: string | null
          telefone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cnpj?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          is_default?: boolean
          nome: string
          responsavel?: string | null
          telefone?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          cnpj?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          is_default?: boolean
          nome?: string
          responsavel?: string | null
          telefone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      radar_entity_links: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          produto_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          produto_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          produto_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "radar_entity_links_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "radar_produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      radar_fornecedores: {
        Row: {
          cnpj: string | null
          contato: string | null
          created_at: string
          email: string | null
          empresa: string | null
          endereco: string | null
          id: string
          nome: string
          observacoes: string | null
          telefone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cnpj?: string | null
          contato?: string | null
          created_at?: string
          email?: string | null
          empresa?: string | null
          endereco?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          telefone?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          cnpj?: string | null
          contato?: string | null
          created_at?: string
          email?: string | null
          empresa?: string | null
          endereco?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          telefone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      radar_historico: {
        Row: {
          event: string
          field: string | null
          id: string
          new_value: string | null
          old_value: string | null
          produto_id: string
          stage: string | null
          timestamp: string
          user_id: string
        }
        Insert: {
          event: string
          field?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          produto_id: string
          stage?: string | null
          timestamp?: string
          user_id: string
        }
        Update: {
          event?: string
          field?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          produto_id?: string
          stage?: string | null
          timestamp?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "radar_historico_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "radar_produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      radar_parametros: {
        Row: {
          auto_descarte: Json
          decisao_thresholds: Json
          descartes_extras: Json
          faixas: Json
          id: string
          pilares_extras: Json
          pilares_visibilidade: Json
          updated_at: string
          user_id: string
          weights: Json
        }
        Insert: {
          auto_descarte?: Json
          decisao_thresholds?: Json
          descartes_extras?: Json
          faixas?: Json
          id?: string
          pilares_extras?: Json
          pilares_visibilidade?: Json
          updated_at?: string
          user_id: string
          weights?: Json
        }
        Update: {
          auto_descarte?: Json
          decisao_thresholds?: Json
          descartes_extras?: Json
          faixas?: Json
          id?: string
          pilares_extras?: Json
          pilares_visibilidade?: Json
          updated_at?: string
          user_id?: string
          weights?: Json
        }
        Relationships: []
      }
      radar_produtos: {
        Row: {
          concorrentes_full: number | null
          copia_de: string | null
          created_at: string
          custo: number | null
          decisao_final: string | null
          decisao_motivo: string | null
          decision: string
          fornecedor: string
          id: string
          is_lancamento: boolean
          link_ml: string | null
          margem: number | null
          nome: string
          observacoes: string | null
          preco_venda: number | null
          quantidade_pedir: number | null
          score_total: number
          stage: string
          stage_entered_at: string
          status_compra: string
          updated_at: string
          user_id: string
          valores_custom: Json
          vendas_mes: number | null
          visitas_mes: number | null
        }
        Insert: {
          concorrentes_full?: number | null
          copia_de?: string | null
          created_at?: string
          custo?: number | null
          decisao_final?: string | null
          decisao_motivo?: string | null
          decision?: string
          fornecedor: string
          id?: string
          is_lancamento?: boolean
          link_ml?: string | null
          margem?: number | null
          nome: string
          observacoes?: string | null
          preco_venda?: number | null
          quantidade_pedir?: number | null
          score_total?: number
          stage?: string
          stage_entered_at?: string
          status_compra?: string
          updated_at?: string
          user_id: string
          valores_custom?: Json
          vendas_mes?: number | null
          visitas_mes?: number | null
        }
        Update: {
          concorrentes_full?: number | null
          copia_de?: string | null
          created_at?: string
          custo?: number | null
          decisao_final?: string | null
          decisao_motivo?: string | null
          decision?: string
          fornecedor?: string
          id?: string
          is_lancamento?: boolean
          link_ml?: string | null
          margem?: number | null
          nome?: string
          observacoes?: string | null
          preco_venda?: number | null
          quantidade_pedir?: number | null
          score_total?: number
          stage?: string
          stage_entered_at?: string
          status_compra?: string
          updated_at?: string
          user_id?: string
          valores_custom?: Json
          vendas_mes?: number | null
          visitas_mes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "radar_produtos_copia_de_fkey"
            columns: ["copia_de"]
            isOneToOne: false
            referencedRelation: "radar_produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          archived: boolean
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          due_time: string | null
          estimated_minutes: number | null
          id: string
          manual_status_override: string | null
          priority: string
          recurrence_days: number[] | null
          recurrence_end_date: string | null
          recurrence_parent_id: string | null
          recurrence_rule: string | null
          status: string
          subtasks: Json
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          due_time?: string | null
          estimated_minutes?: number | null
          id?: string
          manual_status_override?: string | null
          priority?: string
          recurrence_days?: number[] | null
          recurrence_end_date?: string | null
          recurrence_parent_id?: string | null
          recurrence_rule?: string | null
          status?: string
          subtasks?: Json
          title?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          archived?: boolean
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          due_time?: string | null
          estimated_minutes?: number | null
          id?: string
          manual_status_override?: string | null
          priority?: string
          recurrence_days?: number[] | null
          recurrence_end_date?: string | null
          recurrence_parent_id?: string | null
          recurrence_rule?: string | null
          status?: string
          subtasks?: Json
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      project_progress_recursive: {
        Row: {
          done_tasks_recursive: number | null
          progress_percent: number | null
          project_id: string | null
          total_tasks_recursive: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      auto_triage_tasks: { Args: never; Returns: undefined }
      match_entities: {
        Args: {
          exclude_id?: string
          exclude_type?: string
          match_count?: number
          query_embedding: string
        }
        Returns: {
          content_preview: string
          entity_id: string
          entity_type: string
          similarity: number
        }[]
      }
      upsert_entity_embedding: {
        Args: {
          p_content_hash: string
          p_content_preview: string
          p_embedding: number[]
          p_entity_id: string
          p_entity_type: string
        }
        Returns: undefined
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
