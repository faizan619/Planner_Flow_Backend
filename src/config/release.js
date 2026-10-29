// The Android app offered on /download. Update this for each new APK:
//
//   1. Build it: Planner_Flow → npm run build:release (→ dist/planner-flow-<version>-<code>.apk)
//   2. Checksum and size (PowerShell): Get-FileHash <apk> -Algorithm SHA256 ; (Get-Item <apk>).Length
//   3. GitHub → Planner_Flow_Backend → Releases → Draft a new release, tag `v<version>-<code>`,
//      attach the APK (keep its file name), publish.
//   4. Change the values below and deploy.
//
// The APK (≈100 MB) is too big for the repo or a Vercel deployment, so it
// lives on the GitHub release; APK_DOWNLOAD_URL can point somewhere else.

const REPO = "https://github.com/faizan619/Planner_Flow_Backend";

const version = "1.0.5";
const versionCode = 8;
const fileName = `planner-flow-${version}-${versionCode}.apk`;

export const release = {
  version,
  versionCode,
  fileName,
  releasedOn: "2026-10-29",
  sizeBytes: 110_346_449,
  // SHA-256 of the APK file, so people can check the download is intact.
  sha256: "513564964873a107f23fb7182077db976349982a33a4601a44feaa7c63417bff",
  // SHA-256 of the signing certificate. The same for every version: Android
  // only installs an update signed with the same key.
  certificateSha256: "2d719fb45b33367015d3a1dfa2f0739b23992cd6d331a21eb989d48bead07a0a",
  minAndroid: "Android 7.0 or newer",
  downloadUrl: process.env.APK_DOWNLOAD_URL || `${REPO}/releases/download/v${version}-${versionCode}/${fileName}`,
  releasePage: `${REPO}/releases/tag/v${version}-${versionCode}`,
  whatsNew: [
    "Give each habit its own daily reminder: a notification or an alarm, at the time you choose",
    "A friendly welcome and a quick tour of the app for new users (replay it from Settings)",
    "Note reminders ring like a real alarm, with your choice of tone, or your own",
    "Write lesson notes with bold, headings, lists and a distraction-free full screen, and read them in a clean view",
    "Unsaved writing is kept as a draft if the app closes",
    "Undo after deleting a habit, task, book or lesson",
    "Quick-add buttons on empty lists, a cleaner dashboard and smoother loading",
    "Stronger security: tighter sign-in protection and encrypted connections only",
  ],
};
