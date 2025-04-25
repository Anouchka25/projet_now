import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  // Set CORS headers
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return response.status(204).end();
  }

  // Verify HTTP method
  if (request.method !== 'GET') {
    return response.status(405).json({ 
      error: 'Method Not Allowed',
      message: 'Only GET requests are allowed'
    });
  }

  try {
    // Get currency from query params, default to USD
    const currency = (request.query.currency as string || 'usd').toLowerCase();
    const validCurrencies = ['usd', 'eur', 'cny', 'xaf'];
    
    if (!validCurrencies.includes(currency)) {
      return response.status(400).json({
        error: 'Invalid currency',
        message: `Currency must be one of: ${validCurrencies.join(', ')}`
      });
    }

    // Fetch Bitcoin price from CoinGecko API
    const coinGeckoResponse = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=${currency}`
    );

    if (!coinGeckoResponse.ok) {
      throw new Error(`CoinGecko API error: ${coinGeckoResponse.status}`);
    }

    const data = await coinGeckoResponse.json();
    
    // Calculate XAF price if needed (not directly provided by CoinGecko)
    if (currency === 'xaf' && !data.bitcoin.xaf) {
      // Use EUR to XAF fixed rate (655.96)
      if (data.bitcoin.eur) {
        data.bitcoin.xaf = data.bitcoin.eur * 655.96;
      }
    }

    return response.status(200).json({
      price: data.bitcoin[currency],
      currency: currency.toUpperCase(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching Bitcoin price:', error);
    
    return response.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'An unexpected error occurred'
    });
  }
}