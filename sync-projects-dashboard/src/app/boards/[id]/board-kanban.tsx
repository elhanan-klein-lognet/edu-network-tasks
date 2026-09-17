"use client";

import { useMemo, useState, useTransition } from "react";
import { createTask, updateTask, updateTaskStatus } from "./actions";
import {
  TaskDetailModal,
  NewTaskModal,
  type Status,
  type Priority,
  type FieldDef,
  type AssignableUser,
  type Task,
} from "./task-modals";

/**
 * Kanban board: one column per status, task cards draggable between
 * columns (drop = status update). Card click opens the full-detail popup
 * (editable for roles that can also create tasks); "משימה חדשה" opens the
 * create-task popup. Both popups call the server actions directly (not as
 * a <form action>) so we can close the popup and surface errors once the
 * action settles.
 */
export function BoardKanban({
  boardId,
  statuses,
  priorities,
  fieldDefs,
  tasks,
  assigneeIdsByTask,
  assignableUsers,
  canManage,
}: {
  boardId: string;
  statuses: Status[];
  priorities: Priority[];
  fieldDefs: FieldDef[];
  tasks: Task[];
  assigneeIdsByTask: Record<string, string[]>;
  assignableUsers: AssignableUser[];
  canManage: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showNewTask, setShowNewTask] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverStatusId, setDragOverStatusId] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const nameById = useMemo(
    () => Object.fromEntries(assignableUsers.map((u) => [u.id, u.full_name])),
    [assignableUsers],
  );
  const namesForTask = (taskId: string) =>
    (assigneeIdsByTask[taskId] ?? []).map((id) => nameById[id] ?? "משתמש");

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;

  function changeStatus(taskId: string, statusId: string) {
    setError(null);
    const fd = new FormData();
    fd.set("task_id", taskId);
    fd.set("board_id", boardId);
    fd.set("status_id", statusId);
    startTransition(async () => {
      try {
        await updateTaskStatus(fd);
      } catch (e) {
        setError(e instanceof Error ? e.message : "עדכון הסטטוס נכשל");
      }
    });
  }

  function handleDrop(statusId: string) {
    setDragOverStatusId(null);
    const taskId = draggedTaskId;
    setDraggedTaskId(null);
    if (!taskId) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status_id === statusId) return;
    changeStatus(task.id, statusId);
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {canManage && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowNewTask(true)}
            className="rounded bg-black px-4 py-2 text-sm text-white"
          >
            + משימה חדשה
          </button>
        </div>
      )}

      <div className="flex w-full gap-3 overflow-x-auto pb-2">
        {statuses.map((status) => {
          const columnTasks = tasks.filter((t) => t.status_id === status.id);
          const isDragOver = dragOverStatusId === status.id;
          return (
            <div
              key={status.id}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverStatusId(status.id);
              }}
              onDragLeave={() =>
                setDragOverStatusId((cur) => (cur === status.id ? null : cur))
              }
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(status.id);
              }}
              className={`min-w-[220px] flex-1 rounded border p-2 transition-colors ${
                isDragOver ? "border-black bg-black/5" : "border-black/10"
              }`}
            >
              <h2 className="mb-2 px-1 text-sm font-medium text-black/60">
                {status.name} ({columnTasks.length})
              </h2>
              <div className="space-y-2">
                {columnTasks.map((task) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={() => setDraggedTaskId(task.id)}
                    onDragEnd={() => setDraggedTaskId(null)}
                    onClick={() => setSelectedTaskId(task.id)}
                    className={`cursor-pointer space-y-1 rounded border border-black/10 bg-white p-2 text-sm shadow-sm hover:border-black/30 ${
                      draggedTaskId === task.id ? "opacity-40" : ""
                    }`}
                  >
                    <p className="font-medium">{task.title}</p>
                    <p className="text-xs text-black/50">
                      {namesForTask(task.id).length
                        ? namesForTask(task.id).join(", ")
                        : "ללא אחראי"}
                    </p>
                    {task.due_date && (
                      <p className="text-xs text-black/40">{task.due_date}</p>
                    )}
                  </div>
                ))}
                {!columnTasks.length && (
                  <p className="px-1 py-2 text-xs text-black/30">
                    אין משימות
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          boardId={boardId}
          statuses={statuses}
          priorities={priorities}
          fieldDefs={fieldDefs}
          assignableUsers={assignableUsers}
          assigneeIds={assigneeIdsByTask[selectedTask.id] ?? []}
          assigneeNames={namesForTask(selectedTask.id)}
          isPending={isPending}
          canEdit={canManage}
          onClose={() => setSelectedTaskId(null)}
          onStatusChange={(statusId) => changeStatus(selectedTask.id, statusId)}
          onSave={(fd) => {
            setError(null);
            startTransition(async () => {
              try {
                await updateTask(fd);
                setSelectedTaskId(null);
              } catch (e) {
                setError(e instanceof Error ? e.message : "שמירת המשימה נכשלה");
              }
            });
          }}
        />
      )}

      {showNewTask && (
        <NewTaskModal
          boardId={boardId}
          statuses={statuses}
          priorities={priorities}
          fieldDefs={fieldDefs}
          assignableUsers={assignableUsers}
          onClose={() => setShowNewTask(false)}
          onSubmit={(fd) => {
            setError(null);
            startTransition(async () => {
              try {
                await createTask(fd);
                setShowNewTask(false);
              } catch (e) {
                setError(e instanceof Error ? e.message : "יצירת המשימה נכשלה");
              }
            });
          }}
        />
      )}
    </div>
  );
}
