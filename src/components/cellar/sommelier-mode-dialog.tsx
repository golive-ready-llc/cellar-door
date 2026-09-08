"use client";

import { useState, useEffect, useCallback } from "react";
import { SITE_URL } from "@/lib/site-url";
import { QRCodeSVG } from "qrcode.react";
import { Wine, Copy, Trash2, Clock, ExternalLink, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/custom-toast";
import { useAuth } from "@/components/auth-provider";
import {
  createGuestSession,
  getUserGuestSessions,
  deleteGuestSession,
  getSessionVotes,
} from "@/server/actions/guest-sessions";

// ─── Types ──────────────────────────────────────────────────

interface SommelierModeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface GuestSessionItem {
  id: string;
  code: string;
  name: string;
  expiresAt: Date | string;
  votes: Record<string, number> | unknown;
  createdAt: Date | string;
}

const DURATION_OPTIONS = [
  { label: "2 hours", value: 2 },
  { label: "4 hours", value: 4 },
  { label: "8 hours", value: 8 },
  { label: "24 hours", value: 24 },
];

const BASE_URL = SITE_URL;

// ─── Component ──────────────────────────────────────────────

export function SommelierModeDialog({
  open,
  onOpenChange,
}: SommelierModeDialogProps) {
  const { userId } = useAuth();
  const [sessions, setSessions] = useState<GuestSessionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [duration, setDuration] = useState(4);
  const [selectedSession, setSelectedSession] = useState<GuestSessionItem | null>(null);
  const [votes, setVotes] = useState<Record<string, number>>({});

  // Load existing sessions
  const loadSessions = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const data = await getUserGuestSessions(userId);
      // Filter out expired sessions
      const active = data.filter(
        (s) => new Date(s.expiresAt) > new Date()
      );
      setSessions(active as GuestSessionItem[]);
      if (active.length > 0 && !selectedSession) {
        setSelectedSession(active[0] as GuestSessionItem);
      }
    } catch {
      // ignore
    }
    setLoading(false);
  }, [userId, selectedSession]);

  useEffect(() => {
    if (open) {
      loadSessions();
    }
  }, [open, loadSessions]);

  // Poll votes for selected session
  useEffect(() => {
    if (!selectedSession || !userId) return;
    const fetchVotes = async () => {
      const v = await getSessionVotes(userId, selectedSession.id);
      if (v) setVotes(v);
    };
    fetchVotes();
    const interval = setInterval(fetchVotes, 5000);
    return () => clearInterval(interval);
  }, [selectedSession, userId]);

  const handleCreate = async () => {
    if (!userId || !name.trim()) return;
    setCreating(true);
    try {
      const session = await createGuestSession(userId, name.trim(), duration);
      setSessions((prev) => [session as GuestSessionItem, ...prev]);
      setSelectedSession(session as GuestSessionItem);
      setName("");
      toast.success("Session created!", { description: `Code: ${session.code}` });
    } catch {
      toast.error("Failed to create session");
    }
    setCreating(false);
  };

  const handleDelete = async (sessionId: string) => {
    if (!userId) return;
    await deleteGuestSession(userId, sessionId);
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    if (selectedSession?.id === sessionId) {
      setSelectedSession(null);
      setVotes({});
    }
    toast.success("Session ended");
  };

  const copyLink = async (code: string) => {
    try {
      await navigator.clipboard.writeText(`${BASE_URL}/guest/${code}`);
      toast.success("Link copied!");
    } catch {
      // Fallback for when clipboard API is denied
      const textarea = document.createElement("textarea");
      textarea.value = `${BASE_URL}/guest/${code}`;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      toast.success("Link copied!");
    }
  };

  const totalVotes = Object.values(votes).reduce((sum, v) => sum + v, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wine className="h-5 w-5 text-primary" />
            Sommelier Mode
          </DialogTitle>
          <DialogDescription>
            Generate a QR code for dinner guests to browse your cellar and vote
            on what to open.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Create new session */}
          {sessions.length === 0 && (
            <div className="space-y-3">
              <Input
                placeholder="Session name (e.g. Saturday Dinner)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
              <div className="flex gap-2 flex-wrap">
                {DURATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setDuration(opt.value)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      duration === opt.value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <Button
                onClick={handleCreate}
                disabled={creating || !name.trim()}
                className="w-full"
              >
                {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Guest Session
              </Button>
            </div>
          )}

          {/* Active session QR + details */}
          {selectedSession && (
            <div className="space-y-3">
              <div className="flex justify-center">
                <div className="bg-white p-3 rounded-xl">
                  <QRCodeSVG
                    value={`${BASE_URL}/guest/${selectedSession.code}`}
                    size={180}
                    level="M"
                  />
                </div>
              </div>

              <div className="text-center space-y-1">
                <p className="text-lg font-mono font-bold tracking-widest">
                  {selectedSession.code}
                </p>
                <p className="text-xs text-muted-foreground">
                  {selectedSession.name}
                </p>
              </div>

              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyLink(selectedSession.code)}
                >
                  <Copy className="h-3.5 w-3.5 mr-1.5" />
                  Copy Link
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    window.open(
                      `${BASE_URL}/guest/${selectedSession.code}`,
                      "_blank"
                    )
                  }
                >
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                  Preview
                </Button>
              </div>

              {/* Vote summary */}
              <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Live Votes</span>
                  <span className="text-muted-foreground">
                    {totalVotes} total
                  </span>
                </div>
                {Object.entries(votes)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 5)
                  .map(([wineId, count]) => (
                    <div
                      key={wineId}
                      className="flex items-center justify-between text-xs text-muted-foreground"
                    >
                      <span className="truncate max-w-[200px]">
                        {wineId.slice(0, 8)}...
                      </span>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
                {totalVotes === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-1">
                    No votes yet. Share the QR code with your guests!
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Expires{" "}
                  {new Date(selectedSession.expiresAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          )}

          {/* Session list */}
          {sessions.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">
                  Active Sessions
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => {
                    setSelectedSession(null);
                    setSessions([]);
                  }}
                >
                  + New Session
                </Button>
              </div>
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className={`flex items-center justify-between rounded-lg border p-2 text-xs cursor-pointer transition-colors ${
                    selectedSession?.id === s.id
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50"
                  }`}
                  onClick={() => setSelectedSession(s)}
                >
                  <div>
                    <p className="font-medium">{s.name}</p>
                    <p className="text-muted-foreground font-mono">{s.code}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(s.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {loading && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>

        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
