import type { Metadata } from "next";

import { LegalShell } from "@/components/legal-shell";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description:
    "The terms governing your use of agentled.co and Agent-led Growth.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalShell title="Terms & Conditions" updated="August 2026">
      <p>
        These Terms govern your use of <strong>agentled.co</strong>, Agent-led
        Growth, and the tools and services provided through the website.
      </p>
      <p>
        Agent-led Growth is operated by <strong>Campo Base Labs SL</strong>, a
        company based in Spain.
      </p>
      <p>By using our website or services, you agree to these Terms.</p>

      <h2>Using our services</h2>
      <p>You may use Agent-led Growth and its tools for lawful purposes.</p>
      <p>
        You must not misuse the services, attempt to interfere with their
        operation, access them in an unauthorized way, or use them in a way that
        violates applicable law or the rights of others.
      </p>
      <p>
        We may modify, suspend, limit, or discontinue parts of the service at
        any time.
      </p>

      <h2>Accounts and subscriptions</h2>
      <p>Some features may require an account or paid subscription.</p>
      <p>
        If you create an account, you are responsible for keeping your account
        credentials secure and for activity performed through your account.
      </p>
      <p>
        Prices and features may change from time to time. Any applicable pricing
        and billing terms will be shown before purchase.
      </p>

      <h2>Content and intellectual property</h2>
      <p>
        Unless otherwise stated, the content, software, branding, research,
        tools, and other materials available through Agent-led Growth belong to
        Campo Base Labs SL or its licensors.
      </p>
      <p>
        You may use our publicly available content for personal or internal
        business purposes, but you may not reproduce, resell, redistribute, or
        commercially exploit our services or content without permission.
      </p>

      <h2>Third-party services</h2>
      <p>
        Our services may include links to or rely on third-party services. We
        are not responsible for third-party websites, services, content, or
        their availability.
      </p>

      <h2>No guarantees</h2>
      <p>
        Agent-led Growth provides research, analysis, software, and
        informational tools.
      </p>
      <p>
        We aim to provide useful and accurate information, but we do not
        guarantee that information, rankings, AI-generated results, analyses, or
        other outputs will always be complete, accurate, current, or suitable
        for a particular purpose.
      </p>
      <p>
        You are responsible for how you use information provided through the
        service.
      </p>

      <h2>Liability</h2>
      <p>
        To the maximum extent permitted by law, Campo Base Labs SL will not be
        liable for indirect, incidental, special, or consequential losses
        arising from your use of Agent-led Growth.
      </p>
      <p>
        Nothing in these Terms excludes liability that cannot legally be
        excluded.
      </p>

      <h2>Termination</h2>
      <p>
        We may suspend or terminate access to the service if these Terms are
        violated or where reasonably necessary to protect the service or other
        users.
      </p>
      <p>You may stop using the service at any time.</p>

      <h2>Changes to these Terms</h2>
      <p>
        We may update these Terms from time to time. The latest version will be
        available on this page.
      </p>

      <h2>Governing law</h2>
      <p>
        These Terms are governed by the laws of Spain, without prejudice to any
        mandatory consumer protections that may apply to you.
      </p>

      <h2>Contact</h2>
      <p>Questions about these Terms can be sent to:</p>
      <p>
        <strong>Campo Base Labs SL</strong>
        <br />
        Spain
        <br />
        <a href="mailto:hello@agentled.co">hello@agentled.co</a>
      </p>
    </LegalShell>
  );
}
