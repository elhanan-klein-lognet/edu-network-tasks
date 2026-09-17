import type { Metadata } from "next";
import "./globals.css";
import { SiteFooter } from "@/components/site-footer";

// Deliberately not using next/font/google (Geist etc.): those fonts have
// limited/no Hebrew glyph coverage anyway, and self-hosting a Hebrew
// webfont is a nice-to-have, not a POC requirement. The system font stack
// below (see globals.css) renders Hebrew correctly on every platform with
// zero external font fetch — one less thing to break in CI/offline builds.

export const metadata: Metadata = {
  title: "ניהול משימות - רשת מוסדות חינוכיים",
  description: "מערכת ניהול משימות ופרויקטים לרשת מוסדות חינוכיים",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <div className="flex flex-1 flex-col">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
