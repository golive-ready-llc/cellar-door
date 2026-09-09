import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site-url";
import { Wine, ArrowLeft } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | Cellar Door",
  description: "Terms of Service for Cellar Door wine collection management.",
  alternates: { canonical: `${SITE_URL}/terms` },
};

export default function TermsPage() {
  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Wine className="h-6 w-6 text-primary" />
          <Link href="/" className="text-xl font-bold hover:underline">
            Cellar Door
          </Link>
        </div>
        <Link
          href="/signup"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Sign Up
        </Link>
      </div>

      {/* Terms of Service */}
      <section className="mb-12">
        <h1 className="text-2xl font-bold mb-1">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Effective date: March 10, 2026
        </p>

        <div className="prose prose-sm dark:prose-invert space-y-4 text-sm text-foreground/90">
          <h2 className="text-lg font-semibold mt-6">1. Acceptance of Terms</h2>
          <p>
            By creating an account or using the Cellar Door platform
            (&quot;Platform&quot;), operated by Golive Ready, LLC, including our
            website at mycellardoor.app and any associated mobile applications,
            you agree to be bound by these Terms of Service (&quot;Terms&quot;).
            If you do not agree, do not use the Platform.
          </p>

          <h2 className="text-lg font-semibold mt-6">2. Description of Service</h2>
          <p>
            Cellar Door provides a wine collection management platform that
            enables registered users to catalog, organize, rate, and track their
            wine collections. Additional features include AI-powered wine
            analysis, community ratings, and cellar visualization tools.
          </p>

          <h2 className="text-lg font-semibold mt-6">3. User Accounts</h2>
          <p>
            You must be of legal drinking age in your jurisdiction to create an
            account. You are responsible for maintaining the security of your
            account credentials and for all activity that occurs under your
            account. You agree to provide accurate and complete information when
            creating your account.
          </p>

          <h2 className="text-lg font-semibold mt-6">4. Subscription Plans</h2>
          <p>
            Cellar Door offers free and paid subscription tiers. Paid
            subscriptions (Cellar+ and Cellar Pro) are billed monthly through
            Stripe. Free trials, where offered, convert to paid subscriptions at
            the end of the trial period unless cancelled. You may cancel your
            subscription at any time through the Manage Subscription portal in
            your Settings.
          </p>

          <h2 className="text-lg font-semibold mt-6">5. User Content</h2>
          <p>
            You retain ownership of any content you submit to the Platform,
            including wine ratings, reviews, tasting notes, and images. By
            submitting content, you grant Golive Ready, LLC a non-exclusive,
            worldwide license to use, display, and distribute your content in
            connection with the Platform and community features.
          </p>

          <h2 className="text-lg font-semibold mt-6">6. Acceptable Use</h2>
          <p>
            You agree not to misuse the Platform, including but not limited to:
            attempting to gain unauthorized access, using the Platform for
            unlawful purposes, submitting false or misleading information, or
            interfering with the operation of the Platform.
          </p>

          <h2 className="text-lg font-semibold mt-6">7. Disclaimers</h2>
          <p>
            The Platform is provided &quot;as is&quot; without warranties of any
            kind. AI-generated content (tasting notes, price estimates, critic
            score predictions) is for informational purposes only and should not
            be relied upon as professional advice. Golive Ready, LLC is not
            responsible for the accuracy of AI-generated content.
          </p>

          <h2 className="text-lg font-semibold mt-6">8. Limitation of Liability</h2>
          <p>
            To the fullest extent permitted by law, Golive Ready, LLC shall not
            be liable for any indirect, incidental, special, or consequential
            damages arising from your use of the Platform, including but not
            limited to loss of data, wine valuations, or business opportunities.
          </p>

          <h2 className="text-lg font-semibold mt-6">9. Account Deletion</h2>
          <p>
            You may delete your account and all associated data at any time
            through the Settings page, and you can export your collection to CSV
            or JSON beforehand. Account deletion is permanent and irreversible —
            all your wines, cabinets, history, ratings, and personal information
            are immediately removed from our live database. Encrypted
            disaster-recovery backups are never used to restore a deleted
            account and age out on their retention schedule. Anonymized community
            ratings may be retained. See the Privacy Policy below for details.
          </p>

          <h2 className="text-lg font-semibold mt-6">10. Termination</h2>
          <p>
            We reserve the right to suspend or terminate your account at any time
            for violation of these Terms. Upon termination, your right to use the
            Platform ceases immediately.
          </p>

          <h2 className="text-lg font-semibold mt-6">11. Changes to Terms</h2>
          <p>
            We may update these Terms from time to time. We will notify you of
            significant changes via email or an in-app notification. Continued
            use of the Platform after changes constitutes acceptance of the
            updated Terms.
          </p>
        </div>
      </section>

      {/* Privacy Policy */}
      <section id="privacy" className="scroll-mt-8">
        <h1 className="text-2xl font-bold mb-1">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Effective date: June 15, 2026
        </p>

        <div className="prose prose-sm dark:prose-invert space-y-4 text-sm text-foreground/90">
          <h2 className="text-lg font-semibold mt-6">Data Controller</h2>
          <p>
            Golive Ready, LLC, doing business as Cellar Door (&quot;we&quot;,
            &quot;our&quot;, &quot;us&quot;), operates the wine collection
            management platform at mycellardoor.app and associated mobile
            applications (the &quot;Platform&quot;). This Privacy Policy
            describes how we collect, process, and protect your personal data
            when you use our Platform.
          </p>
          <p>
            For privacy inquiries, contact us at:{" "}
            <a href="mailto:support@mycellardoor.app" className="text-primary hover:underline">
              support@mycellardoor.app
            </a>
          </p>

          <h2 className="text-lg font-semibold mt-6">Information We Collect</h2>
          <p>We collect the following categories of personal data:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Account Information:</strong> Name, email address, and
              profile picture when you register via email, Google, or other
              sign-in providers.
            </li>
            <li>
              <strong>Wine Collection Data:</strong> Wine details you enter
              including names, wineries, vintages, ratings, prices, tasting
              notes, and images.
            </li>
            <li>
              <strong>Usage Data:</strong> How you interact with the Platform,
              including pages visited, features used, and device information.
            </li>
            <li>
              <strong>Payment Information:</strong> Subscription and billing data
              processed securely through Stripe. We do not store credit card
              numbers on our servers.
            </li>
          </ul>

          <h2 className="text-lg font-semibold mt-6">How We Use Your Data</h2>
          <p>We process your personal data for the following purposes:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Managing your account and providing access to the Platform</li>
            <li>Processing subscriptions and payments via Stripe</li>
            <li>Providing AI-powered wine analysis and recommendations</li>
            <li>Aggregating anonymous community ratings (CD Scores)</li>
            <li>Improving the Platform through analytics and development</li>
            <li>
              Displaying advertisements to free-tier users via Google AdSense
            </li>
            <li>Communicating service updates and policy changes</li>
          </ul>

          <h2 className="text-lg font-semibold mt-6">Third-Party Services</h2>
          <p>
            We use the following third-party services to operate the Platform:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Firebase (Google):</strong> Authentication and user identity
              management
            </li>
            <li>
              <strong>Stripe:</strong> Payment processing for subscriptions
            </li>
            <li>
              <strong>Google AdSense:</strong> Advertising for free-tier users
            </li>
            <li>
              <strong>AI providers:</strong> AI-powered wine analysis, label and
              receipt scanning, enrichment, and the sommelier chat. Depending on
              our current configuration, these features are powered by one or more
              third-party large-language-model providers, which may include{" "}
              <strong>DeepSeek</strong>, <strong>Alibaba Cloud (Qwen)</strong>, and{" "}
              <strong>Google (Gemini)</strong>. See the &ldquo;AI Processing &amp;
              International Data Transfers&rdquo; section below for details on what
              is sent and where it is processed.
            </li>
            <li>
              <strong>Neon (PostgreSQL):</strong> Secure database hosting
            </li>
            <li>
              <strong>Vercel:</strong> Application hosting and deployment
            </li>
          </ul>
          <p>
            Each service processes data in accordance with their own privacy
            policies. We ensure appropriate data processing agreements are in
            place.
          </p>

          <h2 className="text-lg font-semibold mt-6">
            AI Processing &amp; International Data Transfers
          </h2>
          <p>
            When you use AI features &mdash; scanning a wine label, barcode,
            receipt, or wine list; AI search and enrichment; or the sommelier
            chat &mdash; the content needed for that feature is sent to a
            third-party AI provider for processing. This may include the photos
            you capture, the wine details and tasting notes you enter, relevant
            information about your collection, and the messages you send in chat.
          </p>
          <p>
            Some of our AI providers are located outside the United States and the
            European Economic Area, <strong>including in China</strong>{" "}
            (for example, DeepSeek and Alibaba Cloud). Where data is processed in such
            jurisdictions, it may be subject to that country&rsquo;s laws, and the
            legal protections may differ from those in your own country. We rely on
            appropriate safeguards (such as standard contractual clauses, where
            applicable) for these international transfers.
          </p>
          <p>
            We do not control the AI providers&rsquo; independent data practices.
            Their handling of your inputs &mdash; including whether data is
            retained or used to improve their models &mdash; is governed by their
            own terms and privacy policies. We encourage you to review them. If you
            prefer not to have your content processed by AI providers, you can
            avoid using the AI features; core collection-management features do not
            require them.
          </p>

          <h2 className="text-lg font-semibold mt-6">
            Cookies &amp; Similar Technologies
          </h2>
          <p>
            We use two kinds of cookies and similar browser storage:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Strictly necessary (always on):</strong> keeping you signed
              in (Firebase authentication), remembering that you&apos;ve passed a
              site password gate where one is enabled, the demo-mode flag when you
              try the demo, and small interface preferences such as the sidebar
              state. These are required for the Platform to function and are not
              used for advertising or cross-site tracking.
            </li>
            <li>
              <strong>Advertising (opt-in):</strong> Google AdSense, shown only to
              free-tier users, sets cookies to serve and measure ads. These load
              only after you accept them in our cookie banner. If you reject them
              — or simply don&apos;t choose — the ad script is never loaded and no
              advertising cookies are set; free-tier pages fall back to
              non-tracking placeholder ads.
            </li>
          </ul>
          <p>
            You can change your choice at any time from the &ldquo;Cookie
            settings&rdquo; link in the site footer. We do not use analytics,
            marketing, or cross-site tracking scripts beyond the AdSense case
            described above.
          </p>

          <h2 className="text-lg font-semibold mt-6">Advertising</h2>
          <p>
            Free-tier users may see advertisements served by Google AdSense, but
            only if they have opted in to advertising cookies (see &ldquo;Cookies
            &amp; Similar Technologies&rdquo; above). When enabled, these ads may
            use cookies and similar technologies to serve and measure content
            based on your browsing activity. Paid subscribers (Cellar+ and Cellar
            Pro) never see ads. You can also manage your ad preferences through
            your Google account settings.
          </p>

          <h2 className="text-lg font-semibold mt-6">Data Retention &amp; Deletion</h2>
          <p>
            Your personal data is retained for as long as your account is active.
            You can export your full collection to CSV or JSON at any time from
            Settings, so you can always take a copy of your data with you.
          </p>
          <p>
            You may delete your account at any time from Settings. Doing so
            immediately and permanently removes your personal data &mdash; wines,
            cabinets, history, ratings, and preferences &mdash; from our live
            database and cancels any active Stripe subscription in the same
            action. Residual copies may persist in our encrypted,
            disaster-recovery-only backups; those backups are never used to
            restore a deleted account, and your data is expunged from them as they
            roll off our backup retention schedule. Anonymized community ratings
            may be retained to maintain the integrity of the community scoring
            system.
          </p>

          <h2 className="text-lg font-semibold mt-6">Data Security</h2>
          <p>
            We implement technical and organizational measures to protect your
            personal data, including encrypted data transmission (HTTPS),
            secure authentication via Firebase, and access controls on our
            database. However, no system is completely secure, and we cannot
            guarantee the absolute security of your data.
          </p>

          <h2 className="text-lg font-semibold mt-6">Your Rights</h2>
          <p>You have the right to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Access the personal data we hold about you</li>
            <li>Request correction of inaccurate data</li>
            <li>Delete your account and all personal data (via Settings)</li>
            <li>Export your wine collection data (via CSV export in Settings)</li>
            <li>Object to processing of your data for marketing purposes</li>
            <li>Withdraw consent for data processing at any time</li>
          </ul>
          <p>
            To exercise any of these rights, contact us at{" "}
            <a href="mailto:support@mycellardoor.app" className="text-primary hover:underline">
              support@mycellardoor.app
            </a>
            .
          </p>

          <h2 className="text-lg font-semibold mt-6">Children&apos;s Privacy</h2>
          <p>
            The Platform is intended for use by adults of legal drinking age in
            their jurisdiction. We do not knowingly collect personal information
            from anyone under the legal drinking age. If we become aware that we
            have collected data from an underage user, we will promptly delete
            the account and all associated data.
          </p>

          <h2 className="text-lg font-semibold mt-6">
            California Privacy Rights (CCPA/CPRA)
          </h2>
          <p>
            California residents have additional rights under the CCPA/CPRA,
            including the right to know what personal information is collected,
            the right to delete personal information, and the right to opt-out of
            the sale of personal information. We do not sell your personal
            information. To exercise your California privacy rights, contact us
            at the email address above.
          </p>

          <h2 className="text-lg font-semibold mt-6">Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify
            you of material changes via email or an in-app notification.
            Continued use of the Platform after changes constitutes acceptance of
            the updated policy.
          </p>
        </div>
      </section>

      <div className="mt-8 pt-4 border-t flex flex-col items-center gap-3">
        <Link
          href="/signup"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-medium"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Sign Up
        </Link>
        <p className="text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} Golive Ready, LLC. All rights reserved.
        </p>
      </div>
    </div>
  );
}
