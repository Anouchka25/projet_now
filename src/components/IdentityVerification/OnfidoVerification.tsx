import React, { useState, useEffect } from 'react';
import { supabase } from "../../lib/supabase";
import { useAuth } from "../Auth/AuthProvider";
import { ArrowLeft } from "lucide-react";

const OnfidoVerification = ({ onComplete, onBack }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [token, setToken] = useState(null);
  const [applicantId, setApplicantId] = useState(null);

  useEffect(() => {
    const initOnfido = async () => {
      try {
        setLoading(true);
        
        // Récupérer les informations de l'utilisateur
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('first_name, last_name, email')
          .eq('id', user.id)
          .single();
          
        if (userError) throw userError;
        
        // Obtenir un token Onfido
        const response = await fetch('/api/onfido-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userId: user.id,
            firstName: userData.first_name,
            lastName: userData.last_name,
            email: userData.email
          })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.message || 'Erreur lors de la génération du token');
        }
        
        setToken(data.token);
        setApplicantId(data.applicantId);
        
        // Initialiser le SDK Onfido
        // Note: Vous devrez intégrer le SDK Onfido ici
        // Cela nécessite d'ajouter le script Onfido à votre index.html
        // et d'utiliser la méthode init du SDK
        
      } catch (err) {
        console.error('Error initializing Onfido:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    if (user) {
      initOnfido();
    }
  }, [user]);

  const handleComplete = async () => {
    try {
      // Créer une vérification Onfido
      const response = await fetch('/api/onfido-check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          applicantId,
          userId: user.id
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Erreur lors de la création de la vérification');
      }
      
      onComplete();
    } catch (err) {
      console.error('Error creating check:', err);
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
          <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h3 className="mt-3 text-lg font-medium text-gray-900">Erreur</h3>
        <p className="mt-2 text-sm text-gray-500">{error}</p>
        <div className="mt-4">
          <button
            onClick={onBack}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
          >
            Retour
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Ici, vous devrez intégrer l'interface Onfido */}
      <div id="onfido-mount"></div>
      
      <div className="mt-4 flex justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </button>
      </div>
    </div>
  );
};

export default OnfidoVerification;
