"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Modal } from "@/components/modal";
import { ProgressBar } from "@/app/admin/projects/progress-bar";
import { computeProgress } from "@/lib/progress";
import {
  TaskDetailModal,
  type Status,
  type Priority,
  type FieldDef,
  type AssignableUser,
  type Project,
  type Task,
} from "@/app/boards/[id]/task-modals";
import { updateTask, updateTaskStatus } from "@/app/boards/[id]/actions";

type TaskRow = Task & { board_id: string; institution_id: string | null };
type StatusRow = Status & { is_completed: boolean };
type BoardRow = { id: string; name: string; institution_id: string | null };
type InstitutionRow = { id: string; name: string };
type FieldDefRow = FieldDef & { board_id: string };
type UserRow = AssignableUser & { institution_id: string | null };
type AssignmentRow = { task_id: string; user_id: string };
type ProjectRow = Project & { due_date: string | null };
type ProjectLinkRow = { project_id: string; task_id: string };

type ListFilter =
  | { kind: "total"; label: string }
  | { kind: "open"; label: string }
  | { kind: "completed"; label: string }
  | { kind: "overdue"; label: string }
  | { kind: "status"; statusId: string; label: string }
  | { kind: "institution"; key: string; label: string }
  | { kind: "assignee"; userId: string; label: string };

/**
 * Every aggregate on this page (the 4 stat tiles, the per-status grid, the
 * institution/assignee breakdowns) is clickable: it opens a popup listing
 * the exact tasks behind that number, and each task in that list opens the
 * same full edit popup the Kanban board uses (reused from
 * boards/[id]/task-modals — same fields, same server actions). Saving
 * there calls router.refresh() so this page's numbers update immediately,
 * on top of the revalidatePath("/dashboard") those actions already do.
 */
