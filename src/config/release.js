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

const version = "1.0.9";
const versionCode = 12;
const fileName = `planner-flow-${version}-${versionCode}.apk`;

export const release = {
  version,
  versionCode,
  fileName,
  releasedOn: "2026-11-03",
  sizeBytes: 110_464_661,
  // SHA-256 of the APK file, so people can check the download is intact.
  sha256: "71cc48efa88d7dbe125c84e02617dd95c0412b34aa21005584a3decf48e92c7a",
  // SHA-256 of the signing certificate. The same for every version: Android
  // only installs an update signed with the same key.
  certificateSha256: "2d719fb45b33367015d3a1dfa2f0739b23992cd6d331a21eb989d48bead07a0a",
  minAndroid: "Android 7.0 or newer",
  // The app (1.0.6 and later) asks people to update when a newer versionCode
  // is out. Versions below this one must update: no "Later".
  //   minor update (optional): leave this as it is
  //   major update (required): set it to the new versionCode
  // Never lower it (exception: 1.0.7 was withdrawn on 2026-10-30, back to 1.0.6, optional).
  minimumVersionCode: 12, // 1.0.9: a major update, required
  downloadUrl: process.env.APK_DOWNLOAD_URL || `${REPO}/releases/download/v${version}-${versionCode}/${fileName}`,
  releasePage: `${REPO}/releases/tag/v${version}-${versionCode}`,
  whatsNew: [
    "Track your money: add expenses and income, see what came in, what went out and what’s left each month",
    "Monthly budgets with a heads-up at 80%, a yearly report, search, and a tap to see each category’s entries",
    "Split a bill with a friend: your share counts as spending, theirs goes to Lent & borrowed",
    "Forms now move above the keyboard, so fields and Save buttons are never hidden",
    "Books: mark a book finished in one tap from its page, and see your rating in the Done list",
  ],
};
