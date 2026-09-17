import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/sign-out-button";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "מנהל-על",
  network_admin: "הנהלת רשת",
  institution_manager: "מנהל מוסד",
  employee: "עובד/חברת צוות",
};

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase
        .from("users")
        .select("full_name, role, institution_id")
        .eq("id", user.id)
        .single()
    : { data: null };

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold">
        ברוך הבא{profile?.full_name ? `, ${profile.full_name}` : ""}
      </h1>
      {profile && (
        <p className="text-black/60">
          תפקיד: {ROLE_LABELS[profile.role] ?? profile.role}
        </p>
      )}
      <div className="flex gap-3">
        {profile && (
          <Link
            href="/boards"
            className="rounded bg-black px-4 py-2 text-sm text-white"
          >
            ה-Boards שלי
          </Link>
        )}
        {profile?.role && ["super_admin", "network_admin"].includes(profile.role) && (
          <Link
            href="/dashboard"
            className="rounded border border-black/20 px-4 py-2 text-sm"
          >
            דשבורד ניהולי
          </Link>
        )}
        {profile?.role === "super_admin" && (
          <Link
            href="/admin/institutions"
            className="rounded border border-black/20 px-4 py-2 text-sm"
          >
            כניסה לממשק הניהול
          </Link>
        )}
      </div>
      <SignOutButton />
    </main>
  );
}
