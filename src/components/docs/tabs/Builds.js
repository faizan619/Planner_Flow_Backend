import { C, Code, Lead, List, Note, P, Section, Steps, Table } from "../ui";

export default function Builds() {
  return (
    <>
      <Lead>How the Android app is built and installed, what needs a new build, and how the server goes online.</Lead>

      <Section id="profiles" title="1. Build profiles (eas.json)">
        <Table
          head={["Profile", "What you get", "Server address"]}
          rows={[
            [<C key="1">development</C>, "The development app: loads your code from the bundler on the PC (npx expo start --dev-client)", "Your PC’s Wi-Fi IP"],
            [<C key="2">preview</C>, "A standalone APK with the code built in, for testing without the PC", "Your PC’s Wi-Fi IP"],
            [<C key="3">production</C>, "The release APK for everyone", "The Vercel address (set during release)"],
          ]}
        />
        <Code>{`cd Planner_Flow
npx eas-cli@latest build -p android --profile development   # or preview / production`}</Code>
        <P>
          Builds run in Expo’s cloud (your PC builds nothing). When done, open the link on the phone and install. Every profile
          is signed with the same key, so a new build installs over the old one and keeps the data.
        </P>
      </Section>

      <Section id="rebuild" title="2. When is a new build needed?">
        <Table
          head={["Change", "New build?"]}
          rows={[
            ["Screens, logic, styles (JavaScript)", "No: the development app reloads (press r in the bundler)"],
            ["A package with native code (camera, fingerprint, share sheet…)", "Yes"],
            ["app.json: icon, splash, name, permissions, plugins", "Yes"],
            ["The server (planner_flow_backend)", "No: deploy the server; the app doesn’t change"],
            ["The release APK’s server address or code", "Yes (production build)"],
          ]}
        />
      </Section>

      <Section id="signing" title="3. Signing key and Firebase files">
        <Table
          head={["File", "Where", "Notes"]}
          rows={[
            ["Release keystore", <C key="1">C:\dev\Planner_keystore\planner-flow-release.jks</C>, "Alias planner-flow; password in keystore-info.txt next to it"],
            ["credentials.json", <C key="2">Planner_Flow/</C>, "Points EAS at the keystore; git-ignored"],
            ["Firebase service-account key", <C key="3">C:\dev\Planner_keystore\firebase-service-account.json</C>, "Secret; base64 in FIREBASE_SERVICE_ACCOUNT"],
            ["google-services.json", <C key="4">Planner_Flow/</C>, "Firebase app config; safe to commit"],
          ]}
        />
        <Note type="warn" title="Back up C:\dev\Planner_keystore">
          If the keystore or its password is lost, phones with the app can’t take updates (they would have to uninstall first).
        </Note>
      </Section>

      <Section id="icon" title="4. Icon and splash">
        <P>
          The icon is a cream diary page with two “done” lines and a red “missed” zigzag on the app’s green. Files in{" "}
          <C>Planner_Flow/assets</C>: <C>icon.png</C>, adaptive layers <C>android-icon-foreground/background.png</C>, themed{" "}
          <C>android-icon-monochrome.png</C>, <C>splash-icon.png</C>, <C>favicon.png</C>. The splash (expo-splash-screen in
          app.json) uses the paper colour, or dark in dark mode. Changing them needs a new build.
        </P>
      </Section>

      <Section id="release" title="5. Going online (release)">
        <Steps>
          <li>Push <C>planner_flow_backend</C> to GitHub and import it in Vercel.</li>
          <li>In Vercel → Settings → Environment Variables, add every variable from <C>.env</C> (Production). Use real SMTP; <C>MAIL_MODE</C> is ignored in production.</li>
          <li>Deploy. Vercel reads <C>vercel.json</C> and schedules the daily cleanup; it sends <C>CRON_SECRET</C> automatically.</li>
          <li>Run <C>npm run db:setup</C> against the production database whenever <C>schema.sql</C> changes (or set <C>AUTO_MIGRATE=true</C>).</li>
          <li>Put the Vercel address in <C>eas.json</C> → production → <C>EXPO_PUBLIC_API_URL</C>, then build the production APK.</li>
        </Steps>
        <List>
          <li>Check <C>https://YOUR-APP.vercel.app/api/v1/health</C> answers <C>{"{ ok: true }"}</C> after each deploy.</li>
        </List>
      </Section>
    </>
  );
}
