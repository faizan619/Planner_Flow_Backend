// The client's IP address, for rate limits and the security log.
//
// X-Forwarded-For is a list anyone can start: a client may send its own
// header, and proxies append to it. Trusting its first entry would let a
// client pick a new "IP" on every request and slip past every per-IP limit.
// So on Vercel (process.env.VERCEL) only headers the platform sets itself are
// used: x-real-ip, else the last x-forwarded-for entry (the one Vercel's edge
// added). Elsewhere (local `next dev`, the API tests) there's no trusted proxy,
// and the first entry is used so tests can pose as different clients.
//
// `headers` is a Headers object (request.headers or next/headers()).
export function ipFromHeaders(headers) {
  const forwarded = (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (process.env.VERCEL) return headers.get("x-real-ip") ?? forwarded.at(-1) ?? "unknown";
  return forwarded[0] ?? headers.get("x-real-ip") ?? "unknown";
}
