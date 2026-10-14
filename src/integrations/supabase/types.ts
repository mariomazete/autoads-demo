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
      autoads_audience_defaults: {
        Row: {
          active: boolean
          age_max: number | null
          age_min: number
          created_at: string
          gender: string
          id: string
          interest_ids: Json
          interest_names: Json
          name: string
          objective: string
          radius_km: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          age_max?: number | null
          age_min?: number
          created_at?: string
          gender?: string
          id?: string
          interest_ids?: Json
          interest_names?: Json
          name: string
          objective?: string
          radius_km?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          age_max?: number | null
          age_min?: number
          created_at?: string
          gender?: string
          id?: string
          interest_ids?: Json
          interest_names?: Json
          name?: string
          objective?: string
          radius_km?: number
          updated_at?: string
        }
        Relationships: []
      }
      autoads_cron_config: {
        Row: {
          id: boolean
          secret: string
          updated_at: string
        }
        Insert: {
          id?: boolean
          secret: string
          updated_at?: string
        }
        Update: {
          id?: boolean
          secret?: string
          updated_at?: string
        }
        Relationships: []
      }
      brand_audience_defaults: {
        Row: {
          active: boolean
          age_max: number | null
          age_min: number
          brand_id: string
          created_at: string
          gender: string
          id: string
          interest_ids: Json
          interest_names: Json
          objective: string
          radius_km: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          age_max?: number | null
          age_min?: number
          brand_id: string
          created_at?: string
          gender?: string
          id?: string
          interest_ids?: Json
          interest_names?: Json
          objective?: string
          radius_km?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          age_max?: number | null
          age_min?: number
          brand_id?: string
          created_at?: string
          gender?: string
          id?: string
          interest_ids?: Json
          interest_names?: Json
          objective?: string
          radius_km?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_audience_defaults_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          active: boolean
          created_at: string
          id: string
          logo_url: string | null
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      campaign_metrics: {
        Row: {
          clicks: number
          cost_per_lead: number | null
          created_at: string
          id: string
          impressions: number
          leads: number
          metric_date: string
          seller_campaign_id: string
          seller_id: string
          spend: number
          store_id: string | null
          updated_at: string
        }
        Insert: {
          clicks?: number
          cost_per_lead?: number | null
          created_at?: string
          id?: string
          impressions?: number
          leads?: number
          metric_date?: string
          seller_campaign_id: string
          seller_id: string
          spend?: number
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          clicks?: number
          cost_per_lead?: number | null
          created_at?: string
          id?: string
          impressions?: number
          leads?: number
          metric_date?: string
          seller_campaign_id?: string
          seller_id?: string
          spend?: number
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_metrics_seller_campaign_id_fkey"
            columns: ["seller_campaign_id"]
            isOneToOne: false
            referencedRelation: "seller_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_metrics_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_templates: {
        Row: {
          archived_at: string | null
          brand_id: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          cta: string
          description: string | null
          group_id: string
          headline: string | null
          id: string
          image_url: string | null
          is_featured: boolean
          media_items: Json
          media_type: string | null
          media_url: string | null
          min_daily_budget: number
          model: string | null
          month_label: string | null
          name: string
          objective: string
          offer_condition: string | null
          period_end: string | null
          period_start: string | null
          placements: Json
          price: number | null
          primary_text: string | null
          promotional_price: number | null
          radius_km: number
          status: Database["public"]["Enums"]["entity_status"]
          store_id: string | null
          title: string | null
          updated_at: string
          vehicle_id: string | null
          version: string | null
        }
        Insert: {
          archived_at?: string | null
          brand_id?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          cta?: string
          description?: string | null
          group_id: string
          headline?: string | null
          id?: string
          image_url?: string | null
          is_featured?: boolean
          media_items?: Json
          media_type?: string | null
          media_url?: string | null
          min_daily_budget?: number
          model?: string | null
          month_label?: string | null
          name: string
          objective?: string
          offer_condition?: string | null
          period_end?: string | null
          period_start?: string | null
          placements?: Json
          price?: number | null
          primary_text?: string | null
          promotional_price?: number | null
          radius_km?: number
          status?: Database["public"]["Enums"]["entity_status"]
          store_id?: string | null
          title?: string | null
          updated_at?: string
          vehicle_id?: string | null
          version?: string | null
        }
        Update: {
          archived_at?: string | null
          brand_id?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          cta?: string
          description?: string | null
          group_id?: string
          headline?: string | null
          id?: string
          image_url?: string | null
          is_featured?: boolean
          media_items?: Json
          media_type?: string | null
          media_url?: string | null
          min_daily_budget?: number
          model?: string | null
          month_label?: string | null
          name?: string
          objective?: string
          offer_condition?: string | null
          period_end?: string | null
          period_start?: string | null
          placements?: Json
          price?: number | null
          primary_text?: string | null
          promotional_price?: number | null
          radius_km?: number
          status?: Database["public"]["Enums"]["entity_status"]
          store_id?: string | null
          title?: string | null
          updated_at?: string
          vehicle_id?: string | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_templates_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_templates_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_templates_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_templates_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          group_id: string
          id: string
          logo_url: string | null
          name: string
          slug: string
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          logo_url?: string | null
          name: string
          slug: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          logo_url?: string | null
          name?: string
          slug?: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "companies_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      meta_ad_accounts: {
        Row: {
          account_status: string | null
          act_id: string
          connection_id: string
          created_at: string
          currency: string | null
          id: string
          is_selected: boolean
          name: string | null
          seller_id: string
          updated_at: string
        }
        Insert: {
          account_status?: string | null
          act_id: string
          connection_id: string
          created_at?: string
          currency?: string | null
          id?: string
          is_selected?: boolean
          name?: string | null
          seller_id: string
          updated_at?: string
        }
        Update: {
          account_status?: string | null
          act_id?: string
          connection_id?: string
          created_at?: string
          currency?: string | null
          id?: string
          is_selected?: boolean
          name?: string | null
          seller_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_ad_accounts_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "meta_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_ad_accounts_v2: {
        Row: {
          created_at: string
          external_account_id: string
          id: string
          meta_connection_id: string
          name: string | null
          seller_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          external_account_id: string
          id?: string
          meta_connection_id: string
          name?: string | null
          seller_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          external_account_id?: string
          id?: string
          meta_connection_id?: string
          name?: string | null
          seller_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_ad_accounts_connection_owner_fk"
            columns: ["meta_connection_id", "seller_id"]
            isOneToOne: false
            referencedRelation: "meta_connections_v2"
            referencedColumns: ["id", "seller_id"]
          },
        ]
      }
      meta_connections: {
        Row: {
          access_token: string | null
          created_at: string
          id: string
          last_error: string | null
          meta_user_id: string | null
          meta_user_name: string | null
          scopes: string | null
          seller_id: string
          status: string
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          meta_user_id?: string | null
          meta_user_name?: string | null
          scopes?: string | null
          seller_id: string
          status?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          meta_user_id?: string | null
          meta_user_name?: string | null
          scopes?: string | null
          seller_id?: string
          status?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      meta_connections_v2: {
        Row: {
          connected_at: string | null
          created_at: string
          external_user_id: string | null
          id: string
          last_error: string | null
          provider: string
          seller_id: string
          status: string
          updated_at: string
        }
        Insert: {
          connected_at?: string | null
          created_at?: string
          external_user_id?: string | null
          id?: string
          last_error?: string | null
          provider?: string
          seller_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          connected_at?: string | null
          created_at?: string
          external_user_id?: string | null
          id?: string
          last_error?: string | null
          provider?: string
          seller_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      meta_oauth_states: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          redirect_to: string
          seller_id: string
          state: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          redirect_to: string
          seller_id: string
          state: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          redirect_to?: string
          seller_id?: string
          state?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_oauth_states_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company_id: string | null
          created_at: string
          email: string | null
          full_name: string | null
          group_id: string | null
          id: string
          is_public: boolean
          job_title: string | null
          slug: string | null
          status: Database["public"]["Enums"]["entity_status"]
          store_id: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          group_id?: string | null
          id: string
          is_public?: boolean
          job_title?: string | null
          slug?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          store_id?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          group_id?: string | null
          id?: string
          is_public?: boolean
          job_title?: string | null
          slug?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          store_id?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          created_at: string
          group_id: string | null
          id: string
          proposal_number: string
          sale_date: string
          seller_campaign_id: string
          seller_id: string
          store_id: string
          updated_at: string
          vehicle_model: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          group_id?: string | null
          id?: string
          proposal_number: string
          sale_date?: string
          seller_campaign_id: string
          seller_id?: string
          store_id?: string
          updated_at?: string
          vehicle_model: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          group_id?: string | null
          id?: string
          proposal_number?: string
          sale_date?: string
          seller_campaign_id?: string
          seller_id?: string
          store_id?: string
          updated_at?: string
          vehicle_model?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_seller_campaign_id_fkey"
            columns: ["seller_campaign_id"]
            isOneToOne: false
            referencedRelation: "seller_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_brands: {
        Row: {
          brand_id: string
          created_at: string
          id: string
          seller_id: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          id?: string
          seller_id: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          id?: string
          seller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_brands_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_brands_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_campaigns: {
        Row: {
          archived_at: string | null
          audience_age_max: number | null
          audience_age_min: number
          audience_gender: string
          audience_interest_ids: Json
          audience_interest_names: Json
          brand_id: string | null
          budget_amount: number
          budget_type: Database["public"]["Enums"]["budget_type"]
          clicks: number
          company_id: string | null
          created_at: string
          daily_budget: number | null
          destination_url: string | null
          duration_days: number | null
          end_date: string | null
          error_message: string | null
          id: string
          impressions: number
          leads_count: number
          media_items: Json
          meta_ad_account_id: string | null
          meta_ad_account_id_v2: string | null
          meta_ad_id: string | null
          meta_delivery_checked_at: string | null
          meta_delivery_detail: string | null
          meta_delivery_status: string | null
          meta_adset_id: string | null
          meta_campaign_id: string | null
          meta_creative_id: string | null
          name: string
          objective: string
          published_at: string | null
          radius_km: number
          seller_id: string
          source: string | null
          spend: number
          spent_amount: number | null
          start_date: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          store_id: string
          store_location: string | null
          template_id: string | null
          tenant_id: string
          total_budget: number | null
          updated_at: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          vehicle_id: string | null
          whatsapp: string | null
        }
        Insert: {
          archived_at?: string | null
          audience_age_max?: number | null
          audience_age_min?: number
          audience_gender?: string
          audience_interest_ids?: Json
          audience_interest_names?: Json
          brand_id?: string | null
          budget_amount?: number
          budget_type?: Database["public"]["Enums"]["budget_type"]
          clicks?: number
          company_id?: string | null
          created_at?: string
          daily_budget?: number | null
          destination_url?: string | null
          duration_days?: number | null
          end_date?: string | null
          error_message?: string | null
          id?: string
          impressions?: number
          leads_count?: number
          media_items?: Json
          meta_ad_account_id?: string | null
          meta_ad_account_id_v2?: string | null
          meta_ad_id?: string | null
          meta_delivery_checked_at?: string | null
          meta_delivery_detail?: string | null
          meta_delivery_status?: string | null
          meta_adset_id?: string | null
          meta_campaign_id?: string | null
          meta_creative_id?: string | null
          name: string
          objective?: string
          published_at?: string | null
          radius_km?: number
          seller_id: string
          source?: string | null
          spend?: number
          spent_amount?: number | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          store_id: string
          store_location?: string | null
          template_id?: string | null
          tenant_id: string
          total_budget?: number | null
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          vehicle_id?: string | null
          whatsapp?: string | null
        }
        Update: {
          archived_at?: string | null
          audience_age_max?: number | null
          audience_age_min?: number
          audience_gender?: string
          audience_interest_ids?: Json
          audience_interest_names?: Json
          brand_id?: string | null
          budget_amount?: number
          budget_type?: Database["public"]["Enums"]["budget_type"]
          clicks?: number
          company_id?: string | null
          created_at?: string
          daily_budget?: number | null
          destination_url?: string | null
          duration_days?: number | null
          end_date?: string | null
          error_message?: string | null
          id?: string
          impressions?: number
          leads_count?: number
          media_items?: Json
          meta_ad_account_id?: string | null
          meta_ad_account_id_v2?: string | null
          meta_ad_id?: string | null
          meta_delivery_checked_at?: string | null
          meta_delivery_detail?: string | null
          meta_delivery_status?: string | null
          meta_adset_id?: string | null
          meta_campaign_id?: string | null
          meta_creative_id?: string | null
          name?: string
          objective?: string
          published_at?: string | null
          radius_km?: number
          seller_id?: string
          source?: string | null
          spend?: number
          spent_amount?: number | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          store_id?: string
          store_location?: string | null
          template_id?: string | null
          tenant_id?: string
          total_budget?: number | null
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          vehicle_id?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seller_campaigns_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_campaigns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_campaigns_meta_ad_account_owner_fk_v2"
            columns: ["meta_ad_account_id_v2", "seller_id"]
            isOneToOne: false
            referencedRelation: "meta_ad_accounts_v2"
            referencedColumns: ["id", "seller_id"]
          },
          {
            foreignKeyName: "seller_campaigns_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "campaign_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_campaigns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_campaigns_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          address: string
          brand_id: string | null
          city: string
          company_id: string
          created_at: string
          default_radius_km: number
          group_id: string
          id: string
          latitude: number
          longitude: number
          name: string
          phone: string | null
          state: string
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
          zip_code: string
        }
        Insert: {
          address: string
          brand_id?: string | null
          city: string
          company_id: string
          created_at?: string
          default_radius_km?: number
          group_id: string
          id?: string
          latitude: number
          longitude: number
          name: string
          phone?: string | null
          state: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
          zip_code: string
        }
        Update: {
          address?: string
          brand_id?: string | null
          city?: string
          company_id?: string
          created_at?: string
          default_radius_km?: number
          group_id?: string
          id?: string
          latitude?: number
          longitude?: number
          name?: string
          phone?: string | null
          state?: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
          zip_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "stores_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stores_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stores_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
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
      vehicles: {
        Row: {
          brand: string
          company_id: string | null
          created_at: string
          description: string | null
          down_payment: number | null
          gallery: Json
          group_id: string
          id: string
          installment_value: number | null
          installments: number | null
          main_image_url: string | null
          model: string
          model_year: number | null
          price: number | null
          promo_price: number | null
          status: Database["public"]["Enums"]["entity_status"]
          store_id: string | null
          updated_at: string
          version: string | null
        }
        Insert: {
          brand: string
          company_id?: string | null
          created_at?: string
          description?: string | null
          down_payment?: number | null
          gallery?: Json
          group_id: string
          id?: string
          installment_value?: number | null
          installments?: number | null
          main_image_url?: string | null
          model: string
          model_year?: number | null
          price?: number | null
          promo_price?: number | null
          status?: Database["public"]["Enums"]["entity_status"]
          store_id?: string | null
          updated_at?: string
          version?: string | null
        }
        Update: {
          brand?: string
          company_id?: string | null
          created_at?: string
          description?: string | null
          down_payment?: number | null
          gallery?: Json
          group_id?: string
          id?: string
          installment_value?: number | null
          installments?: number | null
          main_image_url?: string | null
          model?: string
          model_year?: number | null
          price?: number | null
          promo_price?: number | null
          status?: Database["public"]["Enums"]["entity_status"]
          store_id?: string | null
          updated_at?: string
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      archive_seller_campaign: {
        Args: { p_campaign_id: string }
        Returns: undefined
      }
      bootstrap_current_user: {
        Args: { _email?: string; _full_name?: string }
        Returns: {
          avatar_url: string | null
          company_id: string | null
          created_at: string
          email: string | null
          full_name: string | null
          group_id: string | null
          id: string
          is_public: boolean
          job_title: string | null
          slug: string | null
          status: Database["public"]["Enums"]["entity_status"]
          store_id: string | null
          updated_at: string
          whatsapp: string | null
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_group_id: { Args: never; Returns: string }
      current_store_id: { Args: never; Returns: string }
      archive_campaign_template: {
        Args: { p_template_id: string }
        Returns: number
      }
      unarchive_campaign_template: {
        Args: { p_template_id: string }
        Returns: undefined
      }
      delete_campaign_template: {
        Args: { p_template_id: string }
        Returns: undefined
      }
      get_current_seller_context: {
        Args: never
        Returns: {
          brand_id: string
          brand_name: string
          company_id: string
          full_name: string
          group_id: string
          job_title: string
          store_id: string
          store_name: string
          whatsapp: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_master: { Args: never; Returns: boolean }
      is_store_admin: { Args: never; Returns: boolean }
      manager_create_campaign_for_store: {
        Args: {
          p_duration_days: number
          p_template_id: string
          p_total_budget: number
        }
        Returns: number
      }
      manager_set_campaign_status: {
        Args: {
          p_campaign_id: string
          p_status: Database["public"]["Enums"]["campaign_status"]
        }
        Returns: {
          archived_at: string | null
          audience_age_max: number | null
          audience_age_min: number
          audience_gender: string
          audience_interest_ids: Json
          audience_interest_names: Json
          brand_id: string | null
          budget_amount: number
          budget_type: Database["public"]["Enums"]["budget_type"]
          clicks: number
          company_id: string | null
          created_at: string
          daily_budget: number | null
          destination_url: string | null
          duration_days: number | null
          end_date: string | null
          error_message: string | null
          id: string
          impressions: number
          leads_count: number
          media_items: Json
          meta_ad_account_id: string | null
          meta_ad_account_id_v2: string | null
          meta_ad_id: string | null
          meta_adset_id: string | null
          meta_campaign_id: string | null
          meta_creative_id: string | null
          name: string
          objective: string
          published_at: string | null
          radius_km: number
          seller_id: string
          source: string | null
          spend: number
          spent_amount: number | null
          start_date: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          store_id: string
          store_location: string | null
          template_id: string | null
          tenant_id: string
          total_budget: number | null
          updated_at: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          vehicle_id: string | null
          whatsapp: string | null
        }
        SetofOptions: {
          from: "*"
          to: "seller_campaigns"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      master_create_campaign_distribution: {
        Args: {
          p_duration_days?: number
          p_store_id?: string
          p_template_id: string
          p_total_budget?: number
        }
        Returns: number
      }
      set_campaign_template_status: {
        Args: { p_status: string; p_template_id: string }
        Returns: undefined
      }
      set_seller_campaign_status: {
        Args: { p_campaign_id: string; p_status: string }
        Returns: undefined
      }
      update_campaign_template: {
        Args: {
          p_brand_id: string
          p_description: string
          p_media_items: Json
          p_media_type: string
          p_media_url: string
          p_model: string
          p_offer_condition: string
          p_period_end: string
          p_period_start: string
          p_price: number
          p_promotional_price: number
          p_status: string
          p_template_id: string
          p_title: string
          p_version: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "ADMIN_MASTER" | "ADMIN_LOJA" | "VENDEDOR"
      budget_type: "daily" | "lifetime"
      campaign_status:
        | "draft"
        | "pending"
        | "active"
        | "paused"
        | "finished"
        | "error"
      entity_status: "active" | "inactive"
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
      app_role: ["ADMIN_MASTER", "ADMIN_LOJA", "VENDEDOR"],
      budget_type: ["daily", "lifetime"],
      campaign_status: [
        "draft",
        "pending",
        "active",
        "paused",
        "finished",
        "error",
      ],
      entity_status: ["active", "inactive"],
    },
  },
} as const
