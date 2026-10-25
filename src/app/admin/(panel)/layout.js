import { Suspense } from "react";
import Link from "next/link";
import { getAdmin } from "@/server/auth/webSession";
import { logoutAction } from "../actions";

export const metadata = { title: "Admin · Planner Flow" };

// The panel's frame. It reads no data itself, so moving between admin pages
// is instant: each page checks the admin role on the server inside its own
// loading boundary (loading.js), and src/proxy.js sends visitors without a
// session cookie to sign-in first. Actions check the role again themselves.

async function SignedInAs() {
  const admin = await getAdmin();
  return <span className="text-zinc-500">{admin?.email}</span>;
}

export default function AdminLayout({ children }) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <span className="font-bold text-emerald-700 dark:text-emerald-400">Planner Flow admin</span>
          <nav className="flex gap-4 text-sm font-medium">
            <Link href="/admin" className="hover:underline">Overview</Link>
            <Link href="/admin/users" className="hover:underline">Users</Link>
            <Link href="/admin/announcements" className="hover:underline">Announcements</Link>
            <Link href="/admin/logs" className="hover:underline">Logs</Link>
            <Link href="/admin/settings" className="hover:underline">Settings</Link>
            <Link href="/admin/docs" className="hover:underline">Docs</Link>
          </nav>
          <form action={logoutAction} className="ml-auto flex items-center gap-3 text-sm">
            <Suspense fallback={null}>
              <SignedInAs />
            </Suspense>
            <button type="submit" className="font-medium text-red-700 hover:underline dark:text-red-400">Sign out</button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
