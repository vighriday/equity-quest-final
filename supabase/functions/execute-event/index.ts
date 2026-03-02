import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EventMechanics {
  affected_assets: string[]; // asset symbols
  open_gap?: number; // immediate gap percentage
  drift?: number; // total drift percentage
  drift_duration?: number; // drift duration in minutes
  catalyst?: {
    at_minute: number;
    change: number;
  };
  special?: string; // 'black_swan', 'trading_halt', etc.
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { eventId } = await req.json();

    if (!eventId) {
      throw new Error('Event ID is required');
    }

    console.log(`Executing event ${eventId}`);

    // Get event details
    const { data: event, error: eventError } = await supabaseClient
      .from('competition_events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (eventError) throw eventError;

    const mechanics: EventMechanics = event.mechanics;

    // Get affected assets
    console.log('Looking for assets with symbols:', mechanics.affected_assets);
    const { data: assets, error: assetsError } = await supabaseClient
      .from('assets')
      .select('*')
      .in('symbol', mechanics.affected_assets);

    if (assetsError) {
      console.error('Error fetching assets:', assetsError);
      throw assetsError;
    }

    console.log('Found assets:', assets?.map(a => ({ symbol: a.symbol, name: a.name })));

    if (!assets || assets.length === 0) {
      console.warn('No assets found for symbols:', mechanics.affected_assets);
      // For special cases like black swan, we'll handle this separately
      if (mechanics.special !== 'black_swan') {
        return new Response(
          JSON.stringify({
            success: false,
            error: `No assets found for symbols: ${mechanics.affected_assets.join(', ')}`,
            updates: []
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          }
        );
      }
    }

    const updates = [];

    // Apply OPEN GAP (instant price change)
    if (mechanics.open_gap && mechanics.open_gap !== 0) {
      for (const asset of assets) {
        const oldPrice = parseFloat(asset.current_price);
        
        // Check for asset-specific impact first
        let openGap = mechanics.open_gap;
        if (mechanics.asset_specific_impacts && mechanics.asset_specific_impacts[asset.symbol]) {
          openGap = mechanics.asset_specific_impacts[asset.symbol].open_gap;
        }
        
        const newPrice = oldPrice * (1 + openGap);

        await supabaseClient
          .from('assets')
          .update({
            current_price: newPrice,
            updated_at: new Date().toISOString(),
          })
          .eq('id', asset.id);

        // Log the gap
        await supabaseClient
          .from('price_fluctuation_log')
          .insert({
            asset_id: asset.id,
            old_price: oldPrice,
            new_price: newPrice,
            change_percentage: openGap * 100,
            fluctuation_type: 'gap',
            event_id: eventId,
          });

        updates.push({
          symbol: asset.symbol,
          type: 'gap',
          change: openGap * 100,
        });
      }
    } else if (mechanics.open_gap === 0) {
      // Handle events with no price impact (like red herring)
      console.log('Event has no price impact (open_gap = 0)');
      for (const asset of assets) {
        updates.push({
          symbol: asset.symbol,
          type: 'no_impact',
          change: 0,
        });
      }
    }

    // Mark event as executing (drift will be handled by a separate scheduled function)
    await supabaseClient
      .from('competition_events')
      .update({
        status: 'executing',
        executed_at: new Date().toISOString(),
      })
      .eq('id', eventId);

    // If this is a BLACK SWAN event
    if (mechanics.special === 'black_swan') {
      console.log('Executing BLACK SWAN event');
      
      // Get all stock assets
      const { data: allStocks, error: stocksError } = await supabaseClient
        .from('assets')
        .select('*')
        .eq('asset_type', 'stock');

      if (stocksError) {
        console.error('Error fetching stocks for Black Swan:', stocksError);
        throw stocksError;
      }

      console.log(`Found ${allStocks?.length || 0} stocks for Black Swan event`);

      // Apply -8% crash to all stocks
      for (const stock of allStocks || []) {
        const oldPrice = parseFloat(stock.current_price);
        const newPrice = oldPrice * 0.92; // -8%

        await supabaseClient
          .from('assets')
          .update({
            current_price: newPrice,
            updated_at: new Date().toISOString(),
          })
          .eq('id', stock.id);

        await supabaseClient
          .from('price_fluctuation_log')
          .insert({
            asset_id: stock.id,
            old_price: oldPrice,
            new_price: newPrice,
            change_percentage: -8,
            fluctuation_type: 'gap',
            event_id: eventId,
          });

        updates.push({
          symbol: stock.symbol,
          type: 'black_swan_crash',
          change: -8,
        });
      }

      // Pause competition for 90 seconds (trading halt)
      // This would need to be handled by the frontend/admin panel
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Event executed successfully',
        updates,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in execute-event function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
