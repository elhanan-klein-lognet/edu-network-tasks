"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/supabase/database.types";

const SCOPED_ROLES: UserRole[] = ["institution_manager", "employee"];

/**
 * Single entry point for changing a user's role/institution — including
 * ownership transfer (section 3.6): promoting someone else to super_admin
 * and stepping yourself down are both just calls to this action. The one
 * thing it guards specially is demoting the LAST remaining super_admin,
 * which would lock the network out of its own admin panel.
 */
export async function updateUserRoleAndInstitution(formData: FormData) {
  const id = String(formData.get("id"));
  const role = String(formData.get("role")) as UserRole;
  const institutionIdRaw = String(formData.get("institution_id") || "");
  const institutionId = institutionIdRaw || null;

  if (SCOPED_ROLES.includes(role) && !institutionId) {
    throw new Error("תפקיד זה מחייב שיוך למוסד");
  }

  const supabase = await createClient();

  if (role !== "super_admin") {
    const { data: target } = await supabase
      .from("users")
      .select("role")
      .eq("id", id)
      .single();

    if (target?.role === "super_admin") {
      const { count } = await supabase
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("role", "super_admin")
        .eq("is_active", true);

      if ((count ?? 0) <= 1) {
        throw new Error(
          "לא ניתן להסיר את מנהל-העל האחרון הנותר — קודם קדם מישהו אחר למנהל-על (סעיף 3.6 באפיון).",
        );
      }
    }
  }

  const { error } = await supabase
    .from("users")
    .update({
      role,
      // super_admin / network_admin operate network-wide — clear any
      // leftover institution to satisfy the same DB constraint that
      // requires one for the two scoped roles.
      institution_id: SCOPED_ROLES.includes(role) ? institutionId : null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/users");
}

export async function toggleUserActive(formData: FormData) {
  const id = String(formData.get("id"));
  const isActive = formData.get("is_active") === "true";

  const supabase = await createClient();
  const { error } = await supabase
    .from("users")
    .update({ is_active: !isActive })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/users");
}
