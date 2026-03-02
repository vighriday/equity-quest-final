import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const Terms = () => (
  <div className="min-h-screen gradient-mesh flex flex-col items-center px-4 py-16">
    <div className="max-w-3xl w-full">
      <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8">
        <ArrowLeft className="h-4 w-4" />
        Back to Home
      </Link>

      <div className="glass-card p-8 sm:p-12 animate-fade-in">
        <h1 className="text-4xl font-bold text-gradient-primary mb-2">Terms & Conditions</h1>
        <p className="mb-8 text-muted-foreground">Last updated: March 2026</p>

        <div className="space-y-6 text-foreground/90 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold mb-2">1. Acceptance of Terms</h2>
            <p>By accessing or using Equity Quest (the "Platform"), you agree to be bound by these Terms & Conditions. If you do not agree, please do not use the Platform.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">2. Nature of Service</h2>
            <p>Equity Quest is a mock trading simulation for educational and entertainment purposes only. No real money is involved, and no actual financial transactions take place.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">3. User Conduct</h2>
            <p>You agree to use the Platform responsibly and not to engage in any activity that may disrupt the experience for others or compromise the integrity of the simulation.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">4. No Investment Advice</h2>
            <p>All information provided is for simulation purposes only and does not constitute investment advice. Equity Quest is not a registered investment advisor or broker.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">5. Intellectual Property</h2>
            <p>All content, branding, and features of the Platform are the property of Equity Quest and may not be copied or reproduced without permission.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">6. Limitation of Liability</h2>
            <p>Equity Quest is provided "as is" without warranties of any kind. We are not liable for any losses, data loss, service interruptions, or damages arising from your use of the Platform.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">7. Changes to Terms</h2>
            <p>We reserve the right to update these Terms at any time. Continued use of the Platform constitutes acceptance of the revised Terms.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">8. Contact</h2>
            <p>For questions regarding these Terms, please contact us at <a href="mailto:support@equityquest.com" className="text-primary hover:underline">support@equityquest.com</a>.</p>
          </section>
        </div>
      </div>
    </div>
  </div>
);

export default Terms;
