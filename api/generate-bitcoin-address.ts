import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// Binance API configuration
const BINANCE_API_KEY = process.env.BINANCE_API_KEY || '';
const BINANCE_API_SECRET = process.env.BINANCE_API_SECRET || '';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  // Set CORS headers
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return response.status(204).end();
  }

  // Verify HTTP method
  if (request.method !== 'POST') {
    return response.status(405).json({ 
      error: 'Method Not Allowed',
      message: 'Only POST requests are allowed'
    });
  }

  try {
    // Verify the token with Supabase
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return response.status(401).json({ error: 'Non autorisé' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return response.status(401).json({ error: 'Token invalide' });
    }

    // In a real implementation, you would call the Binance API to generate a deposit address
    // For this example, we'll generate a placeholder address
    
    // Generate a timestamp and signature for Binance API
    const timestamp = Date.now();
    const queryString = `timestamp=${timestamp}`;
    
    const signature = crypto
      .createHmac('sha256', BINANCE_API_SECRET)
      .update(queryString)
      .digest('hex');
    
    // In a real implementation, you would make this API call
    // const response = await fetch(`https://api.binance.com/sapi/v1/capital/deposit/address?coin=BTC&network=BTC&${queryString}&signature=${signature}`, {
    //   headers: {
    //     'X-MBX-APIKEY': BINANCE_API_KEY
    //   }
    // });
    // const data = await response.json();
    // const address = data.address;
    
    // For demonstration, generate a random-looking Bitcoin address
    const randomBytes = crypto.randomBytes(20);
    const address = `bc1q${randomBytes.toString('hex')}`;
    
    // Store the address in the database for future reference
    const { error: dbError } = await supabase
      .from('bitcoin_addresses')
      .insert([{
        user_id: user.id,
        address,
        created_at: new Date().toISOString()
      }]);
    
    if (dbError) {
      console.error('Error storing Bitcoin address:', dbError);
      // Continue even if DB storage fails
    }
    
    return response.status(200).json({
      address,
      network: 'BTC',
      tag: null
    });
  } catch (error) {
    console.error('Error generating Bitcoin address:', error);
    
    return response.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'An unexpected error occurred'
    });
  }
}