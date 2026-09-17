"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function nextDisplayOrder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: "task_statuses" | "task_priorities",
) {
  const { data } = await supabase
    .from(table)
    .select("display_order")
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.display_order ?? -1) + 1;
}

export async function addStatus(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  if (!name) return;

  const supabase = await createClient();
  const order = await nextDisplayOrder(supabase, "task_statuses");
  const { error } = await supabase
    .from("task_statuses")
    .insert({ name, display_order: order });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/settings");
}

export async function toggleStatusCompleted(formData: FormData) {
  const id = String(formData.get("id"));
  const isCompleted = formData.get("is_completed") === "true";

  const supabase = await createClient();
  const { error } = await supabase
    .from("task_statuses")
    .update({ is_completed: !isCompleted })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/settings");
}

export async function deleteStatus(formData: FormData) {
  const id = String(formData.get("id"));
  const supabase = await createClient();
  // FK on tasks.status_id (no ON DELETE clause = RESTRICT) blocks this if
  // any task still uses the status — surfaces as a thrown error here rather
  // than silently corrupting data.
  const { error } = await supabase.from("task_statuses").delete().eq("id", id);
  if (error) throw new Error("לא ניתן למחוק סטטוס שנמצא בשימוש במשימה קיימת");

  revalidatePath("/admin/settings");
}

export async function addPriority(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  if (!name) return;

  const supabase = await createClient();
  const order = await nextDisplayOrder(supabase, "task_priorities");
  const { error } = await supabase
    .from("task_priorities")
    .insert({ name, display_order: order });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/settings");
}

export async function deletePriority(formData: FormData) {
  const id = String(formData.get("id"));
  const supabase = await createClient();
  const { error } = await supabase.from("task_priorities").delete().eq("id", id);
  if (error) throw new Error("לא ניתן למחוק עדיפות שנמצאת בשימוש במשימה קיימת");

  revalidatePath("/admin/settings");
}
