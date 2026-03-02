import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface LoginFormValues {
  email: string;
  password: string;
}

interface RegisterFormValues {
  fullName: string;
  email: string;
  password: string;
  teamName: string;
}

/* ------------------------------------------------------------------ */
/*  Password strength helper                                           */
/* ------------------------------------------------------------------ */

function getPasswordStrength(password: string) {
  const len = password.length;
  if (len === 0) return { percent: 0, color: "bg-muted", label: "" };
  if (len < 6) return { percent: 30, color: "bg-red-500", label: "Weak" };
  if (len < 10) return { percent: 65, color: "bg-yellow-500", label: "Fair" };
  return { percent: 100, color: "bg-emerald-500", label: "Strong" };
}

/* ------------------------------------------------------------------ */
/*  Auth Page                                                          */
/* ------------------------------------------------------------------ */

const Auth = () => {
  const navigate = useNavigate();
  const hasNavigated = useRef(false);
  const [loading, setLoading] = useState(false);

  /* ---- react-hook-form instances ---- */
  const loginForm = useForm<LoginFormValues>({
    defaultValues: { email: "", password: "" },
  });

  const registerForm = useForm<RegisterFormValues>({
    defaultValues: { fullName: "", email: "", password: "", teamName: "" },
  });

  const watchRegisterPassword = registerForm.watch("password");
  const strength = useMemo(
    () => getPasswordStrength(watchRegisterPassword),
    [watchRegisterPassword],
  );

  /* ---- Auth state listener (existing logic with hasNavigated ref) ---- */
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && !hasNavigated.current) {
        hasNavigated.current = true;
        navigate("/dashboard");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && !hasNavigated.current) {
        hasNavigated.current = true;
        navigate("/dashboard");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  /* ---- Sign In handler ---- */
  const handleLogin = async (data: LoginFormValues) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });
      if (error) throw error;
      toast.success("Signed in successfully!");
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error.message.includes("Invalid login credentials")) {
          toast.error("Invalid email or password. Please try again.");
        } else if (error.message.includes("Email not confirmed")) {
          toast.error(
            "Your email has not been confirmed. Please check your inbox.",
          );
        } else {
          toast.error(error.message);
        }
      } else {
        toast.error("An unexpected error occurred while signing in.");
      }
    } finally {
      setLoading(false);
    }
  };

  /* ---- Register handler ---- */
  const handleSignup = async (data: RegisterFormValues) => {
    if (data.password.length < 6) {
      toast.error("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.fullName,
            team_name: data.teamName || undefined,
          },
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (error) throw error;
      toast.success("Account created! Please check your email to verify.");
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error.message.includes("already registered")) {
          toast.error(
            "This email is already registered. Try signing in instead.",
          );
        } else if (error.message.includes("valid email")) {
          toast.error("Please enter a valid email address.");
        } else {
          toast.error(error.message);
        }
      } else {
        toast.error("An unexpected error occurred while creating your account.");
      }
    } finally {
      setLoading(false);
    }
  };

  /* ---- Render ---- */
  return (
    <div className="gradient-mesh min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-[440px] animate-fade-in">
        {/* ---- Glass Card ---- */}
        <div className="glass-card rounded-2xl p-8 sm:p-10">
          {/* ---- Logo ---- */}
          <div className="flex justify-center mb-6">
            <img
              src="/equity-quest-logo.png"
              alt="Equity Quest"
              className="h-16 w-auto drop-shadow-lg"
            />
          </div>

          {/* ---- Heading ---- */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary via-primary to-primary/70 bg-clip-text text-transparent">
              Equity Quest
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              The Apex Investors' Gauntlet
            </p>
          </div>

          {/* ---- Tabs ---- */}
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger
                value="signin"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                Sign In
              </TabsTrigger>
              <TabsTrigger
                value="register"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                Register
              </TabsTrigger>
            </TabsList>

            {/* ==================== SIGN IN TAB ==================== */}
            <TabsContent value="signin">
              <form
                onSubmit={loginForm.handleSubmit(handleLogin)}
                className="space-y-5"
              >
                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="login-email" className="text-sm font-medium">
                    Email
                  </Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="input-enhanced h-11"
                    {...loginForm.register("email", { required: true })}
                  />
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <Label
                    htmlFor="login-password"
                    className="text-sm font-medium"
                  >
                    Password
                  </Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    className="input-enhanced h-11"
                    {...loginForm.register("password", { required: true })}
                  />
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full h-11 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    "Sign In"
                  )}
                </button>
              </form>
            </TabsContent>

            {/* ==================== REGISTER TAB ==================== */}
            <TabsContent value="register">
              <form
                onSubmit={registerForm.handleSubmit(handleSignup)}
                className="space-y-4"
              >
                {/* Full Name */}
                <div className="space-y-2">
                  <Label
                    htmlFor="register-name"
                    className="text-sm font-medium"
                  >
                    Full Name
                  </Label>
                  <Input
                    id="register-name"
                    type="text"
                    placeholder="Jane Doe"
                    autoComplete="name"
                    className="input-enhanced h-11"
                    {...registerForm.register("fullName", { required: true })}
                  />
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label
                    htmlFor="register-email"
                    className="text-sm font-medium"
                  >
                    Email
                  </Label>
                  <Input
                    id="register-email"
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="input-enhanced h-11"
                    {...registerForm.register("email", { required: true })}
                  />
                </div>

                {/* Password + strength indicator */}
                <div className="space-y-2">
                  <Label
                    htmlFor="register-password"
                    className="text-sm font-medium"
                  >
                    Password
                  </Label>
                  <Input
                    id="register-password"
                    type="password"
                    placeholder="Minimum 6 characters"
                    autoComplete="new-password"
                    className="input-enhanced h-11"
                    {...registerForm.register("password", {
                      required: true,
                      minLength: 6,
                    })}
                  />
                  {/* Strength bar */}
                  {watchRegisterPassword.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${strength.color}`}
                          style={{ width: `${strength.percent}%` }}
                        />
                      </div>
                      <p
                        className={`text-xs font-medium ${
                          strength.color === "bg-red-500"
                            ? "text-red-500"
                            : strength.color === "bg-yellow-500"
                              ? "text-yellow-500"
                              : "text-emerald-500"
                        }`}
                      >
                        {strength.label}
                      </p>
                    </div>
                  )}
                </div>

                {/* Team Name (optional) */}
                <div className="space-y-2">
                  <Label
                    htmlFor="register-team"
                    className="text-sm font-medium"
                  >
                    Team Name{" "}
                    <span className="text-muted-foreground text-xs">
                      (optional)
                    </span>
                  </Label>
                  <Input
                    id="register-team"
                    type="text"
                    placeholder="Team Alpha"
                    className="input-enhanced h-11"
                    {...registerForm.register("teamName")}
                  />
                  <p className="text-xs text-muted-foreground">
                    Join a team or compete individually
                  </p>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full h-11 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    "Register"
                  )}
                </button>

                <p className="text-xs text-center text-muted-foreground mt-2">
                  By registering, you agree to participate in the mock trading
                  competition
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </div>

        {/* ---- Back to Home ---- */}
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
