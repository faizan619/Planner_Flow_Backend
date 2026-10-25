// Small building blocks for the documentation pages (admin panel → Docs).

export function Section({ id, title, children }) {
  return (
    <section id={id} className="flex scroll-mt-6 flex-col gap-3 border-t border-zinc-200 pt-6 dark:border-zinc-800">
      <h2 className="text-xl font-bold">{title}</h2>
      {children}
    </section>
  );
}

export function Sub({ title, children }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-base font-semibold">{title}</h3>
      {children}
    </div>
  );
}

export function Lead({ children }) {
  return <p className="text-lg leading-relaxed text-zinc-600 dark:text-zinc-300">{children}</p>;
}

export function P({ children }) {
  return <p className="leading-relaxed text-zinc-700 dark:text-zinc-300">{children}</p>;
}

// rows: array of arrays; cells may be strings or JSX.
export function Table({ head, rows }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="bg-zinc-50 text-zinc-500 dark:bg-zinc-900">
          <tr>
            {head.map((cell) => (
              <th key={cell} scope="col" className="px-3 py-2 font-semibold">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-t border-zinc-100 align-top dark:border-zinc-800">
              {row.map((cell, i) => (
                <td key={i} className={`px-3 py-2 ${i === 0 ? "font-medium" : "text-zinc-700 dark:text-zinc-300"}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Code({ children }) {
  return (
    <pre className="overflow-x-auto rounded-lg bg-zinc-900 p-4 text-[13px] leading-relaxed text-zinc-100">
      <code>{children}</code>
    </pre>
  );
}

// Inline code.
export function C({ children }) {
  return <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[0.85em] text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">{children}</code>;
}

const NOTE_STYLES = {
  info: "border-sky-300 bg-sky-50 text-sky-950 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100",
  warn: "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100",
  good: "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100",
};

export function Note({ type = "info", title, children }) {
  return (
    <div className={`rounded-lg border-l-4 p-3 text-sm leading-relaxed ${NOTE_STYLES[type]}`}>
      {title ? <strong className="mb-1 block">{title}</strong> : null}
      <div>{children}</div>
    </div>
  );
}

export function Steps({ children }) {
  return <ol className="ml-5 flex list-decimal flex-col gap-2 leading-relaxed text-zinc-700 marker:font-bold marker:text-emerald-700 dark:text-zinc-300">{children}</ol>;
}

export function List({ children }) {
  return <ul className="ml-5 flex list-disc flex-col gap-1.5 leading-relaxed text-zinc-700 dark:text-zinc-300">{children}</ul>;
}

export function Ext({ href, children }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-emerald-700 hover:underline dark:text-emerald-400">
      {children} ↗
    </a>
  );
}
