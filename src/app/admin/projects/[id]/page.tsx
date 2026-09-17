import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { computeProgress } from "@/lib/progress";
import { ProgressBar } from "../progress-bar";
import { linkTasks, unlinkTask } from "../actions";

export default async function ProjectDetailPage(
  props: PageProps<"/admin/projects/[id]">,
) {
  const { id: projectId } = await props.params;
  const supabase = await createClient();

  const [{ data: project }, { data: links }, { data: statuses }, { data: boards }] =
    await Promise.all([
      supabase
        .from("projects")
        .select("id, name, description, due_date")
        .eq("id", projectId)
        .single(),
      supabase
        .from("task_project_links")
        .select("task_id")
        .eq("project_id", projectId),
      supabase.from("task_statuses").select("id, name, is_completed"),
      supabase.from("boards").select("id, name"),
    ]);

  if (!project) notFound();

  const boardNameById = new Map((boards ?? []).map((b) => [b.id, b.name]));
  const statusById = new Map((statuses ?? []).map((s) => [s.id, s]));
  const completedStatusIds = new Set(
    (statuses ?? []).filter((s) => s.is_completed).map((s) => s.id),
  );

  const linkedTaskIds = (links ?? []).map((l) => l.task_id);

  const { data: linkedTasks } = linkedTaskIds.length
    ? await supabase
        .from("tasks")
        .select("id, title, status_id, board_id, due_date")
        .in("id", linkedTaskIds)
    : { data: [] };

  // Everything else network-wide, for the "add tasks" picker. Fine at POC
  // scale (section 6 doesn't call for search/paging here); RLS already
  // limits this to what an admin/network_admin can see, which is everyone.
  const { data: allTasks } = await supabase
    .from("tasks")
    .select("id, title, board_id")
    .order("created_at", { ascending: false });

  const linkedIdSet = new Set(linkedTaskIds);
  const unlinkedTasks = (allTasks ?? []).filter((t) => !linkedIdSet.has(t.id));

  const progress = computeProgress(
    (linkedTasks ?? []).map((t) => t.status_id),
    completedStatusIds,
  );

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold">{project.name}</h1>
        {project.description && (
          <p className="text-sm text-black/60">{project.description}</p>
        )}
        {project.due_date && (
          <p className="text-xs text-black/40">יעד: {project.due_date}</p>
        )}
      </div>

      <ProgressBar
        percent={progress.percent}
        label={`${progress.completed}/${progress.total} משימות הושלמו`}
      />

      <section className="space-y-2">
        <h2 className="font-medium">משימות בפרויקט</h2>
        <ul className="divide-y divide-black/5 rounded border border-black/10">
          {linkedTasks?.length ? (
            linkedTasks.map((task) => (
              <li
                key={task.id}
                className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
              >
                <div>
                  <p>{task.title}</p>
                  <p className="text-xs text-black/40">
                    {boardNameById.get(task.board_id) ?? "board"} ·{" "}
                    {statusById.get(task.status_id)?.name ?? "—"}
                    {task.due_date ? ` · יעד: ${task.due_date}` : ""}
                  </p>
                </div>
                <form action={unlinkTask}>
                  <input type="hidden" name="project_id" value={projectId} />
                  <input type="hidden" name="task_id" value={task.id} />
                  <button
                    type="submit"
                    className="text-xs text-black/60 underline"
                  >
                    הסרה
                  </button>
                </form>
              </li>
            ))
          ) : (
            <li className="px-3 py-3 text-black/40">
              אין עדיין משימות בפרויקט הזה.
            </li>
          )}
        </ul>
      </section>

      {unlinkedTasks.length > 0 && (
        <form
          action={linkTasks}
          className="space-y-2 rounded border border-black/10 p-4"
        >
          <input type="hidden" name="project_id" value={projectId} />
          <label className="block text-sm font-medium" htmlFor="task_ids">
            הוספת משימות (אפשר לבחור כמה — Ctrl/Cmd+קליק, או גרירה):
          </label>
          <select
            id="task_ids"
            name="task_ids"
            multiple
            size={Math.min(10, Math.max(4, unlinkedTasks.length))}
            className="w-full rounded border border-black/20 px-2 py-1 text-sm"
          >
            {unlinkedTasks.map((task) => (
              <option key={task.id} value={task.id}>
                [{boardNameById.get(task.board_id) ?? "board"}] {task.title}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded bg-black px-4 py-2 text-sm text-white"
          >
            הוספה לפרויקט
          </button>
        </form>
      )}
    </div>
  );
}
