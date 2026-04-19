import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Download,
  Inbox,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { TableSkeleton } from "@/components/LoadingSkeleton";
import { EmptyState } from "@/components/EmptyState";

type OrderStatus =
  | "pending"
  | "executed"
  | "cancelled"
  | "rejected"
  | "processing"
  | "failed";
type OrderTypeName = "market" | "limit" | "stop_loss";

interface Order {
  id: string;
  order_type: OrderTypeName;
  quantity: number;
  price: number | null;
  stop_price: number | null;
  status: OrderStatus;
  executed_price: number | null;
  executed_at: string | null;
  is_buy: boolean;
  created_at: string;
  assets: {
    symbol: string;
    name: string;
    current_price: number;
  };
}

const ORDERS_PER_PAGE = 20;

const ORDER_TYPE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "market", label: "Market" },
  { value: "limit", label: "Limit" },
  { value: "stop_loss", label: "Stop Loss" },
] as const;

const TransactionHistory = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetchOrders();
  }, [currentPage]);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, typeFilter]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      // Build query
      let query = supabase
        .from("orders")
        .select(
          `
          *,
          assets (
            symbol,
            name,
            current_price
          )
        `,
          { count: "exact" }
        )
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      // Apply status filter at the query level when possible
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter as OrderStatus);
      }

      // Apply type filter at the query level when possible
      if (typeFilter !== "all") {
        query = query.eq("order_type", typeFilter as OrderTypeName);
      }

      const from = (currentPage - 1) * ORDERS_PER_PAGE;
      const to = from + ORDERS_PER_PAGE - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) {
        console.error("Error fetching orders:", error);
        toast.error("Failed to fetch transaction history");
        return;
      }

      setOrders(data || []);
      setTotalCount(count ?? 0);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to fetch transaction history");
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch when filters change (debounced via the page reset above)
  useEffect(() => {
    fetchOrders();
  }, [statusFilter, typeFilter]);

  // Client-side search filtering (symbol/name search can't easily be done server-side with joined tables)
  const filteredOrders = useMemo(() => {
    if (!searchTerm.trim()) return orders;
    const term = searchTerm.toLowerCase();
    return orders.filter(
      (order) =>
        order.assets.symbol.toLowerCase().includes(term) ||
        order.assets.name.toLowerCase().includes(term)
    );
  }, [orders, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(totalCount / ORDERS_PER_PAGE));

  const formatCurrency = (amount: number) => {
    return `\u20B9${amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const computePnL = (order: Order): number | null => {
    if (!order.executed_price) return null;
    return order.is_buy
      ? (order.assets.current_price - order.executed_price) * order.quantity
      : (order.executed_price - order.assets.current_price) * order.quantity;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "executed":
        return <span className="badge-executed">Executed</span>;
      case "pending":
        return <span className="badge-pending">Pending</span>;
      case "cancelled":
        return <span className="badge-cancelled">Cancelled</span>;
      case "rejected":
        return <span className="badge-failed">Rejected</span>;
      default:
        return (
          <Badge variant="secondary">{status}</Badge>
        );
    }
  };

  /* ── CSV export with raw numbers (no currency symbol) ── */
  const exportToCSV = () => {
    if (filteredOrders.length === 0) {
      toast.error("No orders to export");
      return;
    }

    const csvContent = [
      ["Date", "Symbol", "Type", "Side", "Quantity", "Price", "Executed Price", "Status", "P&L"],
      ...filteredOrders.map((order) => {
        const pnl = computePnL(order);
        return [
          formatDate(order.created_at),
          order.assets.symbol,
          order.order_type,
          order.is_buy ? "Buy" : "Sell",
          order.quantity.toString(),
          order.price != null ? order.price.toFixed(2) : "Market",
          order.executed_price != null ? order.executed_price.toFixed(2) : "",
          order.status,
          pnl != null ? pnl.toFixed(2) : "",
        ];
      }),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transaction-history-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success("CSV exported successfully");
  };

  /* ── Loading state ── */
  if (loading && orders.length === 0) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gradient-primary">
              Transaction History
            </h1>
            <p className="text-muted-foreground mt-1">
              View all your trading activity and order history
            </p>
          </div>
          <TableSkeleton rows={8} columns={8} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* ── Page Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gradient-primary">
              Transaction History
            </h1>
            <p className="text-muted-foreground mt-1">
              View all your trading activity and order history
            </p>
          </div>
          <Button
            onClick={exportToCSV}
            variant="outline"
            className="flex items-center gap-2 shrink-0"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>

        {/* ── Filter Bar ── */}
        <div className="glass-card p-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            {/* Search */}
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by symbol or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 input-enhanced"
              />
            </div>

            {/* Order Type filter buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {ORDER_TYPE_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  size="sm"
                  variant={typeFilter === opt.value ? "default" : "outline"}
                  onClick={() => setTypeFilter(opt.value)}
                  className="text-xs"
                >
                  {opt.label}
                </Button>
              ))}
            </div>

            {/* Status filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="input-enhanced w-full lg:w-44">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="executed">Executed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ── Orders Table ── */}
        <div className="glass-card overflow-hidden">
          {filteredOrders.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No orders found"
              description="Your transaction history will appear here once you place orders. Try adjusting your filters if you believe orders should be shown."
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="table-premium w-full">
                  <thead>
                    <tr>
                      <th className="text-left">Time</th>
                      <th className="text-left">Asset</th>
                      <th className="text-left">Type</th>
                      <th className="text-left">Side</th>
                      <th className="text-right">Qty</th>
                      <th className="text-right">Price</th>
                      <th className="text-center">Status</th>
                      <th className="text-right">P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((order, index) => {
                      const pnl = computePnL(order);

                      return (
                        <tr
                          key={order.id}
                          className="animate-fade-in"
                          style={{ animationDelay: `${index * 0.03}s` }}
                        >
                          {/* Time */}
                          <td className="whitespace-nowrap text-sm text-muted-foreground">
                            {formatDate(order.executed_at ?? order.created_at)}
                          </td>

                          {/* Asset */}
                          <td>
                            <div>
                              <p className="font-medium text-sm">
                                {order.assets.symbol}
                              </p>
                              <p className="text-xs text-muted-foreground truncate max-w-[140px]">
                                {order.assets.name}
                              </p>
                            </div>
                          </td>

                          {/* Type */}
                          <td>
                            <Badge variant="outline" className="text-xs capitalize">
                              {order.order_type.replace("_", " ")}
                            </Badge>
                          </td>

                          {/* Side */}
                          <td>
                            <span
                              className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-md ${
                                order.is_buy ? "btn-buy" : "btn-sell"
                              }`}
                            >
                              {order.is_buy ? "Buy" : "Sell"}
                            </span>
                          </td>

                          {/* Qty */}
                          <td className="text-right font-medium tabular-nums">
                            {order.quantity}
                          </td>

                          {/* Price */}
                          <td className="text-right tabular-nums">
                            {order.executed_price
                              ? formatCurrency(order.executed_price)
                              : order.price
                                ? formatCurrency(order.price)
                                : "Market"}
                          </td>

                          {/* Status */}
                          <td className="text-center">
                            {getStatusBadge(order.status)}
                          </td>

                          {/* P&L */}
                          <td
                            className={`text-right font-medium tabular-nums ${
                              pnl != null
                                ? pnl >= 0
                                  ? "text-profit"
                                  : "text-loss"
                                : "text-muted-foreground"
                            }`}
                          >
                            {pnl != null ? formatCurrency(pnl) : "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* ── Pagination ── */}
              <div className="flex items-center justify-between border-t border-border/40 px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  Showing{" "}
                  <span className="font-medium text-foreground">
                    {(currentPage - 1) * ORDERS_PER_PAGE + 1}
                  </span>
                  {" - "}
                  <span className="font-medium text-foreground">
                    {Math.min(currentPage * ORDERS_PER_PAGE, totalCount)}
                  </span>{" "}
                  of{" "}
                  <span className="font-medium text-foreground">{totalCount}</span>{" "}
                  orders
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="flex items-center gap-1"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground px-2">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="flex items-center gap-1"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default TransactionHistory;
