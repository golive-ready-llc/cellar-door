"use server";

// B2B demo-request leads: public submission from /restaurants, admin-only
// listing + status updates in the admin dashboard.

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/server/auth-guard";

const VENUE_TYPES = ["restaurant", "wine_bar", "wine_shop", "other"] as const;
const LEAD_STATUSES = ["new", "contacted", "demo", "won", "lost"] as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface BusinessLeadInput {
  name: string;
  email: string;
  venueName: string;
  venueType: string;
  cellarSize?: string;
  message?: string;
  /** Honeypot — humans never see this field; bots fill it. */
  website?: string;
}

export interface BusinessLead {
  id: string;
  name: string;
  email: string;
  venueName: string;
  venueType: string;
  cellarSize: string;
  message: string;
  status: string;
  createdAt: Date;
}

/**
 * Public server action behind the /restaurants demo-request form.
 * Unauthenticated by design (leads arrive before an account exists), so
 * every field is validated and length-capped, and a honeypot filters bots.
 */
export async function submitBusinessLead(
  input: BusinessLeadInput
): Promise<{ ok: true }> {
  // Honeypot tripped — pretend success so the bot learns nothing.
  if (input.website) return { ok: true };

  const name = (input.name ?? "").trim().slice(0, 200);
  const email = (input.email ?? "").trim().slice(0, 320);
  const venueName = (input.venueName ?? "").trim().slice(0, 200);
  const venueType = (input.venueType ?? "").trim();
  const cellarSize = (input.cellarSize ?? "").trim().slice(0, 50);
  const message = (input.message ?? "").trim().slice(0, 2000);

  if (!name) throw new Error("Please tell us your name");
  if (!EMAIL_RE.test(email)) throw new Error("Please enter a valid email address");
  if (!venueName) throw new Error("Please tell us your venue's name");
  if (!(VENUE_TYPES as readonly string[]).includes(venueType)) {
    throw new Error("Please pick a venue type");
  }

  await prisma.businessLead.create({
    data: { name, email, venueName, venueType, cellarSize, message },
  });
  return { ok: true };
}

/** Admin-only: list every lead, newest first. */
export async function getBusinessLeads(
  idToken: string
): Promise<{ error?: string; data?: BusinessLead[] }> {
  const admin = await requireAdmin(idToken);
  if (!admin.ok) return { error: admin.error };

  const leads = await prisma.businessLead.findMany({
    orderBy: { createdAt: "desc" },
  });
  return { data: leads };
}

/** Admin-only: move a lead through the pipeline (new → contacted → …). */
export async function updateBusinessLeadStatus(
  idToken: string,
  leadId: string,
  status: string
): Promise<{ error?: string; ok?: true }> {
  const admin = await requireAdmin(idToken);
  if (!admin.ok) return { error: admin.error };

  if (!(LEAD_STATUSES as readonly string[]).includes(status)) {
    return { error: `Invalid status "${status}"` };
  }
  await prisma.businessLead.update({
    where: { id: leadId },
    data: { status },
  });
  return { ok: true };
}
