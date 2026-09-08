"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Loader2, CheckCircle2, XCircle, Brain, Eye, EyeOff, RefreshCw, MessageSquare, Image as ImageIcon,
} from "lucide-react";
import type { AIConfigData, ProviderSlot } from "@/lib/ai/config";
import type { ModelInfo } from "@/server/actions/ai-config";
import { cn } from "@/lib/utils";

interface Props {
  config: AIConfigData;
  onSave: (updates: Partial<AIConfigData>) => Promise<{ error?: string; data?: AIConfigData }>;
  onTestConnection: (
    provider: "gemini" | "deepseek" | "alibaba" | "mock",
    apiKey?: string,
    baseUrl?: string
  ) => Promise<{ error?: string; data?: { success: boolean; latency: number } }>;
  onFetchModels: (
    provider: "gemini" | "deepseek" | "alibaba",
    apiKey?: string,
    baseUrl?: string
  ) => Promise<{ error?: string; data?: ModelInfo[] }>;
}

// ─── Provider Slot Editor (primary or failover) ─────────────────

function ProviderSlotEditor({
  label, icon, description,
  slot, onChange,
  onFetchModels, onTest,
}: {
  label: string;
  icon: React.ReactNode;
  description: string;
  slot: ProviderSlot;
  onChange: (updated: ProviderSlot) => void;
  onFetchModels: (provider: "gemini" | "deepseek" | "alibaba", apiKey?: string, baseUrl?: string) => Promise<{ error?: string; data?: ModelInfo[] }>;
  onTest: (provider: "gemini" | "deepseek" | "alibaba" | "mock", apiKey?: string, baseUrl?: string) => Promise<{ error?: string; data?: { success: boolean; latency: number } }>;
}) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [fetching, setFetching] = useState(false);
  const [testing, setTesting] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [modelInputMode, setModelInputMode] = useState<"select" | "text">(
    slot.model && models.length > 0 && models.some((m) => m.id === slot.model) ? "select" : "text"
  );

  const isGemini = slot.provider === "gemini";
  const isDeepseek = slot.provider === "deepseek";
  const hasProvider = slot.provider && slot.provider !== "mock";

  const handleFetch = useCallback(async () => {
    if (!slot.provider || slot.provider === "mock") return;
    setFetching(true); setFetchError(null); setTestResult(null);
    try {
      const result = await onFetchModels(slot.provider as "gemini" | "deepseek" | "alibaba", slot.apiKey || undefined, slot.baseUrl || undefined);
      if (result.error) setFetchError(result.error);
      else if (result.data) {
        setModels(result.data);
        setModelInputMode("select");
      }
    } finally { setFetching(false); }
  }, [slot.provider, slot.apiKey, slot.baseUrl, onFetchModels]);

  const handleTest = useCallback(async () => {
    if (!slot.provider || slot.provider === "mock") return;
    setTesting(true); setTestResult(null);
    try {
      const result = await onTest(slot.provider as "gemini" | "deepseek" | "alibaba" | "mock", slot.apiKey || undefined, slot.baseUrl || undefined);
      if (result.error) setTestResult({ ok: false, message: result.error });
      else if (result.data?.success) setTestResult({ ok: true, message: `OK (${result.data.latency}ms)` });
    } finally { setTesting(false); }
  }, [slot.provider, slot.apiKey, slot.baseUrl, onTest]);

  // Reset models cache when provider changes
  useEffect(() => { setModels([]); setFetchError(null); setTestResult(null); }, [slot.provider, slot.apiKey]);

  return (
    <div className="space-y-3 rounded-lg border p-4 bg-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-semibold">{label}</span>
        </div>
        {hasProvider && (
          <div className="flex gap-1">
            <button type="button" onClick={handleFetch} disabled={fetching}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${fetching ? "animate-spin" : ""}`} />
              {fetching ? "Fetching..." : "Models"}
            </button>
            <button type="button" onClick={handleTest} disabled={testing}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              {testing ? <Loader2 className="h-3 w-3 animate-spin" /> : "Test"}
            </button>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">{description}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Provider select */}
        <div className="space-y-1">
          <Label className="text-xs">Provider</Label>
          <Select value={slot.provider} onValueChange={(v) => onChange({ ...slot, provider: v as ProviderSlot["provider"], model: "" })}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gemini">Gemini</SelectItem>
              <SelectItem value="deepseek">Deepseek</SelectItem>
              <SelectItem value="alibaba">Alibaba</SelectItem>
              <SelectItem value="">None</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* API Key (hidden when empty provider or none) */}
        {hasProvider && (
          <div className="space-y-1">
            <Label className="text-xs">API Key</Label>
            <div className="relative">
              <Input
                type={showKey ? "text" : "password"}
                value={slot.apiKey}
                onChange={(e) => onChange({ ...slot, apiKey: e.target.value })}
                placeholder={isDeepseek ? "sk-..." : "AIza..."}
                className="h-8 text-xs pr-7"
              />
              <button type="button" onClick={() => setShowKey(!showKey)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Model selector */}
      {hasProvider && (
        <div className="space-y-1">
          <Label className="text-xs">Model</Label>
          {modelInputMode === "select" && models.length > 0 ? (
            <div className="flex gap-1">
              <Select value={slot.model} onValueChange={(v) => {
                if (v === "__text__") setModelInputMode("text");
                else onChange({ ...slot, model: v ?? "" });
              }}>
                <SelectTrigger className="h-8 text-xs flex-1">
                  <SelectValue placeholder="Select model..." />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {models.map((m) => (
                    <SelectItem key={m.id} value={m.id} className="text-xs">
                      <span className="flex items-center gap-2">
                        {m.displayName}
                        {m.supportsVision && <span className="text-[10px] text-muted-foreground bg-muted px-1 py-0.5 rounded">vision</span>}
                        {m.isReasoning && <span className="text-[10px] text-amber-600 bg-amber-500/10 px-1 py-0.5 rounded">reasoning · avoid</span>}
                      </span>
                    </SelectItem>
                  ))}
                  <SelectItem value="__text__" className="text-xs text-muted-foreground border-t mt-1 pt-1">Type custom...</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : (
            <Input value={slot.model} onChange={(e) => onChange({ ...slot, model: e.target.value })}
                          placeholder="Enter model name"
              className="h-8 text-xs"
            />
          )}
          {modelInputMode === "select" && models.length > 0 && (
            <button type="button" onClick={() => setModelInputMode("text")}
              className="text-xs text-muted-foreground hover:text-foreground"
            >Type custom model name</button>
          )}
          {modelInputMode === "select" && models.some((m) => m.isReasoning) && (
            <p className="text-[10px] text-amber-600/90">
              Avoid &ldquo;reasoning&rdquo;/&ldquo;thinking&rdquo; models — they return empty text and break chat &amp; scanning.
            </p>
          )}
        </div>
      )}

      {/* Base URL (custom API endpoint) */}
      {hasProvider && (
        <div className="space-y-1">
          <Label className="text-xs">API Endpoint</Label>
          <Input value={slot.baseUrl} onChange={(e) => onChange({ ...slot, baseUrl: e.target.value })}
            placeholder={isGemini ? "https://generativelanguage.googleapis.com" : isDeepseek ? "https://api.deepseek.com" : "https://dashscope.aliyuncs.com/compatible-mode"}
          />
          <p className="text-[10px] text-muted-foreground">
            {isGemini ? "Leave empty for default Google API." : "Base URL for the OpenAI-compatible API endpoint."}
          </p>
        </div>
      )}

      {/* Test result */}
      {testResult && (
        <div className={cn("flex items-center gap-1.5 text-xs", testResult.ok ? "text-green-600 dark:text-green-400" : "text-destructive")}>
          {testResult.ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
          {testResult.message}
        </div>
      )}
      {fetchError && (
        <div className="flex items-center gap-1.5 text-xs text-destructive">
          <XCircle className="h-3 w-3" />{fetchError}
        </div>
      )}
    </div>
  );
}

// ─── Main Card ──────────────────────────────────────────────

export function AIConfigCard({ config: initialConfig, onSave, onTestConnection, onFetchModels }: Props) {
  const [config, setConfig] = useState<AIConfigData>(initialConfig);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => { setConfig(initialConfig); }, [initialConfig]);

  const updateSlot = useCallback((path: "text" | "textFailover" | "vision" | "visionFailover", slot: ProviderSlot) => {
    setConfig((prev) => ({ ...prev, [path]: slot }));
    setDirty(true); setSaveError(null);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true); setSaveError(null);
    try {
      const result = await onSave(config);
      if (result.error) setSaveError(result.error);
      else setDirty(false);
    } catch { setSaveError("Failed to save"); }
    finally { setSaving(false); }
  }, [config, onSave]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          AI Provider Configuration
        </CardTitle>
        <CardDescription>
          Configure separate providers for text and image operations, each with failover.
          Changes take effect immediately.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Text Provider */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
            <MessageSquare className="h-4 w-4" />
            Text Provider
            <span className="text-xs font-normal text-muted-foreground">— search, enrichment, chat, recommendations</span>
          </h3>
          <ProviderSlotEditor
            label="Primary"
            icon={<MessageSquare className="h-4 w-4 text-primary" />}
            description="Handles all text-based AI operations."
            slot={config.text}
            onChange={(s) => updateSlot("text", s)}
            onFetchModels={onFetchModels}
            onTest={onTestConnection}
          />
          <ProviderSlotEditor
            label="Failover"
            icon={<MessageSquare className="h-4 w-4 text-muted-foreground" />}
            description="Used if the primary text provider fails. Leave empty to skip."
            slot={config.textFailover}
            onChange={(s) => updateSlot("textFailover", s)}
            onFetchModels={onFetchModels}
            onTest={onTestConnection}
          />
        </div>

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Vision Provider */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
            <ImageIcon className="h-4 w-4" />
            Vision / Image Provider
            <span className="text-xs font-normal text-muted-foreground">— label scanning, wine list extraction, image fetch</span>
          </h3>
          <ProviderSlotEditor
            label="Primary"
            icon={<ImageIcon className="h-4 w-4 text-primary" />}
            description="Handles image-based AI operations. Only Gemini supports images."
            slot={config.vision}
            onChange={(s) => updateSlot("vision", s)}
            onFetchModels={onFetchModels}
            onTest={onTestConnection}
          />
          <ProviderSlotEditor
            label="Failover"
            icon={<ImageIcon className="h-4 w-4 text-muted-foreground" />}
            description="Used if the primary vision provider fails. Leave empty to skip."
            slot={config.visionFailover}
            onChange={(s) => updateSlot("visionFailover", s)}
            onFetchModels={onFetchModels}
            onTest={onTestConnection}
          />
        </div>

        {/* Error */}
        {saveError && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <XCircle className="h-4 w-4" /><span>{saveError}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button onClick={handleSave} disabled={saving || !dirty}>
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : "Save Configuration"}
          </Button>
        </div>

        {/* Status */}
        <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground border-t">
          <div className={cn("h-2 w-2 rounded-full", config.enabled ? "bg-green-500" : "bg-red-500")} />
          <span>{config.enabled ? "AI providers are active" : "AI features are disabled"}</span>
        </div>
      </CardContent>
    </Card>
  );
}
