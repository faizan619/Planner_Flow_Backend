import Link from "next/link";

// The backend's home page. The app talks to /api/v1; visitors are pointed to
// the download page. (The admin panel is at /admin, deliberately not linked.)
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-4 px-4 py-16">
      <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Planner Flow</p>
      <h1 className="text-3xl font-bold">Your week, your habits, your diary.</h1>
      <p className="text-zinc-600 dark:text-zinc-300">
        This is the Planner Flow server, which keeps the Android app in sync. Get the app to start planning.
      </p>
      <div className="flex gap-3">
        <Link href="/download" className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">
          Get the Android app
        </Link>
      </div>
    </main>
  );
}
