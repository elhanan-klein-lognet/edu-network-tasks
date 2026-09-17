import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Exact /boards route: the layout already renders the boards list (right
 * pane); this page is only ever the *content* (left pane) for the default
 * case — nothing selected yet — so it just jumps to the first board. The
 * list itself is fetched again here (cheap, RLS-scoped) rather than passed
 * down, since layouts can't pass data to children (see layout.js docs).
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

  if (firstBoard) redirect(`/boards/${firstBoard.id}`);

  return (
    <div className="flex h-40 items-center justify-center rounded border border-dashed border-black/10 text-sm text-black/40">
      אין עדיין boards שאתה רואה.
    </div>
  );
}
