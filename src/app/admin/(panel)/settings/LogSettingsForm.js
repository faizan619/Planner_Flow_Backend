"use client";

import { useActionState } from "react";
import { saveLogSettingsAction } from "../../actions";
import { SubmitButton } from "../../ui";

const TYPES = [
  ["security", "Security", "Sign-ins, failed sign-ins, sign-ups, email checks, password resets, blocked attempts, deleted accounts."],
  ["admin", "Admin", "What admins do: deactivating or reactivating users, sending announcements."],
  ["usage", "Usage", "Using the app (at most once every 10 minutes per user), imports, exports, profile changes."],
];

// Which log types are recorded, and how long entries are kept.
export function LogSettingsForm({ settings }) {
  const [state, action, pending] = useActionState(saveLogSettingsAction, null);
  const current = state?.settings ?? settings;

  return (
    <form action={action} className="flex flex-col gap-5">
      {state?.error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{state.error}</p> : null}
      {state?.success ? <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">{state.success}</p> : null}

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium">Record these logs</legend>
        {TYPES.map(([key, label, description]) => (
          <label key={key} className="flex items-start gap-3 text-sm">
            <input type="checkbox" name={key} defaultChecked={current[key]} className="mt-1 h-4 w-4 accent-emerald-700" />
            <span>
              <span className="font-semibold">{label}</span>
              <span className="block text-zinc-500">{description}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Keep log entries for (days)
        <input
          type="number"
          name="retentionDays"
          min={7}
          max={365}
          required
          defaultValue={current.retentionDays}
          className="w-32 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
        />
        <span className="font-normal text-zinc-500">Between 7 and 365. Older entries are deleted every night. The default is 45.</span>
      </label>

      <p className="text-xs text-zinc-500">
        Changes to these settings are always recorded in the admin log, even when the admin log is switched off.
      </p>
      <div>
        <SubmitButton pending={pending}>Save</SubmitButton>
      </div>
    </form>
  );
}
