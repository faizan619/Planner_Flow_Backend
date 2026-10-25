import { C, Code, Lead, Note, P, Section, Steps, Table } from "../ui";

export default function Setup() {
  return (
    <>
      <Lead>Everything needed to run Planner Flow on a new computer, from an empty folder to the app on your phone.</Lead>

      <Section id="needs" title="1. What you need">
        <Table
          head={["Thing", "Why"]}
          rows={[
            ["Node.js 22 or newer (24 is used)", "Runs the server, tests and Expo tools"],
            ["A TiDB Cloud database", "The server’s data (free tier is enough)"],
            ["A Gmail account with an App password", "Sends verification and reset codes"],
            ["An Expo account (expo.dev)", "Cloud builds of the app"],
            ["A Firebase project", "Push notifications (optional; the inbox works without it)"],
            ["An Android phone on the same Wi-Fi as the PC", "Runs the development app"],
          ]}
        />
      </Section>

      <Section id="backend" title="2. The server (planner_flow_backend)">
        <Steps>
          <li>Install packages: <C>npm install</C></li>
          <li>Copy <C>.env.example</C> to <C>.env</C> and fill it in (table below).</li>
          <li>Create the tables: <C>npm run db:setup</C>. In development this also happens automatically when the server starts.</li>
          <li>Start it: <C>npm run dev</C> → <C>http://localhost:3000</C> (and your PC’s Wi-Fi IP, port 3000, for the phone).</li>
          <li>Sign up in the app, then make yourself admin: <C>npm run make-admin -- you@example.com</C></li>
        </Steps>
        <Table
          head={["Variable", "What it is", "Notes"]}
          rows={[
            [<C key="1">DATABASE_URL</C>, "TiDB connection string", "mysql://USER:PASSWORD@HOST:4000/DATABASE"],
            [<C key="2">JWT_SECRET</C>, "Signs access tokens and email codes", "48+ random characters"],
            [<C key="3">ENCRYPTION_KEY</C>, "Encrypts journal text (AES-256-GCM)", "32 random bytes, base64. Never change it once lessons exist"],
            [<C key="4">SMTP_USER / SMTP_PASS / MAIL_FROM</C>, "Gmail address, its App password, sender name", "App password needs 2-Step Verification"],
            [<C key="5">MAIL_MODE</C>, "file = save emails in .mail-outbox/; smtp = really send", "Production always sends"],
            [<C key="6">FIREBASE_SERVICE_ACCOUNT</C>, "Firebase service-account key, base64", "Optional; without it push is off"],
            [<C key="7">CRON_SECRET</C>, "Protects the daily cleanup job", "Any long random string"],
            [<C key="8">AUTO_MIGRATE</C>, "Apply schema.sql on start", "Default: on in development only"],
          ]}
        />
        <Code>{`# random secrets
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"   # JWT_SECRET, CRON_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"      # ENCRYPTION_KEY

# Firebase key → one base64 line (PowerShell)
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\\dev\\Planner_keystore\\firebase-service-account.json"))`}</Code>
      </Section>

      <Section id="app" title="3. The app (Planner_Flow)">
        <Steps>
          <li>Install packages: <C>npm install</C></li>
          <li>
            Create <C>.env.local</C> with your PC’s Wi-Fi address (find it with <C>ipconfig</C> → IPv4 Address):
            <Code>{`EXPO_PUBLIC_API_URL=http://10.133.252.178:3000`}</Code>
            Never <C>localhost</C>: on the phone that means the phone itself.
          </li>
          <li>Install the development app once (cloud build, see Builds &amp; release), then start the bundler: <C>npx expo start --dev-client</C></li>
          <li>Open <strong>Planner Flow</strong> on the phone. It connects to the bundler on your PC; scan the QR code inside the app if asked.</li>
        </Steps>
        <Note type="warn" title="Expo Go vs the development app">
          Since push notifications were added, the app runs in its own development build (Expo Go can’t receive push). Press{" "}
          <C>s</C> in the bundler terminal if you ever want to switch back to Expo Go for a quick look.
        </Note>
      </Section>

      <Section id="daily" title="4. Everyday commands">
        <Table
          head={["Where", "Command", "What it does"]}
          rows={[
            ["Server", <C key="1">npm run dev</C>, "Start the server (port 3000)"],
            ["Server", <C key="2">npm test</C>, "Run the API tests on a separate test database"],
            ["Server", <C key="3">npm run lint</C>, "Check the code"],
            ["Server", <C key="4">npm run db:setup</C>, "Apply database/schema.sql (safe to repeat)"],
            ["Server", <C key="5">npm run make-admin -- email</C>, "Give an account the admin role"],
            ["App", <C key="6">npx expo start --dev-client</C>, "Start the bundler for the development app"],
            ["App", <C key="7">npm test</C>, "Run the tests of the app’s rules"],
            ["App", <C key="8">npx expo lint</C>, "Check the code"],
            ["App", <C key="9">npx expo-doctor</C>, "Check packages and config"],
          ]}
        />
        <P>
          After changing <C>.env.local</C> restart the bundler with <C>npx expo start --dev-client --clear</C>: Expo reads it only at start-up.
        </P>
      </Section>
    </>
  );
}
