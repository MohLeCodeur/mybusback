// backend/controllers/reservation.controller.js
const mongoose = require('mongoose');
const axios = require('axios');
const crypto = require('crypto');
const Reservation = require('../models/reservation.model');
const Trajet = require('../models/trajet.model');

// Définition de l'URL de l'API VitePay en fonction de l'environnement
const VITEPAY_API = process.env.NODE_ENV === 'production'
  ? 'https://api.vitepay.com/v1/prod/payments'
  : 'https://api.vitepay.com/v1/test/payments';

/**
 * @desc    Créer une réservation et initier le paiement VitePay
 * @route   POST /api/reservations
 * @access  Privé (client connecté)
 */
exports.createReservationAndPay = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { trajetId, passagers, contactEmail, contactTelephone } = req.body;
    
    if (!contactEmail || !contactTelephone) {
        throw new Error("L'email et le téléphone de contact sont requis.");
    }

    const placesReservees = passagers.length;
    if (!req.user) {
      return res.status(401).json({ message: 'Utilisateur non authentifié.' });
    }
    const clientId = req.user._id;

    const trajet = await Trajet.findById(trajetId).session(session);
    if (!trajet) throw new Error('Trajet non trouvé');
    if (trajet.placesDisponibles < placesReservees) {
      throw new Error(`Seulement ${trajet.placesDisponibles} places sont disponibles.`);
    }

    const reservation = new Reservation({
      trajet: trajetId,
      client: clientId,
      passagers,
      placesReservees,
      statut: 'en_attente'
    });
    await reservation.save({ session });

    trajet.placesDisponibles -= placesReservees;
    await trajet.save({ session });

    const order_id = reservation._id.toString();
    const montantFCFA = trajet.prix * placesReservees;
    const amount_100 = montantFCFA * 100;
    const callback_url = `${process.env.BACKEND_URL}/api/vitepay/callback`; // Assurez-vous que BACKEND_URL est défini
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
        // --- LIGNE AJOUTÉE ---
        country_code: 'ML', // Code pays pour le Mali
        // ---------------------
        description: `Réservation MyBus #${order_id}`,
        return_url, decline_url, cancel_url, callback_url,
        email: contactEmail,
        buyer_name: `${passagers[0].prenom} ${passagers[0].nom}`,
        buyer_phone_number: contactTelephone,
        buyer_ip_adress: req.ip,
      },
      api_key: process.env.VITEPAY_API_KEY,
      hash,
      redirect: 0,
      ...(process.env.NODE_ENV !== 'production' ? { is_test: 1 } : {})
    };

    const vitepayResponse = await axios.post(VITEPAY_API, payload);
    const checkoutUrl = vitepayResponse.data.redirect_url || vitepayResponse.data;

    if (!checkoutUrl) throw new Error("URL de paiement non reçue de VitePay.");
    
    await session.commitTransaction();
    res.status(201).json({ reservationId: order_id, checkoutUrl });

  } catch (err) {
    await session.abortTransaction();
    console.error('Erreur createReservationAndPay:', err.response?.data?.message || err.message, err.stack);
    res.status(400).json({ message: err.message });
  } finally {
    session.endSession();
  }
};

/**
 * @desc    Récupérer une réservation par son ID (pour la page de confirmation)
 * @route   GET /api/reservations/:id
 * @access  Privé (client connecté)
 */
exports.getReservationByIdPublic = async (req, res) => {
    try {
        const reservation = await Reservation.findById(req.params.id)
            .populate('trajet')
            .populate('client', 'nom prenom email');
        if (!reservation) {
            return res.status(404).json({ message: "Réservation non trouvée" });
        }
        // On vérifie que l'utilisateur qui demande est bien le propriétaire de la réservation ou un admin
        if (reservation.client._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ message: "Accès non autorisé à cette réservation." });
        }
        res.json(reservation);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};


// ===============================================
// SECTION ADMINISTRATEUR
// ===============================================

/**
 * @desc    Obtenir toutes les réservations (pour l'admin)
 * @route   GET /api/admin/reservations/all
 * @access  Admin
 */
exports.getAllReservationsAdmin = async (req, res) => {
  try {
    const list = await Reservation.find()
      .populate('client', 'prenom nom email') // Peuple les infos du client
      .populate({
        path: 'trajet', // Peuple le trajet...
        populate: {
          path: 'bus', // ...et à l'intérieur du trajet, peuple le bus
          model: 'Bus' // Il est bon de spécifier le modèle
        }
      })
      .sort({ dateReservation: -1 });

    res.json(list);
  } catch (err) {
    console.error("Erreur getAllReservationsAdmin:", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * @desc    Mettre à jour une réservation (pour l'admin)
 * @route   PUT /api/admin/reservations/:id
 * @access  Admin
 */
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

/**
 * @desc    Supprimer une réservation (pour l'admin)
 * @route   DELETE /api/admin/reservations/:id
 * @access  Admin
 */
exports.deleteReservationAdmin = async (req, res) => {
  try {
    // Optionnel mais recommandé : remettre les places dans le trajet
    const reservation = await Reservation.findById(req.params.id);
    if (reservation && reservation.statut === 'confirmée') { // On ne remet que si la place était prise
        await Trajet.findByIdAndUpdate(reservation.trajet, {
            $inc: { placesDisponibles: reservation.placesReservees }
        });
    }

    const deletedReservation = await Reservation.findByIdAndDelete(req.params.id);
    if (!deletedReservation) {
      return res.status(404).json({ message: "Réservation non trouvée" });
    }
    res.json({ message: "Réservation supprimée avec succès" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};