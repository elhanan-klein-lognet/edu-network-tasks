import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { computeProgress } from "@/lib/progress";
import { createProject } from "./actions";
import { ProgressBar } from "./progress-bar";

export default async function ProjectsPage() {
  const supabase = await createClient();

  const [{ data: projects }, { data: links }, { data: statuses }] =
    await Promise.all([
      supabase
        .from("projects")
        .select("id, name, description, due_date")
        .order("created_at", { ascending: false }),
      supabase.from("task_project_links").select("project_id, task_id"),
      supabase.from("task_statuses").select("id, is_completed"),
    ]);

  const taskIds = [...new Set((links ?? []).map((l) => l.task_id))];
  const { data: tasks } = taskIds.length
    ? await supabase.from("tasks").select("id, status_id").in("id", taskIds)
    : { data: [] };

  const statusIdByTaskId = new Map(
    (tasks ?? []).map((t) => [t.id, t.status_id]),
  );
  const completedStatusIds = new Set(
    (statuses ?? []).filter((s) => s.is_completed).map((s) => s.id),
  );

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold">פרויקטים</h1>
        <p className="text-sm text-black/50">
          קיבוץ משימות מכמה boards סביב יעד משותף (סעיף 6 באפיון). שיוך
          משימות לפרויקט נעשה מתוך עמוד הפרויקט עצמו.
        </p>
      </div>

      <form
        action={createProject}
        className="space-y-2 rounded border border-black/10 p-4"
      >
        <h2 className="font-medium">פרויקט חדש</h2>
        <input
          name="name"
          required
          placeholder="שם הפרויקט"
          className="w-full rounded border border-black/20 px-3 py-2 text-sm"
        />
        <textarea
          name="description"
          placeholder="תיאור (לא חובה)"
          rows={2}
          className="w-full rounded border border-black/20 px-3 py-2 text-sm"
        />
        <input
          type="date"
          name="due_date"
          className="rounded border border-black/20 px-3 py-2 text-sm"
        />
        <div>
          <button
            type="submit"
            className="rounded bg-black px-4 py-2 text-sm text-white"
          >
            יצירת פרויקט
          </button>
        </div>
      </form>

      <ul className="divide-y divide-black/5 rounded border border-black/10">
        {projects?.length ? (
          projects.map((project) => {
            const projectTaskIds = (links ?? [])
              .filter((l) => l.project_id === project.id)
              .map((l) => statusIdByTaskId.get(l.task_id));
            const progress = computeProgress(projectTaskIds, completedStatusIds);
            const isOverdue =
              project.due_date &&
              project.due_date < today &&
              progress.percent !== 100;

            return (
              <li key={project.id} className="space-y-2 px-3 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    href={`/admin/projects/${project.id}`}
                    className="font-medium hover:underline"
                  >
                    {project.name}
                  </Link>
                  {project.due_date && (
                    <span
                      className={`text-xs ${isOverdue ? "text-red-600" : "text-black/40"}`}
                    >
                      יעד: {project.due_date}
                      {isOverdue ? " (באיחור)" : ""}
                    </span>
                  )}
                </div>
                {project.description && (
                  <p className="text-black/60">{project.description}</p>
                )}
                <ProgressBar
                  percent={progress.percent}
                  label={`${progress.completed}/${progress.total} משימות הושלמו`}
                />
              </li>
            );
          })
        ) : (
          <li className="px-3 py-3 text-black/40">אין עדיין פרויקטים.</li>
        )}
      </ul>
    </div>
  );
}
