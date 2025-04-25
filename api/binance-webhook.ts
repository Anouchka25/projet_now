import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// Verify Binance webhook signature
function verifySignature(payload: any, signature: string): boolean {
  if (!process.env.BINANCE_API_SECRET) return false;
  
  const hmac = crypto.createHmac('sha256', process.env.BINANCE_API_SECRET);
  const computedSignature = hmac.update(JSON.stringify(payload)).digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(computedSignature)
  );
}

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
    // Parse request body
    const payload = request.body;
    
    // Verify webhook signature (in a real implementation)
    const signature = request.headers['binance-signature'] as string;
    if (signature && !verifySignature(payload, signature)) {
      return response.status(401).json({
        error: 'Invalid signature',
        message: 'The webhook signature is invalid'
      });
    }

    // Process the deposit notification
    if (payload.type === 'deposit' && payload.status === 'success') {
      // Find the transfer by reference
      const { data: transfer, error: transferError } = await supabase
        .from('transfers')
        .select('*')
        .eq('reference', payload.reference)
        .single();

      if (transferError) {
        console.error('Error finding transfer:', transferError);
        return response.status(404).json({
          error: 'Transfer not found',
          message: 'No transfer found with the provided reference'
        });
      }

      // Update transfer status
      const { error: updateError } = await supabase
        .from('transfers')
        .update({ 
          status: 'paid',
          payment_id: payload.txId,
          paid_at: new Date().toISOString()
        })
        .eq('id', transfer.id);

      if (updateError) {
        console.error('Error updating transfer:', updateError);
        return response.status(500).json({
          error: 'Update failed',
          message: 'Failed to update transfer status'
        });
      }

      // Create notification
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert([{
          type: 'payment_received',
          transfer_id: transfer.id,
          recipient_id: transfer.user_id,
          message: `Paiement Bitcoin reçu pour le transfert ${transfer.reference}`
        }]);

      if (notificationError) {
        console.error('Error creating notification:', notificationError);
      }

      return response.status(200).json({
        success: true,
        message: 'Payment processed successfully'
      });
    }

    // Handle withdrawal notifications
    if (payload.type === 'withdrawal' && payload.status === 'success') {
      // Find the transfer by reference
      const { data: transfer, error: transferError } = await supabase
        .from('transfers')
        .select('*')
        .eq('reference', payload.reference)
        .single();

      if (transferError) {
        console.error('Error finding transfer:', transferError);
        return response.status(404).json({
          error: 'Transfer not found',
          message: 'No transfer found with the provided reference'
        });
      }

      // Update transfer status
      const { error: updateError } = await supabase
        .from('transfers')
        .update({ 
          status: 'completed',
          validated_at: new Date().toISOString()
        })
        .eq('id', transfer.id);

      if (updateError) {
        console.error('Error updating transfer:', updateError);
        return response.status(500).json({
          error: 'Update failed',
          message: 'Failed to update transfer status'
        });
      }

      // Create notification
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert([{
          type: 'transfer_completed',
          transfer_id: transfer.id,
          recipient_id: transfer.user_id,
          message: `Votre transfert Bitcoin ${transfer.reference} a été effectué avec succès`
        }]);

      if (notificationError) {
        console.error('Error creating notification:', notificationError);
      }

      return response.status(200).json({
        success: true,
        message: 'Withdrawal processed successfully'
      });
    }

    // Handle other webhook types
    return response.status(200).json({
      success: true,
      message: 'Webhook received but no action taken'
    });
  } catch (error) {
    console.error('Error processing webhook:', error);
    
    return response.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'An unexpected error occurred'
    });
  }
}