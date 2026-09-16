import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BoardKanban } from "./board-kanban";

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

  const assigneeIdsByTask: Record<string, string[]> = {};
  for (const a of assignments ?? []) {
    const list = assigneeIdsByTask[a.task_id] ?? [];
    list.push(a.user_id);
    assigneeIdsByTask[a.task_id] = list;
  }

  const canManage = profile ? CAN_CREATE_TASKS.includes(profile.role) : false;

  return (
    <div className="w-full space-y-4 px-4 py-4">
      <div>
        <h1 className="text-lg font-semibold">{board.name}</h1>
        <Link href="/boards" className="text-xs text-black/50">
          ← חזרה ל-Boards שלי
        </Link>
      </div>

      <BoardKanban
        boardId={board.id}
        statuses={statuses ?? []}
        priorities={priorities ?? []}
        fieldDefs={fieldDefs ?? []}
        tasks={tasks ?? []}
        assigneeIdsByTask={assigneeIdsByTask}
        assignableUsers={assignableUsers ?? []}
        canManage={canManage}
      />
    </div>
  );
}
