"use client";

import { useState } from "react";
import { MessageSquare, Check } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/custom-toast";
import { submitFeedback } from "@/server/actions/feedback";

const SUBJECT_OPTIONS = [
  { value: "bug_report", label: "Bug Report" },
  { value: "feature_request", label: "Feature Request" },
  { value: "general", label: "General Feedback" },
  { value: "question", label: "Question" },
  { value: "account", label: "Account Issue" },
  { value: "billing", label: "Billing" },
] as const;

type SubjectValue = (typeof SUBJECT_OPTIONS)[number]["value"];

export function SupportCard() {
  const { userId, devMode } = useAuth();
  const [subject, setSubject] = useState<SubjectValue>("general");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      toast.error("Please enter a message");
      return;
    }
    if (!userId) {
      toast.error("You must be signed in to submit feedback");
      return;
    }

    setSubmitting(true);
    try {
      if (devMode) {
        toast.success("Feedback submitted (dev mode)");
      } else {
        const result = await submitFeedback(userId, subject, message.trim());
        if (!result.success) {
          toast.error(result.error || "Failed to submit");
          return;
        }
        toast.success("Feedback submitted! We'll get back to you soon.");
      }
      setSubmitted(true);
      setMessage("");
    } catch {
      toast.error("Failed to submit feedback");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <Card>
        <CardContent className="py-8 text-center space-y-3">
          <div className="mx-auto w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <p className="font-medium">Thank you for your feedback!</p>
          <p className="text-sm text-muted-foreground">
            We review every submission and will get back to you if needed.
          </p>
          <Button variant="outline" size="sm" onClick={() => setSubmitted(false)}>
            Send another
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          Feedback & Support
        </CardTitle>
        <CardDescription>
          Bug reports, feature requests, or general feedback — we read every message.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="feedback-subject" className="text-sm font-medium mb-1.5 block">
              Subject
            </label>
            <select
              id="feedback-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value as SubjectValue)}
              className={cn(
                "w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              )}
            >
              {SUBJECT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="feedback-message" className="text-sm font-medium mb-1.5 block">
              Message
            </label>
            <textarea
              id="feedback-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell us what's on your mind..."
              rows={4}
              className={cn(
                "w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              )}
            />
          </div>

          <Button type="submit" className="gap-2" disabled={submitting}>
            <MessageSquare className="h-4 w-4" />
            {submitting ? "Sending..." : "Send Feedback"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
