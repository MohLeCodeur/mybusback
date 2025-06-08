// backend/models/LiveTrip.model.js
const mongoose = require('mongoose');

const pointSchema = new mongoose.Schema({
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
}, { _id: false });

const liveTripSchema = new mongoose.Schema({
  // Référence à notre modèle Trajet existant
  trajetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trajet', required: true, unique: true },
  busId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bus', required: true },

  // Informations copiées depuis le Trajet pour un accès rapide
  originCityName: { type: String, required: true },
  destinationCityName: { type: String, required: true },
  departureDateTime: { type: Date, required: true },
  
  // Statut du voyage en temps réel
  status: { 
    type: String, 
    enum: ['À venir', 'En cours', 'Terminé', 'Annulé'], 
    default: 'À venir' 
  },
  
  // Position actuelle du bus
  currentPosition: { type: pointSchema },
  
  // Chemin complet de l'itinéraire (peut être stocké ici)
  routeGeoJSON: { type: Object },

  lastUpdated: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('LiveTrip', liveTripSchema);