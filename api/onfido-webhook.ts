import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  // Verify HTTP method
  if (request.method !== 'POST') {
    return response.status(405).json({ 
      error: 'Method Not Allowed',
      message: 'Only POST requests are allowed'
    });
  }

  try {
    // Verify webhook signature
    const signature = request.headers['x-signature'] as string;
    if (!signature) {
      return response.status(401).json({ error: 'Signature manquante' });
    }

    const webhookToken = process.env.ONFIDO_WEBHOOK_TOKEN;
    if (!webhookToken) {
      console.error('ONFIDO_WEBHOOK_TOKEN is not set');
      return response.status(500).json({ error: 'Configuration du webhook manquante' });
    }

    // Verify the signature
    const payload = JSON.stringify(request.body);
    const hmac = crypto.createHmac('sha256', webhookToken);
    const digest = hmac.update(payload).digest('hex');

    if (signature !== digest) {
      return response.status(401).json({ error: 'Signature invalide' });
    }

    // Process the webhook
    const { payload: webhookPayload } = request.body;
    
    if (!webhookPayload || !webhookPayload.resource_type || !webhookPayload.object) {
      return response.status(400).json({ error: 'Payload invalide' });
    }

    // Only process check.completed events
    if (webhookPayload.resource_type !== 'check' || webhookPayload.action !== 'check.completed') {
      return response.status(200).json({ message: 'Événement ignoré' });
    }

    const check = webhookPayload.object;
    const applicantId = check.applicant_id;
    const checkResult = check.status;
    const checkId = check.id;

    // Find the user with this applicant ID
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('identity_check_id', applicantId);

    if (userError) {
      console.error('Error finding user:', userError);
      return response.status(500).json({ error: 'Erreur lors de la recherche de l\'utilisateur' });
    }

    if (!users || users.length === 0) {
      return response.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    const userId = users[0].id;

    // Update the user record with the check result
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        identity_check_status: 'completed',
        identity_check_result: checkResult,
        identity_verified: checkResult === 'clear',
        identity_verified_at: checkResult === 'clear' ? new Date().toISOString() : null
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Error updating user with check result:', updateError);
      return response.status(500).json({ error: 'Erreur lors de la mise à jour des données utilisateur' });
    }

    // Create a notification for the user
    const notificationMessage = checkResult === 'clear' 
      ? 'Votre identité a été vérifiée avec succès'
      : 'La vérification de votre identité a échoué. Veuillez contacter le support.';

    const { error: notificationError } = await supabase
      .from('notifications')
      .insert([{
        type: 'identity_verification',
        recipient_id: userId,
        message: notificationMessage,
        status: 'pending'
      }]);

    if (notificationError) {
      console.error('Error creating notification:', notificationError);
      // Continue even if notification creation fails
    }

    // Return success
    return response.status(200).json({
      success: true,
      message: 'Webhook processed successfully'
    });
  } catch (error: any) {
    console.error('Error processing webhook:', error);
    return response.status(500).json({ 
      error: 'Server Error',
      message: error.message || 'Une erreur inattendue est survenue'
    });
  }
}