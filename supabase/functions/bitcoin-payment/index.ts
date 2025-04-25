import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Initialiser le client Supabase
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_ANON_KEY') || ''
);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // Vérifier la méthode
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Méthode non autorisée' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    // Récupérer et valider le token JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Vérifier le token avec Supabase
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Token invalide' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Récupérer les données du corps de la requête
    const { 
      transferId, 
      transactionHash 
    } = await req.json();

    // Valider les données requises
    if (!transferId || !transactionHash) {
      return new Response(JSON.stringify({ error: 'Données manquantes' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Vérifier que le transfert existe et appartient à l'utilisateur
    const { data: transfer, error: transferError } = await supabaseClient
      .from('transfers')
      .select('*')
      .eq('id', transferId)
      .eq('user_id', user.id)
      .single();

    if (transferError || !transfer) {
      return new Response(JSON.stringify({ error: 'Transfert non trouvé ou non autorisé' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Enregistrer les informations de paiement Bitcoin
    const { error: updateError } = await supabaseClient
      .from('transfers')
      .update({ 
        status: 'pending_verification',
        payment_id: transactionHash
      })
      .eq('id', transferId);

    if (updateError) {
      throw updateError;
    }

    // Créer une notification pour l'administrateur
    const { error: notificationError } = await supabaseClient
      .from('notifications')
      .insert([{
        type: 'bitcoin_payment',
        transfer_id: transferId,
        recipient_id: null, // Admin notification
        message: `Paiement en Bitcoin reçu pour le transfert ${transfer.reference}. Hash de transaction: ${transactionHash}`,
        status: 'pending'
      }]);

    if (notificationError) {
      console.error('Erreur lors de la création de la notification:', notificationError);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Paiement en Bitcoin enregistré avec succès' 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Erreur:', error);
    
    return new Response(JSON.stringify({ 
      error: 'Erreur interne du serveur',
      message: error instanceof Error ? error.message : 'Une erreur inattendue est survenue'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});