export function DashboardClient({
  tasks,
  statuses,
  priorities,
  institutions,
  boards,
  fieldDefs,
  users,
  assignments,
  projects,
  projectLinks,
}: {
  tasks: TaskRow[];
  statuses: StatusRow[];
  priorities: Priority[];
  institutions: InstitutionRow[];
  boards: BoardRow[];
  fieldDefs: FieldDefRow[];
  users: UserRow[];
  assignments: AssignmentRow[];
  projects: ProjectRow[];
  projectLinks: ProjectLinkRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [listFilter, setListFilter] = useState<ListFilter | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const completedStatusIds = useMemo(
    () => new Set(statuses.filter((s) => s.is_completed).map((s) => s.id)),
    [statuses],
  );
  const institutionNameById = useMemo(
    () => new Map(institutions.map((i) => [i.id, i.name])),
    [institutions],
  );
  const userNameById = useMemo(
    () => new Map(users.map((u) => [u.id, u.full_name])),
    [users],
  );
  const boardById = useMemo(() => new Map(boards.map((b) => [b.id, b])), [boards]);
  const fieldDefsByBoard = useMemo(() => {
    const map = new Map<string, FieldDefRow[]>();
    for (const def of fieldDefs) {
      const list = map.get(def.board_id) ?? [];
      list.push(def);
      map.set(def.board_id, list);
    }
    return map;
  }, [fieldDefs]);
  const assigneeIdsByTask = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const a of assignments) {
      const list = map.get(a.task_id) ?? [];
      list.push(a.user_id);
      map.set(a.task_id, list);
    }
    return map;
  }, [assignments]);
  const projectIdsByTask = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const l of projectLinks) {
      const list = map.get(l.task_id) ?? [];
      list.push(l.project_id);
      map.set(l.task_id, list);
    }
    return map;
  }, [projectLinks]);

  const openTasks = useMemo(
    () => tasks.filter((t) => !completedStatusIds.has(t.status_id)),
    [tasks, completedStatusIds],
  );
  const overdueTasks = useMemo(
    () =>
      openTasks
        .filter((t) => t.due_date && t.due_date < today)
        .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? "")),
    [openTasks, today],
  );
  const countByStatus = useMemo(
    () =>
      statuses.map((s) => ({
        ...s,
        count: tasks.filter((t) => t.status_id === s.id).length,
      })),
    [statuses, tasks],
  );
  const institutionRows = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of openTasks) {
      const key = t.institution_id ?? "__network__";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([key, count]) => ({
        key,
        name: key === "__network__" ? "כלל-רשתי" : institutionNameById.get(key) ?? "מוסד",
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [openTasks, institutionNameById]);
  const assigneeRows = useMemo(() => {
    const openIds = new Set(openTasks.map((t) => t.id));
    const counts = new Map<string, number>();
    for (const a of assignments) {
      if (!openIds.has(a.task_id)) continue;
      counts.set(a.user_id, (counts.get(a.user_id) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([userId, count]) => ({
        userId,
        name: userNameById.get(userId) ?? "משתמש",
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [openTasks, assignments, userNameById]);
  const statusIdByTaskId = useMemo(
    () => new Map(tasks.map((t) => [t.id, t.status_id])),
    [tasks],
  );
  const projectProgress = useMemo(
    () =>
      projects.map((project) => {
        const statusIds = projectLinks
          .filter((l) => l.project_id === project.id)
          .map((l) => statusIdByTaskId.get(l.task_id));
        return { ...project, progress: computeProgress(statusIds, completedStatusIds) };
      }),
    [projects, projectLinks, statusIdByTaskId, completedStatusIds],
  );

  function matchesFilter(task: TaskRow, filter: ListFilter): boolean {
    switch (filter.kind) {
      case "total":
        return true;
      case "open":
        return !completedStatusIds.has(task.status_id);
      case "completed":
        return completedStatusIds.has(task.status_id);
      case "overdue":
        return (
          !completedStatusIds.has(task.status_id) &&
          !!task.due_date &&
          task.due_date < today
        );
      case "status":
        return task.status_id === filter.statusId;
      case "institution":
        return (
          !completedStatusIds.has(task.status_id) &&
          (task.institution_id ?? "__network__") === filter.key
        );
      case "assignee":
        return (
          !completedStatusIds.has(task.status_id) &&
          (assigneeIdsByTask.get(task.id) ?? []).includes(filter.userId)
        );
    }
  }

  const listedTasks = useMemo(
    () => (listFilter ? tasks.filter((t) => matchesFilter(t, listFilter)) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [listFilter, tasks, completedStatusIds, today, assigneeIdsByTask],
  );

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;
  const selectedBoard = selectedTask ? boardById.get(selectedTask.board_id) : undefined;
  const selectedFieldDefs = selectedTask
    ? fieldDefsByBoard.get(selectedTask.board_id) ?? []
    : [];
  const selectedAssignableUsers = selectedTask
    ? selectedBoard?.institution_id
      ? users.filter((u) => u.institution_id === selectedBoard.institution_id)
      : users
    : [];
  const selectedAssigneeIds = selectedTask
    ? assigneeIdsByTask.get(selectedTask.id) ?? []
    : [];
  const selectedProjectIds = selectedTask
    ? projectIdsByTask.get(selectedTask.id) ?? []
    : [];

  function changeStatus(taskId: string, statusId: string) {
    setError(null);
    const boardId = tasks.find((t) => t.id === taskId)?.board_id ?? "";
    const fd = new FormData();
    fd.set("task_id", taskId);
    fd.set("board_id", boardId);
    fd.set("status_id", statusId);
    startTransition(async () => {
      try {
        await updateTaskStatus(fd);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "עדכון הסטטוס נכשל");
      }
    });
  }

  return (
    <div className="space-y-8">
      {error && (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="סה״כ משימות"
          value={tasks.length}
          onClick={() => setListFilter({ kind: "total", label: "כל המשימות" })}
        />
        <StatTile
          label="פתוחות"
          value={openTasks.length}
          onClick={() => setListFilter({ kind: "open", label: "משימות פתוחות" })}
        />
        <StatTile
          label="הושלמו"
          value={tasks.length - openTasks.length}
          onClick={() => setListFilter({ kind: "completed", label: "משימות שהושלמו" })}
        />
        <StatTile
          label="באיחור"
          value={overdueTasks.length}
          tone="critical"
          onClick={() => setListFilter({ kind: "overdue", label: "משימות באיחור" })}
        />
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">משימות לפי סטטוס</h2>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {countByStatus.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() =>
                  setListFilter({ kind: "status", statusId: s.id, label: `סטטוס: ${s.name}` })
                }
                className="w-full rounded border border-black/10 px-3 py-2 text-start text-sm hover:border-black/30"
              >
                <p className="text-black/60">{s.name}</p>
                <p className="text-lg font-semibold">{s.count}</p>
              </button>
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
                <li key={row.key}>
                  <button
                    type="button"
                    onClick={() =>
                      setListFilter({
                        kind: "institution",
                        key: row.key,
                        label: `מוסד: ${row.name}`,
                      })
                    }
                    className="flex w-full items-center justify-between px-3 py-2 text-start text-sm hover:bg-black/5"
                  >
                    <span>{row.name}</span>
                    <span className="font-medium">{row.count}</span>
                  </button>
                </li>
              ))
            ) : (
              <li className="px-3 py-3 text-sm text-black/40">אין משימות פתוחות.</li>
            )}
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-medium">עומס לפי אחראי (משימות פתוחות)</h2>
          <ul className="divide-y divide-black/5 rounded border border-black/10">
            {assigneeRows.length ? (
              assigneeRows.map((row) => (
                <li key={row.userId}>
                  <button
                    type="button"
                    onClick={() =>
                      setListFilter({
                        kind: "assignee",
                        userId: row.userId,
                        label: `אחראי: ${row.name}`,
                      })
                    }
                    className="flex w-full items-center justify-between px-3 py-2 text-start text-sm hover:bg-black/5"
                  >
                    <span>{row.name}</span>
                    <span className="font-medium">{row.count}</span>
                  </button>
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
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setSelectedTaskId(t.id)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-start text-sm hover:bg-black/5"
                >
                  <span>{t.title}</span>
                  <span className="text-xs text-red-600">
                    {t.institution_id
                      ? institutionNameById.get(t.institution_id) ?? "מוסד"
                      : "כלל-רשתי"}{" "}
                    · יעד: {t.due_date}
                  </span>
                </button>
              </li>
            ))
          ) : (
            <li className="px-3 py-3 text-sm text-black/40">אין משימות באיחור כרגע.</li>
          )}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">התקדמות פרויקטים</h2>
        {projectProgress.length ? (
          <ul className="space-y-3">
            {projectProgress.map((project) => (
              <li key={project.id} className="space-y-1 rounded border border-black/10 p-3">
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

      {listFilter && (
        <Modal onClose={() => setListFilter(null)} wide>
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-lg font-semibold">{listFilter.label}</h2>
              <button
                type="button"
                onClick={() => setListFilter(null)}
                className="text-black/40 hover:text-black"
                aria-label="סגירה"
              >
                ✕
              </button>
            </div>
            <ul className="max-h-[60vh] divide-y divide-black/5 overflow-y-auto rounded border border-black/10">
              {listedTasks.length ? (
                listedTasks.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedTaskId(t.id)}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-start text-sm hover:bg-black/5"
                    >
                      <span>{t.title}</span>
                      <span className="text-xs text-black/40">
                        {boardById.get(t.board_id)?.name ?? "board"} ·{" "}
                        {statuses.find((s) => s.id === t.status_id)?.name ?? "—"}
                        {t.due_date ? ` · ${t.due_date}` : ""}
                      </span>
                    </button>
                  </li>
                ))
              ) : (
                <li className="px-3 py-3 text-sm text-black/40">אין משימות תואמות.</li>
              )}
            </ul>
          </div>
        </Modal>
      )}

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          boardId={selectedTask.board_id}
          statuses={statuses}
          priorities={priorities}
          fieldDefs={selectedFieldDefs}
          assignableUsers={selectedAssignableUsers}
          assigneeIds={selectedAssigneeIds}
          assigneeNames={selectedAssigneeIds.map((id) => userNameById.get(id) ?? "משתמש")}
          projects={projects}
          projectIds={selectedProjectIds}
          canLinkProjects
          isPending={isPending}
          canEdit
          onClose={() => setSelectedTaskId(null)}
          onStatusChange={(statusId) => changeStatus(selectedTask.id, statusId)}
          onSave={(fd) => {
            setError(null);
            startTransition(async () => {
              try {
                await updateTask(fd);
                setSelectedTaskId(null);
                router.refresh();
              } catch (e) {
                setError(e instanceof Error ? e.message : "שמירת המשימה נכשלה");
              }
            });
          }}
        />
      )}
    </div>
  );
}

function StatTile({
  label,
  value,
  tone,
  onClick,
}: {
  label: string;
  value: number;
  tone?: "critical";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded border border-black/10 p-3 text-start hover:border-black/30"
    >
      <p className="text-xs text-black/50">{label}</p>
      <p
        className={`text-2xl font-semibold ${tone === "critical" && value > 0 ? "text-red-600" : ""}`}
      >
        {value}
      </p>
    </button>
  );
}
