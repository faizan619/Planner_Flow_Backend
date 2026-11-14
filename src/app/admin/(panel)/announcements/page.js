import { Suspense } from "react";
import Link from "next/link";
import { listUsers } from "@/server/admin";
import { listAnnouncements } from "@/server/announcements";
import { requireAdminPage } from "@/server/auth/webSession";
import { Card, Loading, formatDate } from "../../ui";
import { AnnouncementForm } from "./AnnouncementForm";
import { DeleteAnnouncementButton } from "./DeleteAnnouncementButton";

// The heading shows at once; the form and history load in their own boundary.
export default function AdminAnnouncements() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Announcements</h1>
      <Suspense fallback={<Loading />}>
        <Announcements />
      </Suspense>
    </div>
  );
}

// What people answered: a bar per poll option, the reactions, and how many
// answered a question (the answers themselves are on the Feedback page).
function Answers({ item }) {
  const reactions = Object.entries(item.reactions);
  const votes = item.votes ?? [];
  const total = votes.reduce((sum, count) => sum + count, 0);
  return (
    <div className="mt-2 flex flex-col gap-2 text-sm">
      {item.kind === "poll" ? (
        <div className="flex flex-col gap-1.5">
          {item.options.map((option, index) => {
            const share = total ? Math.round((votes[index] / total) * 100) : 0;
            return (
              <div key={option} className="flex flex-col gap-0.5">
                <div className="flex justify-between gap-2 text-xs">
                  <span className="font-medium">{option}</span>
                  <span className="text-zinc-500">
                    {votes[index]} · {share}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div className="h-full rounded-full bg-emerald-600" style={{ width: `${share}%` }} />
                </div>
              </div>
            );
          })}
          <p className="text-xs text-zinc-500">
            {total} vote{total === 1 ? "" : "s"}
          </p>
        </div>
      ) : null}
      {item.kind === "question" ? (
        <Link href="/admin/feedback?view=all" className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400">
          {item.replies} answer{item.replies === 1 ? "" : "s"} → see them on the Feedback page
        </Link>
      ) : null}
      {reactions.length ? (
        <p className="flex flex-wrap gap-2 text-xs">
          {reactions.map(([emoji, count]) => (
            <span key={emoji} className="rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
              {emoji} {count}
            </span>
          ))}
        </p>
      ) : null}
    </div>
  );
}

async function Announcements() {
  await requireAdminPage();
  const [announcements, users] = await Promise.all([listAnnouncements(), listUsers()]);
  const activeUsers = users.filter((user) => user.status === "active").map(({ id, name, email }) => ({ id, name, email }));

  return (
    <>
      <Card title="New announcement">
        <AnnouncementForm users={activeUsers} />
      </Card>

      <Card title="Sent">
        {announcements.length === 0 ? (
          <p className="text-sm text-zinc-500">Nothing sent yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
            {announcements.map((item) => (
              <li key={item.id} className="py-3">
                <div className="flex items-start justify-between gap-4">
                  <p className="font-medium">
                    {item.kind === "poll" ? "📊 " : item.kind === "question" ? "❓ " : ""}
                    {item.title}
                  </p>
                  <DeleteAnnouncementButton id={item.id} title={item.title} />
                </div>
                <p className="whitespace-pre-line text-sm text-zinc-600 dark:text-zinc-300">{item.body}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {formatDate(item.createdAt)} · {item.audience === "all" ? "All users" : "Selected users"} · {item.recipients} recipient
                  {item.recipients === 1 ? "" : "s"} · {item.readCount} read ·{" "}
                  {item.skipped ? "push off (inbox only)" : `${item.pushed} pushed`}
                  {item.closesAt ? ` · ${item.closed ? "closed" : `closes ${formatDate(item.closesAt)}`}` : ""}
                </p>
                <Answers item={item} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
