import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/sign-out-button";
import { SiteFooterNav } from "@/components/site-footer-nav";

/**
 * Global nav/footer: the same link row that used to live only on the home
 * page (ה-Boards שלי / דשבורד ניהולי / כניסה לממשק הניהול / התנתקות), now
 * rendered on every screen via the root layout. Server Component so it can
 * read the session/role itself instead of every page having to pass props
 * down just to feed a footer.
 */
export async function SiteFooter() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  return (
    <footer className="mt-auto border-t border-black/10 px-4 py-3">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-center gap-3">
        <SiteFooterNav
          canSeeDashboard={["super_admin", "network_admin"].includes(profile.role)}
          canSeeAdmin={profile.role === "super_admin"}
        />
        <SignOutButton />
      </div>
    </footer>
  );
}
