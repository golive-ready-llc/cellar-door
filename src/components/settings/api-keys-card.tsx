"use client";

import { useState, useEffect, useCallback } from "react";
import { Key, Plus, Trash2, Copy, Check, Lock, Eye, EyeOff } from "lucide-react";
import { useTier } from "@/hooks/use-tier";
import { useAuth } from "@/components/auth-provider";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/custom-toast";
import { UpgradePrompt } from "@/components/tier/upgrade-prompt";

interface ApiKeyInfo {
  id: string;
  name: string;
  prefix: string;
  lastUsed: string | null;
  createdAt: string;
}

export function ApiKeysCard() {
  const { tier } = useTier();
  const { getIdToken } = useAuth();
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [revoking, setRevoking] = useState<string | null>(null);

  const isPremium = tier === "PREMIUM";

  const fetchKeys = useCallback(async () => {
    if (!isPremium) {
      setLoading(false);
      return;
    }
    try {
      const token = await getIdToken();
      if (!token) return;
      const { listApiKeys } = await import("@/server/actions/api-keys");
      const result = await listApiKeys(token);
      if ("keys" in result) {
        setKeys(result.keys);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [isPremium, getIdToken]);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleGenerate = async () => {
    setGenerating(true);
    setNewKey(null);
    setCopied(false);
    setShowKey(false);
    try {
      const token = await getIdToken();
      if (!token) return;
      const { generateApiKey } = await import("@/server/actions/api-keys");
      const result = await generateApiKey(token, keyName || undefined);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        setNewKey(result.key);
        setShowKey(true);
        setKeyName("");
        await fetchKeys();
        toast.success("API key generated");
      }
    } catch {
      toast.error("Failed to generate API key");
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async (keyId: string) => {
    if (!window.confirm("Are you sure you want to revoke this API key? Any applications using it will stop working.")) {
      return;
    }
    setRevoking(keyId);
    try {
      const token = await getIdToken();
      if (!token) return;
      const { revokeApiKey } = await import("@/server/actions/api-keys");
      const result = await revokeApiKey(token, keyId);
      if (!result.success) {
        toast.error(result.error || "Failed to revoke key");
      } else {
        toast.success("API key revoked");
        await fetchKeys();
      }
    } catch {
      toast.error("Failed to revoke API key");
    } finally {
      setRevoking(null);
    }
  };

  const handleCopy = async () => {
    if (!newKey) return;
    try {
      await navigator.clipboard.writeText(newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  // Non-PREMIUM users see a locked upgrade card
  if (!isPremium) {
    return (
      <Card className="border-dashed border-muted-foreground/25">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-muted-foreground" />
            REST API Access
          </CardTitle>
          <CardDescription>
            Programmatic access to your wine collection via REST API
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UpgradePrompt
            feature="REST API Access"
            variant="banner"
            requiredTier="PREMIUM"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5 text-primary" />
          REST API Keys
        </CardTitle>
        <CardDescription>
          Manage API keys for programmatic access to your cellar data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* New key reveal */}
        {newKey && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
            <p className="text-sm font-semibold text-primary">
              New API key created — copy it now!
            </p>
            <p className="text-xs text-muted-foreground">
              This key will only be shown once. Store it securely.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-muted rounded px-3 py-2 font-mono break-all select-all">
                {showKey ? newKey : newKey.slice(0, 11) + "\u2022".repeat(32)}
              </code>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0"
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 gap-1.5"
                onClick={handleCopy}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={() => setNewKey(null)}
            >
              Dismiss
            </Button>
          </div>
        )}

        {/* Existing keys */}
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading keys...</div>
        ) : keys.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No API keys yet. Generate one to get started.
          </p>
        ) : (
          <div className="space-y-2">
            {keys.map((k) => (
              <div
                key={k.id}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{k.name}</span>
                    <code className="text-xs text-muted-foreground font-mono">
                      {k.prefix}
                    </code>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Created {new Date(k.createdAt).toLocaleDateString()}
                    {k.lastUsed && (
                      <> &middot; Last used {new Date(k.lastUsed).toLocaleDateString()}</>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive shrink-0"
                  disabled={revoking === k.id}
                  onClick={() => handleRevoke(k.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Generate new key */}
        {keys.length < 5 && (
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">
                Key name (optional)
              </label>
              <input
                type="text"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                placeholder="e.g., My Integration"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                maxLength={50}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 shrink-0"
              disabled={generating}
              onClick={handleGenerate}
            >
              <Plus className="h-3.5 w-3.5" />
              {generating ? "Generating..." : "Generate Key"}
            </Button>
          </div>
        )}
        {keys.length >= 5 && (
          <p className="text-xs text-muted-foreground">
            Maximum of 5 API keys reached. Revoke an existing key to create a new one.
          </p>
        )}

        {/* API docs hint */}
        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground">
            Use your API key as a Bearer token:{" "}
            <code className="bg-muted px-1.5 py-0.5 rounded text-[11px] font-mono">
              Authorization: Bearer cd_...
            </code>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Base URL:{" "}
            <code className="bg-muted px-1.5 py-0.5 rounded text-[11px] font-mono">
              /api/v1/wines
            </code>
            {" | "}
            <code className="bg-muted px-1.5 py-0.5 rounded text-[11px] font-mono">
              /api/v1/stats
            </code>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
