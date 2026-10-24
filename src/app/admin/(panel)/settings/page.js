import { Suspense } from "react";
import { requireAdminPage } from "@/server/auth/webSession";
import { getSetting } from "@/server/settings";
import { Card, Loading } from "../../ui";
import { LogSettingsForm } from "./LogSettingsForm";

export default function AdminSettings() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <Suspense fallback={<Loading />}>
        <Settings />
      </Suspense>
    </div>
  );
}

async function Settings() {
  await requireAdminPage();
  const settings = await getSetting("logs");
  return (
    <Card title="Activity logs">
      <LogSettingsForm settings={settings} />
    </Card>
  );
}
