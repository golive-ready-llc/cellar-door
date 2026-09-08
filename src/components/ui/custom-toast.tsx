"use client";

import { useEffect, useRef } from "react";

// ─── Toast store (window-level singleton) ───────────────────────────
type ToastType = "success" | "error" | "info" | "warning" | "default";

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
  description?: string;
  duration: number;
  createdAt: number;
  action?: { label: string; onClick: () => void };
}

interface ToastStore {
  nextId: number;
  items: ToastItem[];
  container: HTMLDivElement | null;
}

function getStore(): ToastStore {
  if (typeof window === "undefined") {
    return { nextId: 1, items: [], container: null };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  if (!w.__cellarToastStore) {
    w.__cellarToastStore = { nextId: 1, items: [], container: null } as ToastStore;
  }
  return w.__cellarToastStore;
}

// ─── Rendering (pure DOM, no React) ────────────────────────────────
const ICON_SVG: Record<ToastType, string> = {
  success: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-400"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  error: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-red-400"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
  info: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-blue-400"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
  warning: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-amber-400"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  default: "",
};

const BORDER_COLOR: Record<ToastType, string> = {
  error: "#ef4444",
  success: "#10b981",
  warning: "#f59e0b",
  info: "#3b82f6",
  default: "#374151",
};

function renderToast(item: ToastItem): HTMLDivElement {
  const el = document.createElement("div");
  el.setAttribute("role", "alert");
  el.setAttribute("data-toast-id", String(item.id));
  el.style.cssText = `
    display: flex; align-items: flex-start; gap: 12px;
    padding: 14px 16px; border-radius: 8px;
    border: 1px solid var(--border);
    border-left: 4px solid ${BORDER_COLOR[item.type]};
    background: var(--background);
    color: var(--foreground);
    box-shadow: 0 10px 15px -3px rgba(0,0,0,.3), 0 4px 6px -4px rgba(0,0,0,.2);
    pointer-events: auto; max-width: 400px; width: 100%;
    transform: translateX(100%); opacity: 0;
    transition: transform 0.3s ease, opacity 0.3s ease;
    font-family: ui-sans-serif, system-ui, sans-serif;
  `;

  const icon = ICON_SVG[item.type];
  const iconHTML = icon
    ? `<span style="flex-shrink:0;margin-top:2px;">${icon}</span>`
    : "";

  const descHTML = item.description
    ? `<p style="margin:4px 0 0;font-size:12px;color:var(--muted-foreground);">${item.description}</p>`
    : "";

  const actionHTML = item.action
    ? `<button data-toast-action style="
        margin-top:6px;padding:4px 10px;border-radius:4px;border:1px solid var(--border);
        background:var(--background);color:var(--foreground);cursor:pointer;
        font-size:12px;font-weight:500;
      ">${item.action.label}</button>`
    : "";

  el.innerHTML = `
    ${iconHTML}
    <div style="flex:1;min-width:0;">
      <p style="margin:0;font-size:14px;font-weight:500;line-height:1.4;">${item.message}</p>
      ${descHTML}
      ${actionHTML}
    </div>
    <button aria-label="Dismiss" style="
      flex-shrink:0; padding:4px; border-radius:4px; border:none;
      background:transparent; color:var(--muted-foreground);
      cursor:pointer; line-height:1;
    ">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  `;

  // Dismiss on close button click
  // NOTE: must select by aria-label — with an action button present,
  // querySelector("button") would grab the action (it precedes the dismiss
  // button in the markup), leaving the ✕ dead and double-binding the action.
  const closeBtn = el.querySelector('[aria-label="Dismiss"]');
  closeBtn?.addEventListener("click", () => removeToast(item.id));

  // Action button click
  const actionBtn = el.querySelector("[data-toast-action]") as HTMLButtonElement | null;
  actionBtn?.addEventListener("click", () => {
    item.action?.onClick();
    removeToast(item.id);
  });

  // Animate in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.style.transform = "translateX(0)";
      el.style.opacity = "1";
    });
  });

  return el;
}

function removeToast(id: number) {
  const store = getStore();
  const el = store.container?.querySelector(`[data-toast-id="${id}"]`) as HTMLDivElement | null;
  if (!el) return;

  // Animate out
  el.style.transform = "translateX(100%)";
  el.style.opacity = "0";

  setTimeout(() => {
    el.remove();
    store.items = store.items.filter((t) => t.id !== id);
  }, 300);
}

function addToast(
  type: ToastType,
  message: string,
  opts?: { description?: string; duration?: number; action?: { label: string; onClick: () => void } }
) {
  const store = getStore();
  const id = store.nextId++;
  const defaultDuration = type === "error" || type === "warning" ? 6000 : 4000;
  const duration = opts?.duration ?? defaultDuration;
  const item: ToastItem = { id, type, message, description: opts?.description, duration, createdAt: Date.now(), action: opts?.action };

  store.items.push(item);

  // Render directly into DOM container
  if (store.container) {
    const el = renderToast(item);
    store.container.appendChild(el);
  }

  // Auto-dismiss
  setTimeout(() => removeToast(id), duration);
  return id;
}

// ─── Public API ────────────────────────────────────────────────────
export const toast = Object.assign(
  (message: string, opts?: { description?: string; duration?: number; action?: { label: string; onClick: () => void } }) =>
    addToast("default", message, opts),
  {
    success: (message: string, opts?: { description?: string; duration?: number; action?: { label: string; onClick: () => void } }) =>
      addToast("success", message, opts),
    error: (message: string, opts?: { description?: string; duration?: number; action?: { label: string; onClick: () => void } }) =>
      addToast("error", message, opts),
    info: (message: string, opts?: { description?: string; duration?: number; action?: { label: string; onClick: () => void } }) =>
      addToast("info", message, opts),
    warning: (message: string, opts?: { description?: string; duration?: number; action?: { label: string; onClick: () => void } }) =>
      addToast("warning", message, opts),
    dismiss: removeToast,
  }
);

// ─── Toaster component (mounts the DOM container) ──────────────────
export function Toaster() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const store = getStore();
    // Capture ref value at effect-run time so cleanup uses the same node
    // (the ref may point to a new/null element by unmount time).
    const node = containerRef.current;
    if (node) {
      store.container = node;
    }
    return () => {
      if (store.container === node) {
        store.container = null;
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-live="polite"
      aria-label="Notifications"
      className="fixed z-[999999] flex flex-col gap-2 pointer-events-none top-[env(safe-area-inset-top,0px)] pt-3 right-4 left-4 sm:left-auto max-w-[420px] w-full min-w-[300px]"
    />
  );
}
