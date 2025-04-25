import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ArrowLeft } from 'lucide-react-native';

export default function BeneficiaryScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { transferDetails } = route.params;

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    alipayId: '',
    weroName: '',
    fundsOrigin: '',
    transferReason: '',
  });

  const [errors, setErrors] = useState({});

  // Check if the beneficiary is in Gabon (receiving country is Gabon)
  const isBeneficiaryInGabon = () => {
    return transferDetails.direction && transferDetails.direction.includes('_TO_GABON');
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'Le prénom est requis';
    }
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Le nom est requis';
    }
    
    // Email validation is optional and not required for Gabon recipients
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Format d\'email invalide';
    }
    
    if (!formData.fundsOrigin) {
      newErrors.fundsOrigin = 'L\'origine des fonds est requise';
    }
    if (!formData.transferReason) {
      newErrors.transferReason = 'La raison du transfert est requise';
    }

    // Validation spécifique selon le mode de réception
    if (transferDetails.receivingMethod === 'AIRTEL_MONEY') {
      if (!formData.phone.trim()) {
        newErrors.phone = 'Le numéro de téléphone est requis';
      } else if (!/^0(74|77)[0-9]{6}$/.test(formData.phone)) {
        newErrors.phone = 'Format invalide. Exemple: 074123456';
      }
    }

    if (transferDetails.receivingMethod === 'MOOV_MONEY') {
      if (!formData.phone.trim()) {
        newErrors.phone = 'Le numéro de téléphone est requis';
      } else if (!/^0(62|66)[0-9]{6}$/.test(formData.phone)) {
        newErrors.phone = 'Format invalide. Exemple: 062123456';
      }
    }

    if (transferDetails.receivingMethod === 'ALIPAY' && !formData.alipayId?.trim()) {
      newErrors.alipayId = 'L\'identifiant Alipay est requis';
    }

    if (transferDetails.receivingMethod === 'WERO') {
      if (!formData.weroName?.trim()) {
        newErrors.weroName = 'Le nom associé au compte Wero est requis';
      }
      if (!formData.phone?.trim()) {
        newErrors.phone = 'Le numéro de téléphone Wero est requis';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const handleSubmit = () => {
    if (validateForm()) {
      navigation.navigate('PaymentScreen', {
        transferDetails,
        beneficiaryData: formData
      });
    } else {
      Alert.alert('Erreur', 'Veuillez corriger les erreurs dans le formulaire');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <ArrowLeft size={24} color="#4b5563" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Informations du bénéficiaire</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Détails du transfert</Text>
        <View style={styles.detailsGrid}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Montant à envoyer</Text>
            <Text style={styles.detailValue}>
              {transferDetails.amountSent.toLocaleString('fr-FR')} {transferDetails.senderCurrency}
            </Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Frais</Text>
            <Text style={styles.detailValue}>
              {transferDetails.fees.toLocaleString('fr-FR')} {transferDetails.senderCurrency}
            </Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Montant à recevoir</Text>
            <Text style={[styles.detailValue, styles.highlightedValue]}>
              {transferDetails.amountReceived.toLocaleString('fr-FR')} {transferDetails.receiverCurrency}
            </Text>
          </View>
        </View>

        {/* Withdrawal fees info */}
        {transferDetails.includeWithdrawalFees && (
          <View style={styles.withdrawalFeesInfo}>
            <Text style={styles.withdrawalFeesText}>
              ✓ Frais de retrait inclus
            </Text>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Informations du bénéficiaire</Text>

        {/* Informations de base */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Prénom</Text>
          <TextInput
            style={[styles.input, errors.firstName && styles.inputError]}
            value={formData.firstName}
            onChangeText={(text) => setFormData({...formData, firstName: text})}
            placeholder="Prénom du bénéficiaire"
          />
          {errors.firstName && <Text style={styles.errorText}>{errors.firstName}</Text>}
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Nom</Text>
          <TextInput
            style={[styles.input, errors.lastName && styles.inputError]}
            value={formData.lastName}
            onChangeText={(text) => setFormData({...formData, lastName: text})}
            placeholder="Nom du bénéficiaire"
          />
          {errors.lastName && <Text style={styles.errorText}>{errors.lastName}</Text>}
        </View>

        {/* Email field - only show if beneficiary is not in Gabon */}
        {!isBeneficiaryInGabon() && (
          <View style={styles.formGroup}>
            <Text style={styles.label}>Email (optionnel)</Text>
            <TextInput
              style={[styles.input, errors.email && styles.inputError]}
              value={formData.email}
              onChangeText={(text) => setFormData({...formData, email: text})}
              placeholder="Email du bénéficiaire"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
          </View>
        )}

        {/* Champs spécifiques selon le mode de réception */}
        {(transferDetails.receivingMethod === 'AIRTEL_MONEY' || transferDetails.receivingMethod === 'MOOV_MONEY' || transferDetails.receivingMethod === 'WERO') && (
          <View style={styles.formGroup}>
            <Text style={styles.label}>Numéro de téléphone</Text>
            <TextInput
              style={[styles.input, errors.phone && styles.inputError]}
              value={formData.phone}
              onChangeText={(text) => setFormData({...formData, phone: text})}
              placeholder={transferDetails.receivingMethod === 'WERO' ? "+33XXXXXXXXX" : 
                          transferDetails.receivingMethod === 'AIRTEL_MONEY' ? "074XXXXXX" : "062XXXXXX"}
              keyboardType="phone-pad"
            />
            {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
          </View>
        )}

        {transferDetails.receivingMethod === 'ALIPAY' && (
          <View style={styles.formGroup}>
            <Text style={styles.label}>Identifiant Alipay</Text>
            <TextInput
              style={[styles.input, errors.alipayId && styles.inputError]}
              value={formData.alipayId}
              onChangeText={(text) => setFormData({...formData, alipayId: text})}
              placeholder="Identifiant Alipay"
            />
            {errors.alipayId && <Text style={styles.errorText}>{errors.alipayId}</Text>}
          </View>
        )}

        {transferDetails.receivingMethod === 'WERO' && (
          <View style={styles.formGroup}>
            <Text style={styles.label}>Nom sur Wero</Text>
            <TextInput
              style={[styles.input, errors.weroName && styles.inputError]}
              value={formData.weroName}
              onChangeText={(text) => setFormData({...formData, weroName: text})}
              placeholder="Nom associé au compte Wero"
            />
            {errors.weroName && <Text style={styles.errorText}>{errors.weroName}</Text>}
          </View>
        )}

        {/* Origine des fonds et raison du transfert */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Origine des fonds</Text>
          <View style={[styles.select, errors.fundsOrigin && styles.inputError]}>
            <TouchableOpacity
              onPress={() => {
                Alert.alert(
                  "Origine des fonds",
                  "Sélectionnez l'origine des fonds",
                  [
                    { text: "Salaire", onPress: () => setFormData({...formData, fundsOrigin: 'salary'}) },
                    { text: "Épargne", onPress: () => setFormData({...formData, fundsOrigin: 'savings'}) },
                    { text: "Revenus d'entreprise", onPress: () => setFormData({...formData, fundsOrigin: 'business'}) },
                    { text: "Investissements", onPress: () => setFormData({...formData, fundsOrigin: 'investment'}) },
                    { text: "Don", onPress: () => setFormData({...formData, fundsOrigin: 'gift'}) },
                    { text: "Autre", onPress: () => setFormData({...formData, fundsOrigin: 'other'}) },
                    { text: "Annuler", style: "cancel" }
                  ]
                );
              }}
            >
              <Text style={formData.fundsOrigin ? styles.selectText : styles.selectPlaceholder}>
                {formData.fundsOrigin ? 
                  formData.fundsOrigin === 'salary' ? 'Salaire' :
                  formData.fundsOrigin === 'savings' ? 'Épargne' :
                  formData.fundsOrigin === 'business' ? 'Revenus d\'entreprise' :
                  formData.fundsOrigin === 'investment' ? 'Investissements' :
                  formData.fundsOrigin === 'gift' ? 'Don' :
                  'Autre'
                : 'Sélectionnez l\'origine des fonds'}
              </Text>
            </TouchableOpacity>
          </View>
          {errors.fundsOrigin && <Text style={styles.errorText}>{errors.fundsOrigin}</Text>}
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Raison du transfert</Text>
          <View style={[styles.select, errors.transferReason && styles.inputError]}>
            <TouchableOpacity
              onPress={() => {
                Alert.alert(
                  "Raison du transfert",
                  "Sélectionnez la raison du transfert",
                  [
                    { text: "Soutien familial", onPress: () => setFormData({...formData, transferReason: 'family_support'}) },
                    { text: "Affaires", onPress: () => setFormData({...formData, transferReason: 'business'}) },
                    { text: "Éducation", onPress: () => setFormData({...formData, transferReason: 'education'}) },
                    { text: "Frais médicaux", onPress: () => setFormData({...formData, transferReason: 'medical'}) },
                    { text: "Voyage", onPress: () => setFormData({...formData, transferReason: 'travel'}) },
                    { text: "Autre", onPress: () => setFormData({...formData, transferReason: 'other'}) },
                    { text: "Annuler", style: "cancel" }
                  ]
                );
              }}
            >
              <Text style={formData.transferReason ? styles.selectText : styles.selectPlaceholder}>
                {formData.transferReason ? 
                  formData.transferReason === 'family_support' ? 'Soutien familial' :
                  formData.transferReason === 'business' ? 'Affaires' :
                  formData.transferReason === 'education' ? 'Éducation' :
                  formData.transferReason === 'medical' ? 'Frais médicaux' :
                  formData.transferReason === 'travel' ? 'Voyage' :
                  'Autre'
                : 'Sélectionnez la raison du transfert'}
              </Text>
            </TouchableOpacity>
          </View>
          {errors.transferReason && <Text style={styles.errorText}>{errors.transferReason}</Text>}
        </View>

        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
          <Text style={styles.submitButtonText}>Continuer vers le paiement</Text>
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
  detailsGrid: {
    marginBottom: 16,
  },
  detailItem: {
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  highlightedValue: {
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
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    color: '#374151',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    padding: 12,
    fontSize: 16,
  },
  inputError: {
    borderColor: '#ef4444',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 4,
  },
  select: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    padding: 12,
  },
  selectText: {
    fontSize: 16,
    color: '#111827',
  },
  selectPlaceholder: {
    fontSize: 16,
    color: '#9ca3af',
  },
  submitButton: {
    backgroundColor: '#d97706',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});