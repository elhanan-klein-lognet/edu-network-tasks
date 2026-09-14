import { createClient } from "@/lib/supabase/server";
import { createInstitution, toggleInstitutionActive } from "./actions";

export default async function InstitutionsPage() {
  const supabase = await createClient();
  const { data: institutions } = await supabase
    .from("institutions")
    .select("id, name, is_active, created_at")
    .order("created_at", { ascending: true });

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold">ניהול מוסדות</h1>
        <p className="text-sm text-black/50">
          כל מוסד שנוסף כאן מקבל board משלו (סעיף 4 באפיון). השבתה שומרת
          היסטוריה — לא מוחקת.
        </p>
      </div>

      <form action={createInstitution} className="flex gap-2">
        <input
          name="name"
          required
          placeholder="שם מוסד חדש"
          className="flex-1 rounded border border-black/20 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded bg-black px-4 py-2 text-sm text-white"
        >
          הוספה
        </button>
      </form>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-black/10 text-start">
            <th className="py-2 font-medium">שם</th>
            <th className="py-2 font-medium">סטטוס</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {institutions?.length ? (
            institutions.map((inst) => (
              <tr key={inst.id} className="border-b border-black/5">
                <td className="py-2">{inst.name}</td>
                <td className="py-2">
                  {inst.is_active ? "פעיל" : "מושבת"}
                </td>
                <td className="py-2 text-end">
                  <form action={toggleInstitutionActive}>
                    <input type="hidden" name="id" value={inst.id} />
                    <input
                      type="hidden"
                      name="is_active"
                      value={String(inst.is_active)}
                    />
                    <button
                      type="submit"
                      className="text-xs text-black/60 underline"
                    >
                      {inst.is_active ? "השבתה" : "הפעלה"}
                    </button>
                  </form>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={3} className="py-4 text-black/40">
                אין עדיין מוסדות ברשת.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
