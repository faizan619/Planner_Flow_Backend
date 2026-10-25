import { C, Code, Lead, List, Note, Section, Table } from "../ui";

const USER = "Signed-in user";
const ADMIN = "Admin";
const ANYONE = "Anyone";

export default function Api() {
  return (
    <>
      <Lead>
        Every address under <C>/api/v1</C>. Signed-in calls send <C>Authorization: Bearer &lt;access token&gt;</C>. Bodies and
        answers are JSON unless noted.
      </Lead>

      <Section id="conventions" title="Conventions">
        <Table
          head={["Status", "Means"]}
          rows={[
            ["200 / 201 / 204", "OK / created / OK with no body"],
            ["400", "Invalid input (code VALIDATION_ERROR with fields, INVALID_JSON, INVALID_CODE…)"],
            ["401", "Not signed in, or the token expired (the app refreshes and retries once)"],
            ["403", "Signed in but not allowed (FORBIDDEN, ACCOUNT_DEACTIVATED, EMAIL_NOT_VERIFIED)"],
            ["404 / 409 / 410 / 413", "Not found / email already used / export link used or expired / file over 2 MB"],
            ["429", "Too many attempts; Retry-After says how many seconds to wait"],
          ]}
        />
        <Code>{`{ "error": { "code": "RATE_LIMITED", "message": "Too many attempts. Please wait and try again.", "retryAfter": 840 } }`}</Code>
      </Section>

      <Section id="auth" title="Accounts">
        <Table
          head={["Method and address", "Who", "Body → answer", "Limit"]}
          rows={[
            [<C key="1">POST /auth/signup</C>, ANYONE, "{ name, email, password, timezone? } → { email, verificationRequired }", "5 / hour per IP"],
            [<C key="2">POST /auth/verify-email</C>, ANYONE, "{ email, code } → { user, accessToken, refreshToken, accessTokenExpiresIn }", "30 / 15 min per IP, 10 per email"],
            [<C key="3">POST /auth/resend-code</C>, ANYONE, "{ email } → { message } (same answer whether or not the email exists)", "3 / 15 min per email"],
            [<C key="4">POST /auth/login</C>, ANYONE, "{ email, password } → { user, accessToken, refreshToken, … }", "20 / 15 min per IP, 5 per email"],
            [<C key="5">POST /auth/refresh</C>, ANYONE, "{ refreshToken } → new { user, accessToken, refreshToken }", "60 / min per IP"],
            [<C key="6">POST /auth/logout</C>, ANYONE, "{ refreshToken } → 204", ""],
            [<C key="7">POST /auth/forgot-password</C>, ANYONE, "{ email } → { message } (same answer always)", "3 / hour per email"],
            [<C key="8">POST /auth/reset-password</C>, ANYONE, "{ email, code, password } → { message }; signs out every device", "10 / hour per email"],
            [<C key="9">GET /me</C>, USER, "→ { user }", ""],
            [<C key="10">PATCH /me</C>, USER, "any of { name, timezone, weekStartDay (1–7), currency } → { user }", ""],
            [<C key="11">DELETE /me</C>, USER, "{ password } → 204; deletes the account and all its data", ""],
          ]}
        />
      </Section>

      <Section id="data" title="Planner data, inbox and files">
        <Table
          head={["Method and address", "Who", "Body → answer"]}
          rows={[
            [<C key="1">POST /sync</C>, USER, "{ cursor, changes: { habits, habitMarks, weeks, weeklyTasks, reminders, lessons, books, bookReadings, readingGoals } } → { cursor, hasMore, fullResync, changes, rejected } (max 500 records per type)"],
            [<C key="2">POST /books/import/preview</C>, USER, "multipart file (.xlsx / .csv, ≤ 2 MB) → { columns, rows: [{ row, ok, data, errors, warnings }], summary }; saves nothing"],
            [<C key="3">POST /export/link</C>, USER, "{ format: json | xlsx } → { url, expiresInMinutes } (10 / hour)"],
            [<C key="4">GET /export/download?token=</C>, "Link holder (once, 10 min)", "→ the file as an attachment; 410 if used or expired"],
            [<C key="5">POST /devices</C>, USER, "{ token, platform } → 204; registers the phone for push"],
            [<C key="6">DELETE /devices</C>, USER, "{ token } → 204; only your own token"],
            [<C key="7">GET /inbox</C>, USER, "→ { items: [{ id, title, body, createdAt, readAt }], unreadCount }"],
            [<C key="8">POST /inbox/:id/read</C>, USER, "→ 204; your own announcements only"],
            [<C key="9">POST /inbox/read-all</C>, USER, "→ 204"],
            [<C key="10">DELETE /inbox/:id</C>, USER, "→ 204; removes it from your inbox only"],
            [<C key="11">GET /health</C>, ANYONE, "→ { ok, db, now }; checks the database connection"],
          ]}
        />
      </Section>

      <Section id="admin" title="Admin">
        <Table
          head={["Method and address", "Who", "Body → answer"]}
          rows={[
            [<C key="1">GET /admin/stats</C>, ADMIN, "→ { stats: { total, active, deactivated, activeThisWeek, newThisWeek } }"],
            [<C key="2">GET /admin/users?q=</C>, ADMIN, "→ { users } (name / email search, newest first, max 500)"],
            [<C key="3">PATCH /admin/users/:id</C>, ADMIN, "{ status: active | deactivated } → 204 (not yourself)"],
            [<C key="4">GET /admin/announcements</C>, ADMIN, "→ { announcements } with recipients, readCount, pushed, skipped"],
            [<C key="5">POST /admin/announcements</C>, ADMIN, "{ title, body, audience: all | selected, userIds? } → { announcement }; push goes out afterwards"],
            [<C key="6">DELETE /admin/announcements/:id</C>, ADMIN, "→ 204; removes it from every inbox"],
            [<C key="7">GET /admin/logs</C>, ADMIN, "?category&event&userId&q&from&to&page → { logs, hasMore, page }"],
            [<C key="8">GET /admin/log-settings</C>, ADMIN, "→ { settings: { security, admin, usage, retentionDays } }"],
            [<C key="9">PATCH /admin/log-settings</C>, ADMIN, "{ security, admin, usage, retentionDays (7–365) } → { settings }"],
          ]}
        />
        <Note>
          <C>GET /api/cron/cleanup</C> (outside <C>/v1</C>) needs <C>Authorization: Bearer $CRON_SECRET</C>; Vercel Cron sends it.
        </Note>
      </Section>

      <Section id="try" title="Trying it by hand">
        <Code>{`# from the PC (PowerShell: use curl.exe)
curl http://localhost:3000/api/v1/health
curl -X POST http://localhost:3000/api/v1/auth/login -H "content-type: application/json" \\
     -d '{"email":"you@example.com","password":"…"}'`}</Code>
        <List>
          <li>The API tests (<C>tests/*.test.mjs</C>) are the most complete examples of every call.</li>
        </List>
      </Section>
    </>
  );
}
