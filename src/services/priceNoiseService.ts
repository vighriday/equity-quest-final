import { supabase } from "@/integrations/supabase/client";

export interface NoiseConfig {
  minInterval: number; // Minimum interval in milliseconds (3000ms = 3 seconds)
  maxInterval: number; // Maximum interval in milliseconds (5000ms = 5 seconds)
  minFluctuation: number; // Minimum fluctuation percentage (-0.5%)
  maxFluctuation: number; // Maximum fluctuation percentage (+0.5%)
  isEnabled: boolean;
}

export interface PriceUpdate {
  assetId: string;
  symbol: string;
  oldPrice: number;
  newPrice: number;
  changePercentage: number;
  timestamp: number;
  fluctuationType: 'noise' | 'drift' | 'gap' | 'catalyst';
}

export class PriceNoiseService {
  private static instance: PriceNoiseService;
  private noiseConfig: NoiseConfig = {
    minInterval: 3000, // 3 seconds
    maxInterval: 5000, // 5 seconds
    minFluctuation: -0.5, // -0.5%
    maxFluctuation: 0.5, // +0.5%
    isEnabled: false
  };
  
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private restartTimeout: NodeJS.Timeout | null = null;
  private isRunning = false;
  private assets: Array<{ id: string; symbol: string; current_price: number }> = [];

  public static getInstance(): PriceNoiseService {
    if (!PriceNoiseService.instance) {
      PriceNoiseService.instance = new PriceNoiseService();
    }
    return PriceNoiseService.instance;
  }

  /**
   * Starts the noise fluctuation system
   */
  async startNoiseFluctuation(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    try {
      // Starting price noise fluctuation system
      
      // Load all assets
      await this.loadAssets();
      
      if (this.assets.length === 0) {
        console.warn('No assets found. Cannot start noise fluctuation.');
        return;
      }

      this.isRunning = true;
      this.noiseConfig.isEnabled = true;

      // Start noise fluctuation for each asset
      for (const asset of this.assets) {
        this.startAssetNoise(asset);
      }

      // console.log(`✅ Price noise fluctuation started for ${this.assets.length} assets`);
      
    } catch (error) {
      console.error('Error starting price noise fluctuation:', error);
      throw error;
    }
  }

  /**
   * Stops the noise fluctuation system
   */
  stopNoiseFluctuation(): void {
    if (!this.isRunning) {
      return;
    }

    // Clear restart timeout if pending
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }

    // Clear all intervals and timeouts
    this.intervals.forEach((timeoutId, assetId) => {
      clearTimeout(timeoutId);
    });
    this.intervals.clear();

