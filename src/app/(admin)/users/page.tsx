import { createClient } from "@/lib/supabase/server";
import { updateUserRoleAndInstitution, toggleUserActive } from "./actions";

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "super_admin", label: "מנהל-על" },
  { value: "network_admin", label: "הנהלת רשת" },
  { value: "institution_manager", label: "מנהל מוסד" },
  { value: "employee", label: "עובד/חברת צוות" },
];

export default async function UsersPage() {
  const supabase = await createClient();

  const [{ data: users }, { data: institutions }] = await Promise.all([
    supabase
      .from("users")
      .select("id, full_name, role, institution_id, is_active")
      .order("created_at", { ascending: true }),
    supabase.from("institutions").select("id, name").eq("is_active", true).order("name"),
  ]);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold">ניהול משתמשים</h1>
        <p className="text-sm text-black/50">
          הזמנת משתמשים חדשים (סעיף 3.2) עדיין לא זמינה כאן — דורשת את
          מפתח ה-service_role שטרם חובר. שינוי תפקיד/מוסד ל-משתמשים
          קיימים, כולל העברת בעלות (סעיף 3.6), כבר עובד.
        </p>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-black/10 text-start">
            <th className="py-2 font-medium">שם</th>
            <th className="py-2 font-medium">תפקיד</th>
            <th className="py-2 font-medium">מוסד</th>
            <th className="py-2 font-medium">פעיל</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {users?.map((u) => (
            <tr key={u.id} className="border-b border-black/5">
              <td className="py-2">{u.full_name}</td>
              <td colSpan={3} className="py-2">
                <form
                  action={updateUserRoleAndInstitution}
                  className="flex flex-wrap items-center gap-2"
                >
                  <input type="hidden" name="id" value={u.id} />
                  <select
                    name="role"
                    defaultValue={u.role}
                    className="rounded border border-black/20 px-2 py-1"
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                  <select
                    name="institution_id"
                    defaultValue={u.institution_id ?? ""}
                    className="rounded border border-black/20 px-2 py-1"
                  >
                    <option value="">— ללא מוסד —</option>
                    {institutions?.map((inst) => (
                      <option key={inst.id} value={inst.id}>
                        {inst.name}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="rounded bg-black px-3 py-1 text-white">
                    שמירה
                  </button>
                </form>
              </td>
              <td className="py-2 text-end">
                <form action={toggleUserActive}>
                  <input type="hidden" name="id" value={u.id} />
                  <input type="hidden" name="is_active" value={String(u.is_active)} />
                  <button type="submit" className="text-xs text-black/60 underline">
                    {u.is_active ? "השבתה" : "הפעלה"}
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
