import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Runs on (almost) every request to keep the Supabase Auth session fresh
 * and redirect signed-out users away from the admin panel and app pages.
 *
 * This file used to be `middleware.ts` — Next.js 16 renamed the
 * convention to `proxy.ts` / `export function proxy`. Behavior and the
 * cookie-handling API are unchanged from the old middleware.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refreshes the session if expired. Required for Server Components,
  // which can't write cookies themselves (see src/lib/supabase/server.ts).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // /auth/* covers the invite/magic-link confirmation route (section 3.2)
  // — it must be reachable signed-out, since verifying the emailed link is
  // what SIGNS THE USER IN in the first place.
  const isAuthRoute =
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/auth");
  const isPublicAsset = request.nextUrl.pathname.startsWith("/_next");

  if (!user && !isAuthRoute && !isPublicAsset) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
