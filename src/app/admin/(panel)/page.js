import { stats } from "@/server/admin";
import { requireAdminPage } from "@/server/auth/webSession";
import { isPushConfigured } from "@/server/push";
import { Card } from "../ui";

export default async function AdminOverview() {
  await requireAdminPage();
  const numbers = await stats();
  const tiles = [
    ["Total users", numbers.total],
    ["Active in the last 7 days", numbers.activeThisWeek],
    ["New in the last 7 days", numbers.newThisWeek],
    ["Deactivated", numbers.deactivated],
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Overview</h1>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {tiles.map(([label, value]) => (
          <Card key={label}>
            <p className="text-sm text-zinc-500">{label}</p>
            <p className="text-3xl font-bold">{value}</p>
          </Card>
        ))}
      </div>
      <Card title="Push notifications">
        {isPushConfigured() ? (
          <p className="text-sm text-emerald-700 dark:text-emerald-400">Firebase is set up: announcements are pushed to phones.</p>
        ) : (
          <p className="text-sm text-zinc-500">
            Firebase isn’t set up yet (FIREBASE_SERVICE_ACCOUNT), so announcements only reach the in-app inbox.
          </p>
        )}
      </Card>
    </div>
  );
}
