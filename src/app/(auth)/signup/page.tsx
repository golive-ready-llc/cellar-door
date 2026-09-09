"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Wine, Loader2 } from "lucide-react";
import {
  auth,
  signInWithGoogle,
  createUserWithEmailAndPassword,
  sendEmailVerification,
} from "@/lib/firebase";
import { updateProfile } from "firebase/auth";
import { syncUser } from "@/server/actions/auth";
import { verifyBotToken } from "@/server/actions/turnstile";
import { markJustSignedIn } from "@/lib/auth-handoff";
import { TurnstileWidget, turnstileEnabled } from "@/components/turnstile-widget";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const DEBUG_AUTH = process.env.NEXT_PUBLIC_DEBUG_AUTH === "true";
const authLog = (...args: unknown[]) => {
  if (DEBUG_AUTH) console.log("[auth]", ...args);
};

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (turnstileEnabled && !(await verifyBotToken(token))) {
        setError("Bot check failed — please try again.");
        setLoading(false);
        return;
      }
      const firebaseAuth = auth();
      if (!firebaseAuth) throw new Error("Firebase not configured");
      const result = await createUserWithEmailAndPassword(
        firebaseAuth,
        email,
        password
      );
      // Set display name
      if (name) {
        await updateProfile(result.user, { displayName: name });
      }

      // Send verification email
      await sendEmailVerification(result.user);

      const idToken = await result.user.getIdToken();
      await syncUser(idToken);
      router.push("/verify-email");
    } catch (err: unknown) {
      const firebaseError = err as { code?: string; message?: string };
      if (firebaseError.code === "auth/email-already-in-use") {
        setError("An account with this email already exists.");
      } else if (firebaseError.code === "auth/weak-password") {
        setError("Password should be at least 6 characters.");
      } else {
        setError(firebaseError.message || "Failed to create account.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    if (!agreedToTerms) {
      setError("Please agree to the Terms of Service before continuing.");
      return;
    }
    setError("");
    setLoading(true);

    try {
      if (turnstileEnabled && !(await verifyBotToken(token))) {
        setError("Bot check failed — please try again.");
        setLoading(false);
        return;
      }
      // signInWithGoogle uses the Firebase popup on web and the
      // native Google SDK via @capacitor-firebase/authentication on
      // Capacitor. Same UserCredential shape returned in both.
      authLog("signup: signInWithGoogle start");
      const result = await signInWithGoogle();
      authLog("signup: signInWithGoogle resolved");
      const idToken = await result.user.getIdToken();
      authLog("signup: idToken acquired, calling syncUser");
      // Await syncUser BEFORE navigating so the route guard finds the
      // freshly-created Prisma user instead of bouncing back to /login.
      await syncUser(idToken);
      authLog("signup: syncUser returned, navigating to /cellar");
      // Mark the handoff so (app)/layout doesn't bounce back to /login
      // while Firebase's onAuthStateChanged catches up (Firefox flake).
      markJustSignedIn();
      router.push("/cellar");
    } catch (err: unknown) {
      const firebaseError = err as { code?: string; message?: string };
      authLog("signup: signInWithGoogle error", firebaseError);
      if (
        firebaseError.code !== "auth/popup-closed-by-user" &&
        firebaseError.code !== "auth/cancelled-popup-request" &&
        !/cancel/i.test(firebaseError.message || "")
      ) {
        setError(
          "Sign-up needs another tap — please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // While Google sign-up + syncUser + Next.js navigation complete,
  // the form would otherwise sit visible for ~1-2s, looking like
  // nothing happened. This loading overlay gives clear feedback.
  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Creating your account…</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Wine className="h-8 w-8 text-primary" />
          <span className="text-2xl font-bold">Cellar Door</span>
        </div>
        <CardTitle className="text-xl">Create an account</CardTitle>
        <CardDescription>
          Start tracking your wine collection
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <div className="text-sm text-destructive bg-destructive/10 rounded-md p-3">
            {error}
          </div>
        )}

        <TurnstileWidget onVerify={setToken} className="flex justify-center min-h-[65px]" />

        <Button
          variant="outline"
          className="w-full"
          onClick={handleGoogleSignup}
          disabled={loading || !agreedToTerms || (turnstileEnabled && !token)}
        >
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Continue with Google
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">
              or continue with email
            </span>
          </div>
        </div>

        <form onSubmit={handleEmailSignup} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          {/* Terms agreement — placed immediately before the signup button
              so the user naturally sees it as the last step before submitting. */}
          <div className="flex items-start gap-2 pt-1">
            <input
              type="checkbox"
              id="terms"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-input accent-primary"
            />
            <label htmlFor="terms" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
              I agree to the{" "}
              <Link href="/terms" className="text-primary hover:underline" target="_blank">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/terms" className="text-primary hover:underline" target="_blank">
                Privacy Policy
              </Link>
            </label>
          </div>

          <Button type="submit" className="w-full" disabled={loading || !agreedToTerms || (turnstileEnabled && !token)}>
            {loading ? "Creating account..." : "Create Account"}
          </Button>
          {!agreedToTerms && (
            <p className="text-[11px] text-center text-muted-foreground">
              Check the box above to enable signup
            </p>
          )}
        </form>


      </CardContent>

      <CardFooter className="flex justify-center">
        <p className="text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
