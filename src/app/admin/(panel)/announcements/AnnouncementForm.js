"use client";

import { useActionState, useState } from "react";
import { sendAnnouncementAction } from "../../actions";
import { Field, SubmitButton } from "../../ui";

// What kind (a message, a poll or a question), title, message and who gets
// it. Sending puts it in each user's in-app inbox and pushes it to their
// phones. Everyone can react with an emoji; a poll takes votes, a question
// takes private answers (they arrive on the Feedback page).
const KINDS = [
  { value: "message", label: "💬 Message", hint: "News or an update. People can react with an emoji." },
  { value: "poll", label: "📊 Poll", hint: "2–5 options; each person votes once and sees the results." },
  { value: "question", label: "❓ Question", hint: "People write you a private answer. Answers arrive on the Feedback page." },
];
const OPTION_FIELDS = 5;

export function AnnouncementForm({ users }) {
  const [state, action, pending] = useActionState(sendAnnouncementAction, null);
  const [audience, setAudience] = useState("all");
  const [kind, setKind] = useState("message");
  const [filter, setFilter] = useState("");
  const values = state?.values ?? {};
  const shown = users.filter((user) => `${user.name} ${user.email}`.toLowerCase().includes(filter.toLowerCase()));

  return (
    // Remount after a successful send so the fields clear.
    <form key={state?.success ?? "form"} action={action} className="flex flex-col gap-4">
      {state?.error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{state.error}</p> : null}
      {state?.success ? <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">{state.success}</p> : null}

      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="mb-1 font-medium">What kind?</legend>
        <div className="flex flex-wrap gap-2">
          {KINDS.map((option) => (
            <label
              key={option.value}
              className={`cursor-pointer rounded-full border px-3 py-1 font-medium ${
                kind === option.value ? "border-emerald-700 bg-emerald-700 text-white" : "border-zinc-300 dark:border-zinc-700"
              }`}
            >
              <input type="radio" name="kind" value={option.value} checked={kind === option.value} onChange={() => setKind(option.value)} className="sr-only" />
              {option.label}
            </label>
          ))}
        </div>
        <p className="text-zinc-500">{KINDS.find((option) => option.value === kind).hint}</p>
      </fieldset>

      <Field label="Title" name="title" maxLength={120} required defaultValue={values.title} />
      <Field
        label={kind === "poll" ? "Question for the poll" : kind === "question" ? "Your question" : "Message"}
        name="body"
        maxLength={2000}
        required
        multiline
        defaultValue={values.body}
      />

      {kind === "poll" ? (
        <fieldset className="flex flex-col gap-2 text-sm">
          <legend className="mb-1 font-medium">Options (at least 2)</legend>
          {Array.from({ length: OPTION_FIELDS }, (_, index) => (
            <input
              key={index}
              name="options"
              maxLength={60}
              placeholder={`Option ${index + 1}${index < 2 ? "" : " (optional)"}`}
              className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
            />
          ))}
        </fieldset>
      ) : null}

      {kind !== "message" ? (
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{kind === "poll" ? "Voting closes after" : "Answers close after"}</span>
          <select name="closesInDays" defaultValue="" className="w-48 rounded-md border border-zinc-300 bg-white px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900">
            <option value="">Never (stays open)</option>
            <option value="1">1 day</option>
            <option value="3">3 days</option>
            <option value="7">7 days</option>
            <option value="14">14 days</option>
            <option value="30">30 days</option>
          </select>
        </label>
      ) : null}

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
        <SubmitButton pending={pending}>{kind === "poll" ? "Send poll" : kind === "question" ? "Send question" : "Send announcement"}</SubmitButton>
      </div>
    </form>
  );
}
