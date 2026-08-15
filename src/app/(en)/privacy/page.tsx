import type { Metadata } from "next";

import { LegalShell } from "@/components/legal-shell";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Agent-led Growth (Campo Base Labs SL) collects and uses information.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="August 2026">
      <p>
        Agent-led Growth is operated by <strong>Campo Base Labs SL</strong>, a
        company based in Spain.
      </p>
      <p>
        This Privacy Policy explains how we collect and use information when you
        use agentled.co, subscribe to Agent-led Growth, or use our tools.
      </p>

      <h2>Information we collect</h2>
      <p>
        We may collect information you provide directly to us, such as your email
        address, account information, and information you submit when using our
        tools.
      </p>
      <p>
        We may also collect basic technical and usage information about how you
        interact with our website and services.
      </p>

      <h2>How we use your information</h2>
      <p>We use your information to:</p>
      <ul>
        <li>Provide and operate Agent-led Growth and its tools</li>
        <li>
          Send newsletters, updates, and other communications you have
          subscribed to
        </li>
        <li>Improve, secure, and understand how our services are used</li>
      </ul>
      <p>
        We may use service providers to help us operate our website, send
        communications, process payments, provide analytics, and deliver our
        services.
      </p>
      <p>We do not sell your personal information.</p>

      <h2>Legal basis</h2>
      <p>
        Where applicable under European data protection law, we process personal
        data based on your consent, the performance of a contract, our legal
        obligations, or our legitimate interests in operating and improving our
        services.
      </p>

      <h2>Data retention</h2>
      <p>
        We keep personal information only for as long as necessary for the
        purposes described above or as required by law.
      </p>

      <h2>Your rights</h2>
      <p>
        If you are in the European Economic Area, you may have rights to access,
        correct, delete, restrict, or object to the processing of your personal
        data, and to request data portability.
      </p>
      <p>
        You can also withdraw your consent at any time where processing is based
        on consent.
      </p>
      <p>
        To exercise these rights, contact us at{" "}
        <a href="mailto:hello@agentled.co">hello@agentled.co</a>.
      </p>
      <p>
        You also have the right to lodge a complaint with your local data
        protection authority.
      </p>

      <h2>Changes</h2>
      <p>
        We may update this Privacy Policy from time to time. The latest version
        will always be available on this page.
      </p>

      <h2>Contact</h2>
      <p>For privacy questions or requests, contact:</p>
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
