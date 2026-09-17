import { createClient } from "@/lib/supabase/server";
import {
  addStatus,
  deleteStatus,
  toggleStatusCompleted,
  addPriority,
  deletePriority,
} from "./actions";

export default async function SettingsPage() {
  const supabase = await createClient();

  const [{ data: statuses }, { data: priorities }] = await Promise.all([
    supabase
      .from("task_statuses")
      .select("id, name, is_completed")
      .order("display_order"),
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

      <section className="space-y-3">
        <div>
          <h2 className="font-medium">סטטוסים</h2>
          <p className="text-xs text-black/50">
            סמן &quot;נחשב כהושלם&quot; על סטטוס שאומר שהמשימה גמורה (למשל
            &quot;הושלם&quot; או &quot;בוטל&quot;) — זה מה שמחשב את אחוז
            ההתקדמות בפרויקטים (סעיף 6) ואת מספר המשימות שנותרו פתוחות
            בדשבורד (סעיף 7). אפשר לסמן יותר מסטטוס אחד ככה.
          </p>
        </div>

        <form action={addStatus} className="flex gap-2">
          <input
            name="name"
            required
            placeholder="לדוגמה: לביצוע"
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
          {statuses?.length ? (
            statuses.map((status) => (
              <li
                key={status.id}
                className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
              >
                <span>{status.name}</span>
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
                    <button
                      type="submit"
                      className="text-xs text-black/60 underline"
                    >
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
      </section>

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
