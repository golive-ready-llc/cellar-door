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
import { GoogleButton, OrEmailDivider } from "@/components/auth/google-button";
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

        <GoogleButton
          onClick={handleGoogleSignup}
          disabled={loading || !agreedToTerms || (turnstileEnabled && !token)}
        />

        <OrEmailDivider />

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
