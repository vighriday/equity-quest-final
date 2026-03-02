import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import StockDetailView from "@/components/StockDetailView";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  TrendingDown,
  ArrowLeft,
  Search,
  Activity,
  BarChart3,
  RefreshCw,
  Layers,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/useDebounce";
import { priceUpdateService, PriceUpdateEvent } from "@/services/priceUpdateService";
import { globalServiceManager } from "@/services/globalServiceManager";

interface Asset {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  previous_close: number;
  sector: string;
  asset_type: "stock" | "commodity" | "index";
  week_52_high?: number;
  week_52_low?: number;
  market_cap?: number;
  pe_ratio?: number;
}

/* ------------------------------------------------------------------ */
/*  Skeleton Card                                                      */
/* ------------------------------------------------------------------ */
const SkeletonCard = () => (
  <div className="glass-card rounded-xl p-5 animate-pulse">
    <div className="flex items-center justify-between mb-4">
      <div className="h-5 w-16 bg-muted/60 rounded" />
      <div className="h-5 w-20 bg-muted/40 rounded-full" />
    </div>
    <div className="h-4 w-32 bg-muted/40 rounded mb-3" />
    <div className="flex items-center justify-between">
      <div className="h-6 w-24 bg-muted/50 rounded" />
      <div className="h-5 w-16 bg-muted/40 rounded" />
    </div>
  </div>
);

