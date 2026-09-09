import Link from "next/link";
import { X } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // overflow-y-auto + m-auto (instead of items-center) keeps the card
    // centered when it fits, but lets it scroll without top-clipping when it
    // doesn't — and pb-56 on mobile reserves room so the fixed cookie-consent
    // banner never covers the submit button on a first visit.
    <div className="min-h-screen flex overflow-y-auto bg-background">
      <div className="w-full max-w-md px-4 py-10 pb-56 sm:pb-10 relative m-auto">
        <Link
          href="/"
          className="absolute top-12 right-6 p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors z-10 sm:top-2"
          aria-label="Back to home"
        >
          <X className="h-5 w-5" />
        </Link>
        {children}
      </div>
    </div>
  );
}
