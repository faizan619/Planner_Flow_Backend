import { Suspense } from "react";
import Link from "next/link";
import { requireAdminPage } from "@/server/auth/webSession";
import { isValidDay } from "@/server/dates";
import { CATEGORIES, listEventNames, listLogs } from "@/server/logs";
import { purgeOldLogs } from "@/server/maintenance";
import { getSetting } from "@/server/settings";
import { CATEGORY_LABELS, describeDetails, eventLabel } from "../../logLabels";
import { Card, Loading, formatDate } from "../../ui";

// Activity logs with filters. The heading shows at once; the list loads in
// its own boundary.
export default function AdminLogs({ searchParams }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-bold">Logs</h1>
        <Link href="/admin/settings" className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400">
          Log settings →
        </Link>
      </div>
      <Suspense fallback={<Loading />}>
        <Logs searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const BADGE = {
  security: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  admin: "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200",
  usage: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

async function Logs({ searchParams }) {
  await requireAdminPage();
  const params = await searchParams;
  const pick = (key) => (typeof params[key] === "string" ? params[key].slice(0, 100) : "");
  const filters = {
    category: CATEGORIES.includes(pick("category")) ? pick("category") : "",
    event: /^[a-z_]{1,64}$/.test(pick("event")) ? pick("event") : "",
    userId: /^\d+$/.test(pick("userId")) ? pick("userId") : "",
    q: pick("q").trim(),
    from: isValidDay(pick("from")) ? pick("from") : "",
    to: isValidDay(pick("to")) ? pick("to") : "",
  };
  const page = Math.max(1, Number.parseInt(pick("page"), 10) || 1);

  await purgeOldLogs();
  const [{ logs, hasMore }, events, settings] = await Promise.all([
    listLogs({ ...filters, page }),
    listEventNames(),
    getSetting("logs"),
  ]);
  const off = CATEGORIES.filter((category) => !settings[category]);
  const pageLink = (to) => `/admin/logs?${new URLSearchParams({ ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)), page: String(to) })}`;
  const input = "rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900";

  return (
    <>
      {off.length ? (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Not being recorded right now: {off.map((category) => CATEGORY_LABELS[category]).join(", ")}.{" "}
          <Link href="/admin/settings" className="font-semibold underline">Change</Link>
        </p>
      ) : null}

      <Card>
        <form className="flex flex-wrap items-end gap-3" role="search">
          {filters.userId ? <input type="hidden" name="userId" value={filters.userId} /> : null}
          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
            Type
            <select name="category" defaultValue={filters.category} className={input}>
              <option value="">All</option>
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>{CATEGORY_LABELS[category]}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
            Event
            <select name="event" defaultValue={filters.event} className={input}>
              <option value="">All</option>
              {events.map((event) => (
                <option key={event} value={event}>{eventLabel(event)}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
            Email contains
            <input name="q" defaultValue={filters.q} className={`${input} w-48`} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
            From
            <input type="date" name="from" defaultValue={filters.from} className={input} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
            To
            <input type="date" name="to" defaultValue={filters.to} className={input} />
          </label>
          <button type="submit" className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">
            Filter
          </button>
          <Link href="/admin/logs" className="py-2 text-sm text-zinc-500 hover:underline">Clear</Link>
        </form>
        {filters.userId ? (
          <p className="mt-3 text-sm text-zinc-500">
            Showing one user’s activity. <Link href="/admin/logs" className="font-medium text-emerald-700 hover:underline dark:text-emerald-400">Show everyone</Link>
          </p>
        ) : null}
      </Card>

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800">
            <tr>
              <th className="px-4 py-3 font-medium">When (IST)</th>
              <th className="px-4 py-3 font-medium">What</th>
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Details</th>
              <th className="px-4 py-3 font-medium">IP</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-b border-zinc-100 align-top last:border-0 dark:border-zinc-800">
                <td className="whitespace-nowrap px-4 py-3 text-zinc-500">{formatDate(log.createdAt)}</td>
                <td className="px-4 py-3">
                  <span className={`mr-2 rounded px-1.5 py-0.5 text-xs font-semibold ${BADGE[log.category]}`}>{CATEGORY_LABELS[log.category]}</span>
                  {eventLabel(log.event)}
                </td>
                <td className="px-4 py-3">
                  {log.userId ? (
                    <Link href={`/admin/logs?userId=${log.userId}`} className="hover:underline">{log.email ?? `User ${log.userId}`}</Link>
                  ) : (
                    <span>{log.email ?? "—"}</span>
                  )}
                  {log.actorEmail ? <p className="text-xs text-zinc-500">by {log.actorEmail}</p> : null}
                </td>
                <td className="max-w-xs px-4 py-3 text-xs text-zinc-500">{describeDetails(log.details)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-zinc-500">{log.ip ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 ? <p className="p-4 text-sm text-zinc-500">No log entries match.</p> : null}
      </Card>

      <div className="flex justify-between text-sm font-medium">
        {page > 1 ? <Link href={pageLink(page - 1)} className="text-emerald-700 hover:underline dark:text-emerald-400">← Newer</Link> : <span />}
        {hasMore ? <Link href={pageLink(page + 1)} className="text-emerald-700 hover:underline dark:text-emerald-400">Older →</Link> : <span />}
      </div>
      <p className="text-xs text-zinc-500">
        Entries are kept for {settings.retentionDays} days. Passwords, codes, tokens and anything users write are never logged.
      </p>
    </>
  );
}
