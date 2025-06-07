// backend/models/reservation.model.js
const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema({
  trajet: { type: mongoose.Schema.Types.ObjectId, ref: 'Trajet', required: true },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  passagers: [{
    nom: { type: String, required: true },
    prenom: { type: String, required: true },
  }],
  placesReservees: { type: Number, required: true, min: 1 },
  dateReservation: { type: Date, default: Date.now },
  statut: {
    type: String,
    enum: ['en_attente', 'confirmée', 'annulée'],
    default: 'en_attente'
  },
  paymentId: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Reservation', reservationSchema);