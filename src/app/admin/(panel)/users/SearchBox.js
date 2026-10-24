"use client";

import { useSearchParams } from "next/navigation";

// The user search form, pre-filled with the current ?q=.
export function SearchBox() {
  const query = useSearchParams().get("q") ?? "";
  return (
    <form className="flex gap-2" role="search">
      <input
        key={query}
        name="q"
        defaultValue={query}
        placeholder="Search name or email"
        aria-label="Search users by name or email"
        className="w-64 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      <button
        type="submit"
        className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        Search
      </button>
    </form>
  );
}
