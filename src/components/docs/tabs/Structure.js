import { C, Code, Lead, Note, Section } from "../ui";

export default function Structure() {
  return (
    <>
      <Lead>Where things live. Each file does one job; the comment at the top of every file says which.</Lead>

      <Section id="backend" title="Server: planner_flow_backend">
        <Code>{`database/schema.sql          all tables; every statement can safely run again
scripts/setup-db.mjs         npm run db:setup
scripts/make-admin.mjs       npm run make-admin -- email
vercel.json                  the daily cleanup schedule (Vercel Cron)
src/
  instrumentation.js         applies schema.sql when the dev server starts
  proxy.js                   signed-out visitors of /admin → /admin/login
  app/
    page.js                  home page
    api/v1/…/route.js        the JSON API (one folder per address)
    api/cron/cleanup/        daily housekeeping
    admin/login/             admin sign-in (PasswordField has Show/Hide)
    admin/(panel)/           Overview, users, announcements, logs, settings, docs
    admin/actions.js         Server Actions of the panel (each re-checks admin)
    admin/ui.js, logLabels.js  shared panel pieces, readable log names
  components/docs/           these docs (ui.js + one file per tab)
  server/                    everything that touches data (server-only)
    db/index.js              connection pool, query / queryOne / transaction
    http.js                  route() wrapper, readJson (zod), error format, IP
    validation.js            zod schemas for auth and profile
    auth/                    password.js (argon2) · tokens.js (JWT + refresh)
                             codes.js (email codes) · session.js (requireUser)
                             webSession.js (admin panel cookie)
    users.js                 find / create / update users
    sync.js                  offline sync: record types, rules, paging
    crypto.js                AES-256-GCM for journal text
    dates.js                 "today" in a time zone, day arithmetic
    books.js · bookImport.js reading rules · Excel/CSV import preview
    export.js                export links, JSON and Excel files
    announcements.js · push.js  inbox, announcements, Firebase push
    admin.js                 user list, (de)activate, stats, last active
    logs.js · settings.js    activity logs · app-wide settings (log switches)
    maintenance.js           cleanup (old logs, expired tokens…)
    rateLimit.js · mail.js · migrate.js
tests/                       API tests (node:test) + helpers/server.mjs`}</Code>
      </Section>

      <Section id="app" title="App: Planner_Flow">
        <Code>{`app.json · eas.json         app name, icons, plugins · build profiles
credentials.json             keystore password (git-ignored)
google-services.json         Firebase app config (public ids)
assets/                      icon, adaptive icon layers, splash, favicon
src/
  app/                       screens (Expo Router: every file is a screen)
    _layout.js               theme, sign-in guard (signed in → app, else sign-in)
    (auth)/                  login, signup, verify, forgot, reset
    (app)/_layout.js         DataProvider → NotificationsProvider → LockProvider
    (app)/(tabs)/            index (Week), dashboard, reminders, journal, books
    (app)/settings, inbox, admin, lesson/[id], book/[id], reading/[id], books-import
  api/client.js              fetch wrapper: tokens, automatic refresh, uploads
  auth/                      AuthProvider (sign in/out, profile) · storage (SecureStore)
  data/                      database.js (SQLite tables, migrations)
                             repo.js (reads/writes) · sync.js · DataProvider.js
  lib/                       pure rules with tests: dates, week, books, lessons,
                             reminders, notifications, lock
  notifications/             scheduler (Android) · NotificationsProvider
  lock/                      PIN lock: provider, screen, pad, set/remove sheet
  components/                ui, EditSheet, ChoiceSheet, DateTimeField, charts,
                             nav/ (pill tab bar, quick add), week/, books/, admin/
  config/ui.js               MODERN_NAV switch (pill bar + quick add)
  theme.js                   colours (light/dark), fonts, theme choice
tests/                       tests of src/lib (plain Node)`}</Code>
        <Note>
          Screens never touch the server directly for planner data: they call <C>src/data/repo.js</C>, which writes to the
          phone’s database and asks for a sync.
        </Note>
      </Section>
    </>
  );
}
