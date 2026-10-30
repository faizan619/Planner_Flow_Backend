import { connection } from "next/server";
import { publicOrigin } from "@/server/http";
import { release } from "@/config/release";

// GET /api/v1/app/latest — the newest Android version, so the app can offer
// an update. Public (nothing personal, and signed-out installs ask too).
// Comes from src/config/release.js, the same place as the /download page.
//   → { version, versionCode, minimumVersionCode, releasedOn, whatsNew, downloadPage }
export async function GET(request) {
  await connection(); // read at request time, never baked in at build
  return Response.json({
    version: release.version,
    versionCode: release.versionCode,
    minimumVersionCode: release.minimumVersionCode,
    releasedOn: release.releasedOn,
    whatsNew: release.whatsNew,
    downloadPage: `${publicOrigin(request)}/download`,
  });
}
