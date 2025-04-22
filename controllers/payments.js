// controllers/payments.js
const axios       = require('axios');
const Reservation = require('../models/Reservation');

const CINETPAY_INIT_URL  = 'https://api-checkout.cinetpay.com/v2/payment';
const CINETPAY_CHECK_URL = 'https://api-checkout.cinetpay.com/v2/payment/check';

exports.initiatePayment = async (req, res) => {
  try {
    const { reservationId } = req.body;
    // 1) Récupérer la réservation
    const reservation = await Reservation
      .findById(reservationId)
      .populate('trajet');
    if (!reservation) return res.status(404).json({ message: 'Réservation introuvable' });

    // 2) Préparer le payload CinetPay
    const payload = {
      apikey:       process.env.CINETPAY_API_KEY,
      site_id:      process.env.CINETPAY_SITE_ID,
      transaction_id: reservationId,                        // doit être unique
      amount:       reservation.trajet.prix,               // en XOF
      currency:     'XOF',
      description:  `Réservation #${reservationId}`,
      return_url:   process.env.CINETPAY_RETURN_URL,
      notify_url:   process.env.CINETPAY_NOTIFY_URL,
      customer_name:  `${reservation.client.prenom} ${reservation.client.nom}`,
      customer_email: reservation.client.email,
    };

    // 3) Appel à CinetPay pour obtenir le lien de paiement
    const { data } = await axios.post(CINETPAY_INIT_URL, payload, {
      headers: { 'Content-Type': 'application/json' }
    });

    if (data.code !== '201') {
      // 201 = lien généré
      return res.status(400).json({ message: data.message || 'Échec init paiement' });
    }

    // 4) Retourner l'URL de paiement au front
    return res.json({ payment_url: data.data.payment_url });
  } catch (err) {
    console.error('CinetPay init error', err.response?.data || err.message);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

exports.handleNotify = async (req, res) => {
  // CinetPay envoie un GET ou POST sur notify_url quand le paiement est confirmé
  // Validez apikey + site_id, transaction_id, status…
  console.log('CinetPay notification', req.body || req.query);
  // TODO : mettre à jour la réservation (statut payée)
  res.status(200).send('OK');
};

exports.handleReturn = async (req, res) => {
  // Après paiement, CinetPay redirige l’utilisateur ici
  // Vous pouvez rediriger vers votre front end
  res.redirect(process.env.CINETPAY_RETURN_URL);
};
