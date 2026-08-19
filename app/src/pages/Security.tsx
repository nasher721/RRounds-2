import * as React from "react";
import { Link } from "react-router-dom";
import { CONTACT_EMAIL, CONTACT_EMAIL_IS_CONFIGURED } from "@/config/marketing";

const Security: React.FC = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <Link
            to="/"
            className="text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
          >
            ← Back to home
          </Link>
        </div>
      </header>
      <main
        id="main-content"
        tabIndex={-1}
        className="max-w-3xl mx-auto px-6 py-12 space-y-8"
      >
        <div>
          <h1 className="text-3xl font-extrabold font-heading mb-2">Security deployment guidance</h1>
          <p className="text-muted-foreground text-sm leading-[1.5]">
            Last reviewed: July 11, 2026. This overview describes application behavior, not a certification or compliance determination for a particular deployment.
          </p>
        </div>

        <section className="space-y-3 leading-[1.5] text-muted-foreground">
          <h2 className="text-xl font-semibold text-foreground">Deployment responsibility</h2>
          <p>
            The deployment operator is responsible for validating hosting, authentication, authorization policies, administrative access, backups, monitoring, incident response, provider agreements, and device controls before sensitive data is used.
          </p>
          <p>
            Clinical content is stored in the configured backend and may be synchronized to authenticated clients. Authentication alone does not prove that authorization is correctly configured; each deployment must test its database and storage policies for its intended roles.
          </p>
        </section>

        <section className="space-y-3 leading-[1.5] text-muted-foreground">
          <h2 className="text-xl font-semibold text-foreground">Transport, hosting, and browser storage</h2>
          <p>
            When deployed behind HTTPS, traffic is encrypted in transit between the browser and configured services. This transport protection is not end-to-end encryption. At-rest encryption, backup encryption, key management, and data residency depend on the selected hosting and storage configuration and must be confirmed by the deployment operator.
          </p>
          <p>
            The application may cache clinical content in browser storage for application and offline features. Use managed-device controls and operating-system protections, restrict shared-device use, and sign out when a session is complete. Authentication and password handling depend on the configured identity provider.
          </p>
        </section>

        <section className="space-y-3 leading-[1.5] text-muted-foreground">
          <h2 className="text-xl font-semibold text-foreground">Change history and audit coverage</h2>
          <p>
            Some record fields preserve change timestamps and user attribution where the feature is enabled and an authenticated identity is available.
          </p>
          <p>
            This is not a comprehensive access audit log and should not be presented as one. The deployment operator must add, retain, protect, and review any audit logging required by its policies or applicable law.
          </p>
        </section>

        <section className="space-y-3 leading-[1.5] text-muted-foreground">
          <h2 className="text-xl font-semibold text-foreground">Contact</h2>
          <p>
            For security questions, vulnerability reports, or compliance inquiries:
          </p>
          {CONTACT_EMAIL_IS_CONFIGURED ? (
            <p>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-primary font-medium hover:underline"
              >
                {CONTACT_EMAIL}
              </a>
            </p>
          ) : (
            <p>The deployment operator has not configured a public contact address.</p>
          )}
          <p className="text-sm italic">The deployment operator should publish its own security contact and response process before production.</p>
        </section>
      </main>
    </div>
  );
};

export default Security;
