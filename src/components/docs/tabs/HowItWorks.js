import { C, Code, Lead, List, Note, P, Section, Steps, Table } from "../ui";

export default function HowItWorks() {
  return (
    <>
      <Lead>What happens behind the scenes: one API request, signing in, and how the phone and server stay in sync.</Lead>

      <Section id="request" title="1. One API request, start to finish">
        <Steps>
          <li>The app calls <C>/api/v1/…</C> through <C>src/api/client.js</C> with <C>Authorization: Bearer &lt;access token&gt;</C>.</li>
          <li>
            The route file wraps its work in <C>route()</C> (<C>src/server/http.js</C>). <C>readJson(request, Schema)</C> parses
            the body and checks it with zod; bad input stops here with a 400.
          </li>
          <li>
            <C>requireUser(request)</C> verifies the token <em>and reloads the user from the database</em>, so a deactivated or
            demoted account is refused on its very next request. Admin routes add <C>{"{ role: \"admin\" }"}</C>.
          </li>
          <li>A module in <C>src/server</C> runs the SQL. Values always go in as <C>?</C> parameters (no SQL injection), and every query includes the user’s id.</li>
          <li>The answer is JSON. Errors always look the same, so the app shows them in one place:</li>
        </Steps>
        <Code>{`{ "error": { "code": "VALIDATION_ERROR", "message": "Please check the highlighted fields",
             "fields": { "email": ["Enter a valid email address"] } } }`}</Code>
        <P>
          Logging and other side work (push, “last active”) runs in <C>after()</C>, once the response has been sent, so it never
          slows the app down and a failure there never breaks the request.
        </P>
      </Section>

      <Section id="signup" title="2. Signing up and signing in">
        <Steps>
          <li><strong>Sign up</strong> (<C>POST /auth/signup</C>): the account is created unverified; a 6-digit code is emailed. Only an HMAC of the code is stored; it lasts 15 minutes and 5 wrong tries burn it.</li>
          <li><strong>Verify</strong> (<C>POST /auth/verify-email</C>): the right code marks the email verified and signs the user in.</li>
          <li><strong>Sign in</strong> (<C>POST /auth/login</C>): wrong password and unknown email give the <em>same</em> error, so nobody can test which emails have accounts. Unverified accounts are sent to the code screen.</li>
          <li><strong>Forgot password</strong>: a reset code by email; setting the new password signs the account out on every device.</li>
        </Steps>
        <Table
          head={["Token", "What it is", "Lifetime", "Stored"]}
          rows={[
            ["Access token", "JWT (HS256) with the user id and role, sent on every request", "15 minutes", "Phone: SecureStore. Server: not stored"],
            ["Refresh token", "48 random bytes, exchanged for a new pair when the access token expires", "30 days, replaced on every use", "Phone: SecureStore. Server: only its SHA-256"],
          ]}
        />
        <Note title="Token theft protection">
          Each sign-in starts a token “family”. Using a refresh token replaces it; if an old one ever comes back (someone copied
          it), the whole family is revoked: that device is signed out, and the event is logged as “Old sign-in reused”.
        </Note>
        <P>
          In the app, a 401 makes <C>client.js</C> refresh once (parallel requests share one refresh) and retry. If refreshing
          fails, the app signs out.
        </P>
      </Section>

      <Section id="sync" title="3. Offline sync">
        <P>
          The phone keeps all planner data in its own SQLite database (<C>src/data/database.js</C>), one file per account. Screens
          read and write it directly, so everything works offline. A changed row is marked <C>dirty</C> until the server has it.
        </P>
        <Code>{`phone edits a record ──► SQLite row (dirty = 1, updatedAt = now)
                                  │
       sync: a moment after an edit · on open · back online · every 2 min
                                  │
POST /api/v1/sync { cursor, changes: { habits: [...], weeklyTasks: [...], ... } }
                                  │
   server: lock the user's row → for each record keep the NEWER updatedAt
           → give each saved record the next number (server_seq) → reply with
           everything after the phone's cursor (pages of 300, hasMore)
                                  │
phone: rows it sent are clean again; server rows are written unless the
       phone has a newer unsent edit; new cursor saved`}</Code>
        <Table
          head={["Rule", "How"]}
          rows={[
            ["Newest edit wins", "Each record carries updatedAt (phone time, ms). An older version never overwrites a newer one"],
            ["Clocks can’t cheat", "A time more than a minute in the future is cut to now + 60 s"],
            ["Deletions sync too", "Deleting sets deletedAt (a “tombstone”) instead of removing the row"],
            ["Nobody touches others’ data", "Every table’s key starts with user_id, so the same record id from another user lands in their own copy"],
            ["Children need their own parent", "A mark must belong to one of your habits; a reading to one of your books"],
            ["No marks in the future", "Marks dated after tomorrow (user’s time zone) are refused"],
            ["One bad record doesn’t block the rest", "Invalid records are returned in rejected[]; the phone stops resending them"],
            ["Big downloads come in pages", "At most 300 records per reply; hasMore asks for the next page"],
            ["Cursor out of step", "A cursor from the future (account recreated) triggers a full resync"],
          ]}
        />
        <Table
          head={["Record type", "What it holds"]}
          rows={[
            ["habits · habitMarks", "Daily habits and their done / missed marks (id = habitId_date)"],
            ["weeks · weeklyTasks", "Motivation per week; weekly tasks with carry links"],
            ["reminders", "Notes and money entries"],
            ["lessons", "Journal entries (encrypted on the server)"],
            ["books · bookReadings · readingGoals", "Books, each reading of them, yearly goals"],
          ]}
        />
        <List>
          <li>Failed syncs retry by themselves after 5 s, 10 s, 20 s… up to every 5 minutes; the badge shows “Sync failed · retrying”.</li>
          <li>Signing out first sends what it can, warns about anything unsent, then deletes the phone’s copy.</li>
        </List>
      </Section>

      <Section id="panel" title="4. The admin panel">
        <Steps>
          <li><C>src/proxy.js</C> sends visitors without the <C>pf_admin</C> cookie to <C>/admin/login</C> before anything renders.</li>
          <li>Signing in sets an httpOnly, SameSite=Lax cookie holding a refresh token (stored hashed), so deactivation or a password reset ends panel sessions too.</li>
          <li>Each page shows its title at once and loads its data inside its own loading boundary, where it checks the admin role again (<C>requireAdminPage()</C>).</li>
          <li>Buttons and forms run Server Actions in <C>src/app/admin/actions.js</C>. Each checks the admin role itself; Next.js also refuses actions from other websites.</li>
        </Steps>
      </Section>
    </>
  );
}
