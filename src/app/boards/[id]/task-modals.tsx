"use client";

import { Modal } from "@/components/modal";

export type Status = { id: string; name: string };
export type Priority = { id: string; name: string };
export type FieldDef = {
  id: string;
  field_name: string;
  field_type: string;
  field_options: unknown;
};
export type AssignableUser = { id: string; full_name: string };
export type Project = { id: string; name: string };
export type Task = {
  id: string;
  title: string;
  description: string | null;
  status_id: string;
  priority_id: string;
  due_date: string | null;
  custom_fields: unknown;
};

function CustomFieldInput({
  def,
  defaultValue,
}: {
  def: FieldDef;
  defaultValue?: unknown;
}) {
  const name = `custom_field__${def.id}`;

  if (def.field_type === "select") {
    const options = Array.isArray(def.field_options)
      ? (def.field_options as string[])
      : [];
    return (
      <label className="block text-sm">
        {def.field_name}
        <select
          name={name}
          defaultValue={typeof defaultValue === "string" ? defaultValue : ""}
          className="ms-2 rounded border border-black/20 px-2 py-1"
        >
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

  const inputType =
    def.field_type === "number"
      ? "number"
      : def.field_type === "date"
        ? "date"
        : "text";

  return (
    <label className="block text-sm">
      {def.field_name}
      <input
        type={inputType}
        name={name}
        defaultValue={defaultValue != null ? String(defaultValue) : ""}
        className="ms-2 rounded border border-black/20 px-2 py-1"
      />
    </label>
  );
}

/**
 * The field set shared by "new task" and "edit task" — everything except
 * the hidden ids and the submit button, which differ between the two.
 */
function TaskFormFields({
  statuses,
  priorities,
  fieldDefs,
  assignableUsers,
  defaults,
}: {
  statuses: Status[];
  priorities: Priority[];
  fieldDefs: FieldDef[];
  assignableUsers: AssignableUser[];
  defaults?: {
    title: string;
    description: string;
    status_id: string;
    priority_id: string;
    due_date: string;
    custom_fields: Record<string, unknown>;
    assignee_ids: string[];
  };
}) {
  return (
    <>
      <input
        name="title"
        required
        defaultValue={defaults?.title}
        placeholder="כותרת"
        className="w-full rounded border border-black/20 px-3 py-2 text-sm"
      />
      <textarea
        name="description"
        defaultValue={defaults?.description}
        placeholder="תיאור (לא חובה)"
        rows={3}
        className="w-full rounded border border-black/20 px-3 py-2 text-sm"
      />

      <div className="flex flex-wrap gap-2">
        <select
          name="status_id"
          required
          defaultValue={defaults?.status_id ?? ""}
          className="rounded border border-black/20 px-2 py-2 text-sm"
        >
          <option value="" disabled>
            סטטוס
          </option>
          {statuses.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          name="priority_id"
          required
          defaultValue={defaults?.priority_id ?? ""}
          className="rounded border border-black/20 px-2 py-2 text-sm"
        >
          <option value="" disabled>
            עדיפות
          </option>
          {priorities.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          name="due_date"
          defaultValue={defaults?.due_date ?? ""}
          className="rounded border border-black/20 px-2 py-2 text-sm"
        />
      </div>

      {fieldDefs.length > 0 && (
        <div className="space-y-2 border-t border-black/10 pt-3">
          <p className="text-xs text-black/50">
            שדות מותאמים אישית של ה-board:
          </p>
          {fieldDefs.map((def) => (
            <CustomFieldInput
              key={def.id}
              def={def}
              defaultValue={defaults?.custom_fields[def.id]}
            />
          ))}
        </div>
      )}

      {assignableUsers.length > 0 ? (
        <div className="space-y-1 border-t border-black/10 pt-3">
          <label className="block text-xs text-black/50" htmlFor="assignee_ids">
            אחראים (אפשר לבחור כמה — Ctrl/Cmd+קליק, או גרירה):
          </label>
          <select
            id="assignee_ids"
            name="assignee_ids"
            multiple
            size={Math.min(6, Math.max(3, assignableUsers.length))}
            defaultValue={defaults?.assignee_ids ?? []}
            className="w-full rounded border border-black/20 px-2 py-1 text-sm"
          >
            {assignableUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <p className="border-t border-black/10 pt-3 text-xs text-black/40">
          אין עדיין אף משתמש פעיל שאפשר לשייך כאחראי במוסד/board הזה — הוסף
          משתמשים דרך ממשק הניהול.
        </p>
      )}
    </>
  );
}

export function NewTaskModal({
  boardId,
  statuses,
  priorities,
  fieldDefs,
  assignableUsers,
  onClose,
  onSubmit,
}: {
  boardId: string;
  statuses: Status[];
  priorities: Priority[];
  fieldDefs: FieldDef[];
  assignableUsers: AssignableUser[];
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
}) {
  return (
    <Modal onClose={onClose} wide>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(new FormData(e.currentTarget));
        }}
        className="space-y-3"
      >
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-semibold">משימה חדשה</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-black/40 hover:text-black"
            aria-label="סגירה"
          >
            ✕
          </button>
        </div>

        <input type="hidden" name="board_id" value={boardId} />

        <TaskFormFields
          statuses={statuses}
          priorities={priorities}
          fieldDefs={fieldDefs}
          assignableUsers={assignableUsers}
        />

        <button
          type="submit"
          className="rounded bg-black px-4 py-2 text-sm text-white"
        >
          יצירת משימה
        </button>
      </form>
    </Modal>
  );
}

export function TaskDetailModal({
  task,
  boardId,
  statuses,
  priorities,
  fieldDefs,
  assignableUsers,
  assigneeIds,
  assigneeNames,
  projects,
  projectIds,
  canLinkProjects,
  isPending,
  canEdit,
  onClose,
  onStatusChange,
  onSave,
}: {
  task: Task;
  boardId: string;
  statuses: Status[];
  priorities: Priority[];
  fieldDefs: FieldDef[];
  assignableUsers: AssignableUser[];
  assigneeIds: string[];
  assigneeNames: string[];
  projects: Project[];
  projectIds: string[];
  canLinkProjects: boolean;
  isPending: boolean;
  canEdit: boolean;
  onClose: () => void;
  onStatusChange: (statusId: string) => void;
  onSave: (formData: FormData) => void;
}) {
  const customFields =
    task.custom_fields && typeof task.custom_fields === "object"
      ? (task.custom_fields as Record<string, unknown>)
      : {};

  if (!canEdit) {
    const priorityName =
      priorities.find((p) => p.id === task.priority_id)?.name ?? "—";
    return (
      <Modal onClose={onClose} wide>
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-lg font-semibold">{task.title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-black/40 hover:text-black"
              aria-label="סגירה"
            >
              ✕
            </button>
          </div>

          {task.description && (
            <p className="whitespace-pre-wrap text-sm text-black/70">
              {task.description}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label className="text-black/50">סטטוס:</label>
            <select
              value={task.status_id}
              disabled={isPending}
              onChange={(e) => onStatusChange(e.target.value)}
              className="rounded border border-black/20 px-2 py-1"
            >
              {statuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <p className="text-sm text-black/60">עדיפות: {priorityName}</p>
          {task.due_date && (
            <p className="text-sm text-black/60">תאריך יעד: {task.due_date}</p>
          )}
          <p className="text-sm text-black/60">
            אחראים: {assigneeNames.length ? assigneeNames.join(", ") : "ללא"}
          </p>
          {projectIds.length > 0 && (
            <p className="text-sm text-black/60">
              פרויקטים:{" "}
              {projectIds
                .map((id) => projects.find((p) => p.id === id)?.name ?? "—")
                .join(", ")}
            </p>
          )}

          {fieldDefs.length > 0 && (
            <div className="space-y-1 border-t border-black/10 pt-3 text-sm">
              {fieldDefs.map((def) => (
                <p key={def.id} className="text-black/60">
                  {def.field_name}: {String(customFields[def.id] ?? "—")}
                </p>
              ))}
            </div>
          )}
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose} wide>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(new FormData(e.currentTarget));
        }}
        className="space-y-3"
      >
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-semibold">עריכת משימה</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-black/40 hover:text-black"
            aria-label="סגירה"
          >
            ✕
          </button>
        </div>

        <input type="hidden" name="task_id" value={task.id} />
        <input type="hidden" name="board_id" value={boardId} />

        <TaskFormFields
          statuses={statuses}
          priorities={priorities}
          fieldDefs={fieldDefs}
          assignableUsers={assignableUsers}
          defaults={{
            title: task.title,
            description: task.description ?? "",
            status_id: task.status_id,
            priority_id: task.priority_id,
            due_date: task.due_date ?? "",
            custom_fields: customFields,
            assignee_ids: assigneeIds,
          }}
        />

        {canLinkProjects && projects.length > 0 && (
          <div className="space-y-1 border-t border-black/10 pt-3">
            <input type="hidden" name="has_project_field" value="1" />
            <label className="block text-xs text-black/50" htmlFor="project_ids">
              פרויקטים (סעיף 6 — אפשר לבחור כמה, Ctrl/Cmd+קליק או גרירה):
            </label>
            <select
              id="project_ids"
              name="project_ids"
              multiple
              size={Math.min(5, Math.max(2, projects.length))}
              defaultValue={projectIds}
              className="w-full rounded border border-black/20 px-2 py-1 text-sm"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          שמירה
        </button>
      </form>
    </Modal>
  );
}
