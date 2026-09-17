"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Client-only piece of the footer: needs usePathname() to highlight
 * whichever link matches the page the user is currently on. Split out from
 * SiteFooter (a Server Component, so it can read the session/role) since a
 * Server Component can't use navigation hooks itself.
 */
function isActive(pathname: string, matchPrefix: string) {
  return pathname === matchPrefix || pathname.startsWith(`${matchPrefix}/`);
}

function NavLink({
  href,
  matchPrefix,
  pathname,
  children,
}: {
  href: string;
  matchPrefix: string;
  pathname: string;
  children: React.ReactNode;
}) {
  const active = isActive(pathname, matchPrefix);
  return (
    <Link
      href={href}
      className={
        active
          ? "rounded bg-black px-4 py-2 text-sm text-white"
          : "rounded border border-black/20 px-4 py-2 text-sm"
      }
    >
      {children}
    </Link>
  );
}

export function SiteFooterNav({
  canSeeDashboard,
  canSeeAdmin,
}: {
  canSeeDashboard: boolean;
  canSeeAdmin: boolean;
}) {
  const pathname = usePathname();

  return (
    <>
      <NavLink href="/boards" matchPrefix="/boards" pathname={pathname}>
        ה-Boards שלי
      </NavLink>
      {canSeeDashboard && (
        <NavLink href="/dashboard" matchPrefix="/dashboard" pathname={pathname}>
          דשבורד ניהולי
        </NavLink>
      )}
      {canSeeAdmin && (
        <NavLink href="/admin/institutions" matchPrefix="/admin" pathname={pathname}>
          ממשק ניהול
        </NavLink>
      )}
    </>
  );
}
