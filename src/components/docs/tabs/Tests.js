import { C, Code, Lead, List, Section, Sub } from "../ui";

// Every automated check, grouped as in the test files.
const SERVER = [
  ["Accounts (auth.test.mjs)", [
    "Rejects invalid sign-up input with field errors, and bodies that aren’t JSON",
    "Full flow: sign up → sign-in blocked until verified → verifying signs in",
    "A code can only be used once; 5 wrong attempts burn it",
    "Duplicate email is rejected",
    "Wrong password and unknown email give the same error",
    "Sign-in is rate-limited per email; sign-up per IP",
    "/me needs a valid access token",
    "Refresh rotates the token; reusing an old one revokes the whole family",
    "Logout revokes the refresh token; a deactivated account is locked out immediately",
    "Reset code sets a new password and signs out other devices; forgot-password reports unknown emails, sends one code a minute and limits lookups per IP",
    "PATCH /me validates and can’t change role or email; DELETE /me needs the password and removes everything",
  ]],
  ["Sync (sync.test.mjs)", [
    "Needs a signed-in user; pushes records and pulls them back with a cursor",
    "Last write wins; a clock far in the future can’t make an edit unbeatable",
    "Deletions sync as tombstones",
    "Users never see or change each other’s records (IDOR)",
    "Marks for a habit you don’t own, or for future days, are rejected",
    "Invalid records are rejected one by one while valid ones apply; malformed requests get 400",
    "Carrying an unfinished task links both weeks; a cursor from the future triggers a full resync",
  ]],
  ["Journal, reminders, paging (journal.test.mjs)", [
    "Lessons round-trip with tags and date; title and text are encrypted at rest",
    "Encrypted text moved to another row is never shown there",
    "Other users can’t see or overwrite lessons; lesson fields are validated",
    "Notes and money round-trip with exact paise; their required fields are checked",
    "Large pulls arrive in pages with hasMore",
  ]],
  ["Books and import (books.test.mjs)", [
    "Books, readings (with a re-read) and a yearly goal round-trip",
    "End before start, ratings on unfinished books and bad goals are rejected",
    "Readings must belong to your own book (IDOR)",
    "An Excel tracker with real date cells is read and bad rows are flagged",
    "CSV with quotes, a BOM, semicolons and other column names is read",
    "A missing Book Title column is explained; no file, huge files, broken Excel and signed-out users are refused",
  ]],
  ["Admin and inbox (admin.test.mjs, announcement-delete.test.mjs)", [
    "Non-admins and signed-out users can’t use admin routes; a demoted admin loses access immediately",
    "Users are listed and searched without password hashes; deactivate / reactivate works; admins can’t deactivate themselves",
    "Stats count users; syncing marks a user active",
    "Announcements reach all or only chosen users; push is skipped without Firebase; history shows counts",
    "Users can only mark their own announcements read; phones move to whoever signed in last",
    "Admins delete for everyone (logged); only admins can; users remove only from their own inbox; not someone else’s",
  ]],
  ["Admin web panel (admin-panel.test.mjs)", [
    "Signed out, panel pages redirect to sign-in before rendering; a made-up cookie still gets nothing",
    "Signing in through the real form sets an httpOnly, SameSite=Lax cookie",
    "Regular users and wrong passwords can’t sign in; demoting ends the session",
    "The Logs page shows entries; the Settings form saves switches and retention",
    "These docs open for admins only, and every tab renders",
  ]],
  ["Export (export.test.mjs)", [
    "Needs a signed-in user and a valid format",
    "JSON holds all your data, lessons decrypted, and nobody else’s",
    "Excel has a sheet per kind of data and the Books sheet imports back",
    "A link works once; made-up links don’t; links use the address the app called",
  ]],
  ["Activity logs (logs.test.mjs)", [
    "Security, admin and usage events are recorded (with the acting admin)",
    "Passwords, codes and tokens are never stored",
    "Each log type can be switched off; settings changes are always recorded",
    "Retention 7–365 days (default 45) and old logs are removed",
    "The list filters by type and user; only admins can see logs or change settings; the cleanup job needs its secret",
  ]],
];

