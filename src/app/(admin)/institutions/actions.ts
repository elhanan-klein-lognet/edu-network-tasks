"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createInstitution(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  if (!name) return;

  const supabase = await createClient();
  // RLS (institutions_write) allows this only for super_admin — enforced
  // by the database regardless of what the UI shows.
  const { error } = await supabase.from("institutions").insert({ name });
  if (error) throw new Error(error.message);

  revalidatePath("/institutions");
}

export async function toggleInstitutionActive(formData: FormData) {
  const id = String(formData.get("id"));
  const isActive = formData.get("is_active") === "true";

  const supabase = await createClient();
  const { error } = await supabase
    .from("institutions")
    .update({ is_active: !isActive })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/institutions");
}
