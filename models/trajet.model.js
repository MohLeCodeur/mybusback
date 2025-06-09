// backend/models/trajet.model.js
const mongoose = require('mongoose');

const trajetSchema = new mongoose.Schema({
  villeDepart: { type: String, required: true },
  villeArrivee: { type: String, required: true },
  compagnie: { type: String, required: true },
  dateDepart: { type: Date, required: true },
  heureDepart: { type: String, required: true },
  prix: { type: Number, required: true },
  placesDisponibles: { type: Number, required: true },
  bus: { type: mongoose.Schema.Types.ObjectId, ref: 'Bus' },
  
  // --- LIGNE MODIFIÉE/AJOUTÉE ---
  // Ce champ est maintenant défini avec une valeur par défaut 'true'.
  // Tout trajet créé sans spécifier 'isActive' sera automatiquement actif.
  isActive: { type: Boolean, default: true }
  
}, { timestamps: true });

module.exports = mongoose.model('Trajet', trajetSchema);