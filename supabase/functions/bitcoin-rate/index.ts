import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    // Fetch Bitcoin price from Binance API
    const response = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT");
    
    if (!response.ok) {
      throw new Error(`Binance API error: ${response.status} ${response.statusText}`);
    }
    
    const btcUsdtData = await response.json();
    const btcUsdtRate = parseFloat(btcUsdtData.price);
    
    // Get EUR/USD rate to convert to EUR
    const eurUsdResponse = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=EURUSDT");
    
    if (!eurUsdResponse.ok) {
      throw new Error(`Binance API error for EUR/USD: ${eurUsdResponse.status}`);
    }
    
    const eurUsdData = await eurUsdResponse.json();
    const eurUsdRate = parseFloat(eurUsdData.price);
    
    // Calculate BTC/EUR rate
    const btcEurRate = btcUsdtRate / eurUsdRate;
    
    // Get XAF rate (fixed)
    const eurXafRate = 655.96;
    const btcXafRate = btcEurRate * eurXafRate;
    
    const rates = {
      BTC_USD: btcUsdtRate,
      BTC_EUR: btcEurRate,
      BTC_XAF: btcXafRate,
      EUR_USD: 1 / eurUsdRate,
      USD_EUR: eurUsdRate,
      timestamp: new Date().toISOString()
    };
    
    return new Response(JSON.stringify(rates), {
      headers: { 
        ...corsHeaders,
        "Content-Type": "application/json" 
      },
    });
  } catch (error) {
    console.error("Error fetching Bitcoin rate:", error);
    
    // Return fallback rates in case of error
    const fallbackRates = {
      BTC_USD: 65000,
      BTC_EUR: 60000,
      BTC_XAF: 39357600, // 60000 * 655.96
      EUR_USD: 1.08,
      USD_EUR: 0.92,
      timestamp: new Date().toISOString(),
      fallback: true
    };
    
    return new Response(JSON.stringify(fallbackRates), {
      headers: { 
        ...corsHeaders,
        "Content-Type": "application/json" 
      },
    });
  }
});