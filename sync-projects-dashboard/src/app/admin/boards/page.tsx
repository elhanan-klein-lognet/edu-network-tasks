import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createBoard } from "./actions";

export default async function BoardsPage() {
  const supabase = await createClient();

  const [{ data: boards }, { data: allInstitutions }] = await Promise.all([
    supabase
      .from("boards")
      .select("id, name, is_active, institution_id")
      .order("created_at", { ascending: true }),
    // Fetched unfiltered so a board's institution name still resolves even
    // if that institution was since deactivated (section 3.1).
    supabase.from("institutions").select("id, name, is_active").order("name"),
  ]);

  const institutionNameById = new Map(
    (allInstitutions ?? []).map((inst) => [inst.id, inst.name]),
  );
  const institutions = (allInstitutions ?? []).filter((inst) => inst.is_active);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold">ניהול Boards</h1>
        <p className="text-sm text-black/50">
          כל מוסד מקבל board משלו; board בלי מוסד הוא board כלל-רשתי (סעיף
          4 באפיון).
        </p>
      </div>

      <form action={createBoard} className="space-y-2">
        <div className="flex gap-2">
          <input
            name="name"
            required
            placeholder="שם ה-board"
            className="flex-1 rounded border border-black/20 px-3 py-2 text-sm"
          />
          <select
            name="institution_id"
            className="rounded border border-black/20 px-3 py-2 text-sm"
            defaultValue=""
          >
            <option value="">כלל-רשתי (בלי מוסד)</option>
            {institutions?.map((inst) => (
              <option key={inst.id} value={inst.id}>
                {inst.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded bg-black px-4 py-2 text-sm text-white"
          >
            יצירה
          </button>
        </div>
      </form>

      <ul className="divide-y divide-black/5 rounded border border-black/10">
        {boards?.length ? (
          boards.map((board) => (
            <li key={board.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <span>
                <Link href={`/admin/boards/${board.id}`} className="hover:underline">
                  {board.name}
                </Link>
                <span className="ms-2 text-black/40">
                  {board.institution_id
                    ? (institutionNameById.get(board.institution_id) ?? "מוסד לא ידוע")
                    : "כלל-רשתי"}
                </span>
              </span>
              <Link href={`/boards/${board.id}`} className="text-xs text-black/50 underline">
                צפייה במשימות ←
              </Link>
            </li>
          ))
        ) : (
          <li className="px-3 py-3 text-black/40">אין עדיין boards.</li>
        )}
      </ul>
    </div>
  );
}
