"use client";

import { useState } from "react";

// Password input with a Show / Hide button.
export function PasswordField({ label, name, ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      <span className="relative flex">
        <input
          name={name}
          type={visible ? "text" : "password"}
          className="w-full rounded-lg border border-zinc-300 bg-white py-2 pl-3 pr-16 text-base outline-none focus:border-emerald-600 dark:border-zinc-700 dark:bg-zinc-900"
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 px-3 text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
        >
          {visible ? "Hide" : "Show"}
        </button>
      </span>
    </label>
  );
}
