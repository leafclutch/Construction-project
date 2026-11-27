
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "bbs_items": {
                  Row: {
                    "bar_count": number,"bar_dia_mm": number,"created_at": string,"created_by": string | null,"cut_length_m": number,"id": string,"member": string,"org_id": string,"project_id": string,"total_weight_kg": number | null,"unit_weight": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "bar_count": number,"bar_dia_mm": number,"created_at"?: string,"created_by"?: string | null,"cut_length_m": number,"id"?: string,"member": string,"org_id": string,"project_id": string,"total_weight_kg"?: never,"unit_weight"?: never
                  }
                  Update: {
                    "bar_count"?: number,"bar_dia_mm"?: number,"created_at"?: string,"created_by"?: string | null,"cut_length_m"?: number,"id"?: string,"member"?: string,"org_id"?: string,"project_id"?: string,"total_weight_kg"?: never,"unit_weight"?: never
                  }
                  Relationships: [
                    {
      foreignKeyName: "bbs_items_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bbs_items_project_id_org_id_fkey"
      columns: ["project_id","org_id"]
isOneToOne: false
      referencedRelation: "project_summaries"
      referencedColumns: ["project_id","org_id"]
    },{
      foreignKeyName: "bbs_items_project_id_org_id_fkey"
      columns: ["project_id","org_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id","org_id"]
    }
                  ]
                },"boq_items": {
                  Row: {
                    "amount": number | null,"created_at": string,"created_by": string | null,"description": string,"id": string,"org_id": string,"project_id": string,"quantity": number,"rate": number,"unit": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount"?: never,"created_at"?: string,"created_by"?: string | null,"description": string,"id"?: string,"org_id": string,"project_id": string,"quantity": number,"rate": number,"unit": string
                  }
                  Update: {
                    "amount"?: never,"created_at"?: string,"created_by"?: string | null,"description"?: string,"id"?: string,"org_id"?: string,"project_id"?: string,"quantity"?: number,"rate"?: number,"unit"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "boq_items_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "boq_items_project_id_org_id_fkey"
      columns: ["project_id","org_id"]
isOneToOne: false
      referencedRelation: "project_summaries"
      referencedColumns: ["project_id","org_id"]
    },{
      foreignKeyName: "boq_items_project_id_org_id_fkey"
      columns: ["project_id","org_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id","org_id"]
    }
                  ]
                },"drawings": {
                  Row: {
                    "category": Database["public"]['Enums']["drawing_category"],"created_at": string,"created_by": string | null,"file_name": string,"file_path": string,"file_size": number,"id": string,"mime_type": string,"org_id": string,"project_id": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category": Database["public"]['Enums']["drawing_category"],"created_at"?: string,"created_by"?: string | null,"file_name": string,"file_path": string,"file_size": number,"id"?: string,"mime_type": string,"org_id": string,"project_id": string,"title": string
                  }
                  Update: {
                    "category"?: Database["public"]['Enums']["drawing_category"],"created_at"?: string,"created_by"?: string | null,"file_name"?: string,"file_path"?: string,"file_size"?: number,"id"?: string,"mime_type"?: string,"org_id"?: string,"project_id"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "drawings_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "drawings_project_id_org_id_fkey"
      columns: ["project_id","org_id"]
isOneToOne: false
      referencedRelation: "project_summaries"
      referencedColumns: ["project_id","org_id"]
    },{
      foreignKeyName: "drawings_project_id_org_id_fkey"
      columns: ["project_id","org_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id","org_id"]
    }
                  ]
                },"labour_entries": {
                  Row: {
                    "category": string,"created_at": string,"created_by": string | null,"daily_rate": number,"entry_date": string,"id": string,"org_id": string,"project_id": string,"remarks": string,"total_wage": number | null,"worker_count": number
                  }
                  ComputedFields: never
                  Insert: {
                    "category": string,"created_at"?: string,"created_by"?: string | null,"daily_rate": number,"entry_date"?: string,"id"?: string,"org_id": string,"project_id": string,"remarks": string,"total_wage"?: never,"worker_count": number
                  }
                  Update: {
                    "category"?: string,"created_at"?: string,"created_by"?: string | null,"daily_rate"?: number,"entry_date"?: string,"id"?: string,"org_id"?: string,"project_id"?: string,"remarks"?: string,"total_wage"?: never,"worker_count"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "labour_entries_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "labour_entries_project_id_org_id_fkey"
      columns: ["project_id","org_id"]
isOneToOne: false
      referencedRelation: "project_summaries"
      referencedColumns: ["project_id","org_id"]
    },{
      foreignKeyName: "labour_entries_project_id_org_id_fkey"
      columns: ["project_id","org_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id","org_id"]
    }
                  ]
                },"material_entries": {
                  Row: {
                    "challan_path": string | null,"created_at": string,"created_by": string | null,"entry_date": string,"id": string,"material": string,"org_id": string,"project_id": string,"quantity": number,"supplier": string | null,"unit": string
                  }
                  ComputedFields: never
                  Insert: {
                    "challan_path"?: string | null,"created_at"?: string,"created_by"?: string | null,"entry_date"?: string,"id"?: string,"material": string,"org_id": string,"project_id": string,"quantity": number,"supplier"?: string | null,"unit": string
                  }
                  Update: {
                    "challan_path"?: string | null,"created_at"?: string,"created_by"?: string | null,"entry_date"?: string,"id"?: string,"material"?: string,"org_id"?: string,"project_id"?: string,"quantity"?: number,"supplier"?: string | null,"unit"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "material_entries_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "material_entries_project_id_org_id_fkey"
      columns: ["project_id","org_id"]
isOneToOne: false
      referencedRelation: "project_summaries"
      referencedColumns: ["project_id","org_id"]
    },{
      foreignKeyName: "material_entries_project_id_org_id_fkey"
      columns: ["project_id","org_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id","org_id"]
    }
                  ]
                },"memberships": {
                  Row: {
                    "active": boolean,"created_at": string,"org_id": string,"role": Database["public"]['Enums']["member_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"org_id": string,"role": Database["public"]['Enums']["member_role"],"user_id": string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"org_id"?: string,"role"?: Database["public"]['Enums']["member_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "memberships_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "memberships_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"organizations": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"status": Database["public"]['Enums']["org_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"status"?: Database["public"]['Enums']["org_status"]
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"status"?: Database["public"]['Enums']["org_status"]
                  }
                  Relationships: [
                    
                  ]
                },"platform_admins": {
                  Row: {
                    "created_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "platform_admins_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"email": string | null,"full_name": string,"id": string,"must_change_password": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email"?: string | null,"full_name"?: string,"id": string,"must_change_password"?: boolean
                  }
                  Update: {
                    "created_at"?: string,"email"?: string | null,"full_name"?: string,"id"?: string,"must_change_password"?: boolean
                  }
                  Relationships: [
                    
                  ]
                },"project_finance": {
                  Row: {
                    "billed_amount": number,"contract_amount": number,"org_id": string,"project_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "billed_amount"?: number,"contract_amount"?: number,"org_id": string,"project_id": string
                  }
                  Update: {
                    "billed_amount"?: number,"contract_amount"?: number,"org_id"?: string,"project_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "project_finance_project_id_org_id_fkey"
      columns: ["project_id","org_id"]
isOneToOne: true
      referencedRelation: "project_summaries"
      referencedColumns: ["project_id","org_id"]
    },{
      foreignKeyName: "project_finance_project_id_org_id_fkey"
      columns: ["project_id","org_id"]
isOneToOne: true
      referencedRelation: "projects"
      referencedColumns: ["id","org_id"]
    }
                  ]
                },"project_members": {
                  Row: {
                    "created_at": string,"org_id": string,"permissions": (string)[],"project_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"org_id": string,"permissions"?: (string)[],"project_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"org_id"?: string,"permissions"?: (string)[],"project_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "project_members_org_id_user_id_fkey"
      columns: ["org_id","user_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["org_id","user_id"]
    },{
      foreignKeyName: "project_members_project_id_org_id_fkey"
      columns: ["project_id","org_id"]
isOneToOne: false
      referencedRelation: "project_summaries"
      referencedColumns: ["project_id","org_id"]
    },{
      foreignKeyName: "project_members_project_id_org_id_fkey"
      columns: ["project_id","org_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id","org_id"]
    }
                  ]
                },"projects": {
                  Row: {
                    "client_name": string | null,"code": string | null,"created_at": string,"created_by": string | null,"id": string,"location": string | null,"name": string,"org_id": string,"start_date": string | null,"status": Database["public"]['Enums']["project_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client_name"?: string | null,"code"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"location"?: string | null,"name": string,"org_id": string,"start_date"?: string | null,"status"?: Database["public"]['Enums']["project_status"],"updated_at"?: string
                  }
                  Update: {
                    "client_name"?: string | null,"code"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"location"?: string | null,"name"?: string,"org_id"?: string,"start_date"?: string | null,"status"?: Database["public"]['Enums']["project_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "projects_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "projects_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"vat_bills": {
                  Row: {
                    "bill_date": string,"bill_no": string,"created_at": string,"created_by": string | null,"file_path": string | null,"gross_amount": number | null,"id": string,"org_id": string,"project_id": string,"supplier_name": string,"supplier_pan": string,"taxable_amount": number,"vat_amount": number | null,"vat_included": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "bill_date": string,"bill_no": string,"created_at"?: string,"created_by"?: string | null,"file_path"?: string | null,"gross_amount"?: never,"id"?: string,"org_id": string,"project_id": string,"supplier_name": string,"supplier_pan": string,"taxable_amount": number,"vat_amount"?: never,"vat_included"?: boolean
                  }
                  Update: {
                    "bill_date"?: string,"bill_no"?: string,"created_at"?: string,"created_by"?: string | null,"file_path"?: string | null,"gross_amount"?: never,"id"?: string,"org_id"?: string,"project_id"?: string,"supplier_name"?: string,"supplier_pan"?: string,"taxable_amount"?: number,"vat_amount"?: never,"vat_included"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "vat_bills_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "vat_bills_project_id_org_id_fkey"
      columns: ["project_id","org_id"]
isOneToOne: false
      referencedRelation: "project_summaries"
      referencedColumns: ["project_id","org_id"]
    },{
      foreignKeyName: "vat_bills_project_id_org_id_fkey"
      columns: ["project_id","org_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id","org_id"]
    }
                  ]
                }
          }
          Views: {
            "project_summaries": {
                  Row: {
                    "boq_total": number | null,"drawing_count": number | null,"labour_cost": number | null,"man_days": number | null,"material_count": number | null,"org_id": string,"project_id": string,"steel_kg": number | null,"vat_bill_count": number | null,"vat_gross": number | null
                  }
                  ComputedFields: never
                  Insert: {
                           "boq_total"?: never,"drawing_count"?: never,"labour_cost"?: never,"man_days"?: never,"material_count"?: never,"org_id"?: string | null,"project_id"?: string | null,"steel_kg"?: never,"vat_bill_count"?: never,"vat_gross"?: never
                         }
                        Update: {
                           "boq_total"?: never,"drawing_count"?: never,"labour_cost"?: never,"man_days"?: never,"material_count"?: never,"org_id"?: string | null,"project_id"?: string | null,"steel_kg"?: never,"vat_bill_count"?: never,"vat_gross"?: never
                         }
                        Relationships: [
                    {
      foreignKeyName: "projects_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            [_ in never]: never
          }
          Enums: {
            "drawing_category": "structural"|"architectural"|"mep"|"as_built","member_role": "owner"|"admin"|"site_staff","org_status": "active"|"suspended","project_status": "running"|"on_hold"|"completed"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "drawing_category": ["structural", "architectural", "mep", "as_built"],"member_role": ["owner", "admin", "site_staff"],"org_status": ["active", "suspended"],"project_status": ["running", "on_hold", "completed"]
          }
        }
} as const
