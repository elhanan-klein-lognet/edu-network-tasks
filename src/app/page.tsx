import { createClient } from "@/lib/supabase/server";

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
        .select("full_name, role")
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
    </main>
  );
}
