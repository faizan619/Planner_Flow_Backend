import { C, Lead, Section, Table } from "../ui";

// Problems actually met while building Planner Flow, and their fixes.
const PROBLEMS = [
  ["App", [
    ["Sync failed · “Can’t reach the server”", <>Check <C key="a">.env.local</C>: it must be your PC’s Wi-Fi IP, not localhost. Phone and PC on the same Wi-Fi; allow Node through Windows Firewall. Restart with <C key="b">npx expo start --dev-client --clear</C> after changing it. The IP changes when you switch networks (<C key="c">ipconfig</C>).</>],
    ["“Unmatched Route” on start", "A signed-in guard needs an explicit redirectTo; the root layout sends signed-out users to /login and signed-in users to /."],
    ["Red “duplicate key” error on a list", "Two items had the same React key (e.g. the keypad’s blank cell used index 9 next to the “9” key). Give every item a unique key."],
    ["“Require cycle” warning", "Two files imported each other (LockProvider ↔ LockScreen). Shared pieces moved to lockContext.js."],
    ["Push notifications don’t arrive", "Use the development/release app (not Expo Go), allow notifications, restart the server after setting FIREBASE_SERVICE_ACCOUNT. The announcement history shows sent / no device / failed."],
    ["New icon not showing", "Icons need a new build; after installing, restart the phone if the launcher still shows the old one."],
    ["Settings changes need internet", "Name, week start, time zone and currency are saved on the server; planner data works offline."],
  ]],
  ["Server", [
    ["“Another next dev server is already running”", <>Only one dev server per build folder. The tests use their own (<C key="a">NEXT_DIST_DIR=.next-test</C>).</>],
    ["only_full_group_by error", "TiDB/MySQL strict mode: every selected column must be in GROUP BY or aggregated."],
    ["“Uncached data during a navigation” (instant)", "Admin pages show their title at once and load data inside their own <Suspense>; the shared layout reads no data."],
    ["Hydration warning about attributes", "Usually a browser extension changing <html>/<body>. Try an incognito window; those two tags ignore attribute differences."],
    ["A request returns 500 instead of 400", "Use safeParse for query parameters and throw ApiError(400…); route() turns unexpected errors into 500."],
    ["Lessons can’t be read", "ENCRYPTION_KEY changed. Restore the original key; never rotate it without re-encrypting."],
    ["Everyone got signed out", "JWT_SECRET changed (new tokens are needed); normal after rotating it."],
  ]],
  ["Builds and tools", [
    ["EAS asks to install expo-dev-client / makes eas.json in the wrong place", <>You’re in <C key="a">planner_flow_backend</C>. Run EAS from <C key="b">Planner_Flow</C>.</>],
    ["expo lint can’t install (react-dom conflict)", <><C key="a">npx expo install react-dom</C> pins the version matching React.</>],
    ["Folder can’t be renamed or deleted (Windows)", "VS Code’s Java extension or a Gradle daemon holds files. Close VS Code or run gradlew --stop."],
    ["Phone shows an old version", <>Press <C key="a">r</C> in the bundler, or restart it with <C key="b">--clear</C>.</>],
  ]],
];

export default function Troubleshooting() {
  return (
    <>
      <Lead>Problems met while building Planner Flow, and how each was fixed.</Lead>
      {PROBLEMS.map(([group, rows]) => (
        <Section key={group} id={group.toLowerCase().replace(/\W+/g, "-")} title={group}>
          <Table head={["Problem", "Fix"]} rows={rows} />
        </Section>
      ))}
    </>
  );
}
