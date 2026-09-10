"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { CustomFieldType } from "@/lib/supabase/database.types";

export async function createBoard(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const institutionId = String(formData.get("institution_id") || "");
  if (!name) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("boards").insert({
    name,
    // Empty selection = network-wide board (institution_id NULL) — section 4.
    institution_id: institutionId || null,
    created_by: user?.id ?? null,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/boards");
}

export async function addCustomField(formData: FormData) {
  const boardId = String(formData.get("board_id"));
  const fieldName = String(formData.get("field_name") || "").trim();
  const fieldType = String(formData.get("field_type")) as CustomFieldType;
  const optionsRaw = String(formData.get("field_options") || "").trim();

  if (!fieldName || !boardId) return;

  // "select" fields take comma-separated options in the form, stored as a
  // JSON array — everything else ignores this field.
  const fieldOptions =
    fieldType === "select" && optionsRaw
      ? optionsRaw.split(",").map((s) => s.trim()).filter(Boolean)
      : null;

  const supabase = await createClient();
  const { error } = await supabase.from("board_custom_field_definitions").insert({
    board_id: boardId,
    field_name: fieldName,
    field_type: fieldType,
    field_options: fieldOptions,
  });
  // Most common failure here: the trg_enforce_max_custom_fields trigger
  // (max 3 per board, section 4) — surfaced to the admin as-is.
  if (error) throw new Error(error.message);

  revalidatePath(`/boards/${boardId}`);
}

export async function deleteCustomField(formData: FormData) {
  const id = String(formData.get("id"));
  const boardId = String(formData.get("board_id"));

  const supabase = await createClient();
  const { error } = await supabase
    .from("board_custom_field_definitions")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath(`/boards/${boardId}`);
}
