"use client";

import { useState, useTransition } from "react";
import { toggleStatusCompleted, deleteStatus, reorderStatuses } from "./actions";

type Status = { id: string; name: string; is_completed: boolean };

/**
 * Drag a row up/down to change where that status sits in the workflow
 * order (section 3.3) — the same display_order the Kanban board and
 * dashboard read. Reordering calls the server action directly (not a
 * <form>), since it needs to send the whole reordered id list at once.
 */
export function StatusList({ statuses }: { statuses: Status[] }) {
  // No effect syncing `items` to the `statuses` prop: the parent remounts
  // this component (via a `key` built from the same data) whenever
  // add/delete/toggle changes it server-side, which resets `items` to the
  // fresh value for free.
  const [items, setItems] = useState(statuses);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDrop(targetId: string) {
    const sourceId = draggedId;
    setDraggedId(null);
    if (!sourceId || sourceId === targetId) return;

    const fromIndex = items.findIndex((s) => s.id === sourceId);
    const toIndex = items.findIndex((s) => s.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;

    const reordered = [...items];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    setItems(reordered);

    startTransition(async () => {
      await reorderStatuses(reordered.map((s) => s.id));
    });
  }

  return (
    <ul className="divide-y divide-black/5 rounded border border-black/10">
      {items.length ? (
        items.map((status) => (
          <li
            key={status.id}
            draggable
            onDragStart={() => setDraggedId(status.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(status.id)}
            onDragEnd={() => setDraggedId(null)}
            className={`flex cursor-move items-center justify-between gap-3 px-3 py-2 text-sm transition-opacity ${
              draggedId === status.id ? "opacity-40" : ""
            } ${isPending ? "opacity-70" : ""}`}
          >
            <span className="flex items-center gap-2">
              <span aria-hidden className="text-black/30">
                ⠿⠿
              </span>
              {status.name}
            </span>
            <div className="flex items-center gap-3">
              <form action={toggleStatusCompleted}>
                <input type="hidden" name="id" value={status.id} />
                <input
                  type="hidden"
                  name="is_completed"
                  value={String(status.is_completed)}
                />
                <button
                  type="submit"
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    status.is_completed
                      ? "bg-black text-white"
                      : "border border-black/20 text-black/50"
                  }`}
                >
                  נחשב כהושלם
                </button>
              </form>
              <form action={deleteStatus}>
                <input type="hidden" name="id" value={status.id} />
                <button type="submit" className="text-xs text-black/60 underline">
                  מחיקה
                </button>
              </form>
            </div>
          </li>
        ))
      ) : (
        <li className="px-3 py-3 text-sm text-black/40">אין ערכים עדיין.</li>
      )}
    </ul>
  );
}
