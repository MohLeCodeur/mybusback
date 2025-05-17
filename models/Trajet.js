const mongoose = require('mongoose');

const trajetSchema = new mongoose.Schema({
  villeDepart: { type: String, required: true },
  villeArrivee: { type: String, required: true },
  compagnie:        { type: String, required: true },
  dateDepart: { type: Date, required: true },
  heureDepart: { type: String, required: true },
  prix: { type: Number, required: true },
  placesDisponibles: { type: Number, required: true },
  bus: {
    numero: { type: String, required: true },
    capacite: { type: Number, required: true }
  }
});

module.exports = mongoose.model('Trajet', trajetSchema);