"use client";

import { useFormStatus } from "react-dom";
import { deleteAnnouncementAction } from "../../actions";

function Button() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="text-xs font-semibold text-red-700 hover:underline disabled:opacity-60 dark:text-red-400">
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}

// Deletes an announcement for everyone, after a confirmation.
export function DeleteAnnouncementButton({ id, title }) {
  return (
    <form
      action={deleteAnnouncementAction}
      onSubmit={(event) => {
        const sure = window.confirm(
          `Delete “${title}” for everyone?\n\nIt disappears from every user's inbox and from this list. Push notifications already on phones can't be recalled. This can't be undone.`
        );
        if (!sure) event.preventDefault();
      }}
    >
      <input type="hidden" name="announcementId" value={id} />
      <Button />
    </form>
  );
}
