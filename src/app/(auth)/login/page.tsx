"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Wine, Loader2 } from "lucide-react";
import {
  auth,
  signInWithGoogle,
  signInWithEmailAndPassword,
} from "@/lib/firebase";
import { syncUser } from "@/server/actions/auth";
import { markJustSignedIn } from "@/lib/auth-handoff";
import { GoogleButton, OrEmailDivider } from "@/components/auth/google-button";
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

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const firebaseAuth = auth();
      if (!firebaseAuth) throw new Error("Firebase not configured");
      const result = await signInWithEmailAndPassword(firebaseAuth, email, password);
      const idToken = await result.user.getIdToken();
      await syncUser(idToken);

      // Redirect unverified email users to verification page
      if (!result.user.emailVerified) {
        router.push("/verify-email");
      } else {
        // Mark the just-signed-in handoff so (app)/layout doesn't bounce
        // us back to /login while Firebase catches up (Firefox can be slow).
        markJustSignedIn();
        router.push("/cellar");
      }
    } catch (err: unknown) {
      const firebaseError = err as { code?: string; message?: string };
      if (
        firebaseError.code === "auth/user-not-found" ||
        firebaseError.code === "auth/wrong-password" ||
        firebaseError.code === "auth/invalid-credential"
      ) {
        setError("Invalid email or password.");
      } else {
        setError(firebaseError.message || "Failed to sign in.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setLoading(true);

    try {
      // signInWithGoogle automatically uses the right path: Firebase
      // popup on web, @capacitor-firebase/authentication's native
      // Google SDK on Capacitor (web popups are blocked inside
      // Android WebViews since 2021).
      authLog("login: signInWithGoogle start");
      const result = await signInWithGoogle();
      authLog("login: signInWithGoogle resolved");
      const idToken = await result.user.getIdToken();
      authLog("login: idToken acquired, calling syncUser");
      // Important: await syncUser BEFORE navigating. Otherwise the
      // (app)/layout.tsx route guard can fire while the Prisma user
      // row is still being created on the server, bouncing the user
      // back to /login (the symptom that looked like "first tap fails").
      await syncUser(idToken);
      authLog("login: syncUser returned, navigating to /cellar");
      // Same handoff marker as the email path — see comment above.
      markJustSignedIn();
      router.push("/cellar");
    } catch (err: unknown) {
      const firebaseError = err as { code?: string; message?: string };
      authLog("login: signInWithGoogle error", firebaseError);
      // Suppress the noise from user-cancelled flows
      if (
        firebaseError.code !== "auth/popup-closed-by-user" &&
        firebaseError.code !== "auth/cancelled-popup-request" &&
        !/cancel/i.test(firebaseError.message || "")
      ) {
        // Friendlier message for the cold-start "needs another tap" case —
        // the underlying lib/firebase.ts already retried once; if we're
        // here, both attempts failed, so prompt the user to try again
        // rather than dumping a Firebase stack trace.
        setError(
          "Sign-in needs another tap — please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // While the Google popup completes + syncUser + Next.js navigates to
  // /cellar, the login form sits visible for ~1-2s. The previous version
  // showed the form during that wait, which looked like the sign-in
  // hadn't worked. This overlay replaces the form with a spinner so
  // there's a clear "we're working on it" signal during the handoff.
  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Signing you in…</p>
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
        <CardTitle className="text-xl">Welcome back</CardTitle>
        <CardDescription>Sign in to manage your cellar</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <div className="text-sm text-destructive bg-destructive/10 rounded-md p-3">
            {error}
          </div>
        )}

        <GoogleButton onClick={handleGoogleLogin} disabled={loading} />

        <OrEmailDivider />

        <form onSubmit={handleEmailLogin} className="space-y-4">
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </Button>
        </form>
      </CardContent>

      <CardFooter className="flex justify-center">
        <p className="text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-primary hover:underline">
            Sign up
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
