"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  MessageCircle,
  X,
  Send,
  Sparkles,
  Loader2,
  Wine as WineIcon,
  Utensils,
  Calendar,
  HelpCircle,
  Lock,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Wine } from "@/types/wine";
import { chatWithSommelier } from "@/server/actions/chat";
import { useCheckout } from "@/hooks/use-checkout";
import { TIER_FEATURE_BULLETS } from "@/lib/tier";
import { setChatPanelOpen } from "./chat-open-store";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface CellarChatProps {
  wines: Wine[];
  onWineClick?: (wine: Wine) => void;
  /** Whether user has AI access (Cellar+ or higher) */
  hasAI: boolean;
  /** Prisma user ID for server-side tier enforcement */
  userId?: string | null;
}

const QUICK_ACTIONS = [
  { icon: WineIcon, label: "What should I drink tonight?", text: "What should I drink tonight?" },
  { icon: Utensils, label: "Pair with steak", text: "What wine from my cellar would pair best with grilled steak?" },
  { icon: Calendar, label: "What's ready?", text: "Which wines in my cellar are ready to drink now?" },
  { icon: HelpCircle, label: "Cellar overview", text: "Give me an overview of my wine collection." },
];

/** Draggable floating action button for the AI chat — dismissible per session */
function DraggableFab({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const fabRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    moved: boolean;
    anchorTop: number;
  } | null>(null);

  // Restore dismissed state from sessionStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      setDismissed(sessionStorage.getItem("cellar-chat-dismissed") === "true");
    }
  }, []);

  const handleDismiss = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setDismissed(true);
    sessionStorage.setItem("cellar-chat-dismissed", "true");
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    const anchorTop = fabRef.current
      ? parseFloat(getComputedStyle(fabRef.current).top)
      : 80;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
      moved: false,
      anchorTop,
    };
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [pos]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) d.moved = true;
    if (d.moved) {
      // Constrain to viewport. The FAB is anchored top-right with
      // top-20 (80px) + right-4 (16px). pos is a translate offset from
      // that anchor — negative values move left/up, positive move
      // right/down.
      //
      // Old constraints capped Y at 0 (max), which meant the FAB could
      // only ever drift UP from its starting position. Users couldn't
      // drag it past the top quarter of the screen. Fixed: allow the
      // full vertical range so the FAB can move anywhere visible —
      // from just below the status bar down to just above the bottom
      // nav, with safe margins so it never tucks into a system gesture
      // strip.
      const FAB_SIZE = 56; // w-14 h-14
      const ANCHOR_TOP = d.anchorTop;
      const ANCHOR_RIGHT = 16; // right-4
      const SAFE_TOP = 16; // don't tuck under the status bar
      const isMobile = window.matchMedia("(max-width: 767px)").matches;
      const SAFE_BOTTOM = isMobile ? 140 : 32;

      const minX = -(window.innerWidth - FAB_SIZE - ANCHOR_RIGHT);
      const maxX = 0;
      const minY = -(ANCHOR_TOP - SAFE_TOP);
      const maxY = window.innerHeight - ANCHOR_TOP - FAB_SIZE - SAFE_BOTTOM;

      const newX = Math.max(minX, Math.min(maxX, d.origX + dx));
      const newY = Math.max(minY, Math.min(maxY, d.origY + dy));
      setPos({ x: newX, y: newY });
    }
  }, []);

  const handlePointerUp = useCallback(() => {
    const d = dragRef.current;
    dragRef.current = null;
    setDragging(false);
    if (!d?.moved) onToggle();
  }, [onToggle]);

  // When dismissed: show a small, subtle mini-fab
  if (dismissed && !isOpen) {
    return (
      <button
        onClick={() => {
          setDismissed(false);
          sessionStorage.removeItem("cellar-chat-dismissed");
          onToggle();
        }}
        className="fixed top-[calc(3.5rem+env(safe-area-inset-top)+0.75rem)] right-4 md:top-20 md:right-6 z-50 w-10 h-10 rounded-full flex items-center justify-center bg-muted/60 text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-all duration-200 hover:scale-110 shadow-sm"
        aria-label="Open chat"
      >
        <MessageCircle className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div
      ref={fabRef}
      // Top-right by default — the bottom-right is owned by the camera
      // FAB (the more frequent action). Users can drag this anywhere.
      // Mobile: sits below the header (3.5rem + safe-area + 0.75rem gap)
      // so it doesn't overlap the tier badge ("Cellar Pro") in the header.
      className="fixed top-[calc(3.5rem+env(safe-area-inset-top)+0.75rem)] right-4 md:top-20 md:right-6 z-50"
      style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Dismiss button — appears on hover when not open */}
      {!isOpen && hovered && (
        <button
          onClick={handleDismiss}
          className="absolute -top-1.5 -right-1.5 z-10 w-5 h-5 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-colors"
          aria-label="Dismiss chat"
        >
          <X className="h-3 w-3" />
        </button>
      )}
      <button
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={cn(
          "w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200",
          isOpen
            ? "bg-muted text-muted-foreground"
            : "bg-primary text-primary-foreground",
          !dragging && "hover:scale-105",
          !isOpen && !hovered && "opacity-70 scale-90",
          !isOpen && hovered && "opacity-100 scale-100",
        )}
        style={{
          boxShadow: isOpen
            ? "0 4px 12px rgba(0,0,0,0.3)"
            : hovered
              ? "0 0 20px 6px rgba(155, 35, 53, 0.5), 0 0 40px 12px rgba(155, 35, 53, 0.2), 0 4px 16px rgba(0,0,0,0.3)"
              : "0 2px 8px rgba(0,0,0,0.2)",
          touchAction: "none",
        }}
      >
        {isOpen ? (
          <X className="h-5 w-5" />
        ) : (
          <div className="relative">
            <MessageCircle className="h-5 w-5" />
            {hovered && (
              <Sparkles className="h-3 w-3 absolute -top-1.5 -right-1.5 text-amber-400 animate-pulse" />
            )}
          </div>
        )}
      </button>
    </div>
  );
}

