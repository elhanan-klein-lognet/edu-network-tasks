/**
 * Hand-written to match supabase/migrations/*.sql until the project is
 * linked to a live Supabase instance. Once it is, regenerate the real thing
 * and replace this file:
 *
 *   npx supabase gen types typescript --project-id <ref> > src/lib/supabase/database.types.ts
 *
 * Do that once for EACH of the two projects described in spec.md section 9
 * (production and dev/test) whenever the schema changes, and keep whichever
 * one matches the project this app is currently pointed at.
 */

export type UserRole =
  | "super_admin"
  | "network_admin"
  | "institution_manager"
  | "employee";

export type CustomFieldType = "text" | "number" | "date" | "select";

export interface Database {
  public: {
    Tables: {
      institutions: {
        Row: {
          id: string;
          name: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["institutions"]["Insert"]>;
        Relationships: never[];
      };
      users: {
        Row: {
          id: string;
          full_name: string;
          role: UserRole;
          institution_id: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          role?: UserRole;
          institution_id?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
        Relationships: never[];
      };
      boards: {
        Row: {
          id: string;
          name: string;
          institution_id: string | null;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          institution_id?: string | null;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["boards"]["Insert"]>;
        Relationships: never[];
      };
      board_custom_field_definitions: {
        Row: {
          id: string;
          board_id: string;
          field_name: string;
          field_type: CustomFieldType;
          field_options: unknown | null;
          display_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          board_id: string;
          field_name: string;
          field_type: CustomFieldType;
          field_options?: unknown | null;
          display_order?: number;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["board_custom_field_definitions"]["Insert"]
        >;
        Relationships: never[];
      };
      task_statuses: {
        Row: {
          id: string;
          name: string;
          display_order: number;
          is_completed: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          display_order?: number;
          is_completed?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["task_statuses"]["Insert"]>;
        Relationships: never[];
      };
      task_priorities: {
        Row: { id: string; name: string; display_order: number; created_at: string };
        Insert: { id?: string; name: string; display_order?: number; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["task_priorities"]["Insert"]>;
        Relationships: never[];
      };
      projects: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          due_date: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          due_date?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["projects"]["Insert"]>;
        Relationships: never[];
      };
      tasks: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          board_id: string;
          institution_id: string | null;
          status_id: string;
          priority_id: string;
          due_date: string | null;
          custom_fields: Record<string, unknown>;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          board_id: string;
          institution_id?: string | null;
          status_id: string;
          priority_id: string;
          due_date?: string | null;
          custom_fields?: Record<string, unknown>;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["tasks"]["Insert"]>;
        Relationships: never[];
      };
      task_assignees: {
        Row: { task_id: string; user_id: string; assigned_at: string };
        Insert: { task_id: string; user_id: string; assigned_at?: string };
        Update: Partial<Database["public"]["Tables"]["task_assignees"]["Insert"]>;
        Relationships: never[];
      };
      task_project_links: {
        Row: { task_id: string; project_id: string };
        Insert: { task_id: string; project_id: string };
        Update: Partial<Database["public"]["Tables"]["task_project_links"]["Insert"]>;
        Relationships: never[];
      };
      task_activity_log: {
        Row: {
          id: string;
          task_id: string;
          changed_by: string | null;
          field_name: string;
          old_value: string | null;
          new_value: string | null;
          changed_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          changed_by?: string | null;
          field_name: string;
          old_value?: string | null;
          new_value?: string | null;
          changed_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["task_activity_log"]["Insert"]>;
        Relationships: never[];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      custom_field_type: CustomFieldType;
    };
    CompositeTypes: Record<string, never>;
  };
}
