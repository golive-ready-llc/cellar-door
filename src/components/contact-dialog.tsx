"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TurnstileWidget, turnstileEnabled } from "@/components/turnstile-widget";
import { Loader2, CheckCircle2 } from "lucide-react";

/**
 * Landing-page contact form. Replaces the exposed support@ mailto links —
 * visitors reach us through a form that POSTs to /api/contact (which emails
 * us and logs the message) instead of scraping an address off the page.
 *
 * Self-contained: renders its own trigger (passed as `children`) and manages
 * its own open/submit state, so it can be dropped in multiple spots on the
 * landing without lifting state.
 */
export function ContactDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [status, setStatus] = React.useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = React.useState("");
  const [token, setToken] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    setError("");

    const form = e.currentTarget;
    const data = new FormData(form);
    const payload = {
      name: String(data.get("name") ?? ""),
      email: String(data.get("email") ?? ""),
      message: String(data.get("message") ?? ""),
      website: String(data.get("website") ?? ""), // honeypot
      turnstileToken: token,
    };

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && body.ok) {
        setStatus("sent");
        form.reset();
      } else {
        setStatus("error");
        setError(body.error || "Something went wrong. Please try again.");
      }
    } catch {
      setStatus("error");
      setError("Couldn't reach the server. Please try again.");
    }
  }

  // Reset back to the form whenever the dialog is reopened after a send.
  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setStatus("idle");
      setError("");
      setToken(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={children as React.ReactElement} />
      <DialogContent>
        {status === "sent" ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="h-10 w-10 text-primary" />
            <DialogTitle>Message sent</DialogTitle>
            <DialogDescription>
              Thanks for reaching out — we read every message and will get back to
              you by email.
            </DialogDescription>
            <Button variant="outline" className="mt-2" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Get in touch</DialogTitle>
              <DialogDescription>
                Questions, feedback, or a bug to report? Send us a note and we&apos;ll
                reply by email.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              {/* Honeypot — hidden from real users, catches bots. */}
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="hidden"
              />

              <div className="flex flex-col gap-1.5">
                <label htmlFor="contact-name" className="text-sm font-medium">
                  Name
                </label>
                <Input id="contact-name" name="name" required maxLength={200} autoComplete="name" />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="contact-email" className="text-sm font-medium">
                  Email
                </label>
                <Input
                  id="contact-email"
                  name="email"
                  type="email"
                  required
                  maxLength={320}
                  autoComplete="email"
                  placeholder="you@example.com"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="contact-message" className="text-sm font-medium">
                  Message
                </label>
                <Textarea id="contact-message" name="message" required maxLength={4000} rows={5} />
              </div>

              <TurnstileWidget onVerify={setToken} className="min-h-[65px]" />

              {status === "error" && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                className="mt-1"
                disabled={status === "sending" || (turnstileEnabled && !token)}
              >
                {status === "sending" && <Loader2 className="h-4 w-4 animate-spin" />}
                {status === "sending" ? "Sending…" : "Send message"}
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
