import Image from "next/image";
import Link from "next/link";

// /privacy — the privacy policy for the Planner Flow app and this server.
// Static. Keep it in step with what the code really stores: database/schema.sql,
// src/server/logs.js (activity logs), src/server/crashes.js, src/server/push.js.
// Change UPDATED_ON whenever the text changes.

const UPDATED_ON = "9 November 2026";

export const metadata = {
  title: "Privacy policy · Planner Flow",
  description: "What Planner Flow stores, why, who helps run it, and how to export or delete your data.",
};

export default function PrivacyPage() {
  return (
    <div className="flex-1 bg-[#FAF8F3] text-[#1F1D1A] dark:bg-[#141311] dark:text-[#ECE8E1]">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 py-5">
        <Link href="/download" className="flex items-center gap-2.5">
          <Image src="/app-icon.png" alt="" width={34} height={34} className="rounded-[10px]" />
          <span className="font-serif text-lg font-bold">Planner Flow</span>
        </Link>
        <Link href="/download" className="text-sm font-semibold text-[#2F5D50] hover:underline dark:text-[#9FD4C2]">
          Get the app
        </Link>
      </header>

      <main className="mx-auto w-full max-w-3xl px-5 pb-20 pt-6">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#2F5D50] dark:text-[#9FD4C2]">Privacy policy</p>
        <h1 className="mt-2 font-serif text-4xl font-bold leading-tight">Your data, in plain words</h1>
        <p className="mt-3 text-sm text-[#6B675F] dark:text-[#A19B90]">Last updated: {UPDATED_ON}</p>

        <Summary />

        <Block title="Who we are">
          <p>
            Planner Flow is a free Android app made by Faizan Alam, an independent developer. This policy covers the app and its
            server (planner-flow-backend.vercel.app). There are no ads, no analytics companies and nothing is sold.
          </p>
        </Block>

        <Block title="What we store, and why">
          <Table
            rows={[
              ["Your account", "Name, email address, a scrambled (hashed) password, time zone, week start day and currency.", "To sign you in and send your verification and password-reset codes."],
              ["What you add", "Habits and their marks, weekly tasks, motivation lines, notes and reminders, money entries, budgets, journal entries, books and reading goals.", "So your planner syncs and is safe if you change or lose your phone."],
              ["Journal entries", "Title and text are encrypted on the server (AES-256-GCM). Tags stay readable so the app can filter them.", "Nobody else, including the admin, can read your journal."],
              ["Push notification token", "An ID from Google's Firebase that lets the server send announcements to your phone.", "For Inbox announcements. Removed when you sign out or delete your account."],
              ["Security and activity logs", "Sign-ins, sign-ups, password resets and similar events, with the time, IP address, device or browser name and email address. Never passwords, codes or anything you write.", "To spot abuse and fix problems. Deleted automatically after 45 days (the admin can set 7–365 days)."],
              ["Crash reports", "The error, app version, Android version and phone model. Not linked to your account, and nothing you wrote.", "To find and fix crashes."],
              ["Short-lived records", "Sign-in tokens, one-time codes, export links and rate-limit counters (which include IP addresses).", "To keep sign-in safe and stop abuse. They expire on their own."],
            ]}
          />
        </Block>

        <Block title="What stays on your phone">
          <ul className="list-disc space-y-2 pl-5">
            <li>A copy of your planner, so the app works offline. It is not included in Android backups.</li>
            <li>Your PIN, if you set one. Only a scrambled version is kept, in Android&apos;s secure storage, and it never leaves the phone.</li>
            <li>Your alarm tones, theme and reminder settings.</li>
            <li>The home screen widget shows today&apos;s habits and tasks. It hides their names while the app is locked or signed out.</li>
          </ul>
        </Block>

        <Block title="Who helps run Planner Flow">
          <p>These services process data only to provide the app:</p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li><strong>Vercel</strong>: hosts the server and this website.</li>
            <li><strong>TiDB Cloud (PingCAP)</strong>: the database that stores your synced data.</li>
            <li><strong>Google (Gmail)</strong>: sends verification and password-reset emails.</li>
            <li><strong>Google (Firebase Cloud Messaging)</strong>: delivers push notifications.</li>
            <li><strong>GitHub</strong>: hosts the app download file.</li>
          </ul>
          <p className="mt-3">Their servers may be outside your country. All traffic between the app and the server is encrypted (HTTPS).</p>
        </Block>

        <Block title="Your choices">
          <ul className="list-disc space-y-2 pl-5">
            <li><strong>Export</strong>: Settings → Your data → Excel or JSON downloads everything you&apos;ve added.</li>
            <li><strong>Change</strong>: edit your name, time zone, week start and currency in Settings.</li>
            <li>
              <strong>Delete</strong>: Settings → Delete my account removes your account and everything in it from the server and
              your phone straight away. Activity log entries about your account are removed with the regular 45-day clean-up.
            </li>
            <li><strong>Notifications</strong>: turn them off any time in Android&apos;s settings.</li>
          </ul>
        </Block>

        <Block title="Children">
          <p>Planner Flow is not meant for children under 13, and we don&apos;t knowingly store data from them.</p>
        </Block>

        <Block title="Changes to this policy">
          <p>
            If this policy changes, the date at the top changes too. Important changes will also be announced in the app&apos;s
            Inbox.
          </p>
        </Block>

        <Block title="Contact">
          <p>
            Questions, or want something deleted? Reply to any email Planner Flow has sent you (for example your verification code)
            and it reaches the developer.
          </p>
        </Block>
      </main>

      <footer className="mx-auto flex w-full max-w-3xl flex-col items-center justify-between gap-3 px-5 pb-10 text-sm text-[#6B675F] sm:flex-row dark:text-[#A19B90]">
        <p>© 2026 Planner Flow</p>
        <Link href="/download" className="hover:text-[#2F5D50] dark:hover:text-[#9FD4C2]">
          Download the app
        </Link>
      </footer>
    </div>
  );
}

