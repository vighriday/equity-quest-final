import { priceNoiseService } from './priceNoiseService';

/**
 * Global Service Manager
 * Manages global services that should run continuously across the application
 */
export class GlobalServiceManager {
  private static instance: GlobalServiceManager;
  private isInitialized = false;
  private priceUpdateListener: ((event: CustomEvent) => void) | null = null;

  public static getInstance(): GlobalServiceManager {
    if (!GlobalServiceManager.instance) {
      GlobalServiceManager.instance = new GlobalServiceManager();
    }
    return GlobalServiceManager.instance;
  }

  /**
   * Initialize global services
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Initialize price noise service
      // await this.initializePriceNoiseService();

      // Set up global price update listener
      this.setupPriceUpdateListener();

      this.isInitialized = true;
      
    } catch (error) {
      console.error('Error initializing global services:', error);
      throw error;
    }
  }

  /**
   * Initialize price noise service
   */
  private async initializePriceNoiseService(): Promise<void> {
    try {
      // Check if noise service is already running
      if (priceNoiseService.isNoiseRunning()) {
        return;
      }

      // Start the noise service
      await priceNoiseService.startNoiseFluctuation();
      
    } catch (error) {
      console.error('Error initializing price noise service:', error);
      // Don't throw here, let other services initialize
    }
  }

  /**
   * Set up global price update listener
   */
  private setupPriceUpdateListener(): void {
    if (typeof window === 'undefined') return;

    this.priceUpdateListener = (event: CustomEvent) => {
      const priceUpdate = event.detail;
      // Global price update received and processed
      
      // Dispatch a more specific event for components to listen to
      const specificEvent = new CustomEvent('assetPriceUpdate', {
        detail: {
          assetId: priceUpdate.assetId,
          symbol: priceUpdate.symbol,
          newPrice: priceUpdate.newPrice,
          changePercentage: priceUpdate.changePercentage,
          timestamp: priceUpdate.timestamp
        }
      });
      
      window.dispatchEvent(specificEvent);
    };

    // Listen for price updates from the noise service
    window.addEventListener('priceUpdate', this.priceUpdateListener as EventListener);
  }

  /**
   * Get noise service status
   */
  getNoiseStatus() {
    return priceNoiseService.getNoiseStats();
  }

  /**
   * Start noise service
   */
  async startNoise(): Promise<void> {
    await priceNoiseService.startNoiseFluctuation();
  }

  /**
   * Stop noise service
   */
  stopNoise(): void {
    priceNoiseService.stopNoiseFluctuation();
  }

  /**
   * Cleanup global services
   */
  cleanup(): void {
    if (this.priceUpdateListener && typeof window !== 'undefined') {
      window.removeEventListener('priceUpdate', this.priceUpdateListener as EventListener);
    }
    
    priceNoiseService.stopNoiseFluctuation();
    this.isInitialized = false;
  }
}

export const globalServiceManager = GlobalServiceManager.getInstance();
