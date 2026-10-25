import { Suspense } from "react";
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
                  <p className="font-medium">{item.title}</p>
                  <DeleteAnnouncementButton id={item.id} title={item.title} />
                </div>
                <p className="whitespace-pre-line text-sm text-zinc-600 dark:text-zinc-300">{item.body}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {formatDate(item.createdAt)} · {item.audience === "all" ? "All users" : "Selected users"} · {item.recipients} recipient
                  {item.recipients === 1 ? "" : "s"} · {item.readCount} read ·{" "}
                  {item.skipped ? "push off (inbox only)" : `${item.pushed} pushed`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
