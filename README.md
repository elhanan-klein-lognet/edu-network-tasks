# edu-network-tasks

מערכת ניהול משימות ופרויקטים לרשת מוסדות חינוכיים. POC על תשתית חינמית -
ראו [`spec.md`](./spec.md) למסמך האפיון המלא (גרסה 1.4).

## מצב נוכחי

שלד ראשוני: פרויקט Next.js מוגדר, חיבור Supabase (client/server), הפרדת
production/dev-test מתוכננת (עדיין לא מחוברת), migrations מלאות למבנה
הנתונים + RLS + Auth Hook, ומסך התחברות בסיסי. עדיין **לא** קיימים מסכי
ניהול (מוסדות/משתמשים/boards/הגדרות - סעיף 3 באפיון), מסך משימות, דשבורד
או התראות - אלה הצעד הבא.

## הקמה מאפס

### 1. פרויקטי Supabase

לפי סעיף 9 באפיון - **שני** פרויקטים נפרדים ב-[supabase.com](https://supabase.com):
אחד ל-production ואחד משותף ל-dev/test. עבור כל אחד מהם:

1. צרו פרויקט חדש, שמרו את סיסמת בסיס הנתונים במקום בטוח.
2. הריצו את כל הקבצים תחת `supabase/migrations/` לפי הסדר (או דרך
   Supabase CLI: `supabase link --project-ref <ref>` ואז `supabase db push`).
3. קבעו את כתובת המייל של מנהל-העל הראשוני (סעיף 3.5) - **לא** דרך
   `alter database ... set` (זה נכשל ב-SQL Editor של Supabase עם
   "permission denied", כי הוא לא רץ כ-superuser אמיתי), אלא דרך טבלת
   ההגדרות `app_config`:
   ```sql
   insert into public.app_config (key, value)
   values ('initial_admin_email', 'the-admin-email@example.com')
   on conflict (key) do update set value = excluded.value;
   ```
   שימו לב: זו הגדרה **לכל פרויקט Supabase בנפרד** - production ו-dev/test
   יכולים (ואולי כדאי שיהיו) עם ערך שונה.
4. **חובה - שלב שלא ניתן לבצע דרך SQL:** בדשבורד → Authentication → Hooks
   → "Customize Access Token (JWT) Claims hook" → בחרו
   `public.custom_access_token_hook`. בלי זה, ה-RLS לא יעבוד כי ה-JWT לא
   יכיל את `user_role`/`institution_id` (ראו סעיף 9 באפיון + הערות בקובץ
   `00000000000002_auth_hook_and_claim_helpers.sql`).
5. (מומלץ) בדשבורד → Authentication → Emails → SMTP Settings, הגדירו
   Custom SMTP עם Resend (ראו סעיף 2 למטה) - כדי שמיילי ההזמנה למשתמשים
   לא ייתקלו במגבלת הקצב של ה-SMTP המובנה.
6. **חובה להזמנת משתמשים (סעיף 3.2):**
   - בדשבורד → Authentication → URL Configuration: ודאו ש-**Site URL**
     מצביע על הכתובת שבה תבדקו (כתובת ה-Vercel deployment, או
     `http://localhost:3000` לבדיקה מקומית), ושה-**Redirect URLs** כוללת
     `<אותה כתובת>/auth/confirm` (או `<אותה כתובת>/**` באופן גורף).
   - בדשבורד → Authentication → Email Templates → **Invite user**:
     ה-template הדיפולטי מפנה לנקודת האימות המובנית של Supabase; צריך
     להחליף את קישור האישור כך שיצביע ישירות ל-route שלנו. מחליפים את
     `{{ .ConfirmationURL }}` ב-:
     ```
     {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite
     ```
     בלי זה, לחיצה על "הצטרפות" בהזמנה תיכשל (ראו
     `src/app/auth/confirm/route.ts`).

### 2. שירות מייל (Resend)

צרו חשבון ב-[resend.com](https://resend.com) (תוכנית חינמית), צרו API key.
לשלב ה-POC אפשר להתחיל עם דומיין הבדיקה שלהם, בלי לאמת דומיין משלכם.

### 3. משתני סביבה

העתיקו `.env.example` ל-`.env.local` ומלאו את הערכים מפרויקט ה-dev/test
של Supabase + Resend. **אל תשתפו `SUPABASE_SERVICE_ROLE_KEY` בשום מקום
מלבד משתני סביבה** (לא ב-git, לא בצ'אט) - הוא עוקף את כל ה-RLS.
`SUPABASE_SERVICE_ROLE_KEY` נמצא בדשבורד → Project Settings → API →
`service_role` `secret` (לא ה-`anon` `public` key). הוא נדרש להזמנת
משתמשים (סעיף 3.2) - בלעדיו כפתור "שליחת הזמנה" ייכשל. צריך להוסיף אותו
גם ל-`.env.local` וגם למשתני הסביבה ב-Vercel (סעיף 5 למטה).

### 4. הרצה מקומית

```bash
npm install
npm run dev
```

### 5. Vercel

חברו את הריפו הזה לפרויקט Vercel חדש. הגדירו את משתני הסביבה בנפרד לכל
Environment (Production / Preview) - ראו סעיף 9 באפיון. ה-Production
environment יצביע על פרויקט ה-Supabase של production, וה-Preview
environment על פרויקט ה-dev/test.

## מבנה הריפו

```
spec.md                     - מסמך האפיון (גרסה 1.4)
supabase/migrations/        - כל סכמת בסיס הנתונים, RLS, Auth Hook, triggers
src/app/                    - Next.js App Router
src/lib/supabase/           - Supabase clients (browser/server/admin) + types
src/proxy.ts                - רענון session (שם החדש ל-middleware.ts ב-Next 16)
```

## הערות טכניות חשובות

- **Next.js 16**: `middleware.ts` הוחלף ב-`proxy.ts` (`export function proxy`
  במקום `export function middleware`). קונבנציות אחרות (route handlers,
  server actions) לא השתנו מ-15.
- **RLS ללא רקורסיה**: policies קוראות `auth.jwt()` דרך
  `current_user_role()` / `current_user_institution_id()` - לא שאילתה
  חוזרת לטבלת `users`. ראייה מורכבת יותר (משימות ↔ אחראים ↔ פרויקטים)
  עוברת דרך פונקציות `SECURITY DEFINER` (`can_view_task`, `can_view_project`)
  שעוקפות RLS פנימית ונמנעות מלולאה בין הטבלאות. פירוט מלא בהערות בתוך
  `00000000000003_rls_policies.sql`.
- **`database.types.ts` נכתב ידנית** בהתאם למיגרציות, עד שהפרויקט יחובר
  לסביבת Supabase אמיתית - ואז יש להריץ `supabase gen types typescript`
  ולהחליף אותו (פעם אחת לכל אחד משני הפרויקטים, בכל שינוי סכמה).
