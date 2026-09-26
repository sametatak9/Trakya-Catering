// Supabase tarafından üretildi (generate_typescript_types). Elle düzenlemeyin; şema değişince yeniden üretin.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor: string | null
          actor_kind: string
          at: string
          diff: Json
          entity_id: string | null
          entity_type: string
          id: number
          summary: string | null
        }
        Insert: {
          action: string
          actor?: string | null
          actor_kind?: string
          at?: string
          diff?: Json
          entity_id?: string | null
          entity_type: string
          id?: never
          summary?: string | null
        }
        Update: {
          action?: string
          actor?: string | null
          actor_kind?: string
          at?: string
          diff?: Json
          entity_id?: string | null
          entity_type?: string
          id?: never
          summary?: string | null
        }
        Relationships: []
      }
      ingredient_prices: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          ingredient_id: string
          noted_at: string
          price: number
          source: string
          supplier_name: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          ingredient_id: string
          noted_at?: string
          price: number
          source?: string
          supplier_name?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          ingredient_id?: string
          noted_at?: string
          price?: number
          source?: string
          supplier_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ingredient_prices_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredients: {
        Row: {
          active: boolean
          allergens: string[]
          avg_cost: number | null
          category: string
          code: string | null
          created_at: string
          id: string
          last_price: number | null
          min_stock: number
          name: string
          notes: string | null
          price_updated_at: string | null
          stock_unit: string
          updated_at: string
          vat_rate: number
          waste_pct: number
        }
        Insert: {
          active?: boolean
          allergens?: string[]
          avg_cost?: number | null
          category?: string
          code?: string | null
          created_at?: string
          id?: string
          last_price?: number | null
          min_stock?: number
          name: string
          notes?: string | null
          price_updated_at?: string | null
          stock_unit: string
          updated_at?: string
          vat_rate?: number
          waste_pct?: number
        }
        Update: {
          active?: boolean
          allergens?: string[]
          avg_cost?: number | null
          category?: string
          code?: string | null
          created_at?: string
          id?: string
          last_price?: number | null
          min_stock?: number
          name?: string
          notes?: string | null
          price_updated_at?: string | null
          stock_unit?: string
          updated_at?: string
          vat_rate?: number
          waste_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "ingredients_stock_unit_fkey"
            columns: ["stock_unit"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["code"]
          },
        ]
      }
      menu_items: {
        Row: {
          created_at: string
          id: string
          menu_id: string
          portion_factor: number
          recipe_id: string
          sort: number
        }
        Insert: {
          created_at?: string
          id?: string
          menu_id: string
          portion_factor?: number
          recipe_id: string
          sort?: number
        }
        Update: {
          created_at?: string
          id?: string
          menu_id?: string
          portion_factor?: number
          recipe_id?: string
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "v_menu_costs"
            referencedColumns: ["menu_id"]
          },
          {
            foreignKeyName: "menu_items_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "v_recipe_costs"
            referencedColumns: ["recipe_id"]
          },
        ]
      }
      menus: {
        Row: {
          active: boolean
          code: string | null
          created_at: string
          id: string
          kind: string
          meal: string
          name: string
          notes: string | null
          target_price: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          code?: string | null
          created_at?: string
          id?: string
          kind?: string
          meal?: string
          name: string
          notes?: string | null
          target_price?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string | null
          created_at?: string
          id?: string
          kind?: string
          meal?: string
          name?: string
          notes?: string | null
          target_price?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      recipe_categories: {
        Row: {
          code: string
          name: string
          sort: number
        }
        Insert: {
          code: string
          name: string
          sort?: number
        }
        Update: {
          code?: string
          name?: string
          sort?: number
        }
        Relationships: []
      }
      recipe_ingredients: {
        Row: {
          created_at: string
          id: string
          ingredient_id: string
          net_qty: number
          note: string | null
          recipe_id: string
          sort: number
          updated_at: string
          waste_pct_override: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          ingredient_id: string
          net_qty: number
          note?: string | null
          recipe_id: string
          sort?: number
          updated_at?: string
          waste_pct_override?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          ingredient_id?: string
          net_qty?: number
          note?: string | null
          recipe_id?: string
          sort?: number
          updated_at?: string
          waste_pct_override?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "v_recipe_costs"
            referencedColumns: ["recipe_id"]
          },
        ]
      }
      recipes: {
        Row: {
          active: boolean
          category_code: string
          code: string | null
          created_at: string
          id: string
          instructions: string | null
          name: string
          portion_label: string | null
          portion_served_g: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          category_code: string
          code?: string | null
          created_at?: string
          id?: string
          instructions?: string | null
          name: string
          portion_label?: string | null
          portion_served_g?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          category_code?: string
          code?: string | null
          created_at?: string
          id?: string
          instructions?: string | null
          name?: string
          portion_label?: string | null
          portion_served_g?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipes_category_code_fkey"
            columns: ["category_code"]
            isOneToOne: false
            referencedRelation: "recipe_categories"
            referencedColumns: ["code"]
          },
        ]
      }
      team_members: {
        Row: {
          active: boolean
          created_at: string
          customer_id: string | null
          full_name: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          customer_id?: string | null
          full_name?: string
          role: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          customer_id?: string | null
          full_name?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      units: {
        Row: {
          code: string
          dimension: string
          name: string
          to_base: number
        }
        Insert: {
          code: string
          dimension: string
          name: string
          to_base: number
        }
        Update: {
          code?: string
          dimension?: string
          name?: string
          to_base?: number
        }
        Relationships: []
      }
    }
    Views: {
      v_menu_costs: {
        Row: {
          active: boolean | null
          code: string | null
          cost_avg: number | null
          cost_last: number | null
          food_margin_pct: number | null
          item_count: number | null
          kind: string | null
          meal: string | null
          menu_id: string | null
          missing_price_count: number | null
          name: string | null
          target_price: number | null
        }
        Relationships: []
      }
      v_recipe_costs: {
        Row: {
          active: boolean | null
          allergens: string[] | null
          category_code: string | null
          code: string | null
          cost_avg: number | null
          cost_last: number | null
          line_count: number | null
          missing_price_count: number | null
          name: string | null
          recipe_id: string | null
          total_net_g: number | null
        }
        Relationships: [
          {
            foreignKeyName: "recipes_category_code_fkey"
            columns: ["category_code"]
            isOneToOne: false
            referencedRelation: "recipe_categories"
            referencedColumns: ["code"]
          },
        ]
      }
      v_recipe_lines: {
        Row: {
          allergens: string[] | null
          avg_cost: number | null
          base_unit: string | null
          gross_qty: number | null
          gross_stock_qty: number | null
          id: string | null
          ingredient_id: string | null
          ingredient_name: string | null
          last_price: number | null
          line_cost_avg: number | null
          line_cost_last: number | null
          net_qty: number | null
          note: string | null
          recipe_id: string | null
          sort: number | null
          stock_unit: string | null
          waste_pct: number | null
          waste_pct_override: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ingredients_stock_unit_fkey"
            columns: ["stock_unit"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "recipe_ingredients_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "v_recipe_costs"
            referencedColumns: ["recipe_id"]
          },
        ]
      }
    }
    Functions: {
      base_unit: { Args: { p_dimension: string }; Returns: string }
      current_app_role: { Args: never; Returns: string }
      current_customer_id: { Args: never; Returns: string }
      gross_qty: {
        Args: { p_net: number; p_waste_pct: number }
        Returns: number
      }
      has_role: { Args: { p_roles: string[] }; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      list_pending_users: {
        Args: never
        Returns: {
          created_at: string
          email: string
          full_name: string
          user_id: string
        }[]
      }
      list_team: {
        Args: never
        Returns: {
          active: boolean
          created_at: string
          customer_id: string
          email: string
          full_name: string
          role: string
          user_id: string
        }[]
      }
      needs_bootstrap: { Args: never; Returns: boolean }
      save_menu: {
        Args: { p_header: Json; p_id: string | null; p_items: Json }
        Returns: string
      }
      save_recipe: {
        Args: { p_header: Json; p_id: string | null; p_lines: Json }
        Returns: string
      }
      recipe_scale: {
        Args: { p_portions: number; p_recipe_id: string }
        Returns: {
          base_unit: string
          cost_last: number
          gross_stock_total: number
          gross_total: number
          ingredient_id: string
          ingredient_name: string
          net_total: number
          stock_unit: string
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

type PublicSchema = Database["public"]

export type Tables<T extends keyof (PublicSchema["Tables"] & PublicSchema["Views"])> =
  (PublicSchema["Tables"] & PublicSchema["Views"])[T] extends { Row: infer R } ? R : never

export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T] extends { Insert: infer I } ? I : never

export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T] extends { Update: infer U } ? U : never
