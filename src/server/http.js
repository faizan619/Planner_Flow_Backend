import "server-only";
import { z } from "zod";

// Shared helpers for /api/v1 route handlers.
//
//   export const POST = route(async (request) => {
//     const body = await readJson(request, Schema);   // 400 on bad input
//     const user = await requireUser(request);        // 401 / 403
//     return ok({ thing });
//   });
//
// Every error response has the same shape so the app can handle it in one place:
//   { error: { code: "VALIDATION_ERROR", message: "…", fields?: { email: ["…"] } } }

export class ApiError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

export const ok = (data, status = 200) => Response.json(data, { status });
export const noContent = () => new Response(null, { status: 204 });

export function errorResponse(status, code, message, extra = {}) {
  const { headers, ...fields } = extra;
  return Response.json({ error: { code, message, ...fields } }, { status, headers });
}

// Wraps a handler so thrown ApiErrors become JSON responses and anything
// unexpected becomes a 500 without leaking details (or request bodies) to logs.
export function route(handler) {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      if (error instanceof ApiError) {
        return errorResponse(error.status, error.code, error.message, error.extra);
      }
      const url = new URL(request.url);
      console.error(`${request.method} ${url.pathname} failed:`, error?.code ?? "", error?.message);
      return errorResponse(500, "SERVER_ERROR", "Something went wrong. Please try again.");
    }
  };
}

// Parses the JSON body and validates it with a zod schema.
export async function readJson(request, schema) {
  const body = await request.json().catch(() => undefined);
  if (body === undefined) throw new ApiError(400, "INVALID_JSON", "Request body must be JSON");
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ApiError(400, "VALIDATION_ERROR", "Please check the highlighted fields", {
      fields: z.flattenError(result.error).fieldErrors,
    });
  }
  return result.data;
}

// Client IP for rate limiting. On Vercel, x-forwarded-for is set by the platform.
export function clientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
