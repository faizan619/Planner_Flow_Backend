import { C, Lead, List, Note, Section, Table } from "../ui";

export default function Security() {
  return (
    <>
      <Lead>How accounts and data are protected, and a checklist for keeping it that way.</Lead>

      <Section id="protections" title="Protections in place">
        <Table
          head={["Risk", "Protection", "Where"]}
          rows={[
            ["Stolen database", "Passwords hashed with argon2id; refresh tokens, codes and export links stored only as hashes; journal text encrypted", <C key="1">auth/*, crypto.js</C>],
            ["Guessing passwords or codes", "Rate limits per IP and per email; codes expire in 15 min and die after 5 wrong tries", <C key="2">rateLimit.js, codes.js</C>],
            ["Finding which emails have accounts", "Same error for unknown email and wrong password; forgot-password always answers the same; dummy hash keeps timing equal", <C key="3">auth routes</C>],
            ["Someone else’s data (IDOR)", "Every query filters by the signed-in user; synced tables’ keys start with user_id; marks/readings must point at your own habit/book", <C key="4">sync.js</C>],
            ["Stolen sign-in", "Short access tokens; refresh tokens rotate and reuse revokes the whole family; password reset signs out everywhere", <C key="5">tokens.js</C>],
            ["Deactivated / demoted users", "User and role reloaded on every request and every admin page/action", <C key="6">session.js, webSession.js</C>],
            ["Bad input", "zod validation on every body and record; one bad record is rejected without blocking the rest", <C key="7">validation.js, sync.js</C>],
            ["SQL injection", "Only parameterised queries (?)", <C key="8">all of src/server</C>],
            ["Admin panel CSRF", "Server Actions are POST-only with an Origin check; cookie is httpOnly, SameSite=Lax, Secure in production, path /admin", <C key="9">webSession.js</C>],
            ["Leaky logs", "Logs never store passwords, codes, tokens or user text; secret-looking keys are dropped before writing", <C key="10">logs.js</C>],
            ["Secrets in git", ".env, credentials.json and the keystore are git-ignored; only .env.example is committed", <C key="11">.gitignore</C>],
            ["Lost phone", "Optional PIN lock with growing waits after wrong tries; tokens in the Android Keystore", <C key="12">Planner_Flow/src/lock</C>],
          ]}
        />
      </Section>

      <Section id="privacy" title="Privacy">
        <List>
          <li>Only the user can read their journal. Admins can’t, and logs don’t contain it.</li>
          <li>Usage logs record that something happened (“Exported data”, “Updated profile: name”), never the content.</li>
          <li>Deleting an account removes all of its data from the server and the phone; its log entries expire with the retention period.</li>
          <li>The phone’s own copy is readable on that phone (needed for offline search); the PIN lock protects it.</li>
        </List>
      </Section>

      <Section id="checklist" title="Checklist">
        <List>
          <li>Keep <C>ENCRYPTION_KEY</C>, <C>JWT_SECRET</C>, the Firebase key and <C>C:\dev\Planner_keystore</C> backed up somewhere safe. Losing <C>ENCRYPTION_KEY</C> makes journal entries unreadable.</li>
          <li>Never paste secrets into chats, issues or screenshots. If one leaks, replace it (a new <C>JWT_SECRET</C> signs everyone out; a new Firebase key is made in the Firebase console).</li>
          <li>Run <C>npm test</C> before every deploy; all tests must pass.</li>
          <li>Keep packages up to date (<C>npm outdated</C>, <C>npx expo install --check</C>) and read the release notes for Next.js and Expo.</li>
          <li>Check the Logs page now and then for many failed sign-ins or “Old sign-in reused”.</li>
        </List>
        <Note type="warn">
          Admins can see emails, IP addresses and activity of every user. Give the admin role only to people you trust, and
          mention the logs and their retention period in the privacy policy.
        </Note>
      </Section>
    </>
  );
}
