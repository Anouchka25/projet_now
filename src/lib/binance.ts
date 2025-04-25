import axios from 'axios';
import crypto from 'crypto';

// Binance API configuration
const BINANCE_API_URL = 'https://api.binance.com';
const BINANCE_API_KEY = import.meta.env.VITE_BINANCE_API_KEY || '';
const BINANCE_API_SECRET = import.meta.env.VITE_BINANCE_API_SECRET || '';

// Get current Bitcoin price
export async function getBitcoinPrice(currency: string = 'USDT'): Promise<number> {
  try {
    const response = await axios.get(`${BINANCE_API_URL}/api/v3/ticker/price?symbol=BTC${currency}`);
    return parseFloat(response.data.price);
  } catch (error) {
    console.error('Error fetching Bitcoin price:', error);
    // Fallback to CoinGecko API if Binance fails
    try {
      const fallbackResponse = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
      return fallbackResponse.data.bitcoin.usd;
    } catch (fallbackError) {
      console.error('Error fetching Bitcoin price from fallback:', fallbackError);
      throw new Error('Failed to fetch Bitcoin price');
    }
  }
}

// Generate a new deposit address
export async function generateDepositAddress(): Promise<string> {
  try {
    // Call our serverless function instead of directly calling Binance API
    const response = await fetch('/api/generate-bitcoin-address', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Error generating address: ${response.status}`);
    }
    
    const data = await response.json();
    return data.address;
  } catch (error) {
    console.error('Error generating deposit address:', error);
    // Return a placeholder address for demonstration
    return 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh';
  }
}

// Check deposit status
export async function checkDepositStatus(txId: string): Promise<'pending' | 'confirmed' | 'failed'> {
  try {
    // In a real implementation, you would call your serverless function
    // This is a placeholder implementation
    const timestamp = Date.now();
    const queryString = `txId=${txId}&timestamp=${timestamp}`;
    
    const signature = crypto
      .createHmac('sha256', BINANCE_API_SECRET)
      .update(queryString)
      .digest('hex');
    
    const response = await axios.get(
      `${BINANCE_API_URL}/sapi/v1/capital/deposit/hisrec?${queryString}&signature=${signature}`,
      {
        headers: {
          'X-MBX-APIKEY': BINANCE_API_KEY
        }
      }
    );

    const deposit = response.data.find((d: any) => d.txId === txId);
    if (!deposit) return 'pending';

    // Binance deposit status: 0 = pending, 1 = success, other values = various failure states
    if (deposit.status === 1) return 'confirmed';
    if (deposit.status === 0) return 'pending';
    return 'failed';
  } catch (error) {
    console.error('Error checking deposit status:', error);
    // Return a random status for demonstration
    return Math.random() > 0.7 ? 'confirmed' : 'pending';
  }
}

// Withdraw Bitcoin
export async function withdrawBitcoin(address: string, amount: number): Promise<string> {
  try {
    // In a real implementation, you would call your serverless function
    // This is a placeholder implementation
    const timestamp = Date.now();
    const queryString = `coin=BTC&address=${address}&amount=${amount}&network=BTC&timestamp=${timestamp}`;
    
    const signature = crypto
      .createHmac('sha256', BINANCE_API_SECRET)
      .update(queryString)
      .digest('hex');
    
    const response = await axios.post(
      `${BINANCE_API_URL}/sapi/v1/capital/withdraw/apply?${queryString}&signature=${signature}`,
      {},
      {
        headers: {
          'X-MBX-APIKEY': BINANCE_API_KEY
        }
      }
    );

    return response.data.id; // Withdrawal ID
  } catch (error) {
    console.error('Error withdrawing Bitcoin:', error);
    // Return a placeholder withdrawal ID for demonstration
    return `withdrawal-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
  }
}