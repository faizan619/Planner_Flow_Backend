import { C, Lead, List, P, Section, Steps, Table } from "../ui";

export default function Overview() {
  return (
    <>
      <Lead>
        Planner Flow turns a paper diary into an app: a weekly plan with daily habits marked by a straight line (done) or a
        zigzag (missed), weekly tasks, a line of motivation, quick reminders and money notes, a life-lessons journal and a
        book tracker. It works offline on the phone and syncs to the server when online.
      </Lead>

      <Section id="projects" title="Two projects">
        <Table
          head={["Folder", "What it is", "Runs on"]}
          rows={[
            [<C key="b">planner_flow_backend</C>, "Next.js server: the JSON API the app calls, the admin web panel, these docs, the daily cleanup job", "Your PC in development; Vercel in production"],
            [<C key="a">Planner_Flow</C>, "The Android app (Expo / React Native, JavaScript). Keeps its own database on the phone and syncs it", "Your phone: the development build, later the release APK"],
          ]}
        />
        <P>They are separate git repositories; the app only talks to the server over HTTPS (HTTP on your Wi-Fi during development).</P>
      </Section>

      <Section id="roles" title="Who uses it">
        <Table
          head={["Person", "What they can do", "Where"]}
          rows={[
            ["User", "Signs up in the app, plans their week, marks habits, keeps reminders, journal and books, exports their data, deletes their account", "The app"],
            [
              "Admin",
              "Everything a user can, plus: user list, deactivate / reactivate users, send and delete announcements, read activity logs, change log settings, read these docs",
              <>Web panel <C key="w">/admin</C> and the app’s Settings → Admin tools</>,
            ],
          ]}
        />
        <P>
          The first admin is made with <C>npm run make-admin -- you@example.com</C> (after signing up in the app). Every admin
          check happens on the server.
        </P>
      </Section>

      <Section id="app-screens" title="App screens">
        <Table
          head={["Screen", "What it does"]}
          rows={[
            ["Sign in · Create account · Verify email · Forgot / reset password", "Email + password; a 6-digit code by email confirms the address and resets the password"],
            ["Week (home tab)", "“This week’s motivation”, the habit grid with 7 day marks, weekly tasks; arrows move between weeks"],
            ["Dashboard", "A hero card with this week’s % and trend, stat tiles, insights (strongest day, most consistent habit, perfect days), 12-week charts and per-habit progress"],
            ["Notebook", "Notes grouped by when they’re due, Money by person with a net balance, and the Journal: life lessons with a lesson to revisit, “On this day”, search, tags and a month timeline"],
            ["Books", "Yearly goal, stats and charts, reading list; add, re-read, import from Excel/CSV"],
            ["Quick add (+)", "Bottom-right button: new habit, weekly task, note, money entry, lesson or book from any tab"],
            ["Inbox (🔔 on the Week page)", "Announcements from admins, unread badge, remove from your inbox"],
            ["Settings (⚙️)", "Profile, week start, time zone, currency, theme, PIN lock, reminder times, export, sync, sign out, delete account"],
            ["Admin tools (admins only)", "Send / delete announcements with history; user stats"],
            ["Lock screen", "Covers the app until the PIN is entered (only if the PIN lock is on)"],
          ]}
        />
      </Section>

      <Section id="web-pages" title="Web pages and addresses">
        <Table
          head={["Address", "What it is", "Who"]}
          rows={[
            [<C key="1">/</C>, "Simple home page with a link to the admin panel", "Everyone"],
            [<C key="2">/admin/login</C>, "Admin sign-in (same email and password as the app)", "Everyone; only admins get in"],
            [<C key="3">/admin</C>, "Overview: user counts, push status", "Admins"],
            [<C key="4">/admin/users</C>, "Search users, deactivate / reactivate, Activity link", "Admins"],
            [<C key="5">/admin/announcements</C>, "Send to all or chosen users; history with read and push counts; delete", "Admins"],
            [<C key="6">/admin/logs</C>, "Activity logs with filters", "Admins"],
            [<C key="7">/admin/settings</C>, "Which logs are recorded and how long they are kept", "Admins"],
            [<C key="8">/admin/docs</C>, "This documentation", "Admins"],
            [<C key="9">/api/v1/…</C>, "The JSON API used by the app (see API reference)", "The app"],
            [<C key="10">/api/cron/cleanup</C>, "Daily housekeeping, called by Vercel Cron with a secret", "Vercel"],
          ]}
        />
      </Section>

      <Section id="stack" title="Technology used">
        <Table
          head={["Part", "Technology", "Why"]}
          rows={[
            ["Server framework", "Next.js 16 (App Router, Cache Components, React Compiler)", "API routes, admin pages and Server Actions in one project; deploys to Vercel"],
            ["Database", "TiDB Cloud (MySQL-compatible) via mysql2", "Serverless SQL; plain parameterised queries"],
            ["Validation", "zod", "Every request body and record is checked on the server"],
            ["Passwords · tokens", "argon2id (@node-rs/argon2) · JWT with jose", "Modern password hashing; short-lived signed access tokens"],
            ["Email", "Gmail SMTP via nodemailer", "Verification and password-reset codes"],
            ["Excel", "exceljs", "Reading imports, writing exports"],
            ["Push", "Firebase Cloud Messaging (HTTP v1)", "Announcements on phones"],
            ["Admin panel styling", "Tailwind CSS 4", "Quick, consistent pages"],
            ["App", "Expo SDK 58 · React Native 0.88 · Expo Router", "One JavaScript codebase, file-based screens, cloud builds"],
            ["App storage", "expo-sqlite · expo-secure-store", "Offline database on the phone; tokens and PIN in the Android Keystore"],
            ["App extras", "expo-notifications · react-native-svg · datetimepicker · document-picker · netinfo", "Reminders, the hand-drawn marks, pickers, file import, offline detection"],
            ["Builds", "EAS Build", "APKs are built in Expo’s cloud, not on this PC"],
          ]}
        />
      </Section>

      <Section id="ideas" title="Ideas behind the code">
        <Steps>
          <li>
            <strong>The phone is the source of truth.</strong> Every screen reads and writes the phone’s own database, so the
            app works offline. Changes sync to the server in the background; the newer edit of a record wins.
          </li>
          <li>
            <strong>The server never trusts the app.</strong> Every request is validated, every query is limited to the
            signed-in user, and admin rights are checked on the server for every request and action.
          </li>
          <li>
            <strong>Personal text stays private.</strong> Journal entries are encrypted in the database, and logs never contain
            passwords, codes, tokens or anything a user wrote.
          </li>
        </Steps>
        <List>
          <li>Pure rules (weeks, streaks, stats, reminders, PIN lock) live in plain JavaScript files with their own tests.</li>
          <li>Small, readable modules: one file per concern on both sides (see Project structure).</li>
        </List>
      </Section>
    </>
  );
}
