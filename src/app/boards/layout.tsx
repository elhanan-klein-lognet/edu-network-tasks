import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BoardsListPane } from "./boards-list-pane";

/**
 * Shared shell for /boards and /boards/[id]: a list of the user's boards on
 * one side (right, in our RTL layout — it's the first flex child) and the
 * selected board's content on the other (left — {children}, i.e. whatever
 * boards/page.tsx or boards/[id]/page.tsx renders). This is what makes
 * switching boards feel like picking from a persistent list instead of
 * navigating to a whole new page: the list here stays mounted, only the
 * content pane changes, across /boards/[id] navigations.
 */
export default async function BoardsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS (boards_select) already scopes this to exactly what the signed-in
  // user is allowed to see — network-wide boards, their own institution's
  // board, or everything for super_admin/network_admin (section 2).
  const { data: boards } = await supabase
    .from("boards")
    .select("id, name, institution_id")
    .eq("is_active", true)
    .order("name");

  return (
    <div className="w-full space-y-4 px-4 py-4">
      <div>
        <h1 className="text-lg font-semibold">ה-Boards שלי</h1>
        <Link href="/" className="text-xs text-black/50">
          ← חזרה לדף הבית
        </Link>
      </div>

      <div className="flex w-full items-start gap-4">
        <BoardsListPane boards={boards ?? []} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
