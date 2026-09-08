"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Trash2, AlertTriangle } from "lucide-react";
import { auth, firebaseSignOut } from "@/lib/firebase";
import { deleteAccount } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Step = "idle" | "confirm1" | "confirm2" | "deleting";

export function DeleteAccountCard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState("");
  const [typedConfirm, setTypedConfirm] = useState("");

  const CONFIRM_TEXT = "DELETE MY ACCOUNT";

  const handleDelete = useCallback(async () => {
    setError("");
    setStep("deleting");

    try {
      const firebaseAuth = auth();
      if (!firebaseAuth?.currentUser) {
        setError("You must be signed in to delete your account.");
        setStep("idle");
        return;
      }

      const idToken = await firebaseAuth.currentUser.getIdToken();
      const result = await deleteAccount(idToken);

      if (!result.success) {
        setError(result.error || "Failed to delete account.");
        setStep("idle");
        return;
      }

      // Sign out of Firebase and redirect to home
      await firebaseSignOut(firebaseAuth);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
      setStep("idle");
    }
  }, [router]);

  const handleCancel = useCallback(() => {
    setStep("idle");
    setTypedConfirm("");
    setError("");
  }, []);

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <Trash2 className="h-5 w-5" />
          Delete Account
        </CardTitle>
        <CardDescription>
          Permanently delete your account and all associated data. This action
          cannot be undone.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="text-sm text-destructive bg-destructive/10 rounded-md p-3 mb-4">
            {error}
          </div>
        )}

        {step === "idle" && (
          <Button
            variant="destructive"
            onClick={() => setStep("confirm1")}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Delete My Account
          </Button>
        )}

        {step === "confirm1" && (
          <div className="space-y-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="text-sm font-semibold text-destructive">
                  Are you sure you want to delete your account?
                </p>
                <p className="text-sm text-muted-foreground">
                  This will permanently delete:
                </p>
                <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                  <li>All your wines and cellar data</li>
                  <li>All cabinets, walls, and rack layouts</li>
                  <li>Your entire consumption history</li>
                  <li>Your buy list and wish list</li>
                  <li>All ratings and community contributions</li>
                  <li>Your account and profile information</li>
                </ul>
                <p className="text-sm text-muted-foreground font-medium">
                  This action is permanent and cannot be reversed. We recommend
                  exporting a backup first (see Data &amp; Backup above).
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCancel} className="flex-1">
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => setStep("confirm2")}
                className="flex-1 gap-2"
              >
                <AlertTriangle className="h-4 w-4" />
                Yes, I want to delete
              </Button>
            </div>
          </div>
        )}

        {step === "confirm2" && (
          <div className="space-y-4 rounded-lg border-2 border-destructive bg-destructive/5 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 text-destructive shrink-0 mt-0.5 animate-pulse" />
              <div className="space-y-3">
                <p className="text-sm font-bold text-destructive">
                  Final confirmation — this cannot be undone!
                </p>
                <p className="text-sm text-muted-foreground">
                  Type <span className="font-mono font-bold text-destructive">{CONFIRM_TEXT}</span> below
                  to permanently delete your account and all data:
                </p>
                <input
                  type="text"
                  value={typedConfirm}
                  onChange={(e) => setTypedConfirm(e.target.value)}
                  placeholder={CONFIRM_TEXT}
                  className="w-full rounded-md border border-destructive/50 bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-destructive/50"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCancel} className="flex-1">
                Cancel — keep my account
              </Button>
              <Button
                variant="destructive"
                disabled={typedConfirm !== CONFIRM_TEXT}
                onClick={handleDelete}
                className="flex-1 gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Permanently Delete
              </Button>
            </div>
          </div>
        )}

        {step === "deleting" && (
          <div className="flex items-center gap-3 p-4 rounded-lg border border-destructive/30 bg-destructive/5">
            <div className="h-5 w-5 border-2 border-destructive border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-destructive font-medium">
              Deleting your account and all data...
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
