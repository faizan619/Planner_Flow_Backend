import { Suspense } from "react";
import Link from "next/link";
import { listUsers } from "@/server/admin";
import { requireAdminPage } from "@/server/auth/webSession";
import { setUserStatusAction } from "../../actions";
import { SearchBox } from "./SearchBox";
import { Card, Loading, SubmitButton, formatDate } from "../../ui";

// The heading and search box show at once; the list loads in its own boundary.
export default function AdminUsers({ searchParams }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-bold">Users</h1>
        <Suspense fallback={null}>
          <SearchBox />
        </Suspense>
      </div>
      <Suspense fallback={<Loading />}>
        <UserTable searchParams={searchParams} />
      </Suspense>
      <p className="text-xs text-zinc-500">Deactivated users are signed out everywhere and can’t sign in. Their data is kept.</p>
    </div>
  );
}

async function UserTable({ searchParams }) {
  const admin = await requireAdminPage();
  const { q = "" } = await searchParams;
  const users = await listUsers({ q: String(q).slice(0, 100) });

  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800">
          <tr>
            <th className="px-4 py-3 font-medium">User</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Last active</th>
            <th className="px-4 py-3 font-medium">Joined</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
              <td className="px-4 py-3">
                <p className="font-medium">
                  {user.name} {user.role === "admin" ? <span className="ml-1 rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">admin</span> : null}
                </p>
                <p className="text-zinc-500">
                  {user.email}
                  {user.emailVerified ? "" : " · not verified"}
                </p>
                <Link href={`/admin/logs?userId=${user.id}`} className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400">
                  Activity
                </Link>
              </td>
              <td className="px-4 py-3">
                <span className={user.status === "active" ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}>
                  {user.status === "active" ? "Active" : "Deactivated"}
                </span>
              </td>
              <td className="px-4 py-3 text-zinc-500">{formatDate(user.lastActiveAt)}</td>
              <td className="px-4 py-3 text-zinc-500">{formatDate(user.createdAt)}</td>
              <td className="px-4 py-3 text-right">
                {user.id !== String(admin.id) ? (
                  <form action={setUserStatusAction}>
                    <input type="hidden" name="userId" value={user.id} />
                    <input type="hidden" name="status" value={user.status === "active" ? "deactivated" : "active"} />
                    <SubmitButton tone={user.status === "active" ? "danger" : "plain"}>
                      {user.status === "active" ? "Deactivate" : "Reactivate"}
                    </SubmitButton>
                  </form>
                ) : (
                  <span className="text-xs text-zinc-400">you</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {users.length === 0 ? <p className="p-4 text-sm text-zinc-500">{q ? `No users match “${q}”.` : "No users yet."}</p> : null}
    </Card>
  );
}
