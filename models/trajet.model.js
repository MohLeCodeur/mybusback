// backend/models/trajet.model.js
const mongoose = require('mongoose');

const pointSchema = new mongoose.Schema({
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
}, { _id: false });

const trajetSchema = new mongoose.Schema({
  villeDepart: { type: String, required: true },
  villeArrivee: { type: String, required: true },
  
  // --- CHAMPS GPS AJOUTÉS ---
  coordsDepart: { type: pointSchema, required: true },
  coordsArrivee: { type: pointSchema, required: true },
  // -------------------------

  compagnie: { type: String, required: true },
  dateDepart: { type: Date, required: true },
  heureDepart: { type: String, required: true },
  prix: { type: Number, required: true },
  placesDisponibles: { type: Number, required: true },
  bus: { type: mongoose.Schema.Types.ObjectId, ref: 'Bus' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Trajet', trajetSchema);