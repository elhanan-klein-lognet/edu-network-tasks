import { createClient } from "@/lib/supabase/server";
import { addStatus, deleteStatus, addPriority, deletePriority } from "./actions";

export default async function SettingsPage() {
  const supabase = await createClient();

  const [{ data: statuses }, { data: priorities }] = await Promise.all([
    supabase.from("task_statuses").select("id, name").order("display_order"),
    supabase.from("task_priorities").select("id, name").order("display_order"),
  ]);

  return (
    <div className="max-w-2xl space-y-10">
      <div>
        <h1 className="text-lg font-semibold">הגדרות מערכת</h1>
        <p className="text-sm text-black/50">
          רשימות אלה משותפות לכל הרשת (סעיף 3.3 באפיון) — לא קבועות בקוד,
          וכל שינוי כאן משפיע מיד על כל ה-boards.
        </p>
      </div>

      <SettingsList
        title="סטטוסים"
        items={statuses ?? []}
        addAction={addStatus}
        deleteAction={deleteStatus}
        placeholder="לדוגמה: לביצוע"
      />

      <SettingsList
        title="עדיפויות"
        items={priorities ?? []}
        addAction={addPriority}
        deleteAction={deletePriority}
        placeholder="לדוגמה: גבוהה"
      />
    </div>
  );
}

function SettingsList({
  title,
  items,
  addAction,
  deleteAction,
  placeholder,
}: {
  title: string;
  items: { id: string; name: string }[];
  addAction: (formData: FormData) => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
  placeholder: string;
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-medium">{title}</h2>

      <form action={addAction} className="flex gap-2">
        <input
          name="name"
          required
          placeholder={placeholder}
          className="flex-1 rounded border border-black/20 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded bg-black px-4 py-2 text-sm text-white"
        >
          הוספה
        </button>
      </form>

      <ul className="divide-y divide-black/5 rounded border border-black/10">
        {items.length ? (
          items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between px-3 py-2 text-sm"
            >
              {item.name}
              <form action={deleteAction}>
                <input type="hidden" name="id" value={item.id} />
                <button type="submit" className="text-xs text-black/60 underline">
                  מחיקה
                </button>
              </form>
            </li>
          ))
        ) : (
          <li className="px-3 py-3 text-sm text-black/40">אין ערכים עדיין.</li>
        )}
      </ul>
    </section>
  );
}
