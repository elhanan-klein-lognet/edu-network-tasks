import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Supabase client for use in Server Components, Route Handlers and
 * Server Actions. `cookies()` is async in Next.js 16 — always await it.
 *
 * Note: called from a Server Component (not a Route Handler / Server
 * Action), `cookies().set()` will throw — that's expected and harmless,
 * because the proxy (see src/proxy.ts) is what actually refreshes the
 * session cookie on every request.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — safe to ignore, the
            // proxy handles refreshing the session cookie instead.
          }
        },
      },
    },
  );
}

/**
 * Admin client with the service-role key — bypasses RLS entirely.
 * Server-only (route handlers / server actions), NEVER import this from
 * anything that ships to the browser. Used for actions the admin panel
 * performs on the user's behalf that RLS cannot express by design, e.g.
 * inviting a new user via Supabase Auth (section 3.2 of the spec).
 */
export function createAdminClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {
          // no-op: the admin client never manages a user session
        },
      },
    },
  );
}
