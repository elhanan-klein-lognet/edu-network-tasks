import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { addCustomField, deleteCustomField } from "../actions";

export default async function BoardDetailPage(
  props: PageProps<"/boards/[id]">,
) {
  const { id } = await props.params;
  const supabase = await createClient();

  const [{ data: board }, { data: fields }] = await Promise.all([
    supabase.from("boards").select("id, name").eq("id", id).single(),
    supabase
      .from("board_custom_field_definitions")
      .select("id, field_name, field_type, field_options")
      .eq("board_id", id)
      .order("display_order"),
  ]);

  if (!board) notFound();

  const fieldCount = fields?.length ?? 0;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold">{board.name}</h1>
        <p className="text-sm text-black/50">
          שדות מותאמים אישית — עד 3 לכל board (סעיף 4 באפיון). כרגע:{" "}
          {fieldCount}/3.
        </p>
      </div>

      <ul className="divide-y divide-black/5 rounded border border-black/10">
        {fields?.length ? (
          fields.map((f) => (
            <li
              key={f.id}
              className="flex items-center justify-between px-3 py-2 text-sm"
            >
              <span>
                {f.field_name}{" "}
                <span className="text-black/40">
                  ({FIELD_TYPE_LABELS[f.field_type]}
                  {f.field_options
                    ? `: ${(f.field_options as string[]).join(", ")}`
                    : ""}
                  )
                </span>
              </span>
              <form action={deleteCustomField}>
                <input type="hidden" name="id" value={f.id} />
                <input type="hidden" name="board_id" value={board.id} />
                <button type="submit" className="text-xs text-black/60 underline">
                  מחיקה
                </button>
              </form>
            </li>
          ))
        ) : (
          <li className="px-3 py-3 text-black/40">אין עדיין שדות מותאמים.</li>
        )}
      </ul>

      {fieldCount < 3 && (
        <form action={addCustomField} className="space-y-2 rounded border border-black/10 p-4">
          <input type="hidden" name="board_id" value={board.id} />
          <div className="flex gap-2">
            <input
              name="field_name"
              required
              placeholder="שם השדה"
              className="flex-1 rounded border border-black/20 px-3 py-2 text-sm"
            />
            <select
              name="field_type"
              className="rounded border border-black/20 px-3 py-2 text-sm"
              defaultValue="text"
            >
              <option value="text">טקסט</option>
              <option value="number">מספר</option>
              <option value="date">תאריך</option>
              <option value="select">רשימת בחירה</option>
            </select>
          </div>
          <input
            name="field_options"
            placeholder="אפשרויות בחירה, מופרדות בפסיקים (רלוונטי רק ל'רשימת בחירה')"
            className="w-full rounded border border-black/20 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded bg-black px-4 py-2 text-sm text-white"
          >
            הוספת שדה
          </button>
        </form>
      )}
    </div>
  );
}

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: "טקסט",
  number: "מספר",
  date: "תאריך",
  select: "רשימת בחירה",
};
