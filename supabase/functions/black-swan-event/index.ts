import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BlackSwanEventData {
  eventId: string;
  triggerTime: string;
  haltDuration: number;
  crashPercentage: number;
  recoveryPercentage: number;
  blueChipStocks: string[];
  isActive: boolean;
  tradingHalted: boolean;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { action, eventId } = await req.json();

    switch (action) {
      case 'trigger':
        return await triggerBlackSwanEvent(supabaseClient);
      case 'status':
        return await getBlackSwanStatus(supabaseClient);
      case 'cancel':
        return await cancelBlackSwanEvent(supabaseClient);
      case 'end_halt':
        return await endTradingHalt(supabaseClient);
      default:
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid action' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
    }

  } catch (error) {
    console.error('Error in black-swan-event function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});

async function triggerBlackSwanEvent(supabaseClient: any) {
  try {
    // Check if Black Swan is already active
    const { data: existingEvent } = await supabaseClient
      .from('competition_events')
      .select('*')
      .eq('event_type', 'black_swan')
      .eq('status', 'active')
      .single();

    if (existingEvent) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Black Swan event is already active' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Create Black Swan event
    const { data: event, error: eventError } = await supabaseClient
      .from('competition_events')
      .insert({
        event_name: 'Black Swan Market Crash',
        event_number: 9,
        event_type: 'black_swan',
        headline: '🚨 BLACK SWAN EVENT: Market Crash & Trading Halt',
        mechanics: JSON.stringify({
          type: 'black_swan',
          crash_percentage: -8,
          recovery_percentage: 2,
          halt_duration: 90,
          blue_chip_stocks: ['RELIANCE', 'HUL', 'INFOSYS'],
          trigger_time: new Date().toISOString()
        }),
        round_number: 3,
        status: 'active'
      })
      .select()
      .single();

    if (eventError) {
      throw new Error(`Failed to create Black Swan event: ${eventError.message}`);
    }

    // Start trading halt
    await startTradingHalt(supabaseClient, event.id);

    // Apply market crash
    await applyMarketCrash(supabaseClient);

    // Publish news
    await publishBlackSwanNews(supabaseClient);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Black Swan event triggered successfully! Trading halted for 90 seconds.',
        eventId: event.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error triggering Black Swan event:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
}

async function getBlackSwanStatus(supabaseClient: any) {
  try {
    // Get Black Swan event
    const { data: event } = await supabaseClient
      .from('competition_events')
      .select('*')
      .eq('event_type', 'black_swan')
      .eq('status', 'active')
      .single();

    if (!event) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          isActive: false,
          message: 'No Black Swan event active'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Get trading halt status
    const { data: settings } = await supabaseClient
      .from('competition_settings')
      .select('value')
      .eq('key', 'trading_halt')
      .single();

    let haltStatus: any = { is_halted: false, halt_start_time: null, halt_end_time: null };
    if (settings) {
      haltStatus = JSON.parse(settings.value);
    }

    const mechanics = JSON.parse(event.mechanics);
    const now = new Date();
    const haltEndTime = haltStatus.halt_end_time ? new Date(haltStatus.halt_end_time) : null;
    
    let remainingTime = 0;
    if (haltStatus.is_halted && haltEndTime && now < haltEndTime) {
      remainingTime = Math.max(0, Math.floor((haltEndTime.getTime() - now.getTime()) / 1000));
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        isActive: true,
        eventId: event.id,
        tradingHalted: haltStatus.is_halted,
        remainingTime,
        haltStartTime: haltStatus.halt_start_time,
        haltEndTime: haltStatus.halt_end_time,
        mechanics
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error getting Black Swan status:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
}

async function cancelBlackSwanEvent(supabaseClient: any) {
  try {
    // End trading halt
    await endTradingHalt(supabaseClient);

    // Mark event as cancelled
    const { error } = await supabaseClient
      .from('competition_events')
      .update({ status: 'cancelled' })
      .eq('event_type', 'black_swan')
      .eq('status', 'active');

    if (error) {
      throw new Error(`Failed to cancel Black Swan event: ${error.message}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Black Swan event cancelled and trading resumed'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error cancelling Black Swan event:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
}

async function endTradingHalt(supabaseClient: any) {
  try {
    // Update competition settings to resume trading
    const { error } = await supabaseClient
      .from('competition_settings')
      .upsert({
        key: 'trading_halt',
        value: JSON.stringify({
          is_halted: false,
          halt_end_time: new Date().toISOString(),
          reason: 'Trading resumed after Black Swan event'
        }),
        updated_at: new Date().toISOString()
      });

    if (error) {
      throw new Error(`Failed to end trading halt: ${error.message}`);
    }

    // Apply blue-chip recovery
    await applyBlueChipRecovery(supabaseClient);

    // Publish recovery news
    await publishRecoveryNews(supabaseClient);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Trading halt ended and recovery applied'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error ending trading halt:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
}

async function startTradingHalt(supabaseClient: any, eventId: string) {
  const haltStartTime = new Date();
  const haltEndTime = new Date(haltStartTime.getTime() + (90 * 1000)); // 90 seconds

  // Update competition settings to halt trading
  const { error } = await supabaseClient
    .from('competition_settings')
    .upsert({
      key: 'trading_halt',
      value: JSON.stringify({
        is_halted: true,
        halt_start_time: haltStartTime.toISOString(),
        halt_end_time: haltEndTime.toISOString(),
        reason: 'Black Swan Event - Market Crash',
        event_id: eventId
      }),
      updated_at: new Date().toISOString()
    });

  if (error) {
    throw new Error(`Failed to start trading halt: ${error.message}`);
  }
}

async function applyMarketCrash(supabaseClient: any) {
  // Get all active assets
  const { data: assets, error: assetsError } = await supabaseClient
    .from('assets')
    .select('id, symbol, current_price')
    .eq('is_active', true);

  if (assetsError) {
    throw new Error(`Failed to fetch assets: ${assetsError.message}`);
  }

  if (!assets || assets.length === 0) {
    return;
  }

  // Apply -8% crash to all assets
  for (const asset of assets) {
    const newPrice = asset.current_price * 0.92; // -8%
    
    const { error: updateError } = await supabaseClient
      .from('assets')
      .update({
        current_price: newPrice,
        previous_close: asset.current_price,
        updated_at: new Date().toISOString()
      })
      .eq('id', asset.id);

    if (updateError) {
      console.error(`Failed to update price for ${asset.symbol}:`, updateError);
    }

    // Log price fluctuation
    await logPriceFluctuation(supabaseClient, asset.id, asset.current_price, newPrice, 'black_swan_crash');
  }

  console.log(`Applied -8% crash to ${assets.length} assets`);
}

async function applyBlueChipRecovery(supabaseClient: any) {
  const blueChipSymbols = ['RELIANCE', 'HUL', 'INFOSYS'];

  // Get blue-chip assets
  const { data: blueChipAssets, error: assetsError } = await supabaseClient
    .from('assets')
    .select('id, symbol, current_price')
    .in('symbol', blueChipSymbols)
    .eq('is_active', true);

  if (assetsError) {
    throw new Error(`Failed to fetch blue-chip assets: ${assetsError.message}`);
  }

  if (!blueChipAssets || blueChipAssets.length === 0) {
    console.log('No blue-chip assets found for recovery');
    return;
  }

  // Apply +2% recovery to blue-chip stocks
  for (const asset of blueChipAssets) {
    const newPrice = asset.current_price * 1.02; // +2%
    
    const { error: updateError } = await supabaseClient
      .from('assets')
      .update({
        current_price: newPrice,
        previous_close: asset.current_price,
        updated_at: new Date().toISOString()
      })
      .eq('id', asset.id);

    if (updateError) {
      console.error(`Failed to update price for ${asset.symbol}:`, updateError);
    }

    // Log price fluctuation
    await logPriceFluctuation(supabaseClient, asset.id, asset.current_price, newPrice, 'blue_chip_recovery');
  }

  console.log(`Applied +2% recovery to ${blueChipAssets.length} blue-chip stocks`);
}

async function logPriceFluctuation(supabaseClient: any, assetId: string, oldPrice: number, newPrice: number, reason: string) {
  try {
    const { error } = await supabaseClient
      .from('price_fluctuation_logs')
      .insert({
        asset_id: assetId,
        old_price: oldPrice,
        new_price: newPrice,
        price_change: newPrice - oldPrice,
        price_change_percentage: ((newPrice - oldPrice) / oldPrice) * 100,
        reason: reason,
        timestamp: new Date().toISOString()
      });

    if (error) {
      console.error('Failed to log price fluctuation:', error);
    }
  } catch (error) {
    console.error('Error logging price fluctuation:', error);
  }
}

async function publishBlackSwanNews(supabaseClient: any) {
  try {
    const { error } = await supabaseClient
      .from('news')
      .insert({
        title: '🚨 BLACK SWAN EVENT: Market Crash & Trading Halt',
        content: `A catastrophic market event has triggered an immediate trading halt across all markets. All assets have experienced an 8% crash. Trading will resume in 90 seconds. This is a test of your risk management skills in extreme market conditions.`,
        category: 'market_event',
        published_by: 'system',
        is_public: true
      });

    if (error) {
      console.error('Failed to publish Black Swan news:', error);
    }
  } catch (error) {
    console.error('Error publishing Black Swan news:', error);
  }
}

async function publishRecoveryNews(supabaseClient: any) {
  try {
    const { error } = await supabaseClient
      .from('news')
      .insert({
        title: '📈 Market Recovery: Blue-Chip Stocks Lead the Way',
        content: `Trading has resumed after the Black Swan event. Blue-chip stocks (Reliance, HUL, Infosys) have shown resilience with a 2% recovery from the crash levels. Other stocks remain at their crashed levels. The market is now open for trading.`,
        category: 'market_event',
        published_by: 'system',
        is_public: true
      });

    if (error) {
      console.error('Failed to publish recovery news:', error);
    }
  } catch (error) {
    console.error('Error publishing recovery news:', error);
  }
}
