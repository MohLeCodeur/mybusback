// backend/models/LiveTrip.model.js
const mongoose = require('mongoose');

const pointSchema = new mongoose.Schema({
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
}, { _id: false });

const liveTripSchema = new mongoose.Schema({
  trajetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trajet', required: true, unique: true },
  busId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bus', required: true },
  
  originCityName: { type: String, required: true },
  destinationCityName: { type: String, required: true },
  departureDateTime: { type: Date, required: true },
  
  status: { type: String, enum: ['À venir', 'En cours', 'Terminé', 'Annulé'], default: 'À venir' },
  currentPosition: { type: pointSchema },
  
  // --- CHAMPS POUR L'ITINÉRAIRE CALCULÉ ---
  routeGeoJSON: { type: Object },
  routeInstructions: [ { instruction: String } ],
  routeSummary: {
      distanceKm: Number,
      durationMin: Number
  },
  // ----------------------------------------
  lastUpdated: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('LiveTrip', liveTripSchema);