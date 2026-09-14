import { createClient } from "@/lib/supabase/server";

/**
 * Temporary diagnostic page — NOT part of the spec. Shows exactly what's in
 * the current request's JWT, to debug why current_user_role() isn't
 * returning 'super_admin' as expected. Delete this whole route once the
 * auth-hook issue (institutions RLS insert failing) is resolved.
 */
export default async function DebugPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: claims, error: claimsError } = await supabase.rpc(
    "debug_current_claims",
  );

  const { data: profile, error: profileError } = user
    ? await supabase.from("users").select("*").eq("id", user.id).single()
    : { data: null, error: null };

  return (
    <main className="flex-1 space-y-4 p-6 text-start" dir="ltr">
      <h1 className="text-lg font-semibold">Debug</h1>

      <section>
        <h2 className="font-medium">auth.getUser()</h2>
        <pre className="overflow-auto rounded bg-black/5 p-3 text-xs">
          {JSON.stringify({ id: user?.id, email: user?.email }, null, 2)}
        </pre>
      </section>

      <section>
        <h2 className="font-medium">auth.jwt() claims (via RPC)</h2>
        <pre className="overflow-auto rounded bg-black/5 p-3 text-xs">
          {claimsError
            ? `ERROR: ${claimsError.message}`
            : JSON.stringify(claims, null, 2)}
        </pre>
      </section>

      <section>
        <h2 className="font-medium">public.users row (via RLS)</h2>
        <pre className="overflow-auto rounded bg-black/5 p-3 text-xs">
          {profileError
            ? `ERROR: ${profileError.message}`
            : JSON.stringify(profile, null, 2)}
        </pre>
      </section>
    </main>
  );
}
