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
export type Task = {
  id: string;
  title: string;
  description: string | null;
  status_id: string;
  priority_id: string;
  due_date: string | null;
  custom_fields: unknown;
};

export function TaskDetailModal({
  task,
  statuses,
  priorityName,
  fieldDefs,
  assignees,
  isPending,
  onClose,
  onStatusChange,
}: {
  task: Task;
  statuses: Status[];
  priorityName: string;
  fieldDefs: FieldDef[];
  assignees: string[];
  isPending: boolean;
  onClose: () => void;
  onStatusChange: (statusId: string) => void;
}) {
  const customFields =
    task.custom_fields && typeof task.custom_fields === "object"
      ? (task.custom_fields as Record<string, unknown>)
      : {};

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
          אחראים: {assignees.length ? assignees.join(", ") : "ללא"}
        </p>

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
            {statuses.map((s) => (
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
            {priorities.map((p) => (
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

        {fieldDefs.length > 0 && (
          <div className="space-y-2 border-t border-black/10 pt-3">
            <p className="text-xs text-black/50">
              שדות מותאמים אישית של ה-board:
            </p>
            {fieldDefs.map((def) => (
              <CustomFieldInput key={def.id} def={def} />
            ))}
          </div>
        )}

        {assignableUsers.length > 0 && (
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
        )}

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

function CustomFieldInput({ def }: { def: FieldDef }) {
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
          defaultValue=""
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
        className="ms-2 rounded border border-black/20 px-2 py-1"
      />
    </label>
  );
}
