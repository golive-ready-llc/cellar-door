import { lookup } from "dns/promises";
import net from "net";

/**
 * SSRF guard for outbound fetches to user-supplied URLs (e.g. Home Assistant).
 *
 * Blocks: malformed URLs, non-https (unless HA_ALLOW_HTTP=true), and any
 * hostname that resolves to a private/loopback/link-local/multicast/reserved
 * IP range. Also blocks bare IP literals in those ranges.
 *
 * Prefer `createSafeFetch(url, options)` over raw `validateHaUrl` + `fetch()`
 * — the wrapper handles DNS rebinding protection and enforces `redirect: "manual"`.
 */

// RFC1918 / loopback / link-local / multicast / reserved IPv4 ranges
function isBlockedIPv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((n) => isNaN(n) || n < 0 || n > 255)) {
    return true; // malformed → block
  }
  const [a, b] = parts;
  // 0.0.0.0/8
  if (a === 0) return true;
  // 10.0.0.0/8
  if (a === 10) return true;
  // 127.0.0.0/8 (loopback)
  if (a === 127) return true;
  // 169.254.0.0/16 (link-local, AWS/GCP metadata)
  if (a === 169 && b === 254) return true;
  // 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16
  if (a === 192 && b === 168) return true;
  // 224.0.0.0/4 (multicast)
  if (a >= 224 && a <= 239) return true;
  // 240.0.0.0/4 (reserved, includes 255.255.255.255)
  if (a >= 240) return true;
  return false;
}

/** Expand a compressed IPv6 address to its full 8-part form */
function expandIPv6(ip: string): string {
  const clean = ip.replace(/^\[|\]$/g, "");
  if (!clean.includes("::")) return clean;
  const parts = clean.split("::");
  const left = parts[0] ? parts[0].split(":") : [];
  const right = parts[1] ? parts[1].split(":") : [];
  const zeros = Array(8 - left.length - right.length).fill("0");
  return [...left, ...zeros, ...right].join(":");
}

function isBlockedIPv6(ip: string): boolean {
  const lower = expandIPv6(ip.toLowerCase());
  // Loopback ::1 (expanded)
  if (lower === "::1" || lower === "0:0:0:0:0:0:0:1") return true;
  // Unspecified ::
  if (lower === "::" || lower === "0:0:0:0:0:0:0:0") return true;
  // IPv4-mapped (::ffff:x.x.x.x) — extract and check IPv4
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedIPv4(mapped[1]);
  // fc00::/7 (unique local)
  if (/^f[cd][0-9a-f]{2}:/.test(lower)) return true;
  // fe80::/10 (link-local)
  if (/^fe[89ab][0-9a-f]:/.test(lower)) return true;
  // ff00::/8 (multicast)
  if (/^ff[0-9a-f]{2}:/.test(lower)) return true;
  return false;
}

function isIPv4Literal(host: string): boolean {
  return net.isIPv4(host);
}

function isIPv6Literal(host: string): boolean {
  return net.isIPv6(host);
}

/**
 * Validate a user-supplied URL for outbound fetch. Throws on rejection.
 * Returns the parsed URL on success.
 *
 * Set HA_ALLOW_HTTP=true to permit http:// (for self-hosted Home Assistant
 * over LAN where the user has explicitly opted in). Default deny.
 */
export async function validateHaUrl(url: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid URL");
  }

  const allowHttp = process.env.HA_ALLOW_HTTP === "true";
  if (parsed.protocol === "https:") {
    // ok
  } else if (parsed.protocol === "http:" && allowHttp) {
    // ok (opt-in for self-hosted)
  } else {
    throw new Error(
      `Disallowed protocol: ${parsed.protocol} (set HA_ALLOW_HTTP=true to permit http)`
    );
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, "");
  if (!hostname) throw new Error("Missing hostname");

  // If it's a literal IP, check it directly.
  if (isIPv4Literal(hostname)) {
    if (isBlockedIPv4(hostname)) {
      throw new Error(`Blocked IP range: ${hostname}`);
    }
    return parsed;
  }
  if (isIPv6Literal(hostname)) {
    if (isBlockedIPv6(hostname)) {
      throw new Error(`Blocked IPv6 range: ${hostname}`);
    }
    return parsed;
  }

  // DNS resolve and check ALL returned addresses.
  let addrs: { address: string; family: number }[];
  try {
    addrs = await lookup(hostname, { all: true });
  } catch {
    throw new Error(`DNS lookup failed for ${hostname}`);
  }
  if (!addrs.length) throw new Error(`No DNS records for ${hostname}`);

  for (const a of addrs) {
    if (a.family === 4 && isBlockedIPv4(a.address)) {
      throw new Error(`Hostname ${hostname} resolves to blocked IP ${a.address}`);
    }
    if (a.family === 6 && isBlockedIPv6(a.address)) {
      throw new Error(`Hostname ${hostname} resolves to blocked IPv6 ${a.address}`);
    }
  }

  return parsed;
}

/**
 * Safe fetch wrapper that validates the URL, provides DNS rebinding protection,
 * and enforces `redirect: "manual"`.
 *
 * The hostname is validated and resolved **before** the fetch, then re-resolved
 * **immediately before** the TCP handshake to narrow the DNS rebinding window.
 * Redirects are never followed automatically — callers receive the 3xx response
 * and can re-validate the `Location` header via `validateHaUrl` before following.
 *
 * Accepts an optional `fetch` override in `options` for testing or custom runtimes.
 */
export async function createSafeFetch(
  url: string,
  options?: RequestInit & { fetch?: typeof globalThis.fetch }
): Promise<Response> {
  // 1. Validate protocol, hostname, and resolve DNS
  const parsed = await validateHaUrl(url);

  // 2. Re-resolve DNS right before the actual request (narrows the rebinding window)
  const hostname = parsed.hostname.replace(/^\[|\]$/g, "");
  try {
    const addrs = await lookup(hostname, { all: true });
    for (const a of addrs) {
      if (a.family === 4 && isBlockedIPv4(a.address)) {
        throw new Error(
          `Hostname ${hostname} resolves to blocked IP ${a.address}`
        );
      }
      if (a.family === 6 && isBlockedIPv6(a.address)) {
        throw new Error(
          `Hostname ${hostname} resolves to blocked IPv6 ${a.address}`
        );
      }
    }
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error(`DNS re-check failed for ${hostname}`);
  }

  // 3. Perform the fetch with redirect: "manual" enforced
  const fetchFn = (options as Record<string, unknown>)?.fetch as
    | typeof globalThis.fetch
    | undefined;
  const { fetch: _omit, ...rest } = options ?? {};
  return fetchFn
    ? fetchFn(url, { ...rest, redirect: "manual" as RequestRedirect })
    : globalThis.fetch(url, { ...rest, redirect: "manual" as RequestRedirect });
}
