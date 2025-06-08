// backend/controllers/reservation.controller.js
const mongoose = require('mongoose');
const axios = require('axios');
const crypto = require('crypto');
const Reservation = require('../models/reservation.model');
const Trajet = require('../models/trajet.model');

// Sélection de l'endpoint API de VitePay en fonction de l'environnement
const VITEPAY_API = process.env.NODE_ENV === 'production'
  ? 'https://api.vitepay.com/v1/prod/payments'
  : 'https://api.vitepay.com/v1/test/payments';

/**
 * @desc    Créer une réservation et initier le paiement VitePay
 * @route   POST /api/reservations
 * @access  Privé (client connecté)
 */
// backend/controllers/reservation.controller.js

// ... (imports)

exports.createReservationAndPay = async (req, res) => {
  const session = await mongoose.startSession();
  
  // --- LIGNES CORRIGÉES ---
  // On déclare toutes les variables nécessaires ici
  let reservation, trajet, passagers;
  // -------------------------

  try {
    session.startTransaction();

    const { trajetId, contactEmail, contactTelephone } = req.body;
    // On assigne la valeur à la variable passagers qui a déjà été déclarée
    passagers = req.body.passagers; 
    
    const placesReservees = passagers.length;

    if (!trajetId || !passagers || placesReservees === 0 || !contactEmail || !contactTelephone) {
      throw new Error('Tous les champs sont requis.');
    }
    if (!req.user) {
      throw new Error('Utilisateur non authentifié.');
    }

    trajet = await Trajet.findById(trajetId).session(session);
    if (!trajet) {
      throw new Error('Trajet non trouvé.');
    }
    if (trajet.placesDisponibles < placesReservees) {
      throw new Error(`Seulement ${trajet.placesDisponibles} places disponibles.`);
    }

    reservation = new Reservation({
      trajet: trajetId,
      client: req.user._id,
      passagers,
      placesReservees,
      statut: 'en_attente'
    });
    await reservation.save({ session });

    trajet.placesDisponibles -= placesReservees;
    await trajet.save({ session });

    await session.commitTransaction();

  } catch (err) {
    await session.abortTransaction();
    console.error('Erreur lors de la transaction DB:', err.message);
    return res.status(400).json({ message: err.message });
  } finally {
    session.endSession();
  }

  // Maintenant, 'passagers' est accessible ici car elle a été déclarée au début
  try {
    const order_id = reservation._id.toString();
    const montantFCFA = trajet.prix * reservation.placesReservees;
    const amount_100 = montantFCFA * 100;
    const callback_url = `${process.env.BACKEND_URL}/api/vitepay/callback`;
    const return_url = `${process.env.FRONTEND_URL}/confirmation/${order_id}`;
    const decline_url = `${process.env.FRONTEND_URL}/payment-failed`;
    const cancel_url = `${process.env.FRONTEND_URL}/search`;

    const rawString = `${order_id};${amount_100};XOF;${callback_url};${process.env.VITEPAY_API_SECRET}`.toUpperCase();
    const hash = crypto.createHash('sha1').update(rawString).digest('hex');

    const payload = {
      payment: {
        order_id,
        language_code: 'fr',
        currency_code: 'XOF',
        country_code: 'ML',
        p_type: 'orange_money',
        description: `Réservation #${order_id}`,
        amount_100,
        return_url,
        decline_url,
        cancel_url,
        callback_url,
        buyer_ip_adress: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
        email: req.body.contactEmail,
        buyer_name: `${passagers[0].prenom} ${passagers[0].nom}`, // C'est maintenant correct
        buyer_phone_number: req.body.contactTelephone,
      },
      redirect: 0,
      api_key: process.env.VITEPAY_API_KEY,
      hash,
      ...(process.env.NODE_ENV !== 'production' ? { is_test: 1 } : {})
    };

    console.log('→ Payload envoyé à VitePay:', JSON.stringify(payload, null, 2));
    const response = await axios.post(VITEPAY_API, payload, { headers: { 'Content-Type': 'application/json' } });
    console.log('← Réponse de VitePay:', response.data);

    const checkoutUrl = response.data.redirect_url || response.data;
    if (!checkoutUrl) throw new Error('URL de paiement non valide reçue de VitePay.');
    
    return res.status(201).json({ reservationId: order_id, checkoutUrl });

  } catch (err) {
    if (err.response) {
      console.error('Erreur API VitePay - Statut:', err.response.status);
      console.error('Erreur API VitePay - Corps:', err.response.data);
    } else {
      console.error('Erreur de requête vers VitePay:', err.message);
    }
    return res.status(500).json({ message: 'Impossible d’initialiser le paiement auprès de notre partenaire.' });
  }
};

// ... Le reste du fichier (getReservationByIdPublic, getAllReservationsAdmin, etc.)
// ne change pas. Vous n'avez qu'à remplacer la fonction createReservationAndPay.

// Le reste des fonctions (pour l'admin et la confirmation) reste identique
// ...
exports.getReservationByIdPublic = async (req, res) => {
    try {
        const reservation = await Reservation.findById(req.params.id).populate('trajet').populate('client', 'nom prenom email');
        if (!reservation) { return res.status(404).json({ message: "Réservation non trouvée" }); }
        if (reservation.client._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ message: "Accès non autorisé." });
        }
        res.json(reservation);
    } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getAllReservationsAdmin = async (req, res) => {
  try {
    const list = await Reservation.findById(req.params.id).populate({ path: 'trajet', populate: { path: 'bus', model: 'Bus' } }).sort({ dateReservation: -1 });
    res.json(list);
  } catch (err) { console.error("Erreur getAllReservationsAdmin:", err); res.status(500).json({ message: err.message }); }
};

exports.updateReservationAdmin = async (req, res) => { /* ... */ };
exports.deleteReservationAdmin = async (req, res) => { /* ... */ };