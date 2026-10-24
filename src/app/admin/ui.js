// Small shared pieces for the admin panel's pages (Tailwind).

export function Field({ label, name, multiline, ...props }) {
  const className =
    "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base outline-none focus:border-emerald-600 dark:border-zinc-700 dark:bg-zinc-900";
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      {multiline ? <textarea name={name} rows={5} className={className} {...props} /> : <input name={name} className={className} {...props} />}
    </label>
  );
}

export function SubmitButton({ pending, children, tone = "primary" }) {
  const tones = {
    primary: "bg-emerald-700 text-white hover:bg-emerald-800",
    danger: "border border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950",
    plain: "border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800",
  };
  return (
    <button
      type="submit"
      disabled={pending}
      className={`rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60 ${tones[tone]}`}
    >
      {pending ? "Working…" : children}
    </button>
  );
}

export function Card({ title, children, className = "" }) {
  return (
    <section className={`rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 ${className}`}>
      {title ? <h2 className="mb-3 text-lg font-semibold">{title}</h2> : null}
      {children}
    </section>
  );
}

export function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}
