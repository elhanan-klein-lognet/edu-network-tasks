import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BoardKanban } from "./board-kanban";

const CAN_CREATE_TASKS = ["super_admin", "network_admin", "institution_manager"];
const CAN_LINK_PROJECTS = ["super_admin", "network_admin"];

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
  const canLinkProjects = profile ? CAN_LINK_PROJECTS.includes(profile.role) : false;

  // Fetched for everyone (not just canLinkProjects) so the read-only detail
  // view can show a linked project's name too, not just admins editing it —
  // RLS already limits what comes back to what that viewer can see anyway.
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name")
    .order("name");
  const { data: projectLinks } = taskIds.length
    ? await supabase
        .from("task_project_links")
        .select("task_id, project_id")
        .in("task_id", taskIds)
    : { data: [] };

  const projectIdsByTask: Record<string, string[]> = {};
  for (const l of projectLinks ?? []) {
    const list = projectIdsByTask[l.task_id] ?? [];
    list.push(l.project_id);
    projectIdsByTask[l.task_id] = list;
  }

  return (
    <div className="w-full space-y-3">
      <h2 className="text-base font-medium">{board.name}</h2>

      <BoardKanban
        boardId={board.id}
        statuses={statuses ?? []}
        priorities={priorities ?? []}
        fieldDefs={fieldDefs ?? []}
        tasks={tasks ?? []}
        assigneeIdsByTask={assigneeIdsByTask}
        assignableUsers={assignableUsers ?? []}
        projects={projects ?? []}
        projectIdsByTask={projectIdsByTask}
        canManage={canManage}
        canLinkProjects={canLinkProjects}
      />
    </div>
  );
}
