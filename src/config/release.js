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

const version = "1.0.8";
const versionCode = 11;
const fileName = `planner-flow-${version}-${versionCode}.apk`;

export const release = {
  version,
  versionCode,
  fileName,
  releasedOn: "2026-10-30",
  sizeBytes: 110_385_481,
  // SHA-256 of the APK file, so people can check the download is intact.
  sha256: "534d741bf163b968be9b3a219e4eb7bfdf2bd8e08782bdc5e1c08272cd669b8c",
  // SHA-256 of the signing certificate. The same for every version: Android
  // only installs an update signed with the same key.
  certificateSha256: "2d719fb45b33367015d3a1dfa2f0739b23992cd6d331a21eb989d48bead07a0a",
  minAndroid: "Android 7.0 or newer",
  // The app (1.0.6 and later) asks people to update when a newer versionCode
  // is out. Versions below this one must update: no "Later".
  //   minor update (optional): leave this as it is
  //   major update (required): set it to the new versionCode
  // Never lower it (exception: 1.0.7 was withdrawn on 2026-10-30, back to 1.0.6, optional).
  minimumVersionCode: 11, // 1.0.8: a major update, required
  downloadUrl: process.env.APK_DOWNLOAD_URL || `${REPO}/releases/download/v${version}-${versionCode}/${fileName}`,
  releasePage: `${REPO}/releases/tag/v${version}-${versionCode}`,
  whatsNew: [
    "Reminders for weekly tasks: a notification or an alarm, every day or only on the days you pick, until the task is done",
    "Tick a task off right from its alarm with the new Done button",
    "When a new week starts, choose which of last week’s unfinished tasks to carry over (their reminders come along)",
    "Fixes the app closing on its own when a reminder went off while it was closed",
    "Long lists of books, journal entries and done notes load in steps, so screens stay quick",
  ],
};
