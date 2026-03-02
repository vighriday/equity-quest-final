import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import CollapsibleMarketOverview from "@/components/CollapsibleMarketOverview";
import MarketSearch from "@/components/MarketSearch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown, Wallet, PieChart, AlertCircle, ArrowUpRight, ArrowDownRight, Activity, Clock, Shield, Newspaper, BarChart3, DollarSign, Percent, ShoppingCart } from "lucide-react";
import { AnimatedCounter } from "@/components/AnimatedCounter";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";
import { orderExecutionEngine } from "@/services/orderExecution";
import { STARTING_CAPITAL } from "@/lib/constants";
import MarginWarningSystem from "@/components/MarginWarningSystem";
import TradingHaltBanner from "@/components/TradingHaltBanner";
import TradingQueue from "@/components/TradingQueue";
import { globalServiceManager } from "@/services/globalServiceManager";

interface Asset {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  previous_close: number;
  asset_type: 'stock' | 'commodity' | 'index';
  sector: string | null;
}

interface Portfolio {
  cash_balance: number;
  total_value: number;
  profit_loss: number;
  profit_loss_percentage: number;
}

interface Position {
  id: string;
  quantity: number;
  average_price: number;
  current_value: number;
  profit_loss: number;
  is_short: boolean;
  assets: Asset;
}

interface NewsItem {
  id: string;
  title: string;
  content: string;
  category: string | null;
  created_at: string;
}

