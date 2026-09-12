"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Wine, Mail, RefreshCw, CheckCircle2 } from "lucide-react";
import { auth, sendEmailVerification, firebaseSignOut } from "@/lib/firebase";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function VerifyEmailPage() {
  const router = useRouter();
  const { refreshTier } = useAuth();
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    const firebaseAuth = auth();
    if (!firebaseAuth?.currentUser) {
      router.push("/signup");
      return;
    }

    setEmail(firebaseAuth.currentUser.email || "");

    // If already verified (e.g. Google user), redirect to cellar
    if (firebaseAuth.currentUser.emailVerified) {
      router.push("/cellar");
    }
  }, [router]);

  // The server mints the __session cookie only for a verified email, and a
  // just-verified account still holds a cached ID token that says otherwise.
  // Refresh that token, then re-run profile init: it establishes the cookie
  // and gives this tab the userId + tier the app reads from context.
  const enterCellar = useCallback(async () => {
    const firebaseAuth = auth();
    const currentUser = firebaseAuth?.currentUser;
    if (!currentUser) return;
    await currentUser.getIdToken(true);
    await refreshTier();
    router.push("/cellar");
  }, [refreshTier, router]);

  const handleResend = useCallback(async () => {
    setResending(true);
    setError("");
    setResent(false);

    try {
      const firebaseAuth = auth();
      if (!firebaseAuth?.currentUser) {
        setError("Session expired. Please sign up again.");
        return;
      }
      await sendEmailVerification(firebaseAuth.currentUser);
      setResent(true);
    } catch (err) {
      const fbErr = err as { code?: string; message?: string };
      if (fbErr.code === "auth/too-many-requests") {
        setError("Too many attempts. Please wait a few minutes before trying again.");
      } else {
        setError(fbErr.message || "Failed to send verification email.");
      }
    } finally {
      setResending(false);
    }
  }, []);

  const handleCheckVerification = useCallback(async () => {
    setChecking(true);
    setError("");

    try {
      const firebaseAuth = auth();
      if (!firebaseAuth?.currentUser) {
        setError("Session expired. Please sign in again.");
        return;
      }

      // Reload the user to get the latest emailVerified status
      await firebaseAuth.currentUser.reload();

      if (firebaseAuth.currentUser.emailVerified) {
        await enterCellar();
      } else {
        setError("Email not verified yet. Please check your inbox and click the verification link.");
      }
    } catch {
      setError("Failed to check verification status. Please try again.");
    } finally {
      setChecking(false);
    }
  }, [enterCellar]);

  const handleSignOut = useCallback(async () => {
    try {
      const { clearSession } = await import("@/server/actions/auth");
      await clearSession();
    } catch {
      /* best effort */
    }
    const firebaseAuth = auth();
    if (firebaseAuth) {
      await firebaseSignOut(firebaseAuth);
    }
    router.push("/signup");
  }, [router]);

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Wine className="h-8 w-8 text-primary" />
          <span className="text-2xl font-bold">Cellar Door</span>
        </div>
        <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-2">
          <Mail className="h-8 w-8 text-primary" />
        </div>
        <CardTitle className="text-xl">Verify your email</CardTitle>
        <CardDescription>
          We sent a verification link to{" "}
          {email ? (
            <span className="font-medium text-foreground">{email}</span>
          ) : (
            "your email"
          )}
          . Please check your inbox and click the link to activate your account.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <div className="text-sm text-destructive bg-destructive/10 rounded-md p-3">
            {error}
          </div>
        )}

        {resent && !error && (
          <div className="text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 rounded-md p-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Verification email sent! Check your inbox.
          </div>
        )}

        <Button
          className="w-full gap-2"
          onClick={handleCheckVerification}
          disabled={checking}
        >
          {checking ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Checking...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" />
              I&apos;ve verified my email
            </>
          )}
        </Button>

        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={handleResend}
          disabled={resending}
        >
          {resending ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Mail className="h-4 w-4" />
              Resend verification email
            </>
          )}
        </Button>

        <div className="pt-2 text-center">
          <p className="text-xs text-muted-foreground mb-2">
            Don&apos;t see the email? Check your spam folder.
          </p>
          <button
            onClick={handleSignOut}
            className="text-xs text-muted-foreground hover:text-primary underline"
          >
            Sign up with a different email
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
