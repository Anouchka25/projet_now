import { supabase } from './supabase';
import type { TransferDirection, PaymentMethod, ReceivingMethod } from './constants';

// Format currency with proper rounding
export function formatCurrency(amount: number, currency: string): string {
  if (!amount || isNaN(amount)) {
    return '0,00';
  }
  
  if (currency === 'XAF') {
    // Round to nearest 5 for FCFA
    const roundedAmount = Math.round(amount / 5) * 5;
    return roundedAmount.toLocaleString('fr-FR');
  }

  if (currency === 'BTC') {
    // Format BTC with 8 decimal places
    return amount.toLocaleString('fr-FR', {
      minimumFractionDigits: 8,
      maximumFractionDigits: 8
    });
  }


  // For EUR, USD, CNY, CAD - always show 2 decimal places
  return amount.toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// Generate a transfer reference
export function generateTransferReference(): string {
  const prefix = 'KP';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}${timestamp}${random}`;
}

// Convert country codes to transfer direction
function getTransferDirection(fromCountry: string, toCountry: string): TransferDirection {
  const directionMap: Record<string, Record<string, TransferDirection>> = {
    'GA': {
      'FR': 'GABON_TO_FRANCE',
      'BE': 'GABON_TO_BELGIUM',
      'DE': 'GABON_TO_GERMANY',
      'CN': 'GABON_TO_CHINA',
      'US': 'GABON_TO_USA',
      'CA': 'GABON_TO_CANADA'
    },
    'FR': {
      'GA': 'FRANCE_TO_GABON'
    },
    'BE': {
      'GA': 'BELGIUM_TO_GABON'
    },
    'DE': {
      'GA': 'GERMANY_TO_GABON'
    },
    'US': {
      'GA': 'USA_TO_GABON'
    },
    'CA': {
      'GA': 'CANADA_TO_GABON'
    }
  };

  const direction = directionMap[fromCountry]?.[toCountry];
  if (!direction) {
    throw new Error('Direction de transfert non valide');
  }

  return direction;
}

// Calculate Airtel Money or Moov Money withdrawal fees based on amount
function calculateWithdrawalFees(amount: number, receivingMethod: ReceivingMethod): { 
  totalFees: number, 
  feeDetails: { amount: number, fee: number, description: string }[] 
} {
  const feeDetails: { amount: number, fee: number, description: string }[] = [];
  let totalFees = 0;

  if (receivingMethod === 'AIRTEL_MONEY') {
    // Airtel Money: 
    // - 3% up to 166,670 XAF
    // - Fixed 5,000 XAF for amounts between 166,671 and 500,000 XAF
    // - For amounts over 500,000 XAF, split into tranches
    if (amount <= 166670) {
      const fee = Math.round(amount * 0.03 / 5) * 5; // Round to nearest 5
      totalFees = fee;
      feeDetails.push({ 
        amount: amount, 
        fee: fee, 
        description: `3% sur ${Math.round(amount).toLocaleString('fr-FR')} XAF` 
      });
    } else if (amount <= 500000) {
      totalFees = 5000;
      feeDetails.push({ 
        amount: amount, 
        fee: 5000, 
        description: `Frais fixes pour montant entre 166 671 et 500 000 XAF` 
      });
    } else {
      // For amounts over 500,000 XAF, split into tranches
      const fullTranches = Math.floor(amount / 500000);
      const remainder = amount % 500000;
      
      // Add full tranches
      if (fullTranches > 0) {
        const trancheFee = fullTranches * 5000;
        totalFees += trancheFee;
        feeDetails.push({ 
          amount: fullTranches * 500000, 
          fee: trancheFee, 
          description: `${fullTranches} tranche(s) de 500 000 XAF à 5 000 XAF chacune` 
        });
      }
      
      // Add remainder
      if (remainder > 0) {
        let remainderFee = 0;
        if (remainder <= 166670) {
          remainderFee = Math.round(remainder * 0.03 / 5) * 5; // Round to nearest 5
          feeDetails.push({ 
            amount: remainder, 
            fee: remainderFee, 
            description: `3% sur le reste de ${Math.round(remainder).toLocaleString('fr-FR')} XAF` 
          });
        } else {
          remainderFee = 5000;
          feeDetails.push({ 
            amount: remainder, 
            fee: remainderFee, 
            description: `Frais fixes pour le reste entre 166 671 et 500 000 XAF` 
          });
        }
        totalFees += remainderFee;
      }
    }
  } else if (receivingMethod === 'MOOV_MONEY') {
    // Moov Money: 
    // - 3% up to 160,000 XAF
    // - Fixed 5,000 XAF for amounts between 160,001 and 500,000 XAF
    // - For amounts over 500,000 XAF, split into tranches
    if (amount <= 160000) {
      const fee = Math.round(amount * 0.03 / 5) * 5; // Round to nearest 5
      totalFees = fee;
      feeDetails.push({ 
        amount: amount, 
        fee: fee, 
        description: `3% sur ${Math.round(amount).toLocaleString('fr-FR')} XAF` 
      });
    } else if (amount <= 500000) {
      totalFees = 5000;
      feeDetails.push({ 
        amount: amount, 
        fee: 5000, 
        description: `Frais fixes pour montant entre 160 001 et 500 000 XAF` 
      });
    } else {
      // For amounts over 500,000 XAF, split into tranches
      const fullTranches = Math.floor(amount / 500000);
      const remainder = amount % 500000;
      
      // Add full tranches
      if (fullTranches > 0) {
        const trancheFee = fullTranches * 5000;
        totalFees += trancheFee;
        feeDetails.push({ 
          amount: fullTranches * 500000, 
          fee: trancheFee, 
          description: `${fullTranches} tranche(s) de 500 000 XAF à 5 000 XAF chacune` 
        });
      }
      
      // Add remainder
      if (remainder > 0) {
        let remainderFee = 0;
        if (remainder <= 160000) {
          remainderFee = Math.round(remainder * 0.03 / 5) * 5; // Round to nearest 5
          feeDetails.push({ 
            amount: remainder, 
            fee: remainderFee, 
            description: `3% sur le reste de ${Math.round(remainder).toLocaleString('fr-FR')} XAF` 
          });
        } else {
          remainderFee = 5000;
          feeDetails.push({ 
            amount: remainder, 
            fee: remainderFee, 
            description: `Frais fixes pour le reste entre 160 001 et 500 000 XAF` 
          });
        }
        totalFees += remainderFee;
      }
    }
  }
  
  // Ensure total fees are rounded to nearest 5
  totalFees = Math.round(totalFees / 5) * 5;
  
  return { totalFees, feeDetails };
}

// Calculate transfer details
export async function calculateTransferDetails(
  amount: number,
  direction: string,
  paymentMethod: PaymentMethod,
  receivingMethod: ReceivingMethod,
  isReceiveAmount: boolean = false,
  promoCode?: string,
  includeWithdrawalFees: boolean = false
) {
  try {
    // Validate amount
    if (!amount || isNaN(amount) || amount <= 0) {
      throw new Error('Le montant doit être supérieur à 0');
    }

    // Parse direction into from/to countries
    const [fromCountry, toCountry] = direction.split('_TO_').map(part => {
      switch (part) {
        case 'GABON': return 'GA';
        case 'FRANCE': return 'FR';
        case 'BELGIUM': return 'BE';
        case 'GERMANY': return 'DE';
        case 'CHINA': return 'CN';
        case 'USA': return 'US';
        case 'CANADA': return 'CA';
        default: throw new Error('Pays non valide dans la direction');
      }
    });

    // Convert to standard direction format
    const standardDirection = getTransferDirection(fromCountry, toCountry);

    // Determine currencies
    let fromCurrency: string, toCurrency: string;
    switch (fromCountry) {
      case 'FR':
      case 'BE':
      case 'DE':
        fromCurrency = 'EUR';
        break;
      case 'US':
        fromCurrency = 'USD';
        break;
      case 'CA':
        fromCurrency = 'CAD';
        break;
      case 'CN':
        fromCurrency = 'CNY';
        break;
      default:
        fromCurrency = 'XAF';
    }
    
    switch (toCountry) {
      case 'FR':
      case 'BE':
      case 'DE':
        toCurrency = 'EUR';
        break;
      case 'US':
        toCurrency = 'USD';
        break;
      case 'CA':
        toCurrency = 'CAD';
        break;
      case 'CN':
        toCurrency = 'CNY';
        break;
      default:
        toCurrency = 'XAF';
    }

    // Get exchange rate from database
    const { data: exchangeRateData, error: exchangeRateError } = await supabase
      .from('exchange_rates')
      .select('rate')
      .eq('from_currency', fromCurrency)
      .eq('to_currency', toCurrency)
      .single();

    if (exchangeRateError || !exchangeRateData) {
      throw new Error(`Taux de change non disponible (${fromCurrency} → ${toCurrency})`);
    }

    const exchangeRate = exchangeRateData.rate;

    // Get fees from database
    const { data: fees, error: feesError } = await supabase
      .from('transfer_fees')
      .select('fee_percentage')
      .eq('from_country', fromCountry)
      .eq('to_country', toCountry)
      .eq('payment_method', paymentMethod)
      .eq('receiving_method', receivingMethod)
      .single();

    if (feesError) {
      console.error('Error fetching fees:', feesError);
      throw new Error(`Frais non disponibles pour cette combinaison (${fromCountry} → ${toCountry})`);
    }

    if (!fees) {
      throw new Error(`Frais non disponibles pour cette combinaison (${fromCountry} → ${toCountry})`);
    }

    let feePercentage = fees.fee_percentage;
    let effectiveFeePercentage = feePercentage;
    
    // Apply promo code if provided
    let promoCodeId = null;
    if (promoCode) {
      try {
        const { data: validation, error: validationError } = await supabase
          .rpc('validate_promo_code', {
            code_text: promoCode,
            transfer_direction: standardDirection
          });

        if (validationError) {
          console.error('Promo code validation error:', validationError);
          throw new Error('Erreur lors de la validation du code promo');
        }

        if (!validation || !validation[0]) {
          throw new Error('Code promo invalide');
        }

        const promoValidation = validation[0];
        if (!promoValidation.valid) {
          throw new Error(promoValidation.message || 'Code promo invalide');
        }

        // Apply discount to KundaPay fees only
        if (promoValidation.discount_type === 'PERCENTAGE') {
          effectiveFeePercentage *= (1 - promoValidation.discount_value / 100);
        } else if (promoValidation.discount_type === 'FIXED') {
          // Pour les réductions fixes, on les convertit en pourcentage basé sur le montant
          const fixedDiscount = promoValidation.discount_value / amount;
          effectiveFeePercentage = Math.max(0, effectiveFeePercentage - fixedDiscount);
        }

        // Get promo code ID for tracking
        const { data: promoData } = await supabase
          .from('promo_codes')
          .select('id')
          .eq('code', promoCode)
          .eq('direction', standardDirection)
          .single();

        if (promoData) {
          promoCodeId = promoData.id;
        }
      } catch (error) {
        if (error instanceof Error) {
          throw error;
        } else {
          throw new Error('Erreur lors de la validation du code promo');
        }
      }
    }

    let amountSent: number;
    let amountReceived: number;
    let kundapayFees: number;
    let withdrawalFees: number = 0;
    let withdrawalFeesDetails: { amount: number, fee: number, description: string }[] = [];
    let totalFees: number;

    // Calculate withdrawal fees if applicable
    if (includeWithdrawalFees && toCountry === 'GA' && 
        (receivingMethod === 'AIRTEL_MONEY' || receivingMethod === 'MOOV_MONEY')) {
      
      if (isReceiveAmount) {
        // For receive amount, we need to calculate backwards
        amountReceived = amount;
        
        // First, calculate the amount without withdrawal fees
        const baseAmountSent = amount / (exchangeRate * (1 - effectiveFeePercentage));
        
        // Calculate KundaPay fees
        kundapayFees = baseAmountSent * effectiveFeePercentage;
        
        // Calculate the amount that would be received without KundaPay fees
        const amountAfterKundapayFees = baseAmountSent - kundapayFees;
        const amountReceivedBeforeWithdrawalFees = amountAfterKundapayFees * exchangeRate;
        
        // Then calculate the withdrawal fees based on the received amount in XAF
        const withdrawalFeeResult = calculateWithdrawalFees(amountReceivedBeforeWithdrawalFees, receivingMethod);
        withdrawalFees = withdrawalFeeResult.totalFees;
        withdrawalFeesDetails = withdrawalFeeResult.feeDetails;
        
        // Convert withdrawal fees to sender currency
        const withdrawalFeesInSenderCurrency = withdrawalFees / exchangeRate;
        
        // Add withdrawal fees to the amount sent
        amountSent = baseAmountSent + withdrawalFeesInSenderCurrency;
        
        // Total fees
        totalFees = kundapayFees + withdrawalFeesInSenderCurrency;
      } else {
        // For send amount
        amountSent = amount;
        
        // Calculate KundaPay fees
        kundapayFees = amount * effectiveFeePercentage;
        
        // Calculate the amount that would be received without withdrawal fees
        const amountAfterKundapayFees = amount - kundapayFees;
        const baseAmountReceived = amountAfterKundapayFees * exchangeRate;
        
        // Calculate withdrawal fees based on the received amount
        const withdrawalFeeResult = calculateWithdrawalFees(baseAmountReceived, receivingMethod);
        withdrawalFees = withdrawalFeeResult.totalFees;
        withdrawalFeesDetails = withdrawalFeeResult.feeDetails;
        
        // Adjust the amount received by subtracting the withdrawal fees
        amountReceived = baseAmountReceived - withdrawalFees;
        
        // Convert withdrawal fees to sender currency
        const withdrawalFeesInSenderCurrency = withdrawalFees / exchangeRate;
        
        // Total fees
        totalFees = kundapayFees + withdrawalFeesInSenderCurrency;
      }
    } else {
      // Standard calculation without withdrawal fees
      if (isReceiveAmount) {
        // Calculate from receive amount
        amountReceived = amount;
        amountSent = amount / (exchangeRate * (1 - effectiveFeePercentage));
        kundapayFees = amountSent * effectiveFeePercentage;
        totalFees = kundapayFees;
      } else {
        // Calculate from send amount
        amountSent = amount;
        kundapayFees = amount * effectiveFeePercentage;
        amountReceived = (amount - kundapayFees) * exchangeRate;
        totalFees = kundapayFees;
      }
    }

    // Validate transfer limits
    if (fromCountry === 'GA') {
      // For transfers from Gabon, validate against the current limit
      const { data: validationData, error: validationError } = await supabase
        .rpc('validate_transfer_amount', {
          amount: amountSent,
          direction: standardDirection
        });

      if (validationError) {
        console.error('Error validating transfer amount:', validationError);
        throw new Error('Erreur lors de la validation du montant');
      }

      if (validationData && validationData.length > 0 && !validationData[0].valid) {
        throw new Error(validationData[0].message);
      }
    } else if (toCountry === 'GA') {
      // For transfers to Gabon, validate against the current limit
      const { data: validationData, error: validationError } = await supabase
        .rpc('validate_transfer_amount', {
          amount: amountSent,
          direction: standardDirection
        });

      if (validationError) {
        console.error('Error validating transfer amount:', validationError);
        throw new Error('Erreur lors de la validation du montant');
      }

      if (validationData && validationData.length > 0 && !validationData[0].valid) {
        throw new Error(validationData[0].message);
      }
    }

    // Round amounts according to currency
    if (fromCurrency === 'XAF') {
      amountSent = Math.ceil(amountSent / 5) * 5;
      kundapayFees = Math.ceil(kundapayFees / 5) * 5;
      totalFees = Math.ceil(totalFees / 5) * 5;
    }
    if (toCurrency === 'XAF') {
      amountReceived = Math.floor(amountReceived / 5) * 5;
      withdrawalFees = Math.ceil(withdrawalFees / 5) * 5;
    }

    return {
      amountSent: Number(amountSent.toFixed(2)),
      kundapayFees: Number(kundapayFees.toFixed(2)),
      withdrawalFees: Number((withdrawalFees / exchangeRate).toFixed(2)),
      withdrawalFeesDetails,
      fees: Number(totalFees.toFixed(2)),
      amountReceived: Number(amountReceived.toFixed(2)),
      senderCurrency: fromCurrency,
      receiverCurrency: toCurrency,
      exchangeRate: Number(exchangeRate.toFixed(4)),
      direction: standardDirection,
      paymentMethod,
      receivingMethod,
      promoCodeId,
      originalFeePercentage: feePercentage,
      effectiveFeePercentage,
      includeWithdrawalFees
    };
  } catch (error) {
    console.error('Error in calculateTransferDetails:', error);
    throw error instanceof Error ? error : new Error('Une erreur inattendue est survenue');
  }
}