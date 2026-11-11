"use client";

import { useActionState, useState } from "react";
import { replyFeedbackAction } from "../../actions";
import { SubmitButton } from "../../ui";

// "Reply" under a feedback message: opens a box; sending puts the reply in
// the user's in-app inbox (and pushes it), and marks the feedback done.
export function ReplyForm({ feedbackId, name }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(replyFeedbackAction, null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        Reply
      </button>
    );
  }
  return (
    <form action={action} className="flex w-full flex-col gap-2">
      <input type="hidden" name="feedbackId" value={feedbackId} />
      {state?.error ? <p className="rounded-lg bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">{state.error}</p> : null}
      <textarea
        name="message"
        rows={4}
        maxLength={1500}
        required
        autoFocus
        defaultValue={state?.message ?? ""}
        placeholder={`Reply to ${name}. It goes to their in-app inbox.`}
        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-600 dark:border-zinc-700 dark:bg-zinc-900"
      />
      <div className="flex gap-2">
        <SubmitButton pending={pending}>Send reply</SubmitButton>
        <button type="button" onClick={() => setOpen(false)} className="text-xs font-medium text-zinc-500 hover:underline">
          Cancel
        </button>
      </div>
    </form>
  );
}
