import { Link } from "react-router-dom";
import { ArrowLeft, Zap, BookOpen, ShieldCheck, Mail } from "lucide-react";

const sections = [
  {
    icon: BookOpen,
    title: "About Equity Quest",
    content:
      "Equity Quest is a high-stakes mock trading platform designed for aspiring investors, students, and finance enthusiasts. Our mission is to provide a realistic, competitive, and educational environment where you can test your trading skills without risking real money.",
  },
  {
    icon: Zap,
    title: "How It Works",
    items: [
      "Sign up and receive virtual capital to start trading immediately.",
      "Browse the live market, analyze sectors, and execute trades with market, limit, and stop-loss orders.",
      "Track your portfolio performance in real time with advanced analytics and risk metrics.",
      "Compete on the leaderboard against other participants and climb the ranks.",
      "React to simulated news and dynamic market events that test your adaptability.",
    ],
  },
  {
    icon: ShieldCheck,
    title: "Trading Rules",
    items: [
      "Each participant starts with the same virtual capital for fair competition.",
      "Margin requirements and position limits are enforced to simulate real-world risk management.",
      "Short selling is available with appropriate margin controls.",
      "All trades are final once executed -- review your orders carefully.",
      "Leaderboard rankings are based on total portfolio value and risk-adjusted returns.",
    ],
  },
  {
    icon: Mail,
    title: "Contact & Support",
    content: (
      <>
        Have questions or need help? Reach out to us at{" "}
        <a
          href="mailto:support@equityquest.com"
          className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
        >
          support@equityquest.com
        </a>
        . We are happy to assist with any inquiries about the platform, rules, or your account.
      </>
    ),
  },
];

const LearnMore = () => {
  return (
    <div className="gradient-mesh min-h-screen px-4 py-16 sm:py-24">
      <div className="max-w-3xl mx-auto space-y-10">
        {/* Back link */}
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        {/* Page heading */}
        <div>
          <h1 className="text-4xl font-bold text-gradient-primary tracking-tight">
            Learn More
          </h1>
          <p className="text-muted-foreground mt-2">
            Everything you need to know about Equity Quest.
          </p>
        </div>

        {/* Content sections */}
        {sections.map((section) => (
          <div key={section.title} className="glass-card rounded-xl p-6 sm:p-8 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <section.icon className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-xl font-semibold">{section.title}</h2>
            </div>

            {section.content && (
              <p className="text-muted-foreground leading-relaxed text-sm sm:text-base">
                {section.content}
              </p>
            )}

            {section.items && (
              <ul className="space-y-2.5 text-muted-foreground text-sm sm:text-base">
                {section.items.map((item, idx) => (
                  <li key={idx} className="flex gap-2.5 leading-relaxed">
                    <span className="text-primary mt-1 shrink-0">&#8226;</span>
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default LearnMore;
