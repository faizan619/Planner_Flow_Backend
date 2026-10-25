// Readable names for log events in the admin panel.
export const EVENT_LABELS = {
  signup: "Signed up",
  email_verified: "Verified email",
  email_verify_failed: "Wrong verification code",
  login: "Signed in",
  login_failed: "Sign-in failed",
  admin_login_failed: "Admin sign-in failed",
  password_reset_requested: "Asked for a password reset",
  password_reset: "Reset password",
  password_reset_failed: "Password reset failed",
  refresh_token_reused: "Old sign-in reused (possible theft)",
  rate_limited: "Blocked: too many attempts",
  account_deleted: "Deleted account",
  user_deactivated: "Deactivated a user",
  user_reactivated: "Reactivated a user",
  announcement_sent: "Sent an announcement",
  announcement_deleted: "Deleted an announcement",
  log_settings_changed: "Changed log settings",
  app_active: "Used the app",
  profile_updated: "Updated profile",
  books_import_previewed: "Previewed a book import",
  data_exported: "Exported data",
  device_registered: "Registered phone for push",
};

export const CATEGORY_LABELS = { security: "Security", admin: "Admin", usage: "Usage" };

export const eventLabel = (event) => EVENT_LABELS[event] ?? event.replace(/_/g, " ");

// Short "key: value" text for a log's details.
export function describeDetails(details) {
  if (!details) return "";
  return Object.entries(details)
    .map(([key, value]) => `${key}: ${typeof value === "object" && value !== null ? JSON.stringify(value) : value}`)
    .join(" · ");
}
