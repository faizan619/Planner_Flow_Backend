import { C, Code, Lead, List, Note, P, Section, Steps, Table } from "../ui";

export default function Notifications() {
  return (
    <>
      <Lead>Reminders scheduled on the phone, announcements pushed through Firebase, the inbox, and the admin tools.</Lead>

      <Section id="local" title="1. Reminders on the phone">
        <P>
          Vercel’s free plan can only run a job once a day, so time-based reminders are scheduled by the phone itself
          (<C>expo-notifications</C>). <C>src/lib/notifications.js</C> decides what should be scheduled;{" "}
          <C>src/notifications/scheduler.js</C> hands that to Android.
        </P>
        <Table
          head={["Reminder", "When", "Notes"]}
          rows={[
            ["Daily check-in", "Every day at the chosen time (default 9 pm)", "“Mark today’s habits”"],
            ["Week ending", "The day before the week ends, at the chosen time (default 8 pm)", "Only if weekly tasks are still open; says how many"],
            ["Reminder notes", "At each note’s time", "Open notes with a future time, soonest 50"],
          ]}
        />
        <List>
          <li>The whole schedule is rebuilt a second after tasks or notes change, and whenever the app opens.</li>
          <li>Each kind can be switched off, with its own time, in Settings → Reminders (stored on the phone).</li>
          <li>Android channels: Reminders, Daily check-in, Announcements. Tapping a notification opens the matching screen.</li>
        </List>
      </Section>

      <Section id="push" title="2. Push notifications (announcements)">
        <Code>{`app opens ──► Android gives an FCM token ──► POST /api/v1/devices
admin sends ──► inbox rows for every recipient ──► reply to the admin
            └─► after(): Google token (service account, cached 1 h)
                 ──► FCM HTTP v1, 8 at a time ──► sent / failed / no_device
                 ──► tokens Android says are dead are deleted`}</Code>
        <List>
          <li>A phone’s token belongs to whoever signed in on it last; signing out removes it.</li>
          <li>Without <C>FIREBASE_SERVICE_ACCOUNT</C> push is off and announcements show “inbox only”; nothing else changes.</li>
          <li>Push needs the development or release app (Expo Go can’t receive it).</li>
        </List>
      </Section>

      <Section id="inbox" title="3. The inbox">
        <List>
          <li>The 🔔 on the Week page shows the unread count, refreshed on open, when a push arrives, and when the app returns to the front.</li>
          <li>Opening an announcement marks it read; “Mark all read” does all of them.</li>
          <li>🗑 removes one from <em>your</em> inbox only (others keep it; the admin’s counts don’t change).</li>
        </List>
      </Section>

      <Section id="announcements" title="4. Sending and deleting announcements">
        <Steps>
          <li>Web panel → Announcements, or app → Settings → Admin tools. Title (120), message (2,000), all users or chosen ones.</li>
          <li>It lands in each recipient’s inbox and is pushed to their phones. History shows recipients, reads and pushes.</li>
          <li><strong>Delete</strong> (with confirmation) removes it from every inbox and the history, and is logged.</li>
        </Steps>
        <Note type="warn">A push already sitting in someone’s notification tray can’t be recalled; tapping it just opens their inbox, where it’s gone.</Note>
      </Section>

      <Section id="admin" title="5. Admin tools">
        <Table
          head={["Where", "What"]}
          rows={[
            ["Web: Overview", "Total users, active and new in the last 7 days, deactivated, push status"],
            ["Web: Users", "Search; Deactivate (signs them out everywhere, keeps data) / Reactivate; Activity link"],
            ["Web: Announcements", "Send, history, delete"],
            ["Web: Logs", "Filter by type, event, email and dates; 50 per page"],
            ["Web: Settings", "Switch each log type on/off; days to keep logs (7–365, default 45)"],
            ["App: Settings → Admin tools", "Announcements (send, history, delete) and Overview numbers"],
          ]}
        />
        <P>Admins can’t deactivate themselves. “Active” means the app synced in the last 7 days (recorded at most every 10 minutes).</P>
      </Section>

      <Section id="logs" title="6. Activity logs and cleanup">
        <Table
          head={["Type", "Events"]}
          rows={[
            ["Security", "sign-ups, email verified / wrong code, sign-ins (app or panel), failed sign-ins with the reason, password resets, too-many-attempts blocks, reused sign-in tokens, deleted accounts"],
            ["Admin", "users deactivated / reactivated, announcements sent / deleted, log settings changed (with which admin)"],
            ["Usage", "used the app (at most every 10 min), book import previewed, data exported, profile updated (field names only), phone registered for push"],
          ]}
        />
        <List>
          <li>Each entry: time, user email, acting admin, IP, device/browser and short details. Never passwords, codes, tokens or anything users write.</li>
          <li>Changing the log settings is always recorded, even when it switches the admin log off.</li>
          <li>Logs are written with <C>after()</C>, so they never slow down or break a request.</li>
          <li>Every night (3:00 IST, <C>vercel.json</C>) <C>/api/cron/cleanup</C> deletes logs past the retention period, expired sign-in tokens, old codes, used export links and old rate-limit counters. Opening the Logs page also clears old logs.</li>
        </List>
      </Section>
    </>
  );
}
