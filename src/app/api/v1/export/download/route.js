import { connection } from "next/server";
import { route } from "@/server/http";
import { buildWorkbook, collectUserData, exportFileName, redeemExportLink } from "@/server/export";
import { findUserById } from "@/server/users";

const page = (message, status) =>
  new Response(`<!doctype html><meta name="viewport" content="width=device-width"><title>Planner Flow</title><p style="font:16px system-ui;padding:24px">${message}</p>`, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });

// GET /api/v1/export/download?token=… — the file itself. Each link works once,
// for 10 minutes; the token alone identifies the user.
export const GET = route(async (request) => {
  await connection();
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const link = /^[\w-]{20,100}$/.test(token) ? await redeemExportLink(token) : null;
  if (!link) return page("This download link has expired or was already used. Ask for a new one in the app: Settings → Export my data.", 410);

  const user = await findUserById(link.userId);
  if (!user || user.status !== "active") return page("This account isn't available.", 403);

  const data = await collectUserData(user);
  const isExcel = link.format === "xlsx";
  const body = isExcel ? await buildWorkbook(data) : JSON.stringify(data, null, 2);
  return new Response(body, {
    headers: {
      "content-type": isExcel ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFileName(link.format)}"`,
      "cache-control": "no-store",
    },
  });
});
