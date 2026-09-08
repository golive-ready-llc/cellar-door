/**
 * Admin access control utilities.
 * The ADMIN_EMAIL env var should be set to the app owner's email.
 */

export function isAdmin(email: string): boolean {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return false;
  return email.toLowerCase() === adminEmail.toLowerCase();
}
