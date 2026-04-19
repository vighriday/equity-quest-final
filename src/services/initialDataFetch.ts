import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { nifty50Assets } from "@/data/nifty50Assets";

export interface TechnicalFundamentals {
  marketCap?: number;
  peRatio?: number;
  pbRatio?: number;
  dividendYield?: number;
  eps?: number;
  bookValue?: number;
  debtToEquity?: number;
  roe?: number;
  roa?: number;
  currentRatio?: number;
  quickRatio?: number;
  priceToSales?: number;
  evToEbitda?: number;
  beta?: number;
  volatility?: number;
}

export interface HistoricalDataPoint {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjustedClose?: number;
}

export interface InitialAssetData {
  symbol: string;
  name: string;
  currentPrice: number;
  previousClose: number;
  sector: string;
  assetType: 'stock' | 'commodity' | 'index';
  yFinanceTicker: string;
  technicalFundamentals: TechnicalFundamentals;
  historicalData: HistoricalDataPoint[];
  week52High?: number;
  week52Low?: number;
}

export class InitialDataFetchService {
  private static instance: InitialDataFetchService;
  private isFetching = false;

  public static getInstance(): InitialDataFetchService {
    if (!InitialDataFetchService.instance) {
      InitialDataFetchService.instance = new InitialDataFetchService();
    }
    return InitialDataFetchService.instance;
  }

