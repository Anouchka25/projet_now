import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { calculateTransferDetails } from '../utils/transfer';
import { ArrowRight } from 'lucide-react-native';

export default function TransferScreen({ navigation }) {
  const [sendAmount, setSendAmount] = useState('');
  const [receiveAmount, setReceiveAmount] = useState('');
  const [direction, setDirection] = useState('GABON_TO_CHINA');
  const [calculation, setCalculation] = useState(null);
  const [activeField, setActiveField] = useState('send');
  const [includeWithdrawalFees, setIncludeWithdrawalFees] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoCodeValid, setPromoCodeValid] = useState(false);
  const [promoCodeMessage, setPromoCodeMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    calculateAmounts();
  }, [sendAmount, receiveAmount, direction, activeField, includeWithdrawalFees]);

  const calculateAmounts = () => {
    if (activeField === 'send' && sendAmount && !isNaN(Number(sendAmount))) {
      const result = calculateTransferDetails(
        Number(sendAmount),
        direction,
        'AIRTEL_MONEY',
        'ALIPAY',
        false, // isReceiveAmount
        undefined, // promoCode
        includeWithdrawalFees
      );
      setCalculation(result);
      setReceiveAmount(result.amountReceived.toFixed(2));
    } else if (activeField === 'receive' && receiveAmount && !isNaN(Number(receiveAmount))) {
      const result = calculateTransferDetails(
        Number(receiveAmount),
        direction,
        'AIRTEL_MONEY',
        'ALIPAY',
        true, // isReceiveAmount
        undefined, // promoCode
        includeWithdrawalFees
      );
      setCalculation(result);
      setSendAmount(result.amountSent.toFixed(2));
    }
  };

  const handleSendAmountChange = (text) => {
    // Validate for Gabon transfers
    if (direction.startsWith('GABON_TO_')) {
      const numericValue = Number(text);
      if (numericValue > 150000) {
        setError("Le montant maximum autorisé depuis le Gabon est de 150 000 XAF par semaine.");
        return;
      }
    }
    
    setActiveField('send');
    setSendAmount(text);
    setError(null);
  };

  const handleReceiveAmountChange = (text) => {
    setActiveField('receive');
    setReceiveAmount(text);
    setError(null);
  };

  const toggleWithdrawalFees = () => {
    setIncludeWithdrawalFees(!includeWithdrawalFees);
  };

  const handleContinue = () => {
    if (calculation) {
      navigation.navigate('BeneficiaryScreen', {
        transferDetails: {
          ...calculation,
          includeWithdrawalFees
        }
      });
    } else {
      Alert.alert('Erreur', 'Veuillez entrer un montant valide');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Simuler un transfert</Text>

        {/* Dual Amount Inputs */}
        <View style={styles.dualInputContainer}>
          {/* Send Amount */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Montant à envoyer</Text>
            <TextInput
              style={[styles.input, activeField === 'send' ? styles.activeInput : {}]}
              keyboardType="numeric"
              value={sendAmount}
              onChangeText={handleSendAmountChange}
              onFocus={() => setActiveField('send')}
              placeholder="0.00"
            />
            {direction.startsWith('GABON_TO_') && (
              <Text style={styles.warningText}>
                Max: 150 000 FCFA/semaine
              </Text>
            )}
          </View>

          {/* Receive Amount */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Montant à recevoir</Text>
            <TextInput
              style={[styles.input, activeField === 'receive' ? styles.activeInput : {}]}
              keyboardType="numeric"
              value={receiveAmount}
              onChangeText={handleReceiveAmountChange}
              onFocus={() => setActiveField('receive')}
              placeholder="0.00"
            />
          </View>
        </View>

        {/* Withdrawal fees checkbox */}
        {(direction.includes('_TO_GABON') && 
          (direction.startsWith('FRANCE_') || direction.startsWith('BELGIUM_') || direction.startsWith('GERMANY_'))) && (
          <View style={styles.checkboxContainer}>
            <TouchableOpacity 
              style={styles.checkbox}
              onPress={toggleWithdrawalFees}
            >
              <View style={[
                styles.checkboxInner, 
                includeWithdrawalFees ? styles.checkboxChecked : {}
              ]} />
            </TouchableOpacity>
            <Text style={styles.checkboxLabel}>
              Inclure les frais de retrait Airtel/Moov Money
            </Text>
            <View style={styles.newBadge}>
              <Text style={styles.newBadgeText}>Nouveau</Text>
            </View>
          </View>
        )}

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {calculation && (
          <View style={styles.resultCard}>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Montant envoyé</Text>
              <Text style={styles.resultValue}>
                {calculation.amountSent.toLocaleString()} {calculation.senderCurrency}
              </Text>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Frais</Text>
              <Text style={styles.resultValue}>
                {calculation.fees.toLocaleString()} {calculation.senderCurrency}
              </Text>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Montant reçu</Text>
              <Text style={[styles.resultValue, styles.highlight]}>
                {calculation.amountReceived.toLocaleString()} {calculation.receiverCurrency}
              </Text>
            </View>

            {/* Withdrawal fees info */}
            {includeWithdrawalFees && calculation.withdrawalFees > 0 && (
              <View style={styles.withdrawalFeesInfo}>
                <Text style={styles.withdrawalFeesText}>
                  ✓ Frais de retrait inclus
                </Text>
              </View>
            )}
          </View>
        )}

        <TouchableOpacity
          style={styles.button}
          onPress={handleContinue}
          disabled={!calculation}
        >
          <Text style={styles.buttonText}>Continuer</Text>
          <ArrowRight size={20} color="#fff" style={styles.buttonIcon} />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  card: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  dualInputContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  inputGroup: {
    flex: 1,
    marginRight: 8,
  },
  label: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  activeInput: {
    borderColor: '#d97706',
    borderWidth: 2,
  },
  warningText: {
    fontSize: 12,
    color: '#dc2626',
    marginTop: 4,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  checkbox: {
    height: 20,
    width: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#d97706',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  checkboxInner: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  checkboxChecked: {
    backgroundColor: '#d97706',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#4b5563',
    flex: 1,
  },
  newBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  newBadgeText: {
    color: '#92400e',
    fontSize: 10,
    fontWeight: 'bold',
  },
  errorContainer: {
    backgroundColor: '#fee2e2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 14,
  },
  resultCard: {
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 8,
    marginVertical: 16,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  resultLabel: {
    color: '#4b5563',
  },
  resultValue: {
    fontWeight: '600',
  },
  highlight: {
    color: '#059669',
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
  button: {
    backgroundColor: '#d97706',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  buttonIcon: {
    marginLeft: 4,
  },
});