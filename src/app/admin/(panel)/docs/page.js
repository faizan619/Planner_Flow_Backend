import { Suspense } from "react";
import Link from "next/link";
import { requireAdminPage } from "@/server/auth/webSession";
import Api from "@/components/docs/tabs/Api";
import Builds from "@/components/docs/tabs/Builds";
import Database from "@/components/docs/tabs/Database";
import Features from "@/components/docs/tabs/Features";
import HowItWorks from "@/components/docs/tabs/HowItWorks";
import Notifications from "@/components/docs/tabs/Notifications";
import Overview from "@/components/docs/tabs/Overview";
import Security from "@/components/docs/tabs/Security";
import Setup from "@/components/docs/tabs/Setup";
import Structure from "@/components/docs/tabs/Structure";
import Tests from "@/components/docs/tabs/Tests";
import Troubleshooting from "@/components/docs/tabs/Troubleshooting";
import Week from "@/components/docs/tabs/Week";
import { Loading } from "../../ui";

export const metadata = { title: "Docs · Planner Flow" };

// To add a tab: create a component in src/components/docs/tabs and list it here.
const TABS = [
  { key: "overview", label: "Overview", hint: "What the project is", Component: Overview },
  { key: "setup", label: "Getting started", hint: "Install, configure, run", Component: Setup },
  { key: "structure", label: "Project structure", hint: "Where things live", Component: Structure },
  { key: "how-it-works", label: "How it works", hint: "Requests, sign-in, sync", Component: HowItWorks },
  { key: "week", label: "The week page", hint: "Habits, marks, tasks, streaks", Component: Week },
  { key: "features", label: "Features", hint: "Reminders, journal, books, settings", Component: Features },
  { key: "notifications", label: "Notifications & admin", hint: "Reminders, push, inbox, logs", Component: Notifications },
  { key: "api", label: "API reference", hint: "Every endpoint", Component: Api },
  { key: "database", label: "Database", hint: "Tables, sync columns, phone DB", Component: Database },
  { key: "security", label: "Security & privacy", hint: "Protections and checklist", Component: Security },
  { key: "tests", label: "Tests", hint: "What is tested, how to run", Component: Tests },
  { key: "builds", label: "Builds & release", hint: "EAS, keystore, Vercel", Component: Builds },
  { key: "troubleshooting", label: "Troubleshooting", hint: "Problems met and fixes", Component: Troubleshooting },
];

const href = (key) => `/admin/docs?tab=${key}`;

export default function DocsPage({ searchParams }) {
  return (
    <Suspense fallback={<Loading />}>
      <Docs searchParams={searchParams} />
    </Suspense>
  );
}

async function Docs({ searchParams }) {
  await requireAdminPage();
  const { tab } = await searchParams;
  const index = Math.max(0, TABS.findIndex((item) => item.key === tab));
  const current = TABS[index];
  const previous = TABS[index - 1];
  const next = TABS[index + 1];
  const Content = current.Component;

  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
      <nav aria-label="Documentation" className="lg:sticky lg:top-6 lg:w-64 lg:shrink-0">
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-500">Documentation</p>
        <ul className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
          {TABS.map((item, i) => {
            const active = item.key === current.key;
            return (
              <li key={item.key} className="shrink-0">
                <Link
                  href={href(item.key)}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-start gap-3 rounded-lg px-3 py-2 text-sm ${
                    active ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                      active ? "bg-emerald-700 text-white" : "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="flex flex-col">
                    <span className="font-medium">{item.label}</span>
                    <small className="hidden text-xs text-zinc-500 lg:block">{item.hint}</small>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <article className="flex min-w-0 max-w-3xl flex-1 flex-col gap-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            Docs · {index + 1} of {TABS.length}
          </p>
          <h1 className="text-3xl font-bold">{current.label}</h1>
        </div>

        <Content />

        <div className="mt-4 flex justify-between gap-4 border-t border-zinc-200 pt-5 dark:border-zinc-800">
          {previous ? (
            <Link href={href(previous.key)} className="flex flex-col rounded-lg px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <small className="text-xs text-zinc-500">Previous</small>
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">← {previous.label}</span>
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link href={href(next.key)} className="flex flex-col items-end rounded-lg px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <small className="text-xs text-zinc-500">Next</small>
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">{next.label} →</span>
            </Link>
          ) : null}
        </div>
      </article>
    </div>
  );
}
