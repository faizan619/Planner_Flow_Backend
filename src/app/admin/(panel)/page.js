import { Suspense } from "react";
import Link from "next/link";
import { stats } from "@/server/admin";
import { feedbackCounts } from "@/server/feedback";
import { requireAdminPage } from "@/server/auth/webSession";
import { isPushConfigured } from "@/server/push";
import { Card, Loading } from "../ui";

// The title shows straight away; the numbers load inside their own boundary.
export default function AdminOverview() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Overview</h1>
      <Suspense fallback={<Loading />}>
        <Overview />
      </Suspense>
    </div>
  );
}

async function Overview() {
  await requireAdminPage();
  const [numbers, feedback] = await Promise.all([stats(), feedbackCounts()]);
  const tiles = [
    ["Total users", numbers.total],
    ["Active in the last 7 days", numbers.activeThisWeek],
    ["New in the last 7 days", numbers.newThisWeek],
    ["Deactivated", numbers.deactivated],
  ];

  return (
    <>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {tiles.map(([label, value]) => (
          <Card key={label}>
            <p className="text-sm text-zinc-500">{label}</p>
            <p className="text-3xl font-bold">{value}</p>
          </Card>
        ))}
      </div>
      <Link href="/admin/feedback" className="block">
        <Card className={feedback.new ? "border-amber-300 dark:border-amber-700" : ""}>
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <p className="text-sm text-zinc-500">New feedback</p>
              <p className="text-3xl font-bold">{feedback.new}</p>
            </div>
            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
              {feedback.open} to look at · {feedback.total} in all →
            </span>
          </div>
        </Card>
      </Link>
      <Card title="Push notifications">
        {isPushConfigured() ? (
          <p className="text-sm text-emerald-700 dark:text-emerald-400">Firebase is set up: announcements are pushed to phones.</p>
        ) : (
          <p className="text-sm text-zinc-500">
            Firebase isn’t set up yet (FIREBASE_SERVICE_ACCOUNT), so announcements only reach the in-app inbox.
          </p>
        )}
      </Card>
    </>
  );
}
