import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function MyBoardsPage() {
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
    <div className="mx-auto w-full max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-lg font-semibold">ה-Boards שלי</h1>
        <Link href="/" className="text-xs text-black/50">
          ← חזרה לדף הבית
        </Link>
      </div>

      <ul className="divide-y divide-black/5 rounded border border-black/10">
        {boards?.length ? (
          boards.map((board) => (
            <li key={board.id} className="px-3 py-2 text-sm">
              <Link href={`/boards/${board.id}`} className="hover:underline">
                {board.name}
              </Link>
              {!board.institution_id && (
                <span className="ms-2 text-black/40">(כלל-רשתי)</span>
              )}
            </li>
          ))
        ) : (
          <li className="px-3 py-3 text-black/40">
            אין עדיין boards שאתה רואה.
          </li>
        )}
      </ul>
    </div>
  );
}
