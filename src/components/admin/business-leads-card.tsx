"use client";

// Admin dashboard card: B2B demo requests from /restaurants with a simple
// pipeline-status dropdown per lead.

import { useEffect, useState, useCallback } from "react";
import { Briefcase, Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import {
  getBusinessLeads,
  updateBusinessLeadStatus,
  type BusinessLead,
} from "@/server/actions/business-leads";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/custom-toast";

const STATUSES = ["new", "contacted", "demo", "won", "lost"] as const;

const VENUE_LABELS: Record<string, string> = {
  restaurant: "Restaurant",
  wine_bar: "Wine bar",
  wine_shop: "Wine shop",
  other: "Other",
};

const STATUS_STYLES: Record<string, string> = {
  new: "bg-primary/10 text-primary",
  contacted: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  demo: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  won: "bg-green-500/10 text-green-600 dark:text-green-400",
  lost: "bg-muted text-muted-foreground",
};

export function BusinessLeadsCard() {
  const { getIdToken, loading: authLoading } = useAuth();
  const [leads, setLeads] = useState<BusinessLead[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    (async () => {
      const token = await getIdToken();
      if (!token) { setError("Not authenticated"); return; }
      const result = await getBusinessLeads(token);
      if (cancelled) return;
      if (result.error) setError(result.error);
      else setLeads(result.data ?? []);
    })();
    return () => { cancelled = true; };
  }, [authLoading, getIdToken]);

  const handleStatusChange = useCallback(
    async (leadId: string, status: string) => {
      const token = await getIdToken();
      if (!token) return;
      const result = await updateBusinessLeadStatus(token, leadId, status);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setLeads((prev) =>
        prev?.map((l) => (l.id === leadId ? { ...l, status } : l)) ?? null
      );
    },
    [getIdToken]
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Briefcase className="h-4 w-4" />
          B2B Demo Requests
        </CardTitle>
        {leads && <Badge variant="secondary">{leads.length}</Badge>}
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : !leads ? (
          <div className="flex items-center gap-2 py-4 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading leads…</span>
          </div>
        ) : leads.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground italic">
            No demo requests yet — share mycellardoor.app/restaurants
          </p>
        ) : (
          <div className="space-y-3">
            {leads.map((lead) => (
              <div
                key={lead.id}
                className="rounded-lg border border-border/60 p-3 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {lead.venueName}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {VENUE_LABELS[lead.venueType] || lead.venueType}
                        {lead.cellarSize ? ` · ${lead.cellarSize} bottles` : ""}
                      </span>
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {lead.name} ·{" "}
                      <a href={`mailto:${lead.email}`} className="underline underline-offset-2">
                        {lead.email}
                      </a>{" "}
                      · {new Date(lead.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <select
                    value={lead.status}
                    onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                    className={`rounded-full border-0 px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[lead.status] || ""}`}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                {lead.message && (
                  <p className="mt-2 border-t border-border/40 pt-2 text-xs text-muted-foreground">
                    {lead.message}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
