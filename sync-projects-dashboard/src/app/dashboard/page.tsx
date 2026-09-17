import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { computeProgress } from "@/lib/progress";
import { ProgressBar } from "../admin/projects/progress-bar";

/**
 * Management dashboard (section 7) — for network_admin and super_admin.
 * Deliberately NOT under /admin: that whole section is gated to
 * super_admin only (see admin/layout.tsx), but the spec explicitly scopes
 * this screen to "להנהלת הרשת ולמנהל-על" (network leadership too).
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
    { data: institutions },
    { data: assignments },
    { data: users },
    { data: projects },
    { data: projectLinks },
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, status_id, board_id, institution_id, due_date"),
    supabase
      .from("task_statuses")
      .select("id, name, is_completed")
      .order("display_order"),
    supabase.from("institutions").select("id, name"),
    supabase.from("task_assignees").select("task_id, user_id"),
    supabase.from("users").select("id, full_name"),
    supabase.from("projects").select("id, name, due_date"),
    supabase.from("task_project_links").select("project_id, task_id"),
  ]);

  const completedStatusIds = new Set(
    (statuses ?? []).filter((s) => s.is_completed).map((s) => s.id),
  );
  const institutionNameById = new Map(
    (institutions ?? []).map((i) => [i.id, i.name]),
  );
  const userNameById = new Map((users ?? []).map((u) => [u.id, u.full_name]));

  const today = new Date().toISOString().slice(0, 10);
  const allTasks = tasks ?? [];
  const openTasks = allTasks.filter((t) => !completedStatusIds.has(t.status_id));
  const overdueTasks = openTasks
    .filter((t) => t.due_date && t.due_date < today)
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));

  // Breakdown by status, in the admin-defined display order.
  const countByStatus = (statuses ?? []).map((s) => ({
    ...s,
    count: allTasks.filter((t) => t.status_id === s.id).length,
  }));

  // Breakdown by institution — open tasks only (workload signal, not a
  // historical count). Null institution_id = network-wide boards.
  const institutionCounts = new Map<string, number>();
  for (const t of openTasks) {
    const key = t.institution_id ?? "__network__";
    institutionCounts.set(key, (institutionCounts.get(key) ?? 0) + 1);
  }
  const institutionRows = [...institutionCounts.entries()]
    .map(([key, count]) => ({
      name: key === "__network__" ? "כלל-רשתי" : institutionNameById.get(key) ?? "מוסד",
      count,
    }))
    .sort((a, b) => b.count - a.count);

  // Workload by assignee — open tasks only.
  const openTaskIds = new Set(openTasks.map((t) => t.id));
  const assigneeCounts = new Map<string, number>();
  for (const a of assignments ?? []) {
    if (!openTaskIds.has(a.task_id)) continue;
    assigneeCounts.set(a.user_id, (assigneeCounts.get(a.user_id) ?? 0) + 1);
  }
  const assigneeRows = [...assigneeCounts.entries()]
    .map(([userId, count]) => ({
      name: userNameById.get(userId) ?? "משתמש",
      count,
    }))
    .sort((a, b) => b.count - a.count);

  // Project progress, same calculation as the projects admin screen.
  const statusIdByTaskId = new Map(allTasks.map((t) => [t.id, t.status_id]));
  const projectProgress = (projects ?? []).map((project) => {
    const statusIds = (projectLinks ?? [])
      .filter((l) => l.project_id === project.id)
      .map((l) => statusIdByTaskId.get(l.task_id));
    return { ...project, progress: computeProgress(statusIds, completedStatusIds) };
  });

  return (
    <div className="w-full max-w-5xl space-y-8 px-4 py-4">
      <div>
        <h1 className="text-lg font-semibold">דשבורד ניהולי</h1>
        <Link href="/" className="text-xs text-black/50">
          ← חזרה לדף הבית
        </Link>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="סה״כ משימות" value={allTasks.length} />
        <StatTile label="פתוחות" value={openTasks.length} />
        <StatTile
          label="הושלמו"
          value={allTasks.length - openTasks.length}
        />
        <StatTile label="באיחור" value={overdueTasks.length} tone="critical" />
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">משימות לפי סטטוס</h2>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {countByStatus.map((s) => (
            <li
              key={s.id}
              className="rounded border border-black/10 px-3 py-2 text-sm"
            >
              <p className="text-black/60">{s.name}</p>
              <p className="text-lg font-semibold">{s.count}</p>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-8 sm:grid-cols-2">
        <section className="space-y-2">
          <h2 className="font-medium">פילוח לפי מוסד (משימות פתוחות)</h2>
          <ul className="divide-y divide-black/5 rounded border border-black/10">
            {institutionRows.length ? (
              institutionRows.map((row) => (
                <li
                  key={row.name}
                  className="flex items-center justify-between px-3 py-2 text-sm"
                >
                  <span>{row.name}</span>
                  <span className="font-medium">{row.count}</span>
                </li>
              ))
            ) : (
              <li className="px-3 py-3 text-sm text-black/40">
                אין משימות פתוחות.
              </li>
            )}
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-medium">עומס לפי אחראי (משימות פתוחות)</h2>
          <ul className="divide-y divide-black/5 rounded border border-black/10">
            {assigneeRows.length ? (
              assigneeRows.map((row) => (
                <li
                  key={row.name}
                  className="flex items-center justify-between px-3 py-2 text-sm"
                >
                  <span>{row.name}</span>
                  <span className="font-medium">{row.count}</span>
                </li>
              ))
            ) : (
              <li className="px-3 py-3 text-sm text-black/40">
                אין משימות פתוחות עם אחראי משויך.
              </li>
            )}
          </ul>
        </section>
      </div>

      <section className="space-y-2">
        <h2 className="font-medium">משימות באיחור</h2>
        <ul className="divide-y divide-black/5 rounded border border-black/10">
          {overdueTasks.length ? (
            overdueTasks.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
              >
                <span>{t.title}</span>
                <span className="text-xs text-red-600">
                  {t.institution_id
                    ? institutionNameById.get(t.institution_id) ?? "מוסד"
                    : "כלל-רשתי"}{" "}
                  · יעד: {t.due_date}
                </span>
              </li>
            ))
          ) : (
            <li className="px-3 py-3 text-sm text-black/40">
              אין משימות באיחור כרגע.
            </li>
          )}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">התקדמות פרויקטים</h2>
        {projectProgress.length ? (
          <ul className="space-y-3">
            {projectProgress.map((project) => (
              <li
                key={project.id}
                className="space-y-1 rounded border border-black/10 p-3"
              >
                <Link
                  href={`/admin/projects/${project.id}`}
                  className="text-sm font-medium hover:underline"
                >
                  {project.name}
                </Link>
                <ProgressBar
                  percent={project.progress.percent}
                  label={`${project.progress.completed}/${project.progress.total} משימות הושלמו`}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-black/40">אין עדיין פרויקטים.</p>
        )}
      </section>
    </div>
  );
}

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "critical";
}) {
  return (
    <div className="rounded border border-black/10 p-3">
      <p className="text-xs text-black/50">{label}</p>
      <p
        className={`text-2xl font-semibold ${tone === "critical" && value > 0 ? "text-red-600" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}
