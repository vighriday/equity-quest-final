import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Settings, DollarSign, Newspaper, Users, Play, Pause, Square, Clock, Zap, BarChart3, AlertTriangle, Target, TrendingUp, Database, Shield, RotateCcw, Skull, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { nifty50Assets } from "@/data/nifty50Assets";
import { competitionResetService, ResetOptions } from "@/services/competitionReset";
import { simpleResetService } from "@/services/simpleReset";
import { blackSwanEventService } from "@/services/blackSwanEvent";
import { initialDataFetchService } from "@/services/initialDataFetch";
import { priceNoiseService } from "@/services/priceNoiseService";
import { priceUpdateService } from "@/services/priceUpdateService";
import { globalServiceManager } from "@/services/globalServiceManager";
import MaintenanceModeToggle from "@/components/MaintenanceModeToggle";

interface Asset {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  asset_type: 'stock' | 'commodity' | 'index';
  sector?: string;
}

interface User {
  id: string;
  full_name: string;
  email: string;
  team_code: string | null;
}

interface TeamMonitoring {
  user_id: string;
  full_name: string;
  team_code: string | null;
  total_value: number;
  cash_balance: number;
  profit_loss: number;
  profit_loss_percentage: number;
  rank: number;
  positions: Array<{
    symbol: string;
    quantity: number;
    current_value: number;
    profit_loss: number;
  }>;
}

