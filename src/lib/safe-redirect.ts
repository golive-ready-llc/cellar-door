/**
 * Allow-list a client-supplied redirect target to a same-origin path.
 *
 * URL parsers treat a backslash like a forward slash for special schemes,
 * so "/\evil.com" normalizes to the protocol-relative "//evil.com"
 * (https://evil.com/). A "starts with /" check alone therefore lets an
 * open redirect through — the second character must be neither "/" nor "\".
 */
export function safeNextPath(
  value: string | null | undefined,
  fallback = "/"
): string {
  return value && /^\/[^/\\]/.test(value) ? value : fallback;
}
