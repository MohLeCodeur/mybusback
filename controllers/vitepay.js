// controllers/vitepay.js
const axios = require('axios');
const crypto = require('crypto');

const VITEPAY_API = 'https://api.vitepay.com/v1/prod/payments';
const API_KEY    = process.env.VITEPAY_API_KEY;    // 5CMQT20wKowIKg
const API_SECRET = process.env.VITEPAY_API_SECRET; // 9fe36ed88b9b0677cbe479f5c4129ddc

/**
 * Crée une session de paiement VitePay et renvoie l'URL de redirection
 */
exports.createPayment = async (req, res) => {
  try {
    const {
      order_id,
      amount_100,
      description,
      return_url,
      decline_url,
      cancel_url,
      callback_url,
      buyer_ip_adress,
      email
    } = req.body;

    // 1. Calcul du hash : SHA1(UPPER("order_id;amount_100;currency_code;callback_url;api_secret"))
    const raw = `${order_id};${amount_100};XOF;${callback_url};${API_SECRET}`.toUpperCase();
    const hash = crypto.createHash('sha1').update(raw).digest('hex').toUpperCase();

    // 2. Construction du payload
    const payload = {
      payment: {
        order_id,
        language_code: 'fr',
        currency_code: 'XOF',
        country_code: 'ML',
        description,
        amount_100,
        return_url,
        decline_url,
        cancel_url,
        callback_url,
        buyer_ip_adress,
        email
      },
      redirect: 0,   // 0 = appel serveur-à-serveur
      api_key: API_KEY,
      hash
    };

    // 3. Appel à l'API VitePay
    const { data } = await axios.post(VITEPAY_API, payload, {
      headers: { 'Content-Type': 'application/json' }
    });

    // 4. Renvoi de l'URL de checkout
    // la doc indique qu'on obtient directement l'URL https://checkout1.vitepay.com/Ytr515 :contentReference[oaicite:0]{index=0}
    return res.json({ checkout_url: data });
  } catch (err) {
    console.error('Erreur VitePay:', err.response?.data || err.message);
    return res.status(500).json({ message: 'Impossible de créer la session de paiement' });
  }
};
// controllers/vitepay.js (suite)
exports.handleCallback = async (req, res) => {
    const {
      order_id,
      authenticity,
      success,
      sandbox,
      amount_100,
      currency_code
    } = req.body;
  
    // Vérifier le hash d'authenticité :contentReference[oaicite:3]{index=3}
    const raw = `${order_id};${amount_100};${currency_code};${API_SECRET}`.toUpperCase();
    const expected = crypto.createHash('sha1').update(raw).digest('hex').toUpperCase();
  
    if (expected !== authenticity) {
      return res.status(400).send('Invalid authenticity');
    }
  
    // Mettre à jour la réservation
    const statut = success === '1' ? 'confirmée' : 'annulée';
    await Reservation.findByIdAndUpdate(order_id, { statut });
  
    // Toujours renvoyer 200 à VitePay
    return res.status(200).send('OK');
  };
  