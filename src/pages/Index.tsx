import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  TrendingUp,
  ArrowDownRight,
  Zap,
  Users,
  Shield,
  Trophy,
  Play,
  ChevronDown,
  BarChart3,
  Target,
  Flame,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface TickerAsset {
  symbol: string;
  current_price: number;
  previous_close: number;
}

/* ------------------------------------------------------------------ */
/*  Live Ticker — fetches real prices from Supabase                    */
/* ------------------------------------------------------------------ */
const LiveTicker = () => {
  const [assets, setAssets] = useState<TickerAsset[]>([]);

  useEffect(() => {
    const fetchAssets = async () => {
      const { data, error } = await supabase
        .from("assets")
        .select("symbol, current_price, previous_close")
        .order("symbol", { ascending: true });

      if (!error && data && data.length > 0) {
        setAssets(data as TickerAsset[]);
      } else {
        // Fallback static data when DB is empty or unavailable
        setAssets([
          { symbol: "NIFTY 50", current_price: 23845.75, previous_close: 23640.0 },
          { symbol: "RELIANCE", current_price: 2745.6, previous_close: 2757.2 },
          { symbol: "TCS", current_price: 3815.2, previous_close: 3772.5 },
          { symbol: "HDFCBANK", current_price: 1715.3, previous_close: 1711.4 },
          { symbol: "INFY", current_price: 1625.8, previous_close: 1628.2 },
          { symbol: "ICICIBANK", current_price: 1150.9, previous_close: 1133.2 },
          { symbol: "SBIN", current_price: 725.4, previous_close: 719.8 },
          { symbol: "HINDUNILVR", current_price: 2550.0, previous_close: 2551.3 },
          { symbol: "BHARTIARTL", current_price: 1050.25, previous_close: 1028.5 },
          { symbol: "ITC", current_price: 435.8, previous_close: 437.1 },
          { symbol: "KOTAKBANK", current_price: 1782.45, previous_close: 1770.0 },
          { symbol: "LT", current_price: 3420.1, previous_close: 3445.6 },
        ]);
      }
    };
    fetchAssets();
  }, []);

  if (assets.length === 0) return null;

  // Double the items so the scroll loops seamlessly
  const doubled = [...assets, ...assets];

  return (
    <div className="w-full border-y border-white/[0.06] bg-black/40 backdrop-blur-md">
      <div className="ticker-strip py-3">
        <div className="ticker-scroll">
          {doubled.map((a, i) => {
            const change = a.previous_close
              ? ((a.current_price - a.previous_close) / a.previous_close) * 100
              : 0;
            const isUp = change >= 0;
            return (
              <span key={i} className="inline-flex items-center gap-2 mx-6 text-sm">
                <span className="font-semibold text-white/90 tracking-wide">{a.symbol}</span>
                <span className="text-muted-foreground">
                  {a.current_price.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
                <span className={isUp ? "text-profit font-medium" : "text-loss font-medium"}>
                  {isUp ? "+" : ""}
                  {change.toFixed(2)}%
                </span>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Hero Chart — lightweight SVG candlestick / line visualization      */
/* ------------------------------------------------------------------ */
const HeroChart = () => (
  <div className="relative w-full h-full min-h-[340px] flex items-center justify-center">
    {/* Glow backdrop */}
    <div className="absolute inset-0 bg-primary/[0.04] rounded-3xl blur-3xl" />

    <svg
      viewBox="0 0 480 280"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-auto max-w-[480px] drop-shadow-2xl"
    >
      {/* Grid lines */}
      {[60, 110, 160, 210].map((y) => (
        <line
          key={y}
          x1="30"
          y1={y}
          x2="460"
          y2={y}
          stroke="hsl(225 18% 20%)"
          strokeWidth="0.5"
          strokeDasharray="4 4"
        />
      ))}

      {/* Area fill under the line */}
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(217 100% 62%)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="hsl(217 100% 62%)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="lineGrad" x1="30" y1="0" x2="460" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="hsl(240 80% 65%)" />
          <stop offset="50%" stopColor="hsl(217 100% 62%)" />
          <stop offset="100%" stopColor="hsl(160 84% 44%)" />
        </linearGradient>
      </defs>

      <path
        d="M30 200 Q60 190 90 185 T150 160 T210 170 T250 120 T300 130 T340 90 T380 100 T420 60 L460 50 L460 260 L30 260 Z"
        fill="url(#areaGrad)"
      />

      {/* Main price line */}
      <path
        d="M30 200 Q60 190 90 185 T150 160 T210 170 T250 120 T300 130 T340 90 T380 100 T420 60 L460 50"
        stroke="url(#lineGrad)"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />

      {/* Candlesticks */}
      {[
        { x: 70, o: 188, c: 180, h: 175, l: 195, up: true },
        { x: 110, o: 172, c: 165, h: 160, l: 178, up: true },
        { x: 150, o: 160, c: 168, h: 155, l: 172, up: false },
        { x: 190, o: 165, c: 155, h: 148, l: 170, up: true },
        { x: 230, o: 145, c: 130, h: 125, l: 150, up: true },
        { x: 270, o: 135, c: 140, h: 128, l: 145, up: false },
        { x: 310, o: 125, c: 105, h: 98, l: 130, up: true },
        { x: 350, o: 100, c: 108, h: 92, l: 112, up: false },
        { x: 390, o: 95, c: 75, h: 68, l: 100, up: true },
        { x: 430, o: 70, c: 55, h: 48, l: 78, up: true },
      ].map((c, i) => (
        <g key={i} opacity={0.6}>
          {/* Wick */}
          <line
            x1={c.x}
            y1={c.h}
            x2={c.x}
            y2={c.l}
            stroke={c.up ? "hsl(160 84% 44%)" : "hsl(4 90% 58%)"}
            strokeWidth="1"
          />
          {/* Body */}
          <rect
            x={c.x - 4}
            y={Math.min(c.o, c.c)}
            width="8"
            height={Math.max(Math.abs(c.o - c.c), 2)}
            rx="1"
            fill={c.up ? "hsl(160 84% 44%)" : "hsl(4 90% 58%)"}
          />
        </g>
      ))}

      {/* Current price indicator */}
      <circle cx="460" cy="50" r="4" fill="hsl(160 84% 44%)" className="animate-pulse-live" />
      <line
        x1="30"
        y1="50"
        x2="460"
        y2="50"
        stroke="hsl(160 84% 44%)"
        strokeWidth="0.5"
        strokeDasharray="3 3"
        opacity="0.5"
      />

      {/* Price label */}
      <rect x="390" y="30" width="68" height="18" rx="4" fill="hsl(160 84% 44% / 0.15)" />
      <text x="424" y="43" textAnchor="middle" fill="hsl(160 84% 44%)" fontSize="10" fontWeight="600">
        +12.4%
      </text>
    </svg>
  </div>
);

/* ------------------------------------------------------------------ */
/*  Feature Card                                                       */
/* ------------------------------------------------------------------ */
interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
  delay: number;
}

const FeatureCard = ({ icon, title, description, color, delay }: FeatureCardProps) => (
  <div
    className="glass-card p-5 group animate-slide-up"
    style={{ animationDelay: `${delay}ms`, animationFillMode: "both" }}
  >
    <div
      className="flex items-center justify-center w-10 h-10 rounded-lg mb-3 transition-transform duration-300 group-hover:scale-110"
      style={{ background: `${color}20` }}
    >
      <div style={{ color }}>{icon}</div>
    </div>
    <h3 className="text-base font-bold text-foreground mb-1.5">{title}</h3>
    <p className="text-[13px] text-muted-foreground leading-relaxed">{description}</p>
  </div>
);

/* ------------------------------------------------------------------ */
/*  Step Card (How It Works)                                           */
/* ------------------------------------------------------------------ */
interface StepCardProps {
  step: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  delay: number;
}

const StepCard = ({ step, title, description, icon, delay }: StepCardProps) => (
  <div
    className="relative flex flex-col items-center text-center animate-slide-up"
    style={{ animationDelay: `${delay}ms`, animationFillMode: "both" }}
  >
    <div className="relative mb-4">
      <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-black text-primary-foreground btn-primary shadow-md">
        {step}
      </div>
    </div>
    <div className="glass-card p-5 w-full">
      <div className="flex justify-center mb-3 text-primary">{icon}</div>
      <h3 className="text-lg font-bold text-foreground mb-1.5">{title}</h3>
      <p className="text-[13px] text-muted-foreground leading-relaxed">{description}</p>
    </div>
  </div>
);

/* ------------------------------------------------------------------ */
/*  Main Index Page                                                    */
/* ------------------------------------------------------------------ */
const Index = () => {
  const navigate = useNavigate();

  // Redirect logged-in users to dashboard
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/dashboard");
    });
  }, [navigate]);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="gradient-mesh min-h-screen text-foreground antialiased">
      {/* ============================================================ */}
      {/*  FIXED NAVIGATION                                            */}
      {/* ============================================================ */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/70 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            <img
              src="/equity-quest-logo.png"
              alt="Equity Quest"
              className="h-8 w-auto"
            />
            <span className="text-lg font-bold tracking-tight text-foreground">Equity Quest</span>
          </div>

          {/* Nav Links — hidden on mobile */}
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <button onClick={() => scrollTo("features")} className="hover:text-foreground transition-colors">
              Features
            </button>
            <button onClick={() => scrollTo("how-it-works")} className="hover:text-foreground transition-colors">
              How it Works
            </button>
            <button onClick={() => navigate("/leaderboard")} className="hover:text-foreground transition-colors">
              Leaderboard
            </button>
          </div>

          {/* CTA */}
          <Button
            onClick={() => navigate("/auth")}
            className="btn-primary group text-sm px-5 py-2"
          >
            Enter Arena
            <ArrowRight className="ml-1.5 h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
          </Button>
        </div>
      </nav>

      {/* ============================================================ */}
      {/*  HERO SECTION                                                 */}
      {/* ============================================================ */}
      <section className="relative pt-24 pb-6 lg:pt-28 lg:pb-8 overflow-hidden">
        {/* Background decorative blobs */}
        <div className="absolute top-20 left-1/4 w-[500px] h-[500px] bg-primary/[0.06] rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-profit/[0.04] rounded-full blur-[100px] pointer-events-none" />

        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left — Copy */}
            <div className="max-w-2xl animate-fade-in" style={{ animationFillMode: "both" }}>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/20 bg-primary/[0.06] text-primary text-xs font-semibold tracking-wide mb-6 animate-fade-in" style={{ animationDelay: "100ms", animationFillMode: "both" }}>
                <Flame className="h-3.5 w-3.5" />
                INDIA'S #1 MOCK TRADING ARENA
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-black tracking-tight leading-[1.1] mb-5 animate-slide-up" style={{ animationDelay: "200ms", animationFillMode: "both" }}>
                <span className="text-gradient-primary">Master the Market.</span>
                <br />
                <span className="text-foreground">Crush the Competition.</span>
              </h1>

              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-xl mb-7 animate-slide-up" style={{ animationDelay: "350ms", animationFillMode: "both" }}>
                India's most intense mock stock trading arena. Trade NIFTY 50 stocks,
                commodities, and indices in real-time. Build your portfolio, survive black
                swan events, and dominate the leaderboard.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 animate-slide-up" style={{ animationDelay: "500ms", animationFillMode: "both" }}>
                <Button
                  size="lg"
                  onClick={() => navigate("/auth")}
                  className="btn-primary group text-base px-8 py-6 shadow-lg shadow-primary/20"
                >
                  Start Trading
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => scrollTo("how-it-works")}
                  className="text-base px-8 py-6 border-white/10 hover:bg-white/5 text-foreground"
                >
                  <Play className="mr-2 h-4 w-4" />
                  Watch Demo
                </Button>
              </div>
            </div>

            {/* Right — Chart Visualization */}
            <div className="hidden lg:block animate-fade-in" style={{ animationDelay: "600ms", animationFillMode: "both" }}>
              <HeroChart />
            </div>
          </div>
        </div>

        {/* Scroll hint */}
        <div className="flex justify-center mt-8 lg:mt-10 animate-fade-in" style={{ animationDelay: "900ms", animationFillMode: "both" }}>
          <button
            onClick={() => scrollTo("ticker")}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown className="h-6 w-6 animate-bounce" />
          </button>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  LIVE TICKER                                                  */}
      {/* ============================================================ */}
      <div id="ticker">
        <LiveTicker />
      </div>

      {/* ============================================================ */}
      {/*  STATS SECTION                                                */}
      {/* ============================================================ */}
      <section className="py-12 lg:py-16">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
            {[
              { value: "50+", label: "Tradable Stocks", icon: <BarChart3 className="h-4 w-4" /> },
              { value: "\u20B95,00,000", label: "Starting Capital", icon: <Target className="h-4 w-4" /> },
              { value: "3 Rounds", label: "of Intense Trading", icon: <Flame className="h-4 w-4" /> },
              { value: "Real-time", label: "Live Market Prices", icon: <TrendingUp className="h-4 w-4" /> },
            ].map((stat, i) => (
              <div
                key={stat.label}
                className="stat-card p-4 lg:p-5 text-center animate-slide-up"
                style={{ animationDelay: `${i * 80 + 80}ms`, animationFillMode: "both" }}
              >
                <div className="flex justify-center mb-2 text-primary">{stat.icon}</div>
                <p className="text-xl lg:text-2xl font-black text-gradient-primary mb-0.5">{stat.value}</p>
                <p className="text-[11px] lg:text-xs text-muted-foreground font-medium">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  FEATURES SECTION                                             */}
      {/* ============================================================ */}
      <section id="features" className="py-14 lg:py-20">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-10 animate-fade-in" style={{ animationFillMode: "both" }}>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight mb-3">
              Built for <span className="text-gradient-primary">Serious Traders</span>
            </h2>
            <p className="text-muted-foreground text-sm lg:text-base leading-relaxed">
              Every tool you need to outperform. From real-time execution to risk management,
              this is your institutional-grade arsenal.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
            <FeatureCard
              icon={<TrendingUp className="h-6 w-6" />}
              title="Real-time Trading"
              description="Execute market, limit, and stop-loss orders instantly. Watch prices update live as the competition heats up."
              color="hsl(217, 100%, 62%)"
              delay={100}
            />
            <FeatureCard
              icon={<ArrowDownRight className="h-6 w-6" />}
              title="Short Selling"
              description="Profit from falling markets. Borrow shares, sell high, buy back low. Master the art of the short."
              color="hsl(4, 90%, 58%)"
              delay={200}
            />
            <FeatureCard
              icon={<Zap className="h-6 w-6" />}
              title="Black Swan Events"
              description="Survive sudden market shocks triggered by organizers. Flash crashes, surprise earnings, geopolitical chaos."
              color="hsl(45, 93%, 52%)"
              delay={300}
            />
            <FeatureCard
              icon={<Users className="h-6 w-6" />}
              title="Team Competition"
              description="Form teams with fellow traders. Strategize together, diversify portfolios, and climb as a unit."
              color="hsl(280, 80%, 60%)"
              delay={400}
            />
            <FeatureCard
              icon={<Shield className="h-6 w-6" />}
              title="Risk Management"
              description="Set stop-losses, manage margin exposure, and protect your capital. Survive first, profit second."
              color="hsl(160, 84%, 44%)"
              delay={500}
            />
            <FeatureCard
              icon={<Trophy className="h-6 w-6" />}
              title="Live Leaderboard"
              description="Track your rank in real-time. Performance scored by risk-adjusted returns using the Sortino Ratio."
              color="hsl(35, 100%, 55%)"
              delay={600}
            />
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  HOW IT WORKS                                                 */}
      {/* ============================================================ */}
      <section id="how-it-works" className="py-14 lg:py-20 relative">
        {/* Background accent */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.02] to-transparent pointer-events-none" />

        <div className="container mx-auto px-6 relative z-10">
          <div className="text-center max-w-2xl mx-auto mb-10 animate-fade-in" style={{ animationFillMode: "both" }}>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight mb-3">
              Three Steps to <span className="text-gradient-primary">Glory</span>
            </h2>
            <p className="text-muted-foreground text-sm lg:text-base leading-relaxed">
              From sign-up to the podium in three intense phases. Are you ready?
            </p>
          </div>

          <div className="relative grid md:grid-cols-3 gap-5 lg:gap-8">
            {/* Connecting line (desktop only) */}
            <div className="hidden md:block absolute top-8 left-[calc(16.67%+32px)] right-[calc(16.67%+32px)] h-[2px]">
              <div className="w-full h-full bg-gradient-to-r from-primary/40 via-primary/20 to-primary/40" />
            </div>

            <StepCard
              step={1}
              title="Register"
              description="Create your account, join a team, and receive your starting capital of Rs. 5,00,000 in virtual funds."
              icon={<Users className="h-7 w-7" />}
              delay={200}
            />
            <StepCard
              step={2}
              title="Trade"
              description="Analyze markets, execute trades across stocks, commodities, and indices. Survive 3 rounds of escalating intensity."
              icon={<TrendingUp className="h-7 w-7" />}
              delay={400}
            />
            <StepCard
              step={3}
              title="Win"
              description="Climb the leaderboard with superior risk-adjusted returns. The top trader takes the crown and eternal bragging rights."
              icon={<Trophy className="h-7 w-7" />}
              delay={600}
            />
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  FINAL CTA                                                    */}
      {/* ============================================================ */}
      <section className="py-16 lg:py-20">
        <div className="container mx-auto px-6">
          <div className="glass-card p-8 lg:p-14 text-center relative overflow-hidden animate-fade-in" style={{ animationFillMode: "both" }}>
            {/* Decorative glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[200px] bg-primary/[0.06] rounded-full blur-[80px] pointer-events-none" />

            <div className="relative z-10">
              <h2 className="text-2xl sm:text-3xl lg:text-5xl font-black tracking-tight mb-4">
                <span className="text-gradient-primary">Prove Your Alpha.</span>
              </h2>
              <p className="text-muted-foreground text-sm lg:text-base max-w-2xl mx-auto mb-7 leading-relaxed">
                The market listens only to those who dominate it. Step forward, trade with
                precision, and carve your legend on the leaderboard.
              </p>
              <Button
                size="lg"
                onClick={() => navigate("/auth")}
                className="btn-primary group text-base px-8 py-5 shadow-lg shadow-primary/25"
              >
                Enter the Arena
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  FOOTER                                                       */}
      {/* ============================================================ */}
      <footer className="border-t border-white/[0.06]">
        <div className="container mx-auto px-6 py-8 flex flex-col md:flex-row justify-between items-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Equity Quest. All Rights Reserved.</p>
          <div className="flex gap-6 mt-4 md:mt-0">
            <a href="/terms" className="hover:text-foreground transition-colors">Terms</a>
            <a href="/privacy" className="hover:text-foreground transition-colors">Privacy</a>
            <a href="/learn-more" className="hover:text-foreground transition-colors">Learn More</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
