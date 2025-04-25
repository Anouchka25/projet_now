import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Linking } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Check } from 'lucide-react-native';

export default function PaymentScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { transferDetails, beneficiaryData } = route.params;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [reference, setReference] = useState(null);

  const handleBack = () => {
    navigation.goBack();
  };

  const generateTransferReference = () => {
    const prefix = 'KP';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}${timestamp}${random}`;
  };

  const getPaymentInstructions = () => {
    switch (transferDetails.paymentMethod) {
      case 'AIRTEL_MONEY':
        return (
          <View>
            <Text style={styles.instructionText}>
              Pour finaliser votre transfert, veuillez :
            </Text>
            <View style={styles.instructionsList}>
              <Text style={styles.instruction}>1. Ouvrir l'application Airtel Money</Text>
              <Text style={styles.instruction}>2. Envoyer {transferDetails.amountSent.toLocaleString('fr-FR')} {transferDetails.senderCurrency} au numéro 074186037</Text>
              <Text style={styles.instruction}>3. Le compte est au nom de Anouchka MINKOUE OBAME</Text>
            </View>
          </View>
        );

      case 'MOOV_MONEY':
        return (
          <View>
            <Text style={styles.instructionText}>
              Pour finaliser votre transfert, veuillez :
            </Text>
            <View style={styles.instructionsList}>
              <Text style={styles.instruction}>1. Ouvrir l'application Moov Money</Text>
              <Text style={styles.instruction}>2. Envoyer {transferDetails.amountSent.toLocaleString('fr-FR')} {transferDetails.senderCurrency} au numéro 062123456</Text>
              <Text style={styles.instruction}>3. Le compte est au nom de Anouchka MINKOUE OBAME</Text>
            </View>
          </View>
        );

      case 'WERO':
        return (
          <View>
            <Text style={styles.instructionText}>
              Pour finaliser votre transfert, veuillez :
            </Text>
            <View style={styles.instructionsList}>
              <Text style={styles.instruction}>1. Ouvrir l'application Wero</Text>
              <Text style={styles.instruction}>2. Envoyer {transferDetails.amountSent.toLocaleString('fr-FR')} {transferDetails.senderCurrency} au numéro +33 6 58 89 85 31</Text>
              <Text style={styles.instruction}>3. Le compte est au nom de Anouchka MINKOUE OBAME</Text>
            </View>
          </View>
        );

      case 'PAYPAL':
        return (
          <View>
            <Text style={styles.instructionText}>
              Pour finaliser votre transfert, veuillez :
            </Text>
            <View style={styles.instructionsList}>
              <Text style={styles.instruction}>1. Connectez-vous à votre compte PayPal</Text>
              <Text style={styles.instruction}>2. Envoyez {transferDetails.amountSent.toLocaleString('fr-FR')} {transferDetails.senderCurrency} à :</Text>
              <Text style={styles.instruction}>   - Email : minkoueobamea@gmail.com</Text>
              <Text style={styles.instruction}>   - Numéro : +33 6 58 89 85 31</Text>
              <Text style={styles.instruction}>3. Le compte est au nom de Anouchka MINKOUE OBAME</Text>
            </View>
          </View>
        );

      case 'BANK_TRANSFER':
        return (
          <View>
            <Text style={styles.instructionText}>
              Pour finaliser votre transfert, veuillez effectuer un virement bancaire aux coordonnées suivantes :
            </Text>
            <View style={styles.bankDetails}>
              <Text style={styles.bankDetail}><Text style={styles.bankDetailLabel}>Bénéficiaire :</Text> Anouchka MINKOUE OBAME</Text>
              <Text style={styles.bankDetail}><Text style={styles.bankDetailLabel}>IBAN :</Text> FR76 1142 5009 0004 2564 3497 042</Text>
              <Text style={styles.bankDetail}><Text style={styles.bankDetailLabel}>BIC :</Text> CEPAFRPP142</Text>
              <Text style={styles.bankDetail}><Text style={styles.bankDetailLabel}>Banque :</Text> Caisse d'Epargne</Text>
              <Text style={styles.bankDetail}><Text style={styles.bankDetailLabel}>Montant :</Text> {transferDetails.amountSent.toLocaleString('fr-FR')} {transferDetails.senderCurrency}</Text>
              <Text style={styles.bankDetail}><Text style={styles.bankDetailLabel}>Référence :</Text> {reference || 'KP-TRANSFER'}</Text>
            </View>
          </View>
        );

      case 'CARD':
        return (
          <View>
            <Text style={styles.instructionText}>
              Redirection en cours vers le paiement sécurisé...
            </Text>
          </View>
        );

      default:
        return (
          <Text style={styles.instructionText}>
            Veuillez contacter notre service client pour obtenir les instructions de paiement.
          </Text>
        );
    }
  };

  const handlePayment = async () => {
    try {
      setLoading(true);
      setError(null);

      // Generate a unique reference
      const newReference = generateTransferReference();
      setReference(newReference);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Utilisateur non connecté');
      }

      // Create the transfer in the database
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
          funds_origin: beneficiaryData.fundsOrigin,
          transfer_reason: beneficiaryData.transferReason,
          direction: transferDetails.direction,
          status: 'pending',
          terms_accepted: true,
          terms_accepted_at: new Date().toISOString()
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
          first_name: beneficiaryData.firstName,
          last_name: beneficiaryData.lastName,
          email: beneficiaryData.email,
          payment_details: {
            phone: beneficiaryData.phone,
            alipayId: beneficiaryData.alipayId,
            weroName: beneficiaryData.weroName,
            fundsOrigin: beneficiaryData.fundsOrigin,
            transferReason: beneficiaryData.transferReason,
            withdrawalFeesIncluded: transferDetails.includeWithdrawalFees || false
          }
        }]);

      if (beneficiaryError) throw beneficiaryError;

      // Show confirmation page
      setShowConfirmation(true);

      // Handle payment method specific actions
      if (transferDetails.paymentMethod === 'PAYPAL') {
        Alert.alert(
          'Instructions de paiement PayPal',
          'Veuillez envoyer le paiement à l\'une des options suivantes :\n\n' +
          '- Email : minkoueobamea@gmail.com\n' +
          '- Numéro : +33 6 58 89 85 31\n\n' +
          'Le compte est au nom de Anouchka MINKOUE OBAME',
          [
            {
              text: 'Ouvrir PayPal',
              onPress: () => Linking.openURL('https://paypal.me/kundapay')
            },
            {
              text: 'OK',
              style: 'cancel'
            }
          ]
        );
      } else if (transferDetails.paymentMethod === 'AIRTEL_MONEY') {
        Alert.alert(
          'Instructions de paiement Airtel Money',
          'Veuillez envoyer le paiement au :\n\n' +
          'Numéro : 074186037\n' +
          'Nom : Anouchka MINKOUE OBAME'
        );
      } else if (transferDetails.paymentMethod === 'MOOV_MONEY') {
        Alert.alert(
          'Instructions de paiement Moov Money',
          'Veuillez envoyer le paiement au :\n\n' +
          'Numéro : 062123456\n' +
          'Nom : Anouchka MINKOUE OBAME'
        );
      } else if (transferDetails.paymentMethod === 'WERO') {
        Alert.alert(
          'Instructions de paiement Wero',
          'Veuillez envoyer le paiement au :\n\n' +
          'Numéro : +33 6 58 89 85 31\n' +
          'Nom : Anouchka MINKOUE OBAME'
        );
      }

    } catch (error) {
      console.error('Erreur:', error);
      setError(error.message || 'Une erreur est survenue lors de la création du transfert');
      Alert.alert('Erreur', 'Une erreur est survenue lors de la création du transfert');
    } finally {
      setLoading(false);
    }
  };

  const handleGoToDashboard = () => {
    navigation.navigate('History');
  };

  // Confirmation page after transfer is created
  if (showConfirmation) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.confirmationCard}>
          <View style={styles.confirmationHeader}>
            <Check size={40} color="#059669" style={styles.confirmationIcon} />
            <Text style={styles.confirmationTitle}>Transfert confirmé</Text>
            <Text style={styles.confirmationSubtitle}>
              Votre transfert a été créé avec succès. Veuillez suivre les instructions ci-dessous pour finaliser le paiement.
            </Text>
          </View>

          {/* Détails du transfert */}
          <View style={styles.detailsSection}>
            <Text style={styles.sectionTitle}>Détails du transfert</Text>
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Référence</Text>
              <Text style={styles.detailValue}>{reference}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Montant à envoyer</Text>
              <Text style={styles.detailValue}>
                {transferDetails.amountSent.toLocaleString('fr-FR')} {transferDetails.senderCurrency}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Frais</Text>
              <Text style={styles.detailValue}>
                {transferDetails.fees.toLocaleString('fr-FR')} {transferDetails.senderCurrency}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Montant à recevoir</Text>
              <Text style={[styles.detailValue, styles.highlightedValue]}>
                {transferDetails.amountReceived.toLocaleString('fr-FR')} {transferDetails.receiverCurrency}
              </Text>
            </View>
            
            {/* Frais de retrait */}
            {transferDetails.includeWithdrawalFees && (
              <View style={styles.withdrawalFeesInfo}>
                <Text style={styles.withdrawalFeesText}>
                  ✓ Frais de retrait inclus
                </Text>
              </View>
            )}
          </View>

          {/* Bénéficiaire */}
          <View style={styles.detailsSection}>
            <Text style={styles.sectionTitle}>Bénéficiaire</Text>
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Nom</Text>
              <Text style={styles.detailValue}>
                {beneficiaryData.firstName} {beneficiaryData.lastName}
              </Text>
            </View>

            {beneficiaryData.email && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Email</Text>
                <Text style={styles.detailValue}>{beneficiaryData.email}</Text>
              </View>
            )}

            {beneficiaryData.phone && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Téléphone</Text>
                <Text style={styles.detailValue}>{beneficiaryData.phone}</Text>
              </View>
            )}

            {beneficiaryData.alipayId && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>ID Alipay</Text>
                <Text style={styles.detailValue}>{beneficiaryData.alipayId}</Text>
              </View>
            )}

            {beneficiaryData.weroName && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Nom Wero</Text>
                <Text style={styles.detailValue}>{beneficiaryData.weroName}</Text>
              </View>
            )}
          </View>

          {/* Instructions de paiement */}
          <View style={styles.instructionsSection}>
            <Text style={styles.sectionTitle}>Instructions de paiement</Text>
            {getPaymentInstructions()}
          </View>

          <TouchableOpacity 
            style={styles.dashboardButton}
            onPress={handleGoToDashboard}
          >
            <Text style={styles.dashboardButtonText}>
              Aller à l'historique des transferts
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <ArrowLeft size={24} color="#4b5563" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Paiement</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Détails du transfert</Text>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Montant à envoyer</Text>
          <Text style={styles.detailValue}>
            {transferDetails.amountSent.toLocaleString('fr-FR')} {transferDetails.senderCurrency}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Frais</Text>
          <Text style={styles.detailValue}>
            {transferDetails.fees.toLocaleString('fr-FR')} {transferDetails.senderCurrency}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Montant à recevoir</Text>
          <Text style={[styles.detailValue, styles.highlightedValue]}>
            {transferDetails.amountReceived.toLocaleString('fr-FR')} {transferDetails.receiverCurrency}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Bénéficiaire</Text>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Nom</Text>
          <Text style={styles.detailValue}>
            {beneficiaryData.firstName} {beneficiaryData.lastName}
          </Text>
        </View>

        {beneficiaryData.email && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Email</Text>
            <Text style={styles.detailValue}>{beneficiaryData.email}</Text>
          </View>
        )}

        {beneficiaryData.phone && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Téléphone</Text>
            <Text style={styles.detailValue}>{beneficiaryData.phone}</Text>
          </View>
        )}

        {beneficiaryData.alipayId && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>ID Alipay</Text>
            <Text style={styles.detailValue}>{beneficiaryData.alipayId}</Text>
          </View>
        )}

        {beneficiaryData.weroName && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Nom Wero</Text>
            <Text style={styles.detailValue}>{beneficiaryData.weroName}</Text>
          </View>
        )}
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <TouchableOpacity 
        style={styles.submitButton}
        onPress={handlePayment}
        disabled={loading}
      >
        <Text style={styles.submitButtonText}>
          {loading ? 'Traitement en cours...' : 'Confirmer le transfert'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  placeholder: {
    width: 40,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    margin: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#111827',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  highlightedValue: {
    color: '#059669',
  },
  errorContainer: {
    backgroundColor: '#fee2e2',
    padding: 16,
    margin: 16,
    marginTop: 0,
    borderRadius: 8,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 14,
  },
  submitButton: {
    backgroundColor: '#d97706',
    padding: 16,
    margin: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  instructionText: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 8,
  },
  instructionsList: {
    marginLeft: 8,
  },
  instruction: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 4,
  },
  bankDetails: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 6,
  },
  bankDetail: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 4,
  },
  bankDetailLabel: {
    fontWeight: '600',
  },
  // Confirmation styles
  confirmationCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  confirmationHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  confirmationIcon: {
    backgroundColor: '#d1fae5',
    padding: 12,
    borderRadius: 50,
    marginBottom: 16,
  },
  confirmationTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  confirmationSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  detailsSection: {
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  withdrawalFeesInfo: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  withdrawalFeesText: {
    color: '#059669',
    fontSize: 14,
  },
  instructionsSection: {
    marginBottom: 24,
  },
  dashboardButton: {
    backgroundColor: '#059669',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  dashboardButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});