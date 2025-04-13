import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../Auth/AuthProvider';
import { supabase } from '../../lib/supabase';

interface IdentityVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerified: () => void;
}

const IdentityVerificationModal: React.FC<IdentityVerificationModalProps> = ({
  isOpen,
  onClose,
  onVerified
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [applicantId, setApplicantId] = useState<string | null>(null);
  const onfidoContainerRef = useRef<HTMLDivElement>(null);
  const onfidoInstance = useRef<any>(null);

  useEffect(() => {
    if (!isOpen || !user) return;

    const checkVerificationStatus = async () => {
      try {
        setLoading(true);
        setError(null);

        // Check if user is already verified
        const { data, error: userError } = await supabase
          .from('users')
          .select('identity_verified, identity_check_status, identity_check_result')
          .eq('id', user.id)
          .single();

        if (userError) throw userError;

        if (data?.identity_verified) {
          setIsVerified(true);
          return;
        }

        // If verification is in progress, show appropriate message
        if (data?.identity_check_status === 'pending') {
          setIsVerifying(true);
          return;
        }

        // Get user details for Onfido
        const { data: userData, error: profileError } = await supabase
          .from('users')
          .select('first_name, last_name, email')
          .eq('id', user.id)
          .single();

        if (profileError) throw profileError;

        // Get Onfido token
        const response = await fetch('/api/onfido-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
          },
          body: JSON.stringify({
            firstName: userData.first_name,
            lastName: userData.last_name,
            email: userData.email
          })
        });

        const responseData = await response.json();

        if (!response.ok) {
          throw new Error(responseData.message || 'Failed to get Onfido token');
        }

        if (responseData.verified) {
          setIsVerified(true);
          return;
        }

        setToken(responseData.token);
        setApplicantId(responseData.applicantId);

      } catch (err) {
        console.error('Error checking verification status:', err);
        setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    };

    checkVerificationStatus();
  }, [isOpen, user]);

  useEffect(() => {
    // Initialize Onfido SDK when token is available
    if (token && onfidoContainerRef.current && !onfidoInstance.current) {
      // Check if Onfido SDK is loaded
      if (typeof window.Onfido === 'undefined') {
        setError('Onfido SDK not loaded. Please refresh the page and try again.');
        return;
      }

      try {
        onfidoInstance.current = window.Onfido.init({
          token,
          containerId: 'onfido-mount',
          onComplete: handleOnfidoComplete,
          steps: [
            {
              type: 'welcome',
              options: {
                title: 'Vérification d\'identité',
                subtitle: 'Nous avons besoin de vérifier votre identité pour des raisons de sécurité et de conformité.'
              }
            },
            'document',
            'face',
            {
              type: 'complete',
              options: {
                message: 'Vérification en cours',
                submessage: 'Nous traitons vos informations. Vous serez notifié une fois la vérification terminée.'
              }
            }
          ],
          language: {
            locale: 'fr'
          },
          customUI: {
            colors: {
              primary: '#d97706',
              secondary: '#b45309'
            },
            fonts: {
              family: 'Inter, system-ui, sans-serif'
            }
          }
        });
      } catch (err) {
        console.error('Error initializing Onfido:', err);
        setError('Failed to initialize identity verification. Please try again later.');
      }
    }

    return () => {
      // Clean up Onfido instance when component unmounts
      if (onfidoInstance.current) {
        onfidoInstance.current.tearDown();
        onfidoInstance.current = null;
      }
    };
  }, [token]);

  const handleOnfidoComplete = async () => {
    try {
      setLoading(true);
      
      // Create check
      const response = await fetch('/api/onfido-check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          applicantId
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create check');
      }

      setIsVerifying(true);
      
    } catch (err) {
      console.error('Error creating check:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Vérification d'identité</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>

        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500"></div>
          </div>
        )}

        {error && (
          <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-4">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {isVerified && !loading && (
          <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-4">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-green-700">Votre identité a été vérifiée avec succès.</p>
              </div>
            </div>
          </div>
        )}

        {isVerifying && !loading && !isVerified && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  Votre vérification d'identité est en cours de traitement. Vous serez notifié une fois terminée.
                </p>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && !isVerified && !isVerifying && (
          <div>
            <p className="mb-4 text-gray-700">
              Pour des raisons de sécurité et de conformité réglementaire, nous devons vérifier votre identité avant de procéder à votre transfert.
            </p>
            <p className="mb-6 text-gray-700">
              Veuillez préparer une pièce d'identité valide (passeport, carte d'identité ou permis de conduire) et vous assurer d'être dans un endroit bien éclairé pour la photo.
            </p>
            <div id="onfido-mount" ref={onfidoContainerRef} className="min-h-[400px]"></div>
          </div>
        )}

        <div className="flex justify-end mt-6">
          {isVerified ? (
            <button
              onClick={onVerified}
              className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2"
            >
              Continuer
            </button>
          ) : (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              Fermer
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Add TypeScript declaration for Onfido
declare global {
  interface Window {
    Onfido?: {
      init: (options: any) => any;
    };
  }
}

export default IdentityVerificationModal;