import { LoginForm } from "./LoginForm";

export const metadata = { title: "Admin sign in · Planner Flow" };

export default function AdminLoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-16">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Planner Flow</p>
        <h1 className="text-2xl font-bold">Admin sign in</h1>
        <p className="mt-1 text-sm text-zinc-500">Use the same email and password as the app. Only admin accounts can sign in here.</p>
      </div>
      <LoginForm />
    </main>
  );
}
