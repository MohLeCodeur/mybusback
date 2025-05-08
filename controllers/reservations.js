// controllers/reservations.js
require('dotenv').config();
const mongoose    = require('mongoose');
const axios       = require('axios');
const crypto      = require('crypto');
const Reservation = require('../models/Reservation');
const Trajet      = require('../models/Trajet');

// VitePay API endpoint selection
const VITEPAY_API = process.env.NODE_ENV === 'production'
  ? 'https://api.vitepay.com/v1/prod/payments'
  : 'https://api.vitepay.com/v1/test/payments';

const API_KEY      = process.env.VITEPAY_API_KEY;
const API_SECRET   = process.env.VITEPAY_API_SECRET;
const BACKEND_URL  = process.env.BACKEND_URL;   // ex: http://localhost:5000
const FRONTEND_URL = process.env.FRONTEND_URL;  // ex: http://localhost:5173

/**
 * GET /api/reservations
 * List all reservations
 */
exports.getReservations = async (req, res) => {
  try {
    const list = await Reservation.find()
      .populate('trajet')
      .sort({ dateReservation: -1 });
    return res.json(list);
  } catch (err) {
    console.error('getReservations error:', err);
    return res.status(500).json({ message: err.message });
  }
};

/**
 * GET /api/reservations/:id
 * Retrieve a reservation by ID
 */
exports.getReservationById = async (req, res) => {
  try {
    const { id } = req.params;
    const reservation = await Reservation.findById(id).populate('trajet');
    if (!reservation) {
      return res.status(404).json({ message: 'Réservation non trouvée' });
    }
    return res.json(reservation);
  } catch (err) {
    console.error('getReservationById error:', err);
    return res.status(500).json({ message: err.message });
  }
};

/**
 * POST /api/reservations
 * Create a reservation and generate the VitePay checkout URL
 */
exports.createReservation = async (req, res) => {
  const session = await mongoose.startSession();
  let reservation, trajet, client;

  try {
    session.startTransaction();

    // Extract and validate input
    const { trajetId, client: clientData, placesReservees } = req.body;
    client = clientData;
    if (!trajetId || !client || !placesReservees) {
      res.status(400);
      throw new Error('Tous les champs sont requis');
    }

    // Verify trajet exists and availability
    trajet = await Trajet.findById(trajetId).session(session);
    if (!trajet) {
      res.status(404);
      throw new Error('Trajet non trouvé');
    }
    if (trajet.placesDisponibles < placesReservees) {
      res.status(400);
      throw new Error(`Seulement ${trajet.placesDisponibles} places disponibles`);
    }

    // Create reservation in pending state
    reservation = new Reservation({
      trajet: trajetId,
      client,
      placesReservees,
      statut: 'en_attente'
    });
    await reservation.save({ session });

    // Update available seats
    trajet.placesDisponibles -= placesReservees;
    await trajet.save({ session });

    // Commit DB transaction
    await session.commitTransaction();
  } catch (err) {
    await session.abortTransaction();
    console.error('DB transaction error:', err);
    return res.status(res.statusCode === 200 ? 400 : res.statusCode)
      .json({ message: err.message });
  } finally {
    session.endSession();
  }

  // Prepare VitePay payment
  try {
    // Debug endpoint
    console.log('→ VITEPAY_API endpoint:', VITEPAY_API);

    const order_id     = reservation._id.toString().toUpperCase();
    const montantFCFA  = trajet.prix * reservation.placesReservees;
    const amount_100   = montantFCFA * 100;
    const callback_url = `${BACKEND_URL}/api/vitepay/callback`;
    const return_url   = `${FRONTEND_URL}/confirmation/${order_id}`;
    const decline_url  = `${FRONTEND_URL}/payment-failed`;
    const cancel_url   = `${FRONTEND_URL}/reservation/${order_id}`;

    // Construct string to hash
    const rawString = `${order_id};${amount_100};XOF;${callback_url};${API_SECRET}`;
    const firstHash = crypto.createHash('sha1')
    .update(rawString)
    .digest('hex');
  
  const hash = crypto.createHash('sha1')
    .update(firstHash)
    .digest('hex');
  

    // Build payload
    const payload = {
      payment: {
        order_id,
        language_code:  'fr',
        currency_code:  'XOF',
        country_code:   'ML',
        p_type:         'orange_money',
        description:    `Réservation #${order_id}`,
        amount_100,
        return_url,
        decline_url,
        cancel_url,
        callback_url,
        buyer_ip_adress: req.ip,
        email:           client.email
      },
      redirect: 0,
      api_key:  API_KEY,
      hash,
      ...(process.env.NODE_ENV !== 'production' ? { is_test: 1 } : {})
    };

    // Debug payload
    console.log('→ VitePay init payload:', { rawString, hash, payload });

    // Call VitePay API
    const response = await axios.post(VITEPAY_API, payload, {
      headers: { 'Content-Type': 'application/json' }
    });

    // Log success
    console.log('← VitePay success response:', response.data);

    // Respond with checkout URL
    const checkoutUrl = response.data.redirect_url;
    return res.status(201).json({ reservationId: order_id, checkoutUrl });
  } catch (err) {
    if (err.response) {
      console.error('VitePay error status:', err.response.status);
      console.error('VitePay error body  :', err.response.data);
    } else {
      console.error('VitePay request failed:', err.message);
    }
    return res.status(500).json({
      message: 'Impossible d’initialiser le paiement',
      details: err.response?.data || err.message
    });
  }
};