/* ------------------------------------------------------------------ */
/*  MarketAnalysis Page                                                */
/* ------------------------------------------------------------------ */
const MarketAnalysis = () => {
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [activeSector, setActiveSector] = useState("All");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [marketStats, setMarketStats] = useState({
    totalValue: 0,
    totalChange: 0,
    activeStocks: 0,
    topGainers: [] as Asset[],
    topLosers: [] as Asset[],
  });
  const [priceUpdateSubscription, setPriceUpdateSubscription] = useState<string | null>(null);

  /* ---------- initialisation ---------- */
  useEffect(() => {
    const initializeGlobalServices = async () => {
      try {
        await globalServiceManager.initialize();
      } catch (error) {
        console.error("Error initializing global services:", error);
      }
    };

    initializeGlobalServices();
    fetchAssets();
    initializePriceUpdates();

    const handleAssetPriceUpdate = (event: CustomEvent) => {
      const { assetId, newPrice } = event.detail;
      setAssets((prev) =>
        prev.map((a) => (a.id === assetId ? { ...a, current_price: newPrice } : a))
      );
    };

    window.addEventListener("assetPriceUpdate", handleAssetPriceUpdate as EventListener);

    return () => {
      if (priceUpdateSubscription) {
        priceUpdateService.unsubscribe(priceUpdateSubscription);
      }
      window.removeEventListener("assetPriceUpdate", handleAssetPriceUpdate as EventListener);
    };
  }, []);

  /* ---------- visibility refresh ---------- */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchAssets();
        if (!priceUpdateSubscription) {
          initializePriceUpdates();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [priceUpdateSubscription]);

  /* ---------- data fetching ---------- */
  const fetchAssets = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("assets")
        .select("*")
        .eq("is_active", true)
        .order("symbol");

      if (error) throw error;

      setAssets(data || []);
      calculateMarketStats(data || []);
    } catch (error) {
      console.error("Error fetching assets:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateMarketStats = (assetsData: Asset[]) => {
    const totalValue = assetsData.reduce((sum, a) => sum + a.current_price, 0);
    const totalChange =
      assetsData.reduce((sum, a) => {
        return sum + ((a.current_price - a.previous_close) / a.previous_close) * 100;
      }, 0) / (assetsData.length || 1);

    const sortedByChange = [...assetsData].sort((a, b) => {
      const cA = ((a.current_price - a.previous_close) / a.previous_close) * 100;
      const cB = ((b.current_price - b.previous_close) / b.previous_close) * 100;
      return cB - cA;
    });

    setMarketStats({
      totalValue,
      totalChange,
      activeStocks: assetsData.length,
      topGainers: sortedByChange.slice(0, 5),
      topLosers: sortedByChange.slice(-5).reverse(),
    });
  };

  /* ---------- realtime price updates ---------- */
  const initializePriceUpdates = useCallback(async () => {
    try {
      if (priceUpdateSubscription) {
        priceUpdateService.unsubscribe(priceUpdateSubscription);
        setPriceUpdateSubscription(null);
      }

      await priceUpdateService.initialize();

      const subscriptionId = priceUpdateService.subscribe((update: PriceUpdateEvent) => {
        setAssets((prev) => {
          const updated = prev.map((a) =>
            a.id === update.assetId ? { ...a, current_price: update.newPrice } : a
          );
          calculateMarketStats(updated);
          return updated;
        });

        if (selectedAsset && selectedAsset.id === update.assetId) {
          setSelectedAsset((prev) =>
            prev ? { ...prev, current_price: update.newPrice } : null
          );
        }
      });

      setPriceUpdateSubscription(subscriptionId);
    } catch (error) {
      console.error("Error initializing price updates:", error);
    }
  }, [selectedAsset, priceUpdateSubscription]);

  /* ---------- helpers ---------- */
  const formatPrice = (price: number, assetType?: string) => {
    if (assetType === "commodity") {
      return `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `₹${price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const changePercent = (a: Asset) =>
    ((a.current_price - a.previous_close) / a.previous_close) * 100;

  /* ---------- derived data ---------- */
  const sectors = useMemo(() => {
    const set = new Set(assets.map((a) => a.sector).filter(Boolean));
    return ["All", ...Array.from(set).sort()];
  }, [assets]);

  const filteredAssets = useMemo(() => {
    let list = assets;
    if (activeSector !== "All") {
      list = list.filter((a) => a.sector === activeSector);
    }
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter(
        (a) =>
          a.symbol.toLowerCase().includes(q) ||
          a.name.toLowerCase().includes(q)
      );
    }
    return list;
  }, [assets, activeSector, debouncedSearch]);

  /* ---------- top gainer / loser for stat cards ---------- */
  const topGainer = marketStats.topGainers[0];
  const topLoser = marketStats.topLosers[0];

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */
  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* ---- Header ---- */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gradient-primary tracking-tight">
              Market Analysis
            </h1>
            <p className="text-muted-foreground mt-1">
              Explore sectors, search assets, and dive into detailed stock metrics.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!priceUpdateSubscription && (
              <Button variant="outline" size="sm" onClick={initializePriceUpdates}>
                <RefreshCw className="h-4 w-4 mr-1.5" />
                Reconnect
              </Button>
            )}
            {selectedAsset && (
              <Button variant="outline" size="sm" onClick={() => setSelectedAsset(null)}>
                <ArrowLeft className="h-4 w-4 mr-1.5" />
                Back to Market
              </Button>
            )}
          </div>
        </div>

        {/* ---- Detail View ---- */}
        {selectedAsset ? (
          <div className="max-w-6xl mx-auto">
            <StockDetailView asset={selectedAsset} />
          </div>
        ) : (
          <>
            {/* ---- Stat Cards ---- */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Active Stocks */}
              <div className="stat-card rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="h-4 w-4 text-primary" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Active Stocks
                  </span>
                </div>
                <p className="text-2xl font-bold">{marketStats.activeStocks}</p>
              </div>

              {/* Avg Change */}
              <div className="stat-card rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Avg Change %
                  </span>
                </div>
                <p
                  className={`text-2xl font-bold ${
                    marketStats.totalChange >= 0 ? "text-[hsl(var(--profit))]" : "text-[hsl(var(--loss))]"
                  }`}
                >
                  {marketStats.totalChange >= 0 ? "+" : ""}
                  {marketStats.totalChange.toFixed(2)}%
                </p>
              </div>

              {/* Top Gainer */}
              <div className="stat-card rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-[hsl(var(--profit))]" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Top Gainer
                  </span>
                </div>
                {topGainer ? (
                  <>
                    <p className="text-lg font-bold truncate">{topGainer.symbol}</p>
                    <p className="text-sm text-[hsl(var(--profit))] font-medium">
                      +{changePercent(topGainer).toFixed(2)}%
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">--</p>
                )}
              </div>

              {/* Top Loser */}
              <div className="stat-card rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="h-4 w-4 text-[hsl(var(--loss))]" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Top Loser
                  </span>
                </div>
                {topLoser ? (
                  <>
                    <p className="text-lg font-bold truncate">{topLoser.symbol}</p>
                    <p className="text-sm text-[hsl(var(--loss))] font-medium">
                      {changePercent(topLoser).toFixed(2)}%
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">--</p>
                )}
              </div>
            </div>

            {/* ---- Sector Pills + Search ---- */}
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Sector scroll */}
              <div className="flex-1 overflow-x-auto pb-1">
                <div className="flex items-center gap-2 min-w-max">
                  <Layers className="h-4 w-4 text-muted-foreground shrink-0" />
                  {sectors.map((sector) => (
                    <button
                      key={sector}
                      onClick={() => setActiveSector(sector)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 border ${
                        activeSector === sector
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-muted/40 text-muted-foreground border-border hover:bg-muted/70 hover:text-foreground"
                      }`}
                    >
                      {sector}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search */}
              <div className="relative w-full sm:w-72 shrink-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search symbol or name..."
                  className="pl-9 bg-muted/30 border-border/50 focus-visible:ring-primary/30"
                />
              </div>
            </div>

            {/* ---- Asset Grid ---- */}
            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : filteredAssets.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Search className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">No assets found</p>
                <p className="text-sm mt-1">Try a different sector or search term.</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredAssets.map((asset) => {
                  const pctChange = changePercent(asset);
                  const isPositive = pctChange >= 0;

                  return (
                    <div
                      key={asset.id}
                      onClick={() => setSelectedAsset(asset)}
                      className="glass-card rounded-xl p-5 cursor-pointer group"
                    >
                      {/* Symbol + Sector */}
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-bold tracking-wide">{asset.symbol}</span>
                        <Badge
                          variant="outline"
                          className="text-[10px] px-2 py-0.5 font-medium"
                        >
                          {asset.sector}
                        </Badge>
                      </div>

                      {/* Name */}
                      <p className="text-xs text-muted-foreground truncate mb-4">
                        {asset.name}
                      </p>

                      {/* Price + Change */}
                      <div className="flex items-end justify-between">
                        <span className="text-lg font-semibold tabular-nums">
                          {formatPrice(asset.current_price, asset.asset_type)}
                        </span>
                        <span
                          className={`text-sm font-medium tabular-nums ${
                            isPositive
                              ? "text-[hsl(var(--profit))]"
                              : "text-[hsl(var(--loss))]"
                          }`}
                        >
                          {isPositive ? "+" : ""}
                          {pctChange.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default MarketAnalysis;
