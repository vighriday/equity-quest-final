import { supabase } from '@/integrations/supabase/client';

export interface BlackSwanEventData {
  eventId: string;
  triggerTime: string;
  haltDuration: number; // in seconds
  crashPercentage: number; // -8% for Black Swan
  recoveryPercentage: number; // +2% for blue-chip recovery
  blueChipStocks: string[]; // Reliance, Hindustan Unilever, Infosys
  isActive: boolean;
  tradingHalted: boolean;
  haltStartTime?: string;
  haltEndTime?: string;
}

export interface TradingHaltStatus {
  isHalted: boolean;
  haltStartTime?: string;
  haltEndTime?: string;
  remainingTime?: number; // seconds remaining
  reason: string;
}

export class BlackSwanEventService {
  private readonly haltDuration = 90; // 1.5 minutes = 90 seconds
  private readonly crashPercentage = -8; // -8% crash
  private readonly recoveryPercentage = 2; // +2% recovery for blue-chips
  private readonly blueChipSymbols = ['RELIANCE', 'HINDUNILVR', 'INFY'];

  /**
   * Trigger Black Swan event
   */
  async triggerBlackSwanEvent(): Promise<{ success: boolean; message: string; eventId?: string }> {
    try {
      // Check if Black Swan is already active
      const { data: existingEvent } = await supabase
        .from('competition_events')
        .select('*')
        .eq('event_type', 'black_swan')
        .eq('status', 'active')
        .single();

      if (existingEvent) {
        return {
          success: false,
          message: 'Black Swan event is already active'
        };
      }

      // Create Black Swan event
      const { data: event, error: eventError } = await supabase
        .from('competition_events')
        .insert({
          event_name: 'Black Swan Market Crash',
          event_number: 9,
          event_type: 'black_swan',
          headline: '🚨 BLACK SWAN EVENT: Market Crash & Trading Halt',
          mechanics: JSON.stringify({
            type: 'black_swan',
            crash_percentage: this.crashPercentage,
            recovery_percentage: this.recoveryPercentage,
            halt_duration: this.haltDuration,
            blue_chip_stocks: this.blueChipSymbols,
            trigger_time: new Date().toISOString()
          }),
          round_number: 3,
          status: 'active'
        })
        .select()
        .single();

      if (eventError) {
        throw new Error(`Failed to create Black Swan event: ${eventError.message}`);
      }

      // Start trading halt
      await this.startTradingHalt(event.id);

      // Apply market crash
      await this.applyMarketCrash();

      // Publish news
      await this.publishBlackSwanNews();

      return {
        success: true,
        message: 'Black Swan event triggered successfully! Trading halted for 90 seconds.',
        eventId: event.id
      };

    } catch (error) {
      console.error('Error triggering Black Swan event:', error);
      return {
        success: false,
        message: `Failed to trigger Black Swan event: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Start trading halt
   */
  private async startTradingHalt(eventId: string): Promise<void> {
    const haltStartTime = new Date();
    const haltEndTime = new Date(haltStartTime.getTime() + (this.haltDuration * 1000));

    // Update competition settings to halt trading
    const { error } = await supabase
      .from('competition_settings')
      .upsert({
        setting_key: 'trading_halt',
        setting_value: JSON.stringify({
          is_halted: true,
          halt_start_time: haltStartTime.toISOString(),
          halt_end_time: haltEndTime.toISOString(),
          reason: 'Black Swan Event - Market Crash',
          event_id: eventId
        }),
        updated_at: new Date().toISOString()
      });

    if (error) {
      throw new Error(`Failed to start trading halt: ${error.message}`);
    }

    // Schedule halt end
    setTimeout(() => {
      this.endTradingHalt();
    }, this.haltDuration * 1000);
  }

  /**
   * End trading halt and apply recovery
   */
  async endTradingHalt(): Promise<void> {
    try {
      // Update competition settings to resume trading
      const { error } = await supabase
        .from('competition_settings')
        .upsert({
          setting_key: 'trading_halt',
          setting_value: JSON.stringify({
            is_halted: false,
            halt_end_time: new Date().toISOString(),
            reason: 'Trading resumed after Black Swan event'
          }),
          updated_at: new Date().toISOString()
        });

      if (error) {
        throw new Error(`Failed to end trading halt: ${error.message}`);
      }

      // Apply blue-chip recovery
      await this.applyBlueChipRecovery();

      // Publish recovery news
      await this.publishRecoveryNews();

      console.log('Trading halt ended and recovery applied');

    } catch (error) {
      console.error('Error ending trading halt:', error);
    }
  }

  /**
   * Apply market crash to all assets
   */
  private async applyMarketCrash(): Promise<void> {
    try {
      // Get all active assets
      const { data: assets, error: assetsError } = await supabase
        .from('assets')
        .select('id, symbol, current_price')
        .eq('is_active', true);

      if (assetsError) {
        throw new Error(`Failed to fetch assets: ${assetsError.message}`);
      }

      if (!assets || assets.length === 0) {
        return;
      }

      // Apply crash to all assets
      for (const asset of assets) {
        const newPrice = asset.current_price * (1 + this.crashPercentage / 100);
        
        const { error: updateError } = await supabase
          .from('assets')
          .update({
            current_price: newPrice,
            previous_close: asset.current_price,
            updated_at: new Date().toISOString()
          })
          .eq('id', asset.id);

        if (updateError) {
          console.error(`Failed to update price for ${asset.symbol}:`, updateError);
        }

        // Log price fluctuation
        await this.logPriceFluctuation(asset.id, asset.current_price, newPrice, 'black_swan_crash');
      }

      console.log(`Applied ${this.crashPercentage}% crash to ${assets.length} assets`);

    } catch (error) {
      console.error('Error applying market crash:', error);
      throw error;
    }
  }

  /**
   * Apply blue-chip recovery
   */
  private async applyBlueChipRecovery(): Promise<void> {
    try {
      // Get blue-chip assets
      const { data: blueChipAssets, error: assetsError } = await supabase
        .from('assets')
        .select('id, symbol, current_price')
        .in('symbol', this.blueChipSymbols)
        .eq('is_active', true);

      if (assetsError) {
        throw new Error(`Failed to fetch blue-chip assets: ${assetsError.message}`);
      }

      if (!blueChipAssets || blueChipAssets.length === 0) {
        console.log('No blue-chip assets found for recovery');
        return;
      }

      // Apply recovery to blue-chip stocks
      for (const asset of blueChipAssets) {
        const newPrice = asset.current_price * (1 + this.recoveryPercentage / 100);
        
        const { error: updateError } = await supabase
          .from('assets')
          .update({
            current_price: newPrice,
            previous_close: asset.current_price,
            updated_at: new Date().toISOString()
          })
          .eq('id', asset.id);

        if (updateError) {
          console.error(`Failed to update price for ${asset.symbol}:`, updateError);
        }

        // Log price fluctuation
        await this.logPriceFluctuation(asset.id, asset.current_price, newPrice, 'blue_chip_recovery');
      }

      console.log(`Applied ${this.recoveryPercentage}% recovery to ${blueChipAssets.length} blue-chip stocks`);

    } catch (error) {
      console.error('Error applying blue-chip recovery:', error);
      throw error;
    }
  }

  /**
   * Log price fluctuation
   */
  private async logPriceFluctuation(
    assetId: string, 
    oldPrice: number, 
    newPrice: number, 
    reason: string
  ): Promise<void> {
    try {
      const changePercentage = ((newPrice - oldPrice) / oldPrice) * 100;
      
      const { error } = await supabase
        .from('price_fluctuation_log')
        .insert({
          asset_id: assetId,
          old_price: oldPrice,
          new_price: newPrice,
          change_percentage: changePercentage,
          fluctuation_type: reason
        });

      if (error) {
        console.error('Failed to log price fluctuation:', error);
      }
    } catch (error) {
      console.error('Error logging price fluctuation:', error);
    }
  }

  /**
   * Publish Black Swan news
   */
  private async publishBlackSwanNews(): Promise<void> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const { error } = await supabase
        .from('news')
        .insert({
          title: '🚨 BLACK SWAN EVENT: Market Crash & Trading Halt',
          content: `A catastrophic market event has triggered an immediate trading halt across all markets. All assets have experienced an ${Math.abs(this.crashPercentage)}% crash. Trading will resume in 90 seconds. This is a test of your risk management skills in extreme market conditions.`,
          category: 'market_event',
          published_by: session?.user.id,
          is_public: true
        });

      if (error) {
        console.error('Failed to publish Black Swan news:', error);
      }
    } catch (error) {
      console.error('Error publishing Black Swan news:', error);
    }
  }

  /**
   * Publish recovery news
   */
  private async publishRecoveryNews(): Promise<void> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const { error } = await supabase
        .from('news')
        .insert({
          title: '📈 Market Recovery: Blue-Chip Stocks Lead the Way',
          content: `Trading has resumed after the Black Swan event. Blue-chip stocks have shown resilience with a ${this.recoveryPercentage}% recovery from the crash levels. Other stocks remain at their crashed levels. The market is now open for trading.`,
          category: 'market_event',
          published_by: session?.user.id,
          is_public: true
        });

      if (error) {
        console.error('Failed to publish recovery news:', error);
      }
    } catch (error) {
      console.error('Error publishing recovery news:', error);
    }
  }

  /**
   * Get current trading halt status
   */
  async getTradingHaltStatus(): Promise<TradingHaltStatus> {
    try {
      const { data: settings } = await supabase
        .from('competition_settings')
        .select('setting_value')
        .eq('setting_key', 'trading_halt')
        .maybeSingle();

      if (!settings) {
        return {
          isHalted: false,
          reason: 'No trading halt active'
        };
      }

      const haltData = JSON.parse(settings.setting_value as string);
      const now = new Date();
      const haltEndTime = new Date(haltData.halt_end_time);

      if (haltData.is_halted && now < haltEndTime) {
        const remainingTime = Math.max(0, Math.floor((haltEndTime.getTime() - now.getTime()) / 1000));
        
        return {
          isHalted: true,
          haltStartTime: haltData.halt_start_time,
          haltEndTime: haltData.halt_end_time,
          remainingTime,
          reason: haltData.reason || 'Trading halt active'
        };
      } else {
        return {
          isHalted: false,
          reason: 'Trading is active'
        };
      }
    } catch (error) {
      console.error('Error getting trading halt status:', error);
      return {
        isHalted: false,
        reason: 'Error checking halt status'
      };
    }
  }

  /**
   * Check if trading is currently halted
   */
  async isTradingHalted(): Promise<boolean> {
    const status = await this.getTradingHaltStatus();
    return status.isHalted;
  }

  /**
   * Get Black Swan event details
   */
  async getBlackSwanEventDetails(): Promise<BlackSwanEventData | null> {
    try {
      const { data: event } = await supabase
        .from('competition_events')
        .select('*')
        .eq('event_type', 'black_swan')
        .eq('status', 'active')
        .single();

      if (!event) {
        return null;
      }

      const mechanics = JSON.parse(event.mechanics as string);
      const haltStatus = await this.getTradingHaltStatus();

      return {
        eventId: event.id,
        triggerTime: mechanics.trigger_time,
        haltDuration: mechanics.halt_duration,
        crashPercentage: mechanics.crash_percentage,
        recoveryPercentage: mechanics.recovery_percentage,
        blueChipStocks: mechanics.blue_chip_stocks,
        isActive: event.status === 'active',
        tradingHalted: haltStatus.isHalted,
        haltStartTime: haltStatus.haltStartTime,
        haltEndTime: haltStatus.haltEndTime
      };
    } catch (error) {
      console.error('Error getting Black Swan event details:', error);
      return null;
    }
  }

  /**
   * Cancel Black Swan event (emergency function)
   */
  async cancelBlackSwanEvent(): Promise<{ success: boolean; message: string }> {
    try {
      // End trading halt
      await this.endTradingHalt();

      // Mark event as cancelled
      const { error } = await supabase
        .from('competition_events')
        .update({ status: 'cancelled' })
        .eq('event_type', 'black_swan')
        .eq('status', 'active');

      if (error) {
        throw new Error(`Failed to cancel Black Swan event: ${error.message}`);
      }

      return {
        success: true,
        message: 'Black Swan event cancelled and trading resumed'
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to cancel Black Swan event: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

export const blackSwanEventService = new BlackSwanEventService();
