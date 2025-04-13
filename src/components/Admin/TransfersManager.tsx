import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Check, X, Eye, Plus } from 'lucide-react';
import { sendTransferStatusEmail } from '../../lib/onesignal';
import CreateTransferModal from './CreateTransferModal';

interface Transfer {
  id: string;
  reference: string;
  created_at: string;
  amount_sent: number;
  amount_received: number;
  sender_currency: string;
  receiver_currency: string;
  payment_method: string;
  receiving_method: string;
  funds_origin: string;
  transfer_reason: string;
  status: string;
  kundapay_fees: number;
  withdrawal_fees: number;
  withdrawal_fees_included: boolean;
  user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
  };
  beneficiaries: Array<{
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    user_id: string;
    payment_details: any;
    transfer_id: string;
  }>;
}

const TransfersManager = () => {
  const navigate = useNavigate();
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [processingTransfer, setProcessingTransfer] = useState<string | null>(null);

  // Format name with first name capitalized and last name uppercase
  const formatName = (firstName: string = '', lastName: string = '') => {
    // Split first name by spaces to handle multiple first names
    const firstNames = firstName.split(' ').map(name => 
      name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()
    ).join(' ');
    
    const formattedLastName = lastName.toUpperCase();
    return `${firstNames} ${formattedLastName}`;
  };

  useEffect(() => {
    fetchTransfers();
  }, []);

  const fetchTransfers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('transfers')
        .select(`
          *,
          user:users!transfers_user_id_fkey (
            id, email, first_name, last_name
          ),
          beneficiaries (
            id, first_name, last_name, email, user_id, payment_details
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      console.log('Transfers data:', data);
      setTransfers(data || []);
    } catch (err) {
      console.error('Error fetching transfers:', err);
      setError('Erreur lors du chargement des transferts');
    } finally {
      setLoading(false);
    }
  };

  const executeAirtelTransfer = async (transferId: string) => {
    try {
      setProcessingTransfer(transferId);
      setError(null);

      const response = await fetch('/.netlify/functions/execute-transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transfer_id: transferId })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Erreur lors de l\'exécution du transfert');
      }

      await fetchTransfers();
      alert('Transfert exécuté avec succès');
    } catch (err) {
      console.error('Error executing transfer:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'exécution du transfert');
      alert('Erreur lors de l\'exécution du transfert');
    } finally {
      setProcessingTransfer(null);
    }
  };

  const handleStatusChange = async (id: string, newStatus: 'completed' | 'cancelled') => {
    try {
      setProcessingTransfer(id);
      setError(null);
      
      // Get the current user for validation
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non autorisé');

      // Update the transfer status
      const { error: updateError } = await supabase
        .from('transfers')
        .update({ 
          status: newStatus,
          validated_at: new Date().toISOString(),
          validated_by: user.id
        })
        .eq('id', id);

      if (updateError) throw updateError;

      // Get transfer details for notification
      const { data: transfer, error: transferError } = await supabase
        .from('transfers')
        .select(`
          *,
          user:users!transfers_user_id_fkey (id, email, first_name, last_name, onesignal_id),
          beneficiaries (first_name, last_name, email, user_id)
        `)
        .eq('id', id)
        .single();

      if (transferError) throw transferError;

      // Create notification
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert([{
          type: 'transfer_status',
          transfer_id: id,
          recipient_id: transfer.user.id,
          message: `Votre transfert ${transfer.reference} a été ${newStatus === 'completed' ? 'validé' : 'annulé'}`,
          status: 'pending'
        }]);

      if (notificationError) {
        console.error('Error creating notification:', notificationError);
      }

      try {
        // Send email notification
        await sendTransferStatusEmail(id, newStatus);
      } catch (emailError) {
        console.error('Error sending email notification:', emailError);
        // Continue even if email fails
      }

      // Refresh the transfers list
      await fetchTransfers();

      // Show success message
      alert(newStatus === 'completed' ? 'Transfert validé avec succès' : 'Transfert annulé avec succès');
    } catch (err) {
      console.error('Error updating transfer status:', err);
      setError('Erreur lors de la mise à jour du statut');
      alert('Une erreur est survenue lors de la mise à jour du statut');
    } finally {
      setProcessingTransfer(null);
    }
  };

  const getPaymentMethodDisplay = (method: string) => {
    const methods: { [key: string]: string } = {
      'BANK_TRANSFER': 'Virement bancaire',
      'AIRTEL_MONEY': 'Airtel Money',
      'MOOV_MONEY': 'Moov Money',
      'CASH': 'Espèces',
      'ALIPAY': 'Alipay',
      'CARD': 'Carte bancaire',
      'ACH': 'Virement ACH',
      'PAYPAL': 'PayPal',
      'WERO': 'Wero',
      'VISA_DIRECT': 'Visa Direct',
      'MASTERCARD_SEND': 'Mastercard Send',
      'INTERAC': 'Interac'
    };
    return methods[method] || method;
  };

  const getFundsOriginDisplay = (origin: string) => {
    const origins: { [key: string]: string } = {
      'salary': 'Salaire',
      'savings': 'Épargne',
      'business': 'Revenus d\'entreprise',
      'investment': 'Investissements',
      'gift': 'Don',
      'other': 'Autre',
      'admin_created': 'Créé par l\'administrateur'
    };
    return origins[origin] || origin || 'Non spécifié';
  };

  const getTransferReasonDisplay = (reason: string) => {
    const reasons: { [key: string]: string } = {
      'family_support': 'Soutien familial',
      'business': 'Affaires',
      'education': 'Éducation',
      'medical': 'Frais médicaux',
      'travel': 'Voyage',
      'other': 'Autre',
      'admin_created': 'Créé par l\'administrateur'
    };
    return reasons[reason] || reason || 'Non spécifié';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Transferts</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700"
        >
          <Plus className="h-5 w-5 mr-2" />
          Créer un transfert
        </button>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="overflow-x-auto">
        <div className="inline-block min-w-full align-middle">
          <div className="overflow-hidden shadow-md rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Référence
                  </th>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Expéditeur
                  </th>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Bénéficiaire
                  </th>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Montant
                  </th>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Statut
                  </th>
                  <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transfers.map((transfer) => (
                  <tr key={transfer.id} className="hover:bg-gray-50">
                    <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {transfer.reference}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(transfer.created_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatName(transfer.user?.first_name, transfer.user?.last_name)}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                      {transfer.beneficiaries && transfer.beneficiaries.length > 0 ? 
                        formatName(transfer.beneficiaries[0]?.first_name || '', transfer.beneficiaries[0]?.last_name || '') : 
                        <span className="text-gray-400 italic">Non spécifié</span>}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                      {transfer.amount_sent.toLocaleString('fr-FR')} {transfer.sender_currency}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        transfer.status === 'completed' ? 'bg-green-100 text-green-800' :
                        transfer.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        transfer.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {transfer.status === 'completed' ? 'Terminé' :
                         transfer.status === 'pending' ? 'En attente' :
                         transfer.status === 'cancelled' ? 'Annulé' :
                         transfer.status}
                      </span>
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        {transfer.status === 'pending' && (
                          <>
                            <button
                              onClick={() => {
                                if (window.confirm('Êtes-vous sûr de vouloir valider ce transfert ?')) {
                                  handleStatusChange(transfer.id, 'completed');
                                }
                              }}
                              className="p-1 text-green-600 hover:text-green-900 rounded-full hover:bg-green-50"
                              title="Valider"
                            >
                              <Check className="h-5 w-5" />
                            </button>
                            {transfer.receiving_method === 'AIRTEL_MONEY' && (
                              <button
                                onClick={() => {
                                  if (window.confirm('Êtes-vous sûr de vouloir exécuter ce transfert Airtel Money ?')) {
                                    executeAirtelTransfer(transfer.id);
                                  }
                                }}
                                disabled={processingTransfer === transfer.id}
                                className="p-1 text-blue-600 hover:text-blue-900 rounded-full hover:bg-blue-50 disabled:opacity-50"
                                title="Exécuter via Airtel Money"
                              >
                                <Check className="h-5 w-5" />
                              </button>
                            )}
                            <button
                              onClick={() => {
                                if (window.confirm('Êtes-vous sûr de vouloir annuler ce transfert ?')) {
                                  handleStatusChange(transfer.id, 'cancelled');
                                }
                              }}
                              className="p-1 text-red-600 hover:text-red-900 rounded-full hover:bg-red-50"
                              title="Annuler"
                            >
                              <X className="h-5 w-5" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => setSelectedTransfer(transfer)}
                          className="p-1 text-yellow-600 hover:text-yellow-900 rounded-full hover:bg-yellow-50"
                          title="Voir les détails"
                        >
                          <Eye className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Mobile-friendly version */}
      <div className="md:hidden mt-6 space-y-4">
        {transfers.map((transfer) => (
          <div key={transfer.id} className="bg-white rounded-lg shadow-md p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="font-medium text-gray-900">{transfer.reference}</span>
              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                transfer.status === 'completed' ? 'bg-green-100 text-green-800' :
                transfer.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                transfer.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {transfer.status === 'completed' ? 'Terminé' :
                 transfer.status === 'pending' ? 'En attente' :
                 transfer.status === 'cancelled' ? 'Annulé' :
                 transfer.status}
              </span>
            </div>
            
            <div className="text-sm text-gray-500 mb-2">
              {new Date(transfer.created_at).toLocaleDateString('fr-FR')}
            </div>
            
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <div className="text-xs text-gray-500">Expéditeur</div>
                <div className="text-sm font-medium">
                  {formatName(transfer.user?.first_name, transfer.user?.last_name)}
                </div>
              </div>
              
              <div>
                <div className="text-xs text-gray-500">Bénéficiaire</div>
                <div className="text-sm font-medium">
                  {transfer.beneficiaries && transfer.beneficiaries.length > 0 ? 
                    formatName(transfer.beneficiaries[0]?.first_name || '', transfer.beneficiaries[0]?.last_name || '') : 
                    <span className="text-gray-400 italic">Non spécifié</span>}
                </div>
              </div>
            </div>
            
            <div className="mb-3">
              <div className="text-xs text-gray-500">Montant</div>
              <div className="text-sm font-medium">
                {transfer.amount_sent.toLocaleString('fr-FR')} {transfer.sender_currency}
              </div>
            </div>
            
            <div className="flex justify-end space-x-2 pt-2 border-t border-gray-100">
              {transfer.status === 'pending' && (
                <>
                  <button
                    onClick={() => {
                      if (window.confirm('Êtes-vous sûr de vouloir valider ce transfert ?')) {
                        handleStatusChange(transfer.id, 'completed');
                      }
                    }}
                    className="p-2 text-green-600 hover:text-green-900 rounded-full hover:bg-green-50"
                    title="Valider"
                  >
                    <Check className="h-5 w-5" />
                  </button>
                  {transfer.receiving_method === 'AIRTEL_MONEY' && (
                    <button
                      onClick={() => {
                        if (window.confirm('Êtes-vous sûr de vouloir exécuter ce transfert Airtel Money ?')) {
                          executeAirtelTransfer(transfer.id);
                        }
                      }}
                      disabled={processingTransfer === transfer.id}
                      className="p-2 text-blue-600 hover:text-blue-900 rounded-full hover:bg-blue-50 disabled:opacity-50"
                      title="Exécuter via Airtel Money"
                    >
                      <Check className="h-5 w-5" />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (window.confirm('Êtes-vous sûr de vouloir annuler ce transfert ?')) {
                        handleStatusChange(transfer.id, 'cancelled');
                      }
                    }}
                    className="p-2 text-red-600 hover:text-red-900 rounded-full hover:bg-red-50"
                    title="Annuler"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </>
              )}
              <button
                onClick={() => setSelectedTransfer(transfer)}
                className="p-2 text-yellow-600 hover:text-yellow-900 rounded-full hover:bg-yellow-50"
                title="Voir les détails"
              >
                <Eye className="h-5 w-5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal des détails */}
      {selectedTransfer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Détails du transfert {selectedTransfer.reference}
            </h3>
            
            <div className="space-y-6">
              {/* Informations de l'expéditeur */}
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-2">Expéditeur</h4>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p><span className="font-medium">Nom :</span> {formatName(selectedTransfer.user?.first_name, selectedTransfer.user?.last_name)}</p>
                  <p><span className="font-medium">Email :</span> {selectedTransfer.user?.email}</p>
                </div>
              </div>

              {/* Informations du bénéficiaire */}
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-2">Bénéficiaire</h4>
                <div className="bg-gray-50 rounded-lg p-4">
                  {selectedTransfer.beneficiaries && selectedTransfer.beneficiaries.length > 0 ? (
                    <>
                      <p><span className="font-medium">Nom :</span> {formatName(selectedTransfer.beneficiaries[0]?.first_name || '', selectedTransfer.beneficiaries[0]?.last_name || '')}</p>
                      <p><span className="font-medium">Email :</span> {selectedTransfer.beneficiaries[0]?.email}</p>
                      
                      {/* Détails de paiement spécifiques */}
                      {selectedTransfer.beneficiaries[0]?.payment_details?.phone && (
                        <p><span className="font-medium">Téléphone :</span> {selectedTransfer.beneficiaries[0].payment_details.phone}</p>
                      )}
                      {selectedTransfer.beneficiaries[0]?.payment_details?.alipayId && (
                        <p><span className="font-medium">ID Alipay :</span> {selectedTransfer.beneficiaries[0].payment_details.alipayId}</p>
                      )}
                      {selectedTransfer.beneficiaries[0]?.payment_details?.weroName && (
                        <p><span className="font-medium">Nom Wero :</span> {selectedTransfer.beneficiaries[0].payment_details.weroName}</p>
                      )}
                      
                      {/* Adresse si disponible */}
                      {selectedTransfer.beneficiaries[0]?.payment_details?.address && (
                        <div className="mt-2">
                          <p className="font-medium">Adresse :</p>
                          <p>{selectedTransfer.beneficiaries[0].payment_details.address.street}</p>
                          <p>{selectedTransfer.beneficiaries[0].payment_details.address.city}, {selectedTransfer.beneficiaries[0].payment_details.address.state} {selectedTransfer.beneficiaries[0].payment_details.address.zipCode}</p>
                        </div>
                      )}
                      
                      {/* Détails bancaires si disponibles */}
                      {selectedTransfer.beneficiaries[0]?.payment_details?.bankDetails && (
                        <div className="mt-2">
                          <p className="font-medium">Informations bancaires :</p>
                          <p>Banque : {selectedTransfer.beneficiaries[0].payment_details.bankDetails.bankName}</p>
                          <p>Compte : {selectedTransfer.beneficiaries[0].payment_details.bankDetails.accountNumber}</p>
                          {selectedTransfer.beneficiaries[0].payment_details.bankDetails.routingNumber && (
                            <p>Routing : {selectedTransfer.beneficiaries[0].payment_details.bankDetails.routingNumber}</p>
                          )}
                          {selectedTransfer.beneficiaries[0].payment_details.bankDetails.swiftCode && (
                            <p>SWIFT/BIC : {selectedTransfer.beneficiaries[0].payment_details.bankDetails.swiftCode}</p>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-gray-400 italic">Aucun bénéficiaire trouvé</p>
                  )}
                </div>
              </div>

              {/* Détails du transfert */}
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-2">Détails du transfert</h4>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p><span className="font-medium">Montant envoyé :</span> {selectedTransfer.amount_sent.toLocaleString('fr-FR')} {selectedTransfer.sender_currency}</p>
                      <p><span className="font-medium">Montant reçu :</span> {selectedTransfer.amount_received.toLocaleString('fr-FR')} {selectedTransfer.receiver_currency}</p>
                    </div>
                    <div>
                      <p><span className="font-medium">Mode de paiement :</span> {getPaymentMethodDisplay(selectedTransfer.payment_method)}</p>
                      <p><span className="font-medium">Mode de réception :</span> {getPaymentMethodDisplay(selectedTransfer.receiving_method)}</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <p><span className="font-medium">Origine des fonds :</span> {getFundsOriginDisplay(selectedTransfer.funds_origin)}</p>
                    <p><span className="font-medium">Raison du transfert :</span> {getTransferReasonDisplay(selectedTransfer.transfer_reason)}</p>
                  </div>
                  
                  {/* Détails des frais */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="font-medium">Détails des frais :</p>
                    <p>Frais KundaPay : {selectedTransfer.kundapay_fees ? selectedTransfer.kundapay_fees.toLocaleString('fr-FR') : selectedTransfer.fees.toLocaleString('fr-FR')} {selectedTransfer.sender_currency}</p>
                    
                    {/* Frais de retrait Airtel/Moov Money */}
                    {(selectedTransfer.receiving_method === 'AIRTEL_MONEY' || selectedTransfer.receiving_method === 'MOOV_MONEY') && (
                      <div className="mt-2">
                        <p>
                          <span className="font-medium">Frais de retrait {selectedTransfer.receiving_method === 'AIRTEL_MONEY' ? 'Airtel Money' : 'Moov Money'} :</span> 
                          {selectedTransfer.withdrawal_fees_included || (selectedTransfer.beneficiaries && selectedTransfer.beneficiaries.length > 0 && selectedTransfer.beneficiaries[0]?.payment_details?.withdrawalFeesIncluded) ? (
                            <span className="text-green-600 ml-2">Inclus dans le transfert ({selectedTransfer.withdrawal_fees ? selectedTransfer.withdrawal_fees.toLocaleString('fr-FR') : '0'} {selectedTransfer.sender_currency})</span>
                          ) : (
                            <span className="text-yellow-600 ml-2">Non inclus (à la charge du bénéficiaire)</span>
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Boutons d'action */}
              <div className="flex justify-between items-center mt-6">
                {selectedTransfer.status === 'pending' && (
                  <div className="flex space-x-4">
                    <button
                      onClick={() => {
                        if (window.confirm('Êtes-vous sûr de vouloir valider ce transfert ?')) {
                          handleStatusChange(selectedTransfer.id, 'completed');
                          setSelectedTransfer(null);
                        }
                      }}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                    >
                      Valider le transfert
                    </button>
                    {selectedTransfer.receiving_method === 'AIRTEL_MONEY' && (
                      <button
                        onClick={() => {
                          if (window.confirm('Êtes-vous sûr de vouloir exécuter ce transfert Airtel Money ?')) {
                            executeAirtelTransfer(selectedTransfer.id);
                            setSelectedTransfer(null);
                          }
                        }}
                        disabled={processingTransfer === selectedTransfer.id}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                      >
                        Exécuter via Airtel Money
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (window.confirm('Êtes-vous sûr de vouloir annuler ce transfert ?')) {
                          handleStatusChange(selectedTransfer.id, 'cancelled');
                          setSelectedTransfer(null);
                        }
                      }}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                    >
                      Annuler le transfert
                    </button>
                  </div>
                )}
                <button
                  onClick={() => setSelectedTransfer(null)}
                  className={`px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 ${selectedTransfer.status === 'pending' ? '' : 'ml-auto'}`}
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de création de transfert */}
      <CreateTransferModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onTransferCreated={fetchTransfers}
      />
    </div>
  );
};

export default TransfersManager;