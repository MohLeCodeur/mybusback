const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema({
  trajet: { type: mongoose.Schema.Types.ObjectId, ref: 'Trajet', required: true },
  client: {
    nom: { type: String, required: true },
    prenom: { type: String, required: true },
    email: { type: String, required: true },
    telephone: { type: String, required: true }
  },
  placesReservees: { type: Number, required: true, min: 1 },
  dateReservation: { type: Date, default: Date.now },
  statut: { type: String, enum: ['confirmée', 'annulée'], default: 'confirmée' }
});

module.exports = mongoose.model('Reservation', reservationSchema);