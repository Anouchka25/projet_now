import type { NextApiRequest, NextApiResponse } from 'next';
import { Checkout } from 'checkout-sdk-node';

// ✅ Utilise ta vraie clé secrète ici ou via variable d'environnement
const cko = new Checkout(process.env.CKO_SECRET_KEY || 'sk_sbox_v7imfjkohl7cz7k6yljah7yily3');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Autorise uniquement POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const { amount, currency, reference } = req.body;

  // Vérifie les paramètres obligatoires
  if (!amount || !currency || !reference) {
    return res.status(400).json({ error: 'Paramètres requis manquants (amount, currency, reference)' });
  }

  try {
    const session = await cko.sessions.request({
      amount,
      currency,
      reference,
      success_url: 'http://localhost:5173/transfer?status=success',
      failure_url: 'http://localhost:5173/transfer?status=failure',
      cancel_url: 'http://localhost:5173/transfer?status=cancel',
    });

    // ✅ Retourne l’URL de redirection
    return res.status(200).json({
      redirect_url: 'https://checkout.com/fake-session-for-test',
    });
  } catch (error) {
    console.error('❌ Erreur Checkout.com :', error);
    return res.status(500).json({ error: 'Erreur serveur lors de la création de la session' });
  }
}
