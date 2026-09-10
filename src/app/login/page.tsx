"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (error) {
      setError("אימייל או סיסמה שגויים");
      return;
    }

    router.replace("/");
    router.refresh();
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg border border-black/10 p-6"
      >
        <h1 className="text-lg font-semibold">התחברות למערכת ניהול המשימות</h1>

        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium">
            אימייל
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-black/20 px-3 py-2"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="text-sm font-medium">
            סיסמה
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-black/20 px-3 py-2"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-black py-2 text-white disabled:opacity-50"
        >
          {loading ? "מתחבר..." : "התחבר"}
        </button>

        <p className="text-xs text-black/60">
          אין הרשמה עצמאית - ההצטרפות למערכת מתבצעת רק דרך הזמנה ממנהל-על
          (סעיף 3.2 באפיון).
        </p>
      </form>
    </main>
  );
}
