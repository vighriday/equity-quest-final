import { supabase } from '@/integrations/supabase/client';
import { STARTING_CAPITAL } from '@/lib/constants';

export interface ResetOptions {
  resetPortfolios: boolean;
  resetPositions: boolean;
  resetOrders: boolean;
  resetTransactions: boolean;
  resetMessages: boolean;
  resetMarginWarnings: boolean;
  resetPortfolioHistory: boolean;
  resetCompetitionEvents: boolean;
  resetNews: boolean;
  resetPriceHistory: boolean;
  resetPriceFluctuations: boolean;
  startingCash: number;
  resetRounds: boolean;
}

export interface ResetResult {
  success: boolean;
  message: string;
  details: {
    portfoliosReset: number;
    positionsDeleted: number;
    ordersDeleted: number;
    transactionsDeleted: number;
    messagesDeleted: number;
    marginWarningsDeleted: number;
    portfolioHistoryDeleted: number;
    competitionEventsDeleted: number;
    newsDeleted: number;
    priceHistoryDeleted: number;
    priceFluctuationsDeleted: number;
    roundsReset: number;
  };
}

export class CompetitionResetService {
  private readonly defaultStartingCash = STARTING_CAPITAL;

  /**
   * Perform a complete competition reset
   */
  async resetCompetition(options: Partial<ResetOptions> = {}): Promise<ResetResult> {
    const resetOptions: ResetOptions = {
      resetPortfolios: true,
      resetPositions: true,
      resetOrders: true,
      resetTransactions: true,
      resetMessages: false, // Keep messages by default
      resetMarginWarnings: true,
      resetPortfolioHistory: true,
      resetCompetitionEvents: true,
      resetNews: false, // Keep news by default
      resetPriceHistory: false, // Keep price history by default
      resetPriceFluctuations: true,
      startingCash: this.defaultStartingCash,
      resetRounds: true,
      ...options
    };

    try {
      console.log('Starting competition reset with options:', resetOptions);

      const result: ResetResult = {
        success: true,
        message: 'Competition reset completed successfully',
        details: {
          portfoliosReset: 0,
          positionsDeleted: 0,
          ordersDeleted: 0,
          transactionsDeleted: 0,
          messagesDeleted: 0,
          marginWarningsDeleted: 0,
          portfolioHistoryDeleted: 0,
          competitionEventsDeleted: 0,
          newsDeleted: 0,
          priceHistoryDeleted: 0,
          priceFluctuationsDeleted: 0,
          roundsReset: 0
        }
      };

      // Reset core tables first (these should definitely exist)
      if (resetOptions.resetPositions) {
        result.details.positionsDeleted = await this.resetPositions();
      }

      if (resetOptions.resetOrders) {
        result.details.ordersDeleted = await this.resetOrders();
      }

      if (resetOptions.resetTransactions) {
        result.details.transactionsDeleted = await this.resetTransactions();
      }

      if (resetOptions.resetPortfolios) {
        result.details.portfoliosReset = await this.resetPortfolios(resetOptions.startingCash);
      }

      // Reset optional tables (these might not exist yet)
      if (resetOptions.resetMarginWarnings) {
        result.details.marginWarningsDeleted = await this.resetMarginWarnings();
      }

      if (resetOptions.resetPortfolioHistory) {
        result.details.portfolioHistoryDeleted = await this.resetPortfolioHistory();
      }

      if (resetOptions.resetCompetitionEvents) {
        result.details.competitionEventsDeleted = await this.resetCompetitionEvents();
      }

      if (resetOptions.resetMessages) {
        result.details.messagesDeleted = await this.resetMessages();
      }

      if (resetOptions.resetNews) {
        result.details.newsDeleted = await this.resetNews();
      }

      if (resetOptions.resetPriceHistory) {
        result.details.priceHistoryDeleted = await this.resetPriceHistory();
      }

      if (resetOptions.resetPriceFluctuations) {
        result.details.priceFluctuationsDeleted = await this.resetPriceFluctuations();
      }

      if (resetOptions.resetRounds) {
        result.details.roundsReset = await this.resetCompetitionRounds();
      }

      console.log('Competition reset completed:', result);
      return result;

    } catch (error) {
      console.error('Error during competition reset:', error);
      return {
        success: false,
        message: `Competition reset failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: {
          portfoliosReset: 0,
          positionsDeleted: 0,
          ordersDeleted: 0,
          transactionsDeleted: 0,
          messagesDeleted: 0,
          marginWarningsDeleted: 0,
          portfolioHistoryDeleted: 0,
          competitionEventsDeleted: 0,
          newsDeleted: 0,
          priceHistoryDeleted: 0,
          priceFluctuationsDeleted: 0,
          roundsReset: 0
        }
      };
    }
  }

  /**
   * Reset all portfolios to starting cash
   */
  private async resetPortfolios(startingCash: number): Promise<number> {
    try {
      const { data: portfolios, error } = await supabase
        .from('portfolios')
        .select('id');

      if (error) {
        console.error('Error fetching portfolios:', error);
        return 0;
      }

      if (!portfolios || portfolios.length === 0) {
        return 0;
      }

      const { error: updateError } = await supabase
        .from('portfolios')
        .update({
          cash_balance: startingCash,
          total_value: startingCash,
          profit_loss: 0,
          profit_loss_percentage: 0,
          updated_at: new Date().toISOString()
        });

      if (updateError) {
        console.error('Error updating portfolios:', updateError);
        return 0;
      }

      return portfolios.length;
    } catch (error) {
      console.error('Error in resetPortfolios:', error);
      return 0;
    }
  }

  /**
   * Delete all positions
   */
  private async resetPositions(): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('positions')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      if (error) {
        console.error('Error deleting positions:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error('Error in resetPositions:', error);
      return 0;
    }
  }

  /**
   * Delete all orders
   */
  private async resetOrders(): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('orders')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      if (error) {
        console.error('Error deleting orders:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error('Error in resetOrders:', error);
      return 0;
    }
  }

  /**
   * Delete all transactions
   */
  private async resetTransactions(): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('transactions')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      if (error) {
        console.error('Error deleting transactions:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error('Error in resetTransactions:', error);
      return 0;
    }
  }

  /**
   * Delete all margin warnings
   */
  private async resetMarginWarnings(): Promise<number> {
    const { count, error } = await supabase
      .from('margin_warnings')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (error) {
      throw new Error(`Failed to delete margin warnings: ${error.message}`);
    }

    return count || 0;
  }

  /**
   * Delete all portfolio history
   */
  private async resetPortfolioHistory(): Promise<number> {
    const { count, error } = await supabase
      .from('portfolio_history')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (error) {
      throw new Error(`Failed to delete portfolio history: ${error.message}`);
    }

    return count || 0;
  }

  /**
   * Delete all competition events
   */
  private async resetCompetitionEvents(): Promise<number> {
    const { count, error } = await supabase
      .from('competition_events')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (error) {
      throw new Error(`Failed to delete competition events: ${error.message}`);
    }

    return count || 0;
  }

  /**
   * Delete all messages
   */
  private async resetMessages(): Promise<number> {
    const { count, error } = await supabase
      .from('messages')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (error) {
      throw new Error(`Failed to delete messages: ${error.message}`);
    }

    return count || 0;
  }

  /**
   * Delete all news
   */
  private async resetNews(): Promise<number> {
    const { count, error } = await supabase
      .from('news')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (error) {
      throw new Error(`Failed to delete news: ${error.message}`);
    }

    return count || 0;
  }

  /**
   * Delete all price history
   */
  private async resetPriceHistory(): Promise<number> {
    const { count, error } = await supabase
      .from('price_history')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (error) {
      throw new Error(`Failed to delete price history: ${error.message}`);
    }

    return count || 0;
  }

  /**
   * Delete all price fluctuations
   */
  private async resetPriceFluctuations(): Promise<number> {
    const { count, error } = await supabase
      .from('price_fluctuation_log')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (error) {
      throw new Error(`Failed to delete price fluctuations: ${error.message}`);
    }

    return count || 0;
  }

  /**
   * Reset competition rounds
   */
  private async resetCompetitionRounds(): Promise<number> {
    // Delete existing rounds
    const { count: deleteCount, error: deleteError } = await supabase
      .from('competition_rounds')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (deleteError) {
      throw new Error(`Failed to delete competition rounds: ${deleteError.message}`);
    }

    // Create new rounds
    const rounds = [
      {
        round_number: 1,
        duration_minutes: 20,
        status: 'not_started' as const
      },
      {
        round_number: 2,
        duration_minutes: 25,
        status: 'not_started' as const
      },
      {
        round_number: 3,
        duration_minutes: 30,
        status: 'not_started' as const
      }
    ];

    const { error: insertError } = await supabase
      .from('competition_rounds')
      .insert(rounds);

    if (insertError) {
      throw new Error(`Failed to create competition rounds: ${insertError.message}`);
    }

    return rounds.length;
  }

  /**
   * Get current competition status
   */
  async getCompetitionStatus(): Promise<{
    totalParticipants: number;
    totalPortfolioValue: number;
    activePositions: number;
    pendingOrders: number;
    currentRound: number | null;
    competitionStarted: boolean;
  }> {
    try {
      // Get participant count
      const { count: participantCount } = await supabase
        .from('portfolios')
        .select('*', { count: 'exact', head: true });

      // Get total portfolio value
      const { data: portfolios } = await supabase
        .from('portfolios')
        .select('total_value');

      const totalPortfolioValue = portfolios?.reduce((sum, p) => sum + p.total_value, 0) || 0;

      // Get active positions count
      const { count: positionsCount } = await supabase
        .from('positions')
        .select('*', { count: 'exact', head: true })
        .gt('quantity', 0);

      // Get pending orders count
      const { count: ordersCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      // Get current round
      const { data: currentRound } = await supabase
        .from('competition_rounds')
        .select('round_number')
        .eq('status', 'active')
        .single();

      return {
        totalParticipants: participantCount || 0,
        totalPortfolioValue,
        activePositions: positionsCount || 0,
        pendingOrders: ordersCount || 0,
        currentRound: currentRound?.round_number || null,
        competitionStarted: !!currentRound
      };
    } catch (error) {
      console.error('Error getting competition status:', error);
      return {
        totalParticipants: 0,
        totalPortfolioValue: 0,
        activePositions: 0,
        pendingOrders: 0,
        currentRound: null,
        competitionStarted: false
      };
    }
  }

  /**
   * Start the first round of competition
   */
  async startCompetition(): Promise<{ success: boolean; message: string }> {
    try {
      // Check if competition is already active
      const { data: activeRound } = await supabase
        .from('competition_rounds')
        .select('*')
        .eq('status', 'active')
        .single();

      if (activeRound) {
        return {
          success: false,
          message: `Round ${activeRound.round_number} is already active`
        };
      }

      // Start Round 1
      const { error } = await supabase
        .from('competition_rounds')
        .update({ 
          status: 'active',
          started_at: new Date().toISOString()
        })
        .eq('round_number', 1);

      if (error) {
        throw new Error(`Failed to start competition: ${error.message}`);
      }

      return {
        success: true,
        message: 'Competition started! Round 1 is now active.'
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to start competition: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * End current round and start next round
   */
  async advanceToNextRound(): Promise<{ success: boolean; message: string; nextRound?: number }> {
    try {
      // Get current active round
      const { data: currentRound } = await supabase
        .from('competition_rounds')
        .select('*')
        .eq('status', 'active')
        .single();

      if (!currentRound) {
        return {
          success: false,
          message: 'No active round found'
        };
      }

      // End current round
      const { error: endError } = await supabase
        .from('competition_rounds')
        .update({ 
          status: 'completed',
          ended_at: new Date().toISOString()
        })
        .eq('id', currentRound.id);

      if (endError) {
        throw new Error(`Failed to end current round: ${endError.message}`);
      }

      // Start next round if it exists
      const nextRoundNumber = currentRound.round_number + 1;
      const { data: nextRound } = await supabase
        .from('competition_rounds')
        .select('*')
        .eq('round_number', nextRoundNumber)
        .single();

      if (nextRound) {
        const { error: startError } = await supabase
          .from('competition_rounds')
          .update({ 
            status: 'active',
            started_at: new Date().toISOString()
          })
          .eq('id', nextRound.id);

        if (startError) {
          throw new Error(`Failed to start next round: ${startError.message}`);
        }

        return {
          success: true,
          message: `Round ${currentRound.round_number} completed. Round ${nextRoundNumber} is now active.`,
          nextRound: nextRoundNumber
        };
      } else {
        return {
          success: true,
          message: `Round ${currentRound.round_number} completed. Competition finished!`,
          nextRound: null
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to advance round: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

export const competitionResetService = new CompetitionResetService();
