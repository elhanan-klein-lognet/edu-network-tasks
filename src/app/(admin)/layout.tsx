import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// All of section 3 (admin panel) is gated to super_admin only, for MVP
// simplicity — even though 3.4 leaves the door open to also letting
// network_admin create boards. Revisit if that turns out to matter.
const NAV = [
  { href: "/institutions", label: "מוסדות" },
  { href: "/settings", label: "הגדרות מערכת" },
  { href: "/boards", label: "Boards" },
  { href: "/users", label: "משתמשים" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "super_admin") {
    redirect("/");
  }

  return (
    <div className="flex flex-1">
      <aside className="w-56 shrink-0 border-e border-black/10 p-4">
        <nav className="flex flex-col gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded px-3 py-2 text-sm hover:bg-black/5"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <Link href="/" className="mt-6 block text-xs text-black/50">
          ← חזרה לדף הבית
        </Link>
      </aside>
      <main className="flex-1 overflow-x-auto p-6">{children}</main>
    </div>
  );
}
