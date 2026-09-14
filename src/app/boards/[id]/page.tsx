import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createTask, updateTaskStatus } from "./actions";

const CAN_CREATE_TASKS = ["super_admin", "network_admin", "institution_manager"];

export default async function BoardTasksPage(
  props: PageProps<"/boards/[id]">,
) {
  const { id: boardId } = await props.params;
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

  const { data: board } = await supabase
    .from("boards")
    .select("id, name, institution_id")
    .eq("id", boardId)
    .single();

  if (!board) notFound();

  const [{ data: statuses }, { data: priorities }, { data: fieldDefs }, { data: tasks }] =
    await Promise.all([
      supabase.from("task_statuses").select("id, name").order("display_order"),
      supabase.from("task_priorities").select("id, name").order("display_order"),
      supabase
        .from("board_custom_field_definitions")
        .select("id, field_name, field_type, field_options")
        .eq("board_id", boardId)
        .order("display_order"),
      supabase
        .from("tasks")
        .select("id, title, description, status_id, priority_id, due_date, custom_fields")
        .eq("board_id", boardId)
        .order("created_at", { ascending: true }),
    ]);

  const taskIds = (tasks ?? []).map((t) => t.id);

  // Assignable users: this institution's staff for an institution board,
  // or every active user for the network-wide board (institution_id NULL).
  const usersQuery = supabase
    .from("users")
    .select("id, full_name")
    .eq("is_active", true);
  const { data: assignableUsers } = board.institution_id
    ? await usersQuery.eq("institution_id", board.institution_id)
    : await usersQuery;

  const { data: assignments } = taskIds.length
    ? await supabase
        .from("task_assignees")
        .select("task_id, user_id")
        .in("task_id", taskIds)
    : { data: [] };

  const userNameById = new Map(
    (assignableUsers ?? []).map((u) => [u.id, u.full_name]),
  );
  const assigneesByTask = new Map<string, string[]>();
  for (const a of assignments ?? []) {
    const list = assigneesByTask.get(a.task_id) ?? [];
    list.push(userNameById.get(a.user_id) ?? "משתמש");
    assigneesByTask.set(a.task_id, list);
  }
  const priorityNameById = new Map((priorities ?? []).map((p) => [p.id, p.name]));

  const canCreate = profile ? CAN_CREATE_TASKS.includes(profile.role) : false;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 p-6">
      <div>
        <h1 className="text-lg font-semibold">{board.name}</h1>
        <Link href="/boards" className="text-xs text-black/50">
          ← חזרה ל-Boards שלי
        </Link>
      </div>

      <div className="space-y-4">
        {(statuses ?? []).map((status) => {
          const statusTasks = (tasks ?? []).filter((t) => t.status_id === status.id);
          return (
            <section key={status.id}>
              <h2 className="mb-2 text-sm font-medium text-black/60">
                {status.name} ({statusTasks.length})
              </h2>
              <ul className="divide-y divide-black/5 rounded border border-black/10">
                {statusTasks.length ? (
                  statusTasks.map((task) => (
                    <li key={task.id} className="space-y-1 px-3 py-2 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">{task.title}</span>
                        <form action={updateTaskStatus} className="flex items-center gap-2">
                          <input type="hidden" name="task_id" value={task.id} />
                          <input type="hidden" name="board_id" value={board.id} />
                          <select
                            name="status_id"
                            defaultValue={task.status_id}
                            className="rounded border border-black/20 px-2 py-1 text-xs"
                          >
                            {(statuses ?? []).map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                          <button type="submit" className="text-xs underline">
                            עדכון
                          </button>
                        </form>
                      </div>
                      {task.description && (
                        <p className="text-black/60">{task.description}</p>
                      )}
                      <p className="text-xs text-black/40">
                        עדיפות: {priorityNameById.get(task.priority_id) ?? "—"}
                        {task.due_date && ` · יעד: ${task.due_date}`}
                        {assigneesByTask.get(task.id)?.length
                          ? ` · אחראים: ${assigneesByTask.get(task.id)!.join(", ")}`
                          : ""}
                      </p>
                    </li>
                  ))
                ) : (
                  <li className="px-3 py-3 text-black/40">אין משימות בסטטוס זה.</li>
                )}
              </ul>
            </section>
          );
        })}
      </div>

      {canCreate && (
        <form
          action={createTask}
          className="space-y-3 rounded border border-black/10 p-4"
        >
          <input type="hidden" name="board_id" value={board.id} />
          <h2 className="font-medium">משימה חדשה</h2>

          <input
            name="title"
            required
            placeholder="כותרת"
            className="w-full rounded border border-black/20 px-3 py-2 text-sm"
          />
          <textarea
            name="description"
            placeholder="תיאור (לא חובה)"
            className="w-full rounded border border-black/20 px-3 py-2 text-sm"
          />

          <div className="flex flex-wrap gap-2">
            <select
              name="status_id"
              required
              defaultValue=""
              className="rounded border border-black/20 px-2 py-2 text-sm"
            >
              <option value="" disabled>
                סטטוס
              </option>
              {(statuses ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              name="priority_id"
              required
              defaultValue=""
              className="rounded border border-black/20 px-2 py-2 text-sm"
            >
              <option value="" disabled>
                עדיפות
              </option>
              {(priorities ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              name="due_date"
              className="rounded border border-black/20 px-2 py-2 text-sm"
            />
          </div>

          {fieldDefs?.length ? (
            <div className="space-y-2 border-t border-black/10 pt-3">
              <p className="text-xs text-black/50">שדות מותאמים אישית של ה-board:</p>
              {fieldDefs.map((def) => (
                <CustomFieldInput key={def.id} def={def} />
              ))}
            </div>
          ) : null}

          {assignableUsers?.length ? (
            <div className="space-y-1 border-t border-black/10 pt-3">
              <p className="text-xs text-black/50">אחראים:</p>
              <div className="flex flex-wrap gap-3">
                {assignableUsers.map((u) => (
                  <label key={u.id} className="flex items-center gap-1 text-sm">
                    <input type="checkbox" name="assignee_ids" value={u.id} />
                    {u.full_name}
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          <button
            type="submit"
            className="rounded bg-black px-4 py-2 text-sm text-white"
          >
            יצירת משימה
          </button>
        </form>
      )}
    </div>
  );
}

function CustomFieldInput({
  def,
}: {
  def: { id: string; field_name: string; field_type: string; field_options: unknown };
}) {
  const name = `custom_field__${def.id}`;

  if (def.field_type === "select") {
    const options = Array.isArray(def.field_options) ? (def.field_options as string[]) : [];
    return (
      <label className="block text-sm">
        {def.field_name}
        <select name={name} defaultValue="" className="ms-2 rounded border border-black/20 px-2 py-1">
          <option value="">—</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </label>
    );
  }

  const inputType = def.field_type === "number" ? "number" : def.field_type === "date" ? "date" : "text";

  return (
    <label className="block text-sm">
      {def.field_name}
      <input
        type={inputType}
        name={name}
        className="ms-2 rounded border border-black/20 px-2 py-1"
      />
    </label>
  );
}
