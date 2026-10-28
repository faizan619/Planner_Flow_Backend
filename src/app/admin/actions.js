"use server";

import { after } from "next/server";
import { headers } from "next/headers";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { setUserStatus } from "@/server/admin";
import { NewAnnouncement, createAnnouncement, deleteAnnouncement } from "@/server/announcements";
import { burnPasswordCheck, verifyPassword } from "@/server/auth/password";
import { ipFromHeaders } from "@/server/clientIp";
import { endAdminSession, requireAdminPage, startAdminSession } from "@/server/auth/webSession";
import { ApiError } from "@/server/http";
import { actionMeta, logEvent, updateLogSettings } from "@/server/logs";
import { pushAnnouncement } from "@/server/push";
import { rateLimit } from "@/server/rateLimit";
import { LogSettings } from "@/server/settings";
import { findUserByEmail } from "@/server/users";
import { Login } from "@/server/validation";

// Server Actions for the admin panel. Every action re-checks the admin
// role itself — page and layout checks don't protect actions.

const clientIp = async () => ipFromHeaders(await headers());

export async function loginAction(_previous, formData) {
  const parsed = Login.safeParse({ email: formData.get("email") ?? "", password: formData.get("password") ?? "" });
  if (!parsed.success) return { error: "Enter your email and password." };
  const { email, password } = parsed.data;

  try {
    await rateLimit(`admin-login:ip:${await clientIp()}`, { limit: 20, windowSeconds: 900 });
    await rateLimit(`login:email:${email}`, { limit: 5, windowSeconds: 900 });
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    throw error;
  }

  const meta = await actionMeta();
  const user = await findUserByEmail(email);
  const fail = (reason) =>
    logEvent(meta, { category: "security", event: "admin_login_failed", userId: user?.id ?? null, email, details: { reason } });

  if (!user) {
    await burnPasswordCheck(password);
    fail("unknown email");
    return { error: "Wrong email or password." };
  }
  if (!(await verifyPassword(user.passwordHash, password))) {
    fail("wrong password");
    return { error: "Wrong email or password." };
  }
  if (user.role !== "admin" || user.status !== "active") {
    fail(user.role !== "admin" ? "not an admin" : "account deactivated");
    return { error: "This account can't use the admin panel." };
  }

  await startAdminSession(user, (await headers()).get("user-agent"));
  logEvent(meta, { category: "security", event: "login", userId: user.id, email: user.email, details: { via: "admin panel" } });
  redirect("/admin");
}

export async function logoutAction() {
  await endAdminSession();
  redirect("/admin/login");
}

const StatusForm = z.object({ userId: z.string().regex(/^\d+$/), status: z.enum(["active", "deactivated"]) });

export async function setUserStatusAction(formData) {
  const admin = await requireAdminPage();
  const { userId, status } = StatusForm.parse({ userId: formData.get("userId"), status: formData.get("status") });
  await setUserStatus(admin, userId, status, await actionMeta());
  refresh();
}

export async function sendAnnouncementAction(_previous, formData) {
  const admin = await requireAdminPage();
  const parsed = NewAnnouncement.safeParse({
    title: formData.get("title") ?? "",
    body: formData.get("body") ?? "",
    audience: formData.get("audience") ?? "all",
    userIds: formData.getAll("userIds"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form.", values: Object.fromEntries(formData) };
  }

  let announcement;
  try {
    announcement = await createAnnouncement(admin, parsed.data, await actionMeta());
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message, values: Object.fromEntries(formData) };
    throw error;
  }
  after(() => pushAnnouncement(announcement).catch((error) => console.error("push failed:", error.message)));
  refresh();
  return { success: `Sent to ${announcement.recipients} user${announcement.recipients === 1 ? "" : "s"}.` };
}

export async function saveLogSettingsAction(_previous, formData) {
  const admin = await requireAdminPage();
  const parsed = LogSettings.safeParse({
    security: formData.get("security") === "on",
    admin: formData.get("admin") === "on",
    usage: formData.get("usage") === "on",
    retentionDays: Number(formData.get("retentionDays")),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const settings = await updateLogSettings(admin, parsed.data, await actionMeta());
  refresh();
  return { success: "Saved.", settings };
}

const AnnouncementId = z.string().regex(/^\d+$/);

export async function deleteAnnouncementAction(formData) {
  const admin = await requireAdminPage();
  const id = AnnouncementId.parse(formData.get("announcementId"));
  await deleteAnnouncement(admin, id, await actionMeta());
  refresh();
}
