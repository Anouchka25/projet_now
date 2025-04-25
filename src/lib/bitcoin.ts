// Fonction pour obtenir le taux de change du Bitcoin
export async function getBitcoinRate() {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('VITE_SUPABASE_URL not defined');
      }
  
      const response = await fetch(`${supabaseUrl}/functions/v1/bitcoin-rate`);
      
      if (!response.ok) {
        throw new Error(`Error fetching Bitcoin rate: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to fetch Bitcoin rate:', error);
      
      // Return fallback rates in case of error
      return {
        BTC_USD: 65000,
        BTC_EUR: 60000,
        BTC_XAF: 39357600, // 60000 * 655.96
        EUR_USD: 1.08,
        USD_EUR: 0.92,
        timestamp: new Date().toISOString(),
        fallback: true
      };
    }
  }
  
  // Fonction pour enregistrer un paiement en Bitcoin
  export async function recordBitcoinPayment(transferId: string, transactionHash: string) {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('VITE_SUPABASE_URL not defined');
      }
  
      // Récupérer le token d'authentification
      const token = localStorage.getItem('supabase.auth.token');
      if (!token) {
        throw new Error('User not authenticated');
      }
  
      const response = await fetch(`${supabaseUrl}/functions/v1/bitcoin-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          transferId,
          transactionHash
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Error recording Bitcoin payment: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to record Bitcoin payment:', error);
      throw error;
    }
  }
  
  // Fonction pour convertir un montant en Bitcoin
  export function convertToBitcoin(amount: number, currency: string, bitcoinRates: any) {
    if (!bitcoinRates) {
      throw new Error('Bitcoin rates not available');
    }
    
    // Convertir le montant en BTC selon la devise
    switch (currency) {
      case 'EUR':
        return amount / bitcoinRates.BTC_EUR;
      case 'USD':
        return amount / bitcoinRates.BTC_USD;
      case 'XAF':
        return amount / bitcoinRates.BTC_XAF;
      default:
        throw new Error(`Unsupported currency: ${currency}`);
    }
  }
  
  // Fonction pour valider une adresse Bitcoin
  export function isValidBitcoinAddress(address: string): boolean {
    // Validation simple d'adresse Bitcoin (peut être améliorée)
    const regex = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
    return regex.test(address);
  }