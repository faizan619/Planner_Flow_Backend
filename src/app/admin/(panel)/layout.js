import { Suspense } from "react";
import Link from "next/link";
import { requireAdminPage } from "@/server/auth/webSession";
import { logoutAction } from "../actions";

export const metadata = { title: "Admin · Planner Flow" };

// Every admin page sits behind this check. (Actions check again themselves.)
async function AdminGate({ children }) {
  const admin = await requireAdminPage();
  return (
    <>
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <span className="font-bold text-emerald-700 dark:text-emerald-400">Planner Flow admin</span>
          <nav className="flex gap-4 text-sm font-medium">
            <Link href="/admin" className="hover:underline">Overview</Link>
            <Link href="/admin/users" className="hover:underline">Users</Link>
            <Link href="/admin/announcements" className="hover:underline">Announcements</Link>
          </nav>
          <form action={logoutAction} className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-zinc-500">{admin.email}</span>
            <button type="submit" className="font-medium text-red-700 hover:underline dark:text-red-400">Sign out</button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </>
  );
}

export default function AdminLayout({ children }) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <Suspense fallback={<p className="p-6 text-sm text-zinc-500">Loading…</p>}>
        <AdminGate>{children}</AdminGate>
      </Suspense>
    </div>
  );
}
