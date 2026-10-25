import { C, Code, Lead, List, Note, P, Section, Steps, Table } from "../ui";

export default function Features() {
  return (
    <>
      <Lead>Reminders, money, the journal, books, export and the app’s settings, and how each is built.</Lead>

      <Section id="reminders" title="1. Reminders and money">
        <List>
          <li><strong>Notes</strong>: text, optional reminder time, done. Open dated notes first (soonest first), then undated, then done; a past time shows “Overdue”.</li>
          <li><strong>Money</strong>: person, amount, I owe / owed to me, what for, settled. Totals add up unsettled entries per currency.</li>
          <li>Amounts are stored as whole <strong>paise</strong> (₹250.50 → 25050), so totals never pick up rounding errors, and shown with Indian grouping (₹1,00,000).</li>
        </List>
      </Section>

      <Section id="journal" title="2. Life lessons journal">
        <List>
          <li>Title, text (up to 5,000 characters), date and tags (lower-case, up to 10).</li>
          <li>Search matches every word across title, text and tags; tag chips filter; “On this day” shows lessons from today’s date in earlier years. All of this runs on the phone.</li>
        </List>
        <Note type="good" title="Encrypted at rest">
          The server stores title and text with AES-256-GCM (<C>src/server/crypto.js</C>) using <C>ENCRYPTION_KEY</C>. The user
          id, lesson id and field name are bound into each value, so encrypted text copied into another row or account can’t be
          decrypted there; such a row is withheld instead of shown. Tags stay readable for filtering.
        </Note>
      </Section>

      <Section id="books" title="3. Book tracker and import">
        <P>
          A <strong>book</strong> (title, author, genre) can have several <strong>readings</strong> (Sr No, type, status, start, end,
          rating), so a re-read is Read #2 of the same book. A <strong>reading goal</strong> is set per year.
        </P>
        <Table
          head={["Rule", "Where it’s enforced"]}
          rows={[
            ["End date can’t be before start date", "Phone form and server (src/server/books.js)"],
            ["Rating (1–5) only when the status is Completed", "Phone form and server"],
            ["A planned book has no end date", "Phone form and server"],
            ["Same title + author (ignoring case and spaces) = same book", "Adding a book and importing"],
          ]}
        />
        <Steps>
          <li>Books → Import → pick an .xlsx or .csv file. The file goes to <C>POST /api/v1/books/import/preview</C>.</li>
          <li>The server reads it (<C>src/server/bookImport.js</C>): finds columns by name (Sr No, Book Title, Author, Genre, Type, Start Date, End Date, Status, Rating and common variants), reads Excel dates and DD/MM/YYYY text, understands words like Kindle or done, and checks every row. Nothing is saved.</li>
          <li>The phone shows ready rows and rows with problems (by spreadsheet row number).</li>
          <li>Import: the phone groups rows into books (matching books you already have), numbers re-reads, skips rows already imported, saves to its database, and syncs.</li>
        </Steps>
        <P>Stats for a year count readings completed that year: per month, by genre and type, average rating, re-reads.</P>
      </Section>

      <Section id="export" title="4. Export my data">
        <Steps>
          <li>Settings → Your data → Excel or JSON calls <C>POST /api/v1/export/link</C>.</li>
          <li>The server returns a one-time link valid for 10 minutes (only a hash of it is stored) and the phone opens it in the browser.</li>
          <li><C>GET /api/v1/export/download?token=…</C> builds the file and the browser saves it to Downloads. A second use shows “expired”.</li>
        </Steps>
        <P>
          Excel has a sheet each for Books (tracker columns, so it imports back), Reading goals, Habits, Habit marks, Weekly tasks,
          Motivation, Notes, Money, Life lessons and Inbox. JSON is the complete backup.
        </P>
      </Section>

      <Section id="settings" title="5. Settings, theme and PIN lock">
        <Table
          head={["Setting", "How it works"]}
          rows={[
            ["Name, week start, time zone, currency", <>Saved on the server with <C key="m">PATCH /api/v1/me</C> (needs internet)</>],
            ["Theme: System / Light / Dark", "Stored on the phone; applied app-wide with Appearance.setColorScheme"],
            ["Reminder times", "Stored on the phone (reminders are scheduled there)"],
            ["Sign out", "Syncs first, warns about unsent changes, stops reminders and push, deletes the phone’s copy"],
            ["Delete my account", "Password needed; deletes everything on the server (cascade) and the phone"],
          ]}
        />
        <P><strong>PIN lock</strong> (<C>src/lock</C>, rules in <C>src/lib/lock.js</C>):</P>
        <List>
          <li>4–6 digits, typed twice. Only a salted SHA-256 of it is kept, in SecureStore; it never leaves the phone.</li>
          <li>Locks when the app opens and when it comes back after 30+ seconds away.</li>
          <li>5 free tries, then waits of 30 s, 1 min, 2 min… up to 15 min, even across restarts.</li>
          <li>“Forgot PIN?” signs out; signing back in with the password removes the PIN.</li>
        </List>
      </Section>

      <Section id="nav" title="6. Navigation and small touches">
        <List>
          <li>Floating pill tab bar: the active tab grows into a labelled chip. <C>MODERN_NAV</C> in <C>src/config/ui.js</C> switches back to the classic bar.</li>
          <li>Swipe between tabs: right-to-left goes to the next tab (Week → Dashboard → … → Books), left-to-right goes back; the pages sit side by side, like Instagram, so while swiping you see the current page and the next one moving together; on release it springs to the nearest page, or the next one on a quick flick (past the first or last tab it only stretches a little). Pages are drawn ahead of time, so there’s no blank flash. Only clearly sideways swipes count (<C>src/lib/swipe.js</C>, <C>components/nav/PagerTabs.js</C>, a small pure-JS tab navigator), so scrolling and taps aren’t affected.</li>
          <li>Quick add (+) actions: Weekly motivation, New habit, Weekly task, Reminder note, Money entry, Life lesson, Add book.</li>
          <li>Quick add (+): opens the right form on its tab by navigating with <C>?add=habit&amp;t=…</C>; <C>t</C> makes every tap a new request.</li>
          <li>Every pop-up sheet closes on a tap outside it, on ✕, or with Back. Password fields have a show / hide eye.</li>
        </List>
        <Code>{`Planner_Flow/src/config/ui.js
export const MODERN_NAV = true;   // false = classic bottom tabs, no quick add`}</Code>
      </Section>
    </>
  );
}
