import { useNavigate, useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home, BarChart3, Trophy, LayoutDashboard } from "lucide-react";

const NotFound = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  const suggestedLinks = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/market", label: "Market Analysis", icon: BarChart3 },
    { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
  ];

  return (
    <div className="gradient-mesh min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-lg w-full space-y-8 animate-fade-in">
        {/* Large 404 */}
        <h1 className="text-[8rem] sm:text-[10rem] font-extrabold leading-none text-gradient-primary select-none">
          404
        </h1>

        {/* Subtitle */}
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-foreground">Page Not Found</h2>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto">
            The page you are looking for does not exist or has been moved. Try one of the
            links below to get back on track.
          </p>
        </div>

        {/* Suggested nav links */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          {suggestedLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="glass-card rounded-xl px-5 py-3 flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <link.icon className="h-4 w-4 text-primary" />
              {link.label}
            </Link>
          ))}
        </div>

        {/* Back to Home button */}
        <Button
          size="lg"
          onClick={() => navigate("/")}
          className="mt-4"
        >
          <Home className="h-4 w-4 mr-2" />
          Back to Home
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
