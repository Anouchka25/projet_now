import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, Copy, Check, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from './Auth/AuthProvider';
import { generateTransferReference } from '../lib/utils';
import { generateDepositAddress, checkDepositStatus } from '../lib/binance';
import type { RecipientData } from './RecipientForm';

interface BitcoinPaymentFormProps {
  transferDetails: any;
  recipientDetails: RecipientData;
  onBack: () => void;
  onSubmit: () => void;
  onComplete?: () => void;
  transferComplete?: boolean;
}

const BitcoinPaymentForm: React.FC<BitcoinPaymentFormProps> = ({
  transferDetails,
  recipientDetails,
  onBack,
  onSubmit,
  onComplete,
  transferComplete = false
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bitcoinAddress, setBitcoinAddress] = useState<string>('');
  const [reference, setReference] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'confirmed' | 'failed'>('pending');
  const [countdown, setCountdown] = useState(1800); // 30 minutes in seconds
  const [txId, setTxId] = useState<string | null>(null);

  // Generate a Bitcoin address for payment
  useEffect(() => {
    const generateBitcoinAddress = async () => {
      try {
        setLoading(true);
        const newAddress = await generateDepositAddress();
        setBitcoinAddress(newAddress);
        
        // Generate a unique reference for the transfer
        const newReference = generateTransferReference();
        setReference(newReference);
        
        setLoading(false);
      } catch (err) {
        console.error('Error generating Bitcoin address:', err);
        setError('Erreur lors de la génération de l\'adresse Bitcoin');
        setLoading(false);
      }
    };

    generateBitcoinAddress();
  }, []);

  // Countdown timer
  useEffect(() => {
    if (countdown > 0 && !transferComplete) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown, transferComplete]);

  // Format countdown time as MM:SS
  const formatCountdown = () => {
    const minutes = Math.floor(countdown / 60);
    const seconds = countdown % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Check payment status periodically
  useEffect(() => {
    if (transferComplete || !txId) return;

    const checkPayment = async () => {
      try {
        const status = await checkDepositStatus(txId);
        setPaymentStatus(status);
        
        if (status === 'confirmed') {
          await handleSubmit();
        }
      } catch (err) {
        console.error('Error checking payment status:', err);
      }
    };

    const interval = setInterval(checkPayment, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, [transferComplete, txId]);

  // For demo purposes, simulate a payment after a random time
  useEffect(() => {
    if (transferComplete) return;

    const simulatePayment = () => {
      // Simulate a transaction ID
      const simulatedTxId = `tx-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
      setTxId(simulatedTxId);
      
      // Simulate a payment confirmation after a random time
      const randomDelay = Math.floor(Math.random() * 30000) + 10000; // 10-40 seconds
      setTimeout(() => {
        setPaymentStatus('confirmed');
        handleSubmit();
      }, randomDelay);
    };

    // Simulate a payment after 15 seconds
    const timer = setTimeout(simulatePayment, 15000);
    return () => clearTimeout(timer);
  }, [transferComplete]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const refreshAddress = async () => {
    setRefreshing(true);
    try {
      const newAddress = await generateDepositAddress();
      setBitcoinAddress(newAddress);
      setRefreshing(false);
    } catch (err) {
      console.error('Error refreshing Bitcoin address:', err);
      setError('Erreur lors du rafraîchissement de l\'adresse Bitcoin');
      setRefreshing(false);
    }
  };

  const handleSubmit = async () => {
    if (!user || !transferDetails || !recipientDetails) return;

    setLoading(true);
    setError(null);

    try {
      // Create new transfer
      const { data: newTransfer, error: transferError } = await supabase
        .from('transfers')
        .insert([{
          reference: reference || generateTransferReference(),
          user_id: user.id,
          amount_sent: transferDetails.amountSent,
          fees: transferDetails.fees,
          kundapay_fees: transferDetails.kundapayFees || transferDetails.fees,
          withdrawal_fees: transferDetails.withdrawalFees || 0,
          withdrawal_fees_included: transferDetails.includeWithdrawalFees || false,
          amount_received: transferDetails.amountReceived,
          sender_currency: transferDetails.senderCurrency,
          receiver_currency: transferDetails.receiverCurrency,
          payment_method: transferDetails.paymentMethod,
          receiving_method: transferDetails.receivingMethod,
          funds_origin: recipientDetails.fundsOrigin,
          transfer_reason: recipientDetails.transferReason,
          direction: transferDetails.direction,
          status: 'pending',
          promo_code_id: transferDetails.promoCodeId,
          terms_accepted: true,
          terms_accepted_at: new Date().toISOString(),
          payment_id: txId
        }])
        .select()
        .single();

      if (transferError) throw transferError;

      // Create beneficiary
      const { error: beneficiaryError } = await supabase
        .from('beneficiaries')
        .insert([{
          transfer_id: newTransfer.id,
          user_id: user.id,
          first_name: recipientDetails.firstName,
          last_name: recipientDetails.lastName,
          email: recipientDetails.email,
          payment_details: {
            phone: recipientDetails.phone,
            address: recipientDetails.address,
            bankDetails: recipientDetails.bankDetails,
            alipayId: recipientDetails.alipayId,
            weroName: recipientDetails.weroName,
            bitcoinAddress: transferDetails.receivingMethod === 'BITCOIN' ? recipientDetails.bitcoinAddress : null,
            fundsOrigin: recipientDetails.fundsOrigin,
            transferReason: recipientDetails.transferReason,
            withdrawalFeesIncluded: transferDetails.includeWithdrawalFees || false
          }
        }]);

      if (beneficiaryError) throw beneficiaryError;

      // Call the onSubmit callback
      onSubmit();
    } catch (err) {
      console.error('Error creating transfer:', err);
      setError(err instanceof Error ? err.message : 'Une erreur est survenue lors de la création du transfert');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-6 sm:py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center px-3 py-1.5 sm:px-4 sm:py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
              >
                <ArrowLeft className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden xs:inline">Retour</span>
              </button>
              <h2 className="text-lg sm:text-2xl font-bold text-gray-900">Paiement Bitcoin</h2>
            </div>

            {/* Détails du transfert */}
            <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
              <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2 sm:mb-4">Détails du transfert</h3>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs sm:text-sm text-gray-600">Montant à envoyer</span>
                  <span className="text-sm sm:text-base font-medium text-gray-900">
                    {transferDetails.amountSent.toLocaleString('fr-FR', { maximumFractionDigits: 8 })} {transferDetails.senderCurrency}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-xs sm:text-sm text-gray-600">Frais</span>
                  <span className="text-sm sm:text-base font-medium text-gray-900">
                    {transferDetails.fees.toLocaleString('fr-FR', { maximumFractionDigits: 8 })} {transferDetails.senderCurrency}
                  </span>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                  <span className="text-xs sm:text-sm text-gray-600">Montant à recevoir</span>
                  <span className="text-sm sm:text-base font-bold text-green-600">
                    {transferDetails.amountReceived.toLocaleString('fr-FR', { maximumFractionDigits: 8 })} {transferDetails.receiverCurrency}
                  </span>
                </div>
              </div>
            </div>

            {/* Bénéficiaire */}
            <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
              <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2 sm:mb-4">Bénéficiaire</h3>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs sm:text-sm text-gray-600">Nom</span>
                  <span className="text-sm sm:text-base font-medium text-gray-900">
                    {recipientDetails.firstName} {recipientDetails.lastName}
                  </span>
                </div>

                {recipientDetails.email && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs sm:text-sm text-gray-600">Email</span>
                    <span className="text-sm sm:text-base font-medium text-gray-900">
                      {recipientDetails.email}
                    </span>
                  </div>
                )}

                {recipientDetails.bitcoinAddress && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs sm:text-sm text-gray-600">Adresse Bitcoin</span>
                    <span className="text-sm sm:text-base font-medium text-gray-900 truncate max-w-[200px]">
                      {recipientDetails.bitcoinAddress}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Instructions de paiement Bitcoin */}
            <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
              <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2 sm:mb-4">Instructions de paiement Bitcoin</h3>
              
              <div className="flex flex-col items-center space-y-4">
                <div className="bg-white p-4 rounded-lg">
                  <QRCodeSVG 
                    value={`bitcoin:${bitcoinAddress}?amount=${transferDetails.amountSent}`} 
                    size={200} 
                    level="H"
                    includeMargin={true}
                  />
                </div>
                
                <div className="w-full">
                  <p className="text-sm text-gray-700 mb-2">Envoyez exactement:</p>
                  <div className="bg-white p-3 rounded-lg flex justify-between items-center border border-gray-300">
                    <span className="font-mono font-medium">{transferDetails.amountSent.toFixed(8)} BTC</span>
                  </div>
                </div>
                
                <div className="w-full">
                  <p className="text-sm text-gray-700 mb-2">À cette adresse:</p>
                  <div className="bg-white p-3 rounded-lg flex justify-between items-center border border-gray-300">
                    <span className="font-mono text-sm overflow-x-auto">{bitcoinAddress}</span>
                    <button 
                      onClick={() => copyToClipboard(bitcoinAddress)}
                      className="ml-2 p-1 rounded-md hover:bg-gray-100"
                    >
                      {copied ? <Check className="h-5 w-5 text-green-500" /> : <Copy className="h-5 w-5 text-gray-500" />}
                    </button>
                  </div>
                </div>
                
                <div className="w-full flex justify-between items-center">
                  <button
                    onClick={refreshAddress}
                    disabled={refreshing}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                    Nouvelle adresse
                  </button>
                  
                  <div className="text-center">
                    <p className="text-sm text-gray-500 mb-1">Temps restant</p>
                    <p className={`font-mono font-bold text-lg ${countdown < 300 ? 'text-red-500' : 'text-gray-700'}`}>
                      {formatCountdown()}
                    </p>
                  </div>
                </div>
                
                <div className="w-full bg-blue-50 p-3 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-800">
                    <strong>Important:</strong> Envoyez uniquement des BTC à cette adresse. L'envoi d'autres crypto-monnaies entraînera une perte de fonds.
                  </p>
                </div>
                
                <div className="w-full">
                  <p className="text-sm text-gray-700">
                    Statut du paiement: 
                    <span className={`ml-2 font-medium ${
                      paymentStatus === 'confirmed' ? 'text-green-600' : 
                      paymentStatus === 'failed' ? 'text-red-600' : 
                      'text-yellow-600'
                    }`}>
                      {paymentStatus === 'confirmed' ? 'Confirmé' : 
                       paymentStatus === 'failed' ? 'Échoué' : 
                       'En attente de confirmation'}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border-l-4 border-red-400 p-3 sm:p-4 mb-4 sm:mb-6">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {transferComplete ? (
              <div className="bg-green-50 border-l-4 border-green-400 p-3 sm:p-4 mb-4 sm:mb-6">
                <p className="text-sm sm:text-base text-green-700">
                  Votre transfert a été créé avec succès. Vous recevrez une confirmation une fois le paiement validé.
                </p>
                <button
                  onClick={onComplete}
                  className="mt-3 w-full flex justify-center py-2.5 sm:py-3 px-4 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  Retour au tableau de bord
                </button>
              </div>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading || paymentStatus !== 'confirmed'}
                className="w-full flex justify-center py-2.5 sm:py-3 px-4 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50"
              >
                {loading ? 'Traitement en cours...' : 'Confirmer le transfert'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BitcoinPaymentForm;