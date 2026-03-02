import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Running background price noise...');

    // Check if competition is active
    const { data: round, error: roundError } = await supabaseClient
      .from('competition_rounds')
      .select('*')
      .order('round_number', { ascending: false })
      .limit(1)
      .single();

    if (roundError || !round || round.status !== 'active') {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Competition not active',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Get all active assets
    const { data: assets, error: assetsError } = await supabaseClient
      .from('assets')
      .select('*')
      .eq('is_active', true);

    if (assetsError) throw assetsError;

    // Get circuit limits
    const { data: circuitLimits } = await supabaseClient
      .from('competition_settings')
      .select('setting_value')
      .eq('setting_key', 'circuit_limits')
      .single();

    const limits = circuitLimits?.setting_value || { stocks: 0.10, commodities: 0.06 };

    const updates = [];

    // Process each asset independently with its own random fluctuation
    for (const asset of assets) {
      try {
        // Generate independent random fluctuation for each asset: ±0.5%
        const fluctuation = (Math.random() - 0.5) * 2 * 0.005; // ±0.5%
        
        const oldPrice = parseFloat(asset.current_price);
        let newPrice = oldPrice * (1 + fluctuation);

        // Apply circuit limits
        const maxLimit = asset.asset_type === 'stock' ? limits.stocks : limits.commodities;
        const maxPrice = parseFloat(asset.previous_close) * (1 + maxLimit);
        const minPrice = parseFloat(asset.previous_close) * (1 - maxLimit);

        newPrice = Math.max(minPrice, Math.min(maxPrice, newPrice));
        const changePercentage = ((newPrice - oldPrice) / oldPrice) * 100;

        // Update asset price - each asset updates independently
        const { error: updateError } = await supabaseClient
          .from('assets')
          .update({
            current_price: newPrice,
            updated_at: new Date().toISOString(),
          })
          .eq('id', asset.id);

        if (updateError) {
          console.error(`Error updating ${asset.symbol}:`, updateError);
          continue;
        }

        // Log the fluctuation
        const { error: logError } = await supabaseClient
          .from('price_fluctuation_log')
          .insert({
            asset_id: asset.id,
            old_price: oldPrice,
            new_price: newPrice,
            change_percentage: changePercentage,
            fluctuation_type: 'noise',
          });

        if (logError) {
          console.error(`Error logging fluctuation for ${asset.symbol}:`, logError);
        }

        updates.push({
          symbol: asset.symbol,
          oldPrice,
          newPrice,
          change: changePercentage.toFixed(3),
        });
      } catch (assetError) {
        console.error(`Exception processing ${asset.symbol}:`, assetError);
      }
    }

    console.log(`Updated ${updates.length} asset prices`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Price noise applied',
        updates,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in background-price-noise function:', error);
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
