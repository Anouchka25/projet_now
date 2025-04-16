import React, { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { generateTransferReference } from '../lib/utils';
import { useAuth } from './Auth/AuthProvider';
import type { RecipientData } from './RecipientForm';


interface PaymentFormProps {
  transferDetails: any;
  recipientDetails: RecipientData;
  onBack: () => void;
  onSubmit: () => void;
  onComplete?: () => void;
  transferComplete?: boolean;
}

const PaymentForm: React.FC<PaymentFormProps> = ({
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
  const [reference, setReference] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false); // Prevent duplicate submissions
  const [showConfirmation, setShowConfirmation] = useState(false);

  useEffect(() => {
    // Check if screen is mobile
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  /* useEffect(() => {
    if (transferComplete && onComplete) {
      onComplete();
    }
  }, [transferComplete, onComplete]); */

  const getPaymentInstructions = () => {
    switch (transferDetails.paymentMethod) {
      case 'AIRTEL_MONEY':
        return (
          <div>
            <p className="text-sm sm:text-base text-gray-700 mb-2">
              Pour finaliser votre transfert, veuillez :
            </p>
            <ol className="list-decimal pl-5 space-y-1 text-sm sm:text-base text-gray-700">
              <li>Ouvrir l'application Airtel Money</li>
              <li>Envoyer {transferDetails.amountSent.toLocaleString('fr-FR')} {transferDetails.senderCurrency} au numéro <span className="font-medium">074186037</span></li>
              <li>Le compte est au nom de <span className="font-medium">Anouchka MINKOUE OBAME</span></li>
            </ol>
          </div>
        );
      case 'MOOV_MONEY':
        return (
          <div>
            <p className="text-sm sm:text-base text-gray-700 mb-2">
              Pour finaliser votre transfert, veuillez :
            </p>
            <ol className="list-decimal pl-5 space-y-1 text-sm sm:text-base text-gray-700">
              <li>Ouvrir l'application Moov Money</li>
              <li>Envoyer {transferDetails.amountSent.toLocaleString('fr-FR')} {transferDetails.senderCurrency} au numéro <span className="font-medium">062123456</span></li>
              <li>Le compte est au nom de <span className="font-medium">Anouchka MINKOUE OBAME</span></li>
            </ol>
          </div>
        );
      case 'WERO':
        return (
          <div>
            <p className="text-sm sm:text-base text-gray-700 mb-2">
              Pour finaliser votre transfert, veuillez :
            </p>
            <ol className="list-decimal pl-5 space-y-1 text-sm sm:text-base text-gray-700">
              <li>Ouvrir l'application Wero</li>
              <li>Envoyer {transferDetails.amountSent.toLocaleString('fr-FR')} {transferDetails.senderCurrency} au numéro <span className="font-medium">+33 6 58 89 85 31</span></li>
              <li>Le compte est au nom de <span className="font-medium">Anouchka MINKOUE OBAME</span></li>
            </ol>
          </div>
        );
      case 'PAYPAL':
        return (
          <div>
            <p className="text-sm sm:text-base text-gray-700 mb-2">
              Pour finaliser votre transfert, veuillez :
            </p>
            <ol className="list-decimal pl-5 space-y-1 text-sm sm:text-base text-gray-700">
              <li>Connectez-vous à votre compte PayPal</li>
              <li>Envoyez {transferDetails.amountSent.toLocaleString('fr-FR')} {transferDetails.senderCurrency} à :</li>
              <li className="ml-5">Email : <span className="font-medium">minkoueobamea@gmail.com</span></li>
              <li className="ml-5">Numéro : <span className="font-medium">+33 6 58 89 85 31</span></li>
              <li>Le compte est au nom de <span className="font-medium">Anouchka MINKOUE OBAME</span></li>
            </ol>
          </div>
        );
      case 'BANK_TRANSFER':
        return (
          <div>
            <p className="text-sm sm:text-base text-gray-700 mb-2">
              Pour finaliser votre transfert, veuillez effectuer un virement bancaire aux coordonnées suivantes :
            </p>
            <div className="bg-gray-50 p-3 rounded-md text-sm sm:text-base">
              <p><span className="font-medium">Bénéficiaire :</span> Anouchka MINKOUE OBAME</p>
              <p><span className="font-medium">IBAN :</span> FR76 1142 5009 0004 2564 3497 042</p>
              <p><span className="font-medium">BIC :</span> CEPAFRPP142</p>
              <p><span className="font-medium">Banque :</span> Caisse d'Epargne</p>
              <p><span className="font-medium">Montant :</span> {transferDetails.amountSent.toLocaleString('fr-FR')} {transferDetails.senderCurrency}</p>
              <p><span className="font-medium">Référence :</span> {reference || 'KP-TRANSFER'}</p>
            </div>
          </div>
        );
        case 'CARD':
          return (
            <p className="text-sm text-gray-700">
              Redirection en cours vers le paiement sécurisé...
            </p>
          );
                
      default:
        return (
          <p className="text-sm sm:text-base text-gray-700">
            Veuillez contacter notre service client pour obtenir les instructions de paiement.
          </p>
        );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSubmitting) return; // Prevent duplicate submissions
    
    if (!user || !transferDetails || !recipientDetails) {
      setError('Vous devez être connecté pour effectuer un transfert');
      return;
    }

    setLoading(true);
    setError(null);
    setIsSubmitting(true); // Set flag to prevent duplicate submissions

    try {
      // Generate a unique reference
      const newReference = generateTransferReference();
      setReference(newReference);
      
      // Create the transfer
      const { data: newTransfer, error: transferError } = await supabase
        .from('transfers')
        .insert([{
          reference: newReference,
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
          terms_accepted_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (transferError) throw transferError;

      // Create the beneficiary
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
            fundsOrigin: recipientDetails.fundsOrigin,
            transferReason: recipientDetails.transferReason,
            withdrawalFeesIncluded: transferDetails.includeWithdrawalFees || false
          }
        }]);

      if (beneficiaryError) throw beneficiaryError;

      if (transferDetails.paymentMethod === 'CARD') {
        const response = await fetch('/api/create-checkout-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: Math.round(transferDetails.amountSent * 100), // en centimes
            currency: transferDetails.senderCurrency.toLowerCase(),
            reference: newReference
          }),
        });
      
        const text = await response.text();
        try {
          const result = JSON.parse(text);
          if (result.redirect_url) {
            window.location.href = result.redirect_url;
            return; // on arrête là
          } else {
            throw new Error("Pas de lien de redirection retourné par Checkout");
          }
        } catch (e) {
          console.error("❌ Réponse non valide :", text);
          throw e;
        }
      }
      

      // Show confirmation page
      setShowConfirmation(true);
      
      // Call the onSubmit callback
      onSubmit();
    } catch (err) {
      console.error('Error creating transfer:', err);
      setError(err instanceof Error ? err.message : 'Une erreur est survenue lors de la création du transfert');
    } finally {
      setLoading(false);
      setIsSubmitting(false); // Reset submission flag
    }
  };

  // Confirmation page after transfer is created
  if (showConfirmation) {
    return (
      <div className="min-h-screen bg-gray-50 py-6 sm:py-12">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="p-4 sm:p-6">
              <div className="mb-6 text-center">
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Transfert confirmé</h2>
                <p className="mt-2 text-sm sm:text-base text-gray-600">
                  Votre transfert a été créé avec succès. Veuillez suivre les instructions ci-dessous pour finaliser le paiement.
                </p>
              </div>

              {/* Détails du transfert */}
              <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
                <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2 sm:mb-4">Détails du transfert</h3>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs sm:text-sm text-gray-600">Référence</span>
                    <span className="text-sm sm:text-base font-medium text-gray-900">
                      {reference}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-xs sm:text-sm text-gray-600">Montant à envoyer</span>
                    <span className="text-sm sm:text-base font-medium text-gray-900">
                      {transferDetails.amountSent.toLocaleString('fr-FR')} {transferDetails.senderCurrency}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-xs sm:text-sm text-gray-600">Frais</span>
                    <span className="text-sm sm:text-base font-medium text-gray-900">
                      {transferDetails.fees.toLocaleString('fr-FR')} {transferDetails.senderCurrency}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                    <span className="text-xs sm:text-sm text-gray-600">Montant à recevoir</span>
                    <span className="text-sm sm:text-base font-bold text-green-600">
                      {transferDetails.amountReceived.toLocaleString('fr-FR')} {transferDetails.receiverCurrency}
                    </span>
                  </div>
                  
                  {/* Frais de retrait */}
                  {transferDetails.includeWithdrawalFees && (
                    <div className="pt-2 border-t border-gray-100">
                      <p className="text-xs sm:text-sm text-green-600">
                        ✓ Frais de retrait {transferDetails.receivingMethod === 'AIRTEL_MONEY' ? 'Airtel Money' : 'Moov Money'} inclus
                      </p>
                    </div>
                  )}
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

                  {recipientDetails.phone && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs sm:text-sm text-gray-600">Téléphone</span>
                      <span className="text-sm sm:text-base font-medium text-gray-900">
                        {recipientDetails.phone}
                      </span>
                    </div>
                  )}

                  {recipientDetails.alipayId && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs sm:text-sm text-gray-600">ID Alipay</span>
                      <span className="text-sm sm:text-base font-medium text-gray-900">
                        {recipientDetails.alipayId}
                      </span>
                    </div>
                  )}

                  {recipientDetails.weroName && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs sm:text-sm text-gray-600">Nom Wero</span>
                      <span className="text-sm sm:text-base font-medium text-gray-900">
                        {recipientDetails.weroName}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Instructions de paiement */}
              <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
                <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2 sm:mb-4">Instructions de paiement</h3>
                {getPaymentInstructions()}
              </div>

              <button
                onClick={onComplete}
                className="w-full flex justify-center py-2.5 sm:py-3 px-4 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Aller au tableau de bord
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
              <h2 className="text-lg sm:text-2xl font-bold text-gray-900">Paiement</h2>
            </div>

            {/* Détails du transfert */}
            <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
              <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2 sm:mb-4">Détails du transfert</h3>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs sm:text-sm text-gray-600">Montant à envoyer</span>
                  <span className="text-sm sm:text-base font-medium text-gray-900">
                    {transferDetails.amountSent.toLocaleString('fr-FR')} {transferDetails.senderCurrency}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-xs sm:text-sm text-gray-600">Frais</span>
                  <span className="text-sm sm:text-base font-medium text-gray-900">
                    {transferDetails.fees.toLocaleString('fr-FR')} {transferDetails.senderCurrency}
                  </span>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                  <span className="text-xs sm:text-sm text-gray-600">Montant à recevoir</span>
                  <span className="text-sm sm:text-base font-bold text-green-600">
                    {transferDetails.amountReceived.toLocaleString('fr-FR')} {transferDetails.receiverCurrency}
                  </span>
                </div>
                
                {/* Frais de retrait */}
                {transferDetails.includeWithdrawalFees && (
                  <div className="pt-2 border-t border-gray-100">
                    <p className="text-xs sm:text-sm text-green-600">
                      ✓ Frais de retrait {transferDetails.receivingMethod === 'AIRTEL_MONEY' ? 'Airtel Money' : 'Moov Money'} inclus
                    </p>
                  </div>
                )}
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

                {recipientDetails.phone && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs sm:text-sm text-gray-600">Téléphone</span>
                    <span className="text-sm sm:text-base font-medium text-gray-900">
                      {recipientDetails.phone}
                    </span>
                  </div>
                )}

                {recipientDetails.alipayId && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs sm:text-sm text-gray-600">ID Alipay</span>
                    <span className="text-sm sm:text-base font-medium text-gray-900">
                      {recipientDetails.alipayId}
                    </span>
                  </div>
                )}

                {recipientDetails.weroName && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs sm:text-sm text-gray-600">Nom Wero</span>
                    <span className="text-sm sm:text-base font-medium text-gray-900">
                      {recipientDetails.weroName}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border-l-4 border-red-400 p-3 sm:p-4 mb-4 sm:mb-6">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <button
                type="submit"
                disabled={loading || isSubmitting}
                className="w-full flex justify-center py-2.5 sm:py-3 px-4 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50"
              >
                {loading ? 'Traitement en cours...' : 'Confirmer le transfert'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentForm;