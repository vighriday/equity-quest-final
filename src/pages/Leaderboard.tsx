import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Crown,
  Medal,
  Award,
  Trophy,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Users,
} from "lucide-react";
import {
  portfolioScoringEngine,
  PortfolioMetrics,
  CompetitionResults,
} from "@/services/portfolioScoring";
import { AnimatedCounter } from "@/components/AnimatedCounter";
import { EmptyState } from "@/components/EmptyState";
import { TableSkeleton } from "@/components/LoadingSkeleton";
import { SCORING } from "@/lib/constants";

const Leaderboard = () => {
  const [competitionResults, setCompetitionResults] =
    useState<CompetitionResults | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCompetitionResults();

    const channel = supabase
      .channel("leaderboard-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "portfolios" },
        () => {
          fetchCompetitionResults();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchCompetitionResults = async () => {
    try {
      setLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        setCurrentUserId(session.user.id);
      }

      // Update portfolio snapshots first
      await portfolioScoringEngine.updateAllPortfolioMetrics();

      // Get comprehensive competition results
      const results = await portfolioScoringEngine.getCompetitionResults();
      setCompetitionResults(results);
    } catch (error) {
      console.error("Error fetching competition results:", error);
    } finally {
      setLoading(false);
    }
  };

  const refreshResults = async () => {
    await fetchCompetitionResults();
  };

  const formatScore = (score: number) => score.toFixed(2);

  const formatSortinoRatio = (ratio: number) => ratio.toFixed(3);

  // Determine if competition has ended (winner exists)
  const competitionEnded = competitionResults?.winner !== null;

  // Find current user's participant entry
  const currentUserEntry = competitionResults?.participants.find(
    (p) => p.userId === currentUserId
  );

  /* ───────── Loading State ───────── */
  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6 p-2">
          <div className="flex items-center justify-between">
            <div className="h-10 w-56 skeleton rounded-lg" />
            <div className="h-10 w-28 skeleton rounded-lg" />
          </div>
          <TableSkeleton rows={8} columns={7} />
        </div>
      </DashboardLayout>
    );
  }

  /* ───────── Empty State ───────── */
  if (
    !competitionResults ||
    competitionResults.participants.length === 0
  ) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between animate-fade-in">
            <h1 className="text-3xl font-bold text-gradient-primary">
              Leaderboard
            </h1>
            <Button
              onClick={refreshResults}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>

          <EmptyState
            icon={Users}
            title="No Participants Yet"
            description="The leaderboard will populate once participants join and start trading."
            action={{ label: "Refresh", onClick: refreshResults }}
          />
        </div>
      </DashboardLayout>
    );
  }

  const participants = competitionResults.participants;
  const top3 = participants.slice(0, 3);

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* ───────── Your Position: Sticky Top Banner ───────── */}
        {currentUserEntry && (
          <div className="sticky top-0 z-30 animate-fade-in">
            <div className="glass-card flex items-center justify-between px-4 py-2.5 border-l-3 border-l-[hsl(var(--primary))]">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  {currentUserEntry.rank <= 3 ? (
                    <TrendingUp className="h-4 w-4 text-[hsl(var(--profit))]" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-sm font-medium text-muted-foreground">
                    Your Position
                  </span>
                </div>
                <Badge variant="secondary" className="font-bold text-base px-3">
                  #{currentUserEntry.rank}
                </Badge>
                <span className="text-sm text-muted-foreground hidden sm:inline">
                  of {competitionResults.totalParticipants} participants
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium">
                  Score:{" "}
                  <span className="text-foreground font-bold">
                    {formatScore(currentUserEntry.finalScore)}
                  </span>
                </span>
                <span
                  className={`text-sm font-semibold ${
                    currentUserEntry.profitLossPercentage >= 0
                      ? "text-[hsl(var(--profit))]"
                      : "text-[hsl(var(--loss))]"
                  }`}
                >
                  {currentUserEntry.profitLossPercentage >= 0 ? "+" : ""}
                  {currentUserEntry.profitLossPercentage.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ───────── Page Header ───────── */}
        <div className="flex items-center justify-between animate-fade-in">
          <div>
            <h1 className="text-2xl font-bold text-gradient-primary">
              Leaderboard
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {(SCORING.PNL_WEIGHT * 100).toFixed(0)}% P&L +{" "}
              {(SCORING.SORTINO_WEIGHT * 100).toFixed(0)}% Sortino
            </p>
          </div>
          <Button
            onClick={refreshResults}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        {/* ───────── Winner Banner (when competition ended) ───────── */}
        {competitionEnded && competitionResults.winner && (
          <div className="glass-card p-4 animate-slide-up border-l-4 border-l-yellow-500">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 rounded-full bg-yellow-500/15 p-2.5">
                <Trophy className="h-6 w-6 text-yellow-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-yellow-500 uppercase tracking-wider">
                  Competition Winner
                </p>
                <h2 className="text-2xl font-bold text-foreground truncate">
                  {competitionResults.winner.teamCode || "Individual Participant"}
                </h2>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-2xl font-bold text-foreground tabular-nums">
                  <AnimatedCounter
                    value={competitionResults.winner.totalValue}
                    prefix="Rs."
                    decimals={2}
                  />
                </p>
                <p
                  className={`text-sm font-semibold ${
                    competitionResults.winner.profitLossPercentage >= 0
                      ? "text-[hsl(var(--profit))]"
                      : "text-[hsl(var(--loss))]"
                  }`}
                >
                  {competitionResults.winner.profitLossPercentage >= 0 ? "+" : ""}
                  {competitionResults.winner.profitLossPercentage.toFixed(2)}% |
                  Score: {formatScore(competitionResults.winner.finalScore)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ───────── Top 3 Podium Section ───────── */}
        {top3.length >= 3 && (
          <div
            className="grid grid-cols-3 gap-3 items-end animate-slide-up"
            style={{ animationDelay: "0.1s", animationFillMode: "backwards" }}
          >
            {/* #2 -- Silver (Left) */}
            <PodiumCard
              participant={top3[1]}
              rank={2}
              podiumClass="podium-silver"
              icon={<Medal className="h-6 w-6 text-gray-400" />}
              heightClass="h-40"
              isCurrentUser={top3[1].userId === currentUserId}
              formatScore={formatScore}
              formatSortino={formatSortinoRatio}
            />

            {/* #1 -- Gold (Center, tallest) */}
            <PodiumCard
              participant={top3[0]}
              rank={1}
              podiumClass="podium-gold"
              icon={<Crown className="h-7 w-7 text-yellow-500" />}
              heightClass="h-48"
              isCurrentUser={top3[0].userId === currentUserId}
              formatScore={formatScore}
              formatSortino={formatSortinoRatio}
              isWinner
            />

            {/* #3 -- Bronze (Right) */}
            <PodiumCard
              participant={top3[2]}
              rank={3}
              podiumClass="podium-bronze"
              icon={<Award className="h-6 w-6 text-amber-700" />}
              heightClass="h-32"
              isCurrentUser={top3[2].userId === currentUserId}
              formatScore={formatScore}
              formatSortino={formatSortinoRatio}
            />
          </div>
        )}

        {/* ───────── Full Ranking Table ───────── */}
        <div
          className="animate-slide-up"
          style={{ animationDelay: "0.2s", animationFillMode: "backwards" }}
        >
          <div className="glass-card overflow-hidden">
            <table className="table-premium w-full">
              <thead>
                <tr>
                  <th className="text-left">Rank</th>
                  <th className="text-left">Name</th>
                  <th className="text-left">Team</th>
                  <th className="text-right">Portfolio Value</th>
                  <th className="text-right">P&L %</th>
                  <th className="text-right">Sortino Ratio</th>
                  <th className="text-right">Final Score</th>
                </tr>
              </thead>
              <tbody>
                {participants.map((participant, index) => {
                  const isCurrentUser = participant.userId === currentUserId;

                  return (
                    <tr
                      key={participant.userId}
                      className={
                        isCurrentUser
                          ? "border-l-2 border-l-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.06)]"
                          : index % 2 === 0
                          ? "bg-transparent"
                          : "bg-muted/20"
                      }
                    >
                      {/* Rank */}
                      <td>
                        <div className="flex items-center gap-2">
                          {participant.rank === 1 && (
                            <Crown className="h-4 w-4 text-yellow-500" />
                          )}
                          {participant.rank === 2 && (
                            <Medal className="h-4 w-4 text-gray-400" />
                          )}
                          {participant.rank === 3 && (
                            <Award className="h-4 w-4 text-amber-700" />
                          )}
                          <span className="font-semibold tabular-nums">
                            #{participant.rank}
                          </span>
                        </div>
                      </td>

                      {/* Name */}
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">
                            {participant.teamCode || "Individual"}
                          </span>
                          {isCurrentUser && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] px-1.5 py-0"
                            >
                              You
                            </Badge>
                          )}
                        </div>
                      </td>

                      {/* Team */}
                      <td className="text-muted-foreground">
                        {participant.teamCode || "--"}
                      </td>

                      {/* Portfolio Value */}
                      <td className="text-right tabular-nums font-medium">
                        <AnimatedCounter
                          value={participant.totalValue}
                          prefix="Rs."
                          decimals={2}
                        />
                      </td>

                      {/* P&L % */}
                      <td className="text-right">
                        <span
                          className={`inline-flex items-center gap-1 font-semibold tabular-nums ${
                            participant.profitLossPercentage >= 0
                              ? "text-[hsl(var(--profit))]"
                              : "text-[hsl(var(--loss))]"
                          }`}
                        >
                          {participant.profitLossPercentage >= 0 ? (
                            <TrendingUp className="h-3.5 w-3.5" />
                          ) : (
                            <TrendingDown className="h-3.5 w-3.5" />
                          )}
                          {participant.profitLossPercentage >= 0 ? "+" : ""}
                          {participant.profitLossPercentage.toFixed(2)}%
                        </span>
                      </td>

                      {/* Sortino Ratio */}
                      <td className="text-right tabular-nums text-muted-foreground">
                        {formatSortinoRatio(participant.sortinoRatio)}
                      </td>

                      {/* Final Score */}
                      <td className="text-right">
                        <span className="font-bold tabular-nums text-foreground">
                          {formatScore(participant.finalScore)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

/* ═══════════════════════════════════════════════════════════
   PodiumCard -- Reusable card for Top-3 podium display
   ═══════════════════════════════════════════════════════════ */
interface PodiumCardProps {
  participant: PortfolioMetrics;
  rank: number;
  podiumClass: string;
  icon: React.ReactNode;
  heightClass: string;
  isCurrentUser: boolean;
  formatScore: (n: number) => string;
  formatSortino: (n: number) => string;
  isWinner?: boolean;
}

function PodiumCard({
  participant,
  rank,
  podiumClass,
  icon,
  heightClass,
  isCurrentUser,
  formatScore,
  formatSortino,
  isWinner,
}: PodiumCardProps) {
  return (
    <div
      className={`${podiumClass} ${heightClass} rounded-xl flex flex-col items-center justify-end pb-4 px-2.5 relative transition-transform hover:scale-[1.01] ${
        isCurrentUser ? "ring-2 ring-[hsl(var(--primary))]" : ""
      }`}
    >
      {/* Rank Badge */}
      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
        <div
          className={`rounded-full flex items-center justify-center ${
            isWinner
              ? "h-10 w-10 bg-yellow-500 text-yellow-950 text-lg font-black shadow-lg shadow-yellow-500/30"
              : "h-8 w-8 bg-muted text-muted-foreground text-sm font-bold"
          }`}
        >
          {rank}
        </div>
      </div>

      {/* Icon */}
      <div className="mb-2">{icon}</div>

      {/* Name */}
      <p
        className={`font-bold text-center truncate w-full ${
          isWinner ? "text-lg" : "text-sm"
        }`}
      >
        {participant.teamCode || "Individual"}
      </p>

      {/* Total Value */}
      <p className="text-xs text-muted-foreground mt-1 tabular-nums">
        <AnimatedCounter
          value={participant.totalValue}
          prefix="Rs."
          decimals={0}
          className="text-xs"
        />
      </p>

      {/* P&L % */}
      <p
        className={`text-xs font-semibold tabular-nums mt-0.5 ${
          participant.profitLossPercentage >= 0
            ? "text-[hsl(var(--profit))]"
            : "text-[hsl(var(--loss))]"
        }`}
      >
        {participant.profitLossPercentage >= 0 ? "+" : ""}
        {participant.profitLossPercentage.toFixed(2)}%
      </p>

      {/* Final Score */}
      <p className="text-[11px] text-muted-foreground mt-1">
        Score:{" "}
        <span className="font-semibold text-foreground">
          {formatScore(participant.finalScore)}
        </span>
      </p>
    </div>
  );
}

export default Leaderboard;
