import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AnimatedCounter } from "@/components/AnimatedCounter";
import {
  Users,
  UserPlus,
  Building2,
  Crown,
  AlertTriangle,
  Copy,
  Check,
  LogOut,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";
import { STARTING_CAPITAL } from "@/lib/constants";

interface Team {
  team_code: string;
  members: Array<{
    id: string;
    full_name: string;
    email: string;
    role: string;
    created_at: string;
    portfolio_value?: number;
    profit_loss?: number;
    profit_loss_percentage?: number;
  }>;
  total_value: number;
  profit_loss: number;
  profit_loss_percentage: number;
  rank: number;
}

interface CompetitionSettings {
  signup_paused: boolean;
  max_team_size: number;
}

/* ------------------------------------------------------------------ */
/*  TeamManagement Page                                                */
/* ------------------------------------------------------------------ */
const TeamManagement = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTeamCode, setNewTeamCode] = useState("");
  const [joinTeamCode, setJoinTeamCode] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);
  const [competitionSettings, setCompetitionSettings] = useState<CompetitionSettings>({
    signup_paused: false,
    max_team_size: 5,
  });
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    fetchCurrentUser();
    fetchTeams();
    fetchCompetitionSettings();
  }, []);

  /* ---------- data fetching (unchanged business logic) ---------- */

  const fetchCurrentUser = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();
        setCurrentUser(profile);
      }
    } catch (error) {
      console.error("Error fetching current user:", error);
    }
  };

  const recalculateAllPortfolios = async () => {
    try {
      const { data: portfolios, error } = await supabase
        .from("portfolios")
        .select("user_id, cash_balance");
      if (error) throw error;

      for (const portfolio of portfolios || []) {
        const { data: positions } = await supabase
          .from("positions")
          .select("*, assets(*)")
          .eq("user_id", portfolio.user_id);

        let totalLongValue = 0;
        let totalShortValue = 0;

        if (positions && positions.length > 0) {
          positions.forEach((position) => {
            const currentPrice = position.assets?.current_price || 0;
            if (position.is_short) {
              totalShortValue += position.quantity * currentPrice;
            } else {
              totalLongValue += position.quantity * currentPrice;
            }
          });
        }

        const totalPortfolioValue = portfolio.cash_balance + totalLongValue - totalShortValue;
        const initialValue = STARTING_CAPITAL;
        const profitLoss = totalPortfolioValue - initialValue;
        const profitLossPercentage = initialValue > 0 ? (profitLoss / initialValue) * 100 : 0;

        await supabase
          .from("portfolios")
          .update({
            total_value: totalPortfolioValue,
            profit_loss: profitLoss,
            profit_loss_percentage: profitLossPercentage,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", portfolio.user_id);
      }
    } catch (error) {
      console.error("Error recalculating portfolios:", error);
    }
  };

  const fetchTeams = async () => {
    try {
      setLoading(true);
      await recalculateAllPortfolios();

      const { data: users, error: usersError } = await supabase
        .from("profiles")
        .select("id, full_name, email, team_code, created_at")
        .not("team_code", "is", null)
        .order("team_code");

      if (usersError) throw usersError;

      const { data: portfolios, error: portfolioError } = await supabase
        .from("portfolios")
        .select("user_id, total_value, profit_loss, profit_loss_percentage")
        .in("user_id", users?.map((u) => u.id) || []);

      if (portfolioError) throw portfolioError;

      const teamMap = new Map<string, Team>();

      users?.forEach((user) => {
        if (user.team_code) {
          if (!teamMap.has(user.team_code)) {
            teamMap.set(user.team_code, {
              team_code: user.team_code,
              members: [],
              total_value: 0,
              profit_loss: 0,
              profit_loss_percentage: 0,
              rank: 0,
            });
          }

          const portfolio = portfolios?.find((p) => p.user_id === user.id);
          const team = teamMap.get(user.team_code)!;

          team.members.push({
            id: user.id,
            full_name: user.full_name,
            email: user.email,
            role: team.members.length === 0 ? "leader" : "member",
            created_at: user.created_at,
            portfolio_value: portfolio?.total_value ?? 0,
            profit_loss: portfolio?.profit_loss ?? 0,
            profit_loss_percentage: portfolio?.profit_loss_percentage ?? 0,
          });

          if (portfolio) {
            team.total_value += portfolio.total_value;
            team.profit_loss += portfolio.profit_loss;
            team.profit_loss_percentage += portfolio.profit_loss_percentage;
          }
        }
      });

      const teamList = Array.from(teamMap.values())
        .map((team) => ({
          ...team,
          profit_loss_percentage: team.profit_loss_percentage / Math.max(1, team.members.length),
        }))
        .sort((a, b) => b.total_value - a.total_value);

      teamList.forEach((team, index) => {
        team.rank = index + 1;
      });

      setTeams(teamList);
    } catch (error) {
      console.error("Error fetching teams:", error);
      toast.error("Failed to fetch teams");
    } finally {
      setLoading(false);
    }
  };

  const fetchCompetitionSettings = async () => {
    try {
      const { data } = await supabase.from("competition_settings").select("*");
      if (data) {
        const settings = data.reduce((acc: any, setting: any) => {
          acc[setting.setting_key] = setting.setting_value;
          return acc;
        }, {} as any);

        setCompetitionSettings({
          signup_paused: settings.signup_paused?.value || false,
          max_team_size: settings.max_team_size?.value || 5,
        });
      }
    } catch (error) {
      console.error("Error fetching competition settings:", error);
    }
  };

  /* ---------- actions ---------- */

  const generateTeamCode = () => {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < 6; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    setNewTeamCode(result);
  };

  const createTeam = async () => {
    if (!newTeamCode.trim()) {
      toast.error("Please enter a team code");
      return;
    }
    if (!currentUser) {
      toast.error("User not found");
      return;
    }
    try {
      const { data: existingTeam } = await supabase
        .from("profiles")
        .select("team_code")
        .eq("team_code", newTeamCode.toUpperCase())
        .limit(1);

      if (existingTeam && existingTeam.length > 0) {
        toast.error("Team code already exists. Please choose a different one.");
        return;
      }

      const { error } = await supabase
        .from("profiles")
        .update({ team_code: newTeamCode.toUpperCase() })
        .eq("id", currentUser.id);

      if (error) throw error;
      toast.success(`Team "${newTeamCode.toUpperCase()}" created successfully!`);
      setNewTeamCode("");
      fetchCurrentUser();
      fetchTeams();
    } catch (error) {
      console.error("Error creating team:", error);
      toast.error("Failed to create team");
    }
  };

  const joinTeam = async () => {
    if (!joinTeamCode.trim()) {
      toast.error("Please enter a team code");
      return;
    }
    if (!currentUser) {
      toast.error("User not found");
      return;
    }
    if (currentUser.team_code) {
      toast.error("You are already part of a team");
      return;
    }
    try {
      const { data: teamMembers } = await supabase
        .from("profiles")
        .select("id")
        .eq("team_code", joinTeamCode.toUpperCase());

      if (!teamMembers || teamMembers.length === 0) {
        toast.error("Team code not found");
        return;
      }
      if (teamMembers.length >= competitionSettings.max_team_size) {
        toast.error(`Team is full. Maximum team size is ${competitionSettings.max_team_size}`);
        return;
      }

      const { error } = await supabase
        .from("profiles")
        .update({ team_code: joinTeamCode.toUpperCase() })
        .eq("id", currentUser.id);

      if (error) throw error;
      toast.success(`Successfully joined team "${joinTeamCode.toUpperCase()}"!`);
      setJoinTeamCode("");
      fetchCurrentUser();
      fetchTeams();
    } catch (error) {
      console.error("Error joining team:", error);
      toast.error("Failed to join team");
    }
  };

  const leaveTeam = async () => {
    if (!currentUser?.team_code) {
      toast.error("You are not part of any team");
      return;
    }
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ team_code: null })
        .eq("id", currentUser.id);

      if (error) throw error;
      toast.success("Successfully left the team");
      fetchCurrentUser();
      fetchTeams();
    } catch (error) {
      console.error("Error leaving team:", error);
      toast.error("Failed to leave team");
    }
  };

  const copyTeamCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    toast.success("Team code copied!");
    setTimeout(() => setCopiedCode(false), 2000);
  };

  /* ---------- derived ---------- */
  const myTeam = teams.find((t) => t.team_code === currentUser?.team_code);

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="h-10 w-64 bg-muted/40 rounded animate-pulse" />
          <div className="grid gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-card rounded-xl p-6 animate-pulse">
                <div className="h-4 w-24 bg-muted/50 rounded mb-3" />
                <div className="h-8 w-32 bg-muted/40 rounded" />
              </div>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* ---- Header ---- */}
        <div>
          <h1 className="text-3xl font-bold text-gradient-primary tracking-tight">
            Team Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Create or join teams to collaborate on portfolio management.
          </p>
        </div>

        {/* ---- Competition paused banner ---- */}
        {competitionSettings.signup_paused && (
          <div className="glass-card rounded-xl p-4 border-orange-500/30 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0" />
            <div>
              <p className="font-medium text-orange-500">Signups are currently paused</p>
              <p className="text-sm text-muted-foreground">
                New team creation and joining is temporarily disabled by administrators.
              </p>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/*  NO TEAM -- Show Create / Join options                           */}
        {/* ================================================================ */}
        {!currentUser?.team_code ? (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Create Team */}
            <div className="glass-card rounded-xl p-6 space-y-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-primary/10">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Create a Team</h2>
                  <p className="text-sm text-muted-foreground">
                    Start a new team and invite others.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Team Code
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={newTeamCode}
                    onChange={(e) => setNewTeamCode(e.target.value.toUpperCase())}
                    placeholder="e.g. ALPHA1"
                    maxLength={6}
                    className="uppercase tracking-widest font-mono"
                  />
                  <Button variant="outline" size="sm" onClick={generateTeamCode}>
                    Generate
                  </Button>
                </div>
              </div>

              <Button
                onClick={createTeam}
                disabled={competitionSettings.signup_paused || !newTeamCode.trim()}
                className="w-full"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Create Team
              </Button>
            </div>

            {/* Join Team */}
            <div className="glass-card rounded-xl p-6 space-y-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Join a Team</h2>
                  <p className="text-sm text-muted-foreground">
                    Enter an existing team code to join.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Team Code
                </Label>
                <Input
                  value={joinTeamCode}
                  onChange={(e) => setJoinTeamCode(e.target.value.toUpperCase())}
                  placeholder="Enter code"
                  maxLength={6}
                  className="uppercase tracking-widest font-mono"
                />
              </div>

              <Button
                onClick={joinTeam}
                disabled={competitionSettings.signup_paused || !joinTeamCode.trim()}
                className="w-full"
              >
                <Users className="h-4 w-4 mr-2" />
                Join Team
              </Button>
            </div>
          </div>
        ) : (
          /* ============================================================== */
          /*  IN TEAM -- Team Dashboard                                      */
          /* ============================================================== */
          <>
            {/* ---- Team Info Card ---- */}
            <div className="glass-card rounded-xl p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-primary/10">
                    <Crown className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                      Your Team
                    </p>
                    <h2 className="text-2xl font-bold tracking-wide">
                      {currentUser.team_code}
                    </h2>
                  </div>
                  <button
                    onClick={() => copyTeamCode(currentUser.team_code)}
                    className="ml-2 p-1.5 rounded-md hover:bg-muted/60 transition-colors"
                    title="Copy team code"
                  >
                    {copiedCode ? (
                      <Check className="h-4 w-4 text-[hsl(var(--profit))]" />
                    ) : (
                      <Copy className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="text-sm px-3 py-1">
                    {myTeam?.members.length ?? 0} member
                    {(myTeam?.members.length ?? 0) !== 1 ? "s" : ""}
                  </Badge>
                  <Button variant="outline" size="sm" onClick={leaveTeam}>
                    <LogOut className="h-4 w-4 mr-1.5" />
                    Leave
                  </Button>
                </div>
              </div>
            </div>

            {/* ---- Team Performance Stats ---- */}
            {myTeam && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="stat-card rounded-xl p-5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                    Total Value
                  </p>
                  <AnimatedCounter
                    value={myTeam.total_value}
                    prefix="₹"
                    decimals={2}
                    className="text-2xl font-bold"
                  />
                </div>
                <div className="stat-card rounded-xl p-5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                    P&L
                  </p>
                  <AnimatedCounter
                    value={myTeam.profit_loss}
                    prefix={myTeam.profit_loss >= 0 ? "+₹" : "-₹"}
                    decimals={2}
                    className={`text-2xl font-bold ${
                      myTeam.profit_loss >= 0
                        ? "text-[hsl(var(--profit))]"
                        : "text-[hsl(var(--loss))]"
                    }`}
                  />
                </div>
                <div className="stat-card rounded-xl p-5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                    Avg P&L %
                  </p>
                  <AnimatedCounter
                    value={myTeam.profit_loss_percentage}
                    suffix="%"
                    prefix={myTeam.profit_loss_percentage >= 0 ? "+" : ""}
                    decimals={2}
                    className={`text-2xl font-bold ${
                      myTeam.profit_loss_percentage >= 0
                        ? "text-[hsl(var(--profit))]"
                        : "text-[hsl(var(--loss))]"
                    }`}
                  />
                </div>
              </div>
            )}

            {/* ---- Members Table ---- */}
            {myTeam && myTeam.members.length > 0 && (
              <div className="glass-card rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-border/30">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Members
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="table-premium w-full">
                    <thead>
                      <tr>
                        <th className="text-left">Name</th>
                        <th className="text-right">Portfolio Value</th>
                        <th className="text-right">P&L %</th>
                        <th className="text-right">Contribution</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myTeam.members.map((member) => {
                        const contribution =
                          myTeam.total_value > 0
                            ? ((member.portfolio_value ?? 0) / myTeam.total_value) * 100
                            : 0;
                        const plPct = member.profit_loss_percentage ?? 0;

                        return (
                          <tr key={member.id}>
                            <td>
                              <div className="flex items-center gap-2">
                                {member.role === "leader" && (
                                  <Crown className="h-3.5 w-3.5 text-yellow-500" />
                                )}
                                <span className="font-medium">{member.full_name}</span>
                                {member.role === "leader" && (
                                  <Badge variant="outline" className="text-[10px] py-0">
                                    Leader
                                  </Badge>
                                )}
                              </div>
                            </td>
                            <td className="text-right tabular-nums">
                              ₹{(member.portfolio_value ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </td>
                            <td
                              className={`text-right tabular-nums font-medium ${
                                plPct >= 0
                                  ? "text-[hsl(var(--profit))]"
                                  : "text-[hsl(var(--loss))]"
                              }`}
                            >
                              {plPct >= 0 ? "+" : ""}
                              {plPct.toFixed(2)}%
                            </td>
                            <td className="text-right tabular-nums">
                              {contribution.toFixed(1)}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ---- Team Leaderboard ---- */}
            <div className="glass-card rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-border/30 flex items-center gap-2">
                <Trophy className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Team Leaderboard
                </h3>
              </div>

              {teams.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p>No teams found</p>
                </div>
              ) : (
                <div className="divide-y divide-border/20">
                  {teams.map((team, index) => {
                    const isMyTeam = currentUser?.team_code === team.team_code;
                    return (
                      <div
                        key={team.team_code}
                        className={`flex items-center justify-between px-6 py-4 transition-colors ${
                          isMyTeam ? "bg-primary/5" : "hover:bg-muted/20"
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <span
                            className={`w-8 h-8 flex items-center justify-center rounded-full text-xs font-bold ${
                              index === 0
                                ? "bg-yellow-500/20 text-yellow-500"
                                : index === 1
                                ? "bg-gray-400/20 text-gray-400"
                                : index === 2
                                ? "bg-orange-500/20 text-orange-500"
                                : "bg-muted/50 text-muted-foreground"
                            }`}
                          >
                            {index + 1}
                          </span>
                          <div>
                            <p className="font-semibold">
                              {team.team_code}
                              {isMyTeam && (
                                <span className="ml-2 text-xs text-primary font-normal">
                                  (You)
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {team.members.length} member
                              {team.members.length !== 1 ? "s" : ""}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="font-semibold tabular-nums">
                            ₹{team.total_value.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </p>
                          <p
                            className={`text-sm font-medium tabular-nums ${
                              team.profit_loss_percentage >= 0
                                ? "text-[hsl(var(--profit))]"
                                : "text-[hsl(var(--loss))]"
                            }`}
                          >
                            {team.profit_loss_percentage >= 0 ? "+" : ""}
                            {team.profit_loss_percentage.toFixed(2)}%
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default TeamManagement;
