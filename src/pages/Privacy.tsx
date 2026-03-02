import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const Privacy = () => (
  <div className="min-h-screen gradient-mesh flex flex-col items-center px-4 py-16">
    <div className="max-w-3xl w-full">
      <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8">
        <ArrowLeft className="h-4 w-4" />
        Back to Home
      </Link>

      <div className="glass-card p-8 sm:p-12 animate-fade-in">
        <h1 className="text-4xl font-bold text-gradient-primary mb-2">Privacy Policy</h1>
        <p className="mb-8 text-muted-foreground">Last updated: March 2026</p>

        <div className="space-y-6 text-foreground/90 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold mb-2">1. Introduction</h2>
            <p>Equity Quest (the "Platform") is committed to protecting your privacy. This policy explains how we collect, use, and safeguard your information.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">2. Information We Collect</h2>
            <p>We collect basic information such as your name, email address, and usage data when you register or use the Platform. No financial or sensitive personal data is collected.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">3. Use of Information</h2>
            <p>Your information is used solely to provide and improve the mock trading experience, communicate updates, and ensure platform security.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">4. Data Sharing</h2>
            <p>We do not sell or share your personal information with third parties, except as required by law or to operate the Platform (e.g., authentication providers).</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">5. Data Security</h2>
            <p>We implement industry-standard security measures including encrypted connections (TLS), secure authentication (JWT), and row-level database security to protect your data. While we employ best practices, no method of transmission over the internet is 100% secure.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">6. Cookies</h2>
            <p>The Platform uses essential cookies for authentication and session management. No third-party tracking cookies are used. You can disable cookies in your browser settings, though this may affect Platform functionality.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">7. Children's Privacy</h2>
            <p>Equity Quest is not intended for children under 13. We do not knowingly collect information from children under 13 years of age.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">8. Changes to Policy</h2>
            <p>We may update this Privacy Policy from time to time. Continued use of the Platform constitutes acceptance of the revised policy.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">9. Contact</h2>
            <p>For privacy-related questions, contact us at <a href="mailto:privacy@equityquest.com" className="text-primary hover:underline">privacy@equityquest.com</a>.</p>
          </section>
        </div>
      </div>
    </div>
  </div>
);

export default Privacy;
