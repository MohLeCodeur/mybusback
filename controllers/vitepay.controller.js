// backend/controllers/vitepay.controller.js
const crypto = require('crypto');
const Reservation = require('../models/reservation.model');
const Trajet = require('../models/trajet.model');

exports.handleCallback = async (req, res) => {
  const {
    order_id,
    authenticity,
    success,
    amount_100,
    currency_code
  } = req.body;

  try {
    // 1. Vérifier l'authenticité du callback
    const raw = `${order_id};${amount_100};${currency_code};${process.env.VITEPAY_API_SECRET}`.toUpperCase();
    const expected = crypto.createHash('sha1').update(raw).digest('hex').toUpperCase();

    if (expected !== authenticity) {
      console.warn(`[VitePay] Invalid authenticity for order ${order_id}`);
      return res.status(400).send('Invalid authenticity');
    }

    // 2. Mettre à jour la réservation
    const reservation = await Reservation.findById(order_id);
    if (!reservation) {
        console.error(`[VitePay] Reservation with ID ${order_id} not found.`);
        return res.status(404).send('Reservation not found');
    }

    if (success === '1') {
      // Paiement réussi
      reservation.statut = 'confirmée';
      await reservation.save();
      console.log(`[VitePay] Paiement confirmé pour la réservation ${order_id}`);
    } else {
      // Paiement échoué
      reservation.statut = 'annulée';
      await reservation.save();
      
      // Remettre les places dans le trajet
      await Trajet.findByIdAndUpdate(reservation.trajet, {
          $inc: { placesDisponibles: reservation.placesReservees }
      });
      console.log(`[VitePay] Paiement échoué pour la réservation ${order_id}. Places remises.`);
    }

    // Répondre 200 OK à VitePay pour acquitter la notification
    res.status(200).send('OK');

  } catch (error) {
    console.error(`[VitePay] Erreur lors du traitement du callback pour ${order_id}:`, error);
    // Même en cas d'erreur interne, il est parfois préférable de répondre 200 pour éviter que VitePay ne renvoie la notification en boucle.
    res.status(500).send('Internal Server Error');
  }
};