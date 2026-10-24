import { ApiError, ok, route } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { rateLimit } from "@/server/rateLimit";
import { interpretSheet, readSheet } from "@/server/bookImport";
import { logEvent, requestMeta } from "@/server/logs";

const MAX_BYTES = 2 * 1024 * 1024;

// POST /api/v1/books/import/preview — multipart form with `file` (.xlsx or .csv)
// → { columns, rows: [{ row, ok, data, errors, warnings }], summary }.
// Only reads the file; the app saves the rows the user accepts.
export const POST = route(async (request) => {
  const user = await requireUser(request);
  await rateLimit(`import:user:${user.id}`, { limit: 30, windowSeconds: 3600 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file === "string") throw new ApiError(400, "NO_FILE", "Choose a .xlsx or .csv file to import");
  if (file.size > MAX_BYTES) throw new ApiError(413, "FILE_TOO_LARGE", "That file is over 2 MB");

  let sheet;
  try {
    sheet = await readSheet(Buffer.from(await file.arrayBuffer()), file.name);
  } catch (error) {
    throw new ApiError(400, "UNREADABLE_FILE", error.message.startsWith("That Excel") ? error.message : "That file couldn't be read. Use .xlsx or .csv.");
  }

  const result = interpretSheet(sheet);
  if (result.error) throw new ApiError(400, "INVALID_SHEET", result.error, { missing: result.missing });
  logEvent(requestMeta(request), {
    category: "usage",
    event: "books_import_previewed",
    userId: user.id,
    email: user.email,
    details: result.summary,
  });
  return ok(result);
});
