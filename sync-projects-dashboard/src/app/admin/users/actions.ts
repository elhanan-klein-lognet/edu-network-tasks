"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/supabase/database.types";

const SCOPED_ROLES: UserRole[] = ["institution_manager", "employee"];

/**
 * Invites a new user by email (section 3.2) — no self-service sign-up
 * exists, so this Auth Admin call (service-role key, bypasses RLS by
 * design) is the only way a user ever enters the system besides the
 * bootstrap super_admin. Because it bypasses RLS, THIS ACTION must check
 * "is the caller a super_admin" itself — nothing else will.
 */
export async function inviteUser(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const fullName = String(formData.get("full_name") || "").trim();
  const role = String(formData.get("role")) as UserRole;
  const institutionIdRaw = String(formData.get("institution_id") || "");
  const institutionId = institutionIdRaw || null;

  if (!email || !fullName || !role) {
    throw new Error("אימייל, שם מלא ותפקיד הם שדות חובה");
  }
  if (SCOPED_ROLES.includes(role) && !institutionId) {
    throw new Error("תפקיד זה מחייב שיוך למוסד");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("יש להתחבר מחדש");

  const { data: me } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();
  if (me?.role !== "super_admin") {
    throw new Error("רק מנהל-על יכול להזמין משתמשים חדשים");
  }

  const admin = createAdminClient();

  const { data: invited, error: inviteError } =
    await admin.auth.admin.inviteUserByEmail(email);
  if (inviteError) throw new Error(inviteError.message);

  // The bootstrap trigger (handle_new_auth_user) only auto-creates a
  // public.users row for the configured initial-admin email — every other
  // invited user's row is created here, with the role/institution the
  // admin actually chose (the trigger has no way to know that).
  const { error: insertError } = await admin.from("users").insert({
    id: invited.user.id,
    full_name: fullName,
    role,
    institution_id: SCOPED_ROLES.includes(role) ? institutionId : null,
  });
  if (insertError) {
    // Don't leave a half-invited auth user with no profile row behind —
    // it would block re-inviting the same email ("already registered").
    await admin.auth.admin.deleteUser(invited.user.id);
    throw new Error(insertError.message);
  }

  revalidatePath("/admin/users");
}

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
