"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type BoardRow = { id: string; name: string; institution_id: string | null };

/**
 * The right-hand pane of the /boards screen (list of boards the user can
 * see). Client Component because it needs usePathname() to highlight the
 * currently-open board, and local state for the collapse toggle — a plain
 * server-rendered list can't do either.
 *
 * Collapsible so the board content (Kanban) on the left can use the full
 * screen width when the list itself isn't needed at the moment; state is
 * local (not persisted) since this is a POC and the list lives in a layout
 * that already stays mounted across in-app navigation between boards.
 */
export function BoardsListPane({ boards }: { boards: BoardRow[] }) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  if (collapsed) {
    return (
      <div className="flex-shrink-0">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          aria-label="פתיחת רשימת ה-Boards"
          title="פתיחת רשימת ה-Boards"
          className="rounded border border-black/10 px-2 py-2 text-sm text-black/50 hover:border-black/30"
        >
          «
        </button>
      </div>
    );
  }

  return (
    <div className="w-56 flex-shrink-0 space-y-2">
      <button
        type="button"
        onClick={() => setCollapsed(true)}
        aria-label="סגירת רשימת ה-Boards"
        title="סגירת רשימת ה-Boards"
        className="w-full rounded border border-black/10 px-2 py-1 text-sm text-black/50 hover:border-black/30"
      >
        »
      </button>

      <ul className="divide-y divide-black/5 rounded border border-black/10">
        {boards.length ? (
          boards.map((board) => {
            const href = `/boards/${board.id}`;
            const active = pathname === href;
            return (
              <li key={board.id}>
                <Link
                  href={href}
                  className={`block px-3 py-2 text-sm ${
                    active ? "bg-black font-medium text-white" : "hover:bg-black/5"
                  }`}
                >
                  {board.name}
                  {!board.institution_id && (
                    <span
                      className={`ms-2 text-xs ${active ? "text-white/60" : "text-black/40"}`}
                    >
                      (כלל-רשתי)
                    </span>
                  )}
                </Link>
              </li>
            );
          })
        ) : (
          <li className="px-3 py-3 text-sm text-black/40">
            אין עדיין boards שאתה רואה.
          </li>
        )}
      </ul>
    </div>
  );
}