const Admin = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<string>("");
  const [newPrice, setNewPrice] = useState("");
  const [newsTitle, setNewsTitle] = useState("");
  const [newsContent, setNewsContent] = useState("");
  const [newsCategory, setNewsCategory] = useState("");
  const [messageRecipient, setMessageRecipient] = useState("");
  const [messageTitle, setMessageTitle] = useState("");
  const [messageContent, setMessageContent] = useState("");
  const [roundStatus, setRoundStatus] = useState<string>("not_started");
  const [teamMonitoring, setTeamMonitoring] = useState<TeamMonitoring[]>([]);
  const [priceChangePercentage, setPriceChangePercentage] = useState("");
  const [competitionStatus, setCompetitionStatus] = useState<unknown>(null);
  const [blackSwanStatus, setBlackSwanStatus] = useState<unknown>(null);
  const [resetOptions, setResetOptions] = useState<ResetOptions>({
    resetPortfolios: true,
    resetPositions: true,
    resetOrders: true,
    resetTransactions: true,
    resetMessages: false,
    resetMarginWarnings: true,
    resetPortfolioHistory: true,
    resetCompetitionEvents: true,
    resetNews: false,
    resetPriceHistory: false,
    resetPriceFluctuations: true,
    startingCash: 500000, // ₹5,00,000 default
    resetRounds: false // Competition rounds are NOT reset - only user data is cleared
  });
  const [isFetchingInitialData, setIsFetchingInitialData] = useState(false);
  const [noiseStats, setNoiseStats] = useState<unknown>(null);
  const [shortSellingEnabled, setShortSellingEnabled] = useState(false);
  const [shortSellingRounds, setShortSellingRounds] = useState({
    round_1: false,
    round_2: false,
    round_3: false
  });
  const [newsItems, setNewsItems] = useState<Array<{
    id: string;
    title: string;
    content: string;
    category: string | null;
    created_at: string;
  }>>([]);

  const updateNoiseStats = useCallback(() => {
    const stats = globalServiceManager.getNoiseStatus();
    setNoiseStats(stats);
  }, []);

  const fetchShortSellingStatus = useCallback(async () => {
    try {
      const { data: settings } = await supabase
        .from('competition_settings')
        .select('setting_value')
        .eq('setting_key', 'short_selling_enabled')
        .single();

      if (settings) {
        const shortSellingConfig = JSON.parse(settings.setting_value as string);
        setShortSellingRounds(shortSellingConfig);
        // Check if short selling is enabled for any round
        const isEnabled = shortSellingConfig.round_1 || shortSellingConfig.round_2 || shortSellingConfig.round_3;
        setShortSellingEnabled(isEnabled);
      }
    } catch (error) {
      console.error('Error fetching short selling status:', error);
    }
  }, []);

  const fetchAssets = useCallback(async () => {
    const { data } = await supabase
      .from("assets")
      .select("*")
      .order("symbol");
    setAssets(data || []);
  }, []);

  const initializeSampleAssets = useCallback(async () => {
    try {
      // Check if assets already exist
      const { data: existingAssets } = await supabase
        .from("assets")
        .select("id")
        .limit(1);

      if (existingAssets && existingAssets.length > 0) {
        return; // Assets already exist
      }

      // Insert sample assets
      const sampleAssets = [
        { symbol: "RELIANCE", name: "Reliance Industries Ltd", asset_type: "stock" as const, sector: "Energy", current_price: 2500.00, previous_close: 2450.00 },
        { symbol: "TCS", name: "Tata Consultancy Services", asset_type: "stock" as const, sector: "IT", current_price: 3500.00, previous_close: 3400.00 },
        { symbol: "HDFC", name: "HDFC Bank Ltd", asset_type: "stock" as const, sector: "Banking", current_price: 1500.00, previous_close: 1480.00 },
        { symbol: "INFY", name: "Infosys Ltd", asset_type: "stock" as const, sector: "IT", current_price: 1800.00, previous_close: 1750.00 },
        { symbol: "BHARTI", name: "Bharti Airtel Ltd", asset_type: "stock" as const, sector: "Telecom", current_price: 800.00, previous_close: 820.00 },
        { symbol: "GOLD", name: "Gold", asset_type: "commodity" as const, sector: "Commodities", current_price: 55000.00, previous_close: 54500.00 },
        { symbol: "SILVER", name: "Silver", asset_type: "commodity" as const, sector: "Commodities", current_price: 75000.00, previous_close: 74000.00 },
        { symbol: "NIFTY", name: "Nifty 50", asset_type: "index" as const, sector: "Index", current_price: 19500.00, previous_close: 19200.00 }
      ];

      const { error } = await supabase
        .from("assets")
        .insert(sampleAssets);

      if (error) {
        console.error("Error initializing sample assets:", error);
      } else {
        toast.success("Sample assets initialized!");
        fetchAssets(); // Refresh the assets list
      }
    } catch (error) {
      console.error("Error initializing sample assets:", error);
    }
  }, [fetchAssets]);

  const initializeCompetitionRound = useCallback(async () => {
    try {
      const { error } = await supabase
        .from("competition_rounds")
        .insert({
          round_number: 1,
          status: "not_started",
          duration_minutes: 120 // 2 hours default
        });

      if (error) {
        console.error("Error initializing competition round:", error);
      } else {
        setRoundStatus("not_started");
        toast.success("Competition round initialized!");
        // Also initialize sample assets if they don't exist
        await initializeSampleAssets();
      }
    } catch (error) {
      console.error("Error initializing competition round:", error);
    }
  }, [initializeSampleAssets]);

  const fetchUsers = useCallback(async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, team_code, email")
      .order("full_name");
    setUsers(data || []);
  }, []);

  const fetchRoundStatus = useCallback(async () => {
    const { data } = await supabase
      .from("competition_rounds")
      .select("status")
      .eq("round_number", 1)
      .single();
    
    if (data) {
      setRoundStatus(data.status);
    } else {
      // Initialize competition round if it doesn't exist
      await initializeCompetitionRound();
    }
  }, [initializeCompetitionRound]);

  const fetchTeamMonitoring = useCallback(async () => {
    try {
      // Get all portfolios with user info
      const { data: portfolios } = await supabase
        .from("portfolios")
        .select(`
          *,
          profiles (
            full_name,
            team_code
          )
        `)
        .order("total_value", { ascending: false });

      if (!portfolios) return;

      // Get positions for each user
      const teamData: TeamMonitoring[] = [];
      
      for (let i = 0; i < portfolios.length; i++) {
        const portfolio = portfolios[i];
        const { data: positions } = await supabase
          .from("positions")
          .select(`
            quantity,
            current_value,
            profit_loss,
            assets (
              symbol
            )
          `)
          .eq("user_id", portfolio.user_id);

        teamData.push({
          user_id: portfolio.user_id,
          full_name: portfolio.profiles?.full_name || "Unknown",
          team_code: portfolio.profiles?.team_code || null,
          total_value: portfolio.total_value,
          cash_balance: portfolio.cash_balance,
          profit_loss: portfolio.profit_loss,
          profit_loss_percentage: portfolio.profit_loss_percentage,
          rank: i + 1,
          positions: positions?.map(p => ({
            symbol: p.assets?.symbol || "",
            quantity: p.quantity,
            current_value: p.current_value,
            profit_loss: p.profit_loss
          })) || []
        });
      }

      setTeamMonitoring(teamData);
    } catch (error) {
      console.error("Error fetching team monitoring data:", error);
    }
  }, []);

  const fetchCompetitionStatus = useCallback(async () => {
    try {
      const status = await simpleResetService.getCompetitionStatus();
      setCompetitionStatus(status);
    } catch (error) {
      console.error('Error fetching competition status:', error);
    }
  }, []);

  const fetchBlackSwanStatus = useCallback(async () => {
    try {
      const status = await blackSwanEventService.getBlackSwanEventDetails();
      setBlackSwanStatus(status);
    } catch (error) {
      console.error('Error fetching Black Swan status:', error);
    }
  }, []);

  const fetchNewsItems = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("news")
        .select("*")
        .order("created_at", { ascending: false });
      setNewsItems(data || []);
    } catch (error) {
      console.error('Error fetching news items:', error);
    }
  }, []);

  const fetchData = useCallback(async () => {
    await Promise.all([
      fetchAssets(), 
      fetchUsers(), 
      fetchRoundStatus(), 
      fetchTeamMonitoring(),
      fetchCompetitionStatus(),
      fetchBlackSwanStatus(),
      fetchNewsItems()
    ]);
  }, [fetchAssets, fetchUsers, fetchRoundStatus, fetchTeamMonitoring, fetchCompetitionStatus, fetchBlackSwanStatus, fetchNewsItems]);

  useEffect(() => {
    let cancelled = false;
    let noiseStatsInterval: ReturnType<typeof setInterval> | null = null;

    const init = async () => {
      try {
        await priceUpdateService.initialize();
        if (cancelled) return;
        updateNoiseStats();
        noiseStatsInterval = setInterval(updateNoiseStats, 5000);
      } catch (error) {
        console.error('Error initializing services:', error);
      }
    };

    fetchData();
    init();
    fetchShortSellingStatus();

    const assetsChannel = supabase
      .channel('admin-assets')
      .on(
        'postgres_changes' as never,
        { event: '*', schema: 'public', table: 'assets' },
        () => {
          fetchAssets();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      if (noiseStatsInterval) clearInterval(noiseStatsInterval);
      supabase.removeChannel(assetsChannel);
    };
  }, [fetchData, updateNoiseStats, fetchAssets, fetchShortSellingStatus]);

  const toggleShortSelling = async () => {
    try {
      const newStatus = !shortSellingEnabled;
      
      // Update the setting to enable/disable short selling for all rounds
      const shortSellingConfig = {
        round_1: newStatus,
        round_2: newStatus,
        round_3: newStatus
      };

      const { error } = await supabase
        .from('competition_settings')
        .upsert({
          setting_key: 'short_selling_enabled',
          setting_value: JSON.stringify(shortSellingConfig),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'setting_key'
        });

      if (error) throw error;

      setShortSellingRounds(shortSellingConfig);
      setShortSellingEnabled(newStatus);
      toast.success(`Short selling ${newStatus ? 'enabled' : 'disabled'} for all rounds`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to toggle short selling';
      console.error('Error toggling short selling:', error);
      toast.error(errorMessage);
    }
  };

  const toggleRoundShortSelling = async (round: 'round_1' | 'round_2' | 'round_3') => {
    try {
      const newRounds = {
        ...shortSellingRounds,
        [round]: !shortSellingRounds[round]
      };

      const { error } = await supabase
        .from('competition_settings')
        .upsert({
          setting_key: 'short_selling_enabled',
          setting_value: JSON.stringify(newRounds),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'setting_key'
        });

      if (error) throw error;

      setShortSellingRounds(newRounds);
      const isAnyEnabled = newRounds.round_1 || newRounds.round_2 || newRounds.round_3;
      setShortSellingEnabled(isAnyEnabled);
      
      const roundName = round.replace('round_', 'Round ');
      toast.success(`Short selling ${newRounds[round] ? 'enabled' : 'disabled'} for ${roundName}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to toggle round short selling';
      console.error('Error toggling round short selling:', error);
      toast.error(errorMessage);
    }
  };

  const fetchInitialNifty50Data = async () => {
    try {
      setIsFetchingInitialData(true);
      toast.loading("Fetching initial NIFTY 50 data from yFinance...", { id: "fetch-initial-data" });
      
      const result = await initialDataFetchService.fetchInitialNifty50Data();
      
      if (result.success) {
        const successCount = result.results.filter(r => r.success).length;
        const failureCount = result.results.filter(r => !r.success).length;
        
        toast.success(
          `Initial data fetch completed! ${successCount} assets loaded, ${failureCount} failed.`,
          { id: "fetch-initial-data" }
        );
        
        // Refresh assets list
        await fetchAssets();
      } else {
        toast.error("Failed to fetch initial data. Please try again.", { id: "fetch-initial-data" });
      }
    } catch (error) {
      console.error('Error fetching initial data:', error);
      toast.error("Error fetching initial data. Please check console for details.", { id: "fetch-initial-data" });
    } finally {
      setIsFetchingInitialData(false);
    }
  };

  const startNoiseFluctuation = async () => {
    try {
      await globalServiceManager.startNoise();
      toast.success("Price noise fluctuation started globally!");
      
      // Update stats immediately
      updateNoiseStats();
      
    } catch (error) {
      console.error('Error starting noise fluctuation:', error);
      toast.error("Failed to start noise fluctuation");
    }
  };

  const stopNoiseFluctuation = () => {
    try {
      globalServiceManager.stopNoise();
      toast.success("Price noise fluctuation stopped globally!");
      updateNoiseStats();
    } catch (error) {
      console.error('Error stopping noise fluctuation:', error);
      toast.error("Failed to stop noise fluctuation");
    }
  };

  const checkInitialDataStatus = async () => {
    try {
      const hasData = await initialDataFetchService.hasInitialDataBeenFetched();
      const assetCount = await initialDataFetchService.getAssetCount();
      
      if (hasData) {
        toast.info(`Initial data already exists. ${assetCount} assets in database.`);
      } else {
        toast.info("No initial data found. You can fetch NIFTY 50 data now.");
      }
    } catch (error) {
      console.error('Error checking initial data status:', error);
      toast.error("Error checking initial data status");
    }
  };

  const initializeNifty50Assets = async () => {
    try {
      // Check if NIFTY 50 assets already exist
      const { data: existingAssets } = await supabase
        .from("assets")
        .select("symbol")
        .in("symbol", nifty50Assets.map(a => a.symbol));

      const existingSymbols = existingAssets?.map(a => a.symbol) || [];
      const newAssets = nifty50Assets.filter(asset => !existingSymbols.includes(asset.symbol));

      if (newAssets.length === 0) {
        toast.info("All NIFTY 50 assets already exist!");
        return;
      }

      // Prepare assets for insertion
      const assetsToInsert = newAssets.map(asset => ({
        symbol: asset.symbol,
        name: asset.name,
        asset_type: asset.symbol === "NIFTY" ? "index" as const : 
                   ["GOLD", "SILVER", "CRUDE", "COPPER"].includes(asset.symbol) ? "commodity" as const : "stock" as const,
        sector: asset.sector,
        yfinance_ticker: asset.yfinance_ticker,
        current_price: 100.00, // Placeholder - will be updated by yFinance fetch
        previous_close: 100.00,
        is_active: true
      }));

      const { error } = await supabase
        .from("assets")
        .insert(assetsToInsert);

      if (error) {
        console.error("Error initializing NIFTY 50 assets:", error);
        toast.error("Failed to initialize NIFTY 50 assets");
      } else {
        toast.success(`Successfully added ${newAssets.length} NIFTY 50 assets!`);
        fetchAssets(); // Refresh the assets list
        
        // Trigger yFinance data fetch
        setTimeout(async () => {
          try {
            const { error: fetchError } = await supabase.functions.invoke('fetch-yfinance-data');
            if (fetchError) {
              console.error("Error fetching yFinance data:", fetchError);
            } else {
              toast.success("Real-time prices updated from yFinance!");
            }
          } catch (error) {
            console.error("Error triggering yFinance fetch:", error);
          }
        }, 2000);
      }
    } catch (error) {
      console.error("Error initializing NIFTY 50 assets:", error);
      toast.error("Failed to initialize NIFTY 50 assets");
    }
  };

  const checkMargins = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('check-margins');
      
      if (error) throw error;

      if (data.success) {
        toast.success(`Margin check completed: ${data.warnings_sent} warnings sent, ${data.liquidations} positions liquidated`);
      } else {
        toast.error(data.error || "Margin check failed");
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to check margins";
      toast.error(errorMessage);
    }
  };


  const deleteNewsItem = async (newsId: string) => {
    try {
      const { error } = await supabase
        .from("news")
        .delete()
        .eq("id", newsId);

      if (error) throw error;

      toast.success("News item deleted successfully!");
      fetchNewsItems();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete news item';
      console.error('Error deleting news item:', error);
      toast.error(errorMessage);
    }
  };

  const clearAllNews = async () => {
    try {
      const { error } = await supabase
        .from("news")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all news

      if (error) throw error;

      toast.success("All news items cleared successfully!");
      fetchNewsItems();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to clear news';
      console.error('Error clearing news:', error);
      toast.error(errorMessage);
    }
  };

  const resetCompetition = async () => {
    try {
      const result = await simpleResetService.resetCompetition(resetOptions.startingCash);
      
      if (result.success) {
        const details = result.details;
        toast.success(`${result.message} - Reset ${details.portfoliosReset} portfolios, deleted ${details.positionsDeleted} positions, ${details.ordersDeleted} orders, ${details.transactionsDeleted} transactions, ${details.marginWarningsDeleted} margin warnings, ${details.portfolioHistoryDeleted} portfolio history records, ${details.competitionEventsDeleted} events, ${details.priceFluctuationsDeleted} price fluctuations`);
        fetchAssets();
        fetchCompetitionStatus();
      } else {
        toast.error(result.message);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to reset competition";
      toast.error(errorMessage);
    }
  };

  const startCompetition = async () => {
    try {
      const result = await competitionResetService.startCompetition();
      
      if (result.success) {
        toast.success(result.message);
        fetchCompetitionStatus();
      } else {
        toast.error(result.message);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to start competition";
      toast.error(errorMessage);
    }
  };

  const advanceRound = async () => {
    try {
      const result = await competitionResetService.advanceToNextRound();
      
      if (result.success) {
        toast.success(result.message);
        fetchCompetitionStatus();
      } else {
        toast.error(result.message);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to advance round";
      toast.error(errorMessage);
    }
  };

  const triggerBlackSwan = async () => {
    try {
      const result = await blackSwanEventService.triggerBlackSwanEvent();
      
      if (result.success) {
        toast.success(result.message);
        fetchBlackSwanStatus();
      } else {
        toast.error(result.message);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to trigger Black Swan event";
      toast.error(errorMessage);
    }
  };

  const cancelBlackSwan = async () => {
    try {
      const result = await blackSwanEventService.cancelBlackSwanEvent();
      
      if (result.success) {
        toast.success(result.message);
        fetchBlackSwanStatus();
      } else {
        toast.error(result.message);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to cancel Black Swan event";
      toast.error(errorMessage);
    }
  };


  const handleUpdatePrice = async () => {
    if (!selectedAsset || !newPrice) {
      toast.error("Please select an asset and enter a price");
      return;
    }

    try {
      const price = parseFloat(newPrice);
      const { data: { session } } = await supabase.auth.getSession();

      // Update asset price
      const { error: assetError } = await supabase
        .from("assets")
        .update({ 
          current_price: price,
          updated_at: new Date().toISOString()
        })
        .eq("id", selectedAsset);

      if (assetError) throw assetError;

      // Log price history
      await supabase.from("price_history").insert({
        asset_id: selectedAsset,
        price: price,
        changed_by: session?.user.id,
      });

      toast.success("Price updated successfully!");
      setNewPrice("");
      fetchAssets();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update price";
      toast.error(errorMessage);
    }
  };

  const handlePercentagePriceChange = async () => {
    if (!selectedAsset || !priceChangePercentage) {
      toast.error("Please select an asset and enter a percentage");
      return;
    }

    try {
      const percentage = parseFloat(priceChangePercentage);
      const asset = assets.find(a => a.id === selectedAsset);
      if (!asset) throw new Error("Asset not found");

      const newPrice = asset.current_price * (1 + percentage / 100);
      const { data: { session } } = await supabase.auth.getSession();

      // Update asset price
      const { error: assetError } = await supabase
        .from("assets")
        .update({ 
          current_price: newPrice,
          updated_at: new Date().toISOString()
        })
        .eq("id", selectedAsset);

      if (assetError) throw assetError;

      // Log price history
      await supabase.from("price_history").insert({
        asset_id: selectedAsset,
        price: newPrice,
        changed_by: session?.user.id,
      });

      toast.success(`Price changed by ${percentage}% successfully!`);
      setPriceChangePercentage("");
      fetchAssets();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update price";
      toast.error(errorMessage);
    }
  };

  const handleEventMacro = async (eventType: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      // Create event in competition_events table first
      const eventData = getEventData(eventType);
      if (!eventData) {
        throw new Error("Unknown event type");
      }

      console.log('Triggering event:', eventType, eventData);

      // Insert event into database
      const { data: event, error: eventError } = await supabase
        .from('competition_events')
        .insert({
          event_name: eventData.name,
          event_number: eventData.number,
          event_type: eventData.type,
          headline: eventData.headline,
          mechanics: eventData.mechanics,
          round_number: eventData.round,
          status: 'pending'
        })
        .select()
        .single();

      if (eventError) {
        console.error('Error creating event:', eventError);
        throw eventError;
      }

      console.log('Event created with ID:', event.id);

      // Execute the event using Edge Function
      const { data: executeResult, error: executeError } = await supabase.functions.invoke('execute-event', {
        body: { eventId: event.id }
      });

      if (executeError) {
        console.error('Error executing event:', executeError);
        throw executeError;
      }

      console.log('Event execution result:', executeResult);

      // Publish news
      const { error: newsError } = await supabase.from("news").insert({
        title: eventData.headline,
        content: eventData.content,
        category: eventData.category,
        published_by: session?.user.id,
        is_public: true,
      });

      if (newsError) {
        console.error('Error publishing news:', newsError);
        // Don't throw here, event was executed successfully
      }

      toast.success(`${eventData.name} event triggered successfully!`);
      fetchAssets();
    } catch (error: unknown) {
      console.error('Event trigger error:', error);
      const errorMessage = error instanceof Error ? error.message : "Failed to trigger event";
      toast.error(errorMessage);
    }
  };

  const getEventData = (eventType: string) => {
    const events = {
      'event1_telecom_shakeup': {
        name: "Telecom Sector Shake-up",
        number: 1,
        type: "sector_impact",
        headline: "Reliance Jio announces an aggressive 8% tariff hike; simultaneously, the government announces a relief package for the telecom sector, reducing spectrum dues.",
        content: "Reliance Jio's aggressive tariff hike combined with government relief package creates mixed signals for the telecom sector. Reliance benefits from tariff increase while Bharti Airtel gains from regulatory relief.",
        category: "Market Alert",
        round: 1,
        mechanics: {
          affected_assets: ["RELIANCE", "BHARTIARTL"],
          open_gap: 0.045, // Reliance +4.5%
          drift: 0.015,    // Reliance +1.5% drift
          drift_duration: 20,
          asset_specific_impacts: {
            "RELIANCE": { open_gap: 0.045, drift: 0.015 },
            "BHARTIARTL": { open_gap: 0.030, drift: 0.010 }
          }
        }
      },
      'event2_banking_divergence': {
        name: "Banking Asset Quality Divergence",
        number: 2,
        type: "sector_impact",
        headline: "HDFC Bank reports higher-than-expected retail loan defaults. In contrast, ICICI Bank pre-releases stellar asset quality numbers, showing NPAs at a multi-year low.",
        content: "HDFC Bank faces asset quality concerns with higher retail loan defaults, while ICICI Bank reports excellent asset quality with NPAs at multi-year lows. This divergence creates sector-wide uncertainty.",
        category: "Market Alert",
        round: 1,
        mechanics: {
          affected_assets: ["HDFCBANK", "ICICIBANK"],
          open_gap: -0.04, // HDFC Bank -4.0%
          drift: -0.015,   // HDFC Bank -1.5% drift
          drift_duration: 20,
          asset_specific_impacts: {
            "HDFCBANK": { open_gap: -0.04, drift: -0.015 },
            "ICICIBANK": { open_gap: 0.03, drift: 0.01 }
          }
        }
      },
      'event3_global_cues_it': {
        name: "Global Cues & IT Whiplash",
        number: 3,
        type: "global_impact",
        headline: "Global Tech Rally Drives IT Sector Surge",
        content: "Strong global tech earnings and positive market sentiment drive IT stocks higher. Major tech companies report better-than-expected quarterly results.",
        category: "Market Alert",
        round: 2,
        mechanics: {
          affected_assets: ["TCS", "INFY", "WIPRO", "HCLTECH"],
          open_gap: 0.12,
          drift: 0.08,
          drift_duration: 30,
          catalyst: {
            at_minute: 15,
            change: 0.05
          }
        }
      },
      'event4_commodity_supercycle': {
        name: "Commodity Supercycle Rumor",
        number: 4,
        type: "commodity_impact",
        headline: "Chatter intensifies about a new commodity supercycle. Chinese demand for steel and aluminum is rumored to be surging.",
        content: "Conflicting insider reports about commodity supercycle. Some sources confirm booming Chinese construction activity, while others suggest this is a fund pump-and-dump scheme. Market reacts with initial optimism but stalls as conflicting data emerges.",
        category: "Market Alert",
        round: 2,
        mechanics: {
          affected_assets: ["HINDALCO", "JSWSTEEL", "TATASTEEL", "SILVER"],
          open_gap: 0.035, // Steel/Aluminum +3.5%
          drift: 0.01,     // Steel/Aluminum +1.0% drift
          drift_duration: 30,
          special: "conflicting_info",
          asset_specific_impacts: {
            "HINDALCO": { open_gap: 0.035, drift: 0.01 },
            "JSWSTEEL": { open_gap: 0.035, drift: 0.01 },
            "TATASTEEL": { open_gap: 0.035, drift: 0.01 },
            "SILVER": { open_gap: 0.02, drift: 0.0 }
          },
          market_twist: {
            at_minute: 20,
            change: -0.02, // Falls back -2.0% from highs
            affected_assets: ["HINDALCO", "JSWSTEEL", "TATASTEEL", "SILVER"]
          }
        }
      },
      'event5_red_herring': {
        name: "Red Herring Corporate Action",
        number: 5,
        type: "corporate_action",
        headline: "Major Corporate Restructuring Announced",
        content: "Several companies announce significant corporate restructuring plans. Market analysts are divided on the potential impact of these changes.",
        category: "Corporate News",
        round: 2,
        mechanics: {
          affected_assets: ["RELIANCE", "TATAMOTORS"],
          open_gap: 0,
          drift: 0,
          drift_duration: 0,
          special: "red_herring"
        }
      },
      'event6_rbi_policy': {
        name: "RBI Policy Shock",
        number: 6,
        type: "policy_impact",
        headline: "In an emergency meeting, RBI hikes repo rate by an unexpected 50 basis points.",
        content: "RBI's unexpected 50 basis point rate hike catches markets off-guard. Banks face margin pressure while auto sector suffers from higher borrowing costs and reduced consumer spending.",
        category: "Policy Alert",
        round: 3,
        mechanics: {
          affected_assets: ["HDFCBANK", "ICICIBANK", "SBIN", "AXISBANK", "MARUTI", "M&M", "TATAMOTORS"],
          open_gap: -0.04, // Banks -4.0%
          drift: 0,
          drift_duration: 0,
          asset_specific_impacts: {
            "HDFCBANK": { open_gap: -0.04, drift: 0 },
            "ICICIBANK": { open_gap: -0.04, drift: 0 },
            "SBIN": { open_gap: -0.04, drift: 0 },
            "AXISBANK": { open_gap: -0.04, drift: 0 },
            "MARUTI": { open_gap: -0.03, drift: 0 },
            "M&M": { open_gap: -0.03, drift: 0 },
            "TATAMOTORS": { open_gap: -0.03, drift: 0 }
          }
        }
      },
      'event7_geopolitical': {
        name: "Geopolitical Flare-up",
        number: 7,
        type: "geopolitical",
        headline: "Tensions escalate in the Middle East, threatening crude oil supply lines.",
        content: "Escalating Middle East tensions threaten crude oil supply lines, driving energy prices higher. Safe-haven assets like gold and silver see increased demand as investors seek refuge from geopolitical uncertainty.",
        category: "Geopolitical Alert",
        round: 3,
        mechanics: {
          affected_assets: ["ONGC", "RELIANCE", "GOLD", "SILVER"],
          open_gap: 0.05, // ONGC, Reliance +5.0%
          drift: 0,
          drift_duration: 0,
          asset_specific_impacts: {
            "ONGC": { open_gap: 0.05, drift: 0 },
            "RELIANCE": { open_gap: 0.05, drift: 0 },
            "GOLD": { open_gap: 0.03, drift: 0 },
            "SILVER": { open_gap: 0.015, drift: 0 }
          }
        }
      },
      'event8_policy_rumor': {
        name: "Evolving Policy Rumor",
        number: 8,
        type: "policy_evolution",
        headline: "Sources report the government is finalizing a massive expansion to the auto scrappage policy.",
        content: "Initial reports suggest major auto scrappage policy expansion, but government later clarifies it's only a proposal under early review. Auto sector sees initial surge followed by partial reversal as clarity emerges.",
        category: "Policy Update",
        round: 3,
        mechanics: {
          affected_assets: ["MARUTI", "M&M", "TATAMOTORS", "BAJAJ-AUTO", "HEROMOTOCO"],
          open_gap: 0.04, // Autos +4%
          drift: 0,
          drift_duration: 0,
          special: "partial_reversal",
          market_twist: {
            at_minute: 20,
            change: -0.03, // Autos give back -3%
            affected_assets: ["MARUTI", "M&M", "TATAMOTORS", "BAJAJ-AUTO", "HEROMOTOCO"]
          }
        }
      },
      'event9_black_swan': {
        name: "THE BLACK SWAN",
        number: 9,
        type: "black_swan",
        headline: "Breaking: A major Indian bank has defaulted on its international debt obligations. Global ratings agencies are putting India's sovereign rating on a negative watch.",
        content: "Major Indian bank defaults on international debt, triggering sovereign rating downgrade watch. NIFTY 50 halts trading for 2 minutes, then crashes 8%. Gold and silver spike as safe havens. Blue-chip stocks partially recover after 10 minutes.",
        category: "Market Crisis",
        round: 3,
        mechanics: {
          affected_assets: ["ALL_STOCKS", "GOLD", "SILVER"],
          open_gap: -0.08, // All stocks -8%
          drift: 0,
          drift_duration: 0,
          special: "black_swan",
          asset_specific_impacts: {
            "GOLD": { open_gap: 0.05, drift: 0 }, // Gold +5%
            "SILVER": { open_gap: 0.03, drift: 0 } // Silver +3%
          },
          trading_halt: {
            duration_minutes: 2,
            affected_assets: ["NIFTY"]
          },
          blue_chip_recovery: {
            at_minute: 10,
            change: 0.02, // +2% recovery
            affected_assets: ["RELIANCE", "HINDUNILVR", "INFY", "TCS", "HDFCBANK", "ICICIBANK", "ITC", "BHARTIARTL"]
          }
        }
      }
    };

    return events[eventType as keyof typeof events];
  };

  const handlePublishNews = async () => {
    if (!newsTitle || !newsContent) {
      toast.error("Please fill in title and content");
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const { error } = await supabase.from("news").insert({
        title: newsTitle,
        content: newsContent,
        category: newsCategory || null,
        published_by: session?.user.id,
        is_public: true,
      });

      if (error) throw error;

      toast.success("News published successfully!");
      setNewsTitle("");
      setNewsContent("");
      setNewsCategory("");
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to publish news";
      toast.error(errorMessage);
    }
  };

  const handleSendMessage = async () => {
    if (!messageRecipient || !messageTitle || !messageContent) {
      toast.error("Please fill in all fields");
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const { error } = await supabase.from("messages").insert({
        recipient_id: messageRecipient,
        sender_id: session?.user.id,
        title: messageTitle,
        content: messageContent,
      });

      if (error) throw error;

      toast.success("Message sent successfully!");
      setMessageTitle("");
      setMessageContent("");
      setMessageRecipient("");
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to send message";
      toast.error(errorMessage);
    }
  };

  const handleResetCompetition = async () => {
    try {
      // Reset the competition round to not_started
      const { error } = await supabase
        .from("competition_rounds")
        .update({ 
          status: "not_started",
          start_time: null,
          end_time: null,
          updated_at: new Date().toISOString()
        })
        .eq("round_number", 1);

      if (error) throw error;

      toast.success("Competition reset successfully! You can now start a new round.");
      fetchRoundStatus();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to reset competition";
      toast.error(errorMessage);
    }
  };

  const handleRoundControl = async (action: "start" | "pause" | "end") => {
    try {
      // First check if round exists, if not initialize it
      const { data: existingRound } = await supabase
        .from("competition_rounds")
        .select("id")
        .eq("round_number", 1)
        .single();

      if (!existingRound) {
        await initializeCompetitionRound();
      }

      let newStatus: "not_started" | "active" | "paused" | "completed";
      switch (action) {
        case "start":
          newStatus = "active";
          break;
        case "pause":
          newStatus = "paused";
          break;
        case "end":
          newStatus = "completed";
          break;
        default:
          newStatus = "not_started";
      }

      const { error } = await supabase
        .from("competition_rounds")
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString(),
          ...(action === "start" && { start_time: new Date().toISOString() }),
          ...(action === "end" && { end_time: new Date().toISOString() })
        })
        .eq("round_number", 1);

      if (error) throw error;

      toast.success(`Round ${action}ed successfully!`);
      fetchRoundStatus();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : `Failed to ${action} round`;
      toast.error(errorMessage);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Settings className="h-8 w-8 text-primary" />
            Admin Control Panel
          </h1>
          <p className="text-muted-foreground">Manage the competition, prices, news, and communications</p>
        </div>

        {/* Round Controls */}
        <Card className="card-enhanced border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Competition Round Controls
              <Badge variant={roundStatus === "active" ? "default" : "secondary"} className="ml-auto">
                {roundStatus.toUpperCase().replace("_", " ")}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex gap-4">
              <Button 
                onClick={() => handleRoundControl("start")}
                disabled={roundStatus === "active" || roundStatus === "completed"}
                className="flex-1 h-14 text-base"
              >
                <Play className="h-5 w-5 mr-2" />
                Start Round
              </Button>
              <Button 
                variant="outline"
                onClick={() => handleRoundControl("pause")}
                disabled={roundStatus !== "active"}
                className="flex-1 h-14 text-base"
              >
                <Pause className="h-5 w-5 mr-2" />
                Pause Round
              </Button>
              <Button 
                variant="destructive"
                onClick={() => handleRoundControl("end")}
                disabled={roundStatus === "completed"}
                className="flex-1 h-14 text-base"
              >
                <Square className="h-5 w-5 mr-2" />
                End Round
              </Button>
            </div>
            
            {roundStatus === "completed" && (
              <div className="mt-6 p-4 bg-muted/50 rounded-lg border border-warning/20">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                  <h3 className="font-semibold text-warning">Competition Completed</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  The competition has ended. Reset it to start a new round.
                </p>
                <Button 
                  onClick={handleResetCompetition}
                  className="bg-warning hover:bg-warning/90 text-warning-foreground"
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Reset Competition
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Tabs defaultValue="prices" className="space-y-4">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="prices">
              <DollarSign className="h-4 w-4 mr-2" />
              Prices
            </TabsTrigger>
            <TabsTrigger value="news">
              <Newspaper className="h-4 w-4 mr-2" />
              News
            </TabsTrigger>
            <TabsTrigger value="messages">
              <Users className="h-4 w-4 mr-2" />
              Messages
            </TabsTrigger>
            <TabsTrigger value="events">
              <Zap className="h-4 w-4 mr-2" />
              Events
            </TabsTrigger>
            <TabsTrigger value="monitoring">
              <BarChart3 className="h-4 w-4 mr-2" />
              Teams
            </TabsTrigger>
            <TabsTrigger value="activity">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="prices">
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="card-enhanced">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-primary" />
                    Set Absolute Price
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Select Asset</Label>
                    <Select value={selectedAsset} onValueChange={setSelectedAsset}>
                      <SelectTrigger className="input-enhanced">
                        <SelectValue placeholder="Choose an asset" />
                      </SelectTrigger>
                      <SelectContent>
                        {assets.map((asset) => (
                          <SelectItem key={asset.id} value={asset.id}>
                            {asset.symbol} - {asset.name} (Current: ₹{asset.current_price})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>New Price (₹)</Label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={newPrice}
                      onChange={(e) => setNewPrice(e.target.value)}
                      step="0.01"
                      className="input-enhanced"
                    />
                  </div>

                  <Button onClick={handleUpdatePrice} className="w-full btn-buy">
                    Update Price
                  </Button>
                </CardContent>
              </Card>

              <Card className="card-enhanced">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-primary" />
                    Percentage Change
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Select Asset</Label>
                    <Select value={selectedAsset} onValueChange={setSelectedAsset}>
                      <SelectTrigger className="input-enhanced">
                        <SelectValue placeholder="Choose an asset" />
                      </SelectTrigger>
                      <SelectContent>
                        {assets.map((asset) => (
                          <SelectItem key={asset.id} value={asset.id}>
                            {asset.symbol} - {asset.name} (Current: ₹{asset.current_price})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Percentage Change (%)</Label>
                    <Input
                      type="number"
                      placeholder="e.g., -5.5 or +8"
                      value={priceChangePercentage}
                      onChange={(e) => setPriceChangePercentage(e.target.value)}
                      step="0.1"
                      className="input-enhanced"
                    />
                  </div>

                  <Button onClick={handlePercentagePriceChange} className="w-full btn-sell">
                    Apply Change
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="news">
            <div className="space-y-6">
              {/* Publish News */}
              <Card className="card-enhanced">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Newspaper className="h-5 w-5 text-primary" />
                    Publish Market News
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input
                      placeholder="Breaking: Market Update"
                      value={newsTitle}
                      onChange={(e) => setNewsTitle(e.target.value)}
                      className="input-enhanced"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Category (Optional)</Label>
                    <Input
                      placeholder="e.g., Market Alert, Company News"
                      value={newsCategory}
                      onChange={(e) => setNewsCategory(e.target.value)}
                      className="input-enhanced"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Content</Label>
                    <Textarea
                      placeholder="Enter news content..."
                      value={newsContent}
                      onChange={(e) => setNewsContent(e.target.value)}
                      rows={5}
                    />
                  </div>

                  <Button onClick={handlePublishNews} className="w-full btn-buy">
                    Publish News
                  </Button>
                </CardContent>
              </Card>

              {/* News Management */}
              <Card className="card-enhanced border-orange-500/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Newspaper className="h-5 w-5 text-orange-600" />
                    News Management
                    <Badge variant="secondary" className="ml-auto">
                      {newsItems.length} items
                    </Badge>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-2">
                    Manage existing news items and clear all news
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Clear All Button */}
                  <div className="flex justify-between items-center p-4 bg-destructive/10 rounded-lg border border-destructive/20">
                    <div>
                      <h3 className="font-semibold text-destructive">Clear All News</h3>
                      <p className="text-sm text-muted-foreground">
                        This will delete all existing news items permanently
                      </p>
                    </div>
                    <Button
                      onClick={clearAllNews}
                      variant="destructive"
                      className="h-10 px-4"
                    >
                      Clear All News
                    </Button>
                  </div>

                  {/* News List */}
                  <div className="space-y-3">
                    <h4 className="font-semibold text-base">Existing News Items</h4>
                    {newsItems.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">No news items found</p>
                    ) : (
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {newsItems.map((news) => (
                          <div key={news.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
                            <div className="flex-1 min-w-0">
                              <h5 className="font-medium truncate">{news.title}</h5>
                              <p className="text-xs text-muted-foreground mt-1">
                                {news.category && `${news.category} • `}
                                {new Date(news.created_at).toLocaleString()}
                              </p>
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                {news.content}
                              </p>
                            </div>
                            <Button
                              onClick={() => deleteNewsItem(news.id)}
                              variant="outline"
                              size="sm"
                              className="ml-3 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                            >
                              Delete
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="messages">
            <Card className="card-enhanced">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Send Private Message
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Recipient</Label>
                  <Select value={messageRecipient} onValueChange={setMessageRecipient}>
                    <SelectTrigger className="input-enhanced">
                      <SelectValue placeholder="Select a user" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.full_name} ({user.team_code || "No team"})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    placeholder="Insider Tip"
                    value={messageTitle}
                    onChange={(e) => setMessageTitle(e.target.value)}
                    className="input-enhanced"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Message</Label>
                  <Textarea
                    placeholder="Enter your message..."
                    value={messageContent}
                    onChange={(e) => setMessageContent(e.target.value)}
                    rows={5}
                  />
                </div>

                <Button onClick={handleSendMessage} className="w-full btn-sell">
                  Send Message
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="events">
            <div className="space-y-6">
              {/* Round 1 Events */}
              <Card className="card-enhanced">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-primary" />
                    Round 1: The Fundamentals Floor (20 Mins)
                    <Badge variant="secondary" className="ml-auto">No Shorting</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Button 
                      onClick={() => handleEventMacro('event1_telecom_shakeup')}
                      className="h-20 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white"
                    >
                      <AlertTriangle className="h-5 w-5" />
                      <span className="font-semibold text-sm">Event 1: Telecom Shake-up</span>
                      <span className="text-xs opacity-90">-15% Telecom</span>
                    </Button>

                    <Button 
                      onClick={() => handleEventMacro('event2_banking_divergence')}
                      className="h-20 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white"
                    >
                      <AlertTriangle className="h-5 w-5" />
                      <span className="font-semibold text-sm">Event 2: Banking Divergence</span>
                      <span className="text-xs opacity-90">-8% Banking</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Round 2 Events */}
              <Card className="card-enhanced">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-primary" />
                    Round 2: The Fog of War (30 Mins)
                    <Badge variant="default" className="ml-auto">Shorting Enabled</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    <Button 
                      onClick={() => handleEventMacro('event3_global_cues_it')}
                      className="h-20 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white"
                    >
                      <TrendingUp className="h-5 w-5" />
                      <span className="font-semibold text-sm">Event 3: IT Whiplash</span>
                      <span className="text-xs opacity-90">+12% IT + Catalyst</span>
                    </Button>

                    <Button 
                      onClick={() => handleEventMacro('event4_commodity_supercycle')}
                      className="h-20 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white"
                    >
                      <AlertTriangle className="h-5 w-5" />
                      <span className="font-semibold text-sm">Event 4: Commodity Cycle</span>
                      <span className="text-xs opacity-90">+10% + Conflicting Info</span>
                    </Button>

                    <Button 
                      onClick={() => handleEventMacro('event5_red_herring')}
                      className="h-20 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white"
                    >
                      <AlertTriangle className="h-5 w-5" />
                      <span className="font-semibold text-sm">Event 5: Red Herring</span>
                      <span className="text-xs opacity-90">No Impact (Test)</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Round 3 Events */}
              <Card className="card-enhanced">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-primary" />
                    Round 3: The Macro Meltdown (30 Mins)
                    <Badge variant="destructive" className="ml-auto">High Volatility</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Button 
                      onClick={() => handleEventMacro('event6_rbi_policy')}
                      className="h-20 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white"
                    >
                      <AlertTriangle className="h-5 w-5" />
                      <span className="font-semibold text-sm">Event 6: RBI Policy</span>
                      <span className="text-xs opacity-90">-12% Policy Shock</span>
                    </Button>

                    <Button 
                      onClick={() => handleEventMacro('event7_geopolitical')}
                      className="h-20 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white"
                    >
                      <AlertTriangle className="h-5 w-5" />
                      <span className="font-semibold text-sm">Event 7: Geopolitical</span>
                      <span className="text-xs opacity-90">-10% Tensions</span>
                    </Button>

                    <Button 
                      onClick={() => handleEventMacro('event8_policy_rumor')}
                      className="h-20 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white"
                    >
                      <AlertTriangle className="h-5 w-5" />
                      <span className="font-semibold text-sm">Event 8: Policy Rumor</span>
                      <span className="text-xs opacity-90">-8% + Reversal</span>
                    </Button>

                    <Button 
                      onClick={() => handleEventMacro('event9_black_swan')}
                      className="h-20 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-black to-gray-800 hover:from-gray-800 hover:to-gray-900 text-white border-2 border-red-500"
                    >
                      <AlertTriangle className="h-5 w-5 text-red-400" />
                      <span className="font-semibold text-sm">Event 9: BLACK SWAN</span>
                      <span className="text-xs opacity-90 text-red-300">-8% + Trading Halt</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="monitoring">
            <Card className="card-enhanced">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Team Monitoring
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {teamMonitoring.map((team, index) => (
                    <div key={team.user_id} className="border border-border rounded-lg p-4 animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
                      <div className="flex items-center justify-between mb-3">
                      <div>
                          <h3 className="font-bold text-lg">{team.full_name}</h3>
                          {team.team_code && (
                            <p className="text-sm text-muted-foreground">Team: {team.team_code}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <Badge variant="default" className="badge-executed">Rank #{team.rank}</Badge>
                          <p className="text-2xl font-bold mt-1">
                            ₹{team.total_value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </p>
                          <p className={`text-sm ${team.profit_loss >= 0 ? 'text-profit' : 'text-loss'}`}>
                            {team.profit_loss >= 0 ? '+' : ''}{team.profit_loss_percentage.toFixed(2)}%
                          </p>
                        </div>
                      </div>
                      
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <p className="text-sm text-muted-foreground">Cash Balance</p>
                          <p className="font-semibold">₹{team.cash_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">P&L</p>
                          <p className={`font-semibold ${team.profit_loss >= 0 ? 'text-profit' : 'text-loss'}`}>
                            ₹{team.profit_loss.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>

                      {team.positions.length > 0 && (
                        <div className="mt-4">
                          <p className="text-sm text-muted-foreground mb-2">Current Positions</p>
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {team.positions.map((position, posIndex) => (
                              <div key={posIndex} className="bg-muted/50 rounded p-2">
                                <div className="flex justify-between items-center">
                                  <span className="font-medium">{position.symbol}</span>
                                  <span className="text-sm text-muted-foreground">{position.quantity}</span>
                                </div>
                                <div className="flex justify-between items-center mt-1">
                                  <span className="text-xs text-muted-foreground">Value</span>
                                  <span className="text-xs font-medium">₹{position.current_value.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-xs text-muted-foreground">P&L</span>
                                  <span className={`text-xs font-medium ${position.profit_loss >= 0 ? 'text-profit' : 'text-loss'}`}>
                                    ₹{position.profit_loss.toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity">
            <div className="space-y-6">
              {/* Short Selling Toggle */}
              <Card className="card-enhanced border-primary/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-primary" />
                    Short Selling Control
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-2">
                    Enable or disable short selling for competition rounds
                  </p>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  {/* Master Toggle */}
                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <div>
                      <h3 className="font-semibold text-lg">Master Control</h3>
                      <p className="text-sm text-muted-foreground">
                        {shortSellingEnabled 
                          ? 'Short selling is currently enabled for some rounds' 
                          : 'Short selling is currently disabled for all rounds'
                        }
                      </p>
                    </div>
                    <Button
                      onClick={toggleShortSelling}
                      variant={shortSellingEnabled ? "destructive" : "default"}
                      className={`h-12 px-6 ${
                        shortSellingEnabled 
                          ? 'bg-red-600 hover:bg-red-700' 
                          : 'bg-green-600 hover:bg-green-700'
                      }`}
                    >
                      {shortSellingEnabled ? 'Disable All' : 'Enable All'}
                    </Button>
                  </div>

                  {/* Individual Round Controls */}
                  <div className="space-y-4">
                    <h4 className="font-semibold text-base">Round-Specific Controls</h4>
                    <div className="grid gap-4 md:grid-cols-3">
                      {[
                        { round: 'round_1' as const, name: 'Round 1', description: 'The Fundamentals Floor (20 mins)', enabledClass: 'border-red-500 bg-red-50', disabledClass: 'border-gray-200 bg-gray-50', buttonEnabledClass: 'border-red-500 text-red-600 hover:bg-red-50', buttonDisabledClass: 'bg-red-600 hover:bg-red-700 text-white' },
                        { round: 'round_2' as const, name: 'Round 2', description: 'The Fog of War (30 mins)', enabledClass: 'border-orange-500 bg-orange-50', disabledClass: 'border-gray-200 bg-gray-50', buttonEnabledClass: 'border-orange-500 text-orange-600 hover:bg-orange-50', buttonDisabledClass: 'bg-orange-600 hover:bg-orange-700 text-white' },
                        { round: 'round_3' as const, name: 'Round 3', description: 'The Macro Meltdown (30 mins)', enabledClass: 'border-purple-500 bg-purple-50', disabledClass: 'border-gray-200 bg-gray-50', buttonEnabledClass: 'border-purple-500 text-purple-600 hover:bg-purple-50', buttonDisabledClass: 'bg-purple-600 hover:bg-purple-700 text-white' }
                      ].map(({ round, name, description, enabledClass, disabledClass, buttonEnabledClass, buttonDisabledClass }) => (
                        <div key={round} className={`p-4 border-2 rounded-lg ${
                          shortSellingRounds[round] ? enabledClass : disabledClass
                        }`}>
                          <div className="flex items-center justify-between mb-2">
                            <h5 className={`font-semibold ${shortSellingRounds[round] ? 'text-gray-900' : 'text-gray-700'}`}>{name}</h5>
                            <Badge variant={shortSellingRounds[round] ? "default" : "secondary"}>
                              {shortSellingRounds[round] ? 'Enabled' : 'Disabled'}
                            </Badge>
                          </div>
                          <p className={`text-xs mb-3 ${shortSellingRounds[round] ? 'text-gray-700' : 'text-gray-600'}`}>{description}</p>
                          <Button
                            onClick={() => toggleRoundShortSelling(round)}
                            variant={shortSellingRounds[round] ? "outline" : "default"}
                            size="sm"
                            className={`w-full ${
                              shortSellingRounds[round] ? buttonEnabledClass : buttonDisabledClass
                            }`}
                          >
                            {shortSellingRounds[round] ? 'Disable' : 'Enable'}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Price Noise Controls */}
              <Card className="card-enhanced border-purple-500/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-purple-600" />
                    Price Noise Fluctuation
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-2">
                    Control automatic price fluctuations to simulate market volatility
                  </p>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-lg">Noise Fluctuation</h3>
                        <p className="text-sm text-muted-foreground">
                          {noiseStats && typeof noiseStats === 'object' && 'isRunning' in noiseStats && noiseStats.isRunning 
                            ? 'Price noise fluctuation is currently active'
                            : 'Price noise fluctuation is currently stopped'
                          }
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          onClick={startNoiseFluctuation}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          <Play className="h-4 w-4 mr-2" />
                          Start
                        </Button>
                        <Button 
                          onClick={stopNoiseFluctuation}
                          variant="destructive"
                        >
                          <Square className="h-4 w-4 mr-2" />
                          Stop
                        </Button>
                      </div>
                    </div>
                    
                    {noiseStats && typeof noiseStats === 'object' && (
                      <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                        <div>
                          <p className="text-sm text-muted-foreground">Status</p>
                          <p className="font-semibold">
                            {'isRunning' in noiseStats && noiseStats.isRunning ? 'Running' : 'Stopped'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Updates</p>
                          <p className="font-semibold">
                            {'updateCount' in noiseStats ? String((noiseStats as { updateCount: number | string }).updateCount) : 0}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Maintenance Mode Toggle */}
              <Card className="card-enhanced border-warning/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-warning" />
                    Maintenance Mode
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <MaintenanceModeToggle />
                </CardContent>
              </Card>

              <Card className="card-enhanced">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5 text-primary" />
                    Database Management
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid gap-6 md:grid-cols-3">
                    <Button 
                      onClick={initializeNifty50Assets}
                      className="h-24 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white"
                    >
                      <Database className="h-6 w-6" />
                      <div className="text-center">
                        <div className="font-semibold">Initialize NIFTY 50</div>
                        <div className="text-xs opacity-90 mt-1">Add all 50 stocks + commodities</div>
                      </div>
                    </Button>

                    <Button 
                      onClick={async () => {
                        try {
                          const { error } = await supabase.functions.invoke('fetch-yfinance-data');
                          if (error) throw error;
                          toast.success("Real-time prices updated from yFinance!");
                        } catch (error) {
                          toast.error("Failed to fetch yFinance data");
                        }
                      }}
                      className="h-24 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white"
                    >
                      <TrendingUp className="h-6 w-6" />
                      <div className="text-center">
                        <div className="font-semibold">Fetch Live Prices</div>
                        <div className="text-xs opacity-90 mt-1">Update from yFinance API</div>
                      </div>
                    </Button>

                    <Button 
                      onClick={checkMargins}
                      className="h-24 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white"
                    >
                      <Shield className="h-6 w-6" />
                      <div className="text-center">
                        <div className="font-semibold">Check Margins</div>
                        <div className="text-xs opacity-90 mt-1">Monitor short positions</div>
                      </div>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Competition Reset */}
              <Card className="card-enhanced border-red-500/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-600">
                    <AlertTriangle className="h-5 w-5" />
                    Competition Reset - All Users
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-2">
                    This will reset ALL users' portfolios, positions, and transactions. Use with caution!
                  </p>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-6">
                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-base font-semibold">Starting Cash Amount (₹)</Label>
                        <Input
                          type="number"
                          value={resetOptions.startingCash}
                          onChange={(e) => setResetOptions({...resetOptions, startingCash: parseInt(e.target.value) || 500000})}
                          placeholder="500000"
                          className="h-12 text-lg"
                        />
                        <p className="text-xs text-muted-foreground">
                          Default: ₹5,00,000 per participant
                        </p>
                      </div>
                      <div className="flex items-end">
                        <Button 
                          onClick={resetCompetition}
                          variant="destructive"
                          className="w-full h-16 text-lg font-semibold"
                        >
                          <RotateCcw className="h-5 w-5 mr-2" />
                          Reset All Competition Data
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="card-enhanced">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5 text-primary" />
                    User Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {users.map((user, index) => (
                      <div key={user.id} className="flex items-center justify-between p-3 border border-border rounded-lg hover:border-primary/50 transition-colors animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
                        <div>
                          <p className="font-medium">{user.full_name}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                          {user.team_code && (
                            <p className="text-xs text-muted-foreground">Team: {user.team_code}</p>
                          )}
                        </div>
                        <Badge variant="default" className="badge-executed">Active</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Admin;