/** Parse [[Wine Name]] references in chat messages and make them clickable */
function ChatMessageContent({
  content,
  wines,
  onWineClick,
}: {
  content: string;
  wines: Wine[];
  onWineClick?: (wine: Wine) => void;
}) {
  // Split on [[...]] patterns
  const parts = content.split(/(\[\[.*?\]\])/g);

  if (parts.length === 1) return <>{content}</>;

  return (
    <>
      {parts.map((part, i) => {
        const match = part.match(/^\[\[(.*)\]\]$/);
        if (!match) return <span key={i}>{part}</span>;

        const wineName = match[1];
        // Fuzzy match against the wine list
        const wine = wines.find((w) => {
          const name = (w.name || "").toLowerCase();
          const query = wineName.toLowerCase();
          return (
            name === query ||
            name.includes(query) ||
            query.includes(name) ||
            // Match partial: "Catena Zapata Malbec" matches "Malbec" wine named "Malbec - Catena Zapata"
            query.split(/\s+/).every((word) => name.includes(word))
          );
        });

        if (wine && onWineClick) {
          return (
            <button
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                onWineClick(wine);
              }}
              className="text-primary underline underline-offset-2 decoration-primary/40 hover:decoration-primary font-medium inline"
            >
              {wineName}
            </button>
          );
        }

        // No match found — render as bold text
        return (
          <span key={i} className="font-medium">
            {wineName}
          </span>
        );
      })}
    </>
  );
}

