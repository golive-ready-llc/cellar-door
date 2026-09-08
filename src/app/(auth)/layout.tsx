import Link from "next/link";
import { X } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md px-4 relative">
        <Link
          href="/"
          className="absolute top-2 right-6 p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors z-10"
          aria-label="Back to home"
        >
          <X className="h-5 w-5" />
        </Link>
        {children}
      </div>
    </div>
  );
}
