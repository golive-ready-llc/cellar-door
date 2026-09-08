import type { Metadata, Viewport } from "next";
import { SITE_URL } from "@/lib/site-url";
import { Inter } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/components/auth-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { CapacitorInit } from "@/components/capacitor-init";
import { ClientErrorReporter } from "@/components/client-error-reporter";
import { AdSenseLoader } from "@/components/consent/adsense-loader";
import { CookieConsent } from "@/components/consent/cookie-consent";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover", // Required for safe area insets on iOS
  themeColor: "#7c3aed",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Cellar Door",
  description: "Track your wine collection with AI-powered insights",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Cellar Door",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <AuthProvider>
            <TooltipProvider>
              <CapacitorInit />
              <ClientErrorReporter />
              {children}
              {/* AdSense loads only after the visitor opts in (see CookieConsent). */}
              <AdSenseLoader />
              <CookieConsent />
            </TooltipProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
