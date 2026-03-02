import { supabase } from "@/integrations/supabase/client";
import { priceNoiseService, PriceUpdate } from "./priceNoiseService";

export interface PriceUpdateEvent {
  type: 'price_change' | 'noise_fluctuation' | 'market_event' | 'admin_manipulation';
  assetId: string;
  symbol: string;
  oldPrice: number;
  newPrice: number;
  changePercentage: number;
  timestamp: number;
  source: 'noise' | 'admin' | 'event' | 'system';
  metadata?: Record<string, any>;
}

export interface PriceUpdateSubscription {
  id: string;
  callback: (update: PriceUpdateEvent) => void;
  assetIds?: string[]; // If undefined, subscribes to all assets
}

export class PriceUpdateService {
  private static instance: PriceUpdateService;
  private subscriptions: Map<string, PriceUpdateSubscription> = new Map();
  private realtimeSubscription: any = null;
  private noiseEventHandler: ((event: Event) => void) | null = null;
  private isInitialized = false;

  public static getInstance(): PriceUpdateService {
    if (!PriceUpdateService.instance) {
      PriceUpdateService.instance = new PriceUpdateService();
    }
    return PriceUpdateService.instance;
  }

  /**
   * Initializes the price update service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Set up Supabase real-time subscription for price changes
      await this.setupRealtimeSubscription();

      // Set up noise service event listener
      this.setupNoiseEventListener();

      this.isInitialized = true;

    } catch (error) {
      console.error('Error initializing price update service:', error);
      throw error;
    }
  }

  /**
   * Subscribes to price updates
   */
  subscribe(callback: (update: PriceUpdateEvent) => void, assetIds?: string[]): string {
    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      callback,
      assetIds
    });

    return subscriptionId;
  }

  /**
   * Unsubscribes from price updates
   */
  unsubscribe(subscriptionId: string): void {
    if (this.subscriptions.has(subscriptionId)) {
      this.subscriptions.delete(subscriptionId);
    }
  }

  /**
   * Manually triggers a price update (for admin manipulation, events, etc.)
   */
  async triggerPriceUpdate(
    assetId: string,
    newPrice: number,
    source: 'admin' | 'event' | 'system' = 'system',
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      // Get current asset data
      const { data: asset, error: fetchError } = await supabase
        .from('assets')
        .select('id, symbol, current_price')
        .eq('id', assetId)
        .single();

      if (fetchError || !asset) {
        throw new Error(`Asset not found: ${assetId}`);
      }

      const oldPrice = asset.current_price;
      const changePercentage = ((newPrice - oldPrice) / oldPrice) * 100;

      // Update the asset price in database
      const { error: updateError } = await supabase
        .from('assets')
        .update({ 
          current_price: newPrice,
          updated_at: new Date().toISOString()
        })
        .eq('id', assetId);

      if (updateError) {
        throw new Error(`Error updating price: ${updateError.message}`);
      }

      // Record the price change in price_history
      const { error: historyError } = await supabase
        .from('price_history')
        .insert({
          asset_id: assetId,
          price: newPrice,
          changed_by: null // System-initiated
        });

      if (historyError) {
        console.warn(`Warning: Could not record price history for ${asset.symbol}:`, historyError);
      }

      // Record the fluctuation in price_fluctuation_log
      const { error: logError } = await supabase
        .from('price_fluctuation_log')
        .insert({
          asset_id: assetId,
          old_price: oldPrice,
          new_price: newPrice,
          change_percentage: changePercentage,
          fluctuation_type: source === 'admin' ? 'catalyst' : 'gap'
        });

      if (logError) {
        console.warn(`Warning: Could not log price fluctuation for ${asset.symbol}:`, logError);
      }

      // Create and emit price update event
      const priceUpdate: PriceUpdateEvent = {
        type: source === 'admin' ? 'admin_manipulation' : 'market_event',
        assetId: assetId,
        symbol: asset.symbol,
        oldPrice: oldPrice,
        newPrice: newPrice,
        changePercentage: changePercentage,
        timestamp: Date.now(),
        source: source,
        metadata: metadata
      };

      this.emitPriceUpdate(priceUpdate);

    } catch (error) {
      console.error(`Error triggering price update for asset ${assetId}:`, error);
      throw error;
    }
  }

  /**
   * Sets up Supabase real-time subscription
   */
  private async setupRealtimeSubscription(): Promise<void> {
    try {
      this.realtimeSubscription = supabase
        .channel('price-updates')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'assets',
            filter: 'current_price=neq.0'
          },
          (payload) => {
            this.handleRealtimePriceUpdate(payload);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'price_history'
          },
          (payload) => {
            this.handlePriceHistoryInsert(payload);
          }
        )
        .subscribe();


    } catch (error) {
      console.error('Error setting up real-time subscription:', error);
      throw error;
    }
  }

  /**
   * Sets up noise service event listener
   */
  private setupNoiseEventListener(): void {
    if (typeof window !== 'undefined') {
      // Remove previous listener if any
      if (this.noiseEventHandler) {
        window.removeEventListener('priceUpdate', this.noiseEventHandler);
      }
      this.noiseEventHandler = (event: any) => {
        const priceUpdate = event.detail as PriceUpdate;

        const priceUpdateEvent: PriceUpdateEvent = {
          type: 'noise_fluctuation',
          assetId: priceUpdate.assetId,
          symbol: priceUpdate.symbol,
          oldPrice: priceUpdate.oldPrice,
          newPrice: priceUpdate.newPrice,
          changePercentage: priceUpdate.changePercentage,
          timestamp: priceUpdate.timestamp,
          source: 'noise',
          metadata: {
            fluctuationType: priceUpdate.fluctuationType
          }
        };

        this.emitPriceUpdate(priceUpdateEvent);
      };
      window.addEventListener('priceUpdate', this.noiseEventHandler);
    }
  }

  /**
   * Handles real-time price updates from Supabase
   */
  private handleRealtimePriceUpdate(payload: any): void {
    try {
      const { new: newData, old: oldData } = payload;
      
      if (!newData || !oldData) {
        return;
      }

      const oldPrice = parseFloat(oldData.current_price);
      const newPrice = parseFloat(newData.current_price);
      
      if (oldPrice === newPrice) {
        return; // No actual price change
      }

      const changePercentage = ((newPrice - oldPrice) / oldPrice) * 100;

      const priceUpdate: PriceUpdateEvent = {
        type: 'price_change',
        assetId: newData.id,
        symbol: newData.symbol,
        oldPrice: oldPrice,
        newPrice: newPrice,
        changePercentage: changePercentage,
        timestamp: Date.now(),
        source: 'system',
        metadata: {
          realtime: true
        }
      };

      this.emitPriceUpdate(priceUpdate);

    } catch (error) {
      console.error('Error handling real-time price update:', error);
    }
  }

  /**
   * Handles price history inserts
   */
  private handlePriceHistoryInsert(payload: any): void {
    try {
      const { new: newData } = payload;
      
      if (!newData) {
        return;
      }

      // Price history change tracked via realtime subscription

    } catch (error) {
      console.error('Error handling price history insert:', error);
    }
  }

  /**
   * Emits price update to all subscribers
   */
  private emitPriceUpdate(priceUpdate: PriceUpdateEvent): void {
    this.subscriptions.forEach((subscription) => {
      try {
        // Check if subscription is for specific assets
        if (subscription.assetIds && !subscription.assetIds.includes(priceUpdate.assetId)) {
          return; // Skip if not subscribed to this asset
        }

        subscription.callback(priceUpdate);
      } catch (error) {
        console.error(`Error in price update subscription ${subscription.id}:`, error);
      }
    });
  }

  /**
   * Gets current price for an asset
   */
  async getCurrentPrice(assetId: string): Promise<number | null> {
    try {
      const { data, error } = await supabase
        .from('assets')
        .select('current_price')
        .eq('id', assetId)
        .single();

      if (error || !data) {
        console.error(`Error fetching current price for asset ${assetId}:`, error);
        return null;
      }

      return parseFloat(data.current_price);
    } catch (error) {
      console.error(`Error getting current price for asset ${assetId}:`, error);
      return null;
    }
  }

  /**
   * Gets price history for an asset
   */
  async getPriceHistory(assetId: string, limit: number = 100): Promise<Array<{
    price: number;
    timestamp: string;
  }> | null> {
    try {
      const { data, error } = await supabase
        .from('price_history')
        .select('price, created_at')
        .eq('asset_id', assetId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error(`Error fetching price history for asset ${assetId}:`, error);
        return null;
      }

      return data?.map(item => ({
        price: parseFloat(item.price),
        timestamp: item.created_at
      })) || [];
    } catch (error) {
      console.error(`Error getting price history for asset ${assetId}:`, error);
      return null;
    }
  }

  /**
   * Cleans up the service
   */
  async cleanup(): Promise<void> {
    try {
      // Unsubscribe from real-time updates
      if (this.realtimeSubscription) {
        await supabase.removeChannel(this.realtimeSubscription);
        this.realtimeSubscription = null;
      }

      // Remove noise event listener
      if (typeof window !== 'undefined' && this.noiseEventHandler) {
        window.removeEventListener('priceUpdate', this.noiseEventHandler);
        this.noiseEventHandler = null;
      }

      // Clear all subscriptions
      this.subscriptions.clear();

      this.isInitialized = false;

    } catch (error) {
      console.error('Error cleaning up price update service:', error);
    }
  }

  /**
   * Gets service statistics
   */
  getStats(): {
    isInitialized: boolean;
    subscriptionCount: number;
    hasRealtimeConnection: boolean;
  } {
    return {
      isInitialized: this.isInitialized,
      subscriptionCount: this.subscriptions.size,
      hasRealtimeConnection: this.realtimeSubscription !== null
    };
  }
}

export const priceUpdateService = PriceUpdateService.getInstance();
