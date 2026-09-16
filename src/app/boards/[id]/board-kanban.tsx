"use client";

import { useState, useTransition } from "react";
import { createTask, updateTaskStatus } from "./actions";
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
 * columns (drop = status update). Card click opens the full-detail popup;
 * "משימה חדשה" opens the create-task popup. Both popups call the server
 * actions directly (not as a <form action>) so we can close the popup and
 * surface errors once the action settles.
 */
export function BoardKanban({
  boardId,
  statuses,
  priorities,
  fieldDefs,
  tasks,
  assigneesByTask,
  priorityNameById,
  assignableUsers,
  canCreate,
}: {
  boardId: string;
  statuses: Status[];
  priorities: Priority[];
  fieldDefs: FieldDef[];
  tasks: Task[];
  assigneesByTask: Record<string, string[]>;
  priorityNameById: Record<string, string>;
  assignableUsers: AssignableUser[];
  canCreate: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showNewTask, setShowNewTask] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverStatusId, setDragOverStatusId] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

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
    <div className="space-y-4">
      {error && (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {canCreate && (
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

      <div className="flex gap-4 overflow-x-auto pb-2">
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
              className={`w-64 shrink-0 rounded border p-2 transition-colors ${
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
                      {assigneesByTask[task.id]?.length
                        ? assigneesByTask[task.id].join(", ")
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
          statuses={statuses}
          priorityName={priorityNameById[selectedTask.priority_id] ?? "—"}
          fieldDefs={fieldDefs}
          assignees={assigneesByTask[selectedTask.id] ?? []}
          isPending={isPending}
          onClose={() => setSelectedTaskId(null)}
          onStatusChange={(statusId) => changeStatus(selectedTask.id, statusId)}
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