  /**
   * Fetches initial data for all NIFTY 50 stocks from yFinance
   * This should be called when competition starts
   */
  async fetchInitialNifty50Data(): Promise<{
    success: boolean;
    results: Array<{
      symbol: string;
      success: boolean;
      error?: string;
      data?: InitialAssetData;
    }>;
  }> {
    if (this.isFetching) {
      throw new Error('Initial data fetch is already in progress');
    }

    this.isFetching = true;
    const results: Array<{
      symbol: string;
      success: boolean;
      error?: string;
      data?: InitialAssetData;
    }> = [];

    try {
      console.log('Starting initial NIFTY 50 data fetch...');

      for (const asset of nifty50Assets) {
        try {
          console.log(`Fetching data for ${asset.symbol}...`);
          
          const assetData = await this.fetchAssetData(asset);
          
          // Save to database
          await this.saveAssetToDatabase(assetData);
          
          results.push({
            symbol: asset.symbol,
            success: true,
            data: assetData
          });

          console.log(`✅ Successfully fetched and saved data for ${asset.symbol}`);
          
          // Rate limiting - wait 300ms between requests to avoid API limits
          await new Promise(resolve => setTimeout(resolve, 300));
          
        } catch (error) {
          console.error(`❌ Error fetching data for ${asset.symbol}:`, error);
          results.push({
            symbol: asset.symbol,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      console.log('Initial data fetch completed');
      return { success: true, results };

    } catch (error) {
      console.error('Error in initial data fetch:', error);
      return { 
        success: false, 
        results: [{
          symbol: 'ALL',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }]
      };
    } finally {
      this.isFetching = false;
    }
  }

  /**
   * Fetches comprehensive data for a single asset from yFinance
   */
  private async fetchAssetData(asset: typeof nifty50Assets[0]): Promise<InitialAssetData> {
    try {
      // Call the Supabase Edge Function to fetch yFinance data
      const { data, error } = await supabase.functions.invoke('fetch-yfinance-data', {
        body: {
          symbols: [asset.yfinance_ticker],
          includeHistorical: true,
          includeFundamentals: true
        }
      });

      if (error) {
        throw new Error(`Supabase function error: ${error.message}`);
      }

      if (!data || !data.success || !data.results || data.results.length === 0) {
        throw new Error('No data returned from yFinance');
      }

      const yFinanceData = data.results[0];
      
      if (!yFinanceData.success) {
        throw new Error(yFinanceData.error || 'Failed to fetch yFinance data');
      }

      // Extract current price and previous close
      const currentPrice = yFinanceData.currentPrice || yFinanceData.price || 0;
      const previousClose = yFinanceData.previousClose || currentPrice;

      // Extract technical fundamentals
      const technicalFundamentals: TechnicalFundamentals = {
        marketCap: yFinanceData.marketCap,
        peRatio: yFinanceData.peRatio,
        pbRatio: yFinanceData.pbRatio,
        dividendYield: yFinanceData.dividendYield,
        eps: yFinanceData.eps,
        bookValue: yFinanceData.bookValue,
        debtToEquity: yFinanceData.debtToEquity,
        roe: yFinanceData.roe,
        roa: yFinanceData.roa,
        currentRatio: yFinanceData.currentRatio,
        quickRatio: yFinanceData.quickRatio,
        priceToSales: yFinanceData.priceToSales,
        evToEbitda: yFinanceData.evToEbitda,
        beta: yFinanceData.beta,
        volatility: yFinanceData.volatility
      };

      // Extract historical data (1 month)
      const historicalData: HistoricalDataPoint[] = yFinanceData.historicalData || [];

      // Calculate 52-week high/low from historical data
      const prices = historicalData.map(d => d.high);
      const week52High = prices.length > 0 ? Math.max(...prices) : undefined;
      const week52Low = prices.length > 0 ? Math.min(...prices) : undefined;

      return {
        symbol: asset.symbol,
        name: asset.name,
        currentPrice,
        previousClose,
        sector: asset.sector,
        assetType: 'stock',
        yFinanceTicker: asset.yfinance_ticker,
        technicalFundamentals,
        historicalData,
        week52High,
        week52Low
      };

    } catch (error) {
      console.error(`Error fetching asset data for ${asset.symbol}:`, error);
      throw error;
    }
  }

  /**
   * Saves asset data to the database
   */
  private async saveAssetToDatabase(assetData: InitialAssetData): Promise<void> {
    try {
      // First, upsert the asset record
      const { error: assetError } = await supabase
        .from('assets')
        .upsert({
          symbol: assetData.symbol,
          name: assetData.name,
          current_price: assetData.currentPrice,
          previous_close: assetData.previousClose,
          sector: assetData.sector,
          asset_type: assetData.assetType,
          week_52_high: assetData.week52High,
          week_52_low: assetData.week52Low,
          market_cap: assetData.technicalFundamentals.marketCap,
          pe_ratio: assetData.technicalFundamentals.peRatio,
          yfinance_ticker: assetData.yFinanceTicker
        }, {
          onConflict: 'symbol'
        });

      if (assetError) {
        throw new Error(`Error saving asset: ${assetError.message}`);
      }

      // Get the asset ID
      const { data: asset, error: assetFetchError } = await supabase
        .from('assets')
        .select('id')
        .eq('symbol', assetData.symbol)
        .single();

      if (assetFetchError || !asset) {
        throw new Error('Could not fetch asset ID after creation');
      }

      // Save technical fundamentals
      const { error: fundamentalsError } = await supabase
        .from('financial_metrics')
        .upsert({
          asset_id: asset.id,
          metric_type: 'technical_fundamentals',
          data: assetData.technicalFundamentals as unknown as Json,
          fetched_at: new Date().toISOString()
        }, {
          onConflict: 'asset_id,metric_type'
        });

      if (fundamentalsError) {
        console.warn(`Warning: Could not save technical fundamentals for ${assetData.symbol}:`, fundamentalsError);
      }

      // Save historical price data
      const { error: historicalError } = await supabase
        .from('financial_metrics')
        .upsert({
          asset_id: asset.id,
          metric_type: 'historical_price',
          data: assetData.historicalData as unknown as Json,
          fetched_at: new Date().toISOString()
        }, {
          onConflict: 'asset_id,metric_type'
        });

      if (historicalError) {
        console.warn(`Warning: Could not save historical data for ${assetData.symbol}:`, historicalError);
      }

      // Record initial price in price_history
      const { error: priceHistoryError } = await supabase
        .from('price_history')
        .insert({
          asset_id: asset.id,
          price: assetData.currentPrice,
          changed_by: null // System-initiated
        });

      if (priceHistoryError) {
        console.warn(`Warning: Could not save initial price history for ${assetData.symbol}:`, priceHistoryError);
      }

    } catch (error) {
      console.error(`Error saving asset data to database for ${assetData.symbol}:`, error);
      throw error;
    }
  }

  /**
   * Checks if initial data has been fetched
   */
  async hasInitialDataBeenFetched(): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('assets')
        .select('id')
        .limit(1);

      if (error) {
        console.error('Error checking initial data:', error);
        return false;
      }

      return data && data.length > 0;
    } catch (error) {
      console.error('Error checking initial data:', error);
      return false;
    }
  }

  /**
   * Gets the count of assets in the database
   */
  async getAssetCount(): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('assets')
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.error('Error getting asset count:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error('Error getting asset count:', error);
      return 0;
    }
  }
}

export const initialDataFetchService = InitialDataFetchService.getInstance();
