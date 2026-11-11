import { Suspense } from "react";
import Link from "next/link";
import { requireAdminPage } from "@/server/auth/webSession";
import { FEEDBACK_VIEWS, feedbackCounts, listFeedback } from "@/server/feedback";
import { setFeedbackStatusAction } from "../../actions";
import { ReplyForm } from "./ReplyForm";
import { Card, Loading, formatDate } from "../../ui";

// Feedback sent from the app, newest first. Filters: To look at (new and
// read), New, Done, All. Each message can be marked read or done, or reopened.
// Reply sends an answer to the user's in-app inbox and marks it done.
export default function AdminFeedback({ searchParams }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-bold">Feedback</h1>
        <Link href="/admin/announcements" className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400">
          Announcements →
        </Link>
      </div>
      <Suspense fallback={<Loading />}>
        <FeedbackList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const VIEW_LABELS = { open: "To look at", new: "New", done: "Done", all: "All" };

const KIND = {
  idea: { label: "💡 Idea", className: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200" },
  bug: { label: "🐞 Bug", className: "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200" },
  other: { label: "💬 Other", className: "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200" },
};

const STATUS = {
  new: { label: "New", className: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200" },
  read: { label: "Read", className: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" },
  done: { label: "Done", className: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400" },
};

async function FeedbackList({ searchParams }) {
  await requireAdminPage();
  const params = await searchParams;
  const view = FEEDBACK_VIEWS.includes(params.view) ? params.view : "open";
  const [items, counts] = await Promise.all([listFeedback({ view }), feedbackCounts()]);
  const countFor = { open: counts.open, new: counts.new, done: counts.total - counts.open, all: counts.total };

  return (
    <>
      <nav className="flex flex-wrap gap-2 text-sm">
        {FEEDBACK_VIEWS.map((option) => (
          <Link
            key={option}
            href={option === "open" ? "/admin/feedback" : `/admin/feedback?view=${option}`}
            className={`rounded-full border px-3 py-1 font-medium ${
              option === view
                ? "border-emerald-700 bg-emerald-700 text-white"
                : "border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            }`}
          >
            {VIEW_LABELS[option]} ({countFor[option]})
          </Link>
        ))}
      </nav>

      {!items.length ? (
        <Card>
          <p className="text-sm text-zinc-500">{view === "open" || view === "new" ? "Nothing waiting. 🎉" : "No feedback here yet."}</p>
        </Card>
      ) : (
        items.map((item) => (
          <Card key={item.id} className={item.status === "done" ? "opacity-70" : ""}>
            <div className="flex flex-col gap-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${KIND[item.kind].className}`}>{KIND[item.kind].label}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS[item.status].className}`}>{STATUS[item.status].label}</span>
                <span className="ml-auto text-xs text-zinc-500">{formatDate(item.createdAt)}</span>
              </div>
              <p className="break-words whitespace-pre-wrap text-base">{item.message}</p>
              <p className="text-xs text-zinc-500">
                From{" "}
                <Link href={`/admin/users?q=${encodeURIComponent(item.userEmail)}`} className="font-medium text-zinc-700 hover:underline dark:text-zinc-300">
                  {item.userName} ({item.userEmail})
                </Link>
                {item.appVersion ? ` · app ${item.appVersion}${item.versionCode ? ` (${item.versionCode})` : ""}` : ""}
                {item.device ? ` · ${item.device}` : ""}
                {item.androidVersion ? ` · Android ${item.androidVersion}` : ""}
              </p>
              {item.reply ? (
                <div className="rounded-lg border-l-4 border-emerald-600 bg-emerald-50 p-3 dark:bg-emerald-950/40">
                  <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">Your reply · {formatDate(item.repliedAt)}</p>
                  <p className="break-words whitespace-pre-wrap">{item.reply}</p>
                </div>
              ) : null}
              <div className="flex flex-wrap items-start gap-2">
                <ReplyForm feedbackId={item.id} name={item.userName} />
                {item.status === "new" ? <StatusButton id={item.id} status="read">Mark read</StatusButton> : null}
                {item.status !== "done" ? <StatusButton id={item.id} status="done" primary>Done ✓</StatusButton> : null}
                {item.status === "done" ? <StatusButton id={item.id} status="read">Reopen</StatusButton> : null}
              </div>
            </div>
          </Card>
        ))
      )}
    </>
  );
}

function StatusButton({ id, status, primary, children }) {
  return (
    <form action={setFeedbackStatusAction}>
      <input type="hidden" name="feedbackId" value={id} />
      <input type="hidden" name="status" value={status} />
      <button
        type="submit"
        className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
          primary ? "bg-emerald-700 text-white hover:bg-emerald-800" : "border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        }`}
      >
        {children}
      </button>
    </form>
  );
}