const Dashboard = () => {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<string>("");
  const [quantity, setQuantity] = useState("");
  const [orderType, setOrderType] = useState("market");
  const [limitPrice, setLimitPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [priceChanges, setPriceChanges] = useState<Record<string, 'up' | 'down' | null>>({});
  const [competitionStatus, setCompetitionStatus] = useState<string>("not_started");
  const [isShortSell, setIsShortSell] = useState(false);
  const [session, setSession] = useState<{ user: { id: string } } | null>(null);

  // Real-time calculated portfolio values
  const [calculatedPortfolio, setCalculatedPortfolio] = useState<Portfolio | null>(null);

  // Timer ref for batched price change animation clearing
  const priceChangeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Rate limiting ref for order placement
  const lastOrderTimeRef = useRef<number>(0);

  const fetchCompetitionStatus = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("competition_rounds")
        .select("status")
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      
      if (data) {
        setCompetitionStatus(data.status);
      }
    } catch (error) {
      console.error("Error fetching competition status:", error);
    }
  }, []);

  const fetchPortfolio = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data, error } = await supabase
      .from("portfolios")
      .select("*")
      .eq("user_id", session.user.id)
      .single();

    if (error) {
      console.error("Error fetching portfolio:", error);
      return;
    }

    setPortfolio(data);
  }, []);

  const fetchPositions = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data, error } = await supabase
      .from("positions")
      .select("*, assets(*)")
      .eq("user_id", session.user.id)
      .gt("quantity", 0);

    if (error) {
      console.error("Error fetching positions:", error);
      return;
    }

    setPositions(data || []);
  }, []);

  const fetchAssets = useCallback(async () => {
    const { data, error } = await supabase
      .from("assets")
      .select("*")
      .eq("is_active", true)
      .order("symbol");

    if (error) {
      console.error("Error fetching assets:", error);
      return;
    }

    // Track price changes for animations using Map for O(1) lookups
    if (data) {
      setAssets(prevAssets => {
        const prevMap = new Map(prevAssets.map(a => [a.id, a]));
        const newPriceChanges: Record<string, 'up' | 'down' | null> = {};
        data.forEach(asset => {
          const prev = prevMap.get(asset.id);
          if (prev && prev.current_price !== asset.current_price) {
            newPriceChanges[asset.id] = asset.current_price > prev.current_price ? 'up' : 'down';
          }
        });
        setPriceChanges(prev => ({ ...prev, ...newPriceChanges }));
        // Single batched timer to clear all animations
        if (priceChangeTimerRef.current) clearTimeout(priceChangeTimerRef.current);
        priceChangeTimerRef.current = setTimeout(() => {
          setPriceChanges({});
        }, 1000);
        return data;
      });
    }
  }, []);

  const fetchNews = useCallback(async () => {
    const { data, error } = await supabase
      .from("news")
      .select("*")
      .eq("is_public", true)
      .order("created_at", { ascending: false })
      .limit(5);

    if (error) {
      console.error("Error fetching news:", error);
      return;
    }

    setNews(data || []);
  }, []);

  // Calculate real-time portfolio values based on current asset prices
  // This ensures P&L updates immediately when asset prices change
  const calculateRealTimePortfolio = useCallback(() => {
    if (!portfolio) return;

    let totalLongValue = 0;  // Value of long positions
    let totalShortValue = 0; // Value of short positions (liability)
    let updatedPositions = positions;
    
    // Only process positions if they exist and assets are available
    if (positions.length > 0 && assets.length > 0) {
      updatedPositions = positions.map(position => {
        // Find current asset price from the assets array
        const currentAsset = assets.find(asset => asset.id === position.assets.id);
        const currentPrice = currentAsset ? currentAsset.current_price : position.assets.current_price;
      
        let positionValue: number;
        let profitLoss: number;

        if (position.is_short) {
          // For short positions:
          // - We received cash when we sold: quantity * average_price (already in cash balance)
          // - We owe shares worth: quantity * current_price (this is a liability)
          // - P&L = (average_price - current_price) * quantity (profit when price goes down)
          positionValue = position.quantity * currentPrice; // Current value of what we owe
          profitLoss = position.quantity * (position.average_price - currentPrice);
          totalShortValue += positionValue; // Add to liability
        } else {
          // For long positions:
          // - We own shares worth: quantity * current_price
          // - P&L = (current_price - average_price) * quantity (profit when price goes up)
          positionValue = position.quantity * currentPrice; // Current value of what we own
          profitLoss = position.quantity * (currentPrice - position.average_price);
          totalLongValue += positionValue; // Add to assets
        }

        return {
          ...position,
          current_value: positionValue,
          profit_loss: profitLoss,
          assets: {
            ...position.assets,
            current_price: currentPrice
          }
        };
      });
    }

    // Calculate total portfolio value: Cash + Long Assets - Short Liabilities
    const totalPortfolioValue = portfolio.cash_balance + totalLongValue - totalShortValue;

    const profitLoss = totalPortfolioValue - STARTING_CAPITAL;
    const profitLossPercentage = STARTING_CAPITAL > 0 ? (profitLoss / STARTING_CAPITAL) * 100 : 0;

    setCalculatedPortfolio({
      ...portfolio,
      total_value: totalPortfolioValue,
      profit_loss: profitLoss,
      profit_loss_percentage: profitLossPercentage
    });

    // Update positions with real-time values only if we processed them
    if (positions.length > 0 && assets.length > 0) {
      setPositions(updatedPositions);
    }
  }, [portfolio, positions, assets]);

  const fetchData = useCallback(async () => {
    await Promise.all([fetchPortfolio(), fetchPositions(), fetchAssets(), fetchNews(), fetchCompetitionStatus()]);
  }, [fetchPortfolio, fetchPositions, fetchAssets, fetchNews, fetchCompetitionStatus]);

  useEffect(() => {
    // Get session first
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
    };

    // Initialize global services
    const initializeGlobalServices = async () => {
      try {
        await globalServiceManager.initialize();
      } catch (error) {
        console.error('Error initializing global services:', error);
      }
    };

    getSession();
    initializeGlobalServices();
    fetchData();

    const assetsChannel = supabase
      .channel('assets-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assets' }, () => {
        fetchAssets();
      })
      .subscribe();

    const newsChannel = supabase
      .channel('news-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'news' }, () => {
        fetchNews();
      })
      .subscribe();

    const portfolioChannel = supabase
      .channel('portfolio-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'portfolios' }, () => {
        fetchPortfolio();
      })
      .subscribe();

    const competitionChannel = supabase
      .channel('competition-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'competition_rounds' }, () => {
        fetchCompetitionStatus();
      })
      .subscribe();

    // Listen for live price updates from the noise service
    const handleAssetPriceUpdate = (event: CustomEvent) => {
      const { assetId, newPrice } = event.detail;

      // Update the assets array with the new price
      setAssets(prevAssets => 
        prevAssets.map(asset => 
          asset.id === assetId 
            ? { ...asset, current_price: newPrice }
            : asset
        )
      );
    };

    window.addEventListener('assetPriceUpdate', handleAssetPriceUpdate as EventListener);

    return () => {
      supabase.removeChannel(assetsChannel);
      supabase.removeChannel(newsChannel);
      supabase.removeChannel(portfolioChannel);
      supabase.removeChannel(competitionChannel);
      window.removeEventListener('assetPriceUpdate', handleAssetPriceUpdate as EventListener);
      if (priceChangeTimerRef.current) clearTimeout(priceChangeTimerRef.current);
    };
  }, [fetchData, fetchAssets, fetchNews, fetchPortfolio, fetchCompetitionStatus]);

  // Recalculate portfolio values whenever assets, positions, or portfolio data changes
  useEffect(() => {
    calculateRealTimePortfolio();
  }, [calculateRealTimePortfolio]);

  // Add a function to recalculate all portfolios (for fixing existing data)
  const recalculateAllPortfolios = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      // Get all positions for the user
      const { data: userPositions } = await supabase
        .from('positions')
        .select('*, assets(*)')
        .eq('user_id', session.user.id);

      if (!userPositions || userPositions.length === 0) return;

      let totalLongValue = 0;
      let totalShortValue = 0;

      // Recalculate each position
      for (const position of userPositions) {
        const currentPrice = position.assets?.current_price || 0;
        let positionValue: number;
        let profitLoss: number;

        if (position.is_short) {
          positionValue = position.quantity * currentPrice;
          profitLoss = position.quantity * (position.average_price - currentPrice);
          totalShortValue += positionValue;
        } else {
          positionValue = position.quantity * currentPrice;
          profitLoss = position.quantity * (currentPrice - position.average_price);
          totalLongValue += positionValue;
        }

        // Update position in database
        await supabase
          .from('positions')
          .update({
            current_value: positionValue,
            profit_loss: profitLoss,
            updated_at: new Date().toISOString()
          })
          .eq('id', position.id);
      }

      // Update portfolio
      const { data: currentPortfolio } = await supabase
        .from('portfolios')
        .select('cash_balance')
        .eq('user_id', session.user.id)
        .single();

      if (currentPortfolio) {
        const totalPortfolioValue = currentPortfolio.cash_balance + totalLongValue - totalShortValue;
        const profitLoss = totalPortfolioValue - STARTING_CAPITAL;
        const profitLossPercentage = STARTING_CAPITAL > 0 ? (profitLoss / STARTING_CAPITAL) * 100 : 0;

        await supabase
          .from('portfolios')
          .update({
            total_value: totalPortfolioValue,
            profit_loss: profitLoss,
            profit_loss_percentage: profitLossPercentage,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', session.user.id);
      }

      // Portfolio recalculated
    } catch (error) {
      console.error('Error recalculating portfolio:', error);
    }
  }, []);

  // Recalculate portfolio on component mount to fix existing data
  useEffect(() => {
    recalculateAllPortfolios();
  }, [recalculateAllPortfolios]);


  const handlePlaceOrder = async (isBuy: boolean) => {
    const now = Date.now();
    if (now - lastOrderTimeRef.current < 2000) {
      toast.error("Please wait 2 seconds between orders");
      return;
    }
    lastOrderTimeRef.current = now;

    if (!selectedAsset || !quantity) {
      toast.error("Please select an asset and enter quantity");
      return;
    }

    // Additional validation
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      toast.error("Please enter a valid quantity");
      return;
    }

    if (!Number.isInteger(qty) || qty < 1) {
      toast.error("Quantity must be a whole number (minimum 1)");
      return;
    }

    if (orderType === "limit" && (!limitPrice || parseFloat(limitPrice) <= 0)) {
      toast.error("Please enter a valid limit price");
      return;
    }

    if (orderType === "stop_loss" && (!limitPrice || parseFloat(limitPrice) <= 0)) {
      toast.error("Please enter a valid stop price");
      return;
    }

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // Check competition status first
      if (competitionStatus !== "active") {
        toast.error(`Trading is not available. Competition status: ${competitionStatus}`);
        return;
      }

      const asset = assets.find(a => a.id === selectedAsset);
      if (!asset) throw new Error("Asset not found");

      const price = orderType === "limit" && limitPrice ? parseFloat(limitPrice) : null;
      const stopPrice = orderType === "stop_loss" && limitPrice ? parseFloat(limitPrice) : null;

      // First, create order in pending status
      let orderData: { id: string } | null = null;

      // Only add is_short_sell if the column exists
      try {
        const { data: orderDataResult, error: orderError } = await supabase
          .from("orders")
          .insert([{
            user_id: session.user.id,
            asset_id: selectedAsset,
            order_type: orderType as "market" | "limit" | "stop_loss",
            quantity: qty,
            price: price,
            stop_price: stopPrice,
            is_buy: isBuy,
            is_short_sell: isShortSell,
            status: "pending" as const,
          }])
          .select()
          .single();
        
        if (orderError) {
          // If is_short_sell column doesn't exist, try without it
          if (orderError.message.includes('is_short_sell')) {
            console.warn('is_short_sell column not found, creating order without it');
            const { data: orderDataResult2, error: orderError2 } = await supabase
              .from("orders")
              .insert([{
                user_id: session.user.id,
                asset_id: selectedAsset,
                order_type: orderType as "market" | "limit" | "stop_loss",
                quantity: qty,
                price: price,
                stop_price: stopPrice,
                is_buy: isBuy,
                status: "pending" as const,
              }])
              .select()
              .single();
            
            if (orderError2) {
              throw orderError2;
            }
            orderData = orderDataResult2;
          } else {
            throw orderError;
          }
        } else {
          orderData = orderDataResult;
        }
      } catch (error) {
        console.error('Error creating order record:', error);
        console.error('Order details:', {
          user_id: session.user.id,
          asset_id: selectedAsset,
          order_type: orderType,
          quantity: qty,
          price: price,
          stop_price: stopPrice,
          is_buy: isBuy,
          is_short_sell: isShortSell
        });
        toast.error(`Failed to create order: ${error instanceof Error ? error.message : 'Database error'}`);
        return;
      }

      // Update order status to processing
      await supabase
        .from("orders")
        .update({ status: "processing" })
        .eq("id", orderData.id);

      toast.success(`Order placed! Processing ${isBuy ? "buy" : "sell"} order...`);

      // Execute order using the order execution engine
      let result;
      try {
        // Add timeout to prevent hanging
        const executionPromise = orderExecutionEngine.executeOrder(
          session.user.id,
          selectedAsset,
          orderType as "market" | "limit" | "stop_loss",
          qty,
          price,
          stopPrice,
          isBuy,
          isShortSell
        );
        
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Order execution timeout')), 30000)
        );
        
        result = await Promise.race([executionPromise, timeoutPromise]);
      } catch (executionError) {
        console.error('Order execution threw an error:', executionError);
        result = {
          success: false,
          message: `Order execution failed: ${executionError instanceof Error ? executionError.message : 'Unknown error'}`
        };
      }

      if (result.success) {
        // Update order status to executed
        await supabase
          .from("orders")
          .update({
            status: "executed",
            executed_price: result.executedPrice,
            executed_at: result.executedAt,
          })
          .eq("id", orderData.id);

        toast.success(`${isBuy ? "Buy" : "Sell"} order executed successfully!`);
        setQuantity("");
        setLimitPrice("");
        setIsShortSell(false);
        fetchData();
      } else {
        // Update order status to failed
        await supabase
          .from("orders")
          .update({
            status: "failed",
            error_message: result.message,
          })
          .eq("id", orderData.id);

        toast.error(`Order failed: ${result.message}`);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to place order";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getPriceChange = (current: number, previous: number | null) => {
    if (!previous) return 0;
    return ((current - previous) / previous) * 100;
  };

  const activePortfolio = calculatedPortfolio || portfolio;
  const selectedAssetData = assets.find(a => a.id === selectedAsset);
  const estimatedCost = selectedAssetData && quantity ? selectedAssetData.current_price * parseInt(quantity || "0", 10) : 0;
  const transactionFee = estimatedCost * 0.001; // 0.1% fee estimate

  const getRelativeTime = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <TradingHaltBanner />

        {/* Portfolio Header - Full Width Glass Card with Stats */}
        <div className="glass-card stat-card p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-2xl font-bold text-gradient-primary flex items-center gap-2.5">
                <Activity className="h-7 w-7 text-primary" />
                Trading Dashboard
              </h1>
              <p className="text-sm text-muted-foreground mt-1">Real-time portfolio overview</p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Live</span>
              <div className="h-2 w-2 rounded-full bg-profit pulse-live"></div>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Value */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/20 border border-border/30">
              <div className="rounded-lg p-2 bg-primary/10">
                <PieChart className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Value</p>
                <div className="text-xl font-bold mt-0.5">
                  <AnimatedCounter value={activePortfolio?.total_value ?? 0} prefix="₹" decimals={2} />
                </div>
              </div>
            </div>

            {/* Cash Balance */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/20 border border-border/30">
              <div className="rounded-lg p-2 bg-primary/10">
                <Wallet className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Cash Balance</p>
                <div className="text-xl font-bold mt-0.5">
                  <AnimatedCounter value={activePortfolio?.cash_balance ?? 0} prefix="₹" decimals={2} />
                </div>
              </div>
            </div>

            {/* P&L */}
            <div className={`flex items-start gap-3 p-3 rounded-lg border border-border/30 ${activePortfolio && activePortfolio.profit_loss >= 0 ? 'bg-profit/5' : 'bg-loss/5'}`}>
              <div className={`rounded-lg p-2 ${activePortfolio && activePortfolio.profit_loss >= 0 ? 'bg-profit/10' : 'bg-loss/10'}`}>
                {activePortfolio && activePortfolio.profit_loss >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-profit" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-loss" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  Profit / Loss
                  {calculatedPortfolio && <span className="h-1.5 w-1.5 rounded-full bg-profit inline-block pulse-live"></span>}
                </p>
                <div className={`text-xl font-bold mt-0.5 ${activePortfolio && activePortfolio.profit_loss >= 0 ? 'text-profit' : 'text-loss'}`}>
                  <AnimatedCounter value={activePortfolio?.profit_loss ?? 0} prefix="₹" decimals={2} />
                </div>
              </div>
            </div>

            {/* Return % */}
            <div className={`flex items-start gap-3 p-3 rounded-lg border border-border/30 ${activePortfolio && activePortfolio.profit_loss_percentage >= 0 ? 'bg-profit/5' : 'bg-loss/5'}`}>
              <div className={`rounded-lg p-2 ${activePortfolio && activePortfolio.profit_loss_percentage >= 0 ? 'bg-profit/10' : 'bg-loss/10'}`}>
                {activePortfolio && activePortfolio.profit_loss_percentage >= 0 ? (
                  <ArrowUpRight className="h-4 w-4 text-profit" />
                ) : (
                  <ArrowDownRight className="h-4 w-4 text-loss" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  Return %
                  {calculatedPortfolio && <span className="h-1.5 w-1.5 rounded-full bg-profit inline-block pulse-live"></span>}
                </p>
                <div className={`text-xl font-bold mt-0.5 ${activePortfolio && activePortfolio.profit_loss_percentage >= 0 ? 'text-profit' : 'text-loss'}`}>
                  <AnimatedCounter value={activePortfolio?.profit_loss_percentage ?? 0} suffix="%" decimals={2} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Competition Status Banner */}
        {competitionStatus !== "active" && (
          <div className="glass-card p-4">
            <div className="flex items-center gap-3">
              <div className={`rounded-full p-2 ${competitionStatus === "not_started" ? "bg-loss/10" : "bg-warning/10"}`}>
                <AlertCircle className={`h-5 w-5 ${competitionStatus === "not_started" ? "text-loss" : "text-warning"}`} />
              </div>
              <div>
                <h3 className="font-semibold text-sm">
                  Competition {competitionStatus === "not_started" ? "Not Started" :
                              competitionStatus === "paused" ? "Paused" :
                              competitionStatus === "completed" ? "Completed" : "Inactive"}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {competitionStatus === "not_started" ? "The competition has not been started yet. Please wait for the admin to begin." :
                   competitionStatus === "paused" ? "The competition is currently paused. Trading is disabled." :
                   competitionStatus === "completed" ? "The competition has ended. Thank you for participating!" :
                   "Trading is currently disabled."}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Market Search */}
        <MarketSearch assets={assets} />

        {/* Collapsible Market Overview */}
        <CollapsibleMarketOverview
          assets={assets}
          priceChanges={priceChanges}
          competitionStatus={competitionStatus}
        />

        {/* Main Grid: Trading Panel (2 cols) + News (1 col) */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Trading Panel */}
          <div className="lg:col-span-2 glass-card p-0 overflow-hidden">
            <div className="p-5 border-b border-border/30">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-primary" />
                <span className="text-gradient-primary">Place Order</span>
              </h2>
            </div>
            <div className="p-5 space-y-5">
              {/* Asset Selector */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Select Asset</Label>
                <Select value={selectedAsset} onValueChange={setSelectedAsset}>
                  <SelectTrigger className="input-enhanced h-11">
                    <SelectValue placeholder="Choose an asset to trade" />
                  </SelectTrigger>
                  <SelectContent>
                    {assets.map((asset) => (
                      <SelectItem key={asset.id} value={asset.id}>
                        <span className="font-medium">{asset.symbol}</span>
                        <span className="text-muted-foreground ml-2">- ₹{asset.current_price.toFixed(2)}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Order Type Button Group */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Order Type</Label>
                <div className="flex gap-1 p-1 bg-muted/40 rounded-lg border border-border/30">
                  {[
                    { value: "market", label: "Market" },
                    { value: "limit", label: "Limit" },
                    { value: "stop_loss", label: "Stop Loss" },
                  ].map((type) => (
                    <button
                      key={type.value}
                      onClick={() => setOrderType(type.value)}
                      className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                        orderType === type.value
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quantity */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Quantity</Label>
                <Input
                  type="number"
                  placeholder="Enter quantity"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  min="1"
                  step="1"
                  className="input-enhanced h-11"
                />
              </div>

              {/* Short Sell Toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/30">
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    id="shortSell"
                    checked={isShortSell}
                    onChange={(e) => setIsShortSell(e.target.checked)}
                    className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                  />
                  <Label htmlFor="shortSell" className="text-sm font-medium cursor-pointer">
                    Short Sell
                  </Label>
                </div>
                {isShortSell && (
                  <Badge variant="destructive" className="text-xs">
                    25% Margin Required
                  </Badge>
                )}
              </div>

              {/* Limit / Stop Price (conditional) */}
              {(orderType === "limit" || orderType === "stop_loss") && (
                <div className="space-y-2 animate-fade-in">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {orderType === "limit" ? "Limit Price" : "Stop Price"}
                  </Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={limitPrice}
                    onChange={(e) => setLimitPrice(e.target.value)}
                    min="0"
                    step="0.01"
                    className="input-enhanced h-11"
                  />
                </div>
              )}

              {/* Order Preview */}
              {selectedAssetData && quantity && parseInt(quantity) > 0 && (
                <div className="rounded-lg border border-border/30 bg-muted/10 p-4 space-y-2.5 animate-fade-in">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Order Preview</h4>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Asset Price</span>
                    <span className="font-medium">₹{selectedAssetData.current_price.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Estimated Cost</span>
                    <span className="font-medium">₹{estimatedCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Transaction Fee (est.)</span>
                    <span className="font-medium text-muted-foreground">₹{transactionFee.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="border-t border-border/30 pt-2 mt-2 flex justify-between text-sm">
                    <span className="font-semibold">Total (est.)</span>
                    <span className="font-bold">₹{(estimatedCost + transactionFee).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              )}

              {/* Buy / Sell Buttons */}
              <div className="flex gap-3 pt-1">
                <Button
                  className="flex-1 btn-buy h-11 text-base"
                  onClick={() => handlePlaceOrder(true)}
                  disabled={loading || competitionStatus !== "active"}
                >
                  {loading ? "Processing..." : "Buy"}
                </Button>
                <Button
                  className="flex-1 btn-sell h-11 text-base"
                  onClick={() => handlePlaceOrder(false)}
                  disabled={loading || competitionStatus !== "active"}
                >
                  {loading ? "Processing..." : "Sell"}
                </Button>
              </div>
            </div>
          </div>

          {/* News Feed */}
          <div className="glass-card p-0 overflow-hidden">
            <div className="p-5 border-b border-border/30">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Newspaper className="h-5 w-5 text-primary" />
                <span className="text-gradient-primary">Market News</span>
              </h2>
            </div>
            <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
              {news.length === 0 ? (
                <EmptyState
                  icon={Newspaper}
                  title="No News Yet"
                  description="Market news and updates will appear here when available."
                />
              ) : (
                news.map((item, index) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-lg bg-muted/15 border border-border/20 hover:border-primary/20 transition-all duration-200 animate-fade-in"
                    style={{ animationDelay: `${index * 0.08}s` }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <h4 className="font-medium text-sm leading-snug">{item.title}</h4>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap mt-0.5">
                        {getRelativeTime(item.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{item.content}</p>
                    {item.category && (
                      <Badge variant="secondary" className="mt-2 text-[10px] px-2 py-0">
                        {item.category}
                      </Badge>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Trading Queue */}
        {session?.user?.id && <TradingQueue userId={session.user.id} />}

        {/* Positions, Orders & Margin Tabs */}
        <Tabs defaultValue="positions" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 glass-card h-11">
            <TabsTrigger value="positions" className="text-sm">Positions</TabsTrigger>
            <TabsTrigger value="orders" className="text-sm">Recent Orders</TabsTrigger>
            <TabsTrigger value="margin" className="text-sm">Margin Status</TabsTrigger>
          </TabsList>

          <TabsContent value="positions">
            <div className="glass-card p-0 overflow-hidden">
              <div className="p-5 border-b border-border/30">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  <span className="text-gradient-primary">Your Positions</span>
                </h2>
              </div>
              <div className="p-0">
                {positions.length === 0 ? (
                  <EmptyState
                    icon={PieChart}
                    title="No Positions"
                    description="You don't have any open positions yet. Start trading to see them here."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full table-premium">
                      <thead>
                        <tr>
                          <th className="text-left">Symbol</th>
                          <th className="text-right">Qty</th>
                          <th className="text-right">Avg Price</th>
                          <th className="text-right">Current</th>
                          <th className="text-center">Type</th>
                          <th className="text-right">P&L</th>
                          <th className="text-right">P&L %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {positions.map((position) => {
                          const plPercent = position.average_price > 0
                            ? ((position.profit_loss / (position.average_price * position.quantity)) * 100)
                            : 0;
                          return (
                            <tr key={position.id}>
                              <td>
                                <div>
                                  <p className="font-semibold text-foreground">{position.assets.symbol}</p>
                                  <p className="text-xs text-muted-foreground">{position.assets.name}</p>
                                </div>
                              </td>
                              <td className="text-right font-medium tabular-nums">
                                {position.is_short ? '-' : ''}{position.quantity}
                              </td>
                              <td className="text-right tabular-nums">₹{position.average_price.toFixed(2)}</td>
                              <td className="text-right tabular-nums">₹{position.assets.current_price.toFixed(2)}</td>
                              <td className="text-center">
                                <Badge variant={position.is_short ? "destructive" : "default"} className="text-[10px] px-2">
                                  {position.is_short ? "SHORT" : "LONG"}
                                </Badge>
                              </td>
                              <td className={`text-right font-semibold tabular-nums ${position.profit_loss > 0 ? 'text-profit' : position.profit_loss < 0 ? 'text-loss' : 'text-muted-foreground'}`}>
                                ₹{position.profit_loss.toFixed(2)}
                              </td>
                              <td className={`text-right font-medium tabular-nums ${plPercent > 0 ? 'text-profit' : plPercent < 0 ? 'text-loss' : 'text-muted-foreground'}`}>
                                {plPercent >= 0 ? '+' : ''}{plPercent.toFixed(2)}%
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="orders">
            <div className="glass-card p-0 overflow-hidden">
              <div className="p-5 border-b border-border/30">
                <h2 className="text-lg font-semibold">Recent Trade Executions</h2>
              </div>
              <div className="p-5">
                <p className="text-sm text-muted-foreground text-center py-8">
                  View your complete order history in the{" "}
                  <a href="/history" className="text-primary hover:underline font-medium">Transaction History</a> page
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="margin">
            <MarginWarningSystem />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
