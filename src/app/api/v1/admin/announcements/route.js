import { after } from "next/server";
import { ok, readJson, route } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { NewAnnouncement, createAnnouncement, listAnnouncements } from "@/server/announcements";
import { pushAnnouncement } from "@/server/push";
import { requestMeta } from "@/server/logs";
import { idempotent, IDEMPOTENCY_TTL } from "@/server/idempotency";

// GET /api/v1/admin/announcements — admins only.
export const GET = route(async (request) => {
  await requireUser(request, { role: "admin" });
  return ok({ announcements: await listAnnouncements() });
});

// POST /api/v1/admin/announcements — { title, body, audience: "all" | "selected", userIds? }
// Saves it to every recipient's inbox, answers, then sends the push.
const handlePost = route(async (request) => {
  const admin = await requireUser(request, { role: "admin" });
  const announcement = await createAnnouncement(admin, await readJson(request, NewAnnouncement), requestMeta(request));
  after(() => pushAnnouncement(announcement).catch((error) => console.error("push failed:", error.message)));
  return ok({ announcement }, 201);
});

// A retry with the same Idempotency-Key gets the same answer instead of running twice.
export const POST = idempotent(handlePost, { ttlSeconds: IDEMPOTENCY_TTL.default });
