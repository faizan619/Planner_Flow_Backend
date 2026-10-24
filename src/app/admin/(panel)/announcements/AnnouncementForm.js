"use client";

import { useActionState, useState } from "react";
import { sendAnnouncementAction } from "../../actions";
import { Field, SubmitButton } from "../../ui";

// Title, message and who gets it. Sending puts it in each user's in-app
// inbox and pushes it to their phones.
export function AnnouncementForm({ users }) {
  const [state, action, pending] = useActionState(sendAnnouncementAction, null);
  const [audience, setAudience] = useState("all");
  const [filter, setFilter] = useState("");
  const values = state?.values ?? {};
  const shown = users.filter((user) => `${user.name} ${user.email}`.toLowerCase().includes(filter.toLowerCase()));

  return (
    // Remount after a successful send so the fields clear.
    <form key={state?.success ?? "form"} action={action} className="flex flex-col gap-4">
      {state?.error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{state.error}</p> : null}
      {state?.success ? <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">{state.success}</p> : null}

      <Field label="Title" name="title" maxLength={120} required defaultValue={values.title} />
      <Field label="Message" name="body" maxLength={2000} required multiline defaultValue={values.body} />

      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="mb-1 font-medium">Send to</legend>
        <label className="flex items-center gap-2">
          <input type="radio" name="audience" value="all" checked={audience === "all"} onChange={() => setAudience("all")} />
          All active users ({users.length})
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="audience" value="selected" checked={audience === "selected"} onChange={() => setAudience("selected")} />
          Selected users
        </label>
      </fieldset>

      {audience === "selected" ? (
        <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter users"
            className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <div className="max-h-64 overflow-y-auto">
            {users.map((user) => (
              // Hidden (not removed) when filtered out, so earlier ticks are kept.
              <label key={user.id} className={`flex items-center gap-2 py-1 text-sm ${shown.includes(user) ? "" : "hidden"}`}>
                <input type="checkbox" name="userIds" value={user.id} />
                <span className="font-medium">{user.name}</span>
                <span className="text-zinc-500">{user.email}</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      <div>
        <SubmitButton pending={pending}>Send announcement</SubmitButton>
      </div>
    </form>
  );
}
