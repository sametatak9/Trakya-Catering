// Supabase şemasından üretildi (generate_typescript_types). save_* RPC p_id alanları yeni kayıt için null kabul eder.
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
      attendance_days: {
        Row: {
          created_at: string
          employee_id: string
          first_in: string | null
          id: string
          last_out: string | null
          note: string | null
          source: string
          status: string
          updated_at: string
          work_date: string
          worked_minutes: number | null
        }
        Insert: {
          created_at?: string
          employee_id: string
          first_in?: string | null
          id?: string
          last_out?: string | null
          note?: string | null
          source?: string
          status?: string
          updated_at?: string
          work_date: string
          worked_minutes?: number | null
        }
        Update: {
          created_at?: string
          employee_id?: string
          first_in?: string | null
          id?: string
          last_out?: string | null
          note?: string | null
          source?: string
          status?: string
          updated_at?: string
          work_date?: string
          worked_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_days_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
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
      chat_messages: {
        Row: {
          author_id: string
          author_name: string
          body: string
          channel: string
          created_at: string
          id: string
        }
        Insert: {
          author_id?: string
          author_name?: string
          body: string
          channel?: string
          created_at?: string
          id?: string
        }
        Update: {
          author_id?: string
          author_name?: string
          body?: string
          channel?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      cheques: {
        Row: {
          account_id: string | null
          amount: number
          bank: string | null
          counterparty: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          direction: string
          due_date: string
          endorsed_to: string | null
          id: string
          issue_date: string
          kind: string
          note: string | null
          serial_no: string | null
          status: string
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          bank?: string | null
          counterparty: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          direction: string
          due_date: string
          endorsed_to?: string | null
          id?: string
          issue_date?: string
          kind?: string
          note?: string | null
          serial_no?: string | null
          status?: string
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          bank?: string | null
          counterparty?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          direction?: string
          due_date?: string
          endorsed_to?: string | null
          id?: string
          issue_date?: string
          kind?: string
          note?: string | null
          serial_no?: string | null
          status?: string
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cheques_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cheques_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "v_account_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cheques_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cheques_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          address: string | null
          city: string | null
          email: string | null
          id: number
          legal_name: string
          phone: string | null
          report_footer: string | null
          short_name: string
          slogan: string | null
          tax_no: string | null
          tax_office: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          email?: string | null
          id?: number
          legal_name?: string
          phone?: string | null
          report_footer?: string | null
          short_name?: string
          slogan?: string | null
          tax_no?: string | null
          tax_office?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          email?: string | null
          id?: number
          legal_name?: string
          phone?: string | null
          report_footer?: string | null
          short_name?: string
          slogan?: string | null
          tax_no?: string | null
          tax_office?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          order_token: string
          active: boolean
          address: string | null
          city: string | null
          contact_name: string | null
          created_at: string
          default_meal_price: number | null
          district: string | null
          e_invoice: boolean
          email: string | null
          id: string
          kind: string
          lat: number | null
          lng: number | null
          name: string
          notes: string | null
          payment_term_days: number
          phone: string | null
          tax_no: string | null
          tax_office: string | null
          updated_at: string
          vat_rate: number
        }
        Insert: {
          order_token?: string
          active?: boolean
          address?: string | null
          city?: string | null
          contact_name?: string | null
          created_at?: string
          default_meal_price?: number | null
          district?: string | null
          e_invoice?: boolean
          email?: string | null
          id?: string
          kind?: string
          lat?: number | null
          lng?: number | null
          name: string
          notes?: string | null
          payment_term_days?: number
          phone?: string | null
          tax_no?: string | null
          tax_office?: string | null
          updated_at?: string
          vat_rate?: number
        }
        Update: {
          order_token?: string
          active?: boolean
          address?: string | null
          city?: string | null
          contact_name?: string | null
          created_at?: string
          default_meal_price?: number | null
          district?: string | null
          e_invoice?: boolean
          email?: string | null
          id?: string
          kind?: string
          lat?: number | null
          lng?: number | null
          name?: string
          notes?: string | null
          payment_term_days?: number
          phone?: string | null
          tax_no?: string | null
          tax_office?: string | null
          updated_at?: string
          vat_rate?: number
        }
        Relationships: []
      }
      delivery_notes: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          doc_no: string
          doc_type: string
          id: string
          lines: Json
          net_amount: number
          note_date: string
          sales_invoice_id: string | null
          status: string
          updated_at: string
          vat_amount: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          doc_no: string
          doc_type?: string
          id?: string
          lines?: Json
          net_amount?: number
          note_date: string
          sales_invoice_id?: string | null
          status?: string
          updated_at?: string
          vat_amount?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          doc_no?: string
          doc_type?: string
          id?: string
          lines?: Json
          net_amount?: number
          note_date?: string
          sales_invoice_id?: string | null
          status?: string
          updated_at?: string
          vat_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "delivery_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_notes_invoice_fk"
            columns: ["sales_invoice_id"]
            isOneToOne: false
            referencedRelation: "sales_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_ledger: {
        Row: {
          account_id: string | null
          amount: number
          created_at: string
          created_by: string | null
          description: string | null
          employee_id: string
          entry_date: string
          id: string
          kind: string
          period: string | null
        }
        Insert: {
          account_id?: string | null
          amount: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          employee_id: string
          entry_date: string
          id?: string
          kind: string
          period?: string | null
        }
        Update: {
          account_id?: string | null
          amount?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          employee_id?: string
          entry_date?: string
          id?: string
          kind?: string
          period?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_ledger_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_ledger_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "v_account_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_ledger_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_requests: {
        Row: {
          amount: number | null
          created_at: string
          decided_by: string | null
          employee_id: string
          end_date: string | null
          id: string
          kind: string
          note: string | null
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          decided_by?: string | null
          employee_id: string
          end_date?: string | null
          id?: string
          kind: string
          note?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          decided_by?: string | null
          employee_id?: string
          end_date?: string | null
          id?: string
          kind?: string
          note?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          active: boolean
          card_public: boolean
          card_slug: string | null
          created_at: string
          daily_hours: number
          daily_wage: number | null
          department: string
          device_user_id: string | null
          email: string | null
          full_name: string
          iban: string | null
          id: string
          monthly_salary: number | null
          notes: string | null
          overtime_rate: number
          pay_type: string
          phone: string | null
          start_date: string | null
          title: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          active?: boolean
          card_public?: boolean
          card_slug?: string | null
          created_at?: string
          daily_hours?: number
          daily_wage?: number | null
          department?: string
          device_user_id?: string | null
          email?: string | null
          full_name: string
          iban?: string | null
          id?: string
          monthly_salary?: number | null
          notes?: string | null
          overtime_rate?: number
          pay_type?: string
          phone?: string | null
          start_date?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          card_public?: boolean
          card_slug?: string | null
          created_at?: string
          daily_hours?: number
          daily_wage?: number | null
          department?: string
          device_user_id?: string | null
          email?: string | null
          full_name?: string
          iban?: string | null
          id?: string
          monthly_salary?: number | null
          notes?: string | null
          overtime_rate?: number
          pay_type?: string
          phone?: string | null
          start_date?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["user_id"]
          },
        ]
      }
      field_visits: {
        Row: {
          created_at: string
          customer_id: string | null
          done: boolean
          feedback: string | null
          id: string
          lead_id: string | null
          manager_checked: boolean
          manager_note: string | null
          next_date: string | null
          outcome: string | null
          photo_path: string | null
          planned: boolean
          updated_at: string
          user_id: string | null
          user_name: string | null
          visit_date: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          done?: boolean
          feedback?: string | null
          id?: string
          lead_id?: string | null
          manager_checked?: boolean
          manager_note?: string | null
          next_date?: string | null
          outcome?: string | null
          photo_path?: string | null
          planned?: boolean
          updated_at?: string
          user_id?: string | null
          user_name?: string | null
          visit_date?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          done?: boolean
          feedback?: string | null
          id?: string
          lead_id?: string | null
          manager_checked?: boolean
          manager_note?: string | null
          next_date?: string | null
          outcome?: string | null
          photo_path?: string | null
          planned?: boolean
          updated_at?: string
          user_id?: string | null
          user_name?: string | null
          visit_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "field_visits_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_visits_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_visits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["user_id"]
          },
        ]
      }
      finance_accounts: {
        Row: {
          active: boolean
          created_at: string
          id: string
          kind: string
          name: string
          opening_balance: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          kind: string
          name: string
          opening_balance?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          kind?: string
          name?: string
          opening_balance?: number
        }
        Relationships: []
      }
      finance_categories: {
        Row: {
          active: boolean
          code: string
          group_name: string
          keywords: string[]
          kind: string
          name: string
          sort: number
        }
        Insert: {
          active?: boolean
          code: string
          group_name: string
          keywords?: string[]
          kind: string
          name: string
          sort?: number
        }
        Update: {
          active?: boolean
          code?: string
          group_name?: string
          keywords?: string[]
          kind?: string
          name?: string
          sort?: number
        }
        Relationships: []
      }
      finance_entries: {
        Row: {
          account_id: string | null
          category_code: string
          counterparty: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          description: string
          due_date: string | null
          entry_date: string
          id: string
          kind: string
          net_amount: number
          paid_at: string | null
          source: string
          source_id: string | null
          status: string
          total_amount: number | null
          updated_at: string
          vat_amount: number
        }
        Insert: {
          account_id?: string | null
          category_code: string
          counterparty?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          description: string
          due_date?: string | null
          entry_date: string
          id?: string
          kind: string
          net_amount: number
          paid_at?: string | null
          source?: string
          source_id?: string | null
          status?: string
          total_amount?: number | null
          updated_at?: string
          vat_amount?: number
        }
        Update: {
          account_id?: string | null
          category_code?: string
          counterparty?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          description?: string
          due_date?: string | null
          entry_date?: string
          id?: string
          kind?: string
          net_amount?: number
          paid_at?: string | null
          source?: string
          source_id?: string | null
          status?: string
          total_amount?: number | null
          updated_at?: string
          vat_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "finance_entries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_entries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "v_account_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_entries_category_code_kind_fkey"
            columns: ["category_code", "kind"]
            isOneToOne: false
            referencedRelation: "finance_categories"
            referencedColumns: ["code", "kind"]
          },
          {
            foreignKeyName: "finance_entries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
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
      leads: {
        Row: {
          address: string | null
          assigned_to: string | null
          city: string | null
          created_at: string
          district: string | null
          employees_est: number | null
          id: string
          lat: number | null
          lng: number | null
          name: string
          notes: string | null
          phone: string | null
          sector: string | null
          source: string
          source_note: string | null
          status: string
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          assigned_to?: string | null
          city?: string | null
          created_at?: string
          district?: string | null
          employees_est?: number | null
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          notes?: string | null
          phone?: string | null
          sector?: string | null
          source?: string
          source_note?: string | null
          status?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          assigned_to?: string | null
          city?: string | null
          created_at?: string
          district?: string | null
          employees_est?: number | null
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          notes?: string | null
          phone?: string | null
          sector?: string | null
          source?: string
          source_note?: string | null
          status?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["user_id"]
          },
        ]
      }
      meal_orders: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          delivered_qty: number | null
          id: string
          kind: string
          meal: string
          menu_id: string | null
          note: string | null
          ordered_qty: number
          service_date: string
          status: string
          unit_price: number
          updated_at: string
          vat_rate: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          delivered_qty?: number | null
          id?: string
          kind?: string
          meal?: string
          menu_id?: string | null
          note?: string | null
          ordered_qty: number
          service_date: string
          status?: string
          unit_price?: number
          updated_at?: string
          vat_rate?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          delivered_qty?: number | null
          id?: string
          kind?: string
          meal?: string
          menu_id?: string | null
          note?: string | null
          ordered_qty?: number
          service_date?: string
          status?: string
          unit_price?: number
          updated_at?: string
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "meal_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_orders_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_orders_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "v_menu_costs"
            referencedColumns: ["menu_id"]
          },
        ]
      }
      member_permissions: {
        Row: {
          level: string
          module: string
          updated_at: string
          user_id: string
        }
        Insert: {
          level: string
          module: string
          updated_at?: string
          user_id: string
        }
        Update: {
          level?: string
          module?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["user_id"]
          },
        ]
      }
      menu_items: {
        Row: {
          course: string
          created_at: string
          id: string
          menu_id: string
          portion_factor: number
          recipe_id: string
          sort: number
        }
        Insert: {
          course?: string
          created_at?: string
          id?: string
          menu_id: string
          portion_factor?: number
          recipe_id: string
          sort?: number
        }
        Update: {
          course?: string
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
      menu_plans: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string | null
          id: string
          meal: string
          menu_id: string
          note: string | null
          plan_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          meal?: string
          menu_id: string
          note?: string | null
          plan_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          meal?: string
          menu_id?: string
          note?: string | null
          plan_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_plans_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_plans_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_plans_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "v_menu_costs"
            referencedColumns: ["menu_id"]
          },
        ]
      }
      menus: {
        Row: {
          active: boolean
          code: string | null
          created_at: string
          customer_id: string | null
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
          customer_id?: string | null
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
          customer_id?: string | null
          id?: string
          kind?: string
          meal?: string
          name?: string
          notes?: string | null
          target_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menus_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      prep_batch_items: {
        Row: {
          batch_id: string
          created_at: string
          id: string
          ingredient_id: string | null
          is_side: boolean
          manual_name: string | null
          planned_qty: number | null
          qty: number
          sort: number
          unit: string
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          id?: string
          ingredient_id?: string | null
          is_side?: boolean
          manual_name?: string | null
          planned_qty?: number | null
          qty: number
          sort?: number
          unit: string
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          id?: string
          ingredient_id?: string | null
          is_side?: boolean
          manual_name?: string | null
          planned_qty?: number | null
          qty?: number
          sort?: number
          unit?: string
          unit_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prep_batch_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "prep_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prep_batch_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_prep_batch_costs"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "prep_batch_items_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prep_batch_items_unit_fkey"
            columns: ["unit"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["code"]
          },
        ]
      }
      prep_batches: {
        Row: {
          course: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          dish_name: string
          id: string
          meal: string
          menu_id: string | null
          note: string | null
          portions: number | null
          portions_source: string
          prep_date: string
          recipe_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          course?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          dish_name: string
          id?: string
          meal?: string
          menu_id?: string | null
          note?: string | null
          portions?: number | null
          portions_source?: string
          prep_date: string
          recipe_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          course?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          dish_name?: string
          id?: string
          meal?: string
          menu_id?: string | null
          note?: string | null
          portions?: number | null
          portions_source?: string
          prep_date?: string
          recipe_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prep_batches_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prep_batches_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prep_batches_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "v_menu_costs"
            referencedColumns: ["menu_id"]
          },
          {
            foreignKeyName: "prep_batches_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prep_batches_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "v_recipe_costs"
            referencedColumns: ["recipe_id"]
          },
        ]
      }
      purchase_invoices: {
        Row: {
          category_code: string
          created_at: string
          created_by: string | null
          due_date: string | null
          ettn: string | null
          id: string
          invoice_date: string
          invoice_no: string
          kind: string
          lines: Json
          net_amount: number
          note: string | null
          source: string
          status: string
          supplier_name: string
          supplier_tax_no: string | null
          total_amount: number
          updated_at: string
          vat_amount: number
        }
        Insert: {
          category_code: string
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          ettn?: string | null
          id?: string
          invoice_date: string
          invoice_no: string
          kind?: string
          lines?: Json
          net_amount: number
          note?: string | null
          source?: string
          status?: string
          supplier_name: string
          supplier_tax_no?: string | null
          total_amount: number
          updated_at?: string
          vat_amount?: number
        }
        Update: {
          category_code?: string
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          ettn?: string | null
          id?: string
          invoice_date?: string
          invoice_no?: string
          kind?: string
          lines?: Json
          net_amount?: number
          note?: string | null
          source?: string
          status?: string
          supplier_name?: string
          supplier_tax_no?: string | null
          total_amount?: number
          updated_at?: string
          vat_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_invoices_category_code_kind_fkey"
            columns: ["category_code", "kind"]
            isOneToOne: false
            referencedRelation: "finance_categories"
            referencedColumns: ["code", "kind"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string
          created_by: string | null
          delivery_date: string | null
          id: string
          lines: Json
          note: string | null
          order_date: string
          status: string
          supplier_id: string
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          delivery_date?: string | null
          id?: string
          lines?: Json
          note?: string | null
          order_date?: string
          status?: string
          supplier_id: string
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          delivery_date?: string | null
          id?: string
          lines?: Json
          note?: string | null
          order_date?: string
          status?: string
          supplier_id?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          company_name: string
          contact_name: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          days_per_month: number
          food_cost: number
          id: string
          lead_id: string | null
          margin_pct: number
          menu_id: string | null
          notes: string | null
          overhead_cost: number
          people_per_day: number
          phone: string | null
          quote_date: string
          quote_no: string
          status: string
          unit_price: number
          updated_at: string
          valid_until: string | null
          vat_rate: number
        }
        Insert: {
          company_name: string
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          days_per_month?: number
          food_cost?: number
          id?: string
          lead_id?: string | null
          margin_pct?: number
          menu_id?: string | null
          notes?: string | null
          overhead_cost?: number
          people_per_day: number
          phone?: string | null
          quote_date?: string
          quote_no: string
          status?: string
          unit_price: number
          updated_at?: string
          valid_until?: string | null
          vat_rate?: number
        }
        Update: {
          company_name?: string
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          days_per_month?: number
          food_cost?: number
          id?: string
          lead_id?: string | null
          margin_pct?: number
          menu_id?: string | null
          notes?: string | null
          overhead_cost?: number
          people_per_day?: number
          phone?: string | null
          quote_date?: string
          quote_no?: string
          status?: string
          unit_price?: number
          updated_at?: string
          valid_until?: string | null
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_lead_fk"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "v_menu_costs"
            referencedColumns: ["menu_id"]
          },
        ]
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
      recipe_cost_snapshots: {
        Row: {
          cost: number
          created_by: string | null
          id: string
          note: string | null
          noted_at: string
          recipe_id: string
        }
        Insert: {
          cost: number
          created_by?: string | null
          id?: string
          note?: string | null
          noted_at?: string
          recipe_id: string
        }
        Update: {
          cost?: number
          created_by?: string | null
          id?: string
          note?: string | null
          noted_at?: string
          recipe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_cost_snapshots_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_cost_snapshots_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "v_recipe_costs"
            referencedColumns: ["recipe_id"]
          },
        ]
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
      role_permissions: {
        Row: {
          level: string
          module: string
          role: string
          updated_at: string
        }
        Insert: {
          level: string
          module: string
          role: string
          updated_at?: string
        }
        Update: {
          level?: string
          module?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      routes: {
        Row: {
          created_at: string
          created_by: string | null
          driver_id: string | null
          id: string
          name: string
          note: string | null
          route_date: string
          status: string
          stops: Json
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          driver_id?: string | null
          id?: string
          name: string
          note?: string | null
          route_date: string
          status?: string
          stops?: Json
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          driver_id?: string | null
          id?: string
          name?: string
          note?: string | null
          route_date?: string
          status?: string
          stops?: Json
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "routes_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routes_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_invoices: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          einvoice_status: string
          ettn: string | null
          id: string
          invoice_date: string
          invoice_no: string
          lines: Json
          net_amount: number
          period_from: string | null
          period_to: string | null
          status: string
          updated_at: string
          vat_amount: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          einvoice_status?: string
          ettn?: string | null
          id?: string
          invoice_date: string
          invoice_no: string
          lines?: Json
          net_amount?: number
          period_from?: string | null
          period_to?: string | null
          status?: string
          updated_at?: string
          vat_amount?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          einvoice_status?: string
          ettn?: string | null
          id?: string
          invoice_date?: string
          invoice_no?: string
          lines?: Json
          net_amount?: number
          period_from?: string | null
          period_to?: string | null
          status?: string
          updated_at?: string
          vat_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      social_posts: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          media_note: string | null
          planned_at: string | null
          platforms: string[]
          source: string
          status: string
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          media_note?: string | null
          planned_at?: string | null
          platforms?: string[]
          source?: string
          status?: string
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          media_note?: string | null
          planned_at?: string | null
          platforms?: string[]
          source?: string
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string | null
          id: string
          ingredient_id: string
          kind: string
          move_date: string
          note: string | null
          qty: number
          source: string
          source_id: string | null
          unit_cost: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          ingredient_id: string
          kind: string
          move_date?: string
          note?: string | null
          qty: number
          source?: string
          source_id?: string | null
          unit_cost?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          ingredient_id?: string
          kind?: string
          move_date?: string
          note?: string | null
          qty?: number
          source?: string
          source_id?: string | null
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_categories: {
        Row: {
          category_code: string
          supplier_key: string
          supplier_name: string
          updated_at: string
        }
        Insert: {
          category_code: string
          supplier_key: string
          supplier_name: string
          updated_at?: string
        }
        Update: {
          category_code?: string
          supplier_key?: string
          supplier_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_categories_category_code_fkey"
            columns: ["category_code"]
            isOneToOne: false
            referencedRelation: "finance_categories"
            referencedColumns: ["code"]
          },
        ]
      }
      supplier_quotes: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          ingredient_id: string
          note: string | null
          price: number
          quoted_at: string
          source: string
          supplier_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          ingredient_id: string
          note?: string | null
          price: number
          quoted_at?: string
          source?: string
          supplier_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          ingredient_id?: string
          note?: string | null
          price?: number
          quoted_at?: string
          source?: string
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_quotes_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_quotes_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          active: boolean
          categories: string[]
          city: string | null
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          payment_term_days: number
          phone: string | null
          rating: number | null
          tax_no: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          categories?: string[]
          city?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          payment_term_days?: number
          phone?: string | null
          rating?: number | null
          tax_no?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          categories?: string[]
          city?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          payment_term_days?: number
          phone?: string | null
          rating?: number | null
          tax_no?: string | null
          updated_at?: string
        }
        Relationships: []
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
        Relationships: [
          {
            foreignKeyName: "team_members_customer_fk"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
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
      vehicle_logs: {
        Row: {
          account_id: string | null
          amount: number | null
          created_at: string
          created_by: string | null
          id: string
          kind: string
          km: number | null
          liters: number | null
          log_date: string
          note: string | null
          place: string | null
          source: string
          vehicle_id: string
        }
        Insert: {
          account_id?: string | null
          amount?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          km?: number | null
          liters?: number | null
          log_date?: string
          note?: string | null
          place?: string | null
          source?: string
          vehicle_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          km?: number | null
          liters?: number | null
          log_date?: string
          note?: string | null
          place?: string | null
          source?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_logs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_logs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "v_account_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_logs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          active: boolean
          created_at: string
          current_km: number
          driver_id: string | null
          id: string
          inspection_due: string | null
          insurance_due: string | null
          kind: string
          last_service_km: number | null
          name: string
          notes: string | null
          plate: string
          service_every_km: number | null
          tracker: string | null
          tracker_ref: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          current_km?: number
          driver_id?: string | null
          id?: string
          inspection_due?: string | null
          insurance_due?: string | null
          kind?: string
          last_service_km?: number | null
          name: string
          notes?: string | null
          plate: string
          service_every_km?: number | null
          tracker?: string | null
          tracker_ref?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          current_km?: number
          driver_id?: string | null
          id?: string
          inspection_due?: string | null
          insurance_due?: string | null
          kind?: string
          last_service_km?: number | null
          name?: string
          notes?: string | null
          plate?: string
          service_every_km?: number | null
          tracker?: string | null
          tracker_ref?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_account_balances: {
        Row: {
          balance: number | null
          id: string | null
          kind: string | null
          name: string | null
          opening_balance: number | null
        }
        Relationships: []
      }
      v_menu_costs: {
        Row: {
          active: boolean | null
          code: string | null
          cost_avg: number | null
          cost_last: number | null
          customer_id: string | null
          food_margin_pct: number | null
          item_count: number | null
          kind: string | null
          meal: string | null
          menu_id: string | null
          missing_price_count: number | null
          name: string | null
          target_price: number | null
        }
        Relationships: [
          {
            foreignKeyName: "menus_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      v_prep_batch_costs: {
        Row: {
          batch_id: string | null
          cost_per_portion: number | null
          course: string | null
          customer_id: string | null
          dish_name: string | null
          item_count: number | null
          meal: string | null
          menu_id: string | null
          missing_price_count: number | null
          planned_cost: number | null
          portions: number | null
          portions_source: string | null
          prep_date: string | null
          recipe_id: string | null
          side_cost: number | null
          status: string | null
          total_cost: number | null
          total_g: number | null
          variance_pct: number | null
        }
        Relationships: [
          {
            foreignKeyName: "prep_batches_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prep_batches_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prep_batches_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "v_menu_costs"
            referencedColumns: ["menu_id"]
          },
          {
            foreignKeyName: "prep_batches_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prep_batches_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "v_recipe_costs"
            referencedColumns: ["recipe_id"]
          },
        ]
      }
      v_prep_items: {
        Row: {
          allergens: string[] | null
          base_unit: string | null
          batch_id: string | null
          created_at: string | null
          dimension: string | null
          id: string | null
          ingredient_id: string | null
          is_side: boolean | null
          item_name: string | null
          line_cost: number | null
          manual_name: string | null
          planned_cost: number | null
          planned_qty: number | null
          planned_qty_base: number | null
          qty: number | null
          qty_base: number | null
          sort: number | null
          unit: string | null
          unit_price: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prep_batch_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "prep_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prep_batch_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_prep_batch_costs"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "prep_batch_items_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prep_batch_items_unit_fkey"
            columns: ["unit"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["code"]
          },
        ]
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
      portal_info: { Args: { p_token: string }; Returns: Json }
      portal_set_order: { Args: { p_token: string; p_date: string; p_meal: string; p_qty: number; p_note?: string | null }; Returns: Json }
      base_unit: { Args: { p_dimension: string }; Returns: string }
      current_app_role: { Args: never; Returns: string }
      current_customer_id: { Args: never; Returns: string }
      effective_menu: {
        Args: {
          p_customer: string
          p_date: string
          p_meal: string
          p_order_menu: string
        }
        Returns: string
      }
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
      order_is_open: { Args: { p_service_date: string }; Returns: boolean }
      plan_prep_from_orders: {
        Args: { p_date: string; p_meal: string }
        Returns: number
      }
      prep_fill_from_recipe: { Args: { p_batch_id: string }; Returns: number }
      public_card: {
        Args: { p_slug: string }
        Returns: {
          address: string
          company: string
          company_phone: string
          department: string
          email: string
          full_name: string
          phone: string
          title: string
          website: string
        }[]
      }
      recipe_from_prep: {
        Args: { p_batch_id: string; p_category?: string }
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
      save_menu: {
        Args: { p_header: Json; p_id: string | null; p_items: Json }
        Returns: string
      }
      save_recipe: {
        Args: { p_header: Json; p_id: string | null; p_lines: Json }
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
