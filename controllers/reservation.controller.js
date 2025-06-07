// backend/controllers/reservation.controller.js
const mongoose = require('mongoose');
const axios = require('axios');
const crypto = require('crypto');
const Reservation = require('../models/reservation.model');
const Trajet = require('../models/trajet.model');

const VITEPAY_API = process.env.NODE_ENV === 'production'
  ? 'https://api.vitepay.com/v1/prod/payments'
  : 'https://api.vitepay.com/v1/test/payments';

// PUBLIC - Créer une réservation et initier le paiement
exports.createReservationAndPay = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { trajetId, passagers } = req.body;
    const placesReservees = passagers.length;
    const clientId = req.user._id; // ID du client connecté via le middleware

    // 1. Vérifier le trajet et la disponibilité
    const trajet = await Trajet.findById(trajetId).session(session);
    if (!trajet) {
        throw new Error('Trajet non trouvé');
    }
    if (trajet.placesDisponibles < placesReservees) {
        throw new Error(`Seulement ${trajet.placesDisponibles} places disponibles`);
    }

    // 2. Créer la réservation
    const reservation = new Reservation({
      trajet: trajetId,
      client: clientId,
      passagers,
      placesReservees,
      statut: 'en_attente'
    });
    await reservation.save({ session });

    // 3. Mettre à jour les places
    trajet.placesDisponibles -= placesReservees;
    await trajet.save({ session });

    // 4. Préparer le paiement VitePay
    const order_id = reservation._id.toString();
    const montantFCFA = trajet.prix * placesReservees;
    const amount_100 = montantFCFA * 100;
    const callback_url = `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/vitepay/callback`;
    const return_url = `${process.env.FRONTEND_URL}/confirmation/${order_id}`;
    const decline_url = `${process.env.FRONTEND_URL}/payment-failed`;
    const cancel_url = `${process.env.FRONTEND_URL}/search`;

    const rawString = `${order_id};${amount_100};XOF;${callback_url};${process.env.VITEPAY_API_SECRET}`.toUpperCase();
    const hash = crypto.createHash('sha1').update(rawString).digest('hex');

    const payload = {
      payment: {
        order_id,
        amount_100,
        currency_code: 'XOF',
        description: `Réservation MyBus #${order_id}`,
        return_url,
        decline_url,
        cancel_url,
        callback_url,
        email: req.user.email,
        buyer_ip_adress: req.ip,
      },
      api_key: process.env.VITEPAY_API_KEY,
      hash,
      redirect: 0,
       ...(process.env.NODE_ENV !== 'production' ? { is_test: 1 } : {})
    };

    const vitepayResponse = await axios.post(VITEPAY_API, payload);
    const checkoutUrl = vitepayResponse.data.redirect_url || vitepayResponse.data;

    if (!checkoutUrl) {
      throw new Error("Impossible d'obtenir l'URL de paiement de VitePay.");
    }
    
    await session.commitTransaction();
    res.status(201).json({ reservationId: order_id, checkoutUrl });

  } catch (err) {
    await session.abortTransaction();
    console.error('Erreur createReservationAndPay:', err.response?.data || err.message);
    res.status(400).json({ message: err.message });
  } finally {
    session.endSession();
  }
};

// PUBLIC - Récupérer une réservation par ID (pour la page de confirmation)
exports.getReservationByIdPublic = async (req, res) => {
    try {
        const reservation = await Reservation.findById(req.params.id)
            .populate('trajet')
            .populate('client', 'nom prenom email');
        if (!reservation) {
            return res.status(404).json({ message: "Réservation non trouvée" });
        }
        res.json(reservation);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// ADMIN - Obtenir toutes les réservations
exports.getAllReservationsAdmin = async (req, res) => {
  try {
    const list = await Reservation.find().populate("trajet bus client").sort({ dateReservation: -1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ADMIN - Mettre à jour une réservation
exports.updateReservationAdmin = async (req, res) => {
  try {
    const r = await Reservation.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!r) return res.status(404).json({ message: "Réservation non trouvée" });
    res.json(r);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// ADMIN - Supprimer une réservation
exports.deleteReservationAdmin = async (req, res) => {
  try {
    // Logique pour remettre les places disponibles dans le trajet
    const reservation = await Reservation.findById(req.params.id);
    if (reservation) {
        await Trajet.findByIdAndUpdate(reservation.trajet, {
            $inc: { placesDisponibles: reservation.placesReservees }
        });
    }
    const r = await Reservation.findByIdAndDelete(req.params.id);
    if (!r) return res.status(404).json({ message: "Réservation non trouvée" });
    res.json({ message: "Réservation supprimée avec succès" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};