const APP = [
  ["Weeks and habits (week.test.mjs)", [
    "Weeks start on the chosen weekday and cross month/year boundaries; “today” follows the user’s time zone",
    "Cell states, cleared marks, the tap cycle; archived/deleted habits drop out of later weeks only",
    "Weekly score counts only the days the habit existed; week totals only count days up to today",
    "Streaks: today unmarked doesn’t break it; missed or lapsed days do; best streak",
    "Tasks: open during the week, ✗ after; only failed, not-yet-carried tasks can be carried",
    "Changing the week start day: tasks show in the containing week and fail at its end",
    "Day strip progress per day; greeting by hour in the user’s time zone",
  ]],
  ["Books (books.test.mjs)", ["Reading rules", "Same book ignores case and spacing; re-read numbering", "Year stats", "Planning an import, and skipping already-imported rows"]],
  ["Reminders and journal (reminders-lessons.test.mjs)", ["Exact paise parsing, Indian formatting, totals", "Note order and overdue", "Tags, multi-word search, “On this day”"]],
  ["Phone reminders (notifications.test.mjs)", ["Daily check-in time", "Week-ending reminder: right day, only with open tasks, only if ahead", "Notes: future, open, soonest first", "Each kind can be switched off"]],
  ["PIN lock (lock.test.mjs)", ["4–6 digits", "Locks after 30 s away, only when enabled", "5 free tries, then waits up to 15 minutes"]],
  ["Drag to reorder (dragOrder.test.mjs)", ["A short drag stays put; passing half of a neighbour takes its place, rows of any height, gaps included", "Up and down, stopping at the ends", "Applying an order renumbers and saves only what changed, keeping tasks added since"]],
  ["Dashboard insights (dashboard.test.mjs)", ["This week vs last week, in percentage points", "Encouraging line follows the week’s share", "Strongest weekday", "Perfect days, not spoiled by habits added later", "Most consistent and needs-attention habits (only below 60%, enough days)"]],
  ["Reminders and Books pages (screens.test.mjs)", ["Notes grouped as overdue, today, upcoming, anytime", "Relative times: in 20 min, in 3 h, in 2 days, ago", "Money balance per person (case and spaces ignored)", "Reading-goal pace: ahead or behind, past and future years", "Reading now, newest first, with days so far", "Stable initials and cover colours", "Journal timeline by month, counts, a lesson to revisit that changes daily"]],
  ["Swiping between tabs (swipe.test.mjs)", ["Only clearly sideways moves count", "Right-to-left = next tab, left-to-right = previous", "A quick flick switches; a slow short drag doesn’t", "Nothing happens past the first or last tab"]],
];

function Group({ title, tests }) {
  return (
    <Sub title={title}>
      <List>
        {tests.map((test) => (
          <li key={test}>{test}</li>
        ))}
      </List>
    </Sub>
  );
}

export default function Tests() {
  return (
    <>
      <Lead>Every automated check, grouped as in the test files. All of them must pass before a deploy.</Lead>

      <Section id="run" title="Running them">
        <Code>{`cd planner_flow_backend
npm test        # starts its own server on port 3999 with a fresh <db>_test database

cd Planner_Flow
npm test        # plain Node, no phone needed`}</Code>
        <List>
          <li>The server tests never touch your real data: they drop and recreate <C>&lt;database&gt;_test</C> on every run, send emails to a temporary folder, and switch push off.</li>
          <li>They run next to your own <C>npm run dev</C> (separate build folder <C>.next-test</C>), so you don’t need to stop it.</li>
          <li>The app’s tests cover the pure rules in <C>src/lib</C>; screens are checked with <C>npx expo lint</C>, <C>npx expo-doctor</C> and on the phone.</li>
        </List>
      </Section>

      <Section id="server" title="Server tests">
        {SERVER.map(([title, tests]) => (
          <Group key={title} title={title} tests={tests} />
        ))}
      </Section>

      <Section id="app" title="App tests">
        {APP.map(([title, tests]) => (
          <Group key={title} title={title} tests={tests} />
        ))}
      </Section>
    </>
  );
}
