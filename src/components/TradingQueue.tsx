import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, CheckCircle, XCircle, AlertCircle, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface PendingOrder {
  id: string;
  asset_id: string;
  asset_symbol: string;
  asset_name: string;
  order_type: 'market' | 'limit' | 'stop_loss';
  quantity: number;
  price: number | null;
  stop_price: number | null;
  is_buy: boolean;
  is_short_sell: boolean;
  status: 'pending' | 'processing' | 'executed' | 'failed' | 'cancelled';
  created_at: string;
  executed_at: string | null;
  executed_price: number | null;
  error_message: string | null;
}

interface TradingQueueProps {
  userId: string;
}

const TradingQueue = ({ userId }: TradingQueueProps) => {
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPendingOrders = async () => {
    try {
      // Don't fetch if userId is empty or undefined
      if (!userId || userId.trim() === '') {
        console.warn('TradingQueue: userId is empty, skipping fetch');
        setPendingOrders([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          asset_id,
          order_type,
          quantity,
          price,
          stop_price,
          is_buy,
          is_short_sell,
          status,
          created_at,
          executed_at,
          executed_price,
          error_message,
          assets!inner(symbol, name)
        `)
        .eq('user_id', userId)
        .in('status', ['pending', 'processing'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      const orders: PendingOrder[] = (data || [])
        .filter((order) => order.status !== 'rejected')
        .map((order) => ({
          id: order.id,
          asset_id: order.asset_id,
          asset_symbol: order.assets.symbol,
          asset_name: order.assets.name,
          order_type: order.order_type,
          quantity: order.quantity,
          price: order.price,
          stop_price: order.stop_price,
          is_buy: order.is_buy,
          is_short_sell: order.is_short_sell ?? false,
          status: order.status as PendingOrder['status'],
          created_at: order.created_at,
          executed_at: order.executed_at,
          executed_price: order.executed_price,
          error_message: order.error_message,
        }));

      setPendingOrders(orders);
    } catch (error) {
      console.error('Error fetching pending orders:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Don't set up subscription if userId is empty
    if (!userId || userId.trim() === '') {
      console.warn('TradingQueue: userId is empty, skipping subscription setup');
      setLoading(false);
      return;
    }

    fetchPendingOrders();
    
    // Set up real-time subscription for order updates
    const channel = supabase
      .channel('orders_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `user_id=eq.${userId}`
        },
        () => {
          fetchPendingOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'processing':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'executed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'cancelled':
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-600 border-yellow-200';
      case 'processing':
        return 'bg-blue-500/10 text-blue-600 border-blue-200';
      case 'executed':
        return 'bg-green-500/10 text-green-600 border-green-200';
      case 'failed':
        return 'bg-red-500/10 text-red-600 border-red-200';
      case 'cancelled':
        return 'bg-gray-500/10 text-gray-600 border-gray-200';
      default:
        return 'bg-gray-500/10 text-gray-600 border-gray-200';
    }
  };

  const formatOrderType = (orderType: string) => {
    return orderType.replace('_', ' ').toUpperCase();
  };

  const formatOrderAction = (isBuy: boolean, isShortSell: boolean) => {
    if (isShortSell) return 'SHORT SELL';
    return isBuy ? 'BUY' : 'SELL';
  };

  const formatPrice = (price: number | null, orderType: string) => {
    if (!price) return 'Market';
    return `₹${price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const orderTime = new Date(timestamp);
    const diffInSeconds = Math.floor((now.getTime() - orderTime.getTime()) / 1000);
    
    if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    return `${Math.floor(diffInSeconds / 3600)}h ago`;
  };

  if (loading) {
    return (
      <Card className="card-enhanced">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Trading Queue
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-20">
            <RefreshCw className="h-6 w-6 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-enhanced">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Trading Queue
          </div>
          <Badge variant="outline" className="text-xs">
            {pendingOrders.length} pending
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {pendingOrders.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm">No pending orders</p>
            <p className="text-xs">Your trades will appear here when processing</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {pendingOrders.map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between p-3 border border-border rounded-lg hover:border-primary/50 transition-all duration-300"
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(order.status)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">
                        {formatOrderAction(order.is_buy, order.is_short_sell)}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {order.quantity} × {order.asset_symbol}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {formatOrderType(order.order_type)}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {order.asset_name} • {formatPrice(order.price, order.order_type)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatTimeAgo(order.created_at)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={`text-xs ${getStatusColor(order.status)}`}>
                    {order.status.toUpperCase()}
                  </Badge>
                  {order.status === 'processing' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={fetchPendingOrders}
                      className="h-6 w-6 p-0"
                    >
                      <RefreshCw className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TradingQueue;