function Summary() {
  const points = [
    "Your journal is encrypted on the server.",
    "No ads, no trackers, nothing sold.",
    "Export or delete everything from Settings.",
  ];
  return (
    <ul className="mt-8 grid gap-3 sm:grid-cols-3">
      {points.map((point) => (
        <li key={point} className="rounded-2xl bg-[#2F5D50]/10 p-4 text-[15px] font-semibold leading-snug dark:bg-[#2F5D50]/25">
          {point}
        </li>
      ))}
    </ul>
  );
}

function Block({ title, children }) {
  return (
    <section className="mt-10">
      <h2 className="font-serif text-2xl font-bold">{title}</h2>
      <div className="mt-3 text-[15px] leading-relaxed text-[#4A4740] dark:text-[#C9C3B8]">{children}</div>
    </section>
  );
}

// Stacked cards on phones, a three-column table from `sm` up.
function Table({ rows }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-black/5 bg-white dark:border-white/10 dark:bg-[#1C1B19]">
      <div className="hidden grid-cols-[0.8fr_1.6fr_1.2fr] gap-4 border-b border-black/5 px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#6B675F] sm:grid dark:border-white/10 dark:text-[#A19B90]">
        <span>What</span>
        <span>Details</span>
        <span>Why</span>
      </div>
      {rows.map(([what, details, why]) => (
        <div key={what} className="grid gap-1 border-b border-black/5 px-4 py-4 last:border-b-0 sm:grid-cols-[0.8fr_1.6fr_1.2fr] sm:gap-4 dark:border-white/10">
          <span className="font-semibold text-[#1F1D1A] dark:text-[#ECE8E1]">{what}</span>
          <span>{details}</span>
          <span className="text-[#6B675F] dark:text-[#A19B90]">{why}</span>
        </div>
      ))}
    </div>
  );
}
