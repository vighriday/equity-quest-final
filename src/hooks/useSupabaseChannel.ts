import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface ChannelConfig {
  channelName: string;
  table: string;
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  schema?: string;
  filter?: string;
  onPayload: (payload: any) => void;
}

/**
 * Custom hook for managing Supabase real-time channel subscriptions.
 * Handles proper subscribe/unsubscribe lifecycle and prevents duplicate channels.
 */
export function useSupabaseChannel(configs: ChannelConfig[]) {
  const channelsRef = useRef<RealtimeChannel[]>([]);

  useEffect(() => {
    // Clean up any existing channels first
    channelsRef.current.forEach(channel => {
      supabase.removeChannel(channel);
    });
    channelsRef.current = [];

    // Create new channels
    const channels = configs.map(config => {
      const channel = supabase
        .channel(config.channelName)
        .on(
          // Supabase v2 typings narrow this signature; cast to satisfy the union.
          'postgres_changes' as never,
          {
            event: config.event || '*',
            schema: config.schema || 'public',
            table: config.table,
            ...(config.filter ? { filter: config.filter } : {}),
          },
          config.onPayload
        )
        .subscribe();

      return channel;
    });

    channelsRef.current = channels;

    return () => {
      channels.forEach(channel => {
        supabase.removeChannel(channel);
      });
      channelsRef.current = [];
    };
  }, [configs]);
}

/**
 * Simple single-channel subscription hook.
 */
export function useSupabaseTable(
  table: string,
  onPayload: (payload: any) => void,
  event: '*' | 'INSERT' | 'UPDATE' | 'DELETE' = '*'
) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    channelRef.current = supabase
      .channel(`${table}-changes-${Date.now()}`)
      .on(
        'postgres_changes' as never,
        { event, schema: 'public', table },
        onPayload
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [table, event, onPayload]);
}
