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
    const { firstName, lastName, email } = request.body;

    // Validate required fields
    if (!firstName || !lastName || !email) {
      return response.status(400).json({ error: 'Données manquantes' });
    }

    // Check if user already has an Onfido applicant ID
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('identity_check_id, identity_verified')
      .eq('id', user.id)
      .single();

    if (userError) {
      console.error('Error fetching user data:', userError);
      return response.status(500).json({ error: 'Erreur lors de la récupération des données utilisateur' });
    }

    // If user is already verified, return success
    if (userData?.identity_verified) {
      return response.status(200).json({ 
        verified: true,
        message: 'Identité déjà vérifiée'
      });
    }

    let applicantId = userData?.identity_check_id;

    // If no applicant ID exists, create a new applicant
    if (!applicantId) {
      const applicantResponse = await axios({
        method: 'post',
        url: 'https://api.onfido.com/v3/applicants',
        headers: {
          'Authorization': `Token token=${process.env.ONFIDO_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        data: {
          first_name: firstName,
          last_name: lastName,
          email: email
        }
      });

      applicantId = applicantResponse.data.id;

      // Save the applicant ID to the user record
      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          identity_check_id: applicantId,
          identity_check_status: 'created',
          identity_check_created_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (updateError) {
        console.error('Error updating user with applicant ID:', updateError);
        return response.status(500).json({ error: 'Erreur lors de la mise à jour des données utilisateur' });
      }
    }

    // Generate an SDK token
    const tokenResponse = await axios({
      method: 'post',
      url: 'https://api.onfido.com/v3/sdk_token',
      headers: {
        'Authorization': `Token token=${process.env.ONFIDO_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      data: {
        applicant_id: applicantId,
        referrer: '*://*/*'
      }
    });

    // Return the token and applicant ID
    return response.status(200).json({
      token: tokenResponse.data.token,
      applicantId: applicantId
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