/** Upgrade panel shown inside the chat window for free-tier users */
function ChatUpgradePanel() {
  const { startCheckout, checkoutLoading } = useCheckout();
  const bullets = TIER_FEATURE_BULLETS.PRO;

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <Lock className="h-7 w-7 text-primary" />
      </div>
      <h3 className="text-base font-semibold mb-1">
        Upgrade to Cellar+
      </h3>
      <p className="text-xs text-muted-foreground mb-4 max-w-[260px]">
        CellarChat AI sommelier is available on the Cellar+ plan. Get AI-powered wine recommendations, pairings, and more.
      </p>

      <ul className="space-y-1.5 text-left mb-5 w-full max-w-[240px]">
        {bullets.slice(0, 5).map((bullet) => (
          <li key={bullet} className="flex items-start gap-2 text-xs">
            <Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>

      <Button
        className="w-full max-w-[240px] gap-1.5"
        onClick={() => startCheckout("PRO")}
        disabled={checkoutLoading}
      >
        <Sparkles className="h-4 w-4" />
        {checkoutLoading ? "Loading..." : "Upgrade to Cellar+ — $9.99/mo"}
      </Button>
      <p className="text-[10px] text-muted-foreground mt-2">
        14-day free trial included
      </p>
    </div>
  );
}

export function CellarChat({ wines, onWineClick, hasAI, userId }: CellarChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && hasAI) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, hasAI]);

  // Hide the bottom-right camera FAB while the chat is open — on phones with a
  // 3-button nav bar the safe-area-shifted FAB overlaps the chat's send button.
  useEffect(() => {
    setChatPanelOpen(isOpen);
    return () => setChatPanelOpen(false);
  }, [isOpen]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return;

      const userMessage: ChatMessage = { role: "user", content: text.trim() };
      const newMessages = [...messages, userMessage];
      setMessages(newMessages);
      setInput("");
      setLoading(true);

      try {
        // Send only the fields the cellar context needs. Full Wine objects
        // carry base64 `imageUrl` data (megabytes for a large cellar), which
        // blew the server-action body limit and returned HTTP 413 before the
        // request ever reached the AI.
        const slimWines = wines.map((w) => ({
          name: w.name,
          winery: w.winery,
          vintage: w.vintage,
          type: w.type,
          region: w.region,
          country: w.country,
          grapeVariety: w.grapeVariety,
          disposition: w.disposition,
          price: w.price,
          retailPrice: w.retailPrice,
        }));
        const result = await chatWithSommelier(newMessages, slimWines, userId ?? undefined);

        if (result.success) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: result.message },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: result.error?.startsWith("Internal")
                ? "Something went wrong. Please try again."
                : `Sorry, I had trouble: ${result.error}`,
            },
          ]);
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Something went wrong. Please try again.",
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [messages, wines, loading, userId]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <>
      {/* Floating toggle button */}
      <DraggableFab isOpen={isOpen} onToggle={() => setIsOpen(!isOpen)} />

      {/* Chat panel */}
      {isOpen && (
        <div className="fixed top-36 right-4 md:top-36 md:right-6 z-50 w-96 max-w-[calc(100vw-2rem)] bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden"
          style={{ height: "min(500px, calc(100vh - 12rem))" }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/30">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold">CellarChat</h3>
              <p className="text-xs text-muted-foreground">
                {hasAI
                  ? `Your AI sommelier · ${wines.length} wines`
                  : "AI sommelier · Cellar+ feature"}
              </p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              aria-label="Close chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Free tier: show upgrade panel instead of chat */}
          {!hasAI ? (
            <ChatUpgradePanel />
          ) : (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                  <div className="space-y-4">
                    <div className="text-center py-4">
                      <WineIcon className="h-8 w-8 text-primary mx-auto mb-2" />
                      <p className="text-sm font-medium">
                        Hi! I&apos;m your AI sommelier.
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Ask me about your cellar, pairings, or recommendations.
                      </p>
                    </div>

                    {/* Quick actions */}
                    <div className="grid grid-cols-2 gap-2">
                      {QUICK_ACTIONS.map((action) => (
                        <button
                          key={action.label}
                          onClick={() => sendMessage(action.text)}
                          disabled={loading}
                          className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-background hover:bg-muted/50 transition-colors text-left"
                        >
                          <action.icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-xs">{action.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "flex",
                        msg.role === "user" ? "justify-end" : "justify-start"
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm",
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground rounded-br-sm"
                            : "bg-muted rounded-bl-sm"
                        )}
                      >
                        {msg.role === "assistant" ? (
                          <ChatMessageContent
                            content={msg.content}
                            wines={wines}
                            onWineClick={onWineClick}
                          />
                        ) : (
                          msg.content
                        )}
                      </div>
                    </div>
                  ))
                )}

                {/* Loading indicator */}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-xl rounded-bl-sm px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          Thinking...
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <form
                onSubmit={handleSubmit}
                className="px-4 py-3 border-t border-border bg-background"
              >
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask your sommelier..."
                    className="flex-1 bg-muted rounded-lg px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20"
                    autoComplete="on"
                    autoCorrect="on"
                    autoCapitalize="sentences"
                    spellCheck={true}
                    disabled={loading}
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!input.trim() || loading}
                    className="h-9 w-9 p-0 shrink-0"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
}
