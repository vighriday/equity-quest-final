import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  LogOut,
  LayoutDashboard,
  Users,
  MessageSquare,
  Trophy,
  History,
  BarChart3,
  Shield,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}

const allNavItems: NavItem[] = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/market", label: "Market Analysis", icon: BarChart3 },
  { path: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { path: "/transactions", label: "Transaction History", icon: History },
  { path: "/messages", label: "Messages", icon: MessageSquare },
  { path: "/teams", label: "Team", icon: Users },
  { path: "/admin", label: "Admin", icon: Shield, adminOnly: true },
];

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/market": "Market Analysis",
  "/leaderboard": "Leaderboard",
  "/transactions": "Transaction History",
  "/messages": "Messages",
  "/teams": "Team",
  "/admin": "Admin Panel",
};

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [isAdmin, setIsAdmin] = useState(false);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        setUserEmail(session.user.email || "");

        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", session.user.id)
          .single();

        setUserName(profile?.full_name || "User");

        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id);

        const userRoles = roles?.map((r) => r.role) || [];
        setIsAdmin(
          userRoles.includes("admin") || userRoles.includes("owner")
        );
      }
    };

    fetchUserData();
  }, []);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Failed to logout");
    } else {
      toast.success("Logged out successfully");
      navigate("/auth");
    }
  };

  const navItems = allNavItems.filter(
    (item) => !item.adminOnly || isAdmin
  );

  const currentPageTitle =
    pageTitles[location.pathname] || "Equity Quest";

  const userInitial = userName.charAt(0).toUpperCase() || "U";

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // ─── Desktop Sidebar ──────────────────────────────────────────────
  const DesktopSidebar = () => (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 hidden lg:flex flex-col",
        "bg-sidebar border-r border-sidebar-border",
        "transition-all duration-300 ease-in-out",
        collapsed ? "w-[72px]" : "w-[256px]"
      )}
    >
      {/* Logo Area */}
      <div
        className={cn(
          "flex items-center h-16 px-4 border-b border-sidebar-border",
          collapsed ? "justify-center" : "gap-3"
        )}
      >
        <Link to="/dashboard" className="flex items-center gap-3 min-w-0">
          <img
            src="/equity-quest-logo.png"
            alt="Equity Quest"
            className="h-9 w-9 object-contain flex-shrink-0"
          />
          {!collapsed && (
            <div className="overflow-hidden">
              <h1 className="text-base font-bold text-sidebar-foreground truncate leading-tight">
                Equity Quest
              </h1>
              <p className="text-[11px] text-sidebar-foreground/60 truncate leading-tight">
                Trading Platform
              </p>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        <TooltipProvider delayDuration={0}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              location.pathname === item.path ||
              (item.path !== "/dashboard" &&
                location.pathname.startsWith(item.path));

            const linkContent = (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "group relative flex items-center rounded-lg transition-all duration-200",
                  collapsed
                    ? "justify-center h-11 w-11 mx-auto"
                    : "gap-3 px-3 h-11",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md shadow-sidebar-primary/20"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                {/* Active left accent bar */}
                {isActive && !collapsed && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-sidebar-primary-foreground rounded-r-full" />
                )}
                <Icon
                  className={cn(
                    "flex-shrink-0 transition-colors",
                    collapsed ? "h-5 w-5" : "h-[18px] w-[18px]"
                  )}
                />
                {!collapsed && (
                  <span className="text-sm font-medium truncate">
                    {item.label}
                  </span>
                )}
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.path}>
                  <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return linkContent;
          })}
        </TooltipProvider>
      </nav>

      {/* Collapse Toggle */}
      <div className="px-3 py-2 border-t border-sidebar-border">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "flex items-center justify-center w-full h-9 rounded-lg",
            "text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent",
            "transition-colors duration-200"
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* User Profile Footer */}
      <div
        className={cn(
          "border-t border-sidebar-border p-3",
          collapsed ? "flex flex-col items-center gap-2" : ""
        )}
      >
        <div
          className={cn(
            "flex items-center",
            collapsed ? "flex-col gap-2" : "gap-3"
          )}
        >
          {/* Avatar */}
          <div className="flex-shrink-0 h-9 w-9 rounded-full bg-sidebar-primary flex items-center justify-center">
            <span className="text-sm font-semibold text-sidebar-primary-foreground">
              {userInitial}
            </span>
          </div>

          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {userName}
              </p>
              <p className="text-xs text-sidebar-foreground/50 truncate">
                {userEmail}
              </p>
            </div>
          )}

          {!collapsed && (
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleLogout}
                    className="flex-shrink-0 p-1.5 rounded-md text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                    aria-label="Logout"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">Logout</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {collapsed && (
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleLogout}
                  className="p-1.5 rounded-md text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                  aria-label="Logout"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Logout</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </aside>
  );

  // ─── Mobile Header ────────────────────────────────────────────────
  const MobileHeader = () => (
    <header className="fixed top-0 left-0 right-0 z-50 lg:hidden">
      <div className="flex items-center justify-between h-14 px-4 bg-background/80 backdrop-blur-xl border-b border-border">
        <Link to="/dashboard" className="flex items-center gap-2">
          <img
            src="/equity-quest-logo.png"
            alt="Equity Quest"
            className="h-8 w-8 object-contain"
          />
          <span className="text-base font-bold text-foreground">
            Equity Quest
          </span>
        </Link>

        <div className="flex items-center gap-2">
          {/* Competition live indicator */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-xs font-medium text-emerald-500">Live</span>
          </div>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-foreground/70 hover:bg-accent transition-colors"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Menu */}
      {mobileMenuOpen && (
        <div className="bg-background/95 backdrop-blur-xl border-b border-border shadow-lg">
          <div className="p-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground/70 hover:bg-accent"
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" />
                  <span className="text-sm font-medium">{item.label}</span>
                </Link>
              );
            })}
            <div className="pt-3 mt-3 border-t border-border">
              <div className="flex items-center gap-3 px-3 py-2">
                <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                  <span className="text-xs font-semibold text-primary-foreground">
                    {userInitial}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {userName}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {userEmail}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleLogout}
                  className="text-foreground/50 hover:text-foreground"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );

  // ─── Mobile Bottom Tab Bar ────────────────────────────────────────
  const MobileBottomBar = () => {
    // Show only the first 5 items in the bottom bar to avoid overcrowding
    const bottomItems = navItems.slice(0, 5);

    return (
      <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-background/90 backdrop-blur-xl border-t border-border">
        <div className="flex items-center justify-around h-16 px-1">
          {bottomItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5 transition-transform",
                    isActive && "scale-110"
                  )}
                />
                <span
                  className={cn(
                    "text-[10px] font-medium leading-none",
                    isActive && "font-semibold"
                  )}
                >
                  {item.label.split(" ")[0]}
                </span>
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-b-full" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    );
  };

  // ─── Desktop Header Bar ───────────────────────────────────────────
  const DesktopHeader = () => (
    <header
      className={cn(
        "sticky top-0 z-30 hidden lg:flex items-center justify-between",
        "h-16 px-6 bg-background/80 backdrop-blur-xl border-b border-border",
        "transition-all duration-300 ease-in-out",
        collapsed ? "ml-[72px]" : "ml-[256px]"
      )}
    >
      {/* Page Title */}
      <div>
        <h1 className="text-lg font-semibold text-foreground">
          {currentPageTitle}
        </h1>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-4">
        {/* Competition Status */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-xs font-medium text-emerald-500">
            Competition Live
          </span>
        </div>

        {/* User Avatar */}
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
            <span className="text-sm font-semibold text-primary-foreground">
              {userInitial}
            </span>
          </div>
          <div className="hidden xl:block text-right">
            <p className="text-sm font-medium text-foreground leading-tight">
              {userName}
            </p>
            <p className="text-xs text-muted-foreground leading-tight">
              {isAdmin ? "Admin" : "Participant"}
            </p>
          </div>
        </div>

        {/* Logout */}
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="text-muted-foreground hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Logout</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </header>
  );

  // ─── Main Layout ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      {/* Desktop */}
      <DesktopSidebar />
      <DesktopHeader />

      {/* Mobile */}
      <MobileHeader />
      <MobileBottomBar />

      {/* Main Content */}
      <main
        className={cn(
          "transition-all duration-300 ease-in-out",
          // Desktop: offset by sidebar width
          "lg:ml-[256px]",
          collapsed && "lg:ml-[72px]",
          // Mobile: padding for top header and bottom bar
          "pt-14 pb-16 lg:pt-0 lg:pb-0",
          "p-4 lg:p-6"
        )}
      >
        {children}
      </main>
    </div>
  );
};

export default DashboardLayout;
