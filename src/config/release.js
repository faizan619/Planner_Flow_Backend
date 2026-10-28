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

const version = "1.0.0";
const versionCode = 7;
const fileName = `planner-flow-${version}-${versionCode}.apk`;

export const release = {
  version,
  versionCode,
  fileName,
  releasedOn: "2026-10-28",
  sizeBytes: 110_321_861,
  // SHA-256 of the APK file, so people can check the download is intact.
  sha256: "e385988fb2cd5ce5f8298ea66b94501abba1827170f69b1b09e28ad8bb06c3eb",
  // SHA-256 of the signing certificate. The same for every version: Android
  // only installs an update signed with the same key.
  certificateSha256: "2d719fb45b33367015d3a1dfa2f0739b23992cd6d331a21eb989d48bead07a0a",
  minAndroid: "Android 7.0 or newer",
  downloadUrl: process.env.APK_DOWNLOAD_URL || `${REPO}/releases/download/v${version}-${versionCode}/${fileName}`,
  releasePage: `${REPO}/releases/tag/v${version}-${versionCode}`,
  whatsNew: [
    "Note reminders ring like a real alarm, with your choice of tone, or your own",
    "Write lesson notes with bold, headings, lists and a distraction-free full screen",
    "Unsaved writing is kept as a draft if the app closes",
    "Undo after deleting a habit, task, book or lesson",
    "A cleaner dashboard and smoother loading",
    "Stronger security: tighter sign-in protection and encrypted connections only",
  ],
};
