import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock, Play, Pause } from "lucide-react";

interface TradingHaltStatus {
  isHalted: boolean;
  haltStartTime?: string;
  haltEndTime?: string;
  remainingTime?: number;
  reason: string;
}

const TradingHaltBanner = () => {
  const [haltStatus, setHaltStatus] = useState<TradingHaltStatus>({
    isHalted: false,
    reason: 'Trading is active'
  });
  const [loading, setLoading] = useState(true);

  // Use a ref so the interval callback can read the latest halted state
  // without needing to re-create the effect (which would cause cycles).
  const isHaltedRef = useRef(haltStatus.isHalted);
  useEffect(() => {
    isHaltedRef.current = haltStatus.isHalted;
  }, [haltStatus.isHalted]);

  useEffect(() => {
    fetchHaltStatus();

    const interval = setInterval(() => {
      if (isHaltedRef.current) {
        fetchHaltStatus();
      }
    }, 1000);

    const channel = supabase
      .channel('trading-halt-changes')
      .on(
        'postgres_changes' as never,
        {
          event: '*',
          schema: 'public',
          table: 'competition_settings',
          filter: 'setting_key=eq.trading_halt',
        },
        () => {
          fetchHaltStatus();
        },
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchHaltStatus = async () => {
    try {
      const { data: settings } = await supabase
        .from('competition_settings')
        .select('setting_value')
        .eq('setting_key', 'trading_halt')
        .maybeSingle();

      if (!settings) {
        setHaltStatus({
          isHalted: false,
          reason: 'Trading is active'
        });
        setLoading(false);
        return;
      }

      const haltData = JSON.parse(settings.setting_value as string);
      const now = new Date();
      const haltEndTime = haltData.halt_end_time ? new Date(haltData.halt_end_time) : null;

      if (haltData.is_halted && haltEndTime && now < haltEndTime) {
        const remainingTime = Math.max(0, Math.floor((haltEndTime.getTime() - now.getTime()) / 1000));
        
        setHaltStatus({
          isHalted: true,
          haltStartTime: haltData.halt_start_time,
          haltEndTime: haltData.halt_end_time,
          remainingTime,
          reason: haltData.reason || 'Trading halt active'
        });
      } else {
        setHaltStatus({
          isHalted: false,
          reason: 'Trading is active'
        });
      }
    } catch (error) {
      console.error('Error fetching halt status:', error);
      setHaltStatus({
        isHalted: false,
        reason: 'Error checking halt status'
      });
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return null;
  }

  if (!haltStatus.isHalted) {
    return null;
  }

  return (
    <Alert className="border-red-200 bg-red-50 border-l-4 border-l-red-500 mb-4">
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          <div>
            <AlertDescription className="text-red-800 font-medium">
              🚨 TRADING HALTED
            </AlertDescription>
            <p className="text-sm text-red-700 mt-1">
              {haltStatus.reason}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {haltStatus.remainingTime !== undefined && haltStatus.remainingTime > 0 && (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-red-500" />
              <Badge variant="outline" className="text-red-600 border-red-300">
                Resumes in: {formatTime(haltStatus.remainingTime)}
              </Badge>
            </div>
          )}
          
          <div className="flex items-center gap-1">
            <Pause className="h-4 w-4 text-red-500" />
            <span className="text-sm text-red-600 font-medium">HALTED</span>
          </div>
        </div>
      </div>
    </Alert>
  );
};

export default TradingHaltBanner;
