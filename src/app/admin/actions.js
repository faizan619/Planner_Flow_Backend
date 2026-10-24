"use server";

import { after } from "next/server";
import { headers } from "next/headers";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { setUserStatus } from "@/server/admin";
import { NewAnnouncement, createAnnouncement } from "@/server/announcements";
import { burnPasswordCheck, verifyPassword } from "@/server/auth/password";
import { endAdminSession, requireAdminPage, startAdminSession } from "@/server/auth/webSession";
import { ApiError } from "@/server/http";
import { pushAnnouncement } from "@/server/push";
import { rateLimit } from "@/server/rateLimit";
import { findUserByEmail } from "@/server/users";
import { Login } from "@/server/validation";

// Server Actions for the admin panel. Every action re-checks the admin
// role itself — page and layout checks don't protect actions.

async function clientIp() {
  const list = await headers();
  return list.get("x-forwarded-for")?.split(",")[0].trim() ?? list.get("x-real-ip") ?? "unknown";
}

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

  const user = await findUserByEmail(email);
  if (!user) {
    await burnPasswordCheck(password);
    return { error: "Wrong email or password." };
  }
  if (!(await verifyPassword(user.passwordHash, password))) return { error: "Wrong email or password." };
  if (user.role !== "admin" || user.status !== "active") return { error: "This account can't use the admin panel." };

  await startAdminSession(user, (await headers()).get("user-agent"));
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
  await setUserStatus(admin, userId, status);
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
    announcement = await createAnnouncement(admin, parsed.data);
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message, values: Object.fromEntries(formData) };
    throw error;
  }
  after(() => pushAnnouncement(announcement).catch((error) => console.error("push failed:", error.message)));
  refresh();
  return { success: `Sent to ${announcement.recipients} user${announcement.recipients === 1 ? "" : "s"}.` };
}
