import { createClient } from "@/lib/supabase/server";
import { BoardContent } from "./board-content";

/**
 * Exact /boards route: the layout renders the boards list (right pane); this
 * is only ever the *content* (left pane) for the default case — nothing
 * explicitly picked from the list yet — so it renders the first board's
 * content directly (by name order, same as the list). Rendering it inline
 * rather than redirecting to /boards/[id] means the default board shows up
 * on the very first request, with no second round trip.
 */
export default async function MyBoardsPage() {
  const supabase = await createClient();

  const { data: firstBoard } = await supabase
    .from("boards")
    .select("id")
    .eq("is_active", true)
    .order("name")
    .limit(1)
    .maybeSingle();

  if (!firstBoard) {
    return (
      <div className="flex h-40 items-center justify-center rounded border border-dashed border-black/10 text-sm text-black/40">
        אין עדיין boards שאתה רואה.
      </div>
    );
  }

  return <BoardContent boardId={firstBoard.id} />;
}
