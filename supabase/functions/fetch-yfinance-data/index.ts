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

    console.log('Fetching yFinance data for all assets...');

    // Get all assets with yfinance_ticker
    const { data: assets, error: assetsError } = await supabaseClient
      .from('assets')
      .select('*')
      .not('yfinance_ticker', 'is', null);

    if (assetsError) throw assetsError;

    const results = [];

    for (const asset of assets) {
      try {
        // Fetch current price from yFinance API proxy with timeout
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${asset.yfinance_ticker}?interval=1d&range=1mo`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        let priceResponse: Response;
        try {
          priceResponse = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0'
            },
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
        } catch (err) {
          clearTimeout(timeoutId);
          if (err.name === 'AbortError') {
            console.error(`Timeout fetching ${asset.symbol}`);
            continue;
          }
          throw err;
        }

        if (!priceResponse.ok) {
          console.error(`Failed to fetch data for ${asset.symbol}`);
          continue;
        }

        const priceData = await priceResponse.json();

        if (!priceData?.chart?.result?.[0]) {
          console.error(`Invalid response structure for ${asset.symbol}`);
          continue;
        }

        const quote = priceData.chart.result[0];
        const meta = quote.meta;
        const currentPrice = meta.regularMarketPrice;
        const previousClose = meta.previousClose || currentPrice;

        // Update asset with real price
        const { error: updateError } = await supabaseClient
          .from('assets')
          .update({
            current_price: currentPrice,
            previous_close: previousClose,
            week_52_high: meta.fiftyTwoWeekHigh,
            week_52_low: meta.fiftyTwoWeekLow,
            updated_at: new Date().toISOString(),
          })
          .eq('id', asset.id);

        if (updateError) {
          console.error(`Error updating ${asset.symbol}:`, updateError);
          continue;
        }

        // Store historical data
        const timestamps = quote.timestamp;
        const closes = quote.indicators.quote[0].close;
        const volumes = quote.indicators.quote[0].volume;

        const historicalData = timestamps.map((ts: number, i: number) => ({
          timestamp: ts,
          close: closes[i],
          volume: volumes[i],
        }));

        // Save to financial_metrics table
        const { error: metricsError } = await supabaseClient
          .from('financial_metrics')
          .upsert({
            asset_id: asset.id,
            metric_type: 'historical_price',
            data: historicalData,
            fetched_at: new Date().toISOString(),
          });

        if (metricsError) {
          console.error(`Error saving metrics for ${asset.symbol}:`, metricsError);
        }

        results.push({
          symbol: asset.symbol,
          currentPrice,
          previousClose,
          success: true,
        });

        console.log(`Successfully updated ${asset.symbol}: ₹${currentPrice}`);

      } catch (error) {
        console.error(`Error processing ${asset.symbol}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          symbol: asset.symbol,
          success: false,
          error: errorMessage,
        });
      }

      // Rate limiting - wait 200ms between requests
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'yFinance data fetch completed',
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in fetch-yfinance-data function:', error);
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
