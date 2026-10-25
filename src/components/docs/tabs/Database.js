import { C, Code, Lead, List, Note, P, Section, Table } from "../ui";

export default function Database() {
  return (
    <>
      <Lead>
        The server’s tables in TiDB (all defined in <C>database/schema.sql</C>) and the phone’s own SQLite database.
      </Lead>

      <Section id="server" title="Server tables">
        <Table
          head={["Table", "Holds", "Key columns"]}
          rows={[
            [<C key="1">users</C>, "Accounts", "email (unique), password_hash (argon2id), role, status, timezone, week_start_day, currency, sync_seq, last_active_at"],
            [<C key="2">refresh_tokens</C>, "Sign-in sessions (app and admin panel)", "token_hash (SHA-256), family_id, expires_at, revoked_at, replaced_by"],
            [<C key="3">email_codes</C>, "Verification and reset codes", "purpose, code_hash (HMAC), expires_at, attempts, used_at"],
            [<C key="4">rate_limits</C>, "Attempt counters", "bucket (e.g. login:email:…), window_start, hits"],
            [<C key="5">habits · habit_marks</C>, "Daily habits; done / missed per day", "started_on, archived_on · habit_id, mark_date, status"],
            [<C key="6">weeks · weekly_tasks</C>, "Motivation per week; weekly tasks", "start_date, motivation · week_start, done, carried_from_id, carried_to_id"],
            [<C key="7">reminders</C>, "Notes and money", "kind, text, remind_at, done, person, amount_minor (paise), currency, direction"],
            [<C key="8">lessons</C>, "Journal", "title_enc, body_enc (encrypted), lesson_date, tags (JSON)"],
            [<C key="9">books · book_readings · reading_goals</C>, "Book tracker", "title, author, genre · read_number, type, status, start/end, rating · year, target"],
            [<C key="10">announcements · announcement_recipients</C>, "Announcements; the inbox", "audience · read_at, dismissed_at, push_status"],
            [<C key="11">device_tokens</C>, "Phones registered for push", "token, user_id, platform, last_seen_at"],
            [<C key="12">export_tokens</C>, "One-time download links", "token_hash, format, expires_at, used_at"],
            [<C key="13">app_settings</C>, "Admin settings (log switches, retention)", "setting_key, value (JSON)"],
            [<C key="14">activity_logs</C>, "Activity logs", "created_at, category, event, user_id, actor_id, email, ip, user_agent, details"],
          ]}
        />
        <Note>
          Deleting a user deletes everything of theirs (foreign keys with <C>ON DELETE CASCADE</C>). Activity logs have no
          foreign keys on purpose: they stay readable until the retention period removes them.
        </Note>
      </Section>

      <Section id="synced" title="Columns every synced table has">
        <Table
          head={["Column", "Purpose"]}
          rows={[
            [<C key="1">user_id + id</C>, "The primary key starts with user_id, so records of different users can never collide or be overwritten"],
            [<C key="2">updated_at</C>, "Phone time (ms) of the last edit; the newer edit wins"],
            [<C key="3">deleted_at</C>, "Set instead of deleting, so deletions reach other devices"],
            [<C key="4">server_seq</C>, "The user’s change counter when the row last changed; the phone pulls everything after its cursor"],
          ]}
        />
      </Section>

      <Section id="phone" title="The phone’s database">
        <List>
          <li>One SQLite file per account (<C>planner-&lt;userId&gt;.db</C>), deleted on sign-out.</li>
          <li>Same record types and fields (camelCase), plus <C>dirty</C> = 1 while a change hasn’t reached the server.</li>
          <li>A <C>meta</C> table holds the sync cursor, last sync time and reminder settings.</li>
          <li>Schema changes on the phone use <C>PRAGMA user_version</C> steps in <C>src/data/database.js</C> (bump <C>SCHEMA_VERSION</C>, add a step).</li>
        </List>
      </Section>

      <Section id="changes" title="Changing the server schema">
        <P>
          Every statement in <C>schema.sql</C> can run again safely, and it runs on every <C>npm run dev</C> start (and with{" "}
          <C>npm run db:setup</C>). To add something, append to the file:
        </P>
        <Code>{`CREATE TABLE IF NOT EXISTS new_table ( … );
ALTER TABLE users ADD COLUMN IF NOT EXISTS nickname VARCHAR(50) NULL;`}</Code>
        <Note type="warn">
          TiDB uses strict SQL: in a <C>GROUP BY</C> query, every selected column must be grouped or aggregated (see
          Troubleshooting). Always pass values as <C>?</C> parameters, never by building the SQL string.
        </Note>
      </Section>
    </>
  );
}
