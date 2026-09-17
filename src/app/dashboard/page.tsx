import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardClient } from "./dashboard-client";

/**
 * Management dashboard (section 7) — for network_admin and super_admin.
 * Deliberately NOT under /admin: that whole section is gated to
 * super_admin only (see admin/layout.tsx), but the spec explicitly scopes
 * this screen to "להנהלת הרשת ולמנהל-על" (network leadership too).
 *
 * This page only fetches; all the aggregation (by status/institution/
 * assignee, overdue, project progress) and the drill-down popups happen in
 * the client component, which also needs the raw rows to filter them.
 */
export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || !["super_admin", "network_admin"].includes(profile.role)) {
    redirect("/");
  }

  const [
    { data: tasks },
    { data: statuses },
    { data: priorities },
    { data: institutions },
    { data: boards },
    { data: fieldDefs },
    { data: users },
    { data: assignments },
    { data: projects },
    { data: projectLinks },
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select(
        "id, title, description, status_id, priority_id, due_date, custom_fields, board_id, institution_id",
      ),
    supabase
      .from("task_statuses")
      .select("id, name, is_completed")
      .order("display_order"),
    supabase.from("task_priorities").select("id, name"),
    supabase.from("institutions").select("id, name"),
    supabase.from("boards").select("id, name, institution_id"),
    supabase
      .from("board_custom_field_definitions")
      .select("id, board_id, field_name, field_type, field_options")
      .order("display_order"),
    supabase.from("users").select("id, full_name, institution_id").eq("is_active", true),
    supabase.from("task_assignees").select("task_id, user_id"),
    supabase.from("projects").select("id, name, due_date"),
    supabase.from("task_project_links").select("project_id, task_id"),
  ]);

  return (
    <div className="w-full max-w-5xl space-y-8 px-4 py-4">
      <div>
        <h1 className="text-lg font-semibold">דשבורד ניהולי</h1>
        <Link href="/" className="text-xs text-black/50">
          ← חזרה לדף הבית
        </Link>
      </div>

      <DashboardClient
        tasks={tasks ?? []}
        statuses={statuses ?? []}
        priorities={priorities ?? []}
        institutions={institutions ?? []}
        boards={boards ?? []}
        fieldDefs={fieldDefs ?? []}
        users={users ?? []}
        assignments={assignments ?? []}
        projects={projects ?? []}
        projectLinks={projectLinks ?? []}
      />
    </div>
  );
}
