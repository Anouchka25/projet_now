export function calculateTransferDetails(
  amount: number,
  direction: string,
  paymentMethod: string,
  receivingMethod: string,
  isReceiveAmount: boolean = false,
  promoCode?: string,
  includeWithdrawalFees: boolean = false
) {
  // Taux de change simplifiés pour la démo
  const exchangeRates = {
    'EUR_XAF': 655.96,
    'XAF_EUR': 1/655.96,
    'EUR_CNY': 7.5099,
    'CNY_EUR': 1/7.5099,
    'XAF_CNY': 0.011445,
    'CNY_XAF': 87.34,
    'USD_XAF': 610.35,
    'XAF_USD': 1/610.35,
    'CAD_XAF': 452.78,
    'XAF_CAD': 1/452.78,
    'USD_EUR': 0.93,
    'EUR_USD': 1.075269,
    'CAD_EUR': 0.69,
    'EUR_CAD': 1.449275
  };

  // Frais simplifiés pour la démo
  const fees = {
    'FRANCE_TO_GABON': 0.005,
    'BELGIUM_TO_GABON': 0.005,
    'GERMANY_TO_GABON': 0.005,
    'USA_TO_GABON': 0.005,
    'CANADA_TO_GABON': 0.005,
    'GABON_TO_FRANCE': 0.07,
    'GABON_TO_BELGIUM': 0.07,
    'GABON_TO_GERMANY': 0.07,
    'GABON_TO_CHINA': 0.085,
    'GABON_TO_USA': 0.075,
    'GABON_TO_CANADA': 0.075
  };

  // Déterminer les devises
  let fromCurrency, toCurrency;
  switch (direction) {
    case 'GABON_TO_CHINA':
      fromCurrency = 'XAF';
      toCurrency = 'CNY';
      break;
    case 'FRANCE_TO_GABON':
    case 'BELGIUM_TO_GABON':
    case 'GERMANY_TO_GABON':
      fromCurrency = 'EUR';
      toCurrency = 'XAF';
      break;
    case 'GABON_TO_FRANCE':
    case 'GABON_TO_BELGIUM':
    case 'GABON_TO_GERMANY':
      fromCurrency = 'XAF';
      toCurrency = 'EUR';
      break;
    case 'USA_TO_GABON':
      fromCurrency = 'USD';
      toCurrency = 'XAF';
      break;
    case 'GABON_TO_USA':
      fromCurrency = 'XAF';
      toCurrency = 'USD';
      break;
    case 'CANADA_TO_GABON':
      fromCurrency = 'CAD';
      toCurrency = 'XAF';
      break;
    case 'GABON_TO_CANADA':
      fromCurrency = 'XAF';
      toCurrency = 'CAD';
      break;
    default:
      throw new Error('Direction de transfert non valide');
  }

  // Calculer le taux de change
  const exchangeRate = exchangeRates[`${fromCurrency}_${toCurrency}`];
  const fee = fees[direction];

  // Appliquer la réduction du code promo si applicable
  let effectiveFeePercentage = fee;
  if (promoCode) {
    // Simuler une réduction de 50% sur les frais pour les codes promo
    effectiveFeePercentage = fee * 0.5;
  }

  let amountSent, amountReceived, kundapayFees, withdrawalFees = 0;
  let withdrawalFeesDetails = [];

  // Calculer les frais de retrait Airtel/Moov Money si applicable
  if (includeWithdrawalFees && toCurrency === 'XAF' && 
      (receivingMethod === 'AIRTEL_MONEY' || receivingMethod === 'MOOV_MONEY')) {
    
    // Fonction simplifiée pour calculer les frais de retrait
    const calculateWithdrawalFees = (amount) => {
      let totalFees = 0;
      let details = [];
      
      if (amount <= 166670) {
        const fee = Math.round(amount * 0.03 / 5) * 5;
        totalFees = fee;
        details.push({ amount, fee, description: `3% sur ${Math.round(amount).toLocaleString('fr-FR')} XAF` });
      } else if (amount <= 500000) {
        totalFees = 5000;
        details.push({ amount, fee: 5000, description: `Frais fixes pour montant entre 166 671 et 500 000 XAF` });
      } else {
        const fullTranches = Math.floor(amount / 500000);
        const remainder = amount % 500000;
        
        if (fullTranches > 0) {
          const trancheFee = fullTranches * 5000;
          totalFees += trancheFee;
          details.push({ 
            amount: fullTranches * 500000, 
            fee: trancheFee, 
            description: `${fullTranches} tranche(s) de 500 000 XAF à 5 000 XAF chacune` 
          });
        }
        
        if (remainder > 0) {
          let remainderFee = 0;
          if (remainder <= 166670) {
            remainderFee = Math.round(remainder * 0.03 / 5) * 5;
            details.push({ 
              amount: remainder, 
              fee: remainderFee, 
              description: `3% sur le reste de ${Math.round(remainder).toLocaleString('fr-FR')} XAF` 
            });
          } else {
            remainderFee = 5000;
            details.push({ 
              amount: remainder, 
              fee: remainderFee, 
              description: `Frais fixes pour le reste entre 166 671 et 500 000 XAF` 
            });
          }
          totalFees += remainderFee;
        }
      }
      
      return { totalFees, details };
    };
    
    if (isReceiveAmount) {
      // Pour le montant à recevoir, on calcule d'abord sans les frais de retrait
      amountReceived = amount;
      
      // Calculer le montant envoyé sans les frais de retrait
      const baseAmountSent = amount / (exchangeRate * (1 - effectiveFeePercentage));
      
      // Calculer les frais KundaPay
      kundapayFees = baseAmountSent * effectiveFeePercentage;
      
      // Calculer le montant qui serait reçu sans les frais KundaPay
      const amountAfterKundapayFees = baseAmountSent - kundapayFees;
      const amountReceivedBeforeWithdrawalFees = amountAfterKundapayFees * exchangeRate;
      
      // Calculer les frais de retrait
      const withdrawalFeeResult = calculateWithdrawalFees(amountReceivedBeforeWithdrawalFees);
      withdrawalFees = withdrawalFeeResult.totalFees;
      withdrawalFeesDetails = withdrawalFeeResult.details;
      
      // Convertir les frais de retrait en devise d'envoi
      const withdrawalFeesInSenderCurrency = withdrawalFees / exchangeRate;
      
      // Ajouter les frais de retrait au montant envoyé
      amountSent = baseAmountSent + withdrawalFeesInSenderCurrency;
      
      // Total des frais
      const totalFees = kundapayFees + withdrawalFeesInSenderCurrency;
    } else {
      // Pour le montant à envoyer
      amountSent = amount;
      
      // Calculer les frais KundaPay
      kundapayFees = amount * effectiveFeePercentage;
      
      // Calculer le montant qui serait reçu sans les frais de retrait
      const amountAfterKundapayFees = amount - kundapayFees;
      const baseAmountReceived = amountAfterKundapayFees * exchangeRate;
      
      // Calculer les frais de retrait
      const withdrawalFeeResult = calculateWithdrawalFees(baseAmountReceived);
      withdrawalFees = withdrawalFeeResult.totalFees;
      withdrawalFeesDetails = withdrawalFeeResult.details;
      
      // Ajuster le montant reçu en soustrayant les frais de retrait
      amountReceived = baseAmountReceived - withdrawalFees;
      
      // Convertir les frais de retrait en devise d'envoi
      const withdrawalFeesInSenderCurrency = withdrawalFees / exchangeRate;
      
      // Total des frais
      const totalFees = kundapayFees + withdrawalFeesInSenderCurrency;
    }
  } else {
    // Calcul standard sans frais de retrait
    if (isReceiveAmount) {
      // Calculer à partir du montant à recevoir
      amountReceived = amount;
      amountSent = amount / (exchangeRate * (1 - effectiveFeePercentage));
      kundapayFees = amountSent * effectiveFeePercentage;
    } else {
      // Calculer à partir du montant à envoyer
      amountSent = amount;
      kundapayFees = amount * effectiveFeePercentage;
      amountReceived = (amount - kundapayFees) * exchangeRate;
    }
  }

  // Arrondir les montants
  if (fromCurrency === 'XAF') {
    amountSent = Math.ceil(amountSent / 5) * 5;
    kundapayFees = Math.ceil(kundapayFees / 5) * 5;
  }
  if (toCurrency === 'XAF') {
    amountReceived = Math.floor(amountReceived / 5) * 5;
    withdrawalFees = Math.ceil(withdrawalFees / 5) * 5;
  }

  const totalFees = kundapayFees + (withdrawalFees / exchangeRate);

  return {
    amountSent,
    kundapayFees,
    withdrawalFees: withdrawalFees / exchangeRate,
    withdrawalFeesDetails,
    fees: totalFees,
    amountReceived,
    senderCurrency: fromCurrency,
    receiverCurrency: toCurrency,
    exchangeRate,
    direction,
    paymentMethod,
    receivingMethod,
    promoCode,
    effectiveFeePercentage,
    includeWithdrawalFees
  };
}