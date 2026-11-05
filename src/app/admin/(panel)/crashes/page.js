import { Suspense } from "react";
import { requireAdminPage } from "@/server/auth/webSession";
import { listCrashes } from "@/server/crashes";
import { Card, Loading, formatDate } from "../../ui";

// Crashes the app has reported, most recent first. The heading shows at once;
// the list loads in its own boundary.
export default function AdminCrashes() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Crashes</h1>
      <Suspense fallback={<Loading />}>
        <Crashes />
      </Suspense>
    </div>
  );
}

async function Crashes() {
  await requireAdminPage();
  const crashes = await listCrashes();
  if (!crashes.length) {
    return (
      <Card>
        <p className="text-sm text-zinc-500">No crashes reported in the last 90 days.</p>
      </Card>
    );
  }
  return crashes.map((crash) => (
    <Card key={crash.id}>
      <div className="flex flex-col gap-2 text-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-semibold break-words">{crash.name}</p>
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-900 dark:bg-red-900/40 dark:text-red-200">
            {crash.occurrences} {crash.occurrences === 1 ? "time" : "times"}
          </span>
        </div>
        {crash.message ? <p className="break-words">{crash.message}</p> : null}
        <p className="text-xs text-zinc-500">
          {crash.appVersion} ({crash.versionCode}) · {crash.source === "js" ? "JavaScript" : "Native"}
          {crash.device ? ` · ${crash.device}` : ""}
          {crash.androidVersion ? ` · Android ${crash.androidVersion}` : ""}
        </p>
        <p className="text-xs text-zinc-500">
          First seen {formatDate(crash.firstSeenAt)} · Last seen {formatDate(crash.lastSeenAt)}
        </p>
        {crash.stack ? (
          <details>
            <summary className="cursor-pointer text-xs font-medium text-emerald-700 dark:text-emerald-400">Stack trace</summary>
            <pre className="mt-2 max-h-96 overflow-auto rounded-lg bg-zinc-100 p-3 text-xs whitespace-pre-wrap dark:bg-zinc-800">{crash.stack}</pre>
          </details>
        ) : null}
      </div>
    </Card>
  ));
}
