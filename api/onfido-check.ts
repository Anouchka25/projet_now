import { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  // Set CORS headers
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return response.status(204).end();
  }

  // Verify HTTP method
  if (request.method !== 'POST') {
    return response.status(405).json({ 
      error: 'Method Not Allowed',
      message: 'Only POST requests are allowed'
    });
  }

  try {
    // Verify the token with Supabase
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return response.status(401).json({ error: 'Non autorisé' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return response.status(401).json({ error: 'Token invalide' });
    }

    // Parse request body
    const { applicantId } = request.body;

    // Validate required fields
    if (!applicantId) {
      return response.status(400).json({ error: 'ID d\'applicant manquant' });
    }

    // Create a check
    const checkResponse = await axios({
      method: 'post',
      url: 'https://api.onfido.com/v3/checks',
      headers: {
        'Authorization': `Token token=${process.env.ONFIDO_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      data: {
        applicant_id: applicantId,
        report_names: ['document', 'facial_similarity_photo'],
        privacy_notices_read_consent_given: true
      }
    });

    const checkId = checkResponse.data.id;

    // Update the user record with the check ID
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        identity_check_id: applicantId,
        identity_check_status: 'pending',
        identity_check_created_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating user with check status:', updateError);
      return response.status(500).json({ error: 'Erreur lors de la mise à jour des données utilisateur' });
    }

    // Return success
    return response.status(200).json({
      success: true,
      checkId: checkId,
      message: 'Vérification d\'identité initiée avec succès'
    });
  } catch (error: any) {
    console.error('Error:', error);
    
    // Handle Onfido API errors
    if (error.response) {
      console.error('Onfido API error:', error.response.data);
      return response.status(error.response.status || 500).json({ 
        error: 'Onfido API Error',
        message: error.response.data.error?.message || 'Une erreur est survenue avec le service de vérification'
      });
    }
    
    return response.status(500).json({ 
      error: 'Server Error',
      message: error.message || 'Une erreur inattendue est survenue'
    });
  }
}