    this.isRunning = false;
    this.noiseConfig.isEnabled = false;
  }

  /**
   * Updates the noise configuration
   */
  updateNoiseConfig(config: Partial<NoiseConfig>): void {
    this.noiseConfig = { ...this.noiseConfig, ...config };
    // Noise configuration updated
  }

  /**
   * Gets the current noise configuration
   */
  getNoiseConfig(): NoiseConfig {
    return { ...this.noiseConfig };
  }

  /**
   * Checks if the noise service is running
   */
  isNoiseRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Loads all assets from the database
   */
  private async loadAssets(): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('assets')
        .select('id, symbol, current_price')
        .order('symbol');

      if (error) {
        throw new Error(`Error loading assets: ${error.message}`);
      }

      this.assets = data || [];
      // Assets loaded for noise fluctuation
      
    } catch (error) {
      console.error('Error loading assets:', error);
      throw error;
    }
  }

  /**
   * Starts noise fluctuation for a specific asset
   */
  private startAssetNoise(asset: { id: string; symbol: string; current_price: number }): void {
    const scheduleNextFluctuation = () => {
      if (!this.isRunning) return; // Guard against scheduling after stop
      // Clear existing timeout for this asset before scheduling new one
      const existingTimeout = this.intervals.get(asset.id);
      if (existingTimeout) clearTimeout(existingTimeout);
      // Generate random interval between min and max
      const interval = this.getRandomInterval();

      const timeoutId = setTimeout(async () => {
        try {
          await this.applyNoiseFluctuation(asset);
        } catch (error) {
          console.error(`Error applying noise fluctuation for ${asset.symbol}:`, error);
        }

        // Schedule next fluctuation
        scheduleNextFluctuation();
      }, interval);

      this.intervals.set(asset.id, timeoutId);
    };

    // Start the first fluctuation
    scheduleNextFluctuation();
  }

  /**
   * Applies noise fluctuation to a specific asset
   */
  private async applyNoiseFluctuation(asset: { id: string; symbol: string; current_price: number }): Promise<void> {
    if (!this.noiseConfig.isEnabled || !this.isRunning) {
      return;
    }

    try {
      // Get current price from database (in case it was updated by other means)
      const { data: currentAsset, error: fetchError } = await supabase
        .from('assets')
        .select('current_price')
        .eq('id', asset.id)
        .single();

      if (fetchError || !currentAsset) {
        console.error(`Error fetching current price for ${asset.symbol}:`, fetchError);
        return;
      }

      const currentPrice = currentAsset.current_price;
      
      // Generate random fluctuation percentage
      const fluctuationPercent = this.getRandomFluctuation();
      
      // Calculate new price
      const changeAmount = currentPrice * (fluctuationPercent / 100);
      const newPrice = Math.max(0.01, currentPrice + changeAmount); // Ensure price doesn't go below 0.01
      
      // Calculate actual change percentage
      const actualChangePercent = ((newPrice - currentPrice) / currentPrice) * 100;

      // Update the asset price in database
      const { error: updateError } = await supabase
        .from('assets')
        .update({ 
          current_price: newPrice,
          updated_at: new Date().toISOString()
        })
        .eq('id', asset.id);

      if (updateError) {
        console.error(`Error updating price for ${asset.symbol}:`, updateError);
        return;
      }

      // Record the price change in price_history
      const { error: historyError } = await supabase
        .from('price_history')
        .insert({
          asset_id: asset.id,
          price: newPrice,
          changed_by: null // System-initiated noise
        });

      if (historyError) {
        console.warn(`Warning: Could not record price history for ${asset.symbol}:`, historyError);
      }

      // Record the fluctuation in price_fluctuation_log
      const { error: logError } = await supabase
        .from('price_fluctuation_log')
        .insert({
          asset_id: asset.id,
          old_price: currentPrice,
          new_price: newPrice,
          change_percentage: actualChangePercent,
          fluctuation_type: 'noise'
        });

      if (logError) {
        console.warn(`Warning: Could not log price fluctuation for ${asset.symbol}:`, logError);
      }

      // Update the asset in our local cache
      const assetIndex = this.assets.findIndex(a => a.id === asset.id);
      if (assetIndex !== -1) {
        this.assets[assetIndex].current_price = newPrice;
      }

      // Create price update event
      const priceUpdate: PriceUpdate = {
        assetId: asset.id,
        symbol: asset.symbol,
        oldPrice: currentPrice,
        newPrice: newPrice,
        changePercentage: actualChangePercent,
        timestamp: Date.now(),
        fluctuationType: 'noise'
      };

      // Emit custom event for real-time updates
      this.emitPriceUpdate(priceUpdate);

      // Price update logged to database, no need for console spam

    } catch (error) {
      console.error(`Error applying noise fluctuation for ${asset.symbol}:`, error);
    }
  }

  /**
   * Generates a random interval between min and max
   */
  private getRandomInterval(): number {
    return Math.floor(
      Math.random() * (this.noiseConfig.maxInterval - this.noiseConfig.minInterval + 1)
    ) + this.noiseConfig.minInterval;
  }

  /**
   * Generates a random fluctuation percentage
   */
  private getRandomFluctuation(): number {
    return Math.random() * (this.noiseConfig.maxFluctuation - this.noiseConfig.minFluctuation) + this.noiseConfig.minFluctuation;
  }

  /**
   * Emits a custom event for price updates
   */
  private emitPriceUpdate(priceUpdate: PriceUpdate): void {
    // Create and dispatch a custom event
    const event = new CustomEvent('priceUpdate', {
      detail: priceUpdate
    });
    
    // Dispatch on window for global access
    if (typeof window !== 'undefined') {
      window.dispatchEvent(event);
    }
  }

  /**
   * Adds a new asset to the noise system
   */
  async addAsset(assetId: string): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('assets')
        .select('id, symbol, current_price')
        .eq('id', assetId)
        .single();

      if (error || !data) {
        console.error(`Error fetching asset ${assetId}:`, error);
        return;
      }

      // Add to local cache
      this.assets.push(data);

      // Start noise fluctuation for this asset if system is running
      if (this.isRunning) {
        this.startAssetNoise(data);
        // Asset added to noise fluctuation system
      }

    } catch (error) {
      console.error(`Error adding asset ${assetId} to noise system:`, error);
    }
  }

  /**
   * Removes an asset from the noise system
   */
  removeAsset(assetId: string): void {
    // Clear timeout for this asset
    const timeoutId = this.intervals.get(assetId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.intervals.delete(assetId);
    }

    // Remove from local cache
    this.assets = this.assets.filter(asset => asset.id !== assetId);
    
  }

  /**
   * Gets statistics about the noise system
   */
  getNoiseStats(): {
    isRunning: boolean;
    assetCount: number;
    config: NoiseConfig;
    activeIntervals: number;
  } {
    return {
      isRunning: this.isRunning,
      assetCount: this.assets.length,
      config: { ...this.noiseConfig },
      activeIntervals: this.intervals.size
    };
  }

  /**
   * Checks if the noise service is healthy and restarts if needed
   */
  checkAndRestart(): void {
    if (this.isRunning && this.noiseConfig.isEnabled) {
      // Check if we have active intervals for all assets
      if (this.intervals.size < this.assets.length) {
        console.warn(`Noise service has fewer active intervals (${this.intervals.size}) than assets (${this.assets.length}). Restarting...`);
        this.stopNoiseFluctuation();
        this.restartTimeout = setTimeout(() => {
          this.startNoiseFluctuation();
        }, 1000);
      }
    }
  }
}

export const priceNoiseService = PriceNoiseService.getInstance();
