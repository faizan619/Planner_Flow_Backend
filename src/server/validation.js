import "server-only";
import { z } from "zod";

// zod schemas for request bodies. Route handlers pass these to readJson().

export const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address").max(254));

export const password = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(128, "Use at most 128 characters");

export const code = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Enter the 6-digit code");

export const name = z.string().trim().min(1, "Enter your name").max(100);

export const timezone = z
  .string()
  .max(64)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "Unknown time zone");

export const Signup = z.object({ name, email, password, timezone: timezone.optional() });
export const Login = z.object({ email, password: z.string().min(1, "Enter your password").max(128) });
export const EmailOnly = z.object({ email });
export const VerifyEmail = z.object({ email, code });
export const ResetPassword = z.object({ email, code, password });
export const RefreshToken = z.object({ refreshToken: z.string().min(20).max(200) });

export const UpdateMe = z
  .object({
    name,
    timezone,
    weekStartDay: z.number().int().min(1).max(7),
    currency: z.string().regex(/^[A-Z]{3}$/, "Use a 3-letter currency code"),
  })
  .partial();

export const DeleteMe = z.object({ password: z.string().min(1, "Enter your password").max(